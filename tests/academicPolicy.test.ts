import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasStudentAcademicWarning,
  getStudentCreditLimits,
  getOfficialDegreeTotalCredits,
  calculateOfficialTuition,
  getCurrentAcademicSemesterCode,
  getCurrentAcademicYearString,
  isSectionOnline,
  getOfficialCohortYear,
} from "../src/core/academicPolicy";
import type { StudentSyncProfile } from "../src/services/studentService";

test("academicPolicy: hasStudentAcademicWarning accurately identifies warning status", () => {
  // Normal student
  const normalStudent: Partial<StudentSyncProfile> = {
    gpa: 82.5,
    academicStatus: "منتظم",
    academicWarning: "لا يوجد",
  };
  assert.equal(
    hasStudentAcademicWarning(normalStudent as StudentSyncProfile),
    false,
  );

  // Warning by academicWarning text
  const warningStudent1: Partial<StudentSyncProfile> = {
    gpa: 72,
    academicStatus: "منتظم",
    academicWarning: "إنذار أول",
  };
  assert.equal(
    hasStudentAcademicWarning(warningStudent1 as StudentSyncProfile),
    true,
  );

  // Warning by academicStatus
  const warningStudent2: Partial<StudentSyncProfile> = {
    gpa: 65,
    academicStatus: "تحت الملاحظة الأكاديمية",
    academicWarning: "لايوجد",
  };
  assert.equal(
    hasStudentAcademicWarning(warningStudent2 as StudentSyncProfile),
    true,
  );

  assert.equal(
    hasStudentAcademicWarning({
      gpa: 69,
      academicStatus: "منتظم",
      academicWarning: "إنذار أكاديمي",
    } as StudentSyncProfile),
    true,
    "An explicit warning must apply even when GPA is above 60",
  );
  assert.equal(
    hasStudentAcademicWarning({
      gpa: 69,
      academicStatus: "منتظم",
      academicWarning: "لا يوجد إنذار",
    } as StudentSyncProfile),
    false,
    "An explicit no-warning message must not trigger the warning cap",
  );
  assert.equal(
    hasStudentAcademicWarning({
      gpa: 69.4,
      academicStatus: "منتظم",
      academicWarning: "غير متوفر",
    } as StudentSyncProfile),
    false,
    "An unknown warning-field value must not be interpreted as an official warning",
  );
  assert.equal(
    getStudentCreditLimits({
      student: {
        gpa: 69.4,
        academicStatus: "منتظم",
        academicWarning: "غير متوفر",
      } as StudentSyncProfile,
      semesterName: "الفصل الثاني 2024/2025",
    }).maxCredits,
    19,
    "A GPA above 60 without an explicit warning must retain the normal semester limit",
  );

  // Warning by low GPA (< 60)
  const warningStudent3: Partial<StudentSyncProfile> = {
    gpa: 57.4,
    academicStatus: "منتظم",
    academicWarning: "",
  };
  assert.equal(
    hasStudentAcademicWarning(warningStudent3 as StudentSyncProfile),
    true,
  );

  // Null/undefined student
  assert.equal(hasStudentAcademicWarning(null), false);
});

test("academicPolicy: getStudentCreditLimits enforces PTUK credit limits", () => {
  // 1. Normal regular semester
  const normalReg = getStudentCreditLimits({
    student: { gpa: 75, academicStatus: "منتظم" } as StudentSyncProfile,
    semesterName: "الفصل الأول 2024/2025",
  });
  assert.equal(normalReg.maxCredits, 19);
  assert.equal(normalReg.minCredits, 12);
  assert.equal(normalReg.isSummer, false);
  assert.equal(normalReg.hasAcademicWarning, false);

  // 2. Normal summer semester
  const normalSummer = getStudentCreditLimits({
    student: { gpa: 75, academicStatus: "منتظم" } as StudentSyncProfile,
    semesterName: "الفصل الصيفي 2024/2025",
  });
  assert.equal(normalSummer.maxCredits, 10);
  assert.equal(normalSummer.minCredits, 0);
  assert.equal(normalSummer.isSummer, true);
  assert.equal(normalSummer.hasAcademicWarning, false);

  // 3. Academic Warning regular semester (must be capped at 14)
  const warningReg = getStudentCreditLimits({
    student: { gpa: 56, academicWarning: "إنذار" } as StudentSyncProfile,
    semesterName: "الفصل الثاني 2024/2025",
  });
  assert.equal(warningReg.maxCredits, 14);
  assert.equal(warningReg.hasAcademicWarning, true);

  const warningAt69 = getStudentCreditLimits({
    student: {
      gpa: 69,
      academicWarning: "إنذار أكاديمي",
    } as StudentSyncProfile,
    semesterName: "الفصل الثاني 2024/2025",
  });
  assert.equal(warningAt69.maxCredits, 14);

  // 4. Academic Warning summer semester (must be capped at 6)
  const warningSummer = getStudentCreditLimits({
    student: { gpa: 56, academicWarning: "إنذار" } as StudentSyncProfile,
    semesterName: "الفصل الصيفي 2024/2025",
  });
  assert.equal(warningSummer.maxCredits, 6);
  assert.equal(warningSummer.hasAcademicWarning, true);

  // 5. High GPA student (GPA >= 80) in regular semester (up to 21)
  const highGpaReg = getStudentCreditLimits({
    student: { gpa: 88, academicStatus: "منتظم" } as StudentSyncProfile,
    semesterName: "الفصل الأول 2024/2025",
  });
  assert.equal(highGpaReg.maxCredits, 21);
  assert.equal(highGpaReg.isHighGpaOrGraduating, true);

  // 6. High GPA student in summer semester (up to 12)
  const highGpaSummer = getStudentCreditLimits({
    student: { gpa: 88, academicStatus: "منتظم" } as StudentSyncProfile,
    semesterName: "الفصل الصيفي 2024/2025",
  });
  assert.equal(highGpaSummer.maxCredits, 12);
  assert.equal(highGpaSummer.isHighGpaOrGraduating, true);
});

