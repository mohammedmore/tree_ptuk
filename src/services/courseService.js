import { courses as fallbackCourses } from "../data.ts";
import { normalizeDayKey } from "./scheduleSolver";
import {
  saveCatalogToIndexedDB,
  loadCatalogFromIndexedDB,
  searchCatalogFromIndexedDB,
} from "./catalogDb";

const DEFAULT_API_URL = "http://localhost:3001/api/courses";
const STORAGE_CACHE_KEY = "ptuk_catalog_courses_cache";

function getApiUrl() {
  const env =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env
      : undefined;
  const proc = typeof process !== "undefined" ? process.env : undefined;

  const direct = env?.VITE_API_URL || proc?.VITE_API_URL;
  if (direct) return direct;

  const base = env?.VITE_API_BASE_URL || proc?.VITE_API_BASE_URL;
  if (
    base &&
    !base.includes("localhost:3001") &&
    !base.includes("127.0.0.1:3001")
  ) {
    return `${base.replace(/\/+$/, "")}/api/courses`;
  }

  if (typeof window !== "undefined") {
    return "/api/courses";
  }

  return DEFAULT_API_URL;
}

let coursesCache;
let isOfflineFallbackActive = false;

/**
 * Returns true if the most recent courses were loaded from local storage or static fallback.
 * @returns {boolean}
 */
export function isOfflineCatalog() {
  return isOfflineFallbackActive;
}

/**
 * Clears the in-memory cache so subsequent calls re-fetch or re-evaluate.
 */
export function clearCoursesCache() {
  coursesCache = undefined;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value, fieldName) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`Invalid course response: ${fieldName} is missing.`);
  }
  const text = String(value).trim();
  if (!text) {
    throw new Error(`Invalid course response: ${fieldName} is empty.`);
  }
  return text;
}

function parseBlock(block) {
  if (!isRecord(block) || !Array.isArray(block.days)) {
    throw new Error("Invalid course response: a schedule block is malformed.");
  }
  const { start, end } = block;
  const isOnlineZero = start === 0 && end === 0;
  if (
    typeof start !== "number" ||
    !Number.isFinite(start) ||
    typeof end !== "number" ||
    !Number.isFinite(end) ||
    (!isOnlineZero && end <= start) ||
    !block.days.every((day) => typeof day === "string")
  ) {
    throw new Error(
      "Invalid course response: a schedule block has invalid times or days.",
    );
  }
  const normalizedDays = block.days.map(normalizeDayKey).filter(Boolean);
  return {
    days: normalizedDays.length > 0 ? normalizedDays : block.days,
    start,
    end,
  };
}

function parseSection(section) {
  if (!isRecord(section) || !Array.isArray(section.blocks)) {
    throw new Error("Invalid course response: a section is malformed.");
  }
  return {
    sec: asText(
      section.sec ?? section.section ?? section.sectionNumber,
      "section number",
    ),
    instructor:
      typeof section.instructor === "string" ? section.instructor : undefined,
    room: typeof section.room === "string" ? section.room : undefined,
    status: typeof section.status === "string" ? section.status : undefined,
    building:
      typeof section.building === "string" ? section.building : undefined,
    capacity:
      typeof section.capacity === "number" ? section.capacity : undefined,
    registered:
      typeof section.registered === "number" ? section.registered : undefined,
    isOnline:
      typeof section.isOnline === "boolean" ? section.isOnline : undefined,
    blocks: section.blocks.map(parseBlock),
  };
}

function parseCourse(course) {
  if (!isRecord(course)) {
    throw new Error("Invalid course response: a course entry is malformed.");
  }
  const sections = course.sections;
  if (sections !== undefined && !Array.isArray(sections)) {
    throw new Error("Invalid course response: sections must be an array.");
  }
  return {
    id: asText(course.id ?? course.code ?? course.courseCode, "course code"),
    name: asText(
      course.name ?? course.courseName ?? course.title,
      "course name",
    ),
    type: typeof course.type === "string" ? course.type : undefined,
    category: typeof course.category === "string" ? course.category : undefined,
    color: typeof course.color === "string" ? course.color : undefined,
    sections: sections?.map(parseSection),
  };
}

function parseCourses(payload) {
  const entries = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.courses)
      ? payload.courses
      : isRecord(payload) && Array.isArray(payload.data)
        ? payload.data
        : null;

  if (!entries) {
    throw new Error("Invalid response from the course service.");
  }

  return entries.map(parseCourse);
}

