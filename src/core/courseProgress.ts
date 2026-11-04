import type { Course } from "../data";
import { TOTAL_CREDITS } from "../constants";

export const REMEDIAL_COURSE_ID = "15200099";
export const COMPUTER_SKILLS_COURSE_ID = "13010006";
export const REMEDIAL_COURSE_IDS = new Set(["15200099", "13010006"]);
export const REMEDIAL_CATEGORY = "متطلب استدراكي إجباري";

export function isRemedialCourse(courseOrId: Course | string): boolean {
  if (typeof courseOrId === "string") {
    const id = courseOrId.trim();
    return REMEDIAL_COURSE_IDS.has(id);
  }
  if (!courseOrId) return false;
  const id = String(courseOrId.id || "").trim();
  if (REMEDIAL_COURSE_IDS.has(id)) return true;
  if (courseOrId.category === REMEDIAL_CATEGORY) return true;
  if (typeof courseOrId.name === "string") {
    const name = courseOrId.name.trim();
    if (name.includes("استدراكي") || name.includes("مهارات الحاسوب")) {
      return true;
    }
  }
  return false;
}

export function isDegreeCreditBearing(courseOrId: Course | string): boolean {
  return !isRemedialCourse(courseOrId);
}

export function toggleCompletedCourse(
  completedCourses: ReadonlySet<string>,
  courseId: string,
): Set<string> {
  const next = new Set(completedCourses);
  if (next.has(courseId)) {
    next.delete(courseId);
  } else {
    next.add(courseId);
  }
  return next;
}

export function markCoursesCompleted(
  completedCourses: ReadonlySet<string>,
  courseIds: readonly string[],
): Set<string> {
  return new Set([...completedCourses, ...courseIds]);
}

/**
 * Calculates total degree credits completed (excluding remedial non-degree courses).
 */
export function calculateDegreeCredits(
  courses: readonly Course[],
  completedCourseIds: ReadonlySet<string>,
): number {
  return courses.reduce((sum, course) => {
    if (completedCourseIds.has(course.id) && isDegreeCreditBearing(course)) {
      return sum + course.credits;
    }
    return sum;
  }, 0);
}

/**
 * Calculates planned degree credits (excluding already completed courses and remedial courses).
 */
export function calculatePlannedCredits(
  courses: readonly Course[],
  completedCourseIds: ReadonlySet<string>,
  plannedCourses: Record<string, string>,
): number {
  return courses.reduce((sum, course) => {
    if (
      !completedCourseIds.has(course.id) &&
      plannedCourses[course.id] &&
      isDegreeCreditBearing(course)
    ) {
      return sum + course.credits;
    }
    return sum;
  }, 0);
}

/**
 * Calculates remaining credits for degree completion locked to 164 total credits.
 * Ensures the value never drops below 0.
 */
export function calculateRemainingCredits(
  completedCredits: number,
  totalCredits: number = TOTAL_CREDITS,
): number {
  return Math.max(0, totalCredits - completedCredits);
}

/**
 * Calculates progress percentage capped at 100%.
 */
export function calculateProgressPercentage(
  credits: number,
  totalCredits: number = TOTAL_CREDITS,
): number {
  if (totalCredits <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((credits / totalCredits) * 100)));
}

/**
 * Calculates credits completed per category.
 */
export function calculateCategoryCredits(
  courses: readonly Course[],
  completedCourseIds: ReadonlySet<string>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const course of courses) {
    if (completedCourseIds.has(course.id)) {
      result[course.category] = (result[course.category] || 0) + course.credits;
    }
  }
  return result;
}

export interface CourseAvailabilityOptions {
  currentPlannedCourses?: ReadonlySet<string>;
  cumulativeEarnedCredits?: number;
  coreqMode?: "strict" | "permissive";
}

let cachedAllCoursesMap: Map<string, Course> | null = null;
let lastAllCoursesRef: readonly Course[] | null = null;

