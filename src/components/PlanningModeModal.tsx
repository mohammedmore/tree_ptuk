import React from "react";
import {
  X,
  CalendarDays,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CircleCheckBig,
  Search,
  AlertTriangle,
} from "lucide-react";
import { cn } from "../utils";
import type { Course } from "../data";
import { categoryRequirements } from "../data";
import { SEMESTERS } from "../constants";
import {
  isCourseAvailable as defaultIsCourseAvailable,
  calculateDegreeCredits,
} from "../courseProgress";
import {
  getSemesterType,
  isCourseAvailableInSemester,
  formatOfferings,
} from "../courseOfferings";

interface PlanningModeModalProps {
  isPlanningModeOpen: boolean;
  onClose: () => void;
  currentPlanningSemester: string | null;
  setCurrentPlanningSemester: (semester: string | null) => void;
  completedCourses: Set<string>;
  plannedCourses: Record<string, string>;
  setPlannedCourses: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  courses: Course[];
  isCourseAvailable?: (
    course: Course,
    completed: ReadonlySet<string>,
    allCourses?: readonly Course[],
    options?: import("../courseProgress").CourseAvailabilityOptions,
  ) => boolean;
  completedCreditsPerCategory: Record<string, number>;
  hasHighGpa: boolean;
  setHasHighGpa: React.Dispatch<React.SetStateAction<boolean>>;
  expandedPlanningCategories: Record<string, boolean>;
  setExpandedPlanningCategories: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  setIsPlannerOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const PlanningModeModal: React.FC<PlanningModeModalProps> = ({
  isPlanningModeOpen,
  onClose,
  currentPlanningSemester,
  setCurrentPlanningSemester,
  completedCourses,
  plannedCourses,
  setPlannedCourses,
  courses,
  isCourseAvailable,
  completedCreditsPerCategory,
  hasHighGpa,
  setHasHighGpa,
  expandedPlanningCategories,
  setExpandedPlanningCategories,
  setIsPlannerOpen,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [hourFilter, setHourFilter] = React.useState<number | null>(null);

  const coursesById = React.useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );
  const currentSemesterIndex = currentPlanningSemester
    ? SEMESTERS.indexOf(currentPlanningSemester)
    : -1;
  const selectedSemester =
    currentSemesterIndex >= 0 ? SEMESTERS[currentSemesterIndex] : null;

  const allPrev = React.useMemo(() => {
    const prev = new Set(completedCourses);
    if (currentSemesterIndex >= 0) {
      Object.entries(plannedCourses).forEach(([id, semester]) => {
        const plannedSemesterIndex = SEMESTERS.indexOf(semester);
        if (
          plannedSemesterIndex >= 0 &&
          plannedSemesterIndex < currentSemesterIndex
        ) {
          prev.add(id);
        }
      });
    }
    return prev;
  }, [completedCourses, plannedCourses, currentSemesterIndex]);

  const currentSemesterPlannedCourses = React.useMemo(
    () =>
      new Set(
        Object.entries(plannedCourses)
          .filter(([, semester]) => semester === currentPlanningSemester)
          .map(([courseId]) => courseId),
      ),
    [plannedCourses, currentPlanningSemester],
  );

  const creditsThroughCurrentSemester = React.useMemo(() => {
    const counts = { ...completedCreditsPerCategory };
    if (currentSemesterIndex < 0) return counts;

    Object.entries(plannedCourses).forEach(([courseId, semester]) => {
      const plannedSemesterIndex = SEMESTERS.indexOf(semester);
      if (
        completedCourses.has(courseId) ||
        plannedSemesterIndex < 0 ||
        plannedSemesterIndex > currentSemesterIndex
      )
        return;
      const course = coursesById.get(courseId);
      if (course)
        counts[course.category] =
          (counts[course.category] || 0) + course.credits;
    });
    return counts;
  }, [
    completedCreditsPerCategory,
    completedCourses,
    plannedCourses,
    currentSemesterIndex,
    coursesById,
  ]);

  const checkCourseAvailability = isCourseAvailable || defaultIsCourseAvailable;

  const cumulativeEarnedCredits = React.useMemo(() => {
    return calculateDegreeCredits(courses, allPrev);
  }, [courses, allPrev]);

  const available = React.useMemo(() => {
    if (!selectedSemester) return [];
    return courses.filter((c) => {
      const isComp = completedCourses.has(c.id);
      const plannedSemester = plannedCourses[c.id];
      const plannedSemesterIndex = plannedSemester
        ? SEMESTERS.indexOf(plannedSemester)
        : -1;
      const isPlannedInPrev =
        plannedSemesterIndex >= 0 &&
        plannedSemesterIndex < currentSemesterIndex;
      const isPlannedNow = plannedSemester === selectedSemester;
      if (isComp || isPlannedInPrev || isPlannedNow) return false;
      return checkCourseAvailability(c, allPrev, courses, {
        currentPlannedCourses: currentSemesterPlannedCourses,
        cumulativeEarnedCredits,
        coreqMode: "strict",
      });
    });
  }, [
    selectedSemester,
    currentSemesterIndex,
    completedCourses,
    plannedCourses,
    courses,
    checkCourseAvailability,
    allPrev,
    creditsThroughCurrentSemester,
    currentSemesterPlannedCourses,
    cumulativeEarnedCredits,
  ]);

  const groupedAvailable = React.useMemo(() => {
    return available
      .filter(
        (c) =>
          (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.id.toLowerCase().includes(searchQuery.toLowerCase())) &&
          (!hourFilter || c.credits === hourFilter),
      )
      .reduce(
        (acc, c) => {
          if (!acc[c.category]) acc[c.category] = [];
          acc[c.category].push(c);
          return acc;
        },
        {} as Record<string, Course[]>,
      );
  }, [available, searchQuery, hourFilter]);

  const currentSemesterPlannedCredits = React.useMemo(() => {
    if (!selectedSemester) return 0;
    return Object.entries(plannedCourses)
      .filter(([, s]) => s === selectedSemester)
      .reduce((sum, [id]) => sum + (coursesById.get(id)?.credits ?? 0), 0);
  }, [plannedCourses, selectedSemester, coursesById]);

  if (!isPlanningModeOpen) return null;

  const isSummer = selectedSemester?.includes("صيفي") ?? false;
  const creditLimit = isSummer ? (hasHighGpa ? 10 : 9) : hasHighGpa ? 21 : 18;
  const exceededCreditLimit = currentSemesterPlannedCredits > creditLimit;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="planning-mode-title"
        className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-0 w-full max-w-5xl shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden border border-gray-100 dark:border-slate-700 flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[90vh]"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-orange-600 via-orange-500 to-yellow-500"></div>

        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-950/20 shrink-0">
          <h2
            id="planning-mode-title"
            className="text-lg sm:text-xl font-black text-gray-800 dark:text-slate-100 flex items-center gap-2 sm:gap-3"
          >
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-white shadow-lg shadow-orange-200 dark:shadow-none">
              <CalendarDays size={22} />
            </div>
            <span>
              {selectedSemester ? `تخطيط ${selectedSemester}` : "بدء التخطيط "}
            </span>
          </h2>
          <button
            type="button"
            aria-label="إغلاق وضع التخطيط"
            onClick={onClose}
            className="min-h-11 min-w-11 flex items-center justify-center p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-3 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
          {currentSemesterIndex < 0 ? (
            <div className="space-y-6">
              <div className="p-4 bg-orange-50 dark:bg-orange-500/10 rounded-2xl border border-orange-100 dark:border-orange-500/30">
                <p className="text-sm font-bold text-orange-800 dark:text-orange-300 leading-relaxed">
                  أهلاً بك في وضع التخطيط . يرجى تحديد الفصل الدراسي القادم الذي
                  ترغب في البدء بتخطيط مواده:
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SEMESTERS.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setCurrentPlanningSemester(s)}
                    className="text-right p-4 rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-orange-500 transition-all text-xs font-black dark:text-slate-200 shadow-sm"
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
                <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={16}
                    />
                    <input
                      aria-label="ابحث في المواد المتاحة"
                      type="text"
                      placeholder="ابحث في المواد المتاحة..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pr-10 pl-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 outline-none dark:text-slate-200"
                    />
                  </div>

                  {/* Hour Filter */}
                  <div className="flex gap-2 p-1.5 bg-gray-50/50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-700/50">
                    <button
                      type="button"
                      aria-pressed={hourFilter === null}
                      onClick={() => setHourFilter(null)}
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all",
                        !hourFilter
                          ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm"
                          : "text-gray-400 hover:text-gray-600 dark:hover:text-slate-300",
                      )}
                    >
                      الكل
                    </button>
                    <button
                      type="button"
                      aria-pressed={hourFilter === 3}
                      onClick={() => setHourFilter(3)}
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all",
                        hourFilter === 3
                          ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm"
                          : "text-gray-400 hover:text-gray-600 dark:hover:text-slate-300",
                      )}
                    >
                      3 ساعات
                    </button>
                    <button
                      type="button"
                      aria-pressed={hourFilter === 1}
                      onClick={() => setHourFilter(1)}
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all",
                        hourFilter === 1
                          ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm"
                          : "text-gray-400 hover:text-gray-600 dark:hover:text-slate-300",
                      )}
                    >
                      ساعة (مختبر)
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-gray-500 dark:text-slate-400 flex items-center gap-2">
                      <BookOpen size={14} /> المواد المتاحة هذا الفصل
                    </h3>
                    {Object.keys(groupedAvailable).length > 0 && (
                      <button
                        type="button"
                        aria-expanded={Object.values(
                          expandedPlanningCategories,
                        ).some((v) => v === true)}
                        onClick={() => {
                          const isAnyOpen = Object.values(
                            expandedPlanningCategories,
                          ).some((v) => v === true);
                          const newState: Record<string, boolean> = {};
                          if (!isAnyOpen)
                            Object.keys(groupedAvailable).forEach((cat) => {
                              newState[cat] = true;
                            });
                          setExpandedPlanningCategories(newState);
                        }}
                        className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        {Object.values(expandedPlanningCategories).some(
                          (v) => v === true,
                        )
                          ? "طي الكل"
                          : "فرد الكل"}
                      </button>
                    )}
                  </div>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
                    {Object.keys(groupedAvailable).length === 0 ? (
                      available.length > 0 &&
                      (searchQuery || hourFilter !== null) ? (
                        <div className="text-center py-10 text-xs font-bold text-gray-400">
                          لا توجد مواد تطابق معايير البحث
                        </div>
                      ) : (
                        <div className="text-center py-10 text-xs font-bold text-gray-400">
                          لا توجد مواد متاحة حالياً للجدولة
                        </div>
                      )
                    ) : (
                      (
                        Object.entries(groupedAvailable) as [string, Course[]][]
                      ).map(([category, items]) => {
                        const isExpanded =
                          expandedPlanningCategories[category] === true; // Default to closed
                        const categoryPanelId = `planning-category-${encodeURIComponent(category)}`;
                        const currentCatCredits =
                          creditsThroughCurrentSemester[category] || 0;
                        const requiredCatCredits =
                          categoryRequirements[category] || 0;
                        const isExceeded =
                          currentCatCredits > requiredCatCredits;

                        return (
                          <div
                            key={category}
                            className={cn(
                              "border rounded-2xl overflow-hidden shadow-sm transition-all",
                              isExceeded
                                ? "border-red-300 bg-red-50/20"
                                : "border-gray-100 dark:border-slate-700",
                            )}
                          >
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              aria-controls={categoryPanelId}
                              onClick={() =>
                                setExpandedPlanningCategories((prev) => ({
                                  ...prev,
                                  [category]: !isExpanded,
                                }))
                              }
                              className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/80 hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex flex-col items-start gap-1">
                                <span className="text-[11px] font-black text-gray-700 dark:text-slate-200">
                                  {category} ({items.length})
                                </span>
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full transition-all",
                                        isExceeded
                                          ? "bg-red-500"
                                          : currentCatCredits >=
                                              requiredCatCredits
                                            ? "bg-emerald-500"
                                            : "bg-blue-500",
                                      )}
                                      style={{
                                        width: `${Math.min(100, (currentCatCredits / requiredCatCredits) * 100)}%`,
                                      }}
                                    ></div>
                                  </div>
                                  <span
                                    className={cn(
                                      "text-[9px] font-bold",
                                      isExceeded
                                        ? "text-red-600"
                                        : "text-gray-400",
                                    )}
                                  >
                                    {currentCatCredits} / {requiredCatCredits} س
                                  </span>
                                </div>
                              </div>
                              {isExpanded ? (
                                <ChevronUp size={14} />
                              ) : (
                                <ChevronDown size={14} />
                              )}
                            </button>

                            {isExpanded && (
                              <div
                                id={categoryPanelId}
                                className="p-2 bg-white dark:bg-slate-900/50 space-y-1.5 animate-in slide-in-from-top-1 duration-200"
                              >
                                {items.map((c) => {
                                  const alreadyPlannedSomewhere =
                                    !!plannedCourses[c.id];
                                  const semesterType = getSemesterType(
                                    selectedSemester ?? "",
                                  );
                                  const isNotAvailableInSemester =
                                    c.availableSemesters &&
                                    (semesterType === null ||
                                      !isCourseAvailableInSemester(
                                        c.id,
                                        semesterType,
                                      ));

                                  return (
                                    <button
                                      type="button"
                                      key={c.id}
                                      disabled={
                                        alreadyPlannedSomewhere ||
                                        Boolean(isNotAvailableInSemester)
                                      }
                                      onClick={() => {
                                        if (selectedSemester) {
                                          setPlannedCourses((prev) => ({
                                            ...prev,
                                            [c.id]: selectedSemester,
                                          }));
                                        }
                                      }}
                                      className={cn(
                                        "w-full text-right p-2.5 bg-white dark:bg-slate-800 border rounded-xl hover:border-blue-400 hover:shadow-sm transition-all flex justify-between items-center group",
                                        (alreadyPlannedSomewhere ||
                                          isNotAvailableInSemester) &&
                                          "opacity-40 cursor-not-allowed grayscale",
                                        isNotAvailableInSemester &&
                                          "border-red-300 dark:border-red-700/50 bg-red-50/30 dark:bg-red-950/20 opacity-60",
                                      )}
                                      title={
                                        isNotAvailableInSemester
                                          ? `⚠️ هذه المادة غير متاحة في ${selectedSemester}`
                                          : ""
                                      }
                                    >
                                      <div className="flex flex-col items-start gap-0.5">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[11px] font-bold text-gray-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors">
                                            {c.name}
                                          </span>
                                          {alreadyPlannedSomewhere && (
                                            <span className="text-[7px] bg-gray-100 dark:bg-slate-700 text-gray-400 px-1 rounded">
                                              مجدولة مسبقاً
                                            </span>
                                          )}
                                          {isNotAvailableInSemester && (
                                            <span className="text-[7px] bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-semibold">
                                              <AlertTriangle size={8} /> غير
                                              متاحة
                                            </span>
                                          )}
                                        </div>
                                        {c.coPrerequisites &&
                                          c.coPrerequisites.length > 0 && (
                                            <span className="text-[8px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-md">
                                              {c.coPrerequisites
                                                .map(
                                                  (cpId) =>
                                                    coursesById.get(cpId)
                                                      ?.name || cpId,
                                                )
                                                .join(", ")}
                                            </span>
                                          )}
                                        {c.availableSemesters && (
                                          <span className="text-[8px] font-semibold text-purple-600 dark:text-purple-400">
                                            💡 متاح:{" "}
                                            {formatOfferings(
                                              c.availableSemesters,
                                            )}
                                          </span>
                                        )}
                                        <span className="text-[9px] font-mono text-gray-400">
                                          {c.id}
                                        </span>
                                      </div>
                                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">
                                        {c.credits} س
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                    <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 leading-relaxed">
                      💡 اضغط على اسم المجموعة لطيها أو فردها. يتم عرض المواد
                      التي حققت متطلباتها السابقة فقط.
                    </p>
                  </div>
                </div>

                {/* Column 2: Selected in Current Semester */}
                <div className="bg-gray-50 dark:bg-slate-800/40 rounded-3xl p-5 flex flex-col gap-4 border border-gray-100 dark:border-slate-700">
                  <h3 className="text-sm font-black text-gray-800 dark:text-slate-100">
                    المواد المجدولة في هذا الفصل:
                  </h3>
                  <div className="flex-1 space-y-2 min-h-[100px]">
                    {Object.entries(plannedCourses)
                      .filter(([, semester]) => semester === selectedSemester)
                      .map(([id]) => {
                        const c = coursesById.get(id);
                        return (
                          <div
                            key={id}
                            className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-gray-100 dark:border-slate-700 flex justify-between items-center shadow-sm"
                          >
                            <span className="text-xs font-bold text-gray-700 dark:text-slate-300 truncate pl-2">
                              {c?.name ?? id}
                            </span>
                            <button
                              type="button"
                              aria-label={`إزالة ${c?.name ?? id} من الفصل`}
                              onClick={() =>
                                setPlannedCourses((prev) => {
                                  const n = { ...prev };
                                  delete n[id];
                                  return n;
                                })
                              }
                              className="text-red-400 hover:text-red-600 p-1"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-slate-700 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-gray-500">
                        مجموع الساعات:
                      </span>
                      <span
                        className={cn(
                          "text-lg font-black",
                          exceededCreditLimit
                            ? "text-red-600 animate-pulse"
                            : "text-blue-600",
                        )}
                      >
                        {currentSemesterPlannedCredits} / {creditLimit}
                      </span>
                    </div>

                    {exceededCreditLimit && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/50">
                        <p className="text-[10px] font-black text-red-700 dark:text-red-400 leading-relaxed mb-2">
                          ⚠️ تنبيه: لقد تجاوزت الحد المسموح به لهذا الفصل.
                        </p>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            aria-label="معدلي التراكمي عالٍ ويسمح بزيادة الحمولة"
                            type="checkbox"
                            checked={hasHighGpa}
                            onChange={(e) => setHasHighGpa(e.target.checked)}
                            className="w-3.5 h-3.5 rounded"
                          />
                          <span className="text-[10px] font-black text-gray-700 dark:text-slate-300">
                            معدلي التراكمي عالٍ (يسمح بزيادة الحمولة)
                          </span>
                        </label>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const nextIdx = currentSemesterIndex + 1;
                        if (nextIdx < SEMESTERS.length) {
                          const nextSem = SEMESTERS[nextIdx];
                          setCurrentPlanningSemester(nextSem);
                          setHasHighGpa(false);
                        } else {
                          onClose(); // Close planning mode
                          setIsPlannerOpen(true); // Open main planner view
                          alert("تم الانتهاء من تخطيط كافة الفصول!");
                        }
                      }}
                      disabled={exceededCreditLimit && !hasHighGpa}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      <CircleCheckBig size={18} /> تثبيت الفصل والانتقال للتالي
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanningModeModal;
