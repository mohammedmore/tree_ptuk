# Phase 0 Survey & Cognitive Load Audit: PTUK Schedule Solver

**Author**: Explorer 2  
**Target Subsystem**: Schedule Solver (`WeeklySchedulePage.tsx`, `WeeklyScheduleModal.tsx`, `SectionSwapModal.tsx`, `DoctorScheduleModal.tsx`, `scheduleSolver.ts`, `scheduleSolver.worker.ts`)  
**Scope**: R2 (Redundant & Useless UI Elements) & R3 (UI/UX & Behavioral Improvements across Personas)  
**Date**: 2026-11-14  

---

## 1. Observations

### 1.1 Architecture & Component Mapping
- The main schedule screen is routed at `#schedule` in `src/router.ts:18-19` and rendered in `src/App.tsx:1890-1901` as `<WeeklySchedulePage>`.
- The full interactive schedule solver dialog is implemented in `src/components/modals/WeeklyScheduleModal.tsx` (3,543 lines), managed globally via `GlobalModalsContainer.tsx:423` and launched via `onOpenScheduleSolver={() => setIsWeeklyScheduleModalOpen(true)}` from `WeeklySchedulePage.tsx:659, 888, 1323, 1490`.
- Supplemental schedule modals include `SectionSwapModal.tsx` (292 lines) and `DoctorScheduleModal.tsx` (609 lines).
- Combinatorial search and constraint satisfaction solver algorithms reside in `src/services/scheduleSolver.ts` (1,260 lines), dispatched asynchronously to a background Web Worker in `src/workers/scheduleSolver.worker.ts` via `src/services/scheduleSolverClient.ts`.

---

### 1.2 R2: Redundant, Dead, and Duplicate UI Elements Observed

#### Observation R2.1: Completely Unreachable 218-Line Dead "Data Entry View" (`activeTab === "edit"`)
- **File**: `src/components/modals/WeeklyScheduleModal.tsx`
- **Lines**: 280, 542–556, 1007–1078, 1533–1750, 3534
- **Code Quote**:
  ```tsx
  // Line 280
  const [activeTab, setActiveTab] = useState<"edit" | "visual">("visual");
  ...
  // Line 1533
  {manualCourses.length === 0 && activeTab === "edit" ? (
    ...
  ) : activeTab === "edit" ? (
    /* Data Entry View */
    <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
      {manualCourses.map((course) => { ... })}
    </div>
  ) : (
    <section className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto">
      ...
  ```
- **Evidence**:
  1. `setActiveTab` is declared on line 280 but is **never called or exposed anywhere** in `WeeklyScheduleModal.tsx` or in the wider project. `grep_search` across `src` confirms zero call sites.
  2. Because `activeTab` is permanently initialized to `"visual"`, lines 1533 to 1750 (218 lines of complex JSX containing manual inputs for start/end times, instructor text fields, classroom fields, and day buttons) are **dead code** that can never execute or be seen by any student.
  3. The helper functions and variables existing solely to support this dead branch are also dead:
     - `getSuggestedManualEntry` (lines 1007–1038)
     - `handleUpdateEntry` (lines 1040–1064)
     - `toggleDay` (lines 1066–1078)
     - `manualCourses` memo (lines 542–556)
     - `EDIT_DAYS` constant (line 115)
  4. Misleading footer text at line 3534 promises: `<p>يمكنك التبديل بين الأقسام من الأعلى</p>` ("You can switch between sections from the top"), but there are no tabs or section switchers at the top of the modal.

