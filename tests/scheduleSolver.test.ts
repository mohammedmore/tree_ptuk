import assert from "node:assert/strict";
import { test } from "node:test";
import {
  KNOWN_DAYS,
  normalizeDayKey,
  dayKeyToName,
  hasConflict,
  isOnlineComponent,
  generateAllSchedules,
  solveSchedule,
  getStats,
  getBlockStats,
  explainScheduleConflicts,
  calculateScheduleQuality,
  isTbaSection,
  selectDiverseSchedules,
} from "../src/services/scheduleSolver";
import type {
  CatalogCourse,
  CatalogSection,
  SolverCourse,
} from "../src/services/scheduleSolver";

test("normalizeDayKey standardizes single-char, short-code, and full Arabic day strings", () => {
  // Saturday
  assert.equal(normalizeDayKey("السبت"), "سب");
  assert.equal(normalizeDayKey("سبت"), "سب");
  assert.equal(normalizeDayKey("سب"), "سب");
  assert.equal(normalizeDayKey("س"), "سب");
  assert.equal(normalizeDayKey("Saturday"), "سب");
  assert.equal(normalizeDayKey("sat"), "سب");

  // Sunday
  assert.equal(normalizeDayKey("الأحد"), "أح");
  assert.equal(normalizeDayKey("الاحد"), "أح");
  assert.equal(normalizeDayKey("أحد"), "أح");
  assert.equal(normalizeDayKey("احد"), "أح");
  assert.equal(normalizeDayKey("أح"), "أح");
  assert.equal(normalizeDayKey("اح"), "أح");
  assert.equal(normalizeDayKey("ح"), "أح");
  assert.equal(normalizeDayKey("Sunday"), "أح");
  assert.equal(normalizeDayKey("sun"), "أح");

  // Monday
  assert.equal(normalizeDayKey("الاثنين"), "اث");
  assert.equal(normalizeDayKey("الإثنين"), "اث");
  assert.equal(normalizeDayKey("اثنين"), "اث");
  assert.equal(normalizeDayKey("اث"), "اث");
  assert.equal(normalizeDayKey("ن"), "اث");
  assert.equal(normalizeDayKey("Monday"), "اث");
  assert.equal(normalizeDayKey("mon"), "اث");

  // Tuesday
  assert.equal(normalizeDayKey("الثلاثاء"), "ثلا");
  assert.equal(normalizeDayKey("ثلاثاء"), "ثلا");
  assert.equal(normalizeDayKey("ثلا"), "ثلا");
  assert.equal(normalizeDayKey("ثل"), "ثلا");
  assert.equal(normalizeDayKey("ث"), "ثلا");
  assert.equal(normalizeDayKey("Tuesday"), "ثلا");
  assert.equal(normalizeDayKey("tue"), "ثلا");

  // Wednesday
  assert.equal(normalizeDayKey("الأربعاء"), "ار");
  assert.equal(normalizeDayKey("الاربعاء"), "ار");
  assert.equal(normalizeDayKey("أربعاء"), "ار");
  assert.equal(normalizeDayKey("اربعاء"), "ار");
  assert.equal(normalizeDayKey("ار"), "ار");
  assert.equal(normalizeDayKey("ارب"), "ار");
  assert.equal(normalizeDayKey("ر"), "ار");
  assert.equal(normalizeDayKey("Wednesday"), "ار");
  assert.equal(normalizeDayKey("wed"), "ار");

  // Thursday
  assert.equal(normalizeDayKey("الخميس"), "خمـ");
  assert.equal(normalizeDayKey("خميس"), "خمـ");
  assert.equal(normalizeDayKey("خمـ"), "خمـ");
  assert.equal(normalizeDayKey("خم"), "خمـ");
  assert.equal(normalizeDayKey("خ"), "خمـ");
  assert.equal(normalizeDayKey("Thursday"), "خمـ");
  assert.equal(normalizeDayKey("thu"), "خمـ");

  // Friday
  assert.equal(normalizeDayKey("الجمعة"), "جم");
  assert.equal(normalizeDayKey("جمعة"), "جم");
  assert.equal(normalizeDayKey("جم"), "جم");
  assert.equal(normalizeDayKey("ج"), "جم");

  // Rejects invalid values
  assert.equal(normalizeDayKey(""), null);
  assert.equal(normalizeDayKey(null), null);
  assert.equal(normalizeDayKey(undefined), null);
  assert.equal(normalizeDayKey("unknown_day"), null);
});

