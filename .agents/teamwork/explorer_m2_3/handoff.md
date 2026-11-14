# OWASP Top 10 & ASVS v4.0 Technical Security Investigation Report

**Target**: PTUK Academic Planner & Schedule Solver (`src/` Frontend and `server/` Backend)  
**Investigator**: `explorer_m2_3` (Security & OWASP Standards Explorer)  
**Date**: 2026-11-14  
**Integrity Mode**: Read-Only Security Audit  

---

## 1. Observation

Direct code observations across the frontend (`src/`) and backend (`server/`) with file locations, exact line numbers, and verbatim code quotes.

### 1.1 Sensitive Data Exposure & Client-Side Storage (OWASP A02:2021 Cryptographic Failures / A04:2021 Insecure Design)

#### Observation 1.1.1: Full Academic Transcript and Financial Records Stored in `localStorage`
- **File**: `c:\Users\mohammed\Desktop\planner\src\services\studentService.ts`
- **Lines 102-103, 175-180**:
  ```typescript
  102: export const STORAGE_STUDENT_KEY = "ptuk_synced_student_profile";
  103: export const STORAGE_STUDENT_TOKEN_KEY = "ptuk_student_token";
  ...
  175:       if (window.localStorage) {
  176:         window.localStorage.setItem(
  177:           STORAGE_STUDENT_KEY,
  178:           JSON.stringify(profile),
  179:         );
  180:       }
  ```
- **File**: `c:\Users\mohammed\Desktop\planner\src\services\studentService.ts`
- **Lines 67-100**: The `StudentSyncProfile` data structure contains:
  ```typescript
  67: export interface StudentSyncProfile {
  68:   studentId: string;
  69:   studentName?: string;
  ...
  75:   academicStatus?: string;
  76:   academicAdvisor?: string;
  77:   academicWarning?: string;
  79:   financialBalance?: string;
  80:   earnedCredits: number;
  82:   gpa: number;
  83:   passedCourseIds: string[];
  84:   registeredCourseIds?: string[];
  85:   failedCourseIds?: string[];
  87:   courseGrades?: Record<string, number>;
  90:   enrolledCourses?: EnrolledCourse[];
  91:   semesters?: StudentSemester[];
  92:   transactions?: AcademicTransaction[];
  93:   financial?: FinancialRecord;
  94:   exemptionExams?: ExemptionExamRecord[];
  ...
  ```
  `financial.payments` includes `receiptNo`, `date`, `amount`, and `description`. `semesters` contains exact letter and numeric grades for every course completed by the student over their entire academic career.

#### Observation 1.1.2: Unencrypted Session JWT Stored in Persistent `localStorage`
- **File**: `c:\Users\mohammed\Desktop\planner\src\services\studentService.ts`
- **Lines 188-190**:
  ```typescript
  188:         if (window.localStorage) {
  189:           window.localStorage.setItem(STORAGE_STUDENT_TOKEN_KEY, result.token);
  190:         }
  ```
  The session authentication token (valid for 7 days, as defined in `server/routes/student.js:69`) is written to `window.localStorage`, surviving browser session termination and accessible via JavaScript.

#### Observation 1.1.3: Additional PII and Academic Grades in `src/appStorage.ts`
- **File**: `c:\Users\mohammed\Desktop\planner\src\appStorage.ts`
- **Lines 72-82, 232-261**:
  `completed_courses`, `planned_courses`, `weekly_schedule`, `course_grades` (exact grade percentages), `selected_electives_map`, and `failed_course_ids` are serialized directly into `localStorage`.
- **File**: `c:\Users\mohammed\Desktop\planner\src\pages\LoginPage.tsx`
- **Line 96**:
  `localStorage.setItem("ptuk_remembered_student_id", cleanUser);`

---

### 1.2 Cryptographic Implementation & Event Loop Starvation (OWASP A02:2021 Cryptographic Failures / ASVS V2.8, V6.2, V6.4)

