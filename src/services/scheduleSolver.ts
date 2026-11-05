export const KNOWN_DAYS: readonly string[] = [
  "سب",
  "أح",
  "اث",
  "ثلا",
  "ار",
  "خمـ",
];

export const DAY_NAMES_MAP: Record<string, string> = {
  سب: "السبت",
  أح: "الأحد",
  اث: "الاثنين",
  ثلا: "الثلاثاء",
  ار: "الأربعاء",
  خمـ: "الخميس",
  جم: "الجمعة",
};

export interface MeetingOption {
  days?: string[];
  day?: string;
  startTime: string;
  endTime: string;
  section?: string;
  instructor?: string;
  room?: string;
  blocks?: ScheduleBlock[];
}

export interface ScheduleBlock {
  days: string[];
  start: number;
  end: number;
  rawTime?: string;
  isOnline?: boolean;
}

export interface CatalogSection {
  sec: string;
  instructor?: string;
  room?: string;
  status?: string;
  building?: string;
  blocks: ScheduleBlock[];
  isOnline?: boolean;
  gender?: string;
  rawTime?: string;
}

export interface CatalogCourse {
  id: string;
  code?: string;
  name: string;
  type?: string;
  category?: string;
  color?: string;
  sections?: CatalogSection[];
}

export interface GeneratedScheduleCourse {
  courseCode: string;
  courseName: string;
  courseType: string;
  color: string;
  section: CatalogSection;
}

export interface SolverCourse {
  id: string;
  name?: string;
  options?: MeetingOption[];
  candidates?: MeetingOption[];
}

export interface SolverConstraints {
  maxWorkDays?: number;
  offDays?: string[];
  preferredStart?: string;
  preferredEnd?: string;
  maxResults?: number;
  nodeLimit?: number;
}

export interface CatalogScheduleFilters {
  /** Meeting-day keys that must remain free, for example "سب" or "أح". */
  freeDays?: string[];
  /** Section numbers to omit, keyed by course code. */
  excludedSections?: Record<string, string[]>;
  /** Required section number, keyed by course code. */
  pinnedSections?: Record<string, string>;
  /** Preferred ordering for generated schedules. */
  timePreference?: "morning" | "late" | "compact" | "min_days" | "";
  /** Maximum allowed gap between consecutive classes, in hours. */
  maxGap?: number | null;
  /** Maximum number of schedules to generate. */
  maxResults?: number;
  /** Gender preference filter: all, male only, female only (Item 149). */
  genderPreference?: "all" | "male" | "female";
  /** Item 50: Prioritizes diverse solution generation to avoid near-identical section duplicates in top results. */
  diverseSolutions?: boolean;
}

export interface ScheduleStats {
  byDay: Record<string, Array<{ start: number; end: number }>>;
  usedDays: string[];
  maxGap: number;
  totalGap: number;
  maxClasses: number;
  earliestStart: number;
  latestEnd: number;
}

export interface MeetingStats {
  courseCount: number;
  workDays: number;
  days: string[];
  totalHours: number;
  earliestStart: string | null;
  latestEnd: string | null;
}

export interface SolvedSchedule {
  entries: Array<MeetingOption & { courseId: string }>;
  stats: MeetingStats;
  score: number;
}

export interface ConflictAutoFix {
  type:
    | "remove_course"
    | "unpin_section"
    | "clear_free_days"
    | "clear_exclusions"
    | "remove_max_gap";
  courseCode?: string;
  label: string;
}

export interface ConflictExplanation {
  hasConflict: boolean;
  summary: string;
  details: string[];
  autoFixes: ConflictAutoFix[];
}

export interface ScheduleQualityIndex {
  score: number;
  tier: "excellent" | "good" | "fair" | "demanding";
  badge: string;
  summary: string;
  breakdown: {
    daysScore: number;
    gapsScore: number;
    timingScore: number;
  };
}

import { normalizeDayKey } from "../core/scheduleTimeParser";
export { normalizeDayKey };

/**
 * Maps canonical day keys or aliases back to display-ready Arabic day names.
 */
export function dayKeyToName(value: unknown): string {
  const key = normalizeDayKey(value);
  if (!key) return String(value ?? "");
  return DAY_NAMES_MAP[key] ?? String(value ?? "");
}

function normalizeArabic(text: unknown): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Determines whether a section or block represents an asynchronous / online class.
 * PTUK Rules:
 * 1. Room numbers containing pure digits without building letters (e.g. "1000", "2000") are virtual/online rooms.
 * 2. Classes starting at or after 16:00 (4:00 PM) are evening e-learning classes.
 * 3. Text containing "الكتروني", "online", "عن بعد", "مسجل", or "moodle".
 */
