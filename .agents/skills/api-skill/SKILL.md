---
name: ptuk-registration-api
description: Build, extend, debug or review a complete, production-grade course-registration API for PTUK (Palestine Technical University – Khadoorie) that drives the Edugate online registration portal (edugate.ptuk.edu.ps/student/onlineRegistration) with Playwright. Use this skill whenever the user mentions Edugate, PTUK registration, course registration automation, seat watching, Plan A/B/C fallback registration, PrimeFaces/JSF scraping, or the planner project's server/ folder (registration.js, registrationEngine.js, edugateLiveRegistration.js, studentPortalService.js, securityVault.js), even if they do not say "skill" or "API".
---

# PTUK Registration API

Goal: a registration API that actually works against the real portal, is safe with student credentials, and can be tested without touching the university's servers.

The single most important rule: **never write code that depends on portal details you have not seen.** Selectors, field names, button labels, PrimeFaces response shapes and Arabic message texts must come from captured evidence (HTML, HAR, screenshots, traces) supplied by the user or recorded by you. If evidence is missing, write the code against a clearly marked adapter interface, tell the user exactly what to capture, and stop short of pretending it works.

## Language

- Talk to the user in Arabic (clear, friendly, Palestinian-dialect-tolerant). Keep code, identifiers, comments, commit messages and log keys in English.
- Do not mix Arabic and English inside the same sentence. Technical terms (Playwright, ViewState, idempotency) may stay in English inside Arabic prose.
- Arabic data from the portal (course names, days, notices) is processed as Arabic. Normalize Arabic-Indic and Persian digits to ASCII before comparing or storing.

## How to think (the mindset)

1. **Evidence before code.** Capture first, then write. A selector that was guessed is a bug that has not fired yet.
2. **Verify state, not actions.** A click succeeding means nothing. After every add/drop, re-read the registered-courses table and compare with what was intended.
3. **Fail closed.** On any unexpected page, message, timeout or ambiguity: stop, report, leave the account untouched. Never "try something else" on a real student account.
4. **Pure logic separated from I/O.** The planner (which section to try, when to fall back) is a pure function testable with fixtures. The browser layer only executes and reports.
5. **Dry-run is the default.** Live mode must be requested explicitly, per request, and must be impossible to trigger by accident (missing flag = simulation).
6. **Minimize what you hold.** Passwords live in memory for one session, are never logged, stored, or returned, and are dropped in `finally`.
7. **Be a polite client.** Low request rates, one browser per student at a time, global concurrency cap, no polling storms. The university can block an IP or an account.
8. **Say what is unverified.** At the end of every task, list what was verified against real evidence and what is assumed.

## Safety and scope rules

- Default design: run on the student's own machine (local Node script) or inside the student's own logged-in browser session (extension/userscript). Credentials then never leave their device.
- If a hosted server is requested, it must: require explicit student consent, hold the password only for the duration of one request, never persist it, never include it in errors or logs, use HTTPS only, and rate-limit per student and per IP. Warn the user about the liability of handling other students' Edugate passwords and the possibility of account/IP blocking. Suggest checking PTUK's usage rules.
- Never build anything that bypasses authentication, CAPTCHAs, payment/financial holds, or the registration window being closed. If the window is closed, report it and stop.
- Never register on behalf of someone who has not provided their own credentials and consent.
- Do not store or log: passwords, raw cookies, session tokens, full ViewState values.

## Workflow

Work in phases. Do not start a phase until the previous one is verified or the user explicitly accepts the risk.

### Phase 0: Discover (evidence)

Ask the user for, or record yourself, the following (with personal data and cookies removed):

- [ ] Login page HTML and the post-login landing page HTML
- [ ] Registration page HTML in each state: window closed, window open and empty, after adding one course, after a failure
- [ ] HAR or Network capture for: login, search course, add section, drop section
- [ ] Exact texts of success and error messages (section full, time conflict, prerequisite missing, hours limit, financial hold, window closed)
- [ ] Which PrimeFaces version is loaded (check `PrimeFaces.version` in the browser console)

Tool for recording: `npx playwright codegen https://edugate.ptuk.edu.ps/student/onlineRegistration` plus the browser's Network tab. Save a Playwright trace (`context.tracing.start({screenshots:true, snapshots:true})`) for later review.

Save evidence under `server/services/scrapers/__fixtures__/` (sanitized). These fixtures drive the tests in Phase 5.

### Phase 1: Read-only portal status

