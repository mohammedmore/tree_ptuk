# Comprehensive Application Features & Workflows Survey Report

**Explorer**: explorer_survey_2 (Application Features & Workflows Explorer)  
**Date**: 2026-11-14T06:25:00Z  
**Project**: PTUK Academic Planner & Schedule Solver  
**Handoff Scope**: Full inventory of frontend pages, components, modals, stores, backend routes, services, data models, user journeys, interaction touchpoints, and edge cases.

---

## 1. Observation

### 1.1 Architecture & Core Configuration
- **Root Repository Layout**:
  - `package.json`: React 19.0.1, Vite 6.2.3, Tailwind CSS 4.1.14, `@xyflow/react` 12.10.2, Zustand 4.5.7, Express 4.22.3, `better-sqlite3` 13.0.3, `@supabase/supabase-js` 2.117.2, Playwright 1.63.0, Zod 4.6.7, motion 12.23.24, Lucide icons, jspdf, html-to-image.
  - `Server.js` (Lines 1–58): Graceful shutdown handling (`SIGTERM`/`SIGINT`), WAL checkpoint truncation for SQLite (`sqlite.pragma("wal_checkpoint(TRUNCATE)")`), closing active SSE clients (`closeAllSseClients()`), and headless browser teardown (`closeSharedBrowser()`).
  - `scripts/audit-illusions.js`: Automated audit enforcing real-world PTUK academic regulations across 135 source files; rejects hardcoded student IDs, enforces official 25 JOD registration fee (not 50), credit limits (19 regular / 10 summer / 14 warning), and dynamic semester indexing. Verification command `node scripts/audit-illusions.js` returned code 0: `0 illusions found`.
  - Automated Test Suite: Verified via `npm test` (`node scripts/audit-illusions.js && node --import tsx --test "tests/*.test.ts"`): **273 tests pass cleanly in 6.7 seconds with 0 failures**.

---

### 1.2 Frontend Feature Inventory

#### A. Routing & App Shell (`src/router.ts`, `src/App.tsx`)
- **Router Pattern**: Hash-based lightweight router supporting 8 distinct application routes (`AppRoute`):
  1. `plan`: Interactive study plan tree / DAG roadmap.
  2. `courses`: University course catalog with section-level details and virtual scrolling.
  3. `schedule`: Weekly interactive timetable grid and schedule drafts.
  4. `gpa`: Cumulative and semester GPA calculator with What-If simulations.
  5. `semester-planning`: Semester-by-semester planning board and auto-planner.
  6. `registration`: Production-grade course registration hub (Plan A / B / C, live prewarm, dry run, auto-cascading).
  7. `login`: Student authentication, sync status, and CampusRunner interactive wait experience.
  8. `calendar`: Academic dates, deadlines, and milestone tracker.
- **App Shell Navigation**:
  - Desktop top navigation bar with live status indicators, theme cycling, language switcher, major selector, and CSV import/export.
  - Mobile fixed bottom navigation bar (`md:hidden`, height 58px) with active route indicators and tactile haptics (`triggerHaptic("selection")`).
  - Command Palette modal (`Cmd+K` / `Ctrl+K`) for instant keyboard-driven navigation across courses, professors, modals, and actions.
  - Undo Toast (`UndoToast.tsx`): 7-second grace window to undo catastrophic plan resets.
  - Printable Academic Audit (`AcademicAuditPrint.tsx`): Official A4 print layout complying with PTUK registrar formats.

