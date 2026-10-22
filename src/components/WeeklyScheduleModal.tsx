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
} from "lucide-react";
import { BaseModal } from "./BaseModal";
import { ErrorBoundary } from "./ErrorBoundary";
import type { Course, ScheduleEntry } from "../data";
import { cn } from "../utils";
import { SEMESTERS } from "../constants";
import {
  fetchSyncStatus,
  triggerManualSync,
  formatArabicSyncTime,
  SyncStatus,
} from "../services/syncService";
import {
  fetchCourses,
  fetchCoursesByCodes,
  searchCourses,
  isOfflineCatalog,
  clearCoursesCache,
} from "../services/courseService";
import {
  generateAllSchedules,
  normalizeDayKey,
  dayKeyToName,
} from "../services/scheduleSolver";
import type { CatalogCourse } from "../services/scheduleSolver";
import type { CatalogScheduleFilters } from "../services/scheduleSolver";

interface WeeklyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  plannedCourses: Record<string, string>;
  courses: Course[];
  weeklySchedule: Record<string, Record<string, ScheduleEntry>>;
  setWeeklySchedule: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, ScheduleEntry>>>
  >;
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

export const WeeklyScheduleModal: React.FC<WeeklyScheduleModalProps> = ({
  isOpen,
  onClose,
  plannedCourses,
  courses,
  weeklySchedule,
  setWeeklySchedule,
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
  const [hasGeneratedSchedules, setHasGeneratedSchedules] = useState(false);
  const [scheduleFilters, setScheduleFilters] =
    useState<CatalogScheduleFilters>({
      freeDays: [],
      excludedSections: {},
      pinnedSections: {},
      timePreference: "",
      maxGap: null,
    });
  const [syncInfo, setSyncInfo] = useState<SyncStatus | null>(null);
  const [isSyncRefreshing, setIsSyncRefreshing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetchSyncStatus().then(setSyncInfo).catch(() => {});
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
  const generatedSchedules = useMemo(
    () => {
      if (!hasGeneratedSchedules || !selectionReady || selectedCourseCodes.length === 0) {
        return [];
      }
      try {
        return generateAllSchedules(selectedCourses, scheduleFilters);
      } catch (err) {
        console.error("Schedule solver error:", err);
        return [];
      }
    },
    [
      hasGeneratedSchedules,
      selectionReady,
      selectedCourseCodes.length,
      selectedCourses,
      scheduleFilters,
    ],
  );
  const activeSchedule = generatedSchedules[activeScheduleIndex] ?? [];
  const courseSearchResults = (
    searchQuery.trim()
      ? debouncedQuery === searchQuery
        ? searchResults
        : []
      : availableCourses
  )
    .filter(
      (course) =>
        (course.sections?.length ?? 0) > 0 &&
        !selectedCourseCodes.includes(course.id),
    )
    .slice(0, 15);

  const changeSemester = (semester: string) => {
    setHasGeneratedSchedules(false);
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
    setHasGeneratedSchedules(false);
    setSelectedCourseCodes((current) =>
      current.includes(courseId)
        ? current.filter((selectedId) => selectedId !== courseId)
        : [...current, courseId],
    );
    setActiveScheduleIndex(0);
  };

  const addGeneratedCourse = (courseId: string) => {
    setHasGeneratedSchedules(false);
    setSelectedCourseCodes((current) =>
      current.includes(courseId) ? current : [...current, courseId],
    );
    setSearchQuery("");
    setDebouncedQuery("");
    setActiveScheduleIndex(0);
  };

  const toggleFreeDay = (dayKey: string) => {
    setHasGeneratedSchedules(false);
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
    setHasGeneratedSchedules(false);
    setScheduleFilters((current) => {
      const pinnedSections = { ...current.pinnedSections };
      if (section) pinnedSections[courseCode] = section;
      else delete pinnedSections[courseCode];
      return { ...current, pinnedSections };
    });
    setActiveScheduleIndex(0);
  };

  const toggleExcludedSection = (courseCode: string, section: string) => {
    setHasGeneratedSchedules(false);
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
    const days = block.days
      .map((dayKey) => DAY_NAME_BY_KEY.get(normalizeDayKey(dayKey) ?? dayKey))
      .filter((day): day is string => Boolean(day));
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
        <div className="flex flex-col md:flex-row gap-2 sm:gap-4 mb-3 sm:mb-6 items-center justify-between">
          <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-2xl w-full md:w-auto">
            <button
              type="button"
              aria-pressed={activeTab === "visual"}
              onClick={() => setActiveTab("visual")}
              className={cn(
                "min-h-10 flex-1 md:flex-none flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-black transition-all",
                activeTab === "visual"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:text-slate-400",
              )}
            >
              <Layout size={18} />
              الجدول البصري
            </button>
            <button
              type="button"
              aria-pressed={activeTab === "edit"}
              onClick={() => setActiveTab("edit")}
              className={cn(
                "min-h-10 flex-1 md:flex-none flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-black transition-all",
                activeTab === "edit"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:text-slate-400",
              )}
            >
              <Edit3 size={18} />
              تعبئة البيانات
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
            <label
              htmlFor="weekly-schedule-semester"
              className="text-xs font-black text-gray-500 dark:text-slate-400 whitespace-nowrap"
            >
              الفصل:
            </label>
            <select
              id="weekly-schedule-semester"
              value={selectedSemester}
              onChange={(e) => changeSemester(e.target.value)}
              className="flex-1 md:w-48 p-2 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-xl font-bold text-sm focus:border-blue-500 outline-none transition-all"
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
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-gray-50/50 dark:bg-slate-900/30 rounded-3xl border-2 border-dashed border-gray-100 dark:border-slate-800">
            <Calendar
              size={64}
              className="text-gray-300 dark:text-slate-700 mb-4 opacity-50"
            />
            <h3 className="text-xl font-black text-gray-400 dark:text-slate-600">
              لا توجد مواد مخططة لهذا الفصل
            </h3>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-2 font-bold">
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
                  className="group bg-white dark:bg-slate-800/50 border-2 border-gray-100 dark:border-slate-800 rounded-3xl p-5 hover:border-blue-200 dark:hover:border-blue-900/30 transition-all shadow-sm"
                >
                  {!weeklySchedule[selectedSemester]?.[course.id] &&
                    !getSuggestedManualEntry(course.id) && (
                      <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                        لا تتوفر بيانات شعبة لهذا المساق؛ أدخل الأوقات والأيام
                        يدوياً.
                      </p>
                    )}
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="md:w-1/3">
                      <div className="mb-4">
                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md mb-2 inline-block">
                          {course.id}
                        </span>
                        <h3 className="text-lg font-black text-gray-800 dark:text-slate-100 leading-tight">
                          {course.name}
                        </h3>
                        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mt-1">
                          {course.credits} ساعات معتمدة
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 dark:text-slate-400">
                          أيام المحاضرات:
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {EDIT_DAYS.map((day) => (
                            <button
                              type="button"
                              aria-label={`محاضرة ${course.name} يوم ${day}`}
                              aria-pressed={entry.days?.includes(day) ?? false}
                              key={day}
                              onClick={() => toggleDay(course.id, day)}
                              className={cn(
                                "min-h-10 px-2.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-all border-2",
                                entry.days?.includes(day)
                                  ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none"
                                  : "bg-gray-50 dark:bg-slate-900 text-gray-400 border-gray-100 dark:border-slate-800 hover:border-blue-200",
                              )}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-gray-400 px-1">
                            وقت البدء
                          </label>
                          <div className="relative">
                            <Clock
                              size={16}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300"
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
                              className="w-full pr-10 pl-3 py-2.5 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:border-blue-500 outline-none transition-all"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-gray-400 px-1">
                            وقت الانتهاء
                          </label>
                          <div className="relative">
                            <Clock
                              size={16}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300"
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
                              className="w-full pr-10 pl-3 py-2.5 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:border-blue-500 outline-none transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-gray-400 px-1">
                            الدكتور / القاعة
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                              <User
                                size={14}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300"
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
                                className="w-full pr-9 pl-3 py-2.5 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-xl text-xs font-bold focus:border-blue-500 outline-none transition-all"
                              />
                            </div>
                            <div className="relative">
                              <MapPin
                                size={14}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300"
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
                                className="w-full pr-9 pl-3 py-2.5 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-xl text-xs font-bold focus:border-blue-500 outline-none transition-all"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-gray-400 px-1">
                            رقم الشعبة
                          </label>
                          <div className="relative">
                            <Hash
                              size={16}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300"
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
                              className="w-full pr-10 pl-3 py-2.5 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:border-blue-500 outline-none transition-all"
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
              className="shrink-0 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 p-3"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white dark:bg-slate-800 p-2.5 text-xs border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold">آخر تحديث للشعب من الجامعة:</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                    {syncInfo?.lastSyncTime
                      ? formatArabicSyncTime(syncInfo.lastSyncTime)
                      : "اليوم"}
                  </span>
                  {syncInfo?.totalSections ? (
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] hidden sm:inline">
                      ({syncInfo.totalCourses} مساق • {syncInfo.totalSections} شعبة)
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncRefreshing}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    size={12}
                    className={isSyncRefreshing ? "animate-spin" : ""}
                  />
                  <span>{isSyncRefreshing ? "جاري التحديث..." : "تحديث فوري للشعب"}</span>
                </button>
              </div>

              <h3 className="mb-2 text-sm font-black text-gray-700 dark:text-slate-200">
                ابحث عن مساق لإضافته
              </h3>
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
                  Boolean(searchQuery.trim() && debouncedQuery !== searchQuery)
                }
                autoComplete="off"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="اكتب اسم المساق أو رمزه..."
                disabled={isCourseLoading || Boolean(courseLoadError)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold outline-none transition-colors focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
              />
              {isCourseLoading && (
                <p
                  role="status"
                  className="mt-2 text-xs font-bold text-gray-500"
                >
                  جارٍ تحميل المساقات...
                </p>
              )}
              {isOffline && (
                <div
                  role="status"
                  className="mt-2 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="font-bold">
                      تعذر الاتصال بخادم المساقات. يتم استخدام البيانات المخزنة محلياً في وضع عدم الاتصال.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      clearCoursesCache();
                      setCourseLoadAttempt((attempt) => attempt + 1);
                    }}
                    className="font-black text-amber-800 underline hover:text-amber-950 dark:text-amber-200"
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
                  <p className="font-bold text-red-700 dark:text-red-300">
                    {courseLoadError}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      clearCoursesCache();
                      setCourseLoadAttempt((attempt) => attempt + 1);
                    }}
                    className="min-h-10 rounded-lg px-3 font-black text-blue-700 underline dark:text-blue-300"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              )}
              {searchError && (
                <p
                  role="alert"
                  className="mt-2 text-xs font-bold text-red-700 dark:text-red-300"
                >
                  {searchError}
                </p>
              )}
              {(isSearching ||
                (searchQuery.trim() && debouncedQuery !== searchQuery)) && (
                <p
                  role="status"
                  className="mt-2 text-xs font-bold text-gray-500"
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
                  <p className="mt-2 text-xs font-bold text-gray-500 dark:text-slate-400">
                    لا توجد مساقات مطابقة متاحة للاختيار.
                  </p>
                )}
              {courseSearchResults.length > 0 && (
                <ul
                  id="weekly-course-search-results"
                  role="list"
                  aria-label="نتائج البحث عن المساقات"
                  className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"
                >
                  {courseSearchResults.map((course) => (
                    <li key={course.id}>
                      <button
                        type="button"
                        onClick={() => addGeneratedCourse(course.id)}
                        className="min-h-12 w-full rounded-xl bg-white p-3 text-right text-xs transition-colors hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                      >
                        <span className="block font-black text-gray-800 dark:text-slate-100">
                          {course.name}
                        </span>
                        <span className="text-gray-500 dark:text-slate-400">
                          {course.id} · {course.sections?.length ?? 0} شعبة
                          {semesterCourses.some(
                            (planned) => planned.id === course.id,
                          )
                            ? " · ضمن خطة الفصل"
                            : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <ul
                className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
                aria-label="المساقات المختارة"
              >
                {selectedCourseCodes.map((code) => {
                  const course =
                    selectedCourses.find((item) => item.id === code) ??
                    availableCourses.find((item) => item.id === code);
                  return (
                    <li
                      key={code}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-blue-200 bg-white p-3 text-xs dark:border-blue-900/60 dark:bg-slate-800"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-black text-blue-900 dark:text-blue-100">
                          {course?.name ?? code}
                        </span>
                        <span className="text-gray-500 dark:text-slate-400">
                          {code} · {course?.sections?.length ?? 0} شعبة
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label={`حذف ${course?.name ?? code} من المساقات المختارة`}
                        onClick={() => toggleGeneratedCourse(code)}
                        className="min-h-8 min-w-8 rounded-lg hover:bg-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 dark:hover:bg-blue-800"
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
              {selectedCourseCodes.length > 0 && isSelectionLoading && (
                <p
                  role="status"
                  className="mt-2 text-xs font-bold text-gray-500"
                >
                  جارٍ تحميل الشعب وأوقاتها...
                </p>
              )}
              {selectionError && (
                <div
                  role="alert"
                  className="mt-2 flex flex-wrap items-center gap-3 text-xs"
                >
                  <p className="font-bold text-red-700 dark:text-red-300">
                    {selectionError}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectionLoadAttempt((attempt) => attempt + 1)
                    }
                    className="min-h-10 rounded-lg px-3 font-black text-blue-700 underline dark:text-blue-300"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              )}
              {semesterCourses.some(
                (course) =>
                  !availableCourses.some(
                    (catalogCourse) =>
                      catalogCourse.id === course.id &&
                      (catalogCourse.sections?.length ?? 0) > 0,
                  ),
              ) && (
                <p className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                  بعض مواد الفصل المخططة لا تتوفر لها شعب في خدمة المساقات.
                </p>
              )}

              {selectedCourseCodes.length > 0 && selectionReady && (
                <section
                  aria-label="قيود الجدول المقترح"
                  className="mt-4 grid gap-4 border-t border-gray-200 pt-4 dark:border-slate-700"
                >
                  <h3 className="text-sm font-black text-gray-700 dark:text-slate-200">
                    تخصيص اقتراحات الجدول
                  </h3>

                  <fieldset className="min-w-0">
                    <legend className="mb-2 text-xs font-black text-gray-600 dark:text-slate-300">
                      أيام أريدها خالية
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {FILTER_DAY_OPTIONS.map(({ key, label }) => {
                        const checked =
                          scheduleFilters.freeDays?.includes(key) ?? false;
                        return (
                          <label
                            key={key}
                            className={cn(
                              "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors",
                              checked
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-gray-200 bg-white text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleFreeDay(key)}
                              className="accent-blue-700"
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <label
                        htmlFor="weekly-time-preference"
                        className="text-xs font-black text-gray-600 dark:text-slate-300"
                      >
                        ترتيب الجداول حسب الوقت
                      </label>
                      <select
                        id="weekly-time-preference"
                        value={scheduleFilters.timePreference ?? ""}
                        onChange={(event) => {
                          setHasGeneratedSchedules(false);
                          setScheduleFilters((current) => ({
                            ...current,
                            timePreference: event.target.value as
                              "morning" | "late" | "",
                          }));
                          setActiveScheduleIndex(0);
                        }}
                        className="min-h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">بدون تفضيل</option>
                        <option value="morning">الأوقات الصباحية أولاً</option>
                        <option value="late">الأوقات المتأخرة أولاً</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <label
                        htmlFor="weekly-max-gap"
                        className="text-xs font-black text-gray-600 dark:text-slate-300"
                      >
                        أقصى فراغ بين المحاضرات في اليوم
                      </label>
                      <select
                        id="weekly-max-gap"
                        value={scheduleFilters.maxGap ?? ""}
                        onChange={(event) => {
                          setHasGeneratedSchedules(false);
                          setScheduleFilters((current) => ({
                            ...current,
                            maxGap:
                              event.target.value === ""
                                ? null
                                : Number(event.target.value),
                          }));
                          setActiveScheduleIndex(0);
                        }}
                        className="min-h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">بدون حد</option>
                        <option value="0">بدون فراغ</option>
                        <option value="1">ساعة واحدة</option>
                        <option value="2">ساعتان</option>
                        <option value="3">3 ساعات</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <h4 className="text-xs font-black text-gray-600 dark:text-slate-300">
                      استبعاد الشعب أو تثبيت شعبة
                    </h4>
                    {selectedCourses.map((course) => {
                      const sections = (course.sections ?? []).filter(
                        (section) =>
                          !String(section.sec).includes("مختلط") &&
                          section.blocks.length > 0,
                      );
                      if (sections.length === 0) return null;
                      const excluded = new Set(
                        scheduleFilters.excludedSections?.[course.id] ?? [],
                      );
                      return (
                        <fieldset
                          key={course.id}
                          className="grid min-w-0 gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/70"
                        >
                          <legend className="px-1 text-xs font-black text-gray-800 dark:text-slate-100">
                            {course.name} ({course.id})
                          </legend>
                          <label
                            htmlFor={`weekly-pinned-${course.id}`}
                            className="text-xs font-bold text-gray-600 dark:text-slate-300"
                          >
                            الشعبة المثبتة
                          </label>
                          <select
                            id={`weekly-pinned-${course.id}`}
                            value={
                              scheduleFilters.pinnedSections?.[course.id] ?? ""
                            }
                            onChange={(event) => {
                              const section = event.target.value;
                              setHasGeneratedSchedules(false);
                              setScheduleFilters((current) => {
                                const pinnedSections = {
                                  ...current.pinnedSections,
                                };
                                const excludedSections = {
                                  ...current.excludedSections,
                                };
                                if (section) {
                                  pinnedSections[course.id] = section;
                                  excludedSections[course.id] = (
                                    excludedSections[course.id] ?? []
                                  ).filter((item) => item !== section);
                                  if (!excludedSections[course.id].length) {
                                    delete excludedSections[course.id];
                                  }
                                } else {
                                  delete pinnedSections[course.id];
                                }
                                return {
                                  ...current,
                                  pinnedSections,
                                  excludedSections,
                                };
                              });
                              setActiveScheduleIndex(0);
                            }}
                            className="min-h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900"
                          >
                            <option value="">أي شعبة متاحة</option>
                            {sections.map((section) => (
                              <option key={section.sec} value={section.sec}>
                                {section.sec} ·{" "}
                                {section.blocks
                                  .map((block) =>
                                    block.days
                                      .map((d) => DAY_NAME_BY_KEY.get(normalizeDayKey(d) ?? d) ?? d)
                                      .join("، "),
                                  )
                                  .join(" / ")}
                              </option>
                            ))}
                          </select>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {sections.map((section) => (
                              <label
                                key={section.sec}
                                className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-gray-700 dark:text-slate-200"
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
                                  className="accent-blue-700"
                                />
                                استبعاد شعبة {section.sec}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      );
                    })}
                  </div>
                </section>
              )}
            </section>

            <nav
              aria-label="التنقل بين الجداول المقترحة"
              className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-gray-100 dark:border-slate-800 p-3"
            >
              <p
                aria-live="polite"
                className="text-xs sm:text-sm font-black text-gray-700 dark:text-slate-200 text-center sm:text-right"
              >
                {generatedSchedules.length
                  ? `جدول ${activeScheduleIndex + 1} من أصل ${generatedSchedules.length} خالي من التعارض`
                  : !selectionReady || isSelectionLoading
                    ? "جارٍ تجهيز بيانات الشعب..."
                    : selectedCourseCodes.length
                      ? hasGeneratedSchedules
                        ? "لا يوجد جدول خالٍ من التعارض للمواد المختارة"
                        : "حدّد المواد والفلاتر ثم ولّد الجداول المقترحة"
                      : "اختر مادة من الكتالوج لعرض الجداول المقترحة"}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={activeScheduleIndex <= 0}
                  onClick={() => setActiveScheduleIndex((index) => index - 1)}
                  className="min-h-11 flex-1 sm:flex-none rounded-xl border border-gray-200 dark:border-slate-700 px-4 text-xs sm:text-sm font-black disabled:opacity-40 cursor-pointer"
                >
                  السابق
                </button>
                <button
                  type="button"
                  disabled={
                    selectedCourseCodes.length === 0 ||
                    !selectionReady ||
                    isSelectionLoading
                  }
                  onClick={() => {
                    setActiveScheduleIndex(0);
                    setHasGeneratedSchedules(true);
                  }}
                  className="min-h-11 flex-1 sm:flex-none rounded-xl bg-blue-600 px-4 text-xs sm:text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  توليد الجداول
                </button>
                <button
                  type="button"
                  disabled={activeScheduleIndex >= generatedSchedules.length - 1}
                  onClick={() => setActiveScheduleIndex((index) => index + 1)}
                  className="min-h-11 flex-1 sm:flex-none rounded-xl border border-gray-200 dark:border-slate-700 px-4 text-xs sm:text-sm font-black disabled:opacity-40 cursor-pointer"
                >
                  التالي
                </button>
              </div>
            </nav>

            <section
              aria-label="الشبكة الأسبوعية"
              className="shrink-0 overflow-hidden bg-gray-50 dark:bg-slate-900/50 rounded-3xl border-2 border-gray-100 dark:border-slate-800"
            >
              <div className="overflow-auto custom-scrollbar">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-[3.5rem_repeat(6,minmax(0,1fr))] border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div aria-hidden="true" className="sticky right-0 z-10 bg-white dark:bg-slate-900 border-l border-gray-100 dark:border-slate-800" />
                    {DAYS.map((day) => (
                      <div
                        key={day}
                        className="border-r border-gray-100 dark:border-slate-800 px-1 py-3 text-center text-xs font-black text-gray-600 dark:text-slate-400"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-[3.5rem_repeat(6,minmax(0,1fr))]">
                    <div className="sticky right-0 z-10 bg-white dark:bg-slate-900 border-l border-gray-100 dark:border-slate-800">
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          className="h-15 border-b border-gray-100 dark:border-slate-800 px-1 pt-1 text-center text-[10px] font-black text-gray-400"
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
                        className="relative border-r border-gray-100 dark:border-slate-800"
                      >
                        {HOURS.map((hour) => (
                          <div
                            key={hour}
                            className="h-15 border-b border-gray-100/70 dark:border-slate-800/60"
                          />
                        ))}
                        {activeSchedule.flatMap((item) =>
                          item.section.blocks
                            .filter(
                              (block) =>
                                block.days.some((d) => (normalizeDayKey(d) ?? d) === dayKey) &&
                                block.end > 8 &&
                                block.start < 16,
                            )
                            .map((block, blockIndex) => {
                              const start = Math.max(block.start, 8);
                              const end = Math.min(block.end, 16);
                              if (end <= start) return null;
                              const top = `${((start - 8) / 8) * 100}%`;
                              const height = `${((end - start) / 8) * 100}%`;
                              return (
                                <article
                                  key={`${item.courseCode}-${dayKey}-${blockIndex}`}
                                  style={{ top, height }}
                                  className="absolute inset-x-1 z-[1] overflow-hidden rounded-lg border border-blue-300 bg-blue-500/15 p-1 text-[9px] text-blue-900 dark:border-blue-800 dark:bg-blue-400/15 dark:text-blue-100"
                                  aria-label={`${item.courseName}، شعبة ${item.section.sec}، ${DAY_NAME_BY_KEY.get(dayKey)}، ${formatScheduleTime(block.start)} إلى ${formatScheduleTime(block.end)}، ${item.section.room ?? "قاعة غير محددة"}، ${item.section.instructor ?? "مدرس غير محدد"}`}
                                >
                                  <h4 className="font-black leading-tight">
                                    {item.courseName}
                                  </h4>
                                  <p>شعبة {item.section.sec}</p>
                                  <p>
                                    {formatScheduleTime(block.start)}–
                                    {formatScheduleTime(block.end)}
                                  </p>
                                  <p>{item.section.room ?? "قاعة غير محددة"}</p>
                                  <p>
                                    {item.section.instructor ?? "مدرس غير محدد"}
                                  </p>
                                </article>
                              );
                            }),
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </section>
        )}

        {/* Footer Info */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center text-[10px] font-bold text-gray-400">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div> جدولك
              مرتب
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div> يتم
              الحفظ تلقائياً
            </span>
          </div>
          <p>يمكنك التبديل بين الأقسام من الأعلى</p>
        </div>
      </div>
    </ErrorBoundary>
  </BaseModal>
);
};
