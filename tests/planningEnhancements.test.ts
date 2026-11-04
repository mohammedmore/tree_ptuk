import test from "node:test";
import assert from "node:assert/strict";
import {
  computeMultipleCriticalTracks,
  simulateProjectedGpa,
  classifyCourseReadiness,
  autoPlanToGraduation,
  checkSemesterScheduleFeasibility,
} from "../src/utils/planningEnhancements";
import type { Course } from "../src/data";

const mockCourses: Course[] = [
  // Software Track
  {
    id: "CS101",
    name: "برمجة حاسوب",
    category: "متطلب كلية إجباري",
    credits: 3,
    prerequisites: [],
    availableSemesters: ["first", "second"],
  },
  {
    id: "CS102",
    name: "برمجة كينونية",
    category: "متطلب كلية إجباري",
    credits: 3,
    prerequisites: ["CS101"],
    availableSemesters: ["second"],
  },
  {
    id: "CS201",
    name: "تراكيب بيانات",
    category: "متطلب تخصص إجباري",
    credits: 3,
    prerequisites: ["CS102"],
    availableSemesters: ["first"],
  },
  {
    id: "CS301",
    name: "خوارزميات",
    category: "متطلب تخصص إجباري",
    credits: 3,
    prerequisites: ["CS201"],
    availableSemesters: ["second"],
  },

  // Hardware Track
  {
    id: "EE101",
    name: "فيزياء عامة 2",
    category: "متطلب كلية إجباري",
    credits: 3,
    prerequisites: [],
    availableSemesters: ["second"],
  },
  {
    id: "EE201",
    name: "دوائر كهربائية 1",
    category: "متطلب كلية إجباري",
    credits: 3,
    prerequisites: ["EE101"],
    availableSemesters: ["first"],
  },
  {
    id: "EE202",
    name: "إلكترونيات",
    category: "متطلب تخصص إجباري",
    credits: 3,
    prerequisites: ["EE201"],
    availableSemesters: ["second"],
  },

  // Math Track
  {
    id: "MATH101",
    name: "تفاضل وتكامل 1",
    category: "متطلب كلية إجباري",
    credits: 3,
    prerequisites: [],
    availableSemesters: ["first", "second"],
  },
  {
    id: "MATH102",
    name: "تفاضل وتكامل 2",
    category: "متطلب كلية إجباري",
    credits: 3,
    prerequisites: ["MATH101"],
    availableSemesters: ["second"],
  },
  {
    id: "MATH201",
    name: "معادلات تفاضلية",
    category: "متطلب كلية إجباري",
    credits: 3,
    prerequisites: ["MATH102"],
    availableSemesters: ["first"],
  },
];

test("computeMultipleCriticalTracks identifies multiple distinct bottleneck tracks", () => {
  const tracks = computeMultipleCriticalTracks(mockCourses);

  assert.ok(tracks.has("CS101"), "Must evaluate CS101");
  const cs101 = tracks.get("CS101")!;
  assert.equal(cs101.track, "برمجيات وخوارزميات");
  assert.equal(
    cs101.chainDepth,
    3,
    "CS101 has chain depth 3 (CS102 -> CS201 -> CS301)",
  );
  assert.ok(cs101.isBottleneck);

  assert.ok(tracks.has("EE201"));
  const ee201 = tracks.get("EE201")!;
  assert.equal(ee201.track, "عتاد وأنظمة");
  assert.equal(ee201.chainDepth, 1, "EE201 has chain depth 1 (EE202)");

  assert.ok(tracks.has("MATH101"));
  const math101 = tracks.get("MATH101")!;
  assert.equal(math101.track, "رياضيات وعلوم");
  assert.equal(math101.chainDepth, 2);
});

test("simulateProjectedGpa accurately calculates term GPA and cumulative graduation GPA", () => {
  const completed = [
    { grade: 80, credits: 3 },
    { grade: 90, credits: 3 },
  ]; // Cumulative so far: 85 (6 cr)

  const plannedWithGrades = [
    { grade: 70, credits: 3 },
    { grade: 80, credits: 3 },
  ]; // Term GPA: 75 (6 cr)

  const res = simulateProjectedGpa(completed, plannedWithGrades);
  assert.equal(res.termGpa, 75);
  // Total 80 + 90 + 70 + 80 = 320 / 4 courses = 80.0
  assert.equal(res.cumulativeGpa, 80);
  assert.equal(res.totalPlannedCredits, 6);
});

test("classifyCourseReadiness accurately classifies ready, in_progress, and locked courses", () => {
  const completed = new Set(["CS101"]);
  const priorPlanned = new Set(["CS102"]);

  // CS102 prereq is CS101 (completed) -> ready
  const cs102 = mockCourses.find((c) => c.id === "CS102")!;
  assert.equal(
    classifyCourseReadiness(cs102, completed, priorPlanned),
    "ready",
  );

  // CS201 prereq is CS102 (not completed, but in priorPlanned) -> in_progress_prereq
  const cs201 = mockCourses.find((c) => c.id === "CS201")!;
  assert.equal(
    classifyCourseReadiness(cs201, completed, priorPlanned),
    "in_progress_prereq",
  );

  // CS301 prereq is CS201 (neither completed nor prior planned) -> locked
  const cs301 = mockCourses.find((c) => c.id === "CS301")!;
  assert.equal(
    classifyCourseReadiness(cs301, completed, priorPlanned),
    "locked",
  );
});