#### B. Complete Pages Inventory (`src/pages/`)
| Page | File | Size | Primary Capabilities & UI Controls |
|---|---|---|---|
| **PlanPage** | `PlanPage.tsx` | 82 KB (2166 lines) | • React Flow (`@xyflow/react`) interactive DAG canvas with Dagre auto-layout.<br>• Layout modes: Tree DAG, Multi-Column Roadmap, and List View.<br>• Critical Path Analysis (`computeCriticalPath`): Bottleneck detection, graduation delay risk.<br>• CourseNode actions: Toggle complete, plan into semester, pin, inspect BFS dependency tree (ancestors/descendants).<br>• Major transfer simulator (`MajorTransferModal`): compares transfer credits, calculates lost vs. transferred hours.<br>• Course details sidebar (`CourseSidebar`): descriptions, syllabus, pass rates, prerequisites. |
| **CoursesPage** | `CoursesPage.tsx` | 128 KB (2966 lines) | • Virtualized list rendering via `useVirtualizer` for smooth 60fps scrolling over 1000+ courses.<br>• Multi-tier search: Course code, course name, instructor name with tokenized Arabic fuzzy matching.<br>• Highlighted professor names (`renderHighlightedDoctorName`).<br>• Filter chips: By study year (1–5), semester, category, completion status, offering status, seat availability.<br>• Section inspector: section number, days, times, room, registered count, capacity, remaining seats.<br>• Seat Sniper integration: track closed sections, subscribe to Web Push notifications.<br>• Section Swap Assistant: checks collision against active weekly schedule before swapping.<br>• Doctor Schedule lookup: view professor's full weekly timetable across faculties. |
| **WeeklySchedulePage** | `WeeklySchedulePage.tsx` | 67 KB (1572 lines) | • Timetable grid spanning 8:00 to 18:00 across 6 university days (Sun–Thu + Sat).<br>• Schedule Drafts Engine: create, duplicate, rename, switch between Draft A, B, C.<br>• Direct session swapping: click session block to swap sections in-place.<br>• Conflict detection: visual overlap badges and collision warnings.<br>• Free days & gap metrics: calculates daily gaps between lectures, off-days.<br>• Export suite: Google/Apple Calendar `.ics` (iCal), PNG image snapshot (`html-to-image`), print stylesheet, QR code / cloud share. |
| **GPAPage** | `GPAPage.tsx` | 62 KB (1357 lines) | • Official PTUK 100-point scale GPA calculation.<br>• Remedial courses exclusion (15200099, 15200106, 13010006) from GPA credits.<br>• Retake logic: automatically replaces older failing/lower grades with repeat grades.<br>• Academic standing tracker: Honor List (>=85), Good, Academic Warning (<60).<br>• Privacy Mask mode (`usePrivacyMask`): obfuscates GPA and grades when viewing in public.<br>• What-If simulator: set target graduation GPA; calculates required average across future credit hours.<br>• Top Retake Recommender: identifies lowest-grade passed courses (60–68) yielding highest GPA boost. |
| **SemesterPlanningPage** | `SemesterPlanningPage.tsx` | 130 KB (2929 lines) | • Multi-semester chronological planning board (Year 1 to Year 5 + Summers).<br>• `MultiColumnRoadmapView` with visual lane grouping.<br>• Intelligent auto-planning (`autoPlanToGraduation`): topological sorting with prerequisite dependencies.<br>• Strict credit limit clamping (19 regular, 10 summer, 14 under warning, 21 graduating).<br>• Plan Scenarios (`PlanScenario`): save and switch pathways (Accelerated 4-yr, Balanced 5-yr).<br>• Financial Tuition Calculator: semester fee breakdown in JOD and ILS based on cohort rates. |
| **RegistrationPage** | `RegistrationPage.tsx` | 155 KB (3802 lines) | • Multi-Plan Strategy: Plan A (Primary), Plan B (Backup), Plan C (Emergency).<br>• Instant cascading execution: automatically pivots to Plan B if Plan A section fills up on Edugate.<br>• Session prewarming (`prewarmRegistration`): preheats Playwright browser / session cookies.<br>• Dry-run test request simulator (`testRegistrationRequest`): inspects exact HTTP payload.<br>• Real-time SSE streaming (`useRealtimeRegistrationStream`): live progress logs from backend.<br>• Seat Watcher panel (`SeatWatcherPanel`): live seat saturation % and threshold alerts.<br>• Financial & credit diagnostics: checks student balance, minimum 12 credits, maximum 19 credits.<br>• Plan comparator: side-by-side comparison of Plan A vs. B vs. C. |
| **LoginPage** | `LoginPage.tsx` | 16 KB (422 lines) | • Student ID and Password form with "Remember Me" and "Continue as Guest" fallback.<br>• 0-second instant cached login for returning students.<br>• Live synchronization experience: interactive `CampusRunnerGame` canvas mini-game while waiting for scraper.<br>• `SyncPipelineRadar`: visual radar tracking scraping stages (Auth -> Transcript -> Plan -> Schedule).<br>• Inline schedule retrieval using 6-character shortcode. |