test("dayKeyToName maps canonical day keys back to full Arabic names", () => {
  assert.equal(dayKeyToName("سب"), "السبت");
  assert.equal(dayKeyToName("أح"), "الأحد");
  assert.equal(dayKeyToName("اث"), "الاثنين");
  assert.equal(dayKeyToName("ثلا"), "الثلاثاء");
  assert.equal(dayKeyToName("ار"), "الأربعاء");
  assert.equal(dayKeyToName("خمـ"), "الخميس");
  assert.equal(dayKeyToName("جم"), "الجمعة");
  // Also resolves when input is an alias
  assert.equal(dayKeyToName("ح"), "الأحد");
  assert.equal(dayKeyToName("الاحد"), "الأحد");
});

test("hasConflict detects time overlaps across different day string representations", () => {
  const assignedSection: CatalogSection = {
    sec: "1",
    blocks: [
      {
        days: ["الأحد", "الثلاثاء"], // Full names
        start: 8,
        end: 9.5,
      },
    ],
  };

  const conflictingCandidate: CatalogSection = {
    sec: "2",
    blocks: [
      {
        days: ["أح"], // Short code for Sunday
        start: 9,
        end: 10,
      },
    ],
  };

  const nonConflictingCandidate: CatalogSection = {
    sec: "3",
    blocks: [
      {
        days: ["ح"], // Single char for Sunday
        start: 9.5,
        end: 11, // Back-to-back: starts exactly when previous ends
      },
    ],
  };

  const differentDayCandidate: CatalogSection = {
    sec: "4",
    blocks: [
      {
        days: ["الاثنين"],
        start: 8.5,
        end: 10,
      },
    ],
  };

  const schedule = [{ section: assignedSection }];

  // Conflict: 8:00-9:30 overlaps with 9:00-10:00 on Sunday
  assert.equal(hasConflict(schedule, conflictingCandidate), true);

  // No conflict: back-to-back 9:30 is allowed
  assert.equal(hasConflict(schedule, nonConflictingCandidate), false);

  // No conflict: different day (Monday vs Sun/Tue)
  assert.equal(hasConflict(schedule, differentDayCandidate), false);
});

test("hasConflict detects conflicts with non-contiguous blocks and multi-block sections", () => {
  // Course with lecture and lab on different days
  const multiBlockSection: CatalogSection = {
    sec: "1",
    blocks: [
      { days: ["أح", "ثلا", "خمـ"], start: 8, end: 9 }, // Lecture
      { days: ["اث"], start: 11, end: 13 }, // Lab (Monday 11-13)
    ],
  };

  const schedule = [{ section: multiBlockSection }];

  // Overlaps with the Monday lab only
  const labConflict: CatalogSection = {
    sec: "2",
    blocks: [{ days: ["الاثنين"], start: 12, end: 14 }],
  };
  assert.equal(hasConflict(schedule, labConflict), true);

  // Overlaps with the Thursday lecture only
  const lectureConflict: CatalogSection = {
    sec: "3",
    blocks: [{ days: ["الخميس"], start: 8.5, end: 9.5 }],
  };
  assert.equal(hasConflict(schedule, lectureConflict), true);

  // Non-conflicting section on both lecture and lab days
  const compatible: CatalogSection = {
    sec: "4",
    blocks: [
      { days: ["أح", "ثلا"], start: 9.5, end: 11 },
      { days: ["اث"], start: 8, end: 10 },
    ],
  };
  assert.equal(hasConflict(schedule, compatible), false);
});

test("hasConflict rejects sections with internal self-conflicts between their own blocks", () => {
  const selfConflictingSection: CatalogSection = {
    sec: "1",
    blocks: [
      { days: ["أح"], start: 8, end: 10 },
      { days: ["الأحد"], start: 9, end: 11 }, // Overlaps block 1 on Sunday
    ],
  };

  assert.equal(hasConflict([], selfConflictingSection), true);
});

