import assert from "node:assert/strict";
import { test } from "node:test";
import { getCourseDetails } from "../src/courseExplanations";
import type { Course } from "../src/data";

const makeCourse = (id: string, prerequisites: string[] = []): Course => ({
  id,
  name: "مادة اختبارية",
  prerequisites,
  credits: 3,
  category: "متطلب تخصص إجباري",
});

test("course details reflect completion and direct dependent courses", () => {
  const course = makeCourse("test-course");
  const dependents = [
    makeCourse("dependent-one", [course.id]),
    makeCourse("dependent-two", [course.id]),
  ];
  const detail = getCourseDetails(course, [course, ...dependents], new Set());
  assert.equal(detail.criticality, "high");
  assert.equal(detail.difficulty, 8);
  assert.match(detail.criticalityReason, /2 مواد/);

  const completedDetail = getCourseDetails(
    course,
    [course, ...dependents],
    new Set([course.id]),
  );
  assert.equal(completedDetail.criticality, "low");
  assert.match(completedDetail.advice, /مكتمل/);
});

test("inherited object property names do not resolve as course data", () => {
  const course = makeCourse("constructor");
  const detail = getCourseDetails(course, [course], new Set());

  assert.equal(typeof detail.description, "string");
  assert.match(detail.description, /مادة اختبارية/);
  assert.equal(detail.difficulty, 8);
});
