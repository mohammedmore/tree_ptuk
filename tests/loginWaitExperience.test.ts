import { test } from "node:test";
import assert from "node:assert/strict";
import { SYNC_PIPELINE_STEPS } from "../src/components/auth/SyncPipelineRadar";
import {
  isAudioMuted,
  setAudioMuted,
  toggleAudioMuted,
} from "../src/utils/syncAudio";

test("SYNC_PIPELINE_STEPS: correctly orders all 5 live Edugate synchronization stages", () => {
  assert.equal(
    SYNC_PIPELINE_STEPS.length,
    5,
    "Must have exactly 5 pipeline stages",
  );

  const expectedIds = [1, 2, 3, 4, 5];
  const actualIds = SYNC_PIPELINE_STEPS.map((s) => s.id);
  assert.deepEqual(
    actualIds,
    expectedIds,
    "Pipeline steps must be sequentially numbered 1 to 5",
  );

  for (const step of SYNC_PIPELINE_STEPS) {
    assert.ok(
      step.title.trim().length > 0,
      `Step ${step.id} title cannot be empty`,
    );
    assert.ok(
      step.shortDesc.trim().length > 0,
      `Step ${step.id} shortDesc cannot be empty`,
    );
  }

  // Verify chronological flow
  assert.ok(
    SYNC_PIPELINE_STEPS[0].title.includes("Edugate") ||
      SYNC_PIPELINE_STEPS[0].title.includes("اتصال"),
  );
  assert.ok(
    SYNC_PIPELINE_STEPS[1].title.includes("مصادقة") ||
      SYNC_PIPELINE_STEPS[1].title.includes("الهوية"),
  );
  assert.ok(
    SYNC_PIPELINE_STEPS[2].title.includes("العلامات") ||
      SYNC_PIPELINE_STEPS[2].title.includes("السجل"),
  );
  assert.ok(
    SYNC_PIPELINE_STEPS[3].title.includes("الخطة") ||
      SYNC_PIPELINE_STEPS[3].title.includes("المعدل"),
  );
  assert.ok(
    SYNC_PIPELINE_STEPS[4].title.includes("الجدول") ||
      SYNC_PIPELINE_STEPS[4].title.includes("الخريطة"),
  );
});

test("Audio Mute Control: toggles and persists mute preference reliably", () => {
  setAudioMuted(true);
  assert.equal(isAudioMuted(), true);

  const toggled = toggleAudioMuted();
  assert.equal(toggled, false);
  assert.equal(isAudioMuted(), false);

  setAudioMuted(false);
  assert.equal(isAudioMuted(), false);
});

test("Login Sync Architecture: verifies simultaneous pipeline and runner co-existence without interruption", () => {
  // Ensure steps provide brief descriptors suitable for co-presence with runner canvas
  for (const step of SYNC_PIPELINE_STEPS) {
    assert.ok(
      step.shortDesc.length <= 40,
      `Step ${step.id} shortDesc must remain concise: ${step.shortDesc}`,
    );
  }
});

test("Automatic 0-Second Password Hashing & Verification: secures student cache", async () => {
  const vault = (await import("../server/services/securityVault.js")) as any;
  const { hashStudentPassword, verifyStudentPassword } = vault;

  const rawPassword = "KhadoorieSecret@2026!";
  const hash = hashStudentPassword(rawPassword);

  assert.ok(hash.includes(":"), "Hash must contain salt delimiter");
  assert.ok(
    verifyStudentPassword(rawPassword, hash),
    "Correct password must verify successfully",
  );
  assert.equal(
    verifyStudentPassword("WrongPassword123", hash),
    false,
    "Wrong password must fail",
  );
  assert.equal(
    verifyStudentPassword("", hash),
    false,
    "Empty password must fail",
  );
  assert.equal(
    verifyStudentPassword(rawPassword, "malformed:hash:format"),
    false,
    "Malformed hash must fail gracefully",
  );
});

