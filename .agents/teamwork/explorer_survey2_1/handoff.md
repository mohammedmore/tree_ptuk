# Phase 0 Survey & Cognitive Load Audit: Header, BottomNav, and Courses Page

**Target Screens**: Header (`src/App.tsx`), Mobile BottomNav (`src/App.tsx`), Courses Page (`src/pages/CoursesPage.tsx` and related subcomponents).  
**Personas Evaluated**: Freshman / New Student (المستجد), Graduating Student (الخريج), Transfer / Bridging Student (المجسر).  
**Requirements Addressed**: R1 (Multi-Persona Cognitive Load Audit), R2 (Elimination of Redundant & Useless UI Elements), R3 (Implementation of UI/UX & Behavioral Improvements).

---

## 1. Observation

### Architectural & File Structure Observations
1. **Monolithic Layout Architecture**:
   - `src/components/Header.tsx` does **not exist** in the repository. Instead, the entire top bar header is embedded directly inside `src/App.tsx` (lines 1329–1817).
   - `src/components/BottomNav.tsx` does **not exist** in the repository. Instead, the mobile fixed bottom navigation bar is embedded directly inside `src/App.tsx` (lines 2088–2142).
   - `src/pages/CoursesPage.tsx` is an immense 2,966-line single-file monolithic component holding table virtualizers, multiple modal managers, inline section drawers, swap analyzers, and state machines.
   - `src/components/common/CoursePeekCard.tsx` (65 lines) is an **orphaned component**. It is defined but imported nowhere in `src/pages/CoursesPage.tsx` or anywhere else across the entire application.
   - `src/components/common/CommandPalette.tsx` (190 lines) is a duplicate orphaned component; `src/components/modals/CommandPaletteModal.tsx` is the actual active modal rendered in `GlobalModalsContainer.tsx`.
   - Legacy 3-line re-export stubs exist in `src/components/` (`AddCourseModal.tsx`, `BaseModal.tsx`, `CourseNode.tsx`, etc.) that merely re-export from `src/components/modals/`.

---

### Direct Verbatim Code Findings (R2: Redundant & Dead UI Elements)

#### Finding O1. Dead "تسجيل الفصل" Desktop Tab & Mobile Bottom Nav Tab
- **File**: `src/App.tsx`
- **Lines 1385–1394 (Desktop Nav in `<header>`)**:
  ```tsx
  <button
    type="button"
    disabled
    title="قيد التطوير"
    aria-label="تسجيل الفصل، قيد التطوير"
    className="h-full flex items-center gap-1.5 border-b-2 border-transparent whitespace-nowrap shrink-0 px-0.5 text-[var(--text-3)] opacity-60 cursor-not-allowed"
  >
    <span>تسجيل الفصل</span>
    <Lock size={12} aria-hidden="true" />
  </button>
  ```
- **Lines 2095, 2100–2116 (Mobile `<nav>` Bottom Bar)**:
  ```tsx
  { route: "registration", label: "التسجيل", icon: Sparkles },
  ...
  if (item.route === "registration") {
    return (
      <button
        key={item.route}
        type="button"
        disabled
        title="قيد التطوير"
        aria-label="التسجيل، قيد التطوير"
        className="flex-1 h-full flex flex-col items-center justify-center py-1 rounded-xl text-[11px] text-[var(--text-3)] opacity-50 cursor-not-allowed"
      >
        <div className="p-1 flex items-center justify-center gap-1">
          <Icon size={17} strokeWidth={1.75} />
          <Lock size={10} aria-hidden="true" />
        </div>
        <span className="leading-tight mt-0.5">{item.label}</span>
      </button>
    );
  }
  ```
