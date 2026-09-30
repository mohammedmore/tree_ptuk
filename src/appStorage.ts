import { SEMESTERS } from "./constants";
import type { ScheduleEntry } from "./data";

const STORAGE_SCHEMA_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function isSemesterRecord(value: unknown): value is Record<string, string> {
  return isStringRecord(value) && Object.values(value).every((semester) => SEMESTERS.includes(semester));
}

function normalizeWeeklySchedule(value: unknown): Record<string, Record<string, ScheduleEntry>> | null {
  if (!isRecord(value)) return null;
  const schedule: Record<string, Record<string, ScheduleEntry>> = {};

  for (const [semester, entries] of Object.entries(value)) {
    if (!SEMESTERS.includes(semester) || !isRecord(entries)) return null;
    schedule[semester] = {};

    for (const [courseId, entry] of Object.entries(entries)) {
      if (!isRecord(entry)) return null;
      if (
        (entry.startTime !== undefined
          && (typeof entry.startTime !== "string" || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(entry.startTime)))
        || (entry.endTime !== undefined
          && (typeof entry.endTime !== "string" || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(entry.endTime)))
        || (entry.days !== undefined
          && (!isStringArray(entry.days) || (entry.day !== undefined && typeof entry.day !== "string")))
        || (entry.days === undefined && entry.day !== undefined && typeof entry.day !== "string")
        || (entry.section !== undefined && typeof entry.section !== "string")
        || (entry.instructor !== undefined && typeof entry.instructor !== "string")
        || (entry.room !== undefined && typeof entry.room !== "string")
        || (entry.location !== undefined && typeof entry.location !== "string")
      ) return null;

      const days = Array.isArray(entry.days) ? entry.days : typeof entry.day === "string" ? [entry.day] : [];

      schedule[semester][courseId] = {
        startTime: typeof entry.startTime === "string" ? entry.startTime : "08:00",
        endTime: typeof entry.endTime === "string" ? entry.endTime : "09:00",
        days,
        section: typeof entry.section === "string" ? entry.section : "",
        instructor: typeof entry.instructor === "string" ? entry.instructor : "",
        room: typeof entry.room === "string" ? entry.room : typeof entry.location === "string" ? entry.location : "",
      };
    }
  }

  return schedule;
}

function decodeValue<T>(key: string, value: unknown, initialValue: T): T | null {
  if (initialValue instanceof Set) {
    return isStringArray(value) ? new Set(value) as T : null;
  }

  switch (key) {
    case "completed_courses":
      return isStringArray(value) ? new Set(value) as T : null;
    case "failed_course_ids":
      return isStringArray(value) ? value as T : null;
    case "planned_courses":
    case "selected_electives_map":
      return isStringRecord(value) && (key !== "planned_courses" || isSemesterRecord(value))
        ? value as T
        : null;
    case "weekly_schedule":
      return normalizeWeeklySchedule(value) as T | null;
    case "plan_start_semester":
    case "plan_end_semester":
      return typeof value === "string" && SEMESTERS.includes(value) ? value as T : null;
    case "hide_past_semesters":
    case "dark_mode":
      return typeof value === "boolean" ? value as T : null;
    case "course_grades":
      return isRecord(value) && Object.values(value).every((grade) => (
        typeof grade === "number"
        && Number.isFinite(grade)
        && (grade === -1 || (grade >= 0 && grade <= 100))
      )) ? value as T : null;
    default:
      return typeof value === typeof initialValue ? value as T : null;
  }
}

export function normalizeAppStorageValue<T>(key: string, value: unknown, initialValue: T): T | null {
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
    reportIssue("تعذرت قراءة البيانات المحفوظة على هذا الجهاز. تحقق من إعدادات التخزين في المتصفح.");
    console.error(`Unable to read localStorage key "${key}"`, error);
    return initialValue;
  }
  if (serialized === null) return initialValue;

  try {
    const parsed: unknown = JSON.parse(serialized);
    let value = parsed;
    if (isRecord(parsed) && "schemaVersion" in parsed) {
      if (parsed.schemaVersion !== STORAGE_SCHEMA_VERSION || !("value" in parsed)) {
        reportIssue("إصدار بيانات التخزين غير مدعوم. صدّر نسخة احتياطية قبل متابعة التغييرات.");
        return initialValue;
      }
      value = parsed.value;
    }
    const decoded = normalizeAppStorageValue(key, value, initialValue);
    if (decoded !== null) return decoded;
  } catch (error) {
    console.error(`Unable to parse localStorage key "${key}"`, error);
  }

  reportIssue("وجدت بيانات محفوظة غير صالحة. أُبقيت الخطة الحالية دون تحميلها؛ صدّر نسخة احتياطية قبل إعادة التهيئة.");
  return initialValue;
}

export function serializeAppStorageValue(value: unknown): string {
  return JSON.stringify({
    schemaVersion: STORAGE_SCHEMA_VERSION,
    value: value instanceof Set ? Array.from(value) : value,
  });
}
