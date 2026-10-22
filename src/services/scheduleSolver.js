export const KNOWN_DAYS = ["سب", "أح", "اث", "ثلا", "ار", "خمـ"];

export const DAY_NAMES_MAP = {
  سب: "السبت",
  أح: "الأحد",
  اث: "الاثنين",
  ثلا: "الثلاثاء",
  ار: "الأربعاء",
  "خمـ": "الخميس",
  جم: "الجمعة",
};

/**
 * Standardizes Arabic and English day strings into the canonical day keys used by the schedule engine:
 * "سب", "أح", "اث", "ثلا", "ار", "خمـ", or "جم".
 * Accepts single characters (س, ح, ن, ث, ر, خ, ج), short codes, and full names.
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeDayKey(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const str = String(value).trim();
  if (!str) return null;

  if (KNOWN_DAYS.includes(str) || str === "جم") return str;

  const clean = str
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .trim();

  // Saturday
  if (
    clean === "سب" ||
    clean === "س" ||
    clean === "سبت" ||
    clean === "السبت" ||
    clean === "sat" ||
    clean === "saturday"
  ) {
    return "سب";
  }

  // Sunday
  if (
    clean === "اح" ||
    clean === "ح" ||
    clean === "احد" ||
    clean === "الاحد" ||
    clean === "sun" ||
    clean === "sunday"
  ) {
    return "أح";
  }

  // Monday
  if (
    clean === "اث" ||
    clean === "ن" ||
    clean === "اثنين" ||
    clean === "الاثنين" ||
    clean === "mon" ||
    clean === "monday"
  ) {
    return "اث";
  }

  // Tuesday
  if (
    clean === "ثلا" ||
    clean === "ثل" ||
    clean === "ثلاث" ||
    clean === "ثلاثاء" ||
    clean === "الثلاثاء" ||
    clean === "ث" ||
    clean === "tue" ||
    clean === "tuesday"
  ) {
    return "ثلا";
  }

  // Wednesday
  if (
    clean === "ار" ||
    clean === "ارب" ||
    clean === "اربع" ||
    clean === "اربعاء" ||
    clean === "الاربعاء" ||
    clean === "ر" ||
    clean === "wed" ||
    clean === "wednesday"
  ) {
    return "ار";
  }

  // Thursday
  if (
    clean === "خم" ||
    clean === "خمي" ||
    clean === "خميس" ||
    clean === "الخميس" ||
    clean === "خ" ||
    clean === "thu" ||
    clean === "thursday"
  ) {
    return "خمـ";
  }

  // Friday
  if (
    clean === "جم" ||
    clean === "جمع" ||
    clean === "جمعه" ||
    clean === "الجمعه" ||
    clean === "الجمعة" ||
    clean === "ج" ||
    clean === "fri" ||
    clean === "friday"
  ) {
    return "جم";
  }

  if (clean.startsWith("السبت") || clean.startsWith("سبت")) return "سب";
  if (clean.startsWith("الاحد") || clean.startsWith("احد")) return "أح";
  if (clean.startsWith("الاثنين") || clean.startsWith("اثنين")) return "اث";
  if (clean.startsWith("الثلاث") || clean.startsWith("ثلاث")) return "ثلا";
  if (clean.startsWith("الاربع") || clean.startsWith("اربع")) return "ار";
  if (clean.startsWith("الخميس") || clean.startsWith("خميس")) return "خمـ";
  if (clean.startsWith("الجمع") || clean.startsWith("جمع")) return "جم";

  return null;
}

/**
 * Returns the full Arabic name for a day key.
 * @param {unknown} value
 * @returns {string}
 */
export function dayKeyToName(value) {
  const key = normalizeDayKey(value);
  return (key && DAY_NAMES_MAP[key]) || String(value ?? "");
}

