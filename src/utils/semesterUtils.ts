import { Course } from "../data";
import {
  SEMESTERS,
  REGULAR_SEMESTERS,
  getRecommendedSemesterOfCourse,
} from "../constants";

/**
 * Standardize Arabic and Persian numeral characters to standard western digits.
 */
export function normalizeDigits(str: string): string {
  if (!str) return "";
  return str
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .trim();
}

/**
 * Calculate a strict chronological weight for a semester string.
 * Example:
 *  "الفصل الأول 2023/2024"  -> 20231
 *  "الفصل الثاني 2023/2024" -> 20232
 *  "الدورة الصيفية 2023/2024" -> 20233
 *  "الفصل الأول 2024/2025"  -> 20241
 */
export function parseSemesterWeight(title: string): number {
  if (!title) return 0;
  const clean = normalizeDigits(title);

  // Extract academic year: e.g. 2023/2024 -> 2023, or 2024 -> 2024
  const yearMatch = clean.match(/\b(20\d{2})\b/);
  const startYear = yearMatch ? parseInt(yearMatch[1], 10) : 2020;

  let termWeight = 1;
  if (
    clean.includes("صيفي") ||
    clean.includes("الصيفي") ||
    clean.includes("الدورة الصيفية") ||
    clean.toLowerCase().includes("summer")
  ) {
    termWeight = 3;
  } else if (
    clean.includes("الثاني") ||
    clean.includes("ثاني") ||
    clean.includes("2nd") ||
    clean.toLowerCase().includes("second")
  ) {
    termWeight = 2;
  } else if (
    clean.includes("الأول") ||
    clean.includes("اول") ||
    clean.includes("أول") ||
    clean.includes("1st") ||
    clean.toLowerCase().includes("first")
  ) {
    termWeight = 1;
  }

  return startYear * 10 + termWeight;
}

/**
 * Extract 4-digit calendar year from student ID, cohort year, or semester title.
 * Handles:
 *  - Standard 9-digit university IDs: "202310123" -> 2023
 *  - PTUK 8-digit IDs: "12214050" -> 2022, "12301234" -> 2023, "12400001" -> 2024
 *  - Short cohort representations: "2023" -> 2023, "123" -> 2023, "122" -> 2022
 *  - Generic year string in text: "الفصل الأول 2023/2024" -> 2023
 */
export function parseYearPattern(str: string): number | null {
  if (!str) return null;
  const s = normalizeDigits(String(str)).trim();
  // 1. Starts with 20xx (e.g. "202310123" or "2023")
  const startYearMatch = s.match(/^(20\d{2})/);
  if (startYearMatch) return parseInt(startYearMatch[1], 10);
  // 2. Starts with PTUK 12x (e.g. "12214050" -> 2022, "12301234" -> 2023, "123" -> 2023)
  const ptukMatch = s.match(/^1(2\d)/);
  if (ptukMatch) return 2000 + parseInt(ptukMatch[1], 10);
  // 3. Isolated 20xx in text (e.g. "الفصل الأول 2023/2024")
  const wordMatch = s.match(/\b(20\d{2})\b/);
  if (wordMatch) return parseInt(wordMatch[1], 10);
  return null;
}

/**
 * Extract student's 4-digit admission cohort year (e.g. 2022, 2023, 2024).
 * Handles:
 *  - Explicit cohortYear: "2023", 2023, "123", "1230", "122"
 *  - PTUK student IDs:
 *      - 8-digit IDs starting with 1 + 2-digit year (e.g. 12214050 -> 2022, 12301234 -> 2023)
 *      - 9-digit standard IDs: "202310123" -> 2023
 *  - Transcript history: start year of earliest semester title
 */
