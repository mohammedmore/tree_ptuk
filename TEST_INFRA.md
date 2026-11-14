# E2E Test Infra: PTUK Academic Planner & Schedule Solver

## Test Philosophy
- Opaque-box & transparent-box programmatic verification derived from user requirements and official PTUK academic bylaws.
- Strictly isolated: 100% local mock data and local environment execution; zero calls to live university systems.
- Existing application source code remains completely unmodified.

## Feature Inventory & Test Coverage
| # | Feature | Requirement Source | Tier 1 (Isolated Unit) | Tier 2 (Boundary & Policy) | Tier 3 (Cross-Flow Integration) | Tier 4 (Persona End-to-End) |
|---|---------|-------------------|:---------------------:|:--------------------------:|:-------------------------------:|:---------------------------:|
| 1 | Academic Policy & Warning Limits | ORIGINAL_REQUEST §R1 | ✓ | ✓ | ✓ | ✓ (Persona 3) |
| 2 | Remedial Course Non-Credit Exclusion | ORIGINAL_REQUEST §R1 | ✓ | ✓ | ✓ | ✓ (Persona 7) |
| 3 | CSP Schedule Solver & Conflict Resolution | ORIGINAL_REQUEST §R1, §R2 | ✓ | ✓ | ✓ | ✓ (Personas 1, 2, 8) |
| 4 | Plan A/B/C Registration & Cascading Fallback | ORIGINAL_REQUEST §R1, §R2 | ✓ | ✓ | ✓ | ✓ (Personas 4, 10) |
| 5 | Security Vault & Token Sanitization | ORIGINAL_REQUEST §R1 | ✓ | ✓ | ✓ | ✓ (Personas 5, 10) |
| 6 | SSRF Guard & Host Whitelisting | ORIGINAL_REQUEST §R1 | ✓ | ✓ | ✓ | ✓ |
| 7 | Academic Illusions Audit | ORIGINAL_REQUEST §R1 | ✓ | ✓ | ✓ | ✓ |
| 8 | 10 Diverse Student Personas Journeys | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ (All 10 Personas) |
| 9 | WCAG 2.1 AA Accessibility Standards | ORIGINAL_REQUEST §R1, §R3 | ✓ | ✓ | ✓ | ✓ (Persona 5) |
| 10 | Standards Compliance (TS/ESLint/OWASP) | ORIGINAL_REQUEST §R1, §R3 | ✓ | ✓ | ✓ | ✓ |

## Test Architecture
- **Runner**: Node.js test runner (`node --import tsx --test`) and automated headless Playwright Chromium scripts.
- **Data Fixtures**: `data/planner.sqlite`, `data/db.json`, `server/services/studentPortalService.js:buildCohortCurriculumAndProgress`, `server/services/registrationEngine.js:demoMode`.
- **Pass/Fail Semantics**: All test suites must exit with code 0; 0 errors, 0 integrity violations, 0 unhandled promise rejections.
