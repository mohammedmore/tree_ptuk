# Comprehensive Persona Evaluation Report: Personas 1–4
**Milestone 3: 10-Student Persona Multi-Angle Evaluation (Part 1)**

- **Agent**: `explorer_m3_1` (Teamwork Explorer)
- **Target Working Directory**: `c:\Users\mohammed\Desktop\planner\.agents\teamwork\explorer_m3_1\`
- **Target Project**: `c:\Users\mohammed\Desktop\planner`
- **Parent Conversation ID**: `b888a5de-c39e-41a3-8613-2c11312234bb`
- **Date**: 2026-11-14

---

## 1. Observation

Direct code inspections, runtime executions, and static traces across all 8 application routes (`plan`, `courses`, `schedule`, `gpa`, `semester-planning`, `registration`, `login`, `calendar`) revealed the following verifiable facts:

### 1.1 Persona 1: Tariq Al-Najjar (Working Senior, Computer Systems Engineering - 164 credits)
- **Schedule Clamping UI Missing 13:30 (`src/components/modals/WeeklyScheduleModal.tsx:2617-2633`)**:
  The select element for latest class end time (`#commuter-latest-time`) restricts users to static discrete options:
  ```tsx
  <select id="commuter-latest-time" value={latestClassTime} onChange={(e) => setLatestClassTime(e.target.value)}>
    <option value="">بدون قيد (حتى نهاية الدوام)</option>
    <option value="14:00">14:00 (2:00 مساءً كحد أقصى)</option>
    <option value="15:00">15:00 (3:00 مساءً كحد أقصى)</option>
    <option value="15:30">15:30 (3:30 مساءً كحد أقصى - نمط المسافرين)</option>
    <option value="16:00">16:00 (4:00 مساءً كحد أقصى)</option>
    <option value="17:00">17:00 (5:00 مساءً كحد أقصى)</option>
  </select>
  ```
  Tariq's afternoon shift begins strictly at 14:00. He requires all classes to finish strictly by **13:30** to allow transit to work. There is no `13:30` (or `13:00`) option, nor any custom time input.
- **Zero-Section / Non-Meeting Course Solver Abort (`src/services/scheduleSolver.ts:451-458`)**:
  In `generateAllSchedules`:
  ```typescript
  if (
    courses.some(
      (course) =>
        !Array.isArray(course.sections) || course.sections.length === 0,
    )
  ) {
    return [];
  }
  ```
  Tariq's required course `15010400` (Field Training / التدريب الميداني) is an off-campus internship that typically has no timetable lecture section (`sections: []`). If Tariq adds Field Training alongside his remaining 4 courses, the solver aborts immediately and returns `[]` (0 schedules) for all courses without explanation.
- **Capstone & Training Eligibility Banner Misplaced (`src/pages/GPAPage.tsx:515-535` vs `src/pages/PlanPage.tsx`)**:
  Standing status (`standingInfo.canRegisterGradProject` requiring 120 cr, `standingInfo.canRegisterFieldTraining` requiring 90 cr) is calculated by `getAcademicStandingInfo` in `src/core/courseProgress.ts:506`. However, this banner is rendered exclusively inside `GPAPage.tsx` (lines 515–535). `PlanPage.tsx` and `SemesterPlanningPage.tsx` do not display whether senior milestones are unlocked.
- **Cognitive Clutter & Delayed Login Transition (`src/components/auth/CampusRunnerGame.tsx:1-965`, `src/components/auth/LoginSyncExperience.tsx:21-68`)**:
  Desktop login sync mounts a 965-line HTML5 canvas 8-bit runner game. If a working student taps the screen or interacts with keyboard controls during authentication sync, `hasInteractedWithGame` becomes `true`, which activates a mandatory 3-second countdown modal (`modalCountdown = 3`) before navigating to the planner.

