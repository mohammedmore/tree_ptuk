# Comprehensive Persona Evaluation & Architectural Audit Report: Personas 8, 9, and 10

**Agent**: `explorer_m3_3` (Teamwork Explorer — Milestone 3)  
**Date**: 2026-11-14  
**Working Directory**: `c:\Users\mohammed\Desktop\planner\.agents\teamwork\explorer_m3_3\`  
**Target Repository**: `c:\Users\mohammed\Desktop\planner`  
**Parent Orchestrator ID**: `b888a5de-c39e-41a3-8613-2c11312234bb`  

---

## 1. Observation

All observations are directly grounded in source code inspection, AST verification, and offline test executions within `c:\Users\mohammed\Desktop\planner`.

### 1.1 Routing Architecture & Dead Endpoints (`src/router.ts` & `src/App.tsx`)
- **Orphaned Registration Page (`src/App.tsx:1920-1940`, `src/App.tsx:2100-2116`)**:
  While `src/pages/RegistrationPage.tsx` exists as a 3,572-line (150 KB) component implementing cascading plans (A/B/C) and real-time seat monitoring, it is **never mounted in `src/App.tsx`**.
  In `src/App.tsx:1920-1940`:
  ```tsx
  {currentRoute === "registration" && (
    <section aria-labelledby="registration-coming-soon-title" className="...">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--sunken)] ...">
        <Lock size={24} aria-hidden="true" />
      </div>
      <h1 id="registration-coming-soon-title">تسجيل الفصل</h1>
      <p>قيد التطوير</p>
    </section>
  )}
  ```
  In mobile bottom navigation (`src/App.tsx:2100-2116`):
  ```tsx
  if (item.route === "registration") {
    return (
      <button key={item.route} type="button" disabled title="قيد التطوير" className="... opacity-50 cursor-not-allowed">
        <Icon size={17} strokeWidth={1.75} />
        <Lock size={10} aria-hidden="true" />
        <span>{item.label}</span>
      </button>
    );
  }
  ```
  The registration interface is completely locked out across both desktop and mobile views.
- **Missing Dedicated `/calendar` Route Component (`src/App.tsx:1827-1828`)**:
  `src/router.ts:10` defines `"calendar"` as a valid route, but `src/App.tsx:1827-1828` handles it via:
  ```tsx
  {(currentRoute === "plan" || currentRoute === "calendar") && (
    <PlanPage ... />
  )}
  ```
  Navigating to `#/calendar` renders the study plan graph instead of an academic calendar. Academic calendar details remain confined to an ad-hoc modal (`AcademicCalendarModal.tsx`) triggered exclusively inside `SemesterPlanningPage.tsx:1866`.

---

### 1.2 Persona 8: Layla Qasim (Student Athlete & Club Leader) Observations
- **Schedule Solver Lacks Granular Recurring Busy Blocks (`src/services/scheduleSolver.ts:85-102`)**:
  `CatalogScheduleFilters` exposes only coarse-grained day filters:
  ```typescript
  export interface CatalogScheduleFilters {
    freeDays?: string[]; // Day keys, e.g. "سب" or "أح"
    excludedSections?: Record<string, string[]>;
    pinnedSections?: Record<string, string>;
    timePreference?: "morning" | "late" | "compact" | "min_days" | "";
    maxGap?: number | null;
    maxResults?: number;
    genderPreference?: "all" | "male" | "female";
    diverseSolutions?: boolean;
  }
  ```
  There is no mechanism in `CatalogScheduleFilters` or `WeeklyScheduleModal.tsx` for Layla to specify recurring partial-day non-academic busy blocks (e.g. Basketball training: Sun/Tue 12:00-14:00; Student Club meeting: Thu 13:00-15:00). Specifying `freeDays: ["أح", "ثلا", "خمـ"]` completely prunes Sunday, Tuesday, and Thursday, destroying all possible schedules for full-time 15-credit enrollment.
- **Weekly Schedule Entry Key Inconsistency (`src/App.tsx:2057`, `src/pages/WeeklySchedulePage.tsx:309-312`)**:
  When a student profile is synchronized from Edugate, `src/App.tsx:2057` stores timetable entries using compound keys:
  ```typescript
  newSched[`${ec.code}_${d}`] = {
    day: d,
    startTime: `${Math.floor(b.start / 60)}:${String(b.start % 60).padStart(2, "0")}`,
    endTime: `${Math.floor(b.end / 60)}:${String(b.end % 60).padStart(2, "0")}`,
    instructor: ec.instructor,
    room: ec.room,
    section: ec.sec,
  };
  ```
  However, in `src/pages/WeeklySchedulePage.tsx:309-312`:
  ```typescript
  Object.entries(currentSchedule).forEach(([courseId, entry]) => {
    const c = coursesById.get(courseId);
    const name = c ? c.name : courseId;
  ```
  Because `coursesById` is keyed by course code (e.g. `"14010311"`), looking up compound key `"14010311_اث"` returns `undefined`. The weekly timetable card displays raw text `"14010311_اث"` instead of `"تايبوغرافي 2"`.
