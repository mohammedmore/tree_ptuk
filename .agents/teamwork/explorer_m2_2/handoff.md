# Technical Investigation Report: Frontend Accessibility & WCAG 2.1 AA / Section 508 Standards Audit

**Explorer**: explorer_m2_2 (Accessibility & WCAG 2.1 AA Standards Explorer)  
**Date**: 2026-11-14  
**Scope**: `src/` (Components, Pages, Modals, Styling Tokens, Theme Management)  
**Applicable Standards**: WCAG 2.1 Level AA, WAI-ARIA 1.2, Section 508 Standards for Electronic and Information Technology  

---

## 1. Observation

Direct code examination of `src/` identified systematic accessibility architectural discrepancies between an isolated compliant modal standard (`src/components/common/BaseModal.tsx`) and the vast majority of the production UI.

### 1.1 Modal Dialogs & Keyboard Navigation Invariants (WCAG 2.1.1, 2.1.2, 2.4.3)

`src/components/common/BaseModal.tsx` defines an authoritative accessibility contract:
- Traps `Tab` / `Shift+Tab` focus cycles strictly inside the dialog container (`lines 52-99`).
- Captures the previously focused element prior to modal display and restores focus upon dismissal (`lines 32-48`).
- Sets initial focus automatically to the close button or modal container (`line 37`).
- Implements an `Escape` key listener (`lines 59-63`).
- Sets `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` / `aria-label` (`lines 110-115`).
- Implements stacking-aware modal tracking via `[data-base-modal]` (`lines 55-57`).

**Components implementing `BaseModal.tsx` (Only 4 files, 6 modal instances):**
1. `src/components/modals/WeeklyScheduleModal.tsx` (lines 38, 1496, 3538)
2. `src/components/modals/AddCourseModal.tsx` (lines 2, 83, 239)
3. `src/components/modals/SharedScheduleModals.tsx` (lines 4, 130, 296, 418) — Comparison, Conflict, and Share modals
4. `src/components/modals/SupportModal.tsx` (lines 4, 47, 243)

**Ad-hoc Modal Implementations Bypassing `BaseModal.tsx` (24 distinct instances):**
Every ad-hoc modal listed below fails WCAG 2.1.2 (Keyboard Trap) and WCAG 2.4.3 (Focus Order) by allowing the `Tab` key to leak focus out of the dialog into underlying background DOM elements, and fails WCAG 2.4.3 by failing to restore focus to the triggering element upon closure:

