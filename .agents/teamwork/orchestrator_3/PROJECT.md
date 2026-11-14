# Project: PTUK Planner Multi-Persona UI/UX & Behavioral Improvements

## Architecture
- **Frontend**: React 19, TypeScript 5.8, Tailwind CSS v4, Zustand 4.5, Lucide icons, Motion.
  - Primary target screens: Header (`src/App.tsx`), BottomNav (`src/App.tsx`), Courses Page (`src/pages/CoursesPage.tsx`), Schedule Solver (`src/pages/WeeklySchedulePage.tsx`, `src/components/modals/WeeklyScheduleModal.tsx`), Registration Page (`src/pages/RegistrationPage.tsx`, `src/components/registration/PlanItemsTable.tsx`), GPA Calculator (`src/pages/GPAPage.tsx`).
- **Backend & Core Engine**: Express server, local SQLite database (`data/planner.sqlite`), `scheduleSolver.ts`, `academicPolicy.ts`, `courseProgress.ts`, and `semesterRegistration.ts`.
- **Target Personas**:
  1. Freshman / New Student (المستجد)
  2. Under Academic Probation (تحت الإنذار)
  3. Graduating Student (الخريج)
  4. High-Achieving / Honor Student (المتفوق)
  5. Commuter / Employed Student (المسافر/الموظف)
  6. Transfer / Bridging Student (المجسر)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Dead Registration Tab & Stub Removal | Remove dead disabled "تسجيل الفصل" button from Header and BottomNav and the stub route in App.tsx | M1 | Survey E1 |
| 2 | Header Action Deduplication | Deduplicate Calendar, Student Records, and Theme/Contrast toggle buttons in Header | M1 | Survey E1 |
| 3 | Mobile BottomNav Touch & Spacing Optimization | Refactor BottomNav from 6 cramped tabs to 5 well-spaced tabs with safe-area padding | M1 | Survey E1 |
| 4 | Courses Page Dead State & Duplicate Export Cleanup | Remove dead `selectedRoom` state/filters and duplicate custom export menu in CoursesPage | M1 | Survey E1 |
| 5 | Course Peek Card Integration | Wire up orphaned `CoursePeekCard.tsx` on hover/click in CoursesPage | M1 | Survey E1 |
| 6 | Freshman Course Catalog Onboarding & Grouping | Default to grouped-by-year view with years 3-4 collapsed, readable prerequisite titles, and prerequisite lock tooltips | M1 | Survey E1 |
| 7 | Graduating Senior Elective Buckets & Seasonal Offerings | Add elective bucket summaries (e.g. 1/2 complete) and seasonal offering tags; clarify capstone credit requirements | M1 | Survey E1 |
| 8 | Transfer/Bridging Equivalence Marking | Add UI action to mark course as transferred/equivalent (`معادلة مساقات`) with Pass/Fail (`-1`) and `معادل 🎓` badge | M1 | Survey E1 |
| 9 | Schedule Solver Dead Edit View & Helper Elimination | Remove 218-line dead `activeTab === "edit"` manual data entry view and associated dead functions/state in WeeklyScheduleModal | M2 | Survey E2 |
| 10 | Schedule Solver Dead Imports & State Cleanup | Remove unused solver imports, `hasGeneratedSchedules`, `isHideSelectedCourses`, `getPosition` | M2 | Survey E2 |
| 11 | Duplicate Compare & Drawer Dismissal Elimination | Remove triple compare buttons and duplicate drawer dismissal buttons in WeeklyScheduleModal | M2 | Survey E2 |
| 12 | Semester State Synchronization & Doctor Filter Wiring | Synchronize selected semester between page and modal, wire `onSelectDoctorFilter` in DoctorScheduleModal | M2 | Survey E2 |
| 13 | Commuter Time Window Constraints & Presets | Add travel constraints (classes >= 9:00, finish <= 15:30), commuter preset, and visible gap metrics | M2 | Survey E2 |
| 14 | Honor Student Overload Credit Hour Tally | Add total credit hour counter in course selection drawer for 19-21 credit overload validation | M2 | Survey E2 |
| 15 | Academic Probation 14-Credit Enforcement & Retake Priority | Enforce 14-credit limit alert/cap in solver and prioritize retake courses in drawer | M2 | Survey E2 |
| 16 | Mobile Timetable Ergonomics & Touch Target Expansion | Expand draft button touch targets to >= 44px, streamline mobile sticky toolbar | M2 | Survey E2 |
| 17 | Dead Share Modal & Audio Synthesizer Elimination | Remove 73-line dead `showShareModal` JSX and dead Web Audio oscillator engine in RegistrationPage | M3 | Survey E3 |
| 18 | Dead State & Helper Function Elimination | Remove `customSectionNumber`, `handleApplyToWeeklySchedule`, and dead `"payload"` tab in RegistrationPage | M3 | Survey E3 |
| 19 | Duplicate Seat-Watch, Safe-Swap & Tuition Mini-Bar Cleanup | Remove duplicate radar button, redundant safe-swap modal, and redundant floating tuition mini-bar | M3 | Survey E3 |
| 20 | Unified GPA Simulator Channels | Eliminate competing grade simulation channels in GPAPage | M3 | Survey E3 |
| 21 | Academic Probation Recovery Solver & Retake Optimizer | Implement "حاسبة النجاة من الإنذار" (semester GPA needed in 12-14 hrs to reach 60%) and retake grade replacement simulator | M3 | Survey E3 |
| 22 | Honor Student Scholarship Credit Alert & Distinction Tracking | Add 15-credit minimum alert for excellence scholarships and distinction tracking (مرتبة الشرف الأولى والثانية) | M3 | Survey E3 |
| 23 | Freshman Grading Guide & Telemetry Simplification | Add PTUK 100-point grading scale guide and tuck raw developer telemetry behind Advanced Settings | M3 | Survey E3 |
| 24 | Full Build & Automated Regression Verification | Run clean `npm run build` and ensure all 310+ tests pass with zero illusions or regressions | M4 | Survey E1, E2, E3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Navigation & Course Catalog Optimization | Header, BottomNav, CoursesPage cleanup, CoursePeekCard wiring, and Freshman/Senior/Transfer enhancements | none | DONE |
| M2 | Schedule Solver Streamlining & Persona Adaptations | WeeklySchedulePage, WeeklyScheduleModal dead code removal, duplicate elimination, commuter/honor/probation features | M1 | DONE |
| M3 | Registration & GPA Calculator Optimization | RegistrationPage, PlanItemsTable, GPAPage dead code removal, unified simulation, probation solver, scholarship alerts | M1 | DONE |
| M4 | Comprehensive End-to-End Verification | Full clean build (`npm run build`), automated test suite (`npm test`), persona workflow validation | M1, M2, M3 | DONE |

