import assert from "node:assert/strict";
import { test } from "node:test";
import "../server/index.d.ts";
import app from "../server/app.js";
import {
  getCourses,
  getMajors,
  getMajorById,
  getSyncStatus,
  acquireSyncLock,
  releaseSyncLock,
  isSyncActive,
} from "../server/db.js";
import { authenticateAndSyncStudent } from "../server/services/studentPortalService.js";
import { parseDays } from "../server/services/scrapers/ptukScraper.js";

test("db.js getCourses returns courses with sections and blocks", async () => {
  const courses = await getCourses();
  assert.ok(Array.isArray(courses));
  assert.ok(courses.length > 0, "Should return seeded courses");

  const cseCourse = courses.find((c: any) => c.code === "12140101");
  assert.ok(cseCourse, "Should find course 12140101");
  assert.ok(Array.isArray(cseCourse.sections));
  assert.ok(cseCourse.sections.length > 0, "Course should have sections");
  assert.ok(
    Array.isArray(cseCourse.sections[0].blocks),
    "Section should have blocks",
  );
});

test("db.js getCourses filters by course codes", async () => {
  const filtered = await getCourses({ codes: ["15200099", "13010006"] });
  assert.equal(filtered.length, 2);
  const codes = filtered.map((c: any) => c.code);
  assert.ok(codes.includes("15200099"));
  assert.ok(codes.includes("13010006"));
});

test("db.js getMajors returns array and has purged legacy dummy majors", () => {
  const majors = getMajors();
  assert.ok(Array.isArray(majors));
  const legacyIds = majors.map((m: any) => m.id);
  assert.ok(!legacyIds.includes("cse"), "Should have purged dummy cse");
  assert.ok(!legacyIds.includes("swe"), "Should have purged dummy swe");
  assert.ok(!legacyIds.includes("cs"), "Should have purged dummy cs");
  assert.ok(!legacyIds.includes("ee"), "Should have purged dummy ee");
});

test("db.js getSyncStatus returns valid tracking metadata", () => {
  const status = getSyncStatus();
  assert.ok(status);
  assert.equal(typeof status.totalCourses, "number");
  assert.ok(status.totalCourses > 0);
  assert.ok(status.lastSyncTime !== null);
});

test("studentPortalService handles authentication, dynamically creates cohort major with clean plan, and excludes remedial hours", async () => {
  const student = await authenticateAndSyncStudent("202110123", "demo", {
    demoMode: true,
  });
  assert.ok(student);
  assert.equal(student.studentId, "202110123");
  assert.equal(student.cohortYear, "2021");
  assert.ok(
    student.majorId.includes("2021"),
    "Major ID should incorporate cohort year",
  );
  assert.ok(Array.isArray(student.passedCourseIds));
  assert.ok(student.passedCourseIds.length > 10, "Should have passed courses");
  assert.ok(
    student.passedCourseIds.includes("15200099"),
    "Should include English remedial (15200099)",
  );
  assert.ok(
    student.passedCourseIds.includes("13010006"),
    "Should include Computer Skills (13010006)",
  );

  // Remedial hours must NOT be included in earned credits
  const totalPassedWithRemedial = student.passedCourseIds.reduce(
    (sum: number, id: string) => {
      return sum + (id === "15200099" ? 3 : id === "13010006" ? 1 : 0);
    },
    0,
  );
  assert.ok(totalPassedWithRemedial >= 4, "Passed both remedials");
  // Check that earnedCredits does not include the 4 remedial credits
  const allCompletedSum = (student.planCourses || [])
    .filter((c: any) => student.passedCourseIds.includes(c.id))
    .reduce((sum: number, c: any) => sum + (c.credits || 0), 0);
  assert.equal(
    student.earnedCredits,
    allCompletedSum - 4,
    "Earned credits must exclude 4 credits of remedials",
  );

  // Verify the dynamically saved clean general major in database
  const cleanMajor = getMajorById(student.majorId);
  assert.ok(cleanMajor, "Clean major must be registered in database");
  assert.equal(cleanMajor.cohortYear, "2021");
  assert.ok(Array.isArray(cleanMajor.courses));
  assert.ok(cleanMajor.courses.length > 50);

  // General curriculum must be clean: NO student grades or student completion status
  for (const course of cleanMajor.courses) {
    assert.equal(
      course.grade,
      undefined,
      `Course ${course.id} must not have student grade in general plan`,
    );
    assert.equal(
      course.status,
      undefined,
      `Course ${course.id} must not have student status in general plan`,
    );
  }

  // Major is now listed in getMajors for guests and other students
  const availableMajors = getMajors();
  const foundInList = availableMajors.find(
    (m: any) => m.id === student.majorId,
  );
  assert.ok(foundInList, "Saved major should appear in getMajors()");
  assert.equal(foundInList.cohortYear, "2021");

  assert.ok(
    Array.isArray((student as any).exemptionExams),
    "Student profile must include exemptionExams",
  );
  assert.ok(Array.isArray(student.enrolledCourses));
  assert.equal(typeof student.gpa, "number");
  assert.ok(student.studentName, "Student profile must include studentName");
  assert.ok(
    student.academicStatus,
    "Student profile must include academicStatus",
  );
});