#### Observation R2.2: Dead State Variables and Unused Imports
- **File**: `src/components/modals/WeeklyScheduleModal.tsx`
- **Lines & Evidence**:
  1. **Line 64 & 67**: `generateAllSchedules` and `explainScheduleConflicts` are imported from `scheduleSolver.ts` but are unused; the modal now uses worker equivalents `generateSchedulesAsync` and `explainConflictsAsync` (lines 72–74).
  2. **Line 68**: `getStats` is imported from `scheduleSolver.ts` but never referenced in the file.
  3. **Lines 85–86**: `exportScheduleToICal` and `downloadScheduleImage` are imported from `icalExport.ts`, but neither is ever invoked inside `WeeklyScheduleModal.tsx`.
  4. **Line 301**: `const [hasGeneratedSchedules, setHasGeneratedSchedules] = useState(true);` is defined, but neither `hasGeneratedSchedules` nor `setHasGeneratedSchedules` is ever read or modified anywhere in the file.
  5. **Line 308**: `const [isExportingPng, setIsExportingPng] = useState(false);` is defined, but never used in any handler or element.
  6. **Line 323 & Line 2396**: `const [isHideSelectedCourses, setIsHideSelectedCourses] = useState<boolean>(false);` is defined, but `setIsHideSelectedCourses` is never called.
  7. **Lines 1080–1101**: `timeToMinutes` and `getPosition` functions are defined but never called in any component.

#### Observation R2.3: Triple Duplicate "Compare Schedules" Buttons
- **File**: `src/components/modals/WeeklyScheduleModal.tsx`
- **Lines**: 2451, 3066, 3491
- **Code Quotes**:
  - Line 2451 (Filter toolbar):
    ```tsx
    <button type="button" id="toggle-compare-schedules-btn" onClick={() => setIsComparing((prev) => !prev)}>
      <span>{isComparing ? "إغلاق المقارنة" : "مقارنة جدولين جنباً إلى جنب"}</span>
    </button>
    ```
  - Line 3066 (Sticky navigation toolbar):
    ```tsx
    <button type="button" id="add-to-comparison-btn" onClick={() => { ... setIsComparing(true); }}>
      <Columns size={13} /> <span>مقارنة</span>
    </button>
    ```
  - Line 3491 (Bottom pager bar):
    ```tsx
    <button type="button" onClick={() => { ... setIsComparing(true); }}>
      <Columns size={13} /> <span>مقارنة</span>
    </button>
    ```
- **Evidence**:
  Three different buttons in three different locations toggle the identical state (`isComparing`). Furthermore, triggering line 3066 or 3491 forces comparison mode open at line 2717, shifting the entire view and disorienting the student.

#### Observation R2.4: Redundant Inconsistent Dual Pagers
- **File**: `src/components/modals/WeeklyScheduleModal.tsx`
- **Lines**: 2991–3116 (Top Sticky Bar) vs. 3423–3517 (Bottom Pager Bar)
- **Evidence**:
  The bottom pager replicates:
  - Previous / Next buttons
  - Direct numeric probability input (`activeScheduleIndex + 1`)
  - "اعتماد هذا الجدول" (Adopt primary schedule)
  - "مقارنة" (Compare schedules)
  However, the bottom pager **omits** "مسودة بديلة" (Adopt as draft, line 3093) and "تتبع المغلقة" (Track closed sections, line 3105). This creates an inconsistent mental model where some core actions exist only at the top sticky bar, while others are duplicated at the bottom.

#### Observation R2.5: Triple Duplicate "Close / Return to Schedule" Buttons in Course Selection Drawer
- **File**: `src/components/modals/WeeklyScheduleModal.tsx`
- **Lines**: 1826, 1917, 2350
- **Evidence**:
  1. Line 1826 (Header toggle): `<button onClick={() => setIsAddCourseOpen(false)}> إغلاق القائمة (عرض الجدول) </button>`
  2. Line 1917 (Drawer inner header): `<button onClick={() => setIsAddCourseOpen(false)}> تم (الانتقال للجدول) </button>`
  3. Line 2350 (Drawer inner bottom): `<button onClick={() => setIsAddCourseOpen(false)}> الانتقال لعرض الجدول الدراسي الأسبوعي </button>`
  All three buttons trigger the exact same mutation (`setIsAddCourseOpen(false)`). Having three large buttons for a single dismissal action within one drawer causes unnecessary visual weight.

