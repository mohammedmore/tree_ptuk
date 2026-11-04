import type { Course } from "../data";
import {
  REGULAR_SEMESTERS,
  SEMESTERS,
  getRecommendedSemesterOfCourse,
} from "../constants";

export interface BottleneckInfo {
  courseId: string;
  track:
    | "برمجيات وخوارزميات"
    | "عتاد وأنظمة"
    | "رياضيات وعلوم"
    | "شبكات واتصالات"
    | "متطلب تخصص رئيسي";
  chainDepth: number;
  dependentCount: number;
  dependentCourseNames: string[];
  isBottleneck: boolean;
  badgeLabel: string;
  colorClass: string;
  trackName?: string;
  trackColor?: string;
  depth?: number;
}

export type ReadinessStatus =
  "ready" | "in_progress_prereq" | "locked" | "in_progress";

/**
 * Computes multiple critical prerequisite tracks and bottleneck courses across the entire curriculum.
 * Detects deep dependency chains and courses that block multiple subsequent levels.
 */
export function computeMultipleCriticalTracks(
  courses: Course[],
): Map<string, BottleneckInfo> {
  const map = new Map<string, BottleneckInfo>();
  if (!courses || courses.length === 0) return map;

  const courseMap = new Map(courses.map((c) => [c.id, c]));

  // Build forward adjacency: courseId -> dependent courses
  const dependentsMap = new Map<string, string[]>();
  courses.forEach((c) => dependentsMap.set(c.id, []));

  courses.forEach((c) => {
    (c.prerequisites || []).forEach((pId) => {
      if (dependentsMap.has(pId)) {
        dependentsMap.get(pId)!.push(c.id);
      }
    });
  });

  // Calculate downstream transitive closure and max chain depth for each course
  const depthMemo = new Map<string, number>();
  const allDownstreamMemo = new Map<string, Set<string>>();

  function getDownstream(
    id: string,
    visited = new Set<string>(),
  ): { depth: number; dependents: Set<string> } {
    if (depthMemo.has(id) && allDownstreamMemo.has(id)) {
      return {
        depth: depthMemo.get(id)!,
        dependents: allDownstreamMemo.get(id)!,
      };
    }
    if (visited.has(id)) {
      return { depth: 0, dependents: new Set() };
    }

    visited.add(id);
    const direct = dependentsMap.get(id) || [];
    let maxChildDepth = 0;
    const allDeps = new Set<string>();

    for (const childId of direct) {
      allDeps.add(childId);
      const childRes = getDownstream(childId, new Set(visited));
      if (childRes.depth > maxChildDepth) {
        maxChildDepth = childRes.depth;
      }
      childRes.dependents.forEach((d) => allDeps.add(d));
    }

    const currentDepth = direct.length > 0 ? 1 + maxChildDepth : 0;
    depthMemo.set(id, currentDepth);
    allDownstreamMemo.set(id, allDeps);
    return { depth: currentDepth, dependents: allDeps };
  }

  courses.forEach((c) => {
    const { depth, dependents } = getDownstream(c.id);

    // Determine domain track from course category, code prefix, and keywords
    let track: BottleneckInfo["track"] = "متطلب تخصص رئيسي";
    let colorClass =
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    const nameLower = (c.name || "").toLowerCase();
    const id = c.id || "";

    if (
      nameLower.includes("برمج") ||
      nameLower.includes("خوارزم") ||
      nameLower.includes("بيانات") ||
      nameLower.includes("كود") ||
      id.startsWith("12140")
    ) {
      track = "برمجيات وخوارزميات";
      colorClass =
        "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    } else if (
      nameLower.includes("دوائر") ||
      nameLower.includes("إلكترون") ||
      nameLower.includes("عتاد") ||
      nameLower.includes("منطق") ||
      nameLower.includes("معالج") ||
      id.startsWith("12110") ||
      id.startsWith("12120")
    ) {
      track = "عتاد وأنظمة";
      colorClass =
        "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    } else if (
      nameLower.includes("تفاضل") ||
      nameLower.includes("فيزياء") ||
      nameLower.includes("كيمياء") ||
      nameLower.includes("جبر") ||
      nameLower.includes("إحصاء") ||
      id.startsWith("15010") ||
      id.startsWith("15020")
    ) {
      track = "رياضيات وعلوم";
      colorClass =
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    } else if (
      nameLower.includes("شبك") ||
      nameLower.includes("اتصال") ||
      nameLower.includes("أمن")
    ) {
      track = "شبكات واتصالات";
      colorClass =
        "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20";
    }

    const isBottleneck = depth >= 2 || dependents.size >= 2;
    const depNames = Array.from(dependents)
      .slice(0, 4)
      .map((dId) => courseMap.get(dId)?.name || dId);

    const badgeLabel =
      depth >= 3
        ? `${track} (عمق ${depth} مستويات)`
        : dependents.size >= 3
          ? `${track} (يعطل ${dependents.size} مواد)`
          : `${track}`;

    map.set(c.id, {
      courseId: c.id,
      track,
      chainDepth: depth,
      dependentCount: dependents.size,
      dependentCourseNames: depNames,
      isBottleneck,
      badgeLabel,
      colorClass,
      trackName: track,
      trackColor: colorClass,
      depth,
    });
  });

  return map;
}

