import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { motion } from "motion/react";
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
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  Menu,
  X,
  Search,
  CircleCheckBig,
  Lock,
  BookOpen,
  Trash2,
  Maximize,
  Target,
  Download,
  Printer,
  Upload,
  Pin,
  CalendarDays,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  MessageCircle,
  Heart,
  Map,
  LayoutList,
  Moon,
  Sun,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import "@xyflow/react/dist/style.css";
import { courses, Course, categoryRequirements } from "./data";
import { generateSmartPlan } from "./scheduler";

import { getLayoutedElements, cn } from "./utils";
import { getCourseDetails } from "./courseExplanations";

import {
  courseCommonNames,
  SEMESTERS
} from "./constants";
import CourseNode from "./CourseNode";
import ListView from "./ListView";

export const getPathForCourse = (nodeId: string) => {
  const ancestors = new Set<string>();
  const descendants = new Set<string>();

  const findAncestors = (currId: string) => {
    initialEdges.forEach((e) => {
      if (e.target === currId && !ancestors.has(e.source)) {
        ancestors.add(e.source);
        findAncestors(e.source);
      }
    });
  };

  const findDescendants = (currId: string) => {
    initialEdges.forEach((e) => {
      if (e.source === currId && !descendants.has(e.target)) {
        descendants.add(e.target);
        findDescendants(e.target);
      }
    });
  };

  findAncestors(nodeId);
  findDescendants(nodeId);

  return {
    ancestors,
    descendants,
    allPathNodeIds: new Set([nodeId, ...Array.from(ancestors), ...Array.from(descendants)]),
  };
};

// Helper function to unify availability logic across the app
const isCourseAvailable = (
  course: Course,
  completed: Set<string>,
  categoryCredits: Record<string, number>,
  allCourses: Course[]
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
  if (!course.coPrerequisites || course.coPrerequisites.length === 0) return true;
  return course.coPrerequisites.every((cpId) => {
    if (completed.has(cpId)) return true;
    const cpCourse = allCourses.find(ac => ac.id === cpId);
    return cpCourse ? cpCourse.prerequisites.every(p => completed.has(p)) : true;
  });
};

// Local storage hook
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) {
          return new Set(parsed) as any;
        }
        return parsed;
      }
      return initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      setStoredValue((prev) => {
        try {
          const valueToStore =
            value instanceof Function ? (value as any)(prev) : value;
          if (valueToStore instanceof Set) {
            window.localStorage.setItem(
              key,
              JSON.stringify(Array.from(valueToStore)),
            );
          } else {
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
          }
          return valueToStore;
        } catch (error) {
          console.log(error);
          return prev;
        }
      });
    },
    [key],
  );

  return [storedValue, setValue] as const;
}

// Helpers for cascading completion
const getAllPrerequisites = (
  courseId: string,
  acc = new Set<string>(),
): Set<string> => {
  const course = courses.find((c) => c.id === courseId);
  if (!course) return acc;
  course.prerequisites.forEach((prereqId) => {
    if (!acc.has(prereqId)) {
      acc.add(prereqId);
      getAllPrerequisites(prereqId, acc);
    }
  });
  return acc;
};

const getAllDependents = (
  courseId: string,
  acc = new Set<string>(),
): Set<string> => {
  courses.forEach((c) => {
    if (c.prerequisites.includes(courseId)) {
      if (!acc.has(c.id)) {
        acc.add(c.id);
        getAllDependents(c.id, acc);
      }
    }
  });
  return acc;
};

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

const nodeTypes = {
  courseNode: CourseNode,
};

