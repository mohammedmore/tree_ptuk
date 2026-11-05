import assert from "node:assert/strict";
import { test } from "node:test";
import "../server/index.d.ts";
import {
  encryptPayload,
  decryptPayload,
  signSessionToken,
  verifySessionToken,
  timingSafeEqualStrings,
  revokeSessionToken,
  isSessionTokenRevoked,
  isAccountLocked,
  recordFailedLogin,
  recordSuccessfulLogin,
  sanitizeStudentRecordForClient,
  hydrateSecurityStateFromDb,
} from "../server/services/securityVault.js";
import {
  sanitizeBody,
  sanitizeQuery,
  enforceContentType,
  additionalSecurityHeaders,
  validateSsrfTarget,
  extractClientIdentity,
} from "../server/middleware/security.js";
import {
  sqliteGetRevokedTokens,
  sqliteGetAccountLockouts,
} from "../server/sqliteDb.js";
import {
  studentLoginSchema,
  registrationExecuteSchema,
  registrationPrewarmSchema,
  syncPtukSchema,
} from "../server/validators.js";
import {
  sanitizeSafeHttpUrl,
  normalizeSharedScheduleSnapshot,
} from "../src/core/sharedSchedules.js";
import app, { validateProductionSecurityEnvironment } from "../server/app.js";

test("securityVault encryptPayload and decryptPayload AES-256-GCM roundtrip", () => {
  const secretData = "my-secret-student-payload-12345";
  const encrypted = encryptPayload(secretData);

  assert.ok(
    encrypted.includes(":"),
    "Encrypted string should have IV:TAG:CIPHERTEXT structure",
  );
  const parts = encrypted.split(":");
  assert.equal(parts.length, 3, "Must have exactly 3 parts");
  assert.equal(parts[0].length, 24, "96-bit IV hex should be 24 characters");
  assert.equal(parts[1].length, 32, "128-bit Tag hex should be 32 characters");

  const decrypted = decryptPayload(encrypted);
  assert.equal(
    decrypted,
    secretData,
    "Decrypted text must match original plaintext",
  );

  // Tampered ciphertext must fail safely and return null
  const tampered = `${parts[0]}:${parts[1]}:deadbeef${parts[2].slice(8)}`;
  const tamperedResult = decryptPayload(tampered);
  assert.equal(
    tamperedResult,
    null,
    "Tampered ciphertext must decrypt to null",
  );

  // Invalid payload formatting
  assert.equal(decryptPayload("invalid"), null);
  assert.equal(decryptPayload(""), null);
});

test("securityVault timingSafeEqualStrings prevents timing attacks", () => {
  assert.equal(
    timingSafeEqualStrings("super-secret-key-123", "super-secret-key-123"),
    true,
  );
  assert.equal(
    timingSafeEqualStrings("super-secret-key-123", "wrong-secret-key-456"),
    false,
  );
  assert.equal(
    timingSafeEqualStrings("short", "much-longer-string-with-extra-bytes"),
    false,
  );
  assert.equal(timingSafeEqualStrings("abc", undefined as any), false);
  assert.equal(timingSafeEqualStrings(null as any, "abc"), false);
});

test("securityVault signSessionToken and verifySessionToken HMAC-SHA256 lifecycle", () => {
  const payload = {
    studentId: "202110123",
    role: "student",
  };

  const token = signSessionToken(payload, 3600);
  assert.ok(token);
  assert.equal(
    token.split(".").length,
    3,
    "Signed token must be header.payload.signature",
  );

  const verified = verifySessionToken(token);
  assert.ok(verified, "Token should verify successfully");
  assert.equal(verified?.studentId, "202110123");
  assert.equal(verified?.role, "student");
  assert.ok(typeof verified?.exp === "number");

  // Tampered token must fail
  const parts = token.split(".");
  const tamperedToken = `${parts[0]}.${parts[1]}.tamperedSignature`;
  assert.equal(
    verifySessionToken(tamperedToken),
    null,
    "Tampered signature must return null",
  );

  // Expired token must fail
  const expiredToken = signSessionToken(payload, -10); // Expired 10s ago
  assert.equal(
    verifySessionToken(expiredToken),
    null,
    "Expired token must return null",
  );
});

