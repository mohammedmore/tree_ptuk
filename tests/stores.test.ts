import assert from "node:assert/strict";
import { test } from "node:test";
import { useUIStore } from "../src/stores/useUIStore";
import { useAcademicStore } from "../src/stores/useAcademicStore";
import { useScheduleStore } from "../src/stores/useScheduleStore";

test("useUIStore manages modal visibility and can batch close all modals", () => {
  const store = useUIStore.getState();

  assert.equal(store.isExportModalOpen, false);
  store.setExportModalOpen(true);
  assert.equal(useUIStore.getState().isExportModalOpen, true);

  store.setWeeklyScheduleModalOpen(true);
  store.setCalendarModalOpen(true);
  store.setSystemHealthModalOpen(true);

  assert.equal(useUIStore.getState().isWeeklyScheduleModalOpen, true);
  assert.equal(useUIStore.getState().isCalendarModalOpen, true);
  assert.equal(useUIStore.getState().isSystemHealthModalOpen, true);

  // Close all
  store.closeAllModals();
  const stateAfter = useUIStore.getState();
  assert.equal(stateAfter.isExportModalOpen, false);
  assert.equal(stateAfter.isWeeklyScheduleModalOpen, false);
  assert.equal(stateAfter.isCalendarModalOpen, false);
  assert.equal(stateAfter.isSystemHealthModalOpen, false);
});

test("useAcademicStore handles course completion, planning, and unplanning", () => {
  const store = useAcademicStore.getState();
  const testCourseId = "12140101";

  // Toggle complete
  store.toggleCompleteCourse(testCourseId);
  assert.ok(
    useAcademicStore.getState().completedCourses.has(testCourseId),
    "Course should be completed",
  );

  // Toggle again to uncomplete
  store.toggleCompleteCourse(testCourseId);
  assert.ok(
    !useAcademicStore.getState().completedCourses.has(testCourseId),
    "Course should be uncompleted",
  );

  // Plan course
  store.planCourse(testCourseId, "السنة الأولى - الفصل الأول");
  assert.equal(
    useAcademicStore.getState().plannedCourses[testCourseId],
    "السنة الأولى - الفصل الأول",
  );

  // Unplan course
  store.unplanCourse(testCourseId);
  assert.equal(
    useAcademicStore.getState().plannedCourses[testCourseId],
    undefined,
  );
});

test("useScheduleStore adds entries, manages drafts and tracked seats", () => {
  const store = useScheduleStore.getState();

  // Add schedule entry
  store.setScheduleEntry("أح", "08:00 - 09:00", {
    startTime: "08:00",
    endTime: "09:00",
    section: "1",
    instructor: "د. أحمد",
  });

  assert.ok(useScheduleStore.getState().weeklySchedule["أح"]);
  assert.equal(
    useScheduleStore.getState().weeklySchedule["أح"]["08:00 - 09:00"].section,
    "1",
  );

  // Track seat
  store.addTrackedSeat({
    courseCode: "12140101",
    courseName: "برمجة متقدمة",
    sec: "2",
    isFull: true,
    trackedAt: new Date().toISOString(),
  });

  assert.equal(useScheduleStore.getState().trackedSeats.length, 1);
  assert.equal(
    useScheduleStore.getState().trackedSeats[0].courseCode,
    "12140101",
  );

  // Remove tracked seat
  store.removeTrackedSeat("12140101", "2");
  assert.equal(useScheduleStore.getState().trackedSeats.length, 0);

  // Clear schedule
  store.clearWeeklySchedule();
  assert.deepEqual(useScheduleStore.getState().weeklySchedule, {});
});
