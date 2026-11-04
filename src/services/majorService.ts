import type { Course } from "../data";
import {
  courses as defaultCseCourses,
  categoryRequirements as defaultCategoryRequirements,
  aiCourses as defaultAiCourses,
  aiCategoryRequirements as defaultAiCategoryRequirements,
} from "../data";
import { STORAGE_STUDENT_KEY, StudentSyncProfile } from "./studentService";
import { extractCohortYear } from "../utils/semesterUtils";

export interface MajorSummary {
  id: string;
  code: string;
  name: string;
  cohortYear?: string;
  displayName?: string;
  college: string;
  degree: string;
  totalCredits: number;
  categoryRequirements: Record<string, number>;
  description?: string;
  coursesCount?: number;
}

export interface MajorDetail extends MajorSummary {
  courses: Course[];
}

const STORAGE_ACTIVE_MAJOR_KEY = "ptuk_active_major_id";
const STORAGE_MAJORS_CACHE_KEY = "ptuk_majors_list_cache";
const STORAGE_MAJOR_PLAN_PREFIX = "ptuk_major_plan_";

function getBaseApiUrl(): string {
  const envBase =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
      ? import.meta.env.VITE_API_BASE_URL
      : "";

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

export const FALLBACK_MAJORS: MajorSummary[] = [];

const isValidMajor = (m: any): boolean =>
  Boolean(
    m &&
    (m.cohortYear || m.name) &&
    !["cse", "swe", "cs", "ee"].includes(m.id?.toLowerCase?.() || ""),
  );

function inferDegreeAndCredits(student: Partial<StudentSyncProfile> = {}) {
  const isDiploma = Boolean(
    student.degree?.includes("دبلوم") ||
    student.majorName?.includes("دبلوم") ||
    student.college?.includes("متوسطة") ||
    student.college?.includes("دبلوم"),
  );
  const isMaster = Boolean(
    student.degree?.includes("ماجستير") ||
    student.majorName?.includes("ماجستير") ||
    student.college?.includes("دراسات عليا"),
  );
  const isFiveYear = Boolean(
    student.college?.includes("هندسة") &&
    !student.majorName?.includes("الذكاء") &&
    !student.majorName?.includes("علم الحاسوب"),
  );
  const defaultCredits = isDiploma
    ? 72
    : isMaster
      ? 36
      : isFiveYear
        ? 164
        : 132;
  const degree =
    student.degree ||
    (isDiploma ? "دبلوم متوسط" : isMaster ? "ماجستير" : "بكالوريوس");
  const totalCredits =
    student.totalCredits && student.totalCredits >= 60
      ? student.totalCredits
      : defaultCredits;
  return { degree, totalCredits };
}

function mergeStudentMajor(list: MajorSummary[]): MajorSummary[] {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const studentRaw = window.localStorage.getItem(STORAGE_STUDENT_KEY);
      if (studentRaw) {
        const student = JSON.parse(studentRaw) as StudentSyncProfile;
        if (student && student.majorName) {
          const studentMajorId = student.majorId || student.majorName;
          if (
            !list.some(
              (m) => m.id === studentMajorId || m.name === student.majorName,
            )
          ) {
            const { degree, totalCredits } = inferDegreeAndCredits(student);
            return [
              {
                id: studentMajorId,
                code: student.cohortYear
                  ? `BATCH-${student.cohortYear}`
                  : "MY-MAJOR",
                name: student.majorName,
                cohortYear: String(
                  extractCohortYear(student) ||
                    student.cohortYear ||
                    new Date().getFullYear(),
                ),
                college: student.college || "جامعة فلسطين التقنية - خضوري",
                degree,
                totalCredits,
                categoryRequirements:
                  student.categoryRequirements || defaultCategoryRequirements,
                coursesCount: Array.isArray(student.planCourses)
                  ? student.planCourses.length
                  : undefined,
              },
              ...list,
            ];
          }
        }
      }
    } catch {}
  }
  return list;
}

export async function fetchMajors(): Promise<MajorSummary[]> {
  const url = `${getBaseApiUrl()}/api/majors`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error("HTTP " + response.status);

    const list: MajorSummary[] = await response.json();
    if (Array.isArray(list)) {
      const validList = mergeStudentMajor(list.filter(isValidMajor));
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.setItem(
            STORAGE_MAJORS_CACHE_KEY,
            JSON.stringify(validList),
          );
        } catch {
          // ignore storage quota error
        }
      }
      return validList.length > 0
        ? validList
        : mergeStudentMajor(FALLBACK_MAJORS);
    }
  } catch {
    // Fallback to cache if available
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const cached = window.localStorage.getItem(STORAGE_MAJORS_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const valid = mergeStudentMajor(parsed.filter(isValidMajor));
            return valid.length > 0
              ? valid
              : mergeStudentMajor(FALLBACK_MAJORS);
          }
        }
      } catch {
        // ignore storage read / parse errors
      }
    }
  }

  return mergeStudentMajor(FALLBACK_MAJORS);
}

