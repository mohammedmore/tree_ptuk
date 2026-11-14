# Phase 0 Survey & Cognitive Load Audit: Registration Page & GPA Calculator

**Auditor / Explorer**: Explorer 3  
**Working Directory**: `c:\Users\mohammed\Desktop\planner\.agents\teamwork\explorer_survey2_3`  
**Milestone**: Phase 0 — Comprehensive UX, UI Clutter, and Persona Cognitive Load Audit  
**Target Screens**:
1. **Registration Page**: `src/pages/RegistrationPage.tsx` and child components (`src/components/registration/PlanItemsTable.tsx`, `PrewarmStatusCard.tsx`, `SeatWatcherPanel.tsx`, `TuitionSummaryWidget.tsx`, `src/core/semesterRegistration.ts`).
2. **GPA Calculator**: `src/pages/GPAPage.tsx` and core calculation engines (`src/core/courseProgress.ts`, `src/core/academicPolicy.ts`).

---

## 1. Observation

Direct code inspections, line references, and architectural findings:

### 1.1 Dead UI Controls & Unreachable Code (R2)

1. **Unreachable Modal: `showShareModal` & Share Code Token UI**
   - **File**: `src/pages/RegistrationPage.tsx`
   - **Line references**:
     - Lines 401–403: `const [showShareModal, setShowShareModal] = useState(false);`, `const [shareCodeCopied, setShareCodeCopied] = useState(false);`, `const [importCodeInput, setImportCodeInput] = useState("");`
     - Lines 1739–1766: Handler functions `handleExportShare` and `handleImportShareCode`
     - Lines 3086–3158: 73 lines of modal JSX rendering `{showShareModal && (<div ...>...<Share2 size={18} />...</div>)}`
   - **Verbatim Evidence**: A search across `src/pages/RegistrationPage.tsx` shows zero occurrences of `setShowShareModal(true)`. The dropdown menu button at line 2167 binds to `handleCopyShareLink()` which generates a direct URL (`generateShareablePlanUrl`), leaving `showShareModal` perpetually `false`. The entire 73-line modal DOM tree and associated helper state are completely unreachable dead code.

2. **Dead State & Orphaned Audio Synthesis Engine: `soundEnabled` & `playAudioChime`**
   - **File**: `src/pages/RegistrationPage.tsx`
   - **Line references**:
     - Line 351: `const [soundEnabled, setSoundEnabled] = useState(false);`
     - Lines 160–222: 63 lines implementing `getSharedAudioContext()` and `playAudioChime()` using Web Audio API oscillators and gain envelopes.
     - Lines 900, 906, 1461, 1468, 1479, 1492, 1500, 1639: Calls to `if (soundEnabled) playAudioChime(...)`.
   - **Verbatim Evidence**: `setSoundEnabled` is never invoked anywhere in the codebase. There is no UI switch, button, or checkbox for sound. `soundEnabled` remains permanently `false`, rendering lines 160–222 and all 8 conditional audio triggers dead.

3. **Orphaned State: `customSectionNumber`**
   - **File**: `src/pages/RegistrationPage.tsx`
   - **Line references**:
     - Line 389: `const [customSectionNumber, setCustomSectionNumber] = useState("1");`
     - Line 1300: `customSectionNumber.trim() || "1"`
   - **Verbatim Evidence**: `setCustomSectionNumber` is never called, and there is no input or control in the modal to edit this state.

4. **Unused Union Member: `"payload"` in Test Inspection Modal**
   - **File**: `src/pages/RegistrationPage.tsx`
   - **Line references**:
     - Lines 330–332: `const [activeTestTab, setActiveTestTab] = useState<"summary" | "items" | "payload">("summary");`
     - Lines 2686–2710: The navigation tabs in `showTestModal` only render buttons for `"summary"` and `"items"`.
   - **Verbatim Evidence**: Tab `"payload"` has no button and no conditional body renderer.

5. **Unused Dead Helper Function: `handleApplyToWeeklySchedule`**
   - **File**: `src/pages/RegistrationPage.tsx`
   - **Line references**:
     - Lines 1149–1181: 33 lines defining `const handleApplyToWeeklySchedule = () => { ... }`.
   - **Verbatim Evidence**: Grep confirms `handleApplyToWeeklySchedule` is never attached to any `onClick`, event, or hook in `RegistrationPage.tsx`. (The execution completion routine at lines 1504–1527 performs its own inline conversion instead).

