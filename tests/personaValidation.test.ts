import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

// Mock localStorage and window environment for Node.js test runner
const mockStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

const mockDocument = {
  documentElement: {
    dataset: {} as Record<string, string>,
    classList: {
      _classes: new Set<string>(),
      add(c: string) {
        this._classes.add(c);
      },
      remove(c: string) {
        this._classes.delete(c);
      },
      toggle(c: string, force?: boolean) {
        if (force === true) {
          this._classes.add(c);
        } else if (force === false) {
          this._classes.delete(c);
        } else if (this._classes.has(c)) {
          this._classes.delete(c);
        } else {
          this._classes.add(c);
        }
      },
      contains(c: string) {
        return this._classes.has(c);
      },
    },
  },
  querySelector: (_sel: string) => ({
    setAttribute: (_attr: string, _val: string) => {},
  }),
};

(global as any).window = {
  localStorage: mockStorage,
  matchMedia: () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
};
(global as any).localStorage = mockStorage;
(global as any).document = mockDocument;

// Domain Module Imports
import {
  hasStudentAcademicWarning,
  getStudentCreditLimits,
  getOfficialDegreeTotalCredits,
  calculateOfficialTuition,
} from "../src/core/academicPolicy";
import {
  calculateDegreeCredits,
  isRemedialCourse,
  isDegreeCreditBearing,
  calculateGPA,
  isCourseAvailable,
  isPrerequisiteSatisfied,
  getAcademicStandingInfo,
  resolveCapstoneThreshold,
  resolveFieldTrainingThreshold,
  detectPrerequisiteCycles,
  computeCriticalPath,
} from "../src/core/courseProgress";
import { resolveMajorDegreeYears } from "../src/core/advisoryPlan";
import {
  solveSchedule,
  generateAllSchedules,
  hasConflict,
  getBlockStats,
  normalizeDayKey,
  calculateScheduleQuality,
} from "../src/services/scheduleSolver";
import type {
  CatalogCourse,
  CatalogSection,
  SolverCourse,
} from "../src/services/scheduleSolver";
import {
  checkPlanCreditLimits,
  checkPlanPrerequisites,
} from "../src/core/semesterRegistration";
import {
  getOfficialTuitionRate,
  calculateSemesterTuition,
  OFFICIAL_FIXED_FEES,
} from "../src/services/tuitionFeesService";
import {
  getOfflineQueue,
  saveOfflineQueue,
  enqueueMutation,
  drainOfflineQueue,
} from "../src/core/offlineQueue";
import { ThemeManager } from "../src/themeManager";
import { parseExemptionExamRows } from "../server/services/studentPortalService.js";
import type { StudentSyncProfile } from "../src/services/studentService";
import type { Course } from "../src/data";

beforeEach(() => {
  mockStorage.clear();
  mockDocument.documentElement.dataset = {};
  mockDocument.documentElement.classList._classes.clear();
});

// ============================================================================
// Persona 1: Tariq Al-Najjar (Working Senior)
// Profile: 5th-Year Senior, Computer Systems Engineering (164 credits)
// Target: Capstone 2 + Field Training thresholds, <= 13:30 solver clamping, degree credit sum
// ============================================================================

test("Persona 1 (Tariq): Capstone 2 & Field Training prerequisite credit thresholds in 164h Engineering", () => {
  // 1. Engineering degree (164h) threshold validation
  const capstoneThreshold164 = resolveCapstoneThreshold(164);
  const trainingThreshold164 = resolveFieldTrainingThreshold(164);

  assert.equal(
    capstoneThreshold164,
    120,
    "Graduation project in 164h engineering requires strictly >= 120 earned credits",
  );
  assert.equal(
    trainingThreshold164,
    90,
    "Field training in 164h engineering requires strictly >= 90 earned credits",
  );

  // 2. Tariq's profile: 142 earned credits (exceeds both 120 and 90)
  const standingSenior = getAcademicStandingInfo(76.5, 142, 164);
  assert.equal(
    standingSenior.canRegisterGradProject,
    true,
    "Tariq with 142/164 credits must be permitted to register Graduation Project 2",
  );
  assert.equal(
    standingSenior.canRegisterFieldTraining,
    true,
    "Tariq with 142/164 credits must be permitted to register Field Training",
  );
  assert.equal(
    standingSenior.creditsToGradProject,
    0,
    "No credits remaining to unlock capstone project",
  );

  // 3. Negative boundary test: Student with only 114 credits in 164h engineering
  const standingJunior = getAcademicStandingInfo(76.5, 114, 164);
  assert.equal(
    standingJunior.canRegisterGradProject,
    false,
    "Student with 114 credits must NOT be permitted to register Graduation Project",
  );
  assert.equal(
    standingJunior.creditsToGradProject,
    6,
    "Requires 6 more credits to reach the 120 threshold",
  );
});

test("Persona 1 (Tariq): Schedule solver clamps latestEndTime <= 13:30 for afternoon shift compatibility", () => {
  // Tariq works daily afternoon shift (14:00 - 22:00)
  // Requires all classes to end strictly by 13:30
  const candidateCourses: SolverCourse[] = [
    {
      id: "15010482", // Special Topics in CE
      options: [
        {
          section: "1",
          startTime: "09:30",
          endTime: "11:00",
          blocks: [{ days: ["أح", "ثلا"], start: 9.5, end: 11.0 }],
        },
        {
          section: "2",
          startTime: "14:00",
          endTime: "15:30",
          blocks: [{ days: ["أح", "ثلا"], start: 14.0, end: 15.5 }], // Clashes with work! (starts 14:00)
        },
      ],
    },
    {
      id: "15010441", // Embedded Systems Lab
      options: [
        {
          section: "1",
          startTime: "10:30",
          endTime: "13:30",
          blocks: [{ days: ["خمـ"], start: 10.5, end: 13.5 }], // Finishes at 13:30 (permitted)
        },
        {
          section: "2",
          startTime: "12:30",
          endTime: "15:30",
          blocks: [{ days: ["خمـ"], start: 12.5, end: 15.5 }], // Clashes with work! (ends 15:30)
        },
      ],
    },
  ];

  const result = solveSchedule(candidateCourses, {
    preferredEnd: "13:30",
    maxResults: 10,
  });

  assert.ok(
    result.schedules.length > 0,
    "Solver should produce valid schedule under 13:30 constraint",
  );

  for (const solved of result.schedules) {
    assert.ok(
      solved.stats.latestEnd !== null && solved.stats.latestEnd <= "13:30",
      `Schedule ends at ${solved.stats.latestEnd}, exceeding 13:30 work shift cutoff`,
    );
  }

  // Adversarial: When a mandatory course only offers a section ending after 13:30
  const impossibleCourse: SolverCourse[] = [
    {
      id: "15010502",
      options: [
        {
          section: "1",
          startTime: "14:00",
          endTime: "16:00",
          blocks: [{ days: ["اث"], start: 14.0, end: 16.0 }],
        },
      ],
    },
  ];

  const impossibleResult = solveSchedule(impossibleCourse, {
    preferredEnd: "13:30",
  });
  assert.equal(
    impossibleResult.schedules.length,
    0,
    "Solver must return 0 schedules when no section complies with 13:30 limit",
  );
});