test("generateAllSchedules generates conflict-free schedules and respects freeDays with Arabic aliases", () => {
  const courseA: CatalogCourse = {
    id: "12140101",
    name: "مقدمة في البرمجة",
    sections: [
      {
        sec: "1",
        blocks: [{ days: ["أح", "ثلا"], start: 8, end: 9.5 }],
      },
      {
        sec: "2",
        blocks: [{ days: ["اث", "ار"], start: 8, end: 9.5 }],
      },
    ],
  };

  const courseB: CatalogCourse = {
    id: "12140102",
    name: "تراكيب البيانات",
    sections: [
      {
        sec: "1",
        blocks: [{ days: ["أح", "ثلا"], start: 9, end: 10.5 }], // Conflicts with Course A Sec 1
      },
      {
        sec: "2",
        blocks: [{ days: ["أح", "ثلا"], start: 11, end: 12.5 }], // Compatible with Course A Sec 1
      },
    ],
  };

  // Without filters:
  // (A1 + B2) -> valid (8-9.5 and 11-12.5)
  // (A2 + B1) -> valid (Mon/Wed vs Sun/Tue)
  // (A2 + B2) -> valid (Mon/Wed vs Sun/Tue)
  // (A1 + B1) -> conflict! (8-9.5 vs 9-10.5 on Sun/Tue)
  const all = generateAllSchedules([courseA, courseB]);
  assert.equal(all.length, 3);

  // Filter with freeDays: student wants Sunday free (using full name "الأحد")
  const freeSunday = generateAllSchedules([courseA, courseB], {
    freeDays: ["الأحد"],
  });
  // Only schedules where neither course meets on Sunday: Course A Sec 2 is Mon/Wed, but Course B has only Sun/Tue sections
  // So no combination can be completely Sunday-free!
  assert.equal(freeSunday.length, 0);

  // Filter with freeDays: student wants Monday free (using short code "اث")
  const freeMonday = generateAllSchedules([courseA, courseB], {
    freeDays: ["اث"],
  });
  // Must avoid Course A Sec 2 (which is Mon/Wed). Course A Sec 1 is Sun/Tue.
  // With A1, only B2 is non-conflicting.
  assert.equal(freeMonday.length, 1);
  assert.equal(freeMonday[0][0].section.sec, "1");
  assert.equal(freeMonday[0][1].section.sec, "2");
});

test("generateAllSchedules applies pinnedSections and excludedSections", () => {
  const courseA: CatalogCourse = {
    id: "101",
    name: "مادة 1",
    sections: [
      { sec: "1", blocks: [{ days: ["أح"], start: 8, end: 9 }] },
      { sec: "2", blocks: [{ days: ["اث"], start: 8, end: 9 }] },
    ],
  };

  const courseB: CatalogCourse = {
    id: "102",
    name: "مادة 2",
    sections: [
      { sec: "1", blocks: [{ days: ["أح"], start: 10, end: 11 }] },
      { sec: "2", blocks: [{ days: ["اث"], start: 10, end: 11 }] },
    ],
  };

  // Pin section 2 for course 101
  const pinned = generateAllSchedules([courseA, courseB], {
    pinnedSections: { "101": "2" },
  });
  assert.equal(pinned.length, 2);
  assert.ok(
    pinned.every((sch) =>
      sch.some((c) => c.courseCode === "101" && c.section.sec === "2"),
    ),
  );

  // Exclude section 2 for course 102
  const excluded = generateAllSchedules([courseA, courseB], {
    pinnedSections: { "101": "2" },
    excludedSections: { "102": ["2"] },
  });
  assert.equal(excluded.length, 1);
  assert.equal(excluded[0][1].section.sec, "1");
});

test("getBlockStats calculates maxGap, totalGap, and earliest/latest accurately for non-contiguous blocks", () => {
  const schedule = [
    {
      courseCode: "101",
      courseName: "Math",
      courseType: "req",
      color: "blue",
      section: {
        sec: "1",
        blocks: [
          { days: ["أح"], start: 8, end: 9.5 }, // 8:00 - 9:30
          { days: ["الأحد"], start: 11, end: 12.5 }, // 11:00 - 12:30 (normalized to Sunday)
          { days: ["ح"], start: 14, end: 15 }, // 14:00 - 15:00 (normalized to Sunday)
        ],
      },
    },
  ];

  const stats = getStats(schedule);
  assert.equal(stats.earliestStart, 8);
  assert.equal(stats.latestEnd, 15);
  // Gaps on Sunday:
  // Between block 1 (end 9.5) and block 2 (start 11): 1.5 hours
  // Between block 2 (end 12.5) and block 3 (start 14): 1.5 hours
  // Max gap = 1.5
  assert.equal("maxGap" in stats ? stats.maxGap : -1, 1.5);
});

