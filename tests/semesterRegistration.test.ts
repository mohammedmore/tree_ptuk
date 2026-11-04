import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import {
  createDefaultRegistrationPlans,
  loadRegistrationPlans,
  saveRegistrationPlans,
  validatePlanCollisions,
  checkPlanPrerequisites,
  checkPlanFinancialBalance,
  checkPlanCreditLimits,
  resolveCascadingFallback,
  sortRegistrationItemsByPriority,
  RegistrationSectionItem,
  RegistrationPlan,
} from "../src/core/semesterRegistration";
import type { Course } from "../src/data";

// Mock localStorage for test environment
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

(global as any).window = { localStorage: mockStorage };

beforeEach(() => {
  mockStorage.clear();
});

test("createDefaultRegistrationPlans creates valid 3-plan structure with correct metadata", () => {
  const plans = createDefaultRegistrationPlans();
  assert.ok(plans.A);
  assert.ok(plans.B);
  assert.ok(plans.C);
  assert.equal(plans.A.id, "A");
  assert.equal(plans.B.id, "B");
  assert.equal(plans.C.id, "C");
  assert.ok(plans.A.title.includes("الأساسية"));
  assert.ok(plans.B.title.includes("البديل الأول"));
  assert.ok(plans.C.title.includes("الطوارئ"));
});

test("validatePlanCollisions accurately detects overlapping sections on same days", () => {
  const items: RegistrationSectionItem[] = [
    {
      courseId: "12140101",
      courseName: "برمجة 1",
      section: "1",
      credits: 4,
      priority: 2,
      blocks: [
        {
          days: ["الأحد", "الثلاثاء", "الخميس"],
          start: 8.5,
          end: 9.5,
          rawTime: "08:30-09:30 أح ثلا خمـ",
        },
      ],
    },
    {
      courseId: "11100101",
      courseName: "تفاضل وتكامل 1",
      section: "2",
      credits: 3,
      priority: 2,
      blocks: [
        {
          days: ["الأحد", "الثلاثاء", "الخميس"],
          start: 9.0, // Overlaps with 8.5-9.5!
          end: 10.0,
          rawTime: "09:00-10:00 أح ثلا خمـ",
        },
      ],
    },
    {
      courseId: "15200101",
      courseName: "اللغة العربية",
      section: "1",
      credits: 3,
      priority: 3,
      blocks: [
        {
          days: ["الاثنين", "الأربعاء"], // Different days!
          start: 8.5,
          end: 10.0,
          rawTime: "08:30-10:00 اث ار",
        },
      ],
    },
  ];

  const diags = validatePlanCollisions(items);
  assert.equal(diags.length, 1);
  assert.equal(diags[0].code, "TIME_CONFLICT");
  assert.ok(diags[0].detail.includes("برمجة 1"));
  assert.ok(diags[0].detail.includes("تفاضل وتكامل 1"));
});

test("checkPlanPrerequisites catches unfulfilled prerequisites with course names", () => {
  const catalog: Course[] = [
    {
      id: "12140101",
      name: "برمجة 1",
      credits: 4,
      category: "متطلب تخصص إجباري",
      prerequisites: [],
    },
    {
      id: "12140201",
      name: "برمجة 2",
      credits: 4,
      category: "متطلب تخصص إجباري",
      prerequisites: ["12140101"],
    },
    {
      id: "12140301",
      name: "هياكل بيانات",
      credits: 4,
      category: "متطلب تخصص إجباري",
      prerequisites: ["12140201"],
    },
  ];

  const items: RegistrationSectionItem[] = [
    {
      courseId: "12140301",
      courseName: "هياكل بيانات",
      section: "1",
      credits: 4,
      priority: 1,
    },
  ];

  // Student has only passed 12140101, but NOT 12140201 (prerequisite for Data Structures)
  const passed = new Set(["12140101"]);
  const diags = checkPlanPrerequisites(items, passed, catalog);

  assert.equal(diags.length, 1);
  assert.equal(diags[0].code, "PREREQ_MISSING");
  assert.ok(diags[0].detail.includes("برمجة 2"));
});