function getAllCoursesMap(allCourses: readonly Course[]): Map<string, Course> {
  if (allCourses === lastAllCoursesRef && cachedAllCoursesMap) {
    return cachedAllCoursesMap;
  }
  cachedAllCoursesMap = new Map(allCourses.map((c) => [c.id, c]));
  lastAllCoursesRef = allCourses;
  return cachedAllCoursesMap;
}

/**
 * Checks if an individual prerequisite condition is met by the completed courses.
 * Supports single course codes ("11100101") as well as alternative OR prerequisites
 * (e.g. "11100101|11100105" or "11100101/11100105" or "11100101 OR 11100105").
 */
export function isPrerequisiteSatisfied(
  prereqRule: string,
  completed: ReadonlySet<string>,
): boolean {
  if (!prereqRule) return true;
  const clean = prereqRule.trim();
  if (completed.has(clean)) return true;

  // Alternative prerequisite format: "id1|id2" or "id1/id2" or "id1 OR id2"
  if (clean.includes("|") || clean.includes("/") || clean.includes(" OR ")) {
    const alternatives = clean
      .split(/[/|]| OR /)
      .map((s) => s.trim())
      .filter(Boolean);
    return alternatives.some((alt) => completed.has(alt));
  }

  return false;
}

/**
 * Evaluates whether a course is available to be taken / planned.
 * - Completed courses are not available.
 * - Prerequisites must be completed in `completed` (or `allPrev`), supporting alternative OR rules.
 * - Co-requisites must be completed or planned in current semester (strict mode for planning/validation),
 *   or available concurrently (permissive mode for catalog/map discovery).
 * - Electives remain available even if category requirements are met (free exploration/swapping).
 * - Minimum credit thresholds (e.g. senior standing / graduation project / training) are validated.
 */
export function isCourseAvailable(
  course: Course,
  completed: ReadonlySet<string>,
  allCourses: readonly Course[] = [],
  options: CourseAvailabilityOptions = {},
): boolean {
  if (completed.has(course.id)) return false;

  // Check Prerequisites (supporting OR alternative prerequisites)
  const prereqsMet = course.prerequisites.every((p: string) =>
    isPrerequisiteSatisfied(p, completed),
  );
  if (!prereqsMet) return false;

  // Check Senior Standing / Minimum Credits threshold if specified
  if (course.minCredits !== undefined && course.minCredits > 0) {
    const earned =
      options.cumulativeEarnedCredits !== undefined
        ? options.cumulativeEarnedCredits
        : calculateDegreeCredits(allCourses, completed);
    if (earned < course.minCredits) return false;
  }

  // Check Co-requisites
  if (!course.coPrerequisites || course.coPrerequisites.length === 0) {
    return true;
  }

  const currentPlanned = options.currentPlannedCourses ?? new Set<string>();
  const coreqMode = options.coreqMode ?? "strict";

  return course.coPrerequisites.every((cpId: string) => {
    // Co-requisite is met if completed or planned in current semester
    if (completed.has(cpId) || currentPlanned.has(cpId)) return true;

    // In permissive mode (e.g. general catalog / map discovery), co-requisite is also met if available concurrently
    if (coreqMode === "permissive") {
      const coursesMap = getAllCoursesMap(allCourses);
      const cpCourse = coursesMap.get(cpId);
      if (!cpCourse) return false;
      return cpCourse.prerequisites.every((p: string) =>
        isPrerequisiteSatisfied(p, completed),
      );
    }

    return false;
  });
}

/**
 * Computes cumulative GPA, excluding remedial courses and Pass/Fail (-1) courses.
 */