test("academicPolicy: getOfficialDegreeTotalCredits scales across diploma, bachelor, and engineering", () => {
  // Official student record: 132 credits (Bachelor)
  const bachelorStudent: Partial<StudentSyncProfile> = {
    totalCredits: 132,
    majorName: "علم الحاسوب",
  };
  assert.equal(
    getOfficialDegreeTotalCredits(bachelorStudent as StudentSyncProfile),
    132,
  );

  // Official student record: 72 credits (Diploma)
  const diplomaStudent: Partial<StudentSyncProfile> = {
    totalCredits: 72,
    majorName: "دبلوم البرمجيات وقواعد البيانات",
  };
  assert.equal(
    getOfficialDegreeTotalCredits(diplomaStudent as StudentSyncProfile),
    72,
  );

  // Category requirements sum (excluding remedial)
  const catReqs = {
    "متطلب جامعة إجباري": 18,
    "متطلب جامعة اختياري": 6,
    "متطلب كلية": 24,
    "متطلب تخصص إجباري": 70,
    "متطلب تخصص اختياري": 14,
    "متطلب استدراكي": 6, // Should be excluded
  };
  assert.equal(getOfficialDegreeTotalCredits(null, catReqs), 132);

  // Fallback to default
  assert.equal(getOfficialDegreeTotalCredits(null, undefined, 164), 164);
});

test("academicPolicy: calculateOfficialTuition uses major hourly rate and 25 JOD registration fee", () => {
  // 15 credits for Computer Systems Engineering (24 JOD/hr)
  const cseStudent: Partial<StudentSyncProfile> = {
    majorName: "هندسة أنظمة الحاسوب",
  };
  const tuition = calculateOfficialTuition(
    15,
    cseStudent as StudentSyncProfile,
  );
  // 15 * 24 = 360 creditsCostJOD + 25 fixedFees = 385 JOD
  assert.equal(tuition.creditsCostJOD, 360);
  assert.equal(tuition.fixedFees, 25);
  assert.equal(tuition.totalJOD, 385);
  assert.equal(tuition.totalILS, Math.round(385 * 5.2));
});

test("academicPolicy: isSectionOnline accurately classifies delivery type", () => {
  // Explicit online flag
  assert.equal(isSectionOnline({ isOnline: true }), true);

  // Room indicator
  assert.equal(isSectionOnline({ room: "قاعة 5000 (الكتروني)" }), true);

  // Time indicator
  assert.equal(isSectionOnline({ timeText: "Online / عن بعد" }), true);

  // Zero-time block with no days
  assert.equal(
    isSectionOnline({ blocks: [{ start: 0, end: 0, days: [] }] }),
    true,
  );

  // Physical lecture
  assert.equal(
    isSectionOnline({
      room: "مبنى الهندسة 102",
      timeText: "08:30 - 09:45",
      blocks: [{ start: 8.5, end: 9.75, days: ["ن", "ر"] }],
    }),
    false,
  );
});

test("academicPolicy: getCurrentAcademicSemesterCode and Year return dynamic valid formats", () => {
  const code = getCurrentAcademicSemesterCode();
  assert.match(code, /^20\d{2}[1-3]$/);

  const yearStr = getCurrentAcademicYearString();
  assert.match(yearStr, /^20\d{2}\/20\d{2}$/);
});

test("academicPolicy: getOfficialCohortYear parses authentic cohort year", () => {
  const student: Partial<StudentSyncProfile> = {
    studentId: "12301234",
  };
  assert.equal(getOfficialCohortYear(student as StudentSyncProfile), "2023");
});