export function isOnlineComponent(sectionOrBlock?: {
  sec?: string;
  room?: string;
  instructor?: string;
  rawTime?: string;
  isOnline?: boolean;
  start?: number;
  end?: number;
  days?: string[];
}): boolean {
  if (!sectionOrBlock) return false;
  if (sectionOrBlock.isOnline === true) return true;

  const room = (sectionOrBlock.room ?? "").trim();
  // PTUK Domain Rule: 4-digit or 5-digit numbers without building prefix (e.g. 1000, 2050, 5000, 10000, 11111) denote online/virtual rooms
  if (
    /^\d{4,5}$/.test(room) ||
    room.includes("5000") ||
    room.includes("10000")
  ) {
    return true;
  }

  // PTUK Domain Rule: Classes starting at or after 16:00 / 4:00 PM (support hours or minutes representation)
  if (typeof sectionOrBlock.start === "number") {
    if (
      (sectionOrBlock.start >= 16 && sectionOrBlock.start <= 24) ||
      sectionOrBlock.start >= 16 * 60
    ) {
      return true;
    }
  }

  const combined = normalizeArabic(
    `${sectionOrBlock.sec ?? ""} ${sectionOrBlock.room ?? ""} ${sectionOrBlock.instructor ?? ""} ${sectionOrBlock.rawTime ?? ""}`,
  );
  if (
    combined.includes("الكتروني") ||
    combined.includes("online") ||
    combined.includes("عن بعد") ||
    combined.includes("moodle") ||
    combined.includes("مسجل")
  ) {
    return true;
  }

  if (sectionOrBlock.start === 0 && sectionOrBlock.end === 0) {
    return true;
  }

  return false;
}

/**
 * Detects whether a section has unannounced / TBA timing (Item 148).
 */
export function isTbaSection(section?: CatalogSection): boolean {
  if (!section) return false;
  const rawTime = (section.rawTime || "").toLowerCase();
  const room = (section.room || "").toLowerCase();
  if (
    rawTime.includes("tba") ||
    rawTime.includes("لم يحدد") ||
    rawTime.includes("غير محدد") ||
    room.includes("tba") ||
    room.includes("لم يحدد")
  ) {
    return true;
  }
  const blocks = Array.isArray(section.blocks) ? section.blocks : [];
  if (blocks.length === 0) return true;
  return blocks.every(
    (b) =>
      (!b.days || b.days.length === 0) &&
      (b.start === undefined || isNaN(b.start)),
  );
}

function sectionBlocks(section?: CatalogSection): ScheduleBlock[] {
  return Array.isArray(section?.blocks) ? section.blocks : [];
}

function isValidBlock(block: ScheduleBlock): boolean {
  if (typeof block !== "object" || block === null) return false;
  if (isOnlineComponent(block)) return true;

  return (
    Array.isArray(block.days) &&
    typeof block.start === "number" &&
    Number.isFinite(block.start) &&
    typeof block.end === "number" &&
    Number.isFinite(block.end) &&
    block.end > block.start
  );
}

/**
 * Returns true when any block in the proposed section overlaps an assigned
 * section on at least one shared day, or if candidate blocks conflict with themselves.
 * Online/asynchronous lectures never conflict with in-person lectures.
 */