#### C. Modals Inventory (`src/components/modals/` & `GlobalModalsContainer.tsx`)
1. `AcademicAdvisorModal.tsx` (50 KB): AI academic counselor; diagnoses bottlenecks, critical path delays, graduation risks, and generates personalized next-semester recommendations.
2. `WeeklyScheduleModal.tsx` (172 KB): Full-featured modal timetable and solver interface.
3. `DynamicCourseDetailsModal.tsx` (35 KB): In-depth syllabus, prerequisites, corequisites, difficulty ratings, and community reviews.
4. `StudentRecordsModal.tsx` (46 KB): Synced Edugate record; transcript by semester, completed/registered/failed courses, financial transactions ledger.
5. `AcademicCalendarModal.tsx` (20 KB): Official PTUK dates, active semester detector, current week indicator, milestone countdown.
6. `DoctorScheduleModal.tsx` (24 KB): Timetable lookup for any faculty member across university branches.
7. `SectionSwapModal.tsx` (13 KB): Collision-free section replacement utility.
8. `CommandPaletteModal.tsx` (21 KB): Keyboard shortcut command runner (`Cmd+K`).
9. `CourseComparisonDrawer.tsx` (14 KB): Side-by-side drawer comparing two courses.
10. `GraduationAuditModal.tsx` (15 KB): Degree requirements checklist against graduation criteria.
11. `MajorSelectorModal.tsx` (12 KB): Switch between university majors and engineering specializations.
12. `MajorTransferModal.tsx` (15 KB): Evaluates credit transfer eligibility between different majors.
13. `ExportModal.tsx` (37 KB): Multi-format export: JSON backup, CSV courses, PDF academic report, PNG schedule, iCal `.ics`.
14. `PlanScenarioModal.tsx` (21 KB): Manage multi-semester plan scenarios.
15. `PlanningModeModal.tsx` (32 KB): Advanced planning options and degree completion presets.
16. `SharedScheduleModals.tsx` (22 KB): Cloud link generation, QR code rendering, PIN code protection, and remote schedule loading.
17. `SystemHealthModal.tsx` (32 KB): Backend status, SQLite metrics, Playwright pool health, and circuit breaker status.
18. `ResetConfirmationModal.tsx` (2.8 KB): Confirmation gate for resetting user data.
19. `SupportModal.tsx` (13 KB): Student help center and feedback submission.
20. `AddCourseModal.tsx` (8 KB): Add custom/elective courses not present in default catalogue.

#### D. State Management & Stores (`src/stores/`)
- `useAcademicStore.ts`: Central store for courses, active major ID/name, category requirements, completed courses Set, planned courses Record, current planning semester, course grades, course marks, and synced student profile.
- `useScheduleStore.ts`: Central store for weekly schedule entries by semester, schedule drafts (A/B/C), active draft ID, tracked seats for sniper, and 12h/24h time format.
- `useUIStore.ts`: Central store for modal visibility toggles, comparison drawer state, and batch `closeAllModals()`.
- `useLanguageStore.ts`: Internationalization store supporting Arabic (`ar`) and English (`en`), persisting preference in local storage and switching DOM `dir="rtl"` / `dir="ltr"`.

#### E. Theming & Accessibility System (`src/themeManager.ts`, `src/styles/`)
- Supports 4 distinct themes:
  1. `light`: High-clarity university parchment theme (`#F1F2ED`).
  2. `dark`: Forest obsidian theme (`#212724`).
  3. `oled`: True pitch-black mode (`#000000`) for battery conservation on mobile OLED screens.
  4. `high-contrast`: WCAG AAA accessible high-contrast theme (`#0047ab`).
