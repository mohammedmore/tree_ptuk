## 2026-11-14T08:36:44Z
You are Worker M2 (`worker_m2_1`) assigned to Milestone 2: Schedule Solver Streamlining & Persona Adaptations.

Working Directory: `c:\Users\mohammed\Desktop\planner\.agents\teamwork\worker_m2_1`
Project Workspace: `c:\Users\mohammed\Desktop\planner`

Read these files first:
1. `c:\Users\mohammed\Desktop\planner\.agents\teamwork\ORIGINAL_REQUEST.md` (Authoritative user request)
2. `c:\Users\mohammed\Desktop\planner\.agents\teamwork\orchestrator_3\PROJECT.md` (Scope, Feature Inventory M2)
3. `c:\Users\mohammed\Desktop\planner\.agents\teamwork\explorer_survey2_2\handoff.md` (Detailed architectural survey & code lines for M2)

## Assigned Write Files (Exclusive Write Ownership):
- `src/components/modals/WeeklyScheduleModal.tsx`
- `src/pages/WeeklySchedulePage.tsx`
- `src/components/modals/DoctorScheduleModal.tsx` (only if necessary for wiring `onSelectDoctorFilter`)
Do NOT edit any other files.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Requirements for Milestone 2:

### 1. Schedule Solver Dead Edit View & Helper Elimination (Feature 9)
- In `src/components/modals/WeeklyScheduleModal.tsx`:
  - Remove the 218-line dead `activeTab === "edit"` manual data entry view (around lines 1533–1750).
  - Remove dead state `const [activeTab, setActiveTab] = useState<"edit" | "visual">("visual");` (it was permanently initialized to "visual" and `setActiveTab` was never called).
  - Remove dead functions and variables supporting only this dead branch: `manualCourses` memo, `getSuggestedManualEntry`, `handleUpdateEntry`, `toggleDay`, and `EDIT_DAYS`.
  - Remove misleading footer text promising `<p>يمكنك التبديل بين الأقسام من الأعلى</p>`.

### 2. Dead Imports & State Cleanup (Feature 10)
- In `src/components/modals/WeeklyScheduleModal.tsx`:
  - Remove unused imports from `scheduleSolver.ts`: `generateAllSchedules`, `explainScheduleConflicts`, `getStats`. (Keep `generateSchedulesAsync`, `explainConflictsAsync`, types, etc.).
  - Remove unused imports from `icalExport.ts`: `exportScheduleToICal`, `downloadScheduleImage`.
  - Remove dead state variables: `hasGeneratedSchedules`, `isExportingPng`, `isHideSelectedCourses`.
  - Remove uncalled helpers if unused: `timeToMinutes` and `getPosition`.

### 3. Duplicate Controls & Drawer Dismissal Elimination (Feature 11)
- In `src/components/modals/WeeklyScheduleModal.tsx`:
  - Consolidate the triple duplicate "مقارنة" compare buttons (toolbar line ~2451, sticky bar line ~3066, bottom pager line ~3491) into a single, clean toggle button in the filter/navigation toolbar.
  - Consolidate the dual pagers (top sticky bar lines ~2991-3116 vs bottom pager lines ~3423-3517): eliminate redundant second pager at the bottom, or unify controls into a consistent, non-duplicative UI.
  - Consolidate the triple duplicate drawer dismissal buttons (lines ~1826, 1917, 2350) into a single clear, intuitive close action for the course selection drawer.

### 4. Semester State Synchronization & Doctor Filter Wiring (Feature 12)
- In `src/pages/WeeklySchedulePage.tsx` and `src/components/modals/WeeklyScheduleModal.tsx`:
  - Ensure the selected semester is synchronized between `WeeklySchedulePage` and `WeeklyScheduleModal` (e.g. passing `selectedSemester` as a prop so opening the modal does not reset to a random planned course semester).
  - In `WeeklySchedulePage.tsx:1545`, pass `onSelectDoctorFilter={(docName) => { ... }}` to `<DoctorScheduleModal>`. When the user clicks "تفضيل هذا الدكتور في المولد الذكي", store or set the preferred doctor filter so that when the solver runs, that doctor is prioritized/filtered.

### 5. Commuter Time Window Constraints & Presets (Feature 13 - المسافر/الموظف)
- In `src/components/modals/WeeklyScheduleModal.tsx`:
  - Add travel constraints / preferences for commuter students:
    - Earliest class time (e.g. >= 09:00 AM) to avoid morning checkpoint delays.
    - Latest class end time (e.g. <= 15:30) to avoid afternoon transportation shutdowns.
  - Add a 1-click "نمط المسافر/الموظف" (Commuter Preset) button in the solver filter toolbar:
    - Automatically sets `timePreference: "min_days"` (compress days on campus).
    - Automatically sets `maxGap: 60` (max 1 hour gap between classes).
    - Automatically sets earliest class to 09:00 and latest class to 15:30.
  - Display gap hours visibly on schedule cards / summary metrics (not hidden solely in a title tooltip).

### 6. Honor Student Overload Credit Hour Tally (Feature 14 - المتفوق)
- In `src/components/modals/WeeklyScheduleModal.tsx`:
  - In the course selection drawer, calculate and prominently display the total credit hours of selected courses (e.g., `إجمالي الساعات المختارة: X ساعة` alongside course count).
  - Provide a clear status badge/indicator: normal range (12–18 hours) vs overload (19–21 hours) for high-achieving / graduating students.

### 7. Academic Probation 14-Credit Enforcement & Retake Priority (Feature 15 - تحت الإنذار)
- In `src/components/modals/WeeklyScheduleModal.tsx`:
  - Check whether the student is on academic warning / probation (`currentGpa < 60` or `hasAcademicWarning`).
  - If on probation and total selected hours > 14, display a prominent warning banner explaining PTUK's academic probation rule: "تنبيه: الحد الأقصى للتسجيل تحت الإنذار الأكاديمي هو 14 ساعة معتمدة لمنع إلغاء الجدول".
  - In the course selection drawer, prioritize and group retake / failed courses under a dedicated "مساقات الإعادة للتحسين" (Retake Priority) section at the top, so probation students can easily select courses to raise their GPA.

### 8. Mobile Timetable Ergonomics & Touch Target Expansion (Feature 16)
- In `src/pages/WeeklySchedulePage.tsx`:
  - Expand draft management buttons (edit, duplicate, delete around lines 818–836) touch targets to at least 44×44px (`min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5`) to satisfy WCAG mobile touch standards.
- In `src/components/modals/WeeklyScheduleModal.tsx`:
  - Refactor the sticky toolbar for mobile viewports (< 414px) so that it remains compact and responsive, preventing it from wrapping into 4 lines or consuming 45% of the mobile viewport height.

## Verification Requirements:
Before writing your handoff report, you must run:
1. `npm run lint` (or `npx tsc --noEmit`) to verify zero TypeScript compilation errors.
2. `npm run build` to verify clean Vite production compilation (exit code 0).
3. `npm test` to verify all automated tests pass (310/310 passed) and `audit-illusions.js` reports 0 illusions.

Write your final report to: `c:\Users\mohammed\Desktop\planner\.agents\teamwork\worker_m2_1\handoff.md`.
Communicate back to orchestrator via `send_message`.

## 2026-11-14T09:08:11Z
**Context**: Milestone 2 Implementation Monitoring
**Content**: Checking in on Milestone 2. We observed that the dead code removal in WeeklyScheduleModal.tsx and touch targets in WeeklySchedulePage.tsx are applied. What step are you currently working on (commuter presets, honor tally, probation limits, or verification)?
**Action**: Please provide an update and report any blockers.
