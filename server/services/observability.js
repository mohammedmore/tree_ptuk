import { monitorEventLoopDelay } from "node:perf_hooks";
import { edugateCircuitBreaker } from "../utils/circuitBreaker.js";
import { getSqliteMetrics } from "../sqliteDb.js";

// Initialize event loop delay monitor with 20ms resolution
let eventLoopHistogram = null;
try {
  eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 });
  eventLoopHistogram.enable();
} catch (e) {
  console.warn("Could not enable monitorEventLoopDelay:", e.message);
}

// In-memory telemetry storage
const BUFFER_SIZE = 1000;
const recentDurations = new Float64Array(BUFFER_SIZE);
let durationIndex = 0;
let totalRecordedDurations = 0;

let totalRequests = 0;
let rateLimitHits = 0;
const statusCodes = {
  "2xx": 0,
  "3xx": 0,
  "4xx": 0,
  "5xx": 0,
};
const requestsByMethod = {};
const routeStats = new Map();
const startTime = Date.now();

/**
 * Normalizes dynamic paths into static route templates to prevent high cardinality.
 * e.g., /api/student/202110123/records -> /api/student/:id/records
 */
export function normalizeRoute(method, rawUrl) {
  if (!rawUrl) return `${method} /`;

  // Strip query strings and hash fragments
  const cleanPath = rawUrl.split("?")[0].split("#")[0];

  const normalized = cleanPath
    // Normalize numeric IDs (e.g. 202110123, 15200101)
    .replace(/\/\d{4,}/g, "/:id")
    // Normalize UUIDs
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "/:uuid",
    );

  return `${method.toUpperCase()} ${normalized}`;
}

/**
 * Records a completed HTTP request.
 */
export function recordRequest({ method, url, statusCode, durationMs }) {
  totalRequests++;

  const m = (method || "GET").toUpperCase();
  requestsByMethod[m] = (requestsByMethod[m] || 0) + 1;

  if (statusCode >= 200 && statusCode < 300) {
    statusCodes["2xx"]++;
  } else if (statusCode >= 300 && statusCode < 400) {
    statusCodes["3xx"]++;
  } else if (statusCode >= 400 && statusCode < 500) {
    statusCodes["4xx"]++;
    if (statusCode === 429) {
      rateLimitHits++;
    }
  } else if (statusCode >= 500) {
    statusCodes["5xx"]++;
  }

  // Circular duration buffer
  recentDurations[durationIndex % BUFFER_SIZE] = durationMs;
  durationIndex++;
  totalRecordedDurations++;

  // Route aggregation
  const routeKey = normalizeRoute(m, url);
  let stats = routeStats.get(routeKey);
  if (!stats) {
    stats = {
      route: routeKey,
      count: 0,
      totalMs: 0,
      minMs: Infinity,
      maxMs: 0,
      errors: 0,
    };
    routeStats.set(routeKey, stats);
  }
  stats.count++;
  stats.totalMs += durationMs;
  stats.minMs = Math.min(stats.minMs, durationMs);
  stats.maxMs = Math.max(stats.maxMs, durationMs);
  if (statusCode >= 400) {
    stats.errors++;
  }
}

/**
 * Computes latency percentiles (p50, p95, p99, avg, min, max) from recorded buffer.
 */
export function getLatencyPercentiles() {
  const sampleCount = Math.min(totalRecordedDurations, BUFFER_SIZE);
  if (sampleCount === 0) {
    return {
      p50: 0,
      p95: 0,
      p99: 0,
      avg: 0,
      min: 0,
      max: 0,
      sampleCount: 0,
    };
  }

  const samples = Array.from(recentDurations.subarray(0, sampleCount)).sort(
    (a, b) => a - b,
  );

  const sum = samples.reduce((acc, val) => acc + val, 0);
  const avg = Math.round((sum / sampleCount) * 100) / 100;
  const min = Math.round(samples[0] * 100) / 100;
  const max = Math.round(samples[samples.length - 1] * 100) / 100;

  const p50 =
    Math.round(samples[Math.floor((samples.length - 1) * 0.5)] * 100) / 100;
  const p95 =
    Math.round(samples[Math.floor((samples.length - 1) * 0.95)] * 100) / 100;
  const p99 =
    Math.round(samples[Math.floor((samples.length - 1) * 0.99)] * 100) / 100;

  return { p50, p95, p99, avg, min, max, sampleCount };
}