export function hasConflict(
  schedule: Array<{ section: CatalogSection } | CatalogSection>,
  newSection: CatalogSection,
): boolean {
  const candidateBlocks = sectionBlocks(newSection);
  if (!Array.isArray(schedule) || candidateBlocks.length === 0) return true;

  // Online sections never conflict with in-person schedules
  if (isOnlineComponent(newSection)) {
    return false;
  }

  // 1. Verify candidate blocks validity and detect self-conflicts within newSection
  for (let i = 0; i < candidateBlocks.length; i++) {
    const b1 = candidateBlocks[i];
    if (!isValidBlock(b1)) return true;
    if (isOnlineComponent(b1)) continue;

    const days1 = (b1.days ?? [])
      .map(normalizeDayKey)
      .filter(Boolean) as string[];
    if (days1.length === 0) return true;

    for (let j = i + 1; j < candidateBlocks.length; j++) {
      const b2 = candidateBlocks[j];
      if (!isValidBlock(b2)) return true;
      if (isOnlineComponent(b2)) continue;

      const days2 = (b2.days ?? [])
        .map(normalizeDayKey)
        .filter(Boolean) as string[];
      const sharedDay = days1.some((d) => days2.includes(d));
      if (sharedDay && b1.start < b2.end && b2.start < b1.end) {
        return true;
      }
    }
  }

  // 2. Check conflicts against all already-assigned sections in schedule
  for (const selected of schedule) {
    const assignedSection =
      (selected as { section: CatalogSection })?.section ??
      (selected as CatalogSection);
    if (isOnlineComponent(assignedSection)) continue;

    const assignedBlocks = sectionBlocks(assignedSection);
    for (const assignedBlock of assignedBlocks) {
      if (!isValidBlock(assignedBlock)) return true;
      if (isOnlineComponent(assignedBlock)) continue;

      const assignedDays = (assignedBlock.days ?? [])
        .map(normalizeDayKey)
        .filter(Boolean) as string[];
      if (assignedDays.length === 0) continue;

      for (const candidateBlock of candidateBlocks) {
        if (isOnlineComponent(candidateBlock)) continue;
        const candidateDays = (candidateBlock.days ?? [])
          .map(normalizeDayKey)
          .filter(Boolean) as string[];
        const sharedDay = assignedDays.some((day) =>
          candidateDays.includes(day),
        );
        if (
          sharedDay &&
          assignedBlock.start < candidateBlock.end &&
          candidateBlock.start < assignedBlock.end
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

function sectionKey(section?: CatalogSection): string {
  return String(section?.sec ?? "").trim();
}

function normalizeSectionConstraints(filters: CatalogScheduleFilters = {}) {
  const excludedSections = new Map<string, Set<string>>(
    Object.entries(filters.excludedSections ?? {}).map(
      ([courseCode, sections]) => [
        courseCode,
        new Set((sections ?? []).map(String)),
      ],
    ),
  );
  const pinnedSections = new Map<string, string>(
    Object.entries(filters.pinnedSections ?? {}).map(
      ([courseCode, section]) => [courseCode, String(section)],
    ),
  );
  return { excludedSections, pinnedSections };
}

/**
 * Filter available candidates for a course given static filters.
 */
function getEligibleSectionsForCourse(
  course: CatalogCourse,
  offDays: Set<string>,
  excludedSections: Map<string, Set<string>>,
  pinnedSections: Map<string, string>,
  genderPreference?: "all" | "male" | "female",
): CatalogSection[] {
  const courseCode = String(course.code ?? course.id ?? "");
  const exclusions = excludedSections.get(courseCode) ?? new Set();
  const pinned = pinnedSections.get(courseCode);

  return (course.sections ?? []).filter((section) => {
    const secKey = sectionKey(section);
    if (exclusions.has(secKey)) return false;
    if (pinned && secKey !== pinned) return false;

    // Gender Section Filter (Item 149)
    if (genderPreference && genderPreference !== "all") {
      const secGender = section.gender || "";
      if (
        genderPreference === "male" &&
        (secGender.includes("طالبات") || secGender.includes("إناث"))
      ) {
        return false;
      }
      if (
        genderPreference === "female" &&
        (secGender.includes("طلاب") || secGender.includes("ذكور"))
      ) {
        return false;
      }
    }

    if (
      offDays.size > 0 &&
      !isOnlineComponent(section) &&
      !isTbaSection(section) &&
      sectionBlocks(section).some((block) =>
        (block.days ?? [])
          .map(normalizeDayKey)
          .some((day) => day && offDays.has(day)),
      )
    ) {
      return false;
    }

    return true;
  });
}

/**
 * Generates conflict-free combinations choosing one section from each course.
 * Uses CSP Forward Checking (MRV heuristic) for high performance.
 */
export function generateAllSchedules(
  courses: CatalogCourse[] = [],
  filters: CatalogScheduleFilters = {},
): GeneratedScheduleCourse[][] {
  if (!Array.isArray(courses) || courses.length === 0) return [];
  if (
    courses.some(
      (course) =>
        !Array.isArray(course.sections) || course.sections.length === 0,
    )
  ) {
    return [];
  }

  const results: Array<{
    schedule: GeneratedScheduleCourse[];
    stats: ScheduleStats;
  }> = [];
  const current: GeneratedScheduleCourse[] = [];
  const offDays = new Set(
    (filters.freeDays ?? []).map(normalizeDayKey).filter(Boolean) as string[],
  );
  const { excludedSections, pinnedSections } =
    normalizeSectionConstraints(filters);
  const preference = filters.timePreference;
  const maxGap =
    typeof filters.maxGap === "number" && Number.isFinite(filters.maxGap)
      ? Math.max(0, filters.maxGap)
      : null;
  const maxResults =
    typeof filters.maxResults === "number" ? filters.maxResults : 500;

  // Pre-filter initial eligible domains per course
  interface PreparedCourse {
    course: CatalogCourse;
    courseCode: string;
    originalIndex: number;
    initialCandidates: CatalogSection[];
  }

  const preparedCourses: PreparedCourse[] = courses.map((course, idx) => ({
    course,
    courseCode: String(course.code ?? course.id ?? ""),
    originalIndex: idx,
    initialCandidates: getEligibleSectionsForCourse(
      course,
      offDays,
      excludedSections,
      pinnedSections,
      filters.genderPreference,
    ),
  }));

  // If any course has 0 eligible candidates, no valid schedule is possible
  if (preparedCourses.some((c) => c.initialCandidates.length === 0)) {
    return [];
  }

  // MRV (Minimum Remaining Values): search courses with fewest candidates first
  preparedCourses.sort(
    (a, b) => a.initialCandidates.length - b.initialCandidates.length,
  );

  // CSP Forward Checking Search
  function backtrack(index: number, remainingDomains: CatalogSection[][]) {
    if (results.length >= maxResults) return;

    if (index === preparedCourses.length) {
      const stats = getBlockStats(current);
      if (maxGap !== null && stats.maxGap > maxGap) return;

      // Restore original course array order for output stability
      const orderedSchedule = [...current].sort((a, b) => {
        const aIdx = courses.findIndex(
          (c) => String(c.code ?? c.id) === a.courseCode,
        );
        const bIdx = courses.findIndex(
          (c) => String(c.code ?? c.id) === b.courseCode,
        );
        return aIdx - bIdx;
      });

      results.push({
        schedule: orderedSchedule,
        stats,
      });
      return;
    }

    const currentCourse = preparedCourses[index];
    const candidateSections = remainingDomains[index];

    for (const section of candidateSections) {
      if (results.length >= maxResults) return;
      if (hasConflict(current, section)) continue;

      // Forward Checking: check future unassigned courses
      let forwardCheckPassed = true;
      const nextDomains: CatalogSection[][] = [];

      for (let j = 0; j < preparedCourses.length; j++) {
        if (j <= index) {
          nextDomains.push(remainingDomains[j]);
        } else {
          // Filter candidate sections of future course that conflict with the new assignment
          const filteredFutureCandidates = remainingDomains[j].filter(
            (futureSec) => !hasConflict([{ section }], futureSec),
          );
          if (filteredFutureCandidates.length === 0) {
            forwardCheckPassed = false;
            break; // Prune branch early!
          }
          nextDomains.push(filteredFutureCandidates);
        }
      }

      if (!forwardCheckPassed) {
        continue; // Forward checking failure: this section starves a future course
      }

      current.push({
        courseCode: currentCourse.courseCode,
        courseName: String(currentCourse.course.name ?? ""),
        courseType: String(
          currentCourse.course.type ?? currentCourse.course.category ?? "",
        ),
        color: String(currentCourse.course.color ?? ""),
        section,
      });

      backtrack(index + 1, nextDomains);
      current.pop();
    }
  }

  backtrack(
    0,
    preparedCourses.map((c) => c.initialCandidates),
  );

  const compareSchedules = (
    first: { stats: ScheduleStats },
    second: { stats: ScheduleStats },
  ) => {
    if (preference === "min_days") {
      if (first.stats.usedDays.length !== second.stats.usedDays.length) {
        return first.stats.usedDays.length - second.stats.usedDays.length;
      }
      return first.stats.totalGap - second.stats.totalGap;
    }
    if (preference === "compact") {
      if (first.stats.totalGap !== second.stats.totalGap) {
        return first.stats.totalGap - second.stats.totalGap;
      }
      return first.stats.maxGap - second.stats.maxGap;
    }
    if (preference === "morning") {
      return (
        first.stats.earliestStart - second.stats.earliestStart ||
        first.stats.latestEnd - second.stats.latestEnd
      );
    }
    if (preference === "late") {
      return (
        second.stats.latestEnd - first.stats.latestEnd ||
        second.stats.earliestStart - first.stats.earliestStart
      );
    }
    return 0;
  };

  const sortedSchedules = results
    .sort(compareSchedules)
    .map(({ schedule }) => schedule);
  if (filters.diverseSolutions) {
    return selectDiverseSchedules(sortedSchedules, maxResults);
  }
  return sortedSchedules;
}

/**
 * Item 50: Selects a diverse subset of schedules.
 * Maximizes variation in sections and meeting times across the top results,
 * preventing identical or near-duplicate section variants from crowding the top ranks.
 */
export function selectDiverseSchedules(
  schedules: GeneratedScheduleCourse[][],
  maxResults = 20,
  minDifferenceRatio = 0.35,
): GeneratedScheduleCourse[][] {
  if (schedules.length <= 1) return schedules;

  const selected: GeneratedScheduleCourse[][] = [];
  const pool = [...schedules];

  // The first schedule is always the optimal one according to user preference
  selected.push(pool.shift()!);

  while (pool.length > 0 && selected.length < maxResults) {
    let bestIdx = -1;
    let highestMinDist = -1;

    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];
      let minDistToSelected = 1.0;

      for (const existing of selected) {
        let matchingSections = 0;
        const totalCourses = Math.max(candidate.length, existing.length);

        for (const candItem of candidate) {
          const match = existing.find(
            (exItem) => exItem.courseCode === candItem.courseCode,
          );
          if (match && match.section.sec === candItem.section.sec) {
            matchingSections++;
          }
        }

        const distance =
          totalCourses > 0
            ? (totalCourses - matchingSections) / totalCourses
            : 1.0;
        if (distance < minDistToSelected) {
          minDistToSelected = distance;
        }
      }

      if (minDistToSelected > highestMinDist) {
        highestMinDist = minDistToSelected;
        bestIdx = i;
      }
    }

    if (bestIdx !== -1 && highestMinDist >= minDifferenceRatio) {
      selected.push(pool.splice(bestIdx, 1)[0]);
    } else {
      // Fallback: append next best in original preference order
      selected.push(pool.shift()!);
    }
  }

  return selected;
}

export function getBlockStats(
  schedule: Array<
    GeneratedScheduleCourse | CatalogSection | { section: CatalogSection }
  >,
): ScheduleStats {
  const byDay: Record<
    string,
    Array<{ start: number; end: number }>
  > = Object.fromEntries(KNOWN_DAYS.map((day) => [day, []]));

  for (const item of schedule) {
    const section =
      (item as { section: CatalogSection })?.section ??
      (item as CatalogSection);
    if (isOnlineComponent(section)) continue;

    for (const block of sectionBlocks(section)) {
      if (isOnlineComponent(block)) continue;
      for (const rawDay of block.days ?? []) {
        const day = normalizeDayKey(rawDay);
        if (day && byDay[day]) {
          byDay[day].push({ start: block.start, end: block.end });
        }
      }
    }
  }

  const usedDays = Object.keys(byDay).filter((day) => byDay[day].length > 0);
  let maxGap = 0;
  let totalGap = 0;
  let maxClasses = 0;
  const allStarts: number[] = [];
  const allEnds: number[] = [];

  for (const blocks of Object.values(byDay)) {
    if (blocks.length === 0) continue;
    maxClasses = Math.max(maxClasses, blocks.length);

    const orderedBlocks = [...blocks].sort(
      (first, second) => first.start - second.start,
    );

    const currentStart = orderedBlocks[0].start;
    let currentEnd = orderedBlocks[0].end;
    let teachingTime = 0;

    for (const b of orderedBlocks) {
      teachingTime += Math.max(0, b.end - b.start);
    }

    for (let index = 1; index < orderedBlocks.length; index += 1) {
      const nextBlock = orderedBlocks[index];
      const gap = Math.max(0, nextBlock.start - currentEnd);
      maxGap = Math.max(maxGap, gap);
      currentEnd = Math.max(currentEnd, nextBlock.end);
    }

    const span = Math.max(0, currentEnd - currentStart);
    totalGap += Math.max(0, span - teachingTime);

    allStarts.push(currentStart);
    allEnds.push(currentEnd);
  }

  return {
    byDay,
    usedDays,
    maxGap,
    totalGap,
    maxClasses,
    earliestStart: allStarts.length ? Math.min(...allStarts) : 99,
    latestEnd: allEnds.length ? Math.max(...allEnds) : 0,
  };
}

/**
 * Calculates Schedule Quality Index (Item 52)
 * Evaluates schedule comfort (0-100) based on days attendance, gaps, and daily lecture times.
 */
export function calculateScheduleQuality(
  schedule: Array<
    GeneratedScheduleCourse | CatalogSection | { section: CatalogSection }
  >,
): ScheduleQualityIndex {
  const stats = getBlockStats(schedule);
  const numDays = stats.usedDays.length;
  const totalGapHours = stats.totalGap;

  let daysScore = 40;
  if (numDays === 4) daysScore = 35;
  else if (numDays === 5) daysScore = 25;
  else if (numDays >= 6) daysScore = 15;
  else if (numDays === 0) daysScore = 0;

  const gapsScore = Math.max(0, Math.round(40 - totalGapHours * 6));

  let timingScore = 20;
  if (
    stats.earliestStart < 8.25 &&
    stats.earliestStart > 0 &&
    stats.earliestStart !== 99
  )
    timingScore -= 4;
  if (stats.latestEnd > 16.25) timingScore -= 4;
  timingScore = Math.max(0, timingScore);

  const totalScore = Math.min(
    100,
    Math.max(0, daysScore + gapsScore + timingScore),
  );

  let tier: ScheduleQualityIndex["tier"] = "good";
  let badge = "جدول متوازن 👍";
  if (totalScore >= 85) {
    tier = "excellent";
    badge = "جدول ممتاز ومريح ⭐";
  } else if (totalScore >= 70) {
    tier = "good";
    badge = "جدول متوازن وجيد 👍";
  } else if (totalScore >= 55) {
    tier = "fair";
    badge = "جدول متوسط ⚡";
  } else {
    tier = "demanding";
    badge = "جدول مجهد (فراغات كثيرة) ⚠️";
  }

  const summary = `${totalScore}/100 • دوام ${numDays} أيام • ${totalGapHours > 0 ? `${totalGapHours.toFixed(1)} س فراغ` : "بدون فراغات"}`;

  return {
    score: totalScore,
    tier,
    badge,
    summary,
    breakdown: {
      daysScore,
      gapsScore,
      timingScore,
    },
  };
}

function toMinutes(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 60);
  }
  const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(
    String(value ?? "").trim(),
  );
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function asDays(value: any): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value?.day === "string") return [value.day];
  return typeof value?.days === "string" ? [value.days] : [];
}