| # | Component / File | Line(s) | `role="dialog"` | `aria-modal` | Escape Listener | Tab Trap | Initial Focus | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | `src/components/modals/AcademicAdvisorModal.tsx` | 243-255 | Yes (outer) | Yes | Yes (231) | **NO** | **NO** | `role="dialog"` is placed on the outer backdrop div rather than the dialog panel. |
| 2 | `src/components/modals/AcademicCalendarModal.tsx` | 188-193 | **NO** | **NO** | **NO** | **NO** | **NO** | Missing dialog semantics completely; backdrop click does not dismiss. |
| 3 | `src/components/modals/CommandPaletteModal.tsx` | 487-496 | Yes | Yes | Yes (460) | **NO** | Partial (input) | ArrowUp/Down works, but `Tab` leaks to background elements. |
| 4 | `src/components/modals/CourseComparisonDrawer.tsx` | 267-277 | Yes | Yes | **NO** | **NO** | **NO** | Cannot be closed via Escape key; close button lacks `aria-label`. |
| 5 | `src/components/modals/DoctorScheduleModal.tsx` | 262-273 | Yes | Yes | Yes (250) | **NO** | **NO** | Focus leaks to background. |
| 6 | `src/components/modals/ExportModal.tsx` | 634-650 | Yes | Yes | **NO** | **NO** | **NO** | Stays rendered in DOM when closed (`opacity-0 pointer-events-none`); hardcoded `bg-white`. |
| 7 | `src/components/modals/MajorSelectorModal.tsx` | 105-116 | Yes | Yes | **NO** | **NO** | **NO** | No Escape key support; leaks Tab focus. |
| 8 | `src/components/modals/MajorTransferModal.tsx` | 198-205 | Yes | Yes | **NO** | **NO** | **NO** | Missing `aria-labelledby`/`aria-label`; backdrop click does not close. |
| 9 | `src/components/modals/ResetConfirmationModal.tsx` | 33-44 | Yes | Yes | **NO** | **NO** | **NO** | Destructive dialog! No Escape key; initial focus does not default to Cancel. |
| 10 | `src/components/modals/SectionSwapModal.tsx` | 96-106 | Yes | Yes | Yes (85) | **NO** | **NO** | Focus leaks to background. |
| 11 | `src/components/modals/StudentRecordsModal.tsx` | 142-151 | Yes | Yes | **NO** | **NO** | **NO** | Missing `aria-labelledby`/`aria-label`; backdrop click does not dismiss. |
| 12 | `src/components/modals/SystemHealthModal.tsx` | 233-244 | Yes | Yes | Yes (219) | **NO** | **NO** | Focus leaks to background. |
| 13 | `src/pages/CoursesPage.tsx` (`gpaModalCourse`) | 2464-2472 | Yes | Yes | **NO** | **NO** | **NO** | Missing `aria-labelledby`; close button lacks `aria-label`. |
| 14 | `src/pages/CoursesPage.tsx` (`selectedCourseForTracking`) | 2648-2656 | Yes | Yes | **NO** | **NO** | **NO** | Missing `aria-labelledby`; close button lacks `aria-label`. |
| 15 | `src/pages/GPAPage.tsx` (`isAddPickerOpen`) | 835-859 | Yes | Yes | **NO** | **NO** | **NO** | No Escape listener; focus leaks to background. |
| 16 | `src/pages/SemesterPlanningPage.tsx` (`showMobilePlannedSheet`) | 2597-2604 | **NO** | **NO** | **NO** | **NO** | **NO** | Mobile sheet completely lacks dialog semantics and Escape key. |
| 17 | `src/pages/SemesterPlanningPage.tsx` (`confirmClearOpen`) | 2814-2824 | `role="alertdialog"` | Yes | **NO** | **NO** | **NO** | Destructive clear semester; missing `aria-labelledby`; no Escape key. |
| 18 | `src/pages/RegistrationPage.tsx` (`showTestModal`) | 2645-2653 | Yes | Yes | **NO** | **NO** | **NO** | No Escape listener; close button lacks `aria-label`. |
| 19 | `src/pages/RegistrationPage.tsx` (`showCompareModal`) | 2874-2882 | Yes | Yes | **NO** | **NO** | **NO** | No Escape listener; close button lacks `aria-label`. |
| 20 | `src/pages/RegistrationPage.tsx` (`safeSwapCourseId`) | 3020-3028 | Yes | Yes | **NO** | **NO** | **NO** | No Escape listener; close button lacks `aria-label`. |
| 21 | `src/pages/RegistrationPage.tsx` (`showShareModal`) | 3087-3095 | Yes | Yes | **NO** | **NO** | **NO** | No Escape listener; close button lacks `aria-label`. |
| 22 | `src/pages/RegistrationPage.tsx` (`showSuggestModal`) | 3162-3170 | Yes | Yes | **NO** | **NO** | **NO** | No Escape listener; close button lacks `aria-label`. |
| 23 | `src/pages/RegistrationPage.tsx` (`isAddModalOpen`) | 3237-3245 | Yes | Yes | **NO** | **NO** | **NO** | No Escape listener; close button lacks `aria-label`. |
| 24 | `src/pages/RegistrationPage.tsx` (`showResetModal`) | 3531-3536 | **NO** | **NO** | **NO** | **NO** | **NO** | Missing dialog semantics completely; no Escape listener. |
| 25 | `src/pages/RegistrationPage.tsx` (`editingPlanTitle`) | 3643-3647 | **NO** | **NO** | **NO** | **NO** | **NO** | Missing dialog semantics completely; no Escape listener. |
| 26 | `src/pages/RegistrationPage.tsx` (`showLiveAuthModal`) | 3700-3705 | **NO** | **NO** | **NO** | **NO** | **NO** | Critical credentials modal; missing dialog semantics; no Escape. |
| 27 | `src/pages/WeeklySchedulePage.tsx` (`selectedEntryDetails`) | 1411-1421 | Yes | Yes | **NO** | **NO** | **NO** | No Escape listener; close button lacks `aria-label`. |
| 28 | `src/components/registration/SeatWatcherPanel.tsx` | 26-34 | Yes | Yes | **NO** | **NO** | **NO** | No Escape listener; close button lacks `aria-label`. |
| 29 | `src/components/registration/TuitionSummaryWidget.tsx` | 74-85 | Yes | Yes | **NO** | **NO** | **NO** | No Escape listener; close button lacks `aria-label`. |
| 30 | `src/components/planner/ScenarioSaveModal.tsx` | 22-29 | Yes | Yes | **NO** | **NO** | Partial (input) | Missing `aria-labelledby`/`aria-label`; no Escape key. |