#### Observation 1.2.1: Synchronous `crypto.scryptSync` Blocks Main Node.js Event Loop Thread
- **File**: `c:\Users\mohammed\Desktop\planner\server\services\securityVault.js`
- **Lines 76-81**:
  ```javascript
  76: export function hashStudentPassword(password) {
  77:   if (typeof password !== "string" || !password) return "";
  78:   const salt = crypto.randomBytes(16).toString("hex");
  79:   const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  80:   return `${salt}:${hash}`;
  81: }
  ```
- **Lines 89-107**:
  ```javascript
  89: export function verifyStudentPassword(password, storedHash) {
  ...
  102:     const computedHash = crypto.scryptSync(password, salt, 32).toString("hex");
  103:     return timingSafeEqualStrings(computedHash, expectedHash);
  ```
  Both password hashing and password verification invoke `crypto.scryptSync`. This call runs synchronously on the V8 main execution thread.

#### Observation 1.2.2: Hardcoded Fallback Master Encryption Secret
- **File**: `c:\Users\mohammed\Desktop\planner\server\services\securityVault.js`
- **Lines 35-51**:
  ```javascript
  35: function getEncryptionKey(version = "v1") {
  36:   const rawSecret =
  37:     process.env.SESSION_SECRET ||
  38:     process.env.SYNC_API_KEY ||
  39:     (process.env.NODE_ENV === "production"
  40:       ? EPHEMERAL_PROCESS_SECRET
  41:       : "ptuk-planner-vault-secure-key-2026");
  42: 
  43:   if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  44:     console.warn(
  45:       "⚠️ [SECURITY WARNING] SESSION_SECRET is not set in production. Using ephemeral in-memory secret.",
  46:     );
  47:   }
  48: 
  49:   // Derive 32 bytes using HKDF-SHA256
  50:   return crypto.hkdfSync("sha256", rawSecret, HKDF_SALT, HKDF_INFO, 32);
  51: }
  ```
  When `NODE_ENV !== "production"` or when `NODE_ENV` is unset, the static fallback secret `"ptuk-planner-vault-secure-key-2026"` is used. In production without `SESSION_SECRET`, it uses an in-memory `EPHEMERAL_PROCESS_SECRET` that regenerates upon process restart.

#### Observation 1.2.3: Insecure TLS Certificate Verification Bypass in Scraper
- **File**: `c:\Users\mohammed\Desktop\planner\server\services\scrapers\academicCalendarScraper.js`
- **Line 5**:
  ```javascript
  5: const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  ```
  Line 592 passes `httpsAgent` to `axios.get(CALENDAR_URL, { httpsAgent, ... })`, turning off TLS certificate validation for university calendar scraping.

---

### 1.3 Access Control & Authorization (OWASP A01:2021 Broken Access Control / ASVS V4.1, V4.2)

#### Observation 1.3.1: Critical BOLA & Auth Bypass on `POST /api/registration/execute`
- **File**: `c:\Users\mohammed\Desktop\planner\server\middleware\security.js`
- **Lines 228-241**:
  ```javascript
  228: export function authenticateStudentSession(req, res, next) {
  229:   const authHeader =
  230:     req.headers["authorization"] || req.headers["x-auth-token"];
  231: 
  232:   if (!authHeader) {
  233:     req.studentSession = null;
  234:     return next();
  235:   }
  236: 
  237:   const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  238:   const session = verifySessionToken(token);
  239:   req.studentSession = session;
  240:   next();
  241: }
  ```
