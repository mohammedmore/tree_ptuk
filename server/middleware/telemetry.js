import crypto from "node:crypto";
import { recordRequest } from "../services/observability.js";

/**
 * Middleware that attaches Correlation ID (x-request-id) and W3C Trace Context (traceparent)
 * to every request, records real-time latency and metrics in the Observability engine,
 * and logs request metadata.
 */
export function telemetryMiddleware(req, res, next) {
  const correlationId = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = correlationId;
  res.setHeader("x-request-id", correlationId);

  // W3C Trace Context propagation
  const traceparent =
    req.headers["traceparent"] ||
    `00-${crypto.randomBytes(16).toString("hex")}-${crypto.randomBytes(8).toString("hex")}-01`;
  res.setHeader("traceparent", traceparent);

  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;

    // Feed real-time observability telemetry
    recordRequest({
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: duration,
    });

    const logLevel =
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    const logData = {
      level: logLevel,
      id: correlationId,
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    };

    if (res.statusCode >= 400) {
      console.warn(
        `[API] ${logData.method} ${logData.url} ${logData.status} (${logData.durationMs}ms) - ${logData.id}`,
      );
    } else if (process.env.NODE_ENV !== "test") {
      console.log(
        `[API] ${logData.method} ${logData.url} ${logData.status} (${logData.durationMs}ms)`,
      );
    }
  });

  next();
}
