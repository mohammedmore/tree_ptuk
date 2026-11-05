import test from "node:test";
import assert from "node:assert/strict";
import type { Course } from "../src/data.js";
import {
  calculateCurriculumCriticalPath,
  simulateCourseDelayImpact,
  recommendOptimalUpcomingSemester,
  simulateGpaForecast,
} from "../src/core/academicAdvisor.js";

// Realistic curriculum fixture with genuine prerequisites
const mockCourses: Course[] = [
  {
    id: "15200101",
    name: "برمجة 1",
    credits: 3,
    prerequisites: [],
    category: "إجباري تخصص",
  },
  {
    id: "15200102",
    name: "برمجة 2",
    credits: 3,
    prerequisites: ["15200101"],
    category: "إجباري تخصص",
  },
  {
    id: "15200211",
    name: "هياكل بيانات",
    credits: 3,
    prerequisites: ["15200102"],
    category: "إجباري تخصص",
  },
  {
    id: "15200321",
    name: "خوارزميات",
    credits: 3,
    prerequisites: ["15200211"],
    category: "إجباري تخصص",
  },
  {
    id: "15200491",
    name: "مشروع تخرج 1",
    credits: 2,
    prerequisites: ["15200321"],
    category: "إجباري تخصص",
  },
  {
    id: "11100101",
    name: "لغة عربية 1",
    credits: 3,
    prerequisites: [],
    category: "إجباري جامعة",
  },
  {
    id: "11100102",
    name: "لغة إنجليزية 1",
    credits: 3,
    prerequisites: [],
    category: "إجباري جامعة",
  },
  {
    id: "11100201",
    name: "دراسات فلسطينية",
    credits: 3,
    prerequisites: [],
    category: "اختياري جامعة",
  },
];

test("academicAdvisor: calculateCurriculumCriticalPath calculates depth and identifies bottlenecks", () => {
  const completed = new Set<string>();
  const report = calculateCurriculumCriticalPath(mockCourses, completed);

  assert.equal(report.totalRemainingCredits, 23);
  assert.equal(report.longestPathLength, 5); // 15200101 -> 15200102 -> 15200211 -> 15200321 -> 15200491
  assert.equal(report.criticalPathCourseIds[0], "15200101");

  const prog1 = report.bottlenecks.find((b) => b.courseId === "15200101");
  assert.ok(prog1);
  assert.equal(prog1.chainDepth, 4);
  assert.equal(prog1.allDownstreamDependents.length, 4);
  assert.equal(prog1.isCriticalBottleneck, true);
  assert.equal(prog1.isEligibleToRegister, true);

  const prog2 = report.bottlenecks.find((b) => b.courseId === "15200102");
  assert.ok(prog2);
  assert.equal(prog2.isEligibleToRegister, false); // needs 15200101
});

test("academicAdvisor: simulateCourseDelayImpact correctly evaluates academic risk", () => {
  // 1. Critical bottleneck course
  const impactProg1 = simulateCourseDelayImpact(
    "15200101",
    mockCourses,
    new Set(),
  );
  assert.equal(impactProg1.isCriticalPath, true);
  assert.equal(impactProg1.academicRiskLevel, "CRITICAL");
  assert.ok(impactProg1.estimatedSemesterDelay >= 1);
  assert.equal(impactProg1.directlyBlockedCourses[0].id, "15200102");
  assert.equal(impactProg1.totalDownstreamBlockedCount, 4);

  // 2. Leaf elective course with no dependents
  const impactArabic = simulateCourseDelayImpact(
    "11100101",
    mockCourses,
    new Set(),
  );
  assert.equal(impactArabic.isCriticalPath, false);
  assert.equal(impactArabic.academicRiskLevel, "LOW");
  assert.equal(impactArabic.estimatedSemesterDelay, 0);
  assert.equal(impactArabic.totalDownstreamBlockedCount, 0);
});

test("academicAdvisor: recommendOptimalUpcomingSemester adheres to PTUK credit limits", () => {
  // Normal student: up to 19 credits
  const normalRec = recommendOptimalUpcomingSemester({
    courses: mockCourses,
    completedCourses: new Set(),
    currentGpa: 75,
    academicWarning: false,
  });

  assert.equal(normalRec.creditLimit, 19);
  assert.ok(normalRec.totalCredits <= 19);
  // Programming 1 should be prioritized because it unblocks the entire curriculum
  assert.equal(normalRec.recommendedCourses[0].id, "15200101");

  // Academic Warning student: capped at 14 credits
  const warningRec = recommendOptimalUpcomingSemester({
    courses: mockCourses,
    completedCourses: new Set(),
    currentGpa: 58,
    academicWarning: true,
  });

  assert.equal(warningRec.creditLimit, 14);
  assert.ok(warningRec.totalCredits <= 14);
});

test("academicAdvisor: simulateGpaForecast accurately forecasts GPA and warning status", () => {
  // 1. GPA rising above 60 from warning
  const forecastGood = simulateGpaForecast({
    currentGpa: 58,
    completedHours: 30,
    upcomingCourses: [
      { credits: 3, expectedGrade: 85 },
      { credits: 3, expectedGrade: 90 },
      { credits: 3, expectedGrade: 80 },
    ],
  });

  // (58*30 + 3*85 + 3*90 + 3*80) / 39 = (1740 + 255 + 270 + 240) / 39 = 2505 / 39 = 64.23
  assert.equal(forecastGood.projectedGpa, 64.23);
  assert.equal(forecastGood.hasAcademicWarning, false);
  assert.ok(forecastGood.gpaDifference > 0);

  // 2. GPA dropping into warning (< 60%)
  const forecastBad = simulateGpaForecast({
    currentGpa: 61,
    completedHours: 20,
    upcomingCourses: [
      { credits: 3, expectedGrade: 50 },
      { credits: 3, expectedGrade: 45 },
    ],
  });

  // (61*20 + 3*50 + 3*45) / 26 = (1220 + 150 + 135) / 26 = 1505 / 26 = 57.88
  assert.equal(forecastBad.projectedGpa, 57.88);
  assert.equal(forecastBad.hasAcademicWarning, true);
});
