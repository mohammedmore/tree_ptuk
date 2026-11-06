import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useDeferredValue,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  Pin,
  Download,
  Map as MapIcon,
  LayoutList,
  X,
  Sparkles,
  GraduationCap,
  ArrowLeftRight,
  RefreshCw,
  Share2,
  Flame,
} from "lucide-react";
import type { Course, ScheduleEntry } from "../data";
import {
  courseDependentsMap,
  categoryRequirements as defaultCategoryRequirements,
} from "../data";
import {
  TOTAL_CREDITS,
  getYearFromId,
  courseRecommendedSemesters,
  getRecommendedSemesterOfCourse,
  ELECTIVE_SLOTS_DEFS,
} from "../constants";
import {
  calculateDegreeCredits,
  calculateYearlyProgress,
  isCourseAvailable as defaultIsCourseAvailable,
} from "../core/courseProgress";
import {
  computeGraphLayout,
  computeCriticalPath,
  type LayoutResult,
  type LayoutMode,
  type CriticalPathResult,
  type CriticalPathChain,
} from "../core/graphLayout";
import CourseNode, { CourseNodeData } from "../components/planner/CourseNode";
import {
  PlannerNodeActionsContext,
  type PlannerNodeActions,
} from "../components/planner/PlannerNodeActionsContext";
import { CourseSidebar } from "../components/planner/CourseSidebar";
import { PlanMobileView } from "../components/planner/PlanMobileView";
import ListView from "../components/planner/ListView";
import { MajorTransferModal } from "../components/modals/MajorTransferModal";
const ExportModal = React.lazy(
  () => import("../components/modals/ExportModal"),
);
import { getCachedStudentProfile } from "../services/studentService";
import { cn, normalizeArabicText } from "../utils";

interface PlanPageProps {
  courses: Course[];
  completedCourses: Set<string>;
  plannedCourses: Record<string, string>;
  onToggleComplete: (courseId: string) => void;
  onPlanCourse: (courseId: string) => void;
  activeMajorName: string;
  activeMajorId?: string;
  onSelectMajor: () => void;
  onNavigateToSemesterPlanning: () => void;
  onAddCourse?: () => void;
  weeklySchedule?: Record<string, Record<string, ScheduleEntry>>;
  courseGrades?: Record<string, number>;
  failedCourseIds?: string[];
  selectedElectives?: Record<string, string>;
  setSelectedElectives?: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  setPlannedCourses?: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  categoryRequirements?: Record<string, number>;
}

// Custom Node for Column Header inside React Flow canvas
const ColumnHeaderComponent = React.memo(({ data }: NodeProps) => {
  return (
    <div
      dir="rtl"
      className="w-[200px] pb-2 text-right border-b border-[var(--line-control)] bg-transparent select-none pointer-events-none"
    >
      <span className="text-[14px] font-semibold text-[var(--text)] block truncate">
        {data.title as string}
      </span>
      <span className="text-[12px] text-[var(--text-3)] tabular-nums block mt-0.5">
        {data.totalCredits as number} ساعات • {data.courseCount as number} مواد
      </span>
    </div>
  );
});

const nodeTypes = {
  courseNode: CourseNode,
  columnHeader: ColumnHeaderComponent,
};

/**
 * Unified BFS helper for prerequisite and dependent traversal
 */
function computeCourseDependencies(
  focusId: string,
  coursesById: Map<string, Course>,
  courseDependentsMap: Map<string, string[]>,
) {
  const ancestors = new Set<string>();
  const descendants = new Set<string>();

  // Upstream
  const queueUp = [focusId];
  while (queueUp.length > 0) {
    const curId = queueUp.shift()!;
    const cur = coursesById.get(curId);
    if (cur?.prerequisites) {
      for (const p of cur.prerequisites) {
        if (!ancestors.has(p)) {
          ancestors.add(p);
          queueUp.push(p);
        }
      }
    }
  }

  // Downstream
  const queueDown = [focusId];
  while (queueDown.length > 0) {
    const curId = queueDown.shift()!;
    const deps = courseDependentsMap.get(curId) || [];
    for (const d of deps) {
      if (!descendants.has(d)) {
        descendants.add(d);
        queueDown.push(d);
      }
    }
  }

  const allPathCourseIds = new Set<string>([
    focusId,
    ...Array.from(ancestors),
    ...Array.from(descendants),
  ]);

  return { ancestors, descendants, allPathCourseIds };
}

