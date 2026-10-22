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
  calculateGPA,
  REMEDIAL_COURSE_ID,
  REMEDIAL_CATEGORY,
} from "../src/courseProgress";
import type { Course } from "../src/data";
import { courses as realCatalogCourses, categoryRequirements } from "../src/data";
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

test("isRemedialCourse and isDegreeCreditBearing identify remedial course", () => {
  const remedial = mockCourses.find((c) => c.id === "15200099")!;
  const standard = mockCourses.find((c) => c.id === "15200106")!;

  assert.equal(isRemedialCourse(remedial), true);
  assert.equal(isRemedialCourse(REMEDIAL_COURSE_ID), true);
  assert.equal(isRemedialCourse("15200099"), true);
  assert.equal(isDegreeCreditBearing(remedial), false);
  assert.equal(isDegreeCreditBearing(REMEDIAL_COURSE_ID), false);
  assert.equal(isDegreeCreditBearing("15200099"), false);

  assert.equal(isRemedialCourse(standard), false);
  assert.equal(isRemedialCourse("15200106"), false);
  assert.equal(isDegreeCreditBearing(standard), true);
  assert.equal(isDegreeCreditBearing("15200106"), true);
});

test("calculateDegreeCredits excludes remedial courses from earned total", () => {
  const completed = new Set(["15200099", "15200106", "11100101", "12010101"]);
  const credits = calculateDegreeCredits(mockCourses, completed);
  // 15200106 (3) + 11100101 (3) + 12010101 (4) = 10 cr (remedial 3 cr excluded)
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
  assert.equal(
    isCourseAvailable(jerusalem, completed, mockCourses),
    true,
  );

  // Already completed Hebrew should not be available
  assert.equal(
    isCourseAvailable(hebrew, completed, mockCourses),
    false,
  );
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