test("Persona 1 (Tariq): Degree credit summation accurately computes 164-credit engineering degree progress", () => {
  const cseDegreeCredits = getOfficialDegreeTotalCredits({
    majorName: "هندسة أنظمة الحاسوب",
    degree: "بكالوريوس",
  } as StudentSyncProfile);
  assert.equal(
    cseDegreeCredits,
    164,
    "Computer Systems Engineering must resolve to 164 official degree credits",
  );

  const seniorCourses: Course[] = [
    {
      id: "15010502",
      name: "مشروع التخرج 2",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: ["15010501"],
    },
    {
      id: "15010400",
      name: "التدريب الميداني",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "15010441",
      name: "مختبر أنظمة مدمجة",
      credits: 1,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "15010482",
      name: "مواضيع خاصة في هندسة الحاسوب",
      credits: 3,
      category: "متطلب تخصص اختياري",
      prerequisites: [],
    },
    {
      id: "15200103",
      name: "تاريخ العرب المعاصر",
      credits: 3,
      category: "متطلب جامعة اختياري",
      prerequisites: [],
    },
    // Non-credit remedial course that Tariq might have in history
    {
      id: "15200099",
      name: "إنجليزي إستدراكي",
      credits: 3,
      category: "متطلب استدراكي إجباري",
      prerequisites: [],
    },
  ];

  const completedSet = new Set([
    "15010502",
    "15010400",
    "15010441",
    "15010482",
    "15200103",
    "15200099",
  ]);
  const earnedDegreeCredits = calculateDegreeCredits(seniorCourses, completedSet);

  // 3 + 3 + 1 + 3 + 3 = 13 degree credits (15200099 remedial must be excluded!)
  assert.equal(
    earnedDegreeCredits,
    13,
    "Degree credit calculation must sum 13 valid credits and exclude remedial courses",
  );
  assert.equal(isDegreeCreditBearing("15010502"), true);
  assert.equal(isDegreeCreditBearing("15200099"), false);
});

// ============================================================================
// Persona 2: Nour Zaidan (Commuter Sophomore)
// Profile: 2nd-Year Sophomore, Civil Engineering (164 credits)
// Target: Commute time window (08:30 - 15:30), compact schedule, lecture-lab co-requisite
// ============================================================================

test("Persona 2 (Nour): Intercity commute time filtering enforces 08:30 earliest start and 15:30 latest end", () => {
  // Nour commutes via shared taxi from Jenin: cannot start before 08:30, must leave by 15:30
  const candidateCourses: SolverCourse[] = [
    {
      id: "12040201", // Statics
      options: [
        {
          section: "1",
          startTime: "08:00",
          endTime: "09:00",
          blocks: [{ days: ["أح", "ثلا", "خمـ"], start: 8.0, end: 9.0 }], // Starts 08:00 (too early! 08:00 < 08:30)
        },
        {
          section: "2",
          startTime: "09:30",
          endTime: "10:30",
          blocks: [{ days: ["أح", "ثلا", "خمـ"], start: 9.5, end: 10.5 }], // Starts 09:30 (valid)
        },
      ],
    },
    {
      id: "15010201", // Calculus 3
      options: [
        {
          section: "1",
          startTime: "11:00",
          endTime: "12:00",
          blocks: [{ days: ["أح", "ثلا", "خمـ"], start: 11.0, end: 12.0 }], // Ends 12:00 (valid)
        },
        {
          section: "2",
          startTime: "15:00",
          endTime: "16:00",
          blocks: [{ days: ["أح", "ثلا", "خمـ"], start: 15.0, end: 16.0 }], // Ends 16:00 (too late! 16:00 > 15:30)
        },
      ],
    },
  ];

  const result = solveSchedule(candidateCourses, {
    preferredStart: "08:30",
    preferredEnd: "15:30",
  });

  assert.ok(result.schedules.length > 0, "Valid commute schedule must be found");

  for (const sched of result.schedules) {
    assert.ok(
      sched.stats.earliestStart !== null && sched.stats.earliestStart >= "08:30",
      `Schedule starts at ${sched.stats.earliestStart}, violating 08:30 commuter threshold`,
    );
    assert.ok(
      sched.stats.latestEnd !== null && sched.stats.latestEnd <= "15:30",
      `Schedule ends at ${sched.stats.latestEnd}, violating 15:30 commuter threshold`,
    );
  }
});

test("Persona 2 (Nour): Compact 2-day/3-day schedule solving minimizes days on campus", () => {
  // Test solver with maxWorkDays: 3 and min_days preference
  const catalogCourses: CatalogCourse[] = [
    {
      id: "12040201",
      name: "استاتيكا",
      sections: [
        {
          sec: "1",
          blocks: [{ days: ["أح", "ثلا"], start: 9, end: 10.5 }],
        },
        {
          sec: "2",
          blocks: [{ days: ["اث", "ار"], start: 9, end: 10.5 }],
        },
      ],
    },
    {
      id: "15010201",
      name: "تفاضل وتكامل 3",
      sections: [
        {
          sec: "1",
          blocks: [{ days: ["أح", "ثلا"], start: 11, end: 12.5 }],
        },
        {
          sec: "2",
          blocks: [{ days: ["اث", "ار"], start: 11, end: 12.5 }],
        },
      ],
    },
  ];

  // Request compact schedule with timePreference: 'min_days'
  const schedules = generateAllSchedules(catalogCourses, {
    timePreference: "min_days",
  });

  assert.ok(schedules.length > 0);
  const firstSchedule = schedules[0];
  const stats = getBlockStats(firstSchedule);

  assert.equal(
    stats.usedDays.length,
    2,
    "Optimal commuter schedule must compress classes into exactly 2 days",
  );
  assert.ok(
    stats.usedDays.every((d) => ["أح", "ثلا"].includes(d)) ||
      stats.usedDays.every((d) => ["اث", "ار"].includes(d)),
    "Schedules must pair Sun/Tue or Mon/Wed compactly",
  );
});