test("solveSchedule handles legacy meeting options with day normalization and time limits", () => {
  const courses: SolverCourse[] = [
    {
      id: "C1",
      options: [
        { startTime: "08:00", endTime: "09:00", day: "الأحد", section: "1" },
        { startTime: "09:00", endTime: "10:00", day: "الاثنين", section: "2" },
      ],
    },
    {
      id: "C2",
      options: [
        { startTime: "8:30", endTime: "9:30", day: "أح", section: "1" }, // Conflicts with C1 Sec 1 on Sunday
        { startTime: "10:00", endTime: "11:00", day: "ح", section: "2" }, // Compatible
      ],
    },
  ];

  const result = solveSchedule(courses, { maxResults: 10 });
  assert.ok(result.schedules.length > 0);

  // Verify no schedule pairs C1 Sec 1 with C2 Sec 1
  for (const sol of result.schedules) {
    const c1Sec = sol.entries.find((e) => e.courseId === "C1")?.section;
    const c2Sec = sol.entries.find((e) => e.courseId === "C2")?.section;
    assert.ok(
      !(c1Sec === "1" && c2Sec === "1"),
      "Conflicting sections must not be paired together",
    );
  }
});

test("explainScheduleConflicts detects pairwise conflicts, empty sections, and freeDay clashes", () => {
  const c1: CatalogCourse = {
    id: "CS101",
    name: "برمجة 1",
    sections: [
      {
        sec: "1",
        blocks: [{ days: ["أح"], start: 9, end: 10 }],
      },
    ],
  };

  const c2: CatalogCourse = {
    id: "CS102",
    name: "قواعد بيانات",
    sections: [
      {
        sec: "1",
        blocks: [{ days: ["أح"], start: 9.5, end: 11 }], // Overlaps with CS101 Sec 1
      },
    ],
  };

  const explanation = explainScheduleConflicts([c1, c2], {});
  assert.equal(explanation.hasConflict, true);
  assert.ok(explanation.details.some((d: string) => d.includes("تعارض كامل")));
  assert.ok(
    explanation.autoFixes.some(
      (f: any) => f.type === "remove_course" && f.courseCode === "CS102",
    ),
  );

  // Test freeDays clash
  const explanationFreeDay = explainScheduleConflicts([c1], {
    freeDays: ["أح"],
  });
  assert.equal(explanationFreeDay.hasConflict, true);
  assert.ok(
    explanationFreeDay.autoFixes.some((f: any) => f.type === "clear_free_days"),
  );
});

test("isOnlineComponent correctly identifies PTUK online rooms, evening lectures, and Saturday/Thursday recordings", () => {
  // Pure numeric room without building code (e.g. 1000)
  assert.equal(isOnlineComponent({ room: "1000" }), true);
  assert.equal(isOnlineComponent({ room: "2050" }), true);
  assert.equal(isOnlineComponent({ room: "B301" }), false);

  // Class at or after 16:00 (evening e-learning) in hours or minutes
  assert.equal(isOnlineComponent({ start: 16 }), true);
  assert.equal(isOnlineComponent({ start: 17 }), true);
  assert.equal(isOnlineComponent({ start: 16 * 60 }), true);
  assert.equal(isOnlineComponent({ start: 17 * 60 }), true);
  assert.equal(isOnlineComponent({ start: 10 }), false);

  // E-learning text tags
  assert.equal(isOnlineComponent({ rawTime: "محاضرة الكتروني مسجلة" }), true);
  assert.equal(isOnlineComponent({ instructor: "عن بعد" }), true);

  const numericRoomCandidate: CatalogSection = {
    sec: "1",
    room: "1000",
    blocks: [{ days: ["أح"], start: 9, end: 10 }],
  };
  const regularAssigned: CatalogSection = {
    sec: "2",
    room: "B201",
    blocks: [{ days: ["أح"], start: 9, end: 10 }],
  };

  // Online section does not conflict with regular in-person section at the same time
  assert.equal(
    hasConflict([{ section: regularAssigned }], numericRoomCandidate),
    false,
  );
});

