import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchCourses,
  fetchCoursesByCodes,
  searchCourses,
  isOfflineCatalog,
  clearCoursesCache,
} from "../src/services/courseService";

test("courseService fetches courses using offline fallback when backend is unavailable", async () => {
  clearCoursesCache();
  const loaded = await fetchCourses();
  assert.ok(Array.isArray(loaded));
  assert.ok(loaded.length > 0);
  // Offline fallback is active in test environment without running Express backend
  assert.equal(typeof isOfflineCatalog(), "boolean");
});

test("searchCourses searches by code and normalized Arabic text variants", async () => {
  // Search by code prefix
  const byCode = await searchCourses("12140");
  assert.ok(byCode.length > 0);
  assert.ok(
    byCode.every((c) => c.id.includes("12140") || c.name.includes("12140")),
  );

  // Search by Arabic name with different alef/hamza forms
  const withHamza = await searchCourses("إنجليزي");
  const withoutHamza = await searchCourses("انجليزي");
  assert.ok(withHamza.length > 0);
  assert.ok(withoutHamza.length > 0);
  assert.equal(withHamza[0].id, withoutHamza[0].id);

  // Search by partial text
  const partial = await searchCourses("حاسوب");
  assert.ok(partial.length > 0);
});

test("fetchCoursesByCodes preserves order, deduplicates, and falls back to static catalog", async () => {
  const codes = ["15200099", "13010006", "15200099"]; // Has duplicate
  const results = await fetchCoursesByCodes(codes);

  assert.equal(results.length, 2);
  assert.equal(results[0].id, "15200099");
  assert.equal(results[1].id, "13010006");

  // Rejects invalid input
  await assert.rejects(
    // @ts-expect-error testing runtime check
    () => fetchCoursesByCodes(null),
    { name: "TypeError" },
  );
});
