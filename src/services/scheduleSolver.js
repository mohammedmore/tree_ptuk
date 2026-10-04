const KNOWN_DAYS = ["سب", "أح", "اث", "ثلا", "ار", "خمـ"];

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

/**
 * Returns true when any block in the proposed section overlaps an assigned
 * section on at least one shared day.
 */
export function hasConflict(schedule, newSection) {
  const candidateBlocks = sectionBlocks(newSection);
  if (!Array.isArray(schedule) || candidateBlocks.length === 0) return true;

  for (const selected of schedule) {
    const assignedBlocks = sectionBlocks(selected?.section);
    for (const assignedBlock of assignedBlocks) {
      for (const candidateBlock of candidateBlocks) {
        if (
          !Number.isFinite(assignedBlock.start) ||
          !Number.isFinite(assignedBlock.end) ||
          !Number.isFinite(candidateBlock.start) ||
          !Number.isFinite(candidateBlock.end) ||
          assignedBlock.end <= assignedBlock.start ||
          candidateBlock.end <= candidateBlock.start
        ) {
          return true;
        }

        const sharedDay = assignedBlock.days?.some((day) =>
          candidateBlock.days?.includes(day),
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
  const offDays = new Set(filters.freeDays ?? []);
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
        (filters.freeDays ?? []).length > 0 &&
        sectionBlocks(section).some((block) =>
          block.days?.some((day) => offDays.has(day)),
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
    for (const block of sectionBlocks(item.section)) {
      for (const day of block.days ?? []) {
        (byDay[day] ??= []).push({ start: block.start, end: block.end });
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
    const orderedBlocks = [...blocks].sort(
      (first, second) => first.start - second.start,
    );
    maxClasses = Math.max(maxClasses, orderedBlocks.length);
    if (orderedBlocks.length === 0) continue;

    const span =
      orderedBlocks[orderedBlocks.length - 1].end - orderedBlocks[0].start;
    const teaching = orderedBlocks.reduce(
      (total, block) => total + block.end - block.start,
      0,
    );
    totalGap += Math.max(0, span - teaching);
    for (let index = 1; index < orderedBlocks.length; index += 1) {
      maxGap = Math.max(
        maxGap,
        orderedBlocks[index].start - orderedBlocks[index - 1].end,
      );
    }
    allStarts.push(orderedBlocks[0].start);
    allEnds.push(orderedBlocks[orderedBlocks.length - 1].end);
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
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function asDays(value) {
  if (Array.isArray(value)) return value;
  if (typeof value?.day === "string") return [value.day];
  return typeof value?.days === "string" ? [value.days] : [];
}

function hasMeetingConflict(candidate, assigned) {
  const candidateStart = toMinutes(candidate.startTime);
  const candidateEnd = toMinutes(candidate.endTime);
  if (
    candidateStart === null ||
    candidateEnd === null ||
    candidateEnd <= candidateStart
  ) {
    return true;
  }

  return assigned.some((entry) => {
    const assignedStart = toMinutes(entry.startTime);
    const assignedEnd = toMinutes(entry.endTime);
    if (
      assignedStart === null ||
      assignedEnd === null ||
      assignedEnd <= assignedStart
    ) {
      return true;
    }
    return (
      asDays(candidate).some((day) => asDays(entry).includes(day)) &&
      candidateStart < assignedEnd &&
      assignedStart < candidateEnd
    );
  });
}

function normalizeCandidates(course, constraints) {
  const offDays = new Set(constraints.offDays ?? []);
  const startLimit = toMinutes(constraints.preferredStart);
  const endLimit = toMinutes(constraints.preferredEnd);
  const candidates = course.options ?? course.candidates ?? [];

  return candidates.filter((candidate) => {
    const days = asDays(candidate);
    const start = toMinutes(candidate.startTime);
    const end = toMinutes(candidate.endTime);
    return (
      days.length > 0 &&
      days.every((day) => !offDays.has(day)) &&
      start !== null &&
      end !== null &&
      end > start &&
      (startLimit === null || start >= startLimit) &&
      (endLimit === null || end <= endLimit)
    );
  });
}

function getMeetingStats(schedule) {
  const validTimes = schedule
    .map((entry) => ({
      start: toMinutes(entry.startTime),
      end: toMinutes(entry.endTime),
    }))
    .filter(({ start, end }) => start !== null && end !== null && end > start);
  const daySet = new Set(schedule.flatMap(asDays));
  const totalMinutes = validTimes.reduce(
    (total, { start, end }) => total + end - start,
    0,
  );
  const earliest = validTimes.length
    ? Math.min(...validTimes.map(({ start }) => start))
    : null;
  const latest = validTimes.length
    ? Math.max(...validTimes.map(({ end }) => end))
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
    ? Math.max(1, Math.min(5, constraints.maxWorkDays))
    : 5;
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

      const days = new Set([
        ...assigned.flatMap(({ option: assignedOption }) =>
          asDays(assignedOption),
        ),
        ...asDays(option),
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
