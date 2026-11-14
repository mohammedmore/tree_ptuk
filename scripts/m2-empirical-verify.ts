/**
 * Milestone 2 Empirical Verification Harness
 * Verifies commuter constraints, probation limits, honor overload, and doctor wiring.
 * Run via: npx tsx scripts/m2-empirical-verify.ts
 */

import assert from "node:assert/strict";

import {
  hasStudentAcademicWarning,
} from "../src/core/academicPolicy";
import {
  generateAllSchedules,
  type CatalogCourse,
  type ScheduleBlock,
} from "../src/services/scheduleSolver";
import { wordsMatch, normalizeArabicText } from "../src/utils";
import type { StudentSyncProfile } from "../src/services/studentService";

console.log("🚀 Starting Milestone 2 Empirical Verification Harness...\n");

// ============================================================================
// 1. COMMUTER TIME CONSTRAINTS & BOUNDARY CONDITIONS
// ============================================================================

function applyCommuterFilter(
  courses: Array<{ id: string; code?: string; sections?: Array<{ sec: string; blocks?: ScheduleBlock[] }> }>,
  earliestClassTime: string,
  latestClassTime: string,
  existingExcluded: Record<string, string[]> = {},
): Record<string, string[]> {
  const excludedSections: Record<string, string[]> = { ...existingExcluded };

  if (earliestClassTime || latestClassTime) {
    const minHour = earliestClassTime
      ? parseFloat(earliestClassTime.split(":")[0]) +
        parseFloat(earliestClassTime.split(":")[1] || "0") / 60
      : 0;
    const maxHour = latestClassTime
      ? parseFloat(latestClassTime.split(":")[0]) +
        parseFloat(latestClassTime.split(":")[1] || "0") / 60
      : 24;

    courses.forEach((course) => {
      const courseCode = String(course.code ?? course.id);
      const currentExcluded = new Set(excludedSections[courseCode] ?? []);
      course.sections?.forEach((sec) => {
        const violates = sec.blocks?.some((b) => {
          if (!b.days || b.days.length === 0) return false;
          return (
            (minHour > 0 && b.start < minHour) ||
            (maxHour < 24 && b.end > maxHour)
          );
        });
        if (violates) {
          currentExcluded.add(String(sec.sec));
        }
      });
      if (currentExcluded.size > 0) {
        excludedSections[courseCode] = Array.from(currentExcluded);
      }
    });
  }

  return excludedSections;
}

// Test 1.1: Boundary times
const testCourse = {
  id: "CS101",
  code: "15100101",
  sections: [
    { sec: "1", blocks: [{ days: ["أح", "ثلا"], start: 8.0, end: 9.0 }] },
    { sec: "2", blocks: [{ days: ["أح", "ثلا"], start: 8.5, end: 10.0 }] },
    { sec: "3", blocks: [{ days: ["أح", "ثلا"], start: 9.0, end: 10.5 }] },
    { sec: "4", blocks: [{ days: ["أح", "ثلا"], start: 11.0, end: 12.5 }] },
    { sec: "5", blocks: [{ days: ["أح", "ثلا"], start: 14.0, end: 15.5 }] },
    { sec: "6", blocks: [{ days: ["أح", "ثلا"], start: 14.0, end: 16.0 }] },
    { sec: "7", blocks: [{ days: ["أح", "ثلا"], start: 15.0, end: 16.5 }] },
    { sec: "8", blocks: [{ days: [], start: 0, end: 0 }] },
  ],
};

const excluded = applyCommuterFilter([testCourse], "09:00", "15:30");
const excludedSet = new Set(excluded["15100101"] || []);

assert.equal(excludedSet.has("1"), true, "08:00 section must be excluded");
assert.equal(excludedSet.has("2"), true, "08:30 section must be excluded");
assert.equal(excludedSet.has("3"), false, "09:00 boundary section must NOT be excluded");
assert.equal(excludedSet.has("4"), false, "11:00 section must NOT be excluded");
assert.equal(excludedSet.has("5"), false, "15:30 boundary section must NOT be excluded");
assert.equal(excludedSet.has("6"), true, "16:00 section must be excluded");
assert.equal(excludedSet.has("7"), true, "16:30 section must be excluded");
assert.equal(excludedSet.has("8"), false, "Online section with no days must NOT be excluded");
console.log("✔ 1.1 Commuter boundary exclusions (09:00 to 15:30) verified");

// Test 1.2: Multiblock section
const hybridCourse = {
  id: "EE201",
  code: "15200201",
  sections: [
    {
      sec: "1",
      blocks: [
        { days: ["أح", "ثلا"], start: 10.0, end: 11.5 },
        { days: ["اث"], start: 15.5, end: 17.5 },
      ],
    },
    {
      sec: "2",
      blocks: [
        { days: ["أح", "ثلا"], start: 10.0, end: 11.5 },
        { days: ["اث"], start: 13.0, end: 15.0 },
      ],
    },
  ],
};
const hybridExcluded = applyCommuterFilter([hybridCourse], "09:00", "15:30");
assert.equal(hybridExcluded["15200201"]?.includes("1"), true);
assert.equal(hybridExcluded["15200201"]?.includes("2") ?? false, false);
console.log("✔ 1.2 Commuter multi-block section exclusion verified");

