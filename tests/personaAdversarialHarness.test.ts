import test from "node:test";
import assert from "node:assert/strict";

import {
  hasStudentAcademicWarning,
  getStudentCreditLimits,
  getOfficialDegreeTotalCredits,
  AcademicPolicy,
  DefaultAcademicPolicy,
} from "../src/core/academicPolicy";
import {
  calculateDegreeCredits,
  isRemedialCourse,
  isDegreeCreditBearing,
  calculateGPA,
  calculateRemainingCredits,
  calculateProgressPercentage,
  isCourseAvailable,
  isPrerequisiteSatisfied,
  getAcademicStandingInfo,
  resolveCapstoneThreshold,
  resolveFieldTrainingThreshold,
  detectPrerequisiteCycles,
  computeCriticalPath,
} from "../src/core/courseProgress";
import {
  solveSchedule,
  generateAllSchedules,
  hasConflict,
  getBlockStats,
  calculateScheduleQuality,
  SolverCourse,
  CatalogCourse,
  CatalogSection,
} from "../src/services/scheduleSolver";
import {
  checkPlanCreditLimits,
  checkPlanPrerequisites,
  resolveCascadingFallback,
} from "../src/core/semesterRegistration";
import type { StudentSyncProfile } from "../src/services/studentService";
import type { Course } from "../src/data";

// ============================================================================
// ADVERSARIAL STRESS SUITE 1: EXTREME GPAs & ACADEMIC STANDING
// ============================================================================

test("Adversarial 1.1: Extreme GPA 0.0% handling", () => {
  // Case A: Freshman student with GPA 0.0% ("مستجد")
  const freshman: Partial<StudentSyncProfile> = {
    gpa: 0,
    academicStatus: "مستجد",
    academicWarning: "لا يوجد",
  };
  assert.equal(
    hasStudentAcademicWarning(freshman as StudentSyncProfile),
    false,
    "Freshman with GPA 0.0 must NOT be flagged as under academic warning",
  );
  const freshmanLimits = getStudentCreditLimits({
    student: freshman as StudentSyncProfile,
    semesterName: "الفصل الأول 2024/2025",
  });
  assert.equal(freshmanLimits.maxCredits, 19);
  assert.equal(freshmanLimits.minCredits, 12);

  // Case B: Enrolled regular student with GPA 0.0% (Failed all registered courses)
  // NOTE: In academicPolicy.ts:95, hasLowGpa is `gpa > 0 && gpa < 60`.
  // If gpa === 0 without warning status text, hasStudentAcademicWarning returns false!
  const zeroGpaStudent: Partial<StudentSyncProfile> = {
    gpa: 0.0,
    academicStatus: "منتظم",
    academicWarning: "",
  };
  const zeroWarning = hasStudentAcademicWarning(zeroGpaStudent as StudentSyncProfile);
  // Document actual behavior:
  assert.equal(
    zeroWarning,
    false,
    "Empirical behavior: gpa === 0 is treated as no-record/freshman unless status text explicitly specifies warning",
  );

  // Case C: Enrolled student with GPA 0.0% and explicit warning status text from Edugate
  const zeroGpaWithWarning: Partial<StudentSyncProfile> = {
    gpa: 0.0,
    academicStatus: "تحت الملاحظة الأكاديمية",
    academicWarning: "إنذار أول",
  };
  assert.equal(
    hasStudentAcademicWarning(zeroGpaWithWarning as StudentSyncProfile),
    true,
    "Status text overrides numeric 0 GPA to trigger warning",
  );
});

test("Adversarial 1.2: Extreme GPA 100.0% handling", () => {
  const perfectStudent: Partial<StudentSyncProfile> = {
    gpa: 100.0,
    academicStatus: "منتظم",
    academicWarning: "لا يوجد",
  };
  assert.equal(hasStudentAcademicWarning(perfectStudent as StudentSyncProfile), false);

  const perfectLimits = getStudentCreditLimits({
    student: perfectStudent as StudentSyncProfile,
    semesterName: "الفصل الأول 2024/2025",
  });
  assert.equal(perfectLimits.isHighGpaOrGraduating, true);
  assert.equal(perfectLimits.maxCredits, 21, "100.0% GPA must unlock 21 credits");

  const summerLimits = getStudentCreditLimits({
    student: perfectStudent as StudentSyncProfile,
    semesterName: "الفصل الصيفي 2024/2025",
  });
  assert.equal(summerLimits.maxCredits, 12, "100.0% GPA must unlock 12 summer credits");
});

