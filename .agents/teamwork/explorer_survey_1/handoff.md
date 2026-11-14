# Codebase Infrastructure & Test Architecture Survey Report

## 1. Observation

### 1.1 Project Structure & Package Management
- **Root Directory**: `c:\Users\mohammed\Desktop\planner`
- **Package Manifest**: `package.json` (`react-example@2.1.0`, `"type": "module"`).
- **Package Lock**: `package-lock.json` (`lockfileVersion: 3`, confirming npm 7+ on Node.js 22.14.0).
- **Workspace Architecture**: Monolithic unified project combining Vite/React frontend and Express/better-sqlite3 backend in one repository without monorepo workspace sub-packages.
- **Key Directory Layout**:
  - `src/`: React 19 Frontend application (Vite 6, TypeScript 5.8.2, Tailwind CSS v4, Zustand 4.5.7, `@xyflow/react` 12.10.2, Lucide icons, Motion, jsPDF).
    - `src/App.tsx`: Central frontend routing and modal orchestrator.
    - `src/pages/`: 7 core pages (`LoginPage.tsx`, `PlanPage.tsx`, `CoursesPage.tsx`, `WeeklySchedulePage.tsx`, `SemesterPlanningPage.tsx`, `RegistrationPage.tsx`, `GPAPage.tsx`).
    - `src/services/`: Frontend API wrappers (`studentService.ts`, `registrationService.ts`, `scheduleSolver.ts`, `courseService.js`, `majorService.ts`, `tuitionFeesService.ts`).
    - `src/stores/`: Zustand state management (`useAcademicStore.ts`, `useScheduleStore.ts`, `useUIStore.ts`, `useLanguageStore.ts`).
    - `src/core/`: Academic computation engines (`academicAdvisor.ts`, `academicPolicy.ts`, `advisoryPlan.ts`, `courseProgress.ts`).
    - `src/data/`: Static assets (`ptukAcademicCalendar.ts`).
    - `src/data.ts`: Static course catalog and degree category requirements.
  - `server/`: Express 4 backend server (`server/app.js` and root `Server.js`).
    - `server/routes/`: Express routers (`calendar.js`, `courses.js`, `majors.js`, `registration.js`, `student.js`, `sync.js`).
    - `server/services/`: Backend services (`studentPortalService.js`, `registrationEngine.js`, `seatSniperService.js`, `securityVault.js`, `observability.js`, `tuitionFeesService.js`).
    - `server/services/scrapers/`: Scrapers & message classifiers (`ptukScraper.js`, `edugateLiveRegistration.js`, `academicCalendarScraper.js`, `messages.js`).
    - `server/middleware/`: Security (`security.js`), rate limiting (`rateLimiters.js`), telemetry (`telemetry.js`), compression (`compression.js`).
    - `server/dal/`: Data Access Layers (`courses.dal.js`, `majors.dal.js`, `students.dal.js`, `syncStatus.dal.js`).
    - `server/sqliteDb.js`: Better-sqlite3 database manager for `data/planner.sqlite`.
    - `server/db.js`: Hybrid data layer bridging SQLite, JSON file storage (`data/db.json`), and optional Supabase PostgreSQL sync.
  - `data/`: Local persistent databases:
    - `data/planner.sqlite`: 3,129,344 bytes SQLite database with 10 tables and WAL mode enabled.
    - `data/db.json`: 1,878,522 bytes JSON persistence file with full catalog and cohort plans.
  - `scripts/`: Operational utilities:
    - `scripts/audit-illusions.js`: Pre-test verification scanner for PTUK academic integrity and anti-illusions.
    - `scripts/devAll.js`: Concurrent launcher for frontend Vite and backend Node server.
    - `scripts/autoSync.js` & `scripts/localAutoSync.js`: Sync routines.
    - `scripts/inspect-registration-portal.js`: University portal inspection tool.
  - `tests/`: 36 test files containing 273 unit, integration, and security tests.

