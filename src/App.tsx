import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  Sun,
  Moon,
  Laptop,
  MoreHorizontal,
  X,
  Share2,
  Download,
  RotateCcw,
  LogOut,
  Check,
  MessageCircle,
  GraduationCap,
  Lock,
  ChevronDown,
  Upload,
  Sparkles,
  FileSpreadsheet,
  Plus,
  Zap,
  BookOpen,
  Calendar,
  Clock,
  Search,
  Sliders,
  Printer,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAppRoute } from "./router";
import { themeManager } from "./themeManager";
import { OfflineBanner, UndoToast } from "./components/common";
import { triggerHaptic } from "./utils/haptics";
import { SEMESTERS, TOTAL_CREDITS } from "./constants";
import {
  parseSemesterWeight,
  resolveAcademicSemester,
  determineUpcomingSemester,
  autoPopulateUpcomingSemester,
} from "./utils/semesterUtils";
import {
  Course,
  ScheduleEntry,
  courses as defaultCourses,
  categoryRequirements as defaultCategoryRequirements,
} from "./data";
import {
  fetchMajorPlan,
  getActiveMajorId,
  getActiveMajorName,
  setActiveMajorId,
  clearActiveMajor,
  FALLBACK_MAJORS,
} from "./services/majorService";
import {
  fetchSyncStatus,
  formatArabicSyncTime,
  SyncStatus,
} from "./services/syncService";
import {
  StudentSyncProfile,
  getCachedStudentProfile,
  clearStudentProfile,
} from "./services/studentService";
import {
  shareScheduleToCloud,
  fetchScheduleByCode,
  normalizeScheduleCode,
  SharedScheduleSnapshot,
} from "./core/sharedSchedules";
import {
  readAppStorageValue,
  serializeAppStorageValue,
  writeAppStorageValue,
} from "./appStorage";
import { parseCsvRows, CSV_HEADERS, escapeCsvValue } from "./core/csv";
import {
  calculateDegreeCredits,
  calculateCategoryCredits,
} from "./core/courseProgress";
import { lazyWithRetry } from "./utils/lazyWithRetry";

// Lazy-loaded Pages (with resilient retry on transient Vite HMR/network drops)
const PlanPage = lazyWithRetry(() => import("./pages/PlanPage"));
const CoursesPage = lazyWithRetry(() => import("./pages/CoursesPage"));
const WeeklySchedulePage = lazyWithRetry(
  () => import("./pages/WeeklySchedulePage"),
);
const GPAPage = lazyWithRetry(() => import("./pages/GPAPage"));
const SemesterPlanningPage = lazyWithRetry(
  () => import("./pages/SemesterPlanningPage"),
);
const LoginPage = lazyWithRetry(() => import("./pages/LoginPage"));

// Lazy-loaded Modals
const ResetConfirmationModal = lazyWithRetry(() =>
  import("./components/modals/ResetConfirmationModal").then((m) => ({
    default: m.ResetConfirmationModal,
  })),
);
const MajorSelectorModal = lazyWithRetry(() =>
  import("./components/modals/MajorSelectorModal").then((m) => ({
    default: m.MajorSelectorModal,
  })),
);
const SupportModal = lazyWithRetry(
  () => import("./components/modals/SupportModal"),
);
const ExportModal = lazyWithRetry(
  () => import("./components/modals/ExportModal"),
);
const WeeklyScheduleModal = lazyWithRetry(() =>
  import("./components/modals/WeeklyScheduleModal").then((m) => ({
    default: m.WeeklyScheduleModal,
  })),
);
const AddCourseModal = lazyWithRetry(() =>
  import("./components/modals/AddCourseModal").then((m) => ({
    default: m.AddCourseModal,
  })),
);
const StudentRecordsModal = lazyWithRetry(() =>
  import("./components/modals/StudentRecordsModal").then((m) => ({
    default: m.StudentRecordsModal,
  })),
);
const AcademicCalendarModal = lazyWithRetry(() =>
  import("./components/modals/AcademicCalendarModal").then((m) => ({
    default: m.AcademicCalendarModal,
  })),
);
import {
  ShareScheduleModal,
  LoadScheduleModal,
  SharedSchedulePreviewModal,
} from "./components/modals/SharedScheduleModals";
import {
  CommandPaletteModal,
  CourseComparisonDrawer,
} from "./components/modals";
import { AcademicAuditPrint } from "./components/planner/AcademicAuditPrint";
import { SyncStatusPill } from "./components/common/SyncStatusPill";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { usePrivacyMask } from "./hooks/usePrivacyMask";
import { cn } from "./utils";

