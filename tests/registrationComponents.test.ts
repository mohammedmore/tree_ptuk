import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateDetailedTuition,
  calculateSectionSaturation,
  isSectionClosed,
  sortRegistrationItemsByPriority,
  movePlanItemPriority,
  RegistrationSectionItem,
} from "../src/core/semesterRegistration";

test("calculateDetailedTuition accurately handles credits, fixed fees, and exchange rate", () => {
  const result = calculateDetailedTuition(18, {
    hourlyRate: 30,
    fixedFees: 25,
    exchangeRate: 5.2,
    currency: "JOD",
  });

  assert.equal(result.hourlyRate, 30);
  assert.equal(result.fixedFees, 25);
  assert.equal(result.creditsCostJOD, 18 * 30); // 540
  assert.equal(result.totalJOD, 540 + 25); // 565
  assert.equal(result.totalILS, Math.round(565 * 5.2)); // 2938
});

test("calculateDetailedTuition handles zero credits gracefully", () => {
  const result = calculateDetailedTuition(0, {
    hourlyRate: 35,
    fixedFees: 25,
    exchangeRate: 5.0,
    currency: "JOD",
  });

  assert.equal(result.creditsCostJOD, 0);
  assert.equal(result.totalJOD, 25);
  assert.equal(result.totalILS, 125);
});

test("calculateSectionSaturation accurately classifies normal, critical, and full states", () => {
  const normal = calculateSectionSaturation(20, 40);
  assert.equal(normal.status, "open");
  assert.equal(normal.percent, 50);

  const critical = calculateSectionSaturation(38, 40);
  assert.equal(critical.status, "critical");
  assert.equal(critical.percent, 95);

  const full = calculateSectionSaturation(40, 40);
  assert.equal(full.status, "full");
  assert.equal(full.percent, 100);
});

test("calculateSectionSaturation handles zero capacity safely without division by zero", () => {
  const safeZero = calculateSectionSaturation(0, 0);
  assert.equal(safeZero.status, "critical");
  assert.equal(safeZero.percent, 0);
});

test("isSectionClosed identifies closed sections correctly", () => {
  assert.equal(isSectionClosed(40, 40), true);
  assert.equal(isSectionClosed(42, 40), true); // over capacity
  assert.equal(isSectionClosed(39, 40), false);
  assert.equal(isSectionClosed(undefined, 40), false);
});

test("movePlanItemPriority respects boundary conditions and shifts properly", () => {
  const items: RegistrationSectionItem[] = [
    { courseId: "A", courseName: "A", credits: 3, section: "1", priority: 1 },
    { courseId: "B", courseName: "B", credits: 3, section: "1", priority: 2 },
    { courseId: "C", courseName: "C", credits: 3, section: "1", priority: 3 },
  ];

  // Moving top item up should be a no-op
  const topUp = movePlanItemPriority(items, "A", "up");
  assert.equal(topUp[0].courseId, "A");

  // Moving bottom item down should be a no-op
  const bottomDown = movePlanItemPriority(items, "C", "down");
  assert.equal(bottomDown[2].courseId, "C");

  // Moving middle item up swaps with top
  const midUp = movePlanItemPriority(items, "B", "up");
  assert.equal(midUp[0].courseId, "B");
  assert.equal(midUp[0].priority, 1);
  assert.equal(midUp[1].courseId, "A");
  assert.equal(midUp[1].priority, 2);
});

test("sortRegistrationItemsByPriority sorts priority 1 first then by credit hours", () => {
  const items: RegistrationSectionItem[] = [
    {
      courseId: "CS101",
      courseName: "برمجة عامة",
      credits: 3,
      section: "1",
      priority: 3,
    },
    {
      courseId: "LAB101",
      courseName: "مختبر حاسوب",
      credits: 1,
      section: "2",
      priority: 1,
    },
    {
      courseId: "MATH101",
      courseName: "تفاضل وتكامل",
      credits: 4,
      section: "1",
      priority: 2,
    },
  ];

  const sorted = sortRegistrationItemsByPriority(items);
  assert.equal(
    sorted[0].courseId,
    "LAB101",
    "Priority 1 item should come first",
  );
  assert.equal(
    sorted[1].courseId,
    "MATH101",
    "Priority 2 item should come second",
  );
  assert.equal(
    sorted[2].courseId,
    "CS101",
    "Priority 3 item should come third",
  );
});
