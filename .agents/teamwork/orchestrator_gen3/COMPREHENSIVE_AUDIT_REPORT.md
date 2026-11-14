# Comprehensive Programmatic Testing, Standards Audit & 10-Student Persona Multi-Angle Evaluation Report

**Project**: Palestine Technical University – Kadoorie (PTUK) Academic Planner & Schedule Solver  
**Workspace**: `c:\Users\mohammed\Desktop\planner`  
**Evaluation Mode**: Development / Offline Total Isolation  
**Date**: 2026-11-14  
**Audit Conducted By**: Teamwork Orchestrator Generation 3 with Multi-Agent Panel (Explorers, Workers, Reviewers, Challengers, and Forensic Auditor)  

---

## Executive Summary

An exhaustive, end-to-end programmatic audit, global standards compliance verification, and 10-student persona multi-angle evaluation was conducted across the PTUK Academic Planner codebase. The evaluation executed strictly in local offline isolation against local SQLite database fixtures (`data/planner.sqlite`) and in-memory mocks, with **zero outbound network connections** to external university servers (`edugate.ptuk.edu.ps`) and **zero unauthorized modifications to existing application source code** under `src/`, `server/`, or `scripts/`.

### Key Metrics & Verification Status
- **Automated Test Suites**: **371 / 371 tests pass cleanly across 22 suites** in ~18 seconds.
  - `tests/personaValidation.test.ts` (Milestone 1): 25/25 passing tests (129 assertions).
  - `tests/standardsAudit.test.ts` (Milestone 2): 16/16 passing tests (global standards suite).
  - `tests/personaJourneys.test.ts` (Milestone 3): 31/31 passing tests (1,386 lines, full persona coverage).
- **Academic Policy Fidelity**: Scanned 135 source files via `scripts/audit-illusions.js`: **0 academic illusions detected** (strict compliance with PTUK 25 JOD registration fee, credit limits, and grading scales).
- **Type Safety & Build Cleanliness**: `npx tsc --noEmit` exited with **0 errors**; `npm run build` completed production bundling cleanly in **7.59s**.
- **Forensic Integrity Audit**: Certified **CLEAN** by independent Forensic Auditor (`auditor_m3`), confirming 0 hardcoded facades, 26 genuine domain function invocations, and 0 source code diffs.

---

## 1. Global Standards Verification & Compliance Matrix

The codebase was audited against international software engineering standards:

| Engineering Standard | Compliance Score | Status | Key Findings & Deficiencies |
| :--- | :---: | :---: | :--- |
| **TypeScript Standards** (Microsoft / Enterprise Guidelines) | **72%** | ⚠️ Sub-optimal | `tsconfig.json` specifies `"strict": true`, but lacks `"noUncheckedIndexedAccess": true`, leading to unchecked array/object indexing; 48+ explicit `any` usages; untyped `catch (e: any)` blocks; ambient `vite-env.d.ts` functions declared as `any`. |
| **Code Quality & Linting** (ESLint / Clean Code) | **45%** | ❌ Failing | `eslint.config.js` defines solely ignore patterns with 0 active rules; `"lint"` in `package.json` only runs `tsc --noEmit`; 4 monolithic files exceed 2,500 lines (`RegistrationPage.tsx` 3,881 lines, `studentPortalService.js` 3,881 lines, `CoursesPage.tsx` 2,650 lines, `SemesterPlanningPage.tsx` 2,873 lines). |
| **Accessibility (WCAG 2.1 AA)** (W3C Guidelines) | **54%** | ❌ Non-Compliant | Exactly 24 ad-hoc modals bypass `BaseModal.tsx`, failing to trap keyboard Tab focus; multiple modals lack Escape handlers; only 3 `aria-live` instances across codebase; `text-slate-400` contrast on white is **2.56:1** (failing 4.5:1 AA); drag-and-drop roadmap lacks keyboard alternatives. |
| **Security & Data Protection** (OWASP ASVS 4.0) | **82%** | ⚠️ Hardening Needed | Server is well-hardened (Helmet CSP, parameterized SQLite queries, BOLA checks, SSRF guards); however, full unencrypted student transcript, GPA, and session token are stored in plaintext in client `localStorage` (`ptuk_synced_student_data`); synchronous `scryptSync` blocks main thread. |

