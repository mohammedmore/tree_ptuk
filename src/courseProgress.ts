import type { Course } from "./data";
import { TOTAL_CREDITS } from "./constants";

export const REMEDIAL_COURSE_ID = "15200099";
export const REMEDIAL_CATEGORY = "متطلب استدراكي إجباري";

export function isRemedialCourse(courseOrId: Course | string): boolean {
  if (typeof courseOrId === "string") {
    return courseOrId === REMEDIAL_COURSE_ID;
  }
  return (
    courseOrId.id === REMEDIAL_COURSE_ID ||
    courseOrId.category === REMEDIAL_CATEGORY
  );
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
      result[course.category] =
        (result[course.category] || 0) + course.credits;
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
 * Evaluates whether a course is available to be taken / planned.
 * - Completed courses are not available.
 * - Prerequisites must be completed in `completed` (or `allPrev`).
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

  // Check Prerequisites
  const prereqsMet = course.prerequisites.every((p: string) => completed.has(p));
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
      return cpCourse.prerequisites.every((p: string) => completed.has(p));
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
      whatIfGrades[course.id] > 0 &&
      !(grades[course.id] > 75)
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
      if (
        !completedCourses.has(id) &&
        !failedCourseIds.has(id) &&
        grade > 0
      ) {
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
