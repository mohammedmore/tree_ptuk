import React from "react";
import { Calculator, TrendingUp, Search, Info, Trash2, PlusCircle, Sparkles, Target } from "lucide-react";
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
  failedCourseIds: Set<string>;
  setFailedCourseIds: (ids: Set<string>) => void;
}

export const GPAModal: React.FC<GPAModalProps> = ({
  isOpen,
  onClose,
  courses,
  completedCourses,
  courseGrades,
  setCourseGrades,
  failedCourseIds,
  setFailedCourseIds,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [failedSearchQuery, setFailedSearchQuery] = React.useState("");
  const [whatIfSearchQuery, setWhatIfSearchQuery] = React.useState("");
  const [isFailedListOpen, setIsFailedListOpen] = React.useState(false);
  const [isWhatIfListOpen, setIsWhatIfListOpen] = React.useState(false);
  const [whatIfGrades, setWhatIfGrades] = React.useState<Record<string, number>>({});
  const [targetGPA, setTargetGPA] = React.useState<number | "">("");

  const remainingCredits = React.useMemo(() => {
    const earnedCredits = courses
      .filter(c => completedCourses.has(c.id) && (courseGrades[c.id] || 0) !== -1)
      .reduce((sum, c) => sum + c.credits, 0);
    return 164 - earnedCredits; // assuming 164 is total credits
  }, [courses, completedCourses, courseGrades]);

  const requiredAverage = React.useMemo(() => {
    if (targetGPA === "" || targetGPA <= 0 || remainingCredits <= 0) return null;
    
    let currentTotalPoints = 0;
    let currentCountedCredits = 0;

    courses.forEach(c => {
      if (completedCourses.has(c.id) && courseGrades[c.id] > 0 && courseGrades[c.id] !== -1) {
        currentTotalPoints += courseGrades[c.id] * c.credits;
        currentCountedCredits += c.credits;
      }
    });

    const totalCreditsNeeded = 164; // Can be made dynamic later
    const neededPoints = (targetGPA * totalCreditsNeeded) - currentTotalPoints;
    
    if (neededPoints <= 0) return 0;
    
    return neededPoints / remainingCredits;
  }, [targetGPA, remainingCredits, courses, completedCourses, courseGrades]);

  const failedAvailableCourses = React.useMemo(() => {
    const query = failedSearchQuery.toLowerCase();
    const available = courses.filter(c =>
      !completedCourses.has(c.id) &&
      !failedCourseIds.has(c.id) &&
      (c.name.toLowerCase().includes(query) || c.id.toLowerCase().includes(query))
    );
    const grouped: Record<string, Course[]> = {};
    available.forEach(course => {
      if (!grouped[course.category]) {
        grouped[course.category] = [];
      }
      grouped[course.category].push(course);
    });
    return grouped;
  }, [courses, completedCourses, failedCourseIds, failedSearchQuery]);

  const whatIfAvailableCourses = React.useMemo(() => {
    const query = whatIfSearchQuery.toLowerCase();
    const available = courses.filter(c =>
      !completedCourses.has(c.id) &&
      !failedCourseIds.has(c.id) &&
      !whatIfGrades.hasOwnProperty(c.id) &&
      (c.name.toLowerCase().includes(query) || c.id.toLowerCase().includes(query))
    );
    const grouped: Record<string, Course[]> = {};
    available.forEach(course => {
      if (!grouped[course.category]) {
        grouped[course.category] = [];
      }
      grouped[course.category].push(course);
    });
    return grouped;
  }, [courses, completedCourses, failedCourseIds, whatIfSearchQuery, whatIfGrades]);

  const combinedCourseList = React.useMemo(() => {
    const completed = courses.filter(c => completedCourses.has(c.id));
    const failed = courses.filter(c => failedCourseIds.has(c.id) && !completedCourses.has(c.id));
    return [...completed, ...failed];
  }, [courses, completedCourses, failedCourseIds]);

  const filteredList = React.useMemo(() => {
    const query = searchQuery.toLowerCase();
    return combinedCourseList.filter(c => 
      c.name.toLowerCase().includes(query) || c.id.toLowerCase().includes(query)
    );
  }, [combinedCourseList, searchQuery]);

  const calculateGPA = (grades: Record<string, number>, includeHypothetical: boolean = false) => {
    let totalPoints = 0;
    let totalCredits = 0;
    
    combinedCourseList.forEach(course => {
      let grade = grades[course.id] || 0;

      // "What-if" logic for courses already in the list: 
      // Condition: course grade must be <= 75 to allow what-if logic
      if (includeHypothetical && whatIfGrades[course.id] > 0 && !(courseGrades[course.id] > 75)) {
        grade = whatIfGrades[course.id];
      }

      // We count the course if it has a grade > 0 OR if it's explicitly in the failed list
      // Note: grade 0 is also a grade that should be counted in credits.
      // But we need to distinguish between "no grade entered" and "grade is 0".
      const hasGradeEntry = grades.hasOwnProperty(course.id) || (includeHypothetical && whatIfGrades.hasOwnProperty(course.id));
      
      if (hasGradeEntry || failedCourseIds.has(course.id)) {
        // Exclude "Pass/Fail" (-1) from numeric GPA calculation
        if (grade !== -1) {
          if (grade > 0) {
            totalPoints += grade * course.credits;
          }
          totalCredits += course.credits;
        }
      }
    });

    if (includeHypothetical) {
      (Object.entries(whatIfGrades) as [string, number][]).forEach(([id, grade]) => {
        if (!completedCourses.has(id) && !failedCourseIds.has(id) && grade > 0) {
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

  const currentGPA = React.useMemo(() => calculateGPA(courseGrades), [combinedCourseList, courseGrades]);

  const whatIfGPA = React.useMemo(() => {
    const combinedGrades = { ...courseGrades, ...whatIfGrades };
    return calculateGPA(combinedGrades, true);
  }, [combinedCourseList, courseGrades, whatIfGrades]);

  const totalCompletedCredits = combinedCourseList.reduce((sum, c) => sum + (completedCourses.has(c.id) ? c.credits : 0), 0);
  const creditsWithGrades = combinedCourseList.filter(c => {
    const grade = courseGrades[c.id];
    return (grade !== undefined && grade >= 0) || failedCourseIds.has(c.id);
  }).reduce((sum, c) => sum + c.credits, 0);

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-linear-to-br from-indigo-600 to-blue-700 dark:from-indigo-900 dark:to-blue-900 p-6 rounded-3xl text-white shadow-lg shadow-indigo-200 dark:shadow-none relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendingUp size={80} />
            </div>
            <div className="relative z-10">
              <div className="text-sm font-bold opacity-80 mb-1">المعدل التراكمي الحالي</div>
              <div className="text-4xl font-black mb-4 tracking-tight">
                %{currentGPA.toFixed(2)}
              </div>
              <div className="flex items-center gap-4 text-xs font-bold opacity-90 bg-white/10 p-2 rounded-xl backdrop-blur-sm">
                <div>المجتازة: {totalCompletedCredits}</div>
                <div className="w-px h-3 bg-white/20"></div>
                <div>سجلات: {creditsWithGrades}</div>
              </div>
            </div>
          </div>
 
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Sparkles size={60} />
            </div>
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

          <div className="bg-linear-to-br from-emerald-500 to-teal-600 dark:from-emerald-900 dark:to-teal-900 p-6 rounded-3xl text-white shadow-lg shadow-emerald-200 dark:shadow-none relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Target size={60} />
            </div>
            <div className="relative z-10 h-full flex flex-col">
              <div className="text-sm font-bold opacity-80 mb-1">محاكي المعدل المستهدف</div>
              <div className="flex-1 flex flex-col justify-center gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={targetGPA}
                    onChange={(e) => setTargetGPA(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    className="w-20 bg-white/20 border border-white/30 rounded-lg py-1 px-2 text-white font-black outline-none focus:ring-2 focus:ring-white/50 text-center"
                    placeholder="80.0"
                  />
                  <span className="text-xs font-bold">% هدف</span>
                </div>
                {requiredAverage !== null && (
                  <div className="mt-2">
                    <div className="text-[10px] font-bold opacity-80">المعدل المطلوب في الـ {remainingCredits} س المتبقية:</div>
                    <div className="text-2xl font-black">
                      {requiredAverage > 100 ? "مستحيل!" : `%${requiredAverage.toFixed(2)}`}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Hypothetical Course Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-red-50 dark:bg-red-500/5 rounded-3xl border border-dashed border-red-200 dark:border-red-500/20">
            <div className="flex items-center gap-2 mb-4 text-red-800 dark:text-red-100">
              <PlusCircle size={20} className="text-red-500" />
              <span className="text-sm font-black">إضافة مادة مسجلة (لم تُجتز بعد)</span>
            </div>
            <div className="space-y-4">
               <div className="text-xs text-gray-500 font-bold leading-relaxed">
                 أضف المواد التي سجلتها ولكنك لم تنجح فيها (رسبت) ليتم احتساب ساعاتها في المعدل التراكمي.
               </div>
               
               <div className="relative">
                 <div className="relative">
                   <input 
                     type="text"
                     placeholder="بحث في المواد المتاحة..."
                     value={failedSearchQuery}
                     onChange={(e) => {
                       setFailedSearchQuery(e.target.value);
                       setIsFailedListOpen(true);
                     }}
                     onFocus={() => setIsFailedListOpen(true)}
                     className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl pl-3 pr-10 py-2 text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500 mb-2"
                   />
                   <Search className="absolute right-3 top-2 text-gray-400" size={16} />
                 </div>

                 {isFailedListOpen && (
                   <div className="absolute z-100 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                     {Object.entries(failedAvailableCourses).length === 0 ? (
                       <div className="p-4 text-center text-xs text-gray-400 font-bold">لا توجد مواد مطابقة للبحث</div>
                     ) : (
                       Object.entries(failedAvailableCourses).map(([category, categoryCourses]) => (
                         <div key={category}>
                           <div className="px-3 py-1 bg-gray-50 dark:bg-slate-900/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-y border-gray-100 dark:border-slate-700/50">
                             {category}
                           </div>
                           {(categoryCourses as Course[]).map(c => (
                             <button
                               key={c.id}
                               className="w-full text-right px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center justify-between"
                               onClick={() => {
                                 const next = new Set(failedCourseIds);
                                 next.add(c.id);
                                 setFailedCourseIds(next);
                                 setFailedSearchQuery("");
                                 setIsFailedListOpen(false);
                               }}
                             >
                               <span>{c.name}</span>
                               <span className="text-[10px] opacity-50">{c.credits}س</span>
                             </button>
                           ))}
                         </div>
                       ))
                     )}
                   </div>
                 )}
                 
                 {/* Click outside backdrop for failed list */}
                 {isFailedListOpen && <div className="fixed inset-0 z-90" onClick={() => setIsFailedListOpen(false)} />}
               </div>

               {failedCourseIds.size > 0 && (
                 <div className="space-y-2 mt-4">
                   {Array.from(failedCourseIds).map(id => {
                     const courseId = id as string;
                     const course = courses.find(c => c.id === courseId);
                     if (!course) return null;
                     return (
                       <div key={courseId} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-xl border border-red-100 dark:border-red-900/30">
                         <div className="flex flex-col">
                           <span className="text-[10px] font-bold dark:text-gray-300">{course.name}</span>
                           <span className="text-[8px] text-gray-400 font-bold">{course.credits}س - {courseId}</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <input
                             type="number"
                             min="0"
                             max="100"
                             placeholder="درجة"
                             value={courseGrades[courseId] || ""}
                             onChange={(e) => {
                               const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                               setCourseGrades(prev => ({ ...prev, [courseId]: val }));
                             }}
                             className="w-12 text-center py-1 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-[10px] font-black text-red-600 dark:text-red-400 outline-none focus:ring-1 focus:ring-red-500"
                           />
                           <button
                             onClick={() => {
                               const next = new Set(failedCourseIds);
                               next.delete(id);
                               setFailedCourseIds(next);
                               // Also clear the grade if it's not a completed course
                               if (!completedCourses.has(courseId)) {
                                 setCourseGrades(prev => {
                                   const updated = { ...prev };
                                   delete updated[courseId];
                                   return updated;
                                 });
                               }
                             }}
                             className="text-gray-400 hover:text-red-500 p-1"
                           >
                             <Trash2 size={14} />
                           </button>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               )}
            </div>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-100">
              <PlusCircle size={20} className="text-indigo-500" />
              <span className="text-sm font-black">إضافة علامة متوقعة لمادة لم تُسجل بعد</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
               <div className="text-xs text-gray-500 font-bold leading-relaxed mb-2 w-full">
                 يمكنك إضافة علامة "ماذا لو" لأي مادة في الخطة حتى لو لم تنجزها بعد لترى كيف سيؤثر ذلك على معدلك النهائي.
               </div>
            </div>
            
            <div className="space-y-3">
               <div className="relative">
                 <div className="relative">
                   <input 
                     type="text"
                     placeholder="بحث في المواد المتاحة..."
                     value={whatIfSearchQuery}
                     onChange={(e) => {
                       setWhatIfSearchQuery(e.target.value);
                       setIsWhatIfListOpen(true);
                     }}
                     onFocus={() => setIsWhatIfListOpen(true)}
                     className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl pl-3 pr-10 py-2 text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                   />
                   <Search className="absolute right-3 top-2 text-gray-400" size={16} />
                 </div>

                 {isWhatIfListOpen && (
                   <div className="absolute z-100 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                     {Object.entries(whatIfAvailableCourses).length === 0 ? (
                       <div className="p-4 text-center text-xs text-gray-400 font-bold">لا توجد مواد مطابقة للبحث</div>
                     ) : (
                       Object.entries(whatIfAvailableCourses).map(([category, categoryCourses]) => (
                         <div key={category}>
                           <div className="px-3 py-1 bg-gray-50 dark:bg-slate-900/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-y border-gray-100 dark:border-slate-700/50">
                             {category}
                           </div>
                           {(categoryCourses as Course[]).map(c => (
                             <button
                               key={c.id}
                               className="w-full text-right px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-between"
                               onClick={() => {
                                 setWhatIfGrades(prev => ({ ...prev, [c.id]: 0 }));
                                 setWhatIfSearchQuery("");
                                 setIsWhatIfListOpen(false);
                               }}
                             >
                               <span>{c.name}</span>
                               <span className="text-[10px] opacity-50">{c.credits}س</span>
                             </button>
                           ))}
                         </div>
                       ))
                     )}
                   </div>
                 )}
                 
                 {/* Click outside backdrop for what-if list */}
                 {isWhatIfListOpen && <div className="fixed inset-0 z-90" onClick={() => setIsWhatIfListOpen(false)} />}
               </div>
            </div>

            {/* List of what-if for non-completed courses */}
            <div className="mt-4 space-y-2">
              {(Object.entries(whatIfGrades) as [string, number][])
                .filter(([id]) => !completedCourses.has(id) && !failedCourseIds.has(id))
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
        </div>

        {/* Search and List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
              <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
              قائمة المواد المسجلة
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

          <div className="max-h-75 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {filteredList.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                <Info size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-400 font-bold text-sm">لا يوجد مواد مسجلة مطابقة</p>
              </div>
            ) : (
              filteredList.map(course => (
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
                    <div className="flex flex-col items-center ml-2">
                      <span className={cn(
                        "text-[10px] font-black mb-1 uppercase tracking-tighter",
                        completedCourses.has(course.id) ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                      )}>
                        {completedCourses.has(course.id) ? "مجتازة" : "لم تجتز"}
                      </span>
                      <input
                        type="checkbox"
                        checked={courseGrades[course.id] === -1}
                        disabled={!completedCourses.has(course.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCourseGrades(prev => ({ ...prev, [course.id]: -1 }));
                          } else {
                            setCourseGrades(prev => {
                              const next = { ...prev };
                              delete next[course.id];
                              return next;
                            });
                          }
                        }}
                        className={cn(
                          "w-5 h-5 rounded-lg border-gray-200 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-gray-50 dark:bg-slate-800 transition-all cursor-pointer",
                          !completedCourses.has(course.id) && "opacity-50 cursor-not-allowed"
                        )}
                      />
                    </div>
                    <div className="w-px h-8 bg-gray-100 dark:bg-slate-700 mx-1"></div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-tighter">الدرجة الحالية</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder={courseGrades[course.id] === -1 ? "مجتاز" : "--"}
                        disabled={courseGrades[course.id] === -1}
                        value={courseGrades[course.id] === -1 ? "" : (courseGrades[course.id] || "")}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                          setCourseGrades(prev => ({ ...prev, [course.id]: val }));
                        }}
                        className={cn(
                          "w-16 text-center py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-black text-indigo-600 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500 transition-all",
                          courseGrades[course.id] === -1 && "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-slate-900"
                        )}
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
                        disabled={courseGrades[course.id] > 75}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                          setWhatIfGrades(prev => ({ ...prev, [course.id]: val }));
                        }}
                        className={cn(
                          "w-16 text-center py-1.5 bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/30 rounded-lg text-sm font-black text-orange-600 dark:text-orange-400 outline-none focus:ring-2 focus:ring-orange-500",
                          courseGrades[course.id] > 75 && "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-slate-900"
                        )}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
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
