import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.resolve(ROOT_DIR, "src");

// ============================================================================
// BROWSER & DOM ENVIRONMENT SHIMS FOR NODE.JS TEST RUNNER
// ============================================================================

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

// ============================================================================
// DOMAIN MODULE IMPORTS
// ============================================================================

import {
  hasStudentAcademicWarning,
  getStudentCreditLimits,
  getOfficialDegreeTotalCredits,
  calculateOfficialTuition,
} from "../src/core/academicPolicy";
import {
  calculateDegreeCredits,
  calculateCategoryCredits,
  isRemedialCourse,
  isDegreeCreditBearing,
  calculateGPA,
  isCourseAvailable,
  isPrerequisiteSatisfied,
  getAcademicStandingInfo,
  resolveCapstoneThreshold,
  resolveFieldTrainingThreshold,
  computeCriticalPath,
  REMEDIAL_COURSE_IDS,
} from "../src/core/courseProgress";
import { simulateGpaForecast } from "../src/core/academicAdvisor";
import { resolveMajorDegreeYears } from "../src/core/advisoryPlan";
import {
  solveSchedule,
  generateAllSchedules,
  hasConflict,
  getBlockStats,
  normalizeDayKey,
  calculateScheduleQuality,
  explainScheduleConflicts,
} from "../src/services/scheduleSolver";
import type {
  CatalogCourse,
  CatalogSection,
  SolverCourse,
  GeneratedScheduleCourse,
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
import { parseExemptionExamRows } from "../server/services/studentPortalService.js";
import type { StudentSyncProfile } from "../src/services/studentService";
import type { Course } from "../src/data";

// ============================================================================
// ACCESSIBILITY & COLOR UTILITIES (WCAG 2.1 MATHEMATICAL FORMULAS)
// ============================================================================

function srgbToLinear(c: number): number {
  const norm = c / 255;
  return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

function calcRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function calcContrastRatio(hex1: string, hex2: string): number {
  const l1 = calcRelativeLuminance(hex1);
  const l2 = calcRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

beforeEach(() => {
  mockStorage.clear();
  mockDocument.documentElement.dataset = {};
  mockDocument.documentElement.classList._classes.clear();
});

// ============================================================================
// COMPREHENSIVE PERSONA JOURNEYS EVALUATION SUITE
// ============================================================================

describe("Milestone 3: 10-Student Persona Multi-Angle Evaluation Suite", () => {

  // ==========================================================================
  // PERSONA 1: Tariq Al-Najjar (Working Senior)
  // Major: Computer Systems Engineering (164 credits)
  // Constraints: Daily afternoon work shift at 14:00 (requires <= 13:30 cutoff),
  // Senior capstone + field training thresholds, non-meeting course handling
  // ==========================================================================
  describe("Persona 1: Tariq Al-Najjar (Working Senior)", () => {
    test("P1.1: 13:30 cutoff UI constraint omission and solver time filtering", () => {
      // 1. Audit WeeklyScheduleModal.tsx UI select options for commuter latest time
      const modalPath = path.join(SRC_DIR, "components", "modals", "WeeklyScheduleModal.tsx");
      const modalContent = fs.readFileSync(modalPath, "utf8");

      assert.ok(
        modalContent.includes('id="commuter-latest-time"'),
        "WeeklyScheduleModal.tsx must contain commuter-latest-time selector",
      );

      // Verify available discrete time options
      assert.ok(modalContent.includes('value="14:00"'), "Must contain 14:00 option");
      assert.ok(modalContent.includes('value="15:00"'), "Must contain 15:00 option");
      assert.ok(modalContent.includes('value="15:30"'), "Must contain 15:30 option");
      assert.ok(modalContent.includes('value="16:00"'), "Must contain 16:00 option");
      assert.ok(modalContent.includes('value="17:00"'), "Must contain 17:00 option");

      // Verify omission of 13:30 and 13:00
      assert.equal(
        modalContent.includes('value="13:30"'),
        false,
        "WeeklyScheduleModal UI select must lack 13:30 option, blocking Tariq from selecting his shift cutoff",
      );
      assert.equal(
        modalContent.includes('value="13:00"'),
        false,
        "WeeklyScheduleModal UI select must lack 13:00 option",
      );

      // 2. Programmatically evaluate solver behavior when filtering for 13:30 cutoff
      // Tariq must leave campus by 13:30 (810 minutes from midnight)
      const courses: SolverCourse[] = [
        {
          id: "15010451", // Distributed Systems
          options: [
            {
              section: "1",
              startTime: "10:00",
              endTime: "11:30",
              blocks: [{ days: ["أح", "ثلا"], start: 10.0, end: 11.5 }], // Morning - OK
            },
            {
              section: "2",
              startTime: "12:30",
              endTime: "14:00",
              blocks: [{ days: ["أح", "ثلا"], start: 12.5, end: 14.0 }], // Ends 14:00 - Collides with work shift
            },
          ],
        },
      ];

      const solved = solveSchedule(courses, {
        preferredEnd: "13:30",
        maxResults: 10,
      });

      assert.ok(solved.schedules.length > 0, "Solver should return valid morning schedule");
      const firstSchedule = solved.schedules[0];
      assert.ok(firstSchedule, "First schedule must exist");
      assert.ok(
        firstSchedule.stats.latestEnd !== null && firstSchedule.stats.latestEnd <= "13:30",
        `All sections in solved schedule must finish by 13:30 (got ${firstSchedule.stats.latestEnd})`,
      );
      const assignedEntry = firstSchedule.entries.find((e) => e.courseId === "15010451");
      assert.ok(assignedEntry, "Must assign course 15010451");
      assert.equal(assignedEntry.section, "1", "Must select morning Section 1");
    });

    test("P1.2: Zero-section course solver abort behavior (Field Training 15010400)", () => {
      // Field training (15010400) or Senior Thesis has no timetable lecture section (sections: [])
      const catalogCoursesWithZeroSections: CatalogCourse[] = [
        {
          id: "15010451",
          code: "15010451",
          name: "أنظمة موزعة",
          sections: [
            {
              sec: "1",
              instructor: "د. أحمد",
              blocks: [{ days: ["أح", "ثلا"], start: 570, end: 660 }],
            },
          ],
        },
        {
          id: "15010400",
          code: "15010400",
          name: "التدريب الميداني",
          sections: [], // 0 sections in schedule offerings
        },
      ];

      // Calling generateAllSchedules with an empty sections course:
      const results = generateAllSchedules(catalogCoursesWithZeroSections);

      // In scheduleSolver.ts:451-458:
      // if (courses.some((course) => !Array.isArray(course.sections) || course.sections.length === 0)) return [];
      assert.equal(
        results.length,
        0,
        "generateAllSchedules immediately aborts and returns 0 schedules if any course has 0 sections",
      );

      // When 0-section non-meeting courses are filtered out beforehand:
      const filteredCourses = catalogCoursesWithZeroSections.filter(
        (c) => Array.isArray(c.sections) && c.sections.length > 0,
      );
      const recoverableResults = generateAllSchedules(filteredCourses);
      assert.ok(
        recoverableResults.length > 0,
        "Filtering out 0-section non-meeting courses allows solver to successfully produce valid schedules",
      );
    });

    test("P1.3: Senior capstone/training eligibility thresholds & UI placement audit", () => {
      // 164-credit Computer Systems Engineering degree
      const capstoneThreshold = resolveCapstoneThreshold(164);
      const trainingThreshold = resolveFieldTrainingThreshold(164);

      assert.equal(capstoneThreshold, 120, "Capstone requires exactly 120 credits in 164h engineering");
      assert.equal(trainingThreshold, 90, "Field Training requires exactly 90 credits in 164h engineering");

      // Tariq has 128 completed credits
      const standing = getAcademicStandingInfo(78.2, 128, 164);
      assert.equal(standing.canRegisterFieldTraining, true, "128 cr satisfies >=90 field training threshold");
      assert.equal(standing.canRegisterGradProject, true, "128 cr satisfies >=120 capstone threshold");
      assert.equal(standing.creditsToGradProject, 0);

      // Verify placement of eligibility banner in source files:
      const gpaPageContent = fs.readFileSync(path.join(SRC_DIR, "pages", "GPAPage.tsx"), "utf8");
      const planPageContent = fs.readFileSync(path.join(SRC_DIR, "pages", "PlanPage.tsx"), "utf8");

      assert.ok(
        gpaPageContent.includes("canRegisterGradProject") || gpaPageContent.includes("canRegisterFieldTraining"),
        "GPAPage.tsx contains senior milestone eligibility banner",
      );
      assert.equal(
        planPageContent.includes("canRegisterGradProject"),
        false,
        "PlanPage.tsx degree tree lacks senior milestone eligibility banner, misplacing it solely in GPAPage",
      );
    });
  });

  // ==========================================================================
  // PERSONA 2: Nour Zaidan (Commuter Sophomore)
  // Major: Civil Engineering (164 credits)
  // Constraints: Rural commuter arriving at 08:30 AM, leaving by 15:30 PM,
  // commuter mode preset wiping 08:30 morning classes, campus transit buffer
  // ==========================================================================
  describe("Persona 2: Nour Zaidan (Commuter Sophomore)", () => {
    test("P2.1: Commuter mode preset hardcodes 09:00 and purges 08:30 morning classes", () => {
      const modalPath = path.join(SRC_DIR, "components", "modals", "WeeklyScheduleModal.tsx");
      const modalContent = fs.readFileSync(modalPath, "utf8");

      // Verify commuter preset button hardcodes 09:00
      assert.ok(
        modalContent.includes('setEarliestClassTime("09:00")'),
        "Commuter preset button hardcodes earliestClassTime = '09:00'",
      );
      assert.ok(
        modalContent.includes('setLatestClassTime("15:30")'),
        "Commuter preset button hardcodes latestClassTime = '15:30'",
      );

      // Evaluate impact: Nour arrives on campus at 08:30 AM (510 minutes)
      // Calculus 3 (15010201) section 1 runs 08:30 - 10:00 (510 to 600 minutes)
      const sec0830: CatalogSection = {
        sec: "1",
        blocks: [{ days: ["أح", "ثلا"], start: 510, end: 600 }], // 08:30 AM
      };
      const sec1000: CatalogSection = {
        sec: "2",
        blocks: [{ days: ["أح", "ثلا"], start: 600, end: 690 }], // 10:00 AM
      };

      const earliestAllowedMinute = 9 * 60; // 09:00 = 540 minutes
      const isSec0830Pruned = sec0830.blocks.some((b) => b.start < earliestAllowedMinute);
      const isSec1000Pruned = sec1000.blocks.some((b) => b.start < earliestAllowedMinute);

      assert.equal(
        isSec0830Pruned,
        true,
        "Nour's 08:30 class is pruned by the 09:00 commuter preset despite her 08:30 arrival",
      );
      assert.equal(isSec1000Pruned, false, "10:00 class is retained");
    });

    test("P2.2: Misleading conflict explanation blaming manual user exclusion", () => {
      // When time filters exclude sections, WeeklyScheduleModal.tsx populates excludedSections
      const courses: CatalogCourse[] = [
        {
          id: "12040201",
          code: "12040201",
          name: "استاتيكا",
          sections: [
            {
              sec: "1",
              blocks: [{ days: ["أح", "ثلا"], start: 480, end: 570 }],
            },
          ],
        },
      ];

      // Filters simulating all sections excluded by time bounds
      const filters = {
        excludedSections: {
          "12040201": ["1"], // Section 1 was excluded
        },
      };

      const explanation = explainScheduleConflicts(courses, filters);
      assert.equal(explanation.hasConflict, true, "Should report conflict when all sections excluded");
      assert.ok(
        explanation.details.some((d) => d.includes('تم استبعاد جميع شعب المادة "استاتيكا" يدوياً')),
        "Conflict explanation misinforms the student that sections were manually excluded rather than time-filtered",
      );
    });

    test("P2.3: Zero transit buffer between campus buildings in schedule solver", () => {
      // Old Campus Surveying Lab (ends 10:00 = 600m)
      const labSection: CatalogSection = {
        sec: "1",
        blocks: [{ days: ["أح"], start: 480, end: 600 }],
      };
      // New Campus Calculus 3 (starts 10:00 = 600m)
      const lectureSection: CatalogSection = {
        sec: "1",
        blocks: [{ days: ["أح"], start: 600, end: 690 }],
      };

      // Evaluate solver hasConflict
      const conflictDetected = hasConflict([{ section: labSection }], lectureSection);
      assert.equal(
        conflictDetected,
        false,
        "Solver reports 0 conflict for back-to-back classes with 0 minutes between separate campus buildings",
      );

      // Evaluate quality gap score: gap = 0 gives maximum score
      const stats = getBlockStats([{ section: labSection }, { section: lectureSection }]);
      assert.equal(stats.totalGap, 0, "Schedule quality awards totalGap = 0 despite physical transit impossibility");

      const quality = calculateScheduleQuality([{ section: labSection }, { section: lectureSection }]);
      assert.equal(quality.breakdown.gapsScore, 40, "Gaps score is rewarded with maximum 40 points");
    });

    test("P2.4: Commuter schedule solving minimizes days on campus (min_days preference)", () => {
      const courses: SolverCourse[] = [
        {
          id: "12040201",
          options: [
            {
              section: "1",
              startTime: "09:30",
              endTime: "11:00",
              blocks: [{ days: ["أح", "ثلا"], start: 9.5, end: 11.0 }], // 2 days
            },
            {
              section: "2",
              startTime: "09:00",
              endTime: "10:00",
              blocks: [{ days: ["سب", "اث", "أرب"], start: 9.0, end: 10.0 }], // 3 days
            },
          ],
        },
        {
          id: "15010201",
          options: [
            {
              section: "1",
              startTime: "11:30",
              endTime: "13:00",
              blocks: [{ days: ["أح", "ثلا"], start: 11.5, end: 13.0 }], // 2 days matching
            },
            {
              section: "2",
              startTime: "10:00",
              endTime: "11:00",
              blocks: [{ days: ["سب", "اث", "أرب"], start: 10.0, end: 11.0 }], // 3 days
            },
          ],
        },
      ];

      const result = solveSchedule(courses, {
        maxWorkDays: 3,
        maxResults: 5,
      });

      assert.ok(result.schedules.length > 0, "Must produce schedules");
      const topSchedule = result.schedules[0];
      assert.ok(topSchedule, "Top schedule must exist");
      assert.ok(topSchedule.stats.workDays <= 3, "Top schedule for commuter must minimize days on campus");
    });
  });

  // ==========================================================================
  // PERSONA 3: Omar Abu-Saleh (Academic Warning / Probation)
  // Major: Software Engineering (132 credits)
  // Constraints: GPA 57.8%, Academic warning, 14-credit hard limit,
  // Retake grade replacement calculation, What-If simulation bugs
  // ==========================================================================
  describe("Persona 3: Omar Abu-Saleh (Academic Warning / Probation)", () => {
    test("P3.1: Academic warning detection and 14-credit regular / 6-credit summer limits", () => {
      const omarProfile: Partial<StudentSyncProfile> = {
        gpa: 57.8,
        academicStatus: "تحت الملاحظة الأكاديمية",
        academicWarning: "إنذار أول",
      };

      // 1. Detection
      assert.equal(
        hasStudentAcademicWarning(omarProfile as StudentSyncProfile),
        true,
        "Student with GPA 57.8% and warning text must be identified as under academic warning",
      );

      // 2. Regular semester credit limits
      const regularLimits = getStudentCreditLimits({
        student: omarProfile as StudentSyncProfile,
        semesterName: "الفصل الأول 2024/2025",
      });
      assert.equal(regularLimits.maxCredits, 14, "Regular semester limit must be strictly 14 credits");
      assert.equal(regularLimits.minCredits, 12, "Regular semester min limit is 12 credits");

      // 3. Summer semester credit limits
      const summerLimits = getStudentCreditLimits({
        student: omarProfile as StudentSyncProfile,
        semesterName: "الفصل الصيفي 2024/2025",
      });
      assert.equal(summerLimits.maxCredits, 6, "Summer semester limit under probation must be strictly 6 credits");

      // 4. Registration enforcement checkPlanCreditLimits
      const validRegular = checkPlanCreditLimits(14, "الفصل الأول 2024/2025", {
        hasAcademicWarning: true,
        gpa: 57.8,
      });
      assert.equal(validRegular.length, 0, "14 credits must pass checkPlanCreditLimits");

      const invalidRegular = checkPlanCreditLimits(15, "الفصل الأول 2024/2025", {
        hasAcademicWarning: true,
        gpa: 57.8,
      });
      assert.equal(invalidRegular.length, 1, "15 credits must exceed credit limit");
      const diagReg = invalidRegular[0];
      assert.ok(diagReg);
      assert.equal(diagReg.code, "CREDIT_LIMIT_EXCEEDED");

      const validSummer = checkPlanCreditLimits(6, "الفصل الصيفي 2024/2025", {
        hasAcademicWarning: true,
        gpa: 57.8,
      });
      assert.equal(validSummer.length, 0, "6 credits in summer must pass");

      const invalidSummer = checkPlanCreditLimits(7, "الفصل الصيفي 2024/2025", {
        hasAcademicWarning: true,
        gpa: 57.8,
      });
      assert.equal(invalidSummer.length, 1, "7 credits in summer must exceed 6 credit limit");
    });

    test("P3.2: Retake grade replacement cumulative GPA calculation and warning clearance", () => {
      // Omar has 58 credits passed (average ~58.2%) + failed Calculus 1 (3 cr, grade 50) = 61 total attempted credits
      const courses: Course[] = [
        { id: "15010101", name: "تفاضل وتكامل 1", credits: 3, category: "متطلب كلية إجباري", prerequisites: [] },
        { id: "15010102", name: "فيزياء 1", credits: 3, category: "متطلب كلية إجباري", prerequisites: [] },
        { id: "11100101", name: "برمجة 1", credits: 4, category: "متطلب كلية إجباري", prerequisites: [] },
      ];

      // Initial state: Calculus 1 has failing grade 50
      const initialGrades: Record<string, number> = {
        "15010101": 50,
        "15010102": 60,
        "11100101": 60,
      };
      const completedInitial = new Set(["15010102", "11100101"]); // 15010101 is failed, not in completed
      const failedCourseIds = new Set(["15010101"]);

      const initialGPA = calculateGPA(courses, initialGrades, completedInitial, failedCourseIds);
      // Quality points = (3*50 + 3*60 + 4*60) / 10 = (150 + 180 + 240) / 10 = 57.0%
      assert.equal(initialGPA, 57.0, "Initial GPA reflects failing grade 50");

      // Omar retakes Calculus 1 and scores 82
      const retakeGrades: Record<string, number> = {
        ...initialGrades,
        "15010101": 82, // Retake grade replaces 50
      };
      const completedAfterRetake = new Set(["15010101", "15010102", "11100101"]);
      const failedAfterRetake = new Set<string>();

      const retakeGPA = calculateGPA(courses, retakeGrades, completedAfterRetake, failedAfterRetake);
      // Quality points = (3*82 + 3*60 + 4*60) / 10 = (246 + 180 + 240) / 10 = 66.6%
      assert.equal(retakeGPA, 66.6, "Retake grade 82 completely replaces 50, lifting GPA above 60% warning line");
      assert.ok(retakeGPA >= 60.0, "Probation is cleared upon grade replacement");
    });

    test("P3.3: What-If simulation stale earned credits bug in GPAPage.tsx", () => {
      const gpaPagePath = path.join(SRC_DIR, "pages", "GPAPage.tsx");
      const gpaPageContent = fs.readFileSync(gpaPagePath, "utf8");

      // Inspect lines 315-335 of GPAPage.tsx:
      // projectedGPA merges completedCourses and whatIfGrades
      assert.ok(
        gpaPageContent.includes("mergedCompleted = new Set(["),
        "GPAPage must declare mergedCompleted for projectedGPA",
      );

      // Verify that earnedCredits passes unmerged completedCourses rather than mergedCompleted
      assert.ok(
        gpaPageContent.includes("calculateDegreeCredits(courses, completedCourses)"),
        "GPAPage passes unmerged completedCourses to calculateDegreeCredits in earnedCredits useMemo",
      );

      // Demonstrate programmatic consequence:
      const courses: Course[] = [
        { id: "15010101", name: "تفاضل وتكامل 1", credits: 3, category: "متطلب كلية إجباري", prerequisites: [] },
        { id: "15010102", name: "فيزياء 1", credits: 3, category: "متطلب كلية إجباري", prerequisites: [] },
      ];
      const completedCourses = new Set(["15010102"]); // 3 credits
      const whatIfGrades = { "15010101": 85 }; // Simulating passing Calculus 1

      const frozenEarnedCredits = calculateDegreeCredits(courses, completedCourses);
      const mergedCompleted = new Set([...Array.from(completedCourses), ...Object.keys(whatIfGrades)]);
      const trueProjectedEarnedCredits = calculateDegreeCredits(courses, mergedCompleted);

      assert.equal(frozenEarnedCredits, 3, "UI displays frozen 3 credits");
      assert.equal(trueProjectedEarnedCredits, 6, "True projected earned credits should be 6");
      assert.notEqual(
        frozenEarnedCredits,
        trueProjectedEarnedCredits,
        "Confirms What-If earned credits staleness bug in GPAPage",
      );
    });
  });

  // ==========================================================================
  // PERSONA 4: Maya Khoury (Honors Fast-Tracker)
  // Major: Artificial Intelligence (132 credits)
  // Constraints: GPA 89.4%, 21-credit overload discrepancy in checkPlanCreditLimits,
  // Combinatorial load across 7 courses in solver, worker fallback
  // ==========================================================================
  describe("Persona 4: Maya Khoury (Honors Fast-Tracker)", () => {
    test("P4.1: Critical policy discrepancy in checkPlanCreditLimits for high-GPA non-graduating students", () => {
      // Maya: 3rd-Year student, GPA 89.4%, not graduating yet
      const mayaProfile: Partial<StudentSyncProfile> = {
        gpa: 89.4,
        academicStatus: "منتظم",
      };

      // 1. academicPolicy.ts correctly unlocks 21 credits based on gpa >= 80 alone
      const policyLimits = getStudentCreditLimits({
        student: mayaProfile as StudentSyncProfile,
        semesterName: "الفصل الأول 2024/2025",
      });
      assert.equal(policyLimits.maxCredits, 21, "academicPolicy permits 21 credits for GPA >= 80");

      // 2. semesterRegistration.ts: checkPlanCreditLimits ignores gpa >= 80 without isGraduating
      const registrationCheckWithoutGraduating = checkPlanCreditLimits(21, "الفصل الأول 2024/2025", {
        gpa: 89.4,
        isGraduating: false, // Maya is 3rd year
      });

      // DISCREPANCY VERIFICATION:
      assert.equal(
        registrationCheckWithoutGraduating.length,
        1,
        "Discrepancy confirmed: checkPlanCreditLimits fails 21 credits because isGraduating is false",
      );
      const diagMaya = registrationCheckWithoutGraduating[0];
      assert.ok(diagMaya);
      assert.equal(diagMaya.code, "CREDIT_LIMIT_EXCEEDED");
      assert.ok(
        diagMaya.detail.includes("19"),
        "Discrepancy detail caps at 19 credits despite GPA 89.4%",
      );

      // If isGraduating: true is explicitly passed, it passes:
      const registrationCheckWithGraduating = checkPlanCreditLimits(21, "الفصل الأول 2024/2025", {
        gpa: 89.4,
        isGraduating: true,
      });
      assert.equal(registrationCheckWithGraduating.length, 0, "Passes when isGraduating is true");
    });

    test("P4.2: 7-course combinatorial solver load and scheduleSolverClient 15s UI thread fallback audit", () => {
      // 1. Audit scheduleSolverClient.ts for fallback execution on main thread
      const clientPath = path.join(SRC_DIR, "services", "scheduleSolverClient.ts");
      const clientContent = fs.readFileSync(clientPath, "utf8");

      assert.ok(
        clientContent.includes("setTimeout"),
        "scheduleSolverClient.ts must contain worker timeout handler",
      );
      assert.ok(
        clientContent.includes("15000"),
        "scheduleSolverClient.ts sets timeout threshold at 15000ms",
      );
      assert.ok(
        clientContent.includes("resolve(fallbackFn())"),
        "On 15s timeout, client runs fallbackFn() synchronously on the main thread, freezing the UI",
      );

      // 2. Programmatically verify solver handling of 7 courses (21 credits)
      const courses7: SolverCourse[] = Array.from({ length: 7 }, (_, i) => ({
        id: `course_${i + 1}`,
        options: [
          {
            section: "1",
            startTime: `${8 + i}:00`,
            endTime: `${9 + i}:00`,
            blocks: [{ days: ["أح"], start: 8 + i, end: 9 + i }],
          },
          {
            section: "2",
            startTime: `${9 + i}:00`,
            endTime: `${10 + i}:00`,
            blocks: [{ days: ["ثلا"], start: 9 + i, end: 10 + i }],
          },
        ],
      }));

      const solveResult = solveSchedule(courses7, { maxResults: 5 });
      assert.ok(solveResult.schedules.length > 0, "Solver should resolve 7 courses under conflict-free arrangement");
      const sched = solveResult.schedules[0];
      assert.ok(sched, "Schedule must exist");
      assert.equal(sched.entries.length, 7, "All 7 courses must be assigned");
    });

    test("P4.3: Prerequisite DAG critical path acceleration for 3.5-year graduation", () => {
      const aiCourses: Course[] = [
        { id: "11100101", name: "برمجة 1", credits: 4, category: "متطلب كلية إجباري", prerequisites: [] },
        { id: "11100201", name: "برمجة 2 وتراكيب بيانات", credits: 4, category: "متطلب تخصص إجباري", prerequisites: ["11100101"] },
        { id: "11100311", name: "خوارزميات", credits: 3, category: "متطلب تخصص إجباري", prerequisites: ["11100201"] },
        { id: "11100421", name: "تعلم الآلة", credits: 3, category: "متطلب تخصص إجباري", prerequisites: ["11100311"] },
        { id: "11100431", name: "التعلم العميق", credits: 3, category: "متطلب تخصص إجباري", prerequisites: ["11100421"] },
      ];

      const criticalPath = computeCriticalPath(aiCourses);
      assert.ok(criticalPath.longestChain.length >= 4, "Critical path through Deep Learning must span at least 4 courses");
      const firstCourseId = criticalPath.longestChain[0];
      const lastCourseId = criticalPath.longestChain[criticalPath.longestChain.length - 1];
      assert.equal(firstCourseId, "11100101", "Root prerequisite is Programming 1");
      assert.equal(lastCourseId, "11100431", "Target course is Deep Learning");
    });
  });

  // ==========================================================================
  // PERSONA 5: Yazan Masri (Screen Reader / WCAG Accessibility)
  // Major: Business Administration (132 credits)
  // Constraints: NVDA/VoiceOver screen reader user, keyboard navigation,
  // 24 ad-hoc modals missing focus trap, contrast 2.56:1, course 13010006 defect
  // ==========================================================================
  describe("Persona 5: Yazan Masri (Screen Reader / WCAG Accessibility)", () => {
    test("P5.1: 24 ad-hoc modals focus trap omission audit across components and pages", () => {
      // 1. Reference: BaseModal.tsx has proper Tab and Escape trapping
      const baseModalPath = path.join(SRC_DIR, "components", "common", "BaseModal.tsx");
      const baseModalContent = fs.readFileSync(baseModalPath, "utf8");
      assert.ok(
        baseModalContent.includes('event.key === "Tab"') ||
        baseModalContent.includes('event.key !== "Tab"') ||
        baseModalContent.includes('e.key === "Tab"'),
        "BaseModal.tsx must trap Tab key",
      );
      assert.ok(
        baseModalContent.includes('event.key === "Escape"') ||
        baseModalContent.includes('e.key === "Escape"'),
        "BaseModal.tsx must handle Escape key",
      );

      // 2. 12 ad-hoc modals in components/modals lacking Tab trap
      const adHocModalFiles = [
        "AcademicAdvisorModal.tsx",
        "AcademicCalendarModal.tsx",
        "CommandPaletteModal.tsx",
        "CourseComparisonDrawer.tsx",
        "DoctorScheduleModal.tsx",
        "ExportModal.tsx",
        "MajorSelectorModal.tsx",
        "MajorTransferModal.tsx",
        "ResetConfirmationModal.tsx",
        "SectionSwapModal.tsx",
        "StudentRecordsModal.tsx",
        "SystemHealthModal.tsx",
      ];

      for (const modalFile of adHocModalFiles) {
        const filePath = path.join(SRC_DIR, "components", "modals", modalFile);
        const content = fs.readFileSync(filePath, "utf8");
        const hasTabTrap =
          content.includes('e.key === "Tab"') ||
          content.includes('event.key === "Tab"') ||
          content.includes("trapFocus");
        assert.equal(hasTabTrap, false, `${modalFile} must lack Tab focus trap`);
      }

      // 3. 12 inline page-embedded ad-hoc modals in primary pages
      const pageAdHocModals = [
        { file: "src/pages/CoursesPage.tsx", flags: ["gpaModalCourse", "selectedCourseForTracking"] },
        { file: "src/pages/GPAPage.tsx", flags: ["isAddPickerOpen"] },
        { file: "src/pages/SemesterPlanningPage.tsx", flags: ["showMobilePlannedSheet", "confirmClearOpen"] },
        {
          file: "src/pages/RegistrationPage.tsx",
          flags: [
            "showTestModal",
            "showCompareModal",
            "safeSwapCourseId",
            "showShareModal",
            "showSuggestModal",
            "isAddModalOpen",
            "showResetModal",
          ],
        },
      ];

      let inlineCount = 0;
      for (const item of pageAdHocModals) {
        const content = fs.readFileSync(path.join(ROOT_DIR, item.file), "utf8");
        for (const flag of item.flags) {
          assert.ok(content.includes(flag), `${item.file} must declare inline modal state '${flag}'`);
          inlineCount++;
        }
      }

      assert.equal(adHocModalFiles.length + inlineCount, 24, "Total ad-hoc modals without focus trap must equal 24");

      // Verify specific modals lacking Escape listener
      const coursesPageContent = fs.readFileSync(path.join(SRC_DIR, "pages", "CoursesPage.tsx"), "utf8");
      assert.equal(
        coursesPageContent.includes("gpaModalCourse") && !coursesPageContent.includes("closeGpaModalOnEscape"),
        true,
        "CoursesPage gpaModalCourse lacks Escape listener",
      );
    });

    test("P5.2: Mathematical color contrast verification (text-slate-400 failing at 2.56:1)", () => {
      const slate400 = "#94a3b8";
      const surfaceLight = "#ffffff";
      const ratio = calcContrastRatio(slate400, surfaceLight);
      const rounded = Math.round(ratio * 100) / 100;

      assert.equal(rounded, 2.56, "Calculated contrast ratio for #94a3b8 against white is exactly 2.56:1");
      assert.ok(rounded < 4.5, "2.56:1 fails WCAG 2.1 AA minimum 4.5:1 threshold");

      // Contrast in high-contrast theme: cobalt blue (#0047ab) against white
      const cobalt = "#0047ab";
      const highContrastRatio = calcContrastRatio(cobalt, surfaceLight);
      const roundedHighContrast = Math.round(highContrastRatio * 100) / 100;
      assert.ok(roundedHighContrast >= 7.0, `High contrast theme ratio (${roundedHighContrast}:1) exceeds WCAG AAA (7.0:1)`);
    });

    test("P5.3: Mandatory course 13010006 classification defect in courseProgress.ts", () => {
      // Course 13010006 is "مهارات الحاسوب وتطبيقاته", 1 credit, "متطلب جامعة إجباري"
      const compSkillsCourse: Course = {
        id: "13010006",
        name: "مهارات الحاسوب وتطبيقاته",
        credits: 1,
        category: "متطلب جامعة إجباري",
        prerequisites: [],
      };

      // 1. courseProgress.ts treats it as remedial
      assert.ok(REMEDIAL_COURSE_IDS.has("13010006"), "13010006 is included in REMEDIAL_COURSE_IDS");
      assert.equal(isRemedialCourse("13010006"), true, "isRemedialCourse returns true for 13010006");
      assert.equal(isDegreeCreditBearing("13010006"), false, "isDegreeCreditBearing returns false, stripping 1 credit");

      // 2. Degree calculation strips the credit
      const completed = new Set(["13010006"]);
      const degreeCredits = calculateDegreeCredits([compSkillsCourse], completed);
      assert.equal(degreeCredits, 0, "calculateDegreeCredits returns 0, creating a 1-credit graduation deficit");

      // 3. Category credits contradicts calculateDegreeCredits
      const categoryCredits = calculateCategoryCredits([compSkillsCourse], completed);
      assert.equal(
        categoryCredits["متطلب جامعة إجباري"],
        1,
        "calculateCategoryCredits counts 1 credit, creating an internal contradiction with calculateDegreeCredits",
      );
    });
  });

  // ==========================================================================
  // PERSONA 6: Hiba Hamdan (Transfer Student)
  // Major: Computer Science (132 credits)
  // Constraints: 48 earned credits (15 local graded + 33 accredited transfer hours 'CR' / -1),
  // Transfer credit mapping, GPA dilution bug in simulateGpaForecast (75.42% vs 77.00%)
  // ==========================================================================
  describe("Persona 6: Hiba Hamdan (Transfer Student)", () => {
    test("P6.1: Non-numeric transfer credits (grade: -1) satisfy prerequisites and prevent NaN in GPA", () => {
      const csCourses: Course[] = [
        { id: "11100101", name: "برمجة 1", credits: 4, category: "متطلب كلية إجباري", prerequisites: [] },
        { id: "11100201", name: "برمجة 2 وتراكيب بيانات", credits: 4, category: "متطلب تخصص إجباري", prerequisites: ["11100101"] },
      ];

      // Hiba completed Programming 1 at previous college (transferred as grade -1)
      const grades: Record<string, number> = { "11100101": -1 };
      const completed = new Set(["11100101"]);

      // Prerequisite satisfaction
      const isPrereqSatisfied = isPrerequisiteSatisfied("11100101", completed);
      assert.equal(isPrereqSatisfied, true, "Transferred course satisfies downstream prerequisite");

      // calculateGPA skips grade -1 and does not produce NaN
      const gpa = calculateGPA(csCourses, grades, completed, new Set());
      assert.equal(isNaN(gpa), false, "calculateGPA must not return NaN for transfer courses");
      assert.equal(gpa, 0, "No graded credits at PTUK yet -> GPA returns 0 without crashing");
    });

    test("P6.2: Mathematical GPA dilution bug in simulateGpaForecast (75.42% vs true 77.00%)", () => {
      // Hiba Hamdan has:
      // - 15 local graded hours at PTUK with current GPA = 74.0 (Quality points = 15 * 74.0 = 1110)
      // - 33 accredited transfer hours (non-numeric, 0 quality points in PTUK GPA)
      // - Total completed hours = 48
      // Upcoming: 15 hours with expected grade 80.0 (New points = 15 * 80 = 1200)

      // 1. Actual behavior of simulateGpaForecast when passing completedHours = 48
      const forecast = simulateGpaForecast({
        currentGpa: 74.0,
        completedHours: 48,
        upcomingCourses: [{ credits: 15, expectedGrade: 80 }],
      });

      // simulateGpaForecast multiplies currentGpa * completedHours (74.0 * 48 = 3552)
      // totalHours = 48 + 15 = 63
      // projectedGpa = (3552 + 1200) / 63 = 4752 / 63 = 75.4285... -> 75.43 or 75.42
      assert.ok(
        forecast.projectedGpa >= 75.42 && forecast.projectedGpa <= 75.43,
        `simulateGpaForecast calculates diluted GPA of ${forecast.projectedGpa}%`,
      );

      // 2. True PTUK academic GPA formula:
      // (local graded points + new points) / (local graded hours + new hours)
      // (1110 + 1200) / (15 + 15) = 2310 / 30 = 77.00%
      const truePoints = 15 * 74.0 + 15 * 80.0;
      const trueGradedHours = 15 + 15;
      const trueGpa = Math.round((truePoints / trueGradedHours) * 100) / 100;
      assert.equal(trueGpa, 77.00, "Authentic academic GPA under PTUK regulations is 77.00%");

      // 3. Mathematical dilution error
      const dilution = Math.round((trueGpa - forecast.projectedGpa) * 100) / 100;
      assert.ok(
        dilution >= 1.57 && dilution <= 1.58,
        `simulateGpaForecast dilutes Hiba's GPA by ${dilution} percentage points (75.42% vs 77.00%)`,
      );
    });

    test("P6.3: Transcript reset grade erasure in GPAPage.tsx (grade > 0 drops grade: -1)", () => {
      const gpaPagePath = path.join(SRC_DIR, "pages", "GPAPage.tsx");
      const gpaPageContent = fs.readFileSync(gpaPagePath, "utf8");

      // Verify handleRestoreOriginalGrades condition in lines 219 and 232
      assert.ok(
        gpaPageContent.includes("typeof c.grade === \"number\" && !isNaN(c.grade) && c.grade > 0"),
        "GPAPage.tsx filters grades strictly with c.grade > 0",
      );

      // Programmatic demonstration:
      const coursesFromTranscript = [
        { code: "11100101", grade: -1 }, // Transfer course
        { code: "11100102", grade: 75 }, // Graded course
      ];

      const restoredGrades: Record<string, number> = {};
      for (const c of coursesFromTranscript) {
        if (typeof c.grade === "number" && !isNaN(c.grade) && c.grade > 0) {
          restoredGrades[c.code] = c.grade;
        }
      }

      assert.equal(restoredGrades["11100102"], 75, "Graded course 11100102 is preserved");
      assert.equal(
        restoredGrades["11100101"],
        undefined,
        "Transfer course 11100101 (grade: -1) is erased from restoredGrades because -1 is not > 0",
      );
    });
  });

  // ==========================================================================
  // PERSONA 7: Ahmad Darwish (Remedial Freshman)
  // Major: Mechatronics Engineering (164 credits)
  // Constraints: High school Tawjihi 86.4%, Placement exam exemption logic,
  // Remedial Arabic 13010006 workload/tuition billing vs degree exclusion
  // ==========================================================================
  describe("Persona 7: Ahmad Darwish (Remedial Freshman)", () => {
    test("P7.1: Tawjihi placement exam exemption rules parse accurately", () => {
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

      const { passedCourseCodes } = parseExemptionExamRows(mockScraped);
      assert.ok(passedCourseCodes instanceof Set);
      assert.ok(passedCourseCodes.has("15200099"), "English score 84 exempts Remedial English 15200099");
      assert.ok(passedCourseCodes.has("15200106"), "English score 84 exempts English 1 15200106");
      assert.equal(passedCourseCodes.has("13010006"), false, "Arabic score 42 does NOT exempt Remedial Arabic");
    });

    test("P7.2: Remedial Arabic workload/tuition inclusion vs degree and GPA exclusion", () => {
      // Ahmad registers 14 credits in Semester 1:
      // Calculus 1 (3 cr), Physics 1 (3 cr), Physics Lab (1 cr), Engineering Workshops (1 cr),
      // Intro to Engineering (3 cr), Remedial Arabic (3 cr)
      const semesterCredits = 14;

      // 1. Workload credit limits (must pass <= 19 credits)
      const workloadDiagnostics = checkPlanCreditLimits(semesterCredits, "الفصل الأول 2024/2025");
      assert.equal(workloadDiagnostics.length, 0, "14 credits is within the 19-credit freshman ceiling");

      // 2. Tuition billing: Remedial credits ARE billed under PTUK regulations
      const tuition = calculateSemesterTuition({
        majorName: "هندسة الميكاترونكس",
        credits: semesterCredits,
        isFreshman: false, // Standard recurring semester rate
      });

      // Rate for Mechatronics Engineering is 24 JOD/hr + 26 JOD fixed fees
      assert.equal(tuition.hourlyRateJOD, 24);
      assert.equal(tuition.creditsFeeJOD, 14 * 24, "All 14 registered credits including remedial hours are billed");
      assert.equal(tuition.fixedFees.totalFixedFeesJOD, 26, "Official standard fixed fees is 26 JOD (25 reg + 1 council)");
      assert.equal(tuition.totalJOD, 14 * 24 + 26, "Total semester tuition is 362 JOD");

      // 3. Degree credits: Remedial Arabic is EXCLUDED from earned degree hours toward 164
      const freshmanCourses: Course[] = [
        { id: "15010101", name: "تفاضل وتكامل 1", credits: 3, category: "متطلب كلية إجباري", prerequisites: [] },
        { id: "15010102", name: "فيزياء 1", credits: 3, category: "متطلب كلية إجباري", prerequisites: [] },
        { id: "15010103", name: "مختبر فيزياء 1", credits: 1, category: "متطلب كلية إجباري", prerequisites: [] },
        { id: "15010104", name: "مشاغل هندسية", credits: 1, category: "متطلب كلية إجباري", prerequisites: [] },
        { id: "15010105", name: "مقدمة في الهندسة", credits: 3, category: "متطلب تخصص إجباري", prerequisites: [] },
        { id: "15200099", name: "لغة عربية استدراكي", credits: 3, category: "متطلب استدراكي إجباري", prerequisites: [] },
      ];
      const completedFreshman = new Set(freshmanCourses.map((c) => c.id));
      const degreeCredits = calculateDegreeCredits(freshmanCourses, completedFreshman);
      assert.equal(
        degreeCredits,
        11,
        "calculateDegreeCredits yields only 11 degree credits, excluding 3 remedial Arabic credits",
      );

      // 4. GPA calculation: Remedial Arabic is EXCLUDED from cumulative GPA
      const grades: Record<string, number> = {
        "15010101": 70,
        "15010102": 70,
        "15010103": 80,
        "15010104": 90,
        "15010105": 75,
        "15200099": 60, // Passed remedial Arabic with 60
      };
      const gpa = calculateGPA(freshmanCourses, grades, completedFreshman, new Set());
      // Quality points for degree courses: (3*70 + 3*70 + 1*80 + 1*90 + 3*75) / 11 = (210 + 210 + 80 + 90 + 225) / 11 = 815 / 11 = 74.09%
      assert.equal(Math.round(gpa * 100) / 100, 74.09, "GPA calculation excludes Remedial Arabic (60) from cumulative average");
    });
  });

  // ==========================================================================
  // PERSONA 8: Layla Qasim (Student Athlete & Club Leader)
  // Major: Graphic Design & Applied Arts (132 credits)
  // Constraints: Recurring basketball training (Sun/Tue 12:00-14:00),
  // compound timetable key mismatch, multi-block studio adoption timing discard
  // ==========================================================================
  describe("Persona 8: Layla Qasim (Student Athlete & Club Leader)", () => {
    test("P8.1: Granular recurring busy blocks collision detection vs whole-day pruning", () => {
      // Basketball training: Sun/Tue 12:00 - 14:00 (720 to 840 mins)
      const athleteSection: CatalogSection = {
        sec: "training",
        blocks: [{ days: ["أح", "ثلا"], start: 720, end: 840 }],
      };

      // Candidate Section A: Sun/Tue 11:30 - 13:00 (690 to 780 mins) -> Collides!
      const secA: CatalogSection = {
        sec: "1",
        blocks: [{ days: ["أح", "ثلا"], start: 690, end: 780 }],
      };
      const collidesWithSecA = hasConflict([{ section: athleteSection }], secA);
      assert.equal(collidesWithSecA, true, "Section A colliding with training block is detected");

      // Candidate Section B: Sun/Tue 08:30 - 10:00 (510 to 600 mins) -> Conflict-free!
      const secB: CatalogSection = {
        sec: "2",
        blocks: [{ days: ["أح", "ثلا"], start: 510, end: 600 }],
      };
      const collidesWithSecB = hasConflict([{ section: athleteSection }], secB);
      assert.equal(collidesWithSecB, false, "Section B does not collide with training block");

      // CatalogScheduleFilters audit: filters only have coarse freeDays ("أح", "ثلا")
      // If Layla checks freeDays: ["أح", "ثلا"], it eliminates ALL classes on Sunday and Tuesday!
      const courses: CatalogCourse[] = [
        {
          id: "14010331",
          code: "14010331",
          name: "تصميم الهوية البصرية",
          sections: [secB], // On Sun/Tue morning
        },
      ];
      const allSundayPruned = explainScheduleConflicts(courses, { freeDays: ["أح", "ثلا"] });
      assert.equal(
        allSundayPruned.hasConflict,
        true,
        "Coarse freeDays filter prunes all Sunday classes, destroying viable schedules for athletes",
      );
    });

    test("P8.2: Timetable compound key mismatch in App.tsx vs WeeklySchedulePage.tsx and iCal", () => {
      const appContent = fs.readFileSync(path.join(SRC_DIR, "App.tsx"), "utf8");
      const pageContent = fs.readFileSync(path.join(SRC_DIR, "pages", "WeeklySchedulePage.tsx"), "utf8");
      const icalContent = fs.readFileSync(path.join(SRC_DIR, "services", "icalExport.ts"), "utf8");

      // 1. App.tsx stores schedule entries keyed by `${ec.code}_${d}`
      assert.ok(appContent.includes("newSched[`${ec.code}_${d}`]"), "App.tsx keys timetable entries with `${ec.code}_${d}`");

      // 2. WeeklySchedulePage.tsx queries coursesById with raw compound key
      assert.ok(
        pageContent.includes("const c = coursesById.get(courseId);") &&
        pageContent.includes("const name = c ? c.name : courseId;"),
        "WeeklySchedulePage.tsx passes courseId directly to coursesById.get(courseId)",
      );

      // 3. icalExport.ts does the same
      assert.ok(
        icalContent.includes("const course = coursesMap.get(courseId);") &&
        icalContent.includes("const courseName = course ? course.name : courseId;"),
        "icalExport.ts queries coursesMap with raw compound key",
      );

      // Programmatic verification of the bug:
      const coursesMap = new Map<string, { name: string }>([
        ["14010311", { name: "تايبوغرافي 2" }],
      ]);

      const compoundKey = "14010311_اث";
      const unresolvedName = coursesMap.get(compoundKey)?.name ?? compoundKey;
      assert.equal(
        unresolvedName,
        "14010311_اث",
        "Compound key lookup in coursesMap fails, displaying raw key '14010311_اث'",
      );

      // Fix verification: stripping trailing _${d} suffix
      const normalizedKey = compoundKey.replace(/_[^_]+$/, "");
      const resolvedName = coursesMap.get(normalizedKey)?.name ?? normalizedKey;
      assert.equal(resolvedName, "تايبوغرافي 2", "Stripping day suffix correctly resolves course name");
    });

    test("P8.3: Schedule adoption multi-block timing discard in WeeklyScheduleModal.tsx", () => {
      const modalContent = fs.readFileSync(
        path.join(SRC_DIR, "components", "modals", "WeeklyScheduleModal.tsx"),
        "utf8",
      );

      // Verify that handleAdoptSchedule extracts only blocks[0]
      assert.ok(
        modalContent.includes("const block = item.section.blocks[0];"),
        "WeeklyScheduleModal extracts only blocks[0] during schedule adoption",
      );

      // Programmatic demonstration of data loss for split studio/lecture courses:
      // Multi-block course: Lecture Mon 09:30-11:00 (start 570, end 660) + Studio Wed 08:00-12:00 (start 480, end 720)
      const multiBlockSection: CatalogSection = {
        sec: "1",
        blocks: [
          { days: ["اث"], start: 570, end: 660 }, // Block 0: Mon 09:30 - 11:00
          { days: ["أرب"], start: 480, end: 720 }, // Block 1: Wed 08:00 - 12:00 (4 hours)
        ],
      };

      const block0 = multiBlockSection.blocks[0];
      assert.ok(block0);
      const adoptedScheduleEntry = {
        startTime: `${Math.floor(block0.start / 60)}:${String(block0.start % 60).padStart(2, "0")}`,
        endTime: `${Math.floor(block0.end / 60)}:${String(block0.end % 60).padStart(2, "0")}`,
        days: ["الإثنين", "الأربعاء"],
      };

      assert.equal(adoptedScheduleEntry.startTime, "9:30");
      assert.equal(adoptedScheduleEntry.endTime, "11:00");
      const block1 = multiBlockSection.blocks[1];
      assert.ok(block1);
      // Wednesday's 4-hour studio (08:00 - 12:00) is falsely recorded as 09:30 - 11:00!
      assert.notEqual(block0.start, block1.start, "Timing from block 0 overwrites block 1");
    });

    test("P8.4: Modal grid truncation at 16:00 for late studio sessions", () => {
      const modalContent = fs.readFileSync(
        path.join(SRC_DIR, "components", "modals", "WeeklyScheduleModal.tsx"),
        "utf8",
      );

      // Verify GRID_END_MINUTES = 16 * 60 (16:00 / 4:00 PM)
      assert.ok(
        modalContent.includes("GRID_END_MINUTES = 16 * 60"),
        "WeeklyScheduleModal sets GRID_END_MINUTES at 16:00 (4:00 PM)",
      );

      const gridEndMinutes = 16 * 60; // 960 minutes
      // Motion Graphics Studio running 13:00 - 17:00 (780 to 1020 minutes)
      const studioEndMinutes = 17 * 60; // 1020 minutes
      assert.ok(
        studioEndMinutes > gridEndMinutes,
        "4-hour afternoon studio running until 17:00 extends beyond visible 16:00 grid boundary",
      );
    });
  });

  // ==========================================================================
  // PERSONA 9: Rami Odeh (Dual-Track / Minor)
  // Major: Agricultural Engineering (160 credits) + Business Minor (21 credits)
  // Constraints: Cross-campus transit buffer (Al-Arroub vs Central Campus),
  // Cross-faculty tuition flat rate discrepancy, single-major state destruction
  // ==========================================================================
  describe("Persona 9: Rami Odeh (Dual-Track / Minor)", () => {
    test("P9.1: Physical cross-campus transit blindness in schedule solver", () => {
      // Rami: Plant Protection at Al-Arroub Agriculture Farm ends at 11:00 (660m)
      const alArroubSection: CatalogSection = {
        sec: "1",
        blocks: [{ days: ["اث"], start: 570, end: 660 }],
      };
      // Marketing Management at Central Campus starts at 11:00 (660m)
      const centralCampusSection: CatalogSection = {
        sec: "2",
        blocks: [{ days: ["اث"], start: 660, end: 750 }],
      };

      // Current solver hasConflict
      const conflict = hasConflict([{ section: alArroubSection }], centralCampusSection);
      assert.equal(conflict, false, "Solver reports no conflict for 0-minute transition across distant campuses");

      // Quality evaluation rewards gap = 0 as optimal compactness
      const stats = getBlockStats([{ section: alArroubSection }, { section: centralCampusSection }]);
      assert.equal(stats.totalGap, 0, "calculateScheduleQuality scores totalGap = 0, giving full compactness score");

      const quality = calculateScheduleQuality([{ section: alArroubSection }, { section: centralCampusSection }]);
      assert.equal(quality.breakdown.gapsScore, 40, "Gaps score is rewarded with maximum 40 points");

      // In physical reality, travel requires >= 45 minutes
      const minRequiredBuffer = 45;
      const actualBuffer = centralCampusSection.blocks[0]!.start - alArroubSection.blocks[0]!.end;
      assert.ok(
        actualBuffer < minRequiredBuffer,
        `Actual buffer (${actualBuffer} mins) is less than required transit buffer (${minRequiredBuffer} mins)`,
      );
    });

    test("P9.2: Cross-faculty tuition flat rate calculation discrepancy", () => {
      // Agricultural Engineering hourly rate is 20 JOD/hr
      // Computer Engineering hourly rate is 24 JOD/hr
      // Business Administration hourly rate is 20 JOD/hr
      const engRate = getOfficialTuitionRate("هندسة الحاسوب").hourlyRateJOD;
      const bizRate = getOfficialTuitionRate("إدارة الأعمال").hourlyRateJOD;
      assert.equal(engRate, 24);
      assert.equal(bizRate, 20);

      // Student enrolled in Engineering (24 JOD) taking 15 credits: 9 cr Engineering + 6 cr Business Minor
      const flatTuition = calculateSemesterTuition({
        majorName: "هندسة الحاسوب",
        credits: 15,
      });

      // calculateSemesterTuition multiplies all 15 credits by 24 JOD = 360 JOD
      assert.equal(flatTuition.creditsFeeJOD, 15 * 24, "Calculates flat 360 JOD using primary major rate for all credits");

      // Authentic cross-faculty fee:
      const trueCreditsFee = 9 * 24 + 6 * 20; // 216 + 120 = 336 JOD
      assert.equal(trueCreditsFee, 336, "True cross-faculty credit fee should be 336 JOD");
      assert.equal(
        flatTuition.creditsFeeJOD - trueCreditsFee,
        24,
        "Flat tuition overcharges student by 24 JOD for cross-faculty minor courses",
      );
    });

    test("P9.3: Single-major state and destructive major switching audit", () => {
      // 1. Audit useAcademicStore.ts for lack of minor state
      const storeContent = fs.readFileSync(path.join(SRC_DIR, "stores", "useAcademicStore.ts"), "utf8");
      assert.ok(storeContent.includes("activeMajorId: string"), "Store defines activeMajorId");
      assert.equal(storeContent.includes("activeMinorId"), false, "Store lacks activeMinorId for minor degree tracking");

      // 2. Audit App.tsx for destructive localStorage clearing on major switch
      const appContent = fs.readFileSync(path.join(SRC_DIR, "App.tsx"), "utf8");
      assert.ok(
        appContent.includes("localStorage.removeItem(key)") &&
        appContent.includes("ptuk_major_plan_"),
        "App.tsx wipes ptuk_major_plan_ keys upon major switch, destroying primary major state",
      );

      // 3. Audit AddCourseModal.tsx for lack of minor category
      const addModalContent = fs.readFileSync(
        path.join(SRC_DIR, "components", "modals", "AddCourseModal.tsx"),
        "utf8",
      );
      assert.equal(
        addModalContent.includes("متطلب تخصص فرعي"),
        false,
        "AddCourseModal categories list lacks 'متطلب تخصص فرعي' (Minor Requirement)",
      );
    });
  });

  // ==========================================================================
  // PERSONA 10: Salma Barghouthi (Poor Connectivity 3G)
  // Major: Vocational IT Diploma (72 credits, 2 years)
  // Constraints: High latency cellular 3G (400ms), offline queue disconnected,
  // Ephemeral idempotency key lost on drop, locked registration coming soon
  // ==========================================================================
  describe("Persona 10: Salma Barghouthi (Poor Connectivity 3G)", () => {
    test("P10.1: Offline queue resilience & zero UI caller audit in src/", () => {
      // 1. Test offlineQueue functions directly
      saveOfflineQueue([]);
      enqueueMutation("SAVE_PLAN", { semester: "20241", courses: ["17010111"] });

      const queue = getOfflineQueue();
      assert.equal(queue.length, 1, "Queue must contain 1 mutation");
      const firstMutation = queue[0];
      assert.ok(firstMutation);
      assert.equal(firstMutation.type, "SAVE_PLAN");

      // Drain with failure -> increments retry count
      const drained = drainOfflineQueue(async () => false);
      assert.ok(drained instanceof Promise);

      // 2. Audit src/ for callers of enqueueMutation and drainOfflineQueue
      const allSrcFiles = fs.readdirSync(path.join(SRC_DIR, "pages"), { recursive: true }) as string[];
      let callerCount = 0;
      for (const relFile of allSrcFiles) {
        if (typeof relFile === "string" && (relFile.endsWith(".ts") || relFile.endsWith(".tsx"))) {
          const content = fs.readFileSync(path.join(SRC_DIR, "pages", relFile), "utf8");
          if (content.includes("enqueueMutation") || content.includes("drainOfflineQueue")) {
            callerCount++;
          }
        }
      }

      assert.equal(
        callerCount,
        0,
        "enqueueMutation and drainOfflineQueue have 0 callers in src/pages/, proving offline queue is disconnected",
      );
    });

    test("P10.2: Idempotency key persistence failure in RegistrationPage.tsx", () => {
      const regPageContent = fs.readFileSync(path.join(SRC_DIR, "pages", "RegistrationPage.tsx"), "utf8");

      // Verify idempotencyKey declaration inside handleExecuteNow
      assert.ok(
        regPageContent.includes("const idempotencyKey = `reg_${Date.now()}_"),
        "RegistrationPage declares idempotencyKey as a local ephemeral variable in handleExecuteNow",
      );

      // Verify that idempotencyKey is NOT saved to localStorage or sessionStorage
      assert.equal(
        regPageContent.includes("sessionStorage.setItem(\"ptuk_idempotency_key\"") ||
        regPageContent.includes("localStorage.setItem(\"ptuk_idempotency_key\""),
        false,
        "idempotencyKey is never persisted to storage, causing it to be lost on network timeout",
      );

      // Programmatic retry demonstration:
      // When 3G drops, the catch block runs, discarding the key. Next click generates a new key:
      const key1 = `reg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const key2 = `reg_${Date.now() + 10}_${Math.random().toString(36).slice(2, 9)}`;
      assert.notEqual(key1, key2, "Retrying mints a brand-new key, bypassing backend deduplication cache");
    });

    test("P10.3: Locked registration coming-soon UI and 15-semester dropdown mismatch for 2-year diploma", () => {
      // 1. Audit App.tsx registration route lock
      const appContent = fs.readFileSync(path.join(SRC_DIR, "App.tsx"), "utf8");

      assert.ok(
        appContent.includes('id="registration-coming-soon-title"') &&
        appContent.includes("قيد التطوير"),
        "App.tsx renders 'قيد التطوير' locked placeholder for registration route",
      );

      assert.ok(
        appContent.includes("disabled") &&
        appContent.includes('title="قيد التطوير"') &&
        appContent.includes("opacity-50 cursor-not-allowed"),
        "Bottom navigation registration button is disabled with cursor-not-allowed",
      );

      // 2. Audit 2-year diploma duration vs 15-semester dropdown
      // Salma is in a 72-credit Vocational IT Diploma
      const degreeDuration = resolveMajorDegreeYears(72, "diploma");
      assert.equal(degreeDuration.maxYears, 2, "72-credit diploma has max 2 years duration");
      assert.equal(degreeDuration.maxRegularSemesters, 4, "72-credit diploma has exactly 4 regular semesters");
      assert.equal(degreeDuration.allowedSemesterNames.length, 4, "Only 4 semesters should be permitted");

      // Compare with constants.ts SEMESTERS
      const constantsContent = fs.readFileSync(path.join(SRC_DIR, "constants.ts"), "utf8");
      assert.ok(
        constantsContent.includes("السنة الخامسة - الفصل الثاني"),
        "constants.ts hardcodes 15 semesters (up to Year 5), overwhelming 2-year diploma students",
      );
    });
  });
});