### 1.2 Tooling Configurations & Build Scripts
- **TypeScript Configuration (`tsconfig.json`)**:
  - `target`: `ES2022`, `module`: `ESNext`, `moduleResolution`: `bundler`, `strict`: `true`, `noEmit`: `true`, `allowImportingTsExtensions`: `true`.
  - `paths`: `"@/*": ["./*"]` for absolute path aliases.
  - `lib`: `["ES2022", "DOM", "DOM.Iterable"]`.
  - Verification: `npm run lint` (`tsc --noEmit`) exited with code 0 (0 compilation errors).
- **ESLint Configuration (`eslint.config.js`)**:
  - Contains only an ignore block (`dist/**`, `node_modules/**`, `data/**`, `*.sqlite*`, `.agents/**`, etc.).
  - No active ESLint rules are configured; `eslint` is not declared in `package.json` devDependencies.
  - The `"lint"` script in `package.json` delegates directly to `tsc --noEmit`.
- **Formatting Configuration (`.prettierignore`)**:
  - Ignores `dist`, `node_modules`, `data`, `*.sqlite*`, `package-lock.json`, `.agents`, `.gemini`.
  - No `.prettierrc` file exists; defaults are used.
  - Verification: `npx prettier --check .` flagged 76 files with minor stylistic discrepancies.
- **Vite Build Configuration (`vite.config.ts`)**:
  - Plugins: `@vitejs/plugin-react`, `@tailwindcss/vite`.
  - Manual chunk splitting: `vendor-xyflow`, `vendor-icons`, `vendor-jspdf`, `vendor-canvas`, `vendor-supabase`, `vendor-dagre`.
  - Dev server proxy: `/api` -> `http://localhost:3001` with error fallback 503 response.
  - Verification: `npm run build` (`vite build`) successfully bundled 2,686 modules in 9.65s into `dist/`.

### 1.3 Test Frameworks, Suites & Verification Execution
- **Test Framework**: Native Node.js test runner (`node:test`) paired with `tsx` (`--import tsx`) and `node:assert/strict`.
- **Test Script (`package.json:18`)**:
  `"test": "node scripts/audit-illusions.js && node --import tsx --test \"tests/*.test.ts\""`
- **Pre-Test Integrity Scanner (`scripts/audit-illusions.js`)**:
  Scans 135 source files in `src/` to guarantee no hardcoded dummy student IDs (`202410001`, `202310123`, `12000000`), outdated fees (50 JOD instead of official 25 JOD), hardcoded majors, or invalid semester codes (`20241`, `20261`).
  - Execution Output:
    ```
    ----------------------------------------------------
    🔍 Running PTUK Academic Integrity & Illusions Audit...
    Scanned 135 source files.
    ✅ AUDIT PASSED: 0 illusions found! All files comply with official academic regulations.
    ----------------------------------------------------
    ```