/**
 * Live GPA simulation calculating projected semester GPA and cumulative graduation GPA.
 */
export function simulateProjectedGpa(
  completedRecords: Array<{ grade: number | null; credits: number }>,
  plannedRecordsWithGrades: Array<{ grade: number | null; credits: number }>,
): {
  termGpa: number | null;
  cumulativeGpa: number | null;
  totalPlannedCredits: number;
  projectedSemesterGpa: number | null;
  projectedGraduationGpa: number | null;
} {
  const validPlanned = plannedRecordsWithGrades.filter(
    (r) =>
      typeof r.grade === "number" &&
      !isNaN(r.grade) &&
      r.grade > 0 &&
      r.credits > 0,
  );

  const termTotalPoints = validPlanned.reduce(
    (sum, r) => sum + (r.grade as number) * r.credits,
    0,
  );
  const termTotalCredits = validPlanned.reduce((sum, r) => sum + r.credits, 0);
  const termGpa =
    termTotalCredits > 0 ? termTotalPoints / termTotalCredits : null;

  const validCompleted = completedRecords.filter(
    (r) =>
      typeof r.grade === "number" &&
      !isNaN(r.grade) &&
      r.grade > 0 &&
      r.credits > 0,
  );

  const totalPoints =
    validCompleted.reduce(
      (sum, r) => sum + (r.grade as number) * r.credits,
      0,
    ) + termTotalPoints;
  const totalCredits =
    validCompleted.reduce((sum, r) => sum + r.credits, 0) + termTotalCredits;

  const cumulativeGpa = totalCredits > 0 ? totalPoints / totalCredits : null;

  const roundedTermGpa =
    termGpa !== null ? Math.round(termGpa * 100) / 100 : null;
  const roundedCumGpa =
    cumulativeGpa !== null ? Math.round(cumulativeGpa * 100) / 100 : null;

  return {
    termGpa: roundedTermGpa,
    cumulativeGpa: roundedCumGpa,
    totalPlannedCredits: plannedRecordsWithGrades.reduce(
      (sum, r) => sum + (r.credits || 0),
      0,
    ),
    projectedSemesterGpa: roundedTermGpa,
    projectedGraduationGpa: roundedCumGpa,
  };
}

/**
 * Classify a course's academic readiness for planning in the active semester.
 * - "ready": All prerequisites are completed and passed in official records or prior terms.
 * - "in_progress_prereq": Prerequisites are not completed yet, but are currently planned in prior semesters.
 * - "locked": One or more mandatory prerequisites are completely missing and unfulfilled.
 */
export function classifyCourseReadiness(
  course: Course,
  completedCourseIds: Set<string>,
  allPriorPlannedIds: Set<string>,
): ReadinessStatus {
  const prereqs = course.prerequisites || [];
  if (prereqs.length === 0) return "ready";

  let allCompleted = true;
  let allCompletedOrPrior = true;

  for (const p of prereqs) {
    if (!completedCourseIds.has(p)) {
      allCompleted = false;
      if (!allPriorPlannedIds.has(p)) {
        allCompletedOrPrior = false;
      }
    }
  }

  if (allCompleted) return "ready";
  if (allCompletedOrPrior) return "in_progress_prereq";
  return "locked";
}