/**
 * Returns formatted human-readable uptime string.
 */
function formatUptime(uptimeSeconds) {
  const d = Math.floor(uptimeSeconds / 86400);
  const h = Math.floor((uptimeSeconds % 86400) / 3600);
  const m = Math.floor((uptimeSeconds % 3600) / 60);
  const s = Math.floor(uptimeSeconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

/**
 * Gathers system performance metrics (Event loop lag, CPU, Memory).
 */
export function getSystemPerformance() {
  const uptimeSeconds = Math.round(process.uptime() * 100) / 100;
  const mem = process.memoryUsage();

  let eventLoopLagMs = 0;
  if (eventLoopHistogram) {
    // mean delay converted from nanoseconds to milliseconds
    eventLoopLagMs = Math.round((eventLoopHistogram.mean / 1e6) * 100) / 100;
  }

  const heapUsedMb = Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100;
  const heapTotalMb = Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100;
  const rssMb = Math.round((mem.rss / 1024 / 1024) * 100) / 100;
  const heapUtilizationPercent =
    heapTotalMb > 0 ? Math.round((heapUsedMb / heapTotalMb) * 1000) / 10 : 0;

  return {
    uptime: {
      seconds: uptimeSeconds,
      formatted: formatUptime(uptimeSeconds),
    },
    eventLoopLagMs,
    memory: {
      heapUsedMb,
      heapTotalMb,
      rssMb,
      heapUtilizationPercent,
      raw: mem,
    },
  };
}

/**
 * Compiles a comprehensive real-time JSON metrics summary.
 */
export function getMetricsSummary() {
  const uptimeSeconds = process.uptime();
  const rps =
    uptimeSeconds > 0
      ? Math.round((totalRequests / uptimeSeconds) * 100) / 100
      : 0;

  const totalErrors = statusCodes["4xx"] + statusCodes["5xx"];
  const errorRatePercent =
    totalRequests > 0
      ? Math.round((totalErrors / totalRequests) * 10000) / 100
      : 0;

  const latency = getLatencyPercentiles();
  const system = getSystemPerformance();
  const circuitBreaker = edugateCircuitBreaker.getStatus();

  let sqliteMetrics = null;
  try {
    sqliteMetrics = getSqliteMetrics();
  } catch {}

  // Determine overall health state
  let overallStatus = "healthy";
  if (circuitBreaker.state === "OPEN" || errorRatePercent >= 50) {
    overallStatus = "unhealthy";
  } else if (
    circuitBreaker.state === "HALF_OPEN" ||
    system.eventLoopLagMs >= 100 ||
    errorRatePercent >= 10
  ) {
    overallStatus = "degraded";
  }

  // Top 10 routes by request count
  const topRoutes = Array.from(routeStats.values())
    .map((s) => ({
      route: s.route,
      count: s.count,
      avgMs: Math.round((s.totalMs / s.count) * 100) / 100,
      minMs: Math.round(s.minMs * 100) / 100,
      maxMs: Math.round(s.maxMs * 100) / 100,
      errors: s.errors,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: system.uptime,
    requests: {
      total: totalRequests,
      rps,
      rateLimitHits,
      statusCodes,
      methods: requestsByMethod,
      errorRatePercent,
    },
    latency,
    topRoutes,
    system: {
      eventLoopLagMs: system.eventLoopLagMs,
      memory: system.memory,
      nodeVersion: process.version,
      platform: process.platform,
    },
    circuitBreaker,
    database: {
      engine: "SQLite (better-sqlite3) + Supabase",
      metrics: sqliteMetrics,
    },
  };
}

/**
 * Exports current metrics in Prometheus exposition text format (version 0.0.4).
 */
export function toPrometheusFormat() {
  const summary = getMetricsSummary();
  const lines = [];

  // Helper to add metric
  const addMetric = (name, help, type, value, labels = "") => {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} ${type}`);
    lines.push(`${name}${labels ? `{${labels}}` : ""} ${value}`);
  };

  // Uptime
  addMetric(
    "nodejs_uptime_seconds",
    "Process uptime in seconds",
    "gauge",
    summary.uptime.seconds,
  );

  // Total requests
  lines.push("# HELP http_requests_total Total number of HTTP requests");
  lines.push("# TYPE http_requests_total counter");
  lines.push(
    `http_requests_total{status_code_class="2xx"} ${statusCodes["2xx"]}`,
  );
  lines.push(
    `http_requests_total{status_code_class="3xx"} ${statusCodes["3xx"]}`,
  );
  lines.push(
    `http_requests_total{status_code_class="4xx"} ${statusCodes["4xx"]}`,
  );
  lines.push(
    `http_requests_total{status_code_class="5xx"} ${statusCodes["5xx"]}`,
  );

  // Rate limit hits
  addMetric(
    "http_rate_limit_hits_total",
    "Total HTTP 429 Too Many Requests responses",
    "counter",
    summary.requests.rateLimitHits,
  );

  // Latencies
  lines.push(
    "# HELP http_request_duration_seconds HTTP request latency percentiles in seconds",
  );
  lines.push("# TYPE http_request_duration_seconds summary");
  lines.push(
    `http_request_duration_seconds{quantile="0.5"} ${summary.latency.p50 / 1000}`,
  );
  lines.push(
    `http_request_duration_seconds{quantile="0.95"} ${summary.latency.p95 / 1000}`,
  );
  lines.push(
    `http_request_duration_seconds{quantile="0.99"} ${summary.latency.p99 / 1000}`,
  );
  lines.push(
    `http_request_duration_seconds_sum ${
      (summary.latency.avg * summary.latency.sampleCount) / 1000
    }`,
  );
  lines.push(
    `http_request_duration_seconds_count ${summary.latency.sampleCount}`,
  );

  // Event loop delay
  addMetric(
    "nodejs_eventloop_lag_seconds",
    "Event loop delay in seconds",
    "gauge",
    summary.system.eventLoopLagMs / 1000,
  );

  // Process Memory
  addMetric(
    "nodejs_heap_size_used_bytes",
    "Process heap memory used",
    "gauge",
    summary.system.memory.raw.heapUsed,
  );
  addMetric(
    "nodejs_heap_size_total_bytes",
    "Process heap memory total allocated",
    "gauge",
    summary.system.memory.raw.heapTotal,
  );
  addMetric(
    "process_resident_memory_bytes",
    "Resident set size memory",
    "gauge",
    summary.system.memory.raw.rss,
  );

  // Circuit Breaker State (0 = CLOSED, 1 = HALF_OPEN, 2 = OPEN)
  const circuitStateValue =
    summary.circuitBreaker.state === "CLOSED"
      ? 0
      : summary.circuitBreaker.state === "HALF_OPEN"
        ? 1
        : 2;
  addMetric(
    "edugate_circuit_breaker_state",
    "State of Edugate Circuit Breaker (0=CLOSED, 1=HALF_OPEN, 2=OPEN)",
    "gauge",
    circuitStateValue,
    'circuit="edugate"',
  );

  addMetric(
    "edugate_circuit_breaker_trips_total",
    "Total times the Edugate circuit breaker tripped",
    "counter",
    summary.circuitBreaker.tripCount || 0,
    'circuit="edugate"',
  );

  // SQLite Database Metrics
  if (summary.database.metrics) {
    addMetric(
      "sqlite_database_size_bytes",
      "Size of SQLite database file on disk",
      "gauge",
      summary.database.metrics.sizeBytes || 0,
    );
    addMetric(
      "sqlite_wal_size_bytes",
      "Size of SQLite WAL file on disk",
      "gauge",
      summary.database.metrics.walSizeBytes || 0,
    );
    addMetric(
      "sqlite_registered_students_total",
      "Count of student profiles stored in SQLite",
      "gauge",
      summary.database.metrics.studentsCount || 0,
    );
  }

  return lines.join("\n") + "\n";
}

/**
 * Resets all collected metrics (useful for automated testing).
 */
export function resetMetrics() {
  totalRequests = 0;
  rateLimitHits = 0;
  statusCodes["2xx"] = 0;
  statusCodes["3xx"] = 0;
  statusCodes["4xx"] = 0;
  statusCodes["5xx"] = 0;
  Object.keys(requestsByMethod).forEach((k) => delete requestsByMethod[k]);
  routeStats.clear();
  recentDurations.fill(0);
  durationIndex = 0;
  totalRecordedDurations = 0;
  if (eventLoopHistogram) {
    eventLoopHistogram.reset();
  }
}