#### Observation R2.6: Semester Selection Disconnection
- **File**: `src/pages/WeeklySchedulePage.tsx` (Line 647) vs. `src/components/modals/WeeklyScheduleModal.tsx` (Lines 274–278, 1519)
- **Evidence**:
  - `WeeklySchedulePageProps` (line 55) does not pass `selectedSemester` down to `WeeklyScheduleModal`.
  - When a student clicks "إنشاء جدول" while viewing e.g. "السنة الثانية - الفصل الثاني", `WeeklyScheduleModal` re-derives `selectedSemester` independently using:
    ```tsx
    const [selectedSemester, setSelectedSemester] = useState<string>(
      () => SEMESTERS.find((semester) => Object.values(plannedCourses).includes(semester)) || SEMESTERS[0]
    );
    ```
  - This resets the semester inside the solver to whatever planned course it encounters first, forcing the student to re-select their semester in the redundant dropdown at line 1519.

#### Observation R2.7: Dead Doctor Filter Handler Guard
- **File**: `src/components/modals/DoctorScheduleModal.tsx` (Lines 28, 151, 365–374) vs. `src/pages/WeeklySchedulePage.tsx` (Lines 1545–1551)
- **Evidence**:
  - In `DoctorScheduleModal.tsx:365`, a prominent action button: `"تفضيل هذا الدكتور في المولد الذكي"` is guarded by `{onSelectDoctorFilter && (...)}`.
  - In `WeeklySchedulePage.tsx:1545`, `<DoctorScheduleModal>` is rendered **without** passing `onSelectDoctorFilter`.
  - Consequently, this high-value feature for students seeking to lock in a specific doctor in the solver is dead and never rendered.

---

### 1.3 Multi-Persona Usability Audit Observations

#### Observation P1: Commuter / Employed Student (المسافر/الموظف)
- **File**: `src/components/modals/WeeklyScheduleModal.tsx:2417-2613` & `src/services/scheduleSolver.ts:470, 586-615`
- **Evidence**:
  1. *Hidden Constraints*: Commuters need to compress their days (e.g. 2 or 3 days on campus) and avoid dead gaps. These filters (`timePreference: "min_days"`, `maxGap`, `freeDays`) are hidden inside a collapsed accordion behind line 2417.
  2. *Missing Travel Time Windows*: Intercity transport between Tulkarm and other West Bank governorates (Nablus, Jenin, Qalqilya, Ramallah) is subject to checkpoint congestion and early shutdown (3:30–4:30 PM). The current solver only offers `"morning"` (which schedules 8:00 AM classes, punishing commuters) and `"late"` (classes ending at 16:00–18:00, stranding commuters). There is **no constraint** to enforce "No classes before 9:00 AM" or "Finish before 3:30 PM".
  3. *Missing Commuter Preset*: There is no 1-click persona preset. A student must manually tick each weekday checkbox and select multiple dropdowns.
  4. *Opaque Gap Metric in Solver*: `WeeklySchedulePage.tsx:637` displays `أوقات الفراغ: {gapStats.totalGaps} س`, but `WeeklyScheduleModal.tsx` buries gap hours inside an HTML tooltip title (`title={...}`) on a generic score badge (line 2964).

#### Observation P2: High-Achieving / Honor Student (المتفوق)
- **File**: `src/components/modals/WeeklyScheduleModal.tsx:1802-1810` & `src/services/scheduleSolver.ts:460-630`
- **Evidence**:
  1. *Zero Credit Hour Tally*: When an honor student selects 6–7 courses for an overload schedule (19 to 21 credits), line 1802 displays only the count of courses: `{selectedCourseCodes.length} مواد`. The total credit hours selected is **never calculated or displayed anywhere in the solver**.
  2. *No GPA / Overload Awareness*: The solver does not differentiate between standard max credits (18) and honor/graduating student overload (19–21 credits), providing no validation or status indicators.
  3. *Illegible Desktop Comparison*: When comparing two 7-course schedules side-by-side (line 1115), the mini-grids are squeezed into 176px height (`h-44`) with 7.5px font (`text-[7.5px]`), causing courses and section badges to visually collide.

