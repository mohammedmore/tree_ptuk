import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSharedScheduleSnapshot } from "../src/sharedSchedules";

function createSnapshot() {
  return {
    version: 2,
    name: "خطة اختبار",
    exportedAt: "2026-09-30T00:00:00.000Z",
    plannedCourses: {},
    completedCourses: [],
    weeklySchedule: {},
    courses: [],
  };
}

test("rejects shared schedules without required planning data", () => {
  const withoutPlannedCourses = { ...createSnapshot(), plannedCourses: undefined };
  const withoutWeeklySchedule = { ...createSnapshot(), weeklySchedule: undefined };

  assert.equal(normalizeSharedScheduleSnapshot(withoutPlannedCourses), null);
  assert.equal(normalizeSharedScheduleSnapshot(withoutWeeklySchedule), null);
});

test("rejects malformed planned courses and weekly schedule entries", () => {
  const malformedPlans = {
    ...createSnapshot(),
    plannedCourses: { course: 42 },
  };
  const malformedEntries = {
    ...createSnapshot(),
    weeklySchedule: { semester: { course: null } },
  };
  const malformedDays = {
    ...createSnapshot(),
    weeklySchedule: { semester: { course: { days: ["الأحد", 42] } } },
  };

  assert.equal(normalizeSharedScheduleSnapshot(malformedPlans), null);
  assert.equal(normalizeSharedScheduleSnapshot(malformedEntries), null);
  assert.equal(normalizeSharedScheduleSnapshot(malformedDays), null);
});

test("preserves legacy single-day weekly schedule entries", () => {
  const snapshot = {
    ...createSnapshot(),
    weeklySchedule: {
      semester: {
        course: { day: "الأحد" },
      },
    },
  };

  assert.deepEqual(
    normalizeSharedScheduleSnapshot(snapshot)?.weeklySchedule.semester.course.days,
    ["الأحد"],
  );
});
