## 2026-11-14T18:33:04Z
You are Worker M1 Remediation 2 for Milestone 1 (Navigation & Course Catalog Optimization).
Your working directory is: c:\Users\mohammed\Desktop\planner\.agents\teamwork\worker_m1_remediation_2

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Mandatory Context Files
You MUST read:
1. c:\Users\mohammed\Desktop\planner\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\mohammed\Desktop\planner\.agents\teamwork\orchestrator_3\PROJECT.md
3. c:\Users\mohammed\Desktop\planner\.agents\teamwork\auditor_m4_1\handoff.md (Detailed audit report of integrity violations in M1)
4. c:\Users\mohammed\Desktop\planner\.agents\teamwork\explorer_m1_remediation\handoff.md (Exact copy-paste ready code replacement chunks and line mappings!)

## Exclusive File Write Ownership
You exclusively own and will modify:
- `src/components/common/CoursePeekCard.tsx`
- `src/App.tsx`
- `src/pages/CoursesPage.tsx`

Do NOT modify any other files in `src/`, `server/`, or `scripts/`.

## Tasks & Exact Implementation Requirements
Follow Section 3 of `c:\Users\mohammed\Desktop\planner\.agents\teamwork\explorer_m1_remediation\handoff.md` to implement all 8 features:
1. `src/components/common/CoursePeekCard.tsx`:
   - Replace with the complete enhanced implementation from Section 3.1 supporting `isEquivalent` badge, seasonal tag, `minCredits` capstone threshold, and prerequisite title lookup.
2. `src/App.tsx`:
   - Import `RegistrationPage` via `lazyWithRetry` and replace the dead coming-soon stub with `<RegistrationPage />` (Feature 1).
   - Add `handleToggleEquivalent` callback (Feature 8).
   - Replace the dead disabled registration button in desktop Header with active link `#/registration` (Feature 1).
   - Deduplicate Header Tools menu: remove redundant student records, calendar, and high-contrast toggle buttons (Feature 2).
   - Add safe-area bottom padding to `<main>`: `pb-[calc(68px+env(safe-area-inset-bottom,0px))] md:pb-0` (Feature 3).
   - Pass `onToggleEquivalent={handleToggleEquivalent}` to `CoursesPage`.
   - Refactor mobile BottomNav from 6 cramped tabs to 5 well-spaced active tabs (`الخطة`, `الفصل`, `المواد`, `الجدول`, `المعدل`) with `>=44px` touch targets and `env(safe-area-inset-bottom)` safe-area padding (Feature 3).
3. `src/pages/CoursesPage.tsx`:
   - Add `GraduationCap` icon import and import `CoursePeekCard` (Feature 5).
   - Add `onToggleEquivalent` prop and destructure in component (Feature 8).
   - Set default `viewMode` to `"grouped"` with Years 3-5 and electives collapsed (`{ "year-3": true, "year-4": true, "year-5": true, "electives-remedial": true }`) for freshman onboarding (Feature 6).
   - Eradicate dead `selectedRoom` state, filter, and `useMemo` dependency (Feature 4).
   - Eradicate duplicate custom export dropdown and ad-hoc CSV/print handlers (Feature 4).
   - Add quick-clear (`X`) search reset button (Feature 4).
   - Add `seasonalFilter` state, dropdown, and filter logic (Feature 7).
   - Add `electiveBuckets` calculation and banner (Feature 7).
   - Add `totalEquivalentCredits` calculation and badge in header subtitle (Feature 8).
   - In `renderCourseRow`: wire peek card on hover/click, show `minCredits` badge, replace raw codes with readable prerequisite title chips, support `معادل 🎓` badge, show detailed locked explanation, and add Transfer Equivalence action button with `GraduationCap` icon (Features 5, 6, 7, 8).
   - Render floating `CoursePeekCard` portal at end of JSX (Feature 5).

## Critical Architectural Constraints
- Line count invariants from `tests/standardsAudit.test.ts`:
  - `src/App.tsx` MUST be >= 2300 lines.
  - `src/pages/CoursesPage.tsx` MUST be >= 2900 lines.
- Zero illusions from `scripts/audit-illusions.js`:
  - No dummy student IDs, no hardcoded major fallback names, no 50 JOD fees.
- Test flags:
  - Do NOT touch or remove `"gpaModalCourse"` or `"selectedCourseForTracking"`.

## Verification Commands
After implementing, you MUST run:
1. `node scripts/audit-illusions.js` (Must report 0 illusions).
2. `npx tsc --noEmit` (Must exit 0 with 0 errors).
3. `npm run build` (Must exit 0 cleanly).
4. `npm test` (All 371+ tests must pass with 0 failures).
5. `git diff --stat` (Must verify non-zero diff on all 3 target files).

## Handoff Report
Write full report to `c:\Users\mohammed\Desktop\planner\.agents\teamwork\worker_m1_remediation_2\handoff.md`.
Notify orchestrator via `send_message` with recipient `9a50c7da-f393-4ee4-8285-b46bc304e194`.