### 1.2 Persona 2: Nour Zaidan (Commuter Sophomore, Civil Engineering - 164 credits)
- **Commuter Mode Preset Purges 08:30 Classes (`src/components/modals/WeeklyScheduleModal.tsx:2340-2364`)**:
  The "نمط المسافر/الموظف" quick-action button hardcodes rigid filter values:
  ```typescript
  setScheduleFilters((prev) => ({
    ...prev,
    timePreference: "min_days",
    maxGap: 1,
  }));
  setEarliestClassTime("09:00");
  setLatestClassTime("15:30");
  ```
  Nour commutes from rural Jenin and arrives on campus at **08:30 AM**. Because the preset forces `earliestClassTime = "09:00"`, 08:30 AM sections of Statics (`12040201`) and Calculus 3 (`15010201`) are aggressively eliminated. Nour must manually open the advanced drawer to override this back to `08:30`.
- **Misleading Conflict Explanation (`src/services/scheduleSolver.ts:1167-1174`)**:
  When sections are pruned because they fall outside the commuter window (`latestClassTime` / `earliestClassTime`), `WeeklyScheduleModal.tsx:766` adds them to `filters.excludedSections`. When zero schedules remain, `explainScheduleConflicts` reports:
  ```typescript
  } else if (exclusions.size > 0) {
    details.push(`تم استبعاد جميع شعب المادة "${name}" يدوياً.`);
  ```
  The user is misinformed that they "manually excluded" all sections, creating confusion.
- **Zero Transit Buffer Between Campus Buildings (`src/services/scheduleSolver.ts:350-366`)**:
  Section conflict validation checks solely for overlapping time intervals (`assignedBlock.start < candidateBlock.end && candidateBlock.start < assignedBlock.end`). It allows back-to-back classes with 0 minutes between Old Campus Engineering Laboratories (Surveying Lab `12040203`) and New Campus Science lecture halls (Calculus 3 `15010201`), which are 10–15 minutes walk apart.
- **Missing Campus Attendance Days in Schedule Compare (`src/components/modals/WeeklyScheduleModal.tsx:3000-3200`)**:
  Schedule cards in the comparison view show total hours and gaps, but do not prominently badge the total days on campus (e.g. "2 days: Mon/Wed" vs "4 days"), forcing commuters to manually count columns.

### 1.3 Persona 3: Omar Abu-Saleh (Academic Warning / Probation, Software Engineering - 132 credits)
- **Lack of Proactive 14-Credit Enforcement in Early UI (`src/pages/RegistrationPage.tsx:2190-2218`, `src/pages/SemesterPlanningPage.tsx:930-970`, `src/components/modals/WeeklyScheduleModal.tsx:1653-1657`)**:
  In `RegistrationPage.tsx`, the 14-credit limit for students under probation (GPA 57.8%) is displayed as an informational advisory banner:
  ```tsx
  {(hasAcademicWarning || (studentGPA > 0 && studentGPA < 60)) && !isSummerSemester && (
    <div className={cn("p-4 rounded-3xl border flex items-start gap-3", currentPlan.totalCredits > 14 ? "bg-rose-500/10" : "bg-blue-500/10")}>
      <span>توجيه أكاديمي: الحد الأقصى للتسجيل للطلبة تحت الإنذار (14 ساعة)</span>
  ```
  However, the UI permits Omar to add 15, 16, or 18 credits to Plan A and only flags an error diagnostic upon submission. In `PlanPage.tsx`, no warning is triggered when planning >14 credits into a semester.
- **What-If Simulation Stale Earned Credits (`src/pages/GPAPage.tsx:315-330`)**:
  When Omar simulates retaking and passing a failed course (`15010101` Calculus 1) with grade 85:
  ```typescript
  const projectedGPA = useMemo(() => {
    const mergedGrades = { ...courseGrades, ...whatIfGrades };
    const mergedCompleted = new Set([...Array.from(completedCourses), ...Object.keys(whatIfGrades)]);
    return calculateGPA(courses, mergedGrades, mergedCompleted, failedCourseIds);
  }, [courses, courseGrades, completedCourses, failedCourseIds, whatIfGrades]);

  const earnedCredits = useMemo(() => {
    return calculateDegreeCredits(courses, completedCourses);
  }, [courses, completedCourses]);
  ```
  `projectedGPA` updates using `mergedCompleted`, but `earnedCredits` passes only the original `completedCourses`. The earned credits display remains frozen at 58 credits instead of incrementing to 61 credits.