export function extractCohortYear(
  student?: {
    cohortYear?: string | number;
    studentId?: string;
    semesters?: { title: string; courses?: any[] }[];
  } | null,
): number | null {
  if (!student) return null;

  // 1. Check explicit cohortYear
  if (student.cohortYear) {
    const parsed = parseYearPattern(String(student.cohortYear));
    if (parsed) return parsed;
  }

  // 2. Check studentId
  if (student.studentId) {
    const parsed = parseYearPattern(String(student.studentId));
    if (parsed) return parsed;
  }

  // 3. Fallback: Oldest semester in transcript
  if (
    student.semesters &&
    Array.isArray(student.semesters) &&
    student.semesters.length > 0
  ) {
    const sorted = [...student.semesters].sort(
      (a, b) => parseSemesterWeight(a.title) - parseSemesterWeight(b.title),
    );
    const earliest = sorted[0]?.title;
    if (earliest) {
      const parsed = parseYearPattern(earliest);
      if (parsed) return parsed;
    }
  }

  return null;
}

/**
 * Map any semester title (from Edugate transcript, profile, or table) to the standard academic planner semester string.
 * Example:
 *  resolveAcademicSemester("الفصل الثاني 2024/2025", "2023") -> "السنة الثانية - الفصل الثاني"
 *  resolveAcademicSemester("الفصل الأول 2023/2024", "2023")  -> "السنة الأولى - الفصل الأول"
 *  resolveAcademicSemester("الدورة الصيفية 2023/2024", "2023") -> "السنة الأولى - الصيفي"
 */
export function resolveAcademicSemester(
  title: string,
  cohortYear?: string | number | null,
  fallbackIndex?: number,
): string {
  if (!title) {
    if (
      fallbackIndex !== undefined &&
      fallbackIndex >= 0 &&
      fallbackIndex < REGULAR_SEMESTERS.length
    ) {
      return REGULAR_SEMESTERS[fallbackIndex];
    }
    return REGULAR_SEMESTERS[0];
  }

  // If already an exact match in SEMESTERS, return as-is
  if (SEMESTERS.includes(title)) {
    return title;
  }

  const clean = normalizeDigits(title);

  // Determine term
  const isSummer =
    clean.includes("صيفي") ||
    clean.includes("الصيفي") ||
    clean.includes("الدورة الصيفية") ||
    clean.toLowerCase().includes("summer");
  const isSecond =
    !isSummer &&
    (clean.includes("الثاني") ||
      clean.includes("ثاني") ||
      clean.includes("2nd") ||
      clean.toLowerCase().includes("second"));
  const termName = isSummer
    ? "الصيفي"
    : isSecond
      ? "الفصل الثاني"
      : "الفصل الأول";

  // Determine academic year level (1 to 5)
  const yearMatch = clean.match(/\b(20\d{2})\b/);
  let yearNum = 1;

  // Extract proper 4-digit cohort year
  const numCohort = cohortYear ? parseYearPattern(String(cohortYear)) : null;

  if (yearMatch && numCohort && !isNaN(numCohort)) {
    const calendarStartYear = parseInt(yearMatch[1], 10);
    yearNum = Math.max(1, Math.min(5, calendarStartYear - numCohort + 1));
  } else if (fallbackIndex !== undefined && fallbackIndex >= 0) {
    // If fallbackIndex is provided: regular semester progression
    yearNum = Math.max(1, Math.min(5, Math.floor(fallbackIndex / 2) + 1));
  }

  const yearWords: Record<number, string> = {
    1: "السنة الأولى",
    2: "السنة الثانية",
    3: "السنة الثالثة",
    4: "السنة الرابعة",
    5: "السنة الخامسة",
  };

  const yearWord = yearWords[yearNum] || "السنة الأولى";
  const resolved = `${yearWord} - ${termName}`;

  return SEMESTERS.includes(resolved) ? resolved : REGULAR_SEMESTERS[0];
}

/**
 * Determine the student's current upcoming/planning semester based on portal standing,
 * transcript history, and completed course curriculum progression.
 * Ensures the student lands on the correct regular semester without prematurely forcing into optional summer terms.
 */