- **Multi-Block Timing Discard in Schedule Adoption (`src/components/modals/WeeklyScheduleModal.tsx:935-943`, `958-972`)**:
  When a student adopts a generated schedule in `WeeklyScheduleModal.tsx`:
  ```typescript
  for (const item of scheduleToAdopt) {
    const block = item.section.blocks[0]; // ONLY READS FIRST BLOCK!
    const days = (item.section.blocks ?? []).flatMap((b) =>
      (b.days ?? []).map((d) => DAY_NAME_BY_KEY.get(normalizeDayKey(d) ?? d) ?? d)
    );
    const uniqueDays = Array.from(new Set(days)).filter(Boolean);
    semesterSchedule[item.courseCode] = {
      startTime: block ? formatScheduleTime(block.start) : "08:00",
      endTime: block ? formatScheduleTime(block.end) : "09:30",
      section: item.section.sec,
      instructor: item.section.instructor ?? "",
      room: item.section.room ?? "",
      days: uniqueDays,
    };
  }
  ```
  If a course contains distinct contact blocks on different days (e.g., Lecture on Monday 09:30-11:00, Studio on Wednesday 08:00-12:00), the Wednesday timing is silently overwritten by Monday's start/end times (`block.start`, `block.end` from `blocks[0]`).
- **Modal Grid Truncation for Late Studio Classes (`src/components/modals/WeeklyScheduleModal.tsx:118-120`)**:
  ```typescript
  const HOURS = Array.from({ length: 8 }, (_, i) => i + 8); // [8, 9, 10, 11, 12, 13, 14, 15]
  const GRID_START_MINUTES = 8 * 60; // 08:00
  const GRID_END_MINUTES = 16 * 60;   // 16:00
  ```
  The schedule solver modal grid cuts off at 16:00 (4:00 PM). Studio courses scheduled 13:00 - 17:00 or 14:00 - 18:00 extend past the visible SVG/CSS container boundary and are rendered off-screen.
- **iCal Export Course Name Resolution Failure (`src/services/icalExport.ts:82-85`)**:
  ```typescript
  for (const [courseId, entry] of Object.entries(schedule)) {
    const course = coursesMap.get(courseId);
    const courseName = course ? course.name : courseId;
  ```
  Compound keys (`"14010311_اث"`) resolve to `undefined` in `coursesMap`, exporting calendar summary as `"14010311_اث (شعبة 1)"` rather than `"تايبوغرافي 2 (شعبة 1)"`.

---

### 1.3 Persona 9: Rami Odeh (Interdisciplinary Dual-Track / Minor) Observations
- **Complete Lack of Minor / Dual-Track Data Structure (`src/stores/useAcademicStore.ts:13-26`)**:
  `AcademicState` holds only single-major state:
  ```typescript
  export interface AcademicState {
    courses: Course[];
    activeMajorId: string;
    activeMajorName: string;
    categoryRequirements: Record<string, number>;
    completedCourses: Set<string>;
    plannedCourses: Record<string, string>;
  ```
  There is zero support for declaring or tracking a secondary minor curriculum (e.g. 21 credits in Business Administration alongside 160 credits in Agricultural Engineering).
- **Destructive Major Switching (`src/pages/LoginPage.tsx:1946-1956`, `src/stores/useAcademicStore.ts:89-94`)**:
  When a student uses `MajorSelectorModal.tsx` to view minor requirements, `setCourses` overwrites the primary major's course list. In `src/App.tsx:1950-1955`:
  ```typescript
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith("ptuk_major_plan_")) {
      localStorage.removeItem(key);
    }
  }
  ```
  Switching majors wipes cached major plans, causes all primary major course IDs stored in `plannedCourses` to become unrecognized orphaned IDs on `PlanPage.tsx`, and corrupts category credit totals.
- **Cross-Faculty Flat Tuition Rate Bug (`src/services/tuitionFeesService.ts:253-270`)**:
  ```typescript
  export function calculateSemesterTuition({
    majorName = "",
    credits = 18,
    isFreshman = false,
    customExchangeRate = null,
  }: ...): TuitionCalculationResult {
    const rateInfo = getOfficialTuitionRate(majorName);
    const hourlyRateJOD = rateInfo.hourlyRateJOD;
    const creditsFeeJOD = credits * hourlyRateJOD;
  ```
  Tuition is computed by multiplying ALL enrolled credits by the primary major's hourly rate (`credits * hourlyRateJOD`). Course codes outside the faculty (e.g. Business courses `13010201` at 20 JOD/hr taken by an Engineering student at 24 JOD/hr, or vice versa) are billed at the primary major's rate rather than the offering faculty rate.
- **Physical Cross-Campus Transit Blindness (`src/services/scheduleSolver.ts:329-363`)**:
  `hasConflict` checks time intervals strictly:
  ```typescript
  if (sharedDay && assignedBlock.start < candidateBlock.end && candidateBlock.start < assignedBlock.end) {
    return true;
  }
  ```
  The solver checks temporal overlap (`start < end`), but **ignores section building/campus location**. If Rami has an Agricultural Engineering class at Al-Arroub Agricultural Farm (or Old Campus Labs) ending at 11:00 AM and a Business Minor class at Central Campus starting at 11:00 AM or 11:15 AM on the same day:
  - `hasConflict` returns `false` (no temporal overlap).
  - `calculateScheduleQuality` gives full score for `gap = 0` (rewarding "compact schedule").
  - In physical reality, travel between Al-Arroub / Far'a and Central Campus requires a 45–60 minute intercampus transit buffer. The solver generates unviable schedules.
- **Restricted Custom Course Categories (`src/components/modals/AddCourseModal.tsx:12-19`)**:
  ```typescript
  const CATEGORIES = [
    "متطلب جامعة إجباري",
    "متطلب جامعة اختياري",
    "متطلب كلية إجباري",
    "متطلب تخصص إجباري",
    "متطلب تخصص اختياري",
    "متطلب استدراكي إجباري",
  ] as const;
  ```
  No category exists for "متطلب تخصص فرعي" (Minor Requirement) or "خارج الخطة" (Out-of-Plan Elective). Dual-track students must misclassify minor courses as primary major electives.

---