- **Test Suite Results**:
  - Command: `npm test`
  - Total Tests: 273 tests across 36 files.
  - Result: 273 passed, 0 failed, 0 skipped, 0 cancelled.
  - Duration: 7,000.42 ms (~7.0 seconds).
  - Scope of existing suites:
    1. `academicAdvisor.test.ts` (8 tests): Critical path analysis, GPA simulation, graduation roadmap.
    2. `academicPolicy.test.ts` (7 tests): Academic warnings, credit limits (19/10 regular vs summer, 14/6 under warning), degree credits, official tuition calculations.
    3. `academicRecordScraper.test.ts` (11 tests): Arabic numeral normalization, semester chronological weights, prerequisite DAG linking, placement and exemption exams parsing.
    4. `advisoryPlan.test.ts` (12 tests): Degree length scaling (2-year diploma vs 4-year bachelor vs 5-year engineering), elective slot resolution, capstone & field training thresholds.
    5. `appStorage.test.ts` (7 tests): LocalStorage schema validation, versioning envelopes, legacy schedule alias migration.
    6. `backendApi.test.ts` (18 tests): Catalog endpoints, cohort plan dynamic saving, in-memory HTTP server endpoints (`GET /api/health`, `GET /api/registration/stream`, OpenAPI docs).
    7. `calendarAndTuition.test.ts` (7 tests): Academic calendar parsing, tuition currency conversions (JOD/ILS).
    8. `catalogDb.test.ts` (3 tests): SQLite catalog queries and cache invalidation.
    9. `courseCommunityService.test.ts` (5 tests): Shared course drive folders, community resources.
    10. `courseExplanations.test.ts` (3 tests): AI and static course explanation lookups.
    11. `courseOfferings.test.ts` (4 tests): Dynamic section filtering and offering tables.
    12. `courseProgress.test.ts` (28 tests): Remedial credit exclusion (English 15200099, Computer 13010006), degree credit sums, GPA calculation, cycle detection.
    13. `courseService.test.ts` (5 tests): Client-side catalog filtering and search.
    14. `csv.test.ts` (4 tests): CSV export formatting.
    15. `graphLayout.test.ts` (5 tests): Dagre DAG layout calculations for flowcharts.
    16. `haptics.test.ts` (2 tests): Mobile tactile feedback hooks.
    17. `i18n.test.ts` (2 tests): Arabic and English dictionary key parity and store toggling.
    18. `loginWaitExperience.test.ts` (5 tests): Portal login latency estimation and user guidance.
    19. `observability.test.ts` (7 tests): Prometheus metrics exposition (`/metrics`), live/ready probes (`/api/health/live`, `/api/health/ready`).
    20. `planningEnhancements.test.ts` (9 tests): Multi-semester roadmaps, bottleneck detection.
    21. `privacyMask.test.ts` (6 tests): CSS blur rules (`.privacy-sensitive`), student GPA & grade hiding.
    22. `registrationComponents.test.ts` (6 tests): Plan priority tables, prewarm status cards, tuition widgets.
    23. `registrationFailClosed.test.ts` (8 tests): Portal message classification (`SECTION_FULL`, `TIME_CONFLICT`, `FINANCIAL_HOLD`, `PREREQ_MISSING`, `HOURS_LIMIT`, `WINDOW_CLOSED`).
    24. `scheduleDrafts.test.ts` (4 tests): Schedule draft snapshots, persistence, and retrieval.
    25. `scheduleSolver.test.ts` (26 tests): Day normalization, time conflict detection, backtrack solver, schedule quality scoring, diversity selection.
    26. `scheduleSolverWorker.test.ts` (3 tests): Web Worker solver message passing.
    27. `seatSniper.test.ts` (5 tests): Target seat availability calculation, cascading sniping, SQLite tracked seats.
    28. `sectionSwap.test.ts` (6 tests): Direct section swap conflict checks and validation.
    29. `security.test.ts` (21 tests): AES-256-GCM encryption, HKDF key derivation, timing-safe string comparison, JWT session tokens, account lockout velocity checks, SSRF guard, BOLA prevention.
    30. `semesterRegistration.test.ts` (19 tests): 3-plan structure (Plan A/B/C), cascading fallback, collision detection, share code generation.
    31. `semesterUtils.test.ts` (11 tests): Semester weight ordering, upcoming semester auto-population, transcript parsing.
    32: `sharedSchedules.test.ts` (4 tests): PIN protection, hashing, verification, schedule sharing.
    33. `ssrfGuard.test.ts` (7 tests): Outbound URL sanitization, private IP blocking, host whitelisting.
    34. `stores.test.ts` (4 tests): Zustand stores state transitions (`useUIStore`, `useAcademicStore`, `useScheduleStore`).
    35. `utils.test.ts` (5 tests): Arabic text normalization, token matching, delivery type detection.
    36. `virtualizer.test.ts` (1 test): Virtualized list windowing interface.

### 1.4 Browser & End-to-End Automation Infrastructure
- `playwright`: Version `^1.63.0` is present in `dependencies`.
- Chromium binary verification:
  Command: `node -e "const { chromium } = require('playwright'); console.log(chromium.executablePath());"`
  Result: `C:\Users\mohammed\AppData\Local\ms-playwright\chromium-1243\chrome-win64\chrome.exe` is installed and immediately runnable without downloading.
- While `@playwright/test` runner is not in `devDependencies`, `playwright` core can be driven directly via Node.js scripts to automate headless browser interactions against `http://localhost:5173` or `http://localhost:4173`.

