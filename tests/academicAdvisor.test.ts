import test from "node:test";
import assert from "node:assert/strict";
import type { Course } from "../src/data.js";
import {
  calculateCurriculumCriticalPath,
  simulateCourseDelayImpact,
  recommendOptimalUpcomingSemester,
  simulateGpaForecast,
  generateGraduationRoadmap,
  generateGraduationRoadmapICS,
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

test("academicAdvisor: generateGraduationRoadmap generates valid multi-semester plan without prerequisite violations", () => {
  const result = generateGraduationRoadmap({
    courses: mockCourses,
    completedCourses: new Set(),
    targetCreditsPerSemester: 18,
    includeSummer: false,
  });

  assert.equal(result.totalCurriculumCredits, 23);
  assert.equal(result.completedCredits, 0);
  assert.equal(result.remainingCredits, 23);
  assert.equal(result.isFullyResolved, true);
  assert.equal(result.unresolvedCourses.length, 0);

  // Validate prerequisite progression order:
  // Prog 1 must be in an earlier semester than Prog 2
  // Prog 2 must be in an earlier semester than Data Structures
  // Data Structures must be in an earlier semester than Algorithms
  // Algorithms must be in an earlier semester than Senior Project 1
  const courseSemesterIndex = new Map<string, number>();
  result.semesters.forEach((sem, idx) => {
    sem.courses.forEach((c) => courseSemesterIndex.set(c.id, idx));
  });

  assert.ok(
    courseSemesterIndex.get("15200101")! < courseSemesterIndex.get("15200102")!,
  );
  assert.ok(
    courseSemesterIndex.get("15200102")! < courseSemesterIndex.get("15200211")!,
  );
  assert.ok(
    courseSemesterIndex.get("15200211")! < courseSemesterIndex.get("15200321")!,
  );
  assert.ok(
    courseSemesterIndex.get("15200321")! < courseSemesterIndex.get("15200491")!,
  );

  // Check first semester priority
  const firstSem = result.semesters[0];
  assert.equal(firstSem.semesterLabel, "السنة 1 - الفصل الأول");
  assert.ok(
    firstSem.courses.some((c) => c.id === "15200101"),
    "Programming 1 must be scheduled in Semester 1",
  );
});

test("academicAdvisor: generateGraduationRoadmap enforces summer credit limit of 9 hours", () => {
  const result = generateGraduationRoadmap({
    courses: mockCourses,
    completedCourses: new Set(),
    includeSummer: true,
  });

  const summerSemesters = result.semesters.filter(
    (s) => s.termType === "summer",
  );
  for (const s of summerSemesters) {
    assert.equal(s.maxCredits, 9);
    assert.ok(s.totalCredits <= 9);
  }
});

test("academicAdvisor: generateGraduationRoadmap enforces academic warning limit of 14 hours", () => {
  const result = generateGraduationRoadmap({
    courses: mockCourses,
    completedCourses: new Set(),
    academicWarning: true,
  });

  for (const s of result.semesters) {
    if (s.termType !== "summer") {
      assert.equal(s.maxCredits, 14);
      assert.ok(s.totalCredits <= 14);
    }
  }
});

test("academicAdvisor: generateGraduationRoadmapICS generates valid RFC 5545 iCalendar data", () => {
  const result = generateGraduationRoadmap({
    courses: mockCourses,
    completedCourses: new Set(),
    includeSummer: false,
  });

  const icsData = generateGraduationRoadmapICS(result, {
    majorName: "علم الحاسوب",
    startYear: 2026,
  });

  assert.ok(icsData.startsWith("BEGIN:VCALENDAR"));
  assert.ok(icsData.endsWith("END:VCALENDAR"));
  assert.ok(
    icsData.includes("PRODID:-//PTUK Student Portal//Graduation Roadmap//AR"),
  );
  assert.ok(icsData.includes("X-WR-CALNAME:خطة التخرج - علم الحاسوب"));
  assert.ok(icsData.includes("LOCATION:جامعة فلسطين التقنية - خضوري"));
  assert.ok(
    icsData.includes("🎓 حفل التخرج المتوقع - جامعة فلسطين التقنية (خضوري)"),
  );

  // Must contain an event for each semester
  for (const sem of result.semesters) {
    assert.ok(icsData.includes(sem.semesterLabel));
  }
});
