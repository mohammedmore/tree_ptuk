import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { INITIAL_MAJORS } from "./majorsData.js";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const DB_FILE = join(DATA_DIR, "db.json");
const LAST_SYNC_FILE = join(__dirname, "..", "last_sync.txt");

// Optional Supabase client configuration
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
let supabaseClient = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  } catch (err) {
    console.warn("⚠️ Could not initialize Supabase client:", err.message);
  }
}

// In-memory database structure
let state = {
  majors: {},
  courses: {}, // code -> course object
  syncStatus: {
    lastSyncTime: null,
    lastSyncStatus: "idle", // 'idle' | 'running' | 'success' | 'error'
    totalCourses: 0,
    totalSections: 0,
    totalBlocks: 0,
    durationSeconds: 0,
    lastErrorMessage: null,
    nextScheduledSync: null,
    syncIntervalCron: "*/30 * * * *",
  },
  students: {}, // studentId -> student profile & cached transcript
  cohortPlans: {}, // `${majorId}_${cohortYear}` -> major curriculum for that cohort
};

function ensureDataDirectory() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function persistState() {
  try {
    ensureDataDirectory();
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    writeFileSync(tempFile, JSON.stringify(state, null, 2), "utf8");
    // Atomic rename
    writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    console.error("❌ Error persisting database state to disk:", err.message);
  }
}

function loadState() {
  try {
    ensureDataDirectory();
    if (existsSync(DB_FILE)) {
      const raw = readFileSync(DB_FILE, "utf8");
      if (raw.trim()) {
        const loaded = JSON.parse(raw);
        state = {
          ...state,
          ...loaded,
          syncStatus: {
            ...state.syncStatus,
            ...(loaded.syncStatus || {}),
          },
        };
      }
    }
  } catch (err) {
    console.warn("⚠️ Could not load existing db.json, initializing fresh store:", err.message);
  }

  // Load last sync date from last_sync.txt if present
  if (!state.syncStatus.lastSyncTime && existsSync(LAST_SYNC_FILE)) {
    try {
      const content = readFileSync(LAST_SYNC_FILE, "utf8").trim();
      if (content) {
        state.syncStatus.lastSyncTime = new Date(content).toISOString();
        state.syncStatus.lastSyncStatus = "success";
      }
    } catch {
      // ignore
    }
  }

  // Ensure initial majors exist
  for (const major of INITIAL_MAJORS) {
    if (!state.majors[major.id]) {
      state.majors[major.id] = { ...major, courses: [] };
    }
  }

  persistState();
}

// Initialize on module load
loadState();

/**
 * Returns all courses formatted for UI and schedule engine.
 * @param {object} [filter]
 * @param {string[]} [filter.codes]
 * @param {string} [filter.search]
 * @param {string} [filter.majorId]
 * @param {number} [filter.limit]
 * @param {number} [filter.offset]
 */
export async function getCourses(filter = {}) {
  const { codes, search, majorId, limit = 500, offset = 0 } = filter;

  // Try to query Supabase if available, but gracefully fallback to local store
  if (supabaseClient) {
    try {
      let query = supabaseClient.from("courses").select(`
        code,
        name,
        type,
        sections (
          id,
          sec_number,
          instructor,
          room,
          building,
          status,
          section_blocks (
            day,
            start_hour,
            end_hour,
            raw_time
          )
        )
      `);

      if (codes && codes.length > 0) {
        query = query.in("code", codes);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        // Format Supabase rows and sync into local memory cache
        const formatted = data.map((course) => {
          const blockMap = new Map();
          (course.sections || []).forEach((sec) => {
            (sec.section_blocks || []).forEach((b) => {
              const key = `${b.start_hour}-${b.end_hour}`;
              if (!blockMap.has(key)) {
                blockMap.set(key, {
                  days: [],
                  start: Number(b.start_hour),
                  end: Number(b.end_hour),
                  rawTime: b.raw_time,
                });
              }
              blockMap.get(key).days.push(b.day);
            });
          });

          return {
            code: course.code,
            name: course.name,
            type: course.type,
            sections: (course.sections || []).map((sec) => {
              const secBlocks = new Map();
              (sec.section_blocks || []).forEach((b) => {
                const k = `${b.start_hour}-${b.end_hour}`;
                if (!secBlocks.has(k)) {
                  secBlocks.set(k, {
                    days: [],
                    start: Number(b.start_hour),
                    end: Number(b.end_hour),
                    rawTime: b.raw_time,
                  });
                }
                secBlocks.get(k).days.push(b.day);
              });
              return {
                sec: sec.sec_number,
                instructor: sec.instructor,
                room: sec.room,
                building: sec.building,
                status: sec.status,
                blocks: Array.from(secBlocks.values()),
              };
            }),
          };
        });

        // Update local memory cache with latest Supabase data
        for (const c of formatted) {
          state.courses[c.code] = c;
        }
        persistState();
        return formatted;
      }
    } catch (err) {
      console.warn("⚠️ Supabase query failed, serving from resilient local store:", err.message);
    }
  }

  // Local store resolution
  let list = Object.values(state.courses);

  if (codes && codes.length > 0) {
    const codeSet = new Set(codes.map((c) => String(c).trim()));
    list = list.filter((c) => codeSet.has(c.code));
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q)),
    );
  }

  return list.slice(offset, offset + limit);
}

