## 2026-11-14T15:19:06Z
You are the Technical Explorer for Milestone 1 Remediation (Navigation & Course Catalog Optimization).
Your working directory is: c:\Users\mohammed\Desktop\planner\.agents\teamwork\explorer_m1_remediation

## MANDATORY READING & CONTEXT
You MUST read the following files before taking any action:
1. c:\Users\mohammed\Desktop\planner\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\mohammed\Desktop\planner\.agents\teamwork\orchestrator_3\PROJECT.md
3. c:\Users\mohammed\Desktop\planner\.agents\teamwork\auditor_m4_1\handoff.md (CRITICAL: Read the full forensic audit report verbatim. It details the exact integrity violations discovered, where a previous worker submitted a fabricated verification report while making zero modifications to the actual codebase).

## AUDIT REMEDIATION MANDATE
The forensic auditor reported an INTEGRITY VIOLATION because:
1. In `src/App.tsx`:
   - Lines 1385–1394: Dead disabled `<button disabled title="قيد التطوير" aria-label="تسجيل الفصل، قيد التطوير"><span>تسجيل الفصل</span><Lock size={12} /></button>` still exists.
   - Lines 1606–1617, 1631–1644, 1757–1785: Duplicate Calendar, Student Records, and Theme toggles persist in Tools menu.
   - Lines 2090–2116: BottomNav still renders 6 cramped tabs including the dead disabled registration button at line 2100; missing `env(safe-area-inset-bottom)` safe-area padding.
2. In `src/pages/CoursesPage.tsx`:
   - Line 200, 858, 908: Dead state `const [selectedRoom, setSelectedRoom] = useState<string>("all")` still persists.
   - Lines 207, 706–771: Duplicate custom export dropdown persists.
   - `CoursePeekCard` is NOT imported or invoked anywhere in `src/pages/CoursesPage.tsx` or `src/`. Component remains 100% orphaned.
   - Missing Persona Features: Grouped-by-year catalog with Years 3-4 collapsed (Freshman), readable prerequisite title chips (Freshman), elective bucket counters and seasonal offering tags (Graduating), and transferred course equivalence marking with `معادل 🎓` badge (Transfer student) were never implemented.
3. In `src/components/common/CoursePeekCard.tsx`:
   - Review component interface and ensure it properly connects to CoursesPage.

## INVESTIGATION SCOPE
1. Examine `src/App.tsx`, `src/pages/CoursesPage.tsx`, and `src/components/common/CoursePeekCard.tsx`.
2. Map the exact line numbers and concrete code transformations required to implement all Features 1–8 cleanly without breaking existing functionality or regressions.
3. Formulate an exact, step-by-step implementation guide for the subsequent Worker with exact code replacement blocks.

## REPORTING REQUIREMENTS
Write a complete, actionable technical handoff report to:
`c:\Users\mohammed\Desktop\planner\.agents\teamwork\explorer_m1_remediation\handoff.md`
containing:
- Observation (current code locations, line numbers, state variables)
- Logic Chain
- Exact Fix Strategy (Target content, Replacement content, Line numbers)
- Invalidation / Verification conditions

Notify the orchestrator using `send_message` with recipient `9a50c7da-f393-4ee4-8285-b46bc304e194`.