### 1.4 Persona 10: Salma Barghouthi (Rural / Low Connectivity) Observations
- **Eager Bundle Bloat: 31.5 KB Campus Runner Game Embedded in Login (`src/components/auth/LoginSyncExperience.tsx:2`, `212-219`)**:
  ```tsx
  import CampusRunnerGame from "./CampusRunnerGame"; // 965 lines, 31.5 KB canvas game
  ...
  {isDesktop ? (
    <div className="w-full flex-1 min-h-[160px] flex flex-col justify-end overflow-hidden pb-0">
      <CampusRunnerGame isSuccess={isSuccess} ... />
    </div>
  ) : (
    /* Mobile View - CampusRunnerGame is NOT RENDERED AT ALL */
    <div className="w-full flex-1 flex flex-col items-center justify-center p-3 text-center my-auto">
  ```
  `CampusRunnerGame` is statically imported into `LoginSyncExperience`, which is statically imported into `LoginPage.tsx`. On mobile devices, the game canvas is never displayed, yet rural students over high-latency 3G cellular (400ms ping, 50-100 kbps) are forced to download the entire 31.5 KB bundle before the authentication screen can execute.
- **Dead Offline Queue Architecture (`src/core/offlineQueue.ts:36-78`)**:
  `src/core/offlineQueue.ts` implements `enqueueMutation` and `drainOfflineQueue`. Grep audit across the entire `src/` directory confirms that **`enqueueMutation` and `drainOfflineQueue` are never invoked in any UI page or store**.
  - `grep_search(Query: "enqueueMutation", SearchPath: "src")` -> Only found in `src/core/offlineQueue.ts:36`.
  - `grep_search(Query: "drainOfflineQueue", SearchPath: "src")` -> Only found in `src/core/offlineQueue.ts:52`.
  When Salma modifies her plan or schedule while offline during a power outage or 3G brownout, no mutations are queued.
- **Deceptive Offline Reconnection Banner (`src/components/common/OfflineBanner.tsx:13-21`)**:
  ```tsx
  if (isOnline && wasOffline) {
    return (
      <div role="status" className="no-print bg-emerald-600/90 text-white ...">
        <CheckCircle2 size={14} className="shrink-0" />
        <span>عادت شبكة الإنترنت! تمت مزامنة كافة التعديلات تلقائياً.</span>
      </div>
    );
  }
  ```
  The banner announces to the student that all modifications were automatically synchronized, when in reality no synchronization call was executed.
