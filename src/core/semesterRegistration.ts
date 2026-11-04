import type { Course, ScheduleEntry } from "../data";
import { normalizeDayKey } from "../services/scheduleSolver.js";

export type PlanKey = "A" | "B" | "C";

export interface RegistrationSectionItem {
  courseId: string;
  courseName: string;
  section: string;
  credits: number;
  instructor?: string;
  room?: string;
  timeText?: string;
  priority: number; // 1 = highest priority (e.g. labs, limited seats), 2 = normal, 3 = elective
  category?: string;
  reserveSection?: string; // Point 10: Reserve section fallback if primary is full
  isOnline?: boolean;
  blocks?: Array<{
    days: string[];
    start: number;
    end: number;
    rawTime?: string;
  }>;
}

export interface RegistrationPlan {
  id: PlanKey;
  title: string;
  description: string;
  items: RegistrationSectionItem[];
  totalCredits: number;
  estimatedTuition: number; // e.g. credits * 25 JOD
}

export type CourseRegistrationStatus =
  | "pending"
  | "registering"
  | "registered"
  | "full"
  | "financial_issue"
  | "prereq_missing"
  | "conflict"
  | "server_error"
  | "skipped";

export interface CourseAttemptResult {
  courseId: string;
  courseName: string;
  section: string;
  originalPlan: PlanKey;
  effectivePlan: PlanKey;
  effectiveSection: string;
  status: CourseRegistrationStatus;
  message: string;
  retriesCount: number;
  timestamp: string;
  fallbackUsed?: boolean;
}

export interface PlanDiagnostic {
  type: "warning" | "error" | "info" | "success";
  code:
    | "CAPACITY_FULL"
    | "INSUFFICIENT_FUNDS"
    | "PREREQ_MISSING"
    | "TIME_CONFLICT"
    | "CREDIT_LIMIT_EXCEEDED"
    | "SERVER_TIMEOUT";
  title: string;
  detail: string;
  courseId?: string;
  suggestedAction?: string;
}

export interface RegistrationExecutionSummary {
  status:
    | "idle"
    | "running"
    | "completed"
    | "partial"
    | "failed"
    | "portal_closed"
    | "financial_hold";
  activePlan: PlanKey;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  totalItems: number;
  registeredCount: number;
  failedCount: number;
  items: CourseAttemptResult[];
  diagnostics: PlanDiagnostic[];
}

const STORAGE_PLANS_PREFIX = "ptuk_registration_plans_v1_";
const DEFAULT_CREDIT_HOUR_COST = 25; // Standard bachelor credit cost in JOD

/**
 * Storage key for semester registration plans.
 */
export function getRegistrationPlansStorageKey(semester: string): string {
  return `${STORAGE_PLANS_PREFIX}${semester.replace(/\s+/g, "_")}`;
}

/**
 * Creates default empty 3-plan structure.
 */
export function createDefaultRegistrationPlans(): Record<
  PlanKey,
  RegistrationPlan
> {
  return {
    A: {
      id: "A",
      title: "الخطة (أ) - الخطة الأساسية",
      description: "الجدول المثالي المفضل بأفضل أوقات المحاضرات والدكاترة",
      items: [],
      totalCredits: 0,
      estimatedTuition: 0,
    },
    B: {
      id: "B",
      title: "الخطة (ب) - البديل الأول",
      description: "شعب ومواعيد بديلة في حال امتلاء إحدى شعب الخطة الأولى",
      items: [],
      totalCredits: 0,
      estimatedTuition: 0,
    },
    C: {
      id: "C",
      title: "الخطة (ج) - خطة الطوارئ",
      description:
        "خيارات احتياطية إضافية لضمان تثبيت الساعات المطلوبة بدون ضياع الفصل",
      items: [],
      totalCredits: 0,
      estimatedTuition: 0,
    },
  };
}

/**
 * Loads registration plans from localStorage or returns default template.
 */
export function loadRegistrationPlans(
  semester: string,
): Record<PlanKey, RegistrationPlan> {
  const defaults = createDefaultRegistrationPlans();
  if (typeof window === "undefined" || !window.localStorage) {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(
      getRegistrationPlansStorageKey(semester),
    );
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          A: recalculatePlanMetrics(parsed.A || defaults.A),
          B: recalculatePlanMetrics(parsed.B || defaults.B),
          C: recalculatePlanMetrics(parsed.C || defaults.C),
        };
      }
    }
  } catch (err) {
    console.error("Error reading registration plans from storage:", err);
  }

  return defaults;
}

/**
 * Persists registration plans to localStorage.
 */
