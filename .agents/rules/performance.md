# Performance Engineering Directives

This project enforces strict performance standards based on Vercel React Best Practices and Antigravity Customizations. Any code modifications must adhere to the following rules:

## 1. Zero-Regression Verification Gate (Mandatory)
After any code modification, always execute and confirm:
1. `npm run lint` (`tsc --noEmit`) - 0 errors.
2. `npm test` - All 53 unit/integration tests must pass with 0 failures.
3. `npm run build` - Production bundle must build cleanly with optimal chunk sizes.

## 2. Component Memoization & Stable References
- **`CourseNode` Equality (`areCourseNodePropsEqual`)**: NEVER compare dynamic callback functions (`toggleCompleted`, `focusNode`, etc.) in `areCourseNodePropsEqual`. Compare only visual and computational data props (`isCompleted`, `isAvailable`, `isDimmed`, `isHighlighted`, `isPinned`, `hasPlannedConflict`, etc.).
- **Node Immutability in State Updates**: When updating node highlights or paths in `App.tsx`, always return the unchanged node reference (`return n;`) if its visual state did not change. Do not shallow-clone unaffected nodes.
- **Heavy Views**: Components rendering large lists (e.g., `ListView`, `PlannerView`) must be wrapped in `React.memo`.

## 3. Dynamic Code Splitting & Lazy Loading
- Modals (`ExportModal`, `ResetConfirmationModal`, `SupportModal`, `PlanningModeModal`, `CourseListModal`, `GPAModal`, `WeeklyScheduleModal`, `SharedScheduleModals`) and non-default views (`ListView`, `PlannerView`) MUST be loaded dynamically via `React.lazy()` with `<React.Suspense>`.
- Heavy export engines (`jspdf`, `html2canvas`, `html-to-image`) and database SDKs (`@supabase`) must remain in dedicated manual chunks in `vite.config.ts`.

## 4. Algorithmic Complexity & Index Maps ($O(1)$)
- **Course Lookups**: Never scan the `courses` array linearly (`courses.find(...)`) in render paths or event handlers. Use `coursesById.get(id)`.
- **Course Dependents**: Never filter the catalog repeatedly (`courses.filter(c => c.prerequisites.includes(id))`). Use `courseDependentsMap.get(id) || []`.
- **Graph Paths**: Use `pathCache` in `getPathForCourse` to retrieve precomputed ancestor and descendant paths.
- **Co-requisite Availability**: Use `getAllCoursesMap()` for $O(1)$ catalog lookup in `isCourseAvailable`.

## 5. Memory Management & Garbage Collection
- **Static Dictionaries**: Hoist all static dictionaries, keyword arrays, and configuration maps to module scope. Never declare large string objects or lookup tables inside function or component bodies (e.g., `DESCRIPTIONS`, `DIFFICULTY_MAP`, `KEY_PREREQ_IDS` in `courseExplanations.ts`).
- **Deferred Computations**: Do not compute or allocate categorized arrays for closed modals (e.g., `groupedCourseList` must return `EMPTY_GROUPED_COURSES` when `isCourseListModalOpen` is false).

## 6. Rendering Performance & Resource Hints
- Use `content-visibility: auto` (`.cv-auto`) on long list card containers to allow the browser to skip layout and paint for offscreen elements.
- Maintain font preconnect links in `index.html` to eliminate render-blocking CSS `@import` waterfalls.
