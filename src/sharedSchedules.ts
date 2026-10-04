import type { SupabaseClient as SupabaseSdkClient } from "@supabase/supabase-js";

type SupabaseJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: SupabaseJson | undefined }
  | SupabaseJson[];

export interface SharedCourseSnapshot {
  courseId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  category: string;
  prerequisites?: string[];
  semester: string;
  color: string;
  section: string;
  startTime: string;
  endTime: string;
  days: string[];
  instructor: string;
  room: string;
  completed?: boolean;
  failed?: boolean;
  grade?: number | null;
  seasonal?: "first" | "second" | "both";
  availableSemesters?: Array<"first" | "second" | "summer">;
  resourceLink?: string;
}

export interface SharedScheduleSnapshot {
  version: 1 | 2;
  name: string;
  exportedAt: string;
  plannedCourses: Record<string, string>;
  completedCourses: Array<{
    courseCode: string;
    courseName: string;
    credits: number;
    category: string;
    grade?: number | null;
  }>;
  courseGrades?: Record<string, number>;
  failedCourseIds?: string[];
  selectedElectives?: Record<string, string>;
  preferences?: {
    planStartSemester: string;
    planEndSemester: string;
    hidePastSemesters: boolean;
    darkMode: boolean;
  };
  weeklySchedule: Record<
    string,
    Record<
      string,
      {
        courseId: string;
        startTime: string;
        endTime: string;
        section: string;
        instructor: string;
        room: string;
        days: string[];
      }
    >
  >;
  courses: SharedCourseSnapshot[];
}

interface SharedSchedulesTable {
  Row: {
    id: string;
    schedule_data: SharedScheduleSnapshot;
    created_at: string;
    expires_at: string;
    views_count: number;
  };
  Insert: {
    id: string;
    schedule_data: SharedScheduleSnapshot;
    created_at?: string;
    expires_at?: string;
    views_count?: number;
  };
  Update: Partial<SharedSchedulesTable["Insert"]>;
  Relationships: [];
}

