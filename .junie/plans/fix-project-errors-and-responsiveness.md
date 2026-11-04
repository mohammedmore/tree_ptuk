---
sessionId: session-261021-233811-xcq0
---

# Requirements

### Overview & Goals

The academic planner is a single-page web application built with React, TypeScript, Vite, Tailwind CSS, and ReactFlow for Palestine Technical University - Kadoorie (PTUK) engineering students. The goal of this initiative is to eliminate all responsive layout bugs across phones (320px–480px), tablets (768px–1024px), laptops (1280px–1440px), and desktops, while fixing logical business errors in credit calculations, prerequisite/co-requisite validation, schedule solving, export rendering, and theme synchronization.

### Scope

- **In Scope**:
  - Fixing responsive layouts, navigation bars, headers, modals, timetable grids, and semester cards on mobile phones and laptops.
  - Correcting credit accounting (164 graduation credits vs 3 remedial English credits), GPA calculations, and category requirement validations.
  - Resolving prerequisite, co-requisite, and senior-standing logic across all views and planning modes.
  - Hardening the weekly schedule engine, Arabic day normalization, and adding offline/network fallback for the course service.
  - Fixing PDF/PNG export rendering issues related to CSS `color-mix()` and Arabic fonts.
  - Refactoring `ThemeStudio` to use consistent modal containers and fixing duplicate files.
  - Validating and updating automated test suites to ensure 100% test pass rate and clean build.
- **Out of Scope**:
  - Replacing the core styling engine or switching away from Tailwind CSS / ReactFlow.
  - Modifying Supabase schema definitions on remote production instances.

### User Stories

- **As a mobile phone user**, I want all modals, headers, and timetable grids to fit smoothly on my screen without overlapping text, broken buttons, or clipped content, so that I can manage my academic plan effortlessly on the go.
- **As a laptop user**, I want horizontal semester planning and multi-section schedule filtering to utilize screen width cleanly without unexpected vertical jumps or layout shifts.
- **As a student**, I want accurate credit accounting and prerequisite checking so that remedial courses do not distort my graduation progress and co-requisite courses can be planned in valid sequences.
- **As an offline/low-connectivity user**, I want the course catalog and schedule solver to work reliably with cached or fallback data when the backend server is unreachable.
- **As a graduating student**, I want to export my plan to high-resolution PNG or PDF without missing text or visual glitches.

### Functional Requirements

- **FR-1 (Responsive Navigation & Header)**: The top navigation bar must dynamically adapt across screen breakpoints: providing an accessible, scrollable or accordion-style action bar on mobile (<640px) with minimum 44px touch targets, and a streamlined layout on desktop.
- **FR-2 (Credit & Remedial Math)**: Total required graduation credits must stay locked at 164 credits. Remedial courses (e.g. `15200099` - 3 credits) must be tracked as prerequisite prerequisites without inflating graduation progress or GPA.
- **FR-3 (Prerequisite & Co-requisite Engine)**: Course availability checks must correctly validate co-requisites across completed courses, previous planned semesters (`allPrev`), and current semester selections.
- **FR-4 (Elective Planning Freedom)**: Students must be able to explore, select, and plan elective courses even when the minimum credits for an elective category have been met.
- **FR-5 (Weekly Schedule Solver & Arabic Days)**: The schedule solver and course service must normalize Arabic day identifiers (`سب`, `أح`, `اث`, `ثلا`, `ار`, `خمـ` vs `السبت`, `الأحد`, etc.) and handle offline/network error states with fallback catalog data.
- **FR-6 (Timetable Grid Responsiveness)**: The weekly timetable view in `WeeklyScheduleModal` must support horizontal scrolling (`overflow-x-auto min-w-[700px]`) and day-by-day tabs on mobile screens.
- **FR-7 (Export Stability)**: PNG and PDF export in `ExportModal` must render Arabic text and glassmorphism styles reliably without failing on `color-mix()` CSS variables.
- **FR-8 (Modal Standardization & Cleanup)**: All modal dialogs must use dynamic viewport heights (`100dvh`), proper focus handling, and accessible ARIA attributes. Duplicate files like `src/SupportModal.tsx` must be removed.

### Non-Functional Requirements