function getMeetingBlocks(
  meeting: any,
): Array<{ days: string[]; start: number; end: number }> {
  if (Array.isArray(meeting?.blocks) && meeting.blocks.length > 0) {
    return meeting.blocks.flatMap((b: any) => {
      const days = (b.days ?? [])
        .map(normalizeDayKey)
        .filter(Boolean) as string[];
      const start = toMinutes(b.start ?? b.startTime);
      const end = toMinutes(b.end ?? b.endTime);
      if (days.length > 0 && start !== null && end !== null && end > start) {
        return [{ days, start, end }];
      }
      return [];
    });
  }

  const start = toMinutes(meeting?.startTime ?? meeting?.start);
  const end = toMinutes(meeting?.endTime ?? meeting?.end);
  const days = asDays(meeting).map(normalizeDayKey).filter(Boolean) as string[];
  if (start !== null && end !== null && end > start && days.length > 0) {
    return [{ days, start, end }];
  }
  return [];
}

function hasMeetingConflict(candidate: any, assigned: any[]): boolean {
  const candidateBlocks = getMeetingBlocks(candidate);
  if (candidateBlocks.length === 0) return true;

  // 1. Self-conflict across candidate blocks
  for (let i = 0; i < candidateBlocks.length; i++) {
    const b1 = candidateBlocks[i];
    for (let j = i + 1; j < candidateBlocks.length; j++) {
      const b2 = candidateBlocks[j];
      const sharedDay = b1.days.some((d) => b2.days.includes(d));
      if (sharedDay && b1.start < b2.end && b2.start < b1.end) {
        return true;
      }
    }
  }

  // 2. Conflict with assigned meetings
  return assigned.some((entry) => {
    const entryBlocks = getMeetingBlocks(entry);
    if (entryBlocks.length === 0) return true;

    return candidateBlocks.some((cb) =>
      entryBlocks.some(
        (eb) =>
          cb.days.some((day) => eb.days.includes(day)) &&
          cb.start < eb.end &&
          eb.start < cb.end,
      ),
    );
  });
}