test("ptukScraper parseDays accurately parses real Edugate day abbreviations", () => {
  assert.deepEqual(parseDays("[ 09:00_10:00 ] أح ثلا خمـ"), [
    "الأحد",
    "الثلاثاء",
    "الخميس",
  ]);
  assert.deepEqual(parseDays("[ 11:00_12:00 ] أح ثلا"), ["الأحد", "الثلاثاء"]);
  assert.deepEqual(parseDays("[ 09:30_11:00 ] اث ار"), ["الاثنين", "الأربعاء"]);
  assert.deepEqual(parseDays("08:30-09:30 ح ث خ"), [
    "الأحد",
    "الثلاثاء",
    "الخميس",
  ]);
  assert.deepEqual(parseDays("09:30-11:00 ن ر"), ["الاثنين", "الأربعاء"]);
  assert.deepEqual(parseDays("[ 10:00_13:00 ] سب"), ["السبت"]);
});

test("db.js sync lock prevents concurrent sync executions", () => {
  assert.equal(isSyncActive(), false);
  assert.equal(acquireSyncLock(), true);
  assert.equal(isSyncActive(), true);
  assert.equal(
    acquireSyncLock(),
    false,
    "Second concurrent lock acquisition must fail",
  );

  releaseSyncLock();
  assert.equal(isSyncActive(), false);
});

test("registrationEngine prewarms session successfully", async () => {
  const { prewarmSession } =
    await import("../server/services/registrationEngine.js");
  const res = await prewarmSession({ studentId: "202310123", demoMode: true });
  assert.ok(res.success);
  assert.equal(res.sessionReady, true);
  assert.equal(typeof res.pingMs, "number");
});

test("registrationEngine executes batch with cascading fallback from Plan A to Plan B when section is full", async () => {
  const { executeRegistrationBatch } =
    await import("../server/services/registrationEngine.js");
  const plans = {
    A: {
      id: "A",
      title: "الخطة الأساسية",
      description: "",
      totalCredits: 3,
      estimatedTuition: 75,
      items: [
        {
          courseId: "12140101",
          courseName: "برمجة 1",
          section: "1", // Simulated full in demo mode
          credits: 3,
          priority: 1,
        },
      ],
    },
    B: {
      id: "B",
      title: "الخطة البديلة",
      description: "",
      totalCredits: 3,
      estimatedTuition: 75,
      items: [
        {
          courseId: "12140101",
          courseName: "برمجة 1",
          section: "2", // Alternative available section!
          credits: 3,
          priority: 1,
        },
      ],
    },
    C: {
      id: "C",
      title: "خطة الطوارئ",
      description: "",
      totalCredits: 0,
      estimatedTuition: 0,
      items: [],
    },
  };

  const summary = await executeRegistrationBatch({
    studentId: "202310123",
    plans,
    options: { demoMode: true, autoFallbackOnFull: true, targetPlan: "A" },
  });

  assert.ok(summary);
  assert.equal(summary.status, "completed");
  assert.equal(summary.registeredCount, 1);
  assert.equal(summary.failedCount, 0);
  assert.equal(summary.items.length, 1);
  assert.equal(summary.items[0].status, "registered");
  assert.equal(summary.items[0].fallbackUsed, true);
  assert.equal(summary.items[0].effectivePlan, "B");
  assert.equal(summary.items[0].effectiveSection, "2");
  assert.ok(summary.diagnostics.length > 0);
});

