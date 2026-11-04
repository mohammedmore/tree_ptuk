import assert from "node:assert/strict";
import { test } from "node:test";
import {
  markCoursesCompleted,
  toggleCompletedCourse,
  isRemedialCourse,
  isDegreeCreditBearing,
  calculateDegreeCredits,
  calculatePlannedCredits,
  calculateRemainingCredits,
  calculateProgressPercentage,
  calculateCategoryCredits,
  isCourseAvailable,
  isPrerequisiteSatisfied,
  calculateGPA,
  getAcademicStandingInfo,
  detectPrerequisiteCycles,
  getTransitivePrerequisites,
  computeCriticalPath,
  calculateYearlyProgress,
  getTopRetakeRecommendations,
  REMEDIAL_COURSE_ID,
  COMPUTER_SKILLS_COURSE_ID,
  REMEDIAL_CATEGORY,
} from "../src/core/courseProgress";
import type { Course } from "../src/data";
import {
  courses as realCatalogCourses,
  categoryRequirements,
} from "../src/data";
import { TOTAL_CREDITS } from "../src/constants";

const mockCourses: Course[] = [
  {
    id: "15200099",
    name: "إنجليزي إستدراكي",
    prerequisites: [],
    credits: 3,
    category: "متطلب استدراكي إجباري",
  },
  {
    id: "13010006",
    name: "مهارات الحاسوب وتطبيقاته",
    prerequisites: [],
    credits: 1,
    category: "متطلب جامعة إجباري",
  },
  {
    id: "15200106",
    name: "اللغة الإنجليزية (1)",
    prerequisites: ["15200099"],
    credits: 3,
    category: "متطلب جامعة إجباري",
  },
  {
    id: "11100101",
    name: "تفاوض وتكامل (1)",
    prerequisites: [],
    credits: 3,
    category: "متطلب كلية إجباري",
  },
  {
    id: "11100102",
    name: "تفاوض وتكامل (2)",
    prerequisites: ["11100101"],
    credits: 3,
    category: "متطلب كلية إجباري",
  },
  {
    id: "11100103",
    name: "فيزياء عامة (1)",
    prerequisites: [],
    credits: 3,
    category: "متطلب كلية إجباري",
  },
  {
    id: "11100104",
    name: "مختبر فيزياء عامة (1)",
    prerequisites: [],
    coPrerequisites: ["11100103"],
    credits: 1,
    category: "متطلب كلية إجباري",
  },
  {
    id: "12010101",
    name: "مقدمة في البرمجة",
    prerequisites: [],
    credits: 4,
    category: "متطلب تخصص إجباري",
  },
  {
    id: "12010201",
    name: "هياكل بيانات",
    prerequisites: ["12010101"],
    credits: 4,
    category: "متطلب تخصص إجباري",
  },
  {
    id: "12010301",
    name: "تصميم منطقي",
    prerequisites: [],
    credits: 3,
    category: "متطلب تخصص إجباري",
  },
  {
    id: "12010302",
    name: "مختبر تصميم منطقي",
    prerequisites: [],
    coPrerequisites: ["12010301"],
    credits: 1,
    category: "متطلب تخصص إجباري",
  },
  {
    id: "12010491",
    name: "مشروع تخرج (1)",
    prerequisites: [],
    credits: 1,
    category: "متطلب تخصص إجباري",
    minCredits: 90,
  },
  {
    id: "12010492",
    name: "تدريب هندسي",
    prerequisites: [],
    credits: 2,
    category: "متطلب تخصص إجباري",
    minCredits: 60,
  },
  {
    id: "13020001",
    name: "اللغة العبرية",
    prerequisites: [],
    credits: 2,
    category: "متطلب جامعة اختياري",
  },
  {
    id: "13020002",
    name: "اللغة الفرنسية",
    prerequisites: [],
    credits: 2,
    category: "متطلب جامعة اختياري",
  },
  {
    id: "13020003",
    name: "اللغة الألمانية",
    prerequisites: [],
    credits: 2,
    category: "متطلب جامعة اختياري",
  },
  {
    id: "13020004",
    name: "تاريخ القدس",
    prerequisites: [],
    credits: 2,
    category: "متطلب جامعة اختياري",
  },
];

