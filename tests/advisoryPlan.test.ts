import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveMajorDegreeYears,
  isCseMajor,
  computeDynamicAdvisoryPlan,
  getMajorElectiveSlots,
  parseExplicitSemesterIndex,
} from "../src/core/advisoryPlan";
import {
  getRecommendedSemesterOfCourse,
  getYearOfCourse,
  getYearFromId,
} from "../src/constants";
import {
  resolveCapstoneThreshold,
  resolveFieldTrainingThreshold,
  getAcademicStandingInfo,
} from "../src/core/courseProgress";
import {
  determineUpcomingSemester,
  resolveAcademicSemester,
} from "../src/utils/semesterUtils";
import { getOfficialDegreeTotalCredits } from "../src/core/academicPolicy";
import { getOfficialTuitionRate } from "../src/services/tuitionFeesService";
import type { Course } from "../src/data";

test("advisoryPlan: resolveMajorDegreeYears scales dynamically across degree types", () => {
  // Diploma (<= 80 credits) -> 2 years (4 regular semesters)
  const diploma = resolveMajorDegreeYears(72, "diploma-it");
  assert.equal(diploma.maxYears, 2);
  assert.equal(diploma.maxRegularSemesters, 4);
  assert.equal(diploma.allowedSemesterNames.length, 4);
  assert.equal(diploma.allowedSemesterNames[3], "السنة الثانية - الفصل الثاني");

  // Bachelor degree (<= 140 credits) -> 4 years (8 regular semesters)
  const bachelor = resolveMajorDegreeYears(132, "ai");
  assert.equal(bachelor.maxYears, 4);
  assert.equal(bachelor.maxRegularSemesters, 8);
  assert.equal(bachelor.allowedSemesterNames.length, 8);
  assert.equal(bachelor.allowedSemesterNames[7], "السنة الرابعة - الفصل الثاني");

  // Engineering degree (> 140 credits or cse) -> 5 years (10 regular semesters)
  const engineering = resolveMajorDegreeYears(164, "cse-2023");
  assert.equal(engineering.maxYears, 5);
  assert.equal(engineering.maxRegularSemesters, 10);
  assert.equal(engineering.allowedSemesterNames.length, 10);
  assert.equal(engineering.allowedSemesterNames[9], "السنة الخامسة - الفصل الثاني");
});

test("advisoryPlan: isCseMajor accurately identifies CSE while decoupling other majors", () => {
  assert.equal(isCseMajor("cse"), true);
  assert.equal(isCseMajor("cse-2023"), true);
  assert.equal(isCseMajor("cse_2024"), true);
  assert.equal(isCseMajor("هندسة أنظمة الحاسوب"), true);

  // Other majors must be false
  assert.equal(isCseMajor("ai"), false);
  assert.equal(isCseMajor("software-engineering"), false);
  assert.equal(isCseMajor("accounting"), false);
  assert.equal(isCseMajor("mechatronics"), false);
  assert.equal(isCseMajor(undefined), false);
});

test("advisoryPlan: getMajorElectiveSlots decouples CSE slots from other majors", () => {
  // CSE gets the 8 predefined CSE elective slots
  const cseSlots = getMajorElectiveSlots("cse-2023", 164);
  assert.equal(Object.keys(cseSlots.electiveDefs).length > 0, true);
  assert.equal(Object.keys(cseSlots.semesterSlots).length > 0, true);

  // Non-CSE majors receive empty slot map to prevent CSE pollution
  const aiSlots = getMajorElectiveSlots("ai", 132);
  assert.deepEqual(aiSlots.electiveDefs, {});
  assert.deepEqual(aiSlots.semesterSlots, {});
});

test("advisoryPlan: parseExplicitSemesterIndex converts Arabic strings to 0-based indices", () => {
  assert.equal(parseExplicitSemesterIndex("السنة الأولى - الفصل الأول"), 0);
  assert.equal(parseExplicitSemesterIndex("السنة الأولى - الفصل الثاني"), 1);
  assert.equal(parseExplicitSemesterIndex("السنة الثانية - الفصل الأول"), 2);
  assert.equal(parseExplicitSemesterIndex("السنة الثانية - الفصل الثاني"), 3);
  assert.equal(parseExplicitSemesterIndex("السنة الرابعة - الفصل الثاني"), 7);
  assert.equal(parseExplicitSemesterIndex("السنة الخامسة - الفصل الثاني"), 9);
  // Clamped if maxSemesters is 8 (4-year degree)
  assert.equal(parseExplicitSemesterIndex("السنة الخامسة - الفصل الأول", 8), 7);
});

