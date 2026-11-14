## 2026-11-14T08:36:20Z
You are worker_m2_gen2 (Global Standards Verification Worker).
Working directory: c:\Users\mohammed\Desktop\planner\.agents\teamwork\worker_m2_gen2\
Parent orchestrator conversation ID: a79c51f6-fe5e-4dd7-9ae9-78365502b514

MANDATORY FIRST STEP:
Read the following authoritative project files before doing anything:
- c:\Users\mohammed\Desktop\planner\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\mohammed\Desktop\planner\PROJECT.md
- c:\Users\mohammed\Desktop\planner\.agents\teamwork\explorer_m2_1\handoff.md
- c:\Users\mohammed\Desktop\planner\.agents\teamwork\explorer_m2_2\handoff.md
- c:\Users\mohammed\Desktop\planner\.agents\teamwork\explorer_m2_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

WRITE OWNERSHIP & SCOPE BOUNDARY:
- You exclusively own: `tests/standardsAudit.test.ts` and files in your working directory `c:\Users\mohammed\Desktop\planner\.agents\teamwork\worker_m2_gen2\`.
- ZERO MODIFICATIONS TO EXISTING APPLICATION SOURCE: You MUST NOT modify, touch, or edit ANY files in `src/`, `server/`, or `scripts/`. `git diff HEAD -- src/ server/ scripts/` must remain completely empty (0 diff lines).

YOUR MISSION:
Synthesize the findings from Explorers 1, 2, and 3 into an automated, programmatic global standards verification test suite in `tests/standardsAudit.test.ts` and run full standards verification against the unmodified codebase.

Specifically, in `tests/standardsAudit.test.ts` (using Node.js native test runner `node:test` and `node:assert/strict`):
1. TypeScript Strictness Verification:
   - Programmatically run or verify compiler configuration in `tsconfig.json` (strict: true, allowJs: false).
   - Programmatically run and assert that running `tsc --noEmit` under current baseline exits with 0 errors.
   - Programmatically execute and assert that running with `--noUncheckedIndexedAccess` detects the 549 latent errors, proving the existence of permissive compiler flags.
   - Programmatically parse `src/` to assert exact counts/locations of `any` usages and non-null assertions (`!`).
2. ESLint & Static Analysis Verification:
   - Programmatically inspect `eslint.config.js` and verify it contains 0 active lint rules.
   - Programmatically verify that `package.json`'s `"lint"` script executes only `tsc --noEmit` and that `eslint` is absent from dependencies.
3. Code Modularity & Complexity Verification:
   - Programmatically measure file lengths and verify that monolithic files (`studentPortalService.js` 3,881 lines, `RegistrationPage.tsx` 3,793 lines, `WeeklyScheduleModal.tsx` 3,543 lines, `CoursesPage.tsx` 2,966 lines, `SemesterPlanningPage.tsx` 2,873 lines, `App.tsx` 2,310 lines) exceed acceptable modular limits (>1,000 lines).
   - Programmatically verify that Zustand stores (`useAcademicStore`, `useScheduleStore`, `useUIStore`) are bypassed by all core pages.
4. WCAG 2.1 AA Accessibility Verification:
   - Programmatically scan modal components and verify that 24 ad-hoc modals bypass `BaseModal.tsx` and lack Tab traps or Escape listeners.
   - Programmatically verify that dynamic seat watcher alerts and status toasts lack `aria-live="polite"` regions.
   - Verify color contrast calculations: calculate that `text-slate-400` against white (`#94a3b8` on `#ffffff`) yields a contrast ratio of 2.57:1 (failing the 4.5:1 WCAG AA threshold).
   - Programmatically verify missing `<label htmlFor="...">` associations in forms.
5. OWASP ASVS Security Verification:
   - Programmatically audit `server/routes/registration.js` and verify the BOLA / unauthenticated execution vulnerability condition on line 199.
   - Programmatically scan `src/services/studentService.ts` and verify sensitive keys (`ptuk_synced_student_profile`, `ptuk_student_token`) are targeted to `localStorage`.
   - Programmatically verify synchronous `crypto.scryptSync` invocations in `server/services/securityVault.js`.
   - Programmatically verify `rejectUnauthorized: false` in `server/scrapers/academicCalendarScraper.js` (or applicable scraper).

TEST & VERIFICATION EXECUTION:
1. Run `node --import tsx --test tests/standardsAudit.test.ts`. All assertions must pass (100%).
2. Run `npm run lint` (`tsc --noEmit`). Confirm 0 errors.
3. Run `npm test` (`node scripts/audit-illusions.js && node --import tsx --test "tests/*.test.ts"`). Confirm 0 academic illusions and 100% test pass rate across all suites.
4. Run `git diff HEAD -- src/ server/ scripts/`. Confirm 0 lines diff.

OUTPUT:
Write your structured handoff report to:
`c:\Users\mohammed\Desktop\planner\.agents\teamwork\worker_m2_gen2\handoff.md`
Report must follow the Handoff Protocol: Observation, Logic Chain, Caveats, Conclusion, Verification Method. Include full execution logs and standards compliance matrices.
When finished, notify the orchestrator via send_message.