- **Performance**: Initial load time and modal transitions must remain smooth (<16ms frame budget), with zero layout shifts.
- **Compatibility**: Support modern mobile browsers (iOS Safari, Android Chrome) and desktop browsers (Chrome, Edge, Firefox, Safari).
- **Accessibility**: Compliance with WCAG 2.1 Level AA for touch target sizes (≥44x44px), color contrast, and keyboard navigation.

# Technical Design

### Current Implementation

The application is structured into the following core layers:

- **Presentation Layer**: `App.tsx` (main orchestrator with ReactFlow and ListView), `ListView.tsx`, and modal components in `src/components/` (`PlannerView.tsx`, `PlanningModeModal.tsx`, `CourseListModal.tsx`, `WeeklyScheduleModal.tsx`, `GPAModal.tsx`, `ExportModal.tsx`, `ThemeStudio.tsx`, `SupportModal.tsx`, `SharedScheduleModals.tsx`, `BaseModal.tsx`).
- **Domain Logic & Services**:
  - `data.ts`: Course definitions, credits, categories, and prerequisites.
  - `courseProgress.ts`, `courseOfferings.ts`, `courseExplanations.ts`: Business logic for course state, offerings, and prerequisite trees.
  - `scheduleSolver.js` & `courseService.js`: Backtracking schedule solver and catalog API integration.
  - `appStorage.ts`: LocalStorage persistence with versioned envelopes.
  - `themeManager.ts`: 14 predefined themes and custom token management.

### Key Decisions

- **Decision 1: Modular Credit Accounting**: Keep `TOTAL_CREDITS = 164` as the degree requirement. Remedial courses (`متطلب استدراكي إجباري`) will be counted towards prerequisite clearance and student workload, but will not deduct from or exceed the 164 degree completion total.
- **Decision 2: API Resilience with Local Fallback**: Update `courseService.js` to look for `import.meta.env.VITE_API_URL || 'http://localhost:3001/api/courses'`, and gracefully fall back to local catalog data if the server is offline or unreachable.
- **Decision 3: Standardized Viewport Modal Containers**: Standardize modal sizing on mobile to use `max-h-[calc(100dvh-1.5rem)]` with `overflow-y-auto` and safe area insets to prevent bottom navigation bar clipping on iOS and Android.
- **Decision 4: Mobile Timetable Grid Adaptation**: For `WeeklyScheduleModal.tsx`, provide a scrollable container with sticky time headers on desktop/laptops and a tabbed single-day selector mode on mobile viewports (<640px).

### Proposed Changes

#### 1. Business Logic & Credit Calculations

- In `data.ts` and `StatsDashboard.tsx`, adjust category progress counters so that remedial courses are displayed clearly as prerequisite requirements without distorting the 164-credit graduation progress bar.
- In `App.tsx` and `PlanningModeModal.tsx`, update `isCourseAvailable` to allow selecting electives when requirements are satisfied, and fix co-requisite checks to inspect `completed`, `allPrev`, and `currentPlannedCourses`.

#### 2. Weekly Schedule Engine & Service Layer

- In `src/services/courseService.js`, introduce environment-based API URLs and safe error handling that provides mock/cached course sections when the backend server is offline.
- In `src/services/scheduleSolver.js`, standardize Arabic day mapping so single-character, short-code, and full-name day strings match accurately.

#### 3. Responsive UI Enhancements

- In `App.tsx`, refactor the header action buttons into a flex-wrap container on desktop and an ergonomic 2-row / scrollable bar on mobile with clear icons and touch targets.
- In `PlannerView.tsx` and `PlanningModeModal.tsx`, add touch scroll indicators, wrap semester summary cards cleanly, and ensure dialog content does not clip.
- In `WeeklyScheduleModal.tsx`, wrap the grid in `overflow-x-auto min-w-[650px]` and add mobile-friendly day selection tabs.
- In `ThemeStudio.tsx`, replace raw `<dialog>` element styling with `BaseModal` or identical backdrop and glassmorphism styling to match all other dialogs.

#### 4. Export & File Cleanup

- In `ExportModal.tsx`, ensure `html-to-image` options include font embedding and fallback background colors before rendering to prevent canvas failure on mobile.
- Remove duplicate unused file `src/SupportModal.tsx` and clean up dead code.

### File Structure