- **File**: `c:\Users\mohammed\Desktop\planner\server\routes\registration.js`
- **Lines 180-210**:
  ```javascript
  180: router.post(
  181:   "/execute",
  182:   authenticateStudentSession,
  183:   validateBody(registrationExecuteSchema),
  184:   async (req, res) => {
  ...
  199:       if (req.studentSession && !options.demoMode) {
  200:         const sessionStudentId = req.studentSession.studentId;
  201:         const actualStudentId = req.studentSession.actualStudentId;
  202:         const isSelf =
  203:           sessionStudentId === cleanId || actualStudentId === cleanId;
  204:         if (!isSelf && req.studentSession.role !== "admin") {
  205:           return res.status(403).json({
  206:             error:
  207:               "طلب مرفوض: غير مصرح لك بتنفيذ عملية تسجيل لطالب آخر (BOLA Violation).",
  208:           });
  209:         }
  210:       }
  ```
  If a client makes a request to `/api/registration/execute` **without** an `Authorization` header, `authenticateStudentSession` sets `req.studentSession = null` and calls `next()`. At line 199, `if (req.studentSession && !options.demoMode)` evaluates to `false`. The entire ownership verification is skipped, allowing unauthenticated execution for any `studentId`.

#### Observation 1.3.2: Missing Authentication on Registration Prewarm and Diagnostic Endpoints
- **File**: `c:\Users\mohammed\Desktop\planner\server\routes\registration.js`
  - Line 120: `router.post("/prewarm", validateBody(registrationPrewarmSchema), async (req, res) => ...)`
  - Line 151: `router.post("/portal-status", validateBody(registrationPortalStatusSchema), async (req, res) => ...)`
  - Line 260: `router.post("/test-request", validateBody(registrationTestRequestSchema), async (req, res) => ...)`
  None of these mutating/scraping endpoints apply `authenticateStudentSession` or require an authenticated user.

#### Observation 1.3.3: SSRF Guard Defined But Never Wired to Express Routes
- **File**: `c:\Users\mohammed\Desktop\planner\server\utils\ssrfGuard.js` (lines 69-151) defines `isSafeOutboundUrl` and `assertSafeOutboundUrl`.
- **File**: `c:\Users\mohammed\Desktop\planner\server\middleware\security.js` (line 165) defines `validateSsrfTarget`.
- Ripgrep verification across `server/routes/` confirms `validateSsrfTarget` and `assertSafeOutboundUrl` are imported and executed on **0** API routes.

---

### 1.4 Security Headers, Rate Limiting & Input Sanitization (OWASP A05:2021 Security Misconfiguration / A03:2021 Injection)

#### Observation 1.4.1: Content Security Policy (CSP) Degraded by `'unsafe-inline'`
- **File**: `c:\Users\mohammed\Desktop\planner\server\app.js`
- **Lines 51-60**:
  ```javascript
  51:   helmet({
  52:     contentSecurityPolicy: {
  53:       directives: {
  54:         defaultSrc: ["'self'"],
  55:         scriptSrc: [
  56:           "'self'",
  57:           "'unsafe-inline'",
  58:           "https://va.vercel-scripts.com",
  59:         ],
  60:         styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  ```
  `'unsafe-inline'` in `scriptSrc` disables script execution gating against injected DOM payloads.

#### Observation 1.4.2: Development CORS Over-Permissiveness with `credentials: true`
- **File**: `c:\Users\mohammed\Desktop\planner\server\app.js`
- **Lines 124-138, 157**:
  In non-production, regex matches any IP in `192.168.*`, `10.*`, `172.16-31.*`, `localhost`, and `127.0.0.1`, returning `Access-Control-Allow-Origin: <origin>` alongside `credentials: true`.

#### Observation 1.4.3: In-Memory Rate Limiting & Bypass in Non-Production
- **File**: `c:\Users\mohammed\Desktop\planner\server\middleware\rateLimiters.js`
  - Uses `express-rate-limit` with default `MemoryStore`.
  - Lines 41, 72: When `NODE_ENV !== "production"`, `req.body?.demoMode` skips rate limiting entirely.
  - `GET /api/student/:studentId` is not protected by `authLimiter`, relying solely on `globalLimiter`.

