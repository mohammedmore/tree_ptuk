# Backend & API Maximum Security Hardening Design

**Date**: 2026-11-05  
**Status**: Ready for Implementation (Builder Checked)  
**Approach**: Option 2 — Zero-Trust & Defense-in-Depth with Persistent Security State

---

## 1. Intent and Why

The PTUK Course Planner backend handles student authentication, course synchronization, academic records, and automated course registration. Because students authenticate using university portal credentials and manage real academic schedules, the system requires an uncompromising security baseline.

Currently:

1. Student credential hashes (`authHash`) are inadvertently returned in `GET /api/student/:studentId`.
2. Input validation across mutating and scraper-launching routes relies on ad-hoc regex checks rather than enforced, fail-closed Zod schemas.
3. Security state tracking (revoked session tokens and account brute-force lockouts) resides solely in ephemeral memory (`Map`), meaning a process restart clears active lockouts and allows revoked tokens to be reused.
4. IP-based rate limiting treats campus Wi-Fi / NAT proxies as single actors, creating risk of denial-of-service for legitimate students sharing university IP addresses while leaving the system vulnerable to horizontal credential stuffing across accounts.
5. In production, missing critical security secrets (`SESSION_SECRET`, `ADMIN_API_KEY`) logs a warning rather than failing fast, risking key mismatch or data loss across restarts.

Hardening the system to the maximum standard eliminates these vulnerabilities while maintaining sub-second response times and seamless UX.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals

- **Eliminate Data Leaks**: Zero exposure of `authHash`, internal password structures, or private server metadata in any HTTP API response.
- **Fail-Closed Input Validation**: Every request to student, registration, and sync routes must be strictly validated with Zod schemas before executing any business logic or launching scrapers.
- **Persistent Security State**: Token revocations and brute-force lockouts persisted in SQLite (WAL mode) with an in-memory L1 cache for sub-millisecond read access, surviving reboots and container recycles.
- **Two-Tier Contextual Rate Limiting**: Coordinated rate limiting based on composite keys (`ip:studentId`) combined with account lockout and raw IP caps to protect students behind university NAT gateways while mitigating credential stuffing.
- **Fail-Fast Environment Sanity**: Server immediately halts on startup in production if `SESSION_SECRET` (min 32 chars) is missing or if neither `ADMIN_API_KEY` nor `SYNC_API_KEY` is configured.
- **Multi-Origin CORS Hardening**: Support comma-separated origins and strict regex origin checking for production domains.

### Non-Goals

- Changing the frontend UI components or student user experience.
- Altering the core Edugate scraping / Playwright registration logic unless required for security sanitization.
- Replacing SQLite or Supabase with another database engine.

### Anti-Goals

- Introducing breaking changes that invalidate valid demo mode logins or existing mobile app API consumers.
- Degrading the zero-second cache hit performance (`fromCache: true`) for student record lookups.
- Allowing malformed, untyped, or oversized payloads to bypass the application gateway.

---

## 3. Constraints

- **Stack**: Node.js (ES modules), Express 4.x, better-sqlite3 (WAL mode), Zod, Playwright.
- **Architecture**: Single-process Node deployment with persistent SQLite database on disk.
- **Backwards Compatibility**: Existing test suites (222 tests) must continue to pass with 100% success.
- **Direct SRE Directives**: Clean, production-ready, performant async code conforming to zero-fluff directives.

---

## 4. Approaches Considered

### Option 1: Defense-in-Depth & Zero-Trust (Memory State)

- Implements response sanitization, Zod validation, dual-key rate limiting, and fail-fast environment.
- Keeps token revocation and lockout state in memory Maps.
- _Trade-off_: Fast, but state is lost across process restarts or container recycling.

### Option 2: Zero-Trust & Defense-in-Depth with Persistent Security State **[CHOSEN]**

- Implements all features of Option 1.
- Adds persistent SQLite tables (`revoked_tokens` and `account_lockouts`) backed by an in-memory L1 cache (write-through + periodic expiry cleanup).
- _Trade-off_: Adds minimal transactional SQLite writes on token revocation and failed login events, but guarantees unshakeable security against restart attacks.
- _Rationale_: Selected by user to achieve maximum security robustness.

### Option 3: Boundary-Only Middleware Hardening

- Restricts security fixes to Express request/response interceptors without touching internal models or DAL.
- _Trade-off_: Leaves internal services vulnerable if accessed through non-standard entry points or subroutines. Rejected.

---

## 5. Detailed Architecture & Implementation Specification

### 5.1 Data Leak Prevention & Sanitization

1. **Central Student Sanitizer**:
   Define `sanitizeStudentRecordForClient(record)` in `server/services/securityVault.js`:
   - Strips `authHash`, `password`, internal DB encryption markers, and raw session tokens.
   - Enforce this sanitizer in BOTH `server/routes/student.js`:
     - `POST /api/student/sync`
     - `GET /api/student/:studentId`
   - Add automated test verifying that `GET /api/student/:studentId` NEVER includes `authHash`.

### 5.2 Persistent Security State in SQLite (Single-Process + Reboot Resilience)

1. **New SQLite Tables** in `server/sqliteDb.js`:
   ```sql
   CREATE TABLE IF NOT EXISTS revoked_tokens (
     signature TEXT PRIMARY KEY,
     expires_at INTEGER NOT NULL,
     revoked_at TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_revoked_tokens_exp ON revoked_tokens(expires_at);

   CREATE TABLE IF NOT EXISTS account_lockouts (
     student_id TEXT PRIMARY KEY,
     attempts INTEGER NOT NULL DEFAULT 0,
     first_attempt_at INTEGER NOT NULL,
     locked_until INTEGER NOT NULL DEFAULT 0,
     updated_at TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_account_lockouts_locked ON account_lockouts(locked_until);
   ```
