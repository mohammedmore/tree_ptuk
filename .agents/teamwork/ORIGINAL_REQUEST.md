# Original User Request

## Approved Task Prompt — 2026-11-14T05:14:09Z

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


## Approved Task Prompt — 2026-11-13T19:00:58Z (Active Run — Orchestrator b888a5de-c39e-41a3-8613-2c11312234bb)

Conduct comprehensive programmatic testing and verify code and files against international standards, followed by testing the application with a team of 10 students with diverse personas, goals, and data to identify missing features, redundant features, bugs, and UI/UX improvements.

Integrity mode: development

## Requirements

### R1. Programmatic Testing & Global Standards Verification
Implement and execute automated test suites (unit, integration, and/or end-to-end) and verify all codebase files against international engineering standards, using standard industry tooling and project configs (TypeScript checking, ESLint, test runner, and WCAG accessibility standards). All tests and verification must run strictly against local mock data and local environment without connecting to live external university services. Existing application source code must not be modified directly.

### R2. 10-Student Persona Multi-Angle Evaluation
Test and evaluate the application across a panel of 10 diverse student personas with varied academic goals, backgrounds, schedules, and datasets. Evaluate user journeys, feature utility, edge cases, and UI/UX usability across all major application flows for each persona.

### R3. Comprehensive Audit & Evaluation Report
Produce a structured, comprehensive evaluation report documenting:
- Missing features that students need.
- Redundant or useless features that add complexity without value.
- Discovered bugs, defects, and edge-case failures of any severity.
- UI/UX issues, usability barriers, and accessibility observations.
- Concrete recommendations for each identified issue.

## Acceptance Criteria

### Automated Testing & Standards Compliance
- [ ] Automated tests are implemented and pass cleanly against local mock data and local environment.
- [ ] Codebase files are verified against international engineering standards (linting, type checking, code quality).
- [ ] Existing application logic is left intact without unauthorized direct code modifications.

### 10-Student Persona Evaluation
- [ ] 10 distinct student personas are defined with diverse academic goals, schedules, and data profiles.
- [ ] User journeys and interactions are conducted and documented for each of the 10 personas.

### Evaluation Report
- [ ] A comprehensive evaluation report is delivered detailing missing features, useless/redundant features, all detected bugs, and UI/UX feedback with actionable recommendations.