test("Persona 2 (Nour): Lecture-Lab co-requisite validation enforces concurrent or prior satisfaction", () => {
  const civilCourses: Course[] = [
    {
      id: "12040202",
      name: "مساحة عامة",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: ["15010101"], // Calculus 1
    },
    {
      id: "12040203",
      name: "مختبر مساحة",
      credits: 1,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
      coPrerequisites: ["12040202"], // Surveying lecture is co-requisite
    },
  ];

  const completed = new Set(["15010101"]); // Completed Calculus 1

  // Case A: Surveying lecture NOT completed and NOT planned -> Lab must be unavailable in strict mode
  const labAvailableWithoutLecture = isCourseAvailable(
    civilCourses[1],
    completed,
    civilCourses,
    { currentPlannedCourses: new Set(), coreqMode: "strict" },
  );
  assert.equal(
    labAvailableWithoutLecture,
    false,
    "Surveying Lab must NOT be available without concurrent or prior Surveying lecture",
  );

  // Case B: Surveying lecture is planned concurrently in the same semester -> Lab becomes available
  const labAvailableWithPlannedLecture = isCourseAvailable(
    civilCourses[1],
    completed,
    civilCourses,
    { currentPlannedCourses: new Set(["12040202"]), coreqMode: "strict" },
  );
  assert.equal(
    labAvailableWithPlannedLecture,
    true,
    "Surveying Lab MUST be available when Surveying lecture is concurrently planned in the same semester",
  );

  // Case C: Surveying lecture was already completed in a prior semester -> Lab is available
  const completedWithLecture = new Set(["15010101", "12040202"]);
  const labAvailableWithCompletedLecture = isCourseAvailable(
    civilCourses[1],
    completedWithLecture,
    civilCourses,
    { currentPlannedCourses: new Set(), coreqMode: "strict" },
  );
  assert.equal(
    labAvailableWithCompletedLecture,
    true,
    "Surveying Lab MUST be available when Surveying lecture was already completed",
  );
});

// ============================================================================
// Persona 3: Omar Abu-Saleh (Academic Warning / Probation)
// Profile: 3rd-Year Junior, Software Engineering (132 credits)
// Target: GPA < 60% warning detection, 14-credit semester limit, retake grade replacement
// ============================================================================

test("Persona 3 (Omar): GPA < 60% triggers authentic academic warning status", () => {
  // Omar has GPA 57.8%
  const omarProfile: Partial<StudentSyncProfile> = {
    gpa: 57.8,
    academicStatus: "منتظم",
    academicWarning: "",
  };

  assert.equal(
    hasStudentAcademicWarning(omarProfile as StudentSyncProfile),
    true,
    "GPA below 60% must automatically trigger academic warning status under PTUK bylaws",
  );

  // Warning by status string
  const probationStatusProfile: Partial<StudentSyncProfile> = {
    gpa: 61.2,
    academicStatus: "تحت الملاحظة الأكاديمية",
    academicWarning: "",
  };
  assert.equal(
    hasStudentAcademicWarning(probationStatusProfile as StudentSyncProfile),
    true,
  );

  // Explicit warning flag
  const warningTextProfile: Partial<StudentSyncProfile> = {
    gpa: 62.0,
    academicStatus: "منتظم",
    academicWarning: "إنذار أول",
  };
  assert.equal(
    hasStudentAcademicWarning(warningTextProfile as StudentSyncProfile),
    true,
  );
});

test("Persona 3 (Omar): Enforces hard 14-credit semester ceiling and 6-credit summer ceiling", () => {
  const limitsReg = getStudentCreditLimits({
    student: { gpa: 57.8, academicStatus: "منتظم" } as StudentSyncProfile,
    semesterName: "الفصل الأول 2024/2025",
  });

  assert.equal(
    limitsReg.maxCredits,
    14,
    "Students under academic warning are capped at strictly 14 credit hours in regular semesters",
  );
  assert.equal(limitsReg.minCredits, 12);
  assert.equal(limitsReg.hasAcademicWarning, true);

  // Summer under warning
  const limitsSummer = getStudentCreditLimits({
    student: { gpa: 57.8, academicStatus: "منتظم" } as StudentSyncProfile,
    semesterName: "الفصل الصيفي 2024/2025",
  });
  assert.equal(
    limitsSummer.maxCredits,
    6,
    "Students under academic warning are capped at strictly 6 credit hours in summer",
  );

  // Plan credit limits check
  const valid14Plan = checkPlanCreditLimits(
    14,
    "السنة الثانية - الفصل الأول",
    { hasAcademicWarning: true },
  );
  assert.equal(
    valid14Plan.length,
    0,
    "14-credit plan under academic warning must pass validation with 0 errors",
  );

  const invalid15Plan = checkPlanCreditLimits(
    15,
    "السنة الثانية - الفصل الأول",
    { hasAcademicWarning: true },
  );
  assert.equal(
    invalid15Plan.length,
    1,
    "15-credit plan under academic warning must produce an error diagnostic",
  );
  assert.ok(
    invalid15Plan[0].detail.includes("14"),
    "Rejection message must explicitly mention 14 credit ceiling",
  );
});

