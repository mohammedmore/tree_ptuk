/**
 * OpenAPI 3.1.0 Specification for PTUK Academic Planner & Schedule Solver API
 * Conforming to Google SRE, RFC 9110, and modern OpenAPI standards.
 */

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "PTUK Academic Planner & Schedule Solver API",
    version: "2.1.0",
    description:
      "Enterprise-grade university schedule scraper, database synchronizer, multi-year CSP graduation solver, and automated online registration engine for Palestine Technical University - Kadoorie (PTUK).",
    contact: {
      name: "PTUK Engineering Team",
      url: "https://edugate.ptuk.edu.ps",
    },
    license: {
      name: "MIT",
    },
  },
  servers: [
    {
      url: "/api",
      description: "Production / Local API Gateway",
    },
  ],
  tags: [
    {
      name: "System & Health",
      description:
        "Diagnostics, container liveness, readiness probes, and telemetry.",
    },
    {
      name: "Courses & Catalog",
      description:
        "Course discovery, section capacity, timetable blocks, and syllabi.",
    },
    {
      name: "Majors & Degree Plans",
      description:
        "Academic majors, compulsory and elective degree track hierarchies.",
    },
    {
      name: "Student Portal & Auth",
      description:
        "Edugate authentication, session tokens, and transcript synchronization.",
    },
    {
      name: "Registration & Real-Time SSE",
      description:
        "Automated batch registration, seat sniping, and live Server-Sent Events.",
    },
    {
      name: "Academic Calendar & Tuition",
      description:
        "University calendar milestones and official tuition calculators.",
    },
    {
      name: "Data Synchronization",
      description:
        "SQLite/Supabase dual-engine synchronization and catalog refresh triggers.",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT/SignedToken",
        description:
          "Student session token obtained from POST /api/student/sync",
      },
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description:
          "Administrative API key for manual sync triggers and telemetry.",
      },
    },
    schemas: {
      ScheduleBlock: {
        type: "object",
        properties: {
          day: { type: "string", example: "U" },
          dayName: { type: "string", example: "الأحد" },
          startTime: { type: "string", example: "08:00" },
          endTime: { type: "string", example: "09:30" },
          startMinutes: { type: "integer", example: 480 },
          endMinutes: { type: "integer", example: 570 },
          room: { type: "string", example: "C-201" },
        },
      },
      Section: {
        type: "object",
        properties: {
          sec: { type: "string", example: "1" },
          activity: { type: "string", example: "نظري" },
          instructor: { type: "string", example: "د. سامر أحمد" },
          room: { type: "string", example: "C-201" },
          capacity: { type: "integer", example: 40 },
          registered: { type: "integer", example: 38 },
          available: { type: "integer", example: 2 },
          isFull: { type: "boolean", example: false },
          times: {
            type: "array",
            items: { $ref: "#/components/schemas/ScheduleBlock" },
          },
        },
      },
      Course: {
        type: "object",
        required: ["code", "name", "credits"],
        properties: {
          code: { type: "string", example: "15200101" },
          name: { type: "string", example: "مقدمة في علم الحاسوب" },
          credits: { type: "integer", example: 3 },
          college: { type: "string", example: "الهندسة والتكنولوجيا" },
          department: { type: "string", example: "علم الحاسوب" },
          type: { type: "string", example: "إجباري تخصص" },
          prerequisites: {
            type: "array",
            items: { type: "string" },
            example: [],
          },
          sections: {
            type: "array",
            items: { $ref: "#/components/schemas/Section" },
          },
        },
      },
      RegistrationPlanItem: {
        type: "object",
        required: ["courseCode", "section"],
        properties: {
          courseCode: { type: "string", example: "15200211" },
          courseName: { type: "string", example: "تراكيب البيانات" },
          section: { type: "string", example: "1" },
          credits: { type: "integer", example: 3 },
          priority: { type: "integer", example: 1 },
          fallbackSections: {
            type: "array",
            items: { type: "string" },
            example: ["2", "3"],
          },
        },
      },
      HealthResponse: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["healthy", "degraded"],
            example: "healthy",
          },
          timestamp: { type: "string", format: "date-time" },
          database: {
            type: "object",
            properties: {
              engine: {
                type: "string",
                example: "SQLite (better-sqlite3) + Supabase",
              },
              sqliteHealthy: { type: "boolean", example: true },
              metrics: { type: "object" },
            },
          },
          circuitBreaker: {
            type: "object",
            properties: {
              edugate: {
                type: "object",
                properties: {
                  state: { type: "string", example: "CLOSED" },
                  failures: { type: "integer", example: 0 },
                },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["System & Health"],
        summary: "Granular server health & diagnostic metrics",
        responses: {
          200: {
            description:
              "System health, database engine status, and circuit breaker health",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
    },
    "/health/live": {
      get: {
        tags: ["System & Health"],
        summary: "Kubernetes / Docker container liveness probe",
        responses: {
          200: {
            description: "Process is live and receiving traffic",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/health/ready": {
      get: {
        tags: ["System & Health"],
        summary:
          "Readiness probe verifying SQLite DB queryability and circuit breaker state",
        responses: {
          200: {
            description: "Process is fully ready to serve requests",
          },
          503: {
            description: "Process is degraded or database is unreachable",
          },
        },
      },
    },
    "/observability/stats": {
      get: {
        tags: ["System & Health"],
        summary:
          "Real-time performance metrics, percentile latencies, and circuit status (Admin)",
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        responses: {
          200: {
            description: "Live observability telemetry payload",
          },
          401: { description: "Missing or invalid authorization" },
          403: { description: "Forbidden - Administrator privileges required" },
        },
      },
    },
    "/courses": {
      get: {
        tags: ["Courses & Catalog"],
        summary:
          "List catalog courses with sections, capacity, and schedule blocks",
        parameters: [
          {
            name: "codes",
            in: "query",
            schema: { type: "string" },
            description: "Comma-separated list of course codes (max 50)",
            example: "15200101,15200211",
          },
          {
            name: "search",
            in: "query",
            schema: { type: "string" },
            description: "Search query filtering course title or code",
            example: "برمجة",
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 500 },
            description: "Maximum number of courses to return",
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", default: 0 },
            description: "Pagination offset",
          },
          {
            name: "compact",
            in: "query",
            schema: { type: "string", enum: ["true", "false", "1", "0"] },
            description:
              "Minify JSON response payload for mobile low-bandwidth clients",
          },
          {
            name: "fields",
            in: "query",
            schema: { type: "string" },
            description: "Comma-separated list of projection fields",
            example: "code,name,credits,sections",
          },
        ],
        responses: {
          200: {
            description: "Array of courses matching the query criteria",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Course" },
                },
              },
            },
          },
        },
      },
    },
    "/courses/{code}": {
      get: {
        tags: ["Courses & Catalog"],
        summary: "Get single course by course code",
        parameters: [
          {
            name: "code",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Unique course code (e.g. 15200101)",
          },
        ],
        responses: {
          200: {
            description: "Course details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Course" },
              },
            },
          },
          404: { description: "Course not found" },
        },
      },
    },
    "/majors": {
      get: {
        tags: ["Majors & Degree Plans"],
        summary: "Get available academic majors and degree study plans",
        responses: {
          200: {
            description:
              "List of academic majors and graduation plan structures",
          },
        },
      },
    },
    "/student/sync": {
      post: {
        tags: ["Student Portal & Auth"],
        summary: "Student authentication & Edugate portal synchronization",
        description:
          "Authenticates student credentials against Edugate, synchronizes degree plan and passed courses, and issues a tamper-proof signed session token.",
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
                  forceLive: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Signed session token and student academic profile",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    message: { type: "string" },
                    token: { type: "string" },
                    data: { type: "object" },
                  },
                },
              },
            },
          },
          401: { description: "Invalid student credentials" },
          429: {
            description:
              "Rate limit reached or account locked due to excessive failed attempts",
          },
        },
      },
    },
    "/student/logout": {
      post: {
        tags: ["Student Portal & Auth"],
        summary:
          "Revoke session token and invalidate immediately across server cluster",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Session successfully invalidated",
          },
        },
      },
    },
    "/student/{studentId}": {
      get: {
        tags: ["Student Portal & Auth"],
        summary:
          "Get cached student academic record (Protected against OWASP BOLA/IDOR)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "studentId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "University Student ID",
          },
        ],
        responses: {
          200: { description: "Sanitized student academic record" },
          403: {
            description: "Forbidden - Cannot access another student's record",
          },
          404: { description: "Student record not found" },
        },
      },
    },
    "/registration/stream": {
      get: {
        tags: ["Registration & Real-Time SSE"],
        summary:
          "Server-Sent Events (SSE) live stream for seat availability and registration outcomes",
        description:
          "High-performance real-time streaming endpoint. Emits 'connected', 'seat_update', and heartbeats.",
        responses: {
          200: {
            description: "Event stream connection established",
            content: {
              "text/event-stream": {
                schema: {
                  type: "string",
                  example:
                    'event: seat_update\\ndata: {\\"openedCount\\": 1}\\n\\n',
                },
              },
            },
          },
        },
      },
    },
    "/registration/prewarm": {
      post: {
        tags: ["Registration & Real-Time SSE"],
        summary: "Prewarm portal session before registration rush",
        description:
          "Checks Edugate availability, primes session cookies, and measures round-trip latency.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["studentId"],
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
          200: { description: "Prewarm diagnostic results" },
        },
      },
    },
    "/registration/portal-status": {
      post: {
        tags: ["Registration & Real-Time SSE"],
        summary:
          "Inspect real-time readiness of the online registration gateway",
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
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Online registration portal status" },
        },
      },
    },
    "/registration/execute": {
      post: {
        tags: ["Registration & Real-Time SSE"],
        summary:
          "Execute batch course registration with automatic plan cascading (A -> B -> C)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "x-idempotency-key",
            in: "header",
            schema: { type: "string" },
            description:
              "Idempotency key to safely retry requests without double-registering",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["studentId", "plans"],
                properties: {
                  studentId: { type: "string", example: "202110123" },
                  password: { type: "string", example: "********" },
                  plans: {
                    type: "object",
                    properties: {
                      planA: {
                        type: "array",
                        items: {
                          $ref: "#/components/schemas/RegistrationPlanItem",
                        },
                      },
                      planB: {
                        type: "array",
                        items: {
                          $ref: "#/components/schemas/RegistrationPlanItem",
                        },
                      },
                      planC: {
                        type: "array",
                        items: {
                          $ref: "#/components/schemas/RegistrationPlanItem",
                        },
                      },
                    },
                  },
                  options: {
                    type: "object",
                    properties: {
                      demoMode: { type: "boolean", default: false },
                      dryRun: { type: "boolean", default: false },
                      semester: { type: "string", example: "20241" },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description:
              "Execution results with registered sections and cascading fallbacks",
          },
          403: { description: "Forbidden - BOLA violation" },
        },
      },
    },
    "/registration/snipe-check": {
      post: {
        tags: ["Registration & Real-Time SSE"],
        summary:
          "Check closed sections for opened seats and trigger instant snipe registration",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["studentId", "targetSeats"],
                properties: {
                  studentId: { type: "string", example: "202110123" },
                  password: { type: "string", example: "********" },
                  autoExecute: { type: "boolean", default: false },
                  targetSeats: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["courseCode", "section"],
                      properties: {
                        courseCode: { type: "string", example: "15200211" },
                        section: { type: "string", example: "1" },
                      },
                    },
                  },
                  demoMode: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description:
              "Sniper evaluation result and registration attempt details",
          },
        },
      },
    },
    "/calendar": {
      get: {
        tags: ["Academic Calendar & Tuition"],
        summary:
          "Get official university academic calendar enriched with active milestones",
        responses: {
          200: {
            description:
              "Academic calendar milestones, current semester, and next deadline",
          },
        },
      },
    },
    "/calendar/sync": {
      post: {
        tags: ["Academic Calendar & Tuition"],
        summary:
          "Force fresh re-scrape of the academic calendar from official PTUK site",
        responses: {
          200: { description: "Refreshed academic calendar" },
        },
      },
    },
    "/calendar/tuition-fees": {
      get: {
        tags: ["Academic Calendar & Tuition"],
        summary:
          "Calculate official tuition fees and fixed semester charges by major and credits",
        parameters: [
          {
            name: "major",
            in: "query",
            schema: { type: "string" },
            description: "Major name or code",
            example: "هندسة أنظمة الحاسوب",
          },
          {
            name: "credits",
            in: "query",
            schema: { type: "integer", default: 18 },
            description: "Registered credit hours",
          },
          {
            name: "freshman",
            in: "query",
            schema: { type: "string", enum: ["true", "false"] },
            description:
              "Whether the student is a new freshman (adds one-time admission fees)",
          },
        ],
        responses: {
          200: {
            description: "Itemized breakdown of tuition and university fees",
          },
        },
      },
    },
    "/sync/status": {
      get: {
        tags: ["Data Synchronization"],
        summary:
          "Get current SQLite/Supabase synchronization status, timestamps, and catalog counts",
        responses: {
          200: { description: "Synchronization health and status" },
        },
      },
    },
    "/sync/trigger": {
      post: {
        tags: ["Data Synchronization"],
        summary:
          "Manually trigger background synchronization of courses catalog (Admin)",
        security: [{ ApiKeyAuth: [] }],
        responses: {
          200: { description: "Sync cycle initiated or completed" },
          401: { description: "Unauthorized - API Key required" },
        },
      },
    },
  },
};

