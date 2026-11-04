export interface EnrolledCourseBlock {
  days: string[];
  start: number;
  end: number;
  rawTime: string;
}

export interface EnrolledCourse {
  code: string;
  name: string;
  sec: string;
  instructor?: string;
  room?: string;
  building?: string;
  blocks: EnrolledCourseBlock[];
}

export interface StudentSemesterCourse {
  code: string;
  name: string;
  status: string;
  credits: number;
  grade?: number | null;
  isPassed: boolean;
  isRegistered: boolean;
  isFailed: boolean;
}

export interface StudentSemester {
  title: string;
  courses: StudentSemesterCourse[];
}

export interface AcademicTransaction {
  id?: string;
  type: string;
  semester: string;
  date: string;
  status: string;
  notes?: string;
}

export interface FinancialRecord {
  balance: string;
  currency?: string;
  totalDebit?: number;
  totalCredit?: number;
  payments?: Array<{
    receiptNo: string;
    date: string;
    amount: number;
    description: string;
  }>;
}

export interface ExemptionExamRecord {
  code: string;
  name: string;
  examName?: string;
  semester?: string;
  status: string;
  grade?: number | null;
  isPassed: boolean;
  rawText?: string;
}

export interface StudentSyncProfile {
  studentId: string;
  studentName?: string;
  majorId: string;
  majorName: string;
  cohortYear?: string;
  college?: string;
  degree?: string;
  academicStatus?: string;
  academicAdvisor?: string;
  academicWarning?: string;
  currentSemester?: string;
  financialBalance?: string;
  earnedCredits: number;
  totalCredits?: number;
  gpa: number;
  passedCourseIds: string[];
  registeredCourseIds?: string[];
  failedCourseIds?: string[];
  remainingCourseIds?: string[];
  courseGrades?: Record<string, number>;
  planCourses?: any[];
  categoryRequirements?: Record<string, number>;
  enrolledCourses?: EnrolledCourse[];
  semesters?: StudentSemester[];
  transactions?: AcademicTransaction[];
  financial?: FinancialRecord;
  exemptionExams?: ExemptionExamRecord[];
  isDemo?: boolean;
  isLiveEdugate?: boolean;
  fromCache?: boolean;
  lastSyncedAt?: string;
  note?: string;
}

export const STORAGE_STUDENT_KEY = "ptuk_synced_student_profile";
export const STORAGE_STUDENT_TOKEN_KEY = "ptuk_student_token";

function getBaseApiUrl(): string {
  const envBase =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
      ? import.meta.env.VITE_API_BASE_URL
      : "";

  // In browser: use relative URL by default so Vite dev proxy or production reverse proxy routes it seamlessly
  // without CORS or Cross-Origin-Resource-Policy issues.
  if (typeof window !== "undefined") {
    if (
      envBase &&
      !envBase.includes("localhost:3001") &&
      !envBase.includes("127.0.0.1:3001")
    ) {
      return envBase.replace(/\/+$/, "");
    }
    return "";
  }

  if (envBase) {
    return envBase.replace(/\/+$/, "");
  }
  return "http://localhost:3001";
}

export async function syncStudentProfile(
  studentId: string,
  password?: string,
  demoMode = false,
  signal?: AbortSignal,
  forceLive = false,
): Promise<StudentSyncProfile> {
  const cleanId = (studentId || "").trim();
  if (!cleanId) {
    throw new Error("رقم الطالب مطلوب للمتابعة.");
  }
  const url = `${getBaseApiUrl()}/api/student/sync`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      studentId: cleanId,
      password: password ? password.trim() : undefined,
      demoMode,
      forceLive,
    }),
    signal,
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => null);
    throw new Error(
      errorJson?.error || `فشلت مزامنة الطالب (HTTP ${response.status}).`,
    );
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "استجابة غير صحيحة من خادم المزامنة.");
  }

  const profile: StudentSyncProfile = result.data;

  // Persist student profile and session token securely
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(
          STORAGE_STUDENT_KEY,
          JSON.stringify(profile),
        );
      }
      if (result.token) {
        if (window.sessionStorage) {
          window.sessionStorage.setItem(
            STORAGE_STUDENT_TOKEN_KEY,
            result.token,
          );
        }
        if (window.localStorage) {
          window.localStorage.setItem(STORAGE_STUDENT_TOKEN_KEY, result.token);
        }
      }
    } catch {}
  }

  return profile;
}

export function getStudentSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      (window.sessionStorage &&
        window.sessionStorage.getItem(STORAGE_STUDENT_TOKEN_KEY)) ||
      (window.localStorage &&
        window.localStorage.getItem(STORAGE_STUDENT_TOKEN_KEY)) ||
      null
    );
  } catch {
    return null;
  }
}

export function getCachedStudentProfile(): StudentSyncProfile | null {
  if (typeof window !== "undefined" && window.localStorage) {
    const raw = window.localStorage.getItem(STORAGE_STUDENT_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // ignore
      }
    }
  }
  return null;
}

export function clearStudentProfile(): void {
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage) {
        window.localStorage.removeItem(STORAGE_STUDENT_KEY);
        window.localStorage.removeItem(STORAGE_STUDENT_TOKEN_KEY);
      }
      if (window.sessionStorage) {
        window.sessionStorage.removeItem(STORAGE_STUDENT_TOKEN_KEY);
      }
    } catch {}
  }
}

export async function logoutStudent(): Promise<void> {
  const token = getStudentSessionToken();
  if (token) {
    try {
      await fetch(`${getBaseApiUrl()}/api/student/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Ignore network errors on logout
    }
  }
  clearStudentProfile();
}

export async function fetchStudentRecord(
  studentId: string,
): Promise<StudentSyncProfile> {
  const cleanId = (studentId || "").trim();
  if (!cleanId) {
    throw new Error("رقم الطالب مطلوب للمتابعة.");
  }
  const url = `${getBaseApiUrl()}/api/student/${encodeURIComponent(cleanId)}`;
  const token = getStudentSessionToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorJson = await response.json().catch(() => null);
    throw new Error(
      errorJson?.error || `فشل جلب بيانات الطالب (${response.status})`,
    );
  }
  const result = await response.json();
  return result.data;
}