test("real catalog category requirements sum to TOTAL_CREDITS (164) excluding remedial", () => {
  const degreeTotal = Object.entries(categoryRequirements).reduce(
    (sum, [cat, req]) => {
      if (cat !== REMEDIAL_CATEGORY) {
        return sum + req;
      }
      return sum;
    },
    0,
  );
  assert.equal(degreeTotal, TOTAL_CREDITS);
  assert.equal(degreeTotal, 164);
  assert.equal(categoryRequirements[REMEDIAL_CATEGORY], 3);
});

test("isRemedialCourse and isDegreeCreditBearing identify remedial courses (English and Computer Skills)", () => {
  const englishRemedial = mockCourses.find((c) => c.id === "15200099")!;
  const computerSkills = mockCourses.find((c) => c.id === "13010006")!;
  const standard = mockCourses.find((c) => c.id === "15200106")!;

  assert.equal(isRemedialCourse(englishRemedial), true);
  assert.equal(isRemedialCourse(REMEDIAL_COURSE_ID), true);
  assert.equal(isRemedialCourse("15200099"), true);
  assert.equal(isDegreeCreditBearing(englishRemedial), false);
  assert.equal(isDegreeCreditBearing(REMEDIAL_COURSE_ID), false);
  assert.equal(isDegreeCreditBearing("15200099"), false);

  assert.equal(isRemedialCourse(computerSkills), true);
  assert.equal(isRemedialCourse(COMPUTER_SKILLS_COURSE_ID), true);
  assert.equal(isRemedialCourse("13010006"), true);
  assert.equal(isDegreeCreditBearing(computerSkills), false);
  assert.equal(isDegreeCreditBearing(COMPUTER_SKILLS_COURSE_ID), false);
  assert.equal(isDegreeCreditBearing("13010006"), false);

  assert.equal(isRemedialCourse(standard), false);
  assert.equal(isRemedialCourse("15200106"), false);
  assert.equal(isDegreeCreditBearing(standard), true);
  assert.equal(isDegreeCreditBearing("15200106"), true);
});

test("calculateDegreeCredits excludes both English remedial and Computer Skills from earned total", () => {
  const completed = new Set([
    "15200099",
    "13010006",
    "15200106",
    "11100101",
    "12010101",
  ]);
  const credits = calculateDegreeCredits(mockCourses, completed);
  // 15200106 (3) + 11100101 (3) + 12010101 (4) = 10 cr (remedials 3 cr + 1 cr excluded)
  assert.equal(credits, 10);
});

test("calculatePlannedCredits excludes completed and remedial courses", () => {
  const completed = new Set(["15200101"]);
  const planned = {
    "15200099": "سنة أولى - فصل أول", // Remedial (3 cr)
    "15200106": "سنة أولى - فصل أول", // 3 cr
    "11100101": "سنة أولى - فصل أول", // 3 cr
  };
  const credits = calculatePlannedCredits(mockCourses, completed, planned);
  // 15200106 (3) + 11100101 (3) = 6 cr
  assert.equal(credits, 6);
});

test("calculateRemainingCredits never drops below 0", () => {
  assert.equal(calculateRemainingCredits(0, 164), 164);
  assert.equal(calculateRemainingCredits(100, 164), 64);
  assert.equal(calculateRemainingCredits(164, 164), 0);
  assert.equal(calculateRemainingCredits(170, 164), 0);
});

test("calculateProgressPercentage caps at 100% and handles bounds", () => {
  assert.equal(calculateProgressPercentage(0, 164), 0);
  assert.equal(calculateProgressPercentage(82, 164), 50);
  assert.equal(calculateProgressPercentage(164, 164), 100);
  assert.equal(calculateProgressPercentage(170, 164), 100);
  assert.equal(calculateProgressPercentage(50, 0), 0);
});

test("calculateCategoryCredits computes category totals accurately", () => {
  const completed = new Set(["15200099", "15200106", "11100101", "11100102"]);
  const cats = calculateCategoryCredits(mockCourses, completed);
  assert.equal(cats["متطلب استدراكي إجباري"], 3);
  assert.equal(cats["متطلب جامعة إجباري"], 3);
  assert.equal(cats["متطلب كلية إجباري"], 6);
});