test("Adversarial 1.3: Negative and Out-of-Bounds GPA inputs", () => {
  // Negative GPA input (-5.0)
  const negativeStudent: Partial<StudentSyncProfile> = {
    gpa: -5.0,
    academicStatus: "منتظم",
    academicWarning: "لا يوجد",
  };
  // gpa > 0 && gpa < 60 is false for -5.0
  assert.equal(
    hasStudentAcademicWarning(negativeStudent as StudentSyncProfile),
    false,
    "Negative GPA does not satisfy gpa > 0 condition",
  );

  // Out of bounds GPA (150.0%)
  const inflatedStudent: Partial<StudentSyncProfile> = {
    gpa: 150.0,
    academicStatus: "منتظم",
    academicWarning: "لا يوجد",
  };
  const inflatedLimits = getStudentCreditLimits({
    student: inflatedStudent as StudentSyncProfile,
  });
  assert.equal(
    inflatedLimits.isHighGpaOrGraduating,
    true,
    "GPA > 80 triggers high GPA flag even if > 100",
  );

  // Non-numeric / NaN / null / undefined GPA inputs
  assert.equal(
    hasStudentAcademicWarning({ gpa: NaN } as any),
    false,
    "NaN GPA must fail closed without crashing",
  );
  assert.equal(
    hasStudentAcademicWarning({ gpa: null } as any),
    false,
    "null GPA must fail closed without crashing",
  );
  assert.equal(
    hasStudentAcademicWarning(undefined),
    false,
    "undefined student must fail closed",
  );
});

// ============================================================================
// ADVERSARIAL STRESS SUITE 2: TRANSFER CREDITS & ZERO GRADED CREDITS
// ============================================================================

