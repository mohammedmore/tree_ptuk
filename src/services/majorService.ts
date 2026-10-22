import type { Course } from "../data";
import { courses as defaultCseCourses, categoryRequirements as defaultCategoryRequirements } from "../data";

export interface MajorSummary {
  id: string;
  code: string;
  name: string;
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
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, "");
  }
  return "http://localhost:3001";
}

export const FALLBACK_MAJORS: MajorSummary[] = [
  {
    id: "cse",
    code: "CSE",
    name: "هندسة أنظمة الحاسوب",
    college: "كلية الهندسة والتكنولوجيا",
    degree: "بكالوريوس",
    totalCredits: 164,
    categoryRequirements: defaultCategoryRequirements,
    description: "تخصص يجمع بين علوم الحاسوب والهندسة الإلكترونية لتصميم العتاد والبرمجيات المتقدمة والأنظمة المدمجة.",
    coursesCount: defaultCseCourses.length,
  },
  {
    id: "swe",
    code: "SWE",
    name: "هندسة البرمجيات",
    college: "كلية الهندسة والتكنولوجيا",
    degree: "بكالوريوس",
    totalCredits: 160,
    categoryRequirements: {
      "متطلب جامعة إجباري": 18,
      "متطلب جامعة اختياري": 6,
      "متطلب كلية إجباري": 18,
      "متطلب تخصص إجباري": 103,
      "متطلب تخصص اختياري": 15,
      "متطلب استدراكي إجباري": 3,
    },
    description: "تخصص يركز على معمارية البرمجيات، هندسة المتطلبات، فحص وضمان الجودة والحوسبة السحابية.",
    coursesCount: 95,
  },
  {
    id: "cs",
    code: "CS",
    name: "علم الحاسوب وتكنولوجيا المعلومات",
    college: "كلية تكنولوجيا المعلومات",
    degree: "بكالوريوس",
    totalCredits: 132,
    categoryRequirements: {
      "متطلب جامعة إجباري": 18,
      "متطلب جامعة اختياري": 6,
      "متطلب كلية إجباري": 21,
      "متطلب تخصص إجباري": 72,
      "متطلب تخصص اختياري": 15,
      "متطلب استدراكي إجباري": 3,
    },
    description: "الأسس النظرية والتطبيقية للخوارزميات والذكاء الاصطناعي والأمن السيبراني وعلم البيانات.",
    coursesCount: 80,
  },
  {
    id: "ee",
    code: "EE",
    name: "الهندسة الكهربائية والأتمتة الصناعية",
    college: "كلية الهندسة والتكنولوجيا",
    degree: "بكالوريوس",
    totalCredits: 160,
    categoryRequirements: {
      "متطلب جامعة إجباري": 18,
      "متطلب جامعة اختياري": 6,
      "متطلب كلية إجباري": 18,
      "متطلب تخصص إجباري": 103,
      "متطلب تخصص اختياري": 15,
      "متطلب استدراكي إجباري": 3,
    },
    description: "أنظمة القوى الكهربائية، التحكم الآلي والـ PLC، الروبوتات والأنظمة الصناعية الذكية.",
    coursesCount: 90,
  },
];

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
    if (Array.isArray(list) && list.length > 0) {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(STORAGE_MAJORS_CACHE_KEY, JSON.stringify(list));
      }
      return list;
    }
  } catch {
    // Fallback to cache or built-in list
    if (typeof window !== "undefined" && window.localStorage) {
      const cached = window.localStorage.getItem(STORAGE_MAJORS_CACHE_KEY);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // ignore
        }
      }
    }
  }

  return FALLBACK_MAJORS;
}

export async function fetchMajorPlan(majorId: string): Promise<MajorDetail> {
  const normId = majorId.toLowerCase().trim();
  const url = `${getBaseApiUrl()}/api/majors/${normId}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error("HTTP " + response.status);

    const detail: MajorDetail = await response.json();
    if (detail && Array.isArray(detail.courses)) {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(
          `${STORAGE_MAJOR_PLAN_PREFIX}${normId}`,
          JSON.stringify(detail),
        );
      }
      return detail;
    }
  } catch {
    // Check cached plan
    if (typeof window !== "undefined" && window.localStorage) {
      const cached = window.localStorage.getItem(`${STORAGE_MAJOR_PLAN_PREFIX}${normId}`);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // ignore
        }
      }
    }
  }

  // Built-in fallback
  const summary = FALLBACK_MAJORS.find((m) => m.id === normId) || FALLBACK_MAJORS[0];
  return {
    ...summary,
    courses: defaultCseCourses,
  };
}

export function getActiveMajorId(): string {
  if (typeof window !== "undefined" && window.localStorage) {
    const saved = window.localStorage.getItem(STORAGE_ACTIVE_MAJOR_KEY);
    if (saved) return saved;
  }
  return "cse";
}

export function setActiveMajorId(majorId: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(STORAGE_ACTIVE_MAJOR_KEY, majorId);
  }
}
