import React from "react";
import { X, CalendarDays, Trash2, CircleCheckBig, Download, Sparkles, PieChart, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { cn } from "../utils";
import { Course, courses } from "../data";
import { SEMESTERS, TOTAL_CREDITS } from "../constants";
import DynamicCourseDetailsModal from "./DynamicCourseDetailsModal";
import StatsDashboard from "./StatsDashboard";

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
  getAllPrerequisites: (courseId: string) => Set<string>;
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
  getAllPrerequisites,
  setIsExportModalOpen,
  onOpenPlanningMode,
  toggleCourseCompletion,
}) => {
  const [plannerSelectedCourse, setPlannerSelectedCourse] = React.useState<Course | null>(null);
  const [isRescheduling, setIsRescheduling] = React.useState(false);
  const [showStats, setShowStats] = React.useState(false);

  const planWarnings = React.useMemo(() => {
    const warnings: Record<string, string[]> = {};
    (Object.entries(plannedCourses) as [string, string][]).forEach(([courseId, semester]) => {
      const course = courses.find((c) => c.id === courseId);
      if (!course) return;

      const courseSemesterIdx = SEMESTERS.indexOf(semester);

      // Check prerequisites
      course.prerequisites.forEach((preId) => {
        const isCompleted = completedCourses.has(preId);
        const plannedSemester = plannedCourses[preId];
        const plannedSemesterIdx = plannedSemester
          ? SEMESTERS.indexOf(plannedSemester)
          : -1;

        if (
          !isCompleted &&
          (plannedSemesterIdx === -1 || plannedSemesterIdx >= courseSemesterIdx)
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
            (plannedSemesterIdx === -1 || plannedSemesterIdx > courseSemesterIdx)
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
  }, [plannedCourses, completedCourses]);

  if (!isPlannerOpen) return null;

  const allSemestersEmpty = Object.keys(plannedCourses).length === 0;

  return (
    <div
      className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-1.5 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-3 sm:p-6 w-full max-w-6xl h-[97dvh] sm:h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4 mb-3 sm:mb-6 shrink-0">
          <h2 className="text-lg sm:text-2xl font-black text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <CalendarDays className="text-orange-500" />
            الخطة الفصلية
          </h2>
          <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setShowStats(!showStats)}
              className={cn(
                "min-h-10 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 border rounded-xl transition-all font-bold text-[11px] sm:text-sm shadow-sm",
                showStats 
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50"
                  : "bg-white text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 hover:bg-gray-50"
              )}
            >
              <PieChart size={16} className={showStats ? "text-indigo-600" : "text-gray-500"} />
              {showStats ? "إخفاء الإحصائيات" : "عرض الإحصائيات الذكية"}
              {showStats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="min-h-10 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all font-bold text-[11px] sm:text-sm shadow-sm"
            >
              <Download size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span className="sm:hidden">تصدير</span>
              <span className="hidden sm:inline">تنزيل الخطة (PDF / صورة)</span>
            </button>
            <button
              onClick={onClose}
              className="min-h-10 min-w-10 flex items-center justify-center p-2 text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
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
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3.5 rounded-2xl mb-3 sm:mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 sm:gap-3 text-right">
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
            <div className="bg-orange-50 border border-orange-200 text-orange-800 p-3 sm:p-4 rounded-xl mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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

          {allSemestersEmpty ? (
            <div className="flex flex-col items-center justify-center text-gray-500 dark:text-slate-400 p-12 text-center bg-gray-50 dark:bg-slate-950/40 rounded-xl border border-gray-200 dark:border-slate-800">
              <Sparkles size={48} className="mb-4 text-orange-400" />
              <p className="text-lg font-bold mb-2">لا توجد مواد مخططة بعد!</p>
              <p className="text-sm mb-4">
                ابدأ بإنشاء خطتك الأكاديمية من خلال وضع التخطيط.
              </p>
              <button
                onClick={() => {
                  onClose(); // Close PlannerView
                  onOpenPlanningMode(); // Open PlanningModeModal
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors cursor-pointer shadow-lg font-bold"
              >
                <CalendarDays size={20} />
                اذهب إلى وضع التخطيط
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto bg-gray-50 dark:bg-slate-950/40 rounded-xl border border-gray-200 dark:border-slate-800 p-4 min-h-[500px]">
              <div className="flex gap-4 min-w-max">
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
                    .filter(([, semester]) => semester === sem)
                    .map(([id]) => courses.find((c) => c.id === id)!)
                    .filter(Boolean);
                  return (
                    <div
                      key={sem}
                      className={cn(
                        "w-64 flex flex-col min-h-[450px] rounded-xl border shrink-0 overflow-hidden group transition-all",
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
                              // Replaced <Lock> with a span for testing
                              <span className="text-slate-400 dark:text-slate-500 shrink-0">
                                [قفل]
                              </span>
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
                              className="min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 opacity-100 sm:opacity-0 sm:group-hover/header:opacity-100 p-2 sm:p-1 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 rounded-md transition-all shadow-sm border border-red-200"
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
                                  className="min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 opacity-100 sm:opacity-0 sm:group-hover/header:opacity-100 p-2 sm:p-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-md transition-all shadow-sm border border-emerald-200"
                                  title="إنجاز كل مواد الفصل"
                                >
                                  <CircleCheckBig size={14} />
                                </button>
                              )}
                          </div>
                        )}
                      </div>

                      <div className="overflow-y-auto p-2 flex flex-col gap-2">
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
                                  : planWarnings[c.id]
                                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 hover:border-amber-400"
                                    : "bg-blue-50/40 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 hover:border-indigo-200 dark:hover:border-indigo-800",
                              )}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={cn(
                                      "text-[10px] font-bold tracking-widest",
                                      isCompleted
                                        ? "text-emerald-500"
                                        : planWarnings[c.id]
                                          ? "text-amber-600"
                                          : "text-blue-600/60 dark:text-blue-400/60",
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPlannedCourses((prev) => {
                                      const next = { ...prev };
                                      delete next[c.id];
                                      return next;
                                    });
                                  }}
                                  className="min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 p-2 sm:p-1 text-gray-400 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 rounded opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 transition-all"
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
                            className="w-full mt-2 py-3 border-2 border-dashed border-orange-200 text-orange-500 hover:border-orange-400 hover:bg-orange-50 rounded-lg text-sm font-bold transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
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