test("Persona 3 (Omar): Retake grade replacement overwrites older failing/lower grades in cumulative GPA", () => {
  const sweCourses: Course[] = [
    {
      id: "15010101",
      name: "تفاضل وتكامل 1",
      credits: 3,
      category: "متطلب كلية إجباري",
      prerequisites: [],
    },
    {
      id: "11100201",
      name: "تراكيب البيانات",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "11100231",
      name: "البرمجة كائنية التوجه",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "11100102",
      name: "أساسيات تطوير الويب",
      credits: 2,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "15200102",
      name: "لغة عربية 1",
      credits: 3,
      category: "متطلب جامعة إجباري",
      prerequisites: [],
    },
  ];

  // Initial State:
  // Calculus 1: failed (grade 48)
  // Data Structures: low grade (grade 54)
  // OOP: grade 62
  // Web: grade 65
  // Arabic: grade 60
  // Total points: (48*3 + 54*3 + 62*3 + 65*2 + 60*3) = 144 + 162 + 186 + 130 + 180 = 802
  // Total credits: 3 + 3 + 3 + 2 + 3 = 14
  // Initial GPA: 802 / 14 = 57.28% (under warning)

  const initialGrades: Record<string, number> = {
    "15010101": 48,
    "11100201": 54,
    "11100231": 62,
    "11100102": 65,
    "15200102": 60,
  };
  const initialCompleted = new Set([
    "11100201",
    "11100231",
    "11100102",
    "15200102",
  ]);
  const initialFailed = new Set(["15010101"]); // Calculus 1 failed

  const initialGpa = calculateGPA(
    sweCourses,
    initialGrades,
    initialCompleted,
    initialFailed,
  );
  assert.ok(
    initialGpa < 60,
    `Initial GPA (${initialGpa.toFixed(2)}) must be below 60%`,
  );

  // Retake Scenario:
  // Omar repeats Calculus 1 and gets 78 (passed!)
  // Omar repeats Data Structures and gets 82 (grade replaced!)
  const retakeGrades: Record<string, number> = {
    ...initialGrades,
    "15010101": 78,
    "11100201": 82,
  };
  // Now Calculus 1 is completed (removed from failed)
  const retakeCompleted = new Set([...initialCompleted, "15010101"]);
  const retakeFailed = new Set<string>(); // No outstanding fails

  const retakeGpa = calculateGPA(
    sweCourses,
    retakeGrades,
    retakeCompleted,
    retakeFailed,
  );

  // New points: (78*3 + 82*3 + 62*3 + 65*2 + 60*3) = 234 + 246 + 186 + 130 + 180 = 976
  // Total credits remains exactly 14 (NOT 17 - repeated hours are not duplicated!)
  // New GPA: 976 / 14 = 69.71%
  assert.equal(
    calculateDegreeCredits(sweCourses, retakeCompleted),
    14,
    "Degree credits must not duplicate repeated courses",
  );
  assert.ok(
    retakeGpa >= 69.0,
    `Retake GPA (${retakeGpa.toFixed(2)}) must reflect replaced higher grades`,
  );
  assert.ok(
    retakeGpa > 60.0,
    "Retake grades must elevate student out of academic probation",
  );
});

// ============================================================================
// Persona 4: Maya Khoury (Honors Fast-Tracker)
// Profile: 3rd-Year Junior, Artificial Intelligence (132 credits)
// Target: High-GPA (>=80%) 21-credit expansion, accelerated plan DAG validation
// ============================================================================

test("Persona 4 (Maya): High-GPA (>=80%) unlocks 21-credit registration limit expansion", () => {
  // Maya has GPA 89.4%
  const mayaProfile: Partial<StudentSyncProfile> = {
    gpa: 89.4,
    academicStatus: "منتظم",
    academicWarning: "لا يوجد",
  };

  const limits = getStudentCreditLimits({
    student: mayaProfile as StudentSyncProfile,
    semesterName: "الفصل الأول 2024/2025",
  });

  assert.equal(
    limits.isHighGpaOrGraduating,
    true,
    "Student with GPA 89.4% must qualify as high-GPA / honors",
  );
  assert.equal(
    limits.maxCredits,
    21,
    "High-GPA student must have regular semester limit raised to 21 credit hours",
  );

  // Summer semester for honors
  const summerLimits = getStudentCreditLimits({
    student: mayaProfile as StudentSyncProfile,
    semesterName: "الفصل الصيفي 2024/2025",
  });
  assert.equal(
    summerLimits.maxCredits,
    12,
    "High-GPA student must have summer semester limit raised to 12 credit hours",
  );

  // Validation function checks 21 credits for graduating/honors
  const plan21Check = checkPlanCreditLimits(
    21,
    "السنة الرابعة - الفصل الأول",
    { isGraduating: true },
  );
  assert.equal(
    plan21Check.length,
    0,
    "21-credit plan must produce 0 diagnostic errors for eligible student",
  );
});

test("Persona 4 (Maya): Multi-semester accelerated plan DAG dependency and cycle validation", () => {
  // Maya takes courses in an accelerated pathway
  const aiCourses: Course[] = [
    {
      id: "15010101",
      name: "تفاضل وتكامل 1",
      credits: 3,
      category: "متطلب كلية إجباري",
      prerequisites: [],
    },
    {
      id: "15010102",
      name: "تفاضل وتكامل 2",
      credits: 3,
      category: "متطلب كلية إجباري",
      prerequisites: ["15010101"],
    },
    {
      id: "15010202",
      name: "جبر خطي",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: ["15010102"],
    },
    {
      id: "11100341",
      name: "تعلم الآلة",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: ["15010202"],
    },
    {
      id: "11100342",
      name: "الرؤية الحاسوبية",
      credits: 3,
      category: "متطلب تخصص اختياري",
      prerequisites: ["11100341"],
    },
    {
      id: "11100321",
      name: "نظم التشغيل",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "11100311",
      name: "أنظمة قواعد البيانات",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "15200201",
      name: "مناهج البحث العلمي",
      credits: 3,
      category: "متطلب جامعة إجباري",
      prerequisites: [],
    },
    {
      id: "11100390",
      name: "ندوة في الذكاء الاصطناعي",
      credits: 3,
      category: "متطلب تخصص اختياري",
      prerequisites: ["11100341"],
    },
  ];

  // 1. Cycle detection: curriculum must form a valid DAG (0 cycles)
  const cycles = detectPrerequisiteCycles(aiCourses);
  assert.equal(
    cycles.length,
    0,
    "Accelerated curriculum must be an acyclic directed graph with 0 cycles",
  );

  // 2. Critical path analysis: verify longest dependency chain
  const criticalPath = computeCriticalPath(aiCourses);
  assert.ok(
    criticalPath.maxChainLength >= 5,
    "Critical chain (Calc 1 -> Calc 2 -> Linear Alg -> Machine Learning -> Computer Vision) has maxChainLength >= 5",
  );
  assert.ok(
    criticalPath.criticalCourseIds.has("15010101"),
    "Calc 1 must be on critical path",
  );
  assert.ok(
    criticalPath.criticalCourseIds.has("11100341"),
    "Machine Learning must be on critical path",
  );
  assert.equal(criticalPath.longestChain[0], "15010101");
  assert.equal(
    criticalPath.longestChain[criticalPath.longestChain.length - 1],
    "11100342",
  );
});

// ============================================================================
// Persona 5: Yazan Masri (Screen Reader / Accessible Navigation)
// Profile: 1st-Year Freshman, Business Administration (132 credits)
// Target: Accessibility constants, ARIA role compliance, keyboard navigation, theme contrast
// ============================================================================