- **Lines 1920–1940 (Dead Route Stub in `App.tsx`)**:
  ```tsx
  {currentRoute === "registration" && (
    <section aria-labelledby="registration-coming-soon-title" className="...">
      <div className="w-full p-6 sm:p-8 text-center ...">
        <Lock size={24} aria-hidden="true" />
        <h1 id="registration-coming-soon-title">تسجيل الفصل</h1>
        <p>قيد التطوير</p>
      </div>
    </section>
  )}
  ```
  *Observation*: A fully implemented 158KB `src/pages/RegistrationPage.tsx` exists in the filesystem, yet `App.tsx` routes to an empty placeholder box while keeping a disabled, locked button in both Header and BottomNav. This permanently wastes prime screen real estate (1 out of 6 mobile tabs is a dead button) and confuses students.

---

#### Finding O2. Header Duplicate Academic Calendar Actions
- **File**: `src/App.tsx`
- **Lines 1449–1460 (Header Action)**:
  ```tsx
  <button
    type="button"
    onClick={() => setIsCalendarModalOpen(true)}
    className="flex items-center gap-1.5 h-8 px-2 sm:px-2.5 text-[12px] sm:text-[13px] font-medium text-indigo-700 ... bg-indigo-50/90 ..."
    title="التقويم الأكاديمي المعتمد ومواعيد الامتحانات والسحب والإضافة"
  >
    <Calendar size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
    <span className="whitespace-nowrap">التقويم الأكاديمي</span>
  </button>
  ```
- **Lines 1631–1644 (Header Tools ⋯ Menu Item)**:
  ```tsx
  <button
    type="button"
    onClick={() => {
      setIsToolsMenuOpen(false);
      setIsCalendarModalOpen(true);
    }}
    className="w-full h-8 px-3.5 text-right text-[13px] text-indigo-700 ..."
  >
    <span>التقويم الأكاديمي المعتمد</span>
    <Calendar size={15} className="text-indigo-600 dark:text-indigo-400" />
  </button>
  ```
  *Observation*: Exactly identical action rendered simultaneously in the top bar header and 200px away in the ⋯ dropdown menu.

---

#### Finding O3. Header Duplicate Student Records Action
- **File**: `src/App.tsx`
- **Lines 1476–1495 (Header Student Name Button)**:
  ```tsx
  <button
    type="button"
    onClick={() => setIsRecordsModalOpen(true)}
    className="font-medium text-[var(--text)] hover:text-[var(--accent)] hover:underline flex items-center gap-1.5 ..."
    title="عرض السجل الأكاديمي والمالي وكشف العلامات"
  >
    <GraduationCap size={15} className="text-[var(--accent)] shrink-0" />
    <span>{currentStudent.studentName || currentStudent.studentId}</span>
  </button>
  ```
- **Lines 1606–1617 (Header Tools ⋯ Menu Item)**:
  ```tsx
  <button
    type="button"
    onClick={() => {
      setIsToolsMenuOpen(false);
      setIsRecordsModalOpen(true);
    }}
    className="w-full h-8 px-3.5 text-right text-[13px] text-[var(--accent)] hover:bg-[var(--accent-soft)] ..."
  >
    <span>السجل المالي والأكاديمي</span>
    <GraduationCap size={15} />
  </button>
  ```
  *Observation*: The student's name in the header already functions as a button opening `StudentRecordsModal`. Re-listing it as the first option in the adjacent ⋯ menu creates redundant clutter.

---

#### Finding O4. Fragmented and Duplicate Export Controls Across Header & CoursesPage
- **File**: `src/App.tsx`
  - Lines 1463–1471: Quick Export button (`hidden 2xl:flex`) -> calls `setIsExportModalOpen(true)`.
  - Lines 1682–1693: Tools ⋯ menu item: "تصدير الخطة (PDF / صور)" -> calls `setIsExportModalOpen(true)` (`flex sm:hidden`).
  - Lines 1706–1716: Tools ⋯ menu item: "تصدير الخطة إلى CSV" -> calls `handleExportCsv`.
  - Lines 1733–1743: Tools ⋯ menu item: "طباعة الخطة الورقية (A4)" -> calls `window.print()`.