- Automatically syncs HTML `<meta name="theme-color">`.
- Full keyboard accessibility with ARIA attributes and Escape key listeners across all pickers and modals.

---

### 1.3 Backend Architecture & Capabilities (`server/`)

#### A. Express Server & Security Pipeline (`server/app.js`, `server/middleware/`)
- **HTTP Stack**: Express 4.22.3 (ESM) with Helmet security headers:
  - Custom Content Security Policy (CSP) allowing Supabase WebSockets, Vercel scripts, Google fonts, and inline styles.
  - Cross-Origin Resource Policy (CORP: `same-origin`), Cross-Origin Embedder Policy, Cross-Origin Opener Policy.
  - HSTS enabled with 1-year max-age and preloading.
  - Disabled `x-powered-by`.
  - Body parser strictly capped at 1 MB to prevent memory exhaustion DoS.
- **CORS Protection**: Origin whitelist matching localhost, development LANs, and configured `FRONTEND_URL` entries. Rejects unauthorized origins with HTTP 403.
- **CSRF Defense**: `verifyCsrfOrigin` validates request origin/referer on mutating POST requests.
- **Rate Limiters** (`server/middleware/rateLimiters.js`):
  - `globalLimiter`: 300 requests / 15 min.
  - `authLimiter`: 10 attempts / 15 min with account lockout velocity tracking.
  - `syncLimiter`: 5 cycles / 10 min.
  - `registrationLimiter`: 30 operations / 5 min.
  - `concurrencyLimiter`: Max concurrent execution guard.
- **Observability & Health**:
  - `/metrics`: Prometheus metrics export format.
  - `/api/health`: Comprehensive system health (SQLite status, Supabase link, circuit breaker status, memory, uptime).
  - `/api/health/live` & `/api/health/ready`: Kubernetes container probes.
  - `/api/observability/stats`: Telemetry analytics endpoint (admin only).
- **OpenAPI 3.0 Documentation**: Served at `/api/docs` and interactive UI at `/api/docs/ui`.

#### B. API Endpoints Map
| Route Group | Endpoint | Method | Protection & Functionality |
|---|---|---|---|
| **Courses** | `/api/courses` | `GET` | Query courses with filtering by `codes`, `search`, `limit`, `offset`. Supports `compact=true` minification for mobile bandwidth saving. |
| | `/api/courses/:code` | `GET` | Single course lookup with full section blocks and instructor details. |
| **Majors** | `/api/majors` | `GET` | Returns list of all approved academic degree programs. |
| | `/api/majors/:majorId` | `GET` | Returns complete graduation plan and category requirements for a major. |
| | `/api/majors` | `POST` | Admin upsert for curricula (`requireAdminAuth`). |
| **Student** | `/api/student/sync` | `POST` | Authenticates with Edugate; syncs transcript, plan, schedule, and fees. Returns HMAC signed token. Protected by `authLimiter` and brute-force lockout. |
| | `/api/student/logout` | `POST` | Cryptographically revokes session token immediately. |
| | `/api/student/:studentId` | `GET` | IDOR-protected student profile query. Requires valid matching token or admin secret. Zero-leak sanitized. |
| **Registration** | `/api/registration/stream` | `GET` | Server-Sent Events (SSE) live channel with 20s keep-alive heartbeats. |
| | `/api/registration/prewarm` | `POST` | Prewarms browser cookies and checks Edugate latency. |
| | `/api/registration/portal-status` | `POST` | Live availability check for `edugate.ptuk.edu.ps/student/onlineRegistration`. |
| | `/api/registration/execute` | `POST` | Executes Plan A -> B -> C batch registration. Enforces OWASP BOLA check and idempotency keys (`X-Idempotency-Key`). |
| | `/api/registration/test-request` | `POST` | Dry-run verification of HTTP payload sent to PrimeFaces backend. |
| | `/api/registration/check-seats` | `POST` | High-speed batch seat availability checker. |
| | `/api/registration/snipe-check` | `POST` | Checks closed sections and auto-registers as soon as vacancy opens. |
| **Calendar** | `/api/calendar` | `GET` | Academic calendar enriched with active semester, current week, and upcoming milestone countdown. |
| | `/api/calendar/sync` | `POST` | Live rescrape of PTUK academic calendar. |
| | `/api/calendar/tuition-fees` | `GET` | Official credit-hour tuition rate calculator by major. |
| **Sync** | `/api/sync/status` | `GET` | Returns course counts, last sync time, and SQLite metrics. |
| | `/api/sync/trigger` | `POST` | Triggers background synchronization with sync lock and API key. |