function normalizeCandidates(
  course: SolverCourse,
  constraints: SolverConstraints,
): MeetingOption[] {
  const offDays = new Set(
    (constraints.offDays ?? [])
      .map(normalizeDayKey)
      .filter(Boolean) as string[],
  );
  const startLimit = toMinutes(constraints.preferredStart);
  const endLimit = toMinutes(constraints.preferredEnd);
  const candidates = course.options ?? course.candidates ?? [];

  return candidates.filter((candidate) => {
    const blocks = getMeetingBlocks(candidate);
    if (blocks.length === 0) return false;

    const hasOffDay = blocks.some((b) =>
      b.days.some((day) => offDays.has(day)),
    );
    if (hasOffDay) return false;

    return blocks.every(
      (b) =>
        (startLimit === null || b.start >= startLimit) &&
        (endLimit === null || b.end <= endLimit),
    );
  });
}

function getMeetingStats(schedule: any[]): MeetingStats {
  const allBlocks = schedule.flatMap(getMeetingBlocks);
  const daySet = new Set(allBlocks.flatMap((b) => b.days));
  const totalMinutes = allBlocks.reduce(
    (total, { start, end }) => total + (end - start),
    0,
  );
  const earliest = allBlocks.length
    ? Math.min(...allBlocks.map(({ start }) => start))
    : null;
  const latest = allBlocks.length
    ? Math.max(...allBlocks.map(({ end }) => end))
    : null;
  const format = (minutes: number | null) =>
    minutes === null
      ? null
      : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
          minutes % 60,
        ).padStart(2, "0")}`;

  return {
    courseCount: schedule.length,
    workDays: daySet.size,
    days: [...daySet],
    totalHours: Number((totalMinutes / 60).toFixed(1)),
    earliestStart: format(earliest),
    latestEnd: format(latest),
  };
}

/**
 * Computes summary values for either block-based generated schedules or
 * legacy flat meeting entries.
 */
export function getStats(
  schedule:
    | GeneratedScheduleCourse[]
    | MeetingOption[]
    | Record<string, MeetingOption> = [],
): ScheduleStats | MeetingStats {
  const entries: any[] = Array.isArray(schedule)
    ? schedule
    : Object.values(schedule ?? {});
  if (entries.length === 0) return getBlockStats(entries);
  if (entries.some((entry) => Array.isArray(entry?.section?.blocks))) {
    return getBlockStats(entries);
  }
  return getMeetingStats(entries);
}

/**
 * Backtracking search across the legacy meeting-option shape.
 */
export function solveSchedule(
  courses: SolverCourse[],
  constraints: SolverConstraints = {},
): {
  schedules: SolvedSchedule[];
  exploredNodes: number;
  truncated: boolean;
} {
  const maxResults = Math.max(1, Math.min(100, constraints.maxResults ?? 16));
  const nodeLimit = Math.max(1, constraints.nodeLimit ?? 50000);
  const maxWorkDays = Number.isInteger(constraints.maxWorkDays)
    ? Math.max(1, Math.min(6, constraints.maxWorkDays!))
    : 6;
  const prepared = (courses ?? [])
    .map((course) => ({
      course,
      candidates: normalizeCandidates(course, constraints),
    }))
    .sort(
      (first, second) => first.candidates.length - second.candidates.length,
    );

  if (prepared.some(({ candidates }) => candidates.length === 0)) {
    return { schedules: [], exploredNodes: 0, truncated: false };
  }

  const schedules: SolvedSchedule[] = [];
  const assigned: Array<{ course: SolverCourse; option: MeetingOption }> = [];
  let exploredNodes = 0;
  let truncated = false;

  function visit(index: number) {
    if (schedules.length >= maxResults || exploredNodes >= nodeLimit) {
      truncated = true;
      return;
    }
    if (index === prepared.length) {
      const entries = assigned.map(({ course, option }) => ({
        courseId: course.id,
        ...option,
      }));
      schedules.push({ entries, stats: getMeetingStats(entries), score: 0 });
      return;
    }

    const { course, candidates } = prepared[index];
    for (const option of candidates) {
      exploredNodes += 1;
      if (
        hasMeetingConflict(
          option,
          assigned.map(({ option: assignedOption }) => assignedOption),
        )
      ) {
        continue;
      }

      const candidateBlocks = getMeetingBlocks(option);
      const days = new Set([
        ...assigned.flatMap(({ option: assignedOption }) =>
          getMeetingBlocks(assignedOption).flatMap((b) => b.days),
        ),
        ...candidateBlocks.flatMap((b) => b.days),
      ]);
      if (days.size > maxWorkDays) continue;

      assigned.push({ course, option });
      visit(index + 1);
      assigned.pop();
      if (schedules.length >= maxResults || exploredNodes >= nodeLimit) break;
    }
  }

  visit(0);
  return { schedules, exploredNodes, truncated };
}

/**
 * Explains why schedule combinations could not be formed and returns actionable auto-fixes.
 */
export function explainScheduleConflicts(
  courses: CatalogCourse[] = [],
  filters: CatalogScheduleFilters = {},
): ConflictExplanation {
  if (!Array.isArray(courses) || courses.length === 0) {
    return { hasConflict: false, summary: "", details: [], autoFixes: [] };
  }

  const offDays = new Set(
    (filters.freeDays ?? []).map(normalizeDayKey).filter(Boolean) as string[],
  );
  const { excludedSections, pinnedSections } =
    normalizeSectionConstraints(filters);

  const details: string[] = [];
  const autoFixes: ConflictAutoFix[] = [];
  const eligibleSectionsByCourse = new Map<
    string,
    {
      course: CatalogCourse;
      available: CatalogSection[];
      name: string;
      code: string;
    }
  >();

  for (const course of courses) {
    const code = String(course.code ?? course.id ?? "");
    const name = String(course.name ?? code);
    const rawSections = Array.isArray(course.sections) ? course.sections : [];

    if (rawSections.length === 0) {
      details.push(`المادة "${name}" (${code}) لا تحتوي على أي شعب مطروحة.`);
      autoFixes.push({
        type: "remove_course",
        courseCode: code,
        label: `إزالة مادة "${name}"`,
      });
      continue;
    }

    const pinned = pinnedSections.get(code);
    const exclusions = excludedSections.get(code) ?? new Set();

    const available = rawSections.filter((section) => {
      const secKey = sectionKey(section);
      const sectionName = normalizeArabic(section.sec);
      if (sectionName.includes("مختلط")) return false;
      if (exclusions.has(secKey)) return false;
      if (pinned && secKey !== pinned) return false;
      if (
        offDays.size > 0 &&
        !isOnlineComponent(section) &&
        sectionBlocks(section).some((block) =>
          (block.days ?? [])
            .map(normalizeDayKey)
            .some((day) => day && offDays.has(day)),
        )
      ) {
        return false;
      }
      return true;
    });

    if (available.length === 0) {
      if (pinned) {
        details.push(
          `الشعبة المثبتة للمادة "${name}" (شعبة ${pinned}) تتعارض مع فلاتر الأيام أو مستبعدة.`,
        );
        autoFixes.push({
          type: "unpin_section",
          courseCode: code,
          label: `إلغاء تثبيت شعبة "${name}"`,
        });
      } else if (offDays.size > 0) {
        details.push(
          `جميع شعب المادة "${name}" تتعارض مع أيام العطلة المحددة.`,
        );
        if (!autoFixes.some((f) => f.type === "clear_free_days")) {
          autoFixes.push({
            type: "clear_free_days",
            label: "إلغاء أيام العطلة المحددة",
          });
        }
      } else if (exclusions.size > 0) {
        details.push(`تم استبعاد جميع شعب المادة "${name}" يدوياً.`);
        autoFixes.push({
          type: "clear_exclusions",
          courseCode: code,
          label: `إلغاء استبعاد شعب "${name}"`,
        });
      } else {
        details.push(`لا تتوفر أي شعب مناسبة للمادة "${name}".`);
        autoFixes.push({
          type: "remove_course",
          courseCode: code,
          label: `إزالة مادة "${name}"`,
        });
      }
    } else {
      eligibleSectionsByCourse.set(code, { course, available, name, code });
    }
  }

  // Pairwise conflicts check
  const validCourses = Array.from(eligibleSectionsByCourse.values());
  for (let i = 0; i < validCourses.length; i++) {
    for (let j = i + 1; j < validCourses.length; j++) {
      const c1 = validCourses[i];
      const c2 = validCourses[j];

      let allConflict = true;
      for (const s1 of c1.available) {
        for (const s2 of c2.available) {
          if (!hasConflict([{ section: s1 }], s2)) {
            allConflict = false;
            break;
          }
        }
        if (!allConflict) break;
      }

      if (allConflict) {
        details.push(
          `تعارض كامل في المواعيد بين "${c1.name}" و "${c2.name}" (جميع الشعب المتاحة متداخلة).`,
        );
        if (
          !autoFixes.some(
            (f) => f.type === "remove_course" && f.courseCode === c2.code,
          )
        ) {
          autoFixes.push({
            type: "remove_course",
            courseCode: c2.code,
            label: `استبعاد "${c2.name}" لحل التعارض`,
          });
        }
      }
    }
  }

  if (details.length === 0) {
    if (filters.maxGap !== null && filters.maxGap !== undefined) {
      details.push(
        `شرط أقصى فراغ بين المحاضرات (${filters.maxGap} ساعة) يمنع اكتمال أي جدول.`,
      );
      autoFixes.push({
        type: "remove_max_gap",
        label: "إلغاء شرط أقصى فراغ",
      });
    } else {
      details.push(
        "يوجد تداخل بين مواعيد بعض المواد المختارة يمنع تكوين جدول موحد.",
      );
      const last = courses[courses.length - 1];
      if (last) {
        const lastCode = String(last.code ?? last.id ?? "");
        const lastName = String(last.name ?? lastCode);
        autoFixes.push({
          type: "remove_course",
          courseCode: lastCode,
          label: `إزالة مادة "${lastName}"`,
        });
      }
    }
  }

  return {
    hasConflict: details.length > 0,
    summary:
      details.length > 0
        ? "تعذر تكوين جدول بسبب وجود تعارضات في الأوقات أو قيود الفلترة"
        : "",
    details,
    autoFixes,
  };
}
