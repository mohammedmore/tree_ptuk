import React, { useState, useMemo, useEffect } from "react";
import {
  Calendar,
  Clock,
  User,
  MapPin,
  Hash,
  Layout,
  Edit3,
  AlertTriangle,
  RefreshCw,
  Filter,
  Check,
  CheckCheck,
  Columns,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Sparkles,
  Trash2,
  Image as ImageIcon,
  Bell,
  Bookmark,
  Zap,
  X,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  Layers,
  Plus,
  Eye,
  EyeOff,
  Users,
} from "lucide-react";
import { BaseModal } from "../common/BaseModal";
import { ErrorBoundary } from "../common/ErrorBoundary";
import type { Course, ScheduleEntry } from "../../data";
import { cn } from "../../utils";
import {
  SEMESTERS,
  getRecommendedSemesterOfCourse,
  getYearFromId,
} from "../../constants";
import { isCourseAvailable } from "../../core/courseProgress";
import {
  fetchSyncStatus,
  triggerManualSync,
  formatArabicSyncTime,
  SyncStatus,
} from "../../services/syncService";
import {
  fetchCourses,
  fetchCoursesByCodes,
  searchCourses,
  isOfflineCatalog,
  clearCoursesCache,
} from "../../services/courseService";
import {
  generateAllSchedules,
  normalizeDayKey,
  dayKeyToName,
  explainScheduleConflicts,
  getStats,
  calculateScheduleQuality,
} from "../../services/scheduleSolver";
import {
  generateSchedulesAsync,
  explainConflictsAsync,
} from "../../services/scheduleSolverClient";
import { triggerHaptic } from "../../utils/haptics";
import type {
  CatalogCourse,
  CatalogScheduleFilters,
  ConflictExplanation,
  ConflictAutoFix,
  GeneratedScheduleCourse,
  ScheduleStats,
} from "../../services/scheduleSolver";
import {
  exportScheduleToICal,
  downloadScheduleImage,
} from "../../services/icalExport";
import {
  trackMultipleSections,
  isSectionClosed,
  getSectionCapacityDetails,
  ensureNotificationPermission,
  sendBrowserNotification,
} from "../../core/seatTracker";
import {
  getSemesterDrafts,
  createSemesterDraft,
} from "../../core/scheduleDrafts";

interface WeeklyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  plannedCourses: Record<string, string>;
  courses: Course[];
  weeklySchedule: Record<string, Record<string, ScheduleEntry>>;
  setWeeklySchedule: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, ScheduleEntry>>>
  >;
  completedCourses?: Set<string>;
}

const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const EDIT_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const DAY_KEYS = ["سب", "أح", "اث", "ثلا", "ار", "خمـ"];
const DAY_NAME_BY_KEY = new Map(
  DAY_KEYS.map((key, index) => [key, DAYS[index]]),
);
const HOURS = Array.from({ length: 8 }, (_, i) => i + 8);
const GRID_START_MINUTES = 8 * 60;
const GRID_END_MINUTES = 16 * 60;
const FILTER_DAY_OPTIONS = DAY_KEYS.map((key, index) => ({
  key,
  label: DAYS[index],
}));