---

### 1.2 Screen Reader Compatibility & ARIA Semantics (WCAG 1.3.1, 4.1.2, 4.1.3)

#### A. ARIA Live Regions (`aria-live`)
Across the entire frontend codebase (`src/`), ripgrep search revealed **only 3 occurrences** of `aria-live`:
1. `src/components/auth/LoginSyncExperience.tsx:171` (`aria-live="polite"`)
2. `src/components/common/UndoToast.tsx:38` (`aria-live="polite"`)
3. `src/pages/PlanPage.tsx:1942` (`aria-live="polite"`)

**Critical dynamic UI states with ZERO screen reader announcements:**
- **Live Seat Tracker Status (`src/components/registration/SeatWatcherPanel.tsx` & `src/pages/RegistrationPage.tsx:1595-1725`)**: When background or manual checks detect an open seat on a previously full course, no `aria-live` announcement occurs. Sighted users see an orange badge/icon pulse, while screen reader users receive zero notifications.
- **Registration Execution Outcome (`src/pages/RegistrationPage.tsx:2469-2578`)**: The post-execution report card (`executionSummary`) displaying registered courses, fallback activations, and failures renders as standard static divs without `role="region"`, `role="alert"`, or `aria-live="polite"`.
- **Global & Local Floating Toasts**:
  - `src/pages/RegistrationPage.tsx:1882`: `{toastMessage && (<div className="fixed bottom-20 ..."><span>{toastMessage}</span></div>)}` — missing `role="status"` and `aria-live="polite"`.
  - `src/App.tsx:2146`: `{appToastMessage && (<div className="fixed bottom-20 ..."><span>{appToastMessage}</span></div>)}` — missing `role="status"` and `aria-live="polite"`.
  - `src/pages/PlanPage.tsx:2146`: `{toastMessage && (<div className="fixed bottom-16 ..."><span>{toastMessage}</span></div>)}` — missing `role="status"` and `aria-live="polite"`.
- **GPA Calculation & What-If Projections (`src/pages/GPAPage.tsx:550-640`)**: Dynamic updates to predicted GPA upon altering target GPA or grade sliders have no status announcement.

#### B. Icon-Only Buttons Lacking `aria-label` (WCAG 4.1.2 Name, Role, Value)
Dozens of interactive `<button>` elements render only a Lucide icon without text or `aria-label`, or rely exclusively on the HTML `title` attribute (which is not announced by many screen readers, particularly on mobile touch interfaces):
- **Modal Close Buttons (`<X size={...} />`)**:
  - `src/pages/CoursesPage.tsx:2488` (`gpaModalCourse` close)
  - `src/pages/CoursesPage.tsx:2673` (`selectedCourseForTracking` close)
  - `src/components/modals/CourseComparisonDrawer.tsx:293`
  - `src/pages/RegistrationPage.tsx:2675` (Dry run modal)
  - `src/pages/RegistrationPage.tsx:2890` (Compare plans modal)
  - `src/pages/RegistrationPage.tsx:3036` (Safe swap modal)
  - `src/pages/RegistrationPage.tsx:3103` (Share modal)
  - `src/pages/RegistrationPage.tsx:3178` (Suggest electives modal)
  - `src/pages/RegistrationPage.tsx:3253` (Add course modal)
  - `src/pages/RegistrationPage.tsx:3543` (Reset plan modal)
  - `src/pages/RegistrationPage.tsx:3655` (Rename plan title modal)
  - `src/pages/RegistrationPage.tsx:3712` (Live auth credentials modal)
  - `src/components/registration/SeatWatcherPanel.tsx:48`
  - `src/components/registration/TuitionSummaryWidget.tsx:93`
  - `src/pages/WeeklySchedulePage.tsx:1431`