export async function fetchMajorPlan(majorId: string): Promise<MajorDetail> {
  const normId = majorId.toLowerCase().trim();

  // 1. Immediately check if cached synced student profile matches this major
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const studentRaw = window.localStorage.getItem(STORAGE_STUDENT_KEY);
      if (studentRaw) {
        const student = JSON.parse(studentRaw) as StudentSyncProfile;
        const studentMajorId = (student.majorId || student.majorName || "")
          .toLowerCase()
          .trim();
        if (
          (studentMajorId === normId ||
            student.majorName?.toLowerCase?.().trim() === normId) &&
          Array.isArray(student.planCourses) &&
          student.planCourses.length > 0
        ) {
          const { degree, totalCredits } = inferDegreeAndCredits(student);
          const detail: MajorDetail = {
            id: student.majorId || normId,
            code: student.cohortYear ? `BATCH-${student.cohortYear}` : normId,
            name: student.majorName || "تخصص الطالب",
            cohortYear: String(
              extractCohortYear(student) ||
                student.cohortYear ||
                new Date().getFullYear(),
            ),
            college: student.college || "جامعة فلسطين التقنية - خضوري",
            degree,
            totalCredits,
            categoryRequirements:
              student.categoryRequirements || defaultCategoryRequirements,
            courses: student.planCourses,
          };
          window.localStorage.setItem(
            `${STORAGE_MAJOR_PLAN_PREFIX}${normId}`,
            JSON.stringify(detail),
          );
          return detail;
        }
      }
    } catch {}
  }

  // 2. Fetch from backend API
  const url = `${getBaseApiUrl()}/api/majors/${encodeURIComponent(normId)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const detail: MajorDetail = await response.json();
      if (
        detail &&
        Array.isArray(detail.courses) &&
        detail.courses.length > 0
      ) {
        // Validation: verify that non-CSE major didn't inherit corrupted CSE circuit courses
        const isCse =
          normId.includes("cse") || detail.name?.includes("أنظمة الحاسوب");
        const hasCircuits = detail.courses.some((c) => c.id === "12110236");
        if (isCse || !hasCircuits) {
          if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem(
              `${STORAGE_MAJOR_PLAN_PREFIX}${normId}`,
              JSON.stringify(detail),
            );
          }
          return detail;
        }
      }
    }
  } catch {}

  // 3. Check cached plan in localStorage
  if (typeof window !== "undefined" && window.localStorage) {
    const cached = window.localStorage.getItem(
      `${STORAGE_MAJOR_PLAN_PREFIX}${normId}`,
    );
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.courses) && parsed.courses.length > 0) {
          return parsed;
        }
      } catch {}
    }

    // 4. Re-check student profile
    try {
      const studentRaw = window.localStorage.getItem(STORAGE_STUDENT_KEY);
      if (studentRaw) {
        const student = JSON.parse(studentRaw) as StudentSyncProfile;
        if (
          Array.isArray(student.planCourses) &&
          student.planCourses.length > 0
        ) {
          const { degree, totalCredits } = inferDegreeAndCredits(student);
          return {
            id: student.majorId || normId,
            code: student.cohortYear ? `BATCH-${student.cohortYear}` : normId,
            name: student.majorName || "تخصص الطالب",
            cohortYear: String(
              extractCohortYear(student) ||
                student.cohortYear ||
                new Date().getFullYear(),
            ),
            college: student.college || "جامعة فلسطين التقنية - خضوري",
            degree,
            totalCredits,
            categoryRequirements:
              student.categoryRequirements || defaultCategoryRequirements,
            courses: student.planCourses,
          };
        }
      }
    } catch {}
  }

  // Built-in fallback: look up in FALLBACK_MAJORS or clean major
  const isCse = normId.includes("cse") || normId.includes("أنظمة-الحاسوب");
  const isAi = normId.includes("ai") || normId.includes("ذكاء");
  const fallback = FALLBACK_MAJORS.find(
    (m) => m.id?.toLowerCase().trim() === normId,
  );
  return {
    id: normId || fallback?.id || (isAi ? "ai" : "default"),
    code: fallback?.code || normId || (isAi ? "AI-132" : "DEFAULT"),
    name:
      fallback?.name ||
      (isCse
        ? "هندسة أنظمة الحاسوب"
        : isAi
          ? "الذكاء الاصطناعي"
          : "تخصص الطالب"),
    college:
      fallback?.college ||
      (isAi
        ? "كلية تكنولوجيا المعلومات والاتصالات"
        : "جامعة فلسطين التقنية - خضوري"),
    degree: "بكالوريوس",
    totalCredits: fallback?.totalCredits || (isCse ? 164 : 132),
    categoryRequirements:
      fallback?.categoryRequirements ||
      (isAi ? defaultAiCategoryRequirements : defaultCategoryRequirements),
    courses: isCse ? defaultCseCourses : isAi ? defaultAiCourses : [],
  };
}

export function getActiveMajorId(): string {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const studentRaw = window.localStorage.getItem(STORAGE_STUDENT_KEY);
      if (studentRaw) {
        const student = JSON.parse(studentRaw) as StudentSyncProfile;
        if (student?.majorId) return student.majorId;
      }
    } catch {}
    const saved = window.localStorage.getItem(STORAGE_ACTIVE_MAJOR_KEY);
    if (saved && !["cse", "swe", "cs", "ee"].includes(saved.toLowerCase())) {
      return saved;
    }
  }
  return "";
}

export function getActiveMajorName(): string {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const studentRaw = window.localStorage.getItem(STORAGE_STUDENT_KEY);
      if (studentRaw) {
        const student = JSON.parse(studentRaw) as StudentSyncProfile;
        if (student?.majorName) return student.majorName;
      }
    } catch {}
    const saved = window.localStorage.getItem("ptuk_active_major_name");
    if (saved) return saved;
  }
  return "";
}

export function setActiveMajorId(majorId: string, majorName?: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(STORAGE_ACTIVE_MAJOR_KEY, majorId);
    if (majorName) {
      window.localStorage.setItem("ptuk_active_major_name", majorName);
    }
  }
}

export function clearActiveMajor(): void {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.removeItem(STORAGE_ACTIVE_MAJOR_KEY);
    window.localStorage.removeItem("ptuk_active_major_name");
  }
}