#### Observation P3: Under Academic Probation (تحت الإنذار)
- **File**: `src/components/modals/WeeklyScheduleModal.tsx` & `src/pages/WeeklySchedulePage.tsx`
- **Evidence**:
  1. *Zero 14-Credit Enforcement or Warning*: Under PTUK academic regulations, students on academic probation (إنذار أكاديمي, GPA < 2.0 / < 60%) are legally prohibited from registering more than 14 credit hours. If a probation student selects 16 or 18 credits in the solver, **no warning, alert banner, or restriction is shown**.
  2. *No Retake / Failed Course Prioritization*: Probation students urgently need to retake courses with failing ("F") grades to raise their GPA and remove probation. In the course drawer (`WeeklyScheduleModal.tsx:2095–2345`), available courses are grouped solely by "السنة" (Year) or "التصنيف" (Category). There is no "مساقات الإعادة لتحسين المعدل" (Retake Courses) highlight or priority grouping.
  3. *High Friction When Registering*: Students discover the 14-credit violation only when their schedule fails at the Edugate portal during live registration.

---

### 1.4 Mobile Timetable Ergonomics & Feedback Observations
- **File**: `src/pages/WeeklySchedulePage.tsx:763–864, 904–1056`
- **Evidence**:
  1. In `WeeklySchedulePage.tsx:818, 827, 836`, the draft management buttons (edit, duplicate, delete) have touch dimensions of 24×24px (`w-6 h-6`). This violates WCAG and mobile design guidelines requiring a minimum touch target of 44×44px / 48×48px, leading to frequent mis-taps on mobile devices.
  2. In `WeeklyScheduleModal.tsx:2938–3117`, the sticky navigation bar contains 7 buttons, numeric inputs, and text badges that wrap into 4 lines on mobile viewports (< 414px), consuming up to 45% of the mobile screen height and obscuring the timetable.
  3. When the solver worker is running (line 2367), only a subtle text line is displayed (`animate-pulse`), while the timetable area remains blank without skeleton placeholders.
  4. In `SectionSwapModal.tsx:210-238`, section cards display instructor, time, and room, but completely lack section capacity metrics (registered / capacity / full status), allowing students to unknowingly swap into full sections.

---

## 2. Logic Chain

1. **Dead Code Elimination (R2.1 & R2.2)**:
   - *Premise*: `activeTab` is initialized to `"visual"` at line 280 and is never modified by any user action or handler.
   - *Inference*: Lines 1533–1750 and related handlers (`getSuggestedManualEntry`, `handleUpdateEntry`, `toggleDay`, `manualCourses`, `EDIT_DAYS`) are mathematically unreachable in the application runtime.
   - *Impact*: Removing these 218+ lines of dead code will reduce bundle size, eliminate false compiler dependencies, and clear out the confusing footer message (line 3534). Similarly, removing unused imports (`generateAllSchedules`, `explainScheduleConflicts`, `getStats`, `exportScheduleToICal`, `downloadScheduleImage`) and dead state variables (`hasGeneratedSchedules`, `isExportingPng`, `isHideSelectedCourses`) will significantly declutter the component.

2. **Control Consolidation (R2.3, R2.4, R2.5)**:
   - *Premise*: Three distinct buttons trigger `setIsComparing(true)` (lines 2451, 3066, 3491); two distinct pagers replicate adoption and paging controls (lines 2991 and 3423); three distinct buttons dismiss the course drawer (lines 1826, 1917, 2350).
   - *Inference*: This redundancy introduces visual clutter, cognitive fatigue, and layout instability.
   - *Impact*: Consolidating comparison into a single action inside a unified toolbar, unifying the top and bottom pagers into a consistent sticky bar, and keeping a single clear dismissal button for the drawer will dramatically reduce visual friction.

