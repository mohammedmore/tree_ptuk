import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDigits,
  parseSemesterWeight,
  resolveAcademicSemester,
  determineUpcomingSemester,
  getNextPlanningSemester,
  autoPopulateUpcomingSemester,
  extractCohortYear,
} from "../src/utils/semesterUtils";
import { courses as realCatalogCourses } from "../src/data";
import { REGULAR_SEMESTERS, SEMESTERS } from "../src/constants";

test("semesterUtils normalizeDigits standardizes Arabic and Persian numerals", () => {
  assert.equal(normalizeDigits("٢٠٢٣/٢٠٢٤"), "2023/2024");
  assert.equal(
    normalizeDigits("الفصل الثاني 2024/2025"),
    "الفصل الثاني 2024/2025",
  );
  assert.equal(normalizeDigits(""), "");
});

test("semesterUtils parseSemesterWeight orders semesters strictly chronologically", () => {
  const y1f = parseSemesterWeight("الفصل الأول 2023/2024");
  const y1s = parseSemesterWeight("الفصل الثاني 2023/2024");
  const y1sum = parseSemesterWeight("الدورة الصيفية 2023/2024");
  const y2f = parseSemesterWeight("الفصل الأول 2024/2025");
  const y2s = parseSemesterWeight("الفصل الثاني 2024/2025");

  assert.ok(y1f < y1s, "Year 1 Fall < Year 1 Spring");
  assert.ok(y1s < y1sum, "Year 1 Spring < Year 1 Summer");
  assert.ok(y1sum < y2f, "Year 1 Summer < Year 2 Fall");
  assert.ok(y2f < y2s, "Year 2 Fall < Year 2 Spring");
});

test("semesterUtils resolveAcademicSemester resolves Edugate titles to academic plan terms", () => {
  // Cohort 2023
  assert.equal(
    resolveAcademicSemester("الفصل الأول 2023/2024", "2023"),
    "السنة الأولى - الفصل الأول",
  );
  assert.equal(
    resolveAcademicSemester("الفصل الثاني 2023/2024", "2023"),
    "السنة الأولى - الفصل الثاني",
  );
  assert.equal(
    resolveAcademicSemester("الدورة الصيفية 2023/2024", "2023"),
    "السنة الأولى - الصيفي",
  );
  assert.equal(
    resolveAcademicSemester("الفصل الأول 2024/2025", "2023"),
    "السنة الثانية - الفصل الأول",
  );
  assert.equal(
    resolveAcademicSemester("الفصل الثاني 2024/2025", "2023"),
    "السنة الثانية - الفصل الثاني",
  );
  assert.equal(
    resolveAcademicSemester("الفصل الأول 2025/2026", "2023"),
    "السنة الثالثة - الفصل الأول",
  );

  // Exact semester name pass-through
  assert.equal(
    resolveAcademicSemester("السنة الثانية - الفصل الثاني"),
    "السنة الثانية - الفصل الثاني",
  );
});

test("semesterUtils determineUpcomingSemester accurately resolves Year 2 Semester 2 without defaulting to Summer", () => {
  // Scenario A: Student with active Edugate semester "الفصل الثاني 2024/2025" and cohort 2023
  const studentWithCurrent = {
    studentId: "202310888",
    cohortYear: "2023",
    currentSemester: "الفصل الثاني 2024/2025",
    semesters: [
      { title: "الفصل الأول 2024/2025", courses: [] },
      { title: "الفصل الثاني 2023/2024", courses: [] },
      { title: "الفصل الأول 2023/2024", courses: [] },
    ],
  };

  assert.equal(
    determineUpcomingSemester(studentWithCurrent),
    "السنة الثانية - الفصل الثاني",
    "Must determine Year 2 Semester 2 and NOT Summer",
  );

  // Scenario B: Student without currentSemester string, but completed 3 regular terms (Year 1 Fall, Year 1 Spring, Year 2 Fall)
  const studentCompletedThree = {
    studentId: "202310123",
    cohortYear: "2023",
    semesters: [
      { title: "الفصل الأول 2024/2025", courses: [] },
      { title: "الدورة الصيفية 2023/2024", courses: [] }, // optional summer taken
      { title: "الفصل الثاني 2023/2024", courses: [] },
      { title: "الفصل الأول 2023/2024", courses: [] },
    ],
  };

  assert.equal(
    determineUpcomingSemester(studentCompletedThree),
    "السنة الثانية - الفصل الثاني",
    "Even with past summer, the 4th regular semester must be Year 2 Semester 2",
  );

  // Scenario C: Student is guest or has empty semesters, but completed courses include Year 2 Semester 1 courses
  const completedSet = new Set([
    "12140101",
    "15010101",
    "12140102",
    "15010102",
    "12140201",
  ]);
  const mockCourses = [
    { id: "12140101", name: "C++", category: "متطلب كلية إجباري", credits: 3 },
    {
      id: "15010101",
      name: "Calc 1",
      category: "متطلب كلية إجباري",
      credits: 3,
    },
    {
      id: "12140102",
      name: "Adv C++",
      category: "متطلب كلية إجباري",
      credits: 3,
    },
    {
      id: "15010102",
      name: "Calc 2",
      category: "متطلب كلية إجباري",
      credits: 3,
    },
    {
      id: "12140201",
      name: "Digital Logic",
      category: "متطلب تخصص إجباري",
      credits: 3,
    },
  ];

  assert.equal(
    determineUpcomingSemester(null, completedSet, mockCourses as any),
    "السنة الثانية - الفصل الثاني",
    "Must determine Year 2 Semester 2 based on completed courses up to Year 2 Semester 1",
  );
});