test("checkPlanFinancialBalance calculates balance and warns on deficit", () => {
  // Plan with 15 credits: 15 * 25 JOD = 375 JOD
  // Student balance is 200 JOD -> Deficit 175 JOD
  const result = checkPlanFinancialBalance(15, "200 دائن", 25);
  assert.equal(result.isSufficient, false);
  assert.equal(result.requiredCost, 375);
  assert.equal(result.balanceNum, 200);
  assert.equal(result.deficit, 175);
  assert.ok(result.diagnostic);
  assert.equal(result.diagnostic?.code, "INSUFFICIENT_FUNDS");

  // Sufficient balance test: 12 credits (300 JOD) vs 450 JOD
  const sufficient = checkPlanFinancialBalance(12, "450 دائن", 25);
  assert.equal(sufficient.isSufficient, true);
  assert.equal(sufficient.deficit, 0);
  assert.equal(sufficient.diagnostic, undefined);
});

test("resolveCascadingFallback steps seamlessly from Plan A to Plan B to Plan C", () => {
  const plans: Record<"A" | "B" | "C", RegistrationPlan> = {
    A: {
      id: "A",
      title: "Plan A",
      description: "",
      totalCredits: 3,
      estimatedTuition: 75,
      items: [
        {
          courseId: "12140101",
          courseName: "برمجة 1",
          section: "1",
          credits: 3,
          priority: 1,
        },
      ],
    },
    B: {
      id: "B",
      title: "Plan B",
      description: "",
      totalCredits: 3,
      estimatedTuition: 75,
      items: [
        {
          courseId: "12140101",
          courseName: "برمجة 1",
          section: "3", // Alternative section in Plan B
          credits: 3,
          priority: 1,
        },
      ],
    },
    C: {
      id: "C",
      title: "Plan C",
      description: "",
      totalCredits: 3,
      estimatedTuition: 75,
      items: [
        {
          courseId: "12140101",
          courseName: "برمجة 1",
          section: "5", // Emergency section in Plan C
          credits: 3,
          priority: 1,
        },
      ],
    },
  };

  // Fallback from A -> should give Plan B section 3
  const fallbackFromA = resolveCascadingFallback("12140101", "A", plans);
  assert.ok(fallbackFromA);
  assert.equal(fallbackFromA?.fallbackPlan, "B");
  assert.equal(fallbackFromA?.item.section, "3");

  // Fallback from B -> should give Plan C section 5
  const fallbackFromB = resolveCascadingFallback("12140101", "B", plans);
  assert.ok(fallbackFromB);
  assert.equal(fallbackFromB?.fallbackPlan, "C");
  assert.equal(fallbackFromB?.item.section, "5");

  // Course not in B or C -> should return null
  const fallbackMissing = resolveCascadingFallback("99999999", "A", plans);
  assert.equal(fallbackMissing, null);
});

test("sortRegistrationItemsByPriority orders sensitive bottleneck sections first", () => {
  const items: RegistrationSectionItem[] = [
    {
      courseId: "13020001",
      courseName: "لغة عبرية",
      section: "1",
      credits: 2,
      category: "متطلب جامعة اختياري",
      priority: 3,
    },
    {
      courseId: "12140102",
      courseName: "مختبر برمجة 1",
      section: "1",
      credits: 1, // Lab!
      category: "متطلب تخصص إجباري",
      priority: 1,
    },
    {
      courseId: "12140101",
      courseName: "برمجة 1",
      section: "2",
      credits: 3,
      category: "متطلب تخصص إجباري",
      priority: 2,
    },
  ];

  const sorted = sortRegistrationItemsByPriority(items);
  // High priority lab should be 1st
  assert.equal(sorted[0].courseId, "12140102");
  // Major course 2nd
  assert.equal(sorted[1].courseId, "12140101");
  // Elective last
  assert.equal(sorted[2].courseId, "13020001");
});