### 1.5 Local Mock Services & Data Fixtures
1. **Local SQLite Database (`data/planner.sqlite`)**:
   - High-performance WAL mode SQLite database populated with real PTUK catalog courses, sections, instructors, rooms, meeting schedules, majors, cohort plans, and academic calendar.
2. **Local JSON Database (`data/db.json`)**:
   - 1.8 MB structured JSON mirror containing course entities and section schedules.
3. **Dynamic Student Data Generator (`server/services/studentPortalService.js:buildCohortCurriculumAndProgress`)**:
   - Generates complete student profiles deterministically for any student ID in demo mode:
     - Calculates completed years from cohort year (`normId.slice(0, 4)`).
     - Assigns passed courses, grades, remedial courses (`15200099`, `13010006`), currently registered courses, and remaining degree requirements.
     - Saves student record to `data/planner.sqlite` and `data/db.json`.
     - Supports any custom student persona without network calls.
4. **Offline Registration Simulator (`server/services/registrationEngine.js:registerSelectedCourses`)**:
   - When `demoMode: true` or `password === "demo"`:
     - Completely bypasses `executeRealEdugateRegistration`.
     - Simulates realistic portal responses (section full, time conflicts, financial deficit).
     - Exercises cascading Plan A -> Plan B -> Plan C fallback logic.
     - Emits real-time progress events over Server-Sent Events (SSE) to the frontend.
5. **Academic Calendar Fixture (`server/services/scrapers/academicCalendarScraper.js:AUTHENTIC_FALLBACK_CALENDAR` & `src/data/ptukAcademicCalendar.ts`)**:
   - Complete semester registration milestones, drop/add deadlines, payment deadlines, and holidays.
6. **Curriculum Fixtures (`server/majorsData.js:AI_CURRICULUM_COURSES` & `src/data.ts`)**:
   - Detailed course trees with prerequisite graphs for Computer Systems Engineering (160+ credits) and AI / IT (132 credits).
7. **Portal Message Classifier Fixture (`server/services/scrapers/messages.js`)**:
   - Arabic portal status string parser mapping real Edugate message strings to strongly typed error codes.

---

## 2. Logic Chain

1. **Safety and Isolation Guarantee**:
   - *Premise*: Requirement R1 mandates that all testing and evaluation run strictly against local mock data without calling external university services, and without modifying existing source code.
   - *Observation*: Grep searches on `tests/` revealed that all 36 test files either test pure functions or instantiate ephemeral local in-memory servers via `node:http` on `127.0.0.1`. The references to `ptuk.edu.ps` in the tests are solely string literals used to verify URL validators (`ssrfGuard.test.ts`) and mock error handlers (`backendApi.test.ts`).
   - *Observation*: Both `studentPortalService.js` (lines 1483-1494) and `registrationEngine.js` (lines 24-34, 173-195) explicitly divert any request having `demoMode: true`, `studentId === "demo"`, or `password === "demo"` away from Playwright portal scraping into local mock generators.
   - *Inference*: Running test scripts, TypeScript verification, and persona evaluations using `demoMode: true` and local servers operates in 100% network isolation with zero risk of touching live university production systems.

2. **Test Infrastructure Capabilities**:
   - *Observation*: The project relies on Node.js 22's built-in `node:test` runner, with TypeScript handled dynamically at runtime via `tsx`.
   - *Observation*: Running `npm test` synchronously executes `node scripts/audit-illusions.js` followed by all 36 test files, completing 273 tests in 7.0 seconds with zero failures.
   - *Inference*: New automated test suites (for student personas, accessibility, UI validation) can be written using `node:test` and executed alongside or in the same pattern as existing tests without introducing new build tooling or altering project configuration.