- **File**: `src/pages/CoursesPage.tsx`
  - Lines 1777–1808: Custom "تصدير" dropdown button with CSV download (`handleExportCSV`, lines 706–766) and PDF Print (`handlePrint`, lines 768–771).
  - Lines 706–766: Re-implements manual CSV serialization in string literals with BOM (`\uFEFF`), ignoring the centralized CSV utility `escapeCsvValue` in `src/core/csv.ts`.
  *Observation*: Exporting is scattered across 5 different triggers and 3 custom menus instead of a single, coherent export modal.

---

#### Finding O5. Phantom / Dead Filter State in CoursesPage (`selectedRoom`)
- **File**: `src/pages/CoursesPage.tsx`
- **Line 207**:
  ```tsx
  const [selectedRoom, setSelectedRoom] = useState<string>("all");
  ```
- **Lines 858–863**:
  ```tsx
  // Feature 6: Room filter
  if (selectedRoom !== "all") {
    const hasRoom = catCourse?.sections?.some(
      (s) => s.room?.trim() === selectedRoom,
    );
    if (!hasRoom) return false;
  }
  ```
- **Line 908**: `selectedRoom` in `useMemo` dependency array.
- *Grep search result*: `setSelectedRoom` is **never called anywhere in the entire codebase**. There is no dropdown, button, input, or UI element in the entire application to select a room. It is completely dead state and dead filtering overhead.

---

#### Finding O6. Redundant Major Selector in CoursesPage Top Bar
- **File**: `src/pages/CoursesPage.tsx`
- **Lines 1765–1774**:
  ```tsx
  {onSelectMajor && (
    <button
      type="button"
      onClick={onSelectMajor}
      className="min-h-[var(--control-h)] px-3 text-[13px] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--line-control)] rounded-[var(--r-control)] bg-[var(--surface)] hover:bg-[var(--sunken)] transition-colors cursor-pointer flex items-center gap-1.5"
    >
      <span>التخصص: {activeMajorName || (isCseMajor(activeMajorId) ? "هندسة أنظمة الحاسوب" : "تخصص الطالب")}</span>
      <ChevronDown size={14} className="text-[var(--text-3)]" />
    </button>
  )}
  ```
  *Observation*: Duplicates the top header's major selector (line 1627) and PlanPage major selector. In CoursesPage, students are browsing their degree catalog; having a major switcher button right beside the view switcher and search bar crowds the responsive flex header on medium viewports.

---

#### Finding O7. Missing Clear Button in CoursesPage Search Input
- **File**: `src/pages/CoursesPage.tsx`
- **Lines 1810–1823**:
  ```tsx
  <div className="relative">
    <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
    <input
      type="text"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="بحث بالمادة، الرمز، الدكتور، القاعة..."
      className="w-48 sm:w-64 h-[var(--control-h)] pr-9 pl-3 text-[13px] ..."
    />
  </div>
  ```
  *Observation*: The search bar does not provide a quick clear (`X`) button. In contrast, the doctor combobox search input (lines 1978–1985) has an `X` button. When students search on mobile devices, they must backspace manually.

---

### Persona-Specific Observations (R1)

#### Freshman / New Student (المستجد)
1. **The "Flat Table" Overload (line 180)**:
   - `const [viewMode, setViewMode] = useState<"flat" | "grouped">("flat");`
   - Default view mode is `"flat"`. The freshman is immediately greeted by a table of 60–80 courses.
   - 4th-year graduation projects ("مشروع التخرج 2", "التدريب الميداني", "أنظمة متقدمة") are displayed right next to 1st-year introductory courses.
   - The grouped-by-year view (`"grouped"`, lines 2184–2301) exists, but is not default, and does not automatically collapse upper-level years.
