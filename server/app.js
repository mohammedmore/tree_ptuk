import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import coursesRouter from "./routes/courses.js";
import majorsRouter from "./routes/majors.js";
import studentRouter from "./routes/student.js";
import syncRouter from "./routes/sync.js";
import registrationRouter from "./routes/registration.js";
import calendarRouter from "./routes/calendar.js";
import { startScheduler } from "./services/scheduler.js";
import { getSyncStatus } from "./db.js";
import { getSqliteDb, getSqliteMetrics } from "./sqliteDb.js";
import { edugateCircuitBreaker } from "./utils/circuitBreaker.js";
import { openApiSpec, renderOpenApiHtml } from "./openapi.js";
import {
  getMetricsSummary,
  toPrometheusFormat,
} from "./services/observability.js";
import {
  sanitizeQuery,
  sanitizeBody,
  enforceContentType,
  additionalSecurityHeaders,
  verifyCsrfOrigin,
  extractClientIdentity,
  authenticateStudentSession,
  requireAdminAuth,
} from "./middleware/security.js";
import {
  globalLimiter,
  authLimiter,
  syncLimiter,
  registrationLimiter,
  concurrencyLimiter,
} from "./middleware/rateLimiters.js";
import { responseCompression } from "./middleware/compression.js";
import { telemetryMiddleware } from "./middleware/telemetry.js";

dotenv.config();

const app = express();

// ─── Trust Proxy ──────────────────────────────────────────────────────────
// Required for accurate client IP rate limiting behind reverse proxies (Nginx, Vercel, Cloudflare)
app.set("trust proxy", 1);

// ─── Security Headers (Helmet) ────────────────────────────────────────────
// Sets Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, etc.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://va.vercel-scripts.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: [
          "'self'",
          "https://*.supabase.co",
          "wss://*.supabase.co",
          "https://va.vercel-scripts.com",
        ],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

// ─── Hide Server Identity ─────────────────────────────────────────────────
app.disable("x-powered-by");

// ─── Additional Security Headers ──────────────────────────────────────────
app.use(additionalSecurityHeaders);

// ─── CORS — Restricted Origin Whitelist ───────────────────────────────────
const configuredFrontendUrls = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  ...configuredFrontendUrls,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server, same-origin)
      if (!origin) {
        return callback(null, true);
      }

      // Check configured allowed origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow any localhost / 127.0.0.1 / local network IP in development
      if (process.env.NODE_ENV !== "production") {
        try {
          const u = new URL(origin);
          if (
            u.hostname === "localhost" ||
            u.hostname === "127.0.0.1" ||
            u.hostname === "0.0.0.0" ||
            /^192\.168\.\d+\.\d+$/.test(u.hostname) ||
            /^10\.\d+\.\d+\.\d+$/.test(u.hostname) ||
            /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(u.hostname)
          ) {
            return callback(null, true);
          }
        } catch {}
      }

      // In production or if origin doesn't match, strictly reject unauthorized origins
      const err = new Error(
        "CORS policy does not allow access from this origin.",
      );
      err.status = 403;
      return callback(err);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "X-API-Key",
      "X-Idempotency-Key",
      "X-Auth-Token",
    ],
    credentials: true,
  }),
);

// ─── Telemetry & Logging ──────────────────────────────────────────────────
app.use(telemetryMiddleware);

// ─── Response Compression (Gzip/Brotli) ───────────────────────────────────
app.use(responseCompression);

// ─── Body Parsing (strictly capped to 1 MB to prevent memory overflow DoS) ─
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// ─── Request Sanitization & Identity Extraction Middleware ───────────────
app.use(sanitizeQuery);
app.use(sanitizeBody);
app.use(enforceContentType);
app.use(extractClientIdentity);

// ─── Global Rate Limiting ─────────────────────────────────────────────────
app.use(globalLimiter);

// ─── CSRF Verification for Mutating Requests ──────────────────────────────
app.use(verifyCsrfOrigin(allowedOrigins));

export { authLimiter, syncLimiter, registrationLimiter, globalLimiter };

// ─── Prometheus Metrics Endpoint ──────────────────────────────────────────
app.get("/metrics", (req, res) => {
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  return res.send(toPrometheusFormat());
});

