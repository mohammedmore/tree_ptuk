import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isIndexedDBSupported,
  normalizeSearchText,
  searchCatalogFromIndexedDB,
  saveCatalogToIndexedDB,
  loadCatalogFromIndexedDB,
  getCoursesByCodesFromIndexedDB,
  clearCatalogIndexedDB,
} from "../src/services/catalogDb";

test("isIndexedDBSupported returns boolean based on environment", () => {
  const supported = isIndexedDBSupported();
  assert.equal(typeof supported, "boolean");
});

test("normalizeSearchText handles Arabic characters and whitespace", () => {
  assert.equal(normalizeSearchText("أحمد"), "احمد");
  assert.equal(normalizeSearchText("برمجة"), "برمجه");
  assert.equal(normalizeSearchText("على"), "علي");
  assert.equal(normalizeSearchText("  MATH 101  "), "math 101");
});

test("catalogDb handles environments without window.indexedDB gracefully", async () => {
  // In Node.js environment without IDB, functions resolve gracefully to null / empty arrays without crashing
  const loaded = await loadCatalogFromIndexedDB();
  assert.equal(loaded, null);

  const searched = await searchCatalogFromIndexedDB("12140");
  assert.deepEqual(searched, []);

  const byCodes = await getCoursesByCodesFromIndexedDB(["12140101"]);
  assert.deepEqual(byCodes, []);

  await assert.doesNotReject(async () => {
    await saveCatalogToIndexedDB([]);
    await clearCatalogIndexedDB();
  });
});
