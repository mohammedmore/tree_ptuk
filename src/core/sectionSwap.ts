import type { ScheduleEntry, Course } from "../data";
import type { CatalogSection } from "../services/scheduleSolver";
import { normalizeDayKey, hasConflict } from "../services/scheduleSolver";
import { parseTimeToMinutes as parseSafeMinutes } from "./scheduleTimeParser";

export interface SwapAnalysis {
  isAlreadyEnrolledInCourse: boolean;
  isSameSection: boolean;
  currentSectionNumber?: string;
  targetSectionNumber: string;
  canSwap: boolean;
  hasConflictWithOtherCourses: boolean;
  conflictingCourseId?: string;
  conflictingCourseName?: string;
  conflictingDay?: string;
  conflictingTime?: string;
}

function parseTimeToMinutes(timeVal: string | number | undefined): number {
  return parseSafeMinutes(timeVal) ?? 0;
}

/**
 * Normalizes section blocks into standard solver blocks for conflict checking
 */
function sectionToBlocks(section: CatalogSection): Array<{
  days: string[];
  start: number;
  end: number;
}> {
  if (Array.isArray(section.blocks) && section.blocks.length > 0) {
    return section.blocks.map((b) => ({
      days: (b.days || []).map(normalizeDayKey).filter(Boolean) as string[],
      start: parseTimeToMinutes(b.start),
      end: parseTimeToMinutes(b.end),
    }));
  }
  return [];
}

/**
 * Normalizes a ScheduleEntry from weeklySchedule into solver blocks
 */
function scheduleEntryToBlocks(entry: ScheduleEntry): Array<{
  days: string[];
  start: number;
  end: number;
}> {
  const rawDays =
    entry.days && entry.days.length > 0
      ? entry.days
      : entry.day
        ? [entry.day]
        : [];
  const days = rawDays.map(normalizeDayKey).filter(Boolean) as string[];
  return [
    {
      days,
      start: parseTimeToMinutes(entry.startTime),
      end: parseTimeToMinutes(entry.endTime),
    },
  ];
}

/**
 * Analyzes whether a target section can be swapped cleanly into the student's current weekly schedule
 * without introducing time clashes with any other course.
 */
export function analyzeSectionSwap(
  courseId: string,
  targetSection: CatalogSection,
  currentSchedule: Record<string, ScheduleEntry>,
  coursesById: Map<string, Course>,
): SwapAnalysis {
  const currentEntry = currentSchedule[courseId];
  const targetSecNum = String(targetSection.sec).trim();

  if (!currentEntry) {
    return {
      isAlreadyEnrolledInCourse: false,
      isSameSection: false,
      targetSectionNumber: targetSecNum,
      canSwap: false,
      hasConflictWithOtherCourses: false,
    };
  }

  const currentSecNum = String(currentEntry.section || "").trim();
  if (currentSecNum === targetSecNum) {
    return {
      isAlreadyEnrolledInCourse: true,
      isSameSection: true,
      currentSectionNumber: currentSecNum,
      targetSectionNumber: targetSecNum,
      canSwap: false,
      hasConflictWithOtherCourses: false,
    };
  }

  // Check conflicts with all other courses in currentSchedule
  const targetBlocks = sectionToBlocks(targetSection);
  let conflictingCourseId: string | undefined;
  let conflictingCourseName: string | undefined;
  let conflictingDay: string | undefined;
  let conflictingTime: string | undefined;
  let conflictFound = false;

  for (const [otherId, otherEntry] of Object.entries(currentSchedule)) {
    if (otherId === courseId) continue; // Exclude the course being replaced

    const otherBlocks = scheduleEntryToBlocks(otherEntry);
    const mockSec1 = { sec: targetSecNum, blocks: targetBlocks };
    const mockSec2 = { sec: otherEntry.section || "1", blocks: otherBlocks };

    if (hasConflict([mockSec2], mockSec1)) {
      conflictFound = true;
      conflictingCourseId = otherId;
      conflictingCourseName = coursesById.get(otherId)?.name || otherId;
      conflictingDay = otherBlocks[0]?.days[0] || otherEntry.day;
      conflictingTime = `${otherEntry.startTime} - ${otherEntry.endTime}`;
      break;
    }
  }

  return {
    isAlreadyEnrolledInCourse: true,
    isSameSection: false,
    currentSectionNumber: currentSecNum,
    targetSectionNumber: targetSecNum,
    canSwap: !conflictFound,
    hasConflictWithOtherCourses: conflictFound,
    conflictingCourseId,
    conflictingCourseName,
    conflictingDay,
    conflictingTime,
  };
}

function formatScheduleTime(
  hour: number | string | undefined,
  defaultTime = "08:00",
): string {
  if (hour === undefined || hour === null) return defaultTime;
  if (typeof hour === "string") {
    if (hour.includes(":")) return hour;
    const parsed = parseFloat(hour);
    if (!isNaN(parsed)) hour = parsed;
    else return defaultTime;
  }
  if (typeof hour === "number" && !isNaN(hour)) {
    const totalMinutes = Math.max(
      0,
      Math.min(1439, Math.round(hour >= 60 ? hour : hour * 60)),
    );
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return defaultTime;
}

/**
 * Builds a ScheduleEntry drop-in object from a CatalogSection
 */
export function buildScheduleEntryFromSection(
  section: CatalogSection,
): ScheduleEntry {
  const firstBlock =
    Array.isArray(section.blocks) && section.blocks.length > 0
      ? section.blocks[0]
      : undefined;
  const rawDays = firstBlock?.days || [];
  const primaryDay = rawDays[0] || "الأحد";

  return {
    section: String(section.sec),
    instructor: section.instructor || "غير محدد",
    room: section.room || "غير محددة",
    day: primaryDay,
    days: rawDays,
    startTime: formatScheduleTime(firstBlock?.start, "08:00"),
    endTime: formatScheduleTime(firstBlock?.end, "09:15"),
  };
}
