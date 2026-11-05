export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "PTUK Academic Planner & Schedule Solver API",
    version: "2.0.0",
    description:
      "High-performance university schedule scraper, database synchronizer, and automated schedule solver for Palestine Technical University - Kadoorie (PTUK).",
    contact: {
      name: "Engineering Team",
    },
  },
  servers: [
    {
      url: "/api",
      description: "Local / Production API Gateway",
    },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Granular server health & diagnostic metrics",
        responses: {
          200: {
            description: "System health and runtime status",
          },
        },
      },
    },
    "/health/live": {
      get: {
        summary: "Kubernetes/container liveness probe",
        responses: {
          200: { description: "Process is live" },
        },
      },
    },
    "/health/ready": {
      get: {
        summary: "Readiness probe verifying DB and upstream gateway",
        responses: {
          200: { description: "Process is ready to serve traffic" },
          503: { description: "Process is not ready" },
        },
      },
    },
    "/observability/stats": {
      get: {
        summary: "Real-time performance metrics and percentile latencies",
        responses: {
          200: { description: "Live observability telemetry payload" },
        },
      },
    },
    "/courses": {
      get: {
        summary: "List catalog courses with sections and schedule blocks",
        parameters: [
          {
            name: "codes",
            in: "query",
            schema: { type: "string" },
            description: "Comma-separated course codes",
          },
          {
            name: "search",
            in: "query",
            schema: { type: "string" },
            description: "Search query for course code or title",
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 500 },
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", default: 0 },
          },
        ],
        responses: {
          200: { description: "Array of courses" },
        },
      },
    },
    "/majors": {
      get: {
        summary: "Get available academic majors and degree plans",
        responses: {
          200: { description: "List of majors" },
        },
      },
    },
    "/student/login": {
      post: {
        summary: "Student authentication & Edugate portal synchronization",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["studentId", "password"],
                properties: {
                  studentId: { type: "string", example: "202110123" },
                  password: { type: "string", example: "********" },
                  demoMode: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Session token and student profile" },
          401: { description: "Invalid credentials" },
          429: { description: "Rate limit or account lockout" },
        },
      },
    },
    "/registration/prewarm": {
      post: {
        summary: "Prewarm portal session before registration rush",
        responses: {
          200: { description: "Session prewarmed successfully" },
        },
      },
    },
    "/registration/execute": {
      post: {
        summary:
          "Execute or simulate batch registration with cascading fallback",
        responses: {
          200: { description: "Registration batch results" },
        },
      },
    },
  },
};
