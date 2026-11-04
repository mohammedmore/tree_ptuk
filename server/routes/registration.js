import express from "express";
import {
  prewarmSession,
  executeRegistrationBatch,
  testRegistrationRequest,
  checkOnlineRegistrationStatus,
} from "../services/registrationEngine.js";
import { getCourses } from "../db.js";

const router = express.Router();

function sanitizeStudentId(id) {
  if (!id || typeof id !== "string") return null;
  const cleaned = id
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .trim();
  if (!/^[a-zA-Z0-9._\-@]{3,40}$/.test(cleaned)) return null;
  return cleaned;
}

function sanitizePassword(password) {
  if (password === undefined || password === null) return undefined;
  if (typeof password !== "string" || password.length > 128) return null;
  return password;
}

/**
 * POST /api/registration/prewarm
 * Warm up session cookies and check university registration gateway latency.
 */
router.post("/prewarm", async (req, res) => {
  try {
    const { studentId, password, demoMode } = req.body;
    const cleanId = sanitizeStudentId(studentId);
    if (!cleanId) {
      return res.status(400).json({ error: "الرقم الجامعي غير صالح." });
    }

    const cleanPass = sanitizePassword(password);
    if (cleanPass === null) {
      return res
        .status(400)
        .json({ error: "كلمة المرور غير صالحة أو طويلة جداً." });
    }

    const result = await prewarmSession({
      studentId: cleanId,
      password: cleanPass,
      demoMode: Boolean(demoMode),
    });
    return res.json(result);
  } catch (err) {
    console.error("Prewarm session error:", err.message || err);
    return res.status(500).json({
      success: false,
      error: "فشل فحص جاهزية بوابة التسجيل.",
      message: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }
});

/**
 * POST /api/registration/portal-status
 * Inspects real-time availability of https://edugate.ptuk.edu.ps/student/onlineRegistration
 */
router.post("/portal-status", async (req, res) => {
  try {
    const { studentId, password } = req.body;
    const cleanId = sanitizeStudentId(studentId);
    if (!cleanId) {
      return res.status(400).json({ error: "الرقم الجامعي غير صالح." });
    }
    const cleanPass = sanitizePassword(password);
    if (!cleanPass) {
      return res
        .status(400)
        .json({ error: "كلمة المرور مطلوبة للتحقق من حالة البوابة." });
    }

    const result = await checkOnlineRegistrationStatus(cleanId, cleanPass);
    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Portal status check error:", err.message || err);
    return res.status(500).json({
      success: false,
      error: err.message || "فشل التحقق من حالة بوابة التسجيل.",
    });
  }
});

// Idempotency store to prevent duplicate submissions
const idempotencyStore = new Map();
const IDEMPOTENCY_TTL_MS = 2 * 60 * 1000;

function cleanupIdempotencyStore() {
  const now = Date.now();
  for (const [key, val] of idempotencyStore.entries()) {
    if (now - val.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  }
}

/**
 * POST /api/registration/execute
 * Execute prioritized fast registration batch with automatic plan cascading (A -> B -> C).
 */
router.post("/execute", async (req, res) => {
  try {
    const {
      studentId,
      password,
      plans,
      options = {},
      idempotencyKey: bodyKey,
    } = req.body;
    const idempotencyKey = req.headers["x-idempotency-key"] || bodyKey;

    const cleanId = sanitizeStudentId(studentId);
    if (!cleanId) {
      return res.status(400).json({ error: "الرقم الجامعي غير صالح." });
    }

    const cleanPass = sanitizePassword(password);
    if (cleanPass === null) {
      return res
        .status(400)
        .json({ error: "كلمة المرور غير صالحة أو طويلة جداً." });
    }

    if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
      const cached = idempotencyStore.get(idempotencyKey);
      if (Date.now() - cached.timestamp < IDEMPOTENCY_TTL_MS) {
        return res.json({
          success: true,
          data: cached.data,
          idempotentReplay: true,
        });
      }
    }

    if (!plans || typeof plans !== "object" || Array.isArray(plans)) {
      return res
        .status(400)
        .json({ error: "الخطط الثلاث (أ، ب، ج) مطلوبة لإتمام التسجيل." });
    }

    const summary = await executeRegistrationBatch({
      studentId: cleanId,
      password: cleanPass,
      plans,
      options,
    });

    if (idempotencyKey) {
      cleanupIdempotencyStore();
      idempotencyStore.set(idempotencyKey, {
        timestamp: Date.now(),
        data: summary,
      });
    }

    return res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    console.error("Registration batch execution error:", err.message || err);
    return res.status(500).json({
      success: false,
      error: "حدث خطأ أثناء معالجة طلب التسجيل.",
      message: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }
});

/**
 * POST /api/registration/test-request
 * Dry run test to inspect the exact HTTP request payload sent to the university portal
 * and verify for any errors (authentication, closed window, invalid section, network timeout).
 */
router.post("/test-request", async (req, res) => {
  try {
    const { studentId, password, plan, demoMode, semester } = req.body;
    const cleanId = sanitizeStudentId(studentId);
    if (!cleanId) {
      return res.status(400).json({ error: "الرقم الجامعي غير صالح." });
    }

    const cleanPass = sanitizePassword(password);
    if (cleanPass === null) {
      return res
        .status(400)
        .json({ error: "كلمة المرور غير صالحة أو طويلة جداً." });
    }

    const result = await testRegistrationRequest({
      studentId: cleanId,
      password: cleanPass,
      plan: plan || {},
      demoMode: Boolean(demoMode),
      semester: semester || "20241",
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Test registration request error:", err.message || err);
    return res.status(500).json({
      success: false,
      error: "فشل التحقق من الطلب التجريبي.",
      message: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }
});

/**
 * POST /api/registration/check-seats
 * Quickly check seats availability for specified sections.
 */
router.post("/check-seats", async (req, res) => {
  try {
    const { courseCodes } = req.body;
    if (!Array.isArray(courseCodes) || courseCodes.length === 0) {
      return res.json({ courses: [] });
    }

    const safeCodes = courseCodes
      .slice(0, 100)
      .map((c) => String(c).trim())
      .filter((c) => /^[a-zA-Z0-9_\-]{2,20}$/.test(c));

    const courses = await getCourses({ codes: safeCodes });
    const formatted = courses.map((c) => ({
      code: c.code,
      name: c.name,
      sections: (c.sections || []).map((s) => ({
        sec: s.sec,
        capacity: s.capacity || 40,
        registered: s.registered || 0,
        available: Math.max(0, (s.capacity || 40) - (s.registered || 0)),
        isFull: (s.registered || 0) >= (s.capacity || 40),
      })),
    }));

    return res.json({ courses: formatted });
  } catch (err) {
    console.error("Check seats error:", err.message || err);
    return res.status(500).json({ error: "فشل التحقق من سعة الشعب." });
  }
});

export default router;