export function calculateGPA(
  courses: readonly Course[],
  grades: Record<string, number>,
  completedCourses: ReadonlySet<string>,
  failedCourseIds: ReadonlySet<string> = new Set(),
  whatIfGrades: Record<string, number> = {},
  includeHypothetical = false,
): number {
  let totalPoints = 0;
  let totalCredits = 0;

  const coursesById = new Map(courses.map((c) => [c.id, c]));
  const completed = courses.filter((c) => completedCourses.has(c.id));
  const failed = courses.filter(
    (c) => failedCourseIds.has(c.id) && !completedCourses.has(c.id),
  );
  const combinedCourseList = [...completed, ...failed];

  combinedCourseList.forEach((course) => {
    if (isRemedialCourse(course)) return;

    let grade = grades[course.id] ?? 0;
    if (
      includeHypothetical &&
      whatIfGrades[course.id] !== undefined &&
      whatIfGrades[course.id] >= 0
    ) {
      grade = whatIfGrades[course.id];
    }

    const hasGradeEntry =
      Object.prototype.hasOwnProperty.call(grades, course.id) ||
      (includeHypothetical &&
        Object.prototype.hasOwnProperty.call(whatIfGrades, course.id));

    if (hasGradeEntry || failedCourseIds.has(course.id)) {
      if (grade !== -1) {
        if (grade > 0) {
          totalPoints += grade * course.credits;
        }
        totalCredits += course.credits;
      }
    }
  });

  if (includeHypothetical) {
    Object.entries(whatIfGrades).forEach(([id, grade]) => {
      if (!completedCourses.has(id) && !failedCourseIds.has(id) && grade > 0) {
        const course = coursesById.get(id);
        if (course && !isRemedialCourse(course)) {
          totalPoints += grade * course.credits;
          totalCredits += course.credits;
        }
      }
    });
  }

  return totalCredits === 0 ? 0 : totalPoints / totalCredits;
}

export interface TargetGPAResult {
  targetGPA: number;
  requiredRemainingGPA: number;
  isPossible: boolean;
  difficulty: "easy" | "moderate" | "challenging" | "impossible";
  difficultyLabel: string;
}

/**
 * Calculates the minimum GPA required in remaining credit hours to reach a target GPA.
 * @param currentGPA Current cumulative GPA (0-100%)
 * @param gradedCredits Graded credit hours attempted (denominator of current cumulative GPA)
 * @param targetGPA Desired target GPA (0-100%)
 * @param remainingCredits Remaining credit hours required to complete degree
 */
export function calculateTargetGPAAnalysis(
  currentGPA: number,
  gradedCredits: number,
  targetGPA: number,
  remainingCredits: number,
): TargetGPAResult {
  if (remainingCredits <= 0) {
    const isPossible = currentGPA >= targetGPA;
    return {
      targetGPA,
      requiredRemainingGPA: currentGPA,
      isPossible,
      difficulty: isPossible ? "easy" : "impossible",
      difficultyLabel: isPossible
        ? "متحقق بالفعل"
        : "غير ممكن لعدم توفر ساعات متبقية",
    };
  }

  const totalCredits = gradedCredits + remainingCredits;
  const currentTotalPoints = currentGPA * gradedCredits;
  const targetTotalPoints = targetGPA * totalCredits;
  const neededPoints = targetTotalPoints - currentTotalPoints;
  const rawRequired = neededPoints / remainingCredits;

  if (rawRequired > 100) {
    return {
      targetGPA,
      requiredRemainingGPA: Math.round(rawRequired * 10) / 10,
      isPossible: false,
      difficulty: "impossible",
      difficultyLabel: "غير ممكن حسابياً (يتطلب أكثر من 100%)",
    };
  }

  if (currentGPA >= targetGPA || rawRequired <= 60) {
    return {
      targetGPA,
      requiredRemainingGPA: Math.max(60, Math.round(rawRequired * 10) / 10),
      isPossible: true,
      difficulty: "easy",
      difficultyLabel:
        currentGPA >= targetGPA
          ? "الهدف محقق بالفعل (يكفي اجتياز الساعات بحد أدنى 60%)"
          : "متاح بسهولة (معدل 60% أو أقل)",
    };
  }

  if (rawRequired <= 75) {
    return {
      targetGPA,
      requiredRemainingGPA: Math.round(rawRequired * 10) / 10,
      isPossible: true,
      difficulty: "moderate",
      difficultyLabel: "متاح بجهد معتدل (بين 60% و 75%)",
    };
  }

  return {
    targetGPA,
    requiredRemainingGPA: Math.round(rawRequired * 10) / 10,
    isPossible: true,
    difficulty: "challenging",
    difficultyLabel: "يتطلب تفوقاً مرتفعاً (أعلى من 75%)",
  };
}