2. **Cryptic Prerequisite Numbers (lines 1213–1221)**:
   ```tsx
   {c.prerequisites && c.prerequisites.length > 0 ? (
     <span dir="ltr" className="tabular-nums">{c.prerequisites.join(", ")}</span>
   ) : ("—")}
   ```
   - Renders raw codes: `12200101, 12200102`.
   - A new student does not know what `12200101` means. There are no course title tooltips, no clickable links, and `CoursePeekCard.tsx` is completely unused.
3. **Ambiguous Lock Status (lines 1266–1271)**:
   ```tsx
   <span className="font-medium text-[var(--text-3)] text-[12px] flex items-center gap-1">
     <Lock size={11} className="text-slate-400" />
     <span>مقفلة (متطلب سابق)</span>
   </span>
   ```
   - Does not explain *which* prerequisite is missing.

---

#### Graduating Student (الخريج)
1. **Elective Course Calculation Flaw in "المتبقية" (lines 815–827)**:
   - If a senior needs 3 credits from an elective bucket containing 8 courses, all 8 courses are marked as remaining in `remainingCoursesSet` until the category is completely fulfilled.
   - The tab label displays `المتبقية (8)`, causing seniors to falsely believe they have 8 remaining courses (24 hours) rather than 1 course (3 hours).
2. **Missing Seasonal Filter (lines 1899–2097)**:
   - Badges for seasonal courses exist (`فصل أول فقط` / `فصل ثاني فقط`, line 1116), but there is **no seasonal filter** in the filter bar.
   - A graduating student cannot filter down to courses that are offered *only* in the current semester to avoid delaying graduation by a full year.
3. **Misleading Lock Reason on Capstone Courses (lines 1266–1271 vs `courseProgress.ts:191–197`)**:
   - Capstone courses (Graduation Project 1, Field Training) require minimum degree credit thresholds (`minCredits`: 100 or 120 credits).
   - When a senior has 92 credits and cannot yet take Graduation Project 1, `CoursesPage.tsx` displays: `مقفلة (متطلب سابق)` with a lock icon.
   - The senior looks at `c.prerequisites` (which is empty or satisfied) and concludes the system has a bug, because the lock message claims a course prerequisite is missing instead of stating: `تتطلب إنجاز 100 ساعة معتمدة (أنجزت 92 ساعة)`.

---

#### Transfer / Bridging Student (المجسر / المنتقل)
1. **Zero UI for Marking Transferred / Equivalent Courses (lines 1078–1091)**:
   - The only action is `onToggleComplete(c.id)`, which toggles a binary completed set.
   - Transferred courses at PTUK are granted credit hours towards graduation (`معادلة ساعات`), but receive a non-numeric grade (Pass / معادل) and must not be counted in the GPA calculation denominator.
   - While `courseProgress.ts:226` supports `-1` as Pass/Fail, `CoursesPage.tsx` provides no button, modal, or dropdown option to designate a course as "معادل بدون علامة".
2. **Missing Transferred Courses Status Indicator**:
   - Status column only shows `منجزة ✔`, `مخطط لها ⭕`, `متاحة`, `مقفلة`.
   - There is no `معادل 🎓` badge to visually indicate transferred credits from a diploma or prior institution.

---

## 2. Logic Chain