test("generateAllSchedules sorts by min_days and compact timePreferences", () => {
  const courseA: CatalogCourse = {
    id: "101",
    name: "مادة 1",
    sections: [
      { sec: "1", blocks: [{ days: ["أح"], start: 8, end: 9 }] },
      { sec: "2", blocks: [{ days: ["اث"], start: 8, end: 9 }] },
    ],
  };

  const courseB: CatalogCourse = {
    id: "102",
    name: "مادة 2",
    sections: [
      { sec: "1", blocks: [{ days: ["أح"], start: 9, end: 10 }] },
      { sec: "2", blocks: [{ days: ["اث"], start: 14, end: 15 }] },
    ],
  };

  // Test min_days: 1-day schedule (Sun only: A sec 1 + B sec 1) must rank before 2-day schedules
  const minDaysResults = generateAllSchedules([courseA, courseB], {
    timePreference: "min_days",
  });
  assert.equal(minDaysResults.length, 4);
  const firstSchedule = minDaysResults[0];
  const firstDays = new Set(
    firstSchedule.flatMap((c) => c.section.blocks[0].days),
  );
  assert.equal(firstDays.size, 1);
  assert.ok(firstDays.has("أح"));

  // Test compact: 0 total gap ranks before schedules with 5-hour gap
  const compactResults = generateAllSchedules([courseA, courseB], {
    timePreference: "compact",
  });
  assert.equal(compactResults.length, 4);
  const statsFirst = getBlockStats(compactResults[0]);
  assert.equal(statsFirst.totalGap, 0);
});

test("calculateScheduleQuality accurately scores compact schedules higher than gapped schedules", () => {
  // Compact 3-day schedule with 0 gaps
  const compactSchedule = [
    {
      courseCode: "101",
      section: {
        sec: "1",
        blocks: [{ days: ["أح", "ثلا", "خمـ"], start: 9, end: 10 }],
      },
    },
    {
      courseCode: "102",
      section: {
        sec: "1",
        blocks: [{ days: ["أح", "ثلا", "خمـ"], start: 10, end: 11 }],
      },
    },
  ];

  const compactQuality = calculateScheduleQuality(compactSchedule as any);
  assert.ok(
    compactQuality.score >= 85,
    `Expected score >= 85, got ${compactQuality.score}`,
  );
  assert.equal(compactQuality.tier, "excellent");
  assert.equal(compactQuality.breakdown.daysScore, 40);
  assert.equal(compactQuality.breakdown.gapsScore, 40);

  // Demanding 5-day schedule with wide 4-hour gap every day
  const demandingSchedule = [
    {
      courseCode: "201",
      section: {
        sec: "1",
        blocks: [{ days: ["أح", "اث", "ثلا", "ار", "خمـ"], start: 8, end: 9 }],
      },
    },
    {
      courseCode: "202",
      section: {
        sec: "1",
        blocks: [
          { days: ["أح", "اث", "ثلا", "ار", "خمـ"], start: 13, end: 14 },
        ],
      },
    },
  ];

  const demandingQuality = calculateScheduleQuality(demandingSchedule as any);
  assert.ok(
    demandingQuality.score < 60,
    `Expected score < 60, got ${demandingQuality.score}`,
  );
  assert.equal(demandingQuality.tier, "demanding");
  assert.ok(demandingQuality.badge.includes("مجهد"));
});

test("isTbaSection correctly detects unannounced or TBA sections", () => {
  assert.equal(isTbaSection({ sec: "1", blocks: [], rawTime: "TBA" }), true);
  assert.equal(
    isTbaSection({ sec: "1", blocks: [], rawTime: "لم يحدد بعد" }),
    true,
  );
  assert.equal(isTbaSection({ sec: "1", blocks: [] }), true);

  const normalSection: CatalogSection = {
    sec: "1",
    blocks: [{ days: ["أح"], start: 9, end: 10 }],
    room: "C201",
  };
  assert.equal(isTbaSection(normalSection), false);
});

