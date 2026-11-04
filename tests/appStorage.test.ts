import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeAppStorageValue,
  readAppStorageValue,
  serializeAppStorageValue,
  writeAppStorageValue,
} from "../src/appStorage";

function withLocalStorage<T>(
  getItem: (key: string) => string | null,
  run: () => T,
  setItem?: (key: string, value: string) => void,
): T {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: { getItem, setItem: setItem ?? (() => {}) } },
  });

  try {
    return run();
  } finally {
    if (originalWindow)
      Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("normalizes legacy completed-course arrays as sets", () => {
  assert.deepEqual(
    normalizeAppStorageValue(
      "completed_courses",
      ["12140101"],
      new Set<string>(),
    ),
    new Set(["12140101"]),
  );
});

test("rejects planned courses containing unknown semester labels", () => {
  assert.equal(
    normalizeAppStorageValue("planned_courses", { "12140101": "unknown" }, {}),
    null,
  );
});

test("fills missing legacy schedule times with safe defaults", () => {
  assert.deepEqual(
    normalizeAppStorageValue(
      "weekly_schedule",
      { "السنة الأولى - الفصل الأول": { "12140101": { day: "الأحد" } } },
      {},
    ),
    {
      "السنة الأولى - الفصل الأول": {
        "12140101": {
          startTime: "08:00",
          endTime: "09:00",
          days: ["الأحد"],
          section: "",
          instructor: "",
          room: "",
        },
      },
    },
  );
});

test("rejects grades outside the supported range", () => {
  assert.equal(
    normalizeAppStorageValue("course_grades", { course: 150 }, {}),
    null,
  );
});

test("rejects malformed weekly schedule values instead of replacing or filtering them", () => {
  const semester = "السنة الأولى - الفصل الأول";
  const invalidEntries = [
    { startTime: "25:00" },
    { endTime: 9 },
    { days: ["الأحد", 42] },
    { day: 42 },
    { section: 3 },
    { instructor: false },
    { room: null },
    { location: 12 },
  ];

  for (const entry of invalidEntries) {
    assert.equal(
      normalizeAppStorageValue(
        "weekly_schedule",
        { [semester]: { course: entry } },
        {},
      ),
      null,
      `expected invalid schedule entry ${JSON.stringify(entry)} to be rejected`,
    );
  }
});

test("loads legacy schedule aliases and keeps valid schedule details", () => {
  assert.deepEqual(
    normalizeAppStorageValue(
      "weekly_schedule",
      {
        "السنة الأولى - الفصل الأول": {
          course: { day: "الأحد", location: "قاعة 1", startTime: "09:30" },
        },
      },
      {},
    ),
    {
      "السنة الأولى - الفصل الأول": {
        course: {
          startTime: "09:30",
          endTime: "09:00",
          days: ["الأحد"],
          section: "",
          instructor: "",
          room: "قاعة 1",
        },
      },
    },
  );
});

test("serializes sets and reads them back from the versioned storage envelope", () => {
  const serialized = serializeAppStorageValue(new Set(["12140101"]));
  const value = withLocalStorage(
    () => serialized,
    () => readAppStorageValue("completed_courses", new Set<string>(), () => {}),
  );

  assert.deepEqual(value, new Set(["12140101"]));
  assert.deepEqual(JSON.parse(serialized), {
    schemaVersion: 1,
    value: ["12140101"],
  });
});

test("rejects unsupported storage schema versions and reports the issue", () => {
  const issues: string[] = [];
  const value = withLocalStorage(
    () => JSON.stringify({ schemaVersion: 2, value: ["12140101"] }),
    () =>
      readAppStorageValue(
        "completed_courses",
        new Set(["existing"]),
        (message) => issues.push(message),
      ),
  );

  assert.deepEqual(value, new Set(["existing"]));
  assert.equal(issues.length, 1);
});

test("migrates legacy un-enveloped raw arrays and records without data loss", () => {
  const issues: string[] = [];
  const value = withLocalStorage(
    () => JSON.stringify(["12140101", "12140102"]),
    () =>
      readAppStorageValue("completed_courses", new Set<string>(), (message) =>
        issues.push(message),
      ),
  );

  assert.deepEqual(value, new Set(["12140101", "12140102"]));
  assert.equal(issues.length, 0);
});

test("migrates older versioned envelopes (v0) to current schema", () => {
  const issues: string[] = [];
  const value = withLocalStorage(
    () => JSON.stringify({ schemaVersion: 0, value: ["12140101"] }),
    () =>
      readAppStorageValue("completed_courses", new Set<string>(), (message) =>
        issues.push(message),
      ),
  );

  assert.deepEqual(value, new Set(["12140101"]));
  assert.equal(issues.length, 0);
});

test("writeAppStorageValue serializes and atomically persists values with schema version envelope", () => {
  const store = new Map<string, string>();
  const success = withLocalStorage(
    (key) => store.get(key) ?? null,
    () => {
      const ok1 = writeAppStorageValue(
        "completed_courses",
        new Set(["12140101", "12140102"]),
      );
      const ok2 = writeAppStorageValue("dark_mode", true);
      return ok1 && ok2;
    },
    (key, val) => {
      store.set(key, val);
    },
  );

  assert.equal(success, true);
  assert.ok(store.has("completed_courses"));
  const parsedCourses = JSON.parse(store.get("completed_courses")!);
  assert.equal(parsedCourses.schemaVersion, 1);
  assert.deepEqual(parsedCourses.value, ["12140101", "12140102"]);

  const parsedTheme = JSON.parse(store.get("dark_mode")!);
  assert.equal(parsedTheme.schemaVersion, 1);
  assert.equal(parsedTheme.value, true);
});