export function determineUpcomingSemester(
  student?: {
    currentSemester?: string;
    cohortYear?: string | number;
    studentId?: string;
    semesters?: { title: string; courses: any[] }[];
    registeredCourses?: any[];
  } | null,
  completedCourses?: Set<string>,
  courses?: Course[],
): string {
  const cohort = extractCohortYear(student);

  // 1. Check if student has registered / in-progress courses in their transcript or profile.
  // Rule: "دائما اذا مسجل مواد يعني الفصل الحالي يعني لازم يخطط للفصل الي بعده"
  // When a student has registered courses, that semester is the CURRENT active semester,
  // so the planner must target the semester immediately following it.
  if (
    student &&
    Array.isArray(student.semesters) &&
    student.semesters.length > 0
  ) {
    const sorted = [...student.semesters].sort(
      (a, b) => parseSemesterWeight(a.title) - parseSemesterWeight(b.title),
    );

    const latestSem = sorted[sorted.length - 1];
    const latestHasRegistered =
      Array.isArray(latestSem?.courses) &&
      latestSem.courses.length > 0 &&
      latestSem.courses.some(
        (c) =>
          c.isRegistered ||
          c.status === "مسجل" ||
          (c.grade === null && !c.isPassed && !c.isFailed),
      );

    const hasAnyRegistered =
      latestHasRegistered ||
      (Array.isArray(student.registeredCourses) &&
        student.registeredCourses.length > 0);

    if (hasAnyRegistered) {
      const regularCountBeforeLatest = sorted
        .slice(0, sorted.length - 1)
        .filter(
          (s) =>
            !s.title.includes("صيفي") &&
            !s.title.includes("الصيفية") &&
            !s.title.toLowerCase().includes("summer"),
        ).length;

      const currentEnrolledSem = resolveAcademicSemester(
        latestSem?.title || student.currentSemester || "",
        cohort,
        regularCountBeforeLatest,
      );

      return getNextPlanningSemester(currentEnrolledSem);
    }

    // 2. If student has completed/past semesters without active registrations in the latest:
    // Determine next regular semester chronologically
    const completedRegularCount = sorted.filter(
      (s) =>
        !s.title.includes("صيفي") &&
        !s.title.includes("الصيفية") &&
        !s.title.toLowerCase().includes("summer"),
    ).length;

    if (completedRegularCount < REGULAR_SEMESTERS.length) {
      return REGULAR_SEMESTERS[completedRegularCount];
    }
    return REGULAR_SEMESTERS[REGULAR_SEMESTERS.length - 1];
  }

  // 3. Fallback when student has currentSemester string from portal profile
  if (student?.currentSemester) {
    const isSummerPortal =
      student.currentSemester.includes("صيفي") ||
      student.currentSemester.includes("الصيفي") ||
      student.currentSemester.includes("الصيفية") ||
      student.currentSemester.toLowerCase().includes("summer");

    if (!isSummerPortal) {
      const resolved = resolveAcademicSemester(student.currentSemester, cohort);
      if (SEMESTERS.includes(resolved)) {
        if (
          Array.isArray(student.registeredCourses) &&
          student.registeredCourses.length > 0
        ) {
          return getNextPlanningSemester(resolved);
        }
        return resolved;
      }
    }
  }

  // 3. Fallback to completedCourses: Determine highest regular semester completed from course curriculum
  if (
    completedCourses &&
    completedCourses.size > 0 &&
    Array.isArray(courses) &&
    courses.length > 0
  ) {
    let maxRegularIndex = -1;
    for (const c of courses) {
      if (completedCourses.has(c.id)) {
        const rec = getRecommendedSemesterOfCourse(c);
        const idx = REGULAR_SEMESTERS.indexOf(rec as any);
        if (idx > maxRegularIndex) {
          maxRegularIndex = idx;
        }
      }
    }

    if (
      maxRegularIndex >= 0 &&
      maxRegularIndex + 1 < REGULAR_SEMESTERS.length
    ) {
      return REGULAR_SEMESTERS[maxRegularIndex + 1];
    }
  }

  return REGULAR_SEMESTERS[0];
}