test("saveRegistrationPlans and loadRegistrationPlans roundtrip accurately", () => {
  const sem = "فصل أول 2026/2027";
  const plans = createDefaultRegistrationPlans();
  plans.A.items.push({
    courseId: "12140101",
    courseName: "برمجة 1",
    section: "1",
    credits: 3,
    priority: 1,
  });

  saveRegistrationPlans(sem, plans);
  const loaded = loadRegistrationPlans(sem);

  assert.equal(loaded.A.items.length, 1);
  assert.equal(loaded.A.items[0].courseId, "12140101");
  assert.equal(loaded.A.totalCredits, 3);
  assert.equal(loaded.A.estimatedTuition, 75);
});

test("calculatePlanGaps accurately computes free waiting hours between lectures", async () => {
  const { calculatePlanGaps } =
    await import("../src/core/semesterRegistration");
  const items: RegistrationSectionItem[] = [
    {
      courseId: "1",
      courseName: "مادة 1",
      section: "1",
      credits: 3,
      priority: 2,
      blocks: [{ days: ["الأحد"], start: 8.5, end: 9.5 }],
    },
    {
      courseId: "2",
      courseName: "مادة 2",
      section: "1",
      credits: 3,
      priority: 2,
      blocks: [{ days: ["الأحد"], start: 11.5, end: 12.5 }], // 2 hours gap!
    },
  ];

  const gaps = calculatePlanGaps(items);
  assert.equal(gaps.totalGapHours, 2);
  assert.equal(gaps.dayGaps["الأحد"], 2);
  assert.equal(gaps.dayGaps["الاثنين"], 0);
});

test("autoDetermineItemPriority assigns priority 1 for labs and 3 for electives", async () => {
  const { autoDetermineItemPriority } =
    await import("../src/core/semesterRegistration");
  assert.equal(autoDetermineItemPriority({ credits: 1 }), 1);
  assert.equal(
    autoDetermineItemPriority({ credits: 3, category: "متطلب تخصص إجباري" }),
    1,
  );
  assert.equal(
    autoDetermineItemPriority({ credits: 3, category: "متطلب جامعة اختياري" }),
    3,
  );
});

test("exportPlansToShareCode and importPlansFromShareCode roundtrip accurately", async () => {
  const {
    createDefaultRegistrationPlans,
    exportPlansToShareCode,
    importPlansFromShareCode,
  } = await import("../src/core/semesterRegistration");

  const plans = createDefaultRegistrationPlans();
  plans.A.items.push({
    courseId: "12140101",
    courseName: "برمجة 1",
    section: "1",
    credits: 3,
    priority: 1,
  });

  const code = exportPlansToShareCode(plans);
  assert.ok(code.length > 0);
  const imported = importPlansFromShareCode(code);
  assert.ok(imported);
  assert.equal(imported.A.items.length, 1);
  assert.equal(imported.A.items[0].courseId, "12140101");
});

test("movePlanItemPriority swaps item order and sequentially updates priorities", async () => {
  const { movePlanItemPriority } =
    await import("../src/core/semesterRegistration");

  const items: RegistrationSectionItem[] = [
    {
      courseId: "101",
      courseName: "Course 1",
      section: "1",
      credits: 3,
      priority: 1,
    },
    {
      courseId: "102",
      courseName: "Course 2",
      section: "2",
      credits: 3,
      priority: 2,
    },
    {
      courseId: "103",
      courseName: "Course 3",
      section: "1",
      credits: 3,
      priority: 3,
    },
  ];

  // Move 102 up
  const movedUp = movePlanItemPriority(items, "102", "up");
  assert.equal(movedUp[0].courseId, "102");
  assert.equal(movedUp[0].priority, 1);
  assert.equal(movedUp[1].courseId, "101");
  assert.equal(movedUp[1].priority, 2);

  // Move 102 down
  const movedDown = movePlanItemPriority(movedUp, "102", "down");
  assert.equal(movedDown[0].courseId, "101");
  assert.equal(movedDown[1].courseId, "102");
});