export interface RetakeRecommendation {
  course: Course;
  currentGrade: number;
  targetGrade: number;
  potentialGpaBoost: number;
  pointsGain: number;
}

/**
 * Identifies courses that provide the largest GPA increase if retaken.
 * Prioritizes failed courses (which give the largest GPA boost upon replacement in PTUK policy)
 * and degree courses with lower grades eligible for retake.
 * By default, suggests all courses that boost cumulative GPA by more than minGpaBoost (default > 0.1).
 */
export function getTopRetakeRecommendations(
  courses: readonly Course[],
  courseGrades: Record<string, number>,
  completedCourseIds: ReadonlySet<string>,
  failedCourseIdsOrTargetGrade?: ReadonlySet<string> | number,
  targetGrade = 85,
  limit?: number,
  minGpaBoost = 0.1,
): RetakeRecommendation[] {
  let failedCourseIds: ReadonlySet<string> = new Set();
  let effectiveTargetGrade = targetGrade;
  let effectiveLimit = limit;
  let effectiveMinGpaBoost = minGpaBoost;

  if (typeof failedCourseIdsOrTargetGrade === "number") {
    effectiveTargetGrade = failedCourseIdsOrTargetGrade;
    effectiveLimit = typeof targetGrade === "number" ? targetGrade : undefined;
    effectiveMinGpaBoost = typeof limit === "number" ? limit : 0.1;
  } else if (failedCourseIdsOrTargetGrade) {
    failedCourseIds = failedCourseIdsOrTargetGrade;
  }

  const completedDegreeCourses = courses.filter(
    (c) => completedCourseIds.has(c.id) && isDegreeCreditBearing(c),
  );
  const failedDegreeCourses = courses.filter(
    (c) =>
      failedCourseIds.has(c.id) &&
      !completedCourseIds.has(c.id) &&
      isDegreeCreditBearing(c),
  );

  const totalAttemptedCredits = [
    ...completedDegreeCourses,
    ...failedDegreeCourses,
  ].reduce((sum, c) => sum + c.credits, 0);
  if (totalAttemptedCredits <= 0) return [];

  const recs: RetakeRecommendation[] = [];

  // 1. Process failed courses first (highest impact for retake in PTUK cumulative GPA)
  for (const course of failedDegreeCourses) {
    const rawGrade = courseGrades[course.id];
    const currentGrade =
      typeof rawGrade === "number" && rawGrade >= 0 ? rawGrade : 40;
    if (currentGrade < effectiveTargetGrade) {
      const pointsGain = (effectiveTargetGrade - currentGrade) * course.credits;
      const potentialGpaBoost = pointsGain / totalAttemptedCredits;
      const roundedBoost = Math.round(potentialGpaBoost * 100) / 100;

      if (potentialGpaBoost > effectiveMinGpaBoost) {
        recs.push({
          course,
          currentGrade,
          targetGrade: effectiveTargetGrade,
          potentialGpaBoost: roundedBoost,
          pointsGain,
        });
      }
    }
  }

  // 2. Process completed degree courses eligible for retake
  for (const course of completedDegreeCourses) {
    const currentGrade = courseGrades[course.id];
    if (
      typeof currentGrade === "number" &&
      currentGrade < effectiveTargetGrade &&
      currentGrade > 0
    ) {
      const pointsGain = (effectiveTargetGrade - currentGrade) * course.credits;
      const potentialGpaBoost = pointsGain / totalAttemptedCredits;
      const roundedBoost = Math.round(potentialGpaBoost * 100) / 100;

      if (potentialGpaBoost > effectiveMinGpaBoost) {
        recs.push({
          course,
          currentGrade,
          targetGrade: effectiveTargetGrade,
          potentialGpaBoost: roundedBoost,
          pointsGain,
        });
      }
    }
  }

  const sorted = recs.sort((a, b) => b.potentialGpaBoost - a.potentialGpaBoost);
  return typeof effectiveLimit === "number" && effectiveLimit > 0
    ? sorted.slice(0, effectiveLimit)
    : sorted;
}