```
[Observation O1: "تسجيل الفصل" is disabled with Lock icon in Header:1385 and BottomNav:2100, and points to dead stub App.tsx:1920]
  │
  ├─► Logic Step 1: In a mobile web application with a 58px bottom bar, screen space is constrained to 360-390px.
  ├─► Logic Step 2: Displaying 6 tabs forces each item to ~55-60px, causing severe touch target congestion.
  └─► Inference 1: 1 of 6 tabs is completely dead, unclickable, and provides zero value to any student persona. Removing it immediately recovers 20% width per remaining tab and eliminates student confusion.

[Observation O2, O3, O4: Calendar, Records, and Export actions are duplicated across Header:1451,1478,1465, Tools Menu:1612,1639,1686,1708, and CoursesPage:1777]
  │
  ├─► Logic Step 3: Having multiple distinct buttons that trigger the exact same dialogs across 3 separate menus creates visual clutter and violates Hick's Law.
  └─► Inference 2: Consolidating these actions into a single global Tools menu and unified ExportModal eliminates 4 redundant buttons, reduces cognitive load, and cleans up the top bar.

[Observation O5: `selectedRoom` state at CoursesPage:207, filter at 858-863, dependency at 908 has no setter or UI control]
  │
  ├─► Logic Step 4: Ripgrep verification confirms `setSelectedRoom` is never called anywhere in `src/`.
  └─► Inference 3: `selectedRoom` is pure dead code that executes pointless array filtering on every render cycle. Removing it cleans up state and eliminates phantom logic.

[Observation O8 (Freshman): CoursesPage defaults to flat table with 60-80 courses and raw numeric prerequisites "12200101"]
  │
  ├─► Logic Step 5: A freshman does not possess mental mapping of 8-digit university course IDs or 4-year curriculum trees.
  ├─► Logic Step 6: `CoursePeekCard.tsx` already exists in `src/components/common/` with course title, credits, category, and prerequisites, but is completely unused.
  └─► Inference 4: Defaulting to `"grouped"` view (collapsing Years 3-4) and integrating `CoursePeekCard` on hover/tap of prerequisite chips transforms an incomprehensible numbers wall into an intuitive, guided roadmap.

[Observation O9 (Graduating Senior): Remaining elective courses explode remaining count, seasonal filter missing, minCredits lock labeled as prerequisite lock]
  │
  ├─► Logic Step 7: A senior requires strict certainty regarding remaining graduation obligations.
  ├─► Logic Step 8: Listing 8 elective courses when only 1 is needed creates false panic. Labeling a 100-credit capstone requirement as "متطلب سابق" leads students to believe the system has an error.
  └─► Inference 5: Adding category bucket summaries in the "المتبقية" tab, a dedicated seasonal filter, and distinguishing credit-threshold locks (`minCredits`) directly solves senior graduation audit anxiety.

[Observation O10 (Transfer/Bridging): No UI mechanism to mark courses as transferred (معادلة)]
  │
  ├─► Logic Step 9: Bridging students bring 30-60 credit hours that count towards graduation but must not enter the cumulative GPA calculation.
  ├─► Logic Step 10: `courseProgress.ts` already supports `-1` as Pass/Fail, but `CoursesPage.tsx` only offers `onToggleComplete`.
  └─► Inference 6: Adding a "تحديد كمساق معادل" action in CoursesPage and a `معادل` status badge allows bridging students to accurately track degree completion without corrupting GPA calculations.
```

---

## 3. Caveats

1. **Read-Only Scope**: This audit is strictly investigative. No production source code files were modified.
2. **Registration Backend Status**: A comprehensive 158KB `src/pages/RegistrationPage.tsx` exists in `src/pages/`, but the route in `App.tsx:1920` currently renders a placeholder stub. Whether registration should be enabled or hidden from the navigation bar pending backend readiness was evaluated solely from a UX/clutter perspective (it should not occupy a dead tab in the bottom bar).
3. **Data Model Constraints**: While `Course` types in `src/data.ts` support `prerequisites`, `coPrerequisites`, and `minCredits`, some department catalog JSON files might have incomplete `minCredits` annotations for elective capstones.
4. **No other screens in scope**: GPA Page and Schedule Solver were examined only insofar as they connect to the Header, BottomNav, and Courses Page.

---

## 4. Conclusion & Actionable Proposals

### 4.1 R2: Exact Inventory of Elements to Eliminate or Prune