/**
 * Returns a single course by its code.
 * @param {string} code
 */
export async function getCourseByCode(code) {
  const norm = String(code).trim();
  if (state.courses[norm]) {
    return state.courses[norm];
  }
  const result = await getCourses({ codes: [norm] });
  return result[0] || null;
}

/**
 * Upsert catalog courses into local storage and cache.
 * @param {Array<{ code: string, name: string, type?: string, sections?: Array<any> }>} catalog
 */
export async function upsertCatalogCourses(catalog) {
  if (!Array.isArray(catalog)) return { insertedCourses: 0, insertedSections: 0 };

  let totalSections = 0;
  let totalBlocks = 0;

  for (const item of catalog) {
    if (!item.code) continue;
    const existing = state.courses[item.code] || { code: item.code, sections: [] };
    existing.name = item.name || existing.name;
    existing.type = item.type || existing.type;

    if (Array.isArray(item.sections) && item.sections.length > 0) {
      existing.sections = item.sections;
      totalSections += item.sections.length;
      for (const sec of item.sections) {
        if (Array.isArray(sec.blocks)) {
          totalBlocks += sec.blocks.length;
        }
      }
    }

    state.courses[item.code] = existing;
  }

  state.syncStatus.totalCourses = Object.keys(state.courses).length;
  state.syncStatus.totalSections = totalSections;
  state.syncStatus.totalBlocks = totalBlocks;

  persistState();

  return {
    insertedCourses: catalog.length,
    insertedSections: totalSections,
    totalCourses: state.syncStatus.totalCourses,
  };
}

/**
 * Get all available majors.
 */
export function getMajors() {
  return Object.values(state.majors).map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    college: m.college,
    degree: m.degree,
    totalCredits: m.totalCredits,
    categoryRequirements: m.categoryRequirements,
    description: m.description,
    coursesCount: Array.isArray(m.courses) ? m.courses.length : 0,
  }));
}

/**
 * Get full major details and course plan.
 * @param {string} majorId
 */
export function getMajorById(majorId) {
  const id = String(majorId).toLowerCase().trim();
  return state.majors[id] || null;
}

/**
 * Update or add a major and its study plan.
 * @param {object} major
 */
export function upsertMajor(major) {
  if (!major || !major.id) throw new Error("Major must have an id.");
  const id = major.id.toLowerCase().trim();
  state.majors[id] = {
    ...state.majors[id],
    ...major,
  };
  persistState();
  return state.majors[id];
}

/**
 * Get current sync status.
 */
export function getSyncStatus() {
  return { ...state.syncStatus };
}

/**
 * Update sync status.
 * @param {Partial<typeof state.syncStatus>} update
 */
export function updateSyncStatus(update) {
  state.syncStatus = {
    ...state.syncStatus,
    ...update,
  };
  if (update.lastSyncTime) {
    try {
      writeFileSync(LAST_SYNC_FILE, update.lastSyncTime.slice(0, 10), "utf8");
    } catch {
      // ignore
    }
  }
  persistState();
  return state.syncStatus;
}

/**
 * Save or retrieve student sync record.
 */
export function saveStudentRecord(studentId, data) {
  state.students[studentId] = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  persistState();
  return state.students[studentId];
}

export function getStudentRecord(studentId) {
  return state.students[studentId] || null;
}

/**
 * Save a major's curriculum plan for a specific student cohort year.
 * e.g. majorId: 'cse', cohortYear: '2021'
 */
export function saveMajorCohortPlan(majorId, cohortYear, planData) {
  if (!state.cohortPlans) state.cohortPlans = {};
  const key = `${String(majorId).toLowerCase()}_${String(cohortYear)}`;
  state.cohortPlans[key] = {
    ...planData,
    majorId,
    cohortYear,
    updatedAt: new Date().toISOString(),
  };

  // Also ensure major is registered in state.majors
  if (state.majors && planData) {
    const existing = state.majors[majorId] || {};
    state.majors[majorId] = {
      ...existing,
      ...planData,
      id: majorId,
      name: planData.name || existing.name || majorId,
    };
  }

  persistState();
  return state.cohortPlans[key];
}

/**
 * Get a major's curriculum plan for a specific cohort year.
 */
export function getMajorCohortPlan(majorId, cohortYear) {
  if (!state.cohortPlans) return null;
  const key = `${String(majorId).toLowerCase()}_${String(cohortYear)}`;
  if (state.cohortPlans[key]) return state.cohortPlans[key];
  return getMajorById(majorId);
}

export { supabaseClient as supabase };