export interface AcademicStandingInfo {
  standingText: string;
  isHonor: boolean;
  isWarning: boolean;
  isWarningZone: boolean;
  canRegisterGradProject: boolean;
  creditsToGradProject: number;
  canRegisterFieldTraining: boolean;
  creditsToFieldTraining: number;
  scholarshipTier: "full" | "partial" | "candidate" | "none";
  scholarshipLabel: string;
  colorClass: string;
}

/**
 * Evaluates academic standing, honors, and senior standing thresholds.
 */
export function getAcademicStandingInfo(
  currentGPA: number,
  earnedCredits: number,
  totalCredits: number = TOTAL_CREDITS,
): AcademicStandingInfo {
  const isWarning = currentGPA > 0 && currentGPA < 60;
  const isWarningZone = currentGPA >= 60 && currentGPA < 65;
  const isHonor = currentGPA >= 85;

  // Dynamic capstone and field training thresholds based on degree requirements (diploma, bachelor 132h, engineering 164h)
  const capstoneThreshold =
    totalCredits <= 80 ? 45 : totalCredits <= 136 ? 90 : 120;
  const fieldTrainingThreshold =
    totalCredits <= 80 ? 30 : totalCredits <= 136 ? 65 : 90;

  const canRegisterGradProject = earnedCredits >= capstoneThreshold;
  const creditsToGradProject = Math.max(0, capstoneThreshold - earnedCredits);
  const canRegisterFieldTraining = earnedCredits >= fieldTrainingThreshold;
  const creditsToFieldTraining = Math.max(
    0,
    fieldTrainingThreshold - earnedCredits,
  );

  let scholarshipTier: "full" | "partial" | "candidate" | "none" = "none";
  let scholarshipLabel = "غير مؤهل لمنحة تفوق فصلية";

  // PTUK Excellence Scholarships are semester-based competitive awards requiring >= 15 registered credits
  if (currentGPA >= 90) {
    scholarshipTier = "full";
    scholarshipLabel =
      "مرشح منحة تفوق كاملة (إعفاء 100% فصلي - تنافسي بحد أدنى 15 ساعة)";
  } else if (currentGPA >= 85) {
    scholarshipTier = "partial";
    scholarshipLabel =
      "مرشح منحة تفوق جزئية (إعفاء 50% فصلي - تنافسي بحد أدنى 15 ساعة)";
  } else if (currentGPA >= 80) {
    scholarshipTier = "candidate";
    scholarshipLabel = `مرشح للمنافسة على المنح الفصلية (متبقي ${(85 - currentGPA).toFixed(2)}% لعتبة الـ 85%)`;
  }

  let standingText = "منتظم";
  let colorClass = "text-emerald-500";

  if (currentGPA <= 0) {
    standingText = "قيد الاحتساب";
    colorClass = "text-slate-400";
  } else if (currentGPA >= 90) {
    standingText = "ممتاز مرتفع (لوحة الشرف)";
    colorClass = "text-amber-500";
  } else if (currentGPA >= 85) {
    standingText = "ممتاز (لوحة الشرف)";
    colorClass = "text-amber-500";
  } else if (currentGPA >= 76) {
    standingText = "جيد جداً";
    colorClass = "text-emerald-500";
  } else if (currentGPA >= 68) {
    standingText = "جيد";
    colorClass = "text-blue-500";
  } else if (currentGPA >= 60) {
    standingText = isWarningZone ? "مقبول (منطقة حذر)" : "مقبول";
    colorClass = isWarningZone ? "text-amber-500" : "text-slate-500";
  } else {
    standingText = "تحت الملاحظة (إنذار أكاديمي)";
    colorClass = "text-rose-500";
  }

  return {
    standingText,
    isHonor,
    isWarning,
    isWarningZone,
    canRegisterGradProject,
    creditsToGradProject,
    canRegisterFieldTraining,
    creditsToFieldTraining,
    scholarshipTier,
    scholarshipLabel,
    colorClass,
  };
}

