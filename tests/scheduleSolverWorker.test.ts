import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateSchedulesAsync,
  explainConflictsAsync,
} from "../src/services/scheduleSolverClient";

test("generateSchedulesAsync resolves without errors (fallback to main thread in Node)", async () => {
  const mockCourses = [
    {
      id: "12140101",
      name: "برمجة 1",
      sections: [
        {
          sec: "1",
          instructor: "د. أحمد",
          blocks: [{ days: ["أح", "ثلا", "خمـ"], start: 8, end: 9 }],
        },
      ],
    },
  ];

  const schedules = await generateSchedulesAsync(mockCourses as any, {});
  assert.equal(Array.isArray(schedules), true);
  assert.equal(schedules.length, 1);
  assert.equal(schedules[0][0].section.sec, "1");
});

test("explainConflictsAsync resolves conflict analysis", async () => {
  const mockCourses = [
    {
      id: "12140101",
      name: "برمجة 1",
      sections: [
        {
          sec: "1",
          blocks: [{ days: ["أح"], start: 8, end: 9.5 }],
        },
      ],
    },
    {
      id: "12140102",
      name: "فيزياء 1",
      sections: [
        {
          sec: "1",
          blocks: [{ days: ["أح"], start: 8.5, end: 10 }],
        },
      ],
    },
  ];

  const explanation = await explainConflictsAsync(mockCourses as any, {});
  assert.ok(explanation);
  assert.equal(explanation.hasConflict, true);
});
