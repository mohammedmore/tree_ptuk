import express from "express";
import {
  prewarmSession,
  executeRegistrationBatch,
  testRegistrationRequest,
  checkOnlineRegistrationStatus,
} from "../services/registrationEngine.js";
import { getCourses } from "../db.js";
import { authenticateStudentSession } from "../middleware/security.js";
import {
  validateBody,
  registrationPrewarmSchema,
  registrationPortalStatusSchema,
  registrationExecuteSchema,
  registrationTestRequestSchema,
  registrationCheckSeatsSchema,
  registrationSnipeCheckSchema,
} from "../validators.js";
import { snipeAndRegister } from "../services/seatSniperService.js";

const router = express.Router();

// Idempotency store with automatic background pruning to prevent memory leak
const idempotencyStore = new Map();
const IDEMPOTENCY_TTL_MS = 2 * 60 * 1000;

const idempotencyPruneTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of idempotencyStore.entries()) {
    if (now - val.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  }
}, 60 * 1000);
if (idempotencyPruneTimer.unref) idempotencyPruneTimer.unref();

function cleanupIdempotencyStore() {
  const now = Date.now();
  for (const [key, val] of idempotencyStore.entries()) {
    if (now - val.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  }
}

// Active Server-Sent Events (SSE) subscriber connections
const activeSseClients = new Set();

/**
 * Broadcasts real-time events to all connected clients (e.g. seat openings, registration results)
 */
export function broadcastRegistrationEvent(eventType, payload = {}) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of activeSseClients) {
    try {
      client.write(message);
    } catch {
      activeSseClients.delete(client);
    }
  }
}

/**
 * Gracefully terminates all active SSE connections during server shutdown or deployment.
 */
export function closeAllSseClients() {
  for (const client of activeSseClients) {
    try {
      client.write(
        'event: shutdown\ndata: {"message":"Server gracefully closing connection"}\n\n',
      );
      client.end();
    } catch {}
  }
  activeSseClients.clear();
}

/**
 * GET /api/registration/stream
 * Real-time SSE channel for seat sniping, section status changes, and registration status.
 */
router.get("/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const initialPayload = {
    status: "connected",
    connectedClients: activeSseClients.size + 1,
    timestamp: new Date().toISOString(),
  };
  res.write(`event: connected\ndata: ${JSON.stringify(initialPayload)}\n\n`);

  activeSseClients.add(res);

  // Keep-alive heartbeat every 20 seconds
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(":ping\n\n");
    } catch {
      clearInterval(heartbeatTimer);
      activeSseClients.delete(res);
    }
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeatTimer);
    activeSseClients.delete(res);
  });
});

/**
 * POST /api/registration/prewarm
 * Warm up session cookies and check university registration gateway latency.
 */
router.post(
  "/prewarm",
  validateBody(registrationPrewarmSchema),
  async (req, res) => {
    try {
      const { studentId, password, demoMode } = req.body;
      const cleanId = studentId;
      const cleanPass = password || undefined;

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
        message:
          process.env.NODE_ENV === "production" ? undefined : err.message,
      });
    }
  },
);

/**
 * POST /api/registration/portal-status
 * Inspects real-time availability of https://edugate.ptuk.edu.ps/student/onlineRegistration
 */
router.post(
  "/portal-status",
  validateBody(registrationPortalStatusSchema),
  async (req, res) => {
    try {
      const { studentId, password } = req.body;
      const cleanId = studentId;
      const cleanPass = password;

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
  },
);

/**
 * POST /api/registration/execute
 * Execute prioritized fast registration batch with automatic plan cascading (A -> B -> C).
 * Protected against Broken Object Level Authorization (OWASP API1:2023 BOLA / IDOR).
 */
router.post(
  "/execute",
  authenticateStudentSession,
  validateBody(registrationExecuteSchema),
  async (req, res) => {
    try {
      const {
        studentId,
        password,
        plans,
        options = {},
        idempotencyKey: bodyKey,
      } = req.body;
      const idempotencyKey = req.headers["x-idempotency-key"] || bodyKey;

      const cleanId = studentId;
      const cleanPass = password || undefined;

      // ─── OWASP BOLA Enforcement ────────────────────────────────────
      // If client presents a student session token, ensure it matches requested studentId
      if (req.studentSession && !options.demoMode) {
        const sessionStudentId = req.studentSession.studentId;
        const actualStudentId = req.studentSession.actualStudentId;
        const isSelf =
          sessionStudentId === cleanId || actualStudentId === cleanId;
        if (!isSelf && req.studentSession.role !== "admin") {
          return res.status(403).json({
            error:
              "طلب مرفوض: غير مصرح لك بتنفيذ عملية تسجيل لطالب آخر (BOLA Violation).",
          });
        }
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
        message:
          process.env.NODE_ENV === "production" ? undefined : err.message,
      });
    }
  },
);