/**
 * Detects circular dependencies in course prerequisites (Item 142).
 * Returns array of detected cycles (e.g. [["101", "102", "101"]]) or empty array if DAG is acyclic.
 */
export function detectPrerequisiteCycles(
  courses: readonly Course[],
): string[][] {
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(courseId: string) {
    visited.add(courseId);
    recursionStack.add(courseId);
    path.push(courseId);

    const course = courseMap.get(courseId);
    if (course) {
      const prereqs = course.prerequisites || [];
      for (const p of prereqs) {
        const pIds = p
          .split(/[/|]|\s+OR\s+/i)
          .map((s) => s.trim())
          .filter(Boolean);
        for (const pId of pIds) {
          if (!courseMap.has(pId)) continue;
          if (!visited.has(pId)) {
            dfs(pId);
          } else if (recursionStack.has(pId)) {
            const cycleStartIndex = path.indexOf(pId);
            if (cycleStartIndex !== -1) {
              cycles.push([...path.slice(cycleStartIndex), pId]);
            }
          }
        }
      }
    }

    recursionStack.delete(courseId);
    path.pop();
  }

  for (const course of courses) {
    if (!visited.has(course.id)) {
      dfs(course.id);
    }
  }

  return cycles;
}

/**
 * Resolves full transitive prerequisite chain safely without infinite loops (Item 142).
 */
export function getTransitivePrerequisites(
  courseId: string,
  courses: readonly Course[],
  maxDepth = 20,
): Set<string> {
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const result = new Set<string>();
  const visited = new Set<string>();

  function traverse(currentId: string, depth: number) {
    if (depth > maxDepth || visited.has(currentId)) return;
    visited.add(currentId);

    const course = courseMap.get(currentId);
    if (!course) return;

    for (const p of course.prerequisites || []) {
      const pIds = p
        .split(/[/|]|\s+OR\s+/i)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const pId of pIds) {
        result.add(pId);
        traverse(pId, depth + 1);
      }
    }
  }

  traverse(courseId, 0);
  return result;
}

export interface CriticalPathAnalysis {
  maxChainLength: number;
  criticalCourseIds: Set<string>;
  longestChain: string[];
  courseIds?: Set<string>;
}

/**
 * Computes the Critical Path (Item 57) in the curriculum DAG.
 * Finds the longest sequential chain of prerequisites needed to reach graduation.
 */
