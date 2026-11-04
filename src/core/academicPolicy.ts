import type { StudentSyncProfile } from "../services/studentService";
import { getOfficialTuitionRate } from "../services/tuitionFeesService";
import {
  calculateDetailedTuition,
  TuitionConfig,
  TuitionCalculationResult,
} from "./semesterRegistration";
import { extractCohortYear } from "../utils/semesterUtils";
import { TOTAL_CREDITS } from "../constants";
import { normalizeArabicText } from "../utils";

export interface AcademicPolicy {
  majorId: string;
  totalCredits: number;
  remedialCourseIds: Set<string>;
  capstoneCreditThreshold: number;
  maxSemesterCredits: number;
  isRemedialCourse(
    courseId: string,
    courseName?: string,
    category?: string,
  ): boolean;
  canRegisterCapstone(earnedCredits: number): boolean;
}

export class DefaultAcademicPolicy implements AcademicPolicy {
  majorId: string;
  totalCredits: number;
  remedialCourseIds: Set<string>;
  capstoneCreditThreshold: number;
  maxSemesterCredits: number;

  constructor(config: Partial<AcademicPolicy> = {}) {
    this.majorId = config.majorId || "cse";
    this.totalCredits = config.totalCredits || 164;
    this.remedialCourseIds =
      config.remedialCourseIds || new Set(["15200099", "13010006", "15200098"]);
    const autoCapstone =
      this.totalCredits <= 80 ? 45 : this.totalCredits <= 136 ? 90 : 120;
    this.capstoneCreditThreshold =
      config.capstoneCreditThreshold || autoCapstone;
    this.maxSemesterCredits = config.maxSemesterCredits || 19;
  }

  isRemedialCourse(courseId: string, courseName = "", category = ""): boolean {
    const id = String(courseId || "").trim();
    if (this.remedialCourseIds.has(id)) return true;
    if (category.includes("استدراكي")) return true;
    if (
      courseName.includes("استدراكي") ||
      courseName.includes("مهارات الحاسوب")
    )
      return true;
    return false;
  }

  canRegisterCapstone(earnedCredits: number): boolean {
    return earnedCredits >= this.capstoneCreditThreshold;
  }
}

export const defaultPolicy = new DefaultAcademicPolicy();

/**
 * Checks if a student is under official academic warning (ملاحظة أكاديمية / إنذار).
 * Evaluates:
 * 1. Official academicWarning status from Edugate portal.
 * 2. Academic standing status text containing "إنذار" or "ملاحظة".
 * 3. Cumulative GPA < 60% (official PTUK warning threshold).
 */
export function hasStudentAcademicWarning(
  student?: StudentSyncProfile | null,
): boolean {
  if (!student) return false;
  const indicatesWarning = (value?: string): boolean => {
    const normalized = normalizeArabicText(value || "");
    if (!normalized) return false;

    const explicitlyNoWarning = [
      "لا يوجد",
      "لا توجد",
      "بدون",
      "غير موجود",
      "ليس هناك",
      "none",
      "no warning",
    ].some((phrase) => normalized.includes(phrase));
    if (explicitlyNoWarning) return false;

    return normalized.includes("انذار") || normalized.includes("ملاحظه");
  };
  const hasWarningField = indicatesWarning(student.academicWarning);
  const hasWarningStatus = indicatesWarning(student.academicStatus);
  const hasLowGpa =
    typeof student.gpa === "number" && student.gpa > 0 && student.gpa < 60;
  return Boolean(hasWarningField || hasWarningStatus || hasLowGpa);
}

export interface StudentCreditLimits {
  minCredits: number;
  maxCredits: number;
  isSummer: boolean;
  hasAcademicWarning: boolean;
  isHighGpaOrGraduating: boolean;
  ruleExplanation: string;
}

/**
 * Calculates authentic semester credit limits according to Palestine Technical University (PTUK) regulations:
 * - Regular Semester: Normal 19 credits, Warning 14 credits, High GPA (>= 80) or Graduating 21 credits. Min 12 credits.
 * - Summer Semester: Normal 10 credits, Warning 6 credits, High GPA or Graduating 12 credits. Min 0 credits.
 */
export function getStudentCreditLimits(options: {
  student?: StudentSyncProfile | null;
  semesterName?: string;
  isSummer?: boolean;
  isHighGpa?: boolean;
  isGraduating?: boolean;
}): StudentCreditLimits {
  const isSummer =
    options.isSummer ??
    Boolean(options.semesterName && options.semesterName.includes("صيفي"));
  const hasWarning = hasStudentAcademicWarning(options.student);
  const isHighGpaOrGraduating = Boolean(
    options.isHighGpa ||
    options.isGraduating ||
    (typeof options.student?.gpa === "number" && options.student.gpa >= 80),
  );

  let maxCredits = isSummer ? 10 : 19;
  let minCredits = isSummer ? 0 : 12;
  let ruleExplanation = isSummer
    ? "الفصل الصيفي: الحد الأقصى للتسجيل 10 ساعات معتمدة."
    : "الفصل العادي: الحد الأدنى 12 ساعة، والحد الأقصى 19 ساعة معتمدة.";

  if (hasWarning) {
    maxCredits = isSummer ? 6 : 14;
    minCredits = isSummer ? 0 : 12;
    ruleExplanation = isSummer
      ? "تنبيه: الطالب تحت الملاحظة الأكاديمية (الحد الأقصى للتسجيل بالصيفي: 6 ساعات بموجب تعليمات خضوري)."
      : "تنبيه: الطالب تحت الملاحظة الأكاديمية (الحد الأقصى للتسجيل بالفصل العادي: 14 ساعة بموجب تعليمات خضوري).";
  } else if (isHighGpaOrGraduating) {
    maxCredits = isSummer ? 12 : 21;
    ruleExplanation = isSummer
      ? "طالب متفوق أو متوقع تخرجه: تم رفع الحد الأقصى للصيفي إلى 12 ساعة معتمدة."
      : "طالب متفوق أو متوقع تخرجه: تم رفع الحد الأقصى للفصل العادي إلى 21 ساعة معتمدة.";
  }

  return {
    minCredits,
    maxCredits,
    isSummer,
    hasAcademicWarning: hasWarning,
    isHighGpaOrGraduating,
    ruleExplanation,
  };
}

