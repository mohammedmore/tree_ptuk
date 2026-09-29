export interface SharedCourseSnapshot {
  courseId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  category: string;
  semester: string;
  color: string;
  section: string;
  startTime: string;
  endTime: string;
  days: string[];
  instructor: string;
  room: string;
}

export interface SharedScheduleSnapshot {
  version: 1;
  name: string;
  exportedAt: string;
  plannedCourses: Record<string, string>;
  completedCourses: Array<{
    courseCode: string;
    courseName: string;
    credits: number;
    category: string;
  }>;
  weeklySchedule: Record<string, Record<string, {
    courseId: string;
    startTime: string;
    endTime: string;
    section: string;
    instructor: string;
    room: string;
    days: string[];
  }>>;
  courses: SharedCourseSnapshot[];
}

interface SupabaseError {
  code?: string;
  message: string;
}

interface SupabaseResult<T> {
  data: T | null;
  error: SupabaseError | null;
}

interface SupabaseQuery<T> extends PromiseLike<SupabaseResult<T>> {
  select(columns: string): SupabaseQuery<T>;
  eq(column: string, value: string): SupabaseQuery<T>;
  gt(column: string, value: string): SupabaseQuery<T>;
  maybeSingle(): Promise<SupabaseResult<T>>;
  insert(values: Record<string, unknown>): Promise<SupabaseResult<unknown>>;
}

export interface SupabaseClient {
  from<T>(table: string): SupabaseQuery<T>;
  rpc(name: string, args: Record<string, unknown>): Promise<SupabaseResult<number>>;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL
  ?? "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ?? import.meta.env.SUPABASE_PUBLISHABLE_KEY
  ?? "YOUR_SUPABASE_ANON_KEY";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  if (
    SUPABASE_URL.includes("YOUR_PROJECT")
    || SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY"
  ) {
    throw new Error("لم تُحمّل إعدادات Supabase. تحقق من NEXT_PUBLIC_SUPABASE_URL وNEXT_PUBLIC_SUPABASE_ANON_KEY (أو VITE_SUPABASE_URL وVITE_SUPABASE_ANON_KEY)، ثم أعد تشغيل الخادم أو أعد نشر الموقع.");
  }
  if (!window.supabase?.createClient) {
    throw new Error("تعذر تحميل مكتبة Supabase. تحقق من اتصال الإنترنت ثم أعد المحاولة.");
  }
  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSharedScheduleSnapshot(value: unknown): value is SharedScheduleSnapshot {
  return isRecord(value)
    && value.version === 1
    && typeof value.name === "string"
    && typeof value.exportedAt === "string"
    && isRecord(value.plannedCourses)
    && isRecord(value.weeklySchedule)
    && Array.isArray(value.completedCourses)
    && value.completedCourses.every((course) => (
      isRecord(course)
      && typeof course.courseCode === "string"
      && typeof course.courseName === "string"
      && typeof course.credits === "number"
      && typeof course.category === "string"
    ))
    && Array.isArray(value.courses)
    && value.courses.every((course) => (
      isRecord(course)
      && typeof course.courseId === "string"
      && typeof course.courseCode === "string"
      && typeof course.courseName === "string"
      && typeof course.credits === "number"
      && typeof course.category === "string"
      && typeof course.semester === "string"
      && typeof course.color === "string"
      && typeof course.section === "string"
      && typeof course.startTime === "string"
      && typeof course.endTime === "string"
      && Array.isArray(course.days)
      && course.days.every((day) => typeof day === "string")
      && typeof course.instructor === "string"
      && typeof course.room === "string"
    ));
}

export function normalizeScheduleCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function generate8Charcode(): string {
  const cryptoApi = window.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error("المتصفح لا يدعم توليد رمز آمن. حدّث المتصفح أو افتح الموقع عبر HTTPS.");
  }
  let code = "";
  const acceptedLimit = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
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
  const supabase = getSupabaseClient();
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

export async function fetchScheduleByCode(
  value: string,
): Promise<{ code: string; schedule: SharedScheduleSnapshot }> {
  const code = normalizeScheduleCode(value);
  if (!/^[A-HJ-KM-NP-Z2-9]{8}$/.test(code)) {
    throw new Error("أدخل رمزاً صحيحاً من 8 أحرف أو أرقام.");
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from<{ schedule_data: SharedScheduleSnapshot }>("shared_schedules")
    .select("schedule_data")
    .eq("id", code)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error(`تعذر جلب الجدول: ${error.message}`);
  if (!data) throw new Error("لم يُعثر على جدول بهذا الرمز، أو انتهت صلاحيته.");
  const schedule: unknown = data.schedule_data;
  if (!isSharedScheduleSnapshot(schedule)) {
    throw new Error("بيانات الجدول المشارك غير صالحة أو غير مدعومة.");
  }

  const { data: updatedCount, error: counterError } = await supabase.rpc(
    "increment_shared_schedule_views",
    { p_code: code },
  );
  if (counterError) {
    throw new Error(`تم العثور على الجدول، لكن تعذر تحديث عداد المشاهدات: ${counterError.message}`);
  }
  if (updatedCount === null) {
    throw new Error("انتهت صلاحية الجدول أثناء تحميله. اطلب رابطاً أحدث.");
  }

  return { code, schedule };
}
