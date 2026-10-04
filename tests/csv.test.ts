import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeCsvValue, parseCsvRows } from "../src/csv";

test("parses quoted commas and escaped quotes across CRLF rows", () => {
  const csv = [
    ["رقم المادة", "اسم المادة", "التصنيف", "الساعات", "الحالة"],
    ["12140101", 'برمجة "متقدمة", 1', "متطلب تخصص", 3, "منجز"],
  ]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");

  assert.deepEqual(parseCsvRows(csv), [
    ["رقم المادة", "اسم المادة", "التصنيف", "الساعات", "الحالة"],
    ["12140101", 'برمجة "متقدمة", 1', "متطلب تخصص", "3", "منجز"],
  ]);
});

test("preserves newlines inside quoted CSV fields", () => {
  assert.deepEqual(parseCsvRows('"id","line one\nline two"\n'), [
    ["id", "line one\nline two"],
  ]);
});

test("strips a UTF-8 BOM before parsing the first header", () => {
  assert.deepEqual(parseCsvRows("\uFEFFid,name\r\n1,Course"), [
    ["id", "name"],
    ["1", "Course"],
  ]);
});

test("rejects malformed quoted fields", () => {
  assert.throws(() => parseCsvRows('"incomplete'), /غير مكتمل/);
  assert.throws(() => parseCsvRows('"quoted"x'), /بعد نهاية الحقل/);
});