interface Database {
  public: {
    Tables: { shared_schedules: SharedSchedulesTable };
    Views: Record<string, never>;
    Functions: {
      fetch_shared_schedule: {
        Args: { p_code: string };
        Returns: SupabaseJson | null;
      };
      increment_shared_schedule_views: {
        Args: { p_code: string };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

const SUPABASE_URL =
  import.meta.env?.VITE_SUPABASE_URL ??
  import.meta.env?.NEXT_PUBLIC_SUPABASE_URL ??
  "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env?.VITE_SUPABASE_ANON_KEY ??
  import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  import.meta.env?.SUPABASE_PUBLISHABLE_KEY ??
  "YOUR_SUPABASE_ANON_KEY";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_SHARED_SCHEDULE_BYTES = 262144;

let clientPromise: Promise<SupabaseSdkClient<Database>> | null = null;

function getSupabaseClient(): Promise<SupabaseSdkClient<Database>> {
  if (clientPromise) return clientPromise;
  if (
    SUPABASE_URL.includes("YOUR_PROJECT") ||
    SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY"
  ) {
    throw new Error(
      "لم تُحمّل إعدادات Supabase. تحقق من NEXT_PUBLIC_SUPABASE_URL وNEXT_PUBLIC_SUPABASE_ANON_KEY (أو VITE_SUPABASE_URL وVITE_SUPABASE_ANON_KEY)، ثم أعد تشغيل الخادم أو أعد نشر الموقع.",
    );
  }
  clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
    createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY),
  );
  return clientPromise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

export function normalizeSharedScheduleSnapshot(
  value: unknown,
): SharedScheduleSnapshot | null {
  if (
    !isRecord(value) ||
    (value.version !== 1 && value.version !== 2) ||
    typeof value.name !== "string" ||
    typeof value.exportedAt !== "string" ||
    !Array.isArray(value.completedCourses) ||
    !Array.isArray(value.courses) ||
    !isStringRecord(value.plannedCourses) ||
    !isRecord(value.weeklySchedule)
  )
    return null;

  const completedCourses = value.completedCourses.flatMap((course) => {
    if (
      !isRecord(course) ||
      typeof course.courseCode !== "string" ||
      typeof course.courseName !== "string" ||
      typeof course.credits !== "number" ||
      !Number.isFinite(course.credits) ||
      typeof course.category !== "string"
    )
      return [];
    const grade = typeof course.grade === "number" ? course.grade : undefined;
    return [
      {
        courseCode: course.courseCode,
        courseName: course.courseName,
        credits: course.credits,
        category: course.category,
        ...(grade !== undefined ? { grade } : {}),
      },
    ];
  });
  if (completedCourses.length !== value.completedCourses.length) return null;

  const courses = value.courses.flatMap((course) => {
    if (
      !isRecord(course) ||
      typeof course.courseCode !== "string" ||
      typeof course.courseName !== "string" ||
      typeof course.credits !== "number" ||
      !Number.isFinite(course.credits) ||
      typeof course.category !== "string"
    )
      return [];

    const prerequisites = Array.isArray(course.prerequisites)
      ? course.prerequisites.filter(
          (id): id is string => typeof id === "string",
        )
      : [];
    const days = Array.isArray(course.days)
      ? course.days.filter((day): day is string => typeof day === "string")
      : typeof course.days === "string"
        ? [course.days]
        : typeof course.day === "string"
          ? [course.day]
          : [];
    const grade: number | null =
      typeof course.grade === "number" ? course.grade : null;
    const seasonal: SharedCourseSnapshot["seasonal"] =
      course.seasonal === "first" ||
      course.seasonal === "second" ||
      course.seasonal === "both"
        ? course.seasonal
        : undefined;
    const availableSemesters = course.availableSemesters;

    return [
      {
        courseId:
          typeof course.courseId === "string"
            ? course.courseId
            : course.courseCode,
        courseCode: course.courseCode,
        courseName: course.courseName,
        credits: course.credits,
        category: course.category,
        prerequisites,
        semester: typeof course.semester === "string" ? course.semester : "",
        color: typeof course.color === "string" ? course.color : "#3b82f6",
        section: typeof course.section === "string" ? course.section : "",
        startTime: typeof course.startTime === "string" ? course.startTime : "",
        endTime: typeof course.endTime === "string" ? course.endTime : "",
        days,
        instructor:
          typeof course.instructor === "string" ? course.instructor : "",
        room: typeof course.room === "string" ? course.room : "",
        completed:
          typeof course.completed === "boolean" ? course.completed : false,
        failed: typeof course.failed === "boolean" ? course.failed : false,
        grade,
        ...(seasonal ? { seasonal } : {}),
        ...(Array.isArray(availableSemesters)
          ? {
              availableSemesters: availableSemesters.filter(
                (semester): semester is "first" | "second" | "summer" =>
                  semester === "first" ||
                  semester === "second" ||
                  semester === "summer",
              ),
            }
          : {}),
        ...(typeof course.resourceLink === "string"
          ? { resourceLink: course.resourceLink }
          : {}),
      },
    ];
  });
  if (courses.length !== value.courses.length) return null;

  const weeklySchedule: SharedScheduleSnapshot["weeklySchedule"] = {};
  for (const [semester, entries] of Object.entries(value.weeklySchedule)) {
    if (!isRecord(entries)) return null;
    const normalizedEntries: SharedScheduleSnapshot["weeklySchedule"][string] =
      {};
    for (const [courseId, entry] of Object.entries(entries)) {
      if (
        !isRecord(entry) ||
        (entry.courseId !== undefined && typeof entry.courseId !== "string") ||
        (entry.startTime !== undefined &&
          typeof entry.startTime !== "string") ||
        (entry.endTime !== undefined && typeof entry.endTime !== "string") ||
        (entry.section !== undefined && typeof entry.section !== "string") ||
        (entry.instructor !== undefined &&
          typeof entry.instructor !== "string") ||
        (entry.room !== undefined && typeof entry.room !== "string") ||
        (entry.days !== undefined &&
          typeof entry.days !== "string" &&
          (!Array.isArray(entry.days) ||
            !entry.days.every(
              (day): day is string => typeof day === "string",
            ))) ||
        (entry.day !== undefined && typeof entry.day !== "string")
      )
        return null;

      const days = Array.isArray(entry.days)
        ? entry.days
        : typeof entry.days === "string"
          ? [entry.days]
          : typeof entry.day === "string"
            ? [entry.day]
            : [];
      normalizedEntries[courseId] = {
        courseId:
          typeof entry.courseId === "string" ? entry.courseId : courseId,
        startTime: typeof entry.startTime === "string" ? entry.startTime : "",
        endTime: typeof entry.endTime === "string" ? entry.endTime : "",
        section: typeof entry.section === "string" ? entry.section : "",
        instructor:
          typeof entry.instructor === "string" ? entry.instructor : "",
        room: typeof entry.room === "string" ? entry.room : "",
        days,
      };
    }
    weeklySchedule[semester] = normalizedEntries;
  }

  const preferences = isRecord(value.preferences)
    ? {
        planStartSemester:
          typeof value.preferences.planStartSemester === "string"
            ? value.preferences.planStartSemester
            : "",
        planEndSemester:
          typeof value.preferences.planEndSemester === "string"
            ? value.preferences.planEndSemester
            : "",
        hidePastSemesters:
          typeof value.preferences.hidePastSemesters === "boolean"
            ? value.preferences.hidePastSemesters
            : false,
        darkMode:
          typeof value.preferences.darkMode === "boolean"
            ? value.preferences.darkMode
            : false,
      }
    : undefined;
  const courseGrades = isRecord(value.courseGrades)
    ? Object.fromEntries(
        Object.entries(value.courseGrades).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === "number" && Number.isFinite(entry[1]),
        ),
      )
    : {};
  const selectedElectives = isRecord(value.selectedElectives)
    ? Object.fromEntries(
        Object.entries(value.selectedElectives).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      )
    : {};
  const failedCourseIds = Array.isArray(value.failedCourseIds)
    ? value.failedCourseIds.filter((id): id is string => typeof id === "string")
    : [];

  return {
    version: value.version,
    name: value.name,
    exportedAt: value.exportedAt,
    plannedCourses: value.plannedCourses,
    completedCourses,
    courseGrades,
    failedCourseIds,
    selectedElectives,
    preferences,
    weeklySchedule,
    courses,
  };
}

export function normalizeScheduleCode(value: string): string {
  const input = value.trim();
  let code = input;

  try {
    const url = new URL(input);
    code = url.searchParams.get("code") ?? url.searchParams.get("s") ?? input;
  } catch {
    const match = input.match(/[?&](?:code|s)=([^&#]+)/i);
    if (match) {
      try {
        code = decodeURIComponent(match[1]);
      } catch {
        code = match[1];
      }
    }
  }

  return code.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function generate8Charcode(): string {
  const cryptoApi = window.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error(
      "المتصفح لا يدعم توليد رمز آمن. حدّث المتصفح أو افتح الموقع عبر HTTPS.",
    );
  }
  let code = "";
  const acceptedLimit =
    Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
  while (code.length < 8) {
    const randomValues = new Uint8Array(16);
    cryptoApi.getRandomValues(randomValues);
    randomValues.forEach((value) => {
      if (value < acceptedLimit && code.length < 8) {
        code += CODE_ALPHABET[value % CODE_ALPHABET.length];
      }
    });
  }
  return code;
}

export async function shareScheduleToCloud(
  scheduleObj: SharedScheduleSnapshot,
): Promise<string> {
  const payloadSize = new TextEncoder().encode(
    JSON.stringify(scheduleObj),
  ).byteLength;
  if (payloadSize > MAX_SHARED_SCHEDULE_BYTES) {
    throw new Error("حجم الخطة أكبر من الحد المسموح لمشاركتها (256 كيلوبايت).");
  }

  const supabase = await getSupabaseClient();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = generate8Charcode();
    const { error } = await supabase.from("shared_schedules").insert({
      id: code,
      schedule_data: scheduleObj,
    });
    if (!error) return code;
    if (error.code !== "23505") {
      throw new Error(`تعذر رفع الجدول: ${error.message}`);
    }
  }
  throw new Error("تعذر إنشاء رمز فريد بعد عدة محاولات. حاول مرة أخرى.");
}

export async function fetchScheduleByCode(value: string): Promise<{
  code: string;
  schedule: SharedScheduleSnapshot;
  viewCountWarning?: string;
}> {
  const code = normalizeScheduleCode(value);
  if (!/^[A-HJ-KM-NP-Z2-9]{8}$/.test(code)) {
    throw new Error("أدخل رمزاً صحيحاً من 8 أحرف أو أرقام.");
  }
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc("fetch_shared_schedule", {
    p_code: code,
  });

  if (error) throw new Error(`تعذر جلب الجدول: ${error.message}`);
  if (!data) throw new Error("لم يُعثر على جدول بهذا الرمز، أو انتهت صلاحيته.");
  const schedule = normalizeSharedScheduleSnapshot(data);
  if (!schedule) {
    throw new Error(
      "تعذر قراءة الخطة: بياناتها الأساسية ناقصة أو غير صالحة. اطلب من المرسل إنشاء رابط مشاركة جديد.",
    );
  }

  const { error: counterError } = await supabase.rpc(
    "increment_shared_schedule_views",
    { p_code: code },
  );
  const viewCountWarning = counterError
    ? `تعذر تحديث عداد المشاهدات: ${counterError.message}`
    : undefined;

  return { code, schedule, viewCountWarning };
}