- **Absence of Dedicated "Probation Recovery Mode"**:
  In `CoursesPage.tsx`, courses are listed indiscriminately. There is no dedicated toggle to filter the catalog down to failed courses (`F`) or low grades (`D`) that are eligible for GPA replacement.

### 1.4 Persona 4: Maya Khoury (Honors Fast-Tracker, Artificial Intelligence - 132 credits)
- **Critical Policy Discrepancy in `checkPlanCreditLimits` (`src/core/semesterRegistration.ts:409-432`)**:
  `academicPolicy.ts:125-147` correctly raises `maxCredits` to **21** for high-GPA students (`options.student.gpa >= 80`).
  `SemesterPlanningPage.tsx:521-551` correctly auto-enables 21 credits for Maya (`currentStudent.gpa >= 80`).
  HOWEVER, `src/core/semesterRegistration.ts:409-432` only checks `options.isGraduating`:
  ```typescript
  export function checkPlanCreditLimits(
    totalCredits: number,
    semester: string = "",
    options: {
      hasAcademicWarning?: boolean;
      isGraduating?: boolean;
      gpa?: number;
    } = {},
  ): PlanDiagnostic[] {
    ...
    if (
      options.hasAcademicWarning ||
      (typeof options.gpa === "number" && options.gpa > 0 && options.gpa < 60)
    ) {
      maxCredits = isSummer ? 6 : 14;
    } else if (options.isGraduating) {
      maxCredits = isSummer ? 12 : 21;
    }
  ```
  `checkPlanCreditLimits` **NEVER checks `options.gpa >= 80`**.
  In `RegistrationPage.tsx:717-729`, the call passes `{ hasAcademicWarning, gpa: cachedProfile?.gpa }`.
  Because Maya is in her 3rd year and not graduating, `options.isGraduating` is `undefined`.
  `maxCredits` evaluates to **19**. When Maya attempts to register her 21-credit overload, `checkPlanCreditLimits` returns `CREDIT_LIMIT_EXCEEDED`, falsely blocking her from registering!
  This bug was verified empirically in `tests/personaAdversarialHarness.test.ts:432-462` (`Adversarial 4.3`).
- **Web Worker Timeout Fallback Freezes Main UI Thread (`src/services/scheduleSolverClient.ts:117-126`, `src/services/scheduleSolver.ts:509-580`)**:
  Maya selects 7 courses (21 credits). Backtracking across 7 courses can explore up to 5^7 = 78,125 permutations. Unlike `solveSchedule` (which caps at 50,000 nodes), `generateAllSchedules` has **no node limit**.
  In `scheduleSolverClient.ts`:
  ```typescript
  const timer = setTimeout(() => {
    if (this.pendingResolvers.has(id)) {
      this.pendingResolvers.delete(id);
      try {
        resolve(fallbackFn()); // Runs generateAllSchedules synchronously on the UI thread!
      } catch (err) {
        reject(err);
      }
    }
  }, 15000);
  ```
  If the Web Worker takes longer than 15 seconds, the client aborts the worker and executes the exact same heavy search synchronously on the main thread, freezing the user's browser.
- **Missing Accelerated 3.5-Year Roadmap Template**:
  `PlanPage.tsx` and `SemesterPlanningPage.tsx` only provide the standard 4-year (8-semester) layout. Maya has no template to model an accelerated 7-semester completion path (21+21+19+18+18+18+17).

---

## 2. Logic Chain

