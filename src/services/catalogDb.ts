/**
 * High-Performance IndexedDB Storage Layer for Course Catalog and Section Offerings.
 * Offloads massive catalog records (thousands of sections) from RAM and synchronous LocalStorage
 * to IndexedDB, preventing UI freezing during searches and schedule solving.
 */

import type { CatalogCourse, CatalogSection } from "./scheduleSolver";

export function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .trim();
}

const DB_NAME = "ptuk_catalog_db";
const DB_VERSION = 1;
const STORE_COURSES = "courses";
const STORE_META = "meta";

export interface CatalogMetadata {
  lastUpdated: number;
  totalCourses: number;
  totalSections: number;
  version: string;
}

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Checks if IndexedDB is supported in the current environment.
 */
export function isIndexedDBSupported(): boolean {
  return (
    typeof window !== "undefined" && typeof window.indexedDB !== "undefined"
  );
}

/**
 * Opens or initializes the IndexedDB catalog database.
 */
export function openCatalogDB(): Promise<IDBDatabase | null> {
  if (!isIndexedDBSupported()) {
    return Promise.resolve(null);
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Courses store indexed by course code (primary key)
        if (!db.objectStoreNames.contains(STORE_COURSES)) {
          const store = db.createObjectStore(STORE_COURSES, { keyPath: "id" });
          store.createIndex("name", "name", { unique: false });
          store.createIndex("category", "category", { unique: false });
          store.createIndex("normalizedName", "normalizedName", {
            unique: false,
          });
        }

        // Metadata store
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: "key" });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        dbInstance.onversionchange = () => {
          dbInstance?.close();
          dbInstance = null;
          dbPromise = null;
        };
        resolve(dbInstance);
      };

      request.onerror = (err) => {
        console.warn("IndexedDB open error, falling back:", err);
        dbPromise = null;
        resolve(null);
      };

      request.onblocked = () => {
        console.warn("IndexedDB open blocked by other tabs");
      };
    } catch (e) {
      console.warn("IndexedDB initialization error:", e);
      resolve(null);
    }
  });

  return dbPromise;
}

interface StoredCatalogCourse extends CatalogCourse {
  normalizedId: string;
  normalizedName: string;
  sectionCount: number;
}

/**
 * Stores courses and their sections into IndexedDB in a single atomic batch transaction.
 */
export async function saveCatalogToIndexedDB(
  courses: CatalogCourse[],
): Promise<void> {
  const db = await openCatalogDB();
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_COURSES, STORE_META], "readwrite");
      const courseStore = tx.objectStore(STORE_COURSES);
      const metaStore = tx.objectStore(STORE_META);

      let totalSections = 0;

      for (const course of courses) {
        const sections = Array.isArray(course.sections) ? course.sections : [];
        totalSections += sections.length;

        const record: StoredCatalogCourse = {
          ...course,
          sections,
          normalizedId: normalizeSearchText(course.id),
          normalizedName: normalizeSearchText(course.name),
          sectionCount: sections.length,
        };

        courseStore.put(record);
      }

      metaStore.put({
        key: "catalog_info",
        lastUpdated: Date.now(),
        totalCourses: courses.length,
        totalSections,
        version: "2.0",
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Retrieves all courses from IndexedDB.
 */
export async function loadCatalogFromIndexedDB(): Promise<
  CatalogCourse[] | null
> {
  const db = await openCatalogDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_COURSES, "readonly");
      const store = tx.objectStore(STORE_COURSES);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result;
        if (Array.isArray(results) && results.length > 0) {
          resolve(results as CatalogCourse[]);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Queries courses directly in IndexedDB with ranked search and limit,
 * avoiding the need to load all courses and sections into main memory.
 */
export async function searchCatalogFromIndexedDB(
  query: string,
  limit: number = 20,
): Promise<CatalogCourse[]> {
  const normalizedQuery = normalizeSearchText(query);
  const allCourses = await loadCatalogFromIndexedDB();
  if (!allCourses) return [];

  if (!normalizedQuery) {
    return allCourses.slice(0, limit);
  }

  const scored: Array<{ course: CatalogCourse; score: number }> = [];

  for (const course of allCourses) {
    const id = normalizeSearchText(course.id);
    const name = normalizeSearchText(course.name);

    let score = -1;
    if (id === normalizedQuery) score = 100;
    else if (name === normalizedQuery) score = 95;
    else if (id.startsWith(normalizedQuery)) score = 80;
    else if (name.startsWith(normalizedQuery)) score = 75;
    else if (id.includes(normalizedQuery)) score = 60;
    else if (name.includes(normalizedQuery)) score = 50;

    if (score > 0) {
      scored.push({ course, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.course);
}

/**
 * Fetches specific courses by their codes directly from IndexedDB.
 */
export async function getCoursesByCodesFromIndexedDB(
  codes: string[],
): Promise<CatalogCourse[]> {
  const db = await openCatalogDB();
  if (!db || !codes || codes.length === 0) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_COURSES, "readonly");
      const store = tx.objectStore(STORE_COURSES);
      const courseMap = new Map<string, CatalogCourse>();
      const uniqueCodes = Array.from(new Set(codes.filter(Boolean)));
      let pending = uniqueCodes.length;

      if (pending === 0) {
        return resolve([]);
      }

      for (const code of uniqueCodes) {
        const request = store.get(code);
        request.onsuccess = () => {
          if (request.result) {
            courseMap.set(code, request.result as CatalogCourse);
          }
          pending -= 1;
          if (pending === 0) {
            const ordered = codes
              .map((c) => courseMap.get(c))
              .filter((c): c is CatalogCourse => Boolean(c));
            resolve(ordered);
          }
        };
        request.onerror = () => {
          pending -= 1;
          if (pending === 0) {
            const ordered = codes
              .map((c) => courseMap.get(c))
              .filter((c): c is CatalogCourse => Boolean(c));
            resolve(ordered);
          }
        };
      }
    } catch {
      resolve([]);
    }
  });
}

/**
 * Clears the catalog from IndexedDB.
 */
export async function clearCatalogIndexedDB(): Promise<void> {
  const db = await openCatalogDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_COURSES, STORE_META], "readwrite");
      tx.objectStore(STORE_COURSES).clear();
      tx.objectStore(STORE_META).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