- `src/App.tsx` (modified): Responsive header, mobile map details overlay, corrected availability logic.
- `src/components/BaseModal.tsx` (modified): Enhanced mobile viewport sizing (`100dvh`) and safe area handling.
- `src/components/WeeklyScheduleModal.tsx` (modified): Responsive timetable grid, mobile day view, error handling.
- `src/components/PlannerView.tsx` (modified): Responsive semester cards, drag/scroll usability.
- `src/components/PlanningModeModal.tsx` (modified): Responsive layout, co-requisite and elective checks.
- `src/components/GPAModal.tsx` (modified): Responsive table and What-If calculator on mobile.
- `src/components/ExportModal.tsx` (modified): Stable PNG/PDF export with Arabic font rendering.
- `src/components/ThemeStudio.tsx` (modified): Standardized modal container and mobile responsiveness.
- `src/components/StatsDashboard.tsx` (modified): Corrected 164-credit graduation math.
- `src/services/courseService.js` (modified): Configurable API URL and offline fallback.
- `src/services/scheduleSolver.js` (modified): Arabic day normalization and conflict resolution.
- `src/SupportModal.tsx` (deleted): Redundant duplicate file removed.

### Architecture Diagram

```mermaid
graph TD
    App[App.tsx Orchestrator] --> Header[Responsive Header & Action Bar]
    App --> MapView[ReactFlow Graph View]
    App --> ListView[ListView Table View]
    App --> Modals[Standardized Modals (BaseModal)]

    Modals --> PlannerModal[PlannerView & PlanningModeModal]
    Modals --> ScheduleModal[WeeklyScheduleModal]
    Modals --> GPAModal[GPAModal]
    Modals --> ExportModal[ExportModal PNG/PDF]
    Modals --> ThemeStudio[ThemeStudio]

    ScheduleModal --> CourseService[courseService.js / API Fallback]
    ScheduleModal --> ScheduleSolver[scheduleSolver.js Engine]

    App --> Storage[appStorage.ts LocalStorage]
    App --> Data[data.ts & courseProgress.ts]
```

### Risks & Mitigations

- **Risk**: `html-to-image` failing on mobile Safari due to SVG/CSS variable parsing.
  - _Mitigation_: Sanitize computed styles and provide explicit fallback background and text colors before rasterization.
- **Risk**: Breaking existing saved plans in `localStorage`.
  - _Mitigation_: Maintain strict backward compatibility in `appStorage.ts` with version checking and default fallback objects.

# Testing

### Validation Approach

Verification will be performed through automated unit tests (`npm test`), TypeScript static type checking, frontend build verification (`npm run build`), and comprehensive end-to-end component validation across mobile, tablet, and desktop viewports.

### Key Scenarios

- **Scenario 1 (Mobile Navigation & Layout)**:
  - Open application at viewport widths 320px, 375px, 414px, and 768px.
  - Verify all 8 header actions are legible, non-overlapping, and comfortably clickable with touch targets ≥ 44px.
- **Scenario 2 (Remedial & Graduation Credit Calculation)**:
  - Add remedial English (`15200099`) to completed courses.
  - Verify total degree completion shows required credits out of 164 without exceeding 100% or calculating negative remaining credits.
- **Scenario 3 (Prerequisite & Co-requisite Validation)**:
  - Plan a course requiring a co-requisite in the same semester or an earlier semester.
  - Verify the validation engine permits the sequence and displays helpful warnings only when prerequisite order is violated.
- **Scenario 4 (Weekly Schedule Solver & Offline Mode)**:
  - Run schedule generation with and without backend server availability.
  - Verify solver generates conflict-free schedules, respects excluded/pinned sections and day off filters, and normalizes all Arabic day codes.
- **Scenario 5 (Timetable View on Mobile & Laptop)**:
  - Open `WeeklyScheduleModal` on a narrow mobile viewport (<640px) and a standard laptop (1366x768).
  - Verify horizontal scrolling and day selection work smoothly without breaking cell dimensions.
- **Scenario 6 (Export to PNG and PDF)**:
  - Trigger PNG and PDF export with different active themes and custom colors.
  - Verify generated files contain crisp Arabic text and correct schedule details without blank canvases.

### Edge Cases

- Remedial courses with grades marked as Pass/Fail or `-1`.
- Semester with 0 planned courses vs maximum 21 credit overload.
- Browser `localStorage` disabled or full.
- Fast switching between custom themes and predefined presets.

### Test Changes

- Update and extend tests in `tests/` to validate:
  - Credit accounting for remedial vs graduation courses.
  - Schedule solver Arabic day key normalization.
  - Co-requisite validation across multi-semester plans.
  - Storage error handling and recovery.

