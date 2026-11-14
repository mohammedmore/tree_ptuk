# First-Time Student Experience & Critical Flow Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate student onboarding barriers, fix broken major selection, resolve schedule search limitations, eliminate misleading error markers, and enable the live course registration page.

**Architecture:** 
1. Fix core data pipelines: populate standard majors in fallback and backend, clean corrupt cohort entries (`m.m.`), and remove artificial limits blocking course search.
2. Fix UI state logic: default unauthenticated students to a valid active major name, prevent elective dumping into Year 1 semesters on mobile, and replace misleading `✖` status icons with positive indicators.
3. Activate the complete course registration subsystem (`RegistrationPage.tsx`) in `App.tsx` and provide reassuring privacy notices on login.

**Tech Stack:** React 19, TypeScript, Node.js, Express, Playwright, Tailwind CSS v4, Zustand.

**Spec:** Student walkthrough audit report identifying 8 critical hurdles for first-time PTUK students.

## Global Constraints
- Preserve all existing 261 automated tests and PTUK academic integrity rules.
- Strictly adhere to PTUK credit limits and major definitions.
- Maintain responsive layout across smartphone (390px) and desktop viewports without horizontal scroll.
- Zero breaking changes to existing localStorage schema envelopes.

## Review Focus
1. Unauthenticated landing state must display a clear, valid major name instead of empty string or "تخصص الطالب".
2. Major selection modal must list valid accredited PTUK majors and allow smooth switching.
3. Mobile plan view must not aggregate all 35+ university electives into Semester 1 (cap at realistic semester credits).
4. Schedule generator course search must successfully query and return courses from the full 1,504-course university catalog.
5. Registration page must render full interactive functionality instead of the "قيد التطوير" placeholder.

---

### Task 1: Fix Major Selection Pipeline & Initial State
**Files:**
- Modify: `src/services/majorService.ts`
- Modify: `server/db.js`
- Modify: `data/db.json`
- Test: `tests/majors.test.ts` (or node test script)

**Steps:**
- [ ] Add standard PTUK majors (`cse-2023`, `cs-2023`, `swe-2023`, `ai-2024`) to `FALLBACK_MAJORS` in `src/services/majorService.ts`.
- [ ] Ensure `getActiveMajorId()` and `getActiveMajorName()` default gracefully to `"cse-2023"` and `"هندسة أنظمة الحاسوب"` when localStorage is empty.
- [ ] In `server/db.js`, remove the filter that was stripping out `cse`, `swe`, `cs`, `ee` from `getMajors()`, and clean up any `m.m.` corrupted cohorts.
- [ ] In `data/db.json`, add `cse-2023` to `db.majors` and purge `الذكاء-الاصطناعي_m.m.`.
- [ ] Verify that `GET /api/majors` returns valid majors and `MajorTransferModal` displays them with search.

---

### Task 2: Fix Full Course Catalog Search in `courseService.js` and Backend
**Files:**
- Modify: `src/services/courseService.js`
- Modify: `server/validators.js`
- Modify: `server/routes/courses.js`
- Test: Playwright search test (`scripts/test_modal_search.cjs`)

**Steps:**
- [ ] In `server/validators.js`, increase `limit` max to `2500` in `coursesQuerySchema`.
- [ ] In `src/services/courseService.js`, update `loadCourses()` to fetch all catalog courses (`/api/courses?limit=2000`).
- [ ] In `src/services/courseService.js`, update `searchCourses(query)` to query `/api/courses?search=${encodeURIComponent(query)}` when the local catalog doesn't find results, ensuring all 1,504 university courses are instantly searchable.
- [ ] In `src/components/modals/WeeklyScheduleModal.tsx`, fix the guide text that said "انقر على زر «+ إضافة مساق» أعلاه للبدء" so it accurately instructs the student to use the search field below.
- [ ] Verify searching for "فيزياء" (Physics) or "برمجة" (Programming) returns live course sections.

---

### Task 3: Fix Mobile View Electives Clustering (54 Hours in Sem 1)
**Files:**
- Modify: `src/pages/PlanPage.tsx`
- Test: `scripts/test_mobile.cjs`

**Steps:**
- [ ] In `src/pages/PlanPage.tsx` (`mobileSemestersData`), distinguish between mandatory core courses and elective pool courses.
- [ ] Do not dump all 35 general university electives into Semester 1 and 2. Slot only the representative elective or show the elective catalog in a dedicated clean section.
- [ ] Ensure Semester 1 shows realistic academic credits (15-18 credit hours) rather than 54 credit hours.
- [ ] Verify using Playwright mobile viewport snapshot.

---

### Task 4: Fix Confusing `متاحة ✖` and `متاح ✖` Status Badges
**Files:**
- Modify: `src/pages/CoursesPage.tsx`
- Modify: `src/components/planner/ListView.tsx`
- Modify: `src/components/planner/CourseNode.tsx`
- Modify: `src/components/planner/PlanMobileView.tsx`
- Test: `scripts/test_first_time_user.cjs`

**Steps:**
- [ ] In `CoursesPage.tsx`, replace `<X size={11} /> <span>متاحة ✖</span>` with positive styling: e.g. `<Circle size={9} className="text-emerald-500 fill-emerald-500/20" /> <span className="text-emerald-600 dark:text-emerald-400 font-bold">متاحة للتسجيل</span>`.
- [ ] In `CoursesPage.tsx`, replace `مقفلة ✖` with `مقفلة (تشترط متطلبات)`.
- [ ] In `ListView.tsx`, replace `statusText = "متاح ✖"` with `"متاح للتسجيل"` (emerald theme) and `"المتطلبات غير مكتملة"`.
- [ ] In `CourseNode.tsx` and `PlanMobileView.tsx`, remove the confusing `✖` mark from uncompleted but available courses.
- [ ] Verify that students clearly understand which courses are open for registration.

---

### Task 5: Activate Course Registration Page in `App.tsx`
**Files:**
- Modify: `src/App.tsx`
- Test: Playwright navigation to `#/registration`

**Steps:**
- [ ] Import `RegistrationPage` via `lazyWithRetry` in `src/App.tsx`.
- [ ] Replace the "تسجيل الفصل - قيد التطوير" lock screen at line 1920 with the actual `<RegistrationPage />` component, passing current courses, selectedSemester, and handlers.
- [ ] Verify that clicking "تسجيل الفصل" in header or mobile bottom nav loads the full Plan A/B/C course registration engine smoothly.

---

### Task 6: Privacy Reassurance on Login & Guest GPA Guidance
**Files:**
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/pages/GPAPage.tsx`
- Test: Playwright walkthrough

**Steps:**
- [ ] In `src/pages/LoginPage.tsx`, add an authentic, calming security notice:
  "🔒 بيانات الدخول مشفرة وتُعالج مباشرة وبأمان مع بوابة Edugate للجامعة دون حفظ كلمة المرور على أي خادم خارجي."
- [ ] In `src/pages/GPAPage.tsx`, convert the empty table message "سجّل الدخول بالرقم الجامعي" into an active button/link to `#/login`, and guide guest students on using "إضافة مادة للتوقع" to forecast grades without logging in.
- [ ] Run full test suite (`npm test`) and Playwright student journey verification.
