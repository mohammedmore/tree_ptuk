import React from "react";
import { PieChart, Target, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react";
import { cn } from "../utils";
import type { Course } from "../data";
import { categoryRequirements } from "../data";

interface StatsDashboardProps {
  completedCredits: number;
  plannedCredits: number;
  totalCredits: number;
  completedCreditsPerCategory: Record<string, number>;
  plannedCreditsPerCategory: Record<string, number>;
  courses: Course[];
  completedCourses: Set<string>;
  plannedCourses: Record<string, string>;
}

const StatsDashboard: React.FC<StatsDashboardProps> = ({
  completedCredits,
  plannedCredits,
  totalCredits,
  completedCreditsPerCategory,
  plannedCreditsPerCategory,
  courses,
  completedCourses,
  plannedCourses,
}) => {
  const [showCategoryCourses, setShowCategoryCourses] = React.useState<string | null>(null);

  const categories = Object.keys(categoryRequirements);
  
  const allCategoriesCompleted = categories.every(cat => (completedCreditsPerCategory[cat] || 0) >= categoryRequirements[cat]);
  const allCategoriesPlanned = categories.every(cat => ((completedCreditsPerCategory[cat] || 0) + (plannedCreditsPerCategory[cat] || 0)) >= categoryRequirements[cat]);

  return (
    <div className="space-y-4">
      {/* Graduation Summary Card */}
      <div className={cn(
        "p-4 rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-500",
        allCategoriesCompleted 
          ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50" 
          : allCategoriesPlanned
            ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/50"
            : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50"
      )}>
        <div className="flex items-center gap-4 text-right">
          <div className={cn(
            "p-3 rounded-2xl text-white shadow-lg",
            allCategoriesCompleted ? "bg-emerald-500 shadow-emerald-200" : allCategoriesPlanned ? "bg-blue-500 shadow-blue-200" : "bg-amber-500 shadow-amber-200"
          )}>
            {allCategoriesCompleted ? <CheckCircle2 size={32} /> : <Target size={32} />}
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-800 dark:text-slate-100">
              {allCategoriesCompleted ? "تهانينا! لقد أتممت متطلبات التخرج" : allCategoriesPlanned ? "الخطة الحالية تغطي متطلبات التخرج" : "الخطة الحالية لا تغطي كافة المتطلبات"}
            </h3>
            <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
              {allCategoriesCompleted 
                ? "لقد نجحت في إنهاء كافة الساعات المطلوبة حسب الخطة الدراسية." 
                : allCategoriesPlanned 
                  ? "إذا التزمت بهذه الخطة، فستتمكن من إنهاء كافة المتطلبات في الوقت المحدد."
                  : "يرجى إضافة المزيد من المواد في الفئات المتبقية لضمان استيفاء شروط التخرج."}
            </p>
          </div>
        </div>

        <div className="flex gap-4 shrink-0">
          <div className="text-center px-6 py-2 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-white dark:border-slate-700">
            <div className="text-[10px] font-black text-gray-400 uppercase mb-1">إجمالي المنجز</div>
            <div className="text-xl font-black text-gray-800 dark:text-slate-100">{completedCredits} <span className="text-xs text-gray-400">ساعة</span></div>
          </div>
          <div className="text-center px-6 py-2 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-white dark:border-slate-700">
            <div className="text-[10px] font-black text-gray-400 uppercase mb-1">المتبقي للتخرج</div>
            <div className="text-xl font-black text-orange-600 dark:text-orange-400">{Math.max(0, totalCredits - completedCredits)} <span className="text-xs text-gray-400">ساعة</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
      {categories.map((cat, categoryIndex) => {
        const required = categoryRequirements[cat];
        const completed = Math.max(0, completedCreditsPerCategory[cat] || 0);
        const planned = Math.max(0, plannedCreditsPerCategory[cat] || 0);
        const total = completed + planned;
        const remainingCourses = courses.filter(
          (course) => course.category === cat && !completedCourses.has(course.id),
        );
        
        const completedPercent = required > 0
          ? Math.min(100, (completed / required) * 100)
          : 0;
        const totalPercent = required > 0
          ? Math.min(100, (total / required) * 100)
          : 0;
        
        const isCompleted = completed >= required;
        const isFullyPlanned = total >= required;

        return (
          <div 
            key={cat} 
            className={cn(
              "bg-white dark:bg-slate-800/50 p-4 rounded-2xl border transition-all duration-300 group",
              isCompleted 
                ? "border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/10" 
                : isFullyPlanned 
                  ? "border-blue-100 dark:border-blue-900/30 bg-blue-50/10"
                  : "border-gray-100 dark:border-slate-700"
            )}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="space-y-1">
                <h4 className="text-[11px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider">{cat}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-gray-800 dark:text-slate-100">{completed}</span>
                  <span className="text-xs font-bold text-gray-400">/ {required} ساعة</span>
                </div>
              </div>
              {isCompleted ? (
                <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded-full text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={16} />
                </div>
              ) : isFullyPlanned ? (
                <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-full text-blue-600 dark:text-blue-400">
                  <Target size={16} />
                </div>
              ) : (
                <div className="bg-gray-100 dark:bg-slate-800 p-1.5 rounded-full text-gray-400">
                  <PieChart size={16} />
                </div>
              )}
            </div>

            <div
              role="progressbar"
              aria-label={`تقدم ${cat} منجزاً ومخططاً`}
              aria-valuemin={0}
              aria-valuemax={required}
              aria-valuenow={Math.min(required, total)}
              className="relative h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3"
            >
              <div 
                aria-hidden="true"
                className="absolute top-0 h-full bg-blue-400/30 transition-all duration-1000 ease-out"
                style={{ width: `${totalPercent}%`, insetInlineStart: 0 }}
              />
              <div 
                aria-hidden="true"
                className={cn(
                  "absolute top-0 h-full transition-all duration-1000 ease-out rounded-full",
                  isCompleted ? "bg-emerald-500" : "bg-blue-500"
                )}
                style={{ width: `${completedPercent}%`, insetInlineStart: 0 }}
              />
            </div>

            <div className="flex justify-between items-center text-[10px] font-bold">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>منجز: {completed}</span>
                </div>
                {planned > 0 && !isCompleted && (
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>مخطط: {planned}</span>
                  </div>
                )}
              </div>
              <div className={cn(
                "px-2 py-0.5 rounded-md",
                isCompleted 
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" 
                  : isFullyPlanned
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
              )}>
                {isCompleted ? "مكتمل" : isFullyPlanned ? "مغطى بالخطة" : `متبقي ${Math.max(0, required - total)}`}
              </div>
            </div>

            {/* List missing courses button */}
            {!isCompleted && (
              <button
                type="button"
                aria-expanded={showCategoryCourses === cat}
                aria-controls={`category-courses-${categoryIndex}`}
                onClick={() => setShowCategoryCourses(showCategoryCourses === cat ? null : cat)}
                className="mt-3 w-full py-1.5 border border-dashed border-gray-200 dark:border-slate-700 rounded-xl text-[9px] font-black text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                {showCategoryCourses === cat ? "إخفاء القائمة" : "عرض المواد المتبقية"}
                <ArrowUpRight size={10} />
              </button>
            )}

            {showCategoryCourses === cat && (
              <div
                id={`category-courses-${categoryIndex}`}
                role="region"
                aria-label={`المواد المتبقية في ${cat}`}
                className="mt-2 space-y-1 max-h-40 overflow-y-auto pr-1 scrollbar-thin"
              >
                {remainingCourses.length === 0 ? (
                  <p className="p-2 text-center text-xs font-bold text-gray-500 dark:text-slate-400">
                    لا توجد مواد متبقية غير مجتازة في هذه الفئة.
                  </p>
                ) : (
                  remainingCourses.map((course) => (
                    <div key={course.id} className="flex justify-between items-center p-1.5 bg-white dark:bg-slate-900 rounded-lg text-[9px] border border-gray-50 dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-700 dark:text-slate-300">{course.name}</span>
                        {plannedCourses[course.id] && (
                          <span className="text-[7px] text-blue-500 font-black">مجدولة في {plannedCourses[course.id]}</span>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-gray-400">{course.credits} س</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
};

export default StatsDashboard;
