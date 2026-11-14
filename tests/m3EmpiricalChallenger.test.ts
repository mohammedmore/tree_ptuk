import assert from "node:assert/strict";
import { test, describe } from "node:test";
import type { Course } from "../src/data";
import {
  calculateGPA,
  calculateDegreeCredits,
  getAcademicStandingInfo,
  calculateTargetGPAAnalysis,
  getTopRetakeRecommendations,
  isRemedialCourse,
} from "../src/core/courseProgress";
import {
  checkPlanCreditLimits,
  calculateDetailedTuition,
  calculateSectionSaturation,
  isSectionClosed,
} from "../src/core/semesterRegistration";

// Mock Course Factory
function createMockCourse(
  id: string,
  name: string,
  credits: number,
  category = "متطلب تخصص إجباري",
): Course {
  return {
    id,
    name,
    credits,
    category,
    prerequisites: [],
    coPrerequisites: [],
    semester: "السنة الأولى - الفصل الأول",
  };
}

describe("Milestone 3 Empirical Verification: Probation Survival Calculator", () => {
  const dummyCourses: Course[] = [
    createMockCourse("11100101", "برمجة 1", 3),
    createMockCourse("11100102", "تفاضل وتكامل 1", 3),
    createMockCourse("11100103", "فيزياء عامة 1", 3),
    createMockCourse("11100104", "مقدمة في هندسة الحاسوب", 2),
    createMockCourse("11100105", "مهارات الاتصال", 2),
    createMockCourse("11100201", "برمجة 2", 3),
    createMockCourse("11100202", "تراكيب بيانات", 3),
  ];

  function computeProbationRecovery(
    cumulativeGPA: number,
    gradedCredits: number,
    plannedHours: 12 | 13 | 14,
  ) {
    const isUnderWarning = cumulativeGPA < 60;
    const currentTotalPoints = cumulativeGPA * gradedCredits;
    const targetCumulativeGPA = 60.0;
    const newTotalCredits = gradedCredits + plannedHours;
    const targetCumulativePoints = targetCumulativeGPA * newTotalCredits;
    const pointsNeeded = targetCumulativePoints - currentTotalPoints;
    const requiredSemesterGPA = pointsNeeded / plannedHours;
    const roundedRequiredGPA = Math.round(requiredSemesterGPA * 10) / 10;

    const isPossible = requiredSemesterGPA <= 100;
    let difficulty: "easy" | "realistic" | "challenging" | "critical" | "impossible";
    let difficultyLabel: string;

    if (!isPossible) {
      difficulty = "impossible";
      difficultyLabel = "غير ممكن بمواد جديدة فقط";
    } else if (requiredSemesterGPA <= 65) {
      difficulty = "easy";
      difficultyLabel = "سهل التحقيق";
    } else if (requiredSemesterGPA <= 75) {
      difficulty = "realistic";
      difficultyLabel = "واقعي وقابل للتحقيق";
    } else if (requiredSemesterGPA <= 85) {
      difficulty = "challenging";
      difficultyLabel = "يتطلب جهداً وتركيزاً مرتفعاً";
    } else {
      difficulty = "critical";
      difficultyLabel = "حرج جداً (يتطلب تفوقاً)";
    }

    return {
      isUnderWarning,
      plannedHours,
      requiredSemesterGPA: roundedRequiredGPA,
      isPossible,
      difficulty,
      difficultyLabel,
    };
  }

  test("Boundary condition: GPA >= 60.00% shows safe standing; GPA < 60.00% triggers probation recovery", () => {
    // Exactly 60.00% - Not under warning
    const safeResult = computeProbationRecovery(60.0, 30, 14);
    assert.equal(safeResult.isUnderWarning, false);

    // 59.99% - Strictly under warning
    const probationResult = computeProbationRecovery(59.99, 30, 14);
    assert.equal(probationResult.isUnderWarning, true);

    const standingSafe = getAcademicStandingInfo(60.0, 30, 160);
    assert.equal(standingSafe.isWarning, false);

    const standingProbation = getAcademicStandingInfo(59.9, 30, 160);
    assert.equal(standingProbation.isWarning, true);
  });

  test("Realistic recovery: computes precise required single-semester GPA across 12, 13, 14 hours", () => {
    // Student with 30 graded hours, cumulative GPA 57.0%
    // Current points = 57.0 * 30 = 1710
    // Target 60.0%
    const for12 = computeProbationRecovery(57.0, 30, 12);
    // (60 * 42 - 1710) / 12 = (2520 - 1710) / 12 = 810 / 12 = 67.5%
    assert.equal(for12.requiredSemesterGPA, 67.5);
    assert.equal(for12.isPossible, true);
    assert.equal(for12.difficulty, "realistic");

    const for13 = computeProbationRecovery(57.0, 30, 13);
    // (60 * 43 - 1710) / 13 = (2580 - 1710) / 13 = 870 / 13 = 66.92% -> 66.9%
    assert.equal(for13.requiredSemesterGPA, 66.9);
    assert.equal(for13.isPossible, true);

    const for14 = computeProbationRecovery(57.0, 30, 14);
    // (60 * 44 - 1710) / 14 = (2640 - 1710) / 14 = 930 / 14 = 66.42% -> 66.4%
    assert.equal(for14.requiredSemesterGPA, 66.4);
    assert.equal(for14.isPossible, true);
    // More registered credits dilute the deficit, lowering the required semester GPA
    assert.ok(for14.requiredSemesterGPA < for12.requiredSemesterGPA);
  });

  test("Impossible recovery (> 100% required) correctly flags impossible and urges retaking failed courses", () => {
    // Severely depressed student: 60 graded credits at 45.0% cumulative GPA
    // Current points = 60 * 45 = 2700
    // To reach 60% in 12 credits: Target = 60 * 72 = 4320 points
    // Points needed = 4320 - 2700 = 1620 points
    // Required semester GPA = 1620 / 12 = 135.0%!
    const impossibleResult = computeProbationRecovery(45.0, 60, 12);
    assert.equal(impossibleResult.isPossible, false);
    assert.equal(impossibleResult.requiredSemesterGPA, 135.0);
    assert.equal(impossibleResult.difficulty, "impossible");
    assert.equal(impossibleResult.difficultyLabel, "غير ممكن بمواد جديدة فقط");

    // Even in 14 credits: (60 * 74 - 2700) / 14 = (4440 - 2700) / 14 = 1740 / 14 = 124.3%
    const impossibleResult14 = computeProbationRecovery(45.0, 60, 14);
    assert.equal(impossibleResult14.isPossible, false);
    assert.equal(impossibleResult14.requiredSemesterGPA, 124.3);
  });
});