| Element | File & Line Number | Component | Action | Rationale |
|---|---|---|---|---|
| **Dead "تسجيل الفصل" Desktop Tab** | `src/App.tsx:1385–1394` | Desktop `<nav>` in `<header>` | Remove button or replace with link to `RegistrationPage` if enabled | Dead UI control with `disabled` and lock icon taking up top bar space. |
| **Dead "التسجيل" Mobile Bottom Tab** | `src/App.tsx:2095, 2100–2116` | Mobile `<nav>` Bottom Bar | Remove item from array | Frees up 20% width for remaining 5 tabs; eliminates unclickable button. |
| **Dead Registration Stub** | `src/App.tsx:1920–1940` | `currentRoute === "registration"` | Connect to `RegistrationPage` or remove route | Dead coming-soon box disconnected from the real registration page. |
| **Duplicate Academic Calendar Action** | `src/App.tsx:1449–1460` | Header Trailing Bar | Remove top bar button (keep inside Tools ⋯ menu) | Consolidates header; removes identical duplicate button. |
| **Duplicate Student Records Action** | `src/App.tsx:1606–1617` | Tools ⋯ Dropdown Menu | Remove from dropdown | Student name pill in header (line 1476) already opens this modal. |
| **Quick Export Button on 2xl** | `src/App.tsx:1463–1471` | Header Trailing Bar | Remove from top bar (keep in Tools menu) | Reduces right-side top bar button count from 9 to 6. |
| **Fragmented Export Logic in CoursesPage** | `src/pages/CoursesPage.tsx:1777–1808, 706–771` | CoursesPage Header | Replace with trigger to global `ExportModal` | Eliminates duplicated CSV formatting and ad-hoc print code. |
| **Dead `selectedRoom` Filter & State** | `src/pages/CoursesPage.tsx:207, 858–863, 908` | `CoursesPage` Component | Remove state, filter condition, and dependency | Dead state and uncallable setter; no UI exists to select rooms. |
| **Redundant Major Switcher in CoursesPage** | `src/pages/CoursesPage.tsx:1765–1774` | CoursesPage Header | Remove button from CoursesPage header | Major switching belongs globally in the Header Tools menu or PlanPage. |
| **Orphaned Duplicate `CommandPalette.tsx`** | `src/components/common/CommandPalette.tsx` | Common Component | Delete or consolidate with `CommandPaletteModal.tsx` | 190 lines of unused duplicate modal code. |

---

### 4.2 R3: UI/UX & Behavioral Improvements by Persona

#### A. Freshman / New Student (المستجد)
1. **Default to Grouped View with Year 1 Spotlight**:
   - In `CoursesPage.tsx`, default `viewMode` to `"grouped"` (lines 179–184).
   - Expand Year 1 by default, and collapse Years 3 and 4 to prevent early-stage cognitive overload.
2. **Interactive Prerequisite Chips & Peek Card**:
   - Replace raw numbers (`c.prerequisites.join(", ")`, line 1216) with badge chips showing course title and code (e.g. `تفاضل وتكامل 1`).
   - Color code chips: Green (منجز), Amber (بانتظار الإنجاز).
   - Activate the orphaned `src/components/common/CoursePeekCard.tsx` on hover/click of any prerequisite chip.
3. **Specific Lock Reason Text**:
   - Replace generic `مقفلة (متطلب سابق)` (line 1269) with dynamic text: `مقفلة: بانتظار مساق [اسم المتطلب]`.
4. **Remedial Course Highlighting**:
   - Add a badge `مساق استدراكي (0 ساعات - لا يدخل في المعدل)` for courses matching `isRemedialCourse` to reassure freshmen.

#### B. Graduating Student (الخريج)
1. **Elective Requirement Bucket Aggregation**:
   - In the "المتبقية" tab (line 1869), add a header summary:  
     `متطلبات التخصص الإجبارية: منجزة بالكامل ✓ • الاختيارية: متبقي 3 ساعات (اختر مساقاً واحداً من الـ 8 المعروضة)`.
   - Prevent elective choices from inflating the remaining course count.
2. **Seasonal Course Filter**:
   - Add a filter toggle in the secondary filter row (line 1900): `مساقات موسمية فقط (فصل أول / فصل ثاني)`.
   - Add an urgent alert icon on remaining seasonal courses: `⚠️ مساق موسمي: لا يطرح إلا في الفصل الأول!`.
