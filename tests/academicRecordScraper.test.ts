import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDigitsAndText,
  parseSemesterWeight,
  applyCurriculumPrerequisitesAndSemesters,
  inferMajorFromCourses,
  parseExemptionExamRows,
} from "../server/services/studentPortalService.js";

test("academicRecordScraper normalizeDigitsAndText standardizes Arabic and Persian numerals", () => {
  assert.equal(normalizeDigitsAndText("٢٠٢١١٠١٢٣"), "202110123");
  assert.equal(normalizeDigitsAndText("علامة: ٨٥.٥ %"), "علامة: 85.5 %");
  assert.equal(normalizeDigitsAndText("ساعات: ۳"), "ساعات: 3");
  assert.equal(
    normalizeDigitsAndText("السِّجِلّ الأكاديمي"),
    "السجل الأكاديمي",
  );
});

test("academicRecordScraper parseSemesterWeight provides strict chronological ordering", () => {
  const s1 = parseSemesterWeight("الفصل الأول 2021/2022");
  const s2 = parseSemesterWeight("الفصل الثاني 2021/2022");
  const s3 = parseSemesterWeight("الدورة الصيفية 2021/2022");
  const s4 = parseSemesterWeight("الفصل الأول 2022/2023");
  const s5 = parseSemesterWeight("الفصل الثاني 2022/2023");
  const s6 = parseSemesterWeight("الفصل الأول ٢٠٢٣/٢٠٢٤");

  assert.ok(s1 < s2, "Fall 2021 comes before Spring 2022");
  assert.ok(s2 < s3, "Spring 2022 comes before Summer 2022");
  assert.ok(s3 < s4, "Summer 2022 comes before Fall 2022");
  assert.ok(s4 < s5, "Fall 2022 comes before Spring 2023");
  assert.ok(s5 < s6, "Spring 2023 comes before Fall 2023 with Arabic digits");
});

test("applyCurriculumPrerequisitesAndSemesters links prerequisites and normalizes academic semesters", () => {
  const inputCourses = [
    { id: "12140101", name: "برمجة حاسوب", credits: 3 },
    { id: "12140102", name: "البرمجة الكينونية", credits: 3 },
    { id: "12140203", name: "تركيب بيانات", credits: 3 },
    { id: "15010101", name: "تفاضل وتكامل (1)", credits: 3 },
    { id: "15010102", name: "تفاضل وتكامل (2)", credits: 3 },
  ];

  const processed = applyCurriculumPrerequisitesAndSemesters(
    inputCourses,
    "cse",
    "هندسة أنظمة الحاسوب",
  );

  const oop = processed.find((c: any) => c.id === "12140102");
  assert.ok(oop, "OOP course exists");
  assert.ok(
    oop.prerequisites.includes("12140101"),
    "OOP depends on Programming 1",
  );

  const calc2 = processed.find((c: any) => c.id === "15010102");
  assert.ok(calc2, "Calculus 2 exists");
  assert.ok(
    calc2.prerequisites.includes("15010101"),
    "Calculus 2 depends on Calculus 1",
  );

  // Every course has a valid semester string
  for (const c of processed) {
    assert.ok(
      c.semester && c.semester.includes("السنة"),
      `Course ${c.id} has valid semester: ${c.semester}`,
    );
    assert.ok(
      c.recommendedSemester && c.recommendedSemester.includes("السنة"),
      `Course ${c.id} has valid recommendedSemester: ${c.recommendedSemester}`,
    );
  }
});

test("inferMajorFromCourses correctly infers major from course codes", () => {
  const cseCourses = [
    { id: "12110236", name: "الدوائر الكهربائية" },
    { id: "12140101", name: "برمجة حاسوب" },
  ];
  const cseMajor = inferMajorFromCourses(cseCourses, "202410616");
  assert.equal(cseMajor.id, "cse");
  assert.ok(cseMajor.name.includes("أنظمة الحاسوب"));

  const aiCourses = [{ id: "19030201", name: "مقدمة في الذكاء الاصطناعي" }];
  const aiMajor = inferMajorFromCourses(aiCourses, "202419030");
  assert.equal(aiMajor.id, "ai");
});

test("parseExemptionExamRows correctly parses Edugate exemption exams with comma-separated exempted courses (15200099,15200106)", () => {
  const mockScraped = [
    {
      examName: "امتحان مهارات حاسوب",
      semester: "20241",
      exemptedCoursesRaw: "13010006",
      passedRaw: "",
      cells: ["امتحان مهارات حاسوب", "20241", "13010006", ""],
      text: "امتحان مهارات حاسوب 20241 13010006",
    },
    {
      examName: "امتحان مستوى انجليزي",
      semester: "20241",
      exemptedCoursesRaw: "15200099,15200106",
      passedRaw: "",
      cells: ["امتحان مستوى انجليزي", "20241", "15200099,15200106", ""],
      text: "امتحان مستوى انجليزي 20241 15200099,15200106",
    },
  ];

  const { exemptionExams, passedCourseCodes } =
    parseExemptionExamRows(mockScraped);

  assert.equal(
    passedCourseCodes.has("13010006"),
    true,
    "Computer skills exempted",
  );
  assert.equal(
    passedCourseCodes.has("15200099"),
    true,
    "English remedial exempted",
  );
  assert.equal(passedCourseCodes.has("15200106"), true, "English 1 exempted");

  const engRemedial = exemptionExams.find((e) => e.code === "15200099");
  assert.ok(engRemedial, "Remedial English must be in exemptionExams");
  assert.equal(engRemedial?.name, "إنجليزي إستدراكي");
  assert.equal(engRemedial?.isPassed, true);

  const eng1 = exemptionExams.find((e) => e.code === "15200106");
  assert.ok(eng1, "English 1 must be in exemptionExams");
  assert.equal(eng1?.name, "اللغة الإنجليزية (1)");
  assert.equal(eng1?.isPassed, true);
  assert.ok(eng1?.status.includes("معفى"));
});

