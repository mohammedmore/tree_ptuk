import { SEMESTERS } from "./constants";
import type { ScheduleEntry } from "./data";

export const STORAGE_SCHEMA_VERSION = 1;

/**
 * Storage Migration Pipeline:
 * Defines transformation functions to upgrade older schema versions
 * incrementally without data loss or user disruption.
 */
type MigrationStep = (data: unknown, key: string) => unknown;

const SCHEMA_MIGRATIONS: Record<number, MigrationStep> = {
  // Migration from unversioned (v0) to v1
  0: (data: unknown, key: string) => {
    if (key === "completed_courses" && Array.isArray(data)) {
      return Array.from(new Set(data.map((c) => String(c).trim())));
    }
    if (key === "planned_courses" && isRecord(data)) {
      const sanitized: Record<string, string> = {};
      for (const [courseId, semester] of Object.entries(data)) {
        if (typeof semester === "string" && SEMESTERS.includes(semester)) {
          sanitized[courseId] = semester;
        }
      }
      return sanitized;
    }
    return data;
  },
};

/**
 * Executes registered schema migrations sequentially from sourceVersion to targetVersion.
 */
export function migrateStoragePayload(
  key: string,
  data: unknown,
  sourceVersion: number,
  targetVersion: number = STORAGE_SCHEMA_VERSION,
): unknown {
  let currentData = data;
  for (let v = sourceVersion; v < targetVersion; v++) {
    const migrator = SCHEMA_MIGRATIONS[v];
    if (migrator) {
      currentData = migrator(currentData, key);
    }
  }
  return currentData;
}

export interface MigrationReport {
  migratedKeys: string[];
  skippedKeys: string[];
  errors: string[];
}

/**
 * Scans all known application storage keys, runs automated schema migrations,
 * and upgrades any legacy formats to ensure student plans are never wiped or lost.
 */
