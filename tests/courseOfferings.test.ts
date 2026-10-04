import assert from "node:assert/strict";
import { test } from "node:test";
import { SEMESTERS } from "../src/constants";
import {
  courseOfferingsByID,
  getAvailableSemesters,
  getSemesterType,
  isCourseAvailableInSemester,
} from "../src/courseOfferings";
import { courses } from "../src/data";

test("uses catalog availability as the single source of course offerings", () => {
  const expected = Object.fromEntries(
    courses.flatMap((course) =>
      course.availableSemesters ? [[course.id, course.availableSemesters]] : [],
    ),
  );

  assert.deepEqual(courseOfferingsByID, expected);
});

test("unknown course ids do not resolve inherited object properties as offerings", () => {
  assert.equal(getAvailableSemesters("toString"), undefined);
  assert.equal(isCourseAvailableInSemester("toString", "first"), true);
});

test("maps valid semester names and rejects unknown names", () => {
  assert.deepEqual(
    SEMESTERS.map(getSemesterType),
    SEMESTERS.map((_, index) => ["first", "second", "summer"][index % 3]),
  );
  assert.equal(getSemesterType("not a semester"), null);
});

test("unknown semester values are not treated as an available semester", () => {
  assert.equal(isCourseAvailableInSemester("12140205", "fall"), false);
});