function saveToLocalStorage(data) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore quota or privacy mode errors
  }
}

function loadFromLocalStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const courses = parseCourses(parsed);
        if (courses.length > 0) return courses;
      }
    }
  } catch {
    // Ignore corrupted cache
  }
  return null;
}

function getStaticFallbackCourses() {
  return fallbackCourses.map((course) => ({
    id: course.id,
    name: course.name,
    type: course.category,
    category: course.category,
    sections: [],
  }));
}

function normalizeSearchText(value) {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .trim();
}

async function loadCourses() {
  const url = getApiUrl();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`تعذر تحميل المساقات (HTTP ${response.status}).`);
    }
    const data = await response.json();
    const courses = parseCourses(data);
    if (courses.length > 0) {
      saveToLocalStorage(courses);
      saveCatalogToIndexedDB(courses).catch(() => {});
      isOfflineFallbackActive = false;
      return courses;
    }
    throw new Error("لم يتم العثور على مساقات في الاستجابة.");
  } catch (fetchError) {
    // Attempt graceful fallback: IndexedDB first, then localStorage, then static
    try {
      const idbCourses = await loadCatalogFromIndexedDB();
      if (idbCourses && idbCourses.length > 0) {
        isOfflineFallbackActive = true;
        return idbCourses;
      }
    } catch {
      // Ignore IDB read error and fallback to storage
    }

    const cached = loadFromLocalStorage();
    if (cached && cached.length > 0) {
      isOfflineFallbackActive = true;
      saveCatalogToIndexedDB(cached).catch(() => {});
      return cached;
    }

    const fallback = getStaticFallbackCourses();
    if (fallback.length > 0) {
      isOfflineFallbackActive = true;
      return fallback;
    }

    throw fetchError;
  }
}

/**
 * Gets all available courses and retains the resolved list in memory.
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<import("./scheduleSolver").CatalogCourse[]>}
 */
export function fetchCourses(forceRefresh = false) {
  if (forceRefresh || !coursesCache) {
    coursesCache = loadCourses().catch((error) => {
      coursesCache = undefined;
      throw error;
    });
  }
  return coursesCache;
}

/**
 * Searches course names and codes, case-insensitively, including Arabic variants.
 * @param {string} query
 * @returns {Promise<import("./scheduleSolver").CatalogCourse[]>}
 */
export async function searchCourses(query) {
  const courses = await fetchCourses();
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return courses.slice(0, 15);

  const matches = courses.flatMap((course) => {
    const normalizedId = normalizeSearchText(course.id);
    const normalizedName = normalizeSearchText(course.name);
    const ranks = [
      normalizedId === normalizedQuery ? 0 : Infinity,
      normalizedName === normalizedQuery ? 1 : Infinity,
      normalizedId.startsWith(normalizedQuery) ? 2 : Infinity,
      normalizedName.startsWith(normalizedQuery) ? 3 : Infinity,
      normalizedId.includes(normalizedQuery) ? 4 : Infinity,
      normalizedName.includes(normalizedQuery) ? 5 : Infinity,
    ];
    const rank = Math.min(...ranks);
    return Number.isFinite(rank) ? [{ course, rank }] : [];
  });

  return matches
    .sort((first, second) => first.rank - second.rank)
    .slice(0, 15)
    .map(({ course }) => course);
}

/**
 * Returns full course records, including all sections and meeting blocks, in
 * the order requested. Unknown and duplicate codes are ignored.
 * @param {string[]} codes
 * @returns {Promise<import("./scheduleSolver").CatalogCourse[]>}
 */
export async function fetchCoursesByCodes(codes) {
  if (!Array.isArray(codes)) {
    throw new TypeError("Course codes must be provided as an array.");
  }

  const courses = await fetchCourses();
  const coursesByCode = new Map(courses.map((course) => [course.id, course]));
  const seen = new Set();
  return codes.flatMap((code) => {
    const normalizedCode = String(code).trim();
    let course = coursesByCode.get(normalizedCode);
    if (!course) {
      const staticMatch = fallbackCourses.find((c) => c.id === normalizedCode);
      if (staticMatch) {
        course = {
          id: staticMatch.id,
          name: staticMatch.name,
          type: staticMatch.category,
          category: staticMatch.category,
          sections: [],
        };
      }
    }
    if (!course || seen.has(normalizedCode)) return [];
    seen.add(normalizedCode);
    return [course];
  });
}