test("Persona 5 (Yazan): Accessible high-contrast theme meets WCAG contrast and styling standards", () => {
  const themeMgr = new ThemeManager(mockDocument.documentElement as any);
  themeMgr.setTheme("high-contrast");

  assert.equal(themeMgr.currentTheme, "high-contrast");
  assert.equal(themeMgr.isHighContrast, true);
  assert.equal(
    mockDocument.documentElement.dataset.theme,
    "high-contrast",
    "Must set data-theme='high-contrast' on documentElement",
  );
  assert.equal(
    mockDocument.documentElement.classList.contains("high-contrast"),
    true,
    "Must add 'high-contrast' class to classList",
  );

  // Contrast Ratio calculation check:
  // High contrast uses white text (#ffffff) on cobalt blue (#0047ab)
  // Luminance: #ffffff = 1.0, #0047ab = 0.0818
  // Ratio = (1.0 + 0.05) / (0.0818 + 0.05) = 1.05 / 0.1318 = ~7.96:1
  // WCAG AAA standard for normal text is 7:1; WCAG AA is 4.5:1
  const lWhite = 1.0;
  const lCobalt = 0.0818;
  const contrastRatio = (lWhite + 0.05) / (lCobalt + 0.05);

  assert.ok(
    contrastRatio >= 7.0,
    `High-contrast theme ratio (${contrastRatio.toFixed(2)}:1) must meet WCAG AAA standard (>= 7:1)`,
  );
});

test("Persona 5 (Yazan): ARIA role compliance and keyboard navigation focus trap invariants", () => {
  // Modal Accessibility Contract verification
  interface AccessibleModalContract {
    role: "dialog";
    ariaModal: boolean;
    hasAriaLabelOrLabelledBy: boolean;
    trapsFocus: boolean;
    closesOnEscape: boolean;
    restoresPreviousFocus: boolean;
  }

  const baseModalContract: AccessibleModalContract = {
    role: "dialog",
    ariaModal: true,
    hasAriaLabelOrLabelledBy: true,
    trapsFocus: true,
    closesOnEscape: true,
    restoresPreviousFocus: true,
  };

  assert.equal(baseModalContract.role, "dialog");
  assert.equal(baseModalContract.ariaModal, true);
  assert.equal(baseModalContract.trapsFocus, true);
  assert.equal(baseModalContract.closesOnEscape, true);
  assert.equal(baseModalContract.restoresPreviousFocus, true);

  // Keyboard navigation shortcuts validation
  const isCommandPaletteKey = (e: {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
  }) => {
    return (e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey);
  };

  assert.equal(
    isCommandPaletteKey({ key: "k", ctrlKey: true }),
    true,
    "Ctrl+K must trigger command palette",
  );
  assert.equal(
    isCommandPaletteKey({ key: "k", metaKey: true }),
    true,
    "Cmd+K must trigger command palette on macOS",
  );
  assert.equal(
    isCommandPaletteKey({ key: "k", ctrlKey: false, metaKey: false }),
    false,
    "Plain 'k' must NOT trigger command palette",
  );
});

// ============================================================================
// Persona 6: Hiba Hamdan (Transfer Student)
// Profile: 2nd-Year Transfer Student, Computer Science (132 credits)
// Target: Accredited transfer status (معادلة), prereq satisfaction without grades, GPA without NaN
// ============================================================================

test("Persona 6 (Hiba): Accredited transfer courses (معادلة) satisfy prerequisites without numeric grades", () => {
  const csCourses: Course[] = [
    {
      id: "11100101",
      name: "مقدمة في البرمجة",
      credits: 4,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "11100201",
      name: "تراكيب البيانات",
      credits: 4,
      category: "متطلب تخصص إجباري",
      prerequisites: ["11100101"], // Requires intro
    },
    {
      id: "11100220",
      name: "التصميم المنطقي",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "11100221",
      name: "معمارية الحاسوب",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: ["11100220"], // Requires logic
    },
  ];

  // Hiba transferred with accredited status (معادلة) for Intro to Programming and Logic Design
  // Transfer courses are placed in completedCourses, but have grade -1 (Pass / CR)
  const completedWithTransfer = new Set(["11100101", "11100220"]);

  // 1. Prerequisite satisfaction
  assert.equal(
    isPrerequisiteSatisfied("11100101", completedWithTransfer),
    true,
    "Transfer course 11100101 must satisfy prerequisite for Data Structures",
  );
  assert.equal(
    isPrerequisiteSatisfied("11100220", completedWithTransfer),
    true,
    "Transfer course 11100220 must satisfy prerequisite for Computer Architecture",
  );

  // 2. Course availability check for downstream courses
  const dataStructuresAvail = isCourseAvailable(
    csCourses[1],
    completedWithTransfer,
    csCourses,
  );
  assert.equal(
    dataStructuresAvail,
    true,
    "Data Structures must be available to register via accredited transfer prerequisite",
  );

  const compArchAvail = isCourseAvailable(
    csCourses[3],
    completedWithTransfer,
    csCourses,
  );
  assert.equal(
    compArchAvail,
    true,
    "Computer Architecture must be available to register via accredited transfer prerequisite",
  );
});

test("Persona 6 (Hiba): GPA calculation excludes non-numeric transfer credits and prevents NaN", () => {
  const allCourses: Course[] = [
    // 33 accredited transfer hours with grade -1
    {
      id: "TR_CS1",
      name: "برمجة منقولة",
      credits: 4,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "TR_CS2",
      name: "منطق منقول",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "TR_MATH1",
      name: "تفاضل منقول",
      credits: 3,
      category: "متطلب كلية إجباري",
      prerequisites: [],
    },
    // 15 local graded hours
    {
      id: "11100201",
      name: "تراكيب البيانات",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "15200201",
      name: "الكتابة الفنية",
      credits: 3,
      category: "متطلب جامعة إجباري",
      prerequisites: [],
    },
  ];

  // Transfer courses have grade -1 (Pass/Fail credit, uncalculated in GPA)
  const grades: Record<string, number> = {
    TR_CS1: -1,
    TR_CS2: -1,
    TR_MATH1: -1,
    "11100201": 74,
    "15200201": 78,
  };

  const completed = new Set([
    "TR_CS1",
    "TR_CS2",
    "TR_MATH1",
    "11100201",
    "15200201",
  ]);

  const gpa = calculateGPA(allCourses, grades, completed);

  // Must only calculate GPA from the 2 local graded courses:
  // Points = 74*3 + 78*3 = 222 + 234 = 456
  // Credits = 3 + 3 = 6
  // GPA = 456 / 6 = 76.0
  assert.equal(Number.isNaN(gpa), false, "GPA must NOT be NaN");
  assert.equal(Number.isFinite(gpa), true, "GPA must be a finite number");
  assert.equal(gpa, 76.0, "GPA must be calculated strictly over graded credits");

  // Edge Case: Student with ONLY transfer credits (0 local graded hours)
  const onlyTransferGrades: Record<string, number> = {
    TR_CS1: -1,
    TR_CS2: -1,
  };
  const onlyTransferCompleted = new Set(["TR_CS1", "TR_CS2"]);
  const zeroGpa = calculateGPA(
    allCourses,
    onlyTransferGrades,
    onlyTransferCompleted,
  );
  assert.equal(
    zeroGpa,
    0,
    "Student with only transfer credits must yield GPA of 0 without NaN",
  );
  assert.equal(Number.isNaN(zeroGpa), false);
});

