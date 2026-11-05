export interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
  sampleCount: number;
}

export interface RouteMetric {
  route: string;
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  errors: number;
}

export interface MetricsSummary {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: {
    seconds: number;
    formatted: string;
  };
  requests: {
    total: number;
    rps: number;
    rateLimitHits: number;
    statusCodes: {
      "2xx": number;
      "3xx": number;
      "4xx": number;
      "5xx": number;
    };
    methods: Record<string, number>;
    errorRatePercent: number;
  };
  latency: LatencyPercentiles;
  topRoutes: RouteMetric[];
  system: {
    eventLoopLagMs: number;
    memory: {
      heapUsedMb: number;
      heapTotalMb: number;
      rssMb: number;
      heapUtilizationPercent: number;
      raw: NodeJS.MemoryUsage;
    };
    nodeVersion: string;
    platform: string;
  };
  circuitBreaker: {
    name: string;
    state: "CLOSED" | "OPEN" | "HALF_OPEN";
    consecutiveFailures: number;
    tripCount: number;
    lastFailureTime: string | null;
    lastSuccessTime: string | null;
    lastErrorMessage: string | null;
  };
  database: {
    engine: string;
    metrics: any;
  };
}

export function normalizeRoute(method: string, rawUrl: string): string;
export function recordRequest(params: {
  method: string;
  url: string;
  statusCode: number;
  durationMs: number;
}): void;
export function getLatencyPercentiles(): LatencyPercentiles;
export function getSystemPerformance(): {
  uptime: { seconds: number; formatted: string };
  eventLoopLagMs: number;
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
    heapUtilizationPercent: number;
    raw: NodeJS.MemoryUsage;
  };
};
export function getMetricsSummary(): MetricsSummary;
export function toPrometheusFormat(): string;
export function resetMetrics(): void;
