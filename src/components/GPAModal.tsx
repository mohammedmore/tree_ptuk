import React from "react";
import { Calculator, TrendingUp, Search, Info, Trash2, PlusCircle } from "lucide-react";
import { BaseModal } from "./BaseModal";
import { Course } from "../data";
import { cn } from "../utils";

interface GPAModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  completedCourses: Set<string>;
  courseGrades: Record<string, number>;
  setCourseGrades: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

export const GPAModal: React.FC<GPAModalProps> = ({
  isOpen,
  onClose,
  courses,
  completedCourses,
  courseGrades,
  setCourseGrades,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [whatIfGrades, setWhatIfGrades] = React.useState<Record<string, number>>({});

  const completedList = React.useMemo(() => {
    return courses.filter(c => completedCourses.has(c.id));
  }, [courses, completedCourses]);

  const filteredCompleted = React.useMemo(() => {
    return completedList.filter(c => 
      c.name.includes(searchQuery) || c.id.includes(searchQuery)
    );
  }, [completedList, searchQuery]);

  const calculateGPA = (grades: Record<string, number>, includeHypothetical: boolean = false) => {
    let totalPoints = 0;
    let totalCredits = 0;
    
    completedList.forEach(course => {
      const grade = grades[course.id] || 0;
      if (grade > 0) {
        totalPoints += grade * course.credits;
        totalCredits += course.credits;
      }
    });

    if (includeHypothetical) {
      (Object.entries(whatIfGrades) as [string, number][]).forEach(([id, grade]) => {
        if (!completedCourses.has(id) && grade > 0) {
          const course = courses.find(c => c.id === id);
          if (course) {
            totalPoints += grade * course.credits;
            totalCredits += course.credits;
          }
        }
      });
    }
    
    return totalCredits === 0 ? 0 : totalPoints / totalCredits;
  };

  const currentGPA = React.useMemo(() => calculateGPA(courseGrades), [completedList, courseGrades]);

  const whatIfGPA = React.useMemo(() => {
    const combinedGrades = { ...courseGrades, ...whatIfGrades };
    return calculateGPA(combinedGrades, true);
  }, [completedList, courseGrades, whatIfGrades, completedCourses, courses]);

  const totalCompletedCredits = completedList.reduce((sum, c) => sum + c.credits, 0);
  const creditsWithGrades = completedList.filter(c => (courseGrades[c.id] || 0) > 0).reduce((sum, c) => sum + c.credits, 0);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Calculator size={24} />
          </div>
          <div>
            <div className="text-xl font-black">نظام المعدل والدرجات</div>
            <div className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">إدارة التحصيل الأكاديمي</div>
          </div>
        </div>
      }
    >
      <div className="p-6 space-y-8" dir="rtl">
        {/* GPA Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 dark:from-indigo-900 dark:to-blue-900 p-6 rounded-3xl text-white shadow-lg shadow-indigo-200 dark:shadow-none relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendingUp size={80} />
            </div>
            <div className="relative z-10">
              <div className="text-sm font-bold opacity-80 mb-1">المعدل التراكمي الحالي</div>
              <div className="text-4xl font-black mb-4 tracking-tight">
                %{currentGPA.toFixed(2)}
              </div>
              <div className="flex items-center gap-4 text-xs font-bold opacity-90 bg-white/10 p-2 rounded-xl backdrop-blur-sm">
                <div>الساعات المنجزة: {totalCompletedCredits}</div>
                <div className="w-px h-3 bg-white/20"></div>
                <div>ساعات محسوبة: {creditsWithGrades}</div>
              </div>
            </div>
          </div>
 
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-bold text-gray-500 dark:text-slate-400">حساب "ماذا لو"</div>
                <div className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg text-[10px] font-black">تجريبي</div>
              </div>
              <div className="text-3xl font-black text-gray-800 dark:text-white mb-2">
                %{whatIfGPA.toFixed(2)}
              </div>
            </div>
            <div className="text-[10px] text-gray-400 font-bold leading-relaxed">
              تظهر هذه النتيجة المعدل المتوقع بناءً على العلامات الحالية مضافاً إليها التوقعات التي تدخلها أدناه.
            </div>
          </div>
        </div>

        {/* Search and List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
              <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
              قائمة المواد المنجزة
            </h3>
            <div className="relative w-64">
              <input
                type="text"
                placeholder="ابحث عن مادة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-10 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
              <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {filteredCompleted.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                <Info size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-400 font-bold text-sm">لا يوجد مواد منجزة مطابقة</p>
              </div>
            ) : (
              filteredCompleted.map(course => (
                <div key={course.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-[10px] font-black text-gray-500 dark:text-slate-400 border border-gray-100 dark:border-slate-700">
                      {course.credits}س
                    </div>
                    <div>
                      <div className="text-sm font-black text-gray-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{course.name}</div>
                      <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500">{course.id}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-tighter">الدرجة الحالية</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="--"
                        value={courseGrades[course.id] || ""}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                          setCourseGrades(prev => ({ ...prev, [course.id]: val }));
                        }}
                        className="w-16 text-center py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-black text-indigo-600 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="w-px h-8 bg-gray-100 dark:bg-slate-700 mx-1"></div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black text-orange-400 mb-1 uppercase tracking-tighter">توقع (ماذا لو)</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="--"
                        value={whatIfGrades[course.id] || ""}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                          setWhatIfGrades(prev => ({ ...prev, [course.id]: val }));
                        }}
                        className="w-16 text-center py-1.5 bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/30 rounded-lg text-sm font-black text-orange-600 dark:text-orange-400 outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Hypothetical Course Section */}
        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-100">
            <PlusCircle size={20} className="text-indigo-500" />
            <span className="text-sm font-black">إضافة علامة متوقعة لمادة لم تُنجز بعد</span>
          </div>
          <div className="flex flex-wrap gap-3">
             <div className="text-xs text-gray-500 font-bold leading-relaxed mb-4 w-full">
               يمكنك إضافة علامة "ماذا لو" لأي مادة في الخطة حتى لو لم تنجزها بعد لترى كيف سيؤثر ذلك على معدلك النهائي.
             </div>
             {/* This could be a dropdown of all non-completed courses */}
             <select 
               className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold flex-1 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
               onChange={(e) => {
                 const courseId = e.target.value;
                 if (courseId) {
                   setWhatIfGrades(prev => ({ ...prev, [courseId]: 0 }));
                 }
               }}
               value=""
             >
               <option value="" disabled>اختر مادة من الخطة...</option>
               {courses.filter(c => !completedCourses.has(c.id)).map(c => (
                 <option key={c.id} value={c.id}>{c.name} ({c.credits}س)</option>
               ))}
             </select>
          </div>

          {/* List of what-if for non-completed courses */}
          <div className="mt-4 space-y-2">
            {(Object.entries(whatIfGrades) as [string, number][])
              .filter(([id]) => !completedCourses.has(id))
              .map(([id, grade]) => {
                const course = courses.find(c => c.id === id);
                if (!course) return null;
                return (
                  <div key={id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-orange-100 dark:border-orange-500/30">
                    <div className="flex items-center gap-3">
                      <div className="text-xs font-black text-gray-700 dark:text-gray-200">{course.name}</div>
                      <div className="text-[10px] font-bold text-gray-500 dark:text-slate-400">{course.credits}س</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={grade || ""}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                          setWhatIfGrades(prev => ({ ...prev, [id]: val }));
                        }}
                        className="w-14 text-center py-1 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-lg text-xs font-black text-orange-600 dark:text-orange-400 outline-none"
                      />
                      <button 
                        onClick={() => {
                          const next = { ...whatIfGrades };
                          delete next[id];
                          setWhatIfGrades(next);
                        }}
                        className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
 
        <div className="flex justify-center">
           <button 
             onClick={() => setWhatIfGrades({})}
             className="text-xs font-black text-gray-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors flex items-center gap-2"
           >
             <Trash2 size={14} />
             إعادة تعيين حسابات "ماذا لو"
           </button>
        </div>
      </div>
    </BaseModal>
  );
};