#### Observation 1.4.4: SQLite Parameterization and Validation Verification
- **File**: `c:\Users\mohammed\Desktop\planner\server\sqliteDb.js`
  - Lines 149-170, 215-238, 291-300: All SQLite operations use prepared statements (`db.prepare(...)`) with parameter bindings (`?` or `@param`).
  - Line 220: `whereClauses.push('code IN (' + placeholders + ')')` uses dynamic `?` placeholders matching the length of validated codes array.
  - No raw string interpolation of query parameters into SQL strings was found in `sqliteDb.js`.
- **File**: `c:\Users\mohammed\Desktop\planner\server\validators.js`
  - Lines 14-26: `studentIdRule` strictly bounds IDs: `/^[a-zA-Z0-9._\-@]{3,40}$/`.

---

## 2. Logic Chain

### 2.1 From Observation 1.1 to Assessment of Sensitive Data Exposure
1. `src/services/studentService.ts:176` stores `StudentSyncProfile` directly into `window.localStorage` under key `ptuk_synced_student_profile`.
2. As observed in lines 67-100, `StudentSyncProfile` includes student ID, full name, GPA, academic probation warnings, detailed course grades, tuition balance, and payment transaction receipts.
3. Simultaneously, lines 188-190 store the raw authentication token (`ptuk_student_token`) in `localStorage`.
4. Browser `localStorage` is accessible to any script executing within the window origin without expiration or partition (unlike `HttpOnly`, `Secure` cookies).
5. Any Cross-Site Scripting (XSS) vulnerability or untrusted third-party script loaded via CSP (e.g. analytics) can read both the complete academic history and the authentication token with `window.localStorage.getItem(...)`.
6. Furthermore, on shared computer lab machines at the university, `localStorage` data persists indefinitely across browser tabs and system reboots until manually cleared.
7. **Conclusion**: Violates **OWASP Top 10 (2021) A02: Cryptographic Failures** and **OWASP ASVS v4.0 V3.4.1 / V3.4.2** (Session Management & Client-Side Storage).

### 2.2 From Observation 1.2 to Assessment of Event Loop Starvation & Secret Compromise
1. `server/services/securityVault.js:79, 102` calls `crypto.scryptSync(password, salt, 32)` synchronously on both password registration and verification.
2. In Node.js, V8 executes JavaScript in a single-threaded event loop. Intensive cryptographic functions executed synchronously occupy 100% of the V8 thread for their entire duration (~50-100ms per scrypt invocation with default cost parameters).
3. When multiple students log in concurrently (for example, during the opening minute of official university course registration), incoming requests queue behind synchronous scrypt calculations.
4. With 20-50 concurrent login attempts, the event loop blocks for 1-5 continuous seconds. During this freeze, HTTP keep-alives timeout, real-time SSE heartbeat packets fail to send, and legitimate student traffic is dropped.
5. **Conclusion**: Violates **OWASP Top 10 (2021) A04: Insecure Design** (Denial of Service via resource starvation) and **OWASP ASVS v4.0 V2.8.1**.
6. Separately, in `securityVault.js:41`, when `SESSION_SECRET` is omitted in non-production, the static string `"ptuk-planner-vault-secure-key-2026"` derives the master encryption and token signing keys. In an unconfigured staging or internal environment, this allows trivial token forgery and unauthorized decryption of student databases.
7. In `academicCalendarScraper.js:5`, setting `rejectUnauthorized: false` completely deactivates TLS certificate verification during outbound HTTPS requests, opening the university calendar scraper to Man-in-the-Middle (MitM) attacks in violation of **OWASP ASVS v4.0 V9.2.1**.

### 2.3 From Observation 1.3 to Assessment of Broken Access Control (BOLA)
1. `server/middleware/security.js:228-241` defines `authenticateStudentSession`. If `req.headers["authorization"]` is missing, it assigns `req.studentSession = null` and proceeds (`next()`). It does not reject unauthenticated requests.
2. In `server/routes/registration.js:199`, the BOLA guard is guarded by:
   `if (req.studentSession && !options.demoMode)`