```
[Observation: #commuter-latest-time select in WeeklyScheduleModal.tsx:2625-2632 only has 14:00, 15:00, 15:30, 16:00, 17:00]
  ├──> [Inference 1: Working seniors with afternoon shifts starting at 14:00 cannot filter for classes ending by 13:30]
  └──> [Conclusion 1: Tariq must manually inspect and uncheck dozens of sections to prevent work shift conflicts]

[Observation: generateAllSchedules aborts immediately if any course has sections.length === 0]
  ├──> [Inference 2: Field Training (15010400) and Capstone courses have no physical classroom sections in the timetable]
  └──> [Conclusion 2: Selecting mandatory senior courses causes solver to return 0 schedules for all courses]

[Observation: Commuter Mode button hardcodes earliestClassTime = "09:00"]
  ├──> [Inference 3: Commuters arriving at 08:30 AM lose all 08:30 morning classes from candidate pool]
  └──> [Conclusion 3: Nour must repeatedly undo and manually adjust filters every time she activates commuter mode]

[Observation: RegistrationPage and WeeklyScheduleModal only show warnings for >14 credits under probation]
  ├──> [Inference 4: Students on probation can construct invalid 15-18 credit plans throughout planning and schedule creation]
  └──> [Conclusion 4: Omar experiences late rejection during final registration submission instead of proactive guidance]

[Observation: checkPlanCreditLimits in semesterRegistration.ts:429 only checks options.isGraduating for 21 credits]
  ├──> [Inference 5: Honors students with GPA >= 80% (Maya, 89.4%) who are not graduating have maxCredits capped at 19]
  └──> [Conclusion 5: Registration page falsely throws CREDIT_LIMIT_EXCEEDED error, preventing 21-credit overload]

[Observation: scheduleSolverClient.ts falls back to fallbackFn() on 15s timeout]
  ├──> [Inference 6: When 7 courses (21 credits) exceed worker timeout, generateAllSchedules executes on the main thread]
  └──> [Conclusion 6: High-achieving students encounter complete browser freezing when solving full overload schedules]
```

---

## 3. Caveats

1. **Read-Only Inspection**: In accordance with the dispatch directive, no production code (`src/`, `server/`, `scripts/`) was modified.
2. **Local Environment Isolation**: All evaluations were conducted against local mock data and test harnesses without connecting to live university endpoints (`edugate.ptuk.edu.ps`).
3. **Hardware-Dependent Worker Timing**: Web Worker execution duration for 7 courses varies based on CPU core count and available system memory. The 15-second timeout threshold is particularly prone to triggering on lower-end laptops or mobile devices.

---

## 4. Conclusion

### 4.1 Persona Evaluation Summary Matrix

| Persona | Core Routes Evaluated | High-Value Features | Redundant / Dead Features | Critical Bugs / Deficiencies | Usability & Friction Barriers |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **P1: Tariq** (Working Senior, CSE 164cr) | `login`, `plan`, `courses`, `schedule`, `semester-planning`, `registration`, `gpa`, `calendar` | Capstone credit threshold checking (`resolveCapstoneThreshold`), `min_days` sorting, memoized degree credits. | 965-line `CampusRunnerGame` in auth sync, audio chimes, doctor schedule modal, retro theme visualizer. | Solver lacks 13:30 cutoff; solver aborts if course has 0 sections (Field Training); Capstone eligibility banner buried in GPA page. | Manually unchecking 50+ sections; mandatory 3-second countdown if runner canvas is clicked during login. |
| **P2: Nour** (Commuter Sophomore, CE 164cr) | `login`, `plan`, `courses`, `schedule`, `semester-planning`, `registration`, `gpa`, `calendar` | `min_days` schedule optimization, diverse solutions filter, ICS calendar export. | Excessive theme variations in Theme Studio, retro sounds, complex network latency visualizers. | Commuter button forces 09:00 start (wiping 08:30 classes); solver falsely reports time-filtered sections as "manually excluded"; zero transit buffer. | No "Days on Campus" badge in schedule comparison view; risk of 0-minute cross-campus transitions. |
| **P3: Omar** (Academic Warning, SE 132cr) | `login`, `plan`, `courses`, `schedule`, `semester-planning`, `registration`, `gpa`, `calendar` | Retake Optimizer with exact GPA boost calculation, retake grade replacement in `calculateGPA`. | Planning >14 credit scenarios that violate probation limits; runner mini-game; sound effects. | 14-credit limit not proactively enforced during course selection/dragging; What-If mode does not update earned credits when passing a retake. | No "GPA Recovery Mode" catalog filter; late diagnostic error on registration submit rather than proactive blocking. |
| **P4: Maya** (Honors Fast-Tracker, AI 132cr) | `login`, `plan`, `courses`, `schedule`, `semester-planning`, `registration`, `gpa`, `calendar` | Critical Path analysis (`computeCriticalPath`), automatic high-GPA detection in semester planning, Plan A/B/C fallback. | 15s worker fallback executing on main thread; runner game; redundant print views. | **Discrepancy Bug**: `checkPlanCreditLimits` ignores `gpa >= 80` without `isGraduating`, falsely blocking 21-credit registration; solver worker freezes UI on 7 courses. | UI warns about 19 credits in registration; lack of an accelerated 3.5-year roadmap template. |