// ─── Health & Metrics Endpoint ──────────────────────────────────────────
app.get("/api/health", (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  let sqliteHealthy = false;
  let sqliteMetrics = null;

  try {
    const sqlite = getSqliteDb();
    sqlite.prepare("SELECT 1").get();
    sqliteHealthy = true;
    sqliteMetrics = getSqliteMetrics();
  } catch {}

  const circuitStatus = edugateCircuitBreaker.getStatus();

  const response = {
    status:
      sqliteHealthy && circuitStatus.state !== "OPEN" ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    database: {
      engine: "SQLite (better-sqlite3) + Supabase",
      sqliteHealthy,
      metrics: sqliteMetrics,
    },
    circuitBreaker: {
      edugate: circuitStatus,
    },
  };

  if (!isProduction) {
    response.uptimeSeconds = Math.round(process.uptime());
    response.memory = process.memoryUsage();
    response.sync = getSyncStatus();
  }

  return res.json(response);
});

// ─── Kubernetes/Container Liveness Probe ──────────────────────────────────
app.get("/api/health/live", (req, res) => {
  return res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ─── Readiness Probe ──────────────────────────────────────────────────────
app.get("/api/health/ready", (req, res) => {
  let sqliteHealthy = false;
  try {
    const sqlite = getSqliteDb();
    sqlite.prepare("SELECT 1").get();
    sqliteHealthy = true;
  } catch {}

  const circuitStatus = edugateCircuitBreaker.getStatus();
  const isReady = sqliteHealthy && circuitStatus.state !== "OPEN";

  return res.status(isReady ? 200 : 503).json({
    status: isReady ? "ready" : "not_ready",
    timestamp: new Date().toISOString(),
    sqliteHealthy,
    circuitState: circuitStatus.state,
  });
});

// ─── Live Observability Telemetry API (Admin Only) ────────────────────────
app.get(
  "/api/observability/stats",
  authenticateStudentSession,
  requireAdminAuth,
  (req, res) => {
    return res.json(getMetricsSummary());
  },
);

// ─── OpenAPI Documentation ────────────────────────────────────────────────
app.get("/api/docs", (req, res) => {
  const accept = req.headers.accept || "";
  if (accept.includes("text/html") && !req.query.json) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(renderOpenApiHtml(openApiSpec));
  }
  return res.json(openApiSpec);
});

app.get("/api/docs/ui", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(renderOpenApiHtml(openApiSpec));
});

app.get("/api/docs/json", (req, res) => {
  return res.json(openApiSpec);
});

// ─── Mount Routers with Specialized Protection ────────────────────────────
app.use("/api/courses", coursesRouter);
app.use("/api/majors", majorsRouter);
app.use("/api/student", studentRouter);
app.use("/api/sync", syncRouter);
app.use("/api/calendar", calendarRouter);
app.use(
  "/api/registration",
  registrationLimiter,
  concurrencyLimiter,
  registrationRouter,
);

// Legacy backward-compatibility routes
app.post("/api/sync-ptuk", (req, res, next) => {
  req.url = "/ptuk";
  return syncRouter(req, res, next);
});

// ─── Centralized Error Handler ────────────────────────────────────────────
// Never leak internal error details or stack traces in production
app.use((err, req, res, next) => {
  console.error("❌ Unhandled server error:", err.message || err);
  const isProduction = process.env.NODE_ENV === "production";
  const status = err.status || 500;
  return res.status(status).json({
    error:
      err.status === 403
        ? "طلب مرفوض: قيود الأمان (CORS / CSRF)."
        : "حدث خطأ غير متوقع في الخادم.",
    ...(isProduction ? {} : { message: err.message }),
  });
});

export function validateProductionSecurityEnvironment({
  throwOnFailure = false,
} = {}) {
  if (process.env.NODE_ENV !== "production") return true;

  const errors = [];
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    errors.push("SESSION_SECRET is missing or shorter than 32 characters.");
  }
  if (!process.env.FRONTEND_URL) {
    errors.push("FRONTEND_URL is not configured for CORS restriction.");
  }
  if (!process.env.ADMIN_API_KEY && !process.env.SYNC_API_KEY) {
    errors.push("Neither ADMIN_API_KEY nor SYNC_API_KEY is configured.");
  }

  if (errors.length > 0) {
    console.error("🚨 [FATAL PRODUCTION SECURITY AUDIT]");
    errors.forEach((w) => console.error(`   - ${w}`));
    if (throwOnFailure) {
      throw new Error(
        `Production security audit failed:\n${errors.join("\n")}`,
      );
    }
  }
  return errors.length === 0;
}

export function startServer(port = process.env.PORT || 3001) {
  const isSecure = validateProductionSecurityEnvironment();
  if (process.env.NODE_ENV === "production" && !isSecure) {
    console.error(
      "🛑 Server start aborted due to production security violations.",
    );
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log(`🚀 السيرفر المطور يعمل بنجاح على: http://localhost:${port}`);
    // Start automated background sync scheduler
    startScheduler();
  });

  // Optimize keep-alive timeouts for high-concurrency registration surges
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  return server;
}

export default app;