/**
 * Generates a zero-dependency, ultra-fast interactive HTML developer portal
 * for exploring the OpenAPI 3.1 specification. Fully CSP-compliant.
 */
export function renderOpenApiHtml(spec = openApiSpec) {
  const specJsonEscaped = JSON.stringify(spec).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spec.info.title} - توثيق واجهات البرمجة API</title>
  <style>
    :root {
      --bg-dark: #0a0f1d;
      --card-bg: #111827;
      --border-color: #1f2937;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --accent: #10b981;
      --accent-glow: rgba(16, 185, 129, 0.2);
      --get-badge: #059669;
      --post-badge: #2563eb;
      --delete-badge: #dc2626;
      --font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-dark);
      color: var(--text-main);
      font-family: var(--font-family);
      line-height: 1.5;
      padding: 1.5rem;
    }
    .header {
      max-width: 1200px;
      margin: 0 auto 2rem;
      padding: 1.5rem 2rem;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 1rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .badge-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-primary { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-version { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
    .header h1 {
      font-size: 1.75rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.025em;
    }
    .header p {
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.6;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.5rem;
      flex-wrap: wrap;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.9rem;
      border-radius: 0.5rem;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.15s ease;
      border: 1px solid var(--border-color);
      background: #1e293b;
      color: #e2e8f0;
    }
    .btn:hover {
      background: #334155;
      color: #ffffff;
    }
    .btn-emerald {
      background: #065f46;
      border-color: #059669;
      color: #a7f3d0;
    }
    .btn-emerald:hover {
      background: #047857;
      color: #ffffff;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .search-box {
      width: 100%;
      padding: 0.85rem 1.25rem;
      border-radius: 0.75rem;
      border: 1px solid var(--border-color);
      background: var(--card-bg);
      color: var(--text-main);
      font-size: 1rem;
      outline: none;
      transition: border-color 0.2s ease;
    }
    .search-box:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }
    .tag-section {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 1rem;
      overflow: hidden;
    }
    .tag-header {
      padding: 1rem 1.5rem;
      background: rgba(255, 255, 255, 0.02);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .tag-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: #f9fafb;
    }
    .tag-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    .endpoint-list {
      display: flex;
      flex-direction: column;
    }
    .endpoint-card {
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding: 1rem 1.5rem;
      transition: background 0.15s ease;
      cursor: pointer;
    }
    .endpoint-card:last-child {
      border-bottom: none;
    }
    .endpoint-card:hover {
      background: rgba(255, 255, 255, 0.02);
    }
    .endpoint-summary {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .method-badge {
      padding: 0.2rem 0.55rem;
      border-radius: 0.35rem;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      min-width: 52px;
      text-align: center;
    }
    .method-get { background: var(--get-badge); color: #ecfdf5; }
    .method-post { background: var(--post-badge); color: #eff6ff; }
    .method-delete { background: var(--delete-badge); color: #fef2f2; }
    .endpoint-path {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.95rem;
      font-weight: 600;
      color: #e5e7eb;
      direction: ltr;
    }
    .endpoint-desc {
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-inline-start: auto;
    }
    .endpoint-details {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px dashed var(--border-color);
      display: none;
      font-size: 0.85rem;
    }
    .endpoint-card.open .endpoint-details {
      display: block;
    }
    .param-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.5rem;
      font-size: 0.8rem;
    }
    .param-table th, .param-table td {
      padding: 0.4rem 0.6rem;
      text-align: right;
      border: 1px solid var(--border-color);
    }
    .param-table th {
      background: rgba(255, 255, 255, 0.04);
      color: #9ca3af;
    }
    .code-pill {
      font-family: monospace;
      background: #1f2937;
      padding: 0.1rem 0.3rem;
      border-radius: 0.25rem;
      color: #67e8f9;
      direction: ltr;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="badge-bar">
      <span class="badge badge-primary">OpenAPI ${spec.openapi}</span>
      <span class="badge badge-version">v${spec.info.version}</span>
      <span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3);">Google SRE & RFC 9110</span>
    </div>
    <h1>${spec.info.title}</h1>
    <p>${spec.info.description}</p>
    <div class="header-actions">
      <a class="btn btn-emerald" href="/api/docs/json" download="openapi.json">
        <span>تنزيل مواصفات JSON</span>
      </a>
      <a class="btn" href="/api/health" target="_blank">
        <span>فحص الصحة الحي (/api/health)</span>
      </a>
      <a class="btn" href="/api/courses" target="_blank">
        <span>الكتالوج الأكاديمي (/api/courses)</span>
      </a>
    </div>
  </div>

  <div class="container">
    <input type="text" id="apiSearch" class="search-box" placeholder="🔍 ابحث في المسارات والواجهات (مثال: courses, stream, execute, student)..." />

    <div id="apiContent"></div>
  </div>

  <script>
    const spec = ${specJsonEscaped};
    const container = document.getElementById("apiContent");
    const searchInput = document.getElementById("apiSearch");

    function renderSpec(filter = "") {
      const q = filter.trim().toLowerCase();
      let html = "";

      const tags = spec.tags || [{ name: "عام", description: "واجهات برمجية" }];

      for (const tag of tags) {
        let tagHtml = "";
        let matchCount = 0;

        for (const [pathKey, pathObj] of Object.entries(spec.paths || {})) {
          for (const [methodKey, opObj] of Object.entries(pathObj)) {
            const opTags = opObj.tags || [];
            if (!opTags.includes(tag.name)) continue;

            const summary = opObj.summary || "";
            const desc = opObj.description || "";
            const searchHaystack = (pathKey + " " + methodKey + " " + summary + " " + desc + " " + tag.name).toLowerCase();

            if (q && !searchHaystack.includes(q)) continue;
            matchCount++;

            const methodClass = "method-" + methodKey.toLowerCase();
            const params = opObj.parameters || [];
            let paramsHtml = "";

            if (params.length > 0) {
              paramsHtml = '<table class="param-table"><thead><tr><th>المعلمة</th><th>الموقع</th><th>النوع</th><th>الوصف</th></tr></thead><tbody>';
              for (const p of params) {
                paramsHtml += '<tr><td><span class="code-pill">' + p.name + '</span></td><td>' + p.in + '</td><td>' + (p.schema?.type || 'string') + '</td><td>' + (p.description || '-') + '</td></tr>';
              }
              paramsHtml += '</tbody></table>';
            }

            tagHtml += '<div class="endpoint-card" onclick="this.classList.toggle(\\'open\\')">' +
              '<div class="endpoint-summary">' +
                '<span class="method-badge ' + methodClass + '">' + methodKey.toUpperCase() + '</span>' +
                '<span class="endpoint-path">' + pathKey + '</span>' +
                '<span class="endpoint-desc">' + summary + '</span>' +
              '</div>' +
              '<div class="endpoint-details">' +
                (desc ? '<p style="color: #cbd5e1; margin-bottom: 0.5rem;">' + desc + '</p>' : '') +
                (paramsHtml ? '<div style="margin-top: 0.5rem;"><strong>المعاملات:</strong>' + paramsHtml + '</div>' : '') +
              '</div>' +
            '</div>';
          }
        }

        if (matchCount > 0) {
          html += '<div class="tag-section">' +
            '<div class="tag-header">' +
              '<div><div class="tag-title">' + tag.name + '</div><div class="tag-desc">' + (tag.description || '') + '</div></div>' +
              '<span class="badge badge-primary">' + matchCount + ' مسار</span>' +
            '</div>' +
            '<div class="endpoint-list">' + tagHtml + '</div>' +
          '</div>';
        }
      }

      container.innerHTML = html || '<div style="text-align:center; padding: 2rem; color: #9ca3af;">لم يتم العثور على واجهات برمجية مطابقة للبحث.</div>';
    }

    searchInput.addEventListener("input", (e) => {
      renderSpec(e.target.value);
    });

    renderSpec();
  </script>
</body>
</html>`;
}