- **Table / List Action Buttons**:
  - `src/pages/RegistrationPage.tsx:1943` (`<Undo2 />`) & line `1952` (`<Redo2 />`): Sibling buttons rely only on `title` attribute, no `aria-label`.
  - `src/components/registration/PlanItemsTable.tsx:350`: `<button onClick={() => onAddWatchedSection(...)} title="مراقبة المقاعد..."><Radio size={15} /></button>` — lacks `aria-label`.
  - `src/components/registration/PlanItemsTable.tsx:362`: `<button onClick={() => onRemoveItem(...)} title="إزالة المساق من هذه الخطة"><Trash2 size={16} /></button>` — lacks `aria-label` specifying which course is being deleted.
  - `src/pages/GPAPage.tsx:1099`: `<button onClick={() => handleRemoveWhatIfCourse(c.id)} title="إزالة المادة من التوقع"><Trash2 size={14} /></button>` — lacks `aria-label`.
  - `src/pages/GPAPage.tsx:900`: `<button onClick={() => setSearchQuery("")}>✕</button>` — plain symbol `✕`, no `aria-label`.
  - `src/pages/CoursesPage.tsx:1279` (`<Calculator />`) & line `1294` (`<Bell />`): Rely solely on `title`.
  - `src/pages/SemesterPlanningPage.tsx:2765` (`<ChevronRight />`), line `2777` (`<ChevronLeft />`), and line `2791` (`<Trash2 />`): Touch buttons rely solely on `title`, lacking `aria-label` with course context.
- **Mobile Bottom Navigation Tabs (`src/App.tsx:2088-2142`)**:
  - `src/App.tsx:2119`: `<a href={`#/${item.route}`} ...>` applies conditional styling for `isActive`, but **never sets `aria-current="page"`**. Assistive technologies cannot determine which tab is currently selected.

---

### 1.3 Color Contrast Ratios (WCAG 1.4.3 Contrast Minimum 4.5:1 / 3:1)

#### Relative Luminance & Contrast Computations for Core Theme Tokens (`src/styles/tokens.css`)