test("calculateDetailedTuition accurately computes JOD and ILS totals", async () => {
  const { calculateDetailedTuition } =
    await import("../src/core/semesterRegistration");

  // 15 credits, rate 25 JOD, fixed 50 JOD, exchange 5.2
  const tuition = calculateDetailedTuition(15, {
    hourlyRate: 25,
    fixedFees: 50,
    exchangeRate: 5.2,
  });
  assert.equal(tuition.creditsCostJOD, 375);
  assert.equal(tuition.totalJOD, 425);
  assert.equal(tuition.totalILS, Math.round(425 * 5.2));

  // With lab insurance
  const tuitionWithLab = calculateDetailedTuition(15, {
    hourlyRate: 25,
    fixedFees: 50,
    labInsurance: 20,
    exchangeRate: 5.2,
  });
  assert.equal(tuitionWithLab.totalJOD, 445);
  assert.equal(tuitionWithLab.labInsurance, 20);
});

test("calculateSectionSaturation classifies open, critical, and full states", async () => {
  const { calculateSectionSaturation } =
    await import("../src/core/semesterRegistration");

  const openSat = calculateSectionSaturation(20, 40);
  assert.equal(openSat.status, "open");
  assert.equal(openSat.available, 20);

  const critSat = calculateSectionSaturation(38, 40);
  assert.equal(critSat.status, "critical");
  assert.equal(critSat.available, 2);
  assert.ok(critSat.badgeText.includes("مهددة"));

  const fullSat = calculateSectionSaturation(40, 40);
  assert.equal(fullSat.status, "full");
  assert.equal(fullSat.available, 0);
  assert.ok(fullSat.badgeText.includes("ممتلئة"));
});

test("isSectionClosed correctly identifies full sections", async () => {
  const { isSectionClosed } = await import("../src/core/semesterRegistration");

  assert.equal(isSectionClosed(40, 40), true);
  assert.equal(isSectionClosed(42, 40), true);
  assert.equal(isSectionClosed(39, 40), false);
  assert.equal(isSectionClosed(undefined, 40), false);
});

test("filterSectionsByMeetingPattern filters 2-day and 3-day schedules accurately", async () => {
  const { filterSectionsByMeetingPattern } =
    await import("../src/core/semesterRegistration");

  const sections = [
    {
      sec: 1,
      blocks: [{ days: ["الاثنين", "الأربعاء"], start: 8.5, end: 10 }],
    },
    {
      sec: 2,
      blocks: [{ days: ["الأحد", "الثلاثاء", "الخميس"], start: 8.5, end: 9.5 }],
    },
    { sec: 3, blocks: [{ days: ["السبت"], start: 9, end: 12 }] },
  ];

  const allFiltered = filterSectionsByMeetingPattern(sections, "all");
  assert.equal(allFiltered.length, 3);

  const twoDays = filterSectionsByMeetingPattern(sections, "2days");
  assert.equal(twoDays.length, 1);
  assert.equal(twoDays[0].sec, 1);

  const threeDays = filterSectionsByMeetingPattern(sections, "3days");
  assert.equal(threeDays.length, 1);
  assert.equal(threeDays[0].sec, 2);
});

test("generateRegistrationCalendarICS generates valid RFC 5545 iCalendar data with 15-minute alarms", async () => {
  const { generateRegistrationCalendarICS } =
    await import("../src/core/semesterRegistration");

  const items: RegistrationSectionItem[] = [
    {
      courseId: "12140101",
      courseName: "برمجة 1",
      section: "1",
      credits: 4,
      priority: 1,
      instructor: "د. سامر",
      room: "B204",
      blocks: [
        {
          days: ["الأحد", "الثلاثاء"],
          start: 8.5,
          end: 10,
          rawTime: "08:30-10:00",
        },
      ],
    },
  ];

  const ics = generateRegistrationCalendarICS(items, "الفصل الأول");
  assert.ok(ics.includes("BEGIN:VCALENDAR"));
  assert.ok(ics.includes("VERSION:2.0"));
  assert.ok(ics.includes("SUMMARY:برمجة 1 (شعبة 1)"));
  assert.ok(ics.includes("LOCATION:B204"));
  assert.ok(ics.includes("RRULE:FREQ=WEEKLY;BYDAY=SU,TU"));
  assert.ok(ics.includes("TRIGGER:-PT15M"));
  assert.ok(ics.includes("END:VCALENDAR"));
});