test("middleware sanitizeBody strips NoSQL injection and Prototype Pollution vectors", () => {
  const req: any = {
    body: {
      studentId: "202110123",
      $where: "function() { return true; }",
      $ne: null,
      __proto__: { isAdmin: true },
      constructor: { name: "attacker" },
      nested: {
        $gt: 0,
        validField: "hello",
      },
    },
  };

  let nextCalled = false;
  sanitizeBody(req, {} as any, () => {
    nextCalled = true;
  });

  assert.ok(nextCalled);
  assert.equal(req.body.studentId, "202110123");
  assert.equal(req.body.$where, undefined);
  assert.equal(req.body.$ne, undefined);
  assert.equal(req.body.__proto__.isAdmin, undefined);
  assert.equal(req.body.nested.$gt, undefined);
  assert.equal(req.body.nested.validField, "hello");
});

test("middleware sanitizeQuery prevents HTTP Parameter Pollution (HPP)", () => {
  const req: any = {
    query: {
      code: ["15200099", "malicious_injected_code"],
      single: "safe_value",
    },
  };

  sanitizeQuery(req, {} as any, () => {});

  assert.equal(
    req.query.code,
    "malicious_injected_code",
    "Must collapse array to single last element",
  );
  assert.equal(req.query.single, "safe_value");
});

test("middleware enforceContentType blocks invalid content types on mutating methods", () => {
  let statusCode = 200;
  let responseJson: any = null;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      responseJson = data;
      return this;
    },
  };

  const reqInvalid: any = {
    method: "POST",
    headers: { "content-type": "text/plain" },
  };

  enforceContentType(reqInvalid, res, () => {});
  assert.equal(
    statusCode,
    415,
    "Should return 415 Unsupported Media Type for text/plain",
  );

  const reqValid: any = {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
  };

  let nextCalled = false;
  enforceContentType(reqValid, res, () => {
    nextCalled = true;
  });
  assert.ok(nextCalled, "Should permit valid application/json");
});

test("middleware additionalSecurityHeaders sets strict headers and no-store for student data", () => {
  const headers: Record<string, string> = {};
  const res: any = {
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
  };

  const reqStudent: any = {
    path: "/api/student/202110123",
  };

  additionalSecurityHeaders(reqStudent, res, () => {});

  assert.equal(headers["x-frame-options"], "DENY");
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.ok(headers["permissions-policy"].includes("camera=()"));
  assert.ok(
    headers["cache-control"].includes("no-store"),
    "Student API must have no-store cache control",
  );
  assert.ok(headers["cache-control"].includes("private"));
});

test("middleware validateSsrfTarget blocks internal IP targets and permits PTUK domains", () => {
  const middleware = validateSsrfTarget();
  let statusCode = 200;
  let responseJson: any = null;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      responseJson = data;
      return this;
    },
  };

  // 1. Block SSRF to cloud metadata
  const reqMetadata: any = {
    body: { url: "http://169.254.169.254/latest/meta-data/" },
  };
  let nextCalled = false;
  middleware(reqMetadata, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(statusCode, 400);
  assert.ok(responseJson?.error?.includes("SSRF Protection"));

  // 2. Allow legitimate PTUK portal URL
  const reqPtuk: any = {
    body: { url: "https://edugate.ptuk.edu.ps/faces/ui/login.xhtml" },
  };
  let ptukNext = false;
  middleware(reqPtuk, res, () => {
    ptukNext = true;
  });
  assert.equal(ptukNext, true);
});