test("registrationEngine testRegistrationRequest verifies payload without actual registration and detects section errors", async () => {
  const { testRegistrationRequest } =
    await import("../server/services/registrationEngine.js");
  const testPlan = {
    id: "A",
    title: "خطة 1",
    description: "",
    totalCredits: 3,
    estimatedTuition: 75,
    items: [
      {
        courseId: "12140101",
        courseName: "مقدمة في هندسة الحاسوب",
        section: "99",
        credits: 3,
        priority: 1,
      },
    ],
  };

  const result = await testRegistrationRequest({
    studentId: "202310123",
    plan: testPlan,
    demoMode: true,
  });

  assert.ok(result);
  assert.equal(result.dryRun, true);
  assert.equal(typeof result.pingMs, "number");
  assert.equal(result.requestDetails.method, "POST");
  assert.ok(result.requestDetails.endpoint.includes("edugate.ptuk.edu.ps"));
  assert.equal(result.requestDetails.payloadData.studentNo, "202310123");
  assert.equal(result.validatedItems.length, 1);
  assert.equal(result.statusCategory, "warning");
  assert.equal(result.errorType, "SECTION_NOT_FOUND");
});

test("database maintenance and sqlite optimization execute cleanly", async () => {
  const { optimizeSqliteDb } = await import("../server/sqliteDb.js");
  const { runDatabaseMaintenance } =
    await import("../server/services/scheduler.js");

  const optResult = optimizeSqliteDb();
  assert.equal(optResult, true);

  const maintenanceResult = await runDatabaseMaintenance();
  assert.ok(maintenanceResult.success);
  assert.equal(typeof maintenanceResult.prunedSharedSchedules, "number");
});

test("sqliteDb getSqliteMetrics returns accurate storage and count analytics", async () => {
  const { getSqliteMetrics, sqliteUpsertCohortPlan, sqliteGetCohortPlan } =
    await import("../server/sqliteDb.js");

  const metrics = getSqliteMetrics();
  assert.ok(metrics);
  assert.equal(typeof metrics.sizeBytes, "number");
  assert.ok(metrics.sizeFormatted.includes("MB"));
  assert.ok(typeof metrics.tableCounts.courses === "number");
  assert.ok(typeof metrics.tableCounts.sections === "number");
  assert.ok(typeof metrics.tableCounts.students === "number");

  // Test cohort plans persistence roundtrip in SQLite
  const testMajorId = "cse_test";
  const testYear = "2024";
  const planData = { title: "CSE Plan 2024", semesters: [] };

  sqliteUpsertCohortPlan(testMajorId, testYear, planData);
  const retrieved = sqliteGetCohortPlan(testMajorId, testYear);
  assert.ok(retrieved);
  assert.equal(retrieved.title, "CSE Plan 2024");
});

test("edugateCircuitBreaker trips to OPEN on upstream failures and resets on success", async () => {
  const { edugateCircuitBreaker } =
    await import("../server/utils/circuitBreaker.js");

  edugateCircuitBreaker.reset();
  assert.equal(edugateCircuitBreaker.canExecute().allowed, true);
  assert.equal(edugateCircuitBreaker.getStatus().state, "CLOSED");

  // User auth errors should NOT trip the breaker
  edugateCircuitBreaker.recordFailure(new Error("بيانات الدخول غير صحيحة"));
  assert.equal(edugateCircuitBreaker.getStatus().consecutiveFailures, 0);

  // Upstream network failures DO trip the breaker
  edugateCircuitBreaker.recordFailure(
    new Error("ETIMEDOUT connecting to edugate.ptuk.edu.ps:443"),
  );
  edugateCircuitBreaker.recordFailure(new Error("502 Bad Gateway"));
  edugateCircuitBreaker.recordFailure(new Error("Connection reset by peer"));

  assert.equal(edugateCircuitBreaker.getStatus().consecutiveFailures, 3);
  const check = edugateCircuitBreaker.canExecute();
  assert.equal(check.allowed, false);
  assert.ok(check.reason?.includes("Circuit Breaker Tripped"));

  // Reset and verify recovery
  edugateCircuitBreaker.recordSuccess();
  assert.equal(edugateCircuitBreaker.getStatus().state, "CLOSED");
  assert.equal(edugateCircuitBreaker.canExecute().allowed, true);
});

test("GET /api/health reports comprehensive database metrics and circuit status", async () => {
  const http = await import("node:http");
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.status, "healthy");
    assert.ok(data.database.sqliteHealthy);
    assert.ok(data.database.metrics);
    assert.ok(data.database.metrics.sizeFormatted);
    assert.ok(data.circuitBreaker);
    assert.equal(data.circuitBreaker.edugate.state, "CLOSED");
  } finally {
    server.close();
  }
});
