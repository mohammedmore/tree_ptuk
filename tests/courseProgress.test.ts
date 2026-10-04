import assert from "node:assert/strict";
import { test } from "node:test";
import {
  markCoursesCompleted,
  toggleCompletedCourse,
} from "../src/courseProgress";

test("toggling a course changes only that course and preserves the input set", () => {
  const completed = new Set(["prerequisite", "other"]);

  const next = toggleCompletedCourse(completed, "course");

  assert.deepEqual([...next], ["prerequisite", "other", "course"]);
  assert.deepEqual([...completed], ["prerequisite", "other"]);
});

test("uncompleting a prerequisite does not erase completed dependent courses", () => {
  const completed = new Set(["prerequisite", "dependent"]);

  const next = toggleCompletedCourse(completed, "prerequisite");

  assert.deepEqual([...next], ["dependent"]);
});

test("marking a semester completed marks only its planned courses", () => {
  const completed = new Set(["existing"]);

  const next = markCoursesCompleted(completed, ["planned", "another-planned"]);

  assert.deepEqual([...next], ["existing", "planned", "another-planned"]);
  assert.deepEqual([...completed], ["existing"]);
});