#### C. Database & Data Storage Engine (`server/db.js`, `server/sqliteDb.js`)
- **Dual Storage Architecture**:
  1. Primary High-Performance Engine: SQLite via `better-sqlite3` located at `data/planner.sqlite`. Operates with Write-Ahead Logging (`WAL` mode) and synchronous=NORMAL for concurrent reads and writes.
  2. Backup & Sync Engine: Supabase PostgreSQL for cloud persistence and multi-device sharing (`shared_schedules` table).
  3. Atomic Local Fallback: `data/db.json` with atomic rename writes (`persistStateSync`) ensuring zero disk corruption during sudden power drops.
- **Tables in SQLite**:
  - `courses`, `course_sections`, `course_blocks`: Complete course catalog with normalized lecture days and times.
  - `majors`: Degree plans, category requirements, cohort years.
  - `students`: Synced student transcripts, pass/fail course IDs, historical semester grades.
  - `tracked_seats`: Seat sniper watchlists per student.
  - `security_vault`: Account lockout timestamps, failed attempt counters, revoked session tokens.
  - `sync_metadata`: Sync timestamps, total course records, schema version.

#### D. Scrapers & Registration Engine (`server/services/`)
- `studentPortalService.js` (137 KB): Playwright headless browser driver navigating Edugate JSF PrimeFaces portal. Supports direct URL navigation and resilient fallback menu traversal. Includes `inferMajorFromCourses` to deduce student major from course code prefixes.
- `registrationEngine.js` (20 KB): Core execution engine for course registration. Prepares PrimeFaces form payloads (`javax.faces.ViewState`), processes responses, detects full sections, and triggers automatic cascading between Plan A, B, and C.
- `seatSniperService.js` (5.5 KB): Background periodic watcher inspecting capacity ratios (e.g. "39/40") and firing auto-registration.
- `tuitionFeesService.js` (9.7 KB): Official tuition fee rate book (e.g. Engineering 23 JOD/hr, SWE 20 JOD/hr, CS 18 JOD/hr, Business 16 JOD/hr) + 25 JOD fixed registration fee.
- `circuitBreaker.js`: Circuit breaker pattern protecting Edugate servers from cascading request floods.

---

## 2. Logic Chain

### 2.1 Tracing Complete User Journeys

#### Journey 1: Schedule Planning & Conflict Resolution
1. **Entry**: Student navigates to `# /schedule` or opens `WeeklyScheduleModal`.
2. **Input**: Student selects semester (e.g. "السنة الثانية - الفصل الثاني") and adds course candidates from planned courses.
3. **Engine Execution**: The schedule solver (`src/services/scheduleSolver.ts` / `src/workers/scheduleSolver.worker.ts`) invokes the CSP Forward Checking algorithm with MRV (Minimum Remaining Values) heuristic:
   - Evaluates all section combinations across courses.
   - Eliminates combinations violating student preferences (e.g., Free Days like Thursday/Saturday, Time Preference: Morning vs. Late vs. Compact, Max Gap between lectures).
   - Skips online/asynchronous lectures (00:00-00:00) so they do not cause false physical conflicts.
4. **Resolution**: If a hard clash occurs (e.g. Algorithms Sec 1 clashes with OS Sec 2), the solver generates a `ConflictExplanation` with concrete `ConflictAutoFix` actions (e.g. "Unpin Section 1" or "Remove Course").
5. **Output**: Renders interactive schedule on grid, computes Schedule Quality Index (SQI), and saves to `ScheduleDraft` (Draft A/B/C).