test("generateShareablePlanUrl generates a valid hash URL containing shareCode", async () => {
  const { generateShareablePlanUrl, createDefaultRegistrationPlans } =
    await import("../src/core/semesterRegistration");

  const plans = createDefaultRegistrationPlans();
  const url = generateShareablePlanUrl(plans, "http://localhost:5173");
  assert.ok(url.startsWith("http://localhost:5173/#/registration?shareCode="));
  assert.ok(url.length > 50);
});

test("checkSectionTimeConflict detects overlapping time ranges on common days", async () => {
  const { checkSectionTimeConflict } =
    await import("../src/core/semesterRegistration");

  const existing: RegistrationSectionItem[] = [
    {
      courseId: "101",
      courseName: "رياضيات",
      section: "1",
      credits: 3,
      priority: 1,
      blocks: [{ days: ["الأحد", "الثلاثاء"], start: 8.5, end: 10 }],
    },
  ];

  // Overlapping
  const conflictRes = checkSectionTimeConflict(
    [{ days: ["الأحد"], start: 9, end: 11 }],
    existing,
  );
  assert.equal(conflictRes.hasConflict, true);
  assert.equal(conflictRes.conflictingCourseName, "رياضيات");

  // Non-overlapping time
  const noConflictRes = checkSectionTimeConflict(
    [{ days: ["الأحد"], start: 10, end: 11.5 }],
    existing,
  );
  assert.equal(noConflictRes.hasConflict, false);

  // Different days
  const diffDayRes = checkSectionTimeConflict(
    [{ days: ["الاثنين"], start: 8.5, end: 10 }],
    existing,
  );
  assert.equal(diffDayRes.hasConflict, false);
});

test("resolveCascadingFallback prioritizes reserveSection within the same plan", () => {
  const plans = createDefaultRegistrationPlans();
  plans.A.items = [
    {
      courseId: "12140101",
      courseName: "برمجة 1",
      section: "1",
      reserveSection: "3", // In-plan reserve section!
      credits: 4,
      priority: 1,
    },
  ];

  const fallback = resolveCascadingFallback("12140101", "A", plans);
  assert.ok(fallback);
  assert.equal(fallback.fallbackPlan, "A");
  assert.equal(fallback.item.section, "3");
  assert.equal(fallback.isReserveSection, true);
});

test("checkPlanCreditLimits enforces PTUK semester credit regulations accurately", () => {
  // Normal semester: optimal load (12 - 19 credits)
  const normalDiags = checkPlanCreditLimits(16, "السنة الثانية - الفصل الأول");
  assert.equal(normalDiags.length, 0);

  // Normal semester: below minimum 12 credits
  const lowDiags = checkPlanCreditLimits(9, "السنة الثانية - الفصل الأول");
  assert.equal(lowDiags.length, 1);
  assert.equal(lowDiags[0].type, "warning");
  assert.ok(lowDiags[0].detail.includes("أقل من الحد الأدنى"));

  // Normal semester: exceeding max 19 credits
  const highDiags = checkPlanCreditLimits(21, "السنة الثانية - الفصل الأول");
  assert.equal(highDiags.length, 1);
  assert.equal(highDiags[0].type, "error");
  assert.ok(highDiags[0].detail.includes("يتجاوز الحد الأقصى"));

  // Academic warning: capped at 14 credits
  const warningDiags = checkPlanCreditLimits(
    16,
    "السنة الثانية - الفصل الأول",
    { hasAcademicWarning: true },
  );
  assert.equal(warningDiags.length, 1);
  assert.equal(warningDiags[0].type, "error");
  assert.ok(warningDiags[0].detail.includes("14"));

  // Summer semester: capped at 10 credits
  const summerDiags = checkPlanCreditLimits(12, "السنة الثانية - الصيفي");
  assert.equal(summerDiags.length, 1);
  assert.equal(summerDiags[0].type, "error");
  assert.ok(summerDiags[0].detail.includes("10"));

  // Summer semester: allowed 9 credits
  const summerOk = checkPlanCreditLimits(9, "السنة الثانية - الصيفي");
  assert.equal(summerOk.length, 0);
});