- **Transient Idempotency Key Lost on Connection Drops (`src/pages/RegistrationPage.tsx:1326-1413`)**:
  ```typescript
  const handleExecuteNow = async () => {
    ...
    try {
      const idempotencyKey = `reg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const summary = await executeRegistration(studentId, livePassword, plans, {
        idempotencyKey,
        ...
      });
    } catch (err: any) {
      addAuditLog(`حدث خطأ أثناء معالجة الإرسال: ${err.message}`, "error");
      showToast(`فشل الإرسال: ${err.message}`);
    }
  ```
  `idempotencyKey` is created as an ephemeral local variable in `handleExecuteNow`. If a 3G timeout occurs after Edugate processes the registration but before the response packet arrives:
  1. The catch block runs and shows an error toast.
  2. The local `idempotencyKey` is discarded; it is **never saved to `localStorage` or `sessionStorage`**.
  3. When Salma reconnects and clicks "تسجيل الخطة الآن" again, a completely new `idempotencyKey` is minted.
  4. The backend server's idempotency deduplication cache (`server/routes/registration.js:212` and `server/services/registrationEngine.js:116`) fails to recognize the retry, risking conflicting duplicate registrations or locked seats.
- **Simulation Mode Forges False Success on Network Dropped (`src/services/registrationService.ts:177-212`)**:
  ```typescript
  } catch (err: any) {
    if (options.demoMode === false && password) {
      throw new Error(err.message || "فشل الاتصال المباشر ببوابة الجامعة Edugate.");
    }
    // Client-side fallback execution (Demo/Simulation mode)
    const items = plans[options.targetPlan || "A"]?.items || [];
    const results = items.map((item, idx) => ({
      status: "registered" as const,
      message: `تم تثبيت تسجيل الشعبة (${item.section}) بنجاح.`,
      ...
    }));
    return { status: "completed", registeredCount: items.length, ... };
  }
  ```
  In demo or simulation mode, if the network drops or backend is unreachable, the client catches the error and fabricates a 100% successful registration summary (`status: "completed"`), creating a dangerous illusion of connectivity.
- **Fixed 15-Semester Dropdown Overwhelms 2-Year Diploma Students (`src/constants.ts:101-117`, `src/pages/SemesterPlanningPage.tsx:300-308`)**:
  `SEMESTERS` is hardcoded as an immutable list of 15 terms (Years 1 to 5, including Summer). In `SemesterPlanningPage.tsx`, Salma (enrolled in a 72-credit, 2-year Vocational IT Diploma) must navigate past Year 3, Year 4, and Year 5 semesters.

---

### 1.5 Feature Utility Audit: High-Value vs. Redundant Features

| Feature / Artifact | Persona 8 (Athlete) | Persona 9 (Dual-Track) | Persona 10 (Rural 3G) | Architectural Assessment |
|---|---|---|---|---|
| **`CampusRunnerGame.tsx` (965 lines, 31.5 KB)** | ❌ Redundant clutter | ❌ Redundant clutter | ❌ Severe Penalty (Wastes mobile data, unrendered on mobile) | **REDUNDANT**: Eagerly loaded in login experience. Zero educational or scheduling utility. |
| **`ThemeStudio.tsx` (Stub returning `null`)** | ⚪ Dead code | ⚪ Dead code | ⚪ Dead code | **USELESS**: Empty stub file returning `null` imported across multiple components. |
| **`syncAudio.ts` (Web Audio synthesis)** | ⚪ Annoyance | ⚪ Annoyance | ❌ Battery & CPU drain on low-spec phones | **REDUNDANT**: Synthesized audio chimes during scraper steps provide negative accessibility. |
| **Client-Side CSP Schedule Solver (`scheduleSolver.ts`)** | ⭐ High value | ⭐ High value | ⭐ Critical value (Operates 100% offline in browser) | **HIGH VALUE**: Core application strength. Requires time-window clamping and transit buffers. |
| **`offlineQueue.ts`** | ⚪ Unused | ⚪ Unused | ⭐ Essential concept (Currently completely disconnected) | **HIGH VALUE INTENT / BROKEN IMPLEMENTATION**: Queue structure exists but has 0 callers in UI. |
| **Plan A/B/C Cascading Fallback** | ⭐ High value | ⭐ High value | ⭐ Critical value (Pre-computed offline fallbacks) | **HIGH VALUE**: Trapped behind disabled registration route. |
| **Offline SQLite Cache (`planner.sqlite`)** | ⚪ Desktop server | ⚪ Desktop server | ⭐ High value for backend, but absent on client | **INCOMPLETE**: Client uses `localStorage` exclusively; lacks IndexedDB fallback. |

---

## 2. Logic Chain

The analytical deductions connecting observed code patterns to student failure modes:

```
[Observation: `WeeklyScheduleModal.tsx:935-943` assigns `blocks[0].start` to all days in `uniqueDays`]
  ├──> [Inference 8.1: A studio or split lecture-lab course having different start hours on different days loses secondary block timings]
  └──> [Conclusion 8.1: Layla's timetable renders studio sessions at incorrect hours, causing real-world missed classes and athlete training clashes]

[Observation: `App.tsx:2057` keys `weeklySchedule` by `${ec.code}_${d}`, while `WeeklySchedulePage.tsx:310` looks up `coursesById.get(courseId)`]
  ├──> [Inference 8.2: Map lookup `coursesById.get("14010311_اث")` returns `undefined`]
  └──> [Conclusion 8.2: Course tiles on timetable and iCal calendar exports display raw cryptic keys instead of course names]

[Observation: `useAcademicStore.ts` stores only single `activeMajorId`; switching majors clears plan caches (`App.tsx:1950`)]
  ├──> [Inference 9.1: No data structure supports secondary major or minor degree course tracks]
  └──> [Conclusion 9.1: Rami cannot view or plan his Business Minor without wiping his Agricultural Engineering plan]

[Observation: `scheduleSolver.ts:354-360` checks only `start < end` and ignores section `building`/`campus`]
  ├──> [Inference 9.2: 0-minute transition between Arroub Agriculture Farm and Tulkarm Main Campus is treated as "ideal compact schedule"]
  └──> [Conclusion 9.2: Solver generates schedules that are physically impossible to attend due to travel times]

[Observation: `tuitionFeesService.ts:266` computes `creditsFeeJOD = credits * hourlyRateJOD(majorName)`]
  ├──> [Inference 9.3: Course faculty and course prefix are ignored during billing]
  └──> [Conclusion 9.3: Dual-track students taking courses across distinct faculties are inaccurately billed at primary major rates]

[Observation: `CampusRunnerGame.tsx` (31.5 KB) is eagerly imported in `LoginSyncExperience.tsx:2` but conditionally hidden on mobile]
  ├──> [Inference 10.1: Mobile devices on cellular connections must download 31.5 KB of unexecuted canvas code over 400ms 3G latency]
  └──> [Conclusion 10.1: First Contentful Paint (FCP) and Time to Interactive (TTI) are degraded for rural students on spotty connectivity]

[Observation: `RegistrationPage.tsx:1326` generates `idempotencyKey` as an in-memory local variable and catches network drop in line 1410]
  ├──> [Inference 10.2: On connection failure, key is discarded; subsequent user retry generates a new key]
  └──> [Conclusion 10.2: Server idempotency cache is bypassed; flaky network retries trigger duplicate requests or lock seats]

[Observation: `offlineQueue.ts` functions `enqueueMutation` and `drainOfflineQueue` have 0 calls in `src/`]
  ├──> [Inference 10.3: Mutations are never stored in the offline queue during disconnections]
  └──> [Conclusion 10.3: `OfflineBanner.tsx` claiming "All changes synced automatically" is a complete illusion; unsaved state is lost on tab refresh]
```

---

## 3. Caveats

1. **Read-Only Investigation Integrity**: In strict adherence to agent guidelines, no source code files (`src/`, `server/`, `scripts/`) were edited or modified. All proposed remediations are formulated as concrete patches and architectural designs.
2. **Local Isolation Constraint**: Network calls to live Palestine Technical University Edugate endpoints (`edugate.ptuk.edu.ps`) were not executed. Behavior was analyzed via Playwright mock fixtures, unit test suites, and source inspection.
3. **Simulation Mode Masking**: Client-side simulation fallback in `registrationService.ts:185-212` artificially returns `status: "completed"` during offline runs. This can mask real network errors during testing unless explicitly configured with `demoMode: false`.

---

## 4. Conclusion

The application demonstrates strong foundational algorithms—notably the offline CSP schedule solver (`generateAllSchedules`) and the comprehensive academic policy definitions (`academicPolicy.ts`). However, evaluation across Personas 8, 9, and 10 reveals significant architectural gaps:

1. **Persona 8 (Layla Qasim)**: Severely hindered by schedule solver limitations: lack of recurring time-block constraints (forcing whole-day exclusions), modal grid truncation at 16:00, multi-block course timing corruption in `WeeklyScheduleModal.tsx:935`, and raw ID display on weekly timetables.
2. **Persona 9 (Rami Odeh)**: Completely unsupported due to single-major architectural assumption: no Minor degree tracking, destructive major switching, flat-rate tuition billing that ignores cross-faculty rates, and zero-minute cross-campus transit blindness in the CSP solver.
3. **Persona 10 (Salma Barghouthi)**: Disproportionately burdened by bundle bloat (`CampusRunnerGame` 31.5 KB on mobile 3G), completely disconnected offline queue (`offlineQueue.ts` has 0 callers), unpersisted idempotency keys that break flaky network retries, and locked registration screens.

---

## 5. Verification Method

To independently reproduce and verify all observations, defects, and behavioral failures:

### 5.1 Automated Test Suite Verification
Run the complete automated test suite in offline mode:
```powershell
npm test
```
*Expected Result*: All 273 tests in `tests/*.test.ts` pass, confirming domain module integrity.

### 5.2 Persona 8 Timetable Key Mismatch Verification
Inspect `src/App.tsx:2057` and `src/pages/WeeklySchedulePage.tsx:310`:
```powershell
Get-Content src/App.tsx | Select-String "newSched\["
Get-Content src/pages/WeeklySchedulePage.tsx | Select-String "coursesById.get"
```
Notice `App.tsx` sets key `${ec.code}_${d}`, whereas `WeeklySchedulePage.tsx` passes that key directly into `coursesById.get(courseId)`, returning `undefined`.

### 5.3 Schedule Modal Multi-Block Flattening Inspection
Inspect `src/components/modals/WeeklyScheduleModal.tsx:935-943`:
```powershell
Get-Content src/components/modals/WeeklyScheduleModal.tsx | Select-Object -Skip 934 -First 10
```
Notice `const block = item.section.blocks[0];` is applied uniformly to all `uniqueDays`, proving that split-time or multi-block studio courses have secondary block times discarded.

### 5.4 Offline Queue Disconnection Verification
Verify that `enqueueMutation` has zero callers in the application:
```powershell
git grep "enqueueMutation" src/
```
*Expected Result*: Only matches its own definition in `src/core/offlineQueue.ts`. Zero callers in `src/pages/`, `src/components/`, or `src/stores/`.

### 5.5 Mobile CampusRunnerGame Bundle Bloat Inspection
Inspect imports in `src/components/auth/LoginSyncExperience.tsx:2` and conditional render in lines 212-220:
```powershell
Get-Content src/components/auth/LoginSyncExperience.tsx | Select-Object -First 5
Get-Content src/components/auth/LoginSyncExperience.tsx | Select-Object -Skip 211 -First 10
```
Confirms static eager import of `CampusRunnerGame` and conditional omission on mobile, proving mobile devices download unused game code.

### 5.6 Invalidation Conditions
This report's findings would be invalidated if:
1. `RegistrationPage.tsx` is mounted and routed in `src/App.tsx`, replacing the "قيد التطوير" stub.
2. `WeeklyScheduleModal.tsx:935` is refactored to support distinct blocks per meeting day.
3. `scheduleSolver.ts` incorporates `building`/`campus` distance transit checks.
4. `offlineQueue.ts` is connected to application state stores with background drainage.
5. `CampusRunnerGame.tsx` is removed or dynamically lazy-loaded.

---

## 6. Detailed Persona User Journeys & Interaction Transcripts

```
====================================================================================================
                        DETAILED 10-STUDENT PERSONA EVALUATION: PERSONAS 8 - 10
====================================================================================================
```

### 6.1 Persona 8: Layla Qasim (Student Athlete & Club Leader)

#### Profile & Context
- **Major**: Graphic Design & Applied Arts (التصميم الجرافيكي والفنون التطبيقية), Faculty of Applied Arts.
- **Degree Total**: 132 Credit Hours.
- **Standing**: 3rd-Year Junior, GPA: 80.2%, Completed: 75/132 Credits. Tuition: 24 JOD/hr.
- **Fixed Weekly Commitments**:
  1. University Basketball Team Training: Sunday & Tuesday 12:00 – 14:00 (Mandatory Athletic Scholarship requirement).
  2. Student Arts Club Executive Council: Thursday 13:00 – 15:00.
- **Academic Course Load (15 Credits Target)**:
  - `14010311`: Typography Studio 2 (تايبوغرافي 2) — 3 cr (Single 4-hour weekly studio: Monday 08:00 – 12:00)
  - `14010321`: Motion Graphics Studio (رسوم متحركة) — 3 cr (Single 4-hour weekly studio: Wednesday 12:00 – 16:00)
  - `14010331`: Brand Identity Design (تصميم الهوية البصرية) — 3 cr (Sun/Tue 08:30 – 10:00)
  - `15200105`: Palestine Studies (دراسات فلسطينية) — 3 cr (Sun/Tue 10:00 – 11:30)
  - `14010341`: Packaging Design (تصميم التغليف) — 3 cr (Thu 09:30 – 12:30)

#### End-to-End Route Journey Audit:
1. **Route `login`**:
   - *Interaction*: Layla logs in on her laptop after morning basketball practice.
   - *Friction*: Login screen displays `LoginSyncExperience` with `CampusRunnerGame`. Layla must wait through sync animation and ignore game prompts to proceed.
2. **Route `plan`**:
   - *Interaction*: Layla accesses `/plan` to verify remaining junior-year studio electives.
   - *Friction*: Graphic Design & Applied Arts is not present in `FALLBACK_MAJORS` (only CSE and AI exist). If offline or guest, she is shown Computer Systems Engineering. In online mode with synced profile, studio courses display identical badge styling (`3 cr`) to standard 3-hour theoretical lectures, providing zero indication that studio courses require 4 contact hours.
3. **Route `courses`**:
   - *Interaction*: Layla filters courses to inspect `14010311` (Typography Studio 2) and `14010321` (Motion Graphics).
   - *Friction*: No filter exists for "Studio Courses" vs "Theoretical Lectures". Section listings do not highlight 4-hour continuous duration blocks.
4. **Route `semester-planning`**:
   - *Interaction*: Layla drags 5 target courses into "السنة الثالثة - الفصل الأول".
   - *Friction*: Workload summary displays "15 Credit Hours - Moderate Workload". In physical reality, Layla is registering for 17 studio contact hours plus 6 hours of athletics/club duties (23 hours on campus). The planner provides no "Physical Contact Hours" metric.
5. **Route `schedule`**:
   - *Interaction*: Layla clicks "حل التعارضات تلقائياً" to open `WeeklyScheduleModal.tsx`.
   - *Failure 1 (No Granular Time Window)*: Layla needs to block Sun/Tue 12:00-14:00 and Thu 13:00-15:00. The filters only offer `freeDays` ("أح", "ثلا", "خمـ"). Checking those three days removes all Sunday, Tuesday, and Thursday sections, resulting in 0 generated schedules.
   - *Failure 2 (16:00 Grid Truncation)*: Motion Graphics studio runs until 16:00 or 16:30. In `WeeklyScheduleModal.tsx:120`, `GRID_END_MINUTES = 16 * 60`. The lower portion of the course block is cut off by the container boundary.
   - *Failure 3 (Schedule Adoption Timing Wipe)*: Layla finds an acceptable schedule and clicks "اعتماد الجدول". In `WeeklyScheduleModal.tsx:935-943`, the adoption handler extracts only `blocks[0]`. Any course with multi-day differing hours is corrupted.
   - *Failure 4 (Key Mismatch on Timetable)*: Returning to `WeeklySchedulePage.tsx`, course cards display raw string `14010311_اث` instead of course name.
   - *Failure 5 (iCal Export)*: Exporting to Google Calendar via `exportScheduleToICal` produces events titled `14010311_اث (شعبة 1)`.
6. **Route `gpa`**:
   - *Interaction*: Layla tests hypothetical semester marks (grades 85, 82, 88, 90, 78).
   - *Result*: GPA calculations execute correctly and match PTUK credit weighting.
7. **Route `registration`**:
   - *Interaction*: Layla clicks "التسجيل" in the bottom navigation.
   - *Failure*: The tab button is disabled with a Lock icon and tooltip "قيد التطوير".
8. **Route `calendar`**:
   - *Interaction*: Layla navigates to `#/calendar` to check basketball tournament dates against midterm exam week.
   - *Failure*: Browser loads `PlanPage` flowchart instead of academic calendar events.

---

### 6.2 Persona 9: Rami Odeh (Interdisciplinary Dual-Track / Minor)

#### Profile & Context
- **Major**: Agricultural Engineering (الهندسة الزراعية), Faculty of Agricultural Sciences & Veterinary Medicine (160 Credit Hours).
- **Minor**: Business Administration (فرعي إدارة أعمال), Faculty of Business & Economics (21 Credit Hours).
- **Standing**: 4th-Year Senior, GPA: 78.4%, Completed: 118/160 (Major) + 9/21 (Minor).
- **Geographic & Campus Constraints**:
  - Agricultural Engineering lectures/labs are held at the Al-Arroub Agricultural Farm Campus & Old Campus agricultural complex.
  - Business Administration courses are held at the Central Tulkarm Campus.
  - Transit requirement: Minimum **45 minutes buffer** between classes when moving between campuses.
- **Academic Course Load (15 Credits Target)**:
  - `16010411`: Plant Protection & Pathology (وقاية النبات وأمراضه) — 3 cr (Agriculture - 20 JOD/hr)
  - `16010421`: Irrigation & Drainage Systems (نظم الري والصرف) — 3 cr (Agriculture - 20 JOD/hr)
  - `16010431`: Soil Fertility & Fertilizers (خصوبة التربة والأسمدة) — 3 cr (Agriculture - 20 JOD/hr)
  - `13010201`: Marketing Management (إدارة التسويق) — 3 cr (Business Minor - 20 JOD/hr)
  - `13010301`: Financial Management (الإدارة المالية) — 3 cr (Business Minor - 20 JOD/hr)

#### End-to-End Route Journey Audit:
1. **Route `login`**:
   - *Interaction*: Rami logs in. Sync profile captures his primary major "الهندسة الزراعية".
   - *Friction*: Edugate sync payload does not capture minor degree tracking metadata; minor progress is treated as out-of-plan electives.
2. **Route `plan`**:
   - *Interaction*: Rami inspects his degree progress.
   - *Failure 1 (No Minor Track Support)*: The flowchart displays only Agricultural Engineering (160 credits). There is no tab, toggle, or auxiliary view to inspect progress toward his 21-credit Business Minor.
   - *Failure 2 (Destructive Major Selector)*: Rami opens `MajorSelectorModal.tsx` and selects "إدارة الأعمال". The store executes `setCourses` with Business courses, wiping all Agricultural Engineering course nodes from the canvas and invalidating `plannedCourses`.
   - *Failure 3 (Missing Minor Category)*: In `AddCourseModal.tsx`, Rami tries to manually add `13010201` Marketing Management. The category dropdown lacks "متطلب تخصص فرعي", forcing him to select "متطلب تخصص اختياري", which skews his category audit.
3. **Route `courses`**:
   - *Interaction*: Rami searches for Business minor requirements (`13010201`).
   - *Friction*: When active major is Agricultural Engineering, the course list is scoped to Agriculture. He cannot browse cross-faculty business courses from the catalog drawer.
4. **Route `semester-planning`**:
   - *Interaction*: Rami plans his 3 Agriculture courses and 2 Business courses for the upcoming term.
   - *Failure (Flat Tuition Overcharging / Distortion)*: The tuition widget executes `calculateSemesterTuition({ majorName: "الهندسة الزراعية", credits: 15 })`. While Agriculture and Business happen to share a 20 JOD/hr rate, if an Engineering student (24 JOD/hr) takes Business minor courses (20 JOD/hr), the calculator overbills all business courses at 24 JOD/hr.
5. **Route `schedule`**:
   - *Interaction*: Rami runs the automated schedule solver for his 5 selected courses.
   - *Failure (Cross-Campus Transit Blindness)*:
     - Candidate Section A: `16010411` (Plant Pathology) at Al-Arroub Farm Campus ends at 11:00 AM on Monday.
     - Candidate Section B: `13010201` (Marketing Management) at Central Campus starts at 11:00 AM or 11:15 AM on Monday.
     - `scheduleSolver.ts` checks `hasConflict`: `assignedBlock.start < candidateBlock.end && candidateBlock.start < assignedBlock.end`. Because 11:00 <= 11:00, it reports **0 conflict**.
     - `calculateScheduleQuality` rates this schedule as "جدول ممتاز ومريح (بدون فراغات)" because `totalGap = 0`.
     - In physical reality, traveling between Al-Arroub / Far'a and Central Campus takes 45-60 minutes. Rami cannot physically attend back-to-back classes across separate campuses.
6. **Route `gpa`**:
   - *Interaction*: Rami projects his cumulative GPA.
   - *Friction*: Cumulative GPA calculates accurately, but the page provides no separate breakdown for "Major GPA" (معدل التخصص) vs "Minor GPA" (معدل الفرعي), which PTUK requires for graduation with minor distinction.
7. **Route `registration`**:
   - *Failure*: Disabled and locked as "قيد التطوير".
8. **Route `calendar`**:
   - *Failure*: Renders `PlanPage` instead of academic dates.

---

### 6.3 Persona 10: Salma Barghouthi (Rural / Low Connectivity)

#### Profile & Context
- **Major**: Vocational IT / Web Application Development (دبلوم تكنولوجيا المعلومات), Palestine Technical College.
- **Degree Total**: 72 Credit Hours (2-Year Intermediate Diploma / دبلوم متوسط).
- **Standing**: 1st-Year Diploma Student, GPA: 72.0%, Completed: 18/72 Credits. Tuition: 12 JOD/hr.
- **Environmental Constraints**:
  - Outlying rural village in northern West Bank with frequent power brownouts.
  - High-latency cellular 3G (400ms round-trip ping, 50-100 kbps bandwidth, frequent TCP packet drops).
  - Demands battery-friendly, low-bandwidth, offline-first operation with guaranteed fail-safe registration queueing.
- **Academic Course Load (14 Credits Target)**:
  - `17010111`: Modern Web Applications (تطبيقات الويب الحديثة) — 3 cr
  - `17010121`: Database Management (إدارة قواعد البيانات) — 3 cr
  - `17010131`: Linux Administration Basics (أساسيات نظام لينكس) — 3 cr
  - `15200101`: Applied Mathematics (رياضيات تطبيقية) — 3 cr
  - `17010141`: Hardware & Networking Lab (مختبر صيانة وشبكات) — 2 cr

#### End-to-End Route Journey Audit:
1. **Route `login`**:
   - *Interaction*: Salma loads the planner on her mobile phone over a flaky 3G connection.
   - *Failure 1 (31.5 KB Game Download on Mobile)*: The mobile browser is forced to download `CampusRunnerGame.tsx` (965 lines, 31.5 KB), even though `LoginSyncExperience.tsx:212-220` conditionally hides it on mobile screens. Over 50 kbps 3G, this adds 5–7 seconds of dead network waiting time.
   - *Failure 2 (Unwanted Web Audio Synthesis)*: `playSyncSound` triggers Web Audio oscillator nodes during sync steps, causing audio stutter and unnecessary battery drain on low-spec hardware.
2. **Route `plan`**:
   - *Interaction*: Salma opens `/plan` to review diploma degree progress.
   - *Failure (Diploma Degree Total Scaling)*: `PlanPage.tsx:378` defaults `totalDegreeCredits` to 132 or 164 if profile credits are unparsed. Her progress bar shows `18 / 132 (13%)` instead of `18 / 72 (25%)`. In mobile view, `advisoryPlan` displays empty columns up to Year 5 unless explicitly constrained.
3. **Route `courses`**:
   - *Interaction*: Salma searches for diploma courses while riding the rural bus with zero cellular signal.
   - *Result*: Offline client-side filtering works well when data was previously cached in `localStorage`. However, if the course catalog was not pre-fetched, `fetchCourses()` throws an uncaught error without an offline fallback card.
4. **Route `semester-planning`**:
   - *Interaction*: Salma opens semester planning to arrange her upcoming 14 credits.
   - *Friction*: The semester selector dropdown renders all 15 university semesters (up to Year 5 Summer), requiring a 2-year diploma student to navigate past 11 irrelevant terms.
5. **Route `schedule`**:
   - *Interaction*: Salma generates a conflict-free schedule using the client-side solver.
   - *Success*: Local solver execution (`generateAllSchedules`) runs entirely in-memory with zero network calls, which is ideal for offline rural usage.
   - *Failure (Dead Offline Queue)*: When Salma saves her schedule draft while offline, `offlineQueue.ts` is never called. Upon reconnecting, `OfflineBanner.tsx` announces that all changes were synchronized automatically, which is false.
6. **Route `gpa`**:
   - *Interaction*: Salma calculates her GPA target.
   - *Success*: Functions 100% offline in client memory.
7. **Route `registration`**:
   - *Interaction*: Salma attempts to register for her semester.
   - *Failure 1 (Locked Route)*: Route is disabled in bottom nav and rendered as "قيد التطوير".
   - *Failure 2 (Idempotency Key Lost on 3G Drop)*: In `RegistrationPage.tsx:1326`, `idempotencyKey` is a temporary local variable. When 3G drops during submission:
     - The request times out.
     - `handleExecuteNow` catches the error and exits.
     - The key is lost.
     - When Salma reconnects and retries, a brand-new key is generated.
     - The backend cannot deduplicate the request, risking registration errors on Edugate.
8. **Route `calendar`**:
   - *Failure*: Renders `PlanPage` instead of academic dates.

---

## 7. Concrete, Actionable Recommendations

### 7.1 Immediate High-Priority Fixes (P0: Architectural & Integrity)

1. **Mount `RegistrationPage.tsx` and Remove "قيد التطوير" Stubs**:
   - In `src/App.tsx`, import `RegistrationPage = lazyWithRetry(() => import("./pages/RegistrationPage"))`.
   - Replace lines 1920-1940 with `<RegistrationPage ... />`, passing student profile and schedule handlers.
   - In `src/App.tsx:2100-2116`, remove the `disabled` and `Lock` icon on the mobile bottom navigation registration button.
2. **Fix Schedule Modal Multi-Block Course Timing**:
   - In `src/components/modals/WeeklyScheduleModal.tsx:935-943` and `958-972`, refactor `handleAdoptSchedule` to iterate over ALL blocks within `item.section.blocks`. For each block, store entries keyed by `${courseCode}_${dayKey}` with its specific start and end times, rather than taking only `blocks[0]`.
3. **Normalize Schedule Key Lookup in `WeeklySchedulePage.tsx` and `icalExport.ts`**:
   - In `WeeklySchedulePage.tsx:310` and `icalExport.ts:84`, strip any trailing day suffix (e.g. `courseId.replace(/_[^_]+$/, "")`) before querying `coursesById` and `coursesMap`. This guarantees proper course names in timetables and iCal exports.
4. **Remove `CampusRunnerGame.tsx` from Default Login Pipeline**:
   - Remove static `import CampusRunnerGame` from `src/components/auth/LoginSyncExperience.tsx:2`.
   - If retained, wrap in `React.lazy()` and mount only behind an explicit user click on a standalone route (e.g. `#/game`), saving 31.5 KB of bundle transfer over mobile 3G.
5. **Persist Client-Side Idempotency Keys in `RegistrationPage.tsx`**:
   - In `RegistrationPage.tsx:1326`, store `idempotencyKey` in `sessionStorage.getItem("ptuk_pending_reg_key")`. On network failure, retain the key; on user retry, reuse the identical key so `server/routes/registration.js:212` can deduplicate the transaction. Clear the key only upon confirmed HTTP 200 completion.

### 7.2 Secondary Priority Enhancements (P1: Persona Experience & Edge Cases)

6. **Add Granular Recurring Busy Blocks to Schedule Solver**:
   - Extend `CatalogScheduleFilters` in `src/services/scheduleSolver.ts` with `customBusyBlocks?: Array<{ days: string[]; start: number; end: number; label?: string }>`.
   - In `getEligibleSectionsForCourse`, filter out sections that collide with any custom busy block.
   - Add a "فترات الانشغال المخصصة" input in `WeeklyScheduleModal.tsx` allowing athletes like Layla to block Sun/Tue 12:00-14:00.
7. **Implement Cross-Campus Transit Buffers**:
   - Add `campus` or `building` proximity metadata to `CatalogSection`.
   - In `scheduleSolver.ts:hasConflict`, when two consecutive sections on the same day are in different campus zones (e.g. Al-Arroub vs Central), require `candidateBlock.start - assignedBlock.end >= 0.75` (45 minutes buffer).
8. **Per-Course Faculty Tuition Rate Calculation**:
   - Refactor `calculateSemesterTuition` in `tuitionFeesService.ts` to accept `courses: Array<{ id: string; credits: number }>` instead of only total credits.
   - Look up hourly tuition rates based on course code prefix (e.g. `16xxxxxx` -> Agriculture 20 JOD, `13xxxxxx` -> Business 20 JOD, `15xxxxxx` -> Engineering 24 JOD) rather than applying the primary major's rate to all credits.
9. **Wire Offline Mutation Queue to Application Stores**:
   - In `useAcademicStore.ts`, invoke `enqueueMutation("SAVE_PLAN", { ... })` whenever a plan modification occurs while `!navigator.onLine`.
   - In `src/App.tsx`, register a `window.addEventListener("online", () => drainOfflineQueue(...))` listener to synchronize pending mutations upon reconnection.
10. **Scale Semester Planning Dropdowns to Degree Duration**:
    - In `SemesterPlanningPage.tsx`, resolve allowed semesters via `resolveMajorDegreeYears(totalDegreeCredits, activeMajorId).allowedSemesterNames`. For a 72-credit diploma, display only the 4 regular semesters (Years 1 and 2), hiding Years 3 to 5.
11. **Mount Dedicated Academic Calendar Page**:
    - Decouple `AcademicCalendarModal.tsx` into a top-level route component rendered when `currentRoute === "calendar"`.
