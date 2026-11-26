import test from "node:test";
import assert from "node:assert/strict";
import {
  EDUGATE_PLAN_SOURCE,
  normalizeEdugateMajorPlan,
} from "../server/services/majorPlanParser.js";

test("normalizes the plan without inventing semesters or elective totals", () => {
  const plan = normalizeEdugateMajorPlan({
    courses: [
      {
        id: "١٢١٤٠١٠١",
        name: "برمجة الحاسوب",
        credits: "٣",
        category: "متطلب تخصص إجباري",
      },
      {
        id: "12140201",
        name: "اختياري أول",
        credits: 3,
        category: "متطلب تخصص اختياري",
      },
      {
        id: "12140202",
        name: "اختياري بديل",
        credits: 3,
        category: "متطلب تخصص اختياري",
      },
    ],
    categoryRequirements: { "متطلب تخصص اختياري": 3 },
  });

  assert.equal(plan.source, EDUGATE_PLAN_SOURCE);
  assert.equal(plan.courses[0].code, "12140101");
  assert.equal(plan.courses[0].credits, 3);
  assert.equal(plan.courses[0].semester, "");
  assert.equal(plan.categoryRequirements["متطلب تخصص اختياري"], 3);
  assert.equal(plan.totalDegreeCredits, 0);
});

test("rejects duplicated course codes and missing credit values", () => {
  const course = {
    code: "12140101",
    name: "برمجة الحاسوب",
    credits: 3,
  };

  assert.throws(
    () =>
      normalizeEdugateMajorPlan({
        courses: [course, course],
      }),
    /تكرر رمز المادة/,
  );
  assert.throws(
    () =>
      normalizeEdugateMajorPlan({
        courses: [{ ...course, credits: "" }],
      }),
    /ساعات المادة/,
  );
});