3. **Semester Synchronization (R2.6)**:
   - *Premise*: `WeeklySchedulePage` maintains a `selectedSemester` state which is not passed to `WeeklyScheduleModal`.
   - *Inference*: Students entering the solver are exposed to desynchronized data, risking adopting a schedule into the wrong semester.
   - *Impact*: Passing `selectedSemester` as a required prop to `WeeklyScheduleModal` ensures consistent state and eliminates the need for an in-modal semester selector.

4. **Commuter Persona Optimization (P1)**:
   - *Premise*: Commuters require compressed campus days and specific departure windows to avoid checkpoint and transportation delays.
   - *Inference*: Hiding travel constraints inside generic accordions and offering only blunt morning/late preferences forces commuters into suboptimal schedules.
   - *Impact*: Surfacing a 1-click "Commuter Preset" (نمط المسافر/الموظف) with `min_days`, max 1h gap, and a time window constraint (e.g., classes between 09:00 and 15:30) solves this student journey pain point directly.

5. **Honor Student Optimization (P2)**:
   - *Premise*: Honor students register 19–21 credits and evaluate specific instructors across numerous sections.
   - *Inference*: Lacking a total credit counter in the solver prevents verification of overload limits, and leaving `onSelectDoctorFilter` unwired blocks doctor-based scheduling.
   - *Impact*: Adding a live credit tally (`إجمالي الساعات: X / 21 ساعة`) and wiring `onSelectDoctorFilter` directly into the solver's pinned sections provides a streamlined experience for high achievers.

6. **Academic Probation Protection (P3)**:
   - *Premise*: Academic probation legally restricts students to 14 credits, and failing grades must be resolved first.
   - *Inference*: A solver that ignores probation status and fails to highlight retake courses risks student schedule rejection at Edugate.
   - *Impact*: Adding a probation warning banner when credits exceed 14 and surfacing a "مساقات معادة للتحسين" group in the course drawer safeguards at-risk students.

---

## 3. Caveats

1. **Solver Algorithm Runtime Complexity**: In `src/services/scheduleSolver.ts`, `generateAllSchedules` uses forward checking CSP search. For honor students selecting 7 courses with 4+ sections each, the combination space exceeds 16,000 possibilities. While the Web Worker prevents main thread UI freezes, setting `maxResults = 500` ensures performance remains within acceptable memory limits.
2. **Catalog Live Sync Latency**: Timetable availability depends on PTUK's backend catalog scraper (`fetchCourses`). When offline, fallback data from IndexedDB/localStorage is used, which may not reflect real-time seat closures.
3. **Registration Portal Decoupling**: The Schedule Solver generates local timetable drafts. Actual enrollment occurs in `RegistrationPage.tsx` or via the external Edugate portal. Warnings generated in the solver are advisory and must align with PTUK's registration bylaws.

---

## 4. Conclusion & Actionable Recommendations

### Summary Table of R2 Cleanup Targets
| # | Component / File | Exact Line Range | Redundant / Dead Element | Proposed Action |
|---|---|---|---|---|
| 1 | `WeeklyScheduleModal.tsx` | 280, 542–556, 1007–1078, 1533–1750, 3534 | Dead `activeTab === "edit"` manual data-entry branch & dead helper methods (`handleUpdateEntry`, `toggleDay`, `getSuggestedManualEntry`) | Remove entire dead branch and unused helpers; clean up misleading footer text |
| 2 | `WeeklyScheduleModal.tsx` | 64, 67, 68, 85–86, 301, 308, 323, 1080–1101 | Unused imports (`generateAllSchedules`, `explainScheduleConflicts`, `getStats`, `exportScheduleToICal`, `downloadScheduleImage`) and dead state variables (`hasGeneratedSchedules`, `isExportingPng`, `isHideSelectedCourses`, `getPosition`) | Remove unused imports, dead states, and uncalled functions |
| 3 | `WeeklyScheduleModal.tsx` | 2451, 3066, 3491 | Triple duplicate "Compare Schedules" buttons | Consolidate into a single comparison action in the sticky toolbar |
| 4 | `WeeklyScheduleModal.tsx` | 2991–3116 vs. 3423–3517 | Redundant dual pagers with inconsistent feature sets | Unify into a single, clean sticky pager toolbar at the bottom/top |
| 5 | `WeeklyScheduleModal.tsx` | 1826, 1917, 2350 | Triple duplicate drawer close buttons | Retain one clear close button in the drawer header |
| 6 | `WeeklyScheduleModal.tsx` & `WeeklySchedulePage.tsx` | Page: 647, Modal: 274–278, 1519 | Disconnected semester state & duplicate semester dropdown | Pass `selectedSemester` as a prop to `WeeklyScheduleModal`; remove redundant dropdown |
| 7 | `WeeklySchedulePage.tsx` & `DoctorScheduleModal.tsx` | Page: 1545–1551, Modal: 28, 365–374 | Dead `onSelectDoctorFilter` handler guard | Wire `onSelectDoctorFilter` from `WeeklySchedulePage` to populate solver pinned sections |

