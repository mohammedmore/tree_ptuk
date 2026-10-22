import assert from "node:assert/strict";
import { test } from "node:test";
import "../server/index.d.ts";
import app from "../server/app.js";
import { getCourses, getMajors, getMajorById, getSyncStatus } from "../server/db.js";
import { authenticateAndSyncStudent } from "../server/services/studentPortalService.js";

test("db.js getCourses returns courses with sections and blocks", async () => {
  const courses = await getCourses();
  assert.ok(Array.isArray(courses));
  assert.ok(courses.length > 0, "Should return seeded courses");

  const cseCourse = courses.find((c: any) => c.code === "12140101");
  assert.ok(cseCourse, "Should find course 12140101");
  assert.ok(Array.isArray(cseCourse.sections));
  assert.ok(cseCourse.sections.length > 0, "Course should have sections");
  assert.ok(Array.isArray(cseCourse.sections[0].blocks), "Section should have blocks");
});

test("db.js getCourses filters by course codes", async () => {
  const filtered = await getCourses({ codes: ["15200099", "13010006"] });
  assert.equal(filtered.length, 2);
  const codes = filtered.map((c: any) => c.code);
  assert.ok(codes.includes("15200099"));
  assert.ok(codes.includes("13010006"));
});

test("db.js getMajors returns all seeded majors with requirements", () => {
  const majors = getMajors();
  assert.ok(Array.isArray(majors));
  assert.ok(majors.length >= 4, "Should have at least 4 majors");

  const majorIds = majors.map((m: any) => m.id);
  assert.ok(majorIds.includes("cse"));
  assert.ok(majorIds.includes("swe"));
  assert.ok(majorIds.includes("cs"));
  assert.ok(majorIds.includes("ee"));

  const cse = getMajorById("cse");
  assert.ok(cse);
  assert.equal(cse.totalCredits, 164);
  assert.ok(Array.isArray(cse.courses));
  assert.ok(cse.courses.length > 50);
});

test("db.js getSyncStatus returns valid tracking metadata", () => {
  const status = getSyncStatus();
  assert.ok(status);
  assert.equal(typeof status.totalCourses, "number");
  assert.ok(status.totalCourses > 0);
  assert.ok(status.lastSyncTime !== null);
});

test("studentPortalService handles demo authentication and generates valid academic profile", async () => {
  const student = await authenticateAndSyncStudent("202110123", "demo", { demoMode: true });
  assert.ok(student);
  assert.equal(student.studentId, "202110123");
  assert.equal(student.majorId, "cse");
  assert.ok(Array.isArray(student.passedCourseIds));
  assert.ok(student.passedCourseIds.length > 10, "Should have passed courses");
  assert.ok(Array.isArray(student.enrolledCourses));
  assert.equal(typeof student.gpa, "number");
});
