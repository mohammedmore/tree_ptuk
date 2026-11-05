# Backend Security Hardening Implementation Plan (OWASP & NIST Standards)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement maximum, world-class backend and API security hardening across the PTUK Course Planner platform adhering to OWASP Top 10 API Security (2023), OWASP ASVS v4.0.3, and NIST SP 800-63B standards.

**Architecture:** Defense-in-depth with zero-trust model: SQLite-backed persistent security state (tokens & lockouts) with L1 in-memory caching, fail-closed Zod request validation, BOLA/IDOR protection, dual-key contextual rate limiters, strict data leak sanitization, and production fail-fast environment gating.

**Tech Stack:** Node.js, Express 4.x, better-sqlite3 (WAL mode), Zod, crypto (AES-256-GCM, HMAC-SHA256, scrypt), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-backend-security-hardening-design.md`

## Global Constraints

- Node.js ES modules (`"type": "module"`).
- Better-sqlite3 transactional consistency with WAL mode.
- Strict backwards compatibility: All 222 existing tests in `npm test` must continue passing.
- Zero-fluff, production-grade, asynchronous code.

## Review Focus

1. `authHash` exposure in `GET /api/student/:studentId`: Must be strictly stripped before output.
2. Token revocation and account lockout surviving restarts: Must persist across process recycles in SQLite.
3. Campus NAT IP collisions: Multiple distinct students from the same university IP must not block each other while credential spraying from a single IP is capped.
4. BOLA in registration: Authenticated sessions executing registration must not target arbitrary third-party student IDs without authorization.
5. Insecure production startups: Missing `SESSION_SECRET` or admin keys in production must halt immediately.

---

### Task 1: SQLite Persistent Security State Tables & DAL

**Files:**

- Modify: `server/sqliteDb.js:30-115`
- Test: `tests/security.test.ts`

- [ ] Add `revoked_tokens` table with index on `expires_at` in `initTables()`.
- [ ] Add `account_lockouts` table with index on `locked_until` in `initTables()`.
- [ ] Export `sqliteRevokeToken(signature, expiresAt)` and `sqliteGetRevokedTokens()`.
- [ ] Export `sqliteSaveAccountLockout(studentId, attempts, firstAttemptAt, lockedUntil)` and `sqliteGetAccountLockouts()`.
- [ ] Export `sqliteDeleteAccountLockout(studentId)`.
- [ ] Export `sqlitePruneExpiredSecurityState()`.
- [ ] Run automated tests to verify table initialization and basic DAL operations.

---

### Task 2: Security Vault Persistent State & Zero-Leak Sanitizer

**Files:**

- Modify: `server/services/securityVault.js:180-370`
- Test: `tests/security.test.ts`

- [ ] Hydrate L1 memory cache from SQLite on startup (`sqliteGetRevokedTokens`, `sqliteGetAccountLockouts`).
- [ ] Update `revokeSessionToken(token)` to write to SQLite and update memory Map.
- [ ] Update `recordFailedLogin(studentId)` to write to SQLite and update memory Map.
- [ ] Update `recordSuccessfulLogin(studentId)` to delete from SQLite and remove from memory Map.
- [ ] Implement `sanitizeStudentRecordForClient(record)` stripping `authHash`, `password`, and internal DB markers.
- [ ] Include unique cryptographic nonce (`jti`) in `signSessionToken` to prevent replay attacks.
- [ ] Add automated tests for persistent revocation, persistent lockout, and `sanitizeStudentRecordForClient`.

---

### Task 3: Fail-Closed Zod Schemas & Validation Middleware

**Files:**

- Modify: `server/validators.js:1-58`
- Test: `tests/security.test.ts`

- [ ] Define `studentSyncSchema` and `studentIdParamSchema`.
- [ ] Define `registrationPrewarmSchema`, `registrationExecuteSchema`, `registrationPortalStatusSchema`, `registrationTestRequestSchema`, and `registrationCheckSeatsSchema`.
- [ ] Define `syncPtukSchema`.
- [ ] Implement `validateBody(schema)` and `validateParams(schema)` rejecting unauthorized unknown keys.
- [ ] Add unit tests verifying validation acceptance and rejection.

---

### Task 4: Two-Tier Dual-Key Rate Limiting & Identity Extractor

**Files:**

- Modify: `server/middleware/rateLimiters.js:1-104`
- Modify: `server/middleware/security.js:215-233`
- Test: `tests/security.test.ts`

- [ ] Implement `extractClientIdentity` middleware extracting student identity from token or body.
- [ ] Update `authLimiter` with dual-key keyGenerator (`${req.ip}:${studentId || 'anon'}`) and raw IP safety cap.
- [ ] Update `registrationLimiter` with dual-key keyGenerator.
- [ ] Add tests simulating campus NAT with multiple student IDs sharing one IP.

---

### Task 5: Route Protection & BOLA / Leak Remediation

**Files:**

- Modify: `server/routes/student.js:1-210`
- Modify: `server/routes/registration.js:1-259`
- Modify: `server/routes/sync.js:1-132`
- Test: `tests/security.test.ts`

- [ ] Apply `validateBody(studentSyncSchema)` to `POST /api/student/sync`.
- [ ] Apply `sanitizeStudentRecordForClient` to `GET /api/student/:studentId` (fixing `authHash` leak).
- [ ] Apply `validateBody` across registration routes (`prewarm`, `execute`, `portal-status`, `test-request`, `check-seats`).
- [ ] Enforce BOLA check in `POST /api/registration/execute` (session studentId must match payload studentId).
- [ ] Apply `validateBody(syncPtukSchema)` to `POST /api/sync/ptuk`.

---

### Task 6: Production Fail-Fast & HTTP Security Headers Hardening

**Files:**

- Modify: `server/app.js:40-150`, `server/app.js:235-260`
- Test: `tests/security.test.ts`

- [ ] Update `validateProductionSecurityEnvironment` to strictly exit (`process.exit(1)`) on missing secrets in production.
- [ ] Support comma-separated origins in `FRONTEND_URL` for flexible, secure CORS whitelisting.
- [ ] Add `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, and `X-Permitted-Cross-Domain-Policies: none`.
- [ ] Run full test suite (`npm test`) to verify all 222+ tests pass without errors.