### Summary Table of R3 Persona & UI/UX Improvements
| Persona / Feature | Target File | Improvement Rationale | Concrete Implementation |
|---|---|---|---|
| **Commuter Student** (المسافر/الموظف) | `WeeklyScheduleModal.tsx`, `scheduleSolver.ts` | Eliminate rush-hour classes and compact campus days | Add 1-click "نمط المسافر" preset button (`min_days`, `maxGap = 1h`); add time window constraints (earliest start >= 09:00, latest end <= 15:30); surface live gap hours in solver card header |
| **Honor Student** (المتفوق) | `WeeklyScheduleModal.tsx` | Support overload scheduling (up to 21 credits) and multi-section optimization | Display live selected credit hours tally (`إجمالي الساعات: X / 21`); connect `DoctorScheduleModal` directly to solver; improve comparison grid readability |
| **Academic Probation** (تحت الإنذار) | `WeeklyScheduleModal.tsx`, `WeeklySchedulePage.tsx` | Enforce 14-credit limit and prevent enrollment failure | Add warning banner when credits exceed 14; add "مساقات معادة للتحسين" group at top of course drawer; display clear credit badge |
| **Mobile Ergonomics** | `WeeklySchedulePage.tsx`, `WeeklyScheduleModal.tsx` | Prevent mis-taps and recover screen real estate | Increase touch targets of draft toolbar buttons to >= 40px; simplify mobile sticky navigation bar to single row (< 50px height) |
| **Feedback States** | `WeeklyScheduleModal.tsx`, `SectionSwapModal.tsx` | Prevent solving confusion and swapping into full sections | Render timetable skeleton loader during worker solving; display dedicated conflict resolution UI in main view; display capacity/registered count in `SectionSwapModal` |

---

## 5. Verification Method

To independently verify these observations and validate future implementation:

1. **Verify Unreachable Code & Dead Variables**:
   - Inspect `src/components/modals/WeeklyScheduleModal.tsx` line 280: observe `activeTab` is initialized to `"visual"` and verify that `setActiveTab` is never referenced.
   - Inspect lines 1533–1750: confirm the `activeTab === "edit"` block cannot be rendered under any user interaction.
   - Search for `hasGeneratedSchedules`, `isHideSelectedCourses`, `getPosition`: verify zero functional usages.

2. **Verify Redundant Controls**:
   - Inspect `WeeklyScheduleModal.tsx` lines 2451, 3066, and 3491 to confirm three identical buttons toggling `isComparing`.
   - Inspect lines 1826, 1917, and 2350 to confirm three buttons toggling `setIsAddCourseOpen(false)`.

3. **Verify Persona Disconnects**:
   - Launch application (`npm run dev`) and navigate to `#schedule`.
   - Open Schedule Solver (`WeeklyScheduleModal`): observe course selection chips display only course counts, with no credit hour counter.
   - Select more than 14 credits: observe that no warning is displayed regarding academic probation.
   - Inspect filter controls: observe commuter travel windows (e.g. no classes before 9 AM) are unavailable.

4. **Automated Suite & Build Integrity**:
   - Run typecheck and production build: `npm run build`
   - Run existing automated test suite: `npm test`
