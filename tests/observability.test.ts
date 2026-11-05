import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../server/app.js";
import {
  recordRequest,
  getLatencyPercentiles,
  normalizeRoute,
  getMetricsSummary,
  toPrometheusFormat,
  resetMetrics,
} from "../server/services/observability.js";
import { edugateCircuitBreaker } from "../server/utils/circuitBreaker.js";

test("observability: normalizeRoute masks numeric IDs and UUIDs to prevent metric cardinality explosion", () => {
  assert.equal(
    normalizeRoute("GET", "/api/student/202110123/records"),
    "GET /api/student/:id/records",
  );
  assert.equal(
    normalizeRoute("POST", "/api/courses/15200101"),
    "POST /api/courses/:id",
  );
  assert.equal(
    normalizeRoute(
      "GET",
      "/api/session/123e4567-e89b-12d3-a456-426614174000/info",
    ),
    "GET /api/session/:uuid/info",
  );
  assert.equal(
    normalizeRoute("GET", "/api/courses?codes=15200101&limit=50"),
    "GET /api/courses",
  );
});

test("observability: getLatencyPercentiles accurately calculates percentiles from buffer", () => {
  resetMetrics();

  // Record 100 sample requests with predictable latencies from 1ms to 100ms
  for (let i = 1; i <= 100; i++) {
    recordRequest({
      method: "GET",
      url: "/api/test",
      statusCode: 200,
      durationMs: i,
    });
  }

  const p = getLatencyPercentiles();
  assert.equal(p.sampleCount, 100);
  assert.equal(p.min, 1);
  assert.equal(p.max, 100);
  assert.ok(p.p50 >= 45 && p.p50 <= 55, `p50 should be ~50ms, got ${p.p50}`);
  assert.ok(p.p95 >= 90 && p.p95 <= 96, `p95 should be ~95ms, got ${p.p95}`);
  assert.ok(p.p99 >= 95 && p.p99 <= 100, `p99 should be ~99ms, got ${p.p99}`);
  assert.ok(p.avg >= 48 && p.avg <= 52, `avg should be ~50.5ms, got ${p.avg}`);
});

test("observability: toPrometheusFormat produces valid Prometheus exposition text", () => {
  resetMetrics();
  recordRequest({
    method: "GET",
    url: "/api/courses",
    statusCode: 200,
    durationMs: 15,
  });
  recordRequest({
    method: "POST",
    url: "/api/student/login",
    statusCode: 401,
    durationMs: 45,
  });
  recordRequest({
    method: "GET",
    url: "/api/fail",
    statusCode: 500,
    durationMs: 80,
  });

  const prom = toPrometheusFormat();

  assert.ok(
    prom.includes(
      "# HELP http_requests_total Total number of HTTP requests\n# TYPE http_requests_total counter",
    ),
  );
  assert.ok(prom.includes('http_requests_total{status_code_class="2xx"} 1'));
  assert.ok(prom.includes('http_requests_total{status_code_class="4xx"} 1'));
  assert.ok(prom.includes('http_requests_total{status_code_class="5xx"} 1'));
  assert.ok(prom.includes("# HELP edugate_circuit_breaker_state"));
  assert.ok(prom.includes("edugate_circuit_breaker_state"));
  assert.ok(prom.includes("nodejs_eventloop_lag_seconds"));
  assert.ok(prom.includes("nodejs_heap_size_used_bytes"));
});

test("observability: HTTP endpoints /metrics, /api/health/live, /api/health/ready, /api/observability/stats", async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Prometheus /metrics endpoint
    const metricsRes = await fetch(`${baseUrl}/metrics`);
    assert.equal(metricsRes.status, 200);
    assert.ok(
      (metricsRes.headers.get("content-type") || "").includes(
        "text/plain; version=0.0.4",
      ),
    );
    const metricsText = await metricsRes.text();
    assert.ok(metricsText.includes("http_requests_total"));
    assert.ok(metricsText.includes("nodejs_uptime_seconds"));

    // 2. Liveness probe /api/health/live
    const liveRes = await fetch(`${baseUrl}/api/health/live`);
    assert.equal(liveRes.status, 200);
    const liveData = await liveRes.json();
    assert.equal(liveData.status, "ok");
    assert.ok(liveData.timestamp);

    // 3. Readiness probe /api/health/ready (healthy)
    const readyRes = await fetch(`${baseUrl}/api/health/ready`);
    assert.equal(readyRes.status, 200);
    const readyData = await readyRes.json();
    assert.equal(readyData.status, "ready");
    assert.equal(readyData.sqliteHealthy, true);
    assert.equal(readyData.circuitState, "CLOSED");

    // 4. Observability stats JSON endpoint
    const statsRes = await fetch(`${baseUrl}/api/observability/stats`);
    assert.equal(statsRes.status, 200);
    const statsData = await statsRes.json();
    assert.ok(statsData.status);
    assert.ok(statsData.uptime);
    assert.ok(statsData.requests);
    assert.ok(statsData.latency);
    assert.ok(statsData.system);
    assert.ok(statsData.circuitBreaker);
    assert.ok(statsData.database);

    // 5. Correlation & Trace Context headers
    assert.ok(statsRes.headers.get("x-request-id"));
    assert.ok(statsRes.headers.get("traceparent"));

    // 6. Readiness probe returns 503 when circuit breaker is tripped to OPEN
    edugateCircuitBreaker.recordFailure(new Error("Downstream PTUK Down"));
    edugateCircuitBreaker.recordFailure(new Error("Downstream PTUK Down"));
    edugateCircuitBreaker.recordFailure(new Error("Downstream PTUK Down"));
    assert.equal(edugateCircuitBreaker.getStatus().state, "OPEN");

    const degradedReadyRes = await fetch(`${baseUrl}/api/health/ready`);
    assert.equal(degradedReadyRes.status, 503);
    const degradedData = await degradedReadyRes.json();
    assert.equal(degradedData.status, "not_ready");
    assert.equal(degradedData.circuitState, "OPEN");

    // Reset circuit breaker back to clean state
    edugateCircuitBreaker.reset();
    assert.equal(edugateCircuitBreaker.getStatus().state, "CLOSED");
  } finally {
    server.close();
  }
});