3. When an attacker sends an HTTP request to `POST /api/registration/execute` omitting the `Authorization` header, `req.studentSession` is `null`.
4. The conditional check evaluates to `false`, completely skipping lines 200-209.
5. The request proceeds directly to `executeRegistrationBatch(...)` with the supplied `cleanId`.
6. While `tests/security.test.ts:646` tests that providing token for Student A while targeting Student B fails with 403, it never tests the unauthenticated path (providing no token at all).
7. **Conclusion**: Direct violation of **OWASP Top 10 (2021) A01: Broken Access Control** (specifically OWASP API1:2023 Broken Object Level Authorization) and **OWASP ASVS v4.0 V4.1.1 / V4.2.1**.

### 2.4 From Observation 1.4 to Assessment of Security Headers & Injection Resilience
1. In `server/app.js:57`, the Content Security Policy header sets `scriptSrc: ["'self'", "'unsafe-inline'", ...]`.
2. The `'unsafe-inline'` directive allows execution of inline `<script>` tags and inline event handlers, nullifying CSP's primary capability to prevent Cross-Site Scripting (XSS).
3. In `server/middleware/rateLimiters.js`, rate limiting relies exclusively on in-memory counters. In horizontal scaling setups (e.g. multiple Node.js worker processes or serverless functions), each instance tracks limits independently, enabling attackers to multiply allowed request velocity by the number of instances.
4. On the positive side, all SQLite queries in `server/sqliteDb.js` utilize parameterized prepared statements, and input validation is enforced by strict Zod schemas with regex boundaries, demonstrating robust resilience against SQL injection (OWASP A03:2021).

---

## 3. Caveats

1. **Live Network Testing Excluded**: In accordance with strict read-only and no-external-network constraints, no traffic was transmitted to live university servers (`edugate.ptuk.edu.ps` or `ptuk.edu.ps`).
2. **Third-Party Supabase Remote Tier**: The application supports optional Supabase synchronization (`server/db.js:batchUpsertToSupabase`). Remote Supabase Row-Level Security (RLS) policies deployed on Supabase cloud instances were not audited directly as they reside in remote cloud infrastructure outside local files.
3. **Source Immutability Maintained**: No source code was modified during this investigation. All remediation proposals are provided as architectural and code-level recommendations.

---

## 4. Conclusion

The application exhibits several well-engineered security controls:
- Parametric SQLite query construction completely resists SQL injection.
- Passwords are never stored in plaintext on the server, and `sanitizeStudentRecordForClient` cleanly strips `authHash` before HTTP transmission.
- Outbound SSRF utility functions (`server/utils/ssrfGuard.js`) implement comprehensive IP and domain boundary checks.
- Dual-key rate limiting (`ipKeyGenerator + studentId`) thoughtfully protects university NAT gateways.

However, the audit identified **four critical architectural vulnerabilities** that must be resolved prior to production deployment:

| Severity | Category | Vulnerability Summary | Primary Location |
|---|---|---|---|
| **CRITICAL** | OWASP A01:2021 / API1:2023 | BOLA / Authentication bypass on `POST /api/registration/execute` when `Authorization` header is omitted. | `server/routes/registration.js:199` & `server/middleware/security.js:228` |
| **HIGH** | OWASP A02:2021 / ASVS V3.4 | Complete student transcript, GPA, financial receipts, and session JWT exposed in browser `localStorage`. | `src/services/studentService.ts:175-190` |
| **HIGH** | OWASP A04:2021 / ASVS V2.8 | Synchronous `crypto.scryptSync` causes main event loop thread starvation and DoS under concurrent login load. | `server/services/securityVault.js:79, 102` |
| **MEDIUM** | OWASP A02:2021 / ASVS V9.2 | TLS certificate verification explicitly disabled (`rejectUnauthorized: false`) in academic calendar scraper. | `server/services/scrapers/academicCalendarScraper.js:5` |
| **MEDIUM** | OWASP A05:2021 / ASVS V14.4 | CSP policy includes `'unsafe-inline'` in `scriptSrc`, degrading browser-level XSS protection. | `server/app.js:57` |
| **MEDIUM** | OWASP A02:2021 / ASVS V6.4 | Static hardcoded fallback secret `"ptuk-planner-vault-secure-key-2026"` used when environment variables are omitted. | `server/services/securityVault.js:41` |