test("isCourseAvailable validates prerequisites correctly", () => {
  const eng2 = mockCourses.find((c) => c.id === "15200106")!; // requires 15200099
  const calc2 = mockCourses.find((c) => c.id === "11100102")!; // requires 11100101

  // Without prereq
  assert.equal(isCourseAvailable(eng2, new Set()), false);
  assert.equal(isCourseAvailable(calc2, new Set()), false);

  // With prereq
  assert.equal(isCourseAvailable(eng2, new Set(["15200099"])), true);
  assert.equal(isCourseAvailable(calc2, new Set(["11100101"])), true);

  // Already completed
  assert.equal(
    isCourseAvailable(eng2, new Set(["15200099", "15200106"])),
    false,
  );
});

test("isCourseAvailable distinguishes permissive discovery vs strict planning co-requisite rules", () => {
  const physLab = mockCourses.find((c) => c.id === "11100104")!; // co-req: 11100103 (Physics 1)

  // 1. Permissive discovery mode: co-req with fulfilled prereqs is available concurrently
  assert.equal(
    isCourseAvailable(physLab, new Set(), mockCourses, {
      coreqMode: "permissive",
    }),
    true,
  );

  // 2. Strict planning mode: co-req not yet in completed or planned is REJECTED
  assert.equal(
    isCourseAvailable(physLab, new Set(), mockCourses, {
      coreqMode: "strict",
    }),
    false,
  );

  // 3. Strict planning mode: co-req planned in current semester is ACCEPTED
  assert.equal(
    isCourseAvailable(physLab, new Set(), mockCourses, {
      currentPlannedCourses: new Set(["11100103"]),
      coreqMode: "strict",
    }),
    true,
  );

  // 4. Strict planning mode: co-req completed in earlier semester is ACCEPTED
  assert.equal(
    isCourseAvailable(physLab, new Set(["11100103"]), mockCourses, {
      coreqMode: "strict",
    }),
    true,
  );
});

test("isCourseAvailable handles multi-semester planning with allPrev co-requisite", () => {
  const logicLab = mockCourses.find((c) => c.id === "12010302")!; // co-req: 12010301

  // Student planned Logic Design in Sem 1 (represented in allPrev for Sem 2)
  const allPrev = new Set(["12010301"]);
  assert.equal(
    isCourseAvailable(logicLab, allPrev, mockCourses, {
      coreqMode: "strict",
    }),
    true,
  );
});

test("isCourseAvailable validates real catalog graduation project credit threshold (120 cr)", () => {
  const gradProject1 = realCatalogCourses.find((c) => c.id === "12140521")!; // مقدمة مشروع تخرج: prereqs ["12110316", "12140418"], minCredits: 120
  const prereqs = new Set(["12110316", "12140418"]);

  // Prereqs met, but only 100 earned credits -> must be false
  assert.equal(
    isCourseAvailable(gradProject1, prereqs, realCatalogCourses, {
      cumulativeEarnedCredits: 100,
    }),
    false,
  );

  // Prereqs met, and 122 earned credits -> must be true
  assert.equal(
    isCourseAvailable(gradProject1, prereqs, realCatalogCourses, {
      cumulativeEarnedCredits: 122,
    }),
    true,
  );

  // Earned credits 130, but missing prerequisite -> must be false
  assert.equal(
    isCourseAvailable(gradProject1, new Set(["12110316"]), realCatalogCourses, {
      cumulativeEarnedCredits: 130,
    }),
    false,
  );
});

test("isCourseAvailable allows elective selection even when category minimum is met", () => {
  const hebrew = mockCourses.find((c) => c.id === "13020001")!;
  const jerusalem = mockCourses.find((c) => c.id === "13020004")!;

  // User already completed Hebrew (2cr), French (2cr), German (2cr) = 6cr (category min requirement met)
  const completed = new Set(["13020001", "13020002", "13020003"]);

  // Jerusalem history is not yet completed and must remain available to explore/plan/swap
  assert.equal(isCourseAvailable(jerusalem, completed, mockCourses), true);

  // Already completed Hebrew should not be available
  assert.equal(isCourseAvailable(hebrew, completed, mockCourses), false);
});