Formula:
$$L = 0.2126 \cdot R_{lin} + 0.7152 \cdot G_{lin} + 0.0722 \cdot B_{lin}$$
$$\text{Contrast Ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$

1. **Theme: `light` (Default Palette)**:
   - Surface (`--surface` = `#fafaf7`): $L \approx 0.955$
   - Primary Text (`--text` = `#1f2421`): $L \approx 0.0166 \implies \mathbf{15.09:1}$ (Passes WCAG AAA)
   - Secondary Text (`--text-2` = `#3d443f`): $L \approx 0.0553 \implies \mathbf{9.54:1}$ (Passes WCAG AAA)
   - Tertiary Text (`--text-3` = `#5c635d`): $L \approx 0.119 \implies \mathbf{5.95:1}$ on `--surface` (Passes WCAG AA).
     *Caveat*: On sunken backgrounds (`--sunken` = `#e5e7e0`, $L \approx 0.784$), contrast drops to $\mathbf{4.93:1}$ (borderline).
   - Accent (`--accent` = `#3f5b2e`): $L \approx 0.0872 \implies \mathbf{7.33:1}$ on `--surface` (Passes WCAG AA).
   - Text on Accent (`--text-on-accent` = `#f7f8f3`, $L \approx 0.941$) on `--accent`: $\mathbf{7.22:1}$ (Passes WCAG AAA).

2. **Theme: `dark` (Midnight Palette)**:
   - Surface (`--surface` = `#2a312d`): $L \approx 0.0294$
   - Primary Text (`--text` = `#e9ece6`): $L \approx 0.825 \implies \mathbf{11.02:1}$ (Passes WCAG AAA)
   - Secondary Text (`--text-2` = `#bcc2ba`): $L \approx 0.528 \implies \mathbf{7.28:1}$ (Passes WCAG AAA)
   - Tertiary Text (`--text-3` = `#98a09a`): $L \approx 0.342 \implies \mathbf{4.94:1}$ (Passes WCAG AA)
   - Accent (`--accent` = `#a9c38b`): $L \approx 0.509 \implies \mathbf{7.04:1}$ (Passes WCAG AA)

3. **Theme: `oled` (OLED Pure Black with Emerald Accent)**:
   - Canvas / Surface (`--bg` = `#000000`, `--surface` = `#0a0a0a`, $L \approx 0.002$)
   - Primary Text (`--text` = `#ffffff`, $L = 1.0$) $\implies \mathbf{20.59:1}$ (Passes WCAG AAA)
   - Accent (`--accent` = `#10b981`, $L \approx 0.358$) on `#0a0a0a` $\implies \mathbf{7.85:1}$ (Passes WCAG AAA)

4. **Theme: `high-contrast` (Accessible High-Contrast)**:
   - Background (`#ffffff`, $L = 1.0$), Primary Text (`#000000`, $L = 0.0$) $\implies \mathbf{21.00:1}$ (Passes WCAG AAA)
   - Accent (`--accent` = `#0047ab`, $L \approx 0.0744$) on `#ffffff` $\implies \mathbf{8.44:1}$ (Passes WCAG AAA)

#### Hardcoded Tailwind CSS Utility Violations in UI Code
While CSS custom property design tokens pass in isolation, arbitrary Tailwind utility classes hardcoded into components create severe WCAG 1.4.3 violations:

| Utility Combination | Component & Line | Computed Luminances | Contrast Ratio | WCAG 2.1 AA Status | Severity |
|---|---|---|---|---|---|
| `text-slate-400` (`#94a3b8`) on `bg-white` (`#ffffff`) | `src/components/dashboard/StudentLoginGate.tsx:289, 313` | $L_1 = 1.0, L_2 = 0.359$ | **2.57:1** | **FAIL** (Min 4.5:1 required) | Critical |
| `text-slate-400` on light modal background | `src/components/modals/SupportModal.tsx:120, 153` | $L_1 = 0.955, L_2 = 0.359$ | **2.46:1** | **FAIL** (Min 4.5:1 required) | High |
| `text-gray-400` (`#9ca3af`) on `bg-gray-50` (`#f9fafb`) | `src/components/planner/ListView.tsx:445` | $L_1 = 0.965, L_2 = 0.380$ | **2.48:1** | **FAIL** (Min 4.5:1 required) | High |
| `text-emerald-500` (`#10b981`) on `bg-white` | `src/pages/GPAPage.tsx:514, 526, 602, 629` | $L_1 = 1.0, L_2 = 0.358$ | **2.57:1** | **FAIL** (Min 4.5:1 required) | Critical |
| `text-emerald-600` (`#059669`) on `bg-white` | `src/pages/CoursesPage.tsx:1448, 1600, 1671, 2134`, `src/pages/GPAPage.tsx:685, 786, 1142` | $L_1 = 1.0, L_2 = 0.229$ | **3.76:1** | **FAIL** (Min 4.5:1 required) | High (Requires `emerald-700` `#047857` at 5.14:1) |
| `text-amber-500` (`#f59e0b`) on `bg-white` | `src/pages/CoursesPage.tsx:2661` | $L_1 = 1.0, L_2 = 0.443$ | **2.13:1** | **FAIL** (Min 4.5:1 required) | Critical |
| `text-amber-600` (`#d97706`) on `bg-white` | `src/pages/CoursesPage.tsx:2629` | $L_1 = 1.0, L_2 = 0.287$ | **3.12:1** | **FAIL** (Min 4.5:1 required) | High |
| `--status-locked-text: #78716c` on `--bg-canvas: #faf8f5` (`warm-ivory`) | `src/styles/themes.css:44` | $L_1 = 0.950, L_2 = 0.183$ | **4.29:1** | **FAIL** (Min 4.5:1 required) | Medium |

---

### 1.4 Form Controls & Input Labeling (WCAG 3.3.2 Labels or Instructions)

#### A. Sibling `<label>` Elements Lacking `htmlFor` / `id` Association
Multiple form inputs render a visual `<label>` adjacent to an `<input>` or `<select>`, but omit both `htmlFor` on the label and `id` on the control. Screen readers announce these as unlabelled inputs:
- `src/pages/RegistrationPage.tsx:3665-3670`:
  ```tsx
  <label className="text-xs text-[var(--text-3)] font-semibold">
    اكتب اسماً مخصصاً للخطة:
  </label>
  <input
    type="text"
    value={tempPlanTitle}
    onChange={(e) => setTempPlanTitle(e.target.value)}
    ...
  />
  ```
  *(Missing `htmlFor` / `id`)*
- `src/pages/RegistrationPage.tsx:3735-3755`:
  - Student ID input: `<label ...>الرقم الجامعي:</label>` and `<input ... />` lack `htmlFor` and `id`.
  - Portal Password input: `<label ...>كلمة مرور بوابة Edugate:</label>` and `<input type="password" ... />` lack `htmlFor` and `id`.
- `src/components/registration/PlanItemsTable.tsx:241-256`:
  ```tsx
  <label className="text-[var(--text-3)] font-semibold">الشعبة:</label>
  <select value={item.section} ...>
  ```
  *(Repeated across all table rows; sibling label lacks `htmlFor`, select lacks `id` and lacks course-specific `aria-label`)*.
- `src/components/registration/PlanItemsTable.tsx:289-305`:
  - Reserve section fallback selector: Sibling `<label>الاحتياطية:</label>` and `<select>` lack `htmlFor` and `id`.
- `src/components/modals/StudentRecordsModal.tsx:414-417`:
  - Credit hours input: `<label>عدد الساعات المعتمدة للفصل:</label>` and `<input type="number">` lack `htmlFor` and `id`.
- `src/components/modals/StudentRecordsModal.tsx:436-443`:
  - Tuition rate selector: `<label>سعر الساعة المعتمد (دينار):</label>` and `<select>` lack `htmlFor` and `id`.

#### B. Inputs Relying Solely on Placeholder (No `<label>` or `aria-label`)
WCAG 3.3.2 explicitly dictates that placeholders are visual hints, not programmatic accessible names:
- `src/pages/CoursesPage.tsx:1816`: `<input type="text" placeholder="بحث بالمادة، الرمز، الدكتور، القاعة..." />`
- `src/pages/CoursesPage.tsx:1969`: `<input type="text" placeholder="ابحث باسم الدكتور (مثلاً: سامر سعيد)..." />`
- `src/pages/SemesterPlanningPage.tsx:1792`: `<input type="text" placeholder="ابحث باسم المادة أو رقم المساق..." />`
- `src/pages/RegistrationPage.tsx:3270`: `<input type="text" placeholder="ابحث باسم المساق أو رقمه..." />`
- `src/pages/GPAPage.tsx:890`: `<input type="text" placeholder="ابحث باسم المادة أو رقمها..." />`
- `src/components/modals/AcademicCalendarModal.tsx:312`: `<input type="text" placeholder="بحث في أنشطة ومواعيد الفصل..." />`
- `src/components/modals/MajorSelectorModal.tsx:148`: `<input type="text" placeholder="ابحث باسم التخصص، الكلية..." />`
- `src/components/modals/SectionSwapModal.tsx:146`: `<input type="text" placeholder="بحث برقم الشعبة، اسم المدرس..." />`

#### C. Unlabelled Sliders, Time Pickers, and Hidden Responsive Labels
- `src/pages/RegistrationPage.tsx:2351`: `<input type="time" ... title="وقت فتح بوابة التسجيل" />` — lacks `<label>` and `aria-label`.
- `src/pages/CoursesPage.tsx:2599`: `<input type="range" min="50" max="100" />` — custom grade impact slider has no `<label>` or `aria-label`.
- `src/components/modals/AcademicAdvisorModal.tsx:744`: `<input type="range" min="50" max="100" />` — expected grade slider has no `<label>` or `aria-label`.
- `src/components/modals/WeeklyScheduleModal.tsx:2761, 2858, 3008, 3439`: Schedule index `<input type="number">` has no `<label>` or `aria-label`.
- `src/pages/SemesterPlanningPage.tsx:1296`: `<label htmlFor="semester-select" className="... hidden lg:inline">الفصل:</label>`. Because `hidden` applies `display: none` below the `lg:` breakpoint (mobile and tablet viewports < 1024px), assistive technologies on mobile ignore the label completely. It must use `sr-only` instead of `hidden`.

---

## 2. Logic Chain

1. **Premise 1 (Keyboard Navigation & Focus Management)**:
   - WCAG 2.1.2 mandates that keyboard focus must not become trapped in background elements while a modal dialog is active.
   - WCAG 2.4.3 mandates that focus order must preserve meaning and operability, and focus must return to the triggering element upon dialog dismissal.
   - `src/components/common/BaseModal.tsx` provides compliant Tab trapping, initial focus, focus return, and Escape key dismissal.
   - 24 ad-hoc modals across `src/components/modals/`, `src/pages/`, and `src/components/` do not use `BaseModal.tsx`.
   - *Inference*: When a student navigates any of these 24 ad-hoc dialogs using keyboard `Tab`, focus escapes behind the semi-transparent scrim, interacting with unseen background elements, breaking WCAG 2.1.2 and 2.4.3. Furthermore, more than half of them cannot be dismissed via `Escape`, violating WCAG 2.1.1.

2. **Premise 2 (Screen Reader & Dynamic Content)**:
   - WCAG 4.1.3 requires status messages to be programmatically determinable through roles or live regions (`aria-live`) without requiring focus changes.
   - WCAG 4.1.2 requires every user interface component (including icon-only buttons) to have an accessible name.
   - Seat changes in `SeatWatcherPanel.tsx`, registration execution outcomes in `RegistrationPage.tsx`, and floating toast alerts render in the DOM without `aria-live="polite"` or `role="status"`.
   - Over 35 icon-only buttons (such as modal close `<X>`, table trash `<Trash2>`, navigation chevrons, and undo/redo controls) lack `aria-label`.
   - Bottom navigation links lack `aria-current="page"`.
   - *Inference*: A student using NVDA, VoiceOver, or Orca has no awareness of real-time seat availability changes, cannot ascertain whether course registration succeeded, and encounters unintelligible "unlabelled button" audio prompts throughout primary application workflows.

3. **Premise 3 (Color Contrast & Low Vision Accessibility)**:
   - WCAG 1.4.3 requires a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text and essential UI components.
   - The design tokens in `tokens.css` meet standard contrast ratios when paired according to specification.
   - However, application components bypass tokens and apply hardcoded Tailwind utilities: `text-slate-400` on white (2.57:1), `text-emerald-500` on white (2.57:1), `text-emerald-600` on white (3.76:1), and `text-amber-500` on white (2.13:1).
   - *Inference*: Students with low vision, contrast sensitivity loss, or viewing displays in outdoor sunlight cannot read critical status badges, input placeholders, and informational notices across the interface.

4. **Premise 4 (Form Labeling & Error Prevention)**:
   - WCAG 3.3.2 requires labels or instructions when content requires user input.
   - Programmatic association requires `<label htmlFor="id">` matching `<input id="id">` or explicit `aria-label` / `aria-labelledby`.
   - In `RegistrationPage.tsx`, `PlanItemsTable.tsx`, and `StudentRecordsModal.tsx`, `<label>` and `<input>`/`<select>` are rendered as disconnected sibling elements. In search bars, placeholders are used in lieu of labels. In `SemesterPlanningPage.tsx`, the semester label is hidden via CSS `display: none` on mobile.
   - *Inference*: Screen readers navigating form controls announce inputs as generic "Edit text" or "Combo box", leaving students unaware of required values (such as Edugate passwords or section selections).

---

## 3. Caveats

1. **Read-Only Scope**: In strict adherence to investigation constraints, zero source files were modified during this audit. All remediation recommendations are presented for subsequent engineering phases.
2. **Dynamic Live Systems**: Audit was conducted against offline local static code and mock infrastructure. Live websocket/SSE behaviors from PTUK servers were evaluated based on frontend event handlers.
3. **Automated Illusions Test Gap**: While `tests/personaValidation.test.ts` contains a theoretical assertion for `AccessibleModalContract` (lines 914-939), it tests an inline dummy object rather than validating real modal components. Existing automated tests pass despite 24 ad-hoc modals violating this contract.

---

## 4. Conclusion

The PTUK Academic Planner frontend possesses a high-quality accessibility primitive (`BaseModal.tsx`) and an accessible high-contrast theme (`high-contrast`), but **suffers from widespread implementation fragmentation**:

1. **Modal Fragmentation**: Only 4 out of 18 modal files use `BaseModal.tsx`. 24 ad-hoc modal dialogs fail WCAG 2.1.2, WCAG 2.4.3, and WCAG 2.1.1.
2. **Screen Reader Blind Spots**: Only 3 `aria-live` instances exist across the entire frontend. Real-time seat updates, registration execution outcomes, and system toasts are invisible to assistive technology.
3. **Contrast Deficits**: Key status indicators (`text-slate-400`, `text-emerald-500/600`, `text-amber-500/600` on white backgrounds) fail WCAG 1.4.3 with ratios as low as 2.13:1 – 3.76:1.
4. **Form Association Gaps**: Critical inputs (Edugate credentials, section dropdowns, search fields) lack `htmlFor`/`id` bindings or accessible names.

### Priority Action Plan for Implementation:

1. **Refactor Ad-hoc Modals to `BaseModal.tsx`**:
   - Wrap or migrate all 24 ad-hoc modal containers to `BaseModal.tsx`.
   - For destructive confirmations (`ResetConfirmationModal.tsx`, `confirmClearOpen`), implement `role="alertdialog"` and auto-focus the Cancel button.
2. **Implement Global Toast & Status Live Region**:
   - Refactor `toastMessage` in `RegistrationPage.tsx`, `SemesterPlanningPage.tsx`, `PlanPage.tsx`, and `App.tsx` to include `role="status"` and `aria-live="polite"`.
   - Add `aria-live="polite"` region to `SeatWatcherPanel.tsx` and `RegistrationPage.tsx` for real-time seat alerts.
   - Add `role="region"` and `aria-live="polite"` to `executionSummary` in `RegistrationPage.tsx`.
3. **Resolve Color Contrast Failures**:
   - Replace `text-emerald-600` on light backgrounds with `text-emerald-700` (`#047857`, 5.14:1) or `text-emerald-800`.
   - Replace `text-slate-400` on light backgrounds with `text-slate-600` (`#475569`, 7.01:1).
   - Replace `text-amber-500/600` on light backgrounds with `text-amber-800` (`#92400e`, 5.76:1).
4. **Fix Form Labeling & Add `aria-label` to Icon Buttons**:
   - Bind all sibling labels with `htmlFor` and unique `id`s (e.g. `id={`section-select-${item.courseId}`}`).
   - Add `sr-only` labels to search inputs in `CoursesPage.tsx`, `SemesterPlanningPage.tsx`, and `GPAPage.tsx`.
   - In `SemesterPlanningPage.tsx:1296`, replace `hidden lg:inline` with `sr-only lg:not-sr-only`.
   - Add `aria-label` to all icon-only buttons (`X`, `Trash2`, `Undo2`, `Redo2`, `Radio`, `ChevronRight/Left`).
   - Add `aria-current={isActive ? "page" : undefined}` to bottom navigation links in `App.tsx:2119`.

---

## 5. Verification Method

To independently reproduce, audit, and verify all findings documented in this report:

### Step 1: Automated Static Grep Verification
Run the following PowerShell commands from project root (`c:\Users\mohammed\Desktop\planner`):

1. **Modal Usage Comparison**:
   ```powershell
   # Modals using BaseModal:
   rg "BaseModal" src/

   # Ad-hoc fixed overlays lacking BaseModal:
   rg "fixed inset-0" src/
   ```

2. **Screen Reader Live Regions**:
   ```powershell
   rg "aria-live" src/
   ```

3. **Inputs Lacking Labels (Placeholders as sole description)**:
   ```powershell
   rg "<input" src/pages/ -A 3
   ```

### Step 2: Color Contrast Verification
Use the WCAG relative luminance formula or an automated tool like axe-core:
- Compute luminance of `text-slate-400` (`#94a3b8`) vs `bg-white` (`#ffffff`) $\implies 2.57:1$ (Fails WCAG 4.5:1).
- Compute luminance of `text-emerald-600` (`#059669`) vs `bg-white` (`#ffffff`) $\implies 3.76:1$ (Fails WCAG 4.5:1).

### Step 3: Runtime Keyboard Navigation & Screen Reader Verification
1. Launch local dev server: `npm run dev` (`http://localhost:5173`).
2. Open `CoursesPage` or `RegistrationPage`.
3. Open any ad-hoc modal (e.g., Click "فحص المواد والشعب" or "مراقبة المقاعد الشاغرة").
4. Press `Tab` repeatedly: observe focus leaving the dialog and highlighting buttons behind the scrim backdrop.
5. Press `Escape`: observe dialog failing to close.
6. Enable Windows Narrator (`Win + Ctrl + Enter`) or NVDA: observe icon-only buttons announced as "button" with no functional description.
