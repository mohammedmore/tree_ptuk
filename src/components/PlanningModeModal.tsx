import React from "react";
import { X, CalendarDays, BookOpen, ChevronDown, ChevronUp, CircleCheckBig } from "lucide-react";
import { cn } from "../utils";
import { Course, courses, categoryRequirements } from "../data"; // Ensure 'courses' is imported
import { SEMESTERS } from "../constants";

interface PlanningModeModalProps {
  isPlanningModeOpen: boolean;
  onClose: () => void;
  currentPlanningSemester: string | null;
  setCurrentPlanningSemester: (semester: string | null) => void;
  completedCourses: Set<string>;
  plannedCourses: Record<string, string>;
  setPlannedCourses: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  courses: Course[];
  isCourseAvailable: (
    course: Course,
    completed: Set<string>,
    categoryCredits: Record<string, number>,
    allCourses: Course[]
  ) => boolean;
  completedCreditsPerCategory: Record<string, number>;
  hasHighGpa: boolean;
  setHasHighGpa: React.Dispatch<React.SetStateAction<boolean>>;
  expandedPlanningCategories: Record<string, boolean>;
  setExpandedPlanningCategories: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
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
  if (!isPlanningModeOpen) return null;

  const allPrev = React.useMemo(() => {
    const prev = new Set(completedCourses);
    if (currentPlanningSemester) {
      Object.entries(plannedCourses).forEach(([id, s]) => {
        if (SEMESTERS.indexOf(s) < SEMESTERS.indexOf(currentPlanningSemester)) {
          prev.add(id);
        }
      });
    }
    return prev;
  }, [completedCourses, plannedCourses, currentPlanningSemester]);

  const available = React.useMemo(() => {
    if (!currentPlanningSemester) return [];
    return courses.filter(c => {
      const isComp = completedCourses.has(c.id);
      const isPlannedInPrev = Object.entries(plannedCourses).some(([id, s]) => id === c.id && SEMESTERS.indexOf(s) < SEMESTERS.indexOf(currentPlanningSemester));
      const isPlannedNow = plannedCourses[c.id] === currentPlanningSemester;
      if (isComp || isPlannedInPrev || isPlannedNow) return false;
      return isCourseAvailable(c, allPrev, completedCreditsPerCategory, courses);
    });
  }, [currentPlanningSemester, completedCourses, plannedCourses, courses, isCourseAvailable, allPrev, completedCreditsPerCategory]);

  const groupedAvailable = React.useMemo(() => {
    return available.reduce((acc, c) => {
      if (!acc[c.category]) acc[c.category] = [];
      acc[c.category].push(c);
      return acc;
    }, {} as Record<string, Course[]>);
  }, [available]);

  const currentSemesterPlannedCredits = React.useMemo(() => {
    if (!currentPlanningSemester) return 0;
    return Object.entries(plannedCourses)
      .filter(([id, s]) => s === currentPlanningSemester)
      .reduce((sum, [id]) => sum + (courses.find(cr => cr.id === id)?.credits || 0), 0);
  }, [plannedCourses, currentPlanningSemester, courses]);

  const isSummer = currentPlanningSemester?.includes("صيفي");
  const creditLimit = isSummer ? (hasHighGpa ? 10 : 9) : (hasHighGpa ? 21 : 18);
  const exceededCreditLimit = currentSemesterPlannedCredits > creditLimit;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
      onClick={onClose}
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
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X /></button>
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-gray-500 dark:text-slate-400 flex items-center gap-2">
                      <BookOpen size={14} /> المواد المتاحة هذا الفصل
                    </h3>
                    {Object.keys(groupedAvailable).length > 0 && (
                      <button
                        onClick={() => {
                          const isAnyOpen = Object.values(expandedPlanningCategories).some(v => v === true);
                          const newState: Record<string, boolean> = {};
                          if (!isAnyOpen) Object.keys(groupedAvailable).forEach(cat => { newState[cat] = true; });
                          setExpandedPlanningCategories(newState);
                        }}
                        className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        {Object.values(expandedPlanningCategories).some(v => v === true) ? "طي الكل" : "فرد الكل"}
                      </button>
                    )}
                  </div>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
                    {Object.keys(groupedAvailable).length === 0 ? (
                      <div className="text-center py-10 text-xs font-bold text-gray-400">لا توجد مواد متاحة حالياً للجدولة</div>
                    ) : (
                      Object.entries(groupedAvailable).map(([category, items]) => {
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
                                      {c.coPrerequisites && c.coPrerequisites.length > 0 && (
                                        <span className="text-[8px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-md">
                                          {c.coPrerequisites.map(cpId => courses.find(course => course.id === cpId)?.name || cpId).join(', ')}
                                        </span>
                                      )}
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

                {/* Column 2: Selected in Current Semester */}
                <div className="bg-gray-50 dark:bg-slate-800/40 rounded-3xl p-5 flex flex-col gap-4 border border-gray-100 dark:border-slate-800">
                  <h3 className="text-sm font-black text-gray-800 dark:text-slate-100">المواد المجدولة في هذا الفصل:</h3>
                  <div className="flex-1 space-y-2 min-h-[100px]">
                    {Object.entries(plannedCourses).filter(([id, s]) => s === currentPlanningSemester).map(([id]) => {
                      const c = courses.find(cr => cr.id === id);
                      return (
                        <div key={id} className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800 flex justify-between items-center shadow-sm">
                          <span className="text-xs font-bold text-gray-700 dark:text-slate-300 truncate pl-2">{c?.name}</span>
                          <button onClick={() => setPlannedCourses(prev => { const n = { ...prev }; delete n[id]; return n; })} className="text-red-400 hover:text-red-600 p-1"><X size={14} /></button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-slate-700 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-gray-500">مجموع الساعات:</span>
                      <span className={cn("text-lg font-black", exceededCreditLimit ? "text-red-600 animate-pulse" : "text-blue-600")}>{currentSemesterPlannedCredits} / {creditLimit}</span>
                    </div>

                    {exceededCreditLimit && (
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