test("semesterUtils determineUpcomingSemester plans for the semester AFTER current when courses are registered", () => {
  // When a student has registered courses in their current semester, that semester is actively ongoing
  // and the planner must advance to plan for the subsequent academic term.
  const studentWithRegistered = {
    studentId: "202310888",
    cohortYear: "2023",
    currentSemester: "الفصل الثاني 2024/2025",
    semesters: [
      {
        title: "الفصل الثاني 2024/2025",
        courses: [
          {
            code: "12140203",
            name: "Data Structures",
            credits: 3,
            status: "مسجل",
            isRegistered: true,
            grade: null,
          },
          {
            code: "12110236",
            name: "Electric Circuits",
            credits: 3,
            status: "مسجل",
            isRegistered: true,
            grade: null,
          },
        ],
      },
      {
        title: "الفصل الأول 2024/2025",
        courses: [
          {
            code: "12140201",
            name: "Digital Logic",
            credits: 3,
            status: "ناجح",
            isPassed: true,
            grade: 85,
          },
        ],
      },
      {
        title: "الفصل الثاني 2023/2024",
        courses: [
          {
            code: "12140102",
            name: "Adv C++",
            credits: 3,
            status: "ناجح",
            isPassed: true,
            grade: 88,
          },
        ],
      },
      {
        title: "الفصل الأول 2023/2024",
        courses: [
          {
            code: "12140101",
            name: "C++",
            credits: 3,
            status: "ناجح",
            isPassed: true,
            grade: 90,
          },
        ],
      },
    ],
  };

  // Student is currently taking Year 2 Semester 2 ("الفصل الثاني 2024/2025"), so they must plan for Year 3 Semester 1 ("السنة الثالثة - الفصل الأول")
  assert.equal(
    determineUpcomingSemester(studentWithRegistered),
    "السنة الثالثة - الفصل الأول",
    "Must advance to Year 3 Semester 1 because student is currently registered in Year 2 Semester 2",
  );
});

test("semesterUtils getNextPlanningSemester skips optional summer by default", () => {
  assert.equal(
    getNextPlanningSemester("السنة الأولى - الفصل الثاني"),
    "السنة الثانية - الفصل الأول",
  );
  assert.equal(
    getNextPlanningSemester("السنة الثانية - الفصل الأول"),
    "السنة الثانية - الفصل الثاني",
  );
  assert.equal(
    getNextPlanningSemester("السنة الثانية - الفصل الثاني"),
    "السنة الثالثة - الفصل الأول",
  );
  assert.equal(
    getNextPlanningSemester("السنة الأولى - الصيفي"),
    "السنة الثانية - الفصل الأول",
  );
});