test("parseExemptionExamRows correctly handles English exam when only remedial is exempted", () => {
  const mockScraped = [
    {
      examName: "امتحان مستوى انجليزي",
      semester: "20241",
      exemptedCoursesRaw: "15200099",
      passedRaw: "",
      cells: ["امتحان مستوى انجليزي", "20241", "15200099", ""],
      text: "امتحان مستوى انجليزي 20241 15200099",
    },
  ];

  const { exemptionExams, passedCourseCodes } =
    parseExemptionExamRows(mockScraped);
  assert.equal(passedCourseCodes.has("15200099"), true);
  assert.equal(
    passedCourseCodes.has("15200106"),
    false,
    "English 1 must NOT be exempted if only 15200099 is listed",
  );
  assert.equal(exemptionExams.length, 1);
});

test("parseExemptionExamRows ensures remedial English is also exempted when English 1 is exempted alone", () => {
  const mockScraped = [
    {
      examName: "امتحان مستوى انجليزي",
      semester: "20241",
      exemptedCoursesRaw: "15200106",
      passedRaw: "",
      cells: ["امتحان مستوى انجليزي", "20241", "15200106", ""],
      text: "امتحان مستوى انجليزي 20241 15200106",
    },
  ];

  const { passedCourseCodes } = parseExemptionExamRows(mockScraped);
  assert.equal(passedCourseCodes.has("15200106"), true);
  assert.equal(
    passedCourseCodes.has("15200099"),
    true,
    "English remedial must be automatically inferred if English 1 is exempted",
  );
});

test("parseExemptionExamRows marks exam as not passed when explicitly failed", () => {
  const mockScraped = [
    {
      examName: "امتحان مستوى انجليزي",
      semester: "20241",
      exemptedCoursesRaw: "",
      passedRaw: "راسب",
      cells: ["امتحان مستوى انجليزي", "20241", "", "راسب"],
      text: "امتحان مستوى انجليزي 20241 راسب",
    },
  ];

  const { exemptionExams, passedCourseCodes } =
    parseExemptionExamRows(mockScraped);
  assert.equal(passedCourseCodes.size, 0);
  assert.equal(exemptionExams.length, 1);
  assert.equal(exemptionExams[0].isPassed, false);
  assert.ok(exemptionExams[0].status.includes("راسب"));
});

test("parseExemptionExamRows automatically exempts BOTH English 1 (15200106) and Remedial English (15200099) when placement exam grade >= 80", () => {
  const mockScraped = [
    {
      examName: "امتحان مستوى لغة انجليزية",
      semester: "20241",
      exemptedCoursesRaw: "",
      passedRaw: "ناجح",
      cells: ["امتحان مستوى لغة انجليزية", "20241", "85", "ناجح"],
      text: "امتحان مستوى لغة انجليزية 20241 85 ناجح",
    },
  ];

  const { exemptionExams, passedCourseCodes } =
    parseExemptionExamRows(mockScraped);
  assert.equal(
    passedCourseCodes.has("15200099"),
    true,
    "Must exempt Remedial English",
  );
  assert.equal(
    passedCourseCodes.has("15200106"),
    true,
    "Must exempt English 1 for grade >= 80",
  );

  const eng1 = exemptionExams.find((e) => e.code === "15200106");
  assert.ok(eng1, "English 1 must be present in exemptionExams");
  assert.equal(eng1?.grade, 85);
  assert.equal(eng1?.isPassed, true);
  assert.ok(eng1?.status.includes("تفوق"));

  const engRem = exemptionExams.find((e) => e.code === "15200099");
  assert.ok(engRem, "Remedial English must be present");
  assert.equal(engRem?.isPassed, true);
});

test("parseExemptionExamRows only exempts Remedial English when placement exam grade is between 50 and 79", () => {
  const mockScraped = [
    {
      examName: "امتحان مستوى لغة انجليزية",
      semester: "20241",
      exemptedCoursesRaw: "",
      passedRaw: "ناجح",
      cells: ["امتحان مستوى لغة انجليزية", "20241", "72", "ناجح"],
      text: "امتحان مستوى لغة انجليزية 20241 72 ناجح",
    },
  ];

  const { exemptionExams, passedCourseCodes } =
    parseExemptionExamRows(mockScraped);
  assert.equal(
    passedCourseCodes.has("15200099"),
    true,
    "Must exempt Remedial English for 50-79",
  );
  assert.equal(
    passedCourseCodes.has("15200106"),
    false,
    "Must NOT exempt English 1 when grade < 80",
  );
  assert.equal(exemptionExams.length, 1);
  assert.equal(exemptionExams[0].grade, 72);
});

test("parseExemptionExamRows correctly identifies Arabic and English 1 text in cells even without numeric code", () => {
  const mockScraped = [
    {
      examName: "امتحان قبول لغة إنجليزية",
      semester: "20241",
      exemptedCoursesRaw: "لغة إنجليزية 1",
      passedRaw: "معفى",
      cells: ["امتحان قبول لغة إنجليزية", "20241", "لغة إنجليزية 1", "معفى"],
      text: "امتحان قبول لغة إنجليزية 20241 لغة إنجليزية 1 معفى",
    },
  ];

  const { passedCourseCodes } = parseExemptionExamRows(mockScraped);
  assert.equal(
    passedCourseCodes.has("15200106"),
    true,
    "Must extract English 1 from text",
  );
  assert.equal(
    passedCourseCodes.has("15200099"),
    true,
    "Must infer Remedial English when English 1 is exempted",
  );
});
