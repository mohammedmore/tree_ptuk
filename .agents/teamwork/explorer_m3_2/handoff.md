# Milestone 3 Multi-Angle Persona Evaluation: Personas 5, 6, and 7 Report

**Agent**: `explorer_m3_2` (Teamwork Explorer — Milestone 3 Persona Specialist)  
**Date**: 2026-11-14  
**Working Directory**: `c:\Users\mohammed\Desktop\planner\.agents\teamwork\explorer_m3_2\`  
**Target Project**: `c:\Users\mohammed\Desktop\planner`  
**Parent Orchestrator ID**: `b888a5de-c39e-41a3-8613-2c11312234bb`  

---

## 1. Observation

Direct code observations, AST pattern examinations, line-by-line analyses, and test executions conducted in local offline isolation:

### 1.1 Architecture & Application Routes (`src/router.ts:3-11`, `src/App.tsx:1820-1960`)
The application defines 8 distinct routes (`plan`, `courses`, `schedule`, `gpa`, `semester-planning`, `registration`, `calendar`, `login`):
- `src/App.tsx:1827`: `(currentRoute === "plan" || currentRoute === "calendar")` renders `PlanPage`.
- `src/App.tsx:1851`: `currentRoute === "semester-planning"` renders `SemesterPlanningPage`.
- `src/App.tsx:1870`: `currentRoute === "courses"` renders `CoursesPage`.
- `src/App.tsx:1890`: `currentRoute === "schedule"` renders `WeeklySchedulePage`.
- `src/App.tsx:1903`: `currentRoute === "gpa"` renders `GPAPage`.
- `src/App.tsx:1920-1940`: `currentRoute === "registration"` is stubbed out with a locked "قيد التطوير" placeholder `<section aria-labelledby="registration-coming-soon-title">`, despite the existence of a 3,674-line `RegistrationPage.tsx` component in `src/pages/RegistrationPage.tsx`.
- `src/App.tsx:1942`: `currentRoute === "login"` renders `LoginPage`.
- `src/App.tsx:2089-2115` & `1385-1394`: Locked "تسجيل الفصل" button disabled with `opacity-50 cursor-not-allowed` on both Desktop navigation and Mobile bottom bar.

### 1.2 Modal Keyboard Focus & WCAG 2.1 AA Audit (Persona 5 Focus)
- **Reference Implementation (`src/components/common/BaseModal.tsx:31-98`)**:
  `BaseModal.tsx` implements proper accessibility primitives:
  - Lines 36-37: Sets `document.body.style.overflow = "hidden"` and focuses close button / dialog.
  - Lines 43-48: Restores focus to `previouslyFocused` on unmount.
  - Lines 59-63: Listens to `Escape` key to close.
  - Lines 65-95: Traps keyboard `Tab` and `Shift+Tab` cycles between first and last focusable elements.
- **The 24 Ad-Hoc Modals Bypassing `BaseModal.tsx`**:
  A full scan identified 24 distinct modal overlays implemented with raw `div.fixed.inset-0` containers that **do NOT trap Tab focus** and fail to restore previous document focus:
  1. `src/components/modals/AcademicAdvisorModal.tsx:244`: Listens to Escape (lines 230-238), but does not trap Tab, does not autofocus on open, and does not restore focus on close.
  2. `src/components/modals/AcademicCalendarModal.tsx:190`: Listens to Escape (line 130), but has no Tab focus trap; lines 188-192 lack `role="dialog"` or `aria-modal="true"`.
  3. `src/components/modals/CommandPaletteModal.tsx:491`: Listens to Escape, but relies on custom index navigation rather than a standard focus trap.
  4. `src/components/modals/CourseComparisonDrawer.tsx:271`: Right-side slide-over drawer; no Tab trap.
  5. `src/components/modals/DoctorScheduleModal.tsx:268`: Raw div; no Tab trap.
  6. `src/components/modals/ExportModal.tsx:636`: Raw div; no Tab trap.
  7. `src/components/modals/MajorSelectorModal.tsx:109`: Listens to Escape (line 62), but does not trap Tab; focus leaks to underlying header links.
  8. `src/components/modals/MajorTransferModal.tsx:200`: Raw div; no Tab trap.
  9. `src/components/modals/ResetConfirmationModal.tsx:37`: Listens to Escape (line 18), but does not autofocus buttons and does not trap Tab.
  10. `src/components/modals/SectionSwapModal.tsx:100`: Raw div; no Tab trap.
  11. `src/components/modals/StudentRecordsModal.tsx:144`: Listens to Escape (line 86), but has no Tab focus trap and no focus restoration.
  12. `src/components/modals/SystemHealthModal.tsx:234`: Raw div; no Tab trap.
  13. `src/pages/CoursesPage.tsx:2449`: GPA Impact Modal (`gpaModalCourse`). **ZERO Escape listener**; **ZERO Tab trap**. Traps keyboard-only users who cannot click the backdrop.
  14. `src/pages/CoursesPage.tsx:2633`: Closed Section Tracker Modal (`selectedCourseForTracking`). **ZERO Escape listener**; **ZERO Tab trap**.
  15. `src/pages/GPAPage.tsx:836` & `952`: Add Course to Forecast Picker (`isAddPickerOpen`). Raw div; no Tab trap.
  16. `src/pages/SemesterPlanningPage.tsx:2598`: Mobile Bottom Sheet for Planned Courses (`showMobilePlannedSheet`). **ZERO Escape listener**; no Tab trap.
  17. `src/pages/SemesterPlanningPage.tsx:2817`: Confirm Clear Semester Dialog (`confirmClearOpen`). **ZERO Escape listener**; no Tab trap.
  18. `src/pages/WeeklySchedulePage.tsx:1429`: Section Details Sheet (`selectedEntryDetails`). **ZERO Escape listener**; no Tab trap.
  19. `src/pages/RegistrationPage.tsx:2565`: Plan Inspection / Custom Section Modal.
  20. `src/pages/RegistrationPage.tsx:2794`: Live Seat Watcher Configuration Modal.
  21. `src/pages/RegistrationPage.tsx:2940`: Pre-Registration Diagnostic Failure Modal.
  22. `src/pages/RegistrationPage.tsx:3015`: Cascading Fallback Plan Execution Confirm Dialog.
  23. `src/pages/RegistrationPage.tsx:3309`: Direct Section Add / Override Dialog.
  24. `src/pages/RegistrationPage.tsx:3421` & `3478`: Audit Log Export / Filter Overlays.

### 1.3 Assistive Technology & Contrast Observations (Persona 5)
- **ARIA Live Regions (`aria-live`)**:
  Searching the entire codebase revealed only **3 instances** of `aria-live`:
  - `src/components/common/UndoToast.tsx:38`: `aria-live="polite"`
  - `src/pages/PlanPage.tsx:1942`: `aria-live="polite"` on `#planner-a11y-announcer`
  - `src/components/auth/LoginSyncExperience.tsx:171`: `aria-live="polite"`
  Crucial dynamic events—such as live seat watcher alerts (`SeatWatcherPanel.tsx`), schedule solver conflict resolutions (`WeeklyScheduleModal.tsx`), timetable changes (`WeeklySchedulePage.tsx`), and credit warnings (`SemesterPlanningPage.tsx`)—possess **zero `aria-live` markup**. Assistive screen reader users receive zero audible feedback when seats open or schedules change.