test("semesterUtils autoPopulateUpcomingSemester populates Year 2 Semester 2 courses instead of Year 1 courses", () => {
  // Passed Year 1 courses
  const passedSet = new Set([
    "15200099", // Remedial English
    "13010006", // Computer skills
    "12140101", // C++
    "15010101", // Calc 1
    "15020101", // Physics 1
    "15020105", // Physics Lab 1
    "15200106", // English 1
    "12140102", // OOP
    "15010102", // Calc 2
    "15020102", // Physics 2
    "15020106", // Physics Lab 2
    "12210137", // Workshop
    "15200112", // English 2
    // Year 2 Sem 1 passed
    "12140203", // Data Structures 1
    "12110236", // Circuit 1
    "15010229", // Linear Algebra
    "12140208", // Logic
    "12140204", // Discrete
    "15200104", // Community Service
  ]);

  const targetSemester = "السنة الثانية - الفصل الثاني";
  const existingPlanned: Record<string, string> = {};

  const populated = autoPopulateUpcomingSemester(
    realCatalogCourses,
    targetSemester,
    passedSet,
    existingPlanned,
  );

  const plannedInTarget = Object.entries(populated)
    .filter(([, sem]) => sem === targetSemester)
    .map(([id]) => id);

  // Must include the Year 2 Semester 2 core courses
  // Data Structures (12140205), Circuits (12120205), ODE (15010230), Electronics (12110237), Stats (13010007), Circuits Lab (12120207)
  assert.ok(
    plannedInTarget.includes("12140205"),
    "Must include Data Structures (12140205)",
  );
  assert.ok(
    plannedInTarget.includes("12120205"),
    "Must include Electric Circuits (12120205)",
  );
  assert.ok(
    plannedInTarget.includes("15010230"),
    "Must include ODE (15010230)",
  );
  assert.ok(
    plannedInTarget.includes("12110237"),
    "Must include Electronics (12110237)",
  );
  assert.ok(
    plannedInTarget.includes("13010007"),
    "Must include Engineering Statistics (13010007)",
  );
  assert.ok(
    plannedInTarget.includes("12120207"),
    "Must include Electric Circuits Lab (12120207)",
  );

  // Must NOT include random Year 1 courses
  assert.ok(
    !plannedInTarget.includes("12140101"),
    "Must NOT include Year 1 C++",
  );
  assert.ok(
    !plannedInTarget.includes("15010101"),
    "Must NOT include Year 1 Calc 1",
  );
});

test("semesterUtils resolves past transcript semesters into distinct academic terms with marks", () => {
  const transcriptSemesters = [
    {
      title: "الفصل الأول 2023/2024",
      courses: [
        {
          code: "12140101",
          name: "برمجة كينونية",
          credits: 3,
          grade: 88,
          isPassed: true,
          isRegistered: false,
          isFailed: false,
          status: "ناجح",
        },
        {
          code: "15010101",
          name: "تفاضل وتكامل 1",
          credits: 3,
          grade: 75,
          isPassed: true,
          isRegistered: false,
          isFailed: false,
          status: "ناجح",
        },
      ],
    },
    {
      title: "الفصل الثاني 2023/2024",
      courses: [
        {
          code: "12140102",
          name: "برمجة متقدمة",
          credits: 3,
          grade: 82,
          isPassed: true,
          isRegistered: false,
          isFailed: false,
          status: "ناجح",
        },
      ],
    },
    {
      title: "الفصل الأول 2024/2025",
      courses: [
        {
          code: "12140201",
          name: "منطق رقمي",
          credits: 3,
          grade: 91,
          isPassed: true,
          isRegistered: false,
          isFailed: false,
          status: "ناجح",
        },
      ],
    },
  ];

  const cohort = "2023";
  const mapped = new Map();
  transcriptSemesters.forEach((sem, idx) => {
    const resolved = resolveAcademicSemester(sem.title, cohort, idx);
    const totalCredits = sem.courses.reduce((sum, c) => sum + c.credits, 0);
    const passedCredits = sem.courses
      .filter((c) => c.isPassed)
      .reduce((sum, c) => sum + c.credits, 0);
    mapped.set(resolved, {
      originalTitle: sem.title,
      courses: sem.courses,
      totalCredits,
      passedCredits,
    });
  });

  assert.ok(mapped.has("السنة الأولى - الفصل الأول"));
  assert.ok(mapped.has("السنة الأولى - الفصل الثاني"));
  assert.ok(mapped.has("السنة الثانية - الفصل الأول"));

  const term1 = mapped.get("السنة الأولى - الفصل الأول");
  assert.equal(term1.courses.length, 2);
  assert.equal(term1.courses[0].grade, 88);
  assert.equal(term1.passedCredits, 6);

  const term3 = mapped.get("السنة الثانية - الفصل الأول");
  assert.equal(term3.courses[0].code, "12140201");
  assert.equal(term3.courses[0].grade, 91);
});

test("semesterUtils extractCohortYear accurately parses PTUK IDs and student profiles", () => {
  // PTUK 8-digit IDs
  assert.equal(extractCohortYear({ studentId: "12214050" }), 2022);
  assert.equal(extractCohortYear({ studentId: "12301234" }), 2023);
  assert.equal(extractCohortYear({ studentId: "12455555" }), 2024);

  // 9-digit standard format
  assert.equal(extractCohortYear({ studentId: "202310123" }), 2023);

  // Explicit cohortYear
  assert.equal(extractCohortYear({ cohortYear: "2023" }), 2023);
  assert.equal(extractCohortYear({ cohortYear: "123" }), 2023);
  assert.equal(extractCohortYear({ cohortYear: "1221" }), 2022);

  // Fallback to earliest transcript semester
  assert.equal(
    extractCohortYear({
      semesters: [
        { title: "الفصل الأول 2024/2025" },
        { title: "الفصل الثاني 2022/2023" },
      ],
    }),
    2022,
  );
});