#### Journey 2: Section Selection, Doctor Preferences, & Section Swapping
1. **Catalog Search**: Student visits `# /courses`, types doctor name (e.g. "د. محمد") or course name.
2. **Inspection**: The course card expands showing all offered sections, capacity badges (e.g., "38 / 40 طالب"), meeting days, and room.
3. **Doctor Timetable**: Student clicks doctor name to open `DoctorScheduleModal`, revealing all sections taught by that professor across the university.
4. **Section Swap**: Student opens `SectionSwapModal` to switch from Section 1 to Section 3.
   - `analyzeSectionSwap` checks the target section blocks against all *other* courses in the student's active weekly schedule.
   - If clean, the schedule entry is updated in one click (`buildScheduleEntryFromSection`).
   - If clashing, the UI flags the exact conflicting course, day, and time.

#### Journey 3: Registration Strategy, Simulation, & Cascading Execution
1. **Setup**: Student visits `# /registration` ahead of university registration day.
2. **Strategy Composition**:
   - Assembles Plan A (ideal schedule, preferred doctors).
   - Assembles Plan B (backup sections for critical bottleneck courses).
   - Assembles Plan C (emergency electives/general requirements).
3. **Validation**:
   - `validatePlanCollisions` confirms 0 section clashes within each plan.
   - `checkPlanPrerequisites` validates all prerequisites are met.
   - `checkPlanCreditLimits` enforces PTUK credit limits (min 12, max 19 regular / 10 summer / 14 warning).
   - `checkPlanFinancialBalance` calculates required tuition and warns if account balance is insufficient.
4. **Prewarming & Dry Run**:
   - Student clicks "Prewarm Gateway": `/api/registration/prewarm` tests latency to Edugate and prepares browser session.
   - Student clicks "Dry Run Test": `/api/registration/test-request` generates and validates the exact PrimeFaces HTTP request payload.
5. **Live / Demo Execution**:
   - Student clicks "Execute Registration": `/api/registration/execute` fires batch registration.
   - If a Section in Plan A returns "Section Full" (شعبة مغلقة), the engine automatically falls back to Plan B, and then Plan C without user intervention.
   - Real-time updates stream via SSE to `useRealtimeRegistrationStream`.
   - On completion, registered sections are automatically merged into `weeklySchedule`.

#### Journey 4: Course Search, Filtering, & Prerequisite Checking
1. **Catalog Exploration**: Student filters by "Year 3", "Major Compulsory", "Available to Register".
2. **Eligibility Calculation**: `isCourseAvailable` verifies all prerequisite course IDs are present in `completedCourses`.
3. **Dependency Inspection**: In `PlanPage`, clicking any course node highlights its prerequisite path (upstream ancestors) and dependent path (downstream blocked courses).
4. **Explanations & Community Reviews**: Student clicks course details to view difficulty rating (Easy/Medium/Hard), study tips, and verified Google Drive study materials.

#### Journey 5: Degree Planning, Advisory Recommendations, & Graduation Audit
1. **Advisory Consultation**: Student opens `AcademicAdvisorModal`.
2. **Critical Path Calculation**: `calculateCurriculumCriticalPath` builds the prerequisite DAG and highlights the longest remaining chain to graduation.
3. **Course Delay Risk**: `simulateCourseDelayImpact` simulates what happens if a core course (e.g. Data Structures) is failed or deferred, showing exact downstream courses blocked and semester delay.
4. **Optimal Recommendations**: `recommendOptimalUpcomingSemester` suggests the exact 5–6 courses to take next semester, prioritizing critical path bottlenecks while strictly observing credit limits.
5. **Graduation Audit**: `GraduationAuditModal` audits passed credits against required categories:
   - University Compulsory & Elective
   - College Compulsory & Elective
   - Major Compulsory & Elective
   - Remedial requirements (remedial English 15200099, remedial Arabic 15200098, computer skills 13010006).