export function computeCriticalPath(
  courses: readonly Course[],
): CriticalPathAnalysis {
  // Build reverse graph: who depends on this course
  const dependentsMap = new Map<string, string[]>();
  for (const c of courses) {
    dependentsMap.set(c.id, []);
  }

  for (const c of courses) {
    for (const p of c.prerequisites || []) {
      const pIds = p
        .split(/[/|]|\s+OR\s+/i)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const pId of pIds) {
        if (dependentsMap.has(pId)) {
          dependentsMap.get(pId)!.push(c.id);
        }
      }
    }
  }

  // Memoized longest path downstream from each course
  const memo = new Map<string, string[]>();

  function getLongestDownstream(
    courseId: string,
    visited = new Set<string>(),
  ): string[] {
    if (visited.has(courseId)) return [courseId]; // prevent cycle
    if (memo.has(courseId)) return memo.get(courseId)!;

    visited.add(courseId);
    const dependents = dependentsMap.get(courseId) || [];
    let bestSubPath: string[] = [];

    for (const depId of dependents) {
      const sub = getLongestDownstream(depId, new Set(visited));
      if (sub.length > bestSubPath.length) {
        bestSubPath = sub;
      }
    }

    const fullPath = [courseId, ...bestSubPath];
    memo.set(courseId, fullPath);
    return fullPath;
  }

  let longestChain: string[] = [];
  for (const c of courses) {
    const chain = getLongestDownstream(c.id);
    if (chain.length > longestChain.length) {
      longestChain = chain;
    }
  }

  const criticalCourseIds = new Set<string>();
  const threshold = Math.max(1, longestChain.length - 1);

  for (const [, path] of memo.entries()) {
    if (path.length >= threshold) {
      path.forEach((id) => criticalCourseIds.add(id));
    }
  }

  return {
    maxChainLength: longestChain.length,
    criticalCourseIds,
    courseIds: criticalCourseIds,
    longestChain,
  };
}

export interface YearProgressSummary {
  year: number;
  totalCredits: number;
  completedCredits: number;
  percentage: number;
}

/**
 * Infers the academic year (1-5) from the course recommended semester or course code based on PTUK conventions.
 */
export function inferCourseYear(course: Course): number {
  const sem = course.semester || (course as any).recommendedSemester || "";
  if (sem.includes("الخامسة") || sem.includes("الخامسه")) return 5;
  if (sem.includes("الرابعة") || sem.includes("الرابعه")) return 4;
  if (sem.includes("الثالثة") || sem.includes("الثالثه")) return 3;
  if (sem.includes("الثانية") || sem.includes("الثانيه")) return 2;
  if (sem.includes("الأولى") || sem.includes("الاولى")) return 1;

  const id = String(course.id || "").trim();
  if (/^\d{8}$/.test(id)) {
    const levelDigit = parseInt(id.charAt(5), 10);
    if (levelDigit >= 1 && levelDigit <= 5) {
      return levelDigit;
    }
  }
  if (
    course.category?.includes("جامعة") ||
    course.category?.includes("استدراكي")
  )
    return 1;
  return 1;
}

/**
 * Calculates yearly completion progress rings (Item 63).
 * Dynamically scales year count to degree requirement (2 years for diploma <= 80h, 4 for bachelor <= 140h, 5 for engineering).
 */
export function calculateYearlyProgress(
  courses: readonly Course[],
  completedCourseIds: ReadonlySet<string>,
  totalCredits: number = TOTAL_CREDITS,
): YearProgressSummary[] {
  const maxYear = totalCredits <= 80 ? 2 : totalCredits <= 140 ? 4 : 5;
  const years: Record<number, { total: number; completed: number }> = {};
  for (let y = 1; y <= maxYear; y++) {
    years[y] = { total: 0, completed: 0 };
  }

  for (const course of courses) {
    if (isRemedialCourse(course)) continue;
    const yr = Math.min(maxYear, Math.max(1, inferCourseYear(course)));
    if (!years[yr]) years[yr] = { total: 0, completed: 0 };
    years[yr].total += course.credits;
    if (completedCourseIds.has(course.id)) {
      years[yr].completed += course.credits;
    }
  }

  const resultYears: number[] = [];
  for (let y = 1; y <= maxYear; y++) {
    resultYears.push(y);
  }

  return resultYears.map((year) => {
    const data = years[year] || { total: 0, completed: 0 };
    const percentage =
      data.total > 0
        ? Math.min(100, Math.round((data.completed / data.total) * 100))
        : 0;
    return {
      year,
      totalCredits: data.total,
      completedCredits: data.completed,
      percentage,
    };
  });
}
