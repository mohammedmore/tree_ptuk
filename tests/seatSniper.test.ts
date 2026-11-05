import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../server/app.js";
import {
  checkTargetSeatsAvailability,
  snipeAndRegister,
  sqliteSaveTrackedSeats,
  sqliteGetTrackedSeats,
  sqliteRemoveTrackedSeat,
} from "../server/services/seatSniperService.js";
import { signSessionToken } from "../server/services/securityVault.js";

test("seatSniper: checkTargetSeatsAvailability returns accurate seat calculations", async () => {
  // Test with real courses that exist in the database (or fallback)
  const targets = [
    { courseCode: "15200101", sec: "1", courseName: "برمجة 1" },
    {
      courseCode: "NONEXISTENT_COURSE",
      sec: "1",
      courseName: "مساق غير موجود",
    },
  ];

  const results = await checkTargetSeatsAvailability(targets);
  assert.equal(results.length, 2);

  const realCourse = results[0];
  assert.equal(realCourse.courseCode, "15200101");
  assert.equal(typeof realCourse.capacity, "number");
  assert.equal(typeof realCourse.registered, "number");
  assert.equal(typeof realCourse.isFull, "boolean");

  const invalidCourse = results[1];
  assert.equal(invalidCourse.courseCode, "NONEXISTENT_COURSE");
  assert.equal(invalidCourse.isFull, true);
  assert.equal(invalidCourse.available, 0);
});

test("seatSniper: snipeAndRegister coordinates with cascading execution when seat is open", async () => {
  const result = await snipeAndRegister({
    studentId: "202110123",
    targetSeats: [{ courseCode: "15200101", sec: "1", courseName: "برمجة 1" }],
    autoExecute: true,
    demoMode: true,
  });

  assert.ok(result.checkedAt);
  assert.equal(result.totalChecked, 1);
  assert.equal(typeof result.openedCount, "number");
  assert.ok(Array.isArray(result.allSeats));
});

test("seatSniper: SQLite persistence saves, retrieves, and removes tracked seats", () => {
  const studentId = "202419999";
  const seats = [
    { courseCode: "15200101", sec: "1", courseName: "برمجة 1" },
    { courseCode: "15200102", sec: "2", courseName: "برمجة 2" },
  ];

  sqliteSaveTrackedSeats(studentId, seats);

  const saved = sqliteGetTrackedSeats(studentId);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].courseCode, "15200101");
  assert.equal(saved[0].sec, "1");

  sqliteRemoveTrackedSeat(studentId, "15200101", "1");
  const afterRemove = sqliteGetTrackedSeats(studentId);
  assert.equal(afterRemove.length, 1);
  assert.equal(afterRemove[0].courseCode, "15200102");
});

test("seatSniper: POST /api/registration/snipe-check enforces security and executes check", async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Missing Authorization header -> 401
    const unauthRes = await fetch(`${baseUrl}/api/registration/snipe-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: "202110123",
        targetSeats: [{ courseCode: "15200101", sec: "1" }],
      }),
    });
    assert.equal(unauthRes.status, 401);

    // 2. Mismatched student ID -> 403 BOLA
    const attackerToken = signSessionToken({ studentId: "202119999" });
    const bolaRes = await fetch(`${baseUrl}/api/registration/snipe-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${attackerToken}`,
      },
      body: JSON.stringify({
        studentId: "202110123", // caller claims to be someone else
        targetSeats: [{ courseCode: "15200101", sec: "1" }],
      }),
    });
    assert.equal(bolaRes.status, 403);

    // 3. Valid authenticated request -> 200
    const validToken = signSessionToken({ studentId: "202110123" });
    const validRes = await fetch(`${baseUrl}/api/registration/snipe-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        studentId: "202110123",
        targetSeats: [{ courseCode: "15200101", sec: "1" }],
        autoExecute: false,
      }),
    });
    assert.equal(validRes.status, 200);
    const data = await validRes.json();
    assert.equal(data.success, true);
    assert.equal(data.data.totalChecked, 1);
  } finally {
    server.close();
  }
});