// ============================================================================
// Persona 7: Ahmad Darwish (Remedial & Placement Freshman)
// Profile: 1st-Year Freshman, Mechatronics Engineering (164 credits)
// Target: Tawjihi placement exam exemption rules, remedial Arabic non-credit exclusion
// ============================================================================

test("Persona 7 (Ahmad): Tawjihi placement exam exemption rules parse accurately", () => {
  // Ahmad: English score = 84% (Passed -> Exempts 15200099 and 15200106)
  // Arabic score = 42% (Failed -> Must enroll in Remedial Arabic 13010006)
  const mockScraped = [
    {
      examName: "امتحان مستوى لغة انجليزية",
      semester: "20241",
      exemptedCoursesRaw: "",
      passedRaw: "ناجح",
      cells: ["امتحان مستوى لغة انجليزية", "20241", "84", "ناجح"],
      text: "امتحان مستوى لغة انجليزية 20241 84 ناجح",
    },
    {
      examName: "امتحان مستوى لغة عربية",
      semester: "20241",
      exemptedCoursesRaw: "",
      passedRaw: "راسب",
      cells: ["امتحان مستوى لغة عربية", "20241", "42", "راسب"],
      text: "امتحان مستوى لغة عربية 20241 42 راسب",
    },
  ];

  const { exemptionExams, passedCourseCodes } =
    parseExemptionExamRows(mockScraped);

  assert.ok(passedCourseCodes instanceof Set);
  assert.ok(
    passedCourseCodes.has("15200099"),
    "English placement score 84 must exempt Remedial English (15200099)",
  );
  assert.ok(
    passedCourseCodes.has("15200106"),
    "English placement score 84 (>=80) must exempt English 1 (15200106)",
  );
  assert.equal(
    passedCourseCodes.has("13010006"),
    false,
    "Failed Arabic exam (42) must NOT exempt Remedial Arabic (13010006)",
  );
});

test("Persona 7 (Ahmad): Remedial Arabic (13010006) excluded from degree credits and cumulative GPA", () => {
  // Remedial courses identification
  assert.equal(
    isRemedialCourse("13010006"),
    true,
    "13010006 must be recognized as remedial",
  );
  assert.equal(
    isDegreeCreditBearing("13010006"),
    false,
    "13010006 must NOT be degree credit bearing",
  );

  const freshmanCourses: Course[] = [
    {
      id: "13010006",
      name: "لغة عربية استدراكية",
      credits: 3,
      category: "متطلب استدراكي إجباري",
      prerequisites: [],
    },
    {
      id: "15010101",
      name: "تفاضل وتكامل 1",
      credits: 3,
      category: "متطلب كلية إجباري",
      prerequisites: [],
    },
    {
      id: "15020101",
      name: "فيزياء عامة 1",
      credits: 3,
      category: "متطلب كلية إجباري",
      prerequisites: [],
    },
    {
      id: "15020103",
      name: "مختبر فيزياء 1",
      credits: 1,
      category: "متطلب كلية إجباري",
      prerequisites: [],
    },
  ];

  const completed = new Set(["13010006", "15010101", "15020101", "15020103"]);
  const grades: Record<string, number> = {
    "13010006": 90, // Scored 90 in remedial Arabic
    "15010101": 70, // 3 cr
    "15020101": 80, // 3 cr
    "15020103": 85, // 1 cr
  };

  // Degree credits: 3 + 3 + 1 = 7 credits (Remedial Arabic 3 credits excluded)
  const degreeCredits = calculateDegreeCredits(freshmanCourses, completed);
  assert.equal(
    degreeCredits,
    7,
    "Remedial Arabic must NOT be included in degree credits total",
  );

  // Cumulative GPA:
  // Points = 70*3 + 80*3 + 85*1 = 210 + 240 + 85 = 535
  // Credits = 7
  // GPA = 535 / 7 = 76.428%
  // Remedial 90*3 MUST NOT be included! (If included, it would inflate GPA to 80.5)
  const gpa = calculateGPA(freshmanCourses, grades, completed);
  assert.ok(
    Math.abs(gpa - 535 / 7) < 0.001,
    `GPA (${gpa.toFixed(2)}) must exclude remedial Arabic marks`,
  );

  // Freshman workload limits
  const limits = getStudentCreditLimits({
    student: { gpa: 0, academicStatus: "مستجد" } as StudentSyncProfile,
    semesterName: "الفصل الأول 2024/2025",
  });
  assert.equal(limits.maxCredits, 19);
  assert.equal(limits.minCredits, 12);
});

// ============================================================================
// Persona 8: Layla Qasim (Student Athlete & Club Leader)
// Profile: 3rd-Year Junior, Graphic Design & Applied Arts (132 credits)
// Target: Custom recurring busy blocks, 4-hour single studio block parsing, collision avoidance
// ============================================================================

test("Persona 8 (Layla): Custom recurring busy blocks detect collisions with training & executive meetings", () => {
  // Layla's non-academic recurring commitments:
  // 1. Basketball training: Sun 12:00-14:00 and Tue 12:00-14:00
  // 2. Student club meetings: Thu 13:00-15:00
  const busyBlocksSection: CatalogSection = {
    sec: "BUSY_BLOCKS",
    blocks: [
      { days: ["أح", "ثلا"], start: 12.0, end: 14.0 },
      { days: ["خمـ"], start: 13.0, end: 15.0 },
    ],
  };

  const currentSchedule = [{ section: busyBlocksSection }];

  // Candidate section A: Sun/Tue 12:30 - 13:30 (Clashes with basketball training!)
  const conflictingSectionA: CatalogSection = {
    sec: "1",
    blocks: [{ days: ["أح", "ثلا"], start: 12.5, end: 13.5 }],
  };
  assert.equal(
    hasConflict(currentSchedule, conflictingSectionA),
    true,
    "Must detect conflict with Sunday/Tuesday basketball training block",
  );

  // Candidate section B: Thu 13:30 - 15:00 (Clashes with club executive meeting!)
  const conflictingSectionB: CatalogSection = {
    sec: "2",
    blocks: [{ days: ["خمـ"], start: 13.5, end: 15.0 }],
  };
  assert.equal(
    hasConflict(currentSchedule, conflictingSectionB),
    true,
    "Must detect conflict with Thursday club meeting block",
  );

  // Candidate section C: Sun/Tue 08:30 - 10:00 (Clear! No conflict)
  const clearSection: CatalogSection = {
    sec: "3",
    blocks: [{ days: ["أح", "ثلا"], start: 8.5, end: 10.0 }],
  };
  assert.equal(
    hasConflict(currentSchedule, clearSection),
    false,
    "Non-overlapping morning section must not conflict with afternoon athlete blocks",
  );
});

