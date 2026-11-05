/**
 * Security Middleware — Comprehensive layered defense
 * Protects against:
 * - HTTP Parameter Pollution (HPP)
 * - Prototype Pollution & NoSQL Injection
 * - Cross-Site Request Forgery (CSRF) / Origin Spoofing
 * - MIME Sniffing, Clickjacking, Cache Leaks
 * - Broken Access Control & IDOR
 */

import {
  timingSafeEqualStrings,
  verifySessionToken,
} from "../services/securityVault.js";
import { isSafeOutboundUrl } from "../utils/ssrfGuard.js";

/**
 * Prevents HTTP Parameter Pollution:
 * If an array of query values is passed for a single key, take the last value only.
 */
export function sanitizeQuery(req, res, next) {
  if (req.query && typeof req.query === "object") {
    for (const key of Object.keys(req.query)) {
      if (Array.isArray(req.query[key])) {
        req.query[key] = req.query[key][req.query[key].length - 1];
      }
    }
  }
  next();
}

/**
 * Prevents NoSQL Injection and Prototype Pollution in JSON bodies:
 * Strips keys starting with $ or matching prototype injection targets (__proto__, constructor, prototype).
 */
export function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === "object") {
    try {
      const sanitized = JSON.parse(
        JSON.stringify(req.body, (key, value) => {
          if (typeof key === "string") {
            if (
              key.startsWith("$") ||
              key === "__proto__" ||
              key === "constructor" ||
              key === "prototype"
            ) {
              return undefined;
            }
          }
          return value;
        }),
      );
      req.body = sanitized;
    } catch {
      // Ignore serialization issues
    }
  }
  next();
}

/**
 * Enforces JSON Content-Type for mutating requests that carry data.
 */
export function enforceContentType(req, res, next) {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const contentType = req.headers["content-type"];
    // Allow empty bodies or enforce application/json
    if (contentType && !contentType.includes("application/json")) {
      return res
        .status(415)
        .json({ error: "نوع المحتوى غير مدعوم. استخدم application/json." });
    }
  }
  next();
}

/**
 * Enhanced HTTP security headers.
 */
export function additionalSecurityHeaders(req, res, next) {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

  // Prevent caching of sensitive API endpoints (student records, registration, sync)
  if (
    req.path.startsWith("/api/student") ||
    req.path.startsWith("/api/registration") ||
    req.path.startsWith("/api/sync")
  ) {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, private",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  next();
}

/**
 * Verifies Origin / Referer for CSRF mitigation on state-changing requests.
 */
export function verifyCsrfOrigin(allowedOrigins = []) {
  return (req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return next();
    }

    const origin = req.headers["origin"];
    const referer = req.headers["referer"];

    // Server-to-server or curl requests with no origin/referer are permitted if authenticated
    if (!origin && !referer) {
      return next();
    }

    const targetUrl = origin || referer;
    try {
      const parsed = new URL(targetUrl);
      const originHost = `${parsed.protocol}//${parsed.host}`;

      const isAllowed = allowedOrigins.some((allowed) => {
        if (!allowed) return false;
        try {
          const a = new URL(allowed);
          return `${a.protocol}//${a.host}` === originHost;
        } catch {
          return allowed === originHost;
        }
      });

      // Allow local development origins
      const isLocal =
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        /^192\.168\.\d+\.\d+$/.test(parsed.hostname) ||
        /^10\.\d+\.\d+\.\d+$/.test(parsed.hostname);

      if (isAllowed || (process.env.NODE_ENV !== "production" && isLocal)) {
        return next();
      }

      return res.status(403).json({
        error: "طلب مرفوض: مصدر غير مصرح به (Cross-Site Request Rejected).",
      });
    } catch {
      return res.status(400).json({ error: "مصدر الطلب غير صالح." });
    }
  };
}

/**
 * Middleware preventing SSRF attacks on endpoints that accept external target URLs (Item 117).
 */
export function validateSsrfTarget(
  urlExtractor = (req) => req.body?.url || req.query?.url,
) {
  return (req, res, next) => {
    const targetUrl = urlExtractor(req);
    if (!targetUrl) return next();

    const check = isSafeOutboundUrl(targetUrl, {
      allowLocalDev: process.env.NODE_ENV !== "production",
    });

    if (!check.safe) {
      return res.status(400).json({
        error: `الرابط المطلوب غير مصرح به أمنياً (SSRF Protection): ${check.reason}`,
      });
    }

    next();
  };
}

/**
 * Authenticates admin operations using constant-time comparison against configured API keys.
 */
export function requireAdminAuth(req, res, next) {
  const adminKey =
    process.env.ADMIN_API_KEY ||
    process.env.SYNC_API_KEY ||
    process.env.STUDENT_AUTH_SECRET;

  if (!adminKey) {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        error:
          "العملية الإدارية غير مفعلة بدون تهيئة مفتاح الأمان (API Key) في بيئة الإنتاج.",
      });
    }
    // In local dev without key, permit with warning
    return next();
  }

  const providedKey =
    req.headers["x-api-key"] ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "");

  if (!providedKey || !timingSafeEqualStrings(providedKey, adminKey)) {
    return res.status(401).json({
      error: "غير مصرح. مفتاح API غير صالح أو مفقود.",
    });
  }

  next();
}

/**
 * Authenticates student session from signed token.
 * Attaches decoded session to req.studentSession.
 */
export function authenticateStudentSession(req, res, next) {
  const authHeader =
    req.headers["authorization"] || req.headers["x-auth-token"];

  if (!authHeader) {
    req.studentSession = null;
    return next();
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const session = verifySessionToken(token);
  req.studentSession = session;
  next();
}

/**
 * Extracts client identity (IP + student ID / session token) for dual-key rate limiting.
 * Protects university campus NAT gateways from shared-IP lockouts (OWASP API4 / NIST SP 800-63B).
 */
export function extractClientIdentity(req, res, next) {
  let studentId = null;

  // 1. Check if session was already decoded or extract from auth header
  if (req.studentSession && req.studentSession.studentId) {
    studentId = req.studentSession.studentId;
  } else {
    const authHeader =
      req.headers["authorization"] || req.headers["x-auth-token"];
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const session = verifySessionToken(token);
      if (session && session.studentId) {
        studentId = session.studentId;
        req.studentSession = session;
      }
    }
  }

  // 2. Extract from request body if studentId is present
  if (
    !studentId &&
    req.body &&
    typeof req.body === "object" &&
    typeof req.body.studentId === "string"
  ) {
    studentId = req.body.studentId
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .trim()
      .toLowerCase();
  }

  // 3. Extract from URL params
  if (!studentId && req.params && req.params.studentId) {
    studentId = String(req.params.studentId).trim().toLowerCase();
  }

  const rawIp = req.ip || req.socket?.remoteAddress || "127.0.0.1";
  req.clientStudentId = studentId || null;
  req.clientIdentity = studentId ? `${rawIp}:${studentId}` : rawIp;
  next();
}
