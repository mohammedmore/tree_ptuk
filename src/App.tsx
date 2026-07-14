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
  Calculator,
} from "lucide-react";
import "@xyflow/react/dist/style.css";
import { courses, Course, categoryRequirements } from "./data";

import { getLayoutedElements, cn } from "./utils";
import { getCourseDetails } from "./courseExplanations";

import {
  courseCommonNames,
  SEMESTERS,
  TOTAL_CREDITS
} from "./constants";
import CourseNode from "./CourseNode";
import ListView from "./ListView";
import ResetConfirmationModal from "./components/ResetConfirmationModal"; // Import the new component
import SupportModal from "./components/SupportModal"; // Import the new component
import ExportModal from "./components/ExportModal"; // Import the new component
import PlanningModeModal from "./components/PlanningModeModal"; // Import the new component
import CourseListModal from "./components/CourseListModal"; // Import the new component
import DynamicCourseDetailsModal from "./components/DynamicCourseDetailsModal"; // Import the new component
import PlannerView from "./components/PlannerView"; // Import the new component
import { GPAModal } from "./components/GPAModal";

// تحسين: تمرير الـ edges كمعامل لجعل الدالة نقية (Pure Function) وقابلة للاختبار
export const getPathForCourse = (nodeId: string, edges: Edge[]) => {
  const ancestors = new Set<string>();
  const descendants = new Set<string>();

  const findAncestors = (currId: string) => {
    edges.forEach((e) => {
      if (e.target === currId && !ancestors.has(e.source)) {
        ancestors.add(e.source);
        findAncestors(e.source);
      }
    });
  };

  const findDescendants = (currId: string) => {
    edges.forEach((e) => {
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
  allCourses: Course[],
  currentPlannedCourses: Set<string> = new Set() // New parameter for courses planned in the current semester
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
    // A co-requisite is met if it's completed OR it's planned for the current semester
    if (completed.has(cpId) || currentPlannedCourses.has(cpId)) return true;
    
    // The co-requisite itself must be available (its prerequisites must be met)
    const cpCourse = allCourses.find(ac => ac.id === cpId);
    if (!cpCourse) return false; // Co-requisite course not found
    
    // Check if the co-requisite's prerequisites are met (excluding itself if it's a co-requisite of itself, which shouldn't happen)
    return cpCourse.prerequisites.every(p => completed.has(p));
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
  const [isGPAModalOpen, setIsGPAModalOpen] = useState(false);
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
  // Removed showAllInMap state, it will be implicitly true
  const [isDarkMode, setIsDarkMode] = useLocalStorage<boolean>(
    "dark_mode",
    false,
  );

  const [courseGrades, setCourseGrades] = useLocalStorage<Record<string, number>>(
    "course_grades",
    {}
  );

  const [courseRepeats, setCourseRepeats] = useLocalStorage<Record<string, number>>(
    "course_repeats",
    {}
  );

  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);

  const hoveredPath = useMemo(() => {
    if (!hoveredCourseId) return null;
    // استخدام layoutedEdges بدلاً من الاعتماد على متغير خارجي
    return getPathForCourse(hoveredCourseId, layoutedEdges);
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
    // Since we are always in "كامل المنهاج", all courses are active regardless of elective selection
    return courses;
  }, []); // No dependency on selectedElectives anymore

  const pinnedPath = useMemo(() => {
    if (!pinnedCourseId) return null;
    return getPathForCourse(pinnedCourseId, layoutedEdges);
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

  const localStorageKeys = [
    "completed_courses",
    "planned_courses",
    "prioritized_electives",
    "selected_electives_map",
    "plan_start_semester",
    "plan_end_semester",
    "hide_past_semesters",
    "dark_mode",
    "course_grades",
    "course_repeats",
  ];

  const confirmReset = () => {
    setCompletedCourses(new Set());
    setPlannedCourses({});
    setCourseRepeats({});
    localStorageKeys.forEach(key => window.localStorage.removeItem(key)); // Clear only app-specific keys
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

        pdf.addImage(dataUrl, "PNG", 0, 0, imgWidth, imgHeight); // Changed position to 0
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          pdf.addPage();
          pdf.addImage(dataUrl, "PNG", 0, heightLeft - imgHeight, imgWidth, imgHeight); // Adjusted position
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
      // استخراج المنطق لدالة getPathForCourse التي قمنا بتحسينها بالأعلى
      const { ancestors: anc, descendants: des } = getPathForCourse(selectedNodeId, layoutedEdges);
      anc.forEach(id => ancestors.add(id));
      des.forEach(id => descendants.add(id));

      layoutedEdges.forEach((e) => {
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
        // const selectedElectiveIds = new Set(Object.values(selectedElectives)); // Not needed as showAllInMap is always true
        // const cObj = courses.find((c) => c.id === n.id); // Not needed as showAllInMap is always true
        // const isElective = cObj?.category === 'متطلب جامعة اختياري' || cObj?.category === 'متطلب تخصص اختياري'; // Not needed as showAllInMap is always true
        // const isActiveElective = isElective && selectedElectiveIds.has(n.id); // Not needed as showAllInMap is always true
        // const isHidden = !showAllInMap && isElective && !isActiveElective; // Simplified to always false
        const isHidden = false; // Always show all nodes

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
      // const selectedElectiveIds = new Set(Object.values(selectedElectives)); // Not needed as showAllInMap is always true
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
        // const sObj = courses.find((c) => c.id === e.source); // Not needed as showAllInMap is always true
        // const tObj = courses.find((c) => c.id === e.target); // Not needed as showAllInMap is always true
        // const isSourceElective = sObj?.category === 'متطلب جامعة اختياري' || sObj?.category === 'متطلب تخصص اختياري'; // Not needed as showAllInMap is always true
        // const isTargetElective = tObj?.category === 'متطلب جامعة اختياري' || tObj?.category === 'متطلب تخصص اختياري'; // Not needed as showAllInMap is always true
        // const isSourceActive = !isSourceElective || selectedElectiveIds.has(e.source); // Not needed as showAllInMap is always true
        // const isTargetActive = !isTargetElective || selectedElectiveIds.has(e.target); // Not needed as showAllInMap is always true
        // return {
        //   ...e,
        //   hidden: !showAllInMap && (!isSourceActive || !isTargetActive), // Simplified to always false
        // };
        return {
          ...e,
          hidden: false, // Always show all edges
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
    // Removed showAllInMap from dependencies
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
                {/* Removed the toggle buttons for "خطة التخرج" and "كامل المنهاج" */}
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
                    setIsGPAModalOpen(true);
                    setSelectedNodeId(null);
                    setIsDetailsOpen(false);
                    setHoveredCourseId(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors cursor-pointer shadow-sm font-black"
                >
                  <Calculator size={16} />
                  المعدل والدرجات
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event bubbling
                    setIsPlannerOpen(true);
                    setPlannerSelectedCourse(null); // Ensure no specific course is selected when opening the main planner
                    setSelectedNodeId(null);
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
                        c.id.toLowerCase().includes(q) ||
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
                      c.id.toLowerCase().includes(q) ||
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
                <span>المجموع: {TOTAL_CREDITS}</span>
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
                                  <span className="10px">ساعات</span>
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
                      / <span className="text-gray-500 dark:text-slate-500 text-sm">{TOTAL_CREDITS}</span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
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
        <ResetConfirmationModal
          showResetConfirm={showResetConfirm}
          onClose={() => setShowResetConfirm(false)}
          onConfirm={confirmReset}
        />

        {/* Support / Technical Assistance and feedback Modal */}
        <SupportModal
          isSupportModalOpen={isSupportModalOpen}
          onClose={() => setIsSupportModalOpen(false)}
        />

        {/* Export Modal */}
        <ExportModal
          isExportModalOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          completedCredits={completedCredits}
          plannedCourses={plannedCourses}
          completedCourses={completedCourses}
          courses={courses}
          courseGrades={courseGrades}
        />

        {/* Planning Mode Modal */}
        <PlanningModeModal
          isPlanningModeOpen={isPlanningModeOpen}
          onClose={() => { setIsPlanningModeOpen(false); setCurrentPlanningSemester(null); setExpandedPlanningCategories({}); }}
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

        {/* Course List Modal */}
        <CourseListModal
          isCourseListModalOpen={isCourseListModalOpen}
          onClose={() => { setIsCourseListModalOpen(false); setExpandedCourseListCategories({}); }}
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

        {/* Planner View Modal */}
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
          plannedCredits={plannedCredits}
          completedCreditsPerCategory={completedCreditsPerCategory}
          plannedCreditsPerCategory={plannedCreditsPerCategory}
          getAllPrerequisites={getAllPrerequisites}
          setIsExportModalOpen={setIsExportModalOpen}
          onOpenPlanningMode={() => setIsPlanningModeOpen(true)}
          toggleCourseCompletion={toggleCourseCompletion}
        />
        {/* GPAModal */}
        <GPAModal
          isOpen={isGPAModalOpen}
          onClose={() => setIsGPAModalOpen(false)}
          courses={courses}
          completedCourses={completedCourses}
          courseGrades={courseGrades}
          setCourseGrades={setCourseGrades}
          courseRepeats={courseRepeats}
          setCourseRepeats={setCourseRepeats}
        />
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