function FlowComponent() {
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [listGroupBy, setListGroupBy] = useState<"category" | "semester">("semester");
  const [pinnedCourseId, setPinnedCourseId] = useState<string | null>(null);
  const [completedCourses, setCompletedCourses] = useLocalStorage<Set<string>>(
    "completed_courses",
    new Set(),
  );
  const [plannedCourses, setPlannedCourses] = useLocalStorage<
    Record<string, string>
  >("planned_courses", {});
  const [prioritizedElectives, setPrioritizedElectives] = useLocalStorage<
    Set<string>
  >("prioritized_electives", new Set());
  const [selectedElectives, setSelectedElectives] = useLocalStorage<Record<string, string>>(
    "selected_electives_map",
    {
      'univ_1': '13020001',
      'univ_2': '13020009',
      'univ_3': '13020026',
      'spec_1': '12140416',
      'spec_2': '12140549',
      'spec_3': '12140505',
      'spec_4': '12140510',
      'spec_5': '12140526',
    }
  );
  const [isPlanningModeOpen, setIsPlanningModeOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [currentPlanningSemester, setCurrentPlanningSemester] = useState<string | null>(null);
  const [isCourseListModalOpen, setIsCourseListModalOpen] = useState(false);
  const [courseListTab, setCourseListTab] = useState<"available" | "completed" | "all">("available");
  const [expandedCourseListCategories, setExpandedCourseListCategories] = useState<Record<string, boolean>>({});
  const [hasHighGpa, setHasHighGpa] = useState(false);
  const [showElectivesList, setShowElectivesList] = useState(false);
  const [expandedPlanningCategories, setExpandedPlanningCategories] = useState<Record<string, boolean>>({});
  const [isExportLoading, setIsExportLoading] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [planningCourseId, setPlanningCourseId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
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
  const [plannerSelectedCourse, setPlannerSelectedCourse] =
    useState<Course | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [hidePastSemesters, setHidePastSemesters] = useLocalStorage<boolean>(
    "hide_past_semesters",
    true,
  );
  const [isDarkMode, setIsDarkMode] = useLocalStorage<boolean>(
    "dark_mode",
    false,
  );
  const [showAllInMap, setShowAllInMap] = useState(false);

  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);

  const hoveredPath = useMemo(() => {
    if (!hoveredCourseId) return null;
    return getPathForCourse(hoveredCourseId);
  }, [hoveredCourseId]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);
  const { fitView, setCenter } = useReactFlow();

  // التأكد من احتواء الشجرة داخل الشاشة بشكل مثالي عند التحميل الأول
  useEffect(() => {
    fitView({ padding: 0.05, duration: 800 });
  }, [fitView]);

  const activeCourses = useMemo(() => {
    const selectedIds = new Set(Object.values(selectedElectives));
    return courses.filter((c) => {
      const isElective = c.category === 'متطلب جامعة اختياري' || c.category === 'متطلب تخصص اختياري';
      return !isElective || selectedIds.has(c.id);
    });
  }, [selectedElectives]);

  const pinnedPath = useMemo(() => {
    if (!pinnedCourseId) return null;
    return getPathForCourse(pinnedCourseId);
  }, [pinnedCourseId]);

  const applyPlan = (plan: Record<string, string>) => {
    // تحديث الخطة المجدولة
    setPlannedCourses(plan);

    setIsPlannerOpen(true);
    setIsPlanningModeOpen(false);
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    setCompletedCourses(new Set());
    setPlannedCourses({});
    window.localStorage.clear();
    setShowResetConfirm(false);
    // Reload to ensure all states are truly reset from scratch
    window.location.reload();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n");
      const newCompleted = new Set(completedCourses);

      lines.slice(1).forEach((line) => {
        // Split by comma ignoring commas inside quotes
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (parts.length >= 5) {
          const id = parts[0].replace(/"/g, "").trim();
          const status = parts[parts.length - 1].replace(/"/g, "").trim();
          if (status.includes("منجز") && !status.includes("غير")) {
            newCompleted.add(id);
          }
        }
      });
      setCompletedCourses(newCompleted);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleZoomToFit = () => {
    fitView({ duration: 800, padding: 0.2 });
  };

  const handleExportCsv = () => {
    const headers = [
      "رقم المادة",
      "اسم المادة",
      "التصنيف",
      "الساعات",
      "الحالة",
    ].join(",");
    const rows = courses.map((course) => {
      const isCompleted = completedCourses.has(course.id);
      const status = isCompleted ? "منجز" : "غير منجز";
      return `"${course.id}","${course.name}","${course.category}","${course.credits}","${status}"`;
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

  // Compute available courses
  const availableCourses = useMemo(() => {
    return courses.filter((course) =>
      isCourseAvailable(course, completedCourses, completedCreditsPerCategory, courses)
    );
  }, [completedCourses, completedCreditsPerCategory, courses]);

  const groupedCourseList = useMemo(() => {
    let list: Course[] = [];
    if (courseListTab === "available") list = availableCourses;
    else if (courseListTab === "completed") list = activeCourses.filter((c) => completedCourses.has(c.id));
    else list = courses; // Show all 123 courses in the "All" tab

    return list.reduce((acc, course) => {
      if (!acc[course.category]) acc[course.category] = [];
      acc[course.category].push(course);
      return acc;
    }, {} as Record<string, Course[]>);
  }, [courseListTab, availableCourses, activeCourses, completedCourses]);

  const completedCredits = useMemo(() => {
    return activeCourses.reduce((acc, course) => {
      if (completedCourses.has(course.id)) {
        return acc + course.credits;
      }
      return acc;
    }, 0);
  }, [completedCourses, activeCourses]);

  const totalCredits = 164;
  const plannedCredits = useMemo(() => {
    return activeCourses.reduce((acc, course) => {
      if (!completedCourses.has(course.id) && plannedCourses[course.id]) {
        return acc + course.credits;
      }
      return acc;
    }, 0);
  }, [completedCourses, plannedCourses, activeCourses]);

  const progressPercentage =
    Math.round((completedCredits / totalCredits) * 100) || 0;
  const plannedPercentage =
    Math.round((plannedCredits / totalCredits) * 100) || 0;

  const criticalPath = useMemo(() => {
    const memo: Record<string, { length: number; path: string[] }> = {};

    function getLongestPathEndingAt(courseId: string): {
      length: number;
      path: string[];
    } {
      if (memo[courseId]) return memo[courseId];

      const course = courses.find((c) => c.id === courseId);
      if (!course) return { length: 0, path: [] };

      if (course.prerequisites.length === 0) {
        return (memo[courseId] = { length: 1, path: [courseId] });
      }

      let maxLength = 0;
      let longestPrevPath: string[] = [];

      course.prerequisites.forEach((prereqId) => {
        const { length, path } = getLongestPathEndingAt(prereqId);
        if (length > maxLength) {
          maxLength = length;
          longestPrevPath = path;
        }
      });

      return (memo[courseId] = {
        length: maxLength + 1,
        path: [...longestPrevPath, courseId],
      });
    }

    let overallMax = { length: 0, path: [] as string[] };
    courses.forEach((c) => {
      const p = getLongestPathEndingAt(c.id);
      if (p.length > overallMax.length) {
        overallMax = p;
      }
    });

    return new Set(overallMax.path);
  }, []);

  const toggleCourseCompletion = useCallback(
    (courseId: string) => {
      setCompletedCourses((prev) => {
        const next = new Set(prev);
        if (next.has(courseId)) {
          next.delete(courseId);
          // Cascading deletion
          const dependents = getAllDependents(courseId);
          dependents.forEach((depId) => next.delete(depId));
        } else {
          next.add(courseId);
          // Cascading addition
          const prereqs = getAllPrerequisites(courseId);
          prereqs.forEach((preId) => next.add(preId));
        }
        return next;
      });
    },
    [setCompletedCourses],
  );

  const togglePrioritizedElective = useCallback(
    (courseId: string) => {
      setPrioritizedElectives((prev) => {
        const next = new Set(prev);
        if (next.has(courseId)) {
          next.delete(courseId);
        } else {
          next.add(courseId);
        }
        return next;
      });
    },
    [setPrioritizedElectives],
  );

  const exportToImage = async () => {
    const element = document.getElementById("study-plan-printable");
    if (!element) return;

    setIsExportLoading(true);
    try {
      // Small delay to ensure styles and fonts are ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      const dataUrl = await toPng(element, {
        backgroundColor: "#ffffff",
        quality: 1,
        cacheBust: true,
        pixelRatio: 3, // High resolution for the long image
        style: {
          margin: "0",
          padding: "40px",
          borderRadius: "0",
        },
      });

      const link = document.createElement("a");
      link.download = `خطة-التخرج-${new Date().toLocaleDateString("ar-EG")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setIsExportLoading(false);
    }
  };

  const exportToPdf = async () => {
    const element = document.getElementById("study-plan-printable");
    if (!element) return;

    setIsExportLoading(true);
    try {
      // Small delay to ensure styles are fully loaded
      await new Promise((resolve) => setTimeout(resolve, 500));

      const dataUrl = await toPng(element, {
        backgroundColor: "#ffffff",
        quality: 1,
        cacheBust: true,
        pixelRatio: 2, // 2 is optimal for sharp results without excessive file size
        style: {
          margin: "0",
          padding: "40px",
          borderRadius: "0",
        },
      });

      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const pdf = new jsPDF("p", "mm", "a4");
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 295; // A4 height in mm
        const imgHeight = (img.height * imgWidth) / img.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(`خطة-التخرج-${new Date().toLocaleDateString("ar-EG")}.pdf`);
        setIsExportLoading(false);
      };
    } catch (err) {
      console.error("Exporting to PDF failed:", err);
      setIsExportLoading(false);
    }
  };

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
        setCenter(node.position.x + 100, node.position.y + 50, {
          zoom: 1.5,
          duration: 800,
        });
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
        setIsSidebarOpen(false);
        setSelectedNodeId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const ancestors = new Set<string>();
    const descendants = new Set<string>();
    const directPrereqs = new Set<string>();
    const directDeps = new Set<string>();

    if (selectedNodeId) {
      const findAncestors = (nodeId: string) => {
        initialEdges.forEach((e) => {
          if (e.target === nodeId && !ancestors.has(e.source)) {
            ancestors.add(e.source);
            findAncestors(e.source);
          }
        });
      };

      const findDescendants = (nodeId: string) => {
        initialEdges.forEach((e) => {
          if (e.source === nodeId && !descendants.has(e.target)) {
            descendants.add(e.target);
            findDescendants(e.target);
          }
        });
      };

      findAncestors(selectedNodeId);
      findDescendants(selectedNodeId);

      initialEdges.forEach((e) => {
        if (e.target === selectedNodeId) {
          directPrereqs.add(e.source);
        }
        if (e.source === selectedNodeId) {
          directDeps.add(e.target);
        }
      });
    }

    setNodes((nds) =>
      nds.map((n) => {
        const selectedElectiveIds = new Set(Object.values(selectedElectives));
        const cObj = courses.find((c) => c.id === n.id);
        const isElective = cObj?.category === 'متطلب جامعة اختياري' || cObj?.category === 'متطلب تخصص اختياري';
        const isActiveElective = isElective && selectedElectiveIds.has(n.id);
        const isHidden = !showAllInMap && isElective && !isActiveElective;

        const isCompleted = completedCourses.has(n.id);
        const isAvailable = availableCourses.some((c) => c.id === n.id);
        const plannedSemester = plannedCourses[n.id];
        const isPlanned = !!plannedSemester && !isCompleted;

        let isSelected = false;
        let isAncestor = false;
        let isDescendant = false;
        let isDirectPrereq = false;
        let isDirectDep = false;
        let opacity = 1;
        let isCriticalPath = showCriticalPath && criticalPath.has(n.id);

        if (selectedNodeId) {
          isSelected = n.id === selectedNodeId;
          isAncestor = ancestors.has(n.id);
          isDescendant = descendants.has(n.id);
          isDirectPrereq = directPrereqs.has(n.id);
          isDirectDep = directDeps.has(n.id);
          opacity =
            n.id === selectedNodeId ||
              ancestors.has(n.id) ||
              descendants.has(n.id)
              ? 1
              : 0.2;
        }

        return {
          ...n,
          hidden: isHidden,
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
            isCriticalPath,
            toggleCompleted: () => toggleCourseCompletion(n.id),
            showDetails: () => openDetails(n.id),
            onPlan: () => {
              setPlanningCourseId(n.id);
              setIsPlannerOpen(true);
            }
          },
        };
      }),
    );

    setEdges((eds) => {
      const selectedElectiveIds = new Set(Object.values(selectedElectives));
      const processed = eds.map((e) => {
        const isCriticalPathEdge =
          showCriticalPath &&
          criticalPath.has(e.source) &&
          criticalPath.has(e.target);

        if (!selectedNodeId) {
          if (isCriticalPathEdge) {
            return {
              ...e,
              animated: true,
              style: { stroke: "#a855f7", strokeWidth: 4, opacity: 1 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#a855f7" },
            };
          }
          return {
            ...e,
            animated: false,
            style: { stroke: "#94a3b8", strokeWidth: 1.5, opacity: 1 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
          };
        }

        // Find if this edge is part of the ancestor path
        const isAncestorEdge =
          ancestors.has(e.source) &&
          (ancestors.has(e.target) || e.target === selectedNodeId);
        // Find if this edge is part of the descendant path
        const isDescendantEdge =
          (descendants.has(e.source) || e.source === selectedNodeId) &&
          descendants.has(e.target);

        const isDirectPrereqEdge = e.target === selectedNodeId;
        const isDirectDepEdge = e.source === selectedNodeId;

        if (isDirectPrereqEdge) {
          return {
            ...e,
            animated: true,
            style: { stroke: "#059669", strokeWidth: 3, opacity: 1 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#059669" },
          };
        } else if (isDirectDepEdge) {
          return {
            ...e,
            animated: true,
            style: { stroke: "#4f46e5", strokeWidth: 3, opacity: 1 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#4f46e5" },
          };
        } else if (isCriticalPathEdge) {
          return {
            ...e,
            animated: true,
            style: { stroke: "#a855f7", strokeWidth: 4, opacity: 1 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#a855f7" },
          };
        } else if (isAncestorEdge) {
          return {
            ...e,
            animated: false,
            style: { stroke: "#6ee7b7", strokeWidth: 1.5, opacity: 0.7 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#6ee7b7" },
          };
        } else if (isDescendantEdge) {
          return {
            ...e,
            animated: true,
            style: {
              stroke: "#9ca3af",
              strokeWidth: 1.5,
              strokeDasharray: "4",
              opacity: 0.7,
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#9ca3af" },
          };
        } else {
          return {
            ...e,
            animated: false,
            style: { stroke: "#e5e7eb", strokeWidth: 1.5, opacity: 0.3 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#e5e7eb" },
          };
        }
      });

      return processed.map((e) => {
        const sObj = courses.find((c) => c.id === e.source);
        const tObj = courses.find((c) => c.id === e.target);
        const isSourceElective = sObj?.category === 'متطلب جامعة اختياري' || sObj?.category === 'متطلب تخصص اختياري';
        const isTargetElective = tObj?.category === 'متطلب جامعة اختياري' || tObj?.category === 'متطلب تخصص اختياري';
        const isSourceActive = !isSourceElective || selectedElectiveIds.has(e.source);
        const isTargetActive = !isTargetElective || selectedElectiveIds.has(e.target);
        return {
          ...e,
          hidden: !isSourceActive || !isTargetActive,
        };
      });
    });
  }, [
    selectedNodeId,
    setNodes,
    setEdges,
    completedCourses,
    plannedCourses,
    availableCourses,
    toggleCourseCompletion,
    selectedElectives,
    showAllInMap,
  ]);

  return (
    <div
      className={cn(
        "w-screen h-screen print:h-auto overflow-hidden print:overflow-visible flex flex-col font-sans sm:p-4 print:p-0 transition-colors duration-300",
        isDarkMode ? "dark bg-[#0f172a]" : "bg-[#f3f4f6] print:bg-white"
      )}
      dir="rtl"
    >
      <div className="print:hidden w-full h-full flex flex-col">
        {/* Header Section */}
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 bg-white dark:bg-slate-800/95 p-4 sm:p-6 rounded-b-none sm:rounded-xl shadow-sm border-b sm:border border-gray-200 dark:border-slate-700/80 z-10 shrink-0 gap-4 transition-all">
          <div className="flex justify-between items-start w-full xl:w-auto gap-4">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-700 p-1 rounded-lg border border-gray-200 dark:border-slate-600 ml-2">
                  <button
                    onClick={() => setShowAllInMap(false)}
                    className={cn("px-2 py-1 text-[10px] font-black rounded-md transition-all", !showAllInMap ? "bg-white dark:bg-slate-500 shadow-sm" : "text-gray-400")}
                  >
                    خطة التخرج
                  </button>
                  <button
                    onClick={() => setShowAllInMap(true)}
                    className={cn("px-2 py-1 text-[10px] font-black rounded-md transition-all", showAllInMap ? "bg-white dark:bg-slate-500 shadow-sm" : "text-gray-400")}
                  >
                    كامل المنهاج
                  </button>
                </div>

                <BookOpen className="text-blue-600 dark:text-blue-400 hidden sm:block" size={24} />
                خريطة المتطلبات الأكاديمية
                <button
                  onClick={() => {
                    setIsPlanningModeOpen(true);
                    setSelectedNodeId(null); // تصفير المادة المحددة لمنع ظهور مسارات قديمة
                    setIsDetailsOpen(false); // إغلاق نافذة التفاصيل
                    setHoveredCourseId(null); // تصفير حالة التمرير
                    setPlanningCourseId(null); // تصفير مادة التخطيط عند الدخول للوضع العام
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer shadow-sm ml-auto sm:ml-0 font-black"
                >
                  <Map size={16} />
                  وضع التخطيط
                </button>
                <button
                  onClick={() => {
                    setIsCourseListModalOpen(true);
                    setSelectedNodeId(null);
                    setIsDetailsOpen(false);
                    setHoveredCourseId(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer shadow-sm font-black"
                >
                  <LayoutList size={16} />
                  قائمة المواد
                </button>
                <button
                  onClick={() => {
                    setIsPlannerOpen(true);
                    setSelectedNodeId(null); // تصفير المادة المحددة
                    setIsDetailsOpen(false);
                    setHoveredCourseId(null);
                    setPlanningCourseId(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300 dark:hover:bg-orange-900/50 rounded-lg transition-colors cursor-pointer shadow-sm font-bold"
                >
                  <CalendarDays size={16} />
                  عرض الخطة
                </button>

                <button
                  onClick={() => setIsSupportModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 dark:hover:bg-emerald-900/50 rounded-lg transition-colors cursor-pointer shadow-sm font-semibold"
                  title="الدعم والاقتراحات"
                >
                  <MessageCircle size={16} className="text-emerald-600 dark:text-emerald-400" />
                  <span>الدعم والاقتراحات</span>
                </button>
              </h1>
              <p className="text-[10px] sm:text-sm text-gray-500 dark:text-slate-400 uppercase font-semibold flex items-center gap-2">
                تخصص هندسة أنظمة الحاسوب{" "}
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-700"></span> جامعة
                فلسطين التقنية - خضوري (PTUK)
              </p>
              <div className="mt-2 hidden sm:flex items-center gap-2 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-1 rounded-lg border border-amber-100 dark:border-amber-900/30 w-fit animate-in fade-in slide-in-from-right-2 duration-500">
                <Pin size={12} className="rotate-[25deg]" />
                <span>ملاحظة: عند تثبيت المادة، يظهر كامل المسار المعتمد عليها والمتطلبات السابقة.</span>
              </div>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="w-full xl:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative group flex-1 sm:w-64">
              <Search
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"
                size={16}
              />
              <input
                type="text"
                placeholder="ابحث عن مادة أو رقم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 dark:text-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-inner"
              />
              {searchQuery && (
                <div
                  className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden z-50 max-h-60 overflow-y-auto"
                  dir="rtl"
                >
                  {courses
                    .filter((c) => {
                      const q = searchQuery.toLowerCase().trim();
                      const common = courseCommonNames[c.id] || "";
                      return (
                        c.name.toLowerCase().includes(q) ||
                        c.id.includes(q) ||
                        common.toLowerCase().includes(q)
                      );
                    })
                    .map((c) => (
                      <button
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
                  {courses.filter((c) => {
                    const q = searchQuery.toLowerCase().trim();
                    const common = courseCommonNames[c.id] || "";
                    return (
                      c.name.toLowerCase().includes(q) ||
                      c.id.includes(q) ||
                      common.toLowerCase().includes(q)
                    );
                  }).length === 0 && (
                      <div className="p-4 text-center text-sm text-gray-500">
                        لا توجد نتائج
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* تبديل عرض الخريطة / القواسم العمودية */}
            <div className="flex bg-gray-150 dark:bg-slate-850 p-1 rounded-xl border border-gray-200 dark:border-slate-700 h-[38px] shrink-0">
              <button
                onClick={() => setViewMode("map")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                  viewMode === "map"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-850 dark:hover:text-slate-200"
                )}
                title="عرض الخريطة التفاعلية"
              >
                <Map size={14} />
                <span>الخريطة التفاعلية</span>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                  viewMode === "list"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-850"
                )}
                title="عرض المواد في قوائم عمودية"
              >
                <LayoutList size={14} />
                <span>قوائم عمودية</span>
              </button>
            </div>

            {/* زر المود الليلي */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="flex items-center justify-center w-[38px] h-[38px] rounded-xl bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 cursor-pointer shadow-sm transition-colors text-gray-600 dark:text-yellow-400 shrink-0"
              title={isDarkMode ? "الوضع المضيء" : "الوضع المظلم"}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={handleReset}
              className="hidden sm:flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg transition-colors h-[38px]"
            >
              <Trash2 size={16} /> ممحاة
            </button>

            <div className="flex-col hidden lg:flex bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700 rounded-lg px-4 py-1.5 min-w-[200px]">
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
                  style={{ width: `${progressPercentage + plannedPercentage}%` }}
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
                <span>المجموع: 164</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div
          className="flex-1 w-full sm:mx-0 relative bg-white dark:bg-slate-900 sm:rounded-xl shadow-sm border-t sm:border border-gray-200 dark:border-slate-800 overflow-hidden flex flex-col"
          dir="ltr"
        >
          {viewMode === "map" ? (
            <>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.05 }}
                minZoom={0.05}
                maxZoom={1.5}
                attributionPosition="bottom-left"
              >
                <Background color={isDarkMode ? "#334155" : "#e5e7eb"} gap={20} size={2} />
                <Controls
                  className="bg-white dark:bg-slate-800 dark:border-slate-700 shadow-md rounded-md border border-gray-200 dark:text-white overflow-hidden"
                  showInteractive={false}
                  showFitView={false}
                />
              </ReactFlow>

              {/* Legend */}
              <div
                className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 flex flex-col gap-2 z-10"
                dir="rtl"
              >
                <div className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  مؤشر الألوان
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-blue-500 shadow-sm"></span>
                  <span className="text-xs text-gray-700 dark:text-slate-200 font-semibold">محددة</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-emerald-400 shadow-sm border border-emerald-500"></span>
                  <span className="text-xs text-gray-700 dark:text-slate-200 font-semibold">منجزة</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-400"></span>
                  <span className="text-xs text-gray-700 dark:text-slate-200 font-semibold">متاحة</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-purple-500 shadow-lg shadow-purple-200 ring-2 ring-purple-300 dark:ring-purple-900"></span>
                  <span className="text-xs text-purple-700 dark:text-purple-300 font-black">
                    المسار الحرج
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-650"></span>
                  <span className="text-xs text-gray-500 dark:text-slate-400 font-semibold">مغلقة</span>
                </div>
              </div>
            </>
          ) : (
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
              isDarkMode={isDarkMode}
              hoveredCourseId={hoveredCourseId}
              setHoveredCourseId={setHoveredCourseId}
              hoveredPath={hoveredPath}
              focusNode={focusNode}
              onOpenDetails={openDetails}
            />
          )}

          {/* Course Details Overlay (Bottom Panel) */}
          <div
            className={cn(
              "absolute bottom-6 left-[4%] sm:left-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 transition-all duration-300 z-50 w-[92%] sm:w-[450px] overflow-hidden max-h-[85vh] sm:max-h-[75vh] flex flex-col",
              (selectedNodeId && isDetailsOpen)
                ? "translate-y-0 opacity-100 scale-100"
                : "translate-y-full opacity-0 scale-95 pointer-events-none",
            )}
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedNodeId &&
              (() => {
                const node = courses.find((c) => c.id === selectedNodeId);
                if (!node) return null;
                const isComp = completedCourses.has(node.id);
                const isAvail = availableCourses.some((c) => c.id === node.id);
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
                  plannedCourses,
                );

                let stateComponent;
                let buttonText;
                let isDisabled = false;

                if (isComp) {
                  stateComponent = (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded">
                      منجزة
                    </span>
                  );
                  buttonText = "إلغاء المادة كمنجزة";
                } else if (isGroupCompleted && isElective) {
                  stateComponent = (
                    <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2 py-1 rounded">
                      مجموعة مكتملة
                    </span>
                  );
                  buttonText = "المجموعة متكملة";
                  isDisabled = true;
                } else if (isAvail) {
                  stateComponent = (
                    <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      متاحة للتسجيل
                    </span>
                  );
                  buttonText = "تحديد كمادة منجزة";
                } else {
                  stateComponent = (
                    <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2 py-1 rounded flex items-center gap-1">
                      <Lock size={12} /> مغلقة
                    </span>
                  );
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
                    <div className="p-5 pt-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-2 shrink-0">
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
                            "w-full sm:w-[150px] shrink-0 py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm",
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
                                  <span className="text-[10px]">ساعات</span>
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              {categoryCourses.map((course) => {
                                const isComp = completedCourses.has(course.id);
                                const isAvail = availableCourses.some(
                                  (c) => c.id === course.id,
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
                                    onClick={(e) => {
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
                      <span className="text-blue-600 dark:text-blue-400">{completedCredits}</span>{" "}
                      {plannedCredits > 0 && (
                        <span className="text-orange-500 dark:text-orange-400 text-sm break-keep whitespace-nowrap">
                          + {plannedCredits}
                        </span>
                      )}{" "}
                      / <span className="text-gray-500 dark:text-slate-500 text-sm">164</span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner mb-4 relative">
                    {/* طبقة المخطط له (برتقالي) */}
                    <div
                      className="absolute right-0 top-0 h-full bg-orange-400 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${progressPercentage + plannedPercentage}%` }}
                    ></div>
                    {/* طبقة المنجز (أزرق متدرج) */}
                    <div
                      className="absolute right-0 top-0 h-full bg-gradient-to-l from-blue-400 to-blue-600 rounded-full transition-all duration-1000 ease-out"
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
                      onClick={exportToPdf}
                      disabled={isExportLoading}
                      className="flex-1 py-2 text-[11px] font-bold text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-750 border border-gray-200 dark:border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm px-1 disabled:opacity-50"
                      title="تحميل ملف PDF بكامل التفاصيل والمعلومات"
                    >
                      {isExportLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Printer size={14} />
                      )}
                      {isExportLoading ? "جاري..." : "PDF"}
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
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in duration-200 shadow-2xl">
              <div className="flex items-center gap-3 mb-4 text-red-600">
                <Trash2 size={24} />
                <h3 className="text-xl font-black">تهيئة البيانات</h3>
              </div>
              <p className="text-gray-650 font-medium text-sm mb-6 leading-relaxed">
                هل أنت متأكد من مسح كافة بيانات المواد المنجزة؟ هذا الإجراء لا
                يمكن التراجع عنه.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmReset}
                  className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md shadow-red-200"
                >
                  تأكيد الحذف
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Support / Technical Assistance and feedback Modal */}
        {isSupportModalOpen && (
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4"
            onClick={() => setIsSupportModalOpen(false)}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 sm:p-8 flex flex-col gap-5 relative animate-in zoom-in-95 duration-200 text-right font-sans max-h-[90vh] overflow-y-auto"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsSupportModalOpen(false)}
                className="absolute top-4 left-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-all"
                title="إغلاق"
              >
                <X size={20} />
              </button>

              <div>
                <div className="flex items-center gap-2.5 mb-2 justify-start">
                  <span className="p-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-305 rounded-xl">
                    <MessageCircle
                      size={24}
                      className="text-emerald-600 dark:text-emerald-400 animate-pulse"
                    />
                  </span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300 px-2.5 py-1 rounded-md">
                    تواصل مباشر
                  </span>
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-slate-100 text-right leading-tight mb-1">
                  الدعم الفني والاقتراحات
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                  موقع خريطة فلسطين الأكاديمية - هندسة أنظمة الحاسوب
                </p>
              </div>

              <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed font-semibold bg-gray-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-gray-100 dark:border-slate-850 text-right">
                إذا واجهتك أي مشكلة تقنية أثناء استخدام الخريطة الأكاديمية، أو
                رغبت في رفع اقتراح لتطوير الموقع وتحسين تجربة الطلاب، يسعدنا
                تواصلك المباشر مع مطور الموقع <strong>(محمد حدرب)</strong> عبر
                الخيارات المتاحة أدناه:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Facebook Card */}
                <a
                  href="https://www.facebook.com/mhmd.hdrb.2025"
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10 hover:bg-blue-50/50 dark:hover:bg-blue-950/25 hover:border-blue-300 dark:hover:border-blue-800 transition-all group flex flex-col justify-between h-32 shadow-sm hover:shadow-md cursor-pointer text-right"
                >
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-blue-600 dark:text-blue-400 font-bold text-xs bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-md">
                        فيسبوك
                      </span>
                      <svg
                        className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
                      </svg>
                    </div>
                    <h4 className="font-extrabold text-sm text-gray-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                      مطور الخريطة
                    </h4>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold mt-0.5">
                      @mhmd.hdrb.2025
                    </p>
                  </div>
                  <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-2">
                    زيارة الملف الشخصي ←
                  </span>
                </a>

                {/* WhatsApp Card */}
                <a
                  href="https://wa.me/972568718784"
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/25 hover:border-emerald-300 dark:hover:border-emerald-800 transition-all group flex flex-col justify-between h-32 shadow-sm hover:shadow-md cursor-pointer text-right"
                >
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md">
                        واتساب
                      </span>
                      <svg
                        className="w-5 h-5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12.012 2c-5.506 0-9.973 4.467-9.973 9.974 0 2.006.591 3.877 1.614 5.451L2.03 22l4.71-.97c1.513.822 3.232 1.29 5.059 1.29l.006-.001c5.507 0 9.973-4.467 9.973-9.973 0-5.507-4.467-9.973-9.974-9.973zm-.006 17.154h-.005a7.17 7.17 0 0 1-3.667-1.002H8.33l-2.723.56.57-2.656-.05-.078a7.17 7.17 0 0 1-1.096-3.82c0-3.957 3.218-7.174 7.178-7.174 1.917 0 3.719.747 5.074 2.104a7.135 7.135 0 0 1 2.101 5.074c-.001 3.959-3.218 7.177-7.175 7.192zm3.931-5.367c-.215-.108-1.272-.63-1.468-.702-.197-.072-.34-.108-.483.108-.144.215-.556.702-.68.845-.125.143-.25.161-.466.054-.215-.108-.91-.336-1.734-1.071-.64-.572-1.073-1.278-1.199-1.493-.125-.215-.013-.331.094-.438.097-.096.215-.25.323-.376.108-.125.143-.215.215-.359.071-.144.035-.269-.018-.376s-.483-1.164-.662-1.594c-.175-.42-.35-.362-.483-.369h-.414c-.143 0-.376.054-.573.269s-.751.735-.751 1.79c0 1.054.767 2.072.874 2.215s1.509 2.302 3.655 3.228c.511.22 1.096.353 1.472.333.376-.021 1.15-.47 1.311-.925.162-.455.162-.845.114-.925-.049-.08-.179-.125-.394-.233z" />
                      </svg>
                    </div>
                    <h4 className="font-extrabold text-sm text-gray-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      مراسلة واتساب فورية
                    </h4>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold mt-0.5">
                      محادثة مباشرة دون حفظ الرقم
                    </p>
                  </div>
                  <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-2">
                    بدء المحادثة ←
                  </span>
                </a>
              </div>

              {/* Replicated WhatsApp QR Card view */}
              <div className="flex flex-col items-center bg-emerald-500/10 dark:bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/20 dark:border-emerald-500/10 mt-2">
                <span className="text-xs font-bold text-gray-700 dark:text-slate-300 mb-3 block text-center">
                  أو امسح رمز كود الواتساب التالي:
                </span>

                <div
                  className="w-64 bg-[#128C7E] rounded-3xl overflow-hidden shadow-xl p-6 flex flex-col items-center text-center relative font-sans select-none animate-in fade-in zoom-in-95 duration-300"
                  dir="ltr"
                >
                  <div className="w-12 h-12 bg-black rounded-full border-4 border-white flex items-center justify-center absolute -top-6 left-1/2 -translate-x-1/2 shadow-inner">
                    <span className="text-white text-base font-black">M</span>
                  </div>

                  {/* White card sub-container */}
                  <div className="bg-white rounded-2xl w-full p-5 mt-4 shadow-md flex flex-col items-center">
                    <h4 className="text-gray-900 font-bold text-sm tracking-wide">
                      Mohammed Hodrob
                    </h4>
                    <p className="text-gray-400 text-[10px] font-semibold mt-1">
                      WhatsApp contact
                    </p>

                    {/* Real QR image generator pointing to decoded WhatsApp url */}
                    <div className="bg-white p-2.5 rounded-lg border border-gray-150 mt-4 relative group">
                      <img
                        src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://wa.me/972568718784"
                        alt="WhatsApp QR Code"
                        referrerPolicy="no-referrer"
                        className="w-40 h-40 object-contain transition-transform group-hover:scale-105 duration-200"
                      />

                      {/* Tiny WhatsApp icon badge right in the center */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow">
                        <svg
                          className="w-6 h-6 text-[#128C7E]"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2C6.48 2 2 6.48 2 12c0 1.76.46 3.42 1.26 4.87L1.13 22.8l6.12-1.22c1.4.74 3 1.15 4.75 1.15 5.52 0 10-4.48 10-10S17.52 2 12 2z" />
                          <path
                            d="M15.3 14.98c-.14.2-.73.4-1 .4-.25 0-.58-.08-1.78-.58-1.53-.63-2.52-2.2-2.6-2.3-.08-.1-.64-.85-.64-1.63 0-.78.4-1.16.55-1.32.14-.15.3-.22.45-.22H11c.14 0 .32.06.46.25.15.2.5 1.25.55 1.34.05.1.08.2.01.32-.07.12-.1.25-.21.37-.1.12-.22.2-.33.34-.1.1-.23.23-.1.46.14.23.63 1.03 1.35 1.67.92.83 1.7 1.08 1.94 1.2.23.12.37.1.5-.04.14-.15.6-.7.76-.94s.3-.2.53-.1.15 0 2.22 1.06c.15.1.25.15.3.23.05.08.05.47-.1.87z"
                            fill="white"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Subtitle bottom text */}
                  <p className="text-white text-[10px] font-bold text-center leading-relaxed mt-4 px-2 w-full">
                    Scan this code using the WhatsApp camera to get my number
                  </p>
                  <p
                    className="text-white/80 text-[10px] font-bold text-center mt-1"
                    dir="rtl"
                  >
                    امسح الرمز بكاميرا واتساب الرسمية للبدء في مراسلتي
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5 border-t border-gray-150 dark:border-slate-800 pt-4 mt-2">
                <button
                  onClick={() => setIsSupportModalOpen(false)}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-750 dark:text-slate-200 text-xs font-extrabold rounded-xl transition-all cursor-pointer text-center"
                >
                  إغلاق النافذة
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        <div
          className={cn(
            "fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 transition-all duration-300",
            isExportModalOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none",
          )}
          onClick={() => setIsExportModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-0 w-full max-w-6xl h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                  <Download size={28} className="text-emerald-600" />
                  تنزيل وتصدير الخطة
                </h2>
                <p className="text-gray-500 text-sm font-medium">
                  معاينة الخطة وتحميلها بملف PDF أو صورة عالية الجودة مباشرة
                  لجهازك
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={exportToImage}
                  disabled={isExportLoading}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                >
                  {isExportLoading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <ImageIcon size={20} />
                  )}
                  حفظ كصورة (PNG)
                </button>
                <button
                  onClick={exportToPdf}
                  disabled={isExportLoading}
                  className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-250 disabled:opacity-50"
                >
                  {isExportLoading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Download size={20} />
                  )}
                  تحميل كـ ملف PDF
                </button>
                <div className="hidden sm:block h-8 w-px bg-gray-200 mx-1"></div>
                <button
                  onClick={() => setIsExportModalOpen(false)}
                  className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Instructions for better results */}
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-2 text-[11px] text-amber-700 font-medium flex items-center gap-2">
              <Sparkles size={14} />
              <span>
                نصيحة: إذا كنت تستخدم المتصفح داخل تطبيق آخر، يفضل "حفظ كصورة"
                للحصول على أفضل نتيجة.
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-12 bg-gray-50 print:p-0">
              <div
                id="study-plan-printable"
                className="max-w-5xl mx-auto border-2 border-gray-900 p-8 rounded-[2rem] relative bg-white shadow-2xl print:shadow-none"
              >
                <div className="flex justify-between items-center mb-10 border-b-2 border-gray-900 pb-8">
                  <div className="space-y-1">
                    <h1 className="text-3xl font-black text-gray-900">
                      خارطة طريق التخرج
                    </h1>
                    <p className="text-lg font-bold text-gray-600">
                      هندسة أنظمة الحاسوب - PTUK
                    </p>
                  </div>
                  <div className="text-left py-2 px-4 bg-gray-900 text-white rounded-xl">
                    <div className="text-xs opacity-70 uppercase tracking-widest font-black">
                      عدد الساعات المنجزة
                    </div>
                    <div className="text-2xl font-black">
                      {completedCredits} / 164
                    </div>
                  </div>
                </div>

                <div className="space-y-10">
                  {/* Stats Summary */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl">
                      <div className="text-[10px] font-black text-blue-600 uppercase mb-1">
                        إجمالي الخطة
                      </div>
                      <div className="text-xl font-black text-blue-900">
                        {Object.keys(plannedCourses).length} مساقاً
                      </div>
                    </div>
                    <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl">
                      <div className="text-[10px] font-black text-emerald-600 uppercase mb-1">
                        ساعات منجزة في الخطة
                      </div>
                      <div className="text-xl font-black text-emerald-900">
                        {courses
                          .filter(
                            (c) =>
                              plannedCourses[c.id] &&
                              completedCourses.has(c.id),
                          )
                          .reduce((sum, c) => sum + c.credits, 0)}{" "}
                        ساعة
                      </div>
                    </div>
                    <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-2xl">
                      <div className="text-[10px] font-black text-orange-600 uppercase mb-1">
                        ساعات متبقية في الخطة
                      </div>
                      <div className="text-xl font-black text-orange-900">
                        {courses
                          .filter(
                            (c) =>
                              plannedCourses[c.id] &&
                              !completedCourses.has(c.id),
                          )
                          .reduce((sum, c) => sum + c.credits, 0)}{" "}
                        ساعة
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {SEMESTERS.map((semester) => {
                      const semCourses = courses.filter(
                        (c) => plannedCourses[c.id] === semester,
                      );
                      if (semCourses.length === 0) return null;

                      return (
                        <div key={semester} className="break-inside-avoid">
                          <div className="flex items-center gap-4 mb-4">
                            <h3 className="text-lg font-black text-white bg-gray-900 px-6 py-2 rounded-xl shadow-lg">
                              {semester}
                            </h3>
                            <div className="h-0.5 flex-1 bg-gray-100"></div>
                            <div className="text-sm font-bold text-gray-400">
                              {semCourses.reduce(
                                (sum, c) => sum + c.credits,
                                0,
                              )}{" "}
                              ساعة معتمدة
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {semCourses.map((course) => (
                              <div
                                key={course.id}
                                className="group p-4 bg-white border border-gray-100 rounded-2xl flex flex-col justify-between hover:border-gray-900 transition-all duration-300 pointer-events-auto cursor-pointer"
                                onClick={(e) => {

                                  setPlannerSelectedCourse(course);
                                }}
                              >
                                <div>
                                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-1">
                                    {course.id}
                                  </div>
                                  <div className="text-sm font-bold text-gray-800 leading-tight group-hover:text-blue-600 transition-colors">
                                    {course.name}
                                  </div>
                                </div>
                                <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-lg">
                                    {course.credits} ساعة
                                  </span>
                                  <div
                                    className={cn(
                                      "flex items-center gap-1.5 text-[10px] font-black",
                                      completedCourses.has(course.id)
                                        ? "text-emerald-600"
                                        : "text-orange-500",
                                    )}
                                  >
                                    {completedCourses.has(course.id) ? (
                                      <>
                                        <CircleCheckBig size={10} /> منجز
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles size={10} /> مخطط
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-12 pt-8 border-t-2 border-gray-900 flex justify-between items-end">
                  <div className="text-gray-400 text-[10px] font-bold">
                    تم توليد هذه الخطة بواسطة بوابتي الذكية -{" "}
                    {new Date().toLocaleDateString("ar-PS")}
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      <span className="text-[10px] font-black text-gray-600">
                        مواد منجزة
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                      <span className="text-[10px] font-black text-gray-600">
                        مواد مخططة
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Planning Mode Modal */}
        {isPlanningModeOpen && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
            onClick={() => { setIsPlanningModeOpen(false); setCurrentPlanningSemester(null); setExpandedPlanningCategories({}); }}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-3xl p-0 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden border border-gray-100 dark:border-slate-800 flex flex-col max-h-[90vh]"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-orange-600 via-orange-500 to-yellow-500"></div>

              {/* Header */}
              <div className="p-6 border-b border-gray-100 dark:border-slate-850 flex justify-between items-center bg-gray-50/50 dark:bg-slate-950/20 shrink-0">
                <h2 className="text-xl font-black text-gray-800 dark:text-slate-100 flex items-center gap-3">
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2.5 rounded-2xl text-white shadow-lg shadow-orange-200 dark:shadow-none">
                    <CalendarDays size={24} />
                  </div>
                  <span>{currentPlanningSemester ? `تخطيط ${currentPlanningSemester}` : "بدء التخطيط "}</span>
                </h2>
                <button onClick={() => { setIsPlanningModeOpen(false); setCurrentPlanningSemester(null); setExpandedPlanningCategories({}); }} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X /></button>
              </div>

              <div className="p-6 overflow-y-auto">
                {!currentPlanningSemester ? (
                  <div className="space-y-6">
                    <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                      <p className="text-sm font-bold text-orange-800 dark:text-orange-300 leading-relaxed">
                        أهلاً بك في وضع التخطيط . يرجى تحديد الفصل الدراسي القادم الذي ترغب في البدء بتخطيط مواده:
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {SEMESTERS.map(s => (
                        <button
                          key={s}
                          onClick={() => setCurrentPlanningSemester(s)}
                          className="text-right p-4 rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-orange-500 transition-all text-xs font-black dark:text-slate-200 shadow-sm"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Column 1: Available to Add */}
                      {(() => {
                        const allPrev = new Set(completedCourses);
                        Object.entries(plannedCourses).forEach(([id, s]) => {
                          if (SEMESTERS.indexOf(s) < SEMESTERS.indexOf(currentPlanningSemester!)) allPrev.add(id);
                        });

                        const tempCredits: Record<string, number> = {}; // To handle limit check during planning
                        const available = courses.filter(c => {
                          const isComp = completedCourses.has(c.id);
                          const isPlannedInPrev = Object.entries(plannedCourses).some(([id, s]) => id === c.id && SEMESTERS.indexOf(s) < SEMESTERS.indexOf(currentPlanningSemester!));
                          const isPlannedNow = plannedCourses[c.id] === currentPlanningSemester;
                          if (isComp || isPlannedInPrev || isPlannedNow) return false;
                          return isCourseAvailable(c, allPrev, {}, courses);
                        });

                        const grouped = available.reduce((acc, c) => {
                          if (!acc[c.category]) acc[c.category] = [];
                          acc[c.category].push(c);
                          return acc;
                        }, {} as Record<string, Course[]>);

                        return (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-xs font-black text-gray-500 dark:text-slate-400 flex items-center gap-2">
                                <BookOpen size={14} /> المواد المتاحة هذا الفصل
                              </h3>
                              {Object.keys(grouped).length > 0 && (
                                <button
                                  onClick={() => {
                                    const isAnyOpen = Object.values(expandedPlanningCategories).some(v => v === true);
                                    const newState: Record<string, boolean> = {};
                                    if (!isAnyOpen) Object.keys(grouped).forEach(cat => { newState[cat] = true; });
                                    setExpandedPlanningCategories(newState);
                                  }}
                                  className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors"
                                >
                                  {Object.values(expandedPlanningCategories).some(v => v === true) ? "طي الكل" : "فرد الكل"}
                                </button>
                              )}
                            </div>
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
                              {Object.keys(grouped).length === 0 ? (
                                <div className="text-center py-10 text-xs font-bold text-gray-400">لا توجد مواد متاحة حالياً للجدولة</div>
                              ) : (
                                Object.entries(grouped).map(([category, items]) => {
                                  const isExpanded = expandedPlanningCategories[category] === true; // Default to closed
                                  return (
                                    <div key={category} className="border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                      <button
                                        onClick={() => setExpandedPlanningCategories(prev => ({ ...prev, [category]: !isExpanded }))}
                                        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/80 hover:bg-gray-100 transition-colors"
                                      >
                                        <span className="text-[11px] font-black text-gray-700 dark:text-slate-200">{category} ({items.length})</span>
                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                      </button>

                                      {isExpanded && (
                                        <div className="p-2 bg-white dark:bg-slate-900/50 space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                                          {items.map(c => (
                                            <button
                                              key={c.id}
                                              onClick={() => setPlannedCourses(prev => ({ ...prev, [c.id]: currentPlanningSemester! }))}
                                              className="w-full text-right p-2.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl hover:border-blue-400 hover:shadow-sm transition-all flex justify-between items-center group"
                                            >
                                              <div className="flex flex-col items-start gap-0.5">
                                                <span className="text-[11px] font-bold text-gray-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors">{c.name}</span>
                                                <span className="text-[9px] font-mono text-gray-400">{c.id}</span>
                                              </div>
                                              <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">{c.credits} س</span>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                              <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 leading-relaxed">
                                💡 اضغط على اسم المجموعة لطيها أو فردها. يتم عرض المواد التي حققت متطلباتها السابقة فقط.
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Column 2: Selected in Current Semester */}
                      <div className="bg-gray-50 dark:bg-slate-800/40 rounded-3xl p-5 flex flex-col gap-4 border border-gray-100 dark:border-slate-800">
                        <h3 className="text-sm font-black text-gray-800 dark:text-slate-100">المواد المجدولة في هذا الفصل:</h3>
                        <div className="flex-1 space-y-2 min-h-[100px]">
                          {Object.entries(plannedCourses).filter(([id, s]) => s === currentPlanningSemester).map(([id]) => {
                            const c = courses.find(cr => cr.id === id);
                            return (
                              <div key={id} className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800 flex justify-between items-center shadow-sm">
                                <span className="text-xs font-bold text-gray-700 dark:text-slate-300 truncate pl-2">{c?.name}</span>
                                <button onClick={() => setPlannedCourses(prev => { const n = { ...prev }; delete n[id]; return n; })} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                              </div>
                            );
                          })}
                        </div>

                        <div className="pt-4 border-t border-gray-200 dark:border-slate-700 space-y-3">
                          {(() => {
                            const currentCr = Object.entries(plannedCourses).filter(([id, s]) => s === currentPlanningSemester).reduce((s, [id]) => s + (courses.find(cr => cr.id === id)?.credits || 0), 0);
                            const isSummer = currentPlanningSemester!.includes("صيفي");
                            const limit = isSummer ? (hasHighGpa ? 10 : 9) : (hasHighGpa ? 21 : 18);
                            const exceeded = currentCr > limit;

                            return (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-black text-gray-500">مجموع الساعات:</span>
                                  <span className={cn("text-lg font-black", exceeded ? "text-red-600 animate-pulse" : "text-blue-600")}>{currentCr} / {limit}</span>
                                </div>

                                {exceeded && (
                                  <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/50">
                                    <p className="text-[10px] font-black text-red-700 dark:text-red-400 leading-relaxed mb-2">
                                      ⚠️ تنبيه: لقد تجاوزت الحد المسموح به لهذا الفصل.
                                    </p>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input type="checkbox" checked={hasHighGpa} onChange={e => setHasHighGpa(e.target.checked)} className="w-3.5 h-3.5 rounded" />
                                      <span className="text-[10px] font-black text-gray-700 dark:text-slate-300">معدلي التراكمي عالٍ (يسمح بزيادة الحمولة)</span>
                                    </label>
                                  </div>
                                )}

                                <button
                                  onClick={() => {
                                    const nextIdx = SEMESTERS.indexOf(currentPlanningSemester!) + 1;
                                    if (nextIdx < SEMESTERS.length) {
                                      const nextSem = SEMESTERS[nextIdx];
                                      setCurrentPlanningSemester(nextSem);
                                      setHasHighGpa(false);
                                      setShowElectivesList(false);
                                    } else {
                                      setIsPlanningModeOpen(false);
                                      setCurrentPlanningSemester(null);
                                      setIsPlannerOpen(true);
                                      alert("تم الانتهاء من تخطيط كافة الفصول!");
                                    }
                                  }}
                                  disabled={exceeded && !hasHighGpa}
                                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                >
                                  <CircleCheckBig size={18} /> تثبيت الفصل والانتقال للتالي
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Course List Modal */}
        {isCourseListModalOpen && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
            onClick={() => { setIsCourseListModalOpen(false); setExpandedCourseListCategories({}); }}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-3xl p-0 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden border border-gray-100 dark:border-slate-800 flex flex-col max-h-[90vh]"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500"></div>

              {/* Header */}
              <div className="p-6 border-b border-gray-100 dark:border-slate-850 flex justify-between items-center bg-gray-50/50 dark:bg-slate-950/20 shrink-0">
                <h2 className="text-xl font-black text-gray-800 dark:text-slate-100 flex items-center gap-3">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-none">
                    <LayoutList size={24} />
                  </div>
                  <span>قائمة المواد</span>
                </h2>
                <button onClick={() => { setIsCourseListModalOpen(false); setExpandedCourseListCategories({}); }} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X /></button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100 dark:border-slate-800 px-6 pt-2 gap-6 bg-gray-50/30 dark:bg-slate-900/30 shrink-0">
                <button
                  className={cn(
                    "pb-3 px-1 text-sm font-black border-b-2 transition-colors",
                    courseListTab === "available"
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200",
                  )}
                  onClick={() => setCourseListTab("available")}
                >
                  متاح للتسجيل ({availableCourses.length})
                </button>
                <button
                  className={cn(
                    "pb-3 px-1 text-sm font-black border-b-2 transition-colors",
                    courseListTab === "completed"
                      ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                      : "border-transparent text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200",
                  )}
                  onClick={() => setCourseListTab("completed")}
                >
                  منجز ({completedCourses.size})
                </button>
                <button
                  className={cn(
                    "pb-3 px-1 text-sm font-black border-b-2 transition-colors",
                    courseListTab === "all"
                      ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200",
                  )}
                  onClick={() => setCourseListTab("all")}
                >
                  كل المواد ({activeCourses.length})
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 scrollbar-thin">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-gray-500 dark:text-slate-400 flex items-center gap-2">
                      <BookOpen size={14} /> تصنيف المواد حسب النوع
                    </h3>
                    {Object.keys(groupedCourseList).length > 0 && (
                      <button
                        onClick={() => {
                          const isAnyOpen = Object.values(expandedCourseListCategories).some(v => v === true);
                          const newState: Record<string, boolean> = {};
                          if (!isAnyOpen) Object.keys(groupedCourseList).forEach(cat => { newState[cat] = true; });
                          setExpandedCourseListCategories(newState);
                        }}
                        className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        {Object.values(expandedCourseListCategories).some(v => v === true) ? "طي الكل" : "فرد الكل"}
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {Object.keys(groupedCourseList).length === 0 ? (
                      <div className="text-center py-10 text-sm font-bold text-gray-400">لا توجد مواد في هذا القسم حالياً</div>
                    ) : (
                      Object.entries(groupedCourseList).map(([category, items]) => {
                        const isExpanded = expandedCourseListCategories[category] === true;
                        return (
                          <div key={category} className="border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                            <button
                              onClick={() => setExpandedCourseListCategories(prev => ({ ...prev, [category]: !isExpanded }))}
                              className="w-full flex items-center justify-between p-3.5 bg-gray-50 dark:bg-slate-800/80 hover:bg-gray-100 transition-colors"
                            >
                              <span className="text-[12px] font-black text-gray-700 dark:text-slate-200">{category} ({items.length})</span>
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {isExpanded && (
                              <div className="p-3 bg-white dark:bg-slate-900/50 space-y-2 animate-in slide-in-from-top-1 duration-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {items.map(c => (
                                  <div
                                    key={c.id}
                                    className="w-full p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl hover:border-blue-400 hover:shadow-md transition-all flex justify-between items-center group relative overflow-hidden"
                                  >
                                    <div
                                      className="flex flex-col items-start gap-1 cursor-pointer flex-1"
                                      onClick={() => {
                                        focusNode(c.id);
                                        setIsCourseListModalOpen(false);
                                      }}
                                    >
                                      <span className="text-[11px] font-black text-gray-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors line-clamp-1">{c.name}</span>
                                      <span className="text-[9px] font-mono text-gray-400">{c.id}</span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">{c.credits} س</span>

                                      <div className="flex gap-1 border-r border-gray-100 dark:border-slate-700 pr-1 mr-1">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); toggleCourseCompletion(c.id); }}
                                          className={cn(
                                            "p-1.5 rounded-lg transition-colors",
                                            completedCourses.has(c.id) ? "text-red-500 bg-red-50 dark:bg-red-900/20" : "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                                          )}
                                          title={completedCourses.has(c.id) ? "إلغاء الإنجاز" : "تحديد كمنجز"}
                                        >
                                          {completedCourses.has(c.id) ? <Trash2 size={14} /> : <CircleCheckBig size={14} />}
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setPlanningCourseId(c.id); setIsPlannerOpen(true); setIsCourseListModalOpen(false); }}
                                          className={cn(
                                            "p-1.5 rounded-lg transition-colors",
                                            plannedCourses[c.id] ? "text-orange-500 bg-orange-50 dark:bg-orange-900/20" : "text-gray-400 hover:text-orange-500"
                                          )}
                                          title="تخطيط المادة"
                                        >
                                          <CalendarDays size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Planner Modal */}
        {isPlannerOpen && (
          <div
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setIsPlannerOpen(false)}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-gray-800 dark:text-slate-100 flex items-center gap-2">
                  <CalendarDays className="text-orange-500" />
                  الخطة الفصلية
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsExportModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all font-bold text-sm shadow-sm"
                  >
                    <Download size={18} className="text-emerald-600 dark:text-emerald-400" />
                    تنزيل الخطة (PDF / صورة)
                  </button>
                  <button
                    onClick={() => {
                      setIsPlannerOpen(false);
                      setPlanningCourseId(null);
                    }}
                    className="p-2 text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X />
                  </button>
                </div>
              </div>

              {/* Controls Bar for Planning Boundaries */}
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-right">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-black text-indigo-600 bg-indigo-55 px-2 py-0.5 rounded-md border border-indigo-100">
                    تحجيم التخطيط الأكاديمي
                  </span>
                  <span className="text-xs font-extrabold text-gray-750 dark:text-slate-300">
                    بداية التخطيط الفعلي (الفصل القادم):
                  </span>
                  <select
                    value={planStartSemester}
                    onChange={(e) => {
                      setPlanStartSemester(e.target.value);
                      if (
                        SEMESTERS.indexOf(e.target.value) >
                        SEMESTERS.indexOf(planEndSemester)
                      ) {
                        setPlanEndSemester(e.target.value);
                      }
                    }}
                    className="p-1 px-2.5 bg-white dark:bg-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-extrabold focus:ring-2 focus:ring-indigo-500 outline-none text-right text-indigo-755 font-sans"
                  >
                    {SEMESTERS.map((semName) => (
                      <option key={semName} value={semName}>
                        {semName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hidePastSemesters}
                      onChange={(e) => setHidePastSemesters(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-gray-700 dark:text-slate-300">
                      إخفاء الفصول القديمة والمجتازة (قبل موعد بدء الخطة)
                    </span>
                  </label>
                </div>
              </div>

              {planningCourseId && (
                <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl mb-4 flex items-center justify-between">
                  <div>
                    <span className="font-bold">
                      قم بتحديد الفصل الدراسي لإضافة مادة:{" "}
                    </span>
                    <span className="ml-2 font-black">
                      {courses.find((c) => c.id === planningCourseId)?.name}
                    </span>
                  </div>
                  <button
                    onClick={() => setPlanningCourseId(null)}
                    className="text-orange-600 text-sm font-bold hover:underline"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-x-auto bg-gray-50 dark:bg-slate-950/40 rounded-xl border border-gray-200 dark:border-slate-800 p-4">
                <div className="flex gap-4 min-w-max h-full">
                  {SEMESTERS.filter((sem) => {
                    if (hidePastSemesters) {
                      return (
                        SEMESTERS.indexOf(sem) >=
                        SEMESTERS.indexOf(planStartSemester)
                      );
                    }
                    return true;
                  }).map((sem) => {
                    const isPastSem =
                      SEMESTERS.indexOf(sem) <
                      SEMESTERS.indexOf(planStartSemester);
                    const semCourses = Object.entries(plannedCourses)
                      .filter(([id, semester]) => semester === sem)
                      .map(([id]) => courses.find((c) => c.id === id)!)
                      .filter(Boolean);
                    return (
                      <div
                        key={sem}
                        className={cn(
                          "w-64 flex flex-col h-full rounded-xl border shrink-0 overflow-hidden group transition-all",
                          isPastSem
                            ? "bg-slate-100/60 dark:bg-slate-900/40 border-dashed border-slate-300 dark:border-slate-700 opacity-[0.72] ring-1 ring-slate-100 dark:ring-slate-900 select-none"
                            : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700",
                        )}
                      >
                        <div
                          className={cn(
                            "p-3 border-b border-gray-100 dark:border-slate-750 flex justify-between items-center transition-colors relative group/header",
                            isPastSem
                              ? "bg-slate-200/90 dark:bg-slate-950/60 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                              : planningCourseId
                                ? "cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-950/30 bg-orange-50/50 dark:bg-orange-950/10"
                                : "bg-gray-50 dark:bg-slate-900/60",
                            !!planningCourseId &&
                            !isPastSem &&
                            "border-orange-200 dark:border-orange-900/50",
                          )}
                          onClick={() => {
                            if (planningCourseId && !isPastSem) {
                              setPlannedCourses((prev) => ({
                                ...prev,
                                [planningCourseId]: sem,
                              }));
                              setPlanningCourseId(null);
                            }
                          }}
                        >
                          <div>
                            <h3 className="font-bold text-gray-700 dark:text-slate-200 text-xs mb-1 flex items-center gap-1.5 flex-wrap">
                              {isPastSem && (
                                <Lock
                                  size={12}
                                  className="text-slate-400 dark:text-slate-500 shrink-0"
                                />
                              )}
                              <span>{sem}</span>
                              {isPastSem && (
                                <span className="text-[9px] bg-slate-250 text-slate-600 px-1.5 py-0.2 rounded font-black">
                                  مجتاز/سابق
                                </span>
                              )}
                            </h3>
                            <span className="text-[10px] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold">
                              {semCourses.reduce(
                                (sum, c) => sum + c.credits,
                                0,
                              )}{" "}
                              س.م
                            </span>
                          </div>
                          {!planningCourseId && semCourses.length > 0 && (
                            <div className="flex gap-1 items-center shrink-0">
                              {/* زر حذف جميع المواد المخططة في هذا الفصل */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPlannedCourses((prev) => {
                                    const next = { ...prev };
                                    semCourses.forEach((c) => {
                                      delete next[c.id];
                                    });
                                    return next;
                                  });
                                }}
                                className="opacity-0 group-hover/header:opacity-100 p-1 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 rounded-md transition-all shadow-sm border border-red-200"
                                title="حذف كل مواد الفصل من الخطة"
                              >
                                <Trash2 size={14} />
                              </button>

                              {semCourses.some(
                                (c) => !completedCourses.has(c.id),
                              ) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCompletedCourses((prev) => {
                                        const next = new Set(prev);
                                        semCourses.forEach((c) => {
                                          if (!next.has(c.id)) {
                                            next.add(c.id);
                                            getAllPrerequisites(c.id).forEach(
                                              (pre) => next.add(pre),
                                            );
                                          }
                                        });
                                        return next;
                                      });
                                    }}
                                    className="opacity-0 group-hover/header:opacity-100 p-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-md transition-all shadow-sm border border-emerald-200"
                                    title="إنجاز كل مواد الفصل"
                                  >
                                    <CircleCheckBig size={14} />
                                  </button>
                                )}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
                          {semCourses.map((c) => {
                            const isCompleted = completedCourses.has(c.id);
                            return (
                              <div
                                key={c.id}
                                onClick={() => setPlannerSelectedCourse(c)}
                                className={cn(
                                  "p-3 border rounded-lg flex flex-col relative group/card shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-indigo-300 hover:bg-neutral-50/50 hover:-translate-y-0.5 active:scale-[0.98]",
                                  isCompleted
                                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100/60 dark:border-emerald-900/50 hover:border-emerald-200"
                                    : "bg-gray-50 dark:bg-slate-900 border-gray-100 dark:border-slate-750 hover:border-orange-200 dark:hover:border-orange-900/50",
                                )}
                              >
                                <div className="flex justify-between items-start">
                                  <span
                                    className={cn(
                                      "text-[10px] font-bold tracking-widest",
                                      isCompleted
                                        ? "text-emerald-500"
                                        : "text-gray-500 dark:text-slate-500",
                                    )}
                                  >
                                    {c.id}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPlannedCourses((prev) => {
                                        const next = { ...prev };
                                        delete next[c.id];
                                        return next;
                                      });
                                    }}
                                    className="p-1 text-gray-400 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover/card:opacity-100 transition-all"
                                    title="حذف من الخطة"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                                <span
                                  className={cn(
                                    "text-sm font-bold leading-tight mt-1",
                                    isCompleted
                                      ? "text-emerald-800 dark:text-emerald-300"
                                      : "text-gray-800 dark:text-slate-200",
                                  )}
                                >
                                  {c.name}{" "}
                                  {isCompleted && (
                                    <CircleCheckBig
                                      size={14}
                                      className="inline-block pb-0.5 text-emerald-500 align-middle"
                                    />
                                  )}
                                </span>
                              </div>
                            );
                          })}
                          {planningCourseId && !isPastSem && (
                            <button
                              onClick={() => {
                                setPlannedCourses((prev) => ({
                                  ...prev,
                                  [planningCourseId]: sem,
                                }));
                                setPlanningCourseId(null);
                              }}
                              className="w-full mt-2 py-3 border-2 border-dashed border-orange-200 text-orange-500 hover:border-orange-400 hover:bg-orange-50 rounded-lg text-sm font-bold transition-colors opacity-0 group-hover:opacity-100"
                            >
                              + أضف{" "}
                              {
                                courses.find((c) => c.id === planningCourseId)
                                  ?.name
                              }{" "}
                              هنا
                            </button>
                          )}
                          {!planningCourseId && semCourses.length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-slate-600 p-4 text-center">
                              <CalendarDays
                                size={24}
                                className="mb-2 opacity-20"
                              />
                              <p className="text-xs font-medium">
                                {isPastSem
                                  ? "فصل سابق تم تجاوزه"
                                  : "هذا الفصل فارغ"}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Detailed Course overlay inside Planner */}
        {isPlannerOpen &&
          plannerSelectedCourse &&
          (() => {
            const details = getCourseDetails(
              plannerSelectedCourse,
              courses,
              completedCourses,
              plannedCourses,
            );
            const isComp = completedCourses.has(plannerSelectedCourse.id);
            const prerequisites = plannerSelectedCourse.prerequisites;
            const dependentCourses = courses.filter((c) =>
              c.prerequisites.includes(plannerSelectedCourse.id),
            );

            const planStartIdx = SEMESTERS.indexOf(planStartSemester);
            const planEndIdx = SEMESTERS.indexOf(planEndSemester);

            // Active uncompleted prerequisites sems:
            const activePrereqs = prerequisites.filter(
              (preId) => !completedCourses.has(preId),
            );
            const prereqsWithSem = activePrereqs
              .map((preId) => ({
                id: preId,
                name: courses.find((cr) => cr.id === preId)?.name || preId,
                sem: plannedCourses[preId],
              }))
              .filter((x) => x.sem);

            const maxPrereqIndex =
              prereqsWithSem.length > 0
                ? Math.max(...prereqsWithSem.map((x) => SEMESTERS.indexOf(x.sem)))
                : -1;

            // Dependent courses planned but not completed:
            const activeDeps = dependentCourses.filter(
              (dep) => !completedCourses.has(dep.id),
            );
            const depsWithSem = activeDeps
              .map((dep) => ({
                id: dep.id,
                name: dep.name,
                sem: plannedCourses[dep.id],
              }))
              .filter((x) => x.sem);

            const minDepIndex =
              depsWithSem.length > 0
                ? Math.min(...depsWithSem.map((x) => SEMESTERS.indexOf(x.sem)))
                : SEMESTERS.length;

            // Filter valid semesters which do not cause delays/conflict
            const validSemesters = SEMESTERS.filter((semName, idx) => {
              return (
                idx >= planStartIdx &&
                idx <= planEndIdx &&
                idx > maxPrereqIndex &&
                idx < minDepIndex
              );
            });
            let critBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
            let critLabel = "مسار مرن وقابل للتأجيل";
            if (details.criticality === "high") {
              critBg = "bg-rose-50 text-rose-700 border-rose-200 animate-pulse";
              critLabel = "سلسلة حرجة - الأولوية القصوى";
            } else if (details.criticality === "medium") {
              critBg = "bg-amber-50 text-amber-700 border-amber-200";
              critLabel = "أهمية متوسطة - ينصح بالالتزام";
            }

            return (
              <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                <div
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 flex flex-col gap-3.5 relative animate-in zoom-in-95 duration-200 text-right font-sans max-h-[90vh] overflow-y-auto"
                  dir="rtl"
                >
                  <button
                    onClick={() => {
                      setPlannerSelectedCourse(null);
                      setIsRescheduling(false);
                    }}
                    className="absolute top-4 left-4 p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X size={18} />
                  </button>

                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap justify-start">
                      <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md tracking-wider">
                        {plannerSelectedCourse.id}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold">
                        {plannerSelectedCourse.category}
                      </span>
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-bold">
                        {plannerSelectedCourse.credits} ساعات
                      </span>
                      <span
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border",
                          details.difficulty >= 8
                            ? "bg-red-50 text-red-700 border-red-200"
                            : details.difficulty >= 6
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-105",
                        )}
                      >
                        🔥 درجة الصعوبة: {details.difficulty}/10
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-gray-950 dark:text-slate-100 leading-tight text-right">
                      {plannerSelectedCourse.name}
                    </h3>
                  </div>

                  <div
                    className={`text-xs font-bold px-3 py-1 bg-gray-50 dark:bg-slate-950/20 rounded-xl border text-right ${details.trackColor}`}
                  >
                    المسار الأكاديمي: {details.trackName}
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider text-right">
                      تفاصيل المساق والشرح الفني:
                    </h4>
                    <p className="text-xs text-slate-705 dark:text-slate-300 leading-relaxed font-semibold bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100/60 dark:border-slate-800 text-right whitespace-pre-line">
                      {details.description}
                    </p>
                  </div>

                  <div className="border-t border-gray-100 pt-2.5 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 justify-start">
                      <span
                        className={`text-xs font-black px-2.5 py-1 rounded-lg border ${critBg}`}
                      >
                        {critLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-normal font-semibold text-right">
                      {details.criticalityReason}
                    </p>
                    <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-2.5 text-xs text-orange-950 font-semibold leading-relaxed text-right">
                      💡 {details.advice}
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-2.5 flex flex-col gap-1.5 text-right">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div className="text-[11px] font-bold text-gray-400">
                        الفصل الدراسي المخطط له:
                      </div>
                      <span className="text-[11px] font-extrabold text-indigo-750 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100">
                        {plannedCourses[plannerSelectedCourse.id] || "غير مجدول"}
                      </span>
                    </div>

                    {!isRescheduling ? (
                      <button
                        type="button"
                        onClick={() => setIsRescheduling(true)}
                        className="w-full py-1.5 px-3 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                      >
                        <CalendarDays size={14} className="text-indigo-600" />
                        تغيير موعد المادة (ترحيل أو نقل لفصل آخر)
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-150 animate-in fade-in duration-200 text-right">
                        <div
                          className={cn(
                            "p-2 rounded-lg text-[10px] leading-relaxed border font-semibold text-right",
                            details.criticality === "high"
                              ? "bg-rose-50 text-rose-800 border-rose-150"
                              : details.criticality === "medium"
                                ? "bg-amber-50 text-amber-800 border-amber-150"
                                : "bg-emerald-50 text-emerald-800 border-emerald-150",
                          )}
                        >
                          {details.criticality === "high" ? (
                            <span>
                              ⚠️ <strong>مادة ضمن السلسلة الحرجة!</strong> تأجيل
                              هذه المادة أو نقلها لفصل متأخر جداً قد يعطل تخريجك
                              فوراً لأنها متطلب سابق لـ {dependentCourses.length}{" "}
                              مساقات تالية. يرجى محاولة حجزها في أقرب وقت.
                            </span>
                          ) : details.criticality === "medium" ? (
                            <span>
                              👍 <strong>مساق متوسط الأهمية:</strong> يفتح مساقاً
                              تالياً واحداً. ننصح بتوزيعه بعناية دون تركه للفصول
                              النهائية.
                            </span>
                          ) : (
                            <span>
                              ✨ <strong>مادة مرنة ولطيفة:</strong> ليس لها
                              متطلبات لاحقة! تستطيع نقلها، تأجيلها، أو حجزها في أي
                              فصل صيفي لرفع العبء الدراسي دون القلق من حدوث Block.
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-gray-500 font-bold mb-0.5">
                          الفصول المتاحة لك فقط (ولا تسبب أي تعارض أو تأخير):
                        </div>

                        {validSemesters.length === 0 ? (
                          <div className="p-2.5 bg-red-55 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-rose-950 dark:text-rose-200 rounded-xl text-xs font-bold leading-relaxed">
                            🚨 عذراً، لا تتوفر فصول بديلة ضمن نطاق خطتك دون التسبب
                            بتأخير! هذه المادة محصورة تماماً:
                            {prereqsWithSem.length > 0 && (
                              <div className="mt-1 text-[11px] text-rose-900 dark:text-rose-400">
                                • يجب أن تُؤخذ بعد متطلبها السابق المجدول:{" "}
                                {prereqsWithSem
                                  .map((x) => `"${x.name}" (${x.sem})`)
                                  .join("، ")}
                              </div>
                            )}
                            {depsWithSem.length > 0 && (
                              <div className="mt-1 text-[11px] text-rose-900 dark:text-rose-400">
                                • يجب أن تُؤخذ قبل مادتها التابعة المجدولة:{" "}
                                {depsWithSem
                                  .map((x) => `"${x.name}" (${x.sem})`)
                                  .join("، ")}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="max-h-[140px] overflow-y-auto border border-gray-150 dark:border-slate-800 rounded-lg divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900 shadow-inner">
                            {validSemesters.map((semName) => {
                              const isCurrent =
                                plannedCourses[plannerSelectedCourse.id] ===
                                semName;
                              return (
                                <button
                                  key={semName}
                                  type="button"
                                  onClick={() => {
                                    setPlannedCourses((prev) => ({
                                      ...prev,
                                      [plannerSelectedCourse.id]: semName,
                                    }));
                                    setIsRescheduling(false);
                                  }}
                                  className={cn(
                                    "w-full text-right p-2.5 text-[11px] font-semibold flex items-center justify-between transition-colors",
                                    isCurrent
                                      ? "bg-indigo-50/70 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-bold"
                                      : "hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-750 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400",
                                  )}
                                >
                                  <span>{semName}</span>
                                  {isCurrent && (
                                    <span className="text-[9px] bg-indigo-600 text-white font-bold px-1.5 py-0.2 rounded">
                                      الحالي
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setIsRescheduling(false)}
                          className="w-full text-center font-bold text-[10px] text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 mt-0.5"
                        >
                          إلغاء و تراجع
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-100 dark:border-slate-800 pt-2.5 grid grid-cols-2 gap-3 text-[11px] font-semibold">
                    <div className="bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-right">
                      <div className="text-gray-400 font-bold mb-1 col-span-1">
                        المتطلبات السابقة:
                      </div>
                      {prerequisites.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {prerequisites.map((preId) => {
                            const preName =
                              courses.find((cr) => cr.id === preId)?.name ||
                              preId;
                            return (
                              <span
                                key={preId}
                                className={
                                  completedCourses.has(preId)
                                    ? "text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-bold text-right"
                                    : "text-gray-550 dark:text-slate-400 font-bold text-right"
                                }
                              >
                                {completedCourses.has(preId) ? "✓" : "○"}{" "}
                                {preName}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded text-[10px] inline-block mt-0.5">
                          لا يوجد (مساق تأسيسي)
                        </span>
                      )}
                    </div>

                    <div className="bg-indigo-50/20 dark:bg-indigo-950/10 p-2.5 rounded-xl border border-indigo-100/40 dark:border-indigo-900/30 text-right">
                      <div className="text-gray-400 font-bold mb-1">
                        يفتح هذا المساق مستقبلاً:
                      </div>
                      {dependentCourses.length > 0 ? (
                        <div className="flex flex-col gap-0.5 max-h-[80px] overflow-y-auto w-full text-right">
                          {dependentCourses.slice(0, 4).map((dep) => (
                            <span
                              key={dep.id}
                              className="text-indigo-850 dark:text-indigo-300 font-bold whitespace-nowrap overflow-hidden text-ellipsis block text-right"
                            >
                              • {dep.name}
                            </span>
                          ))}
                          {dependentCourses.length > 4 && (
                            <span className="text-slate-450 dark:text-slate-500 text-[10px] text-right">
                              وغيرها من المساقات...
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded text-[10px] block text-center mt-1">
                          مساق ورقة نهائية / لا يعطل شيئاً
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-100 dark:border-slate-800 pt-3 flex gap-2">
                    <button
                      onClick={() => {
                        toggleCourseCompletion(plannerSelectedCourse.id);
                      }}
                      className={cn(
                        "flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm border-0",
                        isComp
                          ? "bg-red-50 dark:bg-red-950/40 text-red-650 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                          : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20 shadow-md disabled:opacity-50",
                      )}
                    >
                      {isComp ? <Trash2 size={14} /> : <CircleCheckBig size={14} />}
                      {isComp ? "إلغاء المادة كمنجزة" : "تحديد كمادة منجزة"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
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