### 1.2 Redundant UI Elements & Duplicate Controls (R2)

6. **Duplicate "مراقبة المقعد" (Seat Watch) Action in the Same Row**
   - **File**: `src/components/registration/PlanItemsTable.tsx`
   - **Line references**:
     - Lines 221–232: An inline button `<button onClick={() => onAddWatchedSection(item.courseId, item.section)}>...<Radio size={10} /><span>مراقبة المقعد</span></button>` inside the section saturation area when full.
     - Lines 350–359: An identical icon button in the action column of the same row: `<button onClick={() => onAddWatchedSection(item.courseId, item.section)}><Radio size={15} /></button>`.
   - **Verbatim Evidence**: When a section is closed, both buttons appear simultaneously within a 200px span in the exact same table row.

7. **Redundant "Safe Swap" Modal (`onOpenSafeSwap`) vs Native Section Dropdown**
   - **File**: `src/components/registration/PlanItemsTable.tsx` (Lines 337–347) and `src/pages/RegistrationPage.tsx` (Lines 345, 3019–3083)
   - **Verbatim Evidence**: The row already features a native `<select>` dropdown (lines 245–274) displaying all available sections, capacity saturation, and instructors. Changing the dropdown immediately calls `onUpdateSection(item.courseId, e.target.value)`. Right beside this dropdown is a button "تبديل" (`ArrowLeftRight`) opening a 65-line modal (`safeSwapCourseId`) which lists the exact same sections and executes `handlePerformSafeSwap(courseId, targetSection)`. This adds duplicate controls and modal friction for an operation already executable in 1 click.

8. **Overlapping Fallback Architecture: Per-Row `reserveSection` vs Multi-Plan Tabs (A, B, C)**
   - **File**: `src/components/registration/PlanItemsTable.tsx` (Lines 287–334) and `src/core/semesterRegistration.ts` (Lines 466–507)
   - **Verbatim Evidence**: Every course row in Plan A includes an inline dropdown `الاحتياطية: (بدون احتياط)`. At the same time, the page offers Plan B and Plan C with cascading fallback (`resolveCascadingFallback`). Students are confused whether they should configure their backup sections in the row dropdown or in Plan B/C. On mobile screens, this extra dropdown causes horizontal clipping.

9. **Duplicate Call-to-Action in Empty State and Action Bar**
   - **File**: `src/components/registration/PlanItemsTable.tsx` (Lines 77–95) and `src/pages/RegistrationPage.tsx` (Lines 2072–2100)
   - **Verbatim Evidence**: When a plan is empty, the top Action Bar displays "إضافة مادة" and "استيراد جدول الفصل". Directly below it, the empty placeholder card renders the exact same two buttons with slightly differing labels ("إضافة مادة", "استيراد جدولك الأسبوعي الحالي").

10. **Dual Floating Mini-Bar vs Header Balance in Tuition**
    - **File**: `src/components/registration/TuitionSummaryWidget.tsx` (Lines 46–70) and `src/pages/RegistrationPage.tsx` (Lines 1928–1939)
    - **Verbatim Evidence**: A fixed floating container (`fixed bottom-4 left-4 z-40 hidden sm:flex`) renders on desktop screens, displaying hours and JOD/ILS amounts with a "تعديل الرسوم" trigger. At the same time, the top page header already displays `<Wallet /> الرصيد: ...`, the action bar shows hours, and clicking the header opens the full calculator modal. The floating widget clutters the bottom-left viewport.

11. **Competing Grade Simulation Channels in GPAPage**
    - **File**: `src/pages/GPAPage.tsx` (Lines 1052–1085 vs Lines 1246–1271)
    - **Verbatim Evidence**: Table 2 ("مواد السجل الأكاديمي والدرجات المرصودة") renders editable `<input type="number">` fields for every historical course. Modifying a grade in Table 2 mutates `courseGrades` and changes the "المعدل التراكمي الفعلي (السجل الحالي)" card. Meanwhile, Table 1 ("المعدل المتوقع") provides a separate simulator mutating `whatIfGrades`. When a student resets Table 1, Table 2 remains modified, creating cognitive dissonance about whether Table 2 is an immutable official transcript or a scratchpad.

### 1.3 Persona-Specific Usability Friction & Cognitive Overload (R1 & R3)