test("calculateGPA excludes remedial courses and Pass/Fail (-1)", () => {
  const completed = new Set(["15200099", "15200106", "11100101", "11100103"]);
  const grades = {
    "15200099": 90, // Remedial (3cr, grade 90) -> Excluded
    "15200106": 80, // 3cr -> 240
    "11100101": 90, // 3cr -> 270
    "11100103": -1, // Pass/Fail (-1) -> Excluded from GPA average
  };

  const gpa = calculateGPA(mockCourses, grades, completed);
  // (80*3 + 90*3) / 6 = 85.0
  assert.equal(gpa, 85);
});

test("calculateGPA handles failed courses and what-if grades correctly", () => {
  const completed = new Set(["11100101"]); // Calc 1 (3cr, grade 70)
  const failed = new Set(["11100103"]); // Physics 1 (3cr, grade 40)
  const grades = {
    "11100101": 70,
    "11100103": 40,
  };

  // Regular GPA with failed course: (70*3 + 40*3) / 6 = 55.0
  const regularGPA = calculateGPA(mockCourses, grades, completed, failed);
  assert.equal(regularGPA, 55);

  // What-if GPA retaking Physics with 90: (70*3 + 90*3) / 6 = 80.0
  const whatIfGrades = {
    "11100103": 90,
  };
  const whatIfGPA = calculateGPA(
    mockCourses,
    grades,
    completed,
    failed,
    whatIfGrades,
    true,
  );
  assert.equal(whatIfGPA, 80);
});

test("Item 145: calculateGPA and credit counters safely handle zero-credit labs and workshops without NaN", () => {
  const zeroCreditWorkshop: Course = {
    id: "99999000",
    name: "ورشة عمل تدريبية",
    credits: 0,
    category: "university_elective",
    prerequisites: [],
  };

  const coursesWithZeroCredit = [...mockCourses, zeroCreditWorkshop];
  const completed = new Set(["11100101", "99999000"]); // Calc 1 (3cr, grade 90) + Workshop (0cr, grade 95)
  const grades = {
    "11100101": 90,
    "99999000": 95,
  };

  // GPA should remain exactly 90 and not divide by 0 or produce NaN
  const gpa = calculateGPA(coursesWithZeroCredit, grades, completed);
  assert.equal(gpa, 90);
  assert.ok(!isNaN(gpa));

  // If ONLY the zero-credit course is completed
  const onlyZeroCompleted = new Set(["99999000"]);
  const gpaZero = calculateGPA(
    coursesWithZeroCredit,
    grades,
    onlyZeroCompleted,
  );
  assert.equal(gpaZero, 0);
  assert.ok(!isNaN(gpaZero));

  // Degree credits should not count 0-credit course towards credit accumulation
  const degreeCredits = calculateDegreeCredits(
    coursesWithZeroCredit,
    onlyZeroCompleted,
  );
  assert.equal(degreeCredits, 0);
});

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

test("getAcademicStandingInfo accurately computes standing, graduation project, field training, and scholarship tiers", () => {
  // 1. High Honor student with 125 credits
  const info1 = getAcademicStandingInfo(92.5, 125);
  assert.equal(info1.isHonor, true);
  assert.equal(info1.scholarshipTier, "full");
  assert.equal(info1.canRegisterGradProject, true);
  assert.equal(info1.creditsToGradProject, 0);
  assert.equal(info1.canRegisterFieldTraining, true);

  // 2. Partial scholarship student with 95 credits
  const info2 = getAcademicStandingInfo(87, 95);
  assert.equal(info2.isHonor, true);
  assert.equal(info2.scholarshipTier, "partial");
  assert.equal(info2.canRegisterGradProject, false);
  assert.equal(info2.creditsToGradProject, 25);
  assert.equal(info2.canRegisterFieldTraining, true);
  assert.equal(info2.creditsToFieldTraining, 0);

  // 3. Scholarship candidate (82%) with 80 credits
  const info3 = getAcademicStandingInfo(82, 80);
  assert.equal(info3.isHonor, false);
  assert.equal(info3.scholarshipTier, "candidate");
  assert.equal(info3.canRegisterFieldTraining, false);
  assert.equal(info3.creditsToFieldTraining, 10);

  // 4. Academic warning student
  const info4 = getAcademicStandingInfo(58, 30);
  assert.equal(info4.isWarning, true);
  assert.equal(info4.scholarshipTier, "none");
});