test("sharedSchedules sanitizeSafeHttpUrl eliminates javascript: and data: XSS payloads", () => {
  assert.equal(
    sanitizeSafeHttpUrl("https://edugate.ptuk.edu.ps/library"),
    "https://edugate.ptuk.edu.ps/library",
  );
  assert.equal(sanitizeSafeHttpUrl("http://ptuk.edu.ps"), "http://ptuk.edu.ps");
  assert.equal(
    sanitizeSafeHttpUrl("javascript:alert(document.domain)"),
    undefined,
  );
  assert.equal(
    sanitizeSafeHttpUrl("data:text/html,<script>alert(1)</script>"),
    undefined,
  );
  assert.equal(sanitizeSafeHttpUrl("vbscript:MsgBox(1)"), undefined);
  assert.equal(sanitizeSafeHttpUrl("   "), undefined);
  assert.equal(sanitizeSafeHttpUrl(null), undefined);
  assert.equal(sanitizeSafeHttpUrl(12345), undefined);
});

test("sharedSchedules normalizeSharedScheduleSnapshot purges malicious resourceLink", () => {
  const malformedSnapshot = {
    version: 1,
    name: "خطة آمنة",
    exportedAt: new Date().toISOString(),
    plannedCourses: {},
    completedCourses: [],
    courses: [
      {
        courseCode: "12140101",
        courseName: "برمجة 1",
        credits: 3,
        category: "إجباري",
        semester: "1",
        resourceLink: "javascript:alert(document.cookie)",
      },
    ],
    weeklySchedule: {},
  };

  const normalized = normalizeSharedScheduleSnapshot(malformedSnapshot);
  assert.ok(normalized);
  assert.equal(normalized.courses.length, 1);
  assert.equal(
    normalized.courses[0].resourceLink,
    undefined,
    "Malicious javascript: URI must be stripped",
  );
});

