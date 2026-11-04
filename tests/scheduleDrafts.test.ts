import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import {
  getSemesterDrafts,
  saveSemesterDrafts,
  createSemesterDraft,
  duplicateSemesterDraft,
  renameSemesterDraft,
  deleteSemesterDraft,
  getActiveDraftId,
  setActiveDraftId,
} from "../src/core/scheduleDrafts";

// Mock localStorage for node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

(global as any).window = { localStorage: localStorageMock };

beforeEach(() => {
  localStorageMock.clear();
});

test("initializes default primary draft when no drafts exist", () => {
  const drafts = getSemesterDrafts("فصل أول 2026/2027", {
    "101": { day: "الأحد", startTime: "08:00", endTime: "09:15" },
  });

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].name, "المسودة 1 (الأساسية)");
  assert.ok(drafts[0].schedule["101"]);
});

test("creates and duplicates schedule drafts properly", () => {
  const sem = "فصل أول 2026/2027";
  const draft1 = getSemesterDrafts(sem)[0];

  const draft2 = createSemesterDraft(sem, "جدول صباحي بدون خميس", {
    "102": { day: "الاثنين", startTime: "10:00", endTime: "11:15" },
  });

  assert.equal(draft2.name, "جدول صباحي بدون خميس");
  const allDrafts = getSemesterDrafts(sem);
  assert.equal(allDrafts.length, 2);

  const duplicate = duplicateSemesterDraft(sem, draft2.id);
  assert.ok(duplicate);
  assert.equal(duplicate.name, "جدول صباحي بدون خميس (نسخة)");
  assert.equal(getSemesterDrafts(sem).length, 3);
});

test("renames a draft", () => {
  const sem = "فصل ثاني 2026/2027";
  const d = createSemesterDraft(sem, "مسودة قديمة");
  const updated = renameSemesterDraft(sem, d.id, "مسودة جديدة معدلة");
  const found = updated.find((x) => x.id === d.id);
  assert.equal(found?.name, "مسودة جديدة معدلة");
});

test("deleting draft keeps at least one draft alive", () => {
  const sem = "فصل أول 2026/2027";
  const d1 = getSemesterDrafts(sem)[0];
  const d2 = createSemesterDraft(sem, "مسودة ثانية");

  const res1 = deleteSemesterDraft(sem, d2.id);
  assert.equal(res1.updatedDrafts.length, 1);

  // Attempting to delete the only remaining draft must fail gracefully
  const res2 = deleteSemesterDraft(sem, d1.id);
  assert.equal(res2.updatedDrafts.length, 1);
  assert.equal(res2.updatedDrafts[0].id, d1.id);
});
