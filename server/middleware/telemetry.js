import crypto from "node:crypto";

/**
 * Middleware that attaches a unique Correlation ID (x-request-id) to every request
 * and logs request latency, path, and status code.
 */
export function telemetryMiddleware(req, res, next) {
  const correlationId = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = correlationId;
  res.setHeader("x-request-id", correlationId);

  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
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