test("advisoryPlan: computeDynamicAdvisoryPlan generates conflict-free DAG schedule for new major without semesters", () => {
  // Simulate a newly imported major from Edugate (e.g. Software Engineering) with NO semester tags
  const newMajorCourses: Course[] = [
    {
      id: "SE101",
      name: "مقدمة في البرمجة",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "MATH101",
      name: "تفاضل وتكامل 1",
      credits: 3,
      category: "متطلب كلية إجباري",
      prerequisites: [],
    },
    {
      id: "ENG099",
      name: "لغة إنجليزية استدراكية",
      credits: 3,
      category: "متطلب استدراكي إجباري",
      prerequisites: [],
    },
    {
      id: "SE102",
      name: "برمجة متقدمة",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: ["SE101"],
    },
    {
      id: "MATH102",
      name: "تفاضل وتكامل 2",
      credits: 3,
      category: "متطلب كلية إجباري",
      prerequisites: ["MATH101"],
    },
    {
      id: "SE201",
      name: "تراكيب بيانات",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: ["SE102"],
    },
    {
      id: "SE301",
      name: "هندسة برمجيات 1",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: ["SE201"],
    },
    {
      id: "SE302",
      name: "هندسة برمجيات 2",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: ["SE301"],
    },
    {
      id: "SE401",
      name: "مشروع تخرج (1)",
      credits: 2,
      category: "متطلب تخصص إجباري",
      prerequisites: ["SE302"],
    },
    {
      id: "SE402",
      name: "مشروع تخرج (2)",
      credits: 3,
      category: "متطلب تخصص إجباري",
      prerequisites: ["SE401"],
    },
  ];

  const result = computeDynamicAdvisoryPlan(newMajorCourses, {
    totalCredits: 132,
    majorId: "software-engineering",
  });

  assert.equal(result.isAutoGenerated, true);
  assert.equal(result.maxYears, 4);
  assert.equal(result.maxRegularSemesters, 8);

  // 1. Remedial course placed in Semester 1 (index 0)
  assert.equal(result.courseColumnMap["ENG099"], 0);

  // 2. Strict prerequisite invariant: for any course C with prereq P, col(P) < col(C)
  const colSE101 = result.courseColumnMap["SE101"];
  const colSE102 = result.courseColumnMap["SE102"];
  const colSE201 = result.courseColumnMap["SE201"];
  const colSE301 = result.courseColumnMap["SE301"];
  const colSE302 = result.courseColumnMap["SE302"];
  const colSE401 = result.courseColumnMap["SE401"];
  const colSE402 = result.courseColumnMap["SE402"];

  assert.equal(colSE101 < colSE102, true, "SE101 must precede SE102");
  assert.equal(colSE102 < colSE201, true, "SE102 must precede SE201");
  assert.equal(colSE201 < colSE301, true, "SE201 must precede SE301");
  assert.equal(colSE301 < colSE302, true, "SE301 must precede SE302");
  assert.equal(colSE302 < colSE401, true, "SE302 must precede SE401");
  assert.equal(colSE401 < colSE402, true, "SE401 must precede SE402");

  // 3. Projects placed in final year (indices 6 and 7 in 8-semester degree)
  assert.equal(colSE401 >= 6, true, "Project 1 in final year");
  assert.equal(colSE402, 7, "Project 2 in final semester");

  // 4. All assigned semesters exist in allowedSemesterNames
  for (const c of newMajorCourses) {
    const semName = result.courseSemesterMap[c.id];
    assert.equal(result.allowedSemesterNames.includes(semName), true);
  }
});

test("advisoryPlan: getRecommendedSemesterOfCourse respects maxYears and does not leak Year 5 into 4-year majors", () => {
  const genericCourse = {
    id: "99990599", // 5th digit suggests 5th year under legacy naive parser
    category: "متطلب تخصص إجباري",
    name: "موضوعات متقدمة",
  };

  // For 4-year major (maxYears = 4)
  const sem4 = getRecommendedSemesterOfCourse(genericCourse, "ai", 4);
  assert.equal(sem4.includes("الخامسة"), false, "Must not assign Year 5 to 4-year degree");
  assert.equal(sem4.includes("الرابعة"), true, "Clamped to Year 4");

  // For 2-year diploma (maxYears = 2)
  const sem2 = getRecommendedSemesterOfCourse(genericCourse, "diploma", 2);
  assert.equal(sem2.includes("الخامسة"), false);
  assert.equal(sem2.includes("الرابعة"), false);
  assert.equal(sem2.includes("الثانية"), true, "Clamped to Year 2");
});

test("advisoryPlan: resolveCapstoneThreshold and resolveFieldTrainingThreshold adapt to major credit totals", () => {
  // 1. Diploma (<= 80 credits)
  assert.equal(resolveCapstoneThreshold(72), 45);
  assert.equal(resolveFieldTrainingThreshold(72), 30);

  // 2. Bachelor degree (<= 140 credits, e.g. 132 for AI, Software Eng, Business, etc.)
  assert.equal(resolveCapstoneThreshold(132), 90);
  assert.equal(resolveFieldTrainingThreshold(132), 65);

  // 3. Engineering degree (> 140 credits, e.g. 160 or 164)
  assert.equal(resolveCapstoneThreshold(164), 120);
  assert.equal(resolveFieldTrainingThreshold(164), 90);
});

