import React from "react";
import { X, CalendarDays, BookOpen, ChevronDown, ChevronUp, CircleCheckBig, Search, AlertTriangle } from "lucide-react";
import { cn } from "../utils";
import { Course, courses, categoryRequirements } from "../data"; // Ensure 'courses' is imported
import { SEMESTERS } from "../constants";
import { getSemesterType, isCourseAvailableInSemester, formatOfferings } from "../courseOfferings";

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
  const [searchQuery, setSearchQuery] = React.useState("");
  const [hourFilter, setHourFilter] = React.useState<number | null>(null);

  const allPrev = React.useMemo(() => {
    const prev = new Set(completedCourses);
    if (currentPlanningSemester) {
      (Object.entries(plannedCourses) as [string, string][]).forEach(([id, s]) => {
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
      const isPlannedInPrev = (Object.entries(plannedCourses) as [string, string][]).some(([id, s]) => id === c.id && SEMESTERS.indexOf(s) < SEMESTERS.indexOf(currentPlanningSemester));
      const isPlannedNow = plannedCourses[c.id] === currentPlanningSemester;
      if (isComp || isPlannedInPrev || isPlannedNow) return false;
      return isCourseAvailable(c, allPrev, completedCreditsPerCategory, courses);
    });
  }, [currentPlanningSemester, completedCourses, plannedCourses, courses, isCourseAvailable, allPrev, completedCreditsPerCategory]);

  const groupedAvailable = React.useMemo(() => {
    return available
      .filter(c => 
        (c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.id.toLowerCase().includes(searchQuery.toLowerCase())) &&
        (!hourFilter || c.credits === hourFilter)
      )
      .reduce((acc, c) => {
        if (!acc[c.category]) acc[c.category] = [];
        acc[c.category].push(c);
        return acc;
      }, {} as Record<string, Course[]>);
  }, [available, searchQuery, hourFilter]);

  const currentSemesterPlannedCredits = React.useMemo(() => {
    if (!currentPlanningSemester) return 0;
    return Object.entries(plannedCourses)
      .filter(([id, s]) => s === currentPlanningSemester)
      .reduce((sum, [id]) => sum + (courses.find(cr => cr.id === id)?.credits || 0), 0);
  }, [plannedCourses, currentPlanningSemester, courses]);

  const totalPlannedAndCompletedCreditsPerCategory = React.useMemo(() => {
    const counts: Record<string, number> = { ...completedCreditsPerCategory };
    Object.keys(plannedCourses).forEach(id => {
      const course = courses.find(c => c.id === id);
      if (course) {
        counts[course.category] = (counts[course.category] || 0) + course.credits;
      }
    });
    return counts;
  }, [completedCreditsPerCategory, plannedCourses, courses]);

  if (!isPlanningModeOpen) return null;

  const isSummer = currentPlanningSemester?.includes("صيفي");
  const creditLimit = isSummer ? (hasHighGpa ? 10 : 9) : (hasHighGpa ? 21 : 18);
  const exceededCreditLimit = currentSemesterPlannedCredits > creditLimit;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl p-0 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden border border-gray-100 dark:border-slate-700 flex flex-col max-h-[90vh]"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-orange-600 via-orange-500 to-yellow-500"></div>

        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-950/20 shrink-0">
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
              <div className="p-4 bg-orange-50 dark:bg-orange-500/10 rounded-2xl border border-orange-100 dark:border-orange-500/30">
                <p className="text-sm font-bold text-orange-800 dark:text-orange-300 leading-relaxed">
                  أهلاً بك في وضع التخطيط . يرجى تحديد الفصل الدراسي القادم الذي ترغب في البدء بتخطيط مواده:
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SEMESTERS.map(s => (
                  <button
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
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
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
                      onClick={() => setHourFilter(null)} 
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all",
                        !hourFilter ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                      )}
                    >
                      الكل
                    </button>
                    <button 
                      onClick={() => setHourFilter(3)} 
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all",
                        hourFilter === 3 ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                      )}
                    >
                      3 ساعات
                    </button>
                    <button 
                      onClick={() => setHourFilter(1)} 
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all",
                        hourFilter === 1 ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
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
                      (Object.entries(groupedAvailable) as [string, Course[]][]).map(([category, items]) => {
                        const isExpanded = expandedPlanningCategories[category] === true; // Default to closed
                        const currentCatCredits = totalPlannedAndCompletedCreditsPerCategory[category] || 0;
                        const requiredCatCredits = categoryRequirements[category] || 0;
                        const isExceeded = currentCatCredits > requiredCatCredits;

                        return (
                          <div key={category} className={cn("border rounded-2xl overflow-hidden shadow-sm transition-all", isExceeded ? "border-red-300 bg-red-50/20" : "border-gray-100 dark:border-slate-700")}>
                            <button
                              onClick={() => setExpandedPlanningCategories(prev => ({ ...prev, [category]: !isExpanded }))}
                              className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/80 hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex flex-col items-start gap-1">
                                <span className="text-[11px] font-black text-gray-700 dark:text-slate-200">{category} ({items.length})</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div 
                                      className={cn("h-full transition-all", isExceeded ? "bg-red-500" : currentCatCredits >= requiredCatCredits ? "bg-emerald-500" : "bg-blue-500")}
                                      style={{ width: `${Math.min(100, (currentCatCredits / requiredCatCredits) * 100)}%` }}
                                    ></div>
                                  </div>
                                  <span className={cn("text-[9px] font-bold", isExceeded ? "text-red-600" : "text-gray-400")}>
                                    {currentCatCredits} / {requiredCatCredits} س
                                  </span>
                                </div>
                              </div>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {isExpanded && (
                              <div className="p-2 bg-white dark:bg-slate-900/50 space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                                {items.map(c => {
                                  const alreadyPlannedSomewhere = !!plannedCourses[c.id];
                                  const semesterType = getSemesterType(currentPlanningSemester!);
                                  const isNotAvailableInSemester = c.availableSemesters && !isCourseAvailableInSemester(c.id, semesterType);
                                   
                                  return (
                                    <button
                                      key={c.id}
                                      disabled={alreadyPlannedSomewhere}
                                      onClick={() => setPlannedCourses(prev => ({ ...prev, [c.id]: currentPlanningSemester! }))}
                                      className={cn(
                                        "w-full text-right p-2.5 bg-white dark:bg-slate-800 border rounded-xl hover:border-blue-400 hover:shadow-sm transition-all flex justify-between items-center group",
                                        alreadyPlannedSomewhere && "opacity-40 cursor-not-allowed grayscale",
                                        isNotAvailableInSemester && "border-red-300 dark:border-red-700/50 bg-red-50/30 dark:bg-red-950/20 opacity-60"
                                      )}
                                      title={isNotAvailableInSemester ? `⚠️ هذه المادة غير متاحة في ${currentPlanningSemester}` : ""}
                                    >
                                      <div className="flex flex-col items-start gap-0.5">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[11px] font-bold text-gray-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors">{c.name}</span>
                                          {alreadyPlannedSomewhere && (
                                            <span className="text-[7px] bg-gray-100 dark:bg-slate-700 text-gray-400 px-1 rounded">مجدولة مسبقاً</span>
                                          )}
                                          {isNotAvailableInSemester && (
                                            <span className="text-[7px] bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-semibold">
                                              <AlertTriangle size={8} /> غير متاحة
                                            </span>
                                          )}
                                        </div>
                                        {c.coPrerequisites && c.coPrerequisites.length > 0 && (
                                          <span className="text-[8px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-md">
                                            {c.coPrerequisites.map(cpId => courses.find(course => course.id === cpId)?.name || cpId).join(', ')}
                                          </span>
                                        )}
                                        {c.availableSemesters && (
                                          <span className="text-[8px] font-semibold text-purple-600 dark:text-purple-400">
                                            💡 متاح: {formatOfferings(c.availableSemesters)}
                                          </span>
                                        )}
                                        <span className="text-[9px] font-mono text-gray-400">{c.id}</span>
                                      </div>
                                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">{c.credits} س</span>
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
                      💡 اضغط على اسم المجموعة لطيها أو فردها. يتم عرض المواد التي حققت متطلباتها السابقة فقط.
                    </p>
                  </div>
                </div>

                {/* Column 2: Selected in Current Semester */}
                <div className="bg-gray-50 dark:bg-slate-800/40 rounded-3xl p-5 flex flex-col gap-4 border border-gray-100 dark:border-slate-700">
                  <h3 className="text-sm font-black text-gray-800 dark:text-slate-100">المواد المجدولة في هذا الفصل:</h3>
                  <div className="flex-1 space-y-2 min-h-[100px]">
                    {Object.entries(plannedCourses).filter(([id, s]) => s === currentPlanningSemester).map(([id]) => {
                      const c = courses.find(cr => cr.id === id);
                      return (
                        <div key={id} className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-gray-100 dark:border-slate-700 flex justify-between items-center shadow-sm">
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