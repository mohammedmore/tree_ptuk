## 2026-11-14T13:30:08Z
You are Worker M3-2 (`worker_m3_2`) assigned to Milestone 3: Registration & GPA Calculator Optimization.

Working Directory: `c:\Users\mohammed\Desktop\planner\.agents\teamwork\worker_m3_2`
Project Workspace: `c:\Users\mohammed\Desktop\planner`

Read these files first:
1. `c:\Users\mohammed\Desktop\planner\.agents\teamwork\ORIGINAL_REQUEST.md` (Authoritative user request)
2. `c:\Users\mohammed\Desktop\planner\.agents\teamwork\orchestrator_3\PROJECT.md` (Scope, Feature Inventory M3)
3. `c:\Users\mohammed\Desktop\planner\.agents\teamwork\explorer_survey2_3\handoff.md` (Survey E3 detailing exact line numbers and code patterns in RegistrationPage, PlanItemsTable, TuitionSummaryWidget, and GPAPage)

## Assigned Write Files (Exclusive Write Ownership):
- `src/pages/RegistrationPage.tsx`
- `src/components/registration/PlanItemsTable.tsx`
- `src/components/registration/TuitionSummaryWidget.tsx`
- `src/pages/GPAPage.tsx`
Do NOT edit any other files.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Requirements for Milestone 3:

### 1. Dead Share Modal & Audio Synthesizer Elimination (Feature 17)
- In `src/pages/RegistrationPage.tsx`:
  - Remove the 73-line dead `showShareModal` JSX (around lines 3086–3158) and unreachable helper state (`shareCodeCopied`, `importCodeInput`, `handleExportShare`, `handleImportShareCode`).
  - Remove dead Web Audio oscillator engine (`getSharedAudioContext`, `playAudioChime`, lines 160–222), dead state `soundEnabled` (line 351, permanently `false`), and all 8 conditional audio triggers.

### 2. Dead State & Helper Function Elimination (Feature 18)
- In `src/pages/RegistrationPage.tsx`:
  - Remove `customSectionNumber` state and its uncalled setter.
  - Remove uncalled dead helper function `handleApplyToWeeklySchedule` (lines 1149–1181).
  - Remove dead `"payload"` tab from `activeTestTab` union in test inspection modal.

### 3. Duplicate Controls & Visual Clutter Cleanup (Feature 19)
- In `src/components/registration/PlanItemsTable.tsx`:
  - Eliminate duplicate "مراقبة المقعد" button in the same row (keep single clean control in the action column; remove the duplicate inline trigger).
  - Remove redundant Safe-Swap modal (`safeSwapCourseId`, lines 3019–3083 in `RegistrationPage.tsx`) and button, since the native section `<select>` dropdown in the row already allows direct 1-click section selection.
  - Deduplicate empty plan CTA buttons ("إضافة مادة" / "استيراد جدول").
- In `src/components/registration/TuitionSummaryWidget.tsx`:
  - Eliminate the duplicate desktop floating mini-bar (lines 46–70) that clutters the bottom-left viewport, since balance and credits are already visible in header and action bar.

### 4. Unified GPA Simulator Channels in GPAPage (Feature 20)
- In `src/pages/GPAPage.tsx`:
  - Eliminate confusing competing grade simulation channels between Table 1 and Table 2.
  - Ensure official transcript courses in Table 2 are clearly presented as official academic records, while what-if simulation operates cleanly on planned courses and retakes without causing cognitive confusion or accidental destructive edits to historical grades.

### 5. Academic Probation Recovery Solver & Retake Optimizer (Feature 21 - تحت الإنذار)
- In `src/pages/GPAPage.tsx`:
  - Implement "حاسبة النجاة من الإنذار" (Probation Survival Calculator). For students on academic probation (GPA < 60%), compute the realistic **Semester GPA required in their next registered 12 to 14 credit hours** to cross 60.00% and lift warning status, rather than a misleading calculation across all 120+ remaining degree hours.
  - Add a retake grade replacement simulator showing the exact cumulative GPA gain when retaking failed/low-grade courses (e.g. "إعادة مادة (3 س) بدرجة 75 بدلاً من 45 يرفع معدلك التراكمي بمقدار +1.8%").

### 6. Honor Student Scholarship Credit Alert & Distinction Tracking (Feature 22 - المتفوق)
- In `src/pages/RegistrationPage.tsx`:
  - For students with high GPA (>= 85%), display an alert if planned credits are under 15 hours, warning that PTUK excellence scholarships (منحة التفوق: 100% or 50% tuition waiver) legally require at least 15 registered credit hours in regular semesters.
- In `src/pages/GPAPage.tsx`:
  - Add distinction tracking for graduation honors (مرتبة الشرف الأولى والثانية: GPA >= 85%/90% with zero failing grades throughout degree).

### 7. Freshman Grading Guide & Telemetry Simplification (Feature 23 - المستجد)
- In `src/pages/GPAPage.tsx`:
  - Add PTUK 100-point grading scale guide (passing course = 50%, passing cumulative = 60%, remedial courses = Pass/Fail without GPA impact) for new students.
- In `src/pages/RegistrationPage.tsx`:
  - Tuck raw developer telemetry (ping latency, prewarm diagnostics, raw audit log feeds) behind an "Advanced Settings / إعدادات متقدمة" collapsible or clean mode so freshmen and typical students are not cognitively overwhelmed.

## Verification Requirements:
Before writing your handoff report, you must run:
1. `npx tsc --noEmit` to verify zero TypeScript compilation errors.
2. `npm run build` to verify clean Vite production compilation (exit code 0).
3. `npm test` to verify all automated tests pass (326/326 passed) and `audit-illusions.js` reports 0 illusions.


## 2026-11-14T13:45:42Z
**Context**: Milestone 3 Implementation Monitoring
**Content**: Checking in on Worker M3-2. Please report your progress on the Milestone 3 features across RegistrationPage, PlanItemsTable, TuitionSummaryWidget, and GPAPage.
**Action**: Report current status, any blockers, and estimated completion.


## 2026-11-14T13:47:11Z
**Context**: Milestone 3 Monitoring
**Content**: Excellent work on completing the RegistrationPage and PlanItemsTable cleanups with clean TypeScript compilation. Proceed with GPAPage enhancements and full verification.
**Action**: Submit handoff report upon completion.