3. **Credit-Threshold Lock Clarification**:
   - When a course is locked due to `course.minCredits` (e.g. Graduation Project 1 requiring 100 credits), change the status label from `مقفلة (متطلب سابق)` to:  
     `مقفلة: تتطلب إنجاز 100 ساعة معتمدة (أنجزت ${completedCredits} ساعة)`.

#### C. Transfer / Bridging Student (المجسر / المنتقل)
1. **"تحديد كمساق معادل" Action**:
   - In `CoursesPage.tsx` row actions (line 1275), add a dropdown option: `تحديد كمساق معادل (ساعات بدون علامة)`.
   - Saves grade as `-1` (Pass/Fail) in `courseGrades`, ensuring degree credits are added to total completed hours while remaining excluded from cumulative GPA.
2. **Distinct `معادل 🎓` Status Pill**:
   - In the Status column (line 1224), display a purple pill `معادل 🎓` distinct from regular `منجزة ✔` courses.
3. **Bridging Credit Audit Summary**:
   - Display a transfer credit pill at the top of CoursesPage: `الساعات المعادلة: 36 ساعة • الساعات المطلوبة للتخرج: 128 ساعة`.

---

### 4.3 Mobile Ergonomics & Layout Architecture

1. **Extract Header & BottomNav into Dedicated Components**:
   - Refactor `src/App.tsx` by extracting lines 1329–1817 into `src/components/Header.tsx`.
   - Refactor `src/App.tsx` by extracting lines 2088–2142 into `src/components/BottomNav.tsx`.
2. **5-Tab Mobile Bottom Navigation with Safe Area Support**:
   - Reduce BottomNav items from 6 to 5 (`الخطة`, `الفصل`, `المواد`, `الجدول`, `المعدل`).
   - Add iOS safe area padding: `className="... pb-[env(safe-area-inset-bottom,0px)] h-[calc(58px+env(safe-area-inset-bottom,0px))]"` to eliminate overlap with the iOS home indicator bar.
   - Adjust `main` padding from `pb-14` to `pb-[calc(68px+env(safe-area-inset-bottom,0px))]` so table bottoms and toasts are never obscured.
3. **CoursesPage Search Clear Button & Empty State**:
   - Add an `X` clear button inside `searchQuery` input (line 1821).
   - Provide an informative empty state with a "Reset Filters" (إعادة ضبط الفلاتر) button when zero courses match search criteria.

---

## 5. Verification Method

### Independent Inspection Steps
1. **Header & BottomNav Code Inspection**:
   - Inspect `src/App.tsx` lines 1385–1394 and 2095–2116 to confirm the presence of the disabled "تسجيل الفصل" button with lock icon.
   - Inspect `src/App.tsx` lines 1451 vs 1639 to confirm duplicate "التقويم الأكاديمي" triggers.
   - Inspect `src/App.tsx` lines 1478 vs 1612 to confirm duplicate "السجل المالي والأكاديمي" triggers.
2. **CoursesPage Dead State & Duplicate Export Inspection**:
   - Inspect `src/pages/CoursesPage.tsx` line 207, lines 858–863, and line 908 to verify `selectedRoom` has no setter or UI control.
   - Inspect `src/pages/CoursesPage.tsx` lines 1777–1808 and lines 706–771 to verify custom export logic duplicating `src/components/modals/ExportModal.tsx`.
3. **Orphaned Component Inspection**:
   - Verify `src/components/common/CoursePeekCard.tsx` is unreferenced in any page using `grep_search`.
4. **Build & Automated Test Commands**:
   - Build test:
     ```powershell
     npm run build
     ```
   - Automated tests:
     ```powershell
     npm test
     ```
   - Invalidation conditions: Any claim of redundant elements is invalidated if removing the element breaks an existing user workflow or causes build/test regressions.