function PlanFlowContent({
  courses,
  completedCourses,
  plannedCourses,
  onToggleComplete,
  onPlanCourse,
  activeMajorName,
  activeMajorId,
  onSelectMajor,
  onNavigateToSemesterPlanning,
  onAddCourse,
  weeklySchedule = {},
  courseGrades = {},
  failedCourseIds = [],
  selectedElectives = {},
  setSelectedElectives,
  setPlannedCourses,
  categoryRequirements,
}: PlanPageProps) {
  const { fitView } = useReactFlow();

  // Modals state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  // View mode: map vs list
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [listGroupBy, setListGroupBy] = useState<"category" | "semester">(
    "semester",
  );

  // Toast Notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // Layout mode: "catalog" (default official PTUK study plan) vs "prerequisite" (chains depth)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("catalog");

  // Feature Toggles: Grades Overlay, Multiple Critical Paths
  const [showGrades, setShowGrades] = useState(false);
  const [activeCriticalPathId, setActiveCriticalPathId] = useState<
    string | "all" | null
  >(null);
  const [a11yMessage, setA11yMessage] = useState<string>("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "available" | "completed" | "remaining"
  >("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [seasonFilter, setSeasonFilter] = useState<
    "all" | "first" | "second" | "summer"
  >("all");

  // Selection, Pinning & Hover
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [pinnedCourseId, setPinnedCourseId] = useState<string | null>(null);
  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Category breakdown drawer
  const [showCategoryBreakdown, setShowCategoryBreakdown] = useState(false);

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close options dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        optionsMenuRef.current &&
        !optionsMenuRef.current.contains(e.target as HTMLElement)
      ) {
        setIsOptionsMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOptionsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Clear any pending hover debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
    };
  }, []);

  // Keyboard shortcut: Escape clears search / selection / pinned / hover; Ctrl+K focuses search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        setSearchQuery("");
        setHoveredCourseId(null);
        if (pinnedCourseId) {
          setPinnedCourseId(null);
        } else {
          setSelectedCourseId(null);
        }
        setIsOptionsMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pinnedCourseId]);

  const coursesById = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses],
  );

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set);
  }, [courses]);

  // Overall degree progress (Item 8: Pre-calculated to memoize credit threshold checks)
  const earnedCredits = useMemo(
    () => calculateDegreeCredits(courses, completedCourses),
    [courses, completedCourses],
  );

  const effectiveCategoryRequirements = useMemo(() => {
    if (categoryRequirements && Object.keys(categoryRequirements).length > 0) {
      return categoryRequirements;
    }
    return defaultCategoryRequirements;
  }, [categoryRequirements]);

  const totalDegreeCredits = useMemo(() => {
    const student = getCachedStudentProfile();
    if (
      student?.totalCredits &&
      student.totalCredits >= 60 &&
      student.totalCredits <= 260
    ) {
      return student.totalCredits;
    }
    const sum = Object.entries(effectiveCategoryRequirements).reduce(
      (acc, [cat, val]) => {
        if (cat.includes("استدراكي")) return acc;
        return acc + (typeof val === "number" ? val : 0);
      },
      0,
    );

    // Degree credits must represent valid degree requirement (60 - 260 hours, supporting diplomas & bachelors)
    if (sum >= 60 && sum <= 260) return sum;
    return TOTAL_CREDITS;
  }, [effectiveCategoryRequirements]);

  // Calculate available courses
  const availableCoursesSet = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => {
      if (
        !completedCourses.has(c.id) &&
        defaultIsCourseAvailable(c, completedCourses, courses, {
          cumulativeEarnedCredits: earnedCredits,
        })
      ) {
        set.add(c.id);
      }
    });
    return set;
  }, [courses, completedCourses, earnedCredits]);

  const availableCoursesList = useMemo(() => {
    return courses.filter((c) => availableCoursesSet.has(c.id));
  }, [courses, availableCoursesSet]);
  const progressPercent = useMemo(() => {
    if (totalDegreeCredits <= 0) return 0;
    return Math.min(
      100,
      Math.round((earnedCredits / totalDegreeCredits) * 100),
    );
  }, [earnedCredits, totalDegreeCredits]);

  // Automated Graduation Forecaster calculations
  const remainingCredits = Math.max(0, totalDegreeCredits - earnedCredits);
  const estimatedSemestersNeeded = Math.ceil(remainingCredits / 16);

  // Category credits progress
  const completedCreditsPerCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    completedCourses.forEach((id) => {
      const c = coursesById.get(id);
      if (c && c.category) {
        counts[c.category] = (counts[c.category] || 0) + c.credits;
      }
    });
    return counts;
  }, [completedCourses, coursesById]);

  // Yearly progress rings (Item 63)
  const yearlyProgress = useMemo(
    () =>
      calculateYearlyProgress(courses, completedCourses, totalDegreeCredits),
    [courses, completedCourses, totalDegreeCredits],
  );

  // Active focus: hovered course takes temporary preview focus; falls back to pinned or selected
  const activeFocusId = hoveredCourseId || pinnedCourseId || selectedCourseId;

  // Single unified dependency traversal (Item 3)
  const activePathDetails = useMemo(() => {
    if (!activeFocusId) return null;
    const { ancestors, descendants, allPathCourseIds } =
      computeCourseDependencies(
        activeFocusId,
        coursesById,
        courseDependentsMap,
      );
    return {
      focusId: activeFocusId,
      ancestors,
      descendants,
      allPathCourseIds,
      isPinned: activeFocusId === pinnedCourseId,
    };
  }, [activeFocusId, coursesById, pinnedCourseId]);

  const pinnedPath = useMemo(() => {
    if (!pinnedCourseId) return null;
    if (activePathDetails && activePathDetails.focusId === pinnedCourseId) {
      return {
        ancestors: activePathDetails.ancestors,
        descendants: activePathDetails.descendants,
        allPathNodeIds: activePathDetails.allPathCourseIds,
      };
    }
    const { ancestors, descendants, allPathCourseIds } =
      computeCourseDependencies(
        pinnedCourseId,
        coursesById,
        courseDependentsMap,
      );
    return { ancestors, descendants, allPathNodeIds: allPathCourseIds };
  }, [pinnedCourseId, coursesById, activePathDetails]);

  // Filter matching course IDs with Arabic normalization (Item 28)
  const filteredCourseIds = useMemo(() => {
    const rawQ = deferredSearchQuery.trim();
    const q = rawQ.toLowerCase();
    const normQ = normalizeArabicText(rawQ);
    const hasAnyFilter =
      rawQ.length > 0 ||
      statusFilter !== "all" ||
      yearFilter !== "all" ||
      categoryFilter !== "all" ||
      seasonFilter !== "all";

    if (!hasAnyFilter) return null;

    const matched = new Set<string>();
    courses.forEach((c) => {
      const matchesSearch =
        !rawQ ||
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (normQ.length > 0 && normalizeArabicText(c.name).includes(normQ));
      if (!matchesSearch) return;

      const isCompleted = completedCourses.has(c.id);
      const isAvailable = availableCoursesSet.has(c.id);
      if (statusFilter === "completed" && !isCompleted) return;
      if (statusFilter === "available" && (isCompleted || !isAvailable)) return;
      if (statusFilter === "remaining" && isCompleted) return;

      if (yearFilter !== "all" && getYearFromId(c.id) !== yearFilter) return;
      if (categoryFilter !== "all" && c.category !== categoryFilter) return;

      if (seasonFilter !== "all") {
        if (
          seasonFilter === "first" &&
          c.seasonal &&
          c.seasonal !== "first" &&
          c.seasonal !== "both"
        )
          return;
        if (
          seasonFilter === "second" &&
          c.seasonal &&
          c.seasonal !== "second" &&
          c.seasonal !== "both"
        )
          return;
        if (
          seasonFilter === "summer" &&
          c.seasonal !== "summer" &&
          c.seasonal !== "both"
        )
          return;
      }

      matched.add(c.id);
    });

    return matched;
  }, [
    courses,
    deferredSearchQuery,
    statusFilter,
    yearFilter,
    categoryFilter,
    seasonFilter,
    completedCourses,
    availableCoursesSet,
  ]);

  // Semester mapping helper for catalog mode
  const SEMESTER_INDEX_MAP: Record<string, number> = useMemo(
    () => ({
      "السنة الأولى - الفصل الأول": 0,
      "السنة الأولى - الفصل الثاني": 1,
      "السنة الأولى - الصيفي": 1,
      "السنة الثانية - الفصل الأول": 2,
      "السنة الثانية - الفصل الثاني": 3,
      "السنة الثانية - الصيفي": 3,
      "السنة الثالثة - الفصل الأول": 4,
      "السنة الثالثة - الفصل الثاني": 5,
      "السنة الثالثة - الصيفي": 5,
      "السنة الرابعة - الفصل الأول": 6,
      "السنة الرابعة - الفصل الثاني": 7,
      "السنة الرابعة - الصيفي": 7,
      "السنة الخامسة - الفصل الأول": 8,
      "السنة الخامسة - الفصل الثاني": 9,
      "السنة الخامسة - الصيفي": 9,
    }),
    [],
  );

  const courseSemesterMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (layoutMode === "catalog") {
      courses.forEach((c) => {
        const sem = getRecommendedSemesterOfCourse(c);
        if (sem && typeof SEMESTER_INDEX_MAP[sem] === "number") {
          map[c.id] = SEMESTER_INDEX_MAP[sem];
        } else {
          const y = parseInt(getYearFromId(c.id)) || 1;
          const hasPrereqInSameYear =
            Array.isArray(c.prerequisites) &&
            c.prerequisites.some((p) => parseInt(getYearFromId(p)) === y);
          const isSem2 =
            hasPrereqInSameYear ||
            Boolean(
              c.name &&
              (c.name.includes("(2)") ||
                c.name.includes(" 2") ||
                c.name.includes("ثاني") ||
                c.name.includes("مختبر")),
            );
          map[c.id] = Math.min(9, Math.max(0, (y - 1) * 2 + (isSem2 ? 1 : 0)));
        }
      });
    }
    return map;
  }, [layoutMode, courses, SEMESTER_INDEX_MAP]);

  // Active plan courses: show all courses belonging to this major plan without filtering out electives
  const planCourses = useMemo(() => {
    return courses;
  }, [courses]);

  // Compute Multiple Critical Paths in the Curriculum DAG
  const criticalPathResult: CriticalPathResult = useMemo(() => {
    return computeCriticalPath(planCourses);
  }, [planCourses]);

  const courseCriticalPathsCount = useMemo(() => {
    const counts = new Map<string, number>();
    criticalPathResult.paths.forEach((p) => {
      p.courseIds.forEach((cId) => {
        counts.set(cId, (counts.get(cId) || 0) + 1);
      });
    });
    return counts;
  }, [criticalPathResult]);

  const activeCriticalCourses = useMemo(() => {
    if (!activeCriticalPathId) return null;
    if (activeCriticalPathId === "all") return criticalPathResult.courseIds;
    const path = criticalPathResult.paths.find(
      (p) => p.id === activeCriticalPathId,
    );
    return path ? new Set(path.courseIds) : null;
  }, [activeCriticalPathId, criticalPathResult]);

  const activeCriticalEdges = useMemo(() => {
    if (!activeCriticalPathId) return null;
    if (activeCriticalPathId === "all") return criticalPathResult.edgeIds;
    const path = criticalPathResult.paths.find(
      (p) => p.id === activeCriticalPathId,
    );
    return path ? new Set(path.edgeIds) : null;
  }, [activeCriticalPathId, criticalPathResult]);

  // STEP 1: Compute static Graph Layout ONCE per courses / layout mode
  const baseLayout: LayoutResult = useMemo(() => {
    const rawNodes: Node[] = planCourses.map((c) => ({
      id: c.id,
      type: "courseNode",
      position: { x: 0, y: 0 },
      data: {
        id: c.id,
        label: c.name,
        credits: c.credits,
      },
    }));

    const rawEdges: Edge[] = [];
    planCourses.forEach((c) => {
      if (c.prerequisites) {
        c.prerequisites.forEach((pId) => {
          if (coursesById.has(pId)) {
            rawEdges.push({
              id: `e-${pId}-${c.id}`,
              source: pId,
              target: c.id,
              type: "smoothstep",
            });
          }
        });
      }
      if (c.coPrerequisites) {
        c.coPrerequisites.forEach((coId) => {
          if (coursesById.has(coId)) {
            rawEdges.push({
              id: `coreq-${coId}-${c.id}`,
              source: coId,
              target: c.id,
              type: "smoothstep",
              data: { isCoRequisite: true },
            });
          }
        });
      }
    });

    return computeGraphLayout({
      nodes: rawNodes,
      edges: rawEdges,
      courseSemesterMap,
      layoutMode,
    });
  }, [planCourses, coursesById, courseSemesterMap, layoutMode]);

  const initialFitDone = useRef(false);
  const prevLayoutModeRef = useRef(layoutMode);
  const prevMajorRef = useRef(activeMajorName);

  useEffect(() => {
    if (baseLayout.nodes.length === 0) return;

    const fitToStart = (duration = 0) => {
      const startNodes = baseLayout.nodes.filter((n) => {
        const col = (n.data?.column as number) ?? 0;
        return col <= 3;
      });
      if (startNodes.length > 0) {
        fitView({
          nodes: startNodes,
          padding: 0.15,
          minZoom: 0.75,
          maxZoom: 1.0,
          duration,
        });
      } else {
        fitView({
          padding: 0.12,
          minZoom: 0.72,
          maxZoom: 1.05,
          duration,
        });
      }
    };

    if (!initialFitDone.current) {
      initialFitDone.current = true;
      requestAnimationFrame(() => {
        fitToStart(0);
      });
      return;
    }

    // Refit when layout mode or major changes
    if (
      prevLayoutModeRef.current !== layoutMode ||
      prevMajorRef.current !== activeMajorName
    ) {
      prevLayoutModeRef.current = layoutMode;
      prevMajorRef.current = activeMajorName;
      requestAnimationFrame(() => {
        fitToStart(250);
      });
    }
  }, [baseLayout, fitView, layoutMode, activeMajorName]);

  const handleTogglePin = useCallback((courseId: string) => {
    setPinnedCourseId((prev) => {
      const next = prev === courseId ? null : courseId;
      if (next) {
        setActiveCriticalPathId(null);
      }
      return next;
    });
  }, []);

  // URL Course Deep-Linking & Auto-Focus (e.g. #/plan?course=123)
  const deepLinkedCourseRef = useRef<string | null>(null);

  useEffect(() => {
    const parseUrlCourse = () => {
      if (typeof window === "undefined") return null;
      const searchParams = new URLSearchParams(window.location.search);
      const urlParam = searchParams.get("course");
      if (urlParam) return urlParam;

      if (window.location.hash) {
        const qIdx = window.location.hash.indexOf("?");
        if (qIdx !== -1) {
          const hashParams = new URLSearchParams(
            window.location.hash.slice(qIdx),
          );
          return hashParams.get("course");
        }
      }
      return null;
    };

    const targetCourseId = parseUrlCourse();
    if (
      targetCourseId &&
      coursesById.has(targetCourseId) &&
      deepLinkedCourseRef.current !== targetCourseId
    ) {
      deepLinkedCourseRef.current = targetCourseId;
      setSelectedCourseId(targetCourseId);
      const targetNode = baseLayout.nodes.find((n) => n.id === targetCourseId);
      if (targetNode) {
        requestAnimationFrame(() => {
          fitView({
            nodes: [targetNode],
            duration: 400,
            padding: 0.5,
          });
        });
      }
    }

    const handleHash = () => {
      const newTarget = parseUrlCourse();
      if (newTarget && coursesById.has(newTarget)) {
        deepLinkedCourseRef.current = newTarget;
        setSelectedCourseId(newTarget);
        const node = baseLayout.nodes.find((n) => n.id === newTarget);
        if (node) {
          fitView({ nodes: [node], duration: 400, padding: 0.5 });
        }
      }
    };

    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [baseLayout.nodes, coursesById, fitView]);

  // Safe hover: disabled on touch devices to avoid flicker (Item 7)
  const handleNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(pointer: coarse)").matches
      ) {
        return;
      }
      if (node.type === "columnHeader" || node.id.startsWith("header-")) return;
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      setHoveredCourseId(node.id);
    },
    [],
  );

  const handleNodeMouseLeave = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(pointer: coarse)").matches
      ) {
        return;
      }
      if (node.type === "columnHeader" || node.id.startsWith("header-")) return;
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
      hoverTimeoutRef.current = window.setTimeout(() => {
        setHoveredCourseId((prev) => (prev === node.id ? null : prev));
      }, 60);
    },
    [],
  );

  // Stable node callback handlers (Item 11)
  const handleSelectCourseDetails = useCallback((id: string) => {
    setSelectedCourseId(id);
  }, []);

  const plannerActions = useMemo<PlannerNodeActions>(
    () => ({
      onToggleComplete,
      onSelectDetails: handleSelectCourseDetails,
      onTogglePin: handleTogglePin,
    }),
    [onToggleComplete, handleSelectCourseDetails, handleTogglePin],
  );

  // STEP 3: Assemble Canvas Nodes
  const canvasNodes = useMemo(() => {
    const headerNodes: Node[] = baseLayout.columnHeaders.map((col) => ({
      id: `header-col-${col.column}`,
      type: "columnHeader",
      position: { x: col.x, y: 0 },
      draggable: false,
      selectable: false,
      data: {
        title: col.title,
        totalCredits: col.totalCredits,
        courseCount: col.courseCount,
      },
    }));

    const courseNodes: Node<CourseNodeData>[] = baseLayout.nodes.map(
      (baseNode) => {
        const cId = baseNode.id;
        const c = coursesById.get(cId);
        const isCompleted = completedCourses.has(cId);
        const isPlanned = Boolean(plannedCourses[cId]);
        const isAvailable = availableCoursesSet.has(cId);
        const isSelected = selectedCourseId === cId;
        const isPinned = pinnedCourseId === cId;

        const isPathActive = Boolean(activePathDetails);
        const isFocusNode = activePathDetails?.focusId === cId;
        const isPrereqNode = Boolean(activePathDetails?.ancestors.has(cId));
        const isDepNode = Boolean(activePathDetails?.descendants.has(cId));
        const isInPath = isFocusNode || isPrereqNode || isDepNode;
        const isElective = Boolean(c?.category?.includes("اختياري"));
        const isCriticalDimmed = activeCriticalCourses
          ? !activeCriticalCourses.has(cId)
          : false;
        const isDimmed =
          isCriticalDimmed ||
          (isPathActive && !isInPath) ||
          Boolean(filteredCourseIds && !filteredCourseIds.has(cId));

        return {
          ...baseNode,
          type: "courseNode",
          draggable: false,
          data: {
            id: cId,
            label: c?.name || cId,
            credits: c?.credits || 0,
            isCompleted,
            isPlanned,
            isAvailable,
            isSelected,
            isPinned,
            isFocused: isFocusNode,
            isPrerequisite: isPrereqNode,
            isDependent: isDepNode,
            isInPath,
            isElective,
            isCriticalPath: criticalPathResult.courseIds.has(cId),
            isInActiveCriticalPath: Boolean(activeCriticalCourses?.has(cId)),
            criticalPathsCount: courseCriticalPathsCount.get(cId) || 0,
            grade: courseGrades[cId],
            showGrades,
            minCredits: c?.minCredits,
            hasCoRequisite: Boolean(
              c?.coPrerequisites && c.coPrerequisites.length > 0,
            ),
            offeringSeason: c?.seasonal,
            isDimmed,
          },
        };
      },
    );

    return [...headerNodes, ...courseNodes];
  }, [
    baseLayout,
    coursesById,
    completedCourses,
    plannedCourses,
    availableCoursesSet,
    selectedCourseId,
    pinnedCourseId,
    activePathDetails,
    filteredCourseIds,
    courseGrades,
    showGrades,
    criticalPathResult,
    activeCriticalCourses,
    courseCriticalPathsCount,
  ]);

  // STEP 4: Canvas Edges with dual-color highlighting for upstream prerequisites (Blue), downstream dependents (Emerald), and Critical Paths (Amber)
  const canvasEdges = useMemo(() => {
    return baseLayout.edges.map((baseEdge) => {
      const isCoReq = Boolean(
        (baseEdge.data as Record<string, unknown> | undefined)?.isCoRequisite,
      );
      const isCriticalEdge = Boolean(activeCriticalEdges?.has(baseEdge.id));

      if (isCriticalEdge) {
        return {
          ...baseEdge,
          style: {
            stroke: "#f59e0b",
            strokeWidth: 2.8,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#f59e0b",
            width: 15,
            height: 15,
          },
          animated: true,
          zIndex: 35,
        };
      }

      const isUpstream =
        activePathDetails &&
        (baseEdge.target === activePathDetails.focusId ||
          activePathDetails.ancestors.has(baseEdge.target));

      const isDownstream =
        activePathDetails &&
        (baseEdge.source === activePathDetails.focusId ||
          activePathDetails.descendants.has(baseEdge.source));

      if (isUpstream) {
        return {
          ...baseEdge,
          style: {
            stroke: "#3b82f6",
            strokeWidth: 2.5,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#3b82f6",
            width: 14,
            height: 14,
          },
          animated: true,
          zIndex: 25,
        };
      }

      if (isDownstream) {
        return {
          ...baseEdge,
          style: {
            stroke: "#10b981",
            strokeWidth: 2.5,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#10b981",
            width: 14,
            height: 14,
          },
          animated: true,
          zIndex: 25,
        };
      }

      if (isCoReq) {
        return {
          ...baseEdge,
          style: {
            stroke: "var(--line-control)",
            strokeWidth: 1.5,
            strokeDasharray: "4 4",
            opacity: activePathDetails || activeCriticalCourses ? 0.2 : 0.8,
          },
          animated: false,
          zIndex: 5,
        };
      }

      return {
        ...baseEdge,
        style: {
          stroke: "var(--line)",
          strokeWidth: 1,
          opacity: activePathDetails || activeCriticalCourses ? 0.15 : 1,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "var(--line)",
          width: 10,
          height: 10,
        },
        animated: false,
        zIndex: 0,
      };
    });
  }, [
    baseLayout.edges,
    activePathDetails,
    activeCriticalEdges,
    activeCriticalCourses,
  ]);

  // Group courses by canonical academic semester for mobile view
  const mobileSemestersData = useMemo(() => {
    const SEMESTER_LABELS = [
      "السنة الأولى - الفصل الأول",
      "السنة الأولى - الفصل الثاني",
      "السنة الثانية - الفصل الأول",
      "السنة الثانية - الفصل الثاني",
      "السنة الثالثة - الفصل الأول",
      "السنة الثالثة - الفصل الثاني",
      "السنة الرابعة - الفصل الأول",
      "السنة الرابعة - الفصل الثاني",
      "السنة الخامسة - الفصل الأول",
      "السنة الخامسة - الفصل الثاني",
    ];

    const coursesMap: Record<number, Course[]> = {};
    for (let i = 0; i < SEMESTER_LABELS.length; i++) {
      coursesMap[i] = [];
    }

    planCourses.forEach((c) => {
      const sem = getRecommendedSemesterOfCourse(c);
      let colIdx =
        typeof SEMESTER_INDEX_MAP[sem] === "number"
          ? SEMESTER_INDEX_MAP[sem]
          : -1;
      if (colIdx < 0) {
        const y = parseInt(getYearFromId(c.id)) || 1;
        const hasPrereqInSameYear =
          Array.isArray(c.prerequisites) &&
          c.prerequisites.some((p) => parseInt(getYearFromId(p)) === y);
        const isSem2 =
          hasPrereqInSameYear ||
          Boolean(
            c.name &&
            (c.name.includes("(2)") ||
              c.name.includes(" 2") ||
              c.name.includes("ثاني") ||
              c.name.includes("مختبر")),
          );
        colIdx = Math.min(9, Math.max(0, (y - 1) * 2 + (isSem2 ? 1 : 0)));
      }
      coursesMap[colIdx].push(c);
    });

    const headers = SEMESTER_LABELS.map((title, idx) => {
      const cList = coursesMap[idx] || [];
      const totalCr = cList.reduce((sum, c) => sum + (c.credits || 0), 0);
      return {
        column: idx,
        title,
        totalCredits: totalCr,
        courseCount: cList.length,
      };
    }).filter((h) => h.courseCount > 0);

    return { coursesByColumn: coursesMap, columnHeaders: headers };
  }, [planCourses, SEMESTER_INDEX_MAP]);

  // Group courses by column for graph view
  const coursesByColumn = useMemo(() => {
    const record: Record<number, Course[]> = {};
    baseLayout.nodes.forEach((node) => {
      const colIndex =
        typeof (node.data as any)?.column === "number"
          ? (node.data as any).column
          : Math.max(
              0,
              baseLayout.totalColumns - 1 - Math.round(node.position.x / 288),
            );
      const c = coursesById.get(node.id);
      if (c) {
        if (!record[colIndex]) record[colIndex] = [];
        record[colIndex].push(c);
      }
    });
    return record;
  }, [baseLayout.nodes, baseLayout.totalColumns, coursesById]);

  const selectedCourse = selectedCourseId
    ? coursesById.get(selectedCourseId) || null
    : null;
  const unlockedCourses = useMemo(() => {
    if (!selectedCourseId) return [];
    return courseDependentsMap.get(selectedCourseId) || [];
  }, [selectedCourseId]);

  const matchingCriticalPaths = useMemo(() => {
    if (!selectedCourseId) return [];
    return criticalPathResult.paths.filter((p) =>
      p.courseIds.includes(selectedCourseId),
    );
  }, [selectedCourseId, criticalPathResult]);

  const hasActiveFilters =
    searchQuery ||
    statusFilter !== "all" ||
    yearFilter !== "all" ||
    categoryFilter !== "all" ||
    seasonFilter !== "all";

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setYearFilter("all");
    setCategoryFilter("all");
    setSeasonFilter("all");
  };

  // 1-Click Sync from PTUK Portal (Item 25)
  const handleSyncFromPortal = useCallback(() => {
    const profile = getCachedStudentProfile();
    if (
      profile &&
      profile.passedCourseIds &&
      profile.passedCourseIds.length > 0
    ) {
      let count = 0;
      profile.passedCourseIds.forEach((cId) => {
        if (!completedCourses.has(cId)) {
          onToggleComplete(cId);
          count++;
        }
      });
      showToast(`تمت مزامنة ${count} مساق منجز من بورتال خضوري بنجاح!`);
    } else {
      window.location.hash = "#/login";
    }
  }, [completedCourses, onToggleComplete, showToast]);

  return (
    <PlannerNodeActionsContext.Provider value={plannerActions}>
      <div
        dir="rtl"
        className="w-full h-[calc(100dvh-var(--topbar-h))] flex flex-col bg-[var(--bg)] overflow-hidden"
      >
        {/* Screen Header */}
        <header className="px-4 sm:px-6 py-3 border-b border-[var(--line)] bg-[var(--bg)] shrink-0 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[24px] sm:text-[26px] font-semibold text-[var(--text)] font-['Noto_Naskh_Arabic',serif] leading-tight">
                  خريطة المتطلبات
                </h1>

                {/* View Switcher: Map vs List (hidden on mobile, forced to PlanMobileView) */}
                <div className="hidden md:flex items-center border border-[var(--line-control)] rounded-[var(--r-control)] overflow-hidden bg-[var(--surface)]">
                  <button
                    type="button"
                    onClick={() => setViewMode("map")}
                    className={cn(
                      "px-3 py-1 text-[13px] font-medium transition-colors cursor-pointer flex items-center gap-1",
                      viewMode === "map"
                        ? "bg-[var(--accent)] text-[var(--text-on-accent)]"
                        : "text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)]",
                    )}
                  >
                    <MapIcon size={14} />
                    <span>الخريطة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "px-3 py-1 text-[13px] font-medium transition-colors cursor-pointer flex items-center gap-1",
                      viewMode === "list"
                        ? "bg-[var(--accent)] text-[var(--text-on-accent)]"
                        : "text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)]",
                    )}
                  >
                    <LayoutList size={14} />
                    <span>القوائم</span>
                  </button>
                </div>
              </div>

              {/* Forecaster & Progress Line (Item 17) */}
              <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--text-2)] mt-1">
                <span>
                  الإنجاز:{" "}
                  <span className="privacy-sensitive font-semibold">
                    {earnedCredits} من {totalDegreeCredits} س
                  </span>
                </span>
                <span
                  dir="ltr"
                  className="tabular-nums font-semibold text-[var(--text)] privacy-sensitive"
                >
                  ({progressPercent}%)
                </span>
                <span>•</span>
                <span>
                  المتبقي:{" "}
                  <strong className="text-[var(--text)] privacy-sensitive">
                    {remainingCredits} س
                  </strong>
                </span>
                <span>•</span>
                <span className="text-[var(--accent)] font-medium privacy-sensitive">
                  التخرج التقديري:{" "}
                  {estimatedSemestersNeeded > 0
                    ? `خلال ${estimatedSemestersNeeded} فصول`
                    : "مستوفي الساعات!"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowCategoryBreakdown((prev) => !prev)}
                  className="text-[12px] text-[var(--accent)] hover:underline mr-1 cursor-pointer flex items-center gap-0.5"
                >
                  <span>تفاصيل المتطلبات</span>
                  {showCategoryBreakdown ? (
                    <ChevronUp size={13} />
                  ) : (
                    <ChevronDown size={13} />
                  )}
                </button>
              </div>
            </div>

            {/* Clean Consolidated Header Tools Bar (Item 9) */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
              {/* Major selector */}
              <button
                type="button"
                onClick={onSelectMajor}
                className="min-h-[var(--control-h)] px-2.5 sm:px-3 text-[12px] sm:text-[13px] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--line-control)] rounded-[var(--r-control)] bg-[var(--surface)] hover:bg-[var(--sunken)] transition-colors cursor-pointer flex items-center gap-1 max-w-[130px] sm:max-w-none"
              >
                <span className="truncate">
                  التخصص: {activeMajorName || "تخصص الطالب"}
                </span>
                <ChevronDown
                  size={13}
                  className="text-[var(--text-3)] shrink-0"
                />
              </button>

              {/* Course Search */}
              <div className="relative flex-1 sm:flex-initial">
                <Search
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث (Ctrl+K)..."
                  className="w-full sm:w-44 h-[var(--control-h)] pr-7 pl-2.5 text-[12.5px] bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
                />
              </div>

              {/* Consolidated Plan Options Menu (Item 9) */}
              <div className="relative shrink-0" ref={optionsMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsOptionsMenuOpen((prev) => !prev)}
                  className="min-h-[var(--control-h)] px-2.5 sm:px-3 text-[12px] sm:text-[13px] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--line-control)] rounded-[var(--r-control)] bg-[var(--surface)] hover:bg-[var(--sunken)] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>خيارات</span>
                  <ChevronDown
                    size={13}
                    className={cn(
                      "transition-transform duration-150",
                      isOptionsMenuOpen && "rotate-180",
                    )}
                  />
                </button>

                {isOptionsMenuOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-56 bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-control)] shadow-[var(--shadow-pop)] z-50 py-1.5 text-[12.5px] animate-in fade-in duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsOptionsMenuOpen(false);
                        setIsTransferModalOpen(true);
                      }}
                      className="w-full px-3.5 py-2 text-right hover:bg-[var(--sunken)] flex items-center gap-2.5 cursor-pointer text-[var(--text)]"
                    >
                      <ArrowLeftRight
                        size={15}
                        className="text-[var(--accent)] shrink-0"
                      />
                      <span>محاكاة تحويل التخصص</span>
                    </button>

                    {onAddCourse && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOptionsMenuOpen(false);
                          onAddCourse();
                        }}
                        className="w-full px-3.5 py-2 text-right hover:bg-[var(--sunken)] flex items-center gap-2.5 cursor-pointer text-[var(--text)]"
                      >
                        <Plus
                          size={15}
                          className="text-[var(--accent)] shrink-0"
                        />
                        <span>إضافة مادة حرة / معادلة</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsOptionsMenuOpen(false);
                        setIsExportModalOpen(true);
                      }}
                      className="w-full px-3.5 py-2 text-right hover:bg-[var(--sunken)] flex items-center gap-2.5 cursor-pointer text-[var(--text)]"
                    >
                      <Download
                        size={15}
                        className="text-[var(--accent)] shrink-0"
                      />
                      <span>تصدير الخطة (PDF / صورة)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsOptionsMenuOpen(false);
                        if (typeof window !== "undefined") {
                          navigator.clipboard?.writeText(window.location.href);
                          showToast("تم نسخ رابط الخطة بنجاح");
                        }
                      }}
                      className="w-full px-3.5 py-2 text-right hover:bg-[var(--sunken)] flex items-center gap-2.5 cursor-pointer text-[var(--text)]"
                    >
                      <Share2
                        size={15}
                        className="text-[var(--accent)] shrink-0"
                      />
                      <span>مشاركة رابط الخطة</span>
                    </button>

                    <div className="my-1 border-t border-[var(--line)]" />

                    <button
                      type="button"
                      onClick={() => {
                        setIsOptionsMenuOpen(false);
                        handleSyncFromPortal();
                      }}
                      className="w-full px-3.5 py-2 text-right hover:bg-[var(--sunken)] flex items-center gap-2.5 cursor-pointer text-[var(--text-2)] hover:text-[var(--text)]"
                    >
                      <RefreshCw size={15} className="shrink-0" />
                      <span>مزامنة بورتال خضوري</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2px Full-width Progress Bar */}
          <div className="w-full h-[2px] bg-[var(--line)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-[var(--dur-2)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Graduation Milestone Celebration Banner */}
          {progressPercent >= 100 && (
            <div className="p-3.5 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 rounded-[var(--r-control)] flex flex-wrap items-center justify-between gap-3 text-emerald-950 dark:text-emerald-200 shadow-xs animate-in fade-in duration-300">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <div className="text-[13.5px] font-bold text-emerald-800 dark:text-emerald-300">
                    مبارك! لقد استوفيت كافة متطلبات التخرج (100%)
                  </div>
                  <p className="text-[12px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                    أتممت {earnedCredits} من أصل {totalDegreeCredits} ساعة
                    معتمدة بنجاح. يمكنك الآن تصدير تقرير التخرج الشامل.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[12.5px] font-semibold rounded-[var(--r-control)] flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Download size={14} />
                <span>تصدير تقرير التخرج</span>
              </button>
            </div>
          )}

          {/* Expandable Category & Yearly Breakdown (Item 63) */}
          {showCategoryBreakdown && (
            <div className="p-3.5 bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-control)] space-y-3.5 text-[12px] animate-in fade-in duration-150">
              {/* 1. Academic Years Progress (Item 63) */}
              <div>
                <div className="text-[11.5px] font-bold text-[var(--text-3)] mb-2 flex items-center justify-between">
                  <span>
                    التقدم حسب السنوات الدراسية (
                    {totalDegreeCredits <= 80
                      ? "سنتان"
                      : totalDegreeCredits <= 140
                        ? "4 سنوات"
                        : "5 سنوات"}
                    )
                  </span>
                  <span className="text-[10px] text-[var(--text-3)]">
                    استناداً لترقيم خضوري الأكاديمي
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {yearlyProgress.map((yp) => {
                    const yearNames = [
                      "السنة الأولى",
                      "السنة الثانية",
                      "السنة الثالثة",
                      "السنة الرابعة",
                      "السنة الخامسة",
                    ];
                    const name = yearNames[yp.year - 1] || `السنة ${yp.year}`;
                    return (
                      <div
                        key={yp.year}
                        className="p-2 rounded-lg bg-[var(--sunken)] border border-[var(--line-control)] space-y-1"
                      >
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-semibold text-[var(--text)]">
                            {name}
                          </span>
                          <span className="tabular-nums font-bold text-[var(--text-2)] privacy-sensitive">
                            {yp.percentage}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[var(--line)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${yp.percentage}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-[var(--text-3)] text-left tabular-nums privacy-sensitive">
                          {yp.completedCredits} من {yp.totalCredits} س
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Degree Requirements Categories */}
              <div className="pt-2 border-t border-[var(--line-control)]">
                <div className="text-[11.5px] font-bold text-[var(--text-3)] mb-2">
                  التقدم حسب نوع المتطلب الجامعي
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {Object.entries(effectiveCategoryRequirements).map(
                    ([cat, reqCredits]) => {
                      const earned = completedCreditsPerCategory[cat] || 0;
                      const pct =
                        reqCredits > 0
                          ? Math.min(
                              100,
                              Math.round((earned / reqCredits) * 100),
                            )
                          : 0;
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex justify-between text-[var(--text-2)]">
                            <span className="truncate" title={cat}>
                              {cat}
                            </span>
                            <span className="tabular-nums font-medium text-[var(--text)] privacy-sensitive">
                              {earned}/{reqCredits}
                            </span>
                          </div>
                          <div className="w-full h-[2px] bg-[var(--line)]">
                            <div
                              className="h-full bg-[var(--accent)]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Filters & Toggles Toolbar Row */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            {/* Status Tabs (Horizontally scrollable on mobile) */}
            <div className="flex items-center gap-3 text-[13px] font-medium overflow-x-auto pb-1 no-scrollbar flex-nowrap shrink-0">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={cn(
                  "pb-0.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap",
                  statusFilter === "all"
                    ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                    : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
                )}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("available")}
                className={cn(
                  "pb-0.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap",
                  statusFilter === "available"
                    ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                    : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
                )}
              >
                المتاحة ({availableCoursesSet.size})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("completed")}
                className={cn(
                  "pb-0.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap",
                  statusFilter === "completed"
                    ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                    : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
                )}
              >
                المنجزة ({completedCourses.size})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("remaining")}
                className={cn(
                  "pb-0.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap",
                  statusFilter === "remaining"
                    ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                    : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
                )}
              >
                المتبقية ({courses.length - completedCourses.size})
              </button>
            </div>

            {/* Controls & Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Desktop Canvas Toggles: Grades, Layout Mode */}
              <div className="hidden md:flex items-center gap-2">
                {/* Multiple Critical Paths Toggle Button */}
                {criticalPathResult.paths.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeCriticalPathId) {
                        setActiveCriticalPathId(null);
                        setA11yMessage("تم إلغاء تحديد المسارات الحرجة");
                      } else {
                        setPinnedCourseId(null);
                        setActiveCriticalPathId("all");
                        setA11yMessage(
                          `تم تمييز ${criticalPathResult.paths.length} مسارات تخرج حرجة تضم ${criticalPathResult.courseIds.size} مساقاً`,
                        );
                      }
                    }}
                    className={cn(
                      "h-8 px-2.5 text-[12px] rounded-[var(--r-control)] border flex items-center gap-1.5 transition-colors cursor-pointer",
                      activeCriticalPathId
                        ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 font-semibold shadow-xs"
                        : "border-[var(--line-control)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)]",
                    )}
                    title={`عرض وتحديد المسارات الحرجة المؤدية للتخرج (${criticalPathResult.paths.length} مسارات)`}
                  >
                    <Flame
                      size={13}
                      className={cn(
                        activeCriticalPathId
                          ? "fill-current text-amber-500"
                          : "text-amber-500",
                      )}
                    />
                    <span>
                      المسارات الحرجة ({criticalPathResult.paths.length})
                    </span>
                  </button>
                )}

                {/* Grades Overlay Toggle */}
                <button
                  type="button"
                  onClick={() => setShowGrades((prev) => !prev)}
                  className={cn(
                    "h-8 px-2.5 text-[12px] rounded-[var(--r-control)] border flex items-center gap-1.5 transition-colors cursor-pointer",
                    showGrades
                      ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-semibold"
                      : "border-[var(--line-control)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)]",
                  )}
                  title="عرض علامات المواد المنجزة على الخريطة"
                >
                  <GraduationCap size={13} />
                  <span>الدرجات</span>
                </button>

                {/* Layout Mode Selector (Item 2) */}
                <div className="flex items-center border border-[var(--line-control)] rounded-[var(--r-control)] bg-[var(--surface)] overflow-hidden text-[12px] h-8">
                  <button
                    type="button"
                    onClick={() => setLayoutMode("prerequisite")}
                    className={cn(
                      "px-2.5 h-full transition-colors cursor-pointer flex items-center",
                      layoutMode === "prerequisite"
                        ? "bg-[var(--accent)] text-[var(--text-on-accent)] font-medium"
                        : "text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)]",
                    )}
                    title="ترتيب الأعمدة حسب عمق سلاسل المتطلبات"
                  >
                    سلاسل المتطلبات
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayoutMode("catalog")}
                    className={cn(
                      "px-2.5 h-full transition-colors cursor-pointer flex items-center",
                      layoutMode === "catalog"
                        ? "bg-[var(--accent)] text-[var(--text-on-accent)] font-medium"
                        : "text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)]",
                    )}
                    title="توزيع المواد حسب فصول الخطة الاسترشادية الرسمية"
                  >
                    الخطة الاسترشادية
                  </button>
                </div>
              </div>

              {/* Year selector */}
              {(() => {
                const maxDegreeYear =
                  totalDegreeCredits <= 80
                    ? 2
                    : totalDegreeCredits <= 140
                      ? 4
                      : 5;
                return (
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="h-8 px-2 text-[12px] bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] cursor-pointer hidden sm:block"
                  >
                    <option value="all">جميع السنوات</option>
                    <option value="1">السنة الأولى</option>
                    <option value="2">السنة الثانية</option>
                    {maxDegreeYear >= 3 && (
                      <option value="3">السنة الثالثة</option>
                    )}
                    {maxDegreeYear >= 4 && (
                      <option value="4">السنة الرابعة</option>
                    )}
                    {maxDegreeYear >= 5 && (
                      <option value="5">السنة الخامسة</option>
                    )}
                  </select>
                );
              })()}

              {/* Category selector */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-8 px-2 text-[12px] bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] cursor-pointer max-w-[160px] truncate hidden sm:block"
              >
                <option value="all">جميع المتطلبات</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Offering Season selector (Item 5) */}
              <select
                value={seasonFilter}
                onChange={(e) => setSeasonFilter(e.target.value as any)}
                className="h-8 px-2 text-[12px] bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] cursor-pointer hidden sm:block"
                title="تصفية حسب موسم الطرح (فصل أول / ثاني / صيفي)"
              >
                <option value="all">جميع الفصول المطروحة</option>
                <option value="first">فصل أول (خريف)</option>
                <option value="second">فصل ثاني (ربيع)</option>
                <option value="summer">فصل صيفي</option>
              </select>

              {hasActiveFilters && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11.5px] text-[var(--text-3)] tabular-nums">
                    ({filteredCourseIds ? filteredCourseIds.size : 0} مادة)
                  </span>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-[12px] text-[var(--accent)] hover:underline cursor-pointer font-medium"
                  >
                    إلغاء التصفية
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Multiple Critical Paths Interactive Inspector Strip */}
          {activeCriticalPathId && (
            <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-[var(--r-control)] text-[12px] overflow-x-auto no-scrollbar animate-in fade-in duration-150">
              <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1 shrink-0">
                <Flame
                  size={14}
                  className="fill-current text-amber-600 dark:text-amber-400"
                />
                سلاسل التخرج الحرجة ({criticalPathResult.paths.length}):
              </span>
              <button
                type="button"
                onClick={() => {
                  setPinnedCourseId(null);
                  setActiveCriticalPathId("all");
                  setA11yMessage("عرض كافة المسارات الحرجة");
                }}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer border",
                  activeCriticalPathId === "all"
                    ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                    : "bg-[var(--surface)] text-[var(--text-2)] border-[var(--line-control)] hover:bg-[var(--sunken)]",
                )}
              >
                كافة المسارات ({criticalPathResult.courseIds.size} مادة)
              </button>
              {criticalPathResult.paths.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPinnedCourseId(null);
                    setActiveCriticalPathId(p.id);
                    setA11yMessage(`عرض ${p.name} بطول ${p.length} فصول`);
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer border flex items-center gap-1",
                    activeCriticalPathId === p.id
                      ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                      : "bg-[var(--surface)] text-[var(--text-2)] border-[var(--line-control)] hover:bg-[var(--sunken)]",
                  )}
                >
                  <span>
                    المسار {idx + 1}: {p.name}
                  </span>
                  <span className="text-[10px] opacity-80 tabular-nums">
                    ({p.length} فصول)
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setActiveCriticalPathId(null);
                  setA11yMessage("تم إغلاق عرض المسارات الحرجة");
                }}
                className="text-[11.5px] text-amber-800 dark:text-amber-300 hover:underline mr-auto shrink-0 flex items-center gap-0.5 cursor-pointer font-medium"
              >
                <X size={12} />
                <span>إلغاء التمييز</span>
              </button>
            </div>
          )}

          {/* Pinned Path Badge */}
          {pinnedCourseId && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--accent-soft)] border border-[var(--accent)] rounded-[var(--r-control)] text-[13px] text-[var(--text)]">
              <div className="flex items-center gap-2">
                <Pin size={14} className="text-[var(--accent)] fill-current" />
                <span>
                  مسار مثبت:{" "}
                  <strong>
                    {coursesById.get(pinnedCourseId)?.name || pinnedCourseId}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPinnedCourseId(null)}
                className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <X size={13} />
                <span>إلغاء التثبيت</span>
              </button>
            </div>
          )}
        </header>

        {/* Onboarding PTUK Sync Banner (High conversion CTA for new students) */}
        {completedCourses.size === 0 && (
          <aside
            aria-label="مزامنة الحساب"
            className="bg-[var(--accent-soft)] border-b border-[var(--accent)]/30 px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[12.5px] text-[var(--text)] shrink-0 animate-in fade-in duration-200"
          >
            <div className="flex items-center gap-2.5">
              <GraduationCap
                size={18}
                className="text-[var(--accent)] shrink-0"
              />
              <div>
                <p className="font-bold text-[13px] leading-tight m-0">
                  هل أنت طالب في جامعة خضوري؟
                </p>
                <p className="text-[12px] text-[var(--text-2)] m-0 leading-tight">
                  استورد سجلك الأكاديمي لتحديد المواد المنجزة وفتح المسارات
                  المتاحة بضغطة زر واحدة.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSyncFromPortal}
              className="px-3.5 py-1.5 bg-[var(--accent)] text-[var(--text-on-accent)] font-semibold rounded-[var(--r-control)] hover:opacity-90 transition-opacity cursor-pointer text-[12px] whitespace-nowrap self-start sm:self-auto flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw size={13} />
              <span>مزامنة بورتال خضوري الآن</span>
            </button>
          </aside>
        )}

        {/* Live Accessibility Announcer for Screen Readers */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          id="planner-a11y-announcer"
        >
          {a11yMessage}
        </div>

        {/* Visually Hidden Semantic Structure for Web Crawlers & Assistive Tech */}
        <div className="sr-only">
          <h2>
            الخطة الأكاديمية لتخصص{" "}
            {activeMajorName || "الهندسة وتكنولوجيا المعلومات"}
          </h2>
          <p>إجمالي ساعات الخطة: {totalDegreeCredits} ساعة معتمدة.</p>
          {mobileSemestersData.columnHeaders.map((sem) => (
            <section key={sem.column}>
              <h3>
                {sem.title} ({sem.totalCredits} ساعة معتمدة)
              </h3>
              <ul>
                {mobileSemestersData.coursesByColumn[sem.column]?.map((c) => (
                  <li key={c.id}>
                    <strong>{c.name}</strong> (رمز: {c.id}) - {c.credits} ساعات.
                    {c.prerequisites &&
                      c.prerequisites.length > 0 &&
                      ` المتطلبات السابقة: ${c.prerequisites.join(", ")}`}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Main Viewport Area */}
        <div className="flex-1 relative flex overflow-hidden">
          {isMobile ? (
            <div className="flex-1 overflow-y-auto">
              <PlanMobileView
                columnHeaders={mobileSemestersData.columnHeaders}
                coursesByColumn={mobileSemestersData.coursesByColumn}
                completedCourses={completedCourses}
                plannedCourses={plannedCourses}
                availableCoursesSet={availableCoursesSet}
                filteredCourseIds={filteredCourseIds}
                searchQuery={searchQuery}
                onSelectCourse={(c) => setSelectedCourseId(c.id)}
                onToggleComplete={onToggleComplete}
                onPlanCourse={onPlanCourse}
              />
            </div>
          ) : viewMode === "list" ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <ListView
                activeCourses={courses.filter(
                  (c) => !filteredCourseIds || filteredCourseIds.has(c.id),
                )}
                listGroupBy={listGroupBy}
                setListGroupBy={setListGroupBy}
                completedCourses={completedCourses}
                availableCourses={availableCoursesList}
                plannedCourses={plannedCourses}
                pinnedCourseId={pinnedCourseId}
                setPinnedCourseId={setPinnedCourseId}
                pinnedPath={pinnedPath}
                searchQuery={searchQuery}
                toggleCourseCompletion={onToggleComplete}
                onOpenDetails={(id) => setSelectedCourseId(id)}
                selectedElectives={selectedElectives}
                setSelectedElectives={setSelectedElectives || (() => {})}
                completedCreditsPerCategory={completedCreditsPerCategory}
                courses={courses}
                setPlanningCourseId={() => {}}
                setIsPlannerOpen={() => onNavigateToSemesterPlanning()}
                categoryRequirements={effectiveCategoryRequirements}
                totalDegreeCredits={totalDegreeCredits}
              />
            </div>
          ) : (
            <div className="flex-1 h-full relative bg-[var(--bg)]">
              {filteredCourseIds && filteredCourseIds.size === 0 && (
                <div className="absolute inset-x-0 top-1/4 z-20 mx-auto max-w-sm p-6 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-[var(--shadow-pop)] text-center space-y-2.5 pointer-events-auto">
                  <p className="text-[14.5px] font-bold text-[var(--text)]">
                    لا توجد مواد مطابقة للبحث أو التصفية الحالية
                  </p>
                  <p className="text-[12px] text-[var(--text-3)] leading-relaxed">
                    جرب تعديل كلمة البحث أو إعادة تعيين الفلاتر المحددة
                  </p>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="mt-2 px-4 py-1.5 text-[12.5px] font-semibold bg-[var(--accent)] text-[var(--text-on-accent)] rounded-[var(--r-control)] hover:opacity-90 cursor-pointer"
                  >
                    إلغاء جميع الفلاتر
                  </button>
                </div>
              )}
              <ReactFlow
                nodes={canvasNodes}
                edges={canvasEdges}
                nodeTypes={nodeTypes}
                nodesDraggable={false}
                nodesConnectable={false}
                onlyRenderVisibleElements={true}
                minZoom={0.3}
                maxZoom={2}
                translateExtent={[
                  [-400, -200],
                  [Math.max(3500, baseLayout.totalColumns * 320 + 400), 2500],
                ]}
                preventScrolling={true}
                fitViewOptions={{ minZoom: 0.72, maxZoom: 1.05, padding: 0.12 }}
                onNodeMouseEnter={handleNodeMouseEnter}
                onNodeMouseLeave={handleNodeMouseLeave}
                onPaneClick={() => {
                  setHoveredCourseId(null);
                  if (pinnedCourseId) {
                    setPinnedCourseId(null);
                  } else {
                    setSelectedCourseId(null);
                  }
                }}
                className="bg-[var(--bg)]"
                proOptions={{ hideAttribution: true }}
              />
            </div>
          )}

          {/* Course Details Sidebar */}
          <CourseSidebar
            course={selectedCourse}
            isOpen={Boolean(selectedCourse)}
            onClose={() => setSelectedCourseId(null)}
            isCompleted={
              selectedCourseId ? completedCourses.has(selectedCourseId) : false
            }
            isPlanned={
              selectedCourseId
                ? Boolean(plannedCourses[selectedCourseId])
                : false
            }
            isAvailable={
              selectedCourseId
                ? availableCoursesSet.has(selectedCourseId)
                : false
            }
            isPinned={
              selectedCourseId ? pinnedCourseId === selectedCourseId : false
            }
            onTogglePin={handleTogglePin}
            onToggleComplete={onToggleComplete}
            onPlanCourse={onPlanCourse}
            onSelectCourse={(id) => setSelectedCourseId(id)}
            allCoursesMap={coursesById}
            unlockedCourses={unlockedCourses}
            matchingCriticalPaths={matchingCriticalPaths}
          />
        </div>

        {/* Major Transfer Simulator Modal (Item 24) */}
        <MajorTransferModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          currentMajorId={activeMajorId || "cse-2023"}
          currentMajorName={activeMajorName || "تخصص الطالب"}
          completedCourses={completedCourses}
          courseGrades={courseGrades}
          allCourses={courses}
        />

        {/* Export Plan Modal (Item 29) */}
        {isExportModalOpen && (
          <React.Suspense fallback={null}>
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
              planStartSemester="السنة الأولى - الفصل الأول"
              planEndSemester={
                totalDegreeCredits <= 80
                  ? "السنة الثانية - الفصل الثاني"
                  : totalDegreeCredits <= 140
                    ? "السنة الرابعة - الفصل الثاني"
                    : "السنة الخامسة - الفصل الثاني"
              }
              hidePastSemesters={false}
              darkMode={document.documentElement.dataset.theme === "dark"}
              categoryRequirements={effectiveCategoryRequirements}
              totalDegreeCredits={totalDegreeCredits}
            />
          </React.Suspense>
        )}

        {/* Floating Non-intrusive Toast Notification (Item 12) */}
        {toastMessage && (
          <div className="fixed bottom-16 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--surface)] text-[var(--text)] border border-[var(--accent)] px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-sm font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
            <Sparkles size={16} className="text-[var(--accent)] shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </PlannerNodeActionsContext.Provider>
  );
}

export function PlanPage(props: PlanPageProps) {
  return (
    <ReactFlowProvider>
      <PlanFlowContent {...props} />
    </ReactFlowProvider>
  );
}

export default PlanPage;
