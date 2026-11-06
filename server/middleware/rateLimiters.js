import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Global limiter: 200 requests per 15 minutes per IP in production (1500 in dev)
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 200 : 1500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "تم تجاوز الحد الأقصى للطلبات المسموح بها. يرجى المحاولة لاحقاً.",
  },
  skip: (req) => {
    if (process.env.NODE_ENV !== "production") {
      const ip = req.ip || "";
      return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
    }
    return false;
  },
});

// Auth-specific limiter: 15 requests per 15 minutes per (IP + student ID) dual-key
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 15 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req);
    return req.clientStudentId ? `${ip}:${req.clientStudentId}` : ip;
  },
  message: {
    error: "تم تجاوز عدد محاولات الدخول المسموح بها. يرجى الانتظار 15 دقيقة.",
  },
  skip: (req) => {
    if (process.env.NODE_ENV !== "production") {
      const ip = req.ip || "";
      if (
        ip === "127.0.0.1" ||
        ip === "::1" ||
        ip === "::ffff:127.0.0.1" ||
        req.body?.demoMode
      ) {
        return true;
      }
    }
    return false;
  },
});

// Registration-specific limiter: 30 requests per 15 minutes per (IP + student ID) dual-key
export const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 30 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req);
    return req.clientStudentId ? `${ip}:${req.clientStudentId}` : ip;
  },
  message: {
    error:
      "تم تجاوز الحد الأقصى لعمليات التسجيل السريع. يرجى الانتظار بضع دقائق.",
  },
  skip: (req) => {
    if (req.path === "/stream") return true;
    if (process.env.NODE_ENV !== "production") {
      const ip = req.ip || "";
      if (
        ip === "127.0.0.1" ||
        ip === "::1" ||
        ip === "::ffff:127.0.0.1" ||
        req.body?.demoMode
      ) {
        return true;
      }
    }
    return false;
  },
});

// Sync-specific limiter: 5 requests per 5 minutes per IP
export const syncLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 5 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "تم تجاوز الحد المسموح لعمليات المزامنة. يرجى الانتظار 5 دقائق.",
  },
});

// Concurrency limiter for heavy operations (e.g. registration gateway calls)
let activeConnections = 0;
const MAX_CONCURRENT = 20;

export function concurrencyLimiter(req, res, next) {
  // Never hold concurrency slots for long-lived real-time streaming connections
  if (req.path === "/stream") {
    return next();
  }

  if (activeConnections >= MAX_CONCURRENT) {
    return res.status(429).json({
      error: "الخادم مشغول حالياً بمعالجة طلبات أخرى. يرجى الانتظار بضع ثوانٍ.",
    });
  }
  activeConnections++;
  let decremented = false;
  const decrement = () => {
    if (!decremented) {
      decremented = true;
      activeConnections = Math.max(0, activeConnections - 1);
    }
  };
  res.on("finish", decrement);
  res.on("close", decrement);
  next();
}