const PageLoadingFallback = () => (
  <div
    className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse"
    role="status"
    aria-label="جاري تحميل الصفحة..."
  >
    {/* Header Skeleton */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--line)]">
      <div className="space-y-2">
        <div className="h-6 w-48 bg-[var(--sunken)] rounded-lg" />
        <div className="h-4 w-72 bg-[var(--sunken)]/60 rounded-md" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-9 w-24 bg-[var(--sunken)] rounded-xl" />
        <div className="h-9 w-28 bg-[var(--sunken)] rounded-xl" />
      </div>
    </div>

    {/* Metric / Stat Cards Skeleton */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="p-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] space-y-2 shadow-2xs"
        >
          <div className="h-3.5 w-16 bg-[var(--sunken)] rounded-md" />
          <div className="h-6 w-24 bg-[var(--sunken)]/80 rounded-lg" />
        </div>
      ))}
    </div>

    {/* Content Cards Skeleton Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="p-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] space-y-3 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 bg-[var(--sunken)] rounded-md" />
            <div className="h-5 w-14 bg-[var(--sunken)]/70 rounded-full" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-44 bg-[var(--sunken)]/60 rounded-md" />
            <div className="h-3 w-28 bg-[var(--sunken)]/40 rounded-md" />
          </div>
          <div className="pt-2 flex items-center justify-between border-t border-[var(--line)]">
            <div className="h-4 w-20 bg-[var(--sunken)]/50 rounded-md" />
            <div className="h-7 w-16 bg-[var(--sunken)] rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

function sanitizeCategoryRequirements(
  reqs?: Record<string, number> | null,
  majorName = "",
): Record<string, number> {
  const isFiveYear =
    !majorName.includes("الذكاء") && !majorName.includes("علم الحاسوب");
  if (!reqs || Object.keys(reqs).length === 0)
    return defaultCategoryRequirements;

  const clean: Record<string, number> = { ...reqs };
  // Clamp elective requirements so they never hold the entire course pool sum
  if (clean["متطلب تخصص اختياري"] && clean["متطلب تخصص اختياري"] > 21) {
    clean["متطلب تخصص اختياري"] = isFiveYear ? 15 : 9;
  }
  if (clean["متطلب جامعة اختياري"] && clean["متطلب جامعة اختياري"] > 12) {
    clean["متطلب جامعة اختياري"] = isFiveYear ? 6 : 9;
  }
  if (clean["متطلب كلية اختياري"] && clean["متطلب كلية اختياري"] > 9) {
    clean["متطلب كلية اختياري"] = 3;
  }

  // Verify total degree credits does not exceed 175
  const sum = Object.entries(clean).reduce((acc, [cat, cr]) => {
    if (cat.includes("استدراكي")) return acc;
    return acc + (typeof cr === "number" ? cr : 0);
  }, 0);

  if (sum < 120 || sum > 175) {
    return defaultCategoryRequirements;
  }

  return clean;
}

export function App() {
  const [currentRoute, navigateTo] = useAppRoute();

  // Storage issue logger
  const reportStorageIssue = useCallback((msg: string) => {
    console.warn("Storage warning:", msg);
  }, []);

  // Theme state (Item 85: Tri-cycle dark -> light -> system, plus high-contrast Item 91)
  const [themeMode, setThemeMode] = useState<
    "light" | "dark" | "system" | "high-contrast"
  >(() => {
    themeManager.initialize();
    if (themeManager.isHighContrast) return "high-contrast";
    if (themeManager.isSystemTheme) return "system";
    return themeManager.isDarkMode ? "dark" : "light";
  });
  const [isDarkMode, setIsDarkMode] = useState(() => themeManager.isDarkMode);

  const cycleTheme = () => {
    if (themeMode === "dark") {
      themeManager.setTheme("light");
      setThemeMode("light");
      setIsDarkMode(false);
    } else if (themeMode === "light") {
      themeManager.followSystem();
      setThemeMode("system");
      setIsDarkMode(themeManager.isDarkMode);
    } else {
      themeManager.setTheme("dark");
      setThemeMode("dark");
      setIsDarkMode(true);
    }
    triggerHaptic();
  };

  // Major and courses state
  const [activeMajorId, setActiveMajorIdState] = useState<string>(() => {
    const student = getCachedStudentProfile();
    if (student?.majorId) return student.majorId;
    if (student?.majorName)
      return student.majorName.trim().replace(/\s+/g, "-");
    const saved = getActiveMajorId();
    return saved || "";
  });
  const [activeMajorName, setActiveMajorName] = useState<string>(() => {
    const student = getCachedStudentProfile();
    if (student?.majorName) return student.majorName;
    const savedName = getActiveMajorName();
    return savedName || "";
  });
  const [courses, setCourses] = useState<Course[]>(() => {
    const student = getCachedStudentProfile();
    if (
      student &&
      Array.isArray(student.planCourses) &&
      student.planCourses.length > 0
    ) {
      return student.planCourses;
    }
    const savedId = getActiveMajorId();
    if (savedId && typeof window !== "undefined" && window.localStorage) {
      try {
        const cachedPlan = window.localStorage.getItem(
          `ptuk_major_plan_${savedId.toLowerCase().trim()}`,
        );
        if (cachedPlan) {
          const parsed = JSON.parse(cachedPlan);
          if (Array.isArray(parsed?.courses) && parsed.courses.length > 0) {
            return parsed.courses;
          }
        }
      } catch (err) {
        console.warn("Failed to load cached major plan courses:", err);
      }
    }
    return defaultCourses;
  });
  // Student auth state
  const [currentStudent, setCurrentStudent] =
    useState<StudentSyncProfile | null>(() => getCachedStudentProfile());

  const [categoryRequirements, setCategoryRequirements] = useState<
    Record<string, number>
  >(() => {
    const student = getCachedStudentProfile();
    if (
      student?.categoryRequirements &&
      Object.keys(student.categoryRequirements).length > 0
    ) {
      return sanitizeCategoryRequirements(
        student.categoryRequirements,
        student.majorName || "",
      );
    }
    const savedId = getActiveMajorId();
    if (savedId && typeof window !== "undefined" && window.localStorage) {
      try {
        const cachedPlan = window.localStorage.getItem(
          `ptuk_major_plan_${savedId.toLowerCase().trim()}`,
        );
        if (cachedPlan) {
          const parsed = JSON.parse(cachedPlan);
          if (
            parsed?.categoryRequirements &&
            Object.keys(parsed.categoryRequirements).length > 0
          ) {
            return sanitizeCategoryRequirements(parsed.categoryRequirements);
          }
        }
      } catch (err) {
        console.warn("Failed to load cached category requirements:", err);
      }
    }
    return defaultCategoryRequirements;
  });

  const degreeTotalCredits = useMemo(() => {
    if (
      currentStudent?.totalCredits &&
      currentStudent.totalCredits >= 60 &&
      currentStudent.totalCredits <= 260
    ) {
      return currentStudent.totalCredits;
    }
    if (categoryRequirements && Object.keys(categoryRequirements).length > 0) {
      const sum = Object.entries(categoryRequirements).reduce(
        (acc, [cat, val]) => {
          if (cat.includes("استدراكي")) return acc;
          return acc + (Number(val) || 0);
        },
        0,
      );
      if (sum >= 60 && sum <= 260) return sum;
    }
    return TOTAL_CREDITS;
  }, [categoryRequirements, currentStudent?.totalCredits]);

  // Academic Planner persistent states
  const [completedCourses, setCompletedCourses] = useState<Set<string>>(() => {
    const student = getCachedStudentProfile();
    const set = new Set<string>(student?.passedCourseIds || []);
    if (student?.semesters && student.semesters.length > 0) {
      student.semesters.forEach((sem) => {
        sem.courses.forEach((sc) => {
          if (sc.isPassed) set.add(sc.code);
        });
      });
    }
    if (student?.exemptionExams && student.exemptionExams.length > 0) {
      student.exemptionExams.forEach((ex) => {
        if (ex.isPassed && ex.code) set.add(ex.code);
        const isEng =
          ex.code === "15200099" ||
          ex.code === "15200106" ||
          /انجليزي|إنجليزية|English/i.test(ex.examName || "");
        if (isEng && typeof ex.grade === "number" && ex.grade >= 80) {
          set.add("15200099");
          set.add("15200106");
        }
      });
    }
    if (set.has("15200112")) {
      set.add("15200106");
      set.add("15200099");
    }
    if (set.has("15200106")) {
      set.add("15200099");
    }
    if (set.size > 0) {
      return set;
    }
    return readAppStorageValue<Set<string>>(
      "completed_courses",
      new Set(),
      reportStorageIssue,
    );
  });

  const [plannedCourses, setPlannedCourses] = useState<Record<string, string>>(
    () => {
      return readAppStorageValue<Record<string, string>>(
        "planned_courses",
        {},
        reportStorageIssue,
      );
    },
  );

  const [weeklySchedule, setWeeklySchedule] = useState<
    Record<string, Record<string, ScheduleEntry>>
  >(() => {
    return readAppStorageValue<Record<string, Record<string, ScheduleEntry>>>(
      "weekly_schedule",
      {},
      reportStorageIssue,
    );
  });

  const [courseGrades, setCourseGrades] = useState<Record<string, number>>(
    () => {
      const student = getCachedStudentProfile();
      if (
        student?.courseGrades &&
        Object.keys(student.courseGrades).length > 0
      ) {
        return student.courseGrades;
      }
      return readAppStorageValue<Record<string, number>>(
        "course_grades",
        {},
        reportStorageIssue,
      );
    },
  );

  const [failedCourseIds, setFailedCourseIds] = useState<string[]>(() => {
    const student = getCachedStudentProfile();
    if (student?.failedCourseIds && student.failedCourseIds.length > 0) {
      return student.failedCourseIds;
    }
    return readAppStorageValue<string[]>(
      "failed_course_ids",
      [],
      reportStorageIssue,
    );
  });

  const [selectedElectives, setSelectedElectives] = useState<
    Record<string, string>
  >(() => {
    return readAppStorageValue<Record<string, string>>(
      "selected_electives_map",
      {
        univ_1: "13020001",
        univ_2: "13020009",
        univ_3: "13020026",
        spec_1: "12140416",
        spec_2: "12140549",
        spec_3: "12140505",
        spec_4: "12140510",
        spec_5: "12140526",
      },
      reportStorageIssue,
    );
  });

  const [currentPlanningSemester, setCurrentPlanningSemester] = useState<
    string | null
  >(() => {
    return readAppStorageValue<string | null>(
      "selected_planning_semester",
      null,
      reportStorageIssue,
    );
  });

  const handleSetCurrentPlanningSemester = useCallback(
    (semester: string | null) => {
      setCurrentPlanningSemester(semester);
      try {
        if (typeof window !== "undefined") {
          if (semester) {
            localStorage.setItem("selected_planning_semester", semester);
          } else {
            localStorage.removeItem("selected_planning_semester");
          }
        }
      } catch {
        // storage unavailable
      }
    },
    [],
  );

  // Global Toast Notification in App.tsx (Item 12)
  const [appToastMessage, setAppToastMessage] = useState<string | null>(null);
  const showAppToast = useCallback((msg: string) => {
    setAppToastMessage(msg);
    setTimeout(() => setAppToastMessage(null), 2500);
  }, []);

  // Refs for dirty-checking storage saves (Point 25: prevents redundant JSON serialization)
  const prevSavedRef = useRef<{
    completedCourses?: Set<string>;
    plannedCourses?: Record<string, string>;
    weeklySchedule?: Record<string, Record<string, ScheduleEntry>>;
    courseGrades?: Record<string, number>;
    failedCourseIds?: string[];
    selectedElectives?: Record<string, string>;
  }>({});

  // Debounced dirty-checking batch save to localStorage
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const prev = prevSavedRef.current;
        if (prev.completedCourses !== completedCourses) {
          writeAppStorageValue("completed_courses", completedCourses);
          prev.completedCourses = completedCourses;
        }
        if (prev.plannedCourses !== plannedCourses) {
          writeAppStorageValue("planned_courses", plannedCourses);
          prev.plannedCourses = plannedCourses;
        }
        if (prev.weeklySchedule !== weeklySchedule) {
          writeAppStorageValue("weekly_schedule", weeklySchedule);
          prev.weeklySchedule = weeklySchedule;
        }
        if (prev.courseGrades !== courseGrades) {
          writeAppStorageValue("course_grades", courseGrades);
          prev.courseGrades = courseGrades;
        }
        if (prev.failedCourseIds !== failedCourseIds) {
          writeAppStorageValue("failed_course_ids", failedCourseIds);
          prev.failedCourseIds = failedCourseIds;
        }
        if (prev.selectedElectives !== selectedElectives) {
          writeAppStorageValue("selected_electives_map", selectedElectives);
          prev.selectedElectives = selectedElectives;
        }
      } catch (e) {
        console.error("Storage persistence error:", e);
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [
    completedCourses,
    plannedCourses,
    weeklySchedule,
    courseGrades,
    failedCourseIds,
    selectedElectives,
  ]);

  // Synchronize student grades and status from currentStudent profile
  const lastSyncedStudentKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentStudent) return;
    const syncKey = `${currentStudent.studentId}_${currentStudent.lastSyncedAt || ""}`;
    if (lastSyncedStudentKeyRef.current === syncKey) return;
    lastSyncedStudentKeyRef.current = syncKey;

    // 1. Gather all passed courses
    const allPassed = new Set(currentStudent.passedCourseIds || []);
    if (currentStudent.semesters && currentStudent.semesters.length > 0) {
      currentStudent.semesters.forEach((sem) => {
        sem.courses.forEach((sc) => {
          if (sc.isPassed) allPassed.add(sc.code);
        });
      });
    }
    if (
      currentStudent.exemptionExams &&
      currentStudent.exemptionExams.length > 0
    ) {
      currentStudent.exemptionExams.forEach((ex) => {
        if (ex.isPassed && ex.code) allPassed.add(ex.code);
        const isEng =
          ex.code === "15200099" ||
          ex.code === "15200106" ||
          /انجليزي|إنجليزية|English/i.test(ex.examName || "");
        if (isEng && typeof ex.grade === "number" && ex.grade >= 80) {
          allPassed.add("15200099");
          allPassed.add("15200106");
        }
      });
    }
    if (allPassed.has("15200112")) {
      allPassed.add("15200106");
      allPassed.add("15200099");
    }
    if (allPassed.has("15200106")) {
      allPassed.add("15200099");
    }
    setCompletedCourses(allPassed);
    try {
      writeAppStorageValue("completed_courses", allPassed);
    } catch (err) {
      console.warn("Failed to write completed_courses to storage:", err);
    }

    // 1.1 Synchronize active major and plan courses from synced student profile
    if (
      Array.isArray(currentStudent.planCourses) &&
      currentStudent.planCourses.length > 0
    ) {
      setCourses(currentStudent.planCourses);
    }
    if (currentStudent.majorId) {
      setActiveMajorIdState(currentStudent.majorId);
    }
    if (currentStudent.majorName) {
      setActiveMajorName(currentStudent.majorName);
    }
    if (
      currentStudent.categoryRequirements &&
      Object.keys(currentStudent.categoryRequirements).length > 0
    ) {
      setCategoryRequirements(
        sanitizeCategoryRequirements(
          currentStudent.categoryRequirements,
          currentStudent.majorName || "",
        ),
      );
    }

    // 2. Synchronize failed courses
    if (
      currentStudent.failedCourseIds &&
      currentStudent.failedCourseIds.length > 0
    ) {
      setFailedCourseIds(currentStudent.failedCourseIds);
      try {
        writeAppStorageValue(
          "failed_course_ids",
          currentStudent.failedCourseIds,
        );
      } catch (err) {
        console.warn("Failed to write failed_course_ids to storage:", err);
      }
    }

    // 3. Synchronize grades
    const grades: Record<string, number> = {
      ...(currentStudent.courseGrades || {}),
    };
    if (
      Object.keys(grades).length === 0 &&
      Array.isArray(currentStudent.planCourses)
    ) {
      for (const c of currentStudent.planCourses) {
        if (typeof c.grade === "number" && !isNaN(c.grade)) {
          grades[c.id || c.code] = c.grade;
        }
      }
    }
    if (Object.keys(grades).length > 0) {
      setCourseGrades((prev) => {
        const merged = { ...grades, ...prev };
        try {
          writeAppStorageValue("course_grades", merged);
        } catch (err) {
          console.warn("Failed to write course_grades to storage:", err);
        }
        return merged;
      });
    }

    // 4. Determine student standing / upcoming regular semester
    const upcomingSem = determineUpcomingSemester(
      currentStudent,
      allPassed,
      courses,
    );

    // If current planning semester is unset or stale summer semester, align with upcomingSem
    if (
      !currentPlanningSemester ||
      (currentPlanningSemester.includes("صيفي") &&
        !upcomingSem.includes("صيفي"))
    ) {
      setCurrentPlanningSemester(upcomingSem);
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("selected_planning_semester", upcomingSem);
        }
      } catch (err) {
        console.warn("Failed to persist selected_planning_semester:", err);
      }
    }

    // 5. Clean and sync planned courses:
    // ONLY future courses belong in plannedCourses — NEVER past completed courses or currently registered courses!
    setPlannedCourses((prev) => {
      const next: Record<string, string> = {};
      const registeredSet = new Set<string>(
        currentStudent?.registeredCourseIds || [],
      );

      // Retain only valid planned courses that are NOT completed and NOT currently registered
      Object.entries(prev).forEach(([courseId, semName]) => {
        if (!allPassed.has(courseId) && !registeredSet.has(courseId)) {
          // Remove accidental summer assignments from prior bug
          if (semName.includes("صيفي") && !upcomingSem.includes("صيفي")) {
            return;
          }
          next[courseId] = semName;
        }
      });

      // If upcoming semester has no planned courses yet, populate recommended courses for that semester
      const hasUpcomingPlanned = Object.values(next).some(
        (s) => s === upcomingSem,
      );
      if (!hasUpcomingPlanned && Array.isArray(courses) && courses.length > 0) {
        return autoPopulateUpcomingSemester(
          courses,
          upcomingSem,
          allPassed,
          next,
          currentStudent.registeredCourseIds,
        );
      }

      return next;
    });
  }, [currentStudent, courses]);

  // Item 115: Privacy Screen Mask Mode via Centralized Store
  const {
    isPrivacyMasked,
    togglePrivacyMask: rawTogglePrivacyMask,
    setPrivacyMask,
  } = usePrivacyMask();

  const togglePrivacyMask = useCallback(() => {
    const next = rawTogglePrivacyMask();
    triggerHaptic("selection");
    showAppToast(
      next
        ? "تم تفعيل تمويه الخصوصية للبيانات الحساسة."
        : "تم إيقاف تمويه الخصوصية.",
    );
  }, [rawTogglePrivacyMask, showAppToast]);

  // Feature 114: Auto Session Inactivity Lockout (30 minutes of inactivity)
  useEffect(() => {
    if (!currentStudent) return;
    const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
    let timeoutId: number;

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setPrivacyMask(true);
        showAppToast(
          "تم قفل شاشة الدرجات تلقائياً بعد 30 دقيقة من عدم النشاط لحماية خصوصيتك.",
        );
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((ev) =>
      window.addEventListener(ev, resetTimer, { passive: true }),
    );
    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [currentStudent, setPrivacyMask, showAppToast]);

  // Sync status
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  useEffect(() => {
    fetchSyncStatus()
      .then(setSyncStatus)
      .catch((e) => console.error("Sync status check failed", e));
  }, []);

  const syncTimeText = useMemo(() => {
    if (!syncStatus || !syncStatus.lastSyncTime) return "منذ دقائق";
    return formatArabicSyncTime(syncStatus.lastSyncTime);
  }, [syncStatus]);

  // Synchronize major plan if activeMajorId is loaded and not matching cached student plan
  useEffect(() => {
    if (!activeMajorId) return;
    const student = getCachedStudentProfile();
    if (
      student &&
      (activeMajorId === student.majorId ||
        activeMajorId === student.majorName) &&
      student.planCourses?.length
    ) {
      return;
    }
    let cancelled = false;
    fetchMajorPlan(activeMajorId)
      .then((detail) => {
        if (!cancelled && detail) {
          if (Array.isArray(detail.courses) && detail.courses.length > 0) {
            setCourses(detail.courses);
          }
          if (detail.name) {
            setActiveMajorName(detail.name);
          }
          if (
            detail.categoryRequirements &&
            Object.keys(detail.categoryRequirements).length > 0
          ) {
            setCategoryRequirements(detail.categoryRequirements);
          }
        }
      })
      .catch((e) => console.error("Initial major plan fetch failed:", e));

    return () => {
      cancelled = true;
    };
  }, [activeMajorId]);

  // Load major plan when major changes
  const handleSelectMajor = useCallback(async (majorId: string) => {
    setActiveMajorIdState(majorId);
    try {
      const detail = await fetchMajorPlan(majorId);
      setCourses(detail.courses);
      setActiveMajorName(detail.name);
      setActiveMajorId(majorId, detail.name);
      if (detail.categoryRequirements) {
        setCategoryRequirements(detail.categoryRequirements);
      }
    } catch (e) {
      console.error("Error loading major plan", e);
      const fallback = FALLBACK_MAJORS.find((m) => m.id === majorId);
      if (fallback) {
        setActiveMajorName(fallback.name);
        setActiveMajorId(majorId, fallback.name);
        setCategoryRequirements(fallback.categoryRequirements);
      } else {
        setActiveMajorId(majorId);
      }
    }
  }, []);

  // Course actions
  const handleToggleComplete = useCallback((courseId: string) => {
    setCompletedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
        triggerHaptic("light");
      } else {
        next.add(courseId);
        triggerHaptic("success");
        // Also remove from planned courses if completed
        setPlannedCourses((planned) => {
          if (!planned[courseId]) return planned;
          const copy = { ...planned };
          delete copy[courseId];
          return copy;
        });
      }
      return next;
    });
  }, []);

  const handlePlanCourse = useCallback(
    (courseId: string) => {
      setPlannedCourses((prev) => {
        const next = { ...prev };
        if (next[courseId]) {
          delete next[courseId];
          triggerHaptic("light");
        } else {
          next[courseId] = currentPlanningSemester || SEMESTERS[0];
          triggerHaptic("selection");
        }
        return next;
      });
    },
    [currentPlanningSemester],
  );

  // Modals & Popups State
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showMajorSelector, setShowMajorSelector] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isWeeklyScheduleModalOpen, setIsWeeklyScheduleModalOpen] =
    useState(false);
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [isRecordsModalOpen, setIsRecordsModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  // Global keyboard shortcut for Command Palette (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Sharing states
  const [isShareScheduleOpen, setIsShareScheduleOpen] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Retrieving / Loading shared schedule states
  const [isLoadScheduleOpen, setIsLoadScheduleOpen] = useState(false);
  const [isLoadScheduleLoading, setIsLoadScheduleLoading] = useState(false);
  const [loadScheduleError, setLoadScheduleError] = useState<string | null>(
    null,
  );
  const [loadedSchedule, setLoadedSchedule] = useState<{
    schedule: SharedScheduleSnapshot;
    code: string;
    viewCountWarning?: string;
  } | null>(null);

  // Plan preferences
  const [planStartSemester, setPlanStartSemester] = useState<string>(
    SEMESTERS[0],
  );
  const [planEndSemester, setPlanEndSemester] = useState<string>(
    "السنة الخامسة - الفصل الثاني",
  );
  const [hidePastSemesters, setHidePastSemesters] = useState<boolean>(false);

  // File input ref for CSV import
  const fileInputRef = useRef<HTMLInputElement>(null);

  const earnedCredits = useMemo(() => {
    return calculateDegreeCredits(courses, completedCourses);
  }, [courses, completedCourses]);

  const completedCreditsPerCategory = useMemo(() => {
    return calculateCategoryCredits(courses, completedCourses);
  }, [courses, completedCourses]);

  // Close tools menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        toolsMenuRef.current &&
        !toolsMenuRef.current.contains(e.target as Node)
      ) {
        setIsToolsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Auto load shared schedule from URL (?code=... or ?s=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") ?? params.get("s");
    if (!code) return;

    void (async () => {
      try {
        setIsLoadScheduleLoading(true);
        const result = await fetchScheduleByCode(code);
        setLoadedSchedule(result);
      } catch (err) {
        console.error("Auto load failed", err);
      } finally {
        setIsLoadScheduleLoading(false);
      }
    })();
  }, []);

  // Share schedule handler (with race condition lock - Item 33)
  const handleCreateSharedLink = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);
    setShareError(null);
    try {
      const coursesMap = new Map(courses.map((c) => [c.id, c]));
      const completedList = Array.from(completedCourses).map((id) => {
        const c = coursesMap.get(id);
        return {
          courseCode: id,
          courseName: c?.name || id,
          credits: c?.credits || 3,
          category: c?.category || "متطلب تخصص",
        };
      });

      const weeklyConverted: Record<string, Record<string, any>> = {};
      Object.entries(weeklySchedule).forEach(([sem, entries]) => {
        weeklyConverted[sem] = {};
        Object.entries(entries).forEach(([cId, entry]) => {
          weeklyConverted[sem][cId] = {
            courseId: cId,
            startTime: entry.startTime,
            endTime: entry.endTime,
            section: entry.section || "",
            instructor: entry.instructor || "",
            room: entry.room || entry.location || "",
            days: entry.days || (entry.day ? [entry.day] : []),
          };
        });
      });

      const snapshot: SharedScheduleSnapshot = {
        version: 2,
        name: "خطة الطالب",
        exportedAt: new Date().toISOString(),
        plannedCourses,
        completedCourses: completedList,
        weeklySchedule: weeklyConverted,
        courses: courses.map((c) => ({
          courseId: c.id,
          courseCode: c.id,
          courseName: c.name,
          credits: c.credits,
          category: c.category,
          prerequisites: c.prerequisites || [],
          semester: plannedCourses[c.id] || "",
          color: "",
          section: "",
          startTime: "",
          endTime: "",
          days: [],
          instructor: "",
          room: "",
          completed: completedCourses.has(c.id),
          failed: failedCourseIds.includes(c.id),
          grade: courseGrades[c.id] ?? null,
        })),
        courseGrades,
        failedCourseIds,
        selectedElectives,
        preferences: {
          planStartSemester,
          planEndSemester,
          hidePastSemesters,
          darkMode: isDarkMode,
        },
      };

      const code = await shareScheduleToCloud(snapshot);
      setShareCode(code);
    } catch (err: unknown) {
      console.error("Share schedule failed", err);
      setShareError(
        err instanceof Error ? err.message : "تعذر إنشاء رابط المشاركة.",
      );
    } finally {
      setIsSharing(false);
    }
  }, [
    courses,
    completedCourses,
    plannedCourses,
    weeklySchedule,
    courseGrades,
    failedCourseIds,
    selectedElectives,
    planStartSemester,
    planEndSemester,
    hidePastSemesters,
    isDarkMode,
  ]);

  const handleOpenShare = useCallback(() => {
    setIsToolsMenuOpen(false);
    setIsShareScheduleOpen(true);
    if (!shareCode) {
      void handleCreateSharedLink();
    }
  }, [shareCode, handleCreateSharedLink]);

  // Load schedule by code handler
  const handleLoadSharedSchedule = useCallback(
    async (value: string, pin?: string) => {
      setIsLoadScheduleLoading(true);
      setLoadScheduleError(null);
      const code = normalizeScheduleCode(value);
      try {
        const result = await fetchScheduleByCode(code, pin);
        setLoadedSchedule(result);
        setIsLoadScheduleOpen(false);
      } catch (error: unknown) {
        setLoadScheduleError(
          error instanceof Error
            ? error.message
            : "تعذر جلب الجدول. تحقق من الرمز والاتصال.",
        );
      } finally {
        setIsLoadScheduleLoading(false);
      }
    },
    [],
  );

  // Apply previewed shared schedule to user planner
  const applySharedSchedule = useCallback(() => {
    if (!loadedSchedule) return;
    const { schedule } = loadedSchedule;
    const knownCourseIds = new Set(courses.map((c) => c.id));

    if (schedule.plannedCourses) {
      const importedPlans = Object.fromEntries(
        Object.entries(schedule.plannedCourses).filter(([id]) =>
          knownCourseIds.has(id),
        ),
      );
      setPlannedCourses(importedPlans);
    }

    if (schedule.weeklySchedule) {
      const importedWeekly = Object.fromEntries(
        Object.entries(schedule.weeklySchedule).map(([semester, entries]) => [
          semester,
          Object.fromEntries(
            Object.entries(entries)
              .filter(([cId]) => knownCourseIds.has(cId))
              .map(([cId, entry]) => [cId, { ...entry } as ScheduleEntry]),
          ),
        ]),
      ) as Record<string, Record<string, ScheduleEntry>>;
      setWeeklySchedule(importedWeekly);
    }

    if (schedule.completedCourses) {
      const completedSet = new Set(
        schedule.completedCourses
          .map((sc) => sc.courseCode)
          .filter((id) => knownCourseIds.has(id)),
      );
      setCompletedCourses(completedSet);
    }

    if (schedule.courseGrades) {
      setCourseGrades(schedule.courseGrades);
    }

    if (schedule.failedCourseIds) {
      setFailedCourseIds(
        schedule.failedCourseIds.filter((id) => knownCourseIds.has(id)),
      );
    }

    if (schedule.selectedElectives) {
      setSelectedElectives(schedule.selectedElectives);
    }

    if (schedule.preferences) {
      if (schedule.preferences.planStartSemester)
        setPlanStartSemester(schedule.preferences.planStartSemester);
      if (schedule.preferences.planEndSemester)
        setPlanEndSemester(schedule.preferences.planEndSemester);
      if (schedule.preferences.hidePastSemesters !== undefined)
        setHidePastSemesters(schedule.preferences.hidePastSemesters);
    }

    setLoadedSchedule(null);
  }, [loadedSchedule, courses]);

  // CSV Import handler
  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showAppToast("حجم الملف يتجاوز الحد المسموح (5 ميغابايت).");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== "string") return;
        const rows = parseCsvRows(result);
        const [header, ...records] = rows;
        if (
          header?.length !== CSV_HEADERS.length ||
          header.some((v, idx) => v.trim() !== CSV_HEADERS[idx])
        ) {
          showAppToast(
            "صيغة الملف غير مدعومة. استخدم ملف CSV المُصدّر من الموقع.",
          );
          return;
        }

        const knownCourseIds = new Set(courses.map((c) => c.id));
        const importedCourseIds = new Set<string>();
        for (const row of records) {
          if (row.every((v) => v.trim() === "")) continue;
          if (row.length !== 5) continue;
          const courseId = row[0].trim();
          if (!knownCourseIds.has(courseId)) continue;
          const status = row[4].trim();
          if (status === "منجز") importedCourseIds.add(courseId);
        }

        setCompletedCourses((prev) => new Set([...prev, ...importedCourseIds]));
        showAppToast(`تم استيراد ${importedCourseIds.size} مادة منجزة بنجاح.`);
      } catch (err) {
        console.error(err);
        showAppToast("تعذّر استيراد ملف CSV.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // CSV Export handler
  const handleExportCsv = () => {
    setIsToolsMenuOpen(false);
    const headers = CSV_HEADERS.map(escapeCsvValue).join(",");
    const rows = courses.map((course) => {
      const isCompleted = completedCourses.has(course.id);
      const status = isCompleted ? "منجز" : "غير منجز";
      return [course.id, course.name, course.category, course.credits, status]
        .map(escapeCsvValue)
        .join(",");
    });

    const csvContent = "\uFEFF" + [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `study_plan_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  // Add custom course handler
  const handleAddCustomCourse = (newCourse: Course) => {
    setCourses((prev) => {
      if (prev.some((c) => c.id === newCourse.id)) return prev;
      return [...prev, newCourse];
    });
    setIsAddCourseModalOpen(false);
  };

  // Undo snapshot state for accidental resets (Pillar 3 & 4)
  const [undoSnapshot, setUndoSnapshot] = useState<{
    completedCourses: Set<string>;
    plannedCourses: Record<string, string>;
    weeklySchedule: Record<string, Record<string, ScheduleEntry>>;
    courseGrades: Record<string, number>;
    failedCourseIds: string[];
  } | null>(null);

  // Reset plan with instant snapshot and 7s Undo window
  const handleConfirmReset = () => {
    setUndoSnapshot({
      completedCourses: new Set(completedCourses),
      plannedCourses: { ...plannedCourses },
      weeklySchedule: { ...weeklySchedule },
      courseGrades: { ...courseGrades },
      failedCourseIds: [...failedCourseIds],
    });
    setCompletedCourses(new Set());
    setPlannedCourses({});
    setWeeklySchedule({});
    setCourseGrades({});
    setFailedCourseIds([]);
    setShowResetConfirm(false);
    showAppToast("تمت إعادة ضبط الخطة بنجاح. يمكنك التراجع خلال 7 ثوانٍ.");
  };

  const handleUndoReset = () => {
    if (!undoSnapshot) return;
    setCompletedCourses(undoSnapshot.completedCourses);
    setPlannedCourses(undoSnapshot.plannedCourses);
    setWeeklySchedule(undoSnapshot.weeklySchedule);
    setCourseGrades(undoSnapshot.courseGrades);
    setFailedCourseIds(undoSnapshot.failedCourseIds);
    setUndoSnapshot(null);
    showAppToast("تم استرجاع الخطة السابقة بكافة بياناتها بنجاح.");
  };

  // Logout
  const handleLogout = () => {
    clearStudentProfile();
    clearActiveMajor();
    setCurrentStudent(null);
    setActiveMajorIdState("cse-2023");
    setActiveMajorName("هندسة أنظمة الحاسوب");
    setCourses(defaultCourses);
    setCategoryRequirements(defaultCategoryRequirements);
    setIsToolsMenuOpen(false);
    navigateTo("login");
  };

  return (
    <div
      dir="rtl"
      data-privacy-mask={isPrivacyMasked ? "true" : undefined}
      className={cn(
        "min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col font-['IBM_Plex_Sans_Arabic',system-ui,sans-serif]",
        isPrivacyMasked && "privacy-mask-active",
      )}
    >
      {/* Offline Status Alert Banner */}
      <OfflineBanner />

      {/* 52px Fixed/Sticky Topbar */}
      <header className="h-[52px] bg-[var(--bg)] border-b border-[var(--line)] sticky top-0 z-[var(--z-sticky)] px-3 sm:px-5 lg:px-6 flex items-center justify-between overflow-x-clip">
        {/* Leading edge: Site name + 5 text tabs */}
        <div className="flex items-center gap-3 sm:gap-5 lg:gap-7 shrink-0 min-w-0">
          <a
            href="#/plan"
            className="text-[16px] lg:text-[17px] font-semibold text-[var(--text)] font-['Noto_Naskh_Arabic',serif] hover:opacity-90 transition-opacity no-underline flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <span>بوابة التخطيط</span>
          </a>

          {/* 5 Text Navigation Tabs (Desktop >= 768px) */}
          <nav className="hidden md:flex items-center gap-3 lg:gap-5 text-[13px] lg:text-[14px] font-medium h-[52px] shrink-0 whitespace-nowrap">
            <a
              href="#/plan"
              className={cn(
                "h-full flex items-center border-b-2 transition-colors no-underline whitespace-nowrap shrink-0 px-0.5",
                currentRoute === "plan"
                  ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                  : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
              )}
            >
              الخطة
            </a>
            <a
              href="#/semester-planning"
              className={cn(
                "h-full flex items-center border-b-2 transition-colors no-underline whitespace-nowrap shrink-0 px-0.5",
                currentRoute === "semester-planning"
                  ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                  : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
              )}
            >
              تخطيط الفصل
            </a>
            <a
              href="#/courses"
              className={cn(
                "h-full flex items-center border-b-2 transition-colors no-underline whitespace-nowrap shrink-0 px-0.5",
                currentRoute === "courses"
                  ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                  : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
              )}
            >
              المواد
            </a>
            <a
              href="#/schedule"
              className={cn(
                "h-full flex items-center border-b-2 transition-colors no-underline whitespace-nowrap shrink-0 px-0.5",
                currentRoute === "schedule"
                  ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                  : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
              )}
            >
              الجدول الأسبوعي
            </a>
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
            <a
              href="#/gpa"
              className={cn(
                "h-full flex items-center border-b-2 transition-colors no-underline whitespace-nowrap shrink-0 px-0.5",
                currentRoute === "gpa"
                  ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                  : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
              )}
            >
              المعدل والدرجات
            </a>
          </nav>
        </div>

        {/* Trailing edge: Major Selector, Export, Student Status / Login, Theme Toggle, ⋯ Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-2.5 shrink-0 whitespace-nowrap">
          {/* Quick Command Palette Trigger (Ctrl+K) */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center gap-1.5 h-8 px-2 sm:px-2.5 text-[12px] sm:text-[13px] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--line-control)] rounded-[var(--r-control)] bg-[var(--surface)] hover:bg-[var(--sunken)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="لوحة الأوامر السريعة (Ctrl+K)"
          >
            <Search size={14} className="shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">أوامر</span>
            <kbd className="hidden md:inline-block px-1 py-0.2 rounded text-[10px] font-mono bg-[var(--sunken)] border border-[var(--line-control)] whitespace-nowrap">
              Ctrl+K
            </kbd>
          </button>

          {/* Point 43: Subtle Micro Sync Status Pill */}
          <div className="hidden lg:flex items-center shrink-0">
            <SyncStatusPill
              isOnline={
                typeof navigator !== "undefined" ? navigator.onLine : true
              }
              lastSyncText={syncTimeText}
              onClick={() =>
                showAppToast(
                  `حالة المزامنة: متزامن مع بوابة الجامعة (${syncTimeText})`,
                )
              }
            />
          </div>

          {/* Official Academic Calendar Action (Relocated & Accessible) */}
          <button
            type="button"
            onClick={() => setIsCalendarModalOpen(true)}
            className="flex items-center gap-1.5 h-8 px-2 sm:px-2.5 text-[12px] sm:text-[13px] font-medium text-indigo-700 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 bg-indigo-50/90 dark:bg-indigo-950/40 hover:bg-indigo-100/90 dark:hover:bg-indigo-900/60 border border-indigo-200/90 dark:border-indigo-800/60 rounded-[var(--r-control)] transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
            title="التقويم الأكاديمي المعتمد ومواعيد الامتحانات والسحب والإضافة"
          >
            <Calendar
              size={14}
              className="text-indigo-600 dark:text-indigo-400 shrink-0"
            />
            <span className="whitespace-nowrap">التقويم الأكاديمي</span>
          </button>

          {/* Quick Export Button (Available on 2xl or in ⋯ tools menu) */}
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="hidden 2xl:flex items-center gap-1.5 h-8 px-2.5 text-[13px] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--line-control)] rounded-[var(--r-control)] bg-[var(--surface)] hover:bg-[var(--sunken)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="تصدير الخطة كملف PDF أو صورة أو نسخة احتياطية"
          >
            <Download size={14} className="shrink-0" />
            <span className="whitespace-nowrap">تصدير</span>
          </button>

          {/* User status */}
          <div className="text-[13px] text-[var(--text-2)] shrink-0 whitespace-nowrap">
            {currentStudent ? (
              <button
                type="button"
                onClick={() => setIsRecordsModalOpen(true)}
                className="font-medium text-[var(--text)] hover:text-[var(--accent)] hover:underline flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                title="عرض السجل الأكاديمي والمالي وكشف العلامات"
              >
                <GraduationCap
                  size={15}
                  className="text-[var(--accent)] shrink-0"
                />
                <span
                  className={cn(
                    "truncate max-w-[100px] sm:max-w-[130px] lg:max-w-[160px] whitespace-nowrap privacy-sensitive transition-all duration-200",
                    isPrivacyMasked && "blur-md select-none opacity-80",
                  )}
                >
                  {currentStudent.studentName || currentStudent.studentId}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                <span className="text-[var(--text-3)]">زائر</span>
                <a
                  href="#/login"
                  className="text-[var(--text)] hover:underline font-medium no-underline whitespace-nowrap"
                >
                  دخول
                </a>
              </div>
            )}
          </div>

          {/* Item 115: Privacy Screen Mask Toggle Button */}
          <button
            type="button"
            onClick={togglePrivacyMask}
            aria-label={
              isPrivacyMasked
                ? "إيقاف وضع الخصوصية (المعدل والعلامات مموهة)"
                : "تفعيل وضع الخصوصية للأماكن العامة (تمويه العلامات والمعدل)"
            }
            title={
              isPrivacyMasked
                ? "إيقاف وضع الخصوصية (المعدل والعلامات مموهة حالياً)"
                : "تفعيل وضع الخصوصية للأماكن العامة (تمويه العلامات والمعدل)"
            }
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-[var(--r-control)] transition-all cursor-pointer",
              isPrivacyMasked
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs"
                : "text-[var(--text)] hover:bg-[var(--sunken)] active:scale-95",
            )}
          >
            {isPrivacyMasked ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>

          {/* Tri-cycle Theme Toggle Button (Item 85: Dark -> Light -> System) */}
          <button
            type="button"
            onClick={cycleTheme}
            aria-label={
              themeMode === "dark"
                ? "المظهر الداكن (انقر للتبديل للفاتح)"
                : themeMode === "light"
                  ? "المظهر الفاتح (انقر للتبديل للتلقائي)"
                  : "مظهر النظام التلقائي (انقر للتبديل للداكن)"
            }
            title={
              themeMode === "dark"
                ? "المظهر الداكن (انقر للتبديل للفاتح)"
                : themeMode === "light"
                  ? "المظهر الفاتح (انقر للتبديل للتلقائي)"
                  : "مظهر النظام التلقائي (انقر للتبديل للداكن)"
            }
            className="w-10 h-10 flex items-center justify-center rounded-[var(--r-control)] text-[var(--text)] hover:bg-[var(--sunken)] active:scale-95 transition-all cursor-pointer"
          >
            {themeMode === "dark" ? (
              <Moon size={18} />
            ) : themeMode === "light" ? (
              <Sun size={18} />
            ) : (
              <Laptop size={18} />
            )}
          </button>

          {/* ⋯ Menu */}
          <div className="relative" ref={toolsMenuRef}>
            <button
              type="button"
              onClick={() => setIsToolsMenuOpen((prev) => !prev)}
              aria-label="قائمة الخيارات والأدوات"
              className="w-10 h-10 flex items-center justify-center rounded-[var(--r-control)] text-[var(--text)] hover:bg-[var(--sunken)] active:scale-95 transition-all cursor-pointer"
            >
              <MoreHorizontal size={20} />
            </button>

            {/* Dropdown Menu */}
            {isToolsMenuOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-1.5 w-60 bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-surface)] shadow-[var(--shadow-pop)] py-1 z-[var(--z-menu)] animate-in fade-in duration-100 divide-y divide-[var(--line)] text-right"
              >
                {/* Group 1: Student Profile & Major */}
                <div className="py-1">
                  {currentStudent && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        setIsRecordsModalOpen(true);
                      }}
                      className="w-full h-8 px-3.5 text-right text-[13px] text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors flex items-center justify-between cursor-pointer font-medium"
                    >
                      <span>السجل المالي والأكاديمي</span>
                      <GraduationCap size={15} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      setShowMajorSelector(true);
                    }}
                    className="w-full h-8 px-3.5 text-right text-[13px] text-[var(--text)] hover:bg-[var(--sunken)] transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>تغيير التخصص ({activeMajorName})</span>
                    <GraduationCap size={15} className="text-[var(--text-3)]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      setIsCalendarModalOpen(true);
                    }}
                    className="w-full h-8 px-3.5 text-right text-[13px] text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-colors flex items-center justify-between cursor-pointer font-medium"
                  >
                    <span>التقويم الأكاديمي المعتمد</span>
                    <Calendar
                      size={15}
                      className="text-indigo-600 dark:text-indigo-400"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      setIsAddCourseModalOpen(true);
                    }}
                    className="w-full h-8 px-3.5 text-right text-[13px] text-[var(--text)] hover:bg-[var(--sunken)] transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>إضافة مادة خاصة / معادلة</span>
                    <Plus size={14} className="text-[var(--text-3)]" />
                  </button>
                </div>

                {/* Group 2: Share & Export */}
                <div className="py-1">
                  <button
                    type="button"
                    onClick={handleOpenShare}
                    className="w-full h-8 px-3.5 text-right text-[13px] text-[var(--text)] hover:bg-[var(--sunken)] transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>مشاركة الجدول / رمز QR</span>
                    <Share2 size={14} className="text-[var(--text-3)]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      setIsLoadScheduleOpen(true);
                    }}
                    className="w-full h-8 px-3.5 text-right text-[13px] text-[var(--text)] hover:bg-[var(--sunken)] transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>استرجاع جدول سحابي برمز</span>
                    <Download size={14} className="text-[var(--text-3)]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      setIsExportModalOpen(true);
                    }}
                    className="w-full h-8 px-3.5 text-right text-[13px] text-[var(--text)] hover:bg-[var(--sunken)] transition-colors flex sm:hidden items-center justify-between cursor-pointer"
                  >
                    <span>تصدير الخطة (PDF / صور)</span>
                    <Download size={14} className="text-[var(--text-3)]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full h-8 px-3.5 text-right text-[13px] text-[var(--text)] hover:bg-[var(--sunken)] transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>استيراد خطة من CSV</span>
                    <Upload size={14} className="text-[var(--text-3)]" />
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="w-full h-8 px-3.5 text-right text-[13px] text-[var(--text)] hover:bg-[var(--sunken)] transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>تصدير الخطة إلى CSV</span>
                    <FileSpreadsheet
                      size={14}
                      className="text-[var(--text-3)]"
                    />
                  </button>
                </div>

                {/* Group 3: Tools & Utilities */}
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      setIsComparisonOpen(true);
                    }}
                    className="w-full h-8 px-3.5 text-right text-[13px] text-[var(--text)] hover:bg-[var(--sunken)] transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>مقارنة المساقات الاختيارية</span>
                    <Sliders size={14} className="text-[var(--text-3)]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      window.print();
                    }}
                    className="w-full h-8 px-3.5 text-right text-[13px] text-[var(--text)] hover:bg-[var(--sunken)] transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>طباعة الخطة الورقية (A4)</span>
                    <Printer size={14} className="text-[var(--text-3)]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      setShowSupportModal(true);
                    }}
                    className="w-full h-8 px-3.5 text-right text-[13px] text-[var(--text)] hover:bg-[var(--sunken)] transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>الدعم والملاحظات</span>
                    <MessageCircle size={14} className="text-[var(--text-3)]" />
                  </button>

                  {/* Item 91: High-Contrast Accessibility Theme Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      const isHigh = themeMode === "high-contrast";
                      const next = isHigh ? "light" : "high-contrast";
                      themeManager.setTheme(next);
                      setThemeMode(next);
                      setIsDarkMode(false);
                      showAppToast(
                        isHigh
                          ? "تم إيقاف نمط التباين العالي."
                          : "تم تفعيل نمط التباين العالي للقراءة تحت الشمس.",
                      );
                      triggerHaptic();
                    }}
                    className="w-full h-8 px-3.5 text-right text-[13px] text-[var(--text)] hover:bg-[var(--sunken)] transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>نمط التباين العالي (شمس/ضعف بصر)</span>
                    <Sparkles
                      size={14}
                      className={
                        themeMode === "high-contrast"
                          ? "text-amber-500"
                          : "text-[var(--text-3)]"
                      }
                    />
                  </button>
                </div>

                {/* Group 4: Reset & Session */}
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      setShowResetConfirm(true);
                    }}
                    className="w-full h-8 px-3.5 text-right text-[13px] text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors flex items-center justify-between cursor-pointer font-medium"
                  >
                    <span>إعادة ضبط الخطة</span>
                    <RotateCcw size={14} />
                  </button>

                  {currentStudent && (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full h-8 px-3.5 text-right text-[13px] text-[var(--text-2)] hover:bg-[var(--sunken)] transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span>تسجيل الخروج</span>
                      <LogOut size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Page View Switching based on Route (Item 35: Error Boundary protected) */}
      <main className="flex-1 flex flex-col pb-14 md:pb-0">
        <ErrorBoundary>
          <React.Suspense fallback={<PageLoadingFallback />}>
            {(currentRoute === "plan" || currentRoute === "calendar") && (
              <PlanPage
                courses={courses}
                completedCourses={completedCourses}
                plannedCourses={plannedCourses}
                onToggleComplete={handleToggleComplete}
                onPlanCourse={handlePlanCourse}
                activeMajorName={activeMajorName}
                activeMajorId={activeMajorId}
                onSelectMajor={() => setShowMajorSelector(true)}
                onNavigateToSemesterPlanning={() =>
                  navigateTo("semester-planning")
                }
                onAddCourse={() => setIsAddCourseModalOpen(true)}
                weeklySchedule={weeklySchedule}
                courseGrades={courseGrades}
                failedCourseIds={failedCourseIds}
                selectedElectives={selectedElectives}
                setSelectedElectives={setSelectedElectives}
                setPlannedCourses={setPlannedCourses}
                categoryRequirements={categoryRequirements}
              />
            )}

            {currentRoute === "semester-planning" && (
              <SemesterPlanningPage
                courses={courses}
                completedCourses={completedCourses}
                plannedCourses={plannedCourses}
                setPlannedCourses={setPlannedCourses}
                currentPlanningSemester={currentPlanningSemester}
                setCurrentPlanningSemester={handleSetCurrentPlanningSemester}
                onNavigateBackToPlan={() => navigateTo("plan")}
                hasHighGpa={(currentStudent?.gpa ?? 0) >= 80}
                completedCreditsPerCategory={completedCreditsPerCategory}
                categoryRequirements={categoryRequirements}
                currentStudent={currentStudent}
                courseGrades={courseGrades}
                onOpenRecordsModal={() => setIsRecordsModalOpen(true)}
                onOpenCalendarModal={() => setIsCalendarModalOpen(true)}
              />
            )}

            {currentRoute === "courses" && (
              <CoursesPage
                courses={courses}
                completedCourses={completedCourses}
                plannedCourses={plannedCourses}
                courseGrades={courseGrades}
                currentGpa={currentStudent?.gpa}
                currentPlanningSemester={currentPlanningSemester}
                categoryRequirements={categoryRequirements}
                onNavigate={navigateTo}
                onToggleComplete={handleToggleComplete}
                onPlanCourse={handlePlanCourse}
                activeMajorName={activeMajorName}
                onSelectMajor={() => setShowMajorSelector(true)}
                syncTimeText={syncTimeText}
                weeklySchedule={weeklySchedule}
                setWeeklySchedule={setWeeklySchedule}
              />
            )}

            {currentRoute === "schedule" && (
              <WeeklySchedulePage
                courses={courses}
                plannedCourses={plannedCourses}
                weeklySchedule={weeklySchedule}
                setWeeklySchedule={setWeeklySchedule}
                onShareSchedule={handleOpenShare}
                onOpenScheduleSolver={() => setIsWeeklyScheduleModalOpen(true)}
                syncTimeText={syncTimeText}
                completedCourses={completedCourses}
              />
            )}

            {currentRoute === "gpa" && (
              <GPAPage
                courses={courses}
                completedCourses={completedCourses}
                courseGrades={courseGrades}
                setCourseGrades={setCourseGrades}
                failedCourseIds={new Set(failedCourseIds)}
                setFailedCourseIds={(ids) =>
                  setFailedCourseIds(Array.from(ids))
                }
                activeMajorName={activeMajorName}
                onSelectMajor={() => setShowMajorSelector(true)}
                categoryRequirements={categoryRequirements}
                totalDegreeCredits={degreeTotalCredits}
              />
            )}

            {currentRoute === "registration" && (
              <section
                aria-labelledby="registration-coming-soon-title"
                className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex items-center justify-center"
              >
                <div className="w-full p-6 sm:p-8 text-center bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-surface)] shadow-sm">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--sunken)] text-[var(--text-3)] flex items-center justify-center">
                    <Lock size={24} aria-hidden="true" />
                  </div>
                  <h1
                    id="registration-coming-soon-title"
                    className="text-lg sm:text-xl font-bold text-[var(--text)] m-0"
                  >
                    تسجيل الفصل
                  </h1>
                  <p className="mt-2 mb-0 text-sm text-[var(--text-2)]">
                    قيد التطوير
                  </p>
                </div>
              </section>
            )}

            {currentRoute === "login" && (
              <LoginPage
                onLoginSuccess={(profile) => {
                  // Clear any legacy major caches in localStorage so the student's fresh data takes full precedence
                  try {
                    localStorage.removeItem("ptuk_majors_list_cache");
                    localStorage.removeItem("ptuk_active_major_id");
                    localStorage.removeItem("ptuk_active_major_name");
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                      const key = localStorage.key(i);
                      if (key && key.startsWith("ptuk_major_plan_")) {
                        localStorage.removeItem(key);
                      }
                    }
                  } catch (err) {
                    console.warn("Failed to clear previous major cache:", err);
                  }

                  setCurrentStudent(profile);
                  const studentMajorId =
                    profile.majorId ||
                    (profile.majorName
                      ? profile.majorName.trim().replace(/\s+/g, "-")
                      : "my-major");
                  const studentMajorName = profile.majorName || "تخصص الطالب";

                  setActiveMajorIdState(studentMajorId);
                  setActiveMajorName(studentMajorName);
                  setActiveMajorId(studentMajorId, studentMajorName);

                  if (
                    Array.isArray(profile.planCourses) &&
                    profile.planCourses.length > 0
                  ) {
                    setCourses(profile.planCourses);
                    try {
                      localStorage.setItem(
                        `ptuk_major_plan_${studentMajorId.toLowerCase().trim()}`,
                        JSON.stringify({
                          id: studentMajorId,
                          name: studentMajorName,
                          courses: profile.planCourses,
                          categoryRequirements: profile.categoryRequirements,
                        }),
                      );
                    } catch (err) {
                      console.warn("Failed to cache major plan:", err);
                    }
                  }
                  if (
                    profile.categoryRequirements &&
                    Object.keys(profile.categoryRequirements).length > 0
                  ) {
                    setCategoryRequirements(profile.categoryRequirements);
                  }

                  const syncedPassed = new Set(profile.passedCourseIds || []);
                  if (
                    profile.exemptionExams &&
                    profile.exemptionExams.length > 0
                  ) {
                    profile.exemptionExams.forEach((ex) => {
                      if (ex.isPassed && ex.code) syncedPassed.add(ex.code);
                      const isEng =
                        ex.code === "15200099" ||
                        ex.code === "15200106" ||
                        /انجليزي|إنجليزية|English/i.test(ex.examName || "");
                      if (
                        isEng &&
                        typeof ex.grade === "number" &&
                        ex.grade >= 80
                      ) {
                        syncedPassed.add("15200099");
                        syncedPassed.add("15200106");
                      }
                    });
                  }
                  if (syncedPassed.has("15200112")) {
                    syncedPassed.add("15200106");
                    syncedPassed.add("15200099");
                  }
                  if (syncedPassed.has("15200106")) {
                    syncedPassed.add("15200099");
                  }
                  setCompletedCourses(syncedPassed);
                  setFailedCourseIds(profile.failedCourseIds || []);

                  const grades: Record<string, number> = {
                    ...(profile.courseGrades || {}),
                  };
                  if (
                    Object.keys(grades).length === 0 &&
                    Array.isArray(profile.planCourses)
                  ) {
                    for (const c of profile.planCourses) {
                      if (typeof c.grade === "number" && !isNaN(c.grade)) {
                        grades[c.id || c.code] = c.grade;
                      }
                    }
                  }
                  setCourseGrades(grades);

                  if (
                    Array.isArray(profile.enrolledCourses) &&
                    profile.enrolledCourses.length > 0
                  ) {
                    const targetSem =
                      currentPlanningSemester ||
                      profile.currentSemester ||
                      SEMESTERS[0];
                    const newSched: Record<string, ScheduleEntry> = {};
                    profile.enrolledCourses.forEach((ec) => {
                      if (Array.isArray(ec.blocks) && ec.blocks.length > 0) {
                        ec.blocks.forEach((b) => {
                          (b.days || []).forEach((d) => {
                            newSched[`${ec.code}_${d}`] = {
                              day: d,
                              startTime: `${Math.floor(b.start / 60)}:${String(b.start % 60).padStart(2, "0")}`,
                              endTime: `${Math.floor(b.end / 60)}:${String(b.end % 60).padStart(2, "0")}`,
                              instructor: ec.instructor,
                              room: ec.room,
                              section: ec.sec,
                            };
                          });
                        });
                      }
                    });
                    if (Object.keys(newSched).length > 0) {
                      setWeeklySchedule((prev) => ({
                        ...prev,
                        [targetSem]: newSched,
                      }));
                    }
                  }
                  navigateTo("plan");
                }}
                onContinueAsGuest={() => {
                  navigateTo("plan");
                }}
                onRetrieveCode={handleLoadSharedSchedule}
              />
            )}
          </React.Suspense>
        </ErrorBoundary>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (< 768px) with Active Route Indicators (Item 11) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-[58px] bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--line)] flex items-center justify-around px-1 z-[var(--z-sticky)] shadow-lg">
        {[
          { route: "plan", label: "الخطة", icon: Zap },
          { route: "semester-planning", label: "الفصل", icon: Calendar },
          { route: "courses", label: "المواد", icon: BookOpen },
          { route: "schedule", label: "الجدول", icon: Clock },
          { route: "registration", label: "التسجيل", icon: Sparkles },
          { route: "gpa", label: "المعدل", icon: GraduationCap },
        ].map((item) => {
          const isActive = currentRoute === item.route;
          const Icon = item.icon;
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
          return (
            <a
              key={item.route}
              href={`#/${item.route}`}
              onClick={() => triggerHaptic("selection")}
              className={cn(
                "flex-1 h-full flex flex-col items-center justify-center py-1 rounded-xl transition-all no-underline text-[11px] active:scale-95 select-none",
                isActive
                  ? "text-[var(--accent)] font-bold font-semibold"
                  : "text-[var(--text-3)] hover:text-[var(--text)] font-medium",
              )}
            >
              <div
                className={cn(
                  "p-1 rounded-xl transition-all flex items-center justify-center",
                  isActive && "bg-[var(--accent)]/15 shadow-2xs",
                )}
              >
                <Icon size={17} strokeWidth={isActive ? 2.5 : 1.75} />
              </div>
              <span className="leading-tight mt-0.5">{item.label}</span>
            </a>
          );
        })}
      </nav>

      {/* Global App Floating Toast (Item 12) */}
      {appToastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[var(--surface)] text-[var(--text)] border border-[var(--accent)] px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-sm font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Sparkles size={16} className="text-[var(--accent)] shrink-0" />
          <span>{appToastMessage}</span>
        </div>
      )}

      {/* Undo Toast for Plan Reset (Pillars 3 & 4) */}
      {undoSnapshot && (
        <UndoToast
          message="تمت إعادة ضبط الخطة."
          onUndo={handleUndoReset}
          onDismiss={() => setUndoSnapshot(null)}
          durationMs={7000}
        />
      )}

      <React.Suspense fallback={null}>
        {/* Reset Confirmation Modal */}
        {showResetConfirm && (
          <ResetConfirmationModal
            showResetConfirm={showResetConfirm}
            onClose={() => setShowResetConfirm(false)}
            onConfirm={handleConfirmReset}
          />
        )}

        {/* Major Selector Modal */}
        {showMajorSelector && (
          <MajorSelectorModal
            isOpen={showMajorSelector}
            onClose={() => setShowMajorSelector(false)}
            onSelectMajor={handleSelectMajor}
            currentMajorId={activeMajorId}
          />
        )}

        {/* Support / Feedback Modal */}
        {showSupportModal && (
          <SupportModal
            isSupportModalOpen={showSupportModal}
            onClose={() => setShowSupportModal(false)}
          />
        )}

        {/* Export Plan Modal */}
        {isExportModalOpen && (
          <ExportModal
            isExportModalOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            completedCredits={earnedCredits}
            plannedCourses={plannedCourses}
            completedCourses={completedCourses}
            courses={courses}
            courseGrades={courseGrades}
            weeklySchedule={weeklySchedule}
            selectedElectives={selectedElectives}
            failedCourseIds={failedCourseIds}
            planStartSemester={planStartSemester}
            planEndSemester={planEndSemester}
            hidePastSemesters={hidePastSemesters}
            darkMode={isDarkMode}
            categoryRequirements={categoryRequirements}
            totalDegreeCredits={degreeTotalCredits}
          />
        )}

        {/* Share Schedule Modal */}
        {isShareScheduleOpen && (
          <ShareScheduleModal
            isOpen={isShareScheduleOpen}
            onClose={() => setIsShareScheduleOpen(false)}
            code={shareCode}
            loading={isSharing}
            error={shareError}
            onCreate={handleCreateSharedLink}
          />
        )}

        {/* Retrieve / Load Schedule Modal */}
        {isLoadScheduleOpen && (
          <LoadScheduleModal
            isOpen={isLoadScheduleOpen}
            onClose={() => setIsLoadScheduleOpen(false)}
            loading={isLoadScheduleLoading}
            error={loadScheduleError}
            onLoad={handleLoadSharedSchedule}
          />
        )}

        {/* Shared Schedule Preview Modal */}
        {loadedSchedule && (
          <SharedSchedulePreviewModal
            schedule={loadedSchedule.schedule}
            code={loadedSchedule.code}
            warning={loadedSchedule.viewCountWarning}
            onClose={() => setLoadedSchedule(null)}
            onApply={applySharedSchedule}
          />
        )}

        {/* Smart Schedule Solver Modal */}
        {isWeeklyScheduleModalOpen && (
          <WeeklyScheduleModal
            isOpen={isWeeklyScheduleModalOpen}
            onClose={() => setIsWeeklyScheduleModalOpen(false)}
            plannedCourses={plannedCourses}
            courses={courses}
            weeklySchedule={weeklySchedule}
            setWeeklySchedule={setWeeklySchedule}
            completedCourses={completedCourses}
          />
        )}

        {/* Add Custom Course Modal */}
        {isAddCourseModalOpen && (
          <AddCourseModal
            isOpen={isAddCourseModalOpen}
            onClose={() => setIsAddCourseModalOpen(false)}
            onAddCourse={handleAddCustomCourse}
          />
        )}

        {/* Student Official Records Modal (Financial & Transcript) */}
        {isRecordsModalOpen && (
          <StudentRecordsModal
            isOpen={isRecordsModalOpen}
            onClose={() => setIsRecordsModalOpen(false)}
            profile={currentStudent}
            onOpenSyncModal={() => {
              setIsRecordsModalOpen(false);
              navigateTo("login");
            }}
            completedCourseIds={completedCourses}
            onApplyExemption={(courseCode, shouldExempt) => {
              setCompletedCourses((prev) => {
                const next = new Set(prev);
                if (shouldExempt) {
                  next.add(courseCode);
                  if (courseCode === "15200106") {
                    next.add("15200099");
                  }
                } else {
                  next.delete(courseCode);
                }
                try {
                  writeAppStorageValue("completed_courses", next);
                } catch (err) {
                  console.warn(
                    "Failed to update completed_courses storage:",
                    err,
                  );
                }

                try {
                  const cached = getCachedStudentProfile();
                  if (cached) {
                    const passed = new Set(cached.passedCourseIds || []);
                    if (shouldExempt) {
                      passed.add(courseCode);
                      if (courseCode === "15200106") passed.add("15200099");
                    } else {
                      passed.delete(courseCode);
                    }
                    cached.passedCourseIds = Array.from(passed);
                    localStorage.setItem(
                      "ptuk_synced_student_profile",
                      JSON.stringify(cached),
                    );
                    setCurrentStudent({ ...cached });
                  }
                } catch (err) {
                  console.warn(
                    "Failed to persist updated student profile:",
                    err,
                  );
                }

                return next;
              });
            }}
          />
        )}

        {/* PTUK Official Academic Calendar Modal */}
        {(isCalendarModalOpen || currentRoute === "calendar") && (
          <AcademicCalendarModal
            isOpen={true}
            onClose={() => {
              setIsCalendarModalOpen(false);
              if (currentRoute === "calendar") {
                navigateTo("plan");
              }
            }}
          />
        )}

        {/* Command Palette Modal (Ctrl+K) */}
        <CommandPaletteModal
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          courses={courses}
          completedCourses={completedCourses}
          onNavigate={(route) => {
            navigateTo(route);
            setIsCommandPaletteOpen(false);
          }}
          onOpenExport={() => {
            setIsCommandPaletteOpen(false);
            setIsExportModalOpen(true);
          }}
          onOpenMajorSelector={() => {
            setIsCommandPaletteOpen(false);
            setShowMajorSelector(true);
          }}
          onSelectMajor={(majorId) => {
            handleSelectMajor(majorId);
            setIsCommandPaletteOpen(false);
          }}
          onOpenComparison={() => {
            setIsCommandPaletteOpen(false);
            setIsComparisonOpen(true);
          }}
          onOpenCalendar={() => {
            setIsCommandPaletteOpen(false);
            setIsCalendarModalOpen(true);
          }}
          onPrintTranscript={() => {
            setIsCommandPaletteOpen(false);
            window.print();
          }}
          activeMajorId={activeMajorId}
        />

        {/* Course Comparison Drawer */}
        <CourseComparisonDrawer
          isOpen={isComparisonOpen}
          onClose={() => setIsComparisonOpen(false)}
          courses={courses}
          completedCourses={completedCourses}
          plannedCourses={plannedCourses}
          onToggleComplete={handleToggleComplete}
          onPlanCourse={handlePlanCourse}
        />

        {/* Academic Audit Official Printable A4 Document */}
        {(currentRoute === "plan" ||
          currentRoute === "semester-planning" ||
          currentRoute === "courses") && (
          <AcademicAuditPrint
            courses={courses}
            completedCourses={completedCourses}
            plannedCourses={plannedCourses}
            courseGrades={courseGrades}
            activeMajorName={activeMajorName}
            studentName={currentStudent?.studentName || "طالب جامعي"}
            studentId={currentStudent?.studentId || "—"}
            college={currentStudent?.college}
            totalCredits={degreeTotalCredits}
            currentStudent={currentStudent}
            categoryRequirements={categoryRequirements}
          />
        )}
      </React.Suspense>

      {/* Hidden file input for CSV Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleImportCsv}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
}

export default App;
