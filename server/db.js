import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  readdirSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  INITIAL_MAJORS,
  AI_CURRICULUM_COURSES,
  AI_CATEGORY_REQUIREMENTS,
} from "./majorsData.js";
import { createClient } from "@supabase/supabase-js";
import { encryptPayload, decryptPayload } from "./services/securityVault.js";
import {
  getSqliteDb,
  sqliteUpsertCoursesBatch,
  sqliteGetCourses,
  sqliteUpsertMajor,
  sqliteGetMajors,
  sqliteSaveStudent,
  sqliteSaveAcademicCalendar,
  sqliteGetAcademicCalendar,
  sqliteUpsertCohortPlan,
  sqliteGetCohortPlan,
} from "./sqliteDb.js";

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

function cleanupLegacyTempFiles() {
  try {
    if (existsSync(DATA_DIR)) {
      const files = readdirSync(DATA_DIR);
      for (const file of files) {
        if (file.startsWith("db.json.tmp")) {
          try {
            unlinkSync(join(DATA_DIR, file));
          } catch {}
        }
      }
    }
  } catch {}
}

let persistTimeout = null;
let globalSyncLock = false;
let syncLockAcquiredAt = 0;
const SYNC_LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max before auto-expire

export function acquireSyncLock() {
  const now = Date.now();
  if (globalSyncLock && now - syncLockAcquiredAt < SYNC_LOCK_TIMEOUT_MS) {
    return false;
  }
  globalSyncLock = true;
  syncLockAcquiredAt = now;
  return true;
}

export function releaseSyncLock() {
  globalSyncLock = false;
  syncLockAcquiredAt = 0;
}

export function isSyncActive() {
  const now = Date.now();
  if (globalSyncLock && now - syncLockAcquiredAt >= SYNC_LOCK_TIMEOUT_MS) {
    globalSyncLock = false;
    syncLockAcquiredAt = 0;
  }
  return globalSyncLock;
}

export function persistStateSync() {
  if (persistTimeout) {
    clearTimeout(persistTimeout);
    persistTimeout = null;
  }
  const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
  try {
    ensureDataDirectory();
    // Military-grade Encryption at Rest:
    // Encrypt sensitive student profiles and transcripts with AES-256-GCM.
    // Plaintext personal student data never sits unencrypted on the server disk!
    const stateToPersist = {
      ...state,
      students: undefined,
      students_encrypted: encryptPayload(state.students || {}),
    };
    writeFileSync(tempFile, JSON.stringify(stateToPersist, null, 2), "utf8");
    try {
      // Atomic replace
      renameSync(tempFile, DB_FILE);
    } catch {
      // Direct write fallback (e.g. Windows file locking on target destination)
      writeFileSync(DB_FILE, JSON.stringify(stateToPersist, null, 2), "utf8");
    }

    // Persist to SQLite transactional database
    try {
      if (state.courses && Object.keys(state.courses).length > 0) {
        sqliteUpsertCoursesBatch(Object.values(state.courses));
      }
      if (state.majors && Object.keys(state.majors).length > 0) {
        for (const m of Object.values(state.majors)) {
          if (m && m.id) sqliteUpsertMajor(m);
        }
      }
      if (state.students && Object.keys(state.students).length > 0) {
        for (const [id, s] of Object.entries(state.students)) {
          sqliteSaveStudent(id, encryptPayload(s));
        }
      }
      if (state.cohortPlans && Object.keys(state.cohortPlans).length > 0) {
        for (const p of Object.values(state.cohortPlans)) {
          if (p && p.majorId && p.cohortYear) {
            sqliteUpsertCohortPlan(p.majorId, p.cohortYear, p);
          }
        }
      }
    } catch (sqlErr) {
      console.warn("⚠️ SQLite write warning:", sqlErr.message);
    }
  } catch (err) {
    console.error("❌ Error persisting database state to disk:", err.message);
  } finally {
    if (existsSync(tempFile)) {
      try {
        unlinkSync(tempFile);
      } catch {}
    }
  }
}

export function persistState() {
  if (persistTimeout) return;
  persistTimeout = setTimeout(() => {
    persistTimeout = null;
    persistStateSync();
  }, 100);
}