const formatScheduleTime = (hour: number) => {
  const totalMinutes = Math.round(hour * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

export interface CourseColorPalette {
  id: string;
  border: string;
  bg: string;
  text: string;
  badge: string;
  dot: string;
}

export const COURSE_COLOR_PALETTES: CourseColorPalette[] = [
  {
    id: "blue",
    border: "border-blue-500/80 dark:border-blue-400/80",
    bg: "bg-blue-500/12 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    badge: "bg-blue-500/20 text-blue-800 dark:text-blue-200 border-blue-500/30",
    dot: "bg-blue-500",
  },
  {
    id: "emerald",
    border: "border-emerald-500/80 dark:border-emerald-400/80",
    bg: "bg-emerald-500/12 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    badge:
      "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  {
    id: "purple",
    border: "border-purple-500/80 dark:border-purple-400/80",
    bg: "bg-purple-500/12 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    badge:
      "bg-purple-500/20 text-purple-800 dark:text-purple-200 border-purple-500/30",
    dot: "bg-purple-500",
  },
  {
    id: "amber",
    border: "border-amber-500/80 dark:border-amber-400/80",
    bg: "bg-amber-500/12 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-300",
    badge:
      "bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/30",
    dot: "bg-amber-500",
  },
  {
    id: "rose",
    border: "border-rose-500/80 dark:border-rose-400/80",
    bg: "bg-rose-500/12 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    badge: "bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-500/30",
    dot: "bg-rose-500",
  },
  {
    id: "cyan",
    border: "border-cyan-500/80 dark:border-cyan-400/80",
    bg: "bg-cyan-500/12 dark:bg-cyan-950/40",
    text: "text-cyan-800 dark:text-cyan-300",
    badge: "bg-cyan-500/20 text-cyan-900 dark:text-cyan-200 border-cyan-500/30",
    dot: "bg-cyan-500",
  },
  {
    id: "indigo",
    border: "border-indigo-500/80 dark:border-indigo-400/80",
    bg: "bg-indigo-500/12 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-300",
    badge:
      "bg-indigo-500/20 text-indigo-800 dark:text-indigo-200 border-indigo-500/30",
    dot: "bg-indigo-500",
  },
  {
    id: "teal",
    border: "border-teal-500/80 dark:border-teal-400/80",
    bg: "bg-teal-500/12 dark:bg-teal-950/40",
    text: "text-teal-700 dark:text-teal-300",
    badge: "bg-teal-500/20 text-teal-800 dark:text-teal-200 border-teal-500/30",
    dot: "bg-teal-500",
  },
  {
    id: "orange",
    border: "border-orange-500/80 dark:border-orange-400/80",
    bg: "bg-orange-500/12 dark:bg-orange-950/40",
    text: "text-orange-800 dark:text-orange-300",
    badge:
      "bg-orange-500/20 text-orange-900 dark:text-orange-200 border-orange-500/30",
    dot: "bg-orange-500",
  },
  {
    id: "fuchsia",
    border: "border-fuchsia-500/80 dark:border-fuchsia-400/80",
    bg: "bg-fuchsia-500/12 dark:bg-fuchsia-950/40",
    text: "text-fuchsia-700 dark:text-fuchsia-300",
    badge:
      "bg-fuchsia-500/20 text-fuchsia-800 dark:text-fuchsia-200 border-fuchsia-500/30",
    dot: "bg-fuchsia-500",
  },
  {
    id: "lime",
    border: "border-lime-500/80 dark:border-lime-400/80",
    bg: "bg-lime-500/12 dark:bg-lime-950/40",
    text: "text-lime-800 dark:text-lime-300",
    badge: "bg-lime-500/20 text-lime-900 dark:text-lime-200 border-lime-500/30",
    dot: "bg-lime-500",
  },
  {
    id: "red",
    border: "border-red-500/80 dark:border-red-400/80",
    bg: "bg-red-500/12 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-300",
    badge: "bg-red-500/20 text-red-800 dark:text-red-200 border-red-500/30",
    dot: "bg-red-500",
  },
];

const getCoursePalette = (
  courseCode: string,
  index?: number,
): CourseColorPalette => {
  if (typeof index === "number" && index >= 0) {
    return COURSE_COLOR_PALETTES[index % COURSE_COLOR_PALETTES.length];
  }
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) {
    hash = (hash * 31 + courseCode.charCodeAt(i)) >>> 0;
  }
  return COURSE_COLOR_PALETTES[hash % COURSE_COLOR_PALETTES.length];
};

export const WeeklyScheduleModal: React.FC<WeeklyScheduleModalProps> = ({
  isOpen,
  onClose,
  plannedCourses,
  courses,
  weeklySchedule,
  setWeeklySchedule,
  completedCourses,
}) => {
  const [selectedSemester, setSelectedSemester] = useState<string>(
    () =>
      SEMESTERS.find((semester) =>
        Object.values(plannedCourses).includes(semester),
      ) || SEMESTERS[0],
  );
  const [activeTab, setActiveTab] = useState<"edit" | "visual">("visual");
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>(() =>
    Object.entries(plannedCourses)
      .filter(([, semester]) => semester === selectedSemester)
      .map(([courseId]) => courseId),
  );
  const [availableCourses, setAvailableCourses] = useState<CatalogCourse[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<CatalogCourse[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CatalogCourse[]>([]);
  const [isCourseLoading, setIsCourseLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSelectionLoading, setIsSelectionLoading] = useState(false);
  const [courseLoadError, setCourseLoadError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [courseLoadAttempt, setCourseLoadAttempt] = useState(0);
  const [selectionLoadAttempt, setSelectionLoadAttempt] = useState(0);
  const [activeScheduleIndex, setActiveScheduleIndex] = useState(0);
  const [hasGeneratedSchedules, setHasGeneratedSchedules] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [compareScheduleIndexA, setCompareScheduleIndexA] = useState(0);
  const [compareScheduleIndexB, setCompareScheduleIndexB] = useState(1);
  const [adoptedFeedback, setAdoptedFeedback] = useState(false);
  const [trackedFeedback, setTrackedFeedback] = useState<string | null>(null);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [scheduleFilters, setScheduleFilters] =
    useState<CatalogScheduleFilters>({
      freeDays: [],
      excludedSections: {},
      pinnedSections: {},
      timePreference: "",
      maxGap: null,
      diverseSolutions: true,
    });
  const [syncInfo, setSyncInfo] = useState<SyncStatus | null>(null);
  const [isSyncRefreshing, setIsSyncRefreshing] = useState(false);
  const [isAddCourseOpen, setIsAddCourseOpen] = useState<boolean>(
    () => selectedCourseCodes.length === 0,
  );
  const [isHideSelectedCourses, setIsHideSelectedCourses] =
    useState<boolean>(false);
  const [scheduleViewMode, setScheduleViewMode] = useState<"daily" | "weekly">(
    () => {
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        return "daily";
      }
      return "weekly";
    },
  );
  const [selectedDayKey, setSelectedDayKey] = useState<string>("أح");

  useEffect(() => {
    if (!isOpen) return;
    fetchSyncStatus()
      .then(setSyncInfo)
      .catch(() => {});
  }, [isOpen]);

  const handleManualSync = async () => {
    setIsSyncRefreshing(true);
    try {
      await triggerManualSync();
      const updated = await fetchSyncStatus();
      setSyncInfo(updated);
      clearCoursesCache();
      setCourseLoadAttempt((attempt) => attempt + 1);
    } catch (err) {
      console.error("Manual sync error:", err);
    } finally {
      setIsSyncRefreshing(false);
    }
  };

  const coursesById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );

  const semesterCourses = useMemo(() => {
    return Object.entries(plannedCourses)
      .filter(([, semester]) => semester === selectedSemester)
      .flatMap(([id]) => {
        const course = coursesById.get(id);
        return course ? [course] : [];
      });
  }, [plannedCourses, selectedSemester, coursesById]);

  // Feature: Eligible & Open Major Courses Grouping by Year or Category
  const [eligibleGroupBy, setEligibleGroupBy] = useState<"year" | "category">(
    "year",
  );

  const completedSet = useMemo(
    () => completedCourses ?? new Set<string>(),
    [completedCourses],
  );

  const selectedYearName = useMemo(
    () => selectedSemester.split(" - ")[0] || "",
    [selectedSemester],
  );

  const openCatalogCoursesMap = useMemo(() => {
    const map = new Map<string, CatalogCourse>();
    for (const c of availableCourses) {
      if (c && c.id && (c.sections?.length ?? 0) > 0) {
        map.set(c.id, c);
      }
    }
    return map;
  }, [availableCourses]);

  const eligibleMajorCourses = useMemo(() => {
    return courses
      .filter((course) => {
        // 1. Exclude already completed courses
        if (completedSet.has(course.id)) return false;
        // 2. Must be open in the university timetable (has sections)
        if (!openCatalogCoursesMap.has(course.id)) return false;
        // 3. Prerequisites must be satisfied
        if (!isCourseAvailable(course, completedSet, courses)) return false;
        return true;
      })
      .map((course) => {
        const catalogCourse = openCatalogCoursesMap.get(course.id)!;
        const recSemester = getRecommendedSemesterOfCourse(course);
        const plannedSemester = plannedCourses[course.id];
        const recYear = recSemester.split(" - ")[0] || "";
        const yearDigit = getYearFromId(course.id);
        const selectedYearDigit = selectedYearName.replace("السنة ", "").trim();

        const isDesignatedSemester =
          recSemester === selectedSemester ||
          plannedSemester === selectedSemester;
        const isDesignatedYear =
          recYear === selectedYearName ||
          plannedSemester?.startsWith(selectedYearName) ||
          yearDigit === selectedYearDigit;

        return {
          ...course,
          sectionsCount: catalogCourse.sections?.length ?? 0,
          sections: catalogCourse.sections ?? [],
          recommendedSemester: recSemester,
          isDesignatedSemester,
          isDesignatedYear,
        };
      });
  }, [
    courses,
    completedSet,
    openCatalogCoursesMap,
    plannedCourses,
    selectedSemester,
    selectedYearName,
  ]);

  const groupedEligibleCourses = useMemo(() => {
    if (eligibleMajorCourses.length === 0) return [];

    if (eligibleGroupBy === "year") {
      const yearOrder = [
        "السنة الأولى",
        "السنة الثانية",
        "السنة الثالثة",
        "السنة الرابعة",
        "السنة الخامسة",
        "مساقات عامة / أخرى",
      ];
      const groupsMap = new Map<string, typeof eligibleMajorCourses>();

      for (const course of eligibleMajorCourses) {
        let yName = "مساقات عامة / أخرى";
        const rec = course.recommendedSemester || "";
        if (rec.startsWith("السنة ")) {
          yName = rec.split(" - ")[0].trim();
        } else {
          const digit = getYearFromId(course.id);
          switch (digit) {
            case "1":
              yName = "السنة الأولى";
              break;
            case "2":
              yName = "السنة الثانية";
              break;
            case "3":
              yName = "السنة الثالثة";
              break;
            case "4":
              yName = "السنة الرابعة";
              break;
            case "5":
              yName = "السنة الخامسة";
              break;
            default:
              yName = "مساقات عامة / أخرى";
          }
        }

        const existing = groupsMap.get(yName) || [];
        existing.push(course);
        groupsMap.set(yName, existing);
      }

      return yearOrder
        .filter((y) => groupsMap.has(y) && groupsMap.get(y)!.length > 0)
        .map((y) => ({
          id: y,
          title: y,
          courses: groupsMap.get(y)!,
        }));
    } else {
      // Group by category
      const categoryOrder = [
        "متطلب تخصص إجباري",
        "متطلب كلية إجباري",
        "متطلب جامعة إجباري",
        "متطلب تخصص اختياري",
        "متطلب جامعة اختياري",
        "متطلب استدراكي إجباري",
      ];

      const groupsMap = new Map<string, typeof eligibleMajorCourses>();
      for (const course of eligibleMajorCourses) {
        const cat = (course.category || "متطلبات أخرى").trim();
        const existing = groupsMap.get(cat) || [];
        existing.push(course);
        groupsMap.set(cat, existing);
      }

      const sortedCategories = Array.from(groupsMap.keys()).sort((a, b) => {
        const idxA = categoryOrder.indexOf(a);
        const idxB = categoryOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b, "ar");
      });

      return sortedCategories.map((cat) => ({
        id: cat,
        title: cat,
        courses: groupsMap.get(cat)!,
      }));
    }
  }, [eligibleMajorCourses, eligibleGroupBy]);

  const handleAddAllEligible = () => {
    const codes = eligibleMajorCourses.map((c) => c.id);
    setSelectedCourseCodes((prev) => Array.from(new Set([...prev, ...codes])));
    triggerHaptic("selection");
    setActiveScheduleIndex(0);
  };

  const handleAddGroupCourses = (groupCourses: typeof eligibleMajorCourses) => {
    const codes = groupCourses.map((c) => c.id);
    setSelectedCourseCodes((prev) => Array.from(new Set([...prev, ...codes])));
    triggerHaptic("selection");
    setActiveScheduleIndex(0);
  };
  const manualCourses = useMemo(
    () =>
      selectedCourseCodes.map((id) => {
        const catalogCourse =
          selectedCourses.find((course) => course.id === id) ??
          availableCourses.find((course) => course.id === id);
        const plannedCourse = coursesById.get(id);
        return {
          id,
          name: catalogCourse?.name ?? plannedCourse?.name ?? id,
          credits: plannedCourse?.credits ?? 0,
        };
      }),
    [selectedCourseCodes, selectedCourses, availableCourses, coursesById],
  );

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadAvailableCourses = async () => {
      setIsCourseLoading(true);
      setCourseLoadError(null);
      try {
        const forceRefresh = courseLoadAttempt > 0;
        if (forceRefresh) clearCoursesCache();
        const loadedCourses = await fetchCourses(forceRefresh);
        if (cancelled) return;
        setIsOffline(isOfflineCatalog());
        setAvailableCourses(loadedCourses);
        const coursesWithSections = new Set(
          loadedCourses
            .filter((course) => (course.sections?.length ?? 0) > 0)
            .map((course) => course.id),
        );
        setSelectedCourseCodes((current) =>
          current.filter((code) => coursesWithSections.has(code)),
        );
      } catch (error) {
        if (!cancelled) {
          setIsOffline(isOfflineCatalog());
          setCourseLoadError(
            error instanceof Error ? error.message : "تعذر تحميل المساقات.",
          );
        }
      } finally {
        if (!cancelled) setIsCourseLoading(false);
      }
    };

    void loadAvailableCourses();
    return () => {
      cancelled = true;
    };
  }, [isOpen, courseLoadAttempt]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!isOpen || activeTab !== "visual" || !debouncedQuery.trim()) {
      setIsSearching(false);
      setSearchError(null);
      return;
    }
    let cancelled = false;

    const runSearch = async () => {
      setIsSearching(true);
      setSearchError(null);
      setSearchResults([]);
      try {
        const results = await searchCourses(debouncedQuery);
        if (!cancelled) setSearchResults(results);
      } catch (error) {
        if (!cancelled) {
          setSearchError(
            error instanceof Error ? error.message : "تعذر البحث عن المساقات.",
          );
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };

    void runSearch();
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab, debouncedQuery]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadSelectedCourses = async () => {
      if (selectedCourseCodes.length === 0) {
        setSelectedCourses([]);
        setSelectionError(null);
        setIsSelectionLoading(false);
        return;
      }
      setIsSelectionLoading(true);
      setSelectionError(null);
      try {
        const loadedCourses = await fetchCoursesByCodes(selectedCourseCodes);
        if (!cancelled) setSelectedCourses(loadedCourses);
      } catch (error) {
        if (!cancelled) {
          setSelectionError(
            error instanceof Error ? error.message : "تعذر تحميل شعب المساقات.",
          );
        }
      } finally {
        if (!cancelled) setIsSelectionLoading(false);
      }
    };

    void loadSelectedCourses();
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedCourseCodes, selectionLoadAttempt]);

  const selectionReady =
    selectedCourses.length === selectedCourseCodes.length &&
    selectedCourseCodes.every(
      (code, index) => selectedCourses[index]?.id === code,
    );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (scheduleFilters.freeDays && scheduleFilters.freeDays.length > 0) {
      count += scheduleFilters.freeDays.length;
    }
    if (scheduleFilters.timePreference) count += 1;
    if (scheduleFilters.maxGap !== null && scheduleFilters.maxGap !== undefined)
      count += 1;
    if (
      scheduleFilters.excludedSections &&
      Object.keys(scheduleFilters.excludedSections).length > 0
    ) {
      count += Object.keys(scheduleFilters.excludedSections).length;
    }
    return count;
  }, [scheduleFilters]);

  // Feature 2 & 3: Background Web Worker schedule generation & conflict explanation
  const [generatedSchedules, setGeneratedSchedules] = useState<
    GeneratedScheduleCourse[][]
  >([]);
  const [conflictExplanation, setConflictExplanation] =
    useState<ConflictExplanation | null>(null);
  const [isSolvingWorker, setIsSolvingWorker] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;

    if (!selectionReady || selectedCourseCodes.length === 0) {
      setGeneratedSchedules([]);
      setConflictExplanation(null);
      setIsSolvingWorker(false);
      return;
    }

    setIsSolvingWorker(true);

    generateSchedulesAsync(selectedCourses, scheduleFilters)
      .then(async (schedules) => {
        if (isCancelled) return;
        setGeneratedSchedules(schedules);

        if (schedules.length === 0) {
          const explanation = await explainConflictsAsync(
            selectedCourses,
            scheduleFilters,
          );
          if (!isCancelled) {
            setConflictExplanation(explanation);
          }
        } else {
          setConflictExplanation(null);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Worker solver error:", err);
          setGeneratedSchedules([]);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsSolvingWorker(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectionReady, selectedCourseCodes, selectedCourses, scheduleFilters]);

  // Enable instant Arrow Left/Right schedule navigation without scrolling
  useEffect(() => {
    if (!isOpen || generatedSchedules.length <= 1) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.isContentEditable)
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveScheduleIndex((i) =>
          Math.min(generatedSchedules.length - 1, i + 1),
        );
        triggerHaptic("selection");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveScheduleIndex((i) => Math.max(0, i - 1));
        triggerHaptic("selection");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, generatedSchedules.length]);

  const activeSchedule = generatedSchedules[activeScheduleIndex] ?? [];
  const scheduleQuality = useMemo(() => {
    if (!activeSchedule.length) return null;
    return calculateScheduleQuality(activeSchedule);
  }, [activeSchedule]);

  const handleAdoptSchedule = (scheduleToAdopt: GeneratedScheduleCourse[]) => {
    if (!scheduleToAdopt || scheduleToAdopt.length === 0) return;
    setWeeklySchedule((prev) => {
      const semesterSchedule = { ...(prev[selectedSemester] ?? {}) };
      for (const item of scheduleToAdopt) {
        const block = item.section.blocks[0];
        const days = (item.section.blocks ?? []).flatMap((b) =>
          (b.days ?? []).map(
            (d) => DAY_NAME_BY_KEY.get(normalizeDayKey(d) ?? d) ?? d,
          ),
        );
        const uniqueDays = Array.from(new Set(days)).filter(Boolean);
        semesterSchedule[item.courseCode] = {
          startTime: block ? formatScheduleTime(block.start) : "08:00",
          endTime: block ? formatScheduleTime(block.end) : "09:30",
          section: item.section.sec,
          instructor: item.section.instructor ?? "",
          room: item.section.room ?? "",
          days: uniqueDays,
        };
      }
      return {
        ...prev,
        [selectedSemester]: semesterSchedule,
      };
    });
    triggerHaptic("success");
    setAdoptedFeedback(true);
    setTimeout(() => setAdoptedFeedback(false), 3000);
  };

  const handleAdoptAsDraft = (scheduleToAdopt: GeneratedScheduleCourse[]) => {
    if (!scheduleToAdopt || scheduleToAdopt.length === 0) return;
    const scheduleEntries: Record<string, ScheduleEntry> = {};
    for (const item of scheduleToAdopt) {
      const block = item.section.blocks[0];
      const days = (item.section.blocks ?? []).flatMap((b) =>
        (b.days ?? []).map(
          (d) => DAY_NAME_BY_KEY.get(normalizeDayKey(d) ?? d) ?? d,
        ),
      );
      const uniqueDays = Array.from(new Set(days)).filter(Boolean);
      scheduleEntries[item.courseCode] = {
        startTime: block ? formatScheduleTime(block.start) : "08:00",
        endTime: block ? formatScheduleTime(block.end) : "09:30",
        section: item.section.sec,
        instructor: item.section.instructor ?? "",
        room: item.section.room ?? "",
        days: uniqueDays,
      };
    }

    const currentDrafts = getSemesterDrafts(selectedSemester);
    const draftName = `مسودة بديلة ${currentDrafts.length + 1}`;
    createSemesterDraft(selectedSemester, draftName, scheduleEntries);
    triggerHaptic("success");
    setAdoptedFeedback(true);
    setTrackedFeedback(
      `تم حفظ هذا الجدول كمسودة بديلة جديدة باسم «${draftName}» دون استبدال جدولك الحالي.`,
    );
    setTimeout(() => {
      setAdoptedFeedback(false);
      setTrackedFeedback(null);
    }, 4500);
  };

  const handleTrackScheduleSections = async () => {
    if (!activeSchedule || activeSchedule.length === 0) return;

    // Track ONLY closed sections
    const closedSections = activeSchedule.filter((item) =>
      isSectionClosed(item.section.status),
    );

    if (closedSections.length === 0) {
      setTrackedFeedback(
        "جميع شعب هذا الجدول مفتوحة حالياً (لا توجد شعب مغلقة بحاجة للتتبع).",
      );
      setTimeout(() => setTrackedFeedback(null), 4000);
      return;
    }

    trackMultipleSections(
      closedSections.map((item) => {
        const cap = getSectionCapacityDetails(item.section, item.courseCode);
        return {
          courseCode: item.courseCode,
          courseName: item.courseName,
          sec: item.section.sec,
          instructor: item.section.instructor,
          room: item.section.room,
          isFull: true,
          registered: cap.registered,
          capacity: cap.capacity,
        };
      }),
    );

    // Prompt permission if not granted
    const perm = await ensureNotificationPermission();
    if (perm === "granted") {
      sendBrowserNotification(
        "🔔 تم تتبع الشعب المغلقة في الجدول",
        `تتم الآن مراقبة (${closedSections.length}) شعبة مغلقة عبر المتصفح. ستصلك رسالة فورية عند توفر مقعد.`,
      );
      setTrackedFeedback(
        `تمت إضافة ${closedSections.length} شعبة مغلقة للمراقبة الفورية عبر المتصفح!`,
      );
    } else {
      setTrackedFeedback(
        `تمت إضافة ${closedSections.length} شعبة مغلقة! يُرجى السماح بإشعارات المتصفح لتصلك التنبيهات فوراً.`,
      );
    }
    setTimeout(() => setTrackedFeedback(null), 4000);
  };

  const handleApplyAutoFix = (fix: ConflictAutoFix) => {
    if (fix.type === "remove_course" && fix.courseCode) {
      toggleGeneratedCourse(fix.courseCode);
    } else if (fix.type === "clear_free_days") {
      setScheduleFilters((prev) => ({ ...prev, freeDays: [] }));
      setActiveScheduleIndex(0);
    } else if (fix.type === "unpin_section" && fix.courseCode) {
      setPinnedSection(fix.courseCode, "");
    } else if (fix.type === "clear_exclusions" && fix.courseCode) {
      setScheduleFilters((prev) => {
        const excludedSections = { ...prev.excludedSections };
        delete excludedSections[fix.courseCode!];
        return { ...prev, excludedSections };
      });
      setActiveScheduleIndex(0);
    } else if (fix.type === "remove_max_gap") {
      setScheduleFilters((prev) => ({ ...prev, maxGap: null }));
      setActiveScheduleIndex(0);
    }
  };

  const courseSearchResults = (
    searchQuery.trim()
      ? debouncedQuery === searchQuery
        ? searchResults
        : []
      : []
  )
    .filter(
      (course) =>
        (course.sections?.length ?? 0) > 0 &&
        !selectedCourseCodes.includes(course.id),
    )
    .slice(0, 20);

  const changeSemester = (semester: string) => {
    setSelectedSemester(semester);
    setActiveScheduleIndex(0);
    const plannedCodes = Object.entries(plannedCourses)
      .filter(([, plannedSemester]) => plannedSemester === semester)
      .map(([courseId]) => courseId);
    setSelectedCourseCodes(
      availableCourses.length
        ? plannedCodes.filter((code) =>
            availableCourses.some(
              (course) =>
                course.id === code && (course.sections?.length ?? 0) > 0,
            ),
          )
        : plannedCodes,
    );
  };

  const toggleGeneratedCourse = (courseId: string) => {
    setSelectedCourseCodes((current) =>
      current.includes(courseId)
        ? current.filter((selectedId) => selectedId !== courseId)
        : [...current, courseId],
    );
    setActiveScheduleIndex(0);
  };

  const addGeneratedCourse = (courseId: string) => {
    setSelectedCourseCodes((current) =>
      current.includes(courseId) ? current : [...current, courseId],
    );
    setSearchQuery("");
    setDebouncedQuery("");
    setActiveScheduleIndex(0);
  };

  const toggleFreeDay = (dayKey: string) => {
    setScheduleFilters((current) => {
      const freeDays = current.freeDays ?? [];
      return {
        ...current,
        freeDays: freeDays.includes(dayKey)
          ? freeDays.filter((day) => day !== dayKey)
          : [...freeDays, dayKey],
      };
    });
    setActiveScheduleIndex(0);
  };

  const setPinnedSection = (courseCode: string, section: string) => {
    setScheduleFilters((current) => {
      const pinnedSections = { ...current.pinnedSections };
      if (section) pinnedSections[courseCode] = section;
      else delete pinnedSections[courseCode];
      return { ...current, pinnedSections };
    });
    setActiveScheduleIndex(0);
  };

  const toggleExcludedSection = (courseCode: string, section: string) => {
    setScheduleFilters((current) => {
      const excludedSections = { ...current.excludedSections };
      const excluded = new Set(excludedSections[courseCode] ?? []);
      if (excluded.has(section)) excluded.delete(section);
      else excluded.add(section);
      if (excluded.size) excludedSections[courseCode] = [...excluded];
      else delete excludedSections[courseCode];
      return { ...current, excludedSections };
    });
    setActiveScheduleIndex(0);
  };

  const getSuggestedManualEntry = (courseId: string): ScheduleEntry | null => {
    const selectedRealSection =
      activeSchedule.find((item) => item.courseCode === courseId)?.section ??
      (() => {
        const course = selectedCourses.find((item) => item.id === courseId);
        const pinned = scheduleFilters.pinnedSections?.[courseId];
        return (
          course?.sections?.find(
            (section) =>
              section.sec === pinned && !String(section.sec).includes("مختلط"),
          ) ??
          course?.sections?.find(
            (section) => !String(section.sec).includes("مختلط"),
          )
        );
      })();
    const block = selectedRealSection?.blocks?.[0];
    if (!selectedRealSection || !block) return null;
    const days = (block.days || [])
      .map((dayKey: string) =>
        DAY_NAME_BY_KEY.get(normalizeDayKey(dayKey) ?? dayKey),
      )
      .filter((day: string | undefined): day is string => Boolean(day));
    return {
      startTime: formatScheduleTime(block.start),
      endTime: formatScheduleTime(block.end),
      section: selectedRealSection.sec,
      instructor: selectedRealSection.instructor ?? "",
      room: selectedRealSection.room ?? "",
      days,
    };
  };

  const handleUpdateEntry = <K extends keyof ScheduleEntry>(
    courseId: string,
    field: K,
    value: ScheduleEntry[K],
  ) => {
    setWeeklySchedule((prev) => {
      const semesterSchedule = prev[selectedSemester] ?? {};
      const existing = semesterSchedule[courseId] ??
        getSuggestedManualEntry(courseId) ?? {
          startTime: "",
          endTime: "",
          section: "",
          instructor: "",
          room: "",
          days: [],
        };
      return {
        ...prev,
        [selectedSemester]: {
          ...semesterSchedule,
          [courseId]: { ...existing, [field]: value },
        },
      };
    });
  };

  const toggleDay = (courseId: string, day: string) => {
    const entry = weeklySchedule[selectedSemester]?.[courseId] ??
      getSuggestedManualEntry(courseId) ?? {
        startTime: "",
        endTime: "",
        days: [],
      };
    const days = entry.days ?? (entry.day ? [entry.day] : []);
    const newDays = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day];
    handleUpdateEntry(courseId, "days", newDays);
  };

  const timeToMinutes = (time: string | undefined): number | null => {
    const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(time ?? "");
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };

  const getPosition = (
    startTime: string | undefined,
    endTime: string | undefined,
  ) => {
    const rawStart = timeToMinutes(startTime);
    const rawEnd = timeToMinutes(endTime);
    if (rawStart === null || rawEnd === null || rawEnd <= rawStart) return null;

    const start = Math.max(rawStart, GRID_START_MINUTES);
    const end = Math.min(rawEnd, GRID_END_MINUTES);
    if (end <= start) return null;
    return {
      top: `${((start - GRID_START_MINUTES) / (GRID_END_MINUTES - GRID_START_MINUTES)) * 100}%`,
      height: `${((end - start) / (GRID_END_MINUTES - GRID_START_MINUTES)) * 100}%`,
    };
  };

  const renderMiniScheduleGrid = (
    schedule: GeneratedScheduleCourse[] | undefined,
  ) => {
    if (!schedule || schedule.length === 0) {
      return (
        <div className="h-44 rounded-xl border border-dashed border-[var(--line-control)] bg-[var(--sunken)] flex items-center justify-center text-xs text-[var(--text-3)] font-bold">
          لا توجد بيانات لهذا الجدول
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        {/* Days Header */}
        <div className="grid grid-cols-6 border-b border-[var(--line)] bg-[var(--sunken)] text-center text-[10px] font-bold text-[var(--text-2)] py-1">
          {DAYS.map((day) => (
            <div key={day} className="truncate px-0.5">
              {day}
            </div>
          ))}
        </div>

        {/* Schedule Grid Area */}
        <div className="relative h-44 bg-[var(--surface)]">
          {/* Hour guidelines */}
          <div className="absolute inset-0 grid grid-rows-8 pointer-events-none">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="border-b border-[var(--line)]/25" />
            ))}
          </div>

          {/* Day columns */}
          <div className="absolute inset-0 grid grid-cols-6 divide-x divide-x-reverse divide-[var(--line)]/30">
            {DAY_KEYS.map((dayKey) => (
              <div key={dayKey} className="relative h-full">
                {schedule.flatMap((item) => {
                  const courseIdx = selectedCourseCodes.indexOf(
                    item.courseCode,
                  );
                  const palette = getCoursePalette(item.courseCode, courseIdx);
                  return item.section.blocks
                    .filter(
                      (block: any) =>
                        block.days.some(
                          (d: any) => (normalizeDayKey(d) ?? d) === dayKey,
                        ) &&
                        block.end > 8 &&
                        block.start < 16,
                    )
                    .map((block: any, idx: number) => {
                      const start = Math.max(block.start, 8);
                      const end = Math.min(block.end, 16);
                      if (end <= start) return null;
                      const top = `${((start - 8) / 8) * 100}%`;
                      const height = `${((end - start) / 8) * 100}%`;

                      return (
                        <div
                          key={`${item.courseCode}-${dayKey}-${idx}`}
                          style={{ top, height }}
                          className={cn(
                            "absolute inset-x-0.5 rounded border overflow-hidden p-0.5 text-center flex flex-col justify-center transition-all cursor-default shadow-2xs",
                            palette.bg,
                            palette.border,
                            palette.text,
                          )}
                          title={`${item.courseName} (شعبة ${item.section.sec}) - ${formatScheduleTime(block.start)} إلى ${formatScheduleTime(block.end)}`}
                        >
                          <span className="font-bold text-[8.5px] leading-tight truncate block">
                            {item.courseName}
                          </span>
                          <span className="text-[7.5px] opacity-75 font-mono truncate block">
                            ش.{item.section.sec}
                          </span>
                        </div>
                      );
                    });
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const daysWithLecturesCount = useMemo(() => {
    const map: Record<string, number> = {};
    DAY_KEYS.forEach((key) => {
      let count = 0;
      activeSchedule.forEach((item) => {
        if (
          item.section.blocks.some((b: any) =>
            b.days.some((d: any) => (normalizeDayKey(d) ?? d) === key),
          )
        ) {
          count++;
        }
      });
      map[key] = count;
    });
    return map;
  }, [activeSchedule]);

  const activeDayKey = useMemo(() => {
    if (selectedDayKey === "all") return "all";
    if (
      daysWithLecturesCount[selectedDayKey] &&
      daysWithLecturesCount[selectedDayKey] > 0
    ) {
      return selectedDayKey;
    }
    const firstWithLectures = DAY_KEYS.find(
      (key) => (daysWithLecturesCount[key] ?? 0) > 0,
    );
    return firstWithLectures ?? selectedDayKey;
  }, [selectedDayKey, daysWithLecturesCount]);

  const getLecturesForDay = (dayKey: string) => {
    return activeSchedule
      .flatMap((item) => {
        const courseIdx = selectedCourseCodes.indexOf(item.courseCode);
        const palette = getCoursePalette(item.courseCode, courseIdx);
        const capInfo = getSectionCapacityDetails(
          item.section,
          item.courseCode,
        );

        return item.section.blocks
          .filter((block: any) =>
            block.days.some((d: any) => (normalizeDayKey(d) ?? d) === dayKey),
          )
          .map((block: any) => ({
            courseCode: item.courseCode,
            courseName: item.courseName,
            section: item.section.sec,
            instructor: item.section.instructor,
            room: item.section.room,
            start: block.start,
            end: block.end,
            palette,
            capInfo,
          }));
      })
      .sort((a, b) => a.start - b.start);
  };

  const renderDailyScheduleView = () => {
    const targetDayKeys =
      activeDayKey === "all"
        ? DAY_KEYS.filter((k) => (daysWithLecturesCount[k] ?? 0) > 0)
        : [activeDayKey];

    return (
      <div className="space-y-3">
        {/* Day Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 custom-scrollbar">
          {DAY_KEYS.map((key) => {
            const dayName = DAY_NAME_BY_KEY.get(key) ?? key;
            const count = daysWithLecturesCount[key] ?? 0;
            const isSelected = activeDayKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedDayKey(key);
                  triggerHaptic("selection");
                }}
                className={cn(
                  "flex-1 min-w-[70px] py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-0.5 shrink-0 shadow-2xs",
                  isSelected
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--text-on-accent)] font-bold shadow-xs"
                    : count > 0
                      ? "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--sunken)] text-[var(--text)] font-semibold"
                      : "border-transparent bg-[var(--sunken)]/60 text-[var(--text-3)] opacity-60",
                )}
              >
                <span className="text-xs">{dayName}</span>
                <span
                  className={cn(
                    "text-[10px] font-mono px-1.5 py-0.2 rounded-full",
                    isSelected
                      ? "bg-white/20 text-white font-bold"
                      : count > 0
                        ? "bg-[var(--accent-soft)] text-[var(--accent)] font-bold"
                        : "text-[var(--text-3)]",
                  )}
                >
                  {count > 0
                    ? `${count} ${count === 1 ? "مادة" : "مواد"}`
                    : "عطلة"}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setSelectedDayKey("all");
              triggerHaptic("selection");
            }}
            className={cn(
              "py-2 px-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center shrink-0 text-xs font-bold shadow-2xs",
              activeDayKey === "all"
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--text-on-accent)] shadow-xs"
                : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--sunken)] text-[var(--text)]",
            )}
          >
            <span>كل الأيام</span>
            <span className="text-[10px] opacity-75 font-mono">أجندة</span>
          </button>
        </div>

        {/* Days Content */}
        {targetDayKeys.length === 0 ? (
          <div className="py-12 px-4 rounded-2xl border-2 border-dashed border-[var(--line)] bg-[var(--sunken)] text-center flex flex-col items-center justify-center gap-2">
            <Sparkles size={32} className="text-[var(--accent)] opacity-70" />
            <h4 className="text-sm font-bold text-[var(--text)]">
              لا توجد محاضرات في هذا الجدول
            </h4>
            <p className="text-xs text-[var(--text-3)]">
              لم يتم العثور على أي شعب مطروحة لهذا اليوم.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {targetDayKeys.map((dayKey) => {
              const dayName = DAY_NAME_BY_KEY.get(dayKey) ?? dayKey;
              const lectures = getLecturesForDay(dayKey);

              return (
                <div
                  key={dayKey}
                  className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-xs space-y-3"
                >
                  {/* Day Header in Card */}
                  <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
                      <h3 className="text-sm font-black text-[var(--text)]">
                        {dayName}
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-[var(--text-3)] font-mono">
                      {lectures.length > 0
                        ? `${lectures.length} ${lectures.length === 1 ? "محاضرة" : "محاضرات"}`
                        : "عطلة"}
                    </span>
                  </div>

                  {lectures.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[var(--text-3)] font-bold bg-[var(--sunken)] rounded-xl border border-dashed border-[var(--line)]">
                      ✨ يوم عطلة خالي من المحاضرات
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {lectures.map((lec, idx) => {
                        const nextLec = lectures[idx + 1];
                        const gap = nextLec ? nextLec.start - lec.end : 0;

                        return (
                          <React.Fragment
                            key={`${lec.courseCode}-${dayKey}-${idx}`}
                          >
                            <article
                              className={cn(
                                "rounded-xl border-2 p-3 text-xs transition-all flex flex-col gap-2.5 shadow-2xs",
                                lec.palette.bg,
                                lec.palette.border,
                                lec.palette.text,
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4
                                      className={cn(
                                        "font-black text-sm leading-snug",
                                        lec.palette.text,
                                      )}
                                    >
                                      {lec.courseName}
                                    </h4>
                                    <span
                                      className={cn(
                                        "font-mono text-[10px] border px-1.5 py-0.5 rounded font-bold shrink-0",
                                        lec.palette.badge,
                                      )}
                                    >
                                      {lec.courseCode}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-[var(--text-2)] mt-0.5">
                                    د. {lec.instructor || "مدرس غير محدد"}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExcludedSection(
                                      lec.courseCode,
                                      lec.section,
                                    );
                                    triggerHaptic("selection");
                                  }}
                                  title="استبعاد هذه الشعبة من الاحتمالات المقترحة"
                                  className="p-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text-3)] hover:text-[var(--danger)] hover:border-[var(--danger)]/30 transition-colors cursor-pointer shrink-0"
                                >
                                  <X size={13} />
                                </button>
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--line)]/40 flex-wrap text-[11px]">
                                <div className="flex items-center gap-3 text-[var(--text)] font-bold">
                                  <span
                                    className="flex items-center gap-1 font-mono"
                                    dir="ltr"
                                  >
                                    <Clock
                                      size={12}
                                      className="text-[var(--accent)]"
                                    />
                                    {formatScheduleTime(lec.start)} –{" "}
                                    {formatScheduleTime(lec.end)}
                                  </span>
                                  <span className="flex items-center gap-1 text-[var(--text-2)]">
                                    <MapPin
                                      size={12}
                                      className="text-[var(--text-3)]"
                                    />
                                    {lec.room || "قاعة غير محددة"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--line)] font-bold text-[10px] text-[var(--text)]">
                                    شعبة {lec.section}
                                  </span>
                                  <span
                                    className={cn(
                                      "px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border",
                                      lec.capInfo.isFull
                                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
                                    )}
                                    title={`العدد الحالي: ${lec.capInfo.registered}/${lec.capInfo.capacity}`}
                                  >
                                    {lec.capInfo.registered}/
                                    {lec.capInfo.capacity} طالب
                                  </span>
                                </div>
                              </div>
                            </article>

                            {gap > 0 && (
                              <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[var(--sunken)] border border-dashed border-[var(--line)] text-[10px] font-bold text-[var(--text-3)]">
                                <Clock
                                  size={11}
                                  className="text-[var(--accent)]"
                                />
                                <span>
                                  استراحة{" "}
                                  {gap === 1
                                    ? "ساعة واحدة"
                                    : gap === 1.5
                                      ? "ساعة ونصف"
                                      : gap === 2
                                        ? "ساعتان"
                                        : `${gap} ساعات`}{" "}
                                  (من {formatScheduleTime(lec.end)} إلى{" "}
                                  {formatScheduleTime(nextLec.start)})
                                </span>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="الجدول الدراسي الأسبوعي"
      maxWidth="max-w-6xl"
    >
      <ErrorBoundary>
        <div className="flex flex-col h-full max-h-[calc(100dvh-7rem)] sm:max-h-[85vh]">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-3 sm:mb-4 items-center justify-between">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-[var(--text)]">
              <Calendar size={18} className="text-[var(--accent)]" />
              <span>الجدول الدراسي الأسبوعي</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
              <label
                htmlFor="weekly-schedule-semester"
                className="text-xs font-bold text-[var(--text-2)] whitespace-nowrap"
              >
                الفصل:
              </label>
              <select
                id="weekly-schedule-semester"
                value={selectedSemester}
                onChange={(e) => changeSemester(e.target.value)}
                className="flex-1 md:w-48 p-2 bg-[var(--surface)] text-[var(--text)] border border-[var(--line-control)] rounded-xl font-bold text-sm focus:border-[var(--accent)] outline-none transition-all cursor-pointer"
              >
                {SEMESTERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {manualCourses.length === 0 && activeTab === "edit" ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 bg-[var(--sunken)] rounded-3xl border-2 border-dashed border-[var(--line)]">
              <Calendar
                size={64}
                className="text-[var(--text-3)] mb-4 opacity-50"
              />
              <h3 className="text-xl font-bold text-[var(--text)]">
                لا توجد مواد مخططة لهذا الفصل
              </h3>
              <p className="text-sm text-[var(--text-2)] mt-2 font-medium">
                أضف بعض المواد في "عرض الخطة" لتتمكن من جدولتها
              </p>
            </div>
          ) : activeTab === "edit" ? (
            /* Data Entry View */
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              {manualCourses.map((course) => {
                const entry = weeklySchedule[selectedSemester]?.[course.id] ??
                  getSuggestedManualEntry(course.id) ?? {
                    courseId: course.id,
                    startTime: "",
                    endTime: "",
                    section: "",
                    instructor: "",
                    room: "",
                    days: [],
                  };

                return (
                  <div
                    key={course.id}
                    className="group bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--accent)] rounded-2xl p-5 transition-all shadow-xs"
                  >
                    {!weeklySchedule[selectedSemester]?.[course.id] &&
                      !getSuggestedManualEntry(course.id) && (
                        <p className="mb-3 rounded-xl bg-[var(--warn-soft)] px-3 py-2 text-xs font-bold text-[var(--warn)] border border-[var(--warn)]/30">
                          لا تتوفر بيانات شعبة لهذا المساق؛ أدخل الأوقات والأيام
                          يدوياً.
                        </p>
                      )}
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="md:w-1/3">
                        <div className="mb-4">
                          <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider bg-[var(--accent-soft)] px-2 py-0.5 rounded-md mb-2 inline-block">
                            {course.id}
                          </span>
                          <h3 className="text-lg font-bold text-[var(--text)] leading-tight">
                            {course.name}
                          </h3>
                          <p className="text-xs text-[var(--text-3)] mt-1">
                            {course.credits} ساعات معتمدة
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-[var(--text-2)]">
                            أيام المحاضرات:
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {EDIT_DAYS.map((day) => (
                              <button
                                type="button"
                                aria-label={`محاضرة ${course.name} يوم ${day}`}
                                aria-pressed={
                                  entry.days?.includes(day) ?? false
                                }
                                key={day}
                                onClick={() => toggleDay(course.id, day)}
                                className={cn(
                                  "min-h-9 px-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border cursor-pointer",
                                  entry.days?.includes(day)
                                    ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--text-on-accent)] font-bold shadow-xs"
                                    : "bg-[var(--sunken)] text-[var(--text-2)] border-[var(--line-control)] hover:border-[var(--accent)]",
                                )}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-[var(--text-3)] px-0.5">
                              وقت البدء
                            </label>
                            <div className="relative">
                              <Clock
                                size={14}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
                              />
                              <input
                                aria-label={`وقت بدء ${course.name}`}
                                required
                                type="time"
                                value={entry.startTime ?? ""}
                                onChange={(e) => {
                                  if (e.target.value)
                                    handleUpdateEntry(
                                      course.id,
                                      "startTime",
                                      e.target.value,
                                    );
                                }}
                                className="w-full pr-9 pl-3 py-1.5 bg-[var(--surface)] border border-[var(--line-control)] rounded-lg text-xs font-medium text-[var(--text)] outline-none focus:border-[var(--accent)]"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-[var(--text-3)] px-0.5">
                              وقت الانتهاء
                            </label>
                            <div className="relative">
                              <Clock
                                size={14}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
                              />
                              <input
                                aria-label={`وقت انتهاء ${course.name}`}
                                required
                                type="time"
                                value={entry.endTime ?? ""}
                                onChange={(e) => {
                                  if (e.target.value)
                                    handleUpdateEntry(
                                      course.id,
                                      "endTime",
                                      e.target.value,
                                    );
                                }}
                                className="w-full pr-9 pl-3 py-1.5 bg-[var(--surface)] border border-[var(--line-control)] rounded-lg text-xs font-medium text-[var(--text)] outline-none focus:border-[var(--accent)]"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-[var(--text-3)] px-1">
                              الدكتور / القاعة
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="relative">
                                <User
                                  size={14}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
                                />
                                <input
                                  aria-label={`مدرس ${course.name}`}
                                  type="text"
                                  placeholder="الدكتور"
                                  value={entry.instructor ?? ""}
                                  onChange={(e) =>
                                    handleUpdateEntry(
                                      course.id,
                                      "instructor",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full pr-9 pl-3 py-2.5 bg-[var(--surface)] border border-[var(--line-control)] rounded-xl text-xs font-medium text-[var(--text)] focus:border-[var(--accent)] outline-none transition-all"
                                />
                              </div>
                              <div className="relative">
                                <MapPin
                                  size={14}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
                                />
                                <input
                                  aria-label={`قاعة ${course.name}`}
                                  type="text"
                                  placeholder="القاعة"
                                  value={entry.room ?? ""}
                                  onChange={(e) =>
                                    handleUpdateEntry(
                                      course.id,
                                      "room",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full pr-9 pl-3 py-2.5 bg-[var(--surface)] border border-[var(--line-control)] rounded-xl text-xs font-medium text-[var(--text)] focus:border-[var(--accent)] outline-none transition-all"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-[var(--text-3)] px-1">
                              رقم الشعبة
                            </label>
                            <div className="relative">
                              <Hash
                                size={16}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
                              />
                              <input
                                aria-label={`رقم شعبة ${course.name}`}
                                type="text"
                                placeholder="مثلاً: 101"
                                value={entry.section ?? ""}
                                onChange={(e) =>
                                  handleUpdateEntry(
                                    course.id,
                                    "section",
                                    e.target.value,
                                  )
                                }
                                className="w-full pr-10 pl-3 py-2.5 bg-[var(--surface)] border border-[var(--line-control)] rounded-xl text-xs font-medium text-[var(--text)] focus:border-[var(--accent)] outline-none transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <section className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto">
              <section
                aria-label="اختيار المساقات"
                className="shrink-0 rounded-2xl border border-[var(--line)] bg-[var(--sunken)] p-3"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface)] p-2.5 text-xs border border-[var(--line)] shadow-xs">
                  <div className="flex items-center gap-2 text-[var(--text)]">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
                    <span className="font-bold">
                      آخر تحديث للشعب من الجامعة:
                    </span>
                    <span className="text-[var(--accent)] font-bold">
                      {syncInfo?.lastSyncTime
                        ? formatArabicSyncTime(syncInfo.lastSyncTime)
                        : "اليوم"}
                    </span>
                    {syncInfo?.totalSections ? (
                      <span className="text-[var(--text-3)] text-[11px] hidden sm:inline">
                        ({syncInfo.totalCourses} مساق • {syncInfo.totalSections}{" "}
                        شعبة)
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncRefreshing}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--accent-soft)] text-[11px] font-bold text-[var(--accent)] hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw
                      size={12}
                      className={isSyncRefreshing ? "animate-spin" : ""}
                    />
                    <span>
                      {isSyncRefreshing
                        ? "جاري التحديث..."
                        : "تحديث فوري للشعب"}
                    </span>
                  </button>
                </div>

                {/* Header with Title and Add Course Button */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] shrink-0">
                      <BookOpen size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs sm:text-sm font-bold text-[var(--text)]">
                          المساقات المختارة لتوليد الجدول (
                          {selectedCourseCodes.length})
                        </h3>
                        {selectedCourseCodes.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-mono font-bold">
                            {selectedCourseCodes.length} مواد
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-3)]">
                        {selectedCourseCodes.length > 0
                          ? "المساقات المعتمدة لتوليد ومحاكاة الجدول الأسبوعي بدون تعارض (كل مساق بلونه الخاص)"
                          : "لم تختر أي مساقات بعد. انقر على زر إضافة مساق لتحديد موادك المفتوحة."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddCourseOpen((prev) => !prev);
                        triggerHaptic("selection");
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0",
                        isAddCourseOpen
                          ? "bg-[var(--accent)] text-[var(--text-on-accent)]"
                          : "bg-[var(--accent)] text-[var(--text-on-accent)] hover:opacity-90",
                      )}
                      title={
                        isAddCourseOpen
                          ? "إغلاق قائمة المساقات والعودة للجدول"
                          : "فتح قائمة البحث واختيار المساقات"
                      }
                    >
                      {isAddCourseOpen ? (
                        <>
                          <ChevronUp size={15} />
                          <span>إغلاق القائمة (عرض الجدول)</span>
                        </>
                      ) : (
                        <>
                          <Plus size={15} />
                          <span>إضافة مساق</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Selected Courses Chips (Sleek, colorful, compact tags that don't take vertical space) */}
                {selectedCourseCodes.length > 0 ? (
                  <div
                    className="mt-2.5 flex flex-wrap items-center gap-1.5"
                    aria-label="المساقات المختارة"
                  >
                    {selectedCourseCodes.map((code, idx) => {
                      const course =
                        selectedCourses.find((item) => item.id === code) ??
                        availableCourses.find((item) => item.id === code);
                      const palette = getCoursePalette(code, idx);
                      return (
                        <div
                          key={code}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs group",
                            palette.bg,
                            palette.border,
                            palette.text,
                          )}
                          title={`${course?.name ?? code} (${code}) · ${course?.sections?.length ?? 0} شعبة`}
                        >
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full shrink-0 shadow-2xs",
                              palette.dot,
                            )}
                          />
                          <span className="truncate max-w-[150px] sm:max-w-[200px]">
                            {course?.name ?? code}
                          </span>
                          <span className="text-[10px] font-mono opacity-80 shrink-0">
                            ({code})
                          </span>
                          <button
                            type="button"
                            aria-label={`حذف ${course?.name ?? code} من المساقات المختارة`}
                            onClick={() => toggleGeneratedCourse(code)}
                            className="h-4 w-4 rounded-full hover:bg-black/15 dark:hover:bg-white/25 cursor-pointer text-xs font-bold flex items-center justify-center shrink-0 transition-colors mr-0.5"
                            title="إزالة هذا المساق من التوليد"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2.5 p-3 rounded-xl border border-dashed border-[var(--line-control)] bg-[var(--surface)] text-center text-xs text-[var(--text-3)] font-bold">
                    لم تختر أي مساقات بعد. انقر على زر «+ إضافة مساق» أعلاه
                    للبدء.
                  </div>
                )}

                {/* Collapsible Add Courses Section (Search + 42 Available Courses) */}
                {isAddCourseOpen && (
                  <div className="mt-3 pt-3 border-t border-[var(--line)] space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-black text-[var(--text)] flex items-center gap-1.5">
                        <Plus size={14} className="text-[var(--accent)]" />
                        <span>
                          ابحث عن مساق أو اختر من المواد المفتوحة لتخصصك
                        </span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddCourseOpen(false);
                          triggerHaptic("selection");
                        }}
                        className="text-xs px-2.5 py-1 rounded-lg bg-[var(--accent)] text-[var(--text-on-accent)] font-bold hover:opacity-90 cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <Check size={13} />
                        <span>تم (الانتقال للجدول)</span>
                      </button>
                    </div>
                    <label htmlFor="weekly-course-search" className="sr-only">
                      البحث باسم المساق أو رمزه
                    </label>
                    <input
                      id="weekly-course-search"
                      type="search"
                      role="searchbox"
                      aria-controls="weekly-course-search-results"
                      aria-busy={
                        isCourseLoading ||
                        isSearching ||
                        Boolean(
                          searchQuery.trim() && debouncedQuery !== searchQuery,
                        )
                      }
                      autoComplete="off"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="اكتب اسم المساق أو رمزه..."
                      disabled={isCourseLoading || Boolean(courseLoadError)}
                      className="w-full rounded-xl border border-[var(--line-control)] bg-[var(--surface)] text-[var(--text)] px-3 py-2.5 text-sm font-bold outline-none transition-colors focus:border-[var(--accent)]"
                    />
                    {isCourseLoading && (
                      <p
                        role="status"
                        className="mt-2 text-xs font-bold text-[var(--text-3)]"
                      >
                        جارٍ تحميل المساقات...
                      </p>
                    )}
                    {isOffline && (
                      <div
                        role="status"
                        className="mt-2 flex items-center justify-between rounded-xl border border-[var(--warn)]/40 bg-[var(--warn-soft)] p-2.5 text-xs text-[var(--warn)]"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--warn)]" />
                          <span className="font-bold">
                            تعذر الاتصال بخادم المساقات. يتم استخدام البيانات
                            المخزنة محلياً في وضع عدم الاتصال.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            clearCoursesCache();
                            setCourseLoadAttempt((attempt) => attempt + 1);
                          }}
                          className="font-black text-[var(--warn)] underline hover:opacity-80"
                        >
                          إعادة المحاولة
                        </button>
                      </div>
                    )}
                    {courseLoadError && (
                      <div
                        role="alert"
                        className="mt-2 flex items-center gap-3 text-xs"
                      >
                        <p className="font-bold text-[var(--danger)]">
                          {courseLoadError}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            clearCoursesCache();
                            setCourseLoadAttempt((attempt) => attempt + 1);
                          }}
                          className="min-h-10 rounded-lg px-3 font-black text-[var(--accent)] underline"
                        >
                          إعادة المحاولة
                        </button>
                      </div>
                    )}
                    {searchError && (
                      <p
                        role="alert"
                        className="mt-2 text-xs font-bold text-[var(--danger)]"
                      >
                        {searchError}
                      </p>
                    )}
                    {(isSearching ||
                      (searchQuery.trim() &&
                        debouncedQuery !== searchQuery)) && (
                      <p
                        role="status"
                        className="mt-2 text-xs font-bold text-[var(--text-3)]"
                      >
                        جارٍ البحث...
                      </p>
                    )}
                    {!isCourseLoading &&
                      !courseLoadError &&
                      searchQuery.trim() &&
                      debouncedQuery === searchQuery &&
                      !isSearching &&
                      !searchError &&
                      courseSearchResults.length === 0 && (
                        <p className="mt-2 text-xs font-bold text-[var(--text-3)]">
                          لا توجد مساقات مطابقة متاحة للاختيار.
                        </p>
                      )}
                    {/* Search Results (When typing in the search box) */}
                    {searchQuery.trim() && courseSearchResults.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        <div className="text-[11px] font-bold text-[var(--text-3)]">
                          نتائج البحث ({courseSearchResults.length} مساق):
                        </div>
                        <ul
                          id="weekly-course-search-results"
                          role="list"
                          aria-label="نتائج البحث عن المساقات"
                          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                        >
                          {courseSearchResults.map((course) => {
                            const isMajorCourse = coursesById.has(course.id);
                            const isPlannedInSemester = semesterCourses.some(
                              (planned) => planned.id === course.id,
                            );
                            const isAlreadySelected =
                              selectedCourseCodes.includes(course.id);

                            return (
                              <li key={course.id}>
                                <button
                                  type="button"
                                  onClick={() => addGeneratedCourse(course.id)}
                                  className="min-h-12 w-full rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3 text-right text-xs transition-colors hover:bg-[var(--sunken)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] cursor-pointer flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <span className="block font-black text-[var(--text)] truncate">
                                      {course.name}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-3)] mt-0.5">
                                      <span className="font-mono">
                                        {course.id}
                                      </span>
                                      <span>•</span>
                                      <span className="text-[var(--accent)] font-semibold">
                                        {course.sections?.length ?? 0} شعبة
                                      </span>
                                      {isPlannedInSemester && (
                                        <span className="px-1.5 py-0.2 rounded bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-bold">
                                          ضمن خطة الفصل
                                        </span>
                                      )}
                                      {!isPlannedInSemester &&
                                        isMajorCourse && (
                                          <span className="px-1.5 py-0.2 rounded bg-[var(--sunken)] text-[var(--text-2)] text-[10px] font-semibold border border-[var(--line)]">
                                            من خطة تخصصك
                                          </span>
                                        )}
                                    </div>
                                  </div>
                                  <span className="shrink-0 px-2 py-1 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-[11px]">
                                    {isAlreadySelected ? "✓ مضافة" : "+ إضافة"}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {/* Feature: Eligible & Open Major Courses Grouped by Year or Category */}
                    {!searchQuery.trim() && (
                      <div className="mt-3 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-2xs">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] shrink-0">
                              <GraduationCap size={18} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs sm:text-[13px] font-bold text-[var(--text)]">
                                  المساقات المتاحة لتسجيلك (مفتوحة لتخصصك)
                                </h4>
                                <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-bold">
                                  {eligibleMajorCourses.length} مادة مفتوحة
                                </span>
                              </div>
                              <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                                شعبها مطروحة حالياً في جدول الجامعة ومستوفية
                                لجميع المتطلبات السابقة
                              </p>
                            </div>
                          </div>

                          {/* Toggle: Group by Year vs Group by Category */}
                          <div className="flex items-center gap-1 bg-[var(--sunken)] p-1 rounded-xl border border-[var(--line-control)] shrink-0 self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setEligibleGroupBy("year");
                                triggerHaptic("selection");
                              }}
                              className={cn(
                                "px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                                eligibleGroupBy === "year"
                                  ? "bg-[var(--surface)] text-[var(--accent)] shadow-xs"
                                  : "text-[var(--text-3)] hover:text-[var(--text)]",
                              )}
                              title="عرض المساقات مقسمة حسب السنة الدراسية"
                            >
                              <Calendar size={13} />
                              <span>حسب السنة</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEligibleGroupBy("category");
                                triggerHaptic("selection");
                              }}
                              className={cn(
                                "px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                                eligibleGroupBy === "category"
                                  ? "bg-[var(--surface)] text-[var(--accent)] shadow-xs"
                                  : "text-[var(--text-3)] hover:text-[var(--text)]",
                              )}
                              title="عرض المساقات مقسمة حسب تصنيف الخطة الدراسية"
                            >
                              <Layers size={13} />
                              <span>حسب التصنيف</span>
                            </button>
                          </div>
                        </div>

                        {/* Batch Action: Add All Open Courses */}
                        {eligibleMajorCourses.length > 0 && (
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
                            <span className="text-[11px] text-[var(--text-3)]">
                              انقر على أي مساق لإضافته للجدول، أو أضف الكل دفعة
                              واحدة:
                            </span>
                            {eligibleMajorCourses.filter(
                              (c) => !selectedCourseCodes.includes(c.id),
                            ).length > 0 ? (
                              <button
                                type="button"
                                onClick={handleAddAllEligible}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent-soft)] hover:bg-[var(--accent)] hover:text-[var(--text-on-accent)] text-[var(--accent)] font-bold text-[11px] transition-all cursor-pointer"
                                title="إضافة جميع المساقات المفتوحة للجدول"
                              >
                                <Plus size={13} />
                                <span>
                                  إضافة كل المساقات (
                                  {
                                    eligibleMajorCourses.filter(
                                      (c) =>
                                        !selectedCourseCodes.includes(c.id),
                                    ).length
                                  }
                                  )
                                </span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-[var(--accent)] font-bold flex items-center gap-1">
                                <Check size={13} />
                                <span>تمت إضافة جميع المساقات المفتوحة</span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Grouped Course Cards */}
                        {groupedEligibleCourses.length === 0 ? (
                          <div className="p-4 rounded-xl border border-dashed border-[var(--line-control)] bg-[var(--surface)] text-center space-y-1">
                            <p className="text-xs font-bold text-[var(--text-2)]">
                              لا توجد مساقات إضافية مفتوحة للتسجيل حالياً.
                            </p>
                            <p className="text-[11px] text-[var(--text-3)]">
                              قد تكون أنجزت كافة المواد أو لم تُطرح شعب لها في
                              جدول الجامعة الحالي. يمكنك البحث عن مواد أخرى
                              بالاسم أو الرمز أعلاه.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3.5">
                            {groupedEligibleCourses.map((group) => {
                              const unselectedCount = group.courses.filter(
                                (c) => !selectedCourseCodes.includes(c.id),
                              ).length;

                              return (
                                <div
                                  key={group.id}
                                  className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5"
                                >
                                  {/* Group Header */}
                                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--line)]">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />
                                      <h5 className="font-bold text-xs sm:text-[13px] text-[var(--text)] truncate">
                                        {group.title}
                                      </h5>
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--sunken)] text-[var(--text-2)] font-mono font-bold shrink-0">
                                        {group.courses.length} مواد
                                      </span>
                                    </div>

                                    {unselectedCount > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleAddGroupCourses(group.courses)
                                        }
                                        className="text-[11px] font-bold text-[var(--accent)] hover:underline cursor-pointer flex items-center gap-1 shrink-0"
                                        title={`إضافة كافة مواد ${group.title}`}
                                      >
                                        <Plus size={12} />
                                        <span>
                                          إضافة المجموعة ({unselectedCount})
                                        </span>
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-[var(--accent)] font-semibold flex items-center gap-0.5 shrink-0">
                                        <Check size={11} />
                                        <span>مضافة بالكامل</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* Group Courses Grid */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {group.courses.map((course) => {
                                      const isSelected =
                                        selectedCourseCodes.includes(course.id);
                                      const secondaryLabel =
                                        eligibleGroupBy === "year"
                                          ? course.category
                                          : course.recommendedSemester?.split(
                                              " - ",
                                            )[0] ||
                                            "السنة " + getYearFromId(course.id);

                                      return (
                                        <div
                                          key={course.id}
                                          onClick={() =>
                                            toggleGeneratedCourse(course.id)
                                          }
                                          className={cn(
                                            "p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 text-right select-none",
                                            isSelected
                                              ? "border-[var(--accent)] bg-[var(--accent-soft)]/40 shadow-xs ring-1 ring-[var(--accent)]"
                                              : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--sunken)]",
                                          )}
                                        >
                                          <div>
                                            <div className="flex items-start justify-between gap-1.5 leading-snug">
                                              <h5 className="font-bold text-xs text-[var(--text)] line-clamp-1">
                                                {course.name}
                                              </h5>
                                              <span
                                                className={cn(
                                                  "px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 flex items-center gap-0.5",
                                                  isSelected
                                                    ? "bg-[var(--accent)] text-[var(--text-on-accent)]"
                                                    : "bg-[var(--sunken)] text-[var(--text-2)] border border-[var(--line)]",
                                                )}
                                              >
                                                {isSelected ? (
                                                  <>
                                                    <Check size={11} />
                                                    <span>مضافة</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Plus size={11} />
                                                    <span>إضافة</span>
                                                  </>
                                                )}
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-2 text-[11px] text-[var(--text-3)] font-mono mt-1">
                                              <span>{course.id}</span>
                                              <span>•</span>
                                              <span>
                                                {course.credits} ساعات
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5 border-t border-[var(--line)]/60 text-[10px]">
                                            <span className="font-bold text-[var(--accent)] flex items-center gap-1">
                                              <Layers size={11} />
                                              <span>
                                                {course.sectionsCount} شعبة
                                                متاحة
                                              </span>
                                            </span>
                                            <span className="text-[var(--text-3)] truncate max-w-[50%]">
                                              {secondaryLabel}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bottom Action inside Drawer: Return to Schedule */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddCourseOpen(false);
                        triggerHaptic("selection");
                      }}
                      className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-[var(--text-on-accent)] font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs hover:opacity-95 transition-opacity cursor-pointer mt-3"
                    >
                      <Check size={14} />
                      <span>
                        الانتقال لعرض الجدول الدراسي الأسبوعي (
                        {selectedCourseCodes.length} مساقات مختارة)
                      </span>
                    </button>
                  </div>
                )}
                {selectedCourseCodes.length > 0 &&
                  (isSelectionLoading || isSolvingWorker) && (
                    <p
                      role="status"
                      className="mt-2 text-xs font-bold text-[var(--text-3)] animate-pulse"
                    >
                      {isSelectionLoading
                        ? "جارٍ تحميل الشعب وأوقاتها..."
                        : "جارٍ حساب الجداول الممكنة في الخلفية (Web Worker)..."}
                    </p>
                  )}
                {selectionError && (
                  <div
                    role="alert"
                    className="mt-2 flex flex-wrap items-center gap-3 text-xs"
                  >
                    <p className="font-bold text-[var(--danger)]">
                      {selectionError}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectionLoadAttempt((attempt) => attempt + 1)
                      }
                      className="min-h-10 rounded-lg px-3 font-black text-[var(--accent)] underline"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                )}
                {!isHideSelectedCourses &&
                  semesterCourses.some(
                    (course) =>
                      !availableCourses.some(
                        (catalogCourse) =>
                          catalogCourse.id === course.id &&
                          (catalogCourse.sections?.length ?? 0) > 0,
                      ),
                  ) && (
                    <p className="mt-2 text-xs font-bold text-[var(--warn)]">
                      بعض مواد الفصل المخططة لا تتوفر لها شعب في خدمة المساقات.
                    </p>
                  )}

                {selectedCourseCodes.length > 0 && selectionReady && (
                  <div className="mt-4 flex flex-col gap-3 border-t border-[var(--line)] pt-4">
                    {/* Filter Toggle Button (Organizing Features 4, 5, 7) */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        id="toggle-schedule-filters-btn"
                        onClick={() => setIsFiltersOpen((prev) => !prev)}
                        className={cn(
                          "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition-all shadow-2xs",
                          isFiltersOpen || activeFilterCount > 0
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--sunken)]",
                        )}
                      >
                        <Filter
                          size={15}
                          className={
                            activeFilterCount > 0 ? "text-[var(--accent)]" : ""
                          }
                        />
                        <span>
                          تخصيص وتصفية الجداول (أيام العطلة، تفضيل الوقت، وتثبيت
                          الشعب)
                        </span>
                        {activeFilterCount > 0 && (
                          <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-on-accent)]">
                            {activeFilterCount}
                          </span>
                        )}
                        {isFiltersOpen ? (
                          <ChevronUp size={15} />
                        ) : (
                          <ChevronDown size={15} />
                        )}
                      </button>

                      {generatedSchedules.length > 1 && (
                        <button
                          type="button"
                          id="toggle-compare-schedules-btn"
                          onClick={() => setIsComparing((prev) => !prev)}
                          className={cn(
                            "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition-all shadow-2xs",
                            isComparing
                              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                              : "border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--sunken)]",
                          )}
                        >
                          <Columns size={15} />
                          <span>
                            {isComparing
                              ? "إغلاق المقارنة"
                              : "مقارنة جدولين جنباً إلى جنب"}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Collapsible Filter Panel */}
                    {isFiltersOpen && (
                      <section
                        aria-label="قيود الجدول المقترح"
                        className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--sunken)] p-4 transition-all"
                      >
                        <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                          <h3 className="text-xs font-black text-[var(--text)] flex items-center gap-1.5">
                            <Filter
                              size={14}
                              className="text-[var(--accent)]"
                            />
                            <span>تخصيص الفلاتر والتفضيلات</span>
                          </h3>
                          {activeFilterCount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setScheduleFilters({
                                  freeDays: [],
                                  excludedSections: {},
                                  pinnedSections: {},
                                  timePreference: "",
                                  maxGap: null,
                                  diverseSolutions: true,
                                });
                                setActiveScheduleIndex(0);
                              }}
                              className="text-[11px] font-bold text-[var(--danger)] hover:underline cursor-pointer"
                            >
                              إلغاء جميع الفلاتر
                            </button>
                          )}
                        </div>

                        {/* Feature 5: Free Days */}
                        <fieldset className="min-w-0">
                          <legend className="mb-2 text-xs font-black text-[var(--text-2)]">
                            أيام العطلة المفضلة (أريدها خالية من المحاضرات)
                          </legend>
                          <div className="flex flex-wrap gap-2">
                            {FILTER_DAY_OPTIONS.map(({ key, label }) => {
                              const checked =
                                scheduleFilters.freeDays?.includes(key) ??
                                false;
                              return (
                                <label
                                  key={key}
                                  className={cn(
                                    "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors",
                                    checked
                                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--text-on-accent)]"
                                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--sunken)]",
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleFreeDay(key)}
                                    className="accent-[var(--accent)]"
                                  />
                                  {label}
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>

                        {/* Feature 4: Time Preference & Max Gap */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="grid gap-1.5">
                            <label
                              htmlFor="weekly-time-preference"
                              className="text-xs font-black text-[var(--text-2)]"
                            >
                              ترتيب وتفضيل الأوقات (قوالب الجدول)
                            </label>
                            <select
                              id="weekly-time-preference"
                              value={scheduleFilters.timePreference ?? ""}
                              onChange={(event) => {
                                setScheduleFilters((current) => ({
                                  ...current,
                                  timePreference: event.target.value as
                                    | "morning"
                                    | "late"
                                    | "compact"
                                    | "min_days"
                                    | "",
                                }));
                                setActiveScheduleIndex(0);
                              }}
                              className="min-h-10 rounded-xl border border-[var(--line-control)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--text)] cursor-pointer"
                            >
                              <option value="">
                                بدون تفضيل (عرض كل الجداول)
                              </option>
                              <option value="min_days">
                                ضغط أيام الدوام (أقل عدد أيام في الجامعة - مثلاً
                                3 أيام)
                              </option>
                              <option value="compact">
                                جدول متصل ومضغوط (أقل وقت انتظار وفراغات بين
                                المحاضرات)
                              </option>
                              <option value="morning">
                                الأوقات الصباحية أولاً (دوام مبكر)
                              </option>
                              <option value="late">
                                الأوقات المتأخرة أولاً (دوام مسائي/متأخر)
                              </option>
                            </select>
                          </div>
                          <div className="grid gap-1.5">
                            <label
                              htmlFor="weekly-max-gap"
                              className="text-xs font-black text-[var(--text-2)]"
                            >
                              أقصى فراغ بين المحاضرات باليوم
                            </label>
                            <select
                              id="weekly-max-gap"
                              value={scheduleFilters.maxGap ?? ""}
                              onChange={(event) => {
                                setScheduleFilters((current) => ({
                                  ...current,
                                  maxGap:
                                    event.target.value === ""
                                      ? null
                                      : Number(event.target.value),
                                }));
                                setActiveScheduleIndex(0);
                              }}
                              className="min-h-10 rounded-xl border border-[var(--line-control)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--text)] cursor-pointer"
                            >
                              <option value="">بدون حد للفراغ</option>
                              <option value="0">
                                جدول مكثف (بدون أي فراغ)
                              </option>
                              <option value="1">ساعة واحدة كحد أقصى</option>
                              <option value="2">ساعتان كحد أقصى</option>
                              <option value="3">3 ساعات كحد أقصى</option>
                            </select>
                          </div>
                        </div>

                        {/* Feature 7: Excluded Sections */}
                        <div className="grid gap-3">
                          <h4 className="text-xs font-black text-[var(--text-2)]">
                            استبعاد شعب معينة من الجدول
                          </h4>
                          {selectedCourses.map((course) => {
                            const sections = (course.sections ?? []).filter(
                              (section) =>
                                !String(section.sec).includes("مختلط") &&
                                section.blocks.length > 0,
                            );
                            if (sections.length === 0) return null;
                            const excluded = new Set(
                              scheduleFilters.excludedSections?.[course.id] ??
                                [],
                            );
                            return (
                              <fieldset
                                key={course.id}
                                className="grid min-w-0 gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3"
                              >
                                <legend className="px-1 text-xs font-black text-[var(--text)]">
                                  {course.name} ({course.id})
                                </legend>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {sections.map((section) => {
                                    const cap = getSectionCapacityDetails(
                                      section,
                                      course.id,
                                    );
                                    return (
                                      <label
                                        key={section.sec}
                                        className="inline-flex min-h-9 items-center gap-2 text-xs font-bold text-[var(--text)] cursor-pointer"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={excluded.has(section.sec)}
                                          onChange={() =>
                                            toggleExcludedSection(
                                              course.id,
                                              section.sec,
                                            )
                                          }
                                          className="accent-[var(--accent)]"
                                        />
                                        <span>استبعاد شعبة {section.sec}</span>
                                        <span className="text-[10px] font-mono text-[var(--text-3)]">
                                          ({cap.registered}/{cap.capacity} طالب)
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </fieldset>
                            );
                          })}
                        </div>
                      </section>
                    )}
                  </div>
                )}

                {/* Feature 3: Smart Conflict Explainer Banner with Auto-Fixes */}
                {conflictExplanation?.hasConflict && (
                  <div
                    role="alert"
                    className="mt-4 rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-4 text-xs space-y-2.5"
                  >
                    <div className="flex items-center gap-2 text-[var(--danger)] font-bold text-sm">
                      <AlertTriangle className="h-5 w-5 text-[var(--danger)] shrink-0" />
                      <span>{conflictExplanation.summary}</span>
                    </div>

                    <ul className="list-disc list-inside space-y-1 text-[var(--danger)] font-medium">
                      {conflictExplanation.details.map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                    </ul>

                    {conflictExplanation.autoFixes.length > 0 && (
                      <div className="pt-2 border-t border-[var(--danger)]/20 flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[var(--danger)] text-xs">
                          حلول مقترحة لحل التعارض فوراً:
                        </span>
                        {conflictExplanation.autoFixes.map((fix, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleApplyAutoFix(fix)}
                            className="px-3 py-1.5 rounded-lg bg-[var(--danger)] hover:opacity-90 text-[var(--text-on-accent)] font-bold text-xs transition-opacity cursor-pointer shadow-2xs"
                          >
                            {fix.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Feature 6: Side-by-Side Comparison Mode */}
              {isComparing && generatedSchedules.length > 1 && (
                <section
                  aria-label="مقارنة الجداول جنباً إلى جنب"
                  className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--sunken)] p-3.5 space-y-3.5 animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                    <div className="flex items-center gap-2">
                      <Columns size={18} className="text-[var(--accent)]" />
                      <h3 className="font-bold text-sm text-[var(--text)]">
                        مقارنة جدولين جنباً إلى جنب (جدول أسبوعي مصغر)
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsComparing(false)}
                      className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      إغلاق المقارنة ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Schedule Option A */}
                    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-3 space-y-2.5 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-[var(--accent)]">
                            الجدول الأول (أ):
                          </span>
                          <div className="flex items-center gap-1 bg-[var(--sunken)] border border-[var(--line-control)] rounded-lg p-0.5">
                            <button
                              type="button"
                              disabled={compareScheduleIndexA <= 0}
                              onClick={() =>
                                setCompareScheduleIndexA((i) =>
                                  Math.max(0, i - 1),
                                )
                              }
                              className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold hover:bg-[var(--surface)] disabled:opacity-30 cursor-pointer"
                              title="الاحتمال السابق"
                            >
                              -
                            </button>
                            <div className="flex items-center px-1">
                              <input
                                type="number"
                                min={1}
                                max={generatedSchedules.length}
                                value={compareScheduleIndexA + 1}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (
                                    !isNaN(val) &&
                                    val >= 1 &&
                                    val <= generatedSchedules.length
                                  ) {
                                    setCompareScheduleIndexA(val - 1);
                                  }
                                }}
                                className="w-12 text-center font-mono font-bold text-xs bg-[var(--surface)] border border-[var(--line-control)] rounded px-1 py-0.5 text-[var(--text)]"
                                title="اكتب رقم الاحتمال مباشرة"
                              />
                              <span className="text-[10px] text-[var(--text-3)] mr-1">
                                / {generatedSchedules.length}
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={
                                compareScheduleIndexA >=
                                generatedSchedules.length - 1
                              }
                              onClick={() =>
                                setCompareScheduleIndexA((i) =>
                                  Math.min(
                                    generatedSchedules.length - 1,
                                    i + 1,
                                  ),
                                )
                              }
                              className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold hover:bg-[var(--surface)] disabled:opacity-30 cursor-pointer"
                              title="الاحتمال التالي"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setCompareScheduleIndexA(activeScheduleIndex)
                          }
                          className="text-[11px] px-2 py-1 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] font-bold hover:opacity-85 transition-opacity cursor-pointer shrink-0"
                          title="تعيين الجدول المعروض حالياً بالرئيسية"
                        >
                          تعيين الحالي ({activeScheduleIndex + 1})
                        </button>
                      </div>

                      {/* Mini Weekly Schedule Grid A */}
                      {renderMiniScheduleGrid(
                        generatedSchedules[compareScheduleIndexA],
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          handleAdoptSchedule(
                            generatedSchedules[compareScheduleIndexA],
                          )
                        }
                        className="w-full py-2 bg-[var(--accent)] hover:opacity-90 text-[var(--text-on-accent)] rounded-lg text-xs font-bold transition-opacity cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <Check size={14} />
                        <span>اعتماد جدول (أ) كجدول أسبوعي</span>
                      </button>
                    </div>

                    {/* Schedule Option B */}
                    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-3 space-y-2.5 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-[var(--accent)]">
                            الجدول الثاني (ب):
                          </span>
                          <div className="flex items-center gap-1 bg-[var(--sunken)] border border-[var(--line-control)] rounded-lg p-0.5">
                            <button
                              type="button"
                              disabled={compareScheduleIndexB <= 0}
                              onClick={() =>
                                setCompareScheduleIndexB((i) =>
                                  Math.max(0, i - 1),
                                )
                              }
                              className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold hover:bg-[var(--surface)] disabled:opacity-30 cursor-pointer"
                              title="الاحتمال السابق"
                            >
                              -
                            </button>
                            <div className="flex items-center px-1">
                              <input
                                type="number"
                                min={1}
                                max={generatedSchedules.length}
                                value={compareScheduleIndexB + 1}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (
                                    !isNaN(val) &&
                                    val >= 1 &&
                                    val <= generatedSchedules.length
                                  ) {
                                    setCompareScheduleIndexB(val - 1);
                                  }
                                }}
                                className="w-12 text-center font-mono font-bold text-xs bg-[var(--surface)] border border-[var(--line-control)] rounded px-1 py-0.5 text-[var(--text)]"
                                title="اكتب رقم الاحتمال مباشرة"
                              />
                              <span className="text-[10px] text-[var(--text-3)] mr-1">
                                / {generatedSchedules.length}
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={
                                compareScheduleIndexB >=
                                generatedSchedules.length - 1
                              }
                              onClick={() =>
                                setCompareScheduleIndexB((i) =>
                                  Math.min(
                                    generatedSchedules.length - 1,
                                    i + 1,
                                  ),
                                )
                              }
                              className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold hover:bg-[var(--surface)] disabled:opacity-30 cursor-pointer"
                              title="الاحتمال التالي"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setCompareScheduleIndexB(activeScheduleIndex)
                          }
                          className="text-[11px] px-2 py-1 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] font-bold hover:opacity-85 transition-opacity cursor-pointer shrink-0"
                          title="تعيين الجدول المعروض حالياً بالرئيسية"
                        >
                          تعيين الحالي ({activeScheduleIndex + 1})
                        </button>
                      </div>

                      {/* Mini Weekly Schedule Grid B */}
                      {renderMiniScheduleGrid(
                        generatedSchedules[compareScheduleIndexB],
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          handleAdoptSchedule(
                            generatedSchedules[compareScheduleIndexB],
                          )
                        }
                        className="w-full py-2 bg-[var(--accent)] hover:opacity-90 text-[var(--text-on-accent)] rounded-lg text-xs font-bold transition-opacity cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <Check size={14} />
                        <span>اعتماد جدول (ب) كجدول أسبوعي</span>
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* Navigation & Adoption Control Bar */}
              <nav
                aria-label="التنقل بين الجداول المقترحة"
                className="sticky top-0 z-20 flex flex-col sm:flex-row items-center justify-between gap-2.5 rounded-xl border border-[var(--line)] p-2.5 bg-[var(--surface)]/95 backdrop-blur-md shadow-xs transition-all"
              >
                <div className="text-xs font-bold text-[var(--text)] text-center sm:text-right flex items-center gap-2 flex-wrap">
                  <span>
                    {generatedSchedules.length
                      ? `الاحتمال ${activeScheduleIndex + 1} من أصل ${generatedSchedules.length} خالي من أي تعارض`
                      : !selectionReady || isSelectionLoading || isSolvingWorker
                        ? "جارٍ معالجة وتوليد التوافقات في الخلفية..."
                        : selectedCourseCodes.length
                          ? "لا يوجد توافق خالي من التعارض (راجع الحلول المقترحة أعلاه)"
                          : "اختر مواد من البحث أو من خطتك لتوليد الجداول فوراً"}
                  </span>

                  {scheduleQuality && generatedSchedules.length > 0 && (
                    <span
                      className={cn(
                        "text-[11px] px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 shadow-2xs",
                        scheduleQuality.tier === "excellent"
                          ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30"
                          : scheduleQuality.tier === "good"
                            ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/20"
                            : scheduleQuality.tier === "fair"
                              ? "bg-[var(--warn-soft)] text-[var(--warn)] border-[var(--warn)]/30"
                              : "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/30",
                      )}
                      title={`تفصيل التقييم: أيام الدوام ${scheduleQuality.breakdown.daysScore}/40 • الفراغات ${scheduleQuality.breakdown.gapsScore}/40 • أوقات المحاضرات ${scheduleQuality.breakdown.timingScore}/20`}
                    >
                      <span>{scheduleQuality.badge}</span>
                      <span className="opacity-80 font-mono">
                        ({scheduleQuality.score}%)
                      </span>
                    </span>
                  )}
                  {adoptedFeedback && (
                    <span className="text-[var(--accent)] font-bold flex items-center gap-1 animate-pulse">
                      <CheckCheck size={14} />
                      <span>تم اعتماد هذا الجدول بنجاح!</span>
                    </span>
                  )}
                  {trackedFeedback && (
                    <span className="text-[var(--warn)] font-bold flex items-center gap-1 animate-pulse">
                      <Bell
                        size={14}
                        className="fill-[var(--warn)] text-[var(--warn)]"
                      />
                      <span>{trackedFeedback}</span>
                    </span>
                  )}
                </div>

                {generatedSchedules.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full md:w-auto">
                    {/* Connected Atomic Pager: السابق + الرقم + التالي (لا ينفصلان أبداً) */}
                    <div className="inline-flex items-center rounded-lg border border-[var(--line-control)] bg-[var(--sunken)] p-0.5 shadow-2xs shrink-0">
                      <button
                        type="button"
                        disabled={activeScheduleIndex <= 0}
                        onClick={() => {
                          setActiveScheduleIndex((index) => index - 1);
                          triggerHaptic("selection");
                        }}
                        className="h-8 px-2.5 rounded-md font-bold text-xs text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors flex items-center gap-1"
                        title="الجدول السابق"
                      >
                        <ChevronRight size={14} />
                        <span>السابق</span>
                      </button>

                      <div className="px-2 h-7 text-xs font-black text-[var(--text)] flex items-center gap-1 border-x border-[var(--line)]">
                        <input
                          type="number"
                          min={1}
                          max={generatedSchedules.length}
                          value={activeScheduleIndex + 1}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (
                              !isNaN(val) &&
                              val >= 1 &&
                              val <= generatedSchedules.length
                            ) {
                              setActiveScheduleIndex(val - 1);
                            }
                          }}
                          className="w-10 text-center font-mono font-bold text-xs bg-[var(--surface)] border border-[var(--line-control)] rounded py-0.5 text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                          title="انتقل لرقم جدول محدد مباشرة"
                        />
                        <span className="text-[11px] font-mono text-[var(--text-3)]">
                          / {generatedSchedules.length}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={
                          activeScheduleIndex >= generatedSchedules.length - 1
                        }
                        onClick={() => {
                          setActiveScheduleIndex((index) => index + 1);
                          triggerHaptic("selection");
                        }}
                        className="h-8 px-2.5 rounded-md font-bold text-xs text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors flex items-center gap-1"
                        title="الجدول التالي"
                      >
                        <span>التالي</span>
                        <ChevronLeft size={14} />
                      </button>
                    </div>

                    {/* Primary Action: Adopt Schedule */}
                    <button
                      type="button"
                      id="adopt-schedule-btn"
                      disabled={generatedSchedules.length === 0}
                      onClick={() => handleAdoptSchedule(activeSchedule)}
                      className="h-8 rounded-lg bg-[var(--accent)] hover:opacity-90 text-[var(--text-on-accent)] px-3.5 text-xs font-bold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs shrink-0"
                      title="حفظ واعتماد هذا التوزيع كجدول أسبوعي أساسي لهذا الفصل"
                    >
                      <Check size={14} />
                      <span>اعتماد هذا الجدول</span>
                    </button>

                    {/* Secondary Tools Cluster */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {generatedSchedules.length > 1 && (
                        <button
                          type="button"
                          id="add-to-comparison-btn"
                          onClick={() => {
                            setCompareScheduleIndexA(activeScheduleIndex);
                            if (compareScheduleIndexB === activeScheduleIndex) {
                              setCompareScheduleIndexB(
                                (activeScheduleIndex + 1) %
                                  generatedSchedules.length,
                              );
                            }
                            setIsComparing(true);
                            triggerHaptic("selection");
                          }}
                          className={cn(
                            "h-8 rounded-lg border px-2.5 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs",
                            isComparing
                              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                              : "border-[var(--line-control)] bg-[var(--surface)] hover:bg-[var(--sunken)] text-[var(--text)]",
                          )}
                          title="تثبيت هذا الجدول في شاشة المقارنة لمقارنته مع جداول أخرى جنباً إلى جنب"
                        >
                          <Columns size={13} className="text-[var(--accent)]" />
                          <span>مقارنة</span>
                        </button>
                      )}

                      <button
                        type="button"
                        id="adopt-as-draft-btn"
                        disabled={generatedSchedules.length === 0}
                        onClick={() => handleAdoptAsDraft(activeSchedule)}
                        className="h-8 rounded-lg bg-[var(--surface)] hover:bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text)] px-2.5 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
                        title="حفظ واعتماد هذا الجدول كمسودة بديلة جديدة (A/B/C) للمقارنة بها دون استبدال مسودتك الحالية"
                      >
                        <Bookmark size={13} className="text-[var(--accent)]" />
                        <span>مسودة بديلة</span>
                      </button>

                      <button
                        type="button"
                        id="track-schedule-sections-btn"
                        disabled={generatedSchedules.length === 0}
                        onClick={handleTrackScheduleSections}
                        className="h-8 rounded-lg bg-[var(--warn-soft)] hover:opacity-90 border border-[var(--warn)]/30 text-[var(--warn)] px-2.5 text-xs font-bold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
                        title="تتبع الشعب المغلقة فقط في هذا الجدول لتلقي إشعار فور توفر مقعد شاغر"
                      >
                        <Bell size={13} className="text-[var(--warn)]" />
                        <span>تتبع المغلقة</span>
                      </button>
                    </div>
                  </div>
                )}
              </nav>

              {/* Dual Mode Switcher: يومي للجوال 📱 vs شبكة أسبوعية 📅 */}
              <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
                <div className="flex items-center gap-1 p-0.5 bg-[var(--sunken)] rounded-xl border border-[var(--line)] shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleViewMode("daily");
                      triggerHaptic("selection");
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                      scheduleViewMode === "daily"
                        ? "bg-[var(--surface)] text-[var(--accent)] shadow-2xs border border-[var(--line)]"
                        : "text-[var(--text-2)] hover:text-[var(--text)]",
                    )}
                    title="عرض يومي مخصص لشاشات الجوال ببطاقات واسعة ومقروءة"
                  >
                    <Smartphone size={14} className="text-[var(--accent)]" />
                    <span>عرض يومي (للجوال)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScheduleViewMode("weekly");
                      triggerHaptic("selection");
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                      scheduleViewMode === "weekly"
                        ? "bg-[var(--surface)] text-[var(--accent)] shadow-2xs border border-[var(--line)]"
                        : "text-[var(--text-2)] hover:text-[var(--text)]",
                    )}
                    title="الشبكة الأسبوعية البانورامية الكاملة لجميع أيام الأسبوع"
                  >
                    <Calendar size={14} />
                    <span>شبكة أسبوعية كاملة</span>
                  </button>
                </div>

                <div className="text-[11px] font-bold text-[var(--text-3)] hidden sm:block">
                  {scheduleViewMode === "daily"
                    ? "تصفح محاضرات كل يوم على حدة بوضوح وسلاسة"
                    : "يمكنك التمرير أفقياً لرؤية جميع أيام الأسبوع"}
                </div>
              </div>

              {scheduleViewMode === "daily" ? (
                renderDailyScheduleView()
              ) : (
                <section
                  aria-label="الشبكة الأسبوعية"
                  className="shrink-0 overflow-hidden bg-[var(--surface)] rounded-xl border border-[var(--line)] shadow-xs"
                >
                  <div className="overflow-auto custom-scrollbar">
                    <div className="min-w-[850px]">
                      <div className="grid grid-cols-[3.5rem_repeat(6,minmax(0,1fr))] border-b border-[var(--line)] bg-[var(--sunken)]">
                        <div
                          aria-hidden="true"
                          className="sticky right-0 z-10 bg-[var(--sunken)] border-l border-[var(--line)]"
                        />
                        {DAYS.map((day) => (
                          <div
                            key={day}
                            className="border-r border-[var(--line)] px-1 py-2.5 text-center text-xs font-semibold text-[var(--text)]"
                          >
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-[3.5rem_repeat(6,minmax(0,1fr))]">
                        <div className="sticky right-0 z-10 bg-[var(--sunken)] border-l border-[var(--line)]">
                          {HOURS.map((hour) => (
                            <div
                              key={hour}
                              className="h-16 border-b border-[var(--line)] px-1 pt-1 text-center text-[10px] font-mono text-[var(--text-3)]"
                            >
                              {hour >= 12
                                ? `${hour === 12 ? 12 : hour - 12}:00 م`
                                : `${hour}:00 ص`}
                            </div>
                          ))}
                        </div>
                        {DAY_KEYS.map((dayKey) => (
                          <div
                            key={dayKey}
                            className="relative border-r border-[var(--line)]"
                          >
                            {HOURS.map((hour) => (
                              <div
                                key={hour}
                                className="h-16 border-b border-[var(--line)]/50"
                              />
                            ))}
                            {activeSchedule.flatMap((item) => {
                              const courseIdx = selectedCourseCodes.indexOf(
                                item.courseCode,
                              );
                              const palette = getCoursePalette(
                                item.courseCode,
                                courseIdx,
                              );
                              return item.section.blocks
                                .filter(
                                  (block: any) =>
                                    block.days.some(
                                      (d: any) =>
                                        (normalizeDayKey(d) ?? d) === dayKey,
                                    ) &&
                                    block.end > 8 &&
                                    block.start < 16,
                                )
                                .map((block: any, blockIndex: number) => {
                                  const start = Math.max(block.start, 8);
                                  const end = Math.min(block.end, 16);
                                  if (end <= start) return null;
                                  const top = `${((start - 8) / 8) * 100}%`;
                                  const height = `${((end - start) / 8) * 100}%`;
                                  return (
                                    <article
                                      key={`${item.courseCode}-${dayKey}-${blockIndex}`}
                                      style={{ top, height }}
                                      className={cn(
                                        "absolute inset-x-1 z-[1] overflow-hidden rounded-lg border-2 p-1.5 text-[9px] shadow-xs hover:shadow-md transition-all flex flex-col justify-between",
                                        palette.border,
                                        palette.bg,
                                        palette.text,
                                      )}
                                      aria-label={`${item.courseName}، رمز ${item.courseCode}، شعبة ${item.section.sec}، ${DAY_NAME_BY_KEY.get(dayKey)}، ${formatScheduleTime(block.start)} إلى ${formatScheduleTime(block.end)}، ${item.section.room ?? "قاعة غير محددة"}، ${item.section.instructor ?? "مدرس غير محدد"}`}
                                    >
                                      <div>
                                        <div className="flex items-center justify-between gap-1 leading-tight">
                                          <h4
                                            className={cn(
                                              "font-bold truncate text-[10px]",
                                              palette.text,
                                            )}
                                          >
                                            {item.courseName}
                                          </h4>
                                          <span
                                            className={cn(
                                              "font-mono text-[8px] border px-1 rounded shrink-0 font-bold",
                                              palette.badge,
                                            )}
                                          >
                                            {item.courseCode}
                                          </span>
                                        </div>

                                        {(() => {
                                          const capInfo =
                                            getSectionCapacityDetails(
                                              item.section,
                                              item.courseCode,
                                            );
                                          return (
                                            <div className="flex items-center justify-between gap-1 text-[9px] text-[var(--text)] font-semibold mt-0.5">
                                              <div className="flex items-center gap-1 min-w-0">
                                                <span className="shrink-0">
                                                  شعبة {item.section.sec}
                                                </span>
                                                <span
                                                  className={cn(
                                                    "px-1 py-0.2 rounded text-[7.5px] font-mono font-bold shrink-0 border",
                                                    capInfo.isFull
                                                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
                                                  )}
                                                  title={`العدد الحالي: ${capInfo.registered} من أصل ${capInfo.capacity} طالب (${capInfo.isFull ? "ممتلئة بالكامل" : `متبقي ${capInfo.available} مقاعد`})`}
                                                >
                                                  {capInfo.registered}/
                                                  {capInfo.capacity}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-1 shrink-0">
                                                {/* Item 48: 1-Click Exclude Section */}
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleExcludedSection(
                                                      item.courseCode,
                                                      item.section.sec,
                                                    );
                                                    triggerHaptic();
                                                  }}
                                                  title="استبعاد هذه الشعبة من كل الاحتمالات المقترحة"
                                                  className="p-0.5 rounded transition-all cursor-pointer text-[var(--text-3)] hover:text-[var(--danger)]"
                                                >
                                                  <X size={10} />
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })()}

                                        <p className="truncate text-[var(--text-2)] mt-0.5 text-[9px]">
                                          د.{" "}
                                          {item.section.instructor ??
                                            "غير محدد"}
                                        </p>
                                      </div>

                                      <div className="border-t border-[var(--line)] pt-0.5 flex items-center justify-between text-[8.5px] font-mono text-[var(--text-3)]">
                                        <span className="truncate max-w-[55%]">
                                          {item.section.room ?? "غير محددة"}
                                        </span>
                                        <span dir="ltr">
                                          {formatScheduleTime(block.start)}–
                                          {formatScheduleTime(block.end)}
                                        </span>
                                      </div>
                                    </article>
                                  );
                                });
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Bottom Schedule Pager (User Request: Allows student to cycle schedules from the bottom without scrolling back up) */}
              {generatedSchedules.length > 0 && (
                <div
                  aria-label="التنقل بين الجداول (أسفل الجدول)"
                  className="mt-1 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[var(--line)] p-2.5 bg-[var(--surface)] shadow-xs"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--text)]">
                    <span>
                      الاحتمال {activeScheduleIndex + 1} من أصل{" "}
                      {generatedSchedules.length} خالي من أي تعارض
                    </span>
                    {scheduleQuality && (
                      <span
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold border",
                          scheduleQuality.tier === "excellent"
                            ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30"
                            : scheduleQuality.tier === "good"
                              ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/20"
                              : scheduleQuality.tier === "fair"
                                ? "bg-[var(--warn-soft)] text-[var(--warn)] border-[var(--warn)]/30"
                                : "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/30",
                        )}
                      >
                        <span>{scheduleQuality.badge}</span>
                        <span className="opacity-80 font-mono">
                          ({scheduleQuality.score}%)
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                    {/* Connected Atomic Pager: السابق + الرقم + التالي */}
                    <div className="inline-flex items-center rounded-lg border border-[var(--line-control)] bg-[var(--sunken)] p-0.5 shadow-2xs shrink-0">
                      <button
                        type="button"
                        disabled={activeScheduleIndex <= 0}
                        onClick={() => {
                          setActiveScheduleIndex((index) => index - 1);
                          triggerHaptic("selection");
                        }}
                        className="h-8 px-2.5 rounded-md font-bold text-xs text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors flex items-center gap-1"
                        title="الجدول السابق"
                      >
                        <ChevronRight size={14} />
                        <span>السابق</span>
                      </button>

                      <div className="px-2 h-7 text-xs font-black text-[var(--text)] flex items-center gap-1 border-x border-[var(--line)]">
                        <input
                          type="number"
                          min={1}
                          max={generatedSchedules.length}
                          value={activeScheduleIndex + 1}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (
                              !isNaN(val) &&
                              val >= 1 &&
                              val <= generatedSchedules.length
                            ) {
                              setActiveScheduleIndex(val - 1);
                            }
                          }}
                          className="w-10 text-center font-mono font-bold text-xs bg-[var(--surface)] border border-[var(--line-control)] rounded py-0.5 text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                          title="انتقل لرقم جدول محدد مباشرة"
                        />
                        <span className="text-[11px] font-mono text-[var(--text-3)]">
                          / {generatedSchedules.length}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={
                          activeScheduleIndex >= generatedSchedules.length - 1
                        }
                        onClick={() => {
                          setActiveScheduleIndex((index) => index + 1);
                          triggerHaptic("selection");
                        }}
                        className="h-8 px-2.5 rounded-md font-bold text-xs text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors flex items-center gap-1"
                        title="الجدول التالي"
                      >
                        <span>التالي</span>
                        <ChevronLeft size={14} />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={generatedSchedules.length === 0}
                      onClick={() => handleAdoptSchedule(activeSchedule)}
                      className="h-8 rounded-lg bg-[var(--accent)] hover:opacity-90 text-[var(--text-on-accent)] px-3 text-xs font-bold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs shrink-0"
                    >
                      <Check size={14} />
                      <span>اعتماد هذا الجدول</span>
                    </button>

                    {/* Action: Add to Comparison from bottom pager */}
                    {generatedSchedules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCompareScheduleIndexA(activeScheduleIndex);
                          if (compareScheduleIndexB === activeScheduleIndex) {
                            setCompareScheduleIndexB(
                              (activeScheduleIndex + 1) %
                                generatedSchedules.length,
                            );
                          }
                          setIsComparing(true);
                          triggerHaptic("selection");
                        }}
                        className={cn(
                          "h-8 rounded-lg border px-2.5 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs",
                          isComparing
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "border-[var(--line-control)] bg-[var(--surface)] hover:bg-[var(--sunken)] text-[var(--text)]",
                        )}
                        title="إضافة وتثبيت هذا الجدول في شاشة المقارنة لمقارنته مع جداول أخرى"
                      >
                        <Columns size={13} className="text-[var(--accent)]" />
                        <span>مقارنة</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Footer Info */}
          <div className="mt-4 pt-4 border-t border-[var(--line)] flex justify-between items-center text-[10px] font-bold text-[var(--text-3)]">
            <div className="flex gap-4">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[var(--accent)]"></div>{" "}
                جدولك مرتب
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[var(--text-2)]"></div>{" "}
                يتم الحفظ تلقائياً
              </span>
            </div>
            <p>يمكنك التبديل بين الأقسام من الأعلى</p>
          </div>
        </div>
      </ErrorBoundary>
    </BaseModal>
  );
};

export default WeeklyScheduleModal;