/**
 * Calculates total degree credits strictly from official student record, category requirements, or major degree type.
 * Supports Diploma (72h), Bachelor (130-136h, standard 132h), and Engineering (160-164h).
 */
export function getOfficialDegreeTotalCredits(
  student?: StudentSyncProfile | null,
  categoryRequirements?: Record<string, number>,
  fallbackTotal = TOTAL_CREDITS,
): number {
  if (
    student?.totalCredits &&
    student.totalCredits >= 60 &&
    student.totalCredits <= 260
  ) {
    return student.totalCredits;
  }

  const reqs = categoryRequirements || student?.categoryRequirements;
  if (reqs && Object.keys(reqs).length > 0) {
    const sum = Object.entries(reqs).reduce((acc, [cat, val]) => {
      if (cat.includes("استدراكي")) return acc;
      return acc + (Number(val) || 0);
    }, 0);
    if (sum >= 60 && sum <= 260) {
      return sum;
    }
  }

  const majorName = student?.majorName || "";
  const degree = (student?.degree || "").toLowerCase();
  if (degree.includes("دبلوم") || majorName.includes("دبلوم")) {
    return 72;
  }
  if (majorName.includes("هندسة") && !majorName.includes("برمجيات")) {
    return 164;
  }

  return fallbackTotal;
}

/**
 * Calculates official tuition fees using student's actual major rate + official PTUK fixed registration fee (25 JOD).
 */
export function calculateOfficialTuition(
  credits: number,
  student?: StudentSyncProfile | null,
  configOverride?: Partial<TuitionConfig>,
): TuitionCalculationResult {
  let rate = 25;
  try {
    const saved =
      typeof window !== "undefined" && window.localStorage
        ? window.localStorage.getItem("ptuk_hourly_rate")
        : null;
    if (saved) {
      rate = Number(saved);
    } else if (student?.majorName) {
      rate = getOfficialTuitionRate(student.majorName).hourlyRateJOD;
    }
  } catch {
    if (student?.majorName) {
      rate = getOfficialTuitionRate(student.majorName).hourlyRateJOD;
    }
  }

  const finalConfig: Partial<TuitionConfig> = {
    hourlyRate: rate,
    fixedFees: 25, // Official PTUK registration fee
    currency: "JOD",
    exchangeRate: 5.2,
    ...configOverride,
  };

  return calculateDetailedTuition(credits, finalConfig);
}

/**
 * Returns active academic semester code based on current date (e.g. "20241", "20242", "20243").
 */
export function getCurrentAcademicSemesterCode(): string {
  const now = new Date();
  const calYear = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const termDigit =
    month >= 2 && month <= 5 ? "2" : month >= 6 && month <= 8 ? "3" : "1";
  const academicYear =
    month < 9 && (termDigit === "2" || termDigit === "3")
      ? calYear - 1
      : calYear;
  return `${academicYear}${termDigit}`;
}

/**
 * Returns active academic year string (e.g. "2024/2025" or "2026/2027").
 */
export function getCurrentAcademicYearString(): string {
  const now = new Date();
  const calYear = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 8 ? `${calYear}/${calYear + 1}` : `${calYear - 1}/${calYear}`;
}

/**
 * Classifies if a section is delivered online/asynchronously.
 * Prevents false classroom physical collision alerts.
 */
export function isSectionOnline(sectionOrItem: any): boolean {
  if (!sectionOrItem) return false;
  if (sectionOrItem.isOnline === true) return true;
  const timeText = String(
    sectionOrItem.timeText || sectionOrItem.rawTime || "",
  ).toLowerCase();
  if (
    timeText.includes("online") ||
    timeText.includes("الكتروني") ||
    timeText.includes("إلكتروني") ||
    timeText.includes("عن بعد") ||
    timeText.includes("moodle")
  ) {
    return true;
  }
  const room = String(sectionOrItem.room || "").toLowerCase();
  if (
    room.includes("online") ||
    room.includes("الكتروني") ||
    room.includes("إلكتروني") ||
    room.includes("5000") ||
    room.includes("10000") ||
    room.includes("moodle")
  ) {
    return true;
  }
  if (Array.isArray(sectionOrItem.blocks) && sectionOrItem.blocks.length > 0) {
    const allZero = sectionOrItem.blocks.every(
      (b: any) => (b.start === 0 && b.end === 0) || !b.start,
    );
    if (
      allZero &&
      (!sectionOrItem.blocks[0]?.days ||
        sectionOrItem.blocks[0]?.days.length === 0)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Extracts authentic admission cohort year for a student.
 */
export function getOfficialCohortYear(
  student?: StudentSyncProfile | null,
): string {
  const parsed = extractCohortYear(student);
  if (parsed) return String(parsed);
  if (student?.cohortYear) return String(student.cohortYear);
  return String(new Date().getFullYear());
}