---

## 2. 10-Student Persona Multi-Angle Evaluation Framework

The application was evaluated across a diverse panel of 10 authentic PTUK student personas across all 8 application routes (`plan`, `courses`, `schedule`, `gpa`, `semester-planning`, `registration`, `login`, `calendar`).

```
====================================================================================================
                        PTUK 10-STUDENT PERSONA EVALUATION PANEL
====================================================================================================
```

### Persona 1: Tariq Al-Najjar — The Working Senior
- **Profile**: 5th-Year Senior (Graduating), Computer Systems Engineering (164 cr), GPA: 76.5%, Completed: 142/164 cr.
- **Constraints**: Works daily afternoon shift (14:00–22:00) as junior network technician. Requires all classes to end strictly by **13:30** on Sun/Tue/Thu, or compact Mon/Wed. Zero gap tolerance.
- **User Journey**:
  - `#/schedule`: Attempts to restrict timetable to end before work. Discovers `<select id="commuter-latest-time">` in `WeeklyScheduleModal.tsx:2617-2633` has discrete options starting only at `14:00`, completely omitting `13:30` and `13:00`.
  - `#/schedule`: Adds Field Training (`15010400`) to course list. The course has no classroom section (`sections: []`). In `scheduleSolver.ts:451`, `generateAllSchedules` executes `if (courses.some(c => !c.sections || c.sections.length === 0)) return [];`, aborting and returning 0 schedules for all 5 courses.
  - `#/plan`: Checks graduation project eligibility. Standing status (`standingInfo.canRegisterGradProject`) is calculated in `courseProgress.ts`, but the notification banner is buried in `GPAPage.tsx:515` and absent from `PlanPage.tsx`.
  - `#/login`: Authentication experience mounts `CampusRunnerGame.tsx` (965 lines), which activates a 3-second mandatory countdown if touched, delaying a working student on a tight shift.

### Persona 2: Nour Zaidan — The Commuter Sophomore
- **Profile**: 2nd-Year Sophomore, Civil Engineering (164 cr), GPA: 71.2%, Completed: 46/164 cr.
- **Constraints**: Daily commuter from rural Jenin via intercity shared taxi ("Service"). Transit window: cannot arrive before **08:30 AM**; must depart campus before **15:30 PM**. Needs compact 2-day or 3-day schedule.
- **User Journey**:
  - `#/schedule`: Activates "نمط المسافر/الموظف" preset button in `WeeklyScheduleModal.tsx:2340-2364`. The preset hardcodes `setEarliestClassTime("09:00")`, purging Nour's 08:30 AM sections of Statics (`12040201`) and Calculus 3 (`15010201`).
  - `#/schedule`: Solver conflict explainer (`scheduleSolver.ts:1167-1174`) reports `تم استبعاد جميع شعب المادة "استاتيكا" يدوياً`, falsely claiming the student manually excluded the sections.
  - `#/schedule`: Solver treats 0-minute back-to-back transitions between Old Campus Engineering Laboratories (Surveying Lab `12040203`) and New Campus lecture halls (Calculus 3) as optimal (`totalGap: 0`, max gaps score 40), ignoring the physical 10–15 minute walk.

### Persona 3: Omar Abu-Saleh — Academic Warning / Probation
- **Profile**: 3rd-Year Junior, Software Engineering (132 cr), GPA: **57.8%** (Academic Warning / إنذار أكاديمي), Completed: 58/132 cr.
- **Constraints**: Strict PTUK regulation: **maximum 14 credit hours** in regular semester (minimum 12). Priority is GPA recovery: retaking failed `F`/`D` courses to overwrite grades.
- **User Journey**:
  - `#/registration` & `#/semester-planning`: UI displays 14-credit limit as an informational banner (`RegistrationPage.tsx:2190-2218`), but fails to disable course selection beyond 14 credits. Omar builds a 16-credit schedule and is only blocked upon final submission.
  - `#/gpa`: Uses What-If GPA Simulator to simulate retaking Calculus 1 (`15010101`, 3 cr, failed with 50) and scoring 82. In `GPAPage.tsx:315-333`, `projectedGPA` correctly recalculates cumulative GPA to 66.6% (clearing warning); however, `earnedCredits` passes only original `completedCourses` to `calculateDegreeCredits`, keeping earned credits frozen at 58 instead of updating to 61.
  - `#/courses`: Catalog has no dedicated filter to highlight previous failed/low-grade courses eligible for GPA replacement.