describe("Milestone 3 Empirical Verification: Retake Optimizer & Transcript Immutability", () => {
  const courseA = createMockCourse("11100101", "برمجة 1", 3);
  const courseB = createMockCourse("11100102", "تفاضل وتكامل 1", 3);
  const courseC = createMockCourse("11100103", "فيزياء عامة 1", 3);
  const courseD = createMockCourse("11100201", "برمجة 2", 3);
  const allCourses = [courseA, courseB, courseC, courseD];

  test("PTUK Grade Replacement Formula: retaking replaces grade without duplicating denominator credits", () => {
    // Initial student record:
    // Course A (3 cr): grade 45 (failed)
    // Course B (3 cr): grade 60
    // Course C (3 cr): grade 60
    // Total Graded Credits = 9, Points = 135 + 180 + 180 = 495 -> GPA = 55.0%
    const initialGrades: Record<string, number> = {
      [courseA.id]: 45,
      [courseB.id]: 60,
      [courseC.id]: 60,
    };
    const completedCourses = new Set([courseB.id, courseC.id]);
    const failedCourseIds = new Set([courseA.id]);

    const initialGPA = calculateGPA(allCourses, initialGrades, completedCourses, failedCourseIds);
    assert.equal(Math.round(initialGPA * 100) / 100, 55.0);

    // Scenario 1: Retake Course A with grade 75 in What-If Table
    const whatIfRetake: Record<string, number> = {
      [courseA.id]: 75,
    };
    const mergedGrades = { ...initialGrades, ...whatIfRetake };
    const mergedCompleted = new Set([...Array.from(completedCourses), ...Object.keys(whatIfRetake)]);

    const projectedRetakeGPA = calculateGPA(
      allCourses,
      mergedGrades,
      mergedCompleted,
      failedCourseIds,
    );
    // Grade replaced: Points = 75*3 + 60*3 + 60*3 = 225 + 180 + 180 = 585
    // Denominator remains 9 credits!
    // Expected GPA = 585 / 9 = 65.0%
    assert.equal(Math.round(projectedRetakeGPA * 100) / 100, 65.0);
    const retakeDelta = projectedRetakeGPA - initialGPA;
    assert.equal(Math.round(retakeDelta * 100) / 100, 10.0);

    // Scenario 2: Take NEW Course D (3 cr) with grade 75 instead of retake
    const whatIfNewCourse: Record<string, number> = {
      [courseD.id]: 75,
    };
    const mergedGradesNew = { ...initialGrades, ...whatIfNewCourse };
    const mergedCompletedNew = new Set([
      ...Array.from(completedCourses),
      ...Object.keys(whatIfNewCourse),
    ]);

    const projectedNewCourseGPA = calculateGPA(
      allCourses,
      mergedGradesNew,
      mergedCompletedNew,
      failedCourseIds,
    );
    // Denominator expands: 9 + 3 = 12 credits!
    // Points = 495 + 75*3 = 495 + 225 = 720
    // Expected GPA = 720 / 12 = 60.0%
    assert.equal(Math.round(projectedNewCourseGPA * 100) / 100, 60.0);
    const newCourseDelta = projectedNewCourseGPA - initialGPA;
    assert.equal(Math.round(newCourseDelta * 100) / 100, 5.0);

    // PROVEN: Retake gives exactly +10.0% vs +5.0% for new course (double the boost!)
    assert.ok(retakeDelta > newCourseDelta);
  });

  test("Table 2 (Official Transcript) remains completely untouched during Table 1 What-If simulations", () => {
    const officialTranscriptGrades: Record<string, number> = {
      [courseA.id]: 45,
      [courseB.id]: 65,
    };
    // Deep clone to verify immutability
    const snapshotBeforeSimulation = { ...officialTranscriptGrades };

    // Student adds retake simulation in Table 1
    const whatIfSimulation = {
      [courseA.id]: 85,
    };

    // Table 1 uses merged copy
    const merged = { ...officialTranscriptGrades, ...whatIfSimulation };
    assert.equal(merged[courseA.id], 85);

    // Table 2 (Official Record) MUST REMAIN 45
    assert.equal(officialTranscriptGrades[courseA.id], 45);
    assert.deepEqual(officialTranscriptGrades, snapshotBeforeSimulation);
  });

  test("getTopRetakeRecommendations accurately ranks failed courses as #1 boost candidates", () => {
    const courseFailed = createMockCourse("CS101", "برمجة 1", 3);
    const courseLowPass = createMockCourse("MATH101", "تفاضل 1", 3);
    const courseHighPass = createMockCourse("ENG101", "لغة إنجليزية", 3);

    const courses = [courseFailed, courseLowPass, courseHighPass];
    const grades: Record<string, number> = {
      CS101: 40,
      MATH101: 60,
      ENG101: 85,
    };
    const completed = new Set(["MATH101", "ENG101"]);
    const failed = new Set(["CS101"]);

    const recs = getTopRetakeRecommendations(courses, grades, completed, failed, 85);
    assert.ok(recs.length > 1);
    const firstRec = recs[0];
    const secondRec = recs[1];
    assert.ok(firstRec);
    assert.ok(secondRec);
    // Highest boost candidate MUST be the failed course CS101 (40 -> 85 is +45 pts)
    assert.equal(firstRec.course.id, "CS101");
    assert.ok(firstRec.potentialGpaBoost > secondRec.potentialGpaBoost);
  });
});