---

### 4.2 Route-by-Route Evaluation Synthesis

| Route | Persona 1 (Tariq - Senior) | Persona 2 (Nour - Commuter) | Persona 3 (Omar - Probation) | Persona 4 (Maya - Honors) |
| :--- | :--- | :--- | :--- | :--- |
| **`login`** | Distracted by 965-line canvas game; penalized with 3s delay if touched. | Game unmounted on mobile, but bulky on tablet/laptop. | Clutter when urgently trying to review warning status. | Unnecessary delay during rapid semester planning. |
| **`plan`** | Capstone/Training thresholds (120/90cr) absent from degree tree. | Flowchart does not visually distinguish co-requisites from prerequisites. | No warning when planning >14 credits into future terms. | Critical path tool is excellent, but lacks accelerated 3.5y template. |
| **`courses`** | Lacks filter for sections ending before 13:30; doctor modal is bloat. | Lacks campus building tags (Old vs New campus) on section cards. | Lacks a "Retake Priority" filter for failed courses. | Easy to find electives, but difficult to track seat capacity across 7 courses. |
| **`schedule`** | Dropdown lacks 13:30 cutoff; solver breaks on Field Training (0 sections). | Preset hardcodes 09:00 (purges 08:30); conflict text misleads user. | Warning banner shown, but does not block selecting >14 credits. | Solving 7 courses (21cr) triggers 15s timeout and freezes main thread. |
| **`semester-planning`** | Allows planning 13 credits, but no guidance on Capstone+Training approval. | Permissive co-req allows planning Surveying Lab+Lecture without deadlock. | Allows dragging 15+ credits; does not block drop event. | Correctly auto-enables 21 credits via `isAutoHighGpaEligible`. |
| **`registration`** | Heavy UI (audio, live sniping, radar); wants simple morning schedule. | Plan cards omit "Days on Campus" summary count. | Diagnostic warns of >14 credits late in the flow rather than upfront. | **Blocked**: `checkPlanCreditLimits` rejects 21cr because she isn't graduating. |
| **`gpa`** | Correctly shows standing banner, but it's misplaced in GPA screen. | Tuition calculator accurately estimates 16cr in Engineering (444 JOD). | Retake optimizer is high value; bug: earned credits frozen in What-If. | Honors tuition scholarship calculation is clear and valuable. |
| **`calendar`** | Opens modal for graduation deadlines; modal lacks focus trap. | Opens modal for add/drop deadlines. | Checks warning appeal and course withdrawal (W) deadlines. | Checks honors list publication dates. |

---

## 5. Verification Method

To independently reproduce and verify the findings:

1. **Verify Adversarial Discrepancy (Maya 21-credit bug & Tariq time constraints)**:
   ```powershell
   node --import tsx --test tests/personaAdversarialHarness.test.ts
   ```
   Inspect test `Adversarial 4.3` (lines 432–462), which proves that `checkPlanCreditLimits(21, ..., { gpa: 89.4 })` returns 1 error capping at 19 credits unless `isGraduating: true` is passed.
2. **Verify Persona Validation Test Suite**:
   ```powershell
   node --import tsx --test tests/personaValidation.test.ts
   ```
   All 25 unit/integration tests pass, confirming baseline policy behaviors.
3. **Inspect Discrete Time Dropdown Options**:
   Examine `src/components/modals/WeeklyScheduleModal.tsx:2617-2633`. Observe that `<option value="13:30">` does not exist.
4. **Inspect Zero-Section Solver Abort**:
   Examine `src/services/scheduleSolver.ts:451-458`. Observe that if any course has `sections.length === 0`, `generateAllSchedules` returns `[]`.
5. **Inspect What-If Earned Credits Staleness**:
   Examine `src/pages/GPAPage.tsx:328-330`. Observe that `earnedCredits` depends on `completedCourses` rather than `mergedCompleted`.
