## 2026-11-14T08:32:13Z

Act as a full team inspecting the PTUK Planner web application from the perspective of diverse student personas with varied goals, academic standings, and datasets to identify missing key features, eliminate redundant elements, and implement comprehensive UI/UX and behavioral improvements across all screens.

Integrity mode: development

## Requirements

### R1. Multi-Persona Student Evaluation & Cognitive Load Audit
Inspect all primary application screens (Header, Bottom Navigation Bar, Courses Page, Schedule Solver, Registration, and GPA Calculator) from the perspective of six distinct student personas:
- Freshman / New Student (المستجد)
- Under Academic Probation (تحت الإنذار)
- Graduating Student (الخريج)
- High-Achieving / Honor Student (المتفوق)
- Commuter / Employed Student (المسافر/الموظف)
- Transfer / Bridging Student (المجسر)
Identify missing critical features, usability friction, cognitive overload, and student journey pain points across each screen.

### R2. Elimination of Redundant and Useless UI Elements
Remove unnecessary, dead, or confusing UI elements, redundant buttons, unneeded input fields, and superfluous visual clutter across the Header, Bottom Navigation Bar, Courses Page, Schedule Solver, Registration, and GPA Calculator without degrading existing core functionality.

### R3. Implementation of UI/UX and Behavioral Improvements
Implement comprehensive design and behavioral enhancements across all application screens directly in the codebase. Improve visual hierarchy, responsiveness, mobile ergonomics, clear feedback states (loading, empty, error), and streamline workflows tailored to the diverse student personas.

## Acceptance Criteria

### Persona Evaluation & Usability
- [ ] Evaluation findings for each of the 6 student personas (Freshman, Under Academic Probation, Graduating, High-Achieving, Commuter/Employed, Transfer/Bridging) are addressed across all target screens.
- [ ] Usability friction points, confusing layouts, and high cognitive load patterns identified during inspection are resolved.

### UI Cleanup & Decluttering
- [ ] Redundant buttons, dead UI controls, and unused input fields across Header, Bottom Bar, Courses Page, Schedule Solver, Registration, and GPA Calculator are removed.
- [ ] Core functional workflows remain fully operational after element removal.

### Implementation & Verification
- [ ] UI/UX design and behavioral improvements are directly applied to the codebase across the target screens (Header, Bottom Bar, Courses Page, Schedule Solver, Registration, and GPA Calculator).
- [ ] Project build completes cleanly without errors (`npm run build`).
- [ ] Existing automated test suites pass without regressions (`npm test`).

---
## Subagent Configuration & Continuity Context
- Identity: Project Orchestrator (teamwork_orchestrator)
- Working directory: c:\Users\mohammed\Desktop\planner\.agents\teamwork\orchestrator_3
- Authoritative user request file: c:\Users\mohammed\Desktop\planner\.agents\teamwork\ORIGINAL_REQUEST.md
- Workspace root: c:\Users\mohammed\Desktop\planner
- Project context: PTUK Planner (React 18, TypeScript, Tailwind CSS, Vite)
- Scope Document: c:\Users\mohammed\Desktop\planner\.agents\teamwork\orchestrator_3\PROJECT.md
- Existing Progress & Artifacts:
  1. Phase 0 Surveys already complete: see `.agents/teamwork/explorer_survey2_1/handoff.md`, `explorer_survey2_2/handoff.md`, `explorer_survey2_3/handoff.md`.
  2. Milestone 1 Implementation is ALREADY COMPLETE and verified in codebase:
     - Files modified: `src/App.tsx`, `src/pages/CoursesPage.tsx`, `src/components/common/CoursePeekCard.tsx`.
     - Read `.agents/teamwork/worker_m1_round1/handoff.md`.
     - Baseline tests (310/310 passed) and build (`npm run build` exit code 0).
  3. Immediate Next Focus:
     - Proceed directly to Milestone 2 (Schedule Solver Streamlining & Persona Adaptations in `src/pages/WeeklySchedulePage.tsx` and `src/components/modals/WeeklyScheduleModal.tsx`).
     - Then Milestone 3 (Registration & GPA Calculator Optimization in `src/pages/RegistrationPage.tsx` and `src/pages/GPAPage.tsx`).
     - Then Milestone 4 (Final End-to-End Verification).
  4. CRITICAL RESOURCE EFFICIENCY CONSTRAINT: To prevent rate limits (RESOURCE_EXHAUSTED 429), dispatch subagents focused and sequentially or in small batches of at most 1–2 concurrent subagents, rather than launching large swarms simultaneously.
