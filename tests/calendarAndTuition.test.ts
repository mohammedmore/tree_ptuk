import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getOfficialTuitionRate,
  calculateSemesterTuition,
  OFFICIAL_FIXED_FEES,
} from "../server/services/tuitionFeesService.js";

test("tuitionFeesService returns accurate official rate for Computer Systems Engineering", () => {
  const rate = getOfficialTuitionRate("هندسة أنظمة الحاسوب");
  assert.equal(rate.hourlyRateJOD, 24);
  assert.equal(rate.faculty, "كلية الهندسة والتكنولوجيا");
});

test("tuitionFeesService returns accurate rate for Artificial Intelligence", () => {
  const rate = getOfficialTuitionRate("الذكاء الاصطناعي");
  assert.equal(rate.hourlyRateJOD, 26);
  assert.equal(rate.faculty, "كلية تكنولوجيا المعلومات والذكاء الاصطناعي");
});

test("tuitionFeesService returns accurate rate for Computer Science & Software Engineering", () => {
  const csRate = getOfficialTuitionRate("علم الحاسوب");
  assert.equal(csRate.hourlyRateJOD, 20);

  const sweRate = getOfficialTuitionRate("هندسة البرمجيات");
  assert.equal(sweRate.hourlyRateJOD, 20);
});

test("tuitionFeesService returns accurate rate for Allied Medical Sciences", () => {
  const medRate = getOfficialTuitionRate("العلوم الطبية المخبرية");
  assert.equal(medRate.hourlyRateJOD, 36);
  assert.equal(medRate.faculty, "كلية العلوم الطبية المساندة");
});

test("tuitionFeesService returns accurate rate for Business & Economics", () => {
  const bizRate = getOfficialTuitionRate("المحاسبة");
  assert.equal(bizRate.hourlyRateJOD, 20);
});

test("tuitionFeesService returns accurate rate for Diplomas", () => {
  const dipRate = getOfficialTuitionRate("دبلوم شبكات");
  assert.equal(dipRate.hourlyRateJOD, 12);
});

test("tuitionFeesService calculateSemesterTuition uses official fixed registration fee (25 JOD) and student union (1 JOD)", () => {
  assert.equal(OFFICIAL_FIXED_FEES.registrationFeeJOD, 25);
  assert.equal(OFFICIAL_FIXED_FEES.studentUnionFeeJOD, 1);

  const result = calculateSemesterTuition({
    majorName: "هندسة أنظمة الحاسوب",
    credits: 18,
  });

  // 18 * 24 = 432 JOD
  // Fixed fees = 25 (registration) + 1 (student union) = 26 JOD
  // Total JOD = 458 JOD
  assert.equal(result.creditsFeeJOD, 432);
  assert.equal(result.hourlyRateJOD, 24);
  assert.equal(result.totalJOD, 458);
  assert.ok(result.totalILS > 2000);
});

test("academicCalendar: returns authentic PTUK semesters and milestones", async () => {
  const { getEnrichedAcademicCalendar, AUTHENTIC_PTUK_SEMESTERS } =
    await import("../src/data/ptukAcademicCalendar.ts");

  assert.equal(AUTHENTIC_PTUK_SEMESTERS.length, 3);
  assert.equal(AUTHENTIC_PTUK_SEMESTERS[0].id, "20261");
  assert.equal(AUTHENTIC_PTUK_SEMESTERS[1].id, "20262");
  assert.equal(AUTHENTIC_PTUK_SEMESTERS[2].id, "20263");

  const calendar = getEnrichedAcademicCalendar(new Date("2026-11-01"));
  assert.equal(calendar.success, true);
  assert.equal(calendar.academicYear, "2026/2027");
  assert.equal(calendar.semesters.length, 3);
  assert.ok(calendar.nextUpcomingMilestone !== null);
  assert.ok(calendar.semesters[0].events.length >= 15);
});

test("academicCalendar: categorizes official PTUK activities accurately", async () => {
  const { categorizeActivity } =
    (await import("../server/services/scrapers/academicCalendarScraper.js")) as any;

  assert.equal(
    categorizeActivity("التسجيل للفصل الدّراسي الثّاني"),
    "registration",
  );
  assert.equal(categorizeActivity("أُسبوع السحب والإضافة"), "add_drop");
  assert.equal(categorizeActivity("آخر يوم للسحب المُتأخر(W)"), "withdrawal");
  assert.equal(
    categorizeActivity("الامتحانات النصفيّة النظريّة"),
    "exam_midterm",
  );
  assert.equal(
    categorizeActivity("الامتحانات النهائيّة العمليّة"),
    "exam_final",
  );
  assert.equal(categorizeActivity("عيد الاستقلال (عطلة)"), "holiday");
  assert.equal(
    categorizeActivity("إعلان النتائج وانتهاء الفصل الأوّل"),
    "results",
  );
});

test("academicCalendar: server db returns valid academic calendar without null", async () => {
  const db = (await import("../server/db.js")) as any;
  const cal = db.getAcademicCalendar();
  assert.ok(cal !== null);
  assert.equal(cal.success, true);
  assert.equal(cal.semesters.length, 3);
});
