import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeAppStorageValue,
  readAppStorageValue,
  serializeAppStorageValue,
} from "../src/appStorage";

function withLocalStorage<T>(getItem: (key: string) => string | null, run: () => T): T {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: { getItem } },
  });

  try {
    return run();
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("normalizes legacy completed-course arrays as sets", () => {
  assert.deepEqual(
    normalizeAppStorageValue("completed_courses", ["12140101"], new Set<string>()),
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
  assert.equal(normalizeAppStorageValue("course_grades", { course: 150 }, {}), null);
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
      normalizeAppStorageValue("weekly_schedule", { [semester]: { course: entry } }, {}),
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
    () => readAppStorageValue(
      "completed_courses",
      new Set(["existing"]),
      (message) => issues.push(message),
    ),
  );

  assert.deepEqual(value, new Set(["existing"]));
  assert.equal(issues.length, 1);
});