Implement `checkOnlineRegistrationStatus` first. It logs in, reads the registration page, classifies the state, and logs out. No mutations. Classification must be an enum, not free text:

`portal_open | portal_closed | financial_hold | login_failed | portal_unreachable | unknown_page`

`unknown_page` is the safe fallback: save a redacted screenshot/HTML snapshot for debugging and return it.

### Phase 2: Session module

One class owns the browser lifecycle.

```js
// server/services/scrapers/edugateSession.js
import { chromium } from "playwright";

export class EdugateSession {
  constructor({ headless = true, timeoutMs = 20000 } = {}) {
    this.headless = headless;
    this.timeoutMs = timeoutMs;
  }

  async open() {
    this.browser = await chromium.launch({ headless: this.headless });
    this.context = await this.browser.newContext({ locale: "ar-PS" });
    this.context.setDefaultTimeout(this.timeoutMs);
    this.page = await this.context.newPage();
    return this;
  }

  async close() {
    // Always safe to call, even after partial failure.
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
  }
}

// Usage: always try/finally
export async function withSession(fn) {
  const session = await new EdugateSession().open();
  try {
    return await fn(session.page);
  } finally {
    await session.close();
  }
}
```

Login rules:

- Locate fields by role, label, `type` or stable attributes taken from captured HTML. Never use auto-generated JSF ids like `j_idt17` as the only locator; if they are the only option, isolate them in one `selectors.js` file with a comment pointing to the fixture they came from.
- After submit, wait for a post-login element or an error element, then branch. Never assume success.
- Throw typed errors (see Error taxonomy), never raw strings.

### Phase 3: Registration executor

Per-course algorithm (adapt actions to captured evidence):

1. Search/select the course by code.
2. Select the target section.
3. Trigger add and wait for the PrimeFaces AJAX cycle to finish.
4. Read the server message and classify it using the message catalog.
5. Re-read the registered-courses table and confirm the section is present.
6. Record the result; only then move to the next course.