export function runStorageMigrationEngine(): MigrationReport {
  const report: MigrationReport = {
    migratedKeys: [],
    skippedKeys: [],
    errors: [],
  };

  if (typeof window === "undefined" || !window.localStorage) {
    return report;
  }

  const knownKeys = [
    "completed_courses",
    "planned_courses",
    "weekly_schedule",
    "course_grades",
    "selected_electives_map",
    "plan_start_semester",
    "plan_end_semester",
    "hide_past_semesters",
    "dark_mode",
  ];

  for (const key of knownKeys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      if (isRecord(parsed) && "schemaVersion" in parsed) {
        if (
          typeof parsed.schemaVersion === "number" &&
          parsed.schemaVersion < STORAGE_SCHEMA_VERSION
        ) {
          const migratedValue = migrateStoragePayload(
            key,
            parsed.value,
            parsed.schemaVersion,
            STORAGE_SCHEMA_VERSION,
          );
          window.localStorage.setItem(
            key,
            serializeAppStorageValue(migratedValue),
          );
          report.migratedKeys.push(key);
        } else {
          report.skippedKeys.push(key);
        }
      } else {
        // Legacy un-enveloped raw data (version 0)
        const migratedValue = migrateStoragePayload(
          key,
          parsed,
          0,
          STORAGE_SCHEMA_VERSION,
        );
        window.localStorage.setItem(
          key,
          serializeAppStorageValue(migratedValue),
        );
        report.migratedKeys.push(key);
      }
    } catch (e) {
      report.errors.push(
        `${key}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return report;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function isSemesterRecord(value: unknown): value is Record<string, string> {
  return (
    isStringRecord(value) &&
    Object.values(value).every((semester) => SEMESTERS.includes(semester))
  );
}

function normalizeWeeklySchedule(
  value: unknown,
): Record<string, Record<string, ScheduleEntry>> | null {
  if (!isRecord(value)) return null;
  const schedule: Record<string, Record<string, ScheduleEntry>> = {};

  for (const [semester, entries] of Object.entries(value)) {
    if (!SEMESTERS.includes(semester) || !isRecord(entries)) return null;
    schedule[semester] = {};

    for (const [courseId, entry] of Object.entries(entries)) {
      if (!isRecord(entry)) return null;
      if (
        (entry.startTime !== undefined &&
          (typeof entry.startTime !== "string" ||
            !/^([0-1]?\d|2[0-3]):([0-5]\d)$/.test(entry.startTime))) ||
        (entry.endTime !== undefined &&
          (typeof entry.endTime !== "string" ||
            !/^([0-1]?\d|2[0-3]):([0-5]\d)$/.test(entry.endTime))) ||
        (entry.days !== undefined &&
          (!isStringArray(entry.days) ||
            (entry.day !== undefined && typeof entry.day !== "string"))) ||
        (entry.days === undefined &&
          entry.day !== undefined &&
          typeof entry.day !== "string") ||
        (entry.section !== undefined && typeof entry.section !== "string") ||
        (entry.instructor !== undefined &&
          typeof entry.instructor !== "string") ||
        (entry.room !== undefined && typeof entry.room !== "string") ||
        (entry.location !== undefined && typeof entry.location !== "string")
      )
        return null;

      const days = Array.isArray(entry.days)
        ? entry.days
        : typeof entry.day === "string"
          ? [entry.day]
          : [];

      schedule[semester][courseId] = {
        startTime:
          typeof entry.startTime === "string"
            ? entry.startTime.padStart(5, "0")
            : "08:00",
        endTime:
          typeof entry.endTime === "string"
            ? entry.endTime.padStart(5, "0")
            : "09:00",
        days,
        section: typeof entry.section === "string" ? entry.section : "",
        instructor:
          typeof entry.instructor === "string" ? entry.instructor : "",
        room:
          typeof entry.room === "string"
            ? entry.room
            : typeof entry.location === "string"
              ? entry.location
              : "",
      };
    }
  }

  return schedule;
}

function decodeValue<T>(
  key: string,
  value: unknown,
  initialValue: T,
): T | null {
  if (initialValue instanceof Set) {
    return isStringArray(value) ? (new Set(value) as T) : null;
  }

  switch (key) {
    case "completed_courses":
      return isStringArray(value) ? (new Set(value) as T) : null;
    case "failed_course_ids":
      return isStringArray(value) ? (value as T) : null;
    case "planned_courses":
    case "selected_electives_map":
      return isStringRecord(value) &&
        (key !== "planned_courses" || isSemesterRecord(value))
        ? (value as T)
        : null;
    case "weekly_schedule":
      return normalizeWeeklySchedule(value) as T | null;
    case "plan_start_semester":
    case "plan_end_semester":
      return typeof value === "string" && SEMESTERS.includes(value)
        ? (value as T)
        : null;
    case "hide_past_semesters":
    case "dark_mode":
      return typeof value === "boolean" ? (value as T) : null;
    case "course_grades":
      return isRecord(value) &&
        Object.values(value).every(
          (grade) =>
            typeof grade === "number" &&
            Number.isFinite(grade) &&
            (grade === -1 || (grade >= 0 && grade <= 100)),
        )
        ? (value as T)
        : null;
    default:
      return typeof value === typeof initialValue ? (value as T) : null;
  }
}

export function normalizeAppStorageValue<T>(
  key: string,
  value: unknown,
  initialValue: T,
): T | null {
  return decodeValue(key, value, initialValue);
}

export function readAppStorageValue<T>(
  key: string,
  initialValue: T,
  reportIssue: (message: string) => void,
): T {
  let serialized: string | null;
  try {
    serialized = window.localStorage.getItem(key);
  } catch (error) {
    reportIssue(
      "تعذرت قراءة البيانات المحفوظة على هذا الجهاز. تحقق من إعدادات التخزين في المتصفح.",
    );
    console.error(`Unable to read localStorage key "${key}"`, error);
    return initialValue;
  }
  if (serialized === null) return initialValue;

  try {
    const parsed: unknown = JSON.parse(serialized);
    let value = parsed;
    if (isRecord(parsed) && "schemaVersion" in parsed) {
      if (
        typeof parsed.schemaVersion !== "number" ||
        parsed.schemaVersion > STORAGE_SCHEMA_VERSION ||
        !("value" in parsed)
      ) {
        reportIssue(
          "إصدار بيانات التخزين غير مدعوم. صدّر نسخة احتياطية قبل متابعة التغييرات.",
        );
        return initialValue;
      }

      if (parsed.schemaVersion < STORAGE_SCHEMA_VERSION) {
        value = migrateStoragePayload(
          key,
          parsed.value,
          parsed.schemaVersion,
          STORAGE_SCHEMA_VERSION,
        );
      } else {
        value = parsed.value;
      }
    } else {
      // Legacy unversioned data (v0)
      value = migrateStoragePayload(key, parsed, 0, STORAGE_SCHEMA_VERSION);
    }

    const decoded = normalizeAppStorageValue(key, value, initialValue);
    if (decoded !== null) {
      if (
        !isRecord(parsed) ||
        !("schemaVersion" in parsed) ||
        (typeof parsed.schemaVersion === "number" &&
          parsed.schemaVersion < STORAGE_SCHEMA_VERSION)
      ) {
        try {
          window.localStorage.setItem(key, serializeAppStorageValue(decoded));
        } catch {
          // Ignore write failure
        }
      }
      return decoded;
    }
  } catch (error) {
    console.error(`Unable to parse localStorage key "${key}"`, error);
  }

  reportIssue(
    "وجدت بيانات محفوظة غير صالحة. أُبقيت الخطة الحالية دون تحميلها؛ صدّر نسخة احتياطية قبل إعادة التهيئة.",
  );
  return initialValue;
}

export function serializeAppStorageValue(value: unknown): string {
  let safeValue = value;
  if (value instanceof Set) {
    safeValue = Array.from(value);
  } else if (value instanceof Map) {
    safeValue = Object.fromEntries(value.entries());
  }
  return JSON.stringify({
    schemaVersion: STORAGE_SCHEMA_VERSION,
    value: safeValue,
  });
}

/**
 * In-memory write queue and lock to guarantee atomic storage persistence
 * and prevent race conditions across rapid React state changes.
 */
let isStorageLocked = false;
const writeQueue: Array<{
  key: string;
  serialized: string;
  resolve: (ok: boolean) => void;
}> = [];

function processWriteQueue(): void {
  if (isStorageLocked || writeQueue.length === 0) return;
  isStorageLocked = true;

  try {
    while (writeQueue.length > 0) {
      const item = writeQueue.shift();
      if (!item) break;
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(item.key, item.serialized);
        }
        item.resolve(true);
      } catch (err) {
        console.warn(`[appStorage] Atomic write error for "${item.key}":`, err);
        item.resolve(false);
      }
    }
  } finally {
    isStorageLocked = false;
  }
}

/**
 * Safely writes a key-value pair to window.localStorage wrapped in schema envelope.
 * Uses mutex queue to prevent race conditions during rapid state transitions.
 */
export function writeAppStorageValue(key: string, value: unknown): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    const serialized = serializeAppStorageValue(value);
    if (!isStorageLocked) {
      isStorageLocked = true;
      try {
        window.localStorage.setItem(key, serialized);
        return true;
      } finally {
        isStorageLocked = false;
        if (writeQueue.length > 0) {
          processWriteQueue();
        }
      }
    } else {
      let writeSuccess = false;
      writeQueue.push({
        key,
        serialized,
        resolve: (ok) => {
          writeSuccess = ok;
        },
      });
      return true;
    }
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "QuotaExceededError" ||
        error.code === 22 ||
        error.code === 1014)
    ) {
      console.warn(
        `[appStorage] Storage quota exceeded while writing "${key}".`,
      );
    } else {
      console.error(`[appStorage] Failed to write key "${key}":`, error);
    }
    return false;
  }
}