# Delivery Steps

### * Step 1: Fix Core Business Logic, Credit Accounting, and Prerequisite Validation

Fix all core domain logic including remedial credit calculations, graduation credit totals, prerequisite and co-requisite validation, and elective course management.

- Update graduation credit accounting and stats calculations in `StatsDashboard.tsx`, `App.tsx`, and `data.ts` to cleanly distinguish between graduation-bearing credits (164 hrs) and remedial course completion (`15200099` - 3 hrs), preventing negative remaining credit calculations or GPA inflation.
- Enhance `isCourseAvailable` in `App.tsx` and `PlanningModeModal.tsx` to properly evaluate co-requisites satisfied across completed, previous planned semesters (`allPrev`), and current semester selections.
- Fix elective course availability rules so users can freely explore and swap elective options even when the minimum elective category credits have been met.
- Ensure senior standing credit thresholds (e.g. 60+ / 90+ credits for graduation project and field training) are evaluated correctly against cumulative planned and completed hours.
- Expand test coverage in `tests/courseProgress.test.ts` and add tests for prerequisite, co-requisite, and credit edge cases.

### Step 2: Fix Weekly Schedule Engine, API Resilience, and Offline Fallback

Make the weekly schedule solver and course data service resilient against network failures, Arabic day normalization mismatches, and offline environments.

- Update `src/services/courseService.js` to support configurable API endpoints via `import.meta.env.VITE_API_URL` with a graceful fallback to local/cached catalog data when `Server.js` is unreachable.
- Standardize Arabic day key normalization in `scheduleSolver.js` and `ptukScraper.js` to ensure matching between scraped single-letter days, short names (`سب`, `أح`, `اث`, `ثلا`, `ار`, `خمـ`), and full names (`السبت`, `الأحد`, etc.).
- Fix time overlap conflict detection in `scheduleSolver.js` to handle non-contiguous blocks and multiple sections per course seamlessly.
- Improve error boundaries and loading/error states in `WeeklyScheduleModal.tsx` so users receive clear recovery options if backend synchronization fails.

### Step 3: Fix Responsive Layouts and Mobile / Laptop Viewport Usability

Ensure flawless responsive design, touch interactions, and layout integrity across mobile phones (320px-480px), tablets, and laptops (1024px-1440px).

- Redesign the top navigation header in `App.tsx` and `ListView.tsx` to replace cramped 3-column grids on mobile with a responsive scrolling/collapsible action bar and 44px touch targets.
- Refactor `WeeklyScheduleModal.tsx` timetable view with responsive horizontal scroll wrappers (`min-w-[700px]`), day-view tabs for narrow screens, and accessible filter trays on laptops and phones.
- Improve horizontal scrolling, card snapping, and touch drag indicators in `PlannerView.tsx` across 15 semester columns on mobile and touch-enabled laptops.
- Standardize all custom modals (`CourseListModal.tsx`, `PlanningModeModal.tsx`, `DynamicCourseDetailsModal.tsx`, `ExportModal.tsx`) to use dynamic viewport heights (`100dvh`), avoiding double scrollbars and bottom bar clipping on mobile browsers.
- Ensure the floating course detail panel in map view (`App.tsx`) does not block tapped nodes on small mobile screens and includes an explicit touch-friendly close button.

### Step 4: Fix Export Rendering, Theme Synchronization, and Storage Integrity

Stabilize PDF/PNG plan export rendering, unify ThemeStudio modal behavior, and protect local storage data integrity.

- Update `ExportModal.tsx` to handle CSS variables (`color-mix`), font loading, and RTL Arabic text rendering safely when exporting to PNG (`html-to-image`) and PDF (`jspdf`) across mobile and desktop browsers.
- Refactor `ThemeStudio.tsx` to align its modal container, glassmorphism styling, and backdrop behavior with the application's standard modal system (`BaseModal`), ensuring consistent dark mode and mobile responsiveness.
- Eliminate unused duplicate files (`src/SupportModal.tsx`) and ensure clean imports across all components.
- Enhance `appStorage.ts` storage migration and serialization to prevent data loss on browser storage errors, providing backup download prompts when corrupted state is detected.
- Run complete test suite (`npm test`) and frontend production build (`npm run build`) to verify zero errors and clean build output.