Waiting for PrimeFaces AJAX (verify this API exists in the portal's version before relying on it):

```js
export async function waitForPrimeFacesIdle(page, timeout = 15000) {
  await page.waitForFunction(
    () =>
      !window.PrimeFaces ||
      window.PrimeFaces.ajax?.Queue?.isEmpty?.() !== false,
    null,
    { timeout },
  );
}
```

Never use fixed sleeps as the synchronization mechanism. A short human-like pause between courses is fine as rate limiting, not as waiting.

Message catalog: keep a single `messages.js` mapping normalized Arabic message text (regex) to codes. Normalize before matching (trim, collapse whitespace, unify alef/yeh variants, digits to ASCII). Unmatched text maps to `UNKNOWN_MESSAGE` and halts the batch.

### Phase 4: Planner and fallback engine (pure logic)

`registrationEngine.js` exports pure functions; no Playwright import.

```js
// Input
{
  plans: { A: [item...], B: [item...], C: [item...] },
  catalog: { /* courses and sections from DB */ },
  student: { passedCodes: [], completedHours, maxHours },
  options: { targetPlan: "A", autoFallbackOnFull: true }
}
// item: { courseCode, sectionPrimary, sectionFallbacks: [] }
```

The planner must, before any browser work:

- Validate every item against the catalog (course exists, section exists, section belongs to course).
- Detect time conflicts between chosen sections (use normalized 24h slots and day letters ح ث خ ن ر etc. exactly as defined in the existing parser; do not invent the mapping, read it from the code or data).
- Check prerequisites against the student record and the total hours limit.
- Produce an ordered list of actions plus the fallback chain per course.

Fallback rules:

- Fall back only on codes classified as `SECTION_FULL` (and optionally `TIME_CONFLICT` with that section). Never fall back on `UNKNOWN_MESSAGE`, `LOGIN_FAILED`, `FINANCIAL_HOLD` or `WINDOW_CLOSED`: halt.
- A fallback section must be re-validated for conflicts with everything already registered in this batch.
- Plan-level fallback (A to B to C) switches only when the user enabled it and only for the courses that failed, unless the user states plans are all-or-nothing. Make this an explicit option with a documented default.
- Cap total attempts per course and per batch.

### Phase 5: API layer

Keep the existing Express structure (`server/app.js`, `server/routes/*`, `server/services/*`, `server/middleware/*`). Routes are thin: validate, call a service, shape the response.

Endpoints and contract (all JSON, all responses `{ success, data?, error? }`):

| Route                                  | Mutates portal?                 | Notes                                                    |
| -------------------------------------- | ------------------------------- | -------------------------------------------------------- |
| `POST /api/registration/portal-status` | No                              | Login + classify + logout                                |
| `POST /api/registration/prewarm`       | No                              | Reachability and latency only                            |
| `POST /api/registration/test-request`  | No                              | Validates plans against catalog, returns planned actions |
| `POST /api/registration/check-seats`   | No                              | Read-only, cached, throttled                             |
| `POST /api/registration/execute`       | Only if `options.live === true` | Idempotent, serialized per student                       |

Request validation: use a schema validator (zod or similar). Reject unknown fields. Limit array sizes (plans, items). Normalize `studentId`.

`execute` requirements:

- `idempotencyKey` required in live mode. Store `key -> {status, result}`; a repeated key returns the stored result and never re-runs. Mark `in_progress` atomically before starting so a double submit cannot run twice.
- A per-student mutex: at most one live session per student.
- Global concurrency semaphore for browsers (default 2).
- Overall timeout with guaranteed cleanup.
- Response lists, per course: `status` (`registered | failed | skipped`), `sectionRegistered`, `usedFallback`, `errorCode`, `verified` (boolean from the table re-read), `timestamps`.

Error taxonomy (stable codes, mapped to HTTP statuses):

`VALIDATION_ERROR (400) | LOGIN_FAILED (401) | WINDOW_CLOSED (409) | FINANCIAL_HOLD (409) | SECTION_FULL | TIME_CONFLICT | PREREQ_MISSING | HOURS_LIMIT | UNKNOWN_MESSAGE | PORTAL_UNREACHABLE (503) | TIMEOUT (504) | RATE_LIMITED (429)`

Logging:

- Structured logs with `requestId`, `studentIdHash` (not the raw id), phase, action, duration, code.
- A redaction layer that strips `password`, `cookie`, `authorization`, `viewstate` keys before anything is written. Add a unit test that fails if a known password string appears in captured log output.

Auth for the app's own sessions: signed token with expiry; the student id inside the token must equal the requested resource's student id (prevents IDOR). Constant-time comparison for secrets. Do not put Edugate cookies in the token.

Data at rest: if student records are cached, encrypt with AES-256-GCM using a random 12-byte IV per record and keys from environment variables, never from source code. The Edugate password is not part of what gets stored.

### Phase 6: Testing without the university

Required before any live run:

1. **Planner unit tests**: conflicts, prerequisites, hours, fallback order, "do not fall back on unknown message".
2. **Message catalog tests**: every captured message text maps to the expected code, including Arabic digit/letter variants.
3. **Fake portal**: a small local server (Express or Playwright `page.route`) that serves the sanitized fixtures and simulates states: window closed, section full, conflict, slow response, session expiry. Run the executor against it in CI.
4. **Redaction test**: no secrets in logs.
5. **Idempotency test**: two concurrent identical requests produce one execution.

Live rollout ladder (stop at the first failure):

1. `portal-status` with the user's own account.
2. `test-request` with the real plan.
3. Live `execute` with one low-stakes course, headed browser (`headless: false`) so the user watches.
4. Live `execute` with the full plan, only after the user confirms.

Always keep the manual registration path available and tell the user to keep the portal open in their normal browser as a backup during the real registration window.

### Phase 7: Seat watcher

- Poll no faster than every 30 to 60 seconds, with jitter, per course set. Stop automatically when the target state is reached or after a max duration.
- Cache results briefly and share one poll across multiple watchers of the same course.
- Back off exponentially on errors or rate limits.

## Project conventions

- Node.js ESM, Express, Playwright, existing SQLite/Supabase data layer.
- No new dependency without a one-line justification.
- Config via environment variables with a validated schema at startup; the server refuses to start in production if secrets are missing.
- Every module exports small functions with JSDoc types for inputs and outputs.
- Selectors live only in `selectors.js`; messages only in `messages.js`; both reference the fixture they were derived from.

## Output checklist for every task

Before finishing, report in Arabic:

1. What was built or changed (files).
2. What was verified against real evidence and how.
3. What is assumed and what evidence is still needed.
4. How to run the tests and the next rollout step.
5. Any security or account-risk issue noticed.

## Things to ask the user instead of assuming

- Where will it run: local script, browser extension, or hosted server?
- Are plans all-or-nothing, or per-course fallback?
- The hours limit and prerequisite rules to enforce (or whether to trust the portal to enforce them).
- Whether the portal's registration window is open right now, so live evidence can be captured.
