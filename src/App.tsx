import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import {
  X,
  Search,
  CircleCheckBig,
  Lock,
  BookOpen,
  Trash2,
  Target,
  Download,
  Printer,
  Upload,
  Pin,
  CalendarDays,
  MessageCircle,
  Map as MapIcon,
  LayoutList,
  Calculator,
  Link2,
} from "lucide-react";
import "@xyflow/react/dist/style.css";
import { courses, Course, ScheduleEntry, categoryRequirements } from "./data";

import { getLayoutedElements, cn } from "./utils";
import { getCourseDetails } from "./courseExplanations";

import { courseCommonNames, SEMESTERS, TOTAL_CREDITS } from "./constants";
import CourseNode from "./CourseNode";
import ListView from "./ListView";
import {
  fetchScheduleByCode,
  normalizeScheduleCode,
  shareScheduleToCloud,
  SharedScheduleSnapshot,
} from "./sharedSchedules";
import { toggleCompletedCourse } from "./courseProgress";
import { readAppStorageValue, serializeAppStorageValue } from "./appStorage";
import { escapeCsvValue, parseCsvRows } from "./csv";
import { ThemeStudio } from "./components/ThemeStudio";
import { ThemeManager } from "./themeManager";

const ExportModal = React.lazy(() => import("./components/ExportModal"));
const ResetConfirmationModal = React.lazy(
  () => import("./components/ResetConfirmationModal"),
);
const SupportModal = React.lazy(() => import("./components/SupportModal"));
const PlanningModeModal = React.lazy(
  () => import("./components/PlanningModeModal"),
);
const CourseListModal = React.lazy(
  () => import("./components/CourseListModal"),
);
const PlannerView = React.lazy(() => import("./components/PlannerView"));
const GPAModal = React.lazy(() =>
  import("./components/GPAModal").then((module) => ({
    default: module.GPAModal,
  })),
);
const WeeklyScheduleModal = React.lazy(() =>
  import("./components/WeeklyScheduleModal").then((module) => ({
    default: module.WeeklyScheduleModal,
  })),
);
const ShareScheduleModal = React.lazy(() =>
  import("./components/SharedScheduleModals").then((module) => ({
    default: module.ShareScheduleModal,
  })),
);
const LoadScheduleModal = React.lazy(() =>
  import("./components/SharedScheduleModals").then((module) => ({
    default: module.LoadScheduleModal,
  })),
);
const SharedSchedulePreviewModal = React.lazy(() =>
  import("./components/SharedScheduleModals").then((module) => ({
    default: module.SharedSchedulePreviewModal,
  })),
);
const modalLoadingFallback = (
  <div
    role="status"
    className="fixed inset-0 z-[120] flex items-center justify-center bg-white/80 font-bold text-slate-700 dark:bg-slate-950/80 dark:text-slate-200"
  >
    جارٍ تحميل النافذة...
  </div>
);
const STORAGE_ISSUE_EVENT = "planner:storage-issue";
let pendingStorageIssue: string | null = null;
let storageIssueListenerReady = false;
const themeManager = new ThemeManager();

function reportStorageIssue(message: string): void {
  if (typeof window !== "undefined") {
    if (!storageIssueListenerReady) pendingStorageIssue = message;
    window.dispatchEvent(
      new CustomEvent(STORAGE_ISSUE_EVENT, { detail: message }),
    );
  }
}

// تحسين: تمرير الـ edges كمعامل لجعل الدالة نقية (Pure Function) وقابلة للاختبار
export const getPathForCourse = (nodeId: string, edges: Edge[]) => {
  const ancestors = new Set<string>();
  const descendants = new Set<string>();
  const prerequisites = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();

  const addAdjacency = (
    adjacency: Map<string, string[]>,
    from: string,
    to: string,
  ) => {
    const neighbors = adjacency.get(from);
    if (neighbors) neighbors.push(to);
    else adjacency.set(from, [to]);
  };

  for (const edge of edges) {
    addAdjacency(prerequisites, edge.target, edge.source);
    addAdjacency(dependents, edge.source, edge.target);
  }

  const collectReachable = (
    adjacency: Map<string, string[]>,
    visited: Set<string>,
  ) => {
    const pending = [...(adjacency.get(nodeId) ?? [])];
    while (pending.length > 0) {
      const currentId = pending.pop()!;
      if (currentId === nodeId || visited.has(currentId)) continue;
      visited.add(currentId);
      pending.push(...(adjacency.get(currentId) ?? []));
    }
  };

  collectReachable(prerequisites, ancestors);
  collectReachable(dependents, descendants);

  return {
    ancestors,
    descendants,
    allPathNodeIds: new Set([
      nodeId,
      ...Array.from(ancestors),
      ...Array.from(descendants),
    ]),
  };
};

// Helper function to unify availability logic across the app
const isCourseAvailable = (
  course: Course,
  completed: Set<string>,
  categoryCredits: Record<string, number>,
  allCourses: Course[],
  currentPlannedCourses: Set<string> = new Set(), // New parameter for courses planned in the current semester
): boolean => {
  if (completed.has(course.id)) return false;

  // Check category requirements for electives
  const req = categoryRequirements[course.category] || 999;
  const comp = categoryCredits[course.category] || 0;
  if (comp >= req && course.category.includes("اختياري")) return false;

  // Check Prerequisites
  const prereqsMet = course.prerequisites.every((p) => completed.has(p));
  if (!prereqsMet) return false;

  // Check Co-requisites
  if (!course.coPrerequisites || course.coPrerequisites.length === 0)
    return true;
  return course.coPrerequisites.every((cpId) => {
    // A co-requisite is met if it's completed OR it's planned for the current semester
    if (completed.has(cpId) || currentPlannedCourses.has(cpId)) return true;

    // The co-requisite itself must be available (its prerequisites must be met)
    const cpCourse = allCourses.find((ac) => ac.id === cpId);
    if (!cpCourse) return false; // Co-requisite course not found

    // Check if the co-requisite's prerequisites are met (excluding itself if it's a co-requisite of itself, which shouldn't happen)
    return cpCourse.prerequisites.every((p) => completed.has(p));
  });
};

// Local storage hook
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    return readAppStorageValue(key, initialValue, reportStorageIssue);
  });
  const initialValueRef = useRef(storedValue);
  const hasChangedRef = useRef(false);

  useEffect(() => {
    if (!hasChangedRef.current) {
      if (Object.is(storedValue, initialValueRef.current)) return;
      hasChangedRef.current = true;
    }
    try {
      window.localStorage.setItem(key, serializeAppStorageValue(storedValue));
    } catch (error) {
      reportStorageIssue(
        "تعذر حفظ التغييرات على هذا الجهاز. تحقّق من مساحة التخزين المتاحة في المتصفح.",
      );
      console.error(`Unable to save localStorage key "${key}"`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue] as const;
}

// Generate nodes and edges
const initialNodes: Node[] = courses.map((course) => ({
  id: course.id,
  type: "courseNode",
  data: {
    label: course.name,
    id: course.id,
    credits: course.credits,
    category: course.category,
    commonName: courseCommonNames[course.id],
    availableSemesters: course.availableSemesters,
  },
  position: { x: 0, y: 0 },
}));

const initialEdges: Edge[] = [];
courses.forEach((course) => {
  course.prerequisites.forEach((prereqId) => {
    initialEdges.push({
      id: `${prereqId}-${course.id}`,
      source: prereqId,
      target: course.id,
      animated: false,
      style: { stroke: "#94a3b8", strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#94a3b8",
      },
    });
  });
  course.coPrerequisites?.forEach((coId) => {
    initialEdges.push({
      id: `${coId}-${course.id}`,
      source: coId,
      target: course.id,
      animated: false,
      label: "تزامني",
      style: { stroke: "#94a3b8", strokeWidth: 2, strokeDasharray: "5,5" },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#94a3b8",
      },
    });
  });
});

const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
  initialNodes,
  initialEdges,
  "RL", // Right to left
);

