# Project: PTUK Academic Planner & Schedule Solver

## Architecture
- **Frontend**: Single-page application built with React 19, TypeScript 5.8, Vite 6, Tailwind CSS v4, Zustand 4.5, `@xyflow/react` 12.10, Lucide icons, Motion, and jsPDF.
  - 8 application routes (`plan`, `courses`, `schedule`, `gpa`, `semester-planning`, `registration`, `login`, `calendar`).
  - 7 core pages, 25 specialized modals, 4 accessible themes, bidirectional Arabic/English internationalization.
- **Backend**: Express 4.22 REST API server with Helmet security headers, rate limiters, Prometheus `/metrics`, and OpenAPI 3.0 documentation.
  - Hybrid storage architecture: SQLite (`better-sqlite3` in WAL mode) at `data/planner.sqlite`, atomic JSON backup (`data/db.json`), and optional Supabase PostgreSQL sync.
  - Scraper and registration engine: Playwright-based Edugate driver with local mock fallback (`demoMode`, `buildCohortCurriculumAndProgress`), SSE streaming, and circuit breaker.
- **Test Infrastructure**: Node.js native test runner (`node:test`) with `tsx` (`node --import tsx --test "tests/*.test.ts"`), academic fidelity illusions scanner (`scripts/audit-illusions.js`), and Playwright Chromium headless runner.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Automated Test Suite Execution | Execute 273 existing tests + automated test suites in 100% offline isolation against local mock data | M1 | Survey E1 |
| 2 | Isolated Local Mock Infrastructure Verification | Verify SQLite (`data/planner.sqlite`), JSON fixtures, and mock generators operate without external network calls | M1 | Survey E1 |
| 3 | Automated Flow & Policy Integration Tests | Test academic policy limits (19/10/14/21), remedial exclusions, and CSP solver edge cases | M1 | Survey E1 |
| 4 | Source Code Immutability Verification | Ensure existing application code remains intact without unauthorized direct modifications | M1 | Survey E1 |
| 5 | TypeScript Strictness & Type Safety Audit | Audit compiler config, `noUncheckedIndexedAccess`, 48+ explicit `any` usages, and ambient types | M2 | Survey E3 |
| 6 | Code Quality & Linting Compliance Audit | Audit ESLint ruleset, `npm run lint` configuration, monolithic component complexity, and duplication | M2 | Survey E3 |
| 7 | Accessibility (WCAG 2.1 AA) Standards Audit | Audit modal keyboard focus traps (20+ ad-hoc modals), contrast ratios, ARIA live regions, and labels | M2 | Survey E3 |
| 8 | Security & Data Protection (OWASP) Audit | Audit `localStorage` sensitive data exposure, synchronous `scryptSync`, dev secrets, and BOLA/SSRF | M2 | Survey E3 |
| 9 | Persona 1: Working Senior Evaluation | Evaluate Tariq Al-Najjar (Computer Systems Eng, afternoon shift, capstone + field training) | M3 | Survey E3 |
| 10 | Persona 2: Commuter Sophomore Evaluation | Evaluate Nour Zaidan (Civil Eng, rural commuter, 08:30-15:30 window, compact schedule) | M3 | Survey E3 |
| 11 | Persona 3: Academic Warning Evaluation | Evaluate Omar Abu-Saleh (Software Eng, GPA 57.8%, 14-credit limit, retake grade replacement) | M3 | Survey E3 |
| 12 | Persona 4: Honors Fast-Tracker Evaluation | Evaluate Maya Khoury (AI, GPA 89.4%, 21-credit overload, accelerated graduation) | M3 | Survey E3 |
| 13 | Persona 5: Screen Reader / Accessibility Evaluation | Evaluate Yazan Masri (Business, low vision/motor disability, keyboard navigation, high contrast) | M3 | Survey E3 |
| 14 | Persona 6: Transfer Student Evaluation | Evaluate Hiba Hamdan (CS, 33 accredited transfer hours, non-numeric grades, prerequisite mapping) | M3 | Survey E3 |
| 15 | Persona 7: Remedial Freshman Evaluation | Evaluate Ahmad Darwish (Mechatronics, Tawjihi placement, remedial Arabic, onboarding) | M3 | Survey E3 |
| 16 | Persona 8: Student Athlete Evaluation | Evaluate Layla Qasim (Applied Arts, sports training blocks, 4-hour studio courses) | M3 | Survey E3 |
| 17 | Persona 9: Dual-Track / Minor Evaluation | Evaluate Rami Odeh (Agricultural Eng + Business Minor, cross-campus transit buffers) | M3 | Survey E3 |
| 18 | Persona 10: Rural / Poor Connectivity Evaluation | Evaluate Salma Barghouthi (Vocational IT Diploma, 3G high latency, offline queue, brownout resilience) | M3 | Survey E3 |
| 19 | Missing Features Analysis | Enumerate and document all missing capabilities across student personas with rationale | M4 | Survey E2, E3 |
| 20 | Redundant Features Analysis | Identify and document useless/redundant features adding unnecessary complexity | M4 | Survey E2, E3 |
| 21 | Bug & Defect Documentation | Document all detected bugs and edge-case failures categorized by severity | M4 | Survey E1, E2, E3 |
| 22 | UI/UX & Usability Barriers Assessment | Document interface usability issues, mobile friction points, and accessibility barriers | M4 | Survey E2, E3 |
| 23 | Actionable Recommendations Delivery | Formulate concrete, prioritized technical and product recommendations for all findings | M4 | Survey E1, E2, E3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Programmatic Testing & Mock Verification | Automated test suites execution and verification against local mock data in total isolation | none | DONE (Restored baseline, 25/25 persona tests pass, 310 total pass, 0 illusions, CLEAN audit) |
| M2 | Global Standards Verification | Comprehensive audit against TypeScript, ESLint, WCAG 2.1 AA, and OWASP security standards | none | PLANNED |
| M3 | 10-Student Persona Multi-Angle Evaluation | Deep user journey, edge-case, and feature utility testing across 10 distinct student personas | M1 | PLANNED |
| M4 | Comprehensive Audit & Evaluation Report | Synthesis of missing features, redundant features, bugs, UI/UX, and actionable recommendations | M1, M2, M3 | PLANNED |

## Interface Contracts
### Evaluation Runner ↔ Application Backend/Frontend
- Port: `http://localhost:5173` (Frontend) & `http://localhost:3001` (Backend API).
- Isolation: `demoMode: true`, `password: "demo"`, or local mock endpoints; zero outbound network calls to `edugate.ptuk.edu.ps`.
- Test Framework: `node:test` + `tsx`, Playwright Chromium headless runner.
- Output artifacts: Test logs, standards compliance matrices, persona journey transcripts, and final audit report.

## Code Layout
- `src/`: React 19 Frontend application (pages, components, stores, core logic, services).
- `server/`: Express backend API, services, scrapers, data access layer.
- `data/`: Local SQLite database (`planner.sqlite`) and JSON fallback (`db.json`).
- `scripts/`: Operational scripts (`audit-illusions.js`, `devAll.js`, `autoSync.js`).
- `tests/`: Automated unit, integration, and security test suites.
- `.agents/teamwork/`: Agent metadata, handoffs, and working directories.