function normalizeArabic(value) {
  return String(value ?? "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sectionBlocks(section) {
  return Array.isArray(section?.blocks) ? section.blocks : [];
}

function isValidBlock(block) {
  return (
    typeof block === "object" &&
    block !== null &&
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
 */
export function hasConflict(schedule, newSection) {
  const candidateBlocks = sectionBlocks(newSection);
  if (!Array.isArray(schedule) || candidateBlocks.length === 0) return true;

  // 1. Verify candidate blocks validity and detect self-conflicts within newSection
  for (let i = 0; i < candidateBlocks.length; i++) {
    const b1 = candidateBlocks[i];
    if (!isValidBlock(b1)) return true;
    const days1 = (b1.days ?? []).map(normalizeDayKey).filter(Boolean);
    if (days1.length === 0) return true;

    for (let j = i + 1; j < candidateBlocks.length; j++) {
      const b2 = candidateBlocks[j];
      if (!isValidBlock(b2)) return true;
      const days2 = (b2.days ?? []).map(normalizeDayKey).filter(Boolean);
      const sharedDay = days1.some((d) => days2.includes(d));
      if (sharedDay && b1.start < b2.end && b2.start < b1.end) {
        return true;
      }
    }
  }

  // 2. Check conflicts against all already-assigned sections in schedule
  for (const selected of schedule) {
    const assignedSection = selected?.section ?? selected;
    const assignedBlocks = sectionBlocks(assignedSection);
    for (const assignedBlock of assignedBlocks) {
      if (!isValidBlock(assignedBlock)) return true;
      const assignedDays = (assignedBlock.days ?? [])
        .map(normalizeDayKey)
        .filter(Boolean);
      if (assignedDays.length === 0) continue;

      for (const candidateBlock of candidateBlocks) {
        const candidateDays = (candidateBlock.days ?? [])
          .map(normalizeDayKey)
          .filter(Boolean);
        const sharedDay = assignedDays.some((day) => candidateDays.includes(day));
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

function sectionKey(section) {
  return String(section?.sec ?? "").trim();
}

function normalizeSectionConstraints(filters = {}) {
  const excludedSections = new Map(
    Object.entries(filters.excludedSections ?? {}).map(
      ([courseCode, sections]) => [
        courseCode,
        new Set((sections ?? []).map(String)),
      ],
    ),
  );
  const pinnedSections = new Map(
    Object.entries(filters.pinnedSections ?? {}).map(
      ([courseCode, section]) => [courseCode, String(section)],
    ),
  );
  return { excludedSections, pinnedSections };
}

/**
 * Generates every conflict-free combination, choosing exactly one section
 * from each course and applying the optional UI constraints.
 */
export function generateAllSchedules(courses = [], filters = {}) {
  if (!Array.isArray(courses)) return [];
  if (courses.length === 0) return [];
  if (
    courses.some(
      (course) =>
        !Array.isArray(course.sections) || course.sections.length === 0,
    )
  ) {
    return [];
  }

  const results = [];
  const current = [];
  const offDays = new Set(
    (filters.freeDays ?? []).map(normalizeDayKey).filter(Boolean),
  );
  const { excludedSections, pinnedSections } =
    normalizeSectionConstraints(filters);
  const preference = filters.timePreference;
  const maxGap =
    typeof filters.maxGap === "number" && Number.isFinite(filters.maxGap)
      ? Math.max(0, filters.maxGap)
      : null;

  function backtrack(index) {
    if (index === courses.length) {
      const stats = getBlockStats(current);
      if (maxGap !== null && stats.maxGap > maxGap) return;
      results.push({
        schedule: [...current],
        stats,
      });
      return;
    }

    const course = courses[index];
    const courseCode = String(course.code ?? course.id ?? "");
    const exclusions = excludedSections.get(courseCode) ?? new Set();
    const pinned = pinnedSections.get(courseCode);
    for (const section of course.sections) {
      const sectionName = normalizeArabic(section.sec);
      if (sectionName.includes("مختلط")) continue;
      if (exclusions.has(sectionKey(section))) continue;
      if (pinned && sectionKey(section) !== pinned) continue;

      if (
        offDays.size > 0 &&
        sectionBlocks(section).some((block) =>
          (block.days ?? [])
            .map(normalizeDayKey)
            .some((day) => day && offDays.has(day)),
        )
      ) {
        continue;
      }
      if (hasConflict(current, section)) continue;

      current.push({
        courseCode,
        courseName: String(course.name ?? ""),
        courseType: String(course.type ?? course.category ?? ""),
        color: String(course.color ?? ""),
        section,
      });
      backtrack(index + 1);
      current.pop();
    }
  }

  backtrack(0);
  const compareSchedules = (first, second) => {
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
  return results.sort(compareSchedules).map(({ schedule }) => schedule);
}

function getBlockStats(schedule) {
  const byDay = Object.fromEntries(KNOWN_DAYS.map((day) => [day, []]));
  for (const item of schedule) {
    const section = item?.section ?? item;
    for (const block of sectionBlocks(section)) {
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
  const allStarts = [];
  const allEnds = [];

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

function toMinutes(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 60);
  }
  const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(String(value ?? "").trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function asDays(value) {
  if (Array.isArray(value)) return value;
  if (typeof value?.day === "string") return [value.day];
  return typeof value?.days === "string" ? [value.days] : [];
}

function getMeetingBlocks(meeting) {
  if (Array.isArray(meeting?.blocks) && meeting.blocks.length > 0) {
    return meeting.blocks.flatMap((b) => {
      const days = (b.days ?? []).map(normalizeDayKey).filter(Boolean);
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
  const days = asDays(meeting).map(normalizeDayKey).filter(Boolean);
  if (start !== null && end !== null && end > start && days.length > 0) {
    return [{ days, start, end }];
  }
  return [];
}

function hasMeetingConflict(candidate, assigned) {
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

function normalizeCandidates(course, constraints) {
  const offDays = new Set(
    (constraints.offDays ?? []).map(normalizeDayKey).filter(Boolean),
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

function getMeetingStats(schedule) {
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
  const format = (minutes) =>
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
export function getStats(schedule = []) {
  const entries = Array.isArray(schedule)
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
export function solveSchedule(courses, constraints = {}) {
  const maxResults = Math.max(1, Math.min(100, constraints.maxResults ?? 16));
  const nodeLimit = Math.max(1, constraints.nodeLimit ?? 50000);
  const maxWorkDays = Number.isInteger(constraints.maxWorkDays)
    ? Math.max(1, Math.min(6, constraints.maxWorkDays))
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

  const schedules = [];
  const assigned = [];
  let exploredNodes = 0;
  let truncated = false;

  function visit(index) {
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
