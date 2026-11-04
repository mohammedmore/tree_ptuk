import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cn,
  normalizeArabicText,
  wordsMatch,
  getCourseDeliveryType,
} from "../src/utils";

test("cn merges class names and tailwind conflict overrides", () => {
  const result = cn("p-4", "text-sm", false && "hidden", "p-2");
  assert.equal(result, "text-sm p-2");
});

test("normalizeArabicText standardizes Alef, Yaa, Taa Marbuta and diacritics", () => {
  const raw = "هَنْدَسَةُ الْأَنْظِمَةِ الإلِكْترُونِيَّةِ والذكاء";
  const normalized = normalizeArabicText(raw);
  assert.equal(normalized, "هندسه الانظمه الالكترونيه والذكاا");

  // Zero-width chars and Arabic punctuation
  const withZeroWidth = "هندسة\u200C البرمجيات، والذكاء؛";
  assert.equal(normalizeArabicText(withZeroWidth), "هندسه البرمجيات والذكاا");
});

test("wordsMatch matches tokens with or without prefix and handles Arabic variants", () => {
  assert.ok(wordsMatch("الخوارزميات", "خوارزميات"));
  assert.ok(wordsMatch("قواعد البيانات", "بيانات"));
  assert.ok(wordsMatch("مقدمة في البرمجة", "برمجه"));
  assert.ok(!wordsMatch("فيزياء", "كيمياء"));
});

test("getCourseDeliveryType accurately classifies lab, project, training, and theory courses", () => {
  const lab1 = getCourseDeliveryType("مختبر فيزياء عامة 1");
  assert.equal(lab1.type, "lab");
  assert.equal(lab1.label, "عملي / مختبر");

  const lab2 = getCourseDeliveryType("Operating Systems Lab");
  assert.equal(lab2.type, "lab");

  const proj = getCourseDeliveryType("مشروع تخرج 1");
  assert.equal(proj.type, "project");
  assert.equal(proj.label, "مشروع تخرج");

  const train = getCourseDeliveryType("تدريب هندسي ميداني");
  assert.equal(train.type, "training");
  assert.equal(train.label, "تدريب ميداني");

  const theory = getCourseDeliveryType("رياضيات متقطعة");
  assert.equal(theory.type, "theory");
  assert.equal(theory.label, "نظري");
});