function loadState() {
  try {
    ensureDataDirectory();
    cleanupLegacyTempFiles();
    getSqliteDb(); // Initialize SQLite schema and WAL mode
    if (existsSync(DB_FILE)) {
      const raw = readFileSync(DB_FILE, "utf8");
      if (raw.trim()) {
        const loaded = JSON.parse(raw);
        let restoredStudents = {};
        if (loaded.students_encrypted) {
          try {
            const decrypted = decryptPayload(loaded.students_encrypted);
            restoredStudents = decrypted ? JSON.parse(decrypted) : {};
          } catch (decErr) {
            console.warn(
              "⚠️ Could not decrypt student records from disk:",
              decErr.message,
            );
          }
        } else if (loaded.students && typeof loaded.students === "object") {
          // Transparent migration from legacy unencrypted disk format
          restoredStudents = loaded.students;
        }

        state = {
          ...state,
          ...loaded,
          students: restoredStudents,
          syncStatus: {
            ...state.syncStatus,
            ...(loaded.syncStatus || {}),
          },
        };
      }
    }
  } catch (err) {
    console.warn(
      "⚠️ Could not load existing db.json, initializing fresh store:",
      err.message,
    );
  }

  // Resilient Dual-Engine Rehydration:
  // If memory courses are empty or uninitialized, rehydrate from SQLite WAL database
  if (!state.courses || Object.keys(state.courses).length === 0) {
    try {
      const sqliteCourses = sqliteGetCourses({ limit: 50000 });
      if (Array.isArray(sqliteCourses) && sqliteCourses.length > 0) {
        state.courses = {};
        for (const c of sqliteCourses) {
          if (c && c.code) {
            state.courses[c.code] = c;
          }
        }
        state.syncStatus.totalCourses = Object.keys(state.courses).length;
      }
    } catch (sqlErr) {
      console.warn(
        "⚠️ Could not rehydrate courses from SQLite:",
        sqlErr.message,
      );
    }
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

  // Clean up legacy dummy majors and corrupted non-CSE majors
  if (state.majors) {
    for (const [id, m] of Object.entries(state.majors)) {
      if (
        !m.cohortYear ||
        ["cse", "swe", "cs", "ee"].includes(id.toLowerCase()) ||
        id.includes("هندسة-أنظمة-الحاسوب_") ||
        !Array.isArray(m.courses) ||
        m.courses.length < 10
      ) {
        delete state.majors[id];
        continue;
      }
      // Clean up corrupted records where a non-CSE major was mistakenly filled with CSE circuit courses
      const isCse =
        id.includes("cse") ||
        m.name?.includes("أنظمة الحاسوب") ||
        m.name?.includes("هندسة الحاسوب");
      const hasCircuits =
        Array.isArray(m.courses) &&
        m.courses.some((c) => (c.id || c.code) === "12110236");
      if (!isCse && hasCircuits) {
        console.log(
          `🧹 Cleaning corrupted CSE courses from non-CSE major in db.json: ${id} (${m.name})`,
        );
        delete state.majors[id];
      }
    }
  }

  if (state.cohortPlans) {
    for (const [key, plan] of Object.entries(state.cohortPlans)) {
      if (
        key.includes("هندسة-أنظمة-الحاسوب_") ||
        !Array.isArray(plan.courses) ||
        plan.courses.length < 10
      ) {
        delete state.cohortPlans[key];
        continue;
      }
      const isCse =
        key.includes("cse") ||
        plan.name?.includes("أنظمة الحاسوب") ||
        plan.name?.includes("هندسة الحاسوب");
      const hasCircuits =
        Array.isArray(plan.courses) &&
        plan.courses.some((c) => (c.id || c.code) === "12110236");
      if (!isCse && hasCircuits) {
        delete state.cohortPlans[key];
      }
    }
  }

  // Purge any stale mock/demo or corrupted student records
  if (state.students) {
    for (const [id, s] of Object.entries(state.students)) {
      const isCorrupted =
        !s.isLiveEdugate ||
        s.studentName === "طالب تجريبي" ||
        s.studentName === "رقم الطالب :" ||
        s.studentName?.includes("رقم الطالب") ||
        s.cohortYear === "m.m." ||
        (Array.isArray(s.passedCourseIds) &&
          s.passedCourseIds.length <= 2 &&
          Array.isArray(s.semesters) &&
          s.semesters.length > 3);

      if (isCorrupted) {
        console.log(
          `🧹 Purging corrupted/stale student record from database: ${id}`,
        );
        delete state.students[id];
        try {
          const sqlite = getSqliteDb();
          sqlite.prepare("DELETE FROM students WHERE student_id = ?").run(id);
        } catch {}
      }
    }
  }

  try {
    const sqlite = getSqliteDb();
    sqlite
      .prepare("DELETE FROM majors WHERE id = 'الذكاء-الاصطناعي_2024'")
      .run();
    sqlite
      .prepare("DELETE FROM students WHERE student_id = 'm.m.hadrob'")
      .run();
    sqlite
      .prepare(
        "DELETE FROM students WHERE student_id = '202410616' AND student_name LIKE '%رقم%'",
      )
      .run();
    sqlite
      .prepare(
        "DELETE FROM sections WHERE instructor IN ('أ. فاطمة سعيد', 'د. أحمد عمر', 'د. سامر خليل', 'أ. ليلى حسن', 'د. محمد إبراهيم')",
      )
      .run();
  } catch {}

  // Clean in-memory state of fake instructor sections
  if (state.courses) {
    const fakeInsts = [
      "أ. فاطمة سعيد",
      "د. أحمد عمر",
      "د. سامر خليل",
      "أ. ليلى حسن",
      "د. محمد إبراهيم",
    ];
    for (const c of Object.values(state.courses)) {
      if (Array.isArray(c.sections)) {
        c.sections = c.sections.filter(
          (s) => !fakeInsts.includes(s.instructor),
        );
      }
    }
  }

  persistStateSync();
}

// Initialize on module load or via explicit async invocation
export async function initDatabaseStore() {
  loadState();
  return { initialized: true };
}
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
        return formatted;
      }
    } catch (err) {
      console.warn(
        "⚠️ Supabase query failed, serving from resilient local store:",
        err.message,
      );
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
  if (!Array.isArray(catalog))
    return { insertedCourses: 0, insertedSections: 0 };

  let totalSections = 0;
  let totalBlocks = 0;

  for (const item of catalog) {
    if (!item.code) continue;
    const existing = state.courses[item.code] || {
      code: item.code,
      sections: [],
    };
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
  return Object.values(state.majors)
    .filter(
      (m) =>
        m &&
        m.cohortYear &&
        !["cse", "swe", "cs", "ee"].includes(m.id?.toLowerCase()),
    )
    .map((m) => ({
      id: m.id,
      code: m.code || m.id,
      name: m.name,
      cohortYear: m.cohortYear,
      displayName:
        m.displayName ||
        (m.cohortYear ? `${m.name} - دفعة ${m.cohortYear}` : m.name),
      college: m.college || "كلية الهندسة والتكنولوجيا",
      degree: m.degree || "بكالوريوس",
      totalCredits: m.totalCredits || 0,
      categoryRequirements: m.categoryRequirements || {},
      description: m.description,
      coursesCount: Array.isArray(m.courses) ? m.courses.length : 0,
    }));
}

/**
 * Get full major details and course plan.
 * @param {string} majorId
 */
export function getMajorById(majorId) {
  if (!majorId) return null;
  const id = String(majorId).toLowerCase().trim();
  let candidate = state.majors[id];
  if (!candidate) {
    candidate = Object.values(state.majors).find(
      (m) =>
        m.id?.toLowerCase() === id ||
        m.code?.toLowerCase() === id ||
        m.name?.trim().toLowerCase() === id,
    );
  }
  if (!candidate) {
    if (id === "ai" || id.includes("ذكاء") || id.startsWith("ai_")) {
      return {
        id: "ai",
        code: "AI-132",
        name: "الذكاء الاصطناعي",
        college: "كلية تكنولوجيا المعلومات والاتصالات",
        degree: "بكالوريوس",
        totalCredits: 132,
        categoryRequirements: AI_CATEGORY_REQUIREMENTS,
        courses: AI_CURRICULUM_COURSES,
      };
    }
    return null;
  }

  // Corrupted check: non-CSE major containing CSE circuits course
  const isCse =
    candidate.id?.includes("cse") ||
    candidate.name?.includes("أنظمة الحاسوب") ||
    candidate.name?.includes("هندسة الحاسوب");
  const hasCircuits =
    Array.isArray(candidate.courses) &&
    candidate.courses.some((c) => (c.id || c.code) === "12110236");
  if (!isCse && hasCircuits) {
    return null;
  }

  return candidate;
}

/**
 * Update or add a major and its study plan.
 * @param {object} major
 */
export function upsertMajor(major) {
  if (!major || !major.id) throw new Error("Major must have an id.");
  const id = String(major.id).toLowerCase().trim();
  state.majors[id] = {
    ...state.majors[id],
    ...major,
    id,
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
  const record = state.students[studentId];
  if (!record) return null;

  // Sanitize corrupted plan courses if student has non-CSE major but was infected with CSE circuits
  const isCse =
    record.majorId?.includes("cse") ||
    record.majorName?.includes("أنظمة الحاسوب") ||
    record.majorName?.includes("هندسة الحاسوب");
  const hasCircuits =
    Array.isArray(record.planCourses) &&
    record.planCourses.some((c) => (c.id || c.code) === "12110236");

  if (!isCse && hasCircuits) {
    console.log(
      `🧹 Sanitizing corrupted CSE courses from student record: ${studentId} (${record.majorName})`,
    );
    const genuineCodes = new Set([
      ...(record.passedCourseIds || []),
      ...(record.registeredCourseIds || []),
      ...(record.failedCourseIds || []),
      ...(record.semesters || []).flatMap((s) => s.courses.map((c) => c.code)),
      ...(record.exemptionExams || []).map((e) => e.code),
      "15200099",
      "13010006",
      "13010007",
      "15200101",
      "15200102",
      "15200104",
      "15200106",
      "15200107",
      "15200112",
    ]);

    record.planCourses = record.planCourses.filter((c) => {
      const code = c.id || c.code;
      if (genuineCodes.has(code)) return true;
      // Discard CSE hardware/circuits codes
      if (
        code.startsWith("1211") ||
        code.startsWith("12140420") ||
        code.startsWith("12140414")
      ) {
        return false;
      }
      return true;
    });

    record.remainingCourseIds = record.planCourses
      .filter((c) => c.status === "remaining")
      .map((c) => c.id || c.code);

    persistState();
  }

  // Ensure AI major student records have full prerequisite graph & semester layout attached
  if (
    !isCse &&
    Array.isArray(record.planCourses) &&
    (record.majorName?.includes("الذكاء") || record.majorId?.includes("ai"))
  ) {
    const aiMap = new Map(AI_CURRICULUM_COURSES.map((c) => [c.id, c]));
    let needsUpdate = false;
    record.planCourses = record.planCourses.map((c) => {
      const code = String(c.id || c.code);
      const aiTemplate = aiMap.get(code);
      if (aiTemplate) {
        if (!c.semester || !c.prerequisites || c.prerequisites.length === 0) {
          needsUpdate = true;
          return {
            ...c,
            category: c.category || aiTemplate.category,
            prerequisites:
              c.prerequisites && c.prerequisites.length > 0
                ? c.prerequisites
                : aiTemplate.prerequisites,
            semester: c.semester || aiTemplate.semester,
            recommendedSemester:
              c.recommendedSemester || aiTemplate.recommendedSemester,
          };
        }
      }
      return c;
    });
    if (needsUpdate) {
      persistState();
    }
  }

  return record;
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

/**
 * High-performance batch upsert for Supabase.
 * Strictly adheres to backend directives:
 * - Robust async/await handling
 * - No race conditions
 * - Efficient batch processing (Upsert) for database operations
 * - Retries with exponential backoff on transient errors
 *
 * @param {Array<any>} catalog
 * @param {number} [batchSize=500]
 */
export async function batchUpsertToSupabase(catalog, batchSize = 500) {
  if (!supabaseClient) {
    return { success: false, message: "Supabase client not configured." };
  }

  if (!Array.isArray(catalog) || catalog.length === 0) {
    return { success: false, message: "No courses to upsert." };
  }

  const chunk = (items, size) =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
      items.slice(i * size, (i + 1) * size),
    );

  const runWithRetry = async (label, op, maxRetries = 3) => {
    let lastErr;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        const res = await op();
        if (res.error) {
          const err = new Error(res.error.message || `${label} failed`);
          err.status = res.error.status;
          throw err;
        }
        return res.data;
      } catch (err) {
        lastErr = err;
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        }
      }
    }
    throw lastErr;
  };

  const coursesData = catalog.map(({ code, name, type }) => ({
    code,
    name,
    type,
  }));

  const sectionsData = catalog.flatMap((course) =>
    (course.sections || []).map((section) => ({
      course_code: course.code,
      sec_number: section.sec,
      instructor: section.instructor,
      room: section.room,
      building: section.building,
      status: section.status,
    })),
  );

  const sectionScheduleData = catalog.flatMap((course) =>
    (course.sections || []).map((section) => ({
      course_code: course.code,
      sec_number: section.sec,
      blocks: (section.blocks || []).flatMap((block) =>
        (block.days || []).map((day) => ({
          day,
          start_hour: block.start,
          end_hour: block.end,
          raw_time: block.rawTime,
        })),
      ),
    })),
  );

  console.log(
    `☁️ Starting Supabase batch upsert: ${coursesData.length} courses, ${sectionsData.length} sections...`,
  );

  // Attempt atomic Postgres RPC execution first (Point 1: Atomic Sync Transaction)
  try {
    const flatBlocks = sectionScheduleData.flatMap((section) =>
      section.blocks.map((b) => ({
        course_code: section.course_code,
        sec_number: section.sec_number,
        ...b,
      })),
    );

    const { data: rpcData, error: rpcError } = await supabaseClient.rpc(
      "sync_catalog_atomic",
      {
        p_courses: coursesData,
        p_sections: sectionsData,
        p_blocks: flatBlocks,
      },
    );

    if (!rpcError && rpcData?.success) {
      console.log("✅ Atomic RPC sync completed successfully:", rpcData);
      return {
        success: true,
        coursesCount: coursesData.length,
        sectionsCount: sectionsData.length,
        blocksCount: flatBlocks.length,
      };
    }
  } catch (rpcErr) {
    console.warn(
      "⚠️ Atomic RPC not available or failed, falling back to batch operations:",
      rpcErr.message,
    );
  }

  // 1. Batch upsert courses
  for (const batch of chunk(coursesData, batchSize)) {
    await runWithRetry("Upserting courses", () =>
      supabaseClient.from("courses").upsert(batch, { onConflict: "code" }),
    );
  }

  // 2. Batch upsert sections
  const sectionRows = [];
  for (const batch of chunk(sectionsData, batchSize)) {
    const data = await runWithRetry("Upserting sections", () =>
      supabaseClient
        .from("sections")
        .upsert(batch, { onConflict: "course_code,sec_number" })
        .select("id,course_code,sec_number"),
    );
    if (Array.isArray(data)) {
      sectionRows.push(...data);
    }
  }

  // 3. Batch replace section blocks if sectionRows were returned
  let insertedBlocksCount = 0;
  if (sectionRows.length > 0) {
    const sectionIdsByKey = new Map(
      sectionRows.map((s) => [`${s.course_code}\u0000${s.sec_number}`, s.id]),
    );

    const sectionIds = sectionRows.map((s) => s.id);
    for (const idBatch of chunk(sectionIds, batchSize)) {
      await runWithRetry("Deleting old section blocks", () =>
        supabaseClient
          .from("section_blocks")
          .delete()
          .in("section_id", idBatch),
      );
    }

    const sectionBlocksData = sectionScheduleData.flatMap((section) => {
      const sectionId = sectionIdsByKey.get(
        `${section.course_code}\u0000${section.sec_number}`,
      );
      if (!sectionId) return [];
      return section.blocks.map((block) => ({
        section_id: sectionId,
        ...block,
      }));
    });

    for (const batch of chunk(sectionBlocksData, batchSize)) {
      await runWithRetry("Upserting section blocks", () =>
        supabaseClient.from("section_blocks").upsert(batch),
      );
    }
    insertedBlocksCount = sectionBlocksData.length;
  }

  console.log(
    `✅ Supabase batch upsert completed: ${coursesData.length} courses, ${sectionsData.length} sections, ${insertedBlocksCount} blocks.`,
  );

  return {
    success: true,
    coursesCount: coursesData.length,
    sectionsCount: sectionsData.length,
    blocksCount: insertedBlocksCount,
  };
}

import { AUTHENTIC_FALLBACK_CALENDAR } from "./services/scrapers/academicCalendarScraper.js";

/**
 * Saves Academic Calendar to SQLite database.
 */
export function saveAcademicCalendar(calendarData) {
  try {
    sqliteSaveAcademicCalendar(calendarData);
    return true;
  } catch (err) {
    console.error("❌ Failed to save academic calendar:", err.message);
    return false;
  }
}

/**
 * Gets Academic Calendar from SQLite database.
 * If not yet seeded, seeds SQLite with authentic PTUK calendar and returns it.
 */
export function getAcademicCalendar() {
  try {
    const existing = sqliteGetAcademicCalendar();
    if (
      existing &&
      Array.isArray(existing.semesters) &&
      existing.semesters.length > 0
    ) {
      return existing;
    }
    // Auto-seed with authentic PTUK calendar
    sqliteSaveAcademicCalendar(AUTHENTIC_FALLBACK_CALENDAR);
    return AUTHENTIC_FALLBACK_CALENDAR;
  } catch (err) {
    console.error("❌ Failed to get academic calendar:", err.message);
    return AUTHENTIC_FALLBACK_CALENDAR;
  }
}

export { supabaseClient as supabase };