test("isPrerequisiteSatisfied and isCourseAvailable correctly handle OR alternative prerequisites", () => {
  // Direct match
  assert.equal(
    isPrerequisiteSatisfied("11100101", new Set(["11100101"])),
    true,
  );
  assert.equal(
    isPrerequisiteSatisfied("11100101", new Set(["11100102"])),
    false,
  );

  // Pipe OR separator ("11100101|11100105")
  assert.equal(
    isPrerequisiteSatisfied("11100101|11100105", new Set(["11100105"])),
    true,
  );
  assert.equal(
    isPrerequisiteSatisfied("11100101|11100105", new Set(["11100101"])),
    true,
  );
  assert.equal(
    isPrerequisiteSatisfied("11100101|11100105", new Set(["12010101"])),
    false,
  );

  // Slash OR separator ("11100101/11100105")
  assert.equal(
    isPrerequisiteSatisfied("11100101/11100105", new Set(["11100105"])),
    true,
  );

  // Explicit " OR " keyword separator
  assert.equal(
    isPrerequisiteSatisfied("11100101 OR 11100105", new Set(["11100105"])),
    true,
  );

  // Course with alternative prereqs
  const courseWithAltPrereq: Course = {
    id: "12010202",
    name: "خوارزميات متقدمة",
    prerequisites: ["12010201|12010205", "11100101"],
    credits: 3,
    category: "متطلب تخصص إجباري",
  };

  // Has only one of the alternatives (12010205) and Calc 1 (11100101)
  assert.equal(
    isCourseAvailable(courseWithAltPrereq, new Set(["12010205", "11100101"])),
    true,
  );

  // Missing Calc 1
  assert.equal(
    isCourseAvailable(courseWithAltPrereq, new Set(["12010205"])),
    false,
  );
});

test("detectPrerequisiteCycles identifies circular dependency loops and confirms valid catalog is acyclic", () => {
  // Real catalog should have 0 circular dependency cycles
  const realCatalogCycles = detectPrerequisiteCycles(realCatalogCourses);
  assert.equal(
    realCatalogCycles.length,
    0,
    "Real PTUK catalog must be an acyclic DAG",
  );

  // Synthetic test with direct circular loop: Course A -> Course B -> Course A
  const cyclicCourses: Course[] = [
    {
      id: "C_A",
      name: "مادة أ",
      prerequisites: ["C_B"],
      credits: 3,
      category: "متطلب تخصص إجباري",
    },
    {
      id: "C_B",
      name: "مادة ب",
      prerequisites: ["C_A"],
      credits: 3,
      category: "متطلب تخصص إجباري",
    },
  ];

  const detected = detectPrerequisiteCycles(cyclicCourses);
  assert.ok(detected.length > 0, "Must detect direct cyclic loop");
  assert.ok(detected[0].includes("C_A") && detected[0].includes("C_B"));

  // getTransitivePrerequisites handles cyclic graph without infinite recursion or stack overflow
  const transitive = getTransitivePrerequisites("C_A", cyclicCourses);
  assert.ok(transitive.has("C_B"));
  assert.ok(transitive.has("C_A"));
});

test("computeCriticalPath discovers the longest prerequisite bottleneck chain", () => {
  const result = computeCriticalPath(realCatalogCourses);
  assert.ok(
    result.maxChainLength >= 5,
    `Expected max chain >= 5, got ${result.maxChainLength}`,
  );
  assert.ok(result.criticalCourseIds.size > 0);
  assert.ok(result.longestChain.length === result.maxChainLength);

  // In PTUK CSE, Calculus or Programming foundation must lead into senior graduation projects
  assert.ok(
    result.criticalCourseIds.has("15010101") ||
      result.criticalCourseIds.has("11100101") ||
      result.criticalCourseIds.has("12140101"),
    "Introductory bottleneck courses must be recognized on the critical path",
  );
});