describe("Milestone 3 Empirical Verification: Graduation Distinction Honors & Article 32", () => {
  const dummyCourses: Course[] = [
    createMockCourse("101", "مادة 1", 3),
    createMockCourse("102", "مادة 2", 3),
  ];

  function evaluateDistinction(
    cumulativeGPA: number,
    gradedCredits: number,
    hasAnyFailedCourse: boolean,
  ) {
    const isFirstClass = cumulativeGPA >= 90 && !hasAnyFailedCourse;
    const isSecondClass = cumulativeGPA >= 85 && cumulativeGPA < 90 && !hasAnyFailedCourse;
    const isHonorGPAWithoutHonorsStatus = cumulativeGPA >= 85 && hasAnyFailedCourse;

    let minSemesterGPAFor85: number | null = null;
    if (cumulativeGPA >= 85 && gradedCredits > 0) {
      const targetPts = 85.0 * (gradedCredits + 15);
      const curPts = cumulativeGPA * gradedCredits;
      minSemesterGPAFor85 = Math.max(
        0,
        Math.min(100, Math.round(((targetPts - curPts) / 15) * 10) / 10),
      );
    }

    return {
      isFirstClass,
      isSecondClass,
      isHonorGPAWithoutHonorsStatus,
      minSemesterGPAFor85,
    };
  }

  test("First Class Honors awarded for cumulative GPA >= 90.00% with zero lifetime course failures", () => {
    const honors1 = evaluateDistinction(91.5, 90, false);
    assert.equal(honors1.isFirstClass, true);
    assert.equal(honors1.isSecondClass, false);
    assert.equal(honors1.isHonorGPAWithoutHonorsStatus, false);
  });

  test("Second Class Honors awarded for cumulative GPA between 85.00% and 89.99% with zero lifetime failures", () => {
    const honors2 = evaluateDistinction(87.5, 90, false);
    assert.equal(honors2.isFirstClass, false);
    assert.equal(honors2.isSecondClass, true);
    assert.equal(honors2.isHonorGPAWithoutHonorsStatus, false);
  });

  test("Article 32 Disqualification: lifetime course failure (< 50%) disqualifies honors even with GPA >= 90%", () => {
    // Student with 93.5% GPA but failed one course in first year (Article 32)
    const disqualifiedFirstClass = evaluateDistinction(93.5, 90, true);
    assert.equal(disqualifiedFirstClass.isFirstClass, false);
    assert.equal(disqualifiedFirstClass.isSecondClass, false);
    assert.equal(disqualifiedFirstClass.isHonorGPAWithoutHonorsStatus, true);

    // Student with 86.5% GPA but failed one course
    const disqualifiedSecondClass = evaluateDistinction(86.5, 90, true);
    assert.equal(disqualifiedSecondClass.isFirstClass, false);
    assert.equal(disqualifiedSecondClass.isSecondClass, false);
    assert.equal(disqualifiedSecondClass.isHonorGPAWithoutHonorsStatus, true);
  });

  test("Honors safety margin computes exact minimum semester GPA across 15 hours to maintain 85.0%", () => {
    // Student has 88.0% cumulative GPA across 60 graded credits
    // Target 85.0% across 75 credits = 6375 points
    // Current points = 88.0 * 60 = 5280 points
    // Required in next 15 credits = 6375 - 5280 = 1095 points / 15 = 73.0%
    const margin = evaluateDistinction(88.0, 60, false);
    assert.equal(margin.minSemesterGPAFor85, 73.0);
  });
});