### Persona 4: Maya Khoury — Honors Fast-Tracker
- **Profile**: 3rd-Year Junior (Dean's Honor List), Artificial Intelligence (132 cr), GPA: **89.4%**, Completed: 84/132 cr.
- **Constraints**: PTUK regulation permits up to **21 credit hours** for students with GPA >= 80%. Accelerated 3.5-year graduation plan.
- **User Journey**:
  - `#/registration`: Maya constructs a 21-credit overload (7 courses). In `src/core/semesterRegistration.ts:409-432`, `checkPlanCreditLimits` checks `if (options.isGraduating)` for 21 credits and completely omits `options.gpa >= 80`. Because Maya is a 3rd-year junior, `isGraduating` is undefined. The function falsely caps her at 19 credits and throws `CREDIT_LIMIT_EXCEEDED`, blocking her legitimate registration.
  - `#/schedule`: Solving 7 courses across multi-section permutations triggers solver timeout. In `scheduleSolverClient.ts:117-126`, after 15 seconds, the Web Worker fallback executes `resolve(fallbackFn())`, running `generateAllSchedules` synchronously on the main UI thread and freezing Maya's browser.
  - `#/plan`: Absence of an accelerated 3.5-year degree roadmap preset.

### Persona 5: Yazan Masri — Screen Reader / Motor Accessibility
- **Profile**: 1st-Year Freshman, Business Administration (132 cr), GPA: 81.0%, Completed: 15/132 cr. Low vision & motor disability.
- **Constraints**: Relies 100% on NVDA screen reader and keyboard navigation (Tab/Shift+Tab, Escape). Requires WCAG 2.1 AA compliance.
- **User Journey**:
  - Across all pages: Yazan encounters 24 ad-hoc modals bypassing `BaseModal.tsx`. When opening `AcademicAdvisorModal.tsx` or `DynamicCourseDetailsModal.tsx`, pressing `Tab` leaks focus behind the modal into underlying page elements (violating WCAG 2.1.2 & 2.4.3).
  - In `CoursesPage.tsx:2449, 2633` (GPA impact & seat tracker) and `WeeklySchedulePage.tsx:1429`, modals have **zero Escape key handlers**, trapping keyboard users.
  - `#/courses` & `#/schedule`: Only 3 lines in the entire codebase contain `aria-live`. Dynamic events like live seat alerts and timetable conflict updates provide zero audible announcements.
  - `#/semester-planning`: `MultiColumnRoadmapView.tsx` relies strictly on HTML5 drag-and-drop (`draggable`) with zero keyboard alternatives (arrow keys / move buttons).
  - In `courseProgress.ts:5-6, 20`, `13010006` (Computer Skills, 1 cr mandatory requirement) is falsely misclassified as non-credit remedial, creating a permanent 1-credit shortfall in Yazan's degree audit.

### Persona 6: Hiba Hamdan — The Transfer Student
- **Profile**: 2nd-Year Transfer, Computer Science (132 cr), GPA: 74.0%, Completed: 48 cr (15 local PTUK + 33 accredited transfer hours `معادلة`).
- **Constraints**: Non-numeric transfer grades (`CR`/`P`, `grade: -1`). Prerequisite mapping from external college.
- **User Journey**:
  - `#/gpa`: Uses Academic Advisor GPA forecast (`src/core/academicAdvisor.ts:387-409`). `simulateGpaForecast` multiplies `currentGpa * completedHours` using all 48 credits instead of the 15 graded hours. When Hiba projects 15 new credits at grade 80, the forecast computes `(74.0 * 48 + 15 * 80) / 63 = 75.42%`, diluting her true official PTUK GPA of `(15 * 74.0 + 15 * 80.0) / 30 = 77.00%` downward by **1.58 percentage points**. In transfer students with 0 local hours, this causes a catastrophic 55% dilution (`25.00%` vs `80.00%`), triggering false academic warnings!
  - `#/gpa`: Clicking "إعادة العلامات للأصل" (`GPAPage.tsx:219, 232`) checks `if (c.grade > 0)`. Because transfer grades are stored as `-1`, it strips all transfer courses upon reset.
  - `#/plan` & `#/courses`: Absence of an External Course Equivalency mapping tool causes downstream CS courses (e.g. Data Structures requiring Intro to Programming) to throw false-positive prerequisite warnings.

### Persona 7: Ahmad Darwish — Remedial & Placement Freshman
- **Profile**: 1st-Year Freshman, Mechatronics Engineering (164 cr), Tawjihi: 86.4%, Placement: English 84% (exempted), Arabic 42% (remedial required).
- **Constraints**: Unfamiliar with university scheduling structures, section nomenclature (شعبة), and tuition billing for non-credit remedial courses.
- **User Journey**:
  - `#/login`: Synced placement exam data correctly assigns Remedial Arabic `13010006` and exempts English 1.
  - `#/schedule` & `#/semester-planning`: Remedial Arabic is billed in tuition (362 JOD total) and workload (14 hrs), but excluded from degree credits (11 cr earned toward 164). UI shows conflicting totals without explanatory tooltips, causing severe freshman confusion.
  - `#/registration`: Instead of a guided onboarding tour, Ahmad is confronted with complex multi-tier Plan A/B/C cascading logic without progressive disclosure.

### Persona 8: Layla Qasim — Student Athlete & Club Leader
- **Profile**: 3rd-Year Junior, Applied Arts (132 cr), GPA: 80.2%, Completed: 75/132 cr. Basketball Captain & Arts Club President.
- **Constraints**: Mandatory basketball training: Sun/Tue 12:00–14:00. Club meetings: Thu 13:00–15:00. Needs 4-hour studio courses fitted around non-academic commitments.
- **User Journey**:
  - `#/schedule`: `CatalogScheduleFilters` exposes only whole-day `freeDays`. Layla cannot input recurring partial-day busy blocks (e.g. Sun/Tue 12-2). Blocking Sunday and Tuesday destroys all full-time enrollment options.
  - `#/schedule`: Timetable displays raw keys like `"14010311_اث"` instead of `"تايبوغرافي 2"` due to a compound key lookup mismatch (`src/pages/WeeklySchedulePage.tsx:309-312`).
  - `#/schedule`: In `WeeklyScheduleModal.tsx:935`, schedule adoption executes `const block = item.section.blocks[0];`, copying only the first block's timing to all days and corrupting multi-block course schedules.
  - `#/schedule`: Modal timetable grid truncates at 16:00, cutting off afternoon studio classes (14:00–18:00).

### Persona 9: Rami Odeh — Dual-Track / Minor Student
- **Profile**: 4th-Year Senior, Agricultural Engineering (160 cr) + Business Minor (21 cr), GPA: 78.4%, Completed: 118/160 cr.
- **Constraints**: Attends classes across two distinct faculties: Agriculture (Faculty Campus at Al-Arroub) and Business (Central Campus in Tulkarm). Requires travel transit buffers between campus zones.
- **User Journey**:
  - `#/plan`: No data structures or UI exists to track a Minor degree. Switching the active major to Business wipes all Agricultural Engineering plan data and schedule drafts.
  - `#/schedule`: CSP solver has zero-minute transit awareness between Al-Arroub and Tulkarm campuses (over 90 minutes apart), scheduling physically impossible back-to-back classes.
  - `#/semester-planning`: Tuition calculator applies a flat primary faculty rate (20 JOD/hr) to all courses, failing to bill minor courses at the business rate.

### Persona 10: Salma Barghouthi — Rural / Poor Connectivity (3G)
- **Profile**: 1st-Year Diploma Student, Vocational IT (72 cr), GPA: 72.0%, Outlying rural village with frequent electrical brownouts and high-latency 3G (50–100 kbps, 400ms ping).
- **Constraints**: Relies on offline-first capabilities, instant local drafts, lightweight payloads, and fail-safe registration queueing.
- **User Journey**:
  - `#/login`: Eagerly downloads 31.5 KB `CampusRunnerGame.tsx` canvas game over 3G, increasing initial bundle size, even though mobile never renders the game.
  - `#/registration`: `RegistrationPage.tsx` is completely locked out behind "قيد التطوير" stubs in desktop and mobile bottom navigation (`src/App.tsx:1920-1940`, `2100-2116`).
  - `#/plan`: `offlineQueue.ts` has 0 callers in UI components; the app displays a false "All synced" banner while mutation operations fail silently upon connection drops.
  - `#/registration`: Non-persisted idempotency keys are discarded on network timeout, risking duplicate registration requests or locked seats on flaky connections.

---

## 3. Comprehensive Categorized Findings

### 3.1 Missing Features That Students Need

| # | Missing Feature | Impacted Personas | Academic / Operational Rationale |
|---|----------------|-------------------|----------------------------------|
| **MF-1** | **Granular Start & End Time Filtering in Schedule Solver** | P1 (Tariq), P2 (Nour) | Solver UI lacks custom time inputs and omits `<13:30` (for shift workers) and `>08:30` (for transit commuters arriving at 08:30). |
| **MF-2** | **Recurring Non-Academic Busy Time Blocks** | P8 (Layla), P1 (Tariq) | Students with athletic training, club meetings, or part-time jobs cannot block recurring intervals (e.g., Sun/Tue 12–2). Only full-day blocks exist. |
| **MF-3** | **Campus Transit Buffer Rules in CSP Solver** | P2 (Nour), P9 (Rami) | Inter-building (Old vs New Campus) and inter-campus (Al-Arroub vs Tulkarm) transit times are treated as 0 minutes, producing physically impossible back-to-back schedules. |
| **MF-4** | **Dedicated Probation GPA Recovery Mode** | P3 (Omar) | Students under academic warning lack a dedicated catalog filter to quickly isolate failed/low-grade courses eligible for GPA overwrite. |
| **MF-5** | **Dual Major / Minor Degree Tracking** | P9 (Rami) | No support for secondary degree/minor tracking. Changing major destructively overwrites primary study plan state. |
| **MF-6** | **External Course Equivalency Mapping Tool** | P6 (Hiba) | Transfer students cannot map accredited external courses to PTUK prerequisite codes, causing false-positive prerequisite warnings. |
| **MF-7** | **Freshman Guided Onboarding Tour & Tooltips** | P7 (Ahmad) | First-term freshmen lack explanatory guidance on section codes, room nomenclature, and remedial tuition vs degree credit distinctions. |
| **MF-8** | **Low-Bandwidth / Lite Mode Toggle** | P10 (Salma) | Rural 3G students cannot disable heavy animations, background gradients, and canvas assets to minimize data consumption. |
| **MF-9** | **Live Screen Reader Announcements (`aria-live`)** | P5 (Yazan) | Dynamic updates (live seat openings, timetable conflict resolutions, auto-save status) lack ARIA live regions, leaving screen reader users blind to state changes. |
| **MF-10** | **Keyboard Navigation for Semester Roadmap** | P5 (Yazan) | `MultiColumnRoadmapView.tsx` relies strictly on HTML5 drag-and-drop; motor-impaired and keyboard users cannot move planned courses. |

---

### 3.2 Redundant or Useless Features

| # | Redundant Feature | File Location | Architectural / Complexity Impact | Recommendation |
|---|-------------------|---------------|-----------------------------------|----------------|
| **RF-1** | **Embedded Canvas Mini-Game in Login Screen** | `src/components/auth/CampusRunnerGame.tsx` (965 lines, 31.5 KB) | Adds 31.5 KB of dead bundle weight on mobile 3G where it is never rendered. Imposes a forced 3-second delay on login if touched. | Extract to an optional standalone Easter egg route or delete entirely; replace with clean spinner. |
| **RF-2** | **Web Audio Chime Engine in Registration** | `src/pages/RegistrationPage.tsx:163-180` | Generates Web Audio API context memory leaks on background tabs and annoys students during high-stress registration rushes. | Excise Web Audio chimes; rely on standard visual toast notifications. |
| **RF-3** | **Excessive Retro Themes in Theme Studio** | `src/themeManager.ts`, `src/styles/tokens.css` | 15+ retro themes add CSS token maintenance overhead without accessibility validation. | Consolidate to 4 validated themes: University Light, Forest Dark, OLED Black, and High Contrast. |
| **RF-4** | **Redundant Multi-Modal Code Paths in Registration** | `src/pages/RegistrationPage.tsx` | Duplicate Safe-Swap modal, duplicate share modal (73 lines), and unmounted section inputs bloat file to 3,881 lines. | Eliminate duplicate dialogs; unify section selection into native `<select>` controls. |
| **RF-5** | **Locked "Coming Soon" Registration Route Stub** | `src/App.tsx:1920-1940`, `2100-2116` | A 3,572-line registration page exists in `src/pages/RegistrationPage.tsx`, but is permanently locked behind "قيد التطوير" stubs in navigation. | Connect route cleanly or provide feature flag gating rather than misleading locked UI. |

---

### 3.3 Discovered Bugs, Defects & Edge-Case Failures

#### Critical Severity
1. **BUG-C1: Mathematical GPA Dilution for Transfer Students (`src/core/academicAdvisor.ts:387-409`)**:
   - `simulateGpaForecast` multiplies `currentGpa * completedHours` using all earned hours (local + transfer) instead of graded hours.
   - For Hiba (15 local @ 74.0 + 33 transfer credits), forecasting 15 cr @ 80 dilutes GPA to **75.42%** vs authentic PTUK GPA of **77.00%** (1.58% error).
   - For incoming transfer students with 0 local hours, forecast dilutes to **25.00%** vs authentic **80.00%**, falsely triggering academic warning warnings.
2. **BUG-C2: Honors 21-Credit Overload Registration Block (`src/core/semesterRegistration.ts:409-432`)**:
   - `checkPlanCreditLimits` checks `if (options.isGraduating)` to permit 21 credits, completely ignoring `options.gpa >= 80`.
   - High-achieving juniors (Maya, GPA 89.4%) attempting to register 21 credits are falsely capped at 19 credits and blocked from registering.
3. **BUG-C3: Zero-Section Course Solver Abort (`src/services/scheduleSolver.ts:451-458`)**:
   - `generateAllSchedules` executes `if (courses.some(c => !c.sections || c.sections.length === 0)) return [];`.
   - Adding non-meeting courses like Field Training (`15010400`) causes the solver to abort immediately and return 0 schedules for all courses.
4. **BUG-C4: Multi-Block Timing Erasure in Schedule Adoption (`src/components/modals/WeeklyScheduleModal.tsx:935-943`)**:
   - When adopting a generated schedule, the code executes `const block = item.section.blocks[0];` and applies only the first block's timing to all days, corrupting multi-block courses (e.g. lecture + lab, or different days/times).

#### High Severity
5. **BUG-H1: 24 Ad-Hoc Modals Bypassing Focus Containment (`src/components/modals/*`, `src/pages/*`)**:
   - Exactly 24 modals bypass `BaseModal.tsx`, failing to trap keyboard Tab focus and leaking focus to background elements (violating WCAG 2.1.2 & 2.4.3).
6. **BUG-H2: Modals Trapping Keyboard Users with Zero Escape Handlers**:
   - Modals in `CoursesPage.tsx:2449, 2633`, `WeeklySchedulePage.tsx:1429`, and `SemesterPlanningPage.tsx:2598, 2817` have zero `Escape` listeners, trapping keyboard-only users who cannot click backdrops.
7. **BUG-H3: Web Worker 15s Timeout Freezes Main UI Thread (`src/services/scheduleSolverClient.ts:117-126`)**:
   - When 7-course combinatorial search exceeds 15 seconds, client executes fallback synchronously on main thread, freezing the user's browser.
8. **BUG-H4: Mandatory Computer Skills (13010006) Degree Credit Shortfall (`src/core/courseProgress.ts:5-6, 20`)**:
   - Course `13010006` is a 1-credit mandatory requirement in `src/data.ts:52-58`, but is hardcoded in `REMEDIAL_COURSE_IDS`, causing `calculateDegreeCredits` to strip it and creating a permanent 1-credit degree deficit (131/132).
9. **BUG-H5: Disconnected Offline Queue (`src/core/offlineQueue.ts`)**:
   - `offlineQueue.ts` exists with persistence and drain logic, but has **0 callers** across all UI components. UI displays a false "All synced" badge while offline operations fail silently.

#### Medium Severity
10. **BUG-M1: Timetable Compound Key Lookup Mismatch (`src/pages/WeeklySchedulePage.tsx:309-312`)**:
    - Timetable entries stored as `${code}_${day}` fail lookup in `coursesById`, displaying raw codes (e.g. `"14010311_اث"`) instead of course names.
11. **BUG-M2: What-If GPA Simulation Freezes Earned Credits (`src/pages/GPAPage.tsx:315-333`)**:
    - `projectedGPA` updates, but `earnedCredits` passes only original `completedCourses` to `calculateDegreeCredits`, keeping earned credits frozen upon retakes.
12. **BUG-M3: Reset Original Grades Erases Transfer Marks (`src/pages/GPAPage.tsx:219, 232`)**:
    - `handleRestoreOriginalGrades` checks `if (c.grade > 0)`. Transfer courses stored with `grade: -1` are wiped upon reset.
13. **BUG-M4: Commuter Mode Preset Purges 08:30 Classes (`src/components/modals/WeeklyScheduleModal.tsx:2340-2364`)**:
    - Quick-action commuter button hardcodes `earliestClassTime = "09:00"`, eliminating 08:30 morning classes for rural commuters.
14. **BUG-M5: Misleading Solver Conflict Explanation (`src/services/scheduleSolver.ts:1167-1174`)**:
    - Sections pruned by commuter time window are falsely blamed as "manually excluded by user".
15. **BUG-M6: Modal Timetable Grid Truncated at 16:00 (`src/components/modals/WeeklyScheduleModal.tsx:3400-3480`)**:
    - Weekly schedule modal grid ends at 16:00, cutting off afternoon studio and evening courses (14:00–18:00).

#### Low Severity
16. **BUG-L1: Capstone & Training Eligibility Banner Buried in GPAPage**:
    - Senior eligibility status is calculated in `courseProgress.ts`, but displayed only in `GPAPage.tsx:515` and missing from `PlanPage.tsx`.
17. **BUG-L2: Non-Functional ESLint Pipeline (`eslint.config.js`)**:
    - ESLint configuration has 0 active rules; `"lint"` script in `package.json` only runs `tsc --noEmit`.
18. **BUG-L3: Bidirectional LTR/RTL Text Inversion**:
    - Course codes embedded in Arabic strings lack `<bdi>` tags, inverting punctuation and hyphenation in RTL layouts.

---

### 3.4 UI/UX Issues, Usability Barriers & Accessibility Observations

1. **Severe Text Contrast Failure in Light Theme**:
   - Secondary text styled with `text-slate-400` (#94a3b8) on white (#ffffff) evaluates to **2.56:1 contrast ratio**, violating WCAG 2.1 AA (4.5:1 minimum).
2. **Missing Skip-to-Main-Content Shortcut**:
   - Absence of `<a href="#main-content">` forces keyboard and screen reader users to Tab through 15+ navigation elements on every route transition.
3. **Form Controls Relying Exclusively on Placeholders**:
   - Search inputs in `CoursesPage.tsx` and dropdowns in `RegistrationPage.tsx` lack `<label>` or `aria-label` attributes, violating WCAG 1.3.1 and 3.3.2.
4. **Lack of Proactive Early Enforcement for Academic Probation**:
   - The 14-credit limit is shown as an advisory banner; students on probation can construct invalid 16-credit schedules across `PlanPage` and `WeeklyScheduleModal` before being rejected late at registration.
5. **Mobile Viewport Overcrowding in Monolithic Pages**:
   - 3,881-line `RegistrationPage.tsx` and 2,873-line `SemesterPlanningPage.tsx` cause frame drops and scroll lag on mid-range Android devices over 3G.

---

## 4. Prioritized Actionable Recommendations

### P0 — Immediate Critical Fixes (Academic Integrity & Core Reliability)
1. **Fix Transfer GPA Forecast Formula (`src/core/academicAdvisor.ts:387-409`)**:
   - Update `simulateGpaForecast` to accept `gradedHours` separately from `completedHours`. Calculate points as `currentGpa * gradedHours`, and denominator as `gradedHours + newHours`.
2. **Harmonize 21-Credit Overload Policy in Registration (`src/core/semesterRegistration.ts:409-432`)**:
   - Update `checkPlanCreditLimits` to check `options.gpa >= 80` in addition to `options.isGraduating`, matching `academicPolicy.ts`.
3. **Guard Zero-Section Courses in Solver (`src/services/scheduleSolver.ts:451-458`)**:
   - Separate courses into meeting courses (`sections.length > 0`) and non-meeting courses (e.g. Field Training). Solve meeting courses and append non-meeting courses cleanly.
4. **Correct Multi-Block Schedule Adoption (`src/components/modals/WeeklyScheduleModal.tsx:935-943`)**:
   - Iterate over all blocks in `item.section.blocks` rather than only `blocks[0]`. Assign day-specific start and end times.
5. **Correct Computer Skills Degree Classification (`src/core/courseProgress.ts:5-6, 20`)**:
   - Remove `13010006` from `REMEDIAL_COURSE_IDS` to restore the 1-credit degree requirement for Business and Engineering students.

### P1 — High-Priority Usability & Accessibility Remediations
6. **Wrap All 24 Ad-Hoc Modals in `BaseModal.tsx`**:
   - Refactor modals in `src/components/modals/` and page dialogs to wrap `BaseModal.tsx` to inherit focus containment, Escape key handlers, and focus restoration.
7. **Add Granular Time Cutoffs & Recurring Busy Blocks in Solver UI**:
   - Expose custom time inputs (`earliestClassTime` and `latestClassTime` with `13:00`, `13:30`) and allow users to define recurring blocked time intervals (e.g., Sun/Tue 12–2).
8. **Add Campus Transit Buffer Matrix in CSP Solver**:
   - Add transit rules: 15-minute buffer between Old Campus and New Campus; 90-minute buffer between Al-Arroub and Tulkarm.
9. **Eliminate Main-Thread Solver Fallback Freeze**:
   - If Web Worker times out, return a partial solution or polite notification; never run unbounded combinatorial search on the main thread.
10. **Implement `aria-live` Regions for Dynamic Updates**:
    - Add `aria-live="polite"` to seat watcher alerts, solver results, and timetable change banners.

### P2 — Performance & Code Cleanliness Hardening
11. **Eradicate Dead Code & Eager Bundle Bloat**:
    - Remove `CampusRunnerGame.tsx` from the initial bundle. Excise unused Web Audio chimes and duplicate modals in `RegistrationPage.tsx`.
12. **Configure Active ESLint Rules & React Hooks Plugin**:
    - Populate `eslint.config.js` with `@typescript-eslint/recommended`, `eslint-plugin-react-hooks`, and `eslint-plugin-jsx-a11y`.
13. **Enable TypeScript `noUncheckedIndexedAccess`**:
    - Add `"noUncheckedIndexedAccess": true` to `tsconfig.json` and replace explicit `any` instances with strict type narrowing.
14. **Protect Sensitive Storage (OWASP ASVS Compliance)**:
    - Avoid plaintext storage of full student transcripts in `localStorage`. Retain tokens in `HttpOnly; Secure; SameSite=Strict` cookies.

---

## 5. Audit Attestation & Reproducibility

All assessments, test suites, and measurements in this report are 100% reproducible in local offline isolation:

```powershell
# 1. Run Persona Evaluation & Standards Verification Suites (72 tests)
node --import tsx --test "tests/personaValidation.test.ts" "tests/standardsAudit.test.ts" "tests/personaJourneys.test.ts"

# 2. Run Full Repository Test Suite (371 tests)
npm test

# 3. Verify Zero Academic Illusions Across Source Code
node scripts/audit-illusions.js

# 4. Verify TypeScript Compilation & Strictness
npx tsc --noEmit

# 5. Verify Production Build Cleanliness
npm run build
```

*Attestation: Zero source code files under `src/`, `server/`, or `scripts/` were modified directly during this evaluation. All tests and verifications executed against local mock data in total isolation.*
