import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyzeSectionSwap,
  buildScheduleEntryFromSection,
} from "../src/core/sectionSwap";
import type { Course, ScheduleEntry } from "../src/data";
import type { CatalogSection } from "../src/services/scheduleSolver";

const mockCourses: Course[] = [
  {
    id: "101",
    name: "تفاضل وتكامل 1",
    credits: 3,
    prerequisites: [],
    category: "متطلب كلية إجباري",
  },
  {
    id: "102",
    name: "فيزياء عامة 1",
    credits: 3,
    prerequisites: [],
    category: "متطلب كلية إجباري",
  },
  {
    id: "103",
    name: "برمجة 1",
    credits: 3,
    prerequisites: [],
    category: "متطلب كلية إجباري",
  },
];

const coursesById = new Map<string, Course>(mockCourses.map((c) => [c.id, c]));

test("identifies when student is not enrolled in the course", () => {
  const currentSchedule: Record<string, ScheduleEntry> = {
    "102": {
      day: "الأحد",
      days: ["أح", "ثلا"],
      startTime: "08:00",
      endTime: "09:15",
    },
  };

  const targetSec: CatalogSection = {
    sec: "1",
    blocks: [
      {
        days: ["أح", "ثلا"],
        start: 10,
        end: 11.25,
        rawTime: "10:00 - 11:15",
      },
    ],
  };

  const analysis = analyzeSectionSwap(
    "101",
    targetSec,
    currentSchedule,
    coursesById,
  );
  assert.equal(analysis.isAlreadyEnrolledInCourse, false);
  assert.equal(analysis.canSwap, false);
});

test("identifies when target section is the same section student already has", () => {
  const currentSchedule: Record<string, ScheduleEntry> = {
    "101": {
      section: "1",
      day: "الأحد",
      days: ["أح", "ثلا"],
      startTime: "08:00",
      endTime: "09:15",
    },
  };

  const targetSec: CatalogSection = {
    sec: "1",
    blocks: [
      {
        days: ["أح", "ثلا"],
        start: 8,
        end: 9.25,
        rawTime: "08:00 - 09:15",
      },
    ],
  };

  const analysis = analyzeSectionSwap(
    "101",
    targetSec,
    currentSchedule,
    coursesById,
  );
  assert.equal(analysis.isAlreadyEnrolledInCourse, true);
  assert.equal(analysis.isSameSection, true);
  assert.equal(analysis.canSwap, false);
});

test("approves section swap when target section has NO conflict with other courses", () => {
  const currentSchedule: Record<string, ScheduleEntry> = {
    "101": {
      section: "1",
      day: "الأحد",
      days: ["أح", "ثلا"],
      startTime: "08:00",
      endTime: "09:15",
    },
    "102": {
      section: "1",
      day: "الاثنين",
      days: ["اث", "ار"],
      startTime: "09:30",
      endTime: "10:45",
    },
  };

  // Section 2 of 101 is on Mon/Wed at 12:30 - 13:45 (No conflict with 102)
  const targetSec: CatalogSection = {
    sec: "2",
    blocks: [
      {
        days: ["اث", "ار"],
        start: 12.5,
        end: 13.75,
        rawTime: "12:30 - 13:45",
      },
    ],
  };

  const analysis = analyzeSectionSwap(
    "101",
    targetSec,
    currentSchedule,
    coursesById,
  );
  assert.equal(analysis.isAlreadyEnrolledInCourse, true);
  assert.equal(analysis.isSameSection, false);
  assert.equal(analysis.canSwap, true);
  assert.equal(analysis.hasConflictWithOtherCourses, false);
});

test("detects conflict with other course when trying to swap section", () => {
  const currentSchedule: Record<string, ScheduleEntry> = {
    "101": {
      section: "1",
      day: "الأحد",
      days: ["أح", "ثلا"],
      startTime: "08:00",
      endTime: "09:15",
    },
    "102": {
      section: "1",
      day: "الاثنين",
      days: ["اث", "ار"],
      startTime: "10:00",
      endTime: "11:15",
    },
  };

  // Section 3 of 101 overlaps with 102 on Mon/Wed at 10:30 - 11:45
  const targetSec: CatalogSection = {
    sec: "3",
    blocks: [
      {
        days: ["اث", "ار"],
        start: 10.5,
        end: 11.75,
        rawTime: "10:30 - 11:45",
      },
    ],
  };

  const analysis = analyzeSectionSwap(
    "101",
    targetSec,
    currentSchedule,
    coursesById,
  );
  assert.equal(analysis.isAlreadyEnrolledInCourse, true);
  assert.equal(analysis.canSwap, false);
  assert.equal(analysis.hasConflictWithOtherCourses, true);
  assert.equal(analysis.conflictingCourseId, "102");
  assert.equal(analysis.conflictingCourseName, "فيزياء عامة 1");
});

test("buildScheduleEntryFromSection correctly populates schedule entry", () => {
  const targetSec: CatalogSection = {
    sec: "2",
    instructor: "د. أحمد خليل",
    room: "G-101",
    blocks: [
      {
        days: ["أح", "ثلا"],
        start: 8.5,
        end: 10,
        rawTime: "08:30 - 10:00",
      },
    ],
  };

  const entry = buildScheduleEntryFromSection(targetSec);
  assert.equal(entry.section, "2");
  assert.equal(entry.instructor, "د. أحمد خليل");
  assert.equal(entry.room, "G-101");
  assert.equal(entry.startTime, "08:30");
  assert.equal(entry.endTime, "10:00");
  assert.deepEqual(entry.days, ["أح", "ثلا"]);
});