## Interface Contracts
### Header / BottomNav ↔ Subsystems
- Direct route navigation via `#courses`, `#schedule`, `#registration`, `#gpa`, `#plan`, `#calendar`.
- Mobile BottomNav displays 5 core active destinations without dead or disabled stubs.

### Schedule Solver ↔ Core Solver
- Asynchronous worker communication via `generateSchedulesAsync` and `explainConflictsAsync`.
- Filters payload includes `timePreference`, `maxGap`, `freeDays`, `earliestTime`, `latestTime`, and `selectedDoctor`.

### GPA Calculator & Registration ↔ Academic Policy
- Degree credit thresholds: 14h (probation), 18h (standard), 19-21h (honor/graduating).
- Passing course: 50%, passing cumulative GPA: 60%. Retake replaces prior grade in cumulative total.

## Code Layout
- `src/App.tsx`: Top header navigation and mobile bottom navigation.
- `src/pages/CoursesPage.tsx`: Course catalog, search, prerequisites, and degree progress.
- `src/components/common/CoursePeekCard.tsx`: Course hover card.
- `src/pages/WeeklySchedulePage.tsx`: Timetable grid, schedule drafts, and solver launcher.
- `src/components/modals/WeeklyScheduleModal.tsx`: Interactive combinatorial schedule solver.
- `src/components/modals/DoctorScheduleModal.tsx`: Instructor schedule viewer and solver preference.
- `src/pages/RegistrationPage.tsx`: Plan management, live portal sync, seat watching, and tuition.
- `src/components/registration/PlanItemsTable.tsx`: Course registration table and section selection.
- `src/components/registration/TuitionSummaryWidget.tsx`: Tuition calculation and wallet balance.
- `src/pages/GPAPage.tsx`: Cumulative GPA calculation, target solver, and retake simulation.