/**
 * Get the next sequential semester when committing or advancing.
 * Regular semesters advance to the next regular semester (skipping optional summer by default).
 * Summer semesters advance to the next regular fall semester.
 */
export function getNextPlanningSemester(currentSem: string): string {
  if (!currentSem) return REGULAR_SEMESTERS[0];

  const isSummer = currentSem.includes("صيفي");
  if (!isSummer) {
    const regIdx = REGULAR_SEMESTERS.indexOf(currentSem as any);
    if (regIdx >= 0 && regIdx + 1 < REGULAR_SEMESTERS.length) {
      return REGULAR_SEMESTERS[regIdx + 1];
    }
  } else {
    // Advancing from a summer semester goes to next regular semester
    const sIdx = SEMESTERS.indexOf(currentSem);
    if (sIdx >= 0 && sIdx + 1 < SEMESTERS.length) {
      return SEMESTERS[sIdx + 1];
    }
  }

  return currentSem;
}

/**
 * Auto-populate recommended courses for an upcoming semester, adhering strictly
 * to the curriculum's recommended semester, prerequisite constraints, and credit hour caps.
 */
export function autoPopulateUpcomingSemester(
  courses: Course[],
  targetSemester: string,
  passedSet: Set<string>,
  existingPlanned: Record<string, string>,
  registeredIds?: string[],
): Record<string, string> {
  const next = { ...existingPlanned };
  const isSummer = targetSemester.includes("صيفي");
  const creditLimit = isSummer ? 10 : 19;

  const registeredSet = new Set<string>(registeredIds || []);

  // Remove any registered or passed courses that mistakenly got into next
  for (const cId of Object.keys(next)) {
    if (passedSet.has(cId) || registeredSet.has(cId)) {
      delete next[cId];
    }
  }

  // Combined set of prerequisites satisfied (passed + currently registered in progress)
  const satisfiedPrereqs = new Set<string>([...passedSet, ...registeredSet]);

  // Calculate current planned credits in this semester
  const coursesById = new Map(courses.map((c) => [c.id, c]));
  let currentHours = Object.entries(next)
    .filter(([, s]) => s === targetSemester)
    .reduce((sum, [id]) => sum + (coursesById.get(id)?.credits ?? 0), 0);

  if (currentHours >= creditLimit) {
    return next;
  }

  // 1. Find unpassed & unregistered courses explicitly recommended for this target semester
  const recommendedForSemester = courses.filter((c) => {
    if (passedSet.has(c.id) || registeredSet.has(c.id) || next[c.id])
      return false;
    const rec = getRecommendedSemesterOfCourse(c);
    return rec === targetSemester;
  });

  for (const course of recommendedForSemester) {
    const prereqsMet = (course.prerequisites || []).every((p) =>
      satisfiedPrereqs.has(p),
    );
    if (prereqsMet && currentHours + course.credits <= creditLimit) {
      next[course.id] = targetSemester;
      currentHours += course.credits;
    }
  }

  // 2. If there is still capacity and it is a regular semester, check for missed earlier mandatory courses
  if (!isSummer && currentHours < creditLimit - 2) {
    const targetIdx = REGULAR_SEMESTERS.indexOf(targetSemester as any);
    if (targetIdx > 0) {
      const earlierMissing = courses.filter((c) => {
        if (passedSet.has(c.id) || registeredSet.has(c.id) || next[c.id])
          return false;
        if (
          c.category !== "متطلب تخصص إجباري" &&
          c.category !== "متطلب كلية إجباري"
        )
          return false;
        const rec = getRecommendedSemesterOfCourse(c);
        const recIdx = REGULAR_SEMESTERS.indexOf(rec as any);
        return recIdx >= 0 && recIdx < targetIdx;
      });

      for (const course of earlierMissing) {
        const prereqsMet = (course.prerequisites || []).every((p) =>
          satisfiedPrereqs.has(p),
        );
        if (prereqsMet && currentHours + course.credits <= creditLimit) {
          next[course.id] = targetSemester;
          currentHours += course.credits;
        }
      }
    }
  }

  return next;
}