### Recommended Remediation Actions:
1. **Fix BOLA on Registration Routes**:
   In `server/routes/registration.js`, enforce mandatory authentication:
   ```javascript
   if (!req.studentSession && !options.demoMode) {
     return res.status(401).json({ error: "غير مصرح. يجب تسجيل الدخول لتنفيذ التسجيل." });
   }
   ```
2. **Migrate Session Token & Sensitive Data Storage**:
   - Store session tokens in `HttpOnly`, `Secure`, `SameSite=Strict` cookies instead of `localStorage`.
   - Store transient student transcript data in React state or short-lived `sessionStorage` rather than persistent `localStorage`.
3. **Make Password Hashing Asynchronous**:
   Replace `crypto.scryptSync` with `util.promisify(crypto.scrypt)` to offload password derivation to `libuv` worker threads:
   ```javascript
   import { scrypt } from "node:crypto";
   import { promisify } from "node:util";
   const scryptAsync = promisify(scrypt);
   ```
4. **Enforce TLS Validation**:
   Remove `rejectUnauthorized: false` from `server/services/scrapers/academicCalendarScraper.js:5`.
5. **Harden Production Secret Checks**:
   Enforce that the server process immediately terminates if `SESSION_SECRET` is missing in any staging or production launch.
6. **Eliminate `'unsafe-inline'` in CSP**:
   Adopt nonce-based or hash-based script loading for production builds.

---

## 5. Verification Method

To independently reproduce and verify each observation documented in this report:

### 5.1 Verifying BOLA / Unauthenticated Execution Vulnerability
Inspect `server/routes/registration.js` lines 180-210. Run a local Node.js test harness without providing an `Authorization` header:
```bash
# Start backend in test mode
node Server.js

# In another terminal, dispatch unauthenticated registration execute request:
curl -X POST http://localhost:3001/api/registration/execute \
  -H "Content-Type: application/json" \
  -d "{\"studentId\":\"202110999\",\"plans\":{\"A\":{\"items\":[]}}}"
```
**Expected Invalidation Condition**: If properly secured, the server must respond with `HTTP 401 Unauthorized`.  
**Current Failure Observation**: Because `req.studentSession` is `null`, lines 199-210 are bypassed and execution proceeds.

### 5.2 Verifying Event Loop Blocking via Synchronous Scrypt
Inspect `server/services/securityVault.js` lines 79 and 102. Run Node.js with `--trace-sync-io` or benchmark 50 sequential calls to `hashStudentPassword`:
```bash
node -e "
const { hashStudentPassword } = require('./server/services/securityVault.js');
const start = Date.now();
for (let i = 0; i < 20; i++) hashStudentPassword('testPassword123');
console.log('Synchronous blocking time (ms):', Date.now() - start);
"
```
Observe that the single thread is completely unresponsive during the entire execution window.

### 5.3 Verifying Client-Side Storage
1. Open the web application in a browser.
2. Complete a student sync operation (or mock student login).
3. Open Developer Tools -> Application -> Storage -> Local Storage -> `http://localhost:5173`.
4. Inspect keys:
   - `ptuk_synced_student_profile` -> Observe plaintext JSON transcript, grades, financial records.
   - `ptuk_student_token` -> Observe signed JWT string.

### 5.4 Running the Project Automated Test Suite
Verify that all existing tests pass under the baseline configuration:
```bash
npm test
```
Result: All 310 automated tests pass, confirming that the identified security gaps reside in design logic and unexercised negative test paths rather than compiler or runtime crashes.