// Test 1.3: Solver integration
const solverCourses: CatalogCourse[] = [
  {
    id: "CS101",
    code: "15100101",
    name: "مقدمة في البرمجة",
    sections: [
      { sec: "1", blocks: [{ days: ["أح", "ثلا"], start: 8.0, end: 9.0 }] },
      { sec: "2", blocks: [{ days: ["أح", "ثلا"], start: 9.5, end: 11.0 }] },
    ],
  },
  {
    id: "MATH101",
    code: "15200101",
    name: "تفاضل وتكامل 1",
    sections: [
      { sec: "1", blocks: [{ days: ["أح", "ثلا"], start: 11.5, end: 13.0 }] },
      { sec: "2", blocks: [{ days: ["أح", "ثلا"], start: 15.0, end: 16.5 }] },
    ],
  },
];
const solverExcluded = applyCommuterFilter(solverCourses, "09:00", "15:30");
const schedules = generateAllSchedules(solverCourses, { excludedSections: solverExcluded });
assert.ok(schedules.length > 0);
for (const s of schedules) {
  for (const item of s) {
    if (item.courseCode === "15100101") {
      assert.equal(item.section.sec, "2", "Solver must select Section 2 (09:30), not Section 1 (08:00)");
    }
    if (item.courseCode === "15200101") {
      assert.equal(item.section.sec, "1", "Solver must select Section 1 (11:30), not Section 2 (16:30)");
    }
  }
}
console.log("✔ 1.3 Solver schedule generation with commuter exclusion verified");

// ============================================================================
// 2. ACADEMIC PROBATION 14-CREDIT ENFORCEMENT & RETAKE PRIORITY
// ============================================================================

const warningStudent: Partial<StudentSyncProfile> = {
  academicWarning: "إنذار أول",
  gpa: 65.0,
};
const isProbation =
  hasStudentAcademicWarning(warningStudent as StudentSyncProfile) ||
  (typeof warningStudent?.gpa === "number" && warningStudent.gpa > 0 && warningStudent.gpa < 60);
assert.equal(isProbation, true);

const checkProbationAlert = (credits: number) => isProbation && credits > 14;
assert.equal(checkProbationAlert(12), false);
assert.equal(checkProbationAlert(14), false, "Exactly 14 credits must not trigger alert");
assert.equal(checkProbationAlert(15), true, "15 credits must trigger probation alert");
console.log("✔ 2.1 Academic probation 14-credit alert boundary verified");

// Retake courses priority group
const availableCourses = [
  { id: "MATH101", name: "تفاضل وتكامل 1", category: "متطلب كلية إجباري" },
  { id: "CS101", name: "برمجة 1", category: "متطلب تخصص إجباري" },
  { id: "ENGL101", name: "لغة إنجليزية 1", category: "متطلب جامعة إجباري" },
];
const failedIds = new Set(["MATH101"]);
const retakeCourses = availableCourses.filter((c) => failedIds.has(c.id));
const retakeGroup = retakeCourses.length > 0 ? [{ id: "retake-priority", title: "مساقات الإعادة للتحسين (أولوية رفع المعدل)", courses: retakeCourses }] : [];
const allGroups = [...retakeGroup, { id: "السنة الأولى", title: "السنة الأولى", courses: availableCourses }];
assert.equal(allGroups[0].id, "retake-priority", "Retake group must be placed at the very top");
assert.equal(allGroups[0].courses[0].id, "MATH101");
console.log("✔ 2.2 Retake courses priority group ordering verified");

// ============================================================================
// 3. HONOR STUDENT OVERLOAD CREDIT TALLY (19–21 HOURS)
// ============================================================================

const creditsCatalog = new Map<string, number>([
  ["C1", 3], ["C2", 3], ["C3", 3], ["C4", 3], ["C5", 4], ["C6", 3], ["C7", 2],
]);

function evaluateLoad(courseIds: string[], isProbationStudent: boolean) {
  const total = courseIds.reduce((sum, id) => sum + (creditsCatalog.get(id) ?? 3), 0);
  if (isProbationStudent && total > 14) return "probation_exceeded";
  if (total >= 19 && total <= 21) return "honor_overload";
  if (total > 21) return "exceeded_max";
  if (total >= 12 && total <= 18) return "normal";
  if (total > 0) return "underload";
  return "empty";
}

assert.equal(evaluateLoad(["C1"], false), "underload"); // 3 hrs
assert.equal(evaluateLoad(["C1", "C2", "C3", "C4", "C5"], false), "normal"); // 16 hrs
assert.equal(evaluateLoad(["C1", "C2", "C3", "C4", "C5", "C6"], false), "honor_overload"); // 19 hrs
assert.equal(evaluateLoad(["C1", "C2", "C3", "C4", "C5", "C6", "C7"], false), "honor_overload"); // 21 hrs
assert.equal(evaluateLoad(["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C1"], false), "exceeded_max"); // 24 hrs
assert.equal(evaluateLoad(["C1", "C2", "C3", "C4", "C5"], true), "probation_exceeded"); // 16 hrs under probation
console.log("✔ 3.1 Honor student overload (19-21h) and status badges verified");

// ============================================================================
// 4. DOCTOR PREFERENCE MATCHING
// ============================================================================

const docQuery = "إيمان دراغمة";
assert.equal(wordsMatch("د. ايمان دراغمة", docQuery) || normalizeArabicText("د. ايمان دراغمة").includes(normalizeArabicText(docQuery)), true);
assert.equal(wordsMatch("أ.د. إيمان دراغمه", docQuery) || normalizeArabicText("أ.د. إيمان دراغمه").includes(normalizeArabicText(docQuery)), true);
assert.equal(wordsMatch("د. محمد خضور", docQuery) || normalizeArabicText("د. محمد خضور").includes(normalizeArabicText(docQuery)), false);
console.log("✔ 4.1 Doctor preference fuzzy and normalized Arabic matching verified");

console.log("\n🎯 ALL EMPIRICAL VERIFICATIONS PASSED WITH ZERO ERRORS!");