test("advisoryPlan: getAcademicStandingInfo accurately computes project and training eligibility by major degree credits", () => {
  // Student in 132h degree (e.g. Artificial Intelligence) with 92 earned credits
  const standing132 = getAcademicStandingInfo(80, 92, 132);
  assert.equal(standing132.canRegisterGradProject, true, "Should be eligible for graduation project at 92/132 credits");
  assert.equal(standing132.creditsToGradProject, 0);
  assert.equal(standing132.canRegisterFieldTraining, true, "Should be eligible for field training at 92/132 credits");

  // Same student credits under 164h engineering degree
  const standing164 = getAcademicStandingInfo(80, 92, 164);
  assert.equal(standing164.canRegisterGradProject, false, "Engineering requires 120 credits for graduation project");
  assert.equal(standing164.creditsToGradProject, 28);
  assert.equal(standing164.canRegisterFieldTraining, true, "Eligible for field training at >= 90 credits");
});

test("advisoryPlan: getYearOfCourse dynamically reads semester assignment and clamps to maxYears", () => {
  // Course with explicit semester in plan map
  const courseA = { id: "AI201", name: "مفاهيم الذكاء الاصطناعي" };
  const semesterMap = { AI201: "السنة الثانية - الفصل الأول" };
  assert.equal(getYearOfCourse(courseA, semesterMap, 4), "2");

  // Course with Year 5 label clamped to Year 4 in 4-year degree
  const courseB = { id: "AI499", name: "مشروع تخرج", semester: "السنة الخامسة - الفصل الثاني" };
  assert.equal(getYearOfCourse(courseB, undefined, 4), "4");

  // Course in diploma clamped to Year 2
  assert.equal(getYearOfCourse(courseB, undefined, 2), "2");
});

test("advisoryPlan: determineUpcomingSemester clamps progression to major maxYears", () => {
  // Student in 4-year bachelor who finished 8 regular semesters
  const mock4YearStudent = {
    currentSemester: "الفصل الثاني 2026/2027",
    cohortYear: "2023",
    semesters: [
      { title: "الفصل الأول 2023/2024", courses: [{ isPassed: true, code: "C1" }] },
      { title: "الفصل الثاني 2023/2024", courses: [{ isPassed: true, code: "C2" }] },
      { title: "الفصل الأول 2024/2025", courses: [{ isPassed: true, code: "C3" }] },
      { title: "الفصل الثاني 2024/2025", courses: [{ isPassed: true, code: "C4" }] },
      { title: "الفصل الأول 2025/2026", courses: [{ isPassed: true, code: "C5" }] },
      { title: "الفصل الثاني 2025/2026", courses: [{ isPassed: true, code: "C6" }] },
      { title: "الفصل الأول 2026/2027", courses: [{ isPassed: true, code: "C7" }] },
      { title: "الفصل الثاني 2026/2027", courses: [{ isPassed: true, code: "C8" }] },
    ],
  };

  const sem = determineUpcomingSemester(mock4YearStudent, new Set(), [], {
    maxYears: 4,
    activeMajorId: "ai",
  });
  assert.equal(sem.includes("الخامسة"), false, "Must never assign Year 5 to 4-year major");
  assert.equal(sem, "السنة الرابعة - الفصل الثاني");
});

test("advisoryPlan: getOfficialDegreeTotalCredits returns 132 for standard bachelor degrees", () => {
  // Non-engineering bachelor majors without student.totalCredits must return 132
  const aiStudent = { majorName: "الذكاء الاصطناعي", degree: "بكالوريوس" };
  assert.equal(getOfficialDegreeTotalCredits(aiStudent as any), 132);

  const sweStudent = { majorName: "هندسة البرمجيات", degree: "بكالوريوس" };
  assert.equal(getOfficialDegreeTotalCredits(sweStudent as any), 132);

  const businessStudent = { majorName: "إدارة الأعمال", degree: "بكالوريوس" };
  assert.equal(getOfficialDegreeTotalCredits(businessStudent as any), 132);

  // Engineering majors return 164
  const cseStudent = { majorName: "هندسة أنظمة الحاسوب", degree: "بكالوريوس" };
  assert.equal(getOfficialDegreeTotalCredits(cseStudent as any), 164);

  // Diplomas return 72
  const diplomaStudent = { majorName: "دبلوم تصميم جرافيكي", degree: "دبلوم متوسط" };
  assert.equal(getOfficialDegreeTotalCredits(diplomaStudent as any), 72);
});

test("advisoryPlan: getOfficialTuitionRate accurately bills Software Engineering at 20 JOD/hr", () => {
  const sweRate = getOfficialTuitionRate("هندسة البرمجيات");
  assert.equal(sweRate.hourlyRateJOD, 20);

  const sweRateNoPrefix = getOfficialTuitionRate("هندسة برمجيات");
  assert.equal(sweRateNoPrefix.hourlyRateJOD, 20);

  const cseRate = getOfficialTuitionRate("هندسة أنظمة الحاسوب");
  assert.equal(cseRate.hourlyRateJOD, 24);
});