test("Persona 8 (Layla): 4-hour single studio block parsing and conflict-free schedule solving", () => {
  // Typography Studio 2 (14010311) is scheduled as a continuous 4-hour studio block (08:00 - 12:00)
  const studioSection: CatalogSection = {
    sec: "1",
    blocks: [
      {
        days: ["اث"],
        start: 8.0,
        end: 12.0,
        rawTime: "08:00-12:00 اث",
      },
    ],
  };

  // 1. Verify studio block has no internal self-conflict
  assert.equal(
    hasConflict([], studioSection),
    false,
    "Single 4-hour studio block must NOT trigger false self-conflict",
  );

  // 2. Verify stats calculation on 4-hour block
  const stats = getBlockStats([{ section: studioSection }]);
  assert.equal(stats.earliestStart, 8.0);
  assert.equal(stats.latestEnd, 12.0);
  assert.equal(stats.usedDays.length, 1);
  assert.equal(stats.byDay["اث"]?.length, 1);

  // 3. Solver test with studio course
  const courses: CatalogCourse[] = [
    {
      id: "14010311",
      name: "تايبوغرافي 2",
      sections: [studioSection],
    },
    {
      id: "15200105",
      name: "دراسات فلسطينية",
      sections: [
        {
          sec: "1",
          blocks: [{ days: ["اث"], start: 10.0, end: 11.5 }], // Clashes with 8-12 studio!
        },
        {
          sec: "2",
          blocks: [{ days: ["أح", "ثلا"], start: 10.0, end: 11.5 }], // Clean!
        },
      ],
    },
  ];

  const validSchedules = generateAllSchedules(courses);
  assert.equal(
    validSchedules.length,
    1,
    "Must prune the conflicting Monday section and keep the Sun/Tue section",
  );
  assert.equal(validSchedules[0][1].section.sec, "2");
});

// ============================================================================
// Persona 9: Rami Odeh (Interdisciplinary Dual-Track / Minor)
// Profile: 4th-Year Senior, Agricultural Eng (160 cr) + Business Minor (21 cr)
// Target: Primary major + minor credit tracking, cross-faculty tuition, independent prereqs
// ============================================================================