test("autoPlanToGraduation plans remaining courses across terms respecting prerequisites and locked terms", () => {
  const completed = new Set(["CS101", "MATH101", "EE101"]);
  const existingPlanned: Record<string, string> = {};
  const locked = new Set<string>();

  const planned = autoPlanToGraduation(
    mockCourses,
    "السنة الأولى - الفصل الثاني",
    completed,
    existingPlanned,
    locked,
    18,
  );

  // CS102 should be in Year 1 Term 2
  assert.equal(planned["CS102"], "السنة الأولى - الفصل الثاني");

  // CS201 requires CS102, so it must be placed in a subsequent term (Year 2 Term 1)
  assert.equal(planned["CS201"], "السنة الثانية - الفصل الأول");

  // CS301 requires CS201, so it must be placed in Year 2 Term 2
  assert.equal(planned["CS301"], "السنة الثانية - الفصل الثاني");
});

test("autoPlanToGraduation strictly excludes currently registered courses from future terms", () => {
  const completed = new Set(["CS101"]);
  const registered = new Set(["CS102"]); // currently taking CS102 this term
  const existingPlanned: Record<string, string> = {
    CS102: "السنة الأولى - الفصل الثاني", // lingering erroneous entry
  };

  const planned = autoPlanToGraduation(
    mockCourses,
    "السنة الأولى - الفصل الثاني",
    completed,
    existingPlanned,
    new Set(),
    18,
    false,
    undefined,
    registered,
  );

  // CS102 is currently registered, so it must NEVER be planned into any future term
  assert.equal(
    planned["CS102"],
    undefined,
    "Registered course CS102 must be purged and not scheduled",
  );

  // CS201 requires CS102 and is available in "first" semester.
  // Since CS102 is satisfied by in-progress registration, CS201 is scheduled in Year 2 Term 1 (the next available first semester)!
  assert.equal(
    planned["CS201"],
    "السنة الثانية - الفصل الأول",
    "CS201 prerequisite CS102 is satisfied by in-progress registration",
  );
});

test("checkSemesterScheduleFeasibility detects missing sections", () => {
  const coursesById = new Map<string, Course>();
  coursesById.set("C1", {
    id: "C1",
    name: "مادة بدون شعب",
    category: "إجباري",
    credits: 3,
    prerequisites: [],
    sections: [],
  });
  coursesById.set("C2", {
    id: "C2",
    name: "مادة مع شعب",
    category: "إجباري",
    credits: 3,
    prerequisites: [],
    sections: [
      {
        sectionNumber: 1,
        times: "10:00-11:00",
        days: "ن ث ر",
        activity: "نظري",
      },
    ],
  });

  const check = checkSemesterScheduleFeasibility(["C1", "C2"], coursesById);
  assert.ok(check.hasClash);
  assert.equal(check.warnings.length, 1);
  assert.equal(check.feasibleCount, 1);
});

test("checkSemesterScheduleFeasibility produces no false alarms in pure degree planning mode", () => {
  const coursesById = new Map<string, Course>();
  coursesById.set("CS101", {
    id: "CS101",
    name: "برمجة 1",
    category: "إجباري",
    credits: 3,
    prerequisites: [],
  });
  coursesById.set("MATH101", {
    id: "MATH101",
    name: "تفاضل 1",
    category: "إجباري",
    credits: 3,
    prerequisites: [],
  });

  const check = checkSemesterScheduleFeasibility(
    ["CS101", "MATH101"],
    coursesById,
  );
  assert.equal(check.hasClash, false);
  assert.equal(check.hasConflict, false);
  assert.equal(check.warnings.length, 0);
  assert.equal(check.conflicts.length, 0);
  assert.equal(check.feasibleCount, 2);
});

test("checkSemesterScheduleFeasibility detects unavoidable time clashes between sections", () => {
  const coursesById = new Map<string, Course>();
  coursesById.set("C1", {
    id: "C1",
    name: "برمجة مرئية",
    category: "إجباري",
    credits: 3,
    prerequisites: [],
    sections: [{ sectionNumber: 1, times: "10:00-11:00", days: "ن ث ر" }],
  });
  coursesById.set("C2", {
    id: "C2",
    name: "تحليل وتصميم نظم",
    category: "إجباري",
    credits: 3,
    prerequisites: [],
    sections: [{ sectionNumber: 1, times: "10:30-11:30", days: "ن ث ر" }],
  });

  const check = checkSemesterScheduleFeasibility(["C1", "C2"], coursesById);
  assert.ok(check.hasClash);
  assert.ok(check.hasConflict);
  assert.equal(check.conflicts.length, 1);
});
