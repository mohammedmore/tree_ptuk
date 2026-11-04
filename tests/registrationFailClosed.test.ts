import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeArabicMessage,
  classifyPortalMessage,
} from "../server/services/scrapers/messages.js";

test("normalizeArabicMessage standardizes Arabic-Indic numerals, Alef, Yaa, Taa Marbuta and spaces", () => {
  const input = "  الشعبة  ١  مكتملة   تماماً  ";
  const normalized = normalizeArabicMessage(input);
  assert.equal(normalized, "الشعبه 1 مكتمله تماما");
});

test("classifyPortalMessage classifies SECTION_FULL correctly", () => {
  const result = classifyPortalMessage("الشعبة رقم 1 مكتملة ولا توجد شواغر");
  assert.equal(result.code, "SECTION_FULL");
  assert.ok(result.userMessage.includes("مغلقة"));
});

test("classifyPortalMessage classifies TIME_CONFLICT correctly", () => {
  const result = classifyPortalMessage(
    "يوجد تعارض في مواعيد المحاضرات مع مادة أخرى",
  );
  assert.equal(result.code, "TIME_CONFLICT");
  assert.ok(result.userMessage.includes("تعارض"));
});

test("classifyPortalMessage classifies FINANCIAL_HOLD correctly", () => {
  const result = classifyPortalMessage(
    "يرجى مراجعة الدائرة المالية لتسديد الرسوم وبراءة الذمة",
  );
  assert.equal(result.code, "FINANCIAL_HOLD");
  assert.ok(result.userMessage.includes("مالي"));
});

test("classifyPortalMessage classifies PREREQ_MISSING correctly", () => {
  const result = classifyPortalMessage("لم يتم استيفاء متطلب سابق للمساق");
  assert.equal(result.code, "PREREQ_MISSING");
});

test("classifyPortalMessage classifies HOURS_LIMIT correctly", () => {
  const result = classifyPortalMessage(
    "تجاوز الحد الأقصى للساعات المسموحة للتسجيل",
  );
  assert.equal(result.code, "HOURS_LIMIT");
});

test("classifyPortalMessage classifies WINDOW_CLOSED correctly", () => {
  const result = classifyPortalMessage(
    "فترة التسجيل غير متاحة حالياً حسب التقويم الجامعي",
  );
  assert.equal(result.code, "WINDOW_CLOSED");
});

test("classifyPortalMessage handles unknown messages safely", () => {
  const result = classifyPortalMessage(
    "نص غير متوقع من الخادم وغير معروف في الكتالوج",
  );
  assert.equal(result.code, "UNKNOWN_MESSAGE");
  assert.ok(result.userMessage.includes("رسالة غير مصنفة"));
});