test("Adversarial 2.1: Student with purely transfer credits (0 graded credits) in calculateGPA", () => {
  const dummyCourses: Course[] = [
    {
      id: "TR_1",
      name: "Transfer 1",
      credits: 3,
      category: "متطلب كلية إجباري",
      prerequisites: [],
    },
    {
      id: "TR_2",
      name: "Transfer 2",
      credits: 4,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
  ];

  // All transfer courses have grade -1
  const transferGrades: Record<string, number> = {
    TR_1: -1,
    TR_2: -1,
  };
  const completed = new Set(["TR_1", "TR_2"]);

  const gpa = calculateGPA(dummyCourses, transferGrades, completed);
  assert.equal(Number.isNaN(gpa), false, "GPA must NOT be NaN");
  assert.equal(Number.isFinite(gpa), true, "GPA must be finite");
  assert.equal(gpa, 0, "GPA with 0 graded credits must evaluate to exactly 0");

  // Degree credits still count transfer courses
  const degreeCredits = calculateDegreeCredits(dummyCourses, completed);
  assert.equal(degreeCredits, 7, "Transfer credits must be counted in degree earned credits");

  // Remaining credits properly decremented
  const remaining = calculateRemainingCredits(degreeCredits, 132);
  assert.equal(remaining, 125);

  // Progress percentage correctly computed
  const progress = calculateProgressPercentage(degreeCredits, 132);
  assert.equal(progress, 5); // Math.round((7 / 132) * 100) = 5%
});

test("Adversarial 2.2: Completely empty transcript (0 courses completed, 0 grades)", () => {
  const dummyCourses: Course[] = [
    {
      id: "CS101",
      name: "CS 101",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
  ];

  const gpa = calculateGPA(dummyCourses, {}, new Set());
  assert.equal(Number.isNaN(gpa), false);
  assert.equal(gpa, 0);

  const degreeCredits = calculateDegreeCredits(dummyCourses, new Set());
  assert.equal(degreeCredits, 0);

  const remaining = calculateRemainingCredits(0, 132);
  assert.equal(remaining, 132);

  const progress = calculateProgressPercentage(0, 132);
  assert.equal(progress, 0);
});

test("Adversarial 2.3: Single course with grade 0.0% (genuine 0 score)", () => {
  const dummyCourses: Course[] = [
    {
      id: "MATH101",
      name: "Calculus",
      credits: 3,
      category: "متطلب كلية إجباري",
      prerequisites: [],
    },
  ];

  // Grade is 0, student is in completedCourses
  const grades: Record<string, number> = { MATH101: 0 };
  const completed = new Set(["MATH101"]);

  const gpa = calculateGPA(dummyCourses, grades, completed);
  assert.equal(Number.isNaN(gpa), false);
  assert.equal(gpa, 0.0);

  // Grade is 0, student is in failedCourses
  const failed = new Set(["MATH101"]);
  const failedGpa = calculateGPA(dummyCourses, grades, new Set(), failed);
  assert.equal(Number.isNaN(failedGpa), false);
  assert.equal(failedGpa, 0.0);
});

// ============================================================================
// ADVERSARIAL STRESS SUITE 3: SOLVER RESILIENCE UNDER EMPTY & IMPOSSIBLE INPUTS
// ============================================================================

test("Adversarial 3.1: Solver behavior with completely empty course list", () => {
  // Case A: solveSchedule with empty courses array
  const solved = solveSchedule([], {
    preferredEnd: "13:30",
    maxWorkDays: 3,
  });
  assert.ok(solved, "solveSchedule must return an object");
  assert.equal(solved.truncated, false);
  assert.equal(solved.exploredNodes, 0);
  // Empirically, solveSchedule([]) produces 1 trivial empty schedule:
  assert.equal(solved.schedules.length, 1);
  assert.equal(solved.schedules[0].entries.length, 0);
  assert.equal(solved.schedules[0].stats.courseCount, 0);

  // Case B: generateAllSchedules with empty courses array
  const allSchedules = generateAllSchedules([], {
    timePreference: "compact",
  });
  assert.ok(Array.isArray(allSchedules));
  assert.equal(
    allSchedules.length,
    0,
    "generateAllSchedules([]) must return an empty array []",
  );
});

test("Adversarial 3.2: Solver behavior under impossible time constraints", () => {
  const courses: SolverCourse[] = [
    {
      id: "CS_301",
      options: [
        {
          section: "1",
          startTime: "14:00",
          endTime: "15:30",
          blocks: [{ days: ["أح", "ثلا"], start: 14.0, end: 15.5 }],
        },
      ],
    },
  ];

  // Impossible constraint 1: preferredEnd <= 13:30 (section ends at 15:30)
  const result1 = solveSchedule(courses, { preferredEnd: "13:30" });
  assert.equal(result1.schedules.length, 0, "Must return 0 schedules when no section fits");

  // Impossible constraint 2: inverted window (preferredStart 16:00, preferredEnd 12:00)
  const result2 = solveSchedule(courses, {
    preferredStart: "16:00",
    preferredEnd: "12:00",
  });
  assert.equal(result2.schedules.length, 0, "Inverted time window must prune all candidates");

  // Impossible constraint 3: offDays include all days the course meets
  const result3 = solveSchedule(courses, { offDays: ["أح", "ثلا"] });
  assert.equal(result3.schedules.length, 0, "Blocking all meeting days must prune candidate");

  // Impossible constraint 4: maxWorkDays = 1, but course meets on 2 days ("أح", "ثلا")
  const result4 = solveSchedule(courses, { maxWorkDays: 1 });
  assert.equal(result4.schedules.length, 0, "Exceeding maxWorkDays must reject solution");
});

test("Adversarial 3.3: Solver combinatorial stress & node limit safety", () => {
  // Generate 8 courses each with 4 non-conflicting sections (4^8 = 65,536 combinations)
  const heavyCourses: SolverCourse[] = Array.from({ length: 8 }, (_, cIdx) => ({
    id: `COURSE_${cIdx}`,
    options: Array.from({ length: 4 }, (_, sIdx) => ({
      section: `${sIdx + 1}`,
      startTime: "09:00",
      endTime: "10:00",
      // Stagger start times by course to avoid internal conflicts
      blocks: [
        {
          days: ["أح"],
          start: 8.0 + cIdx * 1.0 + sIdx * 0.1,
          end: 8.5 + cIdx * 1.0 + sIdx * 0.1,
        },
      ],
    })),
  }));

  const start = performance.now();
  const cappedResult = solveSchedule(heavyCourses, {
    maxResults: 5,
    nodeLimit: 500,
  });
  const elapsed = performance.now() - start;

  assert.ok(elapsed < 1000, `Combinatorial search completed in ${elapsed.toFixed(1)}ms`);
  assert.ok(
    cappedResult.exploredNodes <= 501,
    `Explored nodes (${cappedResult.exploredNodes}) must respect node limit`,
  );
  assert.equal(cappedResult.schedules.length, 5);
});

// ============================================================================
// ADVERSARIAL STRESS SUITE 4: ACADEMIC WARNING CREDIT LIMIT BOUNDARIES
// ============================================================================

test("Adversarial 4.1: Warning student regular semester credit boundaries (14.0, 14.5, 15.0)", () => {
  const semester = "السنة الثانية - الفصل الأول";

  // Exact ceiling: 14.0 credits -> MUST PASS (0 errors)
  const exact14 = checkPlanCreditLimits(14.0, semester, {
    hasAcademicWarning: true,
  });
  assert.equal(exact14.length, 0, "14.0 credits under warning must pass with 0 diagnostics");

  // Fractional overflow: 14.5 credits -> MUST FAIL (1 error)
  const overflow14_5 = checkPlanCreditLimits(14.5, semester, {
    hasAcademicWarning: true,
  });
  assert.equal(overflow14_5.length, 1, "14.5 credits must produce a diagnostic error");
  assert.equal(overflow14_5[0].code, "CREDIT_LIMIT_EXCEEDED");
  assert.equal(overflow14_5[0].type, "error");
  assert.ok(overflow14_5[0].detail.includes("14"));

  // Integer overflow: 15.0 credits -> MUST FAIL (1 error)
  const overflow15 = checkPlanCreditLimits(15.0, semester, {
    hasAcademicWarning: true,
  });
  assert.equal(overflow15.length, 1, "15.0 credits must produce a diagnostic error");
  assert.equal(overflow15[0].code, "CREDIT_LIMIT_EXCEEDED");
  assert.equal(overflow15[0].type, "error");
  assert.ok(overflow15[0].detail.includes("14"));

  // Micro overflow: 14.0001 credits -> MUST FAIL
  const microOverflow = checkPlanCreditLimits(14.0001, semester, {
    hasAcademicWarning: true,
  });
  assert.equal(microOverflow.length, 1, "Any fraction above 14.0 must be blocked");

  // Warning triggered implicitly by gpa = 57.8 without hasAcademicWarning flag
  const gpaTriggered = checkPlanCreditLimits(15.0, semester, {
    gpa: 57.8,
  });
  assert.equal(gpaTriggered.length, 1, "GPA < 60 must implicitly enforce 14-credit limit");
});

test("Adversarial 4.2: Warning student summer semester credit boundaries (6.0, 6.5, 7.0)", () => {
  const summerSemester = "الفصل الصيفي 2024/2025";

  // Exact summer warning ceiling: 6.0 credits -> MUST PASS
  const exact6 = checkPlanCreditLimits(6.0, summerSemester, {
    hasAcademicWarning: true,
  });
  assert.equal(exact6.length, 0, "6.0 credits in summer under warning must pass");

  // Overflow summer: 6.5 credits -> MUST FAIL
  const overflow6_5 = checkPlanCreditLimits(6.5, summerSemester, {
    hasAcademicWarning: true,
  });
  assert.equal(overflow6_5.length, 1);
  assert.equal(overflow6_5[0].code, "CREDIT_LIMIT_EXCEEDED");
  assert.ok(overflow6_5[0].detail.includes("6"));

  // Overflow summer: 7.0 credits -> MUST FAIL
  const overflow7 = checkPlanCreditLimits(7.0, summerSemester, {
    hasAcademicWarning: true,
  });
  assert.equal(overflow7.length, 1);
  assert.equal(overflow7[0].code, "CREDIT_LIMIT_EXCEEDED");
  assert.ok(overflow7[0].detail.includes("6"));
});

test("Adversarial 4.3: Policy Discrepancy Stress Test — checkPlanCreditLimits ignores high GPA without isGraduating", () => {
  // Scenario: Maya Khoury (GPA 89.4%) in her 3rd year (not graduating yet)
  // In academicPolicy.ts: getStudentCreditLimits unlocks 21 credits based on gpa >= 80 alone.
  const policyLimits = getStudentCreditLimits({
    student: { gpa: 89.4 } as StudentSyncProfile,
    semesterName: "الفصل الأول 2024/2025",
  });
  assert.equal(policyLimits.maxCredits, 21);

  // In semesterRegistration.ts: checkPlanCreditLimits ONLY checks options.isGraduating for 21 credits!
  // If called with gpa: 89.4 and isGraduating: false / undefined:
  const checkWithoutGraduating = checkPlanCreditLimits(21, "السنة الثالثة - الفصل الأول", {
    gpa: 89.4,
  });
  // EMPIRICAL OBSERVATION: Returns 1 error!
  assert.equal(
    checkWithoutGraduating.length,
    1,
    "Empirical discrepancy confirmed: checkPlanCreditLimits requires isGraduating: true to permit 21 credits",
  );
  assert.ok(
    checkWithoutGraduating[0].detail.includes("19"),
    "Discrepancy: Caps at 19 credits instead of recognizing 21 credits for high GPA",
  );

  // When isGraduating: true is supplied, it passes:
  const checkWithGraduating = checkPlanCreditLimits(21, "السنة الثالثة - الفصل الأول", {
    isGraduating: true,
  });
  assert.equal(checkWithGraduating.length, 0);
});
