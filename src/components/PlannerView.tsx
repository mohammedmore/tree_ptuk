import React from "react";
import { X, CalendarDays, Trash2, CircleCheckBig, Download, Sparkles, PieChart, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { cn } from "../utils";
import type { Course } from "../data";
import { courses } from "../data";
import { SEMESTERS, TOTAL_CREDITS } from "../constants";
import DynamicCourseDetailsModal from "./DynamicCourseDetailsModal";
import StatsDashboard from "./StatsDashboard";
import { markCoursesCompleted } from "../courseProgress";

interface PlannerViewProps {
  isPlannerOpen: boolean;
  onClose: () => void;
  plannedCourses: Record<string, string>;
  setPlannedCourses: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  completedCourses: Set<string>;
  setCompletedCourses: React.Dispatch<React.SetStateAction<Set<string>>>;
  planStartSemester: string;
  setPlanStartSemester: React.Dispatch<React.SetStateAction<string>>;
  planEndSemester: string;
  setPlanEndSemester: React.Dispatch<React.SetStateAction<string>>;
  hidePastSemesters: boolean;
  setHidePastSemesters: React.Dispatch<React.SetStateAction<boolean>>;
  planningCourseId: string | null;
  setPlanningCourseId: (id: string | null) => void;
  completedCredits: number;
  plannedCredits: number;
  completedCreditsPerCategory: Record<string, number>;
  plannedCreditsPerCategory: Record<string, number>;
  setIsExportModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenPlanningMode: () => void;
  toggleCourseCompletion: (courseId: string) => void;
}

const PlannerView: React.FC<PlannerViewProps> = ({
  isPlannerOpen,
  onClose,
  plannedCourses,
  setPlannedCourses,
  completedCourses,
  setCompletedCourses,
  planStartSemester,
  setPlanStartSemester,
  planEndSemester,
  setPlanEndSemester,
  hidePastSemesters,
  setHidePastSemesters,
  planningCourseId,
  setPlanningCourseId,
  completedCredits,
  plannedCredits,
  completedCreditsPerCategory,
  plannedCreditsPerCategory,
  setIsExportModalOpen,
  onOpenPlanningMode,
  toggleCourseCompletion,
}) => {
  const [plannerSelectedCourse, setPlannerSelectedCourse] = React.useState<Course | null>(null);
  const [isRescheduling, setIsRescheduling] = React.useState(false);
  const [showStats, setShowStats] = React.useState(false);

  const coursesById = React.useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [],
  );
  const effectivePlanStartSemester = SEMESTERS.includes(planStartSemester)
    ? planStartSemester
    : SEMESTERS[0];
  const planStartIndex = SEMESTERS.indexOf(effectivePlanStartSemester);
  const invalidPlannedEntries = Object.entries(plannedCourses).filter(
    ([courseId, semester]) =>
      !coursesById.has(courseId) || !SEMESTERS.includes(semester),
  );

  const planWarnings = React.useMemo(() => {
    const warnings: Record<string, string[]> = {};
    Object.entries(plannedCourses).forEach(([courseId, semester]) => {
      const course = coursesById.get(courseId);
      if (!course) return;

      const courseSemesterIdx = SEMESTERS.indexOf(semester);
      if (courseSemesterIdx < 0) {
        warnings[courseId] = ["الفصل المخطط له غير صالح"];
        return;
      }

      // Check prerequisites
      course.prerequisites.forEach((preId) => {
        const isCompleted = completedCourses.has(preId);
        const plannedSemester = plannedCourses[preId];
        const plannedSemesterIdx = plannedSemester
          ? SEMESTERS.indexOf(plannedSemester)
          : -1;

        if (
          !isCompleted &&
          (plannedSemesterIdx < 0 || plannedSemesterIdx >= courseSemesterIdx)
        ) {
          if (!warnings[courseId]) warnings[courseId] = [];
          warnings[courseId].push(
            `المتطلب السابق ${preId} غير مستوفٍ (يجب إنهاؤه قبل هذا الفصل)`,
          );
        }
      });

      // Check co-requisites
      if (course.coPrerequisites) {
        course.coPrerequisites.forEach((coId) => {
          const isCompleted = completedCourses.has(coId);
          const plannedSemester = plannedCourses[coId];
          const plannedSemesterIdx = plannedSemester
            ? SEMESTERS.indexOf(plannedSemester)
            : -1;

          if (
            !isCompleted &&
            (plannedSemesterIdx < 0 || plannedSemesterIdx > courseSemesterIdx)
          ) {
            if (!warnings[courseId]) warnings[courseId] = [];
            warnings[courseId].push(
              `المتطلب التزامني ${coId} غير مستوفٍ (يجب تسجيله في نفس الفصل أو قبله)`,
            );
          }
        });
      }
    });
    return warnings;
  }, [plannedCourses, completedCourses, coursesById]);

  if (!isPlannerOpen) return null;

  const allSemestersEmpty = Object.keys(plannedCourses).length === 0;

  return (
    <div
      className="fixed inset-0 bg-gray-900/60 backdrop-blur-xl z-[100] flex items-center justify-center p-1.5 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="planner-view-title"
        className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-6xl h-[97dvh] sm:h-[85vh] flex flex-col shadow-2xl shadow-gray-900/20 dark:shadow-slate-950/50 animate-in zoom-in-95 duration-300 border border-gray-200/50 dark:border-slate-700/50"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 shrink-0">
          <h2 id="planner-view-title" className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarDays className="text-blue-700 dark:text-blue-400" />
            الخطة الفصلية
          </h2>
          <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              aria-expanded={showStats}
              onClick={() => setShowStats(!showStats)}
              className={cn(
                "min-h-10 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 border rounded-lg transition-colors font-bold text-[11px] sm:text-sm",
                showStats 
                  ? "bg-blue-700 text-white border-blue-700 hover:bg-blue-800"
                  : "bg-white text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
              )}
            >
              <PieChart size={16} className={showStats ? "text-white" : "text-gray-500 dark:text-slate-400"} />
              {showStats ? "إخفاء الإحصائيات" : "عرض الإحصائيات الذكية"}
              {showStats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="min-h-10 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-700 text-white border border-blue-700 rounded-lg hover:bg-blue-800 transition-colors font-bold text-[11px] sm:text-sm"
            >
              <Download size={16} className="text-white" />
              <span className="sm:hidden">تصدير</span>
              <span className="hidden sm:inline">تنزيل الخطة (PDF / صورة)</span>
            </button>
            <button
              type="button"
              aria-label="إغلاق الخطة الفصلية"
              onClick={onClose}
              className="min-h-10 min-w-10 flex items-center justify-center p-2 text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-all duration-200 hover:scale-110 hover:shadow-md"
            >
              <X />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
          {/* Stats Dashboard Section */}
          {showStats && (
            <div className="mb-6 animate-in slide-in-from-top-4 duration-300">
              <StatsDashboard 
                completedCredits={completedCredits}
                plannedCredits={plannedCredits}
                totalCredits={TOTAL_CREDITS}
                completedCreditsPerCategory={completedCreditsPerCategory}
                plannedCreditsPerCategory={plannedCreditsPerCategory}
                courses={courses}
                completedCourses={completedCourses}
                plannedCourses={plannedCourses}
              />
            </div>
          )}

          {/* Controls Bar for Planning Boundaries */}
          <div className="bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900/80 dark:to-slate-800/80 border border-slate-200 dark:border-slate-700 p-3 sm:p-4 rounded-2xl mb-4 sm:mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 text-right shadow-lg shadow-gray-200/30 dark:shadow-slate-900/30">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-extrabold bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-3 py-1 rounded-xl border border-indigo-500 shadow-md shadow-indigo-200/30 dark:shadow-indigo-900/30">
                تحجيم التخطيط الأكاديمي
              </span>
              <span className="text-xs font-extrabold text-gray-700 dark:text-slate-300">
                بداية التخطيط الفعلي (الفصل القادم):
              </span>
              <select
                aria-label="بداية التخطيط الفعلي"
                value={effectivePlanStartSemester}
                onChange={(e) => {
                  if (!SEMESTERS.includes(e.target.value)) return;
                  setPlanStartSemester(e.target.value);
                  if (
                    SEMESTERS.indexOf(e.target.value) >
                    SEMESTERS.indexOf(planEndSemester)
                  ) {
                    setPlanEndSemester(e.target.value);
                  }
                }}
                className="p-1.5 px-3 bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-700 dark:text-slate-200 border border-gray-200 dark:border-slate-600 rounded-xl text-xs font-extrabold focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none text-right shadow-md shadow-gray-200/30 dark:shadow-slate-900/30 transition-all"
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
                  aria-label="إخفاء الفصول القديمة والمجتازة"
                  type="checkbox"
                  checked={hidePastSemesters}
                  onChange={(e) => setHidePastSemesters(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-extrabold text-gray-700 dark:text-slate-300">
                  إخفاء الفصول القديمة والمجتازة (قبل موعد بدء الخطة)
                </span>
              </label>
            </div>
          </div>

          {planningCourseId && (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-800/50 text-orange-800 dark:text-orange-200 p-3 sm:p-4 rounded-2xl mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-orange-200/30 dark:shadow-orange-900/20">
              <div>
                <span className="font-extrabold">
                  قم بتحديد الفصل الدراسي لإضافة مادة:{" "}
                </span>
                <span className="ml-2 font-black">
                  {coursesById.get(planningCourseId)?.name ?? planningCourseId}
                </span>
              </div>
              <button
                type="button"
                aria-label="إلغاء اختيار المقرر"
                onClick={() => setPlanningCourseId(null)}
                className="text-orange-600 dark:text-orange-400 text-sm font-extrabold hover:underline transition-all"
              >
                إلغاء التحديد
              </button>
            </div>
          )}

          {allSemestersEmpty ? (
            <div className="flex flex-col items-center justify-center text-gray-500 dark:text-slate-400 p-12 text-center bg-gradient-to-br from-gray-50 to-slate-100 dark:from-slate-950/40 dark:to-slate-900/40 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xl">
              <Sparkles size={48} className="mb-4 text-orange-400" />
              <p className="text-lg font-extrabold mb-2">لا توجد مواد مخططة بعد!</p>
              <p className="text-sm mb-4">
                ابدأ بإنشاء خطتك الأكاديمية من خلال وضع التخطيط.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPlanningMode();
                }}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl transition-all duration-200 cursor-pointer shadow-lg shadow-indigo-200/50 dark:shadow-indigo-900/30 hover:shadow-xl hover:shadow-indigo-300/60 dark:hover:shadow-indigo-900/50 hover:-translate-y-0.5 font-extrabold"
              >
                <CalendarDays size={20} />
                اذهب إلى وضع التخطيط
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto bg-gradient-to-br from-gray-50 to-slate-100 dark:from-slate-950/40 dark:to-slate-900/40 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 min-h-[500px] shadow-xl">
              {invalidPlannedEntries.length > 0 && (
                <div
                  role="alert"
                  className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  <span>
                    تعذر عرض {invalidPlannedEntries.length} من عناصر الخطة؛
                    لأنها تشير إلى مواد أو فصول غير صالحة.
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPlannedCourses((previous) =>
                        Object.fromEntries(
                          Object.entries(previous).filter(
                            ([courseId, semester]) =>
                              coursesById.has(courseId) &&
                              SEMESTERS.includes(semester),
                          ),
                        ),
                      )
                    }
                    className="min-h-9 rounded-lg border border-amber-400 px-3 font-semibold hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/50"
                  >
                    إزالة العناصر غير الصالحة
                  </button>
                </div>
              )}
              <div className="flex gap-4 min-w-max">
                {SEMESTERS.filter((sem) => {
                  if (hidePastSemesters) {
                    return (
                      SEMESTERS.indexOf(sem) >=
                      planStartIndex
                    );
                  }
                  return true;
                }).map((sem) => {
                  const isPastSem =
                    SEMESTERS.indexOf(sem) < planStartIndex;
                  const semCourses = Object.entries(plannedCourses)
                    .filter(([, semester]) => semester === sem)
                    .flatMap(([id]) => {
                      const course = coursesById.get(id);
                      return course ? [course] : [];
                    });
                  return (
                    <div
                      key={sem}
                      className={cn(
                        "w-64 flex flex-col min-h-[450px] rounded-2xl border shrink-0 overflow-hidden group transition-all duration-300 shadow-lg",
                        isPastSem
                          ? "bg-gradient-to-br from-slate-100/80 to-slate-200/80 dark:from-slate-900/40 dark:to-slate-800/40 border-dashed border-slate-300 dark:border-slate-700 opacity-[0.72] ring-1 ring-slate-200 dark:ring-slate-900 select-none"
                          : "bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 border-gray-200 dark:border-slate-700 hover:shadow-xl",
                      )}
                    >
                      <div
                        className={cn(
                          "p-3 sm:p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center transition-all duration-200 relative group/header",
                          isPastSem
                            ? "bg-gradient-to-r from-slate-200/90 to-slate-300/90 dark:from-slate-950/60 dark:to-slate-900/60 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                            : planningCourseId
                              ? "cursor-pointer hover:bg-gradient-to-r hover:from-orange-100 hover:to-amber-100 dark:hover:from-orange-950/30 dark:hover:to-amber-950/30 bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-950/10 dark:to-amber-950/10"
                              : "bg-gradient-to-r from-gray-50 to-slate-50 dark:from-slate-900/60 dark:to-slate-800/60",
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
                          <h3 className="font-extrabold text-gray-700 dark:text-slate-200 text-xs mb-1 flex items-center gap-1.5 flex-wrap">
                            {isPastSem && (
                              <span className="text-slate-400 dark:text-slate-500 shrink-0">
                                [قفل]
                              </span>
                            )}
                            <span>{sem}</span>
                            {isPastSem && (
                              <span className="text-[9px] bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-lg font-extrabold">
                                مجتاز/سابق
                              </span>
                            )}
                          </h3>
                          <span className="text-[10px] bg-gradient-to-r from-white to-gray-50 dark:from-slate-800 dark:to-slate-700 border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 px-2.5 py-1 rounded-full font-extrabold shadow-sm">
                            {semCourses.reduce(
                              (sum, c) => sum + c.credits,
                              0,
                            )}{" "}
                            س.م
                          </span>
                        </div>
                        {!planningCourseId && semCourses.length > 0 && (
                          <div className="flex gap-1 items-center shrink-0">
                            <button
                              type="button"
                              aria-label={`حذف جميع مواد ${sem}`}
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
                              className="min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 opacity-100 sm:opacity-0 sm:group-hover/header:opacity-100 p-2 sm:p-1 bg-gradient-to-r from-red-50 to-red-100 text-red-500 hover:from-red-100 hover:to-red-200 hover:text-red-700 rounded-xl transition-all duration-200 shadow-md shadow-red-200/30 dark:from-red-950/30 dark:to-red-900/30 dark:text-red-400 dark:hover:from-red-900/40 dark:hover:to-red-800/40 dark:hover:text-red-300 border border-red-200 dark:border-red-800/50"
                              title="حذف كل مواد الفصل من الخطة"
                            >
                              <Trash2 size={14} />
                            </button>

                            {semCourses.some(
                              (c) => !completedCourses.has(c.id),
                            ) && (
                                <button
                                  type="button"
                                  aria-label={`تحديد جميع مواد ${sem} كمكتملة`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCompletedCourses((prev) => {
                                      return markCoursesCompleted(
                                        prev,
                                        semCourses.map((course) => course.id),
                                      );
                                    });
                                  }}
                                  className="min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 opacity-100 sm:opacity-0 sm:group-hover/header:opacity-100 p-2 sm:p-1 bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-600 hover:from-emerald-100 hover:to-emerald-200 hover:text-emerald-700 rounded-xl transition-all duration-200 shadow-md shadow-emerald-200/30 dark:from-emerald-950/30 dark:to-emerald-900/30 dark:text-emerald-400 dark:hover:from-emerald-900/40 dark:hover:to-emerald-800/40 dark:hover:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                                  title="إنجاز كل مواد الفصل"
                                >
                                  <CircleCheckBig size={14} />
                                </button>
                              )}
                          </div>
                        )}
                      </div>

                      <div className="overflow-y-auto p-3 flex flex-col gap-2">
                        {semCourses.map((c) => {
                          const isCompleted = completedCourses.has(c.id);
                          return (
                            <div
                              key={c.id}
                              role="group"
                              onClick={() => setPlannerSelectedCourse(c)}
                              className={cn(
                                "p-3 border rounded-xl flex flex-col relative group/card shadow-md cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98]",
                                isCompleted
                                  ? "bg-gradient-to-br from-emerald-50/80 to-green-50/80 dark:from-emerald-950/20 dark:to-green-950/20 border-emerald-200/60 dark:border-emerald-900/50 hover:border-emerald-300 hover:shadow-emerald-200/30 dark:hover:shadow-emerald-900/30"
                                  : planWarnings[c.id]
                                    ? "bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-900/50 hover:border-amber-400 hover:shadow-amber-200/30 dark:hover:shadow-amber-900/30"
                                    : "bg-gradient-to-br from-blue-50/60 to-indigo-50/60 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-200 dark:border-blue-900/30 hover:border-indigo-300 hover:shadow-blue-200/30 dark:hover:shadow-blue-900/30",
                              )}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={cn(
                                      "text-[10px] font-extrabold tracking-wider",
                                      isCompleted
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : planWarnings[c.id]
                                          ? "text-amber-600 dark:text-amber-400"
                                          : "text-blue-600 dark:text-blue-400",
                                    )}
                                  >
                                    {c.id}
                                  </span>
                                  {planWarnings[c.id] && !isCompleted && (
                                    <span title={planWarnings[c.id].join('\n')}>
                                      <AlertTriangle size={12} className="text-amber-500" aria-hidden="true" />
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  aria-label={`حذف ${c.name} من الخطة`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPlannedCourses((prev) => {
                                      const next = { ...prev };
                                      delete next[c.id];
                                      return next;
                                    });
                                  }}
                                  className="min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 p-2 sm:p-1 text-gray-400 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 transition-all duration-200 hover:scale-110"
                                  title="حذف من الخطة"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setPlannerSelectedCourse(c);
                                }}
                                className={cn(
                                  "text-right text-sm font-extrabold leading-tight mt-1",
                                  isCompleted
                                    ? "text-emerald-800 dark:text-emerald-300"
                                    : "text-blue-900 dark:text-blue-100",
                                )}
                              >
                                {c.name}{" "}
                                {isCompleted && (
                                  <CircleCheckBig
                                    size={14}
                                    className="inline-block pb-0.5 text-emerald-500 align-middle"
                                  />
                                )}
                              </button>
                            </div>
                          );
                        })}
                        {planningCourseId && !isPastSem && (
                          <button
                            type="button"
                            aria-label={`إضافة ${coursesById.get(planningCourseId)?.name ?? planningCourseId} إلى ${sem}`}
                            onClick={() => {
                              setPlannedCourses((prev) => ({
                                ...prev,
                                [planningCourseId]: sem,
                              }));
                              setPlanningCourseId(null);
                            }}
                            className="w-full mt-2 py-3 border-2 border-dashed border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:border-orange-400 dark:hover:border-orange-600 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 dark:hover:from-orange-950/20 dark:hover:to-amber-950/20 rounded-xl text-sm font-extrabold transition-all duration-200 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:shadow-md"
                          >
                            + أضف{" "}
                            {
                              coursesById.get(planningCourseId)?.name ?? planningCourseId
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
                            <p className="text-xs font-extrabold">
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
          )}
        </div>
      </div>

      <DynamicCourseDetailsModal
        isPlannerOpen={isPlannerOpen} // This prop is now redundant for DynamicCourseDetailsModal
        plannerSelectedCourse={plannerSelectedCourse}
        setPlannerSelectedCourse={setPlannerSelectedCourse}
        completedCourses={completedCourses}
        plannedCourses={plannedCourses}
        setPlannedCourses={setPlannedCourses}
        isRescheduling={isRescheduling}
        setIsRescheduling={setIsRescheduling}
        planStartSemester={planStartSemester}
        planEndSemester={planEndSemester}
        toggleCourseCompletion={toggleCourseCompletion}
      />
    </div>
  );
};

export default React.memo(PlannerView);