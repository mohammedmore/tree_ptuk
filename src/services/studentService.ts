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

export interface StudentSyncProfile {
  studentId: string;
  studentName?: string;
  majorId: string;
  majorName: string;
  cohortYear?: string;
  college?: string;
  earnedCredits: number;
  totalCredits?: number;
  gpa: number;
  passedCourseIds: string[];
  registeredCourseIds?: string[];
  remainingCourseIds?: string[];
  planCourses?: any[];
  categoryRequirements?: Record<string, number>;
  enrolledCourses?: EnrolledCourse[];
  isDemo?: boolean;
  isLiveEdugate?: boolean;
  lastSyncedAt?: string;
  note?: string;
}

const STORAGE_STUDENT_KEY = "ptuk_synced_student_profile";

function getBaseApiUrl(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, "");
  }
  return "http://localhost:3001";
}

export async function syncStudentProfile(
  studentId: string,
  password?: string,
  demoMode = false,
): Promise<StudentSyncProfile> {
  const url = `${getBaseApiUrl()}/api/student/sync`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      studentId: studentId.trim(),
      password: password ? password.trim() : undefined,
      demoMode,
    }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => null);
    throw new Error(errorJson?.error || `فشلت مزامنة الطالب (HTTP ${response.status}).`);
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "استجابة غير صحيحة من خادم المزامنة.");
  }

  const profile: StudentSyncProfile = result.data;

  // Persist locally
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(STORAGE_STUDENT_KEY, JSON.stringify(profile));
  }

  return profile;
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
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.removeItem(STORAGE_STUDENT_KEY);
  }
}