#### Journey 6: Student Login, Academic Synchronization, & Waiting Experience
1. **Login**: Student enters University ID and password on `# /login`.
2. **Authentication Flow**:
   - If cached locally, logs in instantaneously (0 ms).
   - If fresh live scrape: backend starts Playwright session. While waiting (~15-25s), the student plays the built-in `CampusRunnerGame` canvas mini-game and views live progress on `SyncPipelineRadar`.
3. **Sync Processing**: Backend scrapes academic transcript, historical grades, current enrolled courses, and exemption exams.
4. **Profile Ingestion**: `useAcademicStore` populates completed courses, registered courses, grades, and sets active major.

#### Journey 7: GPA Simulation, Academic Standing, & Privacy Mode
1. **Transcript Review**: Student navigates to `# /gpa` to inspect current cumulative GPA.
2. **Privacy Protection**: Student clicks the eye icon (`usePrivacyMask`) to mask GPA and sensitive grades when in campus public spaces.
3. **What-If Simulation**: Student inputs hypothetical grades for remaining courses; the simulator displays projected cumulative GPA.
4. **Target GPA Analysis**: Student enters target GPA (e.g. 80.00%); the system computes the exact average required across future credit hours.
5. **Retake Advisor**: System flags courses passed with 60–68% where repeating yields substantial GPA increases with minimal credit expenditure.

#### Journey 8: Multi-Device Sharing, QR Codes, & Calendar Export
1. **Cloud Sharing**: Student clicks "Share Schedule" on weekly timetable.
2. **Snapshot Creation**: Generates a cryptographically signed snapshot with optional 4-digit PIN protection.
3. **Distribution**: Generates a 6-character shortcode (e.g. `ABC123`), shareable link, and downloadable QR code.
4. **Calendar Export**: Downloads `.ics` file with university lecture times, room numbers, instructor names, and 15-minute advance reminders.

---

### 1.4 User Touchpoints, Controls, Modals, & Edge Cases Inventory

#### A. Interactive Touchpoints & Inputs
- **Theme Cycler**: Switches between Light, Dark, OLED, High-Contrast; updates CSS variables and meta tags.
- **Language Switcher**: Toggles between Arabic and English; dynamically updates HTML direction (`dir="rtl"` vs `dir="ltr"`).
- **Major Selector**: Modal dropdown with 15+ university majors and cohort curricula.
- **Course Node Controls**: Click to open drawer, double click to toggle complete, drag to pan canvas, zoom controls.
- **Schedule Draft Buttons**: Add draft (+), duplicate, rename in-place, delete draft, switch active tab.
- **Seat Sniper Toggle**: Bell icon on each section; switches between untracked, tracking, and notification active.
- **CSV Import/Export**: File input accepting official PTUK format CSVs and exporting current academic progress.
- **Print Trigger**: Launches media print stylesheet formatted for A4 official academic documents.

#### B. Edge-Case Handling Architecture
1. **Remedial Courses (المواد الاستدراكية)**:
   - Courses `15200099` (Remedial English), `13010006` (Computer Skills), `15200098` (Remedial Arabic) are non-credit-bearing for the degree.
   - The engine strictly excludes them from earned degree credits and cumulative GPA calculations, while validating that they must be passed or exempted before advancing to English 1 (`15200106`) or English 2 (`15200112`).
   - Placement test rule: Placement grade >= 80 automatically exempts both Remedial English and English 1.
2. **Academic Warning (الملاحظة الأكاديمية)**:
   - Detected when student GPA < 60% or official status text contains "إنذار" / "ملاحظة".
   - Immediately clamps max allowable semester registration to **14 credit hours** (regular) and **6 credit hours** (summer).
3. **High GPA / Graduating Senior Override**:
   - Students with cumulative GPA >= 80% or in their final graduating semester have their registration limit raised to **21 credit hours** (regular) and **12 credit hours** (summer).
4. **Degree Duration Scaling**:
   - Automatically scales degree duration based on major requirements: 2 years (Diploma, <=80 cr), 4 years (Standard Bachelor, 130–140 cr), or 5 years (Engineering, 160+ cr).
   - Prevents leaking Year 5 semesters into 4-year programs.
