## 2026-11-14T05:29:40Z
You are Worker M1 on the PTUK Planner team.

Your working directory is:
c:\Users\mohammed\Desktop\planner\.agents\teamwork\worker_m1_round1

Authoritative user request file:
c:\Users\mohammed\Desktop\planner\.agents\teamwork\ORIGINAL_REQUEST.md
(MANDATORY: You MUST read ORIGINAL_REQUEST.md first before starting any work).

Project Scope Document:
c:\Users\mohammed\Desktop\planner\.agents\teamwork\orchestrator_2\PROJECT.md

Explorer 1 Handoff Report:
c:\Users\mohammed\Desktop\planner\.agents\teamwork\explorer_survey2_1\handoff.md

Domain Skill:
`c:\Users\mohammed\Desktop\planner\.agents\skills\vercel-react-best-practices\SKILL.md` (read and apply these best practices for React components and state).

Write ownership:
You exclusively own these files:
- `src/App.tsx` (Header & BottomNav sections)
- `src/pages/CoursesPage.tsx`
- `src/components/common/CoursePeekCard.tsx`
DO NOT touch any other files outside your write ownership.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Tasks for Milestone 1:
1. In `src/App.tsx`:
   - Remove dead disabled "تسجيل الفصل" button with lock icon from Header (`App.tsx:1385–1394`) and BottomNav (`App.tsx:2095, 2100–2116`), and remove the dead registration stub at `App.tsx:1920–1940`. Route `#registration` cleanly to the real `RegistrationPage` component so navigation is seamless.
   - Deduplicate Header actions: remove duplicate calendar trigger (`1631–1644`), duplicate student records trigger (`1606–1617`), and duplicate theme/contrast toggles (`1757–1785`).
   - Clean up mobile BottomNav from 6 cramped tabs to 5 well-spaced, accessible tabs with proper touch targets and iOS safe area padding (`env(safe-area-inset-bottom)`).
2. In `src/pages/CoursesPage.tsx`:
   - Remove dead `selectedRoom` state, setter, and filter references (lines 207, 858–863, 908).
   - Remove redundant custom export dropdown menu (lines 1777–1808, 706–771) which duplicates global `ExportModal.tsx`.
   - Wire up `CoursePeekCard.tsx` on hover or click for quick preview of course details.
   - Implement Freshman persona enhancements: default to grouped-by-year view with Years 3–4 collapsed; replace raw 8-digit prerequisite codes with interactive chips showing course titles; add clear prerequisite lock explanation badges indicating which specific course is needed.
   - Implement Graduating Senior persona enhancements: display elective bucket summaries (e.g. "Completed 1/2 electives"), add seasonal offering indicators (Fall/Spring/Summer), and display explicit `minCredits` thresholds for capstones.
   - Implement Transfer / Bridging Student persona enhancements: add UI action to mark course as transferred/equivalent (`معادلة مساقات`) with Pass/Fail (`-1`), display distinct `معادل 🎓` badge, and ensure transferred courses are accounted for properly.
   - Add a quick-clear (`X`) button to the search input.
3. Verification:
   - Run `npm run build` and ensure exit 0.
   - Run `npm test` and verify that all test suites pass with 0 regressions.
4. Deliverable:
   - Write a structured handoff report to `c:\Users\mohammed\Desktop\planner\.agents\teamwork\worker_m1_round1\handoff.md`.
   - Send a completion message back with the verification results.

## 2026-11-14T05:40:06Z
**Context**: Milestone 1 Implementation Status Check
**Content**: Checking in on your progress for Milestone 1 changes in `App.tsx` and `CoursesPage.tsx`. Please provide a status update and update your `progress.md` with current activity.
**Action**: Reply with your current progress and ETA.