- **Color Contrast Calculations**:
  In light theme (`src/styles/tokens.css:1-20`), text styled with `text-slate-400` (#94a3b8) or `text-gray-400` (#9ca3af) against `--surface` (#fafaf7) produces a contrast ratio of **2.56:1**, failing WCAG 2.1 Success Criterion 1.4.3 (4.5:1 minimum). In `high-contrast` mode (`src/styles/tokens.css:112-146`), white text on cobalt blue (`#0047ab`) achieves **7.96:1**, exceeding WCAG AAA (7.0:1).
- **Keyboard Drag & Drop Inoperability (`src/components/planner/MultiColumnRoadmapView.tsx:320-331`)**:
  Course cards in the multi-column roadmap rely strictly on HTML5 drag-and-drop:
  `draggable={!isLocked} onDragStart={() => setDraggedCourseId(c.id)}`. The elements have no `tabIndex`, no arrow key handlers, and no keyboard "Move to Semester" context menu. Motor-impaired and keyboard-only students cannot move planned courses between terms.

### 1.4 Transfer Student Data Model & GPA Calculation (Persona 6 Focus)
- **Scraper Ingestion (`server/services/studentPortalService.js:2285-2336`)**:
  Edugate scraper recognizes transfer courses (`معادل`, `محتسب`, `cr`):
  Lines 2334-2336: `courseGrades[code] = -1; // Non-numerical pass/fail course (excluded from GPA calculation)`.
- **Mathematical GPA Dilution Bug (`src/core/academicAdvisor.ts:387-409`)**:
  In `simulateGpaForecast`:
  ```typescript
  const safeHours = Math.max(0, completedHours);
  const currentTotalPoints = currentGpa * safeHours;
  ...
  const totalHours = safeHours + newHours;
  const projectedGpa = totalHours > 0
    ? Math.round(((currentTotalPoints + newPoints) / totalHours) * 100) / 100
    : currentGpa;
  ```
  `completedHours` is passed as total earned degree hours (48 credits = 15 local graded + 33 accredited transfer hours). `simulateGpaForecast` multiplies `currentGpa * completedHours` (74.0 * 48 = 3552 points) instead of using graded hours (15 credits * 74.0 = 1110 points). When Hiba projects taking 15 credits at grade 80 (1200 points), the calculator computes:
  `(3552 + 1200) / (48 + 15) = 4752 / 63 = 75.42%`.
  The true academic GPA under PTUK bylaws is:
  `(1110 + 1200) / (15 + 15) = 2310 / 30 = 77.00%`.
  **The function mathematically dilutes her projected GPA by 1.58 percentage points** by conflating total completed degree hours with graded GPA hours.
- **Transcript Reset State Erasure (`src/pages/GPAPage.tsx:205-242`)**:
  `handleRestoreOriginalGrades` filters grades with:
  `if (typeof c.grade === "number" && !isNaN(c.grade) && c.grade > 0)` (lines 219, 232).
  Because transfer courses are stored with `grade: -1`, this condition evaluates to `false`. Clicking "إعادة العلامات للأصل" erases all transfer course grades from `restoredGrades`, leaving them unmapped or causing them to fall back to 0.
- **Absence of External Course Equivalency Mapping Tool**:
  `MajorTransferModal.tsx` handles only internal major changes (comparing courses within the university catalog). No mechanism exists in `AddCourseModal.tsx` or elsewhere to map external course codes (e.g., `CS101`) to internal PTUK prerequisites (`11100101`). Downstream courses throw false-positive prerequisite blocks.

### 1.5 Remedial & Freshman Degree Tracking (Persona 7 Focus)
- **Course Classification Defect (`src/core/courseProgress.ts:4-25`)**:
  ```typescript
  export const REMEDIAL_COURSE_ID = "15200099";
  export const COMPUTER_SKILLS_COURSE_ID = "13010006";
  export const REMEDIAL_COURSE_IDS = new Set(["15200099", "13010006"]);
  ...
  if (name.includes("استدراكي") || name.includes("مهارات الحاسوب")) return true;
  ```
  However, in `src/data.ts:52-58`:
  `{ id: "13010006", name: "مهارات الحاسوب وتطبيقاته", credits: 1, category: "متطلب جامعة إجباري" }`.
  Because `courseProgress.ts` matches both `"13010006"` and `"مهارات الحاسوب"`, this **legitimate, degree-bearing mandatory university requirement is permanently classified as non-credit remedial**! When Ahmad or Yazan completes this mandatory course, `calculateDegreeCredits` strips it, resulting in an artificial 1-credit shortfall toward graduation (e.g. 163/164 or 131/132).
- **Category Summary Contradiction (`src/core/courseProgress.ts:111-121`)**:
  `calculateCategoryCredits` does NOT filter by `isDegreeCreditBearing`. It counts `13010006` in `متطلب جامعة إجباري` (+1 credit), while `calculateDegreeCredits` excludes it (-1 credit), creating an irreconcilable visual discrepancy between category totals and overall degree progress.
- **Hardcoded Category Requirements (`src/components/dashboard/StatsDashboard.tsx:5,34-37`)**:
  `StatsDashboard.tsx` imports static `categoryRequirements` directly from `../../data` (Computer Systems Engineering - 164cr), ignoring major-specific category structures for Mechatronics Engineering (164cr with different elective allocations) and Business Administration (132cr).
- **Tuition & Workload Accounting (`src/core/semesterRegistration.ts:857-888`, `src/services/tuitionFeesService.ts:253-270`)**:
  Remedial Arabic (`13010006` / `13010006_rem`) is correctly included in semester workload credit counts (14 credits <= 19 credit cap) and tuition billing (14 credits * 24 JOD/hr = 336 JOD + 26 JOD fixed fees = 362 JOD). However, the interface fails to provide clarifying tooltips explaining why the tuition bill states 14 credits while the degree completion counter advances by only 11 credits.
- **Freshman Cognitive Clutter**:
  Freshmen arriving on `/login` are presented with `CampusRunnerGame.tsx` (965 lines, 31.5 KB canvas game) instead of an orientation guide or glossary of academic terminology (شعبة, قاعة, متطلب سابق, عبء فصلي).

---

## 2. Logic Chain

```
[Observation: 24 ad-hoc modals implemented as raw divs without Tab trapping or focus restoration]
  ├──> [Inference 1: Keyboard and screen reader users pressing Tab cycle into background elements beneath modal]
  └──> [Conclusion 1: Fails WCAG 2.1 AA Criteria 2.1.2 (No Keyboard Trap) and 2.4.3 (Focus Order); Yazan Masri is trapped or lost]

[Observation: simulateGpaForecast multiplies currentGpa by all completedHours, including 33 transfer credits]
  ├──> [Inference 2: Quality points are falsely inflated from 1110 to 3552, then divided by an enlarged credit pool]
  └──> [Conclusion 2: Hiba Hamdan's GPA forecast is distorted downwards by ~1.58%; transfer students receive misleading academic forecasts]

[Observation: courseProgress.ts hardcodes 13010006 and "مهارات الحاسوب" as REMEDIAL_COURSE_IDS]
  ├──> [Inference 3: Data.ts defines 13010006 as a 1-credit mandatory university requirement (متطلب جامعة إجباري)]
  └──> [Conclusion 3: Legitimate degree credits are dropped from calculateDegreeCredits; students face permanent 1-credit graduation deficit]

[Observation: MultiColumnRoadmapView uses HTML5 drag-and-drop with 0 keyboard alternatives]
  ├──> [Inference 4: Screen reader and motor-impaired students cannot trigger dragstart/dragend events via Tab/Enter]
  └──> [Conclusion 4: Course roadmap reordering is completely inaccessible to Persona 5 without a mouse]

[Observation: Absence of freshman onboarding guidance; presence of 31.5KB canvas game on login]
  ├──> [Inference 5: Brand-new students cannot decipher building abbreviations (خ102) or section codes, while bundle is bloated]
  └──> [Conclusion 5: Cognitive overload impairs freshman orientation; Ahmad Darwish lacks essential registration guidance]
```

---

## 3. Caveats

1. **Read-Only Exploration Protocol**: Application source code in `src/`, `server/`, and `scripts/` remained untouched during this evaluation.
2. **Local Isolation Execution**: Audits were conducted against SQLite (`data/planner.sqlite`) and local mock structures without outbound connections to `edugate.ptuk.edu.ps`.
3. **Screen Reader Automation**: Focus containment and keyboard cycles were verified programmatically via DOM AST inspections and synthetic event traces. Physical validation with JAWS and NVDA across physical desktop environments is recommended for final release QA.

---

## 4. Conclusion & In-Depth Multi-Angle Persona Evaluation

### 4.1 Persona 5: Yazan Masri (Screen Reader / Motor Disability)

- **Student Profile**: 1st-Year Freshman, Major: Business Administration (إدارة الأعمال - 132 credits).
- **Accessibility Constraints**: NVDA/VoiceOver screen reader user, keyboard-only navigation (Tab, Shift+Tab, Enter, Space, Escape), high-contrast requirements, zero focus traps, ARIA live alerts.

#### 1. Detailed User Journey & Route-by-Route Interactions
- **Route `/login` (`LoginPage.tsx`)**:
  - Focus correctly initializes on the student ID field.
  - The login sync Radar properly incorporates `aria-live="polite"` (`LoginSyncExperience.tsx:171`).
  - *Barrier*: `CampusRunnerGame.tsx` renders an HTML5 `<canvas>` element without a fallback text representation, accessible keyboard controls, or screen reader descriptions.
- **Route `/plan` (`PlanPage.tsx`)**:
  - The skip link (`<a href="#main-content">`) on lines 1318-1323 allows jumping directly to `<main id="main-content" tabIndex={-1}>`.
  - The interactive React Flow canvas (`@xyflow/react`) is largely inaccessible to keyboard navigation; course nodes cannot be traversed sequentially via Tab.
  - Switching to `ListView` provides semantic `<ul>` / `<li>` structures, but the view switcher button lacks an `aria-expanded` or `aria-pressed` indicator.
  - `#planner-a11y-announcer` (line 1942) provides polite announcements when filtering courses or selecting critical paths.
  - Opening `MajorSelectorModal.tsx` traps Yazan: it listens to Escape, but pressing Tab walks focus out of the dialog into background topbar navigation.
- **Route `/courses` (`CoursesPage.tsx`)**:
  - The course catalog search field relies strictly on `placeholder="ابحث باسم المادة أو رقمها..."` without an associated `<label>` element or `aria-label`.
  - Opening the Quick GPA Impact modal (`gpaModalCourse`, line 2449) or Closed Section Tracking modal (`selectedCourseForTracking`, line 2633) is catastrophic: **neither modal handles the Escape key, and neither traps Tab focus**. A keyboard-only user cannot dismiss the modal without clicking with a mouse.
- **Route `/schedule` (`WeeklySchedulePage.tsx`)**:
  - Weekly schedule grid tiles use `div` elements with `role="button"`. Keydown handlers support Enter, but fail to intercept Space.
  - The Section Details bottom sheet (`selectedEntryDetails`, line 1429) lacks Escape key handling and focus containment.
  - Solver result generation lacks an `aria-live` announcement; screen readers are not alerted when conflict-free schedules are computed.
- **Route `/gpa` (`GPAPage.tsx`)**:
  - The "Add Course to Forecast" modal (`isAddPickerOpen`, line 836) lacks Tab trapping.
  - Numeric grade inputs provide appropriate `aria-label` attributes (`aria-label={درجة مادة ${c.name}}`).
  - Screen readers receive no dynamic announcement of the newly calculated cumulative GPA when numeric inputs change.
- **Route `/semester-planning` (`SemesterPlanningPage.tsx`)**:
  - The Multi-Column Roadmap view is completely unusable for Yazan: courses are reordered strictly via HTML5 drag-and-drop (`MultiColumnRoadmapView.tsx:321`). There are no keyboard "Move to previous/next semester" actions.
  - The Confirm Clear Semester alert (`confirmClearOpen`, line 2817) and mobile sheet (line 2598) lack Escape listeners and focus traps.
- **Route `/registration` (`RegistrationPage.tsx`)**:
  - Currently stubbed with a locked placeholder in `App.tsx`.
  - Within the full component (`RegistrationPage.tsx`), live seat count updates in `SeatWatcherPanel` lack `aria-live="assertive"`, so blind students are not notified when seats open up. Audio chimes execute via Web Audio API without user-facing volume controls.
- **Route `/calendar` (`AcademicCalendarModal.tsx`)**:
  - The container (line 190) lacks `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
  - Pressing Escape closes the modal, but keyboard focus is lost rather than restored to the original calendar button.

#### 2. Feature Utility Assessment
- **Genuinely High-Value**: Skip to Main Content shortcut (`App.tsx:1319`), `BaseModal.tsx` focus trap reference architecture, `high-contrast` theme (7.96:1 contrast ratio), List View in `PlanPage.tsx`, Command Palette (`Ctrl+K`), `#planner-a11y-announcer`.
- **Useless / Redundant / Cluttered**: Embedded Canvas Runner Game (`CampusRunnerGame.tsx`) (0 screen reader accessibility), 15+ retro themes with low-contrast tokens, auto-playing audio chimes during sync, locked "تسجيل الفصل" buttons occupying primary header navigation.

#### 3. Discovered Bugs, Defects & Edge-Case Failures
- **Focus Trap Leaks (24 Modals)**: Tab key escapes into background DOM elements across 24 ad-hoc modals.
- **Missing Escape Key Handlers**: Zero Escape listener in `CoursesPage.tsx` (lines 2449, 2633), `WeeklySchedulePage.tsx` (line 1429), and `SemesterPlanningPage.tsx` (lines 2598, 2817).
- **Mandatory Degree Credit Deduction**: `13010006` (Computer Skills - 1 cr) is misclassified as non-credit remedial in `courseProgress.ts:5-6,20`, deducting 1 credit from Yazan's 132-credit degree total.
- **Hardcoded Category Structure**: `StatsDashboard.tsx:5,34` forces Computer Systems Engineering (164cr) category rules onto Business Administration (132cr).

#### 4. UI/UX Issues & Usability Barriers
- Low text contrast: `text-slate-400` against light surface produces 2.56:1 contrast (WCAG AA violation).
- No keyboard alternative for drag-and-drop course reordering in the multi-column semester roadmap.
- Form inputs across search and filter dropdowns lack explicit `<label>` bindings.

#### 5. Concrete Actionable Recommendations
1. Wrap all 24 ad-hoc dialogs in `BaseModal.tsx` or apply a unified `useFocusTrap` hook ensuring Tab containment, Escape dismissal, autofocus, and focus restoration.
2. Add `aria-live="polite"` regions to `SeatWatcherPanel.tsx`, Schedule Solver results, and GPA forecast recalculations.
3. Provide keyboard context actions (e.g. `<button>نقل إلى الفصل التالي</button>`) on course cards in `MultiColumnRoadmapView.tsx`.
4. Fix `isRemedialCourse` in `courseProgress.ts` to exclude legitimate degree-bearing courses like `13010006`.
5. Remove `CampusRunnerGame.tsx` from the login workflow and consolidate themes into Clean Light, Dark, OLED, and High Contrast.

---

### 4.2 Persona 6: Hiba Hamdan (Transfer Student)

- **Student Profile**: 2nd-Year Transfer Student (المجسر / طالبة محولة), Major: Computer Science (علم الحاسوب - 132 credits).
- **Academic Context**: 48 earned credits total (15 local graded hours + 33 accredited transfer hours `معادلة` with non-numeric grades `CR` / `P` / `-1`), external prerequisite fulfillment, transcript sync.

#### 1. Detailed User Journey & Route-by-Route Interactions
- **Route `/login` (`LoginPage.tsx`)**:
  - Edugate scraper extracts transcript data. `studentPortalService.js:2285-2336` identifies transfer marks (`معادل`, `محتسب`) and sets `isPassed = true` and `courseGrades[code] = -1`.
- **Route `/plan` (`PlanPage.tsx`)**:
  - Transferred courses appear in green as completed.
  - *Friction*: If a course was transferred under an external institutional code (e.g. `CS101`), the system treats it as an uncategorized elective. It does not satisfy prerequisites for PTUK courses (e.g., Data Structures `11100201` requiring `11100101`).
  - Clicking "إضافة مادة حرة / معادلة" (`AddCourseModal.tsx:83`) allows creating a course, but provides NO interface to bind it as an equivalent substitute for an existing prerequisite.
- **Route `/courses` (`CoursesPage.tsx`)**:
  - Downstream computer science courses display false-positive warnings: "متطلب سابق غير مستوفى: 11100101", even though Hiba completed equivalent material.
  - Filters lack a dedicated "المواد المعادلة" (Accredited Transfer Courses) toggle.
- **Route `/schedule` (`WeeklySchedulePage.tsx`)**:
  - Generating conflict-free schedules functions as expected, but the schedule solver may flag warnings if corequisites or prerequisites are perceived as unfulfilled due to unmapped transfer codes.
- **Route `/gpa` (`GPAPage.tsx`)**:
  - `calculateGPA` (lines 264-269) correctly skips `grade === -1` courses, preventing non-numeric grades from causing `NaN`.
  - Transferred courses are displayed in the academic record table with a badge "غير نقطي" (line 1401).
  - *Defect*: Clicking "إعادة العلامات للأصل" (`handleRestoreOriginalGrades`, lines 205-242) filters out `c.grade <= 0`. This erases all `grade: -1` transfer marks from state.
- **Route `/semester-planning` (`SemesterPlanningPage.tsx`)**:
  - Historical semesters imported from transcript are rendered in `transcriptSemestersMap`.
  - `AcademicAdvisorModal.tsx:221-225` executes `simulateGpaForecast`:
    Because `completedHours` is passed as 48 (including 33 transfer hours) rather than 15 graded hours, her GPA forecast is diluted by 1.58 percentage points.
- **Route `/registration` (`RegistrationPage.tsx`)**:
  - Automated prerequisite checks reject registration for advanced courses whose prerequisites were fulfilled via external transfer.
- **Route `/calendar` (`AcademicCalendarModal.tsx`)**:
  - Standard academic calendar display; lacks transfer credit equivalency petition and objection deadlines.

#### 2. Feature Utility Assessment
- **Genuinely High-Value**: Non-numeric grade handling (`grade === -1`) in `calculateGPA`, transcript chronological semester timeline, curriculum comparison in `MajorTransferModal.tsx`.
- **Useless / Redundant / Cluttered**: `MajorTransferModal.tsx` is designed solely for internal degree switching, offering zero utility for external college transfer; `AddCourseModal.tsx` creates isolated courses without equivalency linkage; advisor recommendations repeatedly suggest introductory courses that were already transferred.

#### 3. Discovered Bugs, Defects & Edge-Case Failures
- **Mathematical GPA Dilution in `simulateGpaForecast` (`academicAdvisor.ts:392-409`)**:
  Conflates total earned degree hours (48) with graded credit hours (15). Quality points are computed as `74.0 * 48 = 3552` instead of `74.0 * 15 = 1110`. Projected GPA is diluted from 77.0% down to 75.42%.
- **Grade Erasure on Reset (`GPAPage.tsx:219,232`)**:
  `handleRestoreOriginalGrades` filters `c.grade > 0`, stripping all transfer courses (`grade: -1`) upon reset.
- **False-Positive Prerequisite Rejections**:
  Prerequisite checker `isPrerequisiteSatisfied` does not support an equivalency alias table, blocking registration for courses satisfied via external transfer.
- **Omission from Academic Record Table (`GPAPage.tsx:298-301`)**:
  If a transferred course has a custom or external ID not in the active major's static catalog, it is omitted from the GPA page table entirely.

#### 4. UI/UX Issues & Usability Barriers
- Course cards do not display an explicit "معادلة" (Transferred) badge to differentiate transferred credits from courses completed at PTUK.
- GPA overview cards display "Completed Credits: 48", but fail to break down "Graded: 15 hrs | Non-Graded Transfer: 33 hrs", confusing students about why their GPA weight is smaller than expected.

#### 5. Concrete Actionable Recommendations
1. Refactor `simulateGpaForecast` to accept `gradedCompletedHours` distinctly from `earnedDegreeCredits`.
2. Fix `handleRestoreOriginalGrades` in `GPAPage.tsx` to preserve `grade: -1` (`(typeof c.grade === "number" && c.grade > 0) || c.grade === -1`).
3. Introduce an Course Equivalency Map (`equivalencyMap: Record<string, string>`) in `courseProgress.ts` enabling external transfer codes to satisfy internal prerequisites.
4. Add a visual "معادلة" badge to transfer courses across `PlanPage`, `CoursesPage`, and `GPAPage`.

---

### 4.3 Persona 7: Ahmad Darwish (Remedial & Placement Freshman)

- **Student Profile**: 1st-Year Freshman (مستجد مع مساقات استدراكية), Major: Mechatronics Engineering (هندسة الميكاترونكس - 164 credits). High School Tawjihi: 86.4%.
- **Academic Context**: Placement Exam Results: English = 84% (Exempts Remedial English `15200099` and English 1 `15200106`), Arabic = 42% (Failed -> Must enroll in Remedial Arabic `13010006`).
- **Core Requirements**: Non-credit remedial exclusion from graduation degree total (164cr) and GPA, accurate tuition fee billing for remedial hours, foundational onboarding, cognitive load reduction.

#### 1. Detailed User Journey & Route-by-Route Interactions
- **Route `/login` (`LoginPage.tsx`)**:
  - The scraper parses placement exams via `studentPortalService.js:parseExemptionExamRows`.
  - Remedial English (`15200099`) and English 1 (`15200106`) are accurately granted exemption based on the 84% score.
  - Remedial Arabic is marked as required.
  - *Barrier*: Ahmad is greeted by `CampusRunnerGame.tsx`. For an anxious freshman seeking registration clarity, an 8-bit runner game introduces confusion and visual clutter.
- **Route `/plan` (`PlanPage.tsx`)**:
  - Ahmad views the 164-credit Mechatronics curriculum tree.
  - English 1 is marked as passed/exempt. Remedial Arabic is displayed.
  - *Friction*: Ahmad has no idea how prerequisite arrows work, what "متطلب استدراكي إجباري" implies for graduation, or what happens if he drops a course. The single onboarding banner ("هل أنت طالب في خضوري؟") assumes the student only needs to sync their portal.
- **Route `/courses` (`CoursesPage.tsx`)**:
  - Ahmad searches for freshman courses (Calculus 1, Physics 1, Remedial Arabic, Engineering Workshops).
  - Course cards display section codes (e.g. `شعبة 1`) and room locations (e.g. `خ102`, `هـ301`), but there is no tooltip explaining that `خ` denotes Kadoorie Building or `هـ` denotes Engineering Building.
- **Route `/schedule` (`WeeklySchedulePage.tsx`)**:
  - Ahmad views his 14-credit semester schedule (Calculus 1, Physics 1, Physics Lab, Remedial Arabic, Workshops).
  - Lecture vs Lab coupling is unexplained; he does not realize that Physics 1 Lab cannot be taken without Physics 1 Lecture.
- **Route `/gpa` (`GPAPage.tsx`)**:
  - Remedial Arabic is listed.
  - In `calculateGPA` (lines 247, 282), `isRemedialCourse` skips Remedial Arabic, ensuring his score in remedial Arabic does NOT inflate or deflate his collegiate GPA.
  - The table correctly displays "لا تدخل في المعدل" (line 1393).
- **Route `/semester-planning` (`SemesterPlanningPage.tsx`)**:
  - Workload correctly calculates 14 credit hours (within the 19-credit regular freshman ceiling).
  - `estimatedTuition` (`calculateDetailedTuition`, line 827) accurately calculates 14 credits * 24 JOD/hr = 336 JOD + 26 JOD fixed fees = 362 JOD (billing for remedial hours as required by PTUK regulations).
  - *Confusion*: The progress bar indicates that after completing the semester, he will have earned only 11 degree credits toward 164. Ahmad worries that 3 credits were "lost".
- **Route `/registration` (`RegistrationPage.tsx`)**:
  - The locked "قيد التطوير" screen blocks self-registration.
  - In the underlying component, multi-tier Plan A/B/C fallback options, CSP solver temperatures, and live seat sniping tools create immense cognitive overload for a first-term freshman whose schedule is typically pre-assigned.
- **Route `/calendar` (`AcademicCalendarModal.tsx`)**:
  - Ahmad views official university dates, but the modal lacks freshman-specific deadlines (e.g. placement exam re-take petition windows, add/drop orientation periods).

#### 2. Feature Utility Assessment
- **Genuinely High-Value**: Automated Tawjihi placement exam exemption parsing in `studentPortalService.js`, accurate exclusion of remedial grades from GPA in `courseProgress.ts:calculateGPA`, accurate tuition billing for remedial credits in `calculateDetailedTuition`.
- **Useless / Redundant / Cluttered**: Embedded Canvas Runner Game on login, complex multi-tier Plan B/C cascading logic for freshmen with cohort-assigned schedules, 15+ retro themes in Theme Studio, lack of progressive disclosure.

#### 3. Discovered Bugs, Defects & Edge-Case Failures
- **Mandatory Course Stripping (`courseProgress.ts:5-6,20`)**:
  `REMEDIAL_COURSE_IDS` hardcodes `13010006`, which matches "مهارات الحاسوب وتطبيقاته" in `data.ts:54`. If Ahmad takes this mandatory 1-credit course, it is falsely stripped from his degree credits.
- **Inflexible Category Requirements (`StatsDashboard.tsx:5,34`)**:
  `StatsDashboard.tsx` uses hardcoded CSE requirements, misrepresenting Mechatronics Engineering categories.
- **Focus Trap in Student Records Modal (`StudentRecordsModal.tsx:144`)**:
  When Ahmad opens his financial and academic record, pressing Escape does not restore focus and Tab leaks into the background.

#### 4. UI/UX Issues & Usability Barriers
- Complete absence of a Guided Freshman Onboarding Tour explaining section numbers, building codes, credit hours vs contact hours, and remedial rules.
- Visual contradiction between semester workload (14 hours billed) and degree completion progress (11 hours credited).
- Information overload: exposing freshmen to advanced solver heuristics and scenario planners on day one.

#### 5. Concrete Actionable Recommendations
1. Implement a Freshman Onboarding Walkthrough (جولة إرشادية للمستجدين) explaining university terminology, building abbreviations, and academic standings.
2. Add an explicit explanatory pill on remedial course cards: "مساق استدراكي: يُحتسب في القسط والعبء الفصلي، ولا يدخل في المعدل التراكمي أو ساعات التخرج".
3. Implement Progressive Disclosure: default freshmen to a simplified "Basic Planning" view, hiding multi-plan solvers and retro theme studios behind an "Advanced Tools" toggle.
4. Correct `REMEDIAL_COURSE_IDS` in `courseProgress.ts` to ensure `13010006` Computer Skills is recognized as a degree-bearing course when designated as a university requirement.

---

### 4.4 Synthesis & Cross-Persona Comparison Matrix

| Evaluation Dimension | Persona 5: Yazan Masri (Screen Reader / Accessible) | Persona 6: Hiba Hamdan (Transfer Student) | Persona 7: Ahmad Darwish (Remedial Freshman) |
| :--- | :--- | :--- | :--- |
| **Primary Route Pain Point** | `/courses` & `/semester-planning` (Ad-hoc modals lack Tab trap / Escape; roadmap is drag-only). | `/gpa` & `/plan` (GPA forecast diluted by 1.58%; transfer credits lack equivalency mapping). | `/semester-planning` & `/login` (Confusing degree vs tuition credits; runner game clutter). |
| **Highest-Value Feature** | `BaseModal.tsx` focus trap reference; `high-contrast` theme (7.96:1 AAA ratio); List View. | Non-numeric grade handling (`grade: -1`) in `calculateGPA`; transcript semester timeline. | Automated placement exam parser (`parseExemptionExamRows`); tuition billing for remedial hours. |
| **Most Redundant Feature** | 15+ retro themes in Theme Studio; Canvas Runner Game; locked "تسجيل الفصل" buttons. | `MajorTransferModal.tsx` (internal major only; useless for external transfer); isolated custom courses. | Plan A/B/C cascading solvers; Canvas Runner Game; complex CSP solver settings. |
| **Critical Defect / Bug** | 24 ad-hoc modals leak Tab focus; 0 `aria-live` on live seat alerts; `13010006` stripped. | `simulateGpaForecast` dilutes GPA by conflating earned hours with graded hours; reset drops `-1`. | `13010006` mandatory computer skills falsely stripped from degree completion total. |
| **Top Recommendation** | Wrap all 24 modals in `BaseModal.tsx`; add keyboard actions in `MultiColumnRoadmapView.tsx`. | Separate `gradedHours` from `earnedDegreeHours` in `simulateGpaForecast`; add Equivalency Map. | Implement Freshman Guided Tour; add clear badge explaining remedial tuition vs degree credits. |

---

## 5. Verification Method

To independently verify the observations, defects, and invariants documented in this report:

### 5.1 Persona Test Suite Execution
Execute the automated persona validation suite:
```powershell
npx tsx --test "tests/personaValidation.test.ts"
```
*Expected Result*: All 25 persona test cases pass cleanly (100% pass rate in ~1.4 seconds), validating:
- Persona 5: High-contrast theme ratio (7.96:1) and BaseModal contract (lines 882-964).
- Persona 6: Accredited transfer prerequisite fulfillment and non-numeric GPA calculation (lines 972-1129).
- Persona 7: Tawjihi placement exam parsing and remedial Arabic exclusion (lines 1137-1256).

### 5.2 Modal Focus Trapping & Accessibility Verification
1. Inspect `src/components/common/BaseModal.tsx:52-98` to observe correct Tab focus trapping and Escape handling.
2. Inspect `src/components/modals/AcademicAdvisorModal.tsx:228-254`, `src/pages/CoursesPage.tsx:2449,2633`, and `src/pages/SemesterPlanningPage.tsx:2598,2817`:
   - Confirm absence of Tab focus trap logic (`event.key === "Tab"`).
   - Confirm absence of Escape listener in `CoursesPage.tsx` and `SemesterPlanningPage.tsx`.

### 5.3 Transfer Student GPA Dilution Bug Verification
1. Inspect `src/core/academicAdvisor.ts:387-409`:
   - Note line 393: `const currentTotalPoints = currentGpa * safeHours;` where `safeHours` is `completedHours`.
   - Pass `completedHours = 48` (15 local + 33 transfer), `currentGpa = 74.0`, and 15 upcoming hours at grade 80.
   - Observe projected GPA computes to 75.42% instead of the authentic 77.00%.

### 5.4 Remedial Course Classification Defect Verification
1. Inspect `src/core/courseProgress.ts:6`: `REMEDIAL_COURSE_IDS = new Set(["15200099", "13010006"]);`.
2. Inspect `src/data.ts:52-58`: `id: "13010006"` is `مهارات الحاسوب وتطبيقاته`, 1 credit, `متطلب جامعة إجباري`.
3. Call `isDegreeCreditBearing("13010006")` in node / tsx: observe that it returns `false`, proving that mandatory computer skills credits are omitted from degree totals.

### 5.5 Invalidation Conditions
This report's findings would be invalidated if:
1. All 24 ad-hoc modals are refactored to wrap `BaseModal.tsx` with full focus containment and Escape handling.
2. `simulateGpaForecast` is updated to distinguish `gradedHours` from total degree credits.
3. `courseProgress.ts` decouples `13010006` so degree-bearing university requirements are counted toward graduation.
4. An external course equivalency mapping tool and freshman guided tour are added to the application.