/**
 * Smart Balanced Auto-Planning from current standing term all the way to Graduation.
 * - Respects locked semesters (preserves them as configured).
 * - Distributes uncompleted courses into balanced 15-18 credit term chunks.
 * - Respects seasonal course availability (Fall vs Spring).
 * - Prioritizes critical bottleneck courses first.
 */
export function autoPlanToGraduation(
  courses: Course[],
  upcomingSemester: string,
  completedCourseIds: Set<string>,
  existingPlanned: Record<string, string>,
  lockedSemesters: Set<string> = new Set(),
  maxCreditsPerTerm = 19,
  includeSummer = false,
  categoryRequirements?: Record<string, number>,
  registeredCourseIds?: Set<string> | string[],
): Record<string, string> {
  const result: Record<string, string> = { ...existingPlanned };
  if (!courses || courses.length === 0) return result;

  const registeredSet = new Set<string>(
    registeredCourseIds
      ? Array.isArray(registeredCourseIds)
        ? registeredCourseIds
        : Array.from(registeredCourseIds)
      : [],
  );

  // Clean any courses already completed or currently registered from planned map
  for (const cId of Object.keys(result)) {
    if (completedCourseIds.has(cId) || registeredSet.has(cId)) {
      delete result[cId];
    }
  }

  const bottleneckMap = computeMultipleCriticalTracks(courses);

  // Standard category hour ceilings (prevents over-scheduling electives)
  const effectiveCategoryRequirements: Record<string, number> = {
    "متطلب جامعة اختياري": 6,
    "متطلب كلية اختياري": 3,
    "متطلب تخصص اختياري": 15,
    ...(categoryRequirements || {}),
  };

  const targetSemesters = includeSummer ? SEMESTERS : REGULAR_SEMESTERS;
  let startIndex = targetSemesters.indexOf(upcomingSemester as any);
  if (startIndex === -1) {
    // If upcomingSemester is not directly in the list (e.g. summer semester while includeSummer is false), find next available
    const resolvedIndex = targetSemesters.findIndex((s) => {
      return SEMESTERS.indexOf(s) >= SEMESTERS.indexOf(upcomingSemester);
    });
    startIndex = resolvedIndex !== -1 ? resolvedIndex : 0;
  }

  // Purge unlocked upcoming semesters from previous planning to re-balance cleanly
  for (const [cId, sem] of Object.entries(result)) {
    const sIdx = targetSemesters.indexOf(sem as any);
    if (sIdx >= startIndex && !lockedSemesters.has(sem)) {
      delete result[cId];
    }
  }

  // Track credits already completed, currently registered, or assigned per category to respect elective limits
  const categoryCreditsScheduled: Record<string, number> = {};
  courses.forEach((c) => {
    if (
      (completedCourseIds.has(c.id) || registeredSet.has(c.id)) &&
      c.category
    ) {
      categoryCreditsScheduled[c.category] =
        (categoryCreditsScheduled[c.category] || 0) + (c.credits || 3);
    }
  });
  Object.entries(result).forEach(([cId]) => {
    const c = courses.find((item) => item.id === cId);
    if (c?.category) {
      categoryCreditsScheduled[c.category] =
        (categoryCreditsScheduled[c.category] || 0) + (c.credits || 3);
    }
  });

  // Set of courses already passed, registered in progress, or locked
  const passedOrAssigned = new Set<string>(completedCourseIds);
  registeredSet.forEach((cId) => passedOrAssigned.add(cId));
  Object.entries(result).forEach(([cId]) => passedOrAssigned.add(cId));

  // Remaining degree courses to schedule
  const remaining = courses.filter((c) => !passedOrAssigned.has(c.id));

  // Helper to determine if a course is in an elective category
  const isElectiveCategory = (cat?: string) =>
    Boolean(cat && cat.includes("اختياري"));

  // Sort remaining courses: Compulsory before electives, then by bottleneck priority & recommended semester
  remaining.sort((a, b) => {
    const isElecA = isElectiveCategory(a.category);
    const isElecB = isElectiveCategory(b.category);
    if (isElecA !== isElecB) {
      return isElecA ? 1 : -1; // Compulsory first
    }

    const bInfoA = bottleneckMap.get(a.id);
    const bInfoB = bottleneckMap.get(b.id);
    const scoreA =
      (bInfoA?.chainDepth || 0) * 10 + (bInfoA?.dependentCount || 0);
    const scoreB =
      (bInfoB?.chainDepth || 0) * 10 + (bInfoB?.dependentCount || 0);
    if (scoreB !== scoreA) return scoreB - scoreA;

    const recA = targetSemesters.indexOf(
      getRecommendedSemesterOfCourse(a) as any,
    );
    const recB = targetSemesters.indexOf(
      getRecommendedSemesterOfCourse(b) as any,
    );
    return recA - recB;
  });

  // Assign to upcoming semesters
  for (let sIdx = startIndex; sIdx < targetSemesters.length; sIdx++) {
    const semName = targetSemesters[sIdx];
    if (lockedSemesters.has(semName)) continue;

    const isFirstTerm = semName.includes("الفصل الأول");
    const isSecondTerm = semName.includes("الفصل الثاني");
    const isSummerTerm = semName.includes("الصيفي");

    // In summer terms, credit limit is 10 (or 12 for high GPA, 6 under academic warning)
    const termMaxCredits = isSummerTerm
      ? maxCreditsPerTerm <= 14
        ? 6
        : maxCreditsPerTerm > 19
          ? 12
          : 10
      : maxCreditsPerTerm;
    const termMinCredits = isSummerTerm ? 3 : 15;

    let termCredits = Object.entries(result)
      .filter(([, s]) => s === semName)
      .reduce((sum, [id]) => {
        const c = courses.find((item) => item.id === id);
        return sum + (c?.credits || 0);
      }, 0);

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      if (passedOrAssigned.has(candidate.id)) continue;

      // Elective category ceiling check:
      // If course is an elective and the category's required hour ceiling is already met, skip!
      if (isElectiveCategory(candidate.category) && candidate.category) {
        const catCap = effectiveCategoryRequirements[candidate.category];
        if (typeof catCap === "number" && catCap > 0) {
          const currentCatCredits =
            categoryCreditsScheduled[candidate.category] || 0;
          if (currentCatCredits >= catCap) {
            // Group ceiling already reached, do not add more electives from this category
            continue;
          }
        }
      }

      // Seasonal check
      if (
        candidate.availableSemesters &&
        candidate.availableSemesters.length > 0
      ) {
        if (isFirstTerm && !candidate.availableSemesters.includes("first"))
          continue;
        if (isSecondTerm && !candidate.availableSemesters.includes("second"))
          continue;
        if (isSummerTerm) {
          const isSummerRestricted =
            !candidate.availableSemesters.includes("summer") &&
            (candidate.availableSemesters.includes("first") ||
              candidate.availableSemesters.includes("second"));
          if (isSummerRestricted) continue;
        }
      }

      // In summer, avoid scheduling graduation capstone projects
      if (
        isSummerTerm &&
        (candidate.isGraduationProject ||
          candidate.name?.includes("مشروع تخرج") ||
          candidate.name?.includes("مشروع التخرج"))
      ) {
        continue;
      }

      // Prerequisite check: All prereqs must be in completedCourseIds OR registeredSet OR assigned to an earlier semester
      const prereqs = candidate.prerequisites || [];
      const prereqsSatisfied = prereqs.every((pId) => {
        if (completedCourseIds.has(pId) || registeredSet.has(pId)) return true;
        const assignedSem = result[pId];
        if (!assignedSem) return false;
        const assignedIdx = targetSemesters.indexOf(assignedSem as any);
        return assignedIdx >= 0 && assignedIdx < sIdx;
      });

      if (!prereqsSatisfied) continue;

      // Credit limit check
      const courseCredits = candidate.credits || 3;
      if (
        termCredits + courseCredits > termMaxCredits &&
        termCredits >= termMinCredits
      ) {
        // Semester is sufficiently filled
        continue;
      }

      // Assign candidate
      result[candidate.id] = semName;
      passedOrAssigned.add(candidate.id);
      termCredits += courseCredits;

      if (candidate.category) {
        categoryCreditsScheduled[candidate.category] =
          (categoryCreditsScheduled[candidate.category] || 0) + courseCredits;
      }

      if (termCredits >= termMaxCredits) break;
    }
  }

  return result;
}