test("generateAllSchedules applies genderPreference filter correctly", () => {
  const courseWithGenders: CatalogCourse = {
    id: "301",
    name: "مادة تخصص",
    sections: [
      {
        sec: "1",
        gender: "طلاب",
        blocks: [{ days: ["أح"], start: 8, end: 9 }],
      },
      {
        sec: "2",
        gender: "طالبات",
        blocks: [{ days: ["أح"], start: 8, end: 9 }],
      },
      {
        sec: "3",
        gender: "مختلط",
        blocks: [{ days: ["أح"], start: 8, end: 9 }],
      },
    ],
  };

  // Male filter should include sec 1 (طلاب) and sec 3 (مختلط), excluding sec 2 (طالبات)
  const maleSchedules = generateAllSchedules([courseWithGenders], {
    genderPreference: "male",
  });
  assert.equal(maleSchedules.length, 2);
  const maleSecs = maleSchedules.map((s) => s[0].section.sec);
  assert.ok(maleSecs.includes("1"));
  assert.ok(maleSecs.includes("3"));
  assert.ok(!maleSecs.includes("2"));

  // Female filter should include sec 2 (طالبات) and sec 3 (مختلط), excluding sec 1 (طلاب)
  const femaleSchedules = generateAllSchedules([courseWithGenders], {
    genderPreference: "female",
  });
  assert.equal(femaleSchedules.length, 2);
  const femaleSecs = femaleSchedules.map((s) => s[0].section.sec);
  assert.ok(femaleSecs.includes("2"));
  assert.ok(femaleSecs.includes("3"));
  assert.ok(!femaleSecs.includes("1"));
});

test("Item 50: selectDiverseSchedules diversifies section selection across top results", () => {
  const courseA: CatalogCourse = {
    id: "15010101",
    name: "تفاضل 1",
    sections: [
      { sec: "1", blocks: [{ days: ["أح", "ثلا", "خمـ"], start: 8, end: 9 }] },
      { sec: "2", blocks: [{ days: ["أح", "ثلا", "خمـ"], start: 9, end: 10 }] },
      { sec: "3", blocks: [{ days: ["اث", "ار"], start: 8, end: 9.5 }] },
    ],
  };

  const courseB: CatalogCourse = {
    id: "15020101",
    name: "فيزياء 1",
    sections: [
      {
        sec: "1",
        blocks: [{ days: ["أح", "ثلا", "خمـ"], start: 10, end: 11 }],
      },
      {
        sec: "2",
        blocks: [{ days: ["أح", "ثلا", "خمـ"], start: 11, end: 12 }],
      },
      { sec: "3", blocks: [{ days: ["اث", "ار"], start: 10, end: 11.5 }] },
    ],
  };

  const normalSchedules = generateAllSchedules([courseA, courseB]);
  assert.ok(normalSchedules.length >= 6);

  // Diverse solutions request
  const diverseSchedules = generateAllSchedules([courseA, courseB], {
    diverseSolutions: true,
    maxResults: 4,
  });

  assert.ok(diverseSchedules.length >= 3);
  // Verify that the first schedule and subsequent schedules differ significantly in sections
  const firstSecA = diverseSchedules[0][0].section.sec;
  const secondSecA = diverseSchedules[1][0].section.sec;
  // High diversity should ensure distinct section picks in the top 2
  assert.notEqual(
    `${diverseSchedules[0][0].section.sec}-${diverseSchedules[0][1].section.sec}`,
    `${diverseSchedules[1][0].section.sec}-${diverseSchedules[1][1].section.sec}`,
  );
});

test("Item 146: hasConflict handles fractional time blocks and mid-day overlaps accurately", () => {
  // Course 1: 11:30 - 13:00 (11.5 to 13.0)
  const sec1130to1300: CatalogSection = {
    sec: "1",
    blocks: [{ days: ["اث", "ار"], start: 11.5, end: 13.0 }],
  };

  // Course 2: 12:00 - 13:30 (12.0 to 13.5) -> Overlaps with 11:30 - 13:00
  const sec1200to1330: CatalogSection = {
    sec: "2",
    blocks: [{ days: ["اث"], start: 12.0, end: 13.5 }],
  };

  // Course 3: 13:00 - 14:30 (13.0 to 14.5) -> Consecutive / Back-to-back with 11:30 - 13:00 (NO overlap)
  const sec1300to1430: CatalogSection = {
    sec: "3",
    blocks: [{ days: ["اث"], start: 13.0, end: 14.5 }],
  };

  // Course 4: 11:00 - 11:30 (11.0 to 11.5) -> Immediately preceding 11:30 - 13:00 (NO overlap)
  const sec1100to1130: CatalogSection = {
    sec: "4",
    blocks: [{ days: ["ار"], start: 11.0, end: 11.5 }],
  };

  // Overlap check
  assert.equal(hasConflict([{ section: sec1130to1300 }], sec1200to1330), true);

  // Consecutive checks (no conflict)
  assert.equal(hasConflict([{ section: sec1130to1300 }], sec1300to1430), false);
  assert.equal(hasConflict([{ section: sec1130to1300 }], sec1100to1130), false);
});