/**
 * POST /api/registration/test-request
 * Dry run test to inspect the exact HTTP request payload sent to the university portal.
 */
router.post(
  "/test-request",
  validateBody(registrationTestRequestSchema),
  async (req, res) => {
    try {
      const { studentId, password, plan, demoMode, semester } = req.body;
      const cleanId = studentId;
      const cleanPass = password || undefined;

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
        message:
          process.env.NODE_ENV === "production" ? undefined : err.message,
      });
    }
  },
);

/**
 * POST /api/registration/check-seats
 * Quickly check seats availability for specified sections.
 */
router.post(
  "/check-seats",
  validateBody(registrationCheckSeatsSchema),
  async (req, res) => {
    try {
      const { courseCodes = [] } = req.body;
      if (!Array.isArray(courseCodes) || courseCodes.length === 0) {
        return res.json({ courses: [] });
      }

      const courses = await getCourses({ codes: courseCodes });
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
  },
);

/**
 * POST /api/registration/snipe-check
 * Inspects target closed sections, identifies vacancies, and triggers instant registration if autoExecute is enabled.
 */
router.post(
  "/snipe-check",
  authenticateStudentSession,
  validateBody(registrationSnipeCheckSchema),
  async (req, res) => {
    try {
      const {
        studentId,
        password,
        targetSeats,
        autoExecute,
        plan,
        semester,
        demoMode,
      } = req.body;

      // Require authenticated session for sniper checks
      if (!req.studentSession && !demoMode) {
        return res.status(401).json({
          error:
            "طلب غير مصرح به: يجب تسجيل الدخول واستخدام جلسة صالحة لمراقبة المقاعد.",
        });
      }

      // OWASP BOLA Mitigation: verify that authenticated student matches payload
      if (req.studentSession && !demoMode) {
        const sessionStudentId = req.studentSession.studentId;
        const actualStudentId = req.studentSession.actualStudentId;
        const isSelf =
          sessionStudentId === studentId || actualStudentId === studentId;
        if (!isSelf && req.studentSession.role !== "admin") {
          return res.status(403).json({
            error:
              "طلب مرفوض: غير مصرح لك بمراقبة مقاعد لحساب طالب آخر (BOLA Violation).",
          });
        }
      }

      const outcome = await snipeAndRegister({
        studentId,
        password,
        targetSeats,
        autoExecute: Boolean(autoExecute),
        plan,
        semester: semester || "20241",
        demoMode: Boolean(demoMode),
      });

      if (
        outcome &&
        (outcome.openedCount > 0 || outcome.registrationAttempted)
      ) {
        broadcastRegistrationEvent("seat_update", {
          studentId: req.studentSession?.studentId || "student",
          openedCount: outcome.openedCount,
          openedSeats: outcome.openedSeats,
          registrationAttempted: outcome.registrationAttempted,
          registrationResult: outcome.registrationResult,
          timestamp: new Date().toISOString(),
        });
      }

      return res.json({
        success: true,
        data: outcome,
      });
    } catch (err) {
      console.error("Seat sniper check error:", err.message || err);
      return res.status(500).json({
        error: "فشل التحقق من توفر المقاعد للقناص.",
        message:
          process.env.NODE_ENV === "production" ? undefined : err.message,
      });
    }
  },
);

export default router;