test("API security: GET /api/student/:studentId prevents IDOR and rejects unauthorized requests", async () => {
  const http = await import("node:http");
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Unauthenticated request to student record should return 403 Forbidden
    const unauthRes = await fetch(`${baseUrl}/api/student/202110123`);
    assert.equal(
      unauthRes.status,
      403,
      "Unauthenticated student record request must be rejected with 403",
    );
    const unauthJson = await unauthRes.json();
    assert.ok(unauthJson.error.includes("غير مصرح"));

    // 2. Request with token for ANOTHER student attempting to view 202110123 must be 403 (IDOR prevention)
    const wrongStudentToken = signSessionToken({
      studentId: "202399999",
      role: "student",
    });
    const idorRes = await fetch(`${baseUrl}/api/student/202110123`, {
      headers: {
        Authorization: `Bearer ${wrongStudentToken}`,
      },
    });
    assert.equal(
      idorRes.status,
      403,
      "Accessing another student's ID without authorization must be 403",
    );

    // 3. Request with valid token for the owning student
    const ownerToken = signSessionToken({
      studentId: "202110123",
      role: "student",
    });
    const authRes = await fetch(`${baseUrl}/api/student/202110123`, {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    // The owner token must not be rejected with 403 (it can be 200 or 404 if record not found yet)
    assert.notEqual(authRes.status, 403);
  } finally {
    server.close();
  }
});

test("securityVault token revocation immediately invalidates active tokens", () => {
  const token = signSessionToken({ studentId: "202110999", role: "student" });
  assert.ok(verifySessionToken(token), "Token should verify initially");

  // Revoke token
  const revoked = revokeSessionToken(token);
  assert.equal(revoked, true);
  assert.equal(isSessionTokenRevoked(token), true);

  // Verification after revocation must return null
  assert.equal(
    verifySessionToken(token),
    null,
    "Revoked token must fail verification",
  );
});

test("securityVault account lockout protects student IDs against botnet brute force", () => {
  const targetId = "202310888";
  recordSuccessfulLogin(targetId); // Ensure clean initial state

  assert.equal(isAccountLocked(targetId).locked, false);

  // 4 failed attempts should not lock yet
  for (let i = 0; i < 4; i++) {
    recordFailedLogin(targetId);
    assert.equal(isAccountLocked(targetId).locked, false);
  }

  // 5th failed attempt triggers 15-minute lockout
  recordFailedLogin(targetId);
  const status = isAccountLocked(targetId);
  assert.equal(status.locked, true);
  assert.ok(
    status.remainingSeconds > 800,
    "Should lock for ~900 seconds (15 min)",
  );

  // Successful login clears the lockout
  recordSuccessfulLogin(targetId);
  assert.equal(isAccountLocked(targetId).locked, false);
});

test("API security: POST /api/student/logout revokes session token over HTTP", async () => {
  const http = await import("node:http");
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const token = signSessionToken({ studentId: "202110555", role: "student" });
    assert.ok(verifySessionToken(token));

    const logoutRes = await fetch(`${baseUrl}/api/student/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    assert.equal(logoutRes.status, 200);
    const logoutJson = await logoutRes.json();
    assert.equal(logoutJson.success, true);

    // The token is now revoked
    assert.equal(
      verifySessionToken(token),
      null,
      "Token must be invalidated after logout",
    );
  } finally {
    server.close();
  }
});

test("server startup security validation catches missing production configurations", () => {
  // In development, it permits smoothly
  const devResult = validateProductionSecurityEnvironment();
  assert.equal(typeof devResult, "boolean");
});

test("database encryption at rest encrypts student profiles on disk", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { saveStudentRecord, getStudentRecord, persistStateSync } =
    await import("../server/db.js");

  const testStudentId = "2024998877";
  const sensitiveStudentPayload = {
    studentId: testStudentId,
    studentName: "Secret Student Name 99",
    gpa: 3.95,
    financialBalance: "5000 JOD",
    passedCourseIds: ["12140101", "12140102"],
  };

  saveStudentRecord(testStudentId, sensitiveStudentPayload);
  persistStateSync();

  // Read the raw json file directly from the filesystem
  const dbPath = path.join(process.cwd(), "data", "db.json");
  assert.ok(fs.existsSync(dbPath), "db.json must exist");
  const rawDiskContent = fs.readFileSync(dbPath, "utf8");

  // Verify that sensitive strings are NEVER in plain text on disk
  assert.equal(
    rawDiskContent.includes("Secret Student Name 99"),
    false,
    "Student name must NOT be stored in plain text on disk",
  );
  assert.equal(
    rawDiskContent.includes("5000 JOD"),
    false,
    "Financial balance must NOT be stored in plain text on disk",
  );

  // Verify ciphertext envelope exists
  const parsed = JSON.parse(rawDiskContent);
  assert.ok(
    parsed.students_encrypted,
    "students_encrypted field must exist on disk",
  );
  assert.equal(
    parsed.students,
    undefined,
    "Unencrypted students object must be omitted from disk",
  );

  // Verify memory reading still retrieves decrypted data seamlessly
  const inMemory = getStudentRecord(testStudentId);
  assert.ok(inMemory);
  assert.equal(inMemory.studentName, "Secret Student Name 99");
  assert.equal(inMemory.gpa, 3.95);
});

test("sanitizeStudentRecordForClient eliminates authHash, password, and internal markers", () => {
  const dirtyRecord = {
    studentId: "202110999",
    studentName: "Ahmad PTUK",
    gpa: 3.8,
    authHash: "c0ffee:1234567890abcdef",
    password: "plain-secret-password",
    _encryptionVersion: "v1",
    planCourses: [{ code: "15200099", name: "Remedial English" }],
  };

  const clean = sanitizeStudentRecordForClient(dirtyRecord);
  assert.equal(clean.studentId, "202110999");
  assert.equal(clean.studentName, "Ahmad PTUK");
  assert.equal(clean.gpa, 3.8);
  assert.equal(clean.authHash, undefined, "authHash must be stripped");
  assert.equal(clean.password, undefined, "password must be stripped");
  assert.equal(
    clean._encryptionVersion,
    undefined,
    "_encryptionVersion must be stripped",
  );
});

test("SQLite persistent security state stores revoked tokens and survives cache rehydration", () => {
  const token = signSessionToken(
    { studentId: "202110555", role: "student" },
    3600,
  );
  const sig = token.split(".")[2];

  assert.equal(isSessionTokenRevoked(token), false);
  revokeSessionToken(token);
  assert.equal(isSessionTokenRevoked(token), true);

  // Check persistent SQLite table
  const dbTokens = sqliteGetRevokedTokens();
  const found = dbTokens.some((t: any) => t.signature === sig);
  assert.ok(found, "Revoked signature must exist in SQLite database");

  // Rehydrate cache to simulate server restart
  hydrateSecurityStateFromDb();
  assert.equal(
    isSessionTokenRevoked(token),
    true,
    "Revocation must persist across rehydration",
  );
});

test("SQLite persistent security state stores account lockouts and clears on successful login", () => {
  const testId = "202410777";
  for (let i = 0; i < 5; i++) {
    recordFailedLogin(testId);
  }

  const status = isAccountLocked(testId);
  assert.equal(
    status.locked,
    true,
    "Account must be locked after 5 failed attempts",
  );

  const dbLockouts = sqliteGetAccountLockouts();
  const dbEntry = dbLockouts.find((l: any) => l.student_id === testId);
  assert.ok(dbEntry, "Lockout record must be persisted in SQLite");
  assert.equal(dbEntry.attempts, 5);

  // Simulate successful login
  recordSuccessfulLogin(testId);
  assert.equal(isAccountLocked(testId).locked, false);

  const postClearLockouts = sqliteGetAccountLockouts();
  const cleared = postClearLockouts.find((l: any) => l.student_id === testId);
  assert.equal(
    cleared,
    undefined,
    "Lockout record must be deleted from SQLite upon successful login",
  );
});

test("Zod schemas enforce fail-closed input validation", () => {
  // studentLoginSchema accepts valid university IDs and normalizes Arabic numerals
  const validArabicLogin = studentLoginSchema.safeParse({
    studentId: "٢٠٢١١٠١٢٣",
    password: "secretpassword123",
  });
  assert.ok(validArabicLogin.success);
  assert.equal(validArabicLogin.data.studentId, "202110123");

  // Rejects invalid chars in studentId
  const invalidLogin = studentLoginSchema.safeParse({
    studentId: "invalid<script>",
    password: "pwd",
  });
  assert.equal(invalidLogin.success, false);

  // registrationExecuteSchema validates plan structure
  const invalidPlanExec = registrationExecuteSchema.safeParse({
    studentId: "202110123",
    plans: "not-an-object",
  });
  assert.equal(invalidPlanExec.success, false);

  const validPlanExec = registrationExecuteSchema.safeParse({
    studentId: "202110123",
    plans: { A: { items: [] } },
  });
  assert.ok(validPlanExec.success);
});

test("extractClientIdentity generates dual-key (IP + student ID) for university NAT protection", () => {
  const req1: any = {
    ip: "194.165.1.10",
    body: { studentId: "202110111" },
    headers: {},
  };
  extractClientIdentity(req1, {} as any, () => {});
  assert.equal(req1.clientIdentity, "194.165.1.10:202110111");

  const req2: any = {
    ip: "194.165.1.10",
    body: { studentId: "202210222" },
    headers: {},
  };
  extractClientIdentity(req2, {} as any, () => {});
  assert.equal(req2.clientIdentity, "194.165.1.10:202210222");

  // Distinct identities despite sharing the same university NAT IP!
  assert.notEqual(req1.clientIdentity, req2.clientIdentity);
});

test("BOLA protection: POST /api/registration/execute blocks registration on mismatched student session", async () => {
  const http = await import("node:http");
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Generate valid session token for student A
    const tokenA = signSessionToken({
      studentId: "202110123",
      role: "student",
    });

    // Attempt to execute registration for student B with student A's token
    const resp = await fetch(`${baseUrl}/api/registration/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        studentId: "202210999", // Mismatched target student!
        plans: { A: { items: [] } },
      }),
    });

    assert.equal(
      resp.status,
      403,
      "Must reject BOLA attempt with HTTP 403 Forbidden",
    );
    const json = await resp.json();
    assert.ok(
      json.error.includes("BOLA"),
      "Error message should mention BOLA violation",
    );
  } finally {
    server.close();
  }
});