test("calculateYearlyProgress accurately sums completed and total degree credits per academic year", () => {
  const completed = new Set(["15010101", "15020101", "15200101"]); // Real catalog Year 1 courses (Calc 1, Physics 1, Palestine Issue)
  const yearly = calculateYearlyProgress(realCatalogCourses, completed);

  // 164-credit CSE engineering plan scales to 5 academic years
  assert.equal(yearly.length, 5);
  assert.equal(yearly[0].year, 1);
  assert.ok(yearly[0].totalCredits > 30);
  assert.ok(yearly[0].completedCredits >= 9);
  assert.ok(yearly[0].percentage > 0 && yearly[0].percentage <= 100);

  // Year 4 and Year 5 should have 0 completed initially
  assert.equal(yearly[3].completedCredits, 0);
  assert.equal(yearly[3].percentage, 0);
  assert.equal(yearly[4].year, 5);
  assert.equal(yearly[4].completedCredits, 0);

  // 132-credit Bachelor plan scales to 4 academic years
  const bachelorYearly = calculateYearlyProgress(
    realCatalogCourses,
    completed,
    132,
  );
  assert.equal(bachelorYearly.length, 4);

  // 72-credit Diploma plan scales to 2 academic years
  const diplomaYearly = calculateYearlyProgress(
    realCatalogCourses,
    completed,
    72,
  );
  assert.equal(diplomaYearly.length, 2);
});

test("getTopRetakeRecommendations returns all courses boosting GPA by more than 0.1 and excludes negligible boosts", () => {
  const sampleCourses: Course[] = [
    {
      id: "C1",
      name: "برمجة متقدمة",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "C2",
      name: "قواعد بيانات",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "C3",
      name: "مختبر شبكات",
      credits: 1,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "C4",
      name: "هياكل بيانات",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
  ];

  const completed = new Set(["C1", "C2", "C3", "C4"]); // Total credits = 10
  const grades: Record<string, number> = {
    C1: 60, // (85 - 60) * 3 / 10 = 7.5 > 0.1 -> Included
    C2: 80, // (85 - 80) * 3 / 10 = 1.5 > 0.1 -> Included
    C3: 84, // (85 - 84) * 1 / 10 = 0.1 -> Exactly 0.1, not > 0.1 -> Excluded
    C4: 85, // Current grade equals target -> Excluded
  };

  const recs = getTopRetakeRecommendations(
    sampleCourses,
    grades,
    completed,
    85,
    undefined,
    0.1,
  );

  assert.equal(recs.length, 2);
  assert.equal(recs[0].course.id, "C1");
  assert.ok(recs[0].potentialGpaBoost > 0.1);
  assert.equal(recs[1].course.id, "C2");
  assert.ok(recs[1].potentialGpaBoost > 0.1);
});

test("getTopRetakeRecommendations respects custom limits when provided", () => {
  const sampleCourses: Course[] = [
    {
      id: "A",
      name: "A",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "B",
      name: "B",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "C",
      name: "C",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
  ];
  const completed = new Set(["A", "B", "C"]);
  const grades = { A: 60, B: 65, C: 70 };

  const limited = getTopRetakeRecommendations(
    sampleCourses,
    grades,
    completed,
    85,
    2,
    0.1,
  );
  assert.equal(limited.length, 2);
  assert.equal(limited[0].course.id, "A");
  assert.equal(limited[1].course.id, "B");
});

test("calculateGPA allows what-if simulation for courses with existing grade > 75 without arbitrary block", () => {
  const courses: Course[] = [
    {
      id: "MATH1",
      name: "Calculus",
      credits: 3,
      category: "متطلب كلية إجباري",
      prerequisites: [],
    },
  ];
  const completed = new Set(["MATH1"]);
  const grades = { MATH1: 78 };

  // Prior logic blocked what-if if grade > 75. New logic allows simulating retake for any course:
  const whatIfGrades = { MATH1: 95 };
  const gpa = calculateGPA(
    courses,
    grades,
    completed,
    new Set(),
    whatIfGrades,
    true,
  );
  assert.equal(gpa, 95);
});

test("getTopRetakeRecommendations includes and prioritizes failed courses", () => {
  const courses: Course[] = [
    {
      id: "FAIL1",
      name: "Digital Logic",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "PASS1",
      name: "Programming",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
  ];
  const completed = new Set(["PASS1"]);
  const failed = new Set(["FAIL1"]);
  const grades = { FAIL1: 42, PASS1: 65 };

  const recs = getTopRetakeRecommendations(
    courses,
    grades,
    completed,
    failed,
    85,
    undefined,
    0.1,
  );
  assert.equal(recs.length, 2);
  assert.equal(recs[0].course.id, "FAIL1"); // Failed course prioritized first
  assert.ok(recs[0].potentialGpaBoost > recs[1].potentialGpaBoost);
});