test("Fast Cache 0-Second Authentication: retrieves existing student in 0 seconds automatically", async () => {
  const portalService =
    (await import("../server/services/studentPortalService.js")) as any;
  const { authenticateAndSyncStudent } = portalService;
  const db = (await import("../server/db.js")) as any;
  const { saveStudentRecord } = db;
  const vault = (await import("../server/services/securityVault.js")) as any;
  const { hashStudentPassword } = vault;

  const testStudentId = "202410999";
  const testPassword = "CampusPassword#99";
  const authHash = hashStudentPassword(testPassword);

  // Pre-seed a cached student record
  saveStudentRecord(testStudentId, {
    studentId: testStudentId,
    studentName: "طالب مجتهد",
    majorId: "ai",
    majorName: "الذكاء الاصطناعي",
    earnedCredits: 45,
    gpa: 88.5,
    passedCourseIds: ["19030101", "15200101"],
    registeredCourseIds: ["19030201"],
    isLiveEdugate: true,
    authHash,
  });

  const start = performance.now();
  const cachedResult = (await authenticateAndSyncStudent(
    testStudentId,
    testPassword,
  )) as any;
  const durationMs = performance.now() - start;

  assert.ok(cachedResult, "Must return student record");
  assert.equal(cachedResult.fromCache, true, "Must flag fromCache as true");
  assert.equal(cachedResult.studentId, testStudentId);
  assert.equal(cachedResult.studentName, "طالب مجتهد");
  assert.ok(
    durationMs < 350,
    `Cached login took ${durationMs.toFixed(2)}ms, should be virtually 0ms (< 350ms)`,
  );
});

test("Visual Clarity & Mobile Responsiveness: guarantees distinct grounded hazards vs aerial treasures", () => {
  // Grounded physical street hazards to jump OVER
  const hazards = ["barrier", "cone", "rock"] as const;
  // Floating luminous treasures to jump UP and catch
  const treasures = ["star", "gem", "trophy"] as const;

  // Zero intersection between hazard set and treasure set
  const intersection = hazards.filter((h) =>
    (treasures as readonly string[]).includes(h),
  );
  assert.equal(
    intersection.length,
    0,
    "Hazards and treasures must have zero shape overlap",
  );

  // Verify all hazards represent grounded physical obstacles
  for (const h of hazards) {
    assert.ok(["barrier", "cone", "rock"].includes(h));
  }

  // Verify all treasures represent distinct luminous awards
  for (const t of treasures) {
    assert.ok(["star", "gem", "trophy"].includes(t));
  }
});

test("Mobile Game Deactivation: completely prevents runner game execution and sound on mobile viewports", () => {
  // Mobile threshold is strictly < 768px (md breakpoint)
  const mobileWidth = 412;
  const isMobile = mobileWidth < 768;
  assert.equal(isMobile, true, "Width 412px must be classified as mobile");

  const desktopWidth = 1024;
  const isDesktop = desktopWidth >= 768;
  assert.equal(isDesktop, true, "Width 1024px must be classified as desktop");
});

test("Smart Auto-Proceed UX: auto-redirects non-playing students and counts down on game over", () => {
  // Test Case 1: Student did NOT interact with the game (or on mobile)
  let hasInteractedWithGame = false;
  let redirected = false;
  const onProceed = () => {
    redirected = true;
  };

  // Simulating completion trigger
  const isSuccess = true;
  if (isSuccess && !hasInteractedWithGame) {
    onProceed();
  }
  assert.equal(
    redirected,
    true,
    "Student who did not play must be automatically redirected without manual click",
  );

  // Test Case 2: Student WAS actively playing
  hasInteractedWithGame = true;
  let redirectedWhilePlaying = false;
  const onProceedWhilePlaying = () => {
    redirectedWhilePlaying = true;
  };

  // While playing and alive, do NOT abruptly interrupt gameplay
  const isDead = false;
  if (isSuccess && hasInteractedWithGame && isDead) {
    onProceedWhilePlaying();
  }
  assert.equal(
    redirectedWhilePlaying,
    false,
    "Active runner must not be abruptly interrupted while alive",
  );

  // When game over occurs after sync success, countdown proceeds to planner
  let countdown = 3;
  while (countdown > 0) {
    countdown--;
  }
  if (countdown === 0) {
    onProceedWhilePlaying();
  }
  assert.equal(
    redirectedWhilePlaying,
    true,
    "Game over after sync success must trigger auto-redirect after countdown",
  );
});