12. **Under Academic Probation Persona (تحت الإنذار)**:
    - In `GPAPage.tsx`, the Target GPA Simulator (`calculateTargetGPAAnalysis`, lines 308–373) calculates the required average across **ALL remaining degree credits** (e.g., 90–120 hours). For a student under warning with 40 attempted hours and a 57.0% GPA, it displays: "المعدل المطلوب في الساعات المتبقية (124 س): 60.9% (متاح بسهولة)". This is mathematically deceptive and practically useless: probation students need to know the exact **Semester GPA required in their next 12 to 14 registered hours** to cross 60.00% and avoid dismissal.
    - In `RegistrationPage.tsx`, when `hasAcademicWarning` is true, the credit limit error fires if credits > 14, but there is zero proactive assistance prioritizing retake courses over new courses.

13. **High-Achieving / Honor Student Persona (المتفوق)**:
    - In PTUK regulations, semester excellence scholarships (منحة التفوق: 100% or 50% tuition waiver) require a minimum semester registration of **15 credit hours** in a regular semester, alongside a semester GPA >= 90% (full) or >= 85% (partial).
    - In `RegistrationPage.tsx`, an honor student planning 13 or 14 credit hours receives a green "Optimal" progress indicator without any warning that registering under 15 hours forfeits their scholarship eligibility!
    - In `GPAPage.tsx`, distinction tracking for graduation honors (مرتبة الشرف الأولى والثانية: requiring no course failures throughout the student's degree) is absent.

14. **Freshman / New Student Persona (المستجد)**:
    - First-year students encounter an empty state in `GPAPage.tsx` with no onboarding on how PTUK percentage grading works (passing course = 50%, passing cumulative = 60%, remedial English/Computer Skills = 0 credits / Pass-Fail).
    - In `RegistrationPage.tsx`, freshmen face extreme cognitive load from developer-oriented controls: raw ping latency in milliseconds, Prewarm statuses, portal credentials prompts, ICS calendar exports, dry-run payload inspections, and raw audit log feeds.

---

## 2. Logic Chain

The step-by-step reasoning linking observations directly to audit conclusions:

1. **Dead Code & Visual Baggage**:
   - Observations 1, 2, 3, 4, and 5 show that `showShareModal`, `soundEnabled`, `customSectionNumber`, the `"payload"` tab, and `handleApplyToWeeklySchedule` are unreferenced or permanently disabled.
   - Retaining unused modals and dead audio code wastes bundle size, increases maintenance debt, and confuses developers inspecting the UI tree.
   - *Conclusion*: Removing these 5 items eliminates over 170 lines of dead code without altering any user-facing feature.

2. **Interface Streamlining (Eliminating Redundancies)**:
   - Observation 6 demonstrates two identical "مراقبة المقعد" buttons in the same row when a section is full.
   - Observation 7 shows that the native section `<select>` dropdown and the "تبديل" modal execute the exact same state update (`handleUpdateSection`).
   - Observation 8 highlights that having both inline reserve dropdowns and multi-plan tabs (A, B, C) forces duplicate decision-making on the student.
   - Observation 10 demonstrates that the desktop floating tuition mini-bar duplicates the existing header wallet button and action bar statistics.
   - *Conclusion*: Consolidating section selection into the native dropdown, removing the duplicate radar button, dropping the redundant floating widget, and relying on Plans A/B/C for fallbacks drastically cleans up the layout and resolves mobile horizontal overflow.

3. **Academic Probation Needs Math That Matters**:
   - Observation 12 proves that the current Target GPA solver amortizes needed points across the remainder of the 4-year degree instead of solving for the immediate upcoming semester.
   - In PTUK policy, an academic warning is evaluated semester-by-semester; a student who fails to lift their cumulative GPA above 60% within 3 consecutive semesters is dismissed.
   - *Conclusion*: A dedicated "حاسبة النجاة من الإنذار" (Probation Recovery Solver) calculating the exact semester GPA needed across the student's planned 12–14 hours is an essential missing feature for this persona.

4. **Honor Students Risk Losing Scholarships**:
   - Observation 13 shows that `RegistrationPage.tsx` does not enforce or highlight the PTUK 15-credit minimum for semester excellence scholarships.
   - An honor student aiming for a 100% tuition waiver could easily register 14 hours and be disqualified.
   - *Conclusion*: Surfacing a "Scholarship Credit Alert" in Registration and adding distinction tracking (First/Second Class Honors) in GPA calculation bridges this critical gap.

5. **Freshmen Require Onboarding, Not Technical Diagnostics**:
   - Observation 14 shows that freshmen are dropped into raw system telemetry (ping, prewarm, dev logs) without guidance on PTUK's 100-point scale or standard first-semester packages.
   - *Conclusion*: Introducing a "First-Semester Bundle Loader" and an informational card on PTUK academic thresholds while tucking technical logs behind an "Advanced Settings" accordion will reduce cognitive friction for new students.

---

## 3. Caveats

1. **Read-Only Scope**: This audit does not modify source code directly. All recommendations are presented with exact line references and structural blueprints for the implementer agent.
2. **Backend Edugate Synchronization**: Live registration actions (`executeRegistration`, `checkPortalRegistrationStatus`) interact with the university portal. Recommendations to streamline the UI preserve the underlying live API hooks and fail-closed safety guards.
3. **Degree Types**: PTUK degrees include Diploma (72h), Bachelor (132h), and Engineering (164h). Credit limit rules (14h under warning, 21h overload) and capstone thresholds scale across these degrees as defined in `academicPolicy.ts`.

---

## 4. Conclusion & Actionable Recommendations

### 4.1 R2 Cleanup Checklist (Files, Components, Line Numbers)

| Item | File | Component / Section | Line Numbers | Action Required |
|---|---|---|---|---|
| **1. Dead Share Modal** | `src/pages/RegistrationPage.tsx` | `showShareModal`, `handleExportShare`, `handleImportShareCode` | Lines 401–403, 1739–1766, 3086–3158 | Remove dead modal JSX, unused handlers, and state. |
| **2. Dead Sound Synthesizer** | `src/pages/RegistrationPage.tsx` | `soundEnabled`, `playAudioChime`, `getSharedAudioContext` | Lines 351, 160–222, 900, 906, 1461, etc. | Remove dead audio synthesizer and orphaned state. |
| **3. Dead Custom Section State** | `src/pages/RegistrationPage.tsx` | `customSectionNumber` | Lines 389, 1300 | Clean up unused state. |
| **4. Dead Payload Tab** | `src/pages/RegistrationPage.tsx` | `activeTestTab` union type | Line 331 | Simplify type to `"summary" \| "items"`. |
| **5. Unused Function** | `src/pages/RegistrationPage.tsx` | `handleApplyToWeeklySchedule` | Lines 1149–1181 | Remove dead function. |
| **6. Duplicate Watch Button** | `src/components/registration/PlanItemsTable.tsx` | Row actions column | Lines 350–359 | Remove duplicate `<Radio />` button in action column; keep only the inline button when full. |
| **7. Redundant Safe Swap Modal** | `src/components/registration/PlanItemsTable.tsx` & `RegistrationPage.tsx` | `onOpenSafeSwap`, `safeSwapCourseId` | Table: 337–347; Page: 345, 3019–3083 | Remove separate modal; enhance section dropdown with inline time & instructor details. |
| **8. Dual Fallback Systems** | `src/components/registration/PlanItemsTable.tsx` | `reserveSection` dropdown | Lines 287–334 | Streamline row UI by relying on Plan A $\rightarrow$ B $\rightarrow$ C multi-plan architecture. |
| **9. Duplicate Empty State CTAs** | `src/components/registration/PlanItemsTable.tsx` | Empty state container | Lines 77–95 | Consolidate duplicate buttons between Action Bar and Empty Card. |
| **10. Dual Floating Mini-Bar** | `src/components/registration/TuitionSummaryWidget.tsx` | Fixed floating mini-bar | Lines 46–70 | Remove floating mini-bar; keep tuition accessible via top header Wallet button. |
| **11. Developer Clutter** | `src/pages/RegistrationPage.tsx` | Timeline Audit Log | Lines 2226–2237, 2606–2641 | Move technical dev log and ping diagnostics into an "الإعدادات المتقدمة" collapsible. |
| **12. Competing GPA Inputs** | `src/pages/GPAPage.tsx` | Table 2 editable inputs | Lines 1246–1271 | Make official transcript read-only by default; reserve What-If table for all simulations. |

### 4.2 R3 Behavioral & UI Enhancements by Persona

#### Persona A: Under Academic Probation (تحت الإنذار)
1. **Warning Recovery Milestone Calculator (حاسبة النجاة من الإنذار)**:
   - Add a dedicated single-semester recovery card in `GPAPage.tsx`:
     $$\text{Target Semester Points} = 60.00 \times (\text{Graded Credits} + \text{Planned Credits}) - \text{Current Total Points}$$
     $$\text{Required Semester GPA} = \frac{\text{Target Semester Points}}{\text{Planned Credits}}$$
   - Present direct advice: *"تحتاج إلى تحقيق معدل فصلي لا يقل عن **68.5%** في هذا الفصل (14 ساعة) للخروج من الإنذار ورفع معدلك التراكمي إلى 60.00%."*
2. **Retake Grade Replacement Optimizer**:
   - In PTUK, retaking a course replaces the old grade in the GPA numerator without increasing the attempted hours denominator.
   - Display a "خطة الخروج السريع" in `GPAPage.tsx` that highlights failed courses (علامة أقل من 50) and pre-populates them into What-If with a single click.
3. **Registration Probation Guard**:
   - Enforce the 14-hour limit in `RegistrationPage.tsx` with supportive advice: *"أنت تحت الإنذار: الحد الأقصى للتسجيل هو 14 ساعة معتمدة. ركز على إعادة المواد الراسبة ذات الساعات الأعلى لرفع معدلك بسرعة."*

#### Persona B: High-Achieving / Honor Student (المتفوق)
1. **Semester Scholarship Eligibility Tracker**:
   - In `RegistrationPage.tsx`, surface the PTUK rule requiring **>= 15 credit hours** for semester excellence scholarships.
   - If an honor student plans 12–14 hours, show a badge: *"تنبيه المنحة: سجّل 15 ساعة على الأقل لتكون مؤهلاً لإعفاء التفوق الأكاديمي (50% أو 100%)."*
2. **Distinction Tracking (مراتب الشرف عند التخرج)**:
   - In `GPAPage.tsx`, add tracking for:
     - First Class Honors (مرتبة الشرف الأولى): Cumulative GPA >= 90% without course failure.
     - Second Class Honors (مرتبة الشرف الثانية): Cumulative GPA >= 85% without course failure.
3. **Safety Margin Indicator**:
   - Compute: *"ما هو أقل معدل فصلي يحافظ على تفوقي فوق 85%؟"* (e.g., Margin of safety: +6.4%).

#### Persona C: Freshman / New Student (المستجد)
1. **PTUK Academic Grading Onboarding**:
   - Add an educational card explaining:
     - Percentage scale out of 100%.
     - Course pass: 50%.
     - Cumulative warning threshold: 60%.
     - Honors threshold: 85%.
     - Remedial courses: 0 credits, Pass/Fail, excluded from GPA.
2. **1-Click First-Semester Plan Loader**:
   - Add a button in `RegistrationPage.tsx` and `GPAPage.tsx`: *"تحميل الخطة الاسترشادية للفصل الأول"* to immediately load standard freshman courses (Calculus 1, English 1, Computer Skills, Physics 1, Arabic) without searching codes.
3. **Simplified Workflow**:
   - Hide raw ping times, fail-closed credentials warnings, and ICS exports behind an "Advanced / خيارات متقدمة" section.

---

## 5. Verification Method

To verify these findings and subsequent implementations independently:

1. **Source Code Verification**:
   - Confirm dead state and modal in `RegistrationPage.tsx`: grep for `setShowShareModal` (0 hits) and `setSoundEnabled` (0 hits).
   - Confirm duplicate watch buttons in `src/components/registration/PlanItemsTable.tsx` at line 221 and line 350.
   - Confirm `safeSwapCourseId` modal in `RegistrationPage.tsx` at line 3019 duplicates the section selector at `PlanItemsTable.tsx:245`.

2. **Build and Automated Test Verification**:
   - Execute production build:
     ```powershell
     npm run build
     ```
     *Current verified state*: Builds cleanly in 8.51s without errors.
   - Execute unit and integrity test suites:
     ```powershell
     npm test
     ```
     *Current verified state*: 310 tests pass, 0 fail, 0 academic illusions.

3. **Invalidation Conditions**:
   - If any button is found that opens `showShareModal`, observation 1 is invalidated.
   - If `soundEnabled` is toggled by user preference in any settings modal, observation 2 is invalidated.
   - If `handleApplyToWeeklySchedule` is imported or called in another module, observation 5 is invalidated.