const graphExtent = layoutedNodes.reduce(
  (bounds, node) => ({
    minX: Math.min(bounds.minX, node.position.x),
    minY: Math.min(bounds.minY, node.position.y),
    maxX: Math.max(bounds.maxX, node.position.x + 256),
    maxY: Math.max(bounds.maxY, node.position.y + 280),
  }),
  { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
);
const graphPadding = 300;
const nodeExtent: [[number, number], [number, number]] = [
  [graphExtent.minX - graphPadding, graphExtent.minY - graphPadding],
  [graphExtent.maxX + graphPadding, graphExtent.maxY + graphPadding],
];

const nodeTypes = {
  courseNode: CourseNode,
};

const CSV_HEADERS = [
  "رقم المادة",
  "اسم المادة",
  "التصنيف",
  "الساعات",
  "الحالة",
];

function FlowComponent() {
  const [storageIssue, setStorageIssue] = useState<string | null>(null);
  const [csvImportError, setCsvImportError] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"map" | "list">(() =>
    window.matchMedia("(max-width: 639px)").matches ? "list" : "map",
  );
  const [listGroupBy, setListGroupBy] = useState<"category" | "semester">(
    "semester",
  );
  const [pinnedCourseId, setPinnedCourseId] = useState<string | null>(null);
  const [completedCourses, setCompletedCourses] = useLocalStorage<Set<string>>(
    "completed_courses",
    new Set(),
  );
  const [plannedCourses, setPlannedCourses] = useLocalStorage<
    Record<string, string>
  >("planned_courses", {});
  const [weeklySchedule, setWeeklySchedule] = useLocalStorage<
    Record<string, Record<string, ScheduleEntry>>
  >("weekly_schedule", {});
  const [selectedElectives, setSelectedElectives] = useLocalStorage<
    Record<string, string>
  >("selected_electives_map", {
    univ_1: "13020001",
    univ_2: "13020009",
    univ_3: "13020026",
    spec_1: "12140416",
    spec_2: "12140549",
    spec_3: "12140505",
    spec_4: "12140510",
    spec_5: "12140526",
  });
  const [isPlanningModeOpen, setIsPlanningModeOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [isWeeklyScheduleOpen, setIsWeeklyScheduleOpen] = useState(false);
  const [isShareScheduleOpen, setIsShareScheduleOpen] = useState(false);
  const [isLoadScheduleOpen, setIsLoadScheduleOpen] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [loadLoading, setLoadLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedSchedule, setLoadedSchedule] = useState<{
    code: string;
    schedule: SharedScheduleSnapshot;
    viewCountWarning?: string;
  } | null>(null);
  const sharedLinkAutoLoadPromiseRef = useRef<ReturnType<
    typeof fetchScheduleByCode
  > | null>(null);
  const [currentPlanningSemester, setCurrentPlanningSemester] = useState<
    string | null
  >(null);
  const [isCourseListModalOpen, setIsCourseListModalOpen] = useState(false);
  const [isGPAModalOpen, setIsGPAModalOpen] = useState(false);
  const [courseListTab, setCourseListTab] = useState<
    "available" | "completed" | "all"
  >("available");
  const [expandedCourseListCategories, setExpandedCourseListCategories] =
    useState<Record<string, boolean>>({});
  const [hasHighGpa, setHasHighGpa] = useState(false);
  const [expandedPlanningCategories, setExpandedPlanningCategories] = useState<
    Record<string, boolean>
  >({});
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [planningCourseId, setPlanningCourseId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"available" | "completed" | "all">(
    "available",
  );
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [planStartSemester, setPlanStartSemester] = useLocalStorage<string>(
    "plan_start_semester",
    SEMESTERS[0],
  );
  const [planEndSemester, setPlanEndSemester] = useLocalStorage<string>(
    "plan_end_semester",
    SEMESTERS[SEMESTERS.length - 1],
  );
  const [hidePastSemesters, setHidePastSemesters] = useLocalStorage<boolean>(
    "hide_past_semesters",
    true,
  );
  // Removed showAllInMap state, it will be implicitly true
  const [isDarkMode, setIsDarkMode] = useState(() => {
    themeManager.initialize();
    return themeManager.isDarkMode;
  });

  const [courseGrades, setCourseGrades] = useLocalStorage<
    Record<string, number>
  >("course_grades", {});

  const [failedCourseIds, setFailedCourseIds] = useLocalStorage<string[]>(
    "failed_course_ids",
    [],
  );

  useEffect(() => {
    const handleStorageIssue = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      if (message) setStorageIssue(message);
    };
    storageIssueListenerReady = true;
    window.addEventListener(STORAGE_ISSUE_EVENT, handleStorageIssue);
    if (pendingStorageIssue) {
      setStorageIssue(pendingStorageIssue);
      pendingStorageIssue = null;
    }
    return () => {
      storageIssueListenerReady = false;
      window.removeEventListener(STORAGE_ISSUE_EVENT, handleStorageIssue);
    };
  }, []);

  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);

  const hoveredPath = useMemo(() => {
    if (!hoveredCourseId) return null;
    // استخدام layoutedEdges بدلاً من الاعتماد على متغير خارجي
    return getPathForCourse(hoveredCourseId, layoutedEdges);
  }, [hoveredCourseId, layoutedEdges]);

  const handleThemeStateChange = (isDark: boolean) => {
    setIsDarkMode(isDark);
  };
  const { fitView, setCenter } = useReactFlow();

  useEffect(() => {
    if (viewMode !== "map") return;
    const frame = window.requestAnimationFrame(() => {
      const isMobile = window.matchMedia("(max-width: 639px)").matches;
      void fitView({
        padding: isMobile ? 0.12 : 0.05,
        duration: isMobile ? 0 : 500,
      }).catch((error: unknown) =>
        console.error("Unable to fit course map to view", error),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fitView, viewMode]);

  const activeCourses = useMemo(() => {
    // Since we are always in "كامل المنهاج", all courses are active regardless of elective selection
    return courses;
  }, []); // No dependency on selectedElectives anymore

  const pinnedPath = useMemo(() => {
    if (!pinnedCourseId) return null;
    return getPathForCourse(pinnedCourseId, layoutedEdges);
  }, [pinnedCourseId]);

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const localStorageKeys = [
    "completed_courses",
    "planned_courses",
    "weekly_schedule",
    "prioritized_electives",
    "selected_electives_map",
    "plan_start_semester",
    "plan_end_semester",
    "hide_past_semesters",
    "dark_mode",
    "planner_theme",
    "active_theme_type",
    "active_preset_name",
    "active_custom_tokens",
    "user_saved_themes",
    "course_grades",
    "course_repeats",
    "failed_course_ids",
    "last_shared_schedule",
  ];

  const confirmReset = () => {
    try {
      localStorageKeys.forEach((key) => window.localStorage.removeItem(key));
    } catch (error) {
      reportStorageIssue(
        "تعذرت تهيئة الخطة لأن المتصفح منع حذف البيانات المحفوظة.",
      );
      console.error("Unable to reset local plan storage", error);
      setShowResetConfirm(false);
      return;
    }
    window.location.reload();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateSharedLink = useCallback(async () => {
    setShareLoading(true);
    setShareError(null);
    setShareCode(null);
    try {
      const snapshot: SharedScheduleSnapshot = {
        version: 2,
        name: "خطة الطالب",
        exportedAt: new Date().toISOString(),
        plannedCourses: { ...plannedCourses },
        completedCourses: courses
          .filter((course) => completedCourses.has(course.id))
          .map((course) => ({
            courseCode: course.id,
            courseName: course.name,
            credits: course.credits,
            category: course.category,
            grade: courseGrades[course.id] ?? null,
          })),
        courseGrades: { ...courseGrades },
        failedCourseIds: [...failedCourseIds],
        selectedElectives: { ...selectedElectives },
        preferences: {
          planStartSemester,
          planEndSemester,
          hidePastSemesters,
          darkMode: isDarkMode,
        },
        weeklySchedule: Object.fromEntries(
          Object.entries(weeklySchedule).map(([semester, entries]) => [
            semester,
            Object.fromEntries(
              Object.entries(entries).map(([courseId, entry]) => [
                courseId,
                {
                  courseId,
                  startTime: entry.startTime,
                  endTime: entry.endTime,
                  section: entry.section ?? "",
                  instructor: entry.instructor ?? "",
                  room: entry.room ?? "",
                  days: entry.days ?? (entry.day ? [entry.day] : []),
                },
              ]),
            ),
          ]),
        ),
        courses: courses.map((course) => {
          const semester = plannedCourses[course.id] ?? "";
          const entry = semester
            ? weeklySchedule[semester]?.[course.id]
            : undefined;
          return {
            courseId: course.id,
            courseCode: course.id,
            courseName: course.name,
            credits: course.credits,
            category: course.category,
            prerequisites: [...course.prerequisites],
            seasonal: course.seasonal,
            availableSemesters: course.availableSemesters
              ? [...course.availableSemesters]
              : undefined,
            resourceLink: course.resourceLink,
            semester,
            color: "#3b82f6",
            section: entry?.section ?? "",
            startTime: entry?.startTime ?? "",
            endTime: entry?.endTime ?? "",
            days: entry?.days ?? (entry?.day ? [entry.day] : []),
            instructor: entry?.instructor ?? "",
            room: entry?.room ?? entry?.location ?? "",
            completed: completedCourses.has(course.id),
            failed: failedCourseIds.includes(course.id),
            grade: courseGrades[course.id] ?? null,
          };
        }),
      };
      const code = await shareScheduleToCloud(snapshot);
      setShareCode(code);
    } catch (error) {
      setShareError(
        error instanceof Error ? error.message : "تعذر إنشاء رابط المشاركة.",
      );
    } finally {
      setShareLoading(false);
    }
  }, [
    completedCourses,
    courseGrades,
    failedCourseIds,
    hidePastSemesters,
    isDarkMode,
    planEndSemester,
    planStartSemester,
    plannedCourses,
    selectedElectives,
    weeklySchedule,
  ]);

  const handleLoadSharedSchedule = useCallback(async (value: string) => {
    setLoadLoading(true);
    setLoadError(null);
    const code = normalizeScheduleCode(value);
    try {
      const result = await fetchScheduleByCode(code);
      setLoadedSchedule(result);
      setIsLoadScheduleOpen(false);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "تعذر جلب الجدول. تحقق من الاتصال والرمز.",
      );
      setIsLoadScheduleOpen(true);
    } finally {
      setLoadLoading(false);
    }
  }, []);

  const applySharedSchedule = useCallback(() => {
    if (!loadedSchedule) return;

    const { schedule } = loadedSchedule;
    const knownCourseIds = new Set(courses.map((course) => course.id));
    const importedPlans = Object.fromEntries(
      Object.entries(schedule.plannedCourses).filter(([courseId]) =>
        knownCourseIds.has(courseId),
      ),
    );
    const importedWeeklySchedule = Object.fromEntries(
      Object.entries(schedule.weeklySchedule).map(([semester, entries]) => [
        semester,
        Object.fromEntries(
          Object.entries(entries)
            .filter(([courseId]) => knownCourseIds.has(courseId))
            .map(([courseId, entry]) => [
              courseId,
              { ...entry } satisfies ScheduleEntry,
            ]),
        ),
      ]),
    ) as Record<string, Record<string, ScheduleEntry>>;

    setPlannedCourses(importedPlans);
    setWeeklySchedule(importedWeeklySchedule);
    setCompletedCourses(
      new Set(
        schedule.completedCourses
          .map(
            (sharedCourse) =>
              courses.find((course) => course.id === sharedCourse.courseCode)
                ?.id,
          )
          .filter((courseId): courseId is string => !!courseId),
      ),
    );
    setCourseGrades(schedule.courseGrades ?? {});
    setFailedCourseIds(
      (schedule.failedCourseIds ?? []).filter((id) => knownCourseIds.has(id)),
    );
    if (schedule.selectedElectives) {
      setSelectedElectives(schedule.selectedElectives);
    }
    if (schedule.preferences) {
      setPlanStartSemester(schedule.preferences.planStartSemester);
      setPlanEndSemester(schedule.preferences.planEndSemester);
      setHidePastSemesters(schedule.preferences.hidePastSemesters);
      const nextTheme = schedule.preferences.darkMode
        ? "deep-navy"
        : "warm-ivory";
      themeManager.setTheme(nextTheme);
      setIsDarkMode(themeManager.isDarkMode);
    }
    setLoadedSchedule(null);
  }, [
    loadedSchedule,
    setCompletedCourses,
    setCourseGrades,
    setFailedCourseIds,
    setHidePastSemesters,
    setPlanEndSemester,
    setPlanStartSemester,
    setPlannedCourses,
    setSelectedElectives,
    setWeeklySchedule,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") ?? params.get("s");
    if (!code) return;

    let cancelled = false;
    setLoadLoading(true);
    const loadPromise =
      sharedLinkAutoLoadPromiseRef.current ?? fetchScheduleByCode(code);
    sharedLinkAutoLoadPromiseRef.current = loadPromise;

    void (async () => {
      try {
        const schedule = await loadPromise;
        if (cancelled) return;
        setLoadedSchedule(schedule);
      } catch (error: unknown) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : "تعذر فتح رابط الجدول.",
        );
        setIsLoadScheduleOpen(true);
      } finally {
        if (!cancelled) setLoadLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImportError(null);
    if (file.size > 5 * 1024 * 1024) {
      setCsvImportError("حجم الملف يتجاوز الحد المسموح (5 ميغابايت).");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== "string") {
          setCsvImportError("تعذرت قراءة محتوى الملف.");
          return;
        }
        let rows: string[][];
        try {
          rows = parseCsvRows(result);
        } catch (error) {
          setCsvImportError(
            error instanceof Error ? error.message : "صيغة ملف CSV غير صالحة.",
          );
          return;
        }
        const [header, ...records] = rows;
        if (
          header?.length !== CSV_HEADERS.length ||
          header.some((value, index) => value.trim() !== CSV_HEADERS[index])
        ) {
          setCsvImportError(
            "صيغة الملف غير مدعومة. استخدم ملف CSV المُصدّر من الموقع.",
          );
          return;
        }

        const knownCourseIds = new Set(courses.map((course) => course.id));
        const importedCourseIds = new Set<string>();
        for (const row of records) {
          if (row.every((value) => value.trim() === "")) continue;
          if (row.length !== 5) {
            setCsvImportError(
              "أحد صفوف CSV لا يحتوي على الأعمدة الخمسة المطلوبة.",
            );
            return;
          }
          const courseId = row[0].trim();
          if (!knownCourseIds.has(courseId)) {
            setCsvImportError(
              `رقم المادة ${courseId || "(فارغ)"} غير موجود في المنهاج الحالي.`,
            );
            return;
          }
          const status = row[4].trim();
          if (status !== "منجز" && status !== "غير منجز") {
            setCsvImportError(`حالة المادة ${courseId} غير صالحة.`);
            return;
          }
          if (status === "منجز") importedCourseIds.add(courseId);
        }

        setCompletedCourses(
          (previous) => new Set([...previous, ...importedCourseIds]),
        );
        setCsvImportError(null);
      } catch (error) {
        setCsvImportError(
          error instanceof Error ? error.message : "تعذّر استيراد ملف CSV.",
        );
        console.error("Unable to import CSV plan", error);
      }
    };
    reader.onerror = () => {
      setCsvImportError("تعذّرت قراءة الملف. تحقق من الملف ثم حاول مرة أخرى.");
      console.error("Unable to read CSV file", reader.error);
    };
    reader.onabort = () =>
      setCsvImportError("أُلغيت قراءة الملف قبل اكتمالها.");
    try {
      reader.readAsText(file);
    } catch (error) {
      setCsvImportError(
        error instanceof Error
          ? error.message
          : "تعذّرت قراءة الملف. تحقق من الملف ثم حاول مرة أخرى.",
      );
      console.error("Unable to start reading CSV file", error);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExportCsv = () => {
    const headers = CSV_HEADERS.map(escapeCsvValue).join(",");
    const rows = courses.map((course) => {
      const isCompleted = completedCourses.has(course.id);
      const status = isCompleted ? "منجز" : "غير منجز";
      return [course.id, course.name, course.category, course.credits, status]
        .map(escapeCsvValue)
        .join(",");
    });

    // Add BOM for UTF-8 correctly opening in Excel
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

  const completedCreditsPerCategory = useMemo(() => {
    return activeCourses.reduce(
      (acc, course) => {
        if (completedCourses.has(course.id)) {
          acc[course.category] = (acc[course.category] || 0) + course.credits;
        }
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [completedCourses, activeCourses]);

  const matchingSearchCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return courses.filter(
      (course) =>
        course.name.toLowerCase().includes(query) ||
        course.id.toLowerCase().includes(query) ||
        (courseCommonNames[course.id] ?? "").toLowerCase().includes(query),
    );
  }, [searchQuery]);

  // Compute available courses
  const availableCourses = useMemo(() => {
    return courses.filter((course) =>
      isCourseAvailable(
        course,
        completedCourses,
        completedCreditsPerCategory,
        courses,
      ),
    );
  }, [completedCourses, completedCreditsPerCategory, courses]);
  const availableCourseIds = useMemo(
    () => new Set(availableCourses.map((course) => course.id)),
    [availableCourses],
  );

  const groupedCourseList = useMemo(() => {
    let list: Course[];
    if (courseListTab === "available") list = availableCourses;
    else if (courseListTab === "completed")
      list = activeCourses.filter((c) => completedCourses.has(c.id));
    else list = courses; // Show all 123 courses in the "All" tab

    return list.reduce(
      (acc, course) => {
        if (!acc[course.category]) acc[course.category] = [];
        acc[course.category].push(course);
        return acc;
      },
      {} as Record<string, Course[]>,
    );
  }, [courseListTab, availableCourses, activeCourses, completedCourses]);

  const completedCredits = useMemo(() => {
    return activeCourses.reduce((acc, course) => {
      if (completedCourses.has(course.id)) {
        return acc + course.credits;
      }
      return acc;
    }, 0);
  }, [completedCourses, activeCourses]);

  const plannedCredits = useMemo(() => {
    return activeCourses.reduce((acc, course) => {
      if (!completedCourses.has(course.id) && plannedCourses[course.id]) {
        return acc + course.credits;
      }
      return acc;
    }, 0);
  }, [completedCourses, plannedCourses, activeCourses]);

  const plannedCreditsPerCategory = useMemo(() => {
    return courses.reduce(
      (acc, course) => {
        if (!completedCourses.has(course.id) && plannedCourses[course.id]) {
          acc[course.category] = (acc[course.category] || 0) + course.credits;
        }
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [plannedCourses, completedCourses]);

  const progressPercentage =
    Math.round((completedCredits / TOTAL_CREDITS) * 100) || 0;
  const plannedPercentage =
    Math.round((plannedCredits / TOTAL_CREDITS) * 100) || 0;

  const toggleCourseCompletion = useCallback(
    (courseId: string) => {
      setCompletedCourses((previous) =>
        toggleCompletedCourse(previous, courseId),
      );
    },
    [setCompletedCourses],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setIsDetailsOpen(false);
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setIsDetailsOpen(false); // الضغط على البطاقة في الخريطة يظهر المسار فقط ويغلق نافذة التفاصيل
  }, []);

  const openDetails = useCallback((id: string) => {
    setSelectedNodeId(id);
    setIsDetailsOpen(true); // يفتح نافذة التفاصيل السفلية عند الضغط على زر المعلومات فقط
  }, []);

  const focusNode = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (node) {
        void setCenter(node.position.x + 100, node.position.y + 50, {
          zoom: 1.5,
          duration: 800,
        }).catch((error: unknown) =>
          console.error("Unable to center map on course", error),
        );
        setSelectedNodeId(id);
      }
      // Close sidebar on mobile but maybe not on desktop
      if (window.innerWidth < 640) {
        setIsSidebarOpen(false);
      }
    },
    [nodes, setCenter],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.querySelector('[role="dialog"][aria-modal="true"]'))
          return;
        setIsSidebarOpen(false);
        setSelectedNodeId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (viewMode !== "map") return;

    const ancestors = new Set<string>();
    const descendants = new Set<string>();
    const directPrereqs = new Set<string>();
    const directDeps = new Set<string>();

    // Use hoveredCourseId for hover effect, or selectedNodeId for click effect
    const activeNodeId = hoveredCourseId || selectedNodeId;

    if (activeNodeId) {
      // استخراج المنطق لدالة getPathForCourse التي قمنا بتحسينها بالأعلى
      const { ancestors: anc, descendants: des } = getPathForCourse(
        activeNodeId,
        layoutedEdges,
      );
      anc.forEach((id) => ancestors.add(id));
      des.forEach((id) => descendants.add(id));

      layoutedEdges.forEach((e) => {
        if (e.target === activeNodeId) {
          directPrereqs.add(e.source);
        }
        if (e.source === activeNodeId) {
          directDeps.add(e.target);
        }
      });
    }

    setNodes((nds) =>
      nds.map((n) => {
        const isCompleted = completedCourses.has(n.id);
        const isAvailable = availableCourseIds.has(n.id);
        const plannedSemester = plannedCourses[n.id];
        const isPlanned = !!plannedSemester && !isCompleted;

        let isSelected = false;
        let isAncestor = false;
        let isDescendant = false;
        let isDirectPrereq = false;
        let isDirectDep = false;
        let opacity = 1;
        if (activeNodeId) {
          isSelected = n.id === activeNodeId;
          isAncestor = ancestors.has(n.id);
          isDescendant = descendants.has(n.id);
          isDirectPrereq = directPrereqs.has(n.id);
          isDirectDep = directDeps.has(n.id);
          // Dim all nodes except the active path
          opacity =
            n.id === activeNodeId ||
            ancestors.has(n.id) ||
            descendants.has(n.id)
              ? 1
              : 0.15;
        }

        return {
          ...n,
          hidden: false,
          data: {
            ...n.data,
            isSelected,
            isAncestor,
            isDescendant,
            isDirectPrereq,
            isDirectDep,
            isCompleted,
            isPlanned,
            plannedSemester,
            isAvailable,
            opacity,
            toggleCompleted: () => toggleCourseCompletion(n.id),
            showDetails: () => openDetails(n.id),
            onPlan: () => {
              setPlanningCourseId(n.id);
              setIsPlannerOpen(true);
            },
            onHoverStart: () => setHoveredCourseId(n.id),
            onHoverEnd: () => setHoveredCourseId(null),
          },
        };
      }),
    );

    setEdges((eds) => {
      return eds.map((e) => {
        if (!activeNodeId) {
          return {
            ...e,
            animated: false,
            style: { stroke: "#94A3B8", strokeWidth: 2, opacity: 1 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" },
          };
        }

        const isAncestorEdge =
          ancestors.has(e.source) &&
          (ancestors.has(e.target) || e.target === activeNodeId);
        const isDescendantEdge =
          (descendants.has(e.source) || e.source === activeNodeId) &&
          descendants.has(e.target);

        const isDirectPrereqEdge = e.target === activeNodeId;
        const isDirectDepEdge = e.source === activeNodeId;

        if (isDirectPrereqEdge) {
          return {
            ...e,
            animated: true,
            style: { stroke: "#6366F1", strokeWidth: 3, opacity: 1 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#6366F1" },
          };
        }
        if (isDirectDepEdge) {
          return {
            ...e,
            animated: true,
            style: { stroke: "#6366F1", strokeWidth: 3, opacity: 1 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#6366F1" },
          };
        }
        if (isAncestorEdge || isDescendantEdge) {
          return {
            ...e,
            animated: false,
            style: { stroke: "#6366F1", strokeWidth: 2, opacity: 0.8 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#6366F1" },
          };
        }
        return {
          ...e,
          animated: false,
          style: { stroke: "#94A3B8", strokeWidth: 1.5, opacity: 0.2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" },
        };
      });
    });
  }, [
    selectedNodeId,
    hoveredCourseId,
    viewMode,
    setNodes,
    setEdges,
    completedCourses,
    plannedCourses,
    availableCourseIds,
    toggleCourseCompletion,
    openDetails,
    layoutedEdges,
  ]);

  return (
    <div
      className={cn(
        "app-shell w-full h-dvh print:h-auto overflow-hidden print:overflow-visible flex flex-col font-sans p-0 sm:p-4 print:p-0 transition-colors duration-300",
        isDarkMode ? "dark" : "",
      )}
      dir="rtl"
    >
      {storageIssue && (
        <div
          role="alert"
          className="fixed inset-x-3 top-3 z-[200] mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 shadow-lg"
        >
          <span>{storageIssue}</span>
          <button
            type="button"
            onClick={() => setStorageIssue(null)}
            className="shrink-0 rounded-lg px-2 py-1 text-amber-900 hover:bg-amber-100"
            aria-label="إغلاق تنبيه التخزين"
          >
            إغلاق
          </button>
        </div>
      )}
      {csvImportError && (
        <div
          role="alert"
          className="fixed inset-x-3 top-20 z-[200] mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-900 shadow-lg"
        >
          <span>{csvImportError}</span>
          <button
            type="button"
            onClick={() => setCsvImportError(null)}
            className="shrink-0 rounded-lg px-2 py-1 text-red-900 hover:bg-red-100"
            aria-label="إغلاق تنبيه استيراد الملف"
          >
            إغلاق
          </button>
        </div>
      )}
      <div className="print:hidden w-full h-full min-h-0 flex flex-col">
        {/* Header Section */}
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-2 sm:mb-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl p-3 sm:p-6 rounded-b-none sm:rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-slate-900/50 border-b sm:border border-gray-200/50 dark:border-slate-700/50 z-10 shrink-0 gap-3 sm:gap-4 transition-all">
          <div className="flex justify-between items-start w-full xl:w-auto gap-4">
            <div>
              <div className="mb-1">
                <h1 className="flex items-center gap-2 text-sm sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                  <BookOpen
                    className="text-blue-600 dark:text-blue-400 hidden sm:block"
                    size={24}
                  />
                  خريطة المتطلبات الأكاديمية
                </h1>
                <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:gap-2 sm:mt-1">
                  <button
                    onClick={() => {
                      setIsPlanningModeOpen(true);
                      setSelectedNodeId(null);
                      setIsDetailsOpen(false);
                      setHoveredCourseId(null);
                      setPlanningCourseId(null);
                    }}
                    className="flex min-h-10 items-center justify-center gap-1.5 px-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-sm bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl transition-all duration-200 cursor-pointer shadow-lg shadow-indigo-200/50 dark:shadow-indigo-900/30 hover:shadow-xl hover:shadow-indigo-300/60 dark:hover:shadow-indigo-900/50 hover:-translate-y-0.5 font-extrabold"
                  >
                    <MapIcon size={16} />
                    وضع التخطيط
                  </button>
                  <button
                    onClick={() => {
                      setIsCourseListModalOpen(true);
                      setSelectedNodeId(null);
                      setIsDetailsOpen(false);
                      setHoveredCourseId(null);
                    }}
                    className="flex min-h-10 items-center justify-center gap-1.5 px-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-sm bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all duration-200 cursor-pointer shadow-lg shadow-blue-200/50 dark:shadow-blue-900/30 hover:shadow-xl hover:shadow-blue-300/60 dark:hover:shadow-blue-900/50 hover:-translate-y-0.5 font-extrabold"
                  >
                    <LayoutList size={16} />
                    قائمة المواد
                  </button>
                  <button
                    onClick={() => {
                      setIsGPAModalOpen(true);
                      setSelectedNodeId(null);
                      setIsDetailsOpen(false);
                      setHoveredCourseId(null);
                    }}
                    className="flex min-h-10 items-center justify-center gap-1.5 px-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-sm bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white rounded-xl transition-all duration-200 cursor-pointer shadow-lg shadow-violet-200/50 dark:shadow-violet-900/30 hover:shadow-xl hover:shadow-violet-300/60 dark:hover:shadow-violet-900/50 hover:-translate-y-0.5 font-extrabold"
                  >
                    <Calculator size={16} />
                    <span className="sm:hidden">المعدل</span>
                    <span className="hidden sm:inline">المعدل والدرجات</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPlannerOpen(true);
                      setSelectedNodeId(null);
                      setIsDetailsOpen(false);
                      setHoveredCourseId(null);
                      setPlanningCourseId(null);
                    }}
                    className="flex min-h-10 items-center justify-center gap-1.5 px-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-sm bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white dark:from-orange-500 dark:to-orange-600 dark:hover:from-orange-600 dark:hover:to-orange-700 rounded-xl transition-all duration-200 cursor-pointer shadow-lg shadow-orange-200/50 dark:shadow-orange-900/30 hover:shadow-xl hover:shadow-orange-300/60 dark:hover:shadow-orange-900/50 hover:-translate-y-0.5 font-extrabold"
                  >
                    <CalendarDays size={14} className="sm:hidden" />
                    <CalendarDays size={16} className="hidden sm:block" />
                    <span className="sm:hidden">الخطة</span>
                    <span className="hidden sm:inline">عرض الخطة</span>
                  </button>
                  <button
                    onClick={() => setIsWeeklyScheduleOpen(true)}
                    className="flex min-h-10 items-center justify-center gap-1.5 px-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-sm bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white dark:from-cyan-600 dark:to-cyan-700 dark:hover:from-cyan-700 dark:hover:to-cyan-800 rounded-xl transition-all duration-200 cursor-pointer shadow-lg shadow-cyan-200/50 dark:shadow-cyan-900/30 hover:shadow-xl hover:shadow-cyan-300/60 dark:hover:shadow-cyan-900/50 hover:-translate-y-0.5 font-extrabold"
                  >
                    <CalendarDays size={14} className="sm:hidden" />
                    <CalendarDays size={16} className="hidden sm:block" />
                    <span className="sm:hidden">الجدول</span>
                    <span className="hidden sm:inline">الجدول الأسبوعي</span>
                  </button>
                  <button
                    onClick={() => {
                      setShareCode(null);
                      setShareError(null);
                      setIsShareScheduleOpen(true);
                    }}
                    className="flex min-h-10 items-center justify-center gap-1.5 px-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-sm bg-violet-100 hover:bg-violet-200 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300 dark:hover:bg-violet-800/60 rounded-xl transition-colors cursor-pointer shadow-sm font-bold"
                    title="إنشاء رابط أو رمز QR لفتح الخطة على جهاز آخر"
                  >
                    <Link2 size={15} />
                    <span className="sm:hidden">مشاركة</span>
                    <span className="hidden sm:inline">
                      مشاركة / فتح على الجوال
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setLoadError(null);
                      setIsLoadScheduleOpen(true);
                    }}
                    className="flex min-h-10 items-center justify-center gap-1.5 px-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer shadow-sm font-bold"
                    title="فتح خطة مشتركة باستخدام رمز أو رابط"
                  >
                    <Search size={15} />
                    <span className="sm:hidden">استرجاع</span>
                    <span className="hidden sm:inline">استرجاع برمز</span>
                  </button>

                  <button
                    onClick={() => setIsSupportModalOpen(true)}
                    className="flex min-h-10 items-center justify-center gap-1.5 px-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white dark:from-emerald-600 dark:to-emerald-700 dark:hover:from-emerald-700 dark:hover:to-emerald-800 rounded-xl transition-all duration-200 cursor-pointer shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30 hover:shadow-xl hover:shadow-emerald-300/60 dark:hover:shadow-emerald-900/50 hover:-translate-y-0.5 font-extrabold"
                    title="الدعم والاقتراحات"
                  >
                    <MessageCircle
                      size={14}
                      className="text-emerald-600 dark:text-emerald-400 sm:hidden"
                    />
                    <MessageCircle
                      size={16}
                      className="text-emerald-600 dark:text-emerald-400 hidden sm:block"
                    />
                    <span className="hidden sm:inline">الدعم والاقتراحات</span>
                    <span className="sm:hidden">الدعم</span>
                  </button>
                </div>
              </div>
              <p className="text-[10px] sm:text-sm text-gray-600 dark:text-slate-400 uppercase font-bold flex items-center gap-2">
                تخصص هندسة أنظمة الحاسوب{" "}
                <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"></span>{" "}
                جامعة فلسطين التقنية - خضوري (PTUK)
              </p>
              <div className="mt-2 hidden sm:flex items-center gap-2 text-[10px] font-extrabold text-amber-700 dark:text-amber-300 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 px-4 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800/50 shadow-md shadow-amber-200/30 dark:shadow-amber-900/20 w-fit animate-in fade-in slide-in-from-right-2 duration-500">
                <Pin size={12} className="rotate-25" />
                <span>
                  ملاحظة: عند تثبيت المادة، يظهر كامل المسار المعتمد عليها
                  والمتطلبات السابقة.
                </span>
              </div>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="w-full xl:w-auto grid grid-cols-[1fr_auto] items-center gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <div className="relative group col-span-2 min-w-0 sm:col-span-1 sm:flex-1 sm:min-w-45 sm:w-64">
              <Search
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"
                size={16}
              />
              <input
                type="text"
                aria-label="ابحث عن مادة أو رقمها"
                aria-controls="course-search-results"
                aria-expanded={searchQuery.length > 0}
                placeholder="ابحث عن مادة أو رقم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-11 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 border border-gray-200 dark:border-slate-700 dark:text-slate-200 rounded-xl pl-3 pr-10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-lg shadow-gray-200/30 dark:shadow-slate-900/30"
              />
              {searchQuery && (
                <div
                  id="course-search-results"
                  role="region"
                  aria-label="نتائج البحث عن المواد"
                  className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden z-50 max-h-60 overflow-y-auto"
                  dir="rtl"
                >
                  {matchingSearchCourses.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className="w-full text-right px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 text-sm border-b border-gray-50 dark:border-slate-750 last:border-0 transition-colors flex justify-between items-center cursor-pointer"
                      onClick={() => {
                        focusNode(c.id);
                        setSearchQuery("");
                      }}
                    >
                      <span className="font-semibold text-gray-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                        <span>{c.name}</span>
                        {courseCommonNames[c.id] && (
                          <span className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-150 dark:border-blue-800 font-bold">
                            {courseCommonNames[c.id]}
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] bg-gray-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-gray-500 dark:text-slate-500 font-mono shrink-0">
                        {c.id}
                      </span>
                    </button>
                  ))}
                  {matchingSearchCourses.length === 0 && (
                    <p
                      role="status"
                      className="p-4 text-center text-sm text-gray-500"
                    >
                      لا توجد نتائج
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* تبديل عرض الخريطة / القواسم العمودية */}
            <div className="flex bg-gray-150 dark:bg-slate-850 p-1 rounded-xl border border-gray-200 dark:border-slate-700 min-h-11 shrink-0">
              <button
                onClick={() => setViewMode("map")}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer",
                  viewMode === "map"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-850 dark:hover:text-slate-200",
                )}
                title="عرض الخريطة التفاعلية"
              >
                <MapIcon size={14} />
                <span className="hidden sm:inline">الخريطة التفاعلية</span>
                <span className="sm:hidden">خريطة</span>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer",
                  viewMode === "list"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-850",
                )}
                title="عرض المواد في قوائم عمودية"
              >
                <LayoutList size={14} />
                <span className="hidden sm:inline">قوائم عمودية</span>
                <span className="sm:hidden">قائمة</span>
              </button>
            </div>

            <ThemeStudio
              manager={themeManager}
              onThemeStateChange={handleThemeStateChange}
            />

            <button
              onClick={handleReset}
              className="hidden sm:flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg transition-colors h-9.5"
            >
              <Trash2 size={16} /> ممحاة
            </button>

            <div className="flex-col hidden lg:flex bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700 rounded-lg px-4 py-1.5 min-w-50">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-gray-600 dark:text-slate-300">
                  نسبة الإنجاز
                </span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  {progressPercentage}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
                {/* الشريط البرتقالي: يمثل المنجز + المخطط له كخلفية متصلة */}
                <div
                  className="absolute right-0 top-0 h-full bg-orange-400 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${progressPercentage + plannedPercentage}%`,
                  }}
                ></div>
                {/* الشريط الأزرق: يركب فوق البرتقالي ليمثل المنجز فقط */}
                <div
                  className="absolute right-0 top-0 h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-gray-400 dark:text-slate-400 mt-1 flex justify-between">
                <span>
                  {completedCredits} ساعات منجزة{" "}
                  {plannedCredits > 0 && (
                    <span className="text-orange-500 font-bold">
                      + {plannedCredits} محددة
                    </span>
                  )}
                </span>
                <span>المجموع: {TOTAL_CREDITS}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div
          className="flex-1 min-h-0 min-w-0 w-full sm:mx-0 relative bg-white dark:bg-slate-900 sm:rounded-xl shadow-sm border-t sm:border border-gray-200 dark:border-slate-800 overflow-hidden flex flex-col"
          dir="ltr"
        >
          <>
            {viewMode === "map" && (
              <div className="absolute inset-0">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={onNodeClick}
                  onPaneClick={onPaneClick}
                  nodeTypes={nodeTypes}
                  onlyRenderVisibleElements
                  nodeExtent={nodeExtent}
                  translateExtent={nodeExtent}
                  elevateNodesOnSelect={false}
                  minZoom={0.05}
                  maxZoom={1.5}
                  attributionPosition="bottom-left"
                >
                  <Background
                    color={isDarkMode ? "#334155" : "#e5e7eb"}
                    gap={20}
                    size={2}
                  />
                  <Controls
                    className="bg-white dark:bg-slate-800 dark:border-slate-700 shadow-md rounded-md border border-gray-200 dark:text-white overflow-hidden"
                    showInteractive={false}
                    showFitView={true}
                  />
                </ReactFlow>

                {/* Selected Course Prereq/Dependent Info Box */}
                {selectedNodeId &&
                  (() => {
                    const selCourse = courses.find(
                      (c) => c.id === selectedNodeId,
                    );
                    if (!selCourse) return null;
                    const prereqs = selCourse.prerequisites || [];
                    const dependents = courses
                      .filter((c) => c.prerequisites.includes(selectedNodeId))
                      .map((c) => c.id);
                    return (
                      <div
                        className="absolute top-2 left-2 sm:top-6 sm:left-6 bg-white dark:bg-slate-800 p-2.5 sm:p-4 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 flex flex-col gap-2 z-10 w-[calc(100vw-1rem)] max-w-70 sm:w-70 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto"
                        dir="rtl"
                      >
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100 dark:border-slate-700">
                          <div className="text-[11px] font-black text-blue-600 dark:text-blue-400 font-mono">
                            {selCourse.id}
                          </div>
                          <button
                            onClick={() => setSelectedNodeId(null)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-xs"
                            title="إغلاق"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="text-[12px] font-bold text-gray-700 dark:text-slate-200 leading-tight">
                          {selCourse.name}
                        </div>

                        <div className="mt-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                              المتطلبات السابقة
                            </span>
                            <span className="text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                              {prereqs.length}
                            </span>
                          </div>
                          {prereqs.length === 0 ? (
                            <div className="text-[10px] text-gray-400">
                              لا يوجد
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {prereqs.map((pid) => {
                                const p = courses.find((c) => c.id === pid);
                                return (
                                  <button
                                    key={pid}
                                    onClick={() => {
                                      setSelectedNodeId(pid);
                                      focusNode(pid);
                                    }}
                                    className="flex items-center gap-1.5 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded hover:bg-emerald-100 max-w-full transition-colors cursor-pointer group relative"
                                    title={`انقر للانتقال إلى ${p?.name || pid}`}
                                  >
                                    <span className="font-mono">{pid}</span>
                                    {p?.name && (
                                      <span className="font-normal truncate">
                                        {p.name}
                                      </span>
                                    )}
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="12"
                                      height="12"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      className="shrink-0 ml-0.5"
                                    >
                                      <path d="M7 17l9.2-9.2M17 17V7H7" />
                                    </svg>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="mt-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400">
                              المواد التي تفتحها
                            </span>
                            <span className="text-[10px] font-black bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                              {dependents.length}
                            </span>
                          </div>
                          {dependents.length === 0 ? (
                            <div className="text-[10px] text-gray-400">
                              لا يوجد
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {dependents.map((did) => {
                                const p = courses.find((c) => c.id === did);
                                return (
                                  <button
                                    key={did}
                                    onClick={() => {
                                      setSelectedNodeId(did);
                                      focusNode(did);
                                    }}
                                    className="flex items-center gap-1.5 text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2 py-1 rounded hover:bg-indigo-100 max-w-full transition-colors cursor-pointer group relative"
                                    title={`انقر للانتقال إلى ${p?.name || did}`}
                                  >
                                    <span className="font-mono">{did}</span>
                                    {p?.name && (
                                      <span className="font-normal truncate">
                                        {p.name}
                                      </span>
                                    )}
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="12"
                                      height="12"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      className="shrink-0 ml-0.5"
                                    >
                                      <path d="M7 17l9.2-9.2M17 17V7H7" />
                                    </svg>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
              </div>
            )}
            {viewMode === "list" && (
              <ListView
                activeCourses={activeCourses}
                listGroupBy={listGroupBy}
                setListGroupBy={setListGroupBy}
                completedCourses={completedCourses}
                availableCourses={availableCourses}
                plannedCourses={plannedCourses}
                pinnedCourseId={pinnedCourseId}
                setPinnedCourseId={setPinnedCourseId}
                pinnedPath={pinnedPath}
                searchQuery={searchQuery}
                toggleCourseCompletion={toggleCourseCompletion}
                setPlanningCourseId={setPlanningCourseId}
                setIsPlannerOpen={setIsPlannerOpen}
                selectedElectives={selectedElectives}
                setSelectedElectives={setSelectedElectives}
                completedCreditsPerCategory={completedCreditsPerCategory}
                courses={courses}
                hoveredCourseId={hoveredCourseId}
                setHoveredCourseId={setHoveredCourseId}
                hoveredPath={hoveredPath}
                onOpenDetails={openDetails}
              />
            )}
          </>

          {/* Course Details Sidebar */}
          <div
            className={cn(
              "absolute top-0 right-0 h-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl border-l border-gray-200 dark:border-slate-800 transition-all duration-300 z-50 w-full sm:w-100 overflow-hidden flex flex-col",
              selectedNodeId && isDetailsOpen
                ? "translate-x-0 opacity-100"
                : "translate-x-full opacity-0 pointer-events-none",
            )}
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedNodeId &&
              (() => {
                const node = courses.find((c) => c.id === selectedNodeId);
                if (!node) return null;
                const isComp = completedCourses.has(node.id);
                const isAvail = availableCourseIds.has(node.id);
                const req = categoryRequirements[node.category] || 999;
                const comp = completedCreditsPerCategory[node.category] || 0;
                const isGroupCompleted = comp >= req;
                const isElective = node.category.includes("اختياري");
                const prerequisitesCompleted = node.prerequisites.every(
                  (prereq) => completedCourses.has(prereq),
                );
                const details = getCourseDetails(
                  node,
                  courses,
                  completedCourses,
                );

                let buttonText;
                let isDisabled = false;

                if (isComp) {
                  buttonText = "إلغاء المادة كمنجزة";
                } else if (isGroupCompleted && isElective) {
                  buttonText = "المجموعة متكملة";
                  isDisabled = true;
                } else if (isAvail) {
                  buttonText = "تحديد كمادة منجزة";
                } else {
                  if (!prerequisitesCompleted) {
                    buttonText = "المتطلبات السابقة غير مكتملة";
                  } else {
                    buttonText = "مغلقة";
                  }
                  isDisabled = true;
                }

                let critBg =
                  "bg-emerald-50 text-emerald-700 border-emerald-250";
                let critLabel = "مسار مرن وقابل للتأجيل";
                if (details.criticality === "high") {
                  critBg =
                    "bg-rose-50 text-rose-700 border-rose-250 animate-pulse";
                  critLabel = "سلسلة حرجة - الأولوية القصوى";
                } else if (details.criticality === "medium") {
                  critBg = "bg-amber-50 text-amber-700 border-amber-250";
                  critLabel = "أهمية متوسطة - ينصح بالالتزام";
                }

                return (
                  <>
                    {/* Header */}
                    <div className="p-5 pb-3 border-b border-gray-100 dark:border-slate-800 relative flex justify-between items-start">
                      <div className="text-right">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap justify-start">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-md tracking-widest">
                            {node.id}
                          </span>
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md font-bold">
                            {node.category}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border",
                              details.difficulty >= 8
                                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30"
                                : details.difficulty >= 6
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30",
                            )}
                          >
                            🔥 صعوبة: {details.difficulty}/10
                          </span>
                        </div>
                        <h3 className="text-lg font-black text-gray-800 dark:text-slate-100 leading-tight pr-0">
                          {node.name}
                        </h3>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNodeId(null);
                        }}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Body (scrollable) */}
                    <div
                      className="p-5 py-4 overflow-y-auto flex flex-col gap-3.5 max-h-[40vh] sm:max-h-[45vh]"
                      style={{ scrollbarWidth: "thin" }}
                    >
                      <div
                        className={`text-xs font-bold px-3 py-1 bg-gray-50 rounded-xl border text-right ${details.trackColor}`}
                      >
                        المسار الأكاديمي: {details.trackName}
                      </div>

                      <div className="space-y-1.5 text-right">
                        <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
                          شرح المساق والتفاصيل:
                        </h4>
                        <p className="text-xs text-gray-650 dark:text-slate-300 leading-relaxed font-semibold bg-gray-50/50 dark:bg-slate-800/50 p-3 rounded-2xl border border-gray-100 dark:border-slate-800 whitespace-pre-line">
                          {details.description}
                        </p>
                      </div>

                      <div className="bg-yellow-50/40 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 p-3 rounded-2xl space-y-1 text-right">
                        <div className="flex items-center gap-1.5 justify-start">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${critBg}`}
                          >
                            {critLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-normal font-semibold">
                          {details.criticalityReason}
                        </p>
                        <div className="bg-orange-50/50 dark:bg-orange-900/20 border border-orange-100/60 dark:border-orange-900/40 rounded-xl p-2.5 text-[11px] text-orange-950 dark:text-orange-200 font-semibold leading-relaxed">
                          💡 {details.advice}
                        </div>
                      </div>
                    </div>

                    {/* Footer / Actions */}
                    <div className="p-5 pt-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex flex-col gap-2 shrink-0">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => {
                            if (!isDisabled) toggleCourseCompletion(node.id);
                          }}
                          className={cn(
                            "flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm",
                            isComp
                              ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                              : !isDisabled
                                ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20 shadow-md"
                                : "bg-gray-100 text-gray-400 cursor-not-allowed",
                          )}
                          disabled={isDisabled}
                        >
                          {isComp ? (
                            <Trash2 size={16} />
                          ) : !isDisabled ? (
                            <CircleCheckBig size={16} />
                          ) : (
                            <Lock size={16} />
                          )}
                          {buttonText}
                        </button>

                        {!isComp && !isDisabled && (
                          <button
                            onClick={() => {
                              setPlanningCourseId(node.id);
                              setIsPlannerOpen(true);
                            }}
                            className={cn(
                              "w-full sm:w-37.5 shrink-0 py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm",
                              plannedCourses[node.id]
                                ? "bg-orange-100 text-orange-700 border border-orange-300 hover:bg-orange-200"
                                : "bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100",
                            )}
                          >
                            <CalendarDays size={16} />
                            <span className="text-xs line-clamp-1">
                              {plannedCourses[node.id] || "حدد فصلاً لجدولتها"}
                            </span>
                          </button>
                        )}
                      </div>

                      {/* IVR Library Link Button */}
                      <a
                        href={
                          node.resourceLink ||
                          "https://ivr-team-ptuk.github.io/IVR-Library/"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/30"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        ملفات وملخصات المادة (IVR)
                      </a>
                    </div>
                  </>
                );
              })()}
          </div>

          {/* Sidebar Overlay */}
          {isSidebarOpen && (
            <div
              className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm z-50 flex justify-end"
              dir="rtl"
              onClick={() => setIsSidebarOpen(false)}
            >
              <div
                className="w-80 sm:w-96 max-w-[100vw] h-full bg-white dark:bg-slate-900 shadow-2xl border-r border-gray-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right-full duration-300"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 dark:border-slate-800">
                  <h2 className="text-xl font-black text-gray-800 dark:text-slate-100 flex items-center gap-2">
                    <Target size={20} className="text-blue-500" /> إدارة الخطة
                  </h2>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex border-b border-gray-100 dark:border-slate-800 px-4 pt-2 gap-4">
                  <button
                    className={cn(
                      "pb-2 px-1 text-sm font-bold border-b-2 transition-colors",
                      activeTab === "available"
                        ? "border-blue-500 text-blue-600 dark:text-blue-400"
                        : "border-transparent text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200",
                    )}
                    onClick={() => setActiveTab("available")}
                  >
                    المتاحة ({availableCourses.length})
                  </button>
                  <button
                    className={cn(
                      "pb-2 px-1 text-sm font-bold border-b-2 transition-colors",
                      activeTab === "completed"
                        ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                        : "border-transparent text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200",
                    )}
                    onClick={() => setActiveTab("completed")}
                  >
                    المنجزة ({completedCourses.size})
                  </button>
                  <button
                    className={cn(
                      "pb-2 px-1 text-sm font-bold border-b-2 transition-colors",
                      activeTab === "all"
                        ? "border-gray-800 dark:border-slate-200 text-gray-800 dark:text-slate-200"
                        : "border-transparent text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200",
                    )}
                    onClick={() => setActiveTab("all")}
                  >
                    الكل
                  </button>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 mb-1 pr-1">
                        السنة الدراسية
                      </label>
                      <select
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 dark:text-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                      >
                        <option value="all">كل السنوات</option>
                        <option value="1">السنة الأولى</option>
                        <option value="2">السنة الثانية</option>
                        <option value="3">السنة الثالثة</option>
                        <option value="4">السنة الرابعة</option>
                        <option value="5">السنة الخامسة</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 mb-1 pr-1">
                        التصنيف
                      </label>
                      <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 dark:text-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                      >
                        <option value="all">كل التصنيفات</option>
                        {Object.keys(categoryRequirements).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 relative bg-gray-50/50 dark:bg-slate-900/50">
                  {(() => {
                    const getYearFromId = (id: string) => {
                      if (id.length >= 6) {
                        const levelChar = id.charAt(5);
                        const level = parseInt(levelChar);
                        if (!isNaN(level) && level >= 1 && level <= 5)
                          return level.toString();

                        // Special cases for codes like 1301... or 1501...
                        // Usually the 6th digit is the level in PTUK new system
                        // or 4th/5th in old.
                      }
                      // Fallback for university requirements which often start with 1501, 1520 etc.
                      if (id.startsWith("1520") || id.startsWith("1301"))
                        return "1";
                      if (id.startsWith("121401")) return "1";
                      if (id.startsWith("121402")) return "2";
                      if (id.startsWith("121403")) return "3";
                      if (id.startsWith("121404")) return "4";
                      if (id.startsWith("121405")) return "5";

                      return "1";
                    };

                    let displayCourses = courses;
                    if (activeTab === "available")
                      displayCourses = availableCourses;
                    if (activeTab === "completed")
                      displayCourses = courses.filter((c) =>
                        completedCourses.has(c.id),
                      );

                    // Apply Filters
                    if (filterYear !== "all") {
                      displayCourses = displayCourses.filter(
                        (c) => getYearFromId(c.id) === filterYear,
                      );
                    }
                    if (filterCategory !== "all") {
                      displayCourses = displayCourses.filter(
                        (c) => c.category === filterCategory,
                      );
                    }

                    if (displayCourses.length === 0) {
                      return (
                        <div className="text-center text-gray-400 dark:text-slate-500 py-10 text-sm font-semibold flex flex-col items-center gap-4">
                          <BookOpen size={40} className="opacity-20" />
                          لا توجد مواد تطابق الفلاتر.
                        </div>
                      );
                    }

                    const groupedCourses = displayCourses.reduce(
                      (acc, course) => {
                        if (!acc[course.category]) acc[course.category] = [];
                        acc[course.category].push(course);
                        return acc;
                      },
                      {} as Record<string, typeof courses>,
                    );

                    return Object.entries(groupedCourses).map(
                      ([categoryName, categoryCourses]) => {
                        const req = categoryRequirements[categoryName] || 0;
                        const comp =
                          completedCreditsPerCategory[categoryName] || 0;
                        const isGroupCompleted = comp >= req;
                        const isElective = categoryName.includes("اختياري");
                        const isLocked = isGroupCompleted && isElective;

                        return (
                          <div
                            key={categoryName}
                            className="flex flex-col gap-3"
                          >
                            <div className="flex items-center justify-between px-1">
                              <h3 className="text-sm font-black text-gray-700 dark:text-slate-200">
                                {categoryName}
                              </h3>
                              <div className="flex items-center gap-2">
                                {isGroupCompleted && (
                                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded font-bold">
                                    مكتملة
                                  </span>
                                )}
                                <span className="text-xs text-gray-500 dark:text-slate-400 font-semibold">
                                  {comp} / {req}{" "}
                                  <span className="10px">ساعات</span>
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              {categoryCourses.map((course) => {
                                const isComp = completedCourses.has(course.id);
                                const isAvail = availableCourseIds.has(
                                  course.id,
                                );
                                return (
                                  <div
                                    key={course.id}
                                    className={cn(
                                      "p-3 bg-white dark:bg-slate-800 border rounded-xl flex flex-col gap-1 cursor-pointer hover:border-blue-300 hover:dark:border-blue-500 hover:shadow-md transition-all group relative overflow-hidden",
                                      isLocked && !isComp
                                        ? "opacity-50 grayscale border-gray-100 dark:border-slate-800"
                                        : "border-gray-200 dark:border-slate-700",
                                    )}
                                    onClick={() => {
                                      focusNode(course.id);
                                      setSelectedNodeId(course.id);
                                    }}
                                  >
                                    <div
                                      className={cn(
                                        "absolute right-0 top-0 bottom-0 w-1",
                                        isComp
                                          ? "bg-emerald-400"
                                          : isAvail
                                            ? "bg-blue-400"
                                            : "bg-gray-200 dark:bg-slate-700",
                                      )}
                                    />
                                    <div className="flex justify-between items-start pl-1 pr-3">
                                      <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest">
                                          {course.id}
                                        </span>
                                        <span className="text-sm font-bold text-gray-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">
                                          {course.name}
                                        </span>
                                      </div>
                                      <div className="flex gap-1 shrink-0">
                                        {!isComp && (!isLocked || isComp) && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setPlanningCourseId(course.id);
                                              setIsPlannerOpen(true);
                                            }}
                                            className={cn(
                                              "p-1.5 rounded-md transition-colors",
                                              plannedCourses[course.id]
                                                ? "text-orange-500 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-900/40"
                                                : "text-gray-300 dark:text-slate-500 hover:text-orange-500 dark:hover:text-orange-400 bg-gray-50 dark:bg-slate-900 hover:bg-orange-50 dark:hover:bg-orange-950/10",
                                            )}
                                            title={
                                              plannedCourses[course.id] ||
                                              "حدد فصلاً"
                                            }
                                          >
                                            <CalendarDays size={18} />
                                          </button>
                                        )}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (!isLocked || isComp)
                                              toggleCourseCompletion(course.id);
                                          }}
                                          className={cn(
                                            "p-1.5 rounded-md transition-colors",
                                            isComp
                                              ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400"
                                              : isAvail
                                                ? "text-gray-300 dark:text-slate-600 hover:text-emerald-500 dark:hover:text-emerald-400 bg-gray-50 dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                                : "text-gray-200 dark:text-slate-750 cursor-not-allowed",
                                          )}
                                          title={
                                            isComp
                                              ? "تحديد كغير منجز"
                                              : isLocked
                                                ? "المجموعة مكتملة"
                                                : "إنجاز"
                                          }
                                          disabled={isLocked && !isComp}
                                        >
                                          <CircleCheckBig size={18} />
                                        </button>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 mt-2 pr-3">
                                      <span className="text-[10px] font-medium text-gray-500 bg-gray-100/80 px-1.5 py-0.5 rounded">
                                        {course.credits} ساعات
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      },
                    );
                  })()}
                </div>

                <div className="p-5 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] z-10">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-bold text-gray-700 dark:text-slate-300">
                      الساعات المنجزة
                    </span>
                    <div className="text-lg font-black flex items-center justify-end gap-1">
                      <span className="text-blue-600 dark:text-blue-400">
                        {completedCredits}
                      </span>{" "}
                      {plannedCredits > 0 && (
                        <span className="text-orange-500 dark:text-orange-400 text-sm break-keep whitespace-nowrap">
                          + {plannedCredits}
                        </span>
                      )}{" "}
                      /{" "}
                      <span className="text-gray-500 dark:text-slate-500 text-sm">
                        {TOTAL_CREDITS}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                    {/* الشريط البرتقالي: يمثل المنجز + المخطط له كخلفية متصلة */}
                    <div
                      className="absolute right-0 top-0 h-full bg-orange-400 rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${progressPercentage + plannedPercentage}%`,
                      }}
                    ></div>
                    {/* الشريط الأزرق: يركب فوق البرتقالي ليمثل المنجز فقط */}
                    <div
                      className="absolute right-0 top-0 h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleImportCsv}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-2 text-[11px] font-bold text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-750 border border-gray-200 dark:border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm px-1"
                      title="استيراد الخطة من ملف CSV"
                    >
                      <Upload size={14} /> استيراد
                    </button>
                    <button
                      onClick={handleExportCsv}
                      className="flex-1 py-2 text-[11px] font-bold text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-750 border border-gray-200 dark:border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm px-1"
                    >
                      <Download size={14} /> تصدير
                    </button>
                    <button
                      onClick={() => setIsExportModalOpen(true)}
                      className="flex-1 py-2 text-[11px] font-bold text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-750 border border-gray-200 dark:border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm px-1"
                      title="تحميل ملف PDF بكامل التفاصيل والمعلومات"
                    >
                      <Printer size={14} />
                      PDF
                    </button>
                    <button
                      onClick={handleReset}
                      className="flex-1 py-2 text-[11px] font-bold text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-lg transition-colors flex items-center justify-center gap-1.5 px-1"
                    >
                      <Trash2 size={14} /> تهيئة
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Reset Confirmation Modal */}
        {showResetConfirm && (
          <React.Suspense fallback={modalLoadingFallback}>
            <ResetConfirmationModal
              showResetConfirm={showResetConfirm}
              onClose={() => setShowResetConfirm(false)}
              onConfirm={confirmReset}
            />
          </React.Suspense>
        )}

        {/* Support / Technical Assistance and feedback Modal */}
        {isSupportModalOpen && (
          <React.Suspense fallback={modalLoadingFallback}>
            <SupportModal
              isSupportModalOpen={isSupportModalOpen}
              onClose={() => setIsSupportModalOpen(false)}
            />
          </React.Suspense>
        )}

        {/* Export Modal */}
        {isExportModalOpen && (
          <React.Suspense fallback={modalLoadingFallback}>
            <ExportModal
              isExportModalOpen={isExportModalOpen}
              onClose={() => setIsExportModalOpen(false)}
              completedCredits={completedCredits}
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
            />
          </React.Suspense>
        )}

        {/* Planning Mode Modal */}
        {isPlanningModeOpen && (
          <React.Suspense fallback={modalLoadingFallback}>
            <PlanningModeModal
              isPlanningModeOpen={isPlanningModeOpen}
              onClose={() => {
                setIsPlanningModeOpen(false);
                setCurrentPlanningSemester(null);
                setExpandedPlanningCategories({});
              }}
              currentPlanningSemester={currentPlanningSemester}
              setCurrentPlanningSemester={setCurrentPlanningSemester}
              completedCourses={completedCourses}
              plannedCourses={plannedCourses}
              setPlannedCourses={setPlannedCourses}
              courses={courses}
              isCourseAvailable={isCourseAvailable}
              completedCreditsPerCategory={completedCreditsPerCategory}
              hasHighGpa={hasHighGpa}
              setHasHighGpa={setHasHighGpa}
              expandedPlanningCategories={expandedPlanningCategories}
              setExpandedPlanningCategories={setExpandedPlanningCategories}
              setIsPlannerOpen={setIsPlannerOpen}
            />
          </React.Suspense>
        )}

        {/* Course List Modal */}
        {isCourseListModalOpen && (
          <React.Suspense fallback={modalLoadingFallback}>
            <CourseListModal
              isCourseListModalOpen={isCourseListModalOpen}
              onClose={() => {
                setIsCourseListModalOpen(false);
                setExpandedCourseListCategories({});
              }}
              courseListTab={courseListTab}
              setCourseListTab={setCourseListTab}
              availableCourses={availableCourses}
              completedCourses={completedCourses}
              activeCourses={activeCourses}
              groupedCourseList={groupedCourseList}
              expandedCourseListCategories={expandedCourseListCategories}
              setExpandedCourseListCategories={setExpandedCourseListCategories}
              focusNode={focusNode}
              toggleCourseCompletion={toggleCourseCompletion}
              setPlanningCourseId={setPlanningCourseId}
              setIsPlannerOpen={setIsPlannerOpen}
              completedCreditsPerCategory={completedCreditsPerCategory}
              plannedCourses={plannedCourses}
            />
          </React.Suspense>
        )}

        {/* Planner View Modal */}
        {isPlannerOpen && (
          <React.Suspense fallback={modalLoadingFallback}>
            <PlannerView
              isPlannerOpen={isPlannerOpen}
              onClose={() => setIsPlannerOpen(false)}
              plannedCourses={plannedCourses}
              setPlannedCourses={setPlannedCourses}
              completedCourses={completedCourses}
              setCompletedCourses={setCompletedCourses}
              planStartSemester={planStartSemester}
              setPlanStartSemester={setPlanStartSemester}
              planEndSemester={planEndSemester}
              setPlanEndSemester={setPlanEndSemester}
              hidePastSemesters={hidePastSemesters}
              setHidePastSemesters={setHidePastSemesters}
              planningCourseId={planningCourseId}
              setPlanningCourseId={setPlanningCourseId}
              completedCredits={completedCredits}
              completedCreditsPerCategory={completedCreditsPerCategory}
              plannedCreditsPerCategory={plannedCreditsPerCategory}
              setIsExportModalOpen={setIsExportModalOpen}
              onOpenPlanningMode={() => setIsPlanningModeOpen(true)}
              toggleCourseCompletion={toggleCourseCompletion}
            />
          </React.Suspense>
        )}
        {/* GPAModal */}
        {isGPAModalOpen && (
          <React.Suspense fallback={modalLoadingFallback}>
            <GPAModal
              isOpen={isGPAModalOpen}
              onClose={() => setIsGPAModalOpen(false)}
              courses={courses}
              completedCourses={completedCourses}
              courseGrades={courseGrades}
              setCourseGrades={setCourseGrades}
              failedCourseIds={new Set(failedCourseIds)}
              setFailedCourseIds={(ids) => setFailedCourseIds(Array.from(ids))}
            />
          </React.Suspense>
        )}
        {isWeeklyScheduleOpen && (
          <React.Suspense fallback={modalLoadingFallback}>
            <WeeklyScheduleModal
              isOpen={isWeeklyScheduleOpen}
              onClose={() => setIsWeeklyScheduleOpen(false)}
              plannedCourses={plannedCourses}
              courses={courses}
              weeklySchedule={weeklySchedule}
              setWeeklySchedule={setWeeklySchedule}
            />
          </React.Suspense>
        )}
        {isShareScheduleOpen && (
          <React.Suspense fallback={modalLoadingFallback}>
            <ShareScheduleModal
              isOpen={isShareScheduleOpen}
              onClose={() => setIsShareScheduleOpen(false)}
              code={shareCode}
              loading={shareLoading}
              error={shareError}
              onCreate={() => void handleCreateSharedLink()}
            />
          </React.Suspense>
        )}
        {isLoadScheduleOpen && (
          <React.Suspense fallback={modalLoadingFallback}>
            <LoadScheduleModal
              isOpen={isLoadScheduleOpen}
              onClose={() => setIsLoadScheduleOpen(false)}
              loading={loadLoading}
              error={loadError}
              onLoad={handleLoadSharedSchedule}
            />
          </React.Suspense>
        )}
        {loadedSchedule && (
          <React.Suspense fallback={modalLoadingFallback}>
            <SharedSchedulePreviewModal
              schedule={loadedSchedule?.schedule ?? null}
              code={loadedSchedule?.code ?? null}
              warning={loadedSchedule?.viewCountWarning}
              onClose={() => setLoadedSchedule(null)}
              onApply={applySharedSchedule}
            />
          </React.Suspense>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowComponent />
    </ReactFlowProvider>
  );
}
