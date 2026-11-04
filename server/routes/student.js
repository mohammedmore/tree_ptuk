import express from "express";
import { authenticateAndSyncStudent } from "../services/studentPortalService.js";
import { getStudentRecord } from "../db.js";
import { authLimiter } from "../middleware/rateLimiters.js";
import { authenticateStudentSession } from "../middleware/security.js";
import {
  signSessionToken,
  timingSafeEqualStrings,
  isAccountLocked,
  recordFailedLogin,
  recordSuccessfulLogin,
  revokeSessionToken,
} from "../services/securityVault.js";

const router = express.Router();

/**
 * POST /api/student/sync
 * Authenticate student with University ID and Password, then synchronize plan and schedule.
 * Returns a cryptographically signed session token bound to the student ID.
 * Protected by auth rate limiter and account lockout protection.
 */
router.post("/sync", authLimiter, async (req, res) => {
  try {
    const { studentId, password, demoMode, forceLive } = req.body;

    // ─── Input Validation ───────────────────────────────────────────
    if (!studentId || typeof studentId !== "string") {
      return res.status(400).json({ error: "الرقم الجامعي مطلوب." });
    }

    const trimmedId = studentId
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .trim();

    // Validate studentId format: alphanumeric, underscore, dot, dash, at-sign
    if (!/^[a-zA-Z0-9._\-@]{3,40}$/.test(trimmedId)) {
      return res
        .status(400)
        .json({ error: "صيغة اسم المستخدم أو الرقم الجامعي غير صالحة." });
    }

    // ─── Account-Based Velocity Check (Brute-Force & Botnet Shield) ─
    const lockStatus = isAccountLocked(trimmedId);
    if (lockStatus.locked) {
      return res.status(429).json({
        error: `تم قفل الحساب مؤقتاً لحمايته بسبب تكرار محاولات الدخول الخاطئة. يرجى المحاولة بعد ${lockStatus.remainingSeconds} ثانية.`,
        locked: true,
        remainingSeconds: lockStatus.remainingSeconds,
      });
    }

    // Validate password length if provided
    if (password !== undefined && password !== null) {
      if (typeof password !== "string" || password.length > 128) {
        return res
          .status(400)
          .json({ error: "كلمة المرور غير صالحة أو طويلة جداً." });
      }
    }

    const studentRecord = await authenticateAndSyncStudent(
      trimmedId,
      password,
      {
        demoMode: Boolean(demoMode),
        forceLive: Boolean(forceLive),
      },
    );

    // Reset failed counter on successful authentication
    recordSuccessfulLogin(trimmedId);

    // Issue tamper-proof signed session token (7-day validity)
    const token = signSessionToken(
      {
        studentId: trimmedId,
        actualStudentId: studentRecord.studentId || trimmedId,
        cohortYear: studentRecord.cohortYear,
        role: "student",
      },
      7 * 24 * 3600,
    );

    // Sanitize sensitive credentials/hashes before sending to client
    const clientSafeData = { ...studentRecord };
    delete clientSafeData.authHash;

    return res.json({
      success: true,
      message: studentRecord.fromCache
        ? "تم استرجاع السجل الأكاديمي فورياً من الذاكرة السريعة."
        : "تمت مزامنة بيانات الطالب بنجاح.",
      token,
      data: clientSafeData,
    });
  } catch (err) {
    const rawStudentId = req.body?.studentId;
    const msg = err.message || "";
    const isAuthError =
      msg.includes("بيانات الدخول") ||
      msg.includes("كلمة المرور") ||
      msg.includes("اسم المستخدم") ||
      msg.includes("الرقم الجامعي");

    if (isAuthError && rawStudentId) {
      recordFailedLogin(String(rawStudentId).trim());
    }

    console.error("Student sync error:", msg || "Failed sync");
    const status = isAuthError
      ? 401
      : msg.includes("Edugate") || msg.includes("بوابة")
        ? 502
        : 500;

    return res.status(status).json({
      success: false,
      error: msg || "فشلت عملية مزامنة بيانات الطالب.",
    });
  }
});

/**
 * POST /api/student/logout
 * Revokes the session token and invalidates it immediately across all servers.
 */
router.post("/logout", (req, res) => {
  const authHeader =
    req.headers["authorization"] || req.headers["x-auth-token"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (token) {
    revokeSessionToken(token);
  }

  return res.json({
    success: true,
    message: "تم تسجيل الخروج وإلغاء صلاحية الجلسة بنجاح.",
  });
});

/**
 * GET /api/student/:studentId
 * Get cached student record.
 * Protected against IDOR:
 * Only allows access if:
 * 1) Request includes a valid student session token for this studentId.
 * 2) OR request includes a valid admin/secret key.
 * Unauthorized requests cannot view personal courses, grades, or transcripts.
 */
router.get("/:studentId", authenticateStudentSession, (req, res) => {
  try {
    const { studentId } = req.params;

    // ─── Input Validation ───────────────────────────────────────────
    if (
      !studentId ||
      typeof studentId !== "string" ||
      !/^[a-zA-Z0-9._\-@]{3,40}$/.test(studentId.trim())
    ) {
      return res.status(400).json({ error: "معرف طالب غير صالح." });
    }

    const normId = studentId.trim();

    // ─── Authorization Check (Checked Before DB Lookup to Prevent ID Enumeration) ─
    const authHeader =
      req.headers["authorization"] || req.headers["x-auth-token"] || "";
    const rawProvidedKey = authHeader.replace(/^Bearer\s+/i, "").trim();

    // Check if authorized via Admin Secret
    const expectedSecret =
      process.env.STUDENT_AUTH_SECRET || process.env.SYNC_API_KEY;
    const isAdmin = Boolean(
      expectedSecret &&
      rawProvidedKey &&
      timingSafeEqualStrings(rawProvidedKey, expectedSecret),
    );

    // Check if authorized via Student Session Token
    const session = req.studentSession;
    const isOwnerStudent = Boolean(
      session &&
      (session.studentId === normId || session.actualStudentId === normId),
    );

    if (!isAdmin && !isOwnerStudent) {
      return res.status(403).json({
        error: "غير مصرح. يجب تسجيل الدخول للوصول إلى هذا السجل الأكاديمي.",
      });
    }

    const record = getStudentRecord(normId);

    if (!record) {
      return res
        .status(404)
        .json({ error: "لم يتم العثور على سجل مسبق للطالب." });
    }

    return res.json({ success: true, data: record });
  } catch (err) {
    console.error("Get student record error:", err.message || err);
    return res.status(500).json({ error: "فشل في قراءة بيانات الطالب." });
  }
});

export default router;