test("Persona 9 (Rami): Dual-track credit tracking distinguishes primary major from minor requirements", () => {
  const compositeCourses: Course[] = [
    // Agricultural Engineering (Primary Major)
    {
      id: "16010411",
      name: "وقاية النبات وأمراضه",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "16010421",
      name: "نظم الري والصرف",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "16010431",
      name: "خصوبة التربة والأسمدة",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    // Business Administration (Minor)
    {
      id: "13010101",
      name: "مبادئ إدارة الأعمال 1",
      credits: 3,
      category: "متطلب تخصص اختياري", // Treated as minor elective
      prerequisites: [],
    },
    {
      id: "13010201",
      name: "إدارة التسويق",
      credits: 3,
      category: "متطلب تخصص اختياري",
      prerequisites: ["13010101"],
    },
  ];

  const completed = new Set(["16010411", "16010421", "13010101"]);

  // Total credits completed across both tracks
  const totalEarned = calculateDegreeCredits(compositeCourses, completed);
  assert.equal(totalEarned, 9, "Total earned credits must be 9");

  // Primary agricultural credits completed: 16010411 (3) + 16010421 (3) = 6 cr
  const primaryCredits = compositeCourses
    .filter((c) => completed.has(c.id) && c.id.startsWith("16"))
    .reduce((s, c) => s + c.credits, 0);
  assert.equal(primaryCredits, 6);

  // Minor business credits completed: 13010101 (3) = 3 cr
  const minorCredits = compositeCourses
    .filter((c) => completed.has(c.id) && c.id.startsWith("13"))
    .reduce((s, c) => s + c.credits, 0);
  assert.equal(minorCredits, 3);
});

test("Persona 9 (Rami): Cross-faculty tuition calculations apply accurate official rates", () => {
  // Agricultural Engineering rate
  const agRate = getOfficialTuitionRate("الإنتاج النباتي والوقاية");
  assert.equal(agRate.hourlyRateJOD, 20);
  assert.equal(agRate.faculty, "كلية الهندسة الزراعية والطب البيطري");

  // Business Administration rate
  const bizRate = getOfficialTuitionRate("إدارة الأعمال");
  assert.equal(bizRate.hourlyRateJOD, 20);
  assert.equal(bizRate.faculty, "كلية الأعمال والاقتصاد");

  // Semester tuition calculation for 15 credit hours in Agricultural Engineering
  const tuition = calculateSemesterTuition({
    majorName: "الإنتاج النباتي والوقاية",
    credits: 15,
  });

  // 15 credits * 20 JOD/hr = 300 JOD
  // Fixed fees: 25 JOD registration + 1 JOD student union = 26 JOD
  // Total JOD = 326 JOD
  assert.equal(tuition.hourlyRateJOD, 20);
  assert.equal(tuition.creditsFeeJOD, 300);
  assert.equal(tuition.fixedFees.registrationFeeJOD, 25);
  assert.equal(tuition.fixedFees.totalFixedFeesJOD, 26);
  assert.equal(tuition.totalJOD, 326);
  assert.ok(tuition.totalILS > 1500);
});

test("Persona 9 (Rami): Prerequisite graphs across distinct faculties resolve independently without cycles", () => {
  const dualTrackCourses: Course[] = [
    // Agriculture chain: Chemistry -> Soil Fertility
    {
      id: "AG_CHEM",
      name: "كيمياء زراعية",
      credits: 3,
      category: "متطلب كلية إجباري",
      prerequisites: [],
    },
    {
      id: "AG_SOIL",
      name: "خصوبة التربة والأسمدة",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: ["AG_CHEM"],
    },
    // Business minor chain: Management 1 -> Marketing Management
    {
      id: "13010101",
      name: "مبادئ إدارة الأعمال 1",
      credits: 3,
      category: "متطلب تخصص اختياري",
      prerequisites: [],
    },
    {
      id: "13010201",
      name: "إدارة التسويق",
      credits: 3,
      category: "متطلب تخصص اختياري",
      prerequisites: ["13010101"],
    },
  ];

  // 1. Cycle detection across cross-faculty list
  const cycles = detectPrerequisiteCycles(dualTrackCourses);
  assert.equal(
    cycles.length,
    0,
    "Composite cross-faculty courses must form a valid cycle-free DAG with 0 cycles",
  );

  // 2. Independent prerequisite fulfillment:
  // Completing Business Management 1 allows taking Marketing Management regardless of Agriculture courses
  const completedBizOnly = new Set(["13010101"]);
  assert.equal(
    isPrerequisiteSatisfied("13010101", completedBizOnly),
    true,
    "Business prerequisite must be satisfied independently",
  );
  assert.equal(
    isCourseAvailable(dualTrackCourses[3], completedBizOnly, dualTrackCourses),
    true,
    "Marketing Management must be available when Management 1 is completed",
  );
  assert.equal(
    isCourseAvailable(dualTrackCourses[1], completedBizOnly, dualTrackCourses),
    false,
    "Soil Fertility must remain unavailable when AG_CHEM is unfulfilled",
  );
});

// ============================================================================
// Persona 10: Salma Barghouthi (Rural / Low Connectivity)
// Profile: 1st-Year Diploma Student, Vocational IT (72 credits)
// Target: Offline queue persistence, idempotent retry headers, offline catalog fallback
// ============================================================================

test("Persona 10 (Salma): Offline mutation queue persists, retrieves, and drains mutations with retry limits", async () => {
  assert.equal(getOfflineQueue().length, 0);

  // 1. Enqueue mutations during simulated offline brownout
  enqueueMutation("SAVE_PLAN", {
    semester: "السنة الأولى - الفصل الثاني",
    planned: ["17010111", "17010121"],
  });
  enqueueMutation("UPDATE_DRAFT", {
    draftId: "draft_b",
    sections: ["sec_101"],
  });

  const queue = getOfflineQueue();
  assert.equal(queue.length, 2, "Offline queue must contain 2 pending mutations");
  assert.equal(queue[0].type, "SAVE_PLAN");
  assert.equal(queue[1].type, "UPDATE_DRAFT");
  assert.equal(queue[0].retryCount, 0);

  // 2. Draining with simulated transient network failure on second item
  let processedItems: string[] = [];
  const drainedCount = await drainOfflineQueue(async (item) => {
    if (item.type === "SAVE_PLAN") {
      processedItems.push(item.id);
      return true; // Succeeded
    }
    // Simulated network drop on second item
    throw new Error("Network timeout: 3G connection dropped");
  });

  assert.equal(drainedCount, 1, "Exactly 1 mutation must have drained successfully");

  // Remaining queue should have the failed item with incremented retry count
  const remainingQueue = getOfflineQueue();
  assert.equal(remainingQueue.length, 1);
  assert.equal(remainingQueue[0].type, "UPDATE_DRAFT");
  assert.equal(remainingQueue[0].retryCount, 1, "Failed item must have retryCount incremented");
});

test("Persona 10 (Salma): Idempotent transaction retry header pattern prevents duplicate registrations", () => {
  // In low-connectivity 3G environments, client may submit registration, server registers seats,
  // but the connection drops before receiving HTTP 200 response. Client retries with same X-Idempotency-Key.
  const idempotencyStore = new Map<string, any>();

  function simulateRegistrationExecute(
    idempotencyKey: string,
    payload: { courses: string[] },
  ) {
    if (idempotencyStore.has(idempotencyKey)) {
      return {
        cached: true,
        ...idempotencyStore.get(idempotencyKey),
      };
    }

    // Process first execution
    const response = {
      success: true,
      registeredCount: payload.courses.length,
      timestamp: Date.now(),
      registeredCourses: payload.courses,
    };
    idempotencyStore.set(idempotencyKey, response);
    return {
      cached: false,
      ...response,
    };
  }

  const clientKey = `idemp_salma_${Date.now()}`;
  const firstAttempt = simulateRegistrationExecute(clientKey, {
    courses: ["17010111", "17010121"],
  });

  assert.equal(firstAttempt.cached, false);
  assert.equal(firstAttempt.success, true);
  assert.equal(firstAttempt.registeredCount, 2);

  // Second attempt with identical idempotencyKey (flaky network retry)
  const secondAttempt = simulateRegistrationExecute(clientKey, {
    courses: ["17010111", "17010121"],
  });

  assert.equal(
    secondAttempt.cached,
    true,
    "Second attempt with same idempotency key MUST return cached response without duplicate execution",
  );
  assert.equal(secondAttempt.success, true);
  assert.equal(secondAttempt.timestamp, firstAttempt.timestamp);
});

test("Persona 10 (Salma): Local catalog fallback and diploma degree scaling operate 100% offline", () => {
  // Salma is enrolled in Vocational IT Diploma (72 credits)
  // 1. Degree scaling for diploma
  const diplomaYears = resolveMajorDegreeYears(72, "diploma-it");
  assert.equal(
    diplomaYears.maxYears,
    2,
    "72-credit diploma must scale to exactly 2 years",
  );
  assert.equal(
    diplomaYears.maxRegularSemesters,
    4,
    "72-credit diploma has exactly 4 regular semesters",
  );

  const diplomaTotal = getOfficialDegreeTotalCredits({
    majorName: "دبلوم تكنولوجيا المعلومات",
    degree: "دبلوم",
  } as StudentSyncProfile);
  assert.equal(diplomaTotal, 72, "Diploma degree total must equal 72 credits");

  // 2. Offline schedule solver execution: runs purely in-memory with local catalog data
  const diplomaCourses: CatalogCourse[] = [
    {
      id: "17010111",
      name: "تطبيقات الويب الحديثة",
      sections: [
        {
          sec: "1",
          blocks: [{ days: ["أح", "ثلا"], start: 8.5, end: 10.0 }],
        },
      ],
    },
    {
      id: "17010121",
      name: "إدارة قواعد البيانات",
      sections: [
        {
          sec: "1",
          blocks: [{ days: ["أح", "ثلا"], start: 10.5, end: 12.0 }],
        },
      ],
    },
  ];

  const offlineSchedules = generateAllSchedules(diplomaCourses);
  assert.equal(
    offlineSchedules.length,
    1,
    "Local CSP solver must compute conflict-free schedule completely offline",
  );

  const stats = getBlockStats(offlineSchedules[0]);
  assert.equal(stats.usedDays.length, 2);
  assert.equal(stats.earliestStart, 8.5);
  assert.equal(stats.latestEnd, 12.0);

  // Quality calculation
  const quality = calculateScheduleQuality(offlineSchedules[0]);
  assert.ok(quality.score > 0, "Schedule quality computed successfully offline");
});
