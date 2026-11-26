import test from "node:test";
import assert from "node:assert/strict";
import { buildCourseYearGroups } from "../src/core/courseCatalogGrouping";
import { categoryRequirements, courses } from "../src/data";
import type { Course } from "../src/data";

const sampleCourses: Course[] = [
  {
    id: "REQ101",
    name: "متطلب أول",
    prerequisites: [],
    credits: 3,
    category: "متطلب تخصص إجباري",
    semester: "السنة الأولى - الفصل الأول",
  },
  {
    id: "REQ102",
    name: "متطلب ثان",
    prerequisites: [],
    credits: 4,
    category: "متطلب تخصص إجباري",
    semester: "السنة الأولى - الفصل الثاني",
  },
  {
    id: "15200099",
    name: "متطلب استدراكي",
    prerequisites: [],
    credits: 3,
    category: "متطلب استدراكي إجباري",
    semester: "السنة الأولى - الفصل الأول",
  },
  ...["ELEC01", "ELEC02", "ELEC03"].map((id): Course => ({
    id,
    name: `اختياري ${id}`,
    prerequisites: [],
    credits: 3,
    category: "متطلب جامعة اختياري",
    semester: "السنة الأولى - الفصل الأول",
  })),
];

test("year groups show semester totals and do not inflate years with elective options", () => {
  const completedCourseIds = new Set(
    sampleCourses
      .filter(
        (course) =>
          course.id.startsWith("ELEC") || course.category.includes("استدراكي"),
      )
      .map((course) => course.id),
  );
  const groups = buildCourseYearGroups(
    sampleCourses,
    sampleCourses,
    completedCourseIds,
    {
      "متطلب استدراكي إجباري": 3,
      "متطلب جامعة اختياري": 6,
    },
  );

  assert.equal(groups[0].id, "year-1");
  assert.equal(groups[0].totalCredits, 7);
  assert.deepEqual(
    groups[0].semesterGroups.map((semester) => semester.totalCredits),
    [3, 4],
  );
  assert.equal(
    groups[0].courses.some((course) => course.id === "15200099"),
    false,
  );

  const remedialGroup = groups.find((group) => group.id === "remedial");
  assert.ok(remedialGroup);
  assert.equal(remedialGroup.totalCredits, 3);
  assert.equal(remedialGroup.completedCredits, 3);
  assert.equal(remedialGroup.semesterGroups.length, 0);
  assert.equal(remedialGroup.courses[0].id, "15200099");

  const electiveGroup = groups[groups.length - 1];
  assert.equal(electiveGroup.id, "electives");
  assert.equal(electiveGroup.courses.length, 3);
  assert.equal(electiveGroup.totalCredits, 6);
  assert.equal(electiveGroup.completedCredits, 6);
});

test("official plan keeps year-one totals and separates elective and remedial requirements", () => {
  const groups = buildCourseYearGroups(
    courses,
    courses,
    new Set(),
    categoryRequirements,
  );
  const yearOne = groups.find((group) => group.id === "year-1");
  const remedialGroup = groups.find((group) => group.id === "remedial");
  const electiveGroup = groups.find((group) => group.id === "electives");

  assert.ok(yearOne);
  assert.deepEqual(
    yearOne.semesterGroups.map((semester) => semester.totalCredits),
    [15, 15],
  );
  assert.ok(remedialGroup);
  assert.equal(remedialGroup.totalCredits, 3);
  assert.equal(remedialGroup.semesterGroups.length, 0);
  assert.ok(electiveGroup);
  assert.equal(electiveGroup.totalCredits, 21);
});