function parseTimeToMinutes(tStr: string): number | null {
  if (!tStr) return null;
  const match = tStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function sectionsOverlap(s1: any, s2: any): boolean {
  if (!s1 || !s2) return false;
  if (
    s1.isOnline ||
    s2.isOnline ||
    s1.activity?.includes("إلكتروني") ||
    s2.activity?.includes("إلكتروني")
  ) {
    return false;
  }

  const extractDays = (s: any): string[] => {
    if (Array.isArray(s.days)) return s.days;
    if (typeof s.days === "string")
      return s.days.split(/[\s,،]+/).filter(Boolean);
    if (typeof s.day === "string") return [s.day];
    return [];
  };

  const days1 = extractDays(s1);
  const days2 = extractDays(s2);
  if (days1.length > 0 && days2.length > 0) {
    const hasSharedDay = days1.some((d) => days2.includes(d));
    if (!hasSharedDay) return false;
  }

  const parseRange = (s: any): { start: number; end: number } | null => {
    if (typeof s.start === "number" && typeof s.end === "number") {
      return { start: s.start, end: s.end };
    }
    if (s.startTime && s.endTime) {
      const start = parseTimeToMinutes(s.startTime);
      const end = parseTimeToMinutes(s.endTime);
      if (start !== null && end !== null) return { start, end };
    }
    if (typeof s.times === "string") {
      const parts = s.times.split(/[-–—]/);
      if (parts.length === 2) {
        const start = parseTimeToMinutes(parts[0]);
        const end = parseTimeToMinutes(parts[1]);
        if (start !== null && end !== null) return { start, end };
      }
    }
    return null;
  };

  const r1 = parseRange(s1);
  const r2 = parseRange(s2);
  if (r1 && r2) {
    return r1.start < r2.end && r2.start < r1.end;
  }

  return false;
}

/**
 * Pre-registration schedule feasibility check.
 * Verifies that planned courses in the active semester have open/offered sections without unavoidable time clashes.
 * When in curriculum degree planning mode (no catalog sections attached), returns feasible without false alarms.
 */
export function checkSemesterScheduleFeasibility(
  plannedCourseIds: string[],
  coursesById: Map<string, Course>,
): {
  hasClash: boolean;
  warnings: string[];
  feasibleCount: number;
  hasConflict: boolean;
  conflicts: string[];
} {
  const warnings: string[] = [];
  const conflicts: string[] = [];
  let feasibleCount = 0;

  const plannedCourses: Course[] = [];
  for (const cId of plannedCourseIds) {
    const c = coursesById.get(cId);
    if (c) plannedCourses.push(c);
  }

  // Detect whether schedule catalog sections are actually loaded in this context.
  // In pure degree planning mode, curriculum courses do not have sections populated.
  const coursesWithSections = plannedCourses.filter(
    (c) => Array.isArray(c.sections) && c.sections.length > 0,
  );
  const isCatalogActive = coursesWithSections.length > 0;

  if (!isCatalogActive) {
    // If no course has timetable sections, we are in curriculum planning mode.
    // There are NO section conflicts or unoffered warnings to falsely report.
    return {
      hasClash: false,
      warnings: [],
      feasibleCount: plannedCourses.length,
      hasConflict: false,
      conflicts: [],
    };
  }

  // If schedule catalog is active, identify which courses are missing sections
  for (const c of plannedCourses) {
    if (!c.sections || c.sections.length === 0) {
      warnings.push(
        `المساق "${c.name}" لا توجد له شعب مطروحة حالياً في قاعدة بيانات التسجيل.`,
      );
    } else {
      feasibleCount++;
    }
  }

  // Check for unavoidable clashes between courses that have sections
  if (coursesWithSections.length >= 2) {
    for (let i = 0; i < coursesWithSections.length; i++) {
      for (let j = i + 1; j < coursesWithSections.length; j++) {
        const c1 = coursesWithSections[i];
        const c2 = coursesWithSections[j];
        const s1List = c1.sections || [];
        const s2List = c2.sections || [];

        const canPairWithoutClash = s1List.some((s1) =>
          s2List.some((s2) => !sectionsOverlap(s1, s2)),
        );

        if (!canPairWithoutClash && s1List.length > 0 && s2List.length > 0) {
          conflicts.push(
            `تعارض زمني حتمي بين جميع شُعب "${c1.name}" وشُعب "${c2.name}".`,
          );
        }
      }
    }
  }

  const hasConflict = conflicts.length > 0;
  const hasClash = warnings.length > 0 || hasConflict;

  return {
    hasClash,
    warnings,
    feasibleCount,
    hasConflict,
    conflicts,
  };
}