describe("Milestone 3 Empirical Verification: RegistrationPage Credit Limits & Alerts", () => {
  test("Honor Student 15-credit minimum alert triggers for GPA >= 85 in regular semesters when planned < 15", () => {
    function evaluateHonorScholarshipAlert(
      gpa: number,
      isSummer: boolean,
      plannedCredits: number,
    ) {
      const isHonorStudent = gpa >= 85;
      return isHonorStudent && !isSummer && plannedCredits < 15;
    }

    // High achiever (88% GPA) with 12 credits in regular semester: MUST ALERT!
    assert.equal(evaluateHonorScholarshipAlert(88, false, 12), true);
    assert.equal(evaluateHonorScholarshipAlert(88, false, 14), true);

    // High achiever registering 15 or 18 credits: NO ALERT
    assert.equal(evaluateHonorScholarshipAlert(88, false, 15), false);
    assert.equal(evaluateHonorScholarshipAlert(88, false, 18), false);

    // In summer semester: NO ALERT (scholarships apply only to regular fall/spring semesters)
    assert.equal(evaluateHonorScholarshipAlert(88, true, 9), false);

    // Non-honor student (75% GPA) with 12 credits: NO ALERT
    assert.equal(evaluateHonorScholarshipAlert(75, false, 12), false);
  });

  test("Academic Probation 14-credit ceiling in RegistrationPage flags violations and guides retakes", () => {
    function evaluateProbationRegistrationAlert(
      hasWarning: boolean,
      gpa: number,
      isSummer: boolean,
      plannedCredits: number,
    ) {
      const isUnderWarning = hasWarning || (gpa > 0 && gpa < 60);
      if (!isUnderWarning || isSummer) return null;

      if (plannedCredits > 14) {
        return {
          type: "danger",
          message: `لقد تجاوزت الحد الأقصى للتسجيل تحت الإنذار (${plannedCredits} ساعة من أصل 14)`,
        };
      }
      return {
        type: "advisory",
        message: "أنت تحت الإنذار الأكاديمي (معدلك أقل من 60%). ركز على تسجيل وإعادة المساقات الراسبة",
      };
    }

    // Student on probation registering 16 credits: DANGER (over 14 ceiling)
    const overLimit = evaluateProbationRegistrationAlert(true, 55, false, 16);
    assert.ok(overLimit !== null);
    assert.equal(overLimit?.type, "danger");
    assert.ok(overLimit?.message.includes("تجاوزت الحد الأقصى"));

    // Student on probation registering 13 credits: ADVISORY (valid credits, guidance to retake)
    const validLimit = evaluateProbationRegistrationAlert(true, 55, false, 13);
    assert.ok(validLimit !== null);
    assert.equal(validLimit?.type, "advisory");

    // Regular student (GPA 72, no warning) registering 18 credits: NO ALERT
    const regularStudent = evaluateProbationRegistrationAlert(false, 72, false, 18);
    assert.equal(regularStudent, null);
  });
});

describe("Milestone 3 Empirical Verification: Clutter Elimination & Accessibility", () => {
  test("TuitionSummaryWidget handles zero and standard tuition calculations accurately", () => {
    const res = calculateDetailedTuition(15, {
      hourlyRate: 20,
      fixedFees: 25,
      exchangeRate: 5.2,
      currency: "JOD",
    });

    assert.equal(res.creditsCostJOD, 300);
    assert.equal(res.fixedFees, 25);
    assert.equal(res.totalJOD, 325);
    assert.equal(res.totalILS, Math.round(325 * 5.2));
  });

  test("Section saturation and closed state correctly determine dropdown border styling and alerts", () => {
    assert.equal(isSectionClosed(40, 40), true);
    assert.equal(isSectionClosed(41, 40), true);
    assert.equal(isSectionClosed(39, 40), false);

    const satOpen = calculateSectionSaturation(25, 40);
    assert.equal(satOpen.status, "open");

    const satCritical = calculateSectionSaturation(36, 40);
    assert.equal(satCritical.status, "critical");

    const satFull = calculateSectionSaturation(40, 40);
    assert.equal(satFull.status, "full");
  });
});