2. **L1 Read Cache + Write-Through Storage** in `server/services/securityVault.js`:
   - **Startup Hydration**: On server initialization, load active unexpired lockouts (`locked_until > now` or `now - first_attempt_at < 15m`) and unexpired token signatures (`expires_at > now`) into memory Maps.
   - **Write-Through**:
     - `revokeSessionToken(token)`: Persists signature to SQLite `revoked_tokens` and updates memory Map.
     - `recordFailedLogin(studentId)`: Upserts to SQLite `account_lockouts` and updates memory Map.
     - `recordSuccessfulLogin(studentId)`: Deletes from SQLite `account_lockouts` and removes from memory Map.
   - **Sub-millisecond Reads**:
     - `isSessionTokenRevoked(token)`: O(1) in-memory check.
     - `isAccountLocked(studentId)`: O(1) in-memory check.
   - **Maintenance Routine**: Auto-cleanup every 60 minutes removes expired entries from both SQLite and memory.

### 5.3 Comprehensive Fail-Closed Schema Validation (Zod)

Define and mount strict Zod schemas across **all** mutating and scraper-launching routes in `server/validators.js`:

1. **Student Routes**:
   - `studentSyncSchema`:
     - `studentId`: String, trimmed, min 3, max 40, regex `/^[a-zA-Z0-9._\-@]{3,40}$/`.
     - `password`: String optional, max 128.
     - `demoMode`: Boolean optional default false.
     - `forceLive`: Boolean optional default false.
   - `studentParamSchema`:
     - `studentId`: Min 3, max 40, regex `/^[a-zA-Z0-9._\-@]{3,40}$/`.
2. **Registration Routes**:
   - `registrationPrewarmSchema`:
     - `studentId`: Min 3, max 40, regex `/^[a-zA-Z0-9._\-@]{3,40}$/`.
     - `password`: String optional, max 128.
     - `demoMode`: Boolean optional default false.
   - `registrationExecuteSchema`:
     - `studentId`: Min 3, max 40, regex `/^[a-zA-Z0-9._\-@]{3,40}$/`.
     - `password`: String optional, max 128.
     - `plans`: Object containing plans A, B, C (non-empty object).
     - `options`: Optional configuration (targetPlan, autoFallbackOnFull, requireAllOrNothing, demoMode, idempotencyKey).
   - `registrationPortalStatusSchema`:
     - `studentId`: Min 3, max 40, regex `/^[a-zA-Z0-9._\-@]{3,40}$/`.
     - `password`: String, min 1, max 128.
   - `registrationTestRequestSchema`:
     - `studentId`: Min 3, max 40.
     - `password`: String optional, max 128.
     - `plan`: Object optional.
     - `demoMode`: Boolean optional.
     - `semester`: String optional, regex `/^\d{4,6}$/`.
   - `registrationCheckSeatsSchema`:
     - `courseCodes`: Array of strings (max 100 items, each 2-20 chars).
3. **Sync Routes**:
   - `syncPtukSchema`:
     - `cookie`: String, min 1, max 4096.
     - `viewState`: String, min 1, max 8192.
     - `branch`: String optional, max 10.

### 5.4 Two-Tier Contextual Rate Limiting (Campus NAT + Botnet Defense)

1. **Client Identity Extraction Middleware**:
   Add a lightweight middleware `extractClientIdentity` mounted before rate limiters:
   - Extracts student ID from session token (Authorization header) or request body if present (`req.body?.studentId`).
   - Normalizes studentId (standardizing Arabic digits and lowercasing).
   - Sets `req.clientIdentity = req.studentId ? `${req.ip}:${req.studentId}` : req.ip`.
2. **Rate Limiting Tiers**:
   - **Tier 1 (Per-Account Velocity & Lockout)**: `accountLockouts` (5 failed logins per 15 mins locks account, preventing single-account brute-force from any IP or distributed botnet).
   - **Tier 2 (Dual-Key Auth & Registration Limiters)**:
     - `authLimiter`: Keyed by `req.clientIdentity`. Allows legitimate concurrent campus users without IP collisions.
     - Upper-bound raw IP limiter: Prevents a single IP from attempting hundreds of distinct accounts (horizontal credential spraying).
   - **Tier 3 (Global Limiter)**: Increased headroom for trusted local/dev environments and normalized IP parsing (`trust proxy 1`).

### 5.5 Environment Validation & Fail-Fast Startup

Update `validateProductionSecurityEnvironment()` in `server/app.js`:

- In production (`NODE_ENV === 'production'`):
  - If `!process.env.SESSION_SECRET` or `SESSION_SECRET.length < 32`:
    Fatal error log and `process.exit(1)`.
  - If `!process.env.ADMIN_API_KEY && !process.env.SYNC_API_KEY`:
    Fatal error log and `process.exit(1)` (preserves interoperability while enforcing at least one authorized admin secret).
  - Support comma-separated origins in `FRONTEND_URL` for flexible, secure CORS whitelisting across production preview environments.

---

## 6. Verification and Testing Plan

1. **Automated Unit Tests (`tests/security.test.ts`)**:
   - Persistent Token Revocation test: Revoke token, verify in SQLite, restart cache, verify token remains revoked.
   - Persistent Account Lockout test: Record failed logins, verify in SQLite, restart cache, verify account remains locked.
   - Sensitive Data Leak test: Call `GET /api/student/:studentId` and verify `authHash` is strictly undefined.
   - Zod Schema Validation tests: Test valid and invalid payloads across all 6 new schemas.
   - Dual-Key Rate Limiting tests: Verify campus NAT simulation allows distinct student accounts on the same IP.
2. **Integration Regression Test**:
   - Run complete suite (`npm test`) to ensure all 222+ existing tests pass.