export function saveRegistrationPlans(
  semester: string,
  plans: Record<PlanKey, RegistrationPlan>,
): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const prepared = {
      A: recalculatePlanMetrics(plans.A),
      B: recalculatePlanMetrics(plans.B),
      C: recalculatePlanMetrics(plans.C),
    };
    window.localStorage.setItem(
      getRegistrationPlansStorageKey(semester),
      JSON.stringify(prepared),
    );
  } catch (err) {
    console.error("Error saving registration plans:", err);
  }
}

/**
 * Recalculates total credits and estimated tuition for a plan.
 */
export function recalculatePlanMetrics(
  plan: RegistrationPlan,
): RegistrationPlan {
  const totalCredits = (plan.items || []).reduce(
    (sum, item) => sum + (item.credits || 0),
    0,
  );
  const estimatedTuition = totalCredits * DEFAULT_CREDIT_HOUR_COST;
  return {
    ...plan,
    totalCredits,
    estimatedTuition,
  };
}

/**
 * Checks for time collisions between sections inside a plan.
 */
export function validatePlanCollisions(
  items: RegistrationSectionItem[],
): PlanDiagnostic[] {
  const diagnostics: PlanDiagnostic[] = [];

  const isItemOnline = (item: RegistrationSectionItem) => {
    if (item.isOnline === true) return true;
    const r = (item.room || "").trim();
    if (/^\d{4,5}$/.test(r) || r.includes("5000") || r.includes("10000"))
      return true;
    const t = `${item.timeText || ""} ${r}`.toLowerCase();
    if (
      t.includes("الكتروني") ||
      t.includes("online") ||
      t.includes("عن بعد") ||
      t.includes("moodle")
    )
      return true;
    return false;
  };

  const isBlockOnline = (b: {
    start?: number;
    end?: number;
    rawTime?: string;
    days?: string[];
  }) => {
    if (b.start === 0 && b.end === 0) return true;
    if (!b.days || b.days.length === 0) return true;
    const t = (b.rawTime || "").toLowerCase();
    if (
      t.includes("الكتروني") ||
      t.includes("online") ||
      t.includes("عن بعد") ||
      t.includes("moodle")
    )
      return true;
    return false;
  };

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];

      // Online lectures never produce physical classroom conflicts
      if (isItemOnline(a) || isItemOnline(b)) {
        continue;
      }

      if (
        !a.blocks ||
        !b.blocks ||
        a.blocks.length === 0 ||
        b.blocks.length === 0
      ) {
        continue;
      }

      for (const blockA of a.blocks) {
        if (isBlockOnline(blockA)) continue;
        for (const blockB of b.blocks) {
          if (isBlockOnline(blockB)) continue;
          const commonDays = (blockA.days || []).some((dayA) =>
            (blockB.days || []).some(
              (dayB) => normalizeDayKey(dayA) === normalizeDayKey(dayB),
            ),
          );

          if (commonDays) {
            // Check time overlap: startA < endB && endA > startB
            if (blockA.start < blockB.end && blockA.end > blockB.start) {
              diagnostics.push({
                type: "error",
                code: "TIME_CONFLICT",
                title: "تعارض في أوقات المحاضرات",
                detail: `يوجد تعارض زمني بين مساق "${a.courseName}" (شعبة ${a.section}) ومساق "${b.courseName}" (شعبة ${b.section}).`,
                courseId: a.courseId,
                suggestedAction: `اختر شعبة بديلة لمساق ${b.courseName} لتفادي رفض التسجيل تلقائياً.`,
              });
            }
          }
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Validates course prerequisites against student passed courses.
 */
export function checkPlanPrerequisites(
  items: RegistrationSectionItem[],
  passedCourseIds: ReadonlySet<string>,
  catalogCourses: readonly Course[],
): PlanDiagnostic[] {
  const diagnostics: PlanDiagnostic[] = [];
  const courseMap = new Map(catalogCourses.map((c) => [c.id, c]));

  for (const item of items) {
    const course = courseMap.get(item.courseId);
    if (
      !course ||
      !Array.isArray(course.prerequisites) ||
      course.prerequisites.length === 0
    ) {
      continue;
    }

    const missingPrereqs: string[] = [];
    for (const prereqId of course.prerequisites) {
      if (!passedCourseIds.has(prereqId)) {
        const prereqCourse = courseMap.get(prereqId);
        missingPrereqs.push(prereqCourse?.name || prereqId);
      }
    }

    if (missingPrereqs.length > 0) {
      diagnostics.push({
        type: "error",
        code: "PREREQ_MISSING",
        title: "عدم استيفاء المتطلب السابق",
        detail: `مساق "${item.courseName}" يتطلب اجتياز: ${missingPrereqs.join("، ")}.`,
        courseId: item.courseId,
        suggestedAction:
          "لا يمكن تثبيت هذه الشعبة حتى يتم إنهاء المتطلبات السابقة أولاً.",
      });
    }
  }

  return diagnostics;
}

/**
 * Parses financial balance text and checks whether it covers tuition cost.
 */
export function checkPlanFinancialBalance(
  totalCredits: number,
  financialBalanceText?: string,
  creditHourCost: number = DEFAULT_CREDIT_HOUR_COST,
): {
  isSufficient: boolean;
  balanceNum: number;
  requiredCost: number;
  deficit: number;
  diagnostic?: PlanDiagnostic;
} {
  const requiredCost = totalCredits * creditHourCost;
  let balanceNum = 0;

  if (financialBalanceText) {
    // e.g. "150 دائن", "-50 مدين", "0 دائن"
    const digitsMatch = financialBalanceText.match(/-?\d+(?:\.\d+)?/);
    if (digitsMatch) {
      balanceNum = parseFloat(digitsMatch[0]);
      if (financialBalanceText.includes("مدين") && balanceNum > 0) {
        balanceNum = -balanceNum;
      }
    }
  }

  const deficit = Math.max(0, requiredCost - balanceNum);
  const isSufficient = balanceNum >= requiredCost || requiredCost === 0;

  let diagnostic: PlanDiagnostic | undefined;
  if (!isSufficient && deficit > 0) {
    diagnostic = {
      type: "warning",
      code: "INSUFFICIENT_FUNDS",
      title: "الرصيد المالي غير كافٍ لتثبيت التسجيل",
      detail: `رصيدك الجامعي الحالي (${balanceNum} د.أ) أقل من تكلفة الساعات المطلوبة (${requiredCost} د.أ). النقص المالي التقديري: ${deficit} د.أ.`,
      suggestedAction:
        "ينصح بتسديد رسوم الساعات مسبقاً لدى الدائرة المالية أو عبر قنوات الدفع الإلكتروني لتفادي رفض تثبيت الشعب.",
    };
  }

  return {
    isSufficient,
    balanceNum,
    requiredCost,
    deficit,
    diagnostic,
  };
}

/**
 * Validates plan credit load against PTUK academic regulations:
 * - Summer semester: max 10 credits (or 6 under warning, up to 12 if graduating)
 * - Regular semester: min 12 credits, max 19 credits (or 14 under warning, up to 21 if graduating)
 */
export function checkPlanCreditLimits(
  totalCredits: number,
  semester: string = "",
  options: {
    hasAcademicWarning?: boolean;
    isGraduating?: boolean;
    gpa?: number;
  } = {},
): PlanDiagnostic[] {
  const diagnostics: PlanDiagnostic[] = [];
  const isSummer = semester.includes("الصيفي");

  const minCredits = isSummer ? 0 : 12;
  let maxCredits = isSummer ? 10 : 19;

  if (
    options.hasAcademicWarning ||
    (typeof options.gpa === "number" && options.gpa > 0 && options.gpa < 60)
  ) {
    maxCredits = isSummer ? 6 : 14;
  } else if (options.isGraduating) {
    maxCredits = isSummer ? 12 : 21;
  }

  if (totalCredits > maxCredits) {
    diagnostics.push({
      type: "error",
      code: "CREDIT_LIMIT_EXCEEDED",
      title: "تجاوز الحد الأعلى للعبء الدراسي",
      detail: `إجمالي الساعات المحددة (${totalCredits} س) يتجاوز الحد الأقصى المسموح به رسمياً (${maxCredits} س)${
        options.hasAcademicWarning
          ? " للطالب الواقع تحت الملاحظة الأكاديمية"
          : isSummer
            ? " في الفصل الصيفي"
            : ""
      }.`,
      suggestedAction: `احذف أو انقل بعض المواد البديلة إلى الخطة (ب) لتخفيض العبء إلى ${maxCredits} ساعة كحد أقصى.`,
    });
  } else if (totalCredits > 0 && totalCredits < minCredits) {
    diagnostics.push({
      type: "warning",
      code: "CREDIT_LIMIT_EXCEEDED",
      title: "أقل من الحد الأدنى للعبء الدراسي",
      detail: `إجمالي الساعات المسجلة (${totalCredits} س) أقل من الحد الأدنى للعبء الدراسي الفصلي (${minCredits} س) وفق تعليمات خضوري.`,
      suggestedAction:
        "أضف مساقاً إضافياً للوصول للحد الأدنى (12 ساعة) لتجنب تأخير التخرج أو مشاكل تثبيت القسط.",
    });
  }

  return diagnostics;
}

/**
 * Resolves a fallback section for a course:
 * 1. Checks if the current plan item defines a reserveSection fallback.
 * 2. Cascades across Plans B and C if no reserveSection or if cascading further.
 */
export function resolveCascadingFallback(
  courseId: string,
  currentPlan: PlanKey,
  plans: Record<PlanKey, RegistrationPlan>,
): {
  fallbackPlan: PlanKey;
  item: RegistrationSectionItem;
  isReserveSection?: boolean;
} | null {
  const currentItem = plans[currentPlan]?.items?.find(
    (i) => i.courseId === courseId,
  );
  if (
    currentItem &&
    currentItem.reserveSection &&
    currentItem.reserveSection.trim() !== "" &&
    currentItem.reserveSection.trim() !== currentItem.section.trim()
  ) {
    return {
      fallbackPlan: currentPlan,
      item: {
        ...currentItem,
        section: currentItem.reserveSection.trim(),
      },
      isReserveSection: true,
    };
  }

  const planOrder: PlanKey[] =
    currentPlan === "A" ? ["B", "C"] : currentPlan === "B" ? ["C"] : [];

  for (const nextPlan of planOrder) {
    const candidate = plans[nextPlan]?.items?.find(
      (i) => i.courseId === courseId,
    );
    if (candidate) {
      return { fallbackPlan: nextPlan, item: candidate };
    }
  }

  return null;
}

/**
 * Sorts registration items by critical priority (labs, single-sections, limited-seat first).
 */
export function sortRegistrationItemsByPriority(
  items: RegistrationSectionItem[],
): RegistrationSectionItem[] {
  return [...items].sort((a, b) => {
    // Explicit priority first (1 is highest)
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // Labs (1 credit) are usually highest competition
    if (a.credits === 1 && b.credits > 1) return -1;
    if (b.credits === 1 && a.credits > 1) return 1;
    // Core requirements before electives
    const aIsCore = (a.category || "").includes("إجباري");
    const bIsCore = (b.category || "").includes("إجباري");
    if (aIsCore && !bIsCore) return -1;
    if (!aIsCore && bIsCore) return 1;
    const nameDiff = a.courseName.localeCompare(b.courseName, "ar");
    if (nameDiff !== 0) return nameDiff;
    const idDiff = String(a.courseId).localeCompare(String(b.courseId));
    if (idDiff !== 0) return idDiff;
    return String(a.section).localeCompare(String(b.section));
  });
}

/**
 * Calculates total gap hours (waiting time between lectures) for a plan across weekdays.
 */
export function calculatePlanGaps(items: RegistrationSectionItem[]): {
  totalGapHours: number;
  dayGaps: Record<string, number>;
} {
  const weekdays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  const dayGaps: Record<string, number> = {};
  let totalGapHours = 0;

  for (const day of weekdays) {
    const dayBlocks: Array<{ start: number; end: number }> = [];

    for (const item of items) {
      if (!item.blocks) continue;
      for (const b of item.blocks) {
        const matchesDay = b.days.some(
          (d) => normalizeDayKey(d) === normalizeDayKey(day),
        );
        if (
          matchesDay &&
          typeof b.start === "number" &&
          typeof b.end === "number"
        ) {
          dayBlocks.push({ start: b.start, end: b.end });
        }
      }
    }

    if (dayBlocks.length <= 1) {
      dayGaps[day] = 0;
      continue;
    }

    dayBlocks.sort((a, b) => a.start - b.start);
    let currentDayGap = 0;

    for (let i = 0; i < dayBlocks.length - 1; i++) {
      const gap = dayBlocks[i + 1].start - dayBlocks[i].end;
      if (gap > 0) {
        currentDayGap += gap;
      }
    }

    const roundedGap = Math.round(currentDayGap * 10) / 10;
    dayGaps[day] = roundedGap;
    totalGapHours += roundedGap;
  }

  return {
    totalGapHours: Math.round(totalGapHours * 10) / 10,
    dayGaps,
  };
}

/**
 * Automatically calculates a recommended priority level (1 = critical/lab, 2 = standard, 3 = elective).
 */
export function autoDetermineItemPriority(item: {
  credits: number;
  category?: string;
  courseName?: string;
}): number {
  // Labs (1 credit) are highest bottleneck
  if (item.credits === 1) return 1;
  const cat = item.category || "";
  if (cat.includes("تخصص إجباري") || cat.includes("كلية إجباري")) return 1;
  if (cat.includes("اختياري") || cat.includes("حرة")) return 3;
  return 2;
}

/**
 * Compares Plans A, B, and C side-by-side to show section differences and credits.
 */
export function comparePlansSideBySide(
  plans: Record<PlanKey, RegistrationPlan>,
): {
  courses: Array<{
    courseId: string;
    courseName: string;
    credits: number;
    sectionA?: string;
    sectionB?: string;
    sectionC?: string;
    isIdentical: boolean;
  }>;
  metrics: Record<
    PlanKey,
    {
      totalCredits: number;
      totalCourses: number;
      totalGaps: number;
    }
  >;
} {
  const courseMap = new Map<
    string,
    { courseId: string; courseName: string; credits: number }
  >();

  for (const key of ["A", "B", "C"] as PlanKey[]) {
    for (const item of plans[key]?.items || []) {
      if (!courseMap.has(item.courseId)) {
        courseMap.set(item.courseId, {
          courseId: item.courseId,
          courseName: item.courseName,
          credits: item.credits,
        });
      }
    }
  }

  const courses = Array.from(courseMap.values()).map((c) => {
    const secA = plans.A?.items?.find(
      (i) => i.courseId === c.courseId,
    )?.section;
    const secB = plans.B?.items?.find(
      (i) => i.courseId === c.courseId,
    )?.section;
    const secC = plans.C?.items?.find(
      (i) => i.courseId === c.courseId,
    )?.section;
    const isIdentical = secA === secB && secB === secC;

    return {
      courseId: c.courseId,
      courseName: c.courseName,
      credits: c.credits,
      sectionA: secA,
      sectionB: secB,
      sectionC: secC,
      isIdentical,
    };
  });

  const metrics: Record<
    PlanKey,
    { totalCredits: number; totalCourses: number; totalGaps: number }
  > = {
    A: {
      totalCredits: plans.A?.totalCredits || 0,
      totalCourses: plans.A?.items?.length || 0,
      totalGaps: calculatePlanGaps(plans.A?.items || []).totalGapHours,
    },
    B: {
      totalCredits: plans.B?.totalCredits || 0,
      totalCourses: plans.B?.items?.length || 0,
      totalGaps: calculatePlanGaps(plans.B?.items || []).totalGapHours,
    },
    C: {
      totalCredits: plans.C?.totalCredits || 0,
      totalCourses: plans.C?.items?.length || 0,
      totalGaps: calculatePlanGaps(plans.C?.items || []).totalGapHours,
    },
  };

  return { courses, metrics };
}

/**
 * Seat Watcher item data model
 */
export interface SeatWatcherItem {
  courseId: string;
  courseName: string;
  section: string;
  instructor?: string;
  timeText?: string;
  capacity?: number;
  registered?: number;
  available?: number;
  isAvailable?: boolean;
  lastChecked?: string;
}

const SEAT_WATCHER_STORAGE_KEY = "ptuk_seat_watcher_items_v1";

export function loadSeatWatchList(): SeatWatcherItem[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(SEAT_WATCHER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSeatWatchList(items: SeatWatcherItem[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(SEAT_WATCHER_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Failed to save seat watcher list", e);
  }
}

/**
 * Exports registration plans to a portable, lightweight share code.
 */
export function exportPlansToShareCode(
  plans: Record<PlanKey, RegistrationPlan>,
): string {
  try {
    const compact: Record<string, unknown> = { v: 2 };
    (["A", "B", "C"] as PlanKey[]).forEach((k) => {
      compact[k] = {
        title: plans[k].title,
        items: plans[k].items.map((it) => ({
          courseId: it.courseId,
          courseName: it.courseName,
          section: it.section,
          reserveSection: it.reserveSection,
          credits: it.credits,
          priority: it.priority,
          blocks: it.blocks,
        })),
      };
    });
    const json = JSON.stringify(compact);
    if (typeof window !== "undefined" && typeof window.btoa === "function") {
      return "REG2:" + btoa(unescape(encodeURIComponent(json)));
    }
    return "REG2:" + Buffer.from(json, "utf-8").toString("base64");
  } catch {
    return "";
  }
}

/**
 * Imports registration plans from a portable share string (supports both compact REG2 and legacy v1).
 */
export function importPlansFromShareCode(
  code: string,
): Record<PlanKey, RegistrationPlan> | null {
  try {
    const raw = code.trim();
    const isV2 = raw.startsWith("REG2:");
    const cleanBase64 = isV2 ? raw.slice(5) : raw;

    let json = "";
    if (typeof window !== "undefined" && typeof window.atob === "function") {
      json = decodeURIComponent(escape(atob(cleanBase64)));
    } else {
      json = Buffer.from(cleanBase64, "base64").toString("utf-8");
    }
    const parsed = JSON.parse(json);
    if (!parsed) return null;

    if (isV2 && parsed.v === 2) {
      const defaults = createDefaultRegistrationPlans();
      (["A", "B", "C"] as PlanKey[]).forEach((k) => {
        if (parsed[k]) {
          defaults[k].title = parsed[k].title || defaults[k].title;
          defaults[k].items = Array.isArray(parsed[k].items)
            ? parsed[k].items
            : [];
          defaults[k].totalCredits = defaults[k].items.reduce(
            (s: number, i: any) => s + (i.credits || 0),
            0,
          );
        }
      });
      return defaults;
    }

    if (parsed.plans && parsed.plans.A) {
      return parsed.plans;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Swaps item priority order up or down (Point 26).
 */
export function movePlanItemPriority(
  items: RegistrationSectionItem[],
  courseId: string,
  direction: "up" | "down",
): RegistrationSectionItem[] {
  const index = items.findIndex((i) => i.courseId === courseId);
  if (index === -1) return items;
  if (direction === "up" && index === 0) return items;
  if (direction === "down" && index === items.length - 1) return items;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  const newItems = [...items];
  const temp = newItems[index];
  newItems[index] = newItems[targetIndex];
  newItems[targetIndex] = temp;

  return newItems.map((item, idx) => ({
    ...item,
    priority: idx + 1,
  }));
}

/**
 * Tuition configuration and calculator (Point 21).
 */
export interface TuitionConfig {
  hourlyRate: number; // in JOD
  fixedFees: number; // in JOD
  labInsurance?: number; // in JOD (optional lab insurance - Item 34)
  currency: "JOD" | "ILS";
  exchangeRate: number; // ILS per JOD, default 5.2
}

export interface TuitionCalculationResult {
  hourlyRate: number;
  fixedFees: number;
  labInsurance: number;
  creditsCostJOD: number;
  creditsCostILS: number;
  totalJOD: number;
  totalILS: number;
}

export function calculateDetailedTuition(
  credits: number,
  config?: Partial<TuitionConfig>,
): TuitionCalculationResult {
  const safeCredits = Math.max(0, Number.isFinite(credits) ? credits : 0);
  const hourlyRate = Math.max(
    0,
    config?.hourlyRate ?? DEFAULT_CREDIT_HOUR_COST,
  );
  // Official PTUK Fixed Fees: 25 JOD semester registration + 1 JOD student union = 26 JOD
  const fixedFees = Math.max(0, config?.fixedFees ?? 26);
  const labInsurance = Math.max(0, config?.labInsurance ?? 0);
  const exchangeRate =
    config?.exchangeRate && config.exchangeRate > 0
      ? config.exchangeRate
      : 5.15;

  const creditsCostJOD = safeCredits * hourlyRate;
  const totalJOD = creditsCostJOD + fixedFees + labInsurance;
  const creditsCostILS = Math.round(creditsCostJOD * exchangeRate);
  const totalILS = Math.round(totalJOD * exchangeRate);

  return {
    hourlyRate,
    fixedFees,
    labInsurance,
    creditsCostJOD,
    creditsCostILS,
    totalJOD,
    totalILS,
  };
}

/**
 * Section saturation calculator (Point 15).
 */
export interface SectionSaturationInfo {
  registered: number;
  capacity: number;
  available: number;
  percent: number;
  status: "open" | "critical" | "full";
  badgeText: string;
}

export function calculateSectionSaturation(
  registered: number = 0,
  capacity: number = 40,
): SectionSaturationInfo {
  const safeCap = Math.max(1, capacity);
  const safeReg = Math.max(0, registered);
  const available = Math.max(0, safeCap - safeReg);
  const percent = Math.min(100, Math.round((safeReg / safeCap) * 100));

  let status: "open" | "critical" | "full" = "open";
  let badgeText = `${available} مقعد متاح`;

  if (available === 0 || safeReg >= safeCap) {
    status = "full";
    badgeText = "ممتلئة بالكامل";
  } else if (available <= 2) {
    status = "critical";
    badgeText = `حرجة - مهددة بالإغلاق (بقي ${available} مقعد)`;
  } else if (percent >= 85 || available <= 5) {
    status = "critical";
    badgeText = `مهددة بالإغلاق (${available} مقاعد)`;
  }

  return {
    registered: safeReg,
    capacity: safeCap,
    available,
    percent,
    status,
    badgeText,
  };
}

/**
 * Checks if a section is closed (capacity reached) - Point 4.
 */
export function isSectionClosed(
  registered?: number,
  capacity?: number,
): boolean {
  if (capacity === undefined || capacity === null) return false;
  if (registered === undefined || registered === null) return false;
  return registered >= capacity;
}

/**
 * Filters sections by meeting pattern (2 days vs 3 days) - Point 6.
 */
export function filterSectionsByMeetingPattern<
  T extends { blocks?: Array<{ days?: string[] }> },
>(sections: T[], pattern: "all" | "2days" | "3days"): T[] {
  if (pattern === "all") return sections;
  return sections.filter((sec) => {
    const days = new Set<string>();
    (sec.blocks || []).forEach((b) => {
      (b.days || []).forEach((d) => {
        const k = normalizeDayKey(d);
        if (k) days.add(k);
      });
    });
    if (pattern === "2days") {
      return days.size === 2;
    }
    if (pattern === "3days") {
      return days.size === 3;
    }
    return true;
  });
}

/**
 * Generates RFC 5545 iCalendar (.ics) format for phone and desktop calendar sync - Point 14.
 */
export function generateRegistrationCalendarICS(
  items: RegistrationSectionItem[],
  semesterTitle: string = "جدول الفصل الدراسي - خضوري",
): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const dtStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PTUK Student Portal//Registration Schedule//AR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${semesterTitle}`,
    "X-WR-TIMEZONE:Asia/Hebron",
  ];

  const dayMap: Record<string, { rruleDay: string; dayOffset: number }> = {
    أح: { rruleDay: "SU", dayOffset: 0 },
    اث: { rruleDay: "MO", dayOffset: 1 },
    ثلا: { rruleDay: "TU", dayOffset: 2 },
    ار: { rruleDay: "WE", dayOffset: 3 },
    خمـ: { rruleDay: "TH", dayOffset: 4 },
    سب: { rruleDay: "SA", dayOffset: 6 },
    جم: { rruleDay: "FR", dayOffset: 5 },
    U: { rruleDay: "SU", dayOffset: 0 },
    M: { rruleDay: "MO", dayOffset: 1 },
    T: { rruleDay: "TU", dayOffset: 2 },
    W: { rruleDay: "WE", dayOffset: 3 },
    R: { rruleDay: "TH", dayOffset: 4 },
    S: { rruleDay: "SA", dayOffset: 6 },
  };

  const baseDate = new Date();
  const currentDay = baseDate.getDay();
  const diffToSunday = (7 - currentDay) % 7;
  baseDate.setDate(baseDate.getDate() + diffToSunday);

  let eventCounter = 1;

  for (const item of items) {
    if (!item.blocks || item.blocks.length === 0) continue;

    for (const block of item.blocks) {
      const days = block.days || [];
      if (days.length === 0) continue;

      const rruleDays = days
        .map((d) => {
          const k = normalizeDayKey(d);
          return k ? dayMap[k]?.rruleDay : undefined;
        })
        .filter(Boolean);

      if (rruleDays.length === 0) continue;

      const startHours = Math.floor(block.start || 8);
      const startMins = Math.round(((block.start || 8) % 1) * 60);
      const endHours = Math.floor(block.end || startHours + 1);
      const endMins = Math.round(((block.end || startHours + 1) % 1) * 60);

      const primaryKey = normalizeDayKey(days[0]);
      const primaryOffset: number =
        primaryKey && dayMap[primaryKey] ? dayMap[primaryKey].dayOffset : 0;
      const eventDate = new Date(baseDate);
      eventDate.setDate(baseDate.getDate() + primaryOffset);

      const dtStart = `${eventDate.getFullYear()}${pad(eventDate.getMonth() + 1)}${pad(eventDate.getDate())}T${pad(startHours)}${pad(startMins)}00`;
      const dtEnd = `${eventDate.getFullYear()}${pad(eventDate.getMonth() + 1)}${pad(eventDate.getDate())}T${pad(endHours)}${pad(endMins)}00`;

      const untilDate = new Date(eventDate);
      untilDate.setDate(untilDate.getDate() + 16 * 7);
      const untilStr = `${untilDate.getUTCFullYear()}${pad(untilDate.getUTCMonth() + 1)}${pad(untilDate.getUTCDate())}T235959Z`;

      lines.push("BEGIN:VEVENT");
      lines.push(
        `UID:ptuk-${item.courseId}-${item.section}-${eventCounter++}@ptuk.edu.ps`,
      );
      lines.push(`DTSTAMP:${dtStamp}`);
      lines.push(`DTSTART;TZID=Asia/Hebron:${dtStart}`);
      lines.push(`DTEND;TZID=Asia/Hebron:${dtEnd}`);
      lines.push(
        `RRULE:FREQ=WEEKLY;BYDAY=${rruleDays.join(",")};UNTIL=${untilStr}`,
      );
      lines.push(`SUMMARY:${item.courseName} (شعبة ${item.section})`);
      lines.push(`LOCATION:${item.room || "قاعة المحاضرات - حرم خضوري"}`);
      lines.push(
        `DESCRIPTION:المساق: ${item.courseName}\\nالمدرس: ${item.instructor || "غير محدد"}\\nالشعبة: ${item.section}\\nالساعات: ${item.credits}`,
      );
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(`DESCRIPTION:تذكير: محاضرة ${item.courseName} بعد 15 دقيقة`);
      lines.push("TRIGGER:-PT15M");
      lines.push("END:VALARM");
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/**
 * Generates shareable URL with plan payload - Point 15 & 36.
 */
export function generateShareablePlanUrl(
  plans: Record<PlanKey, RegistrationPlan>,
  origin: string = "",
): string {
  const code = exportPlansToShareCode(plans);
  const base =
    origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/#/registration?shareCode=${encodeURIComponent(code)}`;
}

/**
 * Detects whether a candidate section introduces a time conflict with existing items.
 */
export function checkSectionTimeConflict(
  candidateBlocks:
    | {
        days?: string[];
        start: number;
        end: number;
        isOnline?: boolean;
        room?: string;
        rawTime?: string;
      }[]
    | undefined,
  existingItems: RegistrationSectionItem[],
  ignoreCourseId?: string,
): { hasConflict: boolean; conflictingCourseName?: string } {
  if (!candidateBlocks || candidateBlocks.length === 0)
    return { hasConflict: false };

  const isBlockOnline = (b: {
    isOnline?: boolean;
    room?: string;
    rawTime?: string;
    start?: number;
    end?: number;
  }) => {
    if (b.isOnline === true) return true;
    const r = (b.room || "").trim();
    if (/^\d{4,5}$/.test(r) || r.includes("5000") || r.includes("10000"))
      return true;
    const t = `${b.rawTime || ""} ${r}`.toLowerCase();
    if (
      t.includes("الكتروني") ||
      t.includes("online") ||
      t.includes("عن بعد") ||
      t.includes("moodle")
    )
      return true;
    if (b.start === 0 && b.end === 0) return true;
    return false;
  };

  for (const item of existingItems) {
    if (ignoreCourseId && item.courseId === ignoreCourseId) continue;
    if (!item.blocks || item.blocks.length === 0) continue;

    // Online items do not conflict with in-person lectures
    const isItemOnline = Boolean(
      (item.room && /^\d{4,5}$/.test(item.room.trim())) ||
      item.room?.includes("5000") ||
      item.room?.includes("10000") ||
      item.timeText?.includes("الكتروني") ||
      item.timeText?.includes("online"),
    );
    if (isItemOnline) continue;

    for (const candBlock of candidateBlocks) {
      if (isBlockOnline(candBlock)) continue;

      for (const itemBlock of item.blocks) {
        if (isBlockOnline(itemBlock)) continue;

        const commonDays = (candBlock.days || []).some((dayA) =>
          (itemBlock.days || []).some(
            (dayB) => normalizeDayKey(dayA) === normalizeDayKey(dayB),
          ),
        );

        if (commonDays) {
          const cStart = Number(candBlock.start) || 0;
          const cEnd = Number(candBlock.end) || 0;
          const iStart = Number(itemBlock.start) || 0;
          const iEnd = Number(itemBlock.end) || 0;

          if (cStart < iEnd && cEnd > iStart) {
            return {
              hasConflict: true,
              conflictingCourseName: item.courseName,
            };
          }
        }
      }
    }
  }

  return { hasConflict: false };
}

const PLAN_SNAPSHOT_PREFIX = "ptuk_reg_plan_snapshot_v1_";

/**
 * Saves an auto-snapshot of registration plans for emergency recovery.
 */
export function savePlanAutoSnapshot(
  semester: string,
  plans: Record<PlanKey, RegistrationPlan>,
): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const payload = {
      timestamp: Date.now(),
      plans,
    };
    window.localStorage.setItem(
      `${PLAN_SNAPSHOT_PREFIX}${semester}`,
      JSON.stringify(payload),
    );
  } catch {}
}

/**
 * Loads the latest auto-snapshot of registration plans.
 */
export function loadPlanAutoSnapshot(
  semester: string,
): { timestamp: number; plans: Record<PlanKey, RegistrationPlan> } | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(
      `${PLAN_SNAPSHOT_PREFIX}${semester}`,
    );
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