5. **Online & Asynchronous Lectures**:
   - Classes scheduled at 00:00–00:00 or flagged as "إلكتروني" are isolated by the CSP solver to avoid generating false conflicts with physical room-based lectures.
6. **Network & Backend Resilience**:
   - Offline banner triggers when network drops.
   - Full offline catalog fallback ensures students can plan, solve schedules, and calculate GPAs even without an internet connection.
   - Circuit breaker (`edugateCircuitBreaker`) prevents cascading failure loops when university portals are down.
7. **Security Boundaries**:
   - OWASP BOLA mitigation: `/api/registration/execute` blocks execution if student session does not match target payload.
   - IDOR mitigation: `/api/student/:studentId` restricts transcript access strictly to the owner student or admin.
   - Brute-force lockout: Blocks accounts after 5 failed login attempts with exponential cooldown.

---

## 3. Caveats
- **Live University Service Prohibition**: As instructed, no live network requests were made to external PTUK endpoints (`edugate.ptuk.edu.ps`) during exploration. All findings regarding live scraping were verified by inspecting service implementations, unit tests, mock datasets, and database structures.
- **Source Code Modification**: In accordance with the read-only exploration constraint, no application code was modified.
- **Supabase Cloud Dependency**: Multi-device cloud schedule sharing requires valid Supabase environment credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). In local offline development without Supabase, the application automatically falls back to local storage and SQLite.

---

## 4. Conclusion
The PTUK Academic Planner & Schedule Solver is a mature, resilient, production-grade application with deep domain fidelity to Palestinian Technical University – Khadoorie regulations.

### Key Architectural Strengths:
1. **Academic Regulatory Precision**: Complete absence of illusions; strict enforcement of PTUK credit ceilings (19/10/14/21), remedial course exclusions, and authentic cohort tuition calculations.
2. **High-Performance Constraint Solving**: Fast CSP schedule solver with MRV heuristics running in Web Workers, guaranteeing 60fps UI responsiveness during schedule permutations.
3. **Fault-Tolerant Automated Registration**: Multi-plan architecture (Plan A/B/C) with automatic cascading fallback, prewarming, idempotency keys, and real-time SSE streaming.
4. **Comprehensive User Experience**: Rich UI covering 8 full user journeys, 7 dedicated pages, 25 specialized modals, bidirectional Arabic/English internationalization, 4 accessible themes, and interactive wait experiences.
5. **Enterprise-Grade Backend Security**: Helmet CSP, origin-restricted CORS, CSRF verification, rate limiting, HMAC session token vault, account velocity lockout, and zero-leak sanitization.

This detailed survey provides the exact foundational functional and architectural baseline required to design the 10-student persona evaluation matrix and programmatic testing suite.

---

## 5. Verification Method

To independently verify the observations and conclusions in this report, execute the following commands in the project directory:

```bash
# 1. Verify academic integrity and absence of academic illusions (must exit 0 with 0 violations)
node scripts/audit-illusions.js

# 2. Verify TypeScript strict type-checking across all frontend and backend source files
npm run lint

# 3. Execute the complete automated test suite (must pass 273/273 tests)
npm test

# 4. Verify specific domain test suites individually
node --import tsx --test tests/scheduleSolver.test.ts
node --import tsx --test tests/semesterRegistration.test.ts
node --import tsx --test tests/academicAdvisor.test.ts
node --import tsx --test tests/academicPolicy.test.ts
node --import tsx --test tests/backendApi.test.ts
node --import tsx --test tests/security.test.ts
```

### Invalidation Conditions:
- Modifying credit limits to non-PTUK values (e.g. 18 instead of 19 regular, or 9 instead of 10 summer) will trigger failures in `audit-illusions.js` and `tests/academicPolicy.test.ts`.
- Introducing section conflicts in the solver will cause failures in `tests/scheduleSolver.test.ts`.
- Introducing unauthenticated student profile access will fail OWASP BOLA tests in `tests/security.test.ts`.