3. **End-to-End Persona Journey Feasibility**:
   - *Observation*: Playwright is already installed in `node_modules` and its headless Chromium browser binary is present on the filesystem at `C:\Users\mohammed\AppData\Local\ms-playwright\chromium-1243\chrome-win64\chrome.exe`.
   - *Observation*: The application can be built cleanly via `npm run build` and served via `npx vite preview` (or `npm run dev:all`), while backend routes respond to mock credentials.
   - *Inference*: A standalone programmatic evaluation runner using Playwright and Chromium can launch headless sessions, navigate the live web interface across all 7 pages, log in with 10 distinct student personas (freshman, senior, probation, honor, working/commuter, transfer, financial hold, registration bottleneck, international, 4-year major), record UI/UX metrics, detect missing/redundant features, and audit WCAG accessibility standards.

---

## 3. Caveats

1. **ESLint Configuration**:
   - While `eslint.config.js` exists, it only contains ignore patterns and does not declare any active linting rules. ESLint is not present in `devDependencies`. The `npm run lint` script runs `tsc --noEmit`. Any global standards code quality audit must recognize that TypeScript compiler strict checking (`strict: true`, `noImplicitOverride: true`) is the enforced standard in this codebase.
2. **Prettier Stylistic Formatting**:
   - `npx prettier --check .` flagged 76 files with whitespace and formatting differences. Per the read-only constraint of this exploration mission, no source files were modified to fix formatting.
3. **Database Concurrency during Multi-Agent Persona Execution**:
   - `data/planner.sqlite` operates in WAL mode with a busy timeout of 5,000ms. If multiple persona journeys run concurrently and write to SQLite (e.g. saving tracked seats or session tokens), WAL mode handles concurrency well, but sequential execution of persona journeys or using unique persona IDs (e.g., `demo_freshman`, `demo_senior`, `demo_warning`) is recommended to prevent database lock contention.
4. **Local Network Boundary**:
   - Supabase environment variables exist in `.env`, but backend services (`server/db.js`) are designed to fail over to local SQLite (`data/planner.sqlite`) and `data/db.json` whenever Supabase is unreachable or when running offline.

---

## 4. Conclusion

The planner project possesses a mature, highly resilient, and fully isolated local testing architecture:
1. **Compilation & Integrity**: TypeScript strict type-checking (`npm run lint`), academic integrity audit (`node scripts/audit-illusions.js`), and production bundling (`npm run build`) all pass cleanly with zero errors.
2. **Existing Automated Tests**: All 273 tests across 36 test suites pass in 7.0 seconds using `node:test` + `tsx`, verifying academic policies, curriculum DAG resolution, schedule solving, security vault encryption, and SSRF guardrails.
3. **Zero External University Dependency**: The codebase contains full mock generators (`buildCohortCurriculumAndProgress`) and simulated registration engines (`demoMode`), allowing all academic workflows to run completely offline without calling live Edugate endpoints.
4. **Ready for 10-Persona Programmatic Evaluation**: Local data fixtures and the installed Playwright Chromium browser provide all necessary primitives to construct and execute automated evaluations for 10 diverse student personas, UI/UX audit, and WCAG accessibility standards verification.

---

## 5. Verification Method

To independently verify all findings in this survey, run the following commands in the workspace root (`c:\Users\mohammed\Desktop\planner`):

1. **Verify Academic Fidelity & Anti-Illusions Audit**:
   ```powershell
   node scripts/audit-illusions.js
   ```
   *Expected outcome*: Exits with code 0; scans 135 source files; reports `0 illusions found! All files comply with official academic regulations.`

2. **Verify TypeScript Strict Compilation**:
   ```powershell
   npm run lint
   ```
   *Expected outcome*: Exits with code 0 (`tsc --noEmit` completes with no type errors).

3. **Verify All Automated Unit & Integration Tests**:
   ```powershell
   npm test
   ```
   *Expected outcome*: Exits with code 0; reports `ℹ tests 273`, `ℹ pass 273`, `ℹ fail 0`, duration ~7s.

4. **Verify Production Build**:
   ```powershell
   npm run build
   ```
   *Expected outcome*: Exits with code 0; Vite transforms 2686 modules and outputs production bundle in `dist/`.

5. **Verify Playwright Chromium Browser Availability**:
   ```powershell
   node -e "const { chromium } = require('playwright'); console.log(chromium.executablePath());"
   ```
   *Expected outcome*: Exits with code 0; outputs path to installed Chromium binary (`chrome.exe`).