test("semesterUtils correctly maps newest-first transcript semesters to chronological academic terms", () => {
  // Real Edugate transcript list is ordered newest-to-oldest:
  const newestFirstSemesters = [
    {
      title: "الفصل الأول 2024/2025",
      courses: [
        {
          code: "12140201",
          name: "منطق رقمي",
          credits: 3,
          grade: 90,
          isPassed: true,
          isRegistered: false,
          isFailed: false,
          status: "ناجح",
        },
      ],
    },
    {
      title: "الفصل الثاني 2023/2024",
      courses: [
        {
          code: "12140102",
          name: "برمجة متقدمة",
          credits: 3,
          grade: 85,
          isPassed: true,
          isRegistered: false,
          isFailed: false,
          status: "ناجح",
        },
      ],
    },
    {
      title: "الفصل الأول 2023/2024",
      courses: [
        {
          code: "12140101",
          name: "برمجة حاسوب",
          credits: 3,
          grade: 88,
          isPassed: true,
          isRegistered: false,
          isFailed: false,
          status: "ناجح",
        },
      ],
    },
  ];

  const student = {
    studentId: "12314050", // PTUK Year 2 student
    currentSemester: "الفصل الثاني 2024/2025",
    semesters: newestFirstSemesters,
  };

  const cohort = extractCohortYear(student);
  assert.equal(
    cohort,
    2023,
    "Cohort must resolve to 2023 for PTUK ID 12314050",
  );

  // Upcoming semester for student in Year 2 Semester 2
  const upcoming = determineUpcomingSemester(student);
  assert.equal(upcoming, "السنة الثانية - الفصل الثاني");

  // Sort chronologically and map
  const sorted = [...newestFirstSemesters].sort(
    (a, b) => parseSemesterWeight(a.title) - parseSemesterWeight(b.title),
  );

  const mapped = new Map();
  let regularCount = 0;
  sorted.forEach((sem) => {
    const isSummer = sem.title.includes("صيفي");
    const resolved = resolveAcademicSemester(
      sem.title,
      cohort,
      isSummer ? undefined : regularCount,
    );
    if (!isSummer) regularCount++;
    mapped.set(resolved, { title: sem.title, courses: sem.courses });
  });

  // Verify Year 1 Term 1 has "برمجة حاسوب" and NOT "منطق رقمي"
  assert.ok(mapped.has("السنة الأولى - الفصل الأول"));
  assert.equal(
    mapped.get("السنة الأولى - الفصل الأول").courses[0].code,
    "12140101",
  );
  assert.equal(
    mapped.get("السنة الأولى - الفصل الأول").title,
    "الفصل الأول 2023/2024",
  );

  // Verify Year 1 Term 2 has "برمجة متقدمة"
  assert.ok(mapped.has("السنة الأولى - الفصل الثاني"));
  assert.equal(
    mapped.get("السنة الأولى - الفصل الثاني").courses[0].code,
    "12140102",
  );
  assert.equal(
    mapped.get("السنة الأولى - الفصل الثاني").title,
    "الفصل الثاني 2023/2024",
  );

  // Verify Year 2 Term 1 has "منطق رقمي"
  assert.ok(mapped.has("السنة الثانية - الفصل الأول"));
  assert.equal(
    mapped.get("السنة الثانية - الفصل الأول").courses[0].code,
    "12140201",
  );
  assert.equal(
    mapped.get("السنة الثانية - الفصل الأول").title,
    "الفصل الأول 2024/2025",
  );
});

test("semesterUtils autoPopulateUpcomingSemester strictly excludes currently registered courses from upcoming semester", () => {
  const passedSet = new Set(["12140101", "15010101"]);
  const currentlyRegistered = ["12110237", "12110316", "12120208"]; // e.g. circuits lab, digital electronics
  const targetSemester = "السنة الثالثة - الفصل الثاني";

  // Suppose one of the registered courses was mistakenly present in existingPlanned
  const existingPlanned: Record<string, string> = {
    "12110237": targetSemester, // should be purged
    "12140203": "السنة الثانية - الفصل الأول",
  };

  const result = autoPopulateUpcomingSemester(
    realCatalogCourses,
    targetSemester,
    passedSet,
    existingPlanned,
    currentlyRegistered,
  );

  // None of the registered courses should be in targetSemester
  for (const regCode of currentlyRegistered) {
    assert.notEqual(
      result[regCode],
      targetSemester,
      `Registered course ${regCode} must NEVER be planned into ${targetSemester}`,
    );
  }
});
