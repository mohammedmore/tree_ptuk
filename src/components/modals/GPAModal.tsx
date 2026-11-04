import React from "react";
import {
  Calculator,
  TrendingUp,
  Search,
  Info,
  Trash2,
  PlusCircle,
  Sparkles,
  Target,
} from "lucide-react";
import { BaseModal } from "../common/BaseModal";
import type { Course } from "../../data";
import { cn } from "../../utils";
import { TOTAL_CREDITS } from "../../constants";
import { getCachedStudentProfile } from "../../services/studentService";
import {
  isRemedialCourse,
  calculateGPA,
  calculateDegreeCredits,
  calculateRemainingCredits,
} from "../../core/courseProgress";

function groupCoursesByCategory(courses: Course[]): Map<string, Course[]> {
  const grouped = new Map<string, Course[]>();
  courses.forEach((course) => {
    const categoryCourses = grouped.get(course.category);
    if (categoryCourses) {
      categoryCourses.push(course);
    } else {
      grouped.set(course.category, [course]);
    }
  });
  return grouped;
}

function updateGrade(
  setGrades: React.Dispatch<React.SetStateAction<Record<string, number>>>,
  courseId: string,
  value: string,
) {
  if (value === "") {
    setGrades((previous) => {
      const next = { ...previous };
      delete next[courseId];
      return next;
    });
    return;
  }

  const parsedGrade = Number(value);
  if (!Number.isFinite(parsedGrade)) return;
  const grade = Math.min(100, Math.max(0, parsedGrade));
  setGrades((previous) => ({ ...previous, [courseId]: grade }));
}

interface GPAModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  completedCourses: Set<string>;
  courseGrades: Record<string, number>;
  setCourseGrades: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  failedCourseIds: Set<string>;
  setFailedCourseIds: (ids: Set<string>) => void;
  categoryRequirements?: Record<string, number>;
  totalDegreeCredits?: number;
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
  categoryRequirements,
  totalDegreeCredits,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [failedSearchQuery, setFailedSearchQuery] = React.useState("");
  const [whatIfSearchQuery, setWhatIfSearchQuery] = React.useState("");
  const [isFailedListOpen, setIsFailedListOpen] = React.useState(false);
  const [isWhatIfListOpen, setIsWhatIfListOpen] = React.useState(false);
  const [whatIfGrades, setWhatIfGrades] = React.useState<
    Record<string, number>
  >({});
  const [targetGPA, setTargetGPA] = React.useState<number | "">("");
  const coursesById = React.useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );

  const totalCompletedCredits = React.useMemo(() => {
    return calculateDegreeCredits(courses, completedCourses);
  }, [courses, completedCourses]);

  const effectiveTotalCredits = React.useMemo(() => {
    if (totalDegreeCredits && totalDegreeCredits >= 60)
      return totalDegreeCredits;
    const student = getCachedStudentProfile();
    if (
      student?.totalCredits &&
      student.totalCredits >= 60 &&
      student.totalCredits <= 260
    ) {
      return student.totalCredits;
    }
    if (categoryRequirements && Object.keys(categoryRequirements).length > 0) {
      const sum = Object.entries(categoryRequirements).reduce(
        (acc, [cat, val]) => {
          if (cat.includes("استدراكي")) return acc;
          return acc + (Number(val) || 0);
        },
        0,
      );
      if (sum >= 60 && sum <= 260) return sum;
    }
    return TOTAL_CREDITS;
  }, [totalDegreeCredits, categoryRequirements]);

  const remainingCredits = React.useMemo(() => {
    return calculateRemainingCredits(
      totalCompletedCredits,
      effectiveTotalCredits,
    );
  }, [totalCompletedCredits, effectiveTotalCredits]);

  const requiredAverage = React.useMemo(() => {
    if (targetGPA === "" || targetGPA <= 0 || remainingCredits <= 0)
      return null;

    let currentTotalPoints = 0;

    courses.forEach((c) => {
      if (
        completedCourses.has(c.id) &&
        !isRemedialCourse(c) &&
        courseGrades[c.id] > 0 &&
        courseGrades[c.id] !== -1
      ) {
        currentTotalPoints += courseGrades[c.id] * c.credits;
      }
    });

    const neededPoints = targetGPA * effectiveTotalCredits - currentTotalPoints;

    if (neededPoints <= 0) return 0;

    return neededPoints / remainingCredits;
  }, [
    targetGPA,
    remainingCredits,
    courses,
    completedCourses,
    courseGrades,
    effectiveTotalCredits,
  ]);

  const failedAvailableCourses = React.useMemo(() => {
    const query = failedSearchQuery.toLowerCase();
    const available = courses.filter(
      (c) =>
        !completedCourses.has(c.id) &&
        !failedCourseIds.has(c.id) &&
        (c.name.toLowerCase().includes(query) ||
          c.id.toLowerCase().includes(query)),
    );
    return groupCoursesByCategory(available);
  }, [courses, completedCourses, failedCourseIds, failedSearchQuery]);

  const whatIfAvailableCourses = React.useMemo(() => {
    const query = whatIfSearchQuery.toLowerCase();
    const available = courses.filter(
      (c) =>
        !completedCourses.has(c.id) &&
        !failedCourseIds.has(c.id) &&
        !Object.prototype.hasOwnProperty.call(whatIfGrades, c.id) &&
        (c.name.toLowerCase().includes(query) ||
          c.id.toLowerCase().includes(query)),
    );
    return groupCoursesByCategory(available);
  }, [
    courses,
    completedCourses,
    failedCourseIds,
    whatIfSearchQuery,
    whatIfGrades,
  ]);

  const combinedCourseList = React.useMemo(() => {
    const completed = courses.filter((c) => completedCourses.has(c.id));
    const failed = courses.filter(
      (c) => failedCourseIds.has(c.id) && !completedCourses.has(c.id),
    );
    return [...completed, ...failed];
  }, [courses, completedCourses, failedCourseIds]);

  const filteredList = React.useMemo(() => {
    const query = searchQuery.toLowerCase();
    return combinedCourseList.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query),
    );
  }, [combinedCourseList, searchQuery]);

  const currentGPA = React.useMemo(
    () =>
      calculateGPA(courses, courseGrades, completedCourses, failedCourseIds),
    [courses, courseGrades, completedCourses, failedCourseIds],
  );

  const whatIfGPA = React.useMemo(() => {
    return calculateGPA(
      courses,
      courseGrades,
      completedCourses,
      failedCourseIds,
      whatIfGrades,
      true,
    );
  }, [courses, courseGrades, completedCourses, failedCourseIds, whatIfGrades]);

  const creditsWithGrades = combinedCourseList
    .filter((c) => {
      if (isRemedialCourse(c)) return false;
      const grade = courseGrades[c.id];
      return (grade !== undefined && grade >= 0) || failedCourseIds.has(c.id);
    })
    .reduce((sum, c) => sum + c.credits, 0);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-5xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
            <Calculator size={20} />
          </div>
          <div>
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              حساب المعدل والتحصيل الأكاديمي
            </div>
          </div>
        </div>
      }
    >
      <div className="p-3 sm:p-5 space-y-4 sm:space-y-6" dir="rtl">
        {/* GPA Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                المعدل التراكمي الفعلي
              </div>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-3 tracking-tight">
                %{currentGPA.toFixed(2)}
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-800">
              <div>
                الساعات المجتازة:{" "}
                <strong className="font-semibold text-slate-700 dark:text-slate-200">
                  {totalCompletedCredits}
                </strong>
              </div>
              <div className="w-px h-3 bg-slate-300 dark:bg-slate-700" />
              <div>
                ساعات بعلامات:{" "}
                <strong className="font-semibold text-slate-700 dark:text-slate-200">
                  {creditsWithGrades}
                </strong>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-1">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                المعدل التقديري ("ماذا لو")
              </div>
              <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded text-[10px] font-medium">
                تقديري
              </span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-3 tracking-tight">
              %{whatIfGPA.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200/60 dark:border-slate-800">
              بناءً على العلامات الحالية مع التوقعات المدخلة
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              محاكي المعدل المستهدف
            </div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={targetGPA}
                aria-label="المعدل المستهدف"
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "") {
                    setTargetGPA("");
                    return;
                  }
                  const parsedValue = Number(value);
                  if (Number.isFinite(parsedValue)) {
                    setTargetGPA(Math.min(100, Math.max(0, parsedValue)));
                  }
                }}
                className="w-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-1 px-2 text-slate-900 dark:text-slate-100 font-semibold outline-none focus:border-slate-400 dark:focus:border-slate-500 text-center text-sm"
                placeholder="80.0"
              />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                % الهدف
              </span>
            </div>
            {requiredAverage !== null && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">
                  المطلوب في {remainingCredits}س:{" "}
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {requiredAverage > 100
                    ? "يتجاوز 100%"
                    : `%${requiredAverage.toFixed(2)}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Hypothetical Course Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3 text-slate-800 dark:text-slate-200">
              <PlusCircle size={16} className="text-rose-500" />
              <span className="text-xs font-semibold">
                إضافة مادة مسجلة (لم تُجتز بعد)
              </span>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <div className="relative">
                  <input
                    type="text"
                    aria-label="البحث عن مواد لإضافتها إلى قائمة الرسوب"
                    aria-expanded={isFailedListOpen}
                    aria-controls="failed-course-options"
                    placeholder="بحث في المواد المتاحة..."
                    value={failedSearchQuery}
                    onChange={(e) => {
                      setFailedSearchQuery(e.target.value);
                      setIsFailedListOpen(true);
                    }}
                    onFocus={() => setIsFailedListOpen(true)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-9 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 mb-2"
                  />
                  <Search
                    className="absolute right-3 top-2 text-slate-400"
                    size={14}
                  />
                </div>

                {isFailedListOpen && (
                  <div
                    id="failed-course-options"
                    className="absolute z-100 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar"
                  >
                    {failedAvailableCourses.size === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400 font-bold">
                        لا توجد مواد مطابقة للبحث
                      </div>
                    ) : (
                      Array.from(failedAvailableCourses).map(
                        ([category, categoryCourses]) => (
                          <div key={category}>
                            <div className="px-3 py-1 bg-gray-50 dark:bg-slate-900/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-y border-gray-100 dark:border-slate-700/50">
                              {category}
                            </div>
                            {categoryCourses.map((c) => (
                              <button
                                key={c.id}
                                type="button"
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
                                <span className="text-[10px] opacity-50">
                                  {c.credits}س
                                </span>
                              </button>
                            ))}
                          </div>
                        ),
                      )
                    )}
                  </div>
                )}

                {/* Click outside backdrop for failed list */}
                {isFailedListOpen && (
                  <button
                    type="button"
                    aria-label="إغلاق قائمة مواد الرسوب"
                    className="fixed inset-0 z-90 border-0 bg-transparent p-0"
                    onClick={() => setIsFailedListOpen(false)}
                  />
                )}
              </div>

              {failedCourseIds.size > 0 && (
                <div className="space-y-2 mt-4">
                  {Array.from(failedCourseIds).map((id) => {
                    const courseId = id;
                    const course = coursesById.get(courseId);
                    if (!course) return null;
                    return (
                      <div
                        key={courseId}
                        className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-xl border border-red-100 dark:border-red-900/30"
                      >
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold dark:text-gray-300">
                            {course.name}
                          </span>
                          <span className="text-[8px] text-gray-400 font-bold">
                            {course.credits}س - {courseId}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="درجة"
                            aria-label={`درجة الرسوب في ${course.name}`}
                            value={courseGrades[courseId] ?? ""}
                            onChange={(event) =>
                              updateGrade(
                                setCourseGrades,
                                courseId,
                                event.target.value,
                              )
                            }
                            className="w-12 text-center py-1 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-[10px] font-black text-red-600 dark:text-red-400 outline-none focus:ring-1 focus:ring-red-500"
                          />
                          <button
                            type="button"
                            aria-label={`إزالة ${course.name} من قائمة الرسوب`}
                            onClick={() => {
                              const next = new Set(failedCourseIds);
                              next.delete(id);
                              setFailedCourseIds(next);
                              // Also clear the grade if it's not a completed course
                              if (!completedCourses.has(courseId)) {
                                setCourseGrades((prev) => {
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

          <div className="p-4 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3 text-slate-800 dark:text-slate-200">
              <PlusCircle size={16} className="text-amber-500" />
              <span className="text-xs font-semibold">
                إضافة علامة متوقعة لمادة لم تُسجل بعد
              </span>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <div className="relative">
                  <input
                    type="text"
                    aria-label="البحث عن مواد لإضافة علامة افتراضية"
                    aria-expanded={isWhatIfListOpen}
                    aria-controls="what-if-course-options"
                    placeholder="بحث في المواد المتاحة..."
                    value={whatIfSearchQuery}
                    onChange={(e) => {
                      setWhatIfSearchQuery(e.target.value);
                      setIsWhatIfListOpen(true);
                    }}
                    onFocus={() => setIsWhatIfListOpen(true)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-9 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500"
                  />
                  <Search
                    className="absolute right-3 top-2 text-slate-400"
                    size={14}
                  />
                </div>

                {isWhatIfListOpen && (
                  <div
                    id="what-if-course-options"
                    className="absolute z-100 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar"
                  >
                    {whatIfAvailableCourses.size === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400 font-bold">
                        لا توجد مواد مطابقة للبحث
                      </div>
                    ) : (
                      Array.from(whatIfAvailableCourses).map(
                        ([category, categoryCourses]) => (
                          <div key={category}>
                            <div className="px-3 py-1 bg-gray-50 dark:bg-slate-900/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-y border-gray-100 dark:border-slate-700/50">
                              {category}
                            </div>
                            {categoryCourses.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                className="w-full text-right px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-between"
                                onClick={() => {
                                  setWhatIfGrades((prev) => ({
                                    ...prev,
                                    [c.id]: 0,
                                  }));
                                  setWhatIfSearchQuery("");
                                  setIsWhatIfListOpen(false);
                                }}
                              >
                                <span>{c.name}</span>
                                <span className="text-[10px] opacity-50">
                                  {c.credits}س
                                </span>
                              </button>
                            ))}
                          </div>
                        ),
                      )
                    )}
                  </div>
                )}

                {/* Click outside backdrop for what-if list */}
                {isWhatIfListOpen && (
                  <button
                    type="button"
                    aria-label="إغلاق قائمة المواد الافتراضية"
                    className="fixed inset-0 z-90 border-0 bg-transparent p-0"
                    onClick={() => setIsWhatIfListOpen(false)}
                  />
                )}
              </div>
            </div>

            {/* List of what-if for non-completed courses */}
            <div className="mt-4 space-y-2">
              {Object.entries(whatIfGrades)
                .filter(
                  ([id]) =>
                    !completedCourses.has(id) && !failedCourseIds.has(id),
                )
                .map(([id, grade]) => {
                  const course = coursesById.get(id);
                  if (!course) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-orange-100 dark:border-orange-500/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-black text-gray-700 dark:text-gray-200">
                          {course.name}
                        </div>
                        <div className="text-[10px] font-bold text-gray-500 dark:text-slate-400">
                          {course.credits}س
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          aria-label={`العلامة الافتراضية في ${course.name}`}
                          value={grade}
                          onChange={(event) =>
                            updateGrade(setWhatIfGrades, id, event.target.value)
                          }
                          className="w-14 text-center py-1 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-lg text-xs font-black text-orange-600 dark:text-orange-400 outline-none"
                        />
                        <button
                          type="button"
                          aria-label={`إزالة توقع ${course.name}`}
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

        {/* Search and Table */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
              قائمة المواد المسجلة والدرجات
            </h3>
            <div className="relative w-full sm:w-64">
              <Search
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                type="text"
                aria-label="البحث عن المواد المسجلة"
                placeholder="ابحث عن مادة أو رمز..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-8 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
              />
            </div>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="جدول المواد والدرجات"
            className="overflow-x-auto max-h-80 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 custom-scrollbar"
          >
            {filteredList.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                لا توجد مواد مسجلة مطابقة للبحث
              </div>
            ) : (
              <table className="w-full border-collapse text-right text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 z-10 border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="py-2.5 px-3">
                      المساق
                    </th>
                    <th scope="col" className="py-2.5 px-3 text-center">
                      الساعات
                    </th>
                    <th scope="col" className="py-2.5 px-3 text-center">
                      الحالة
                    </th>
                    <th scope="col" className="py-2.5 px-3 text-center">
                      ناجح/راسب
                    </th>
                    <th scope="col" className="py-2.5 px-3 text-center">
                      الدرجة الفعلية
                    </th>
                    <th scope="col" className="py-2.5 px-3 text-center">
                      توقع (ماذا لو)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredList.map((course) => {
                    const isCompleted = completedCourses.has(course.id);
                    const isPassFail = courseGrades[course.id] === -1;
                    return (
                      <tr
                        key={course.id}
                        className="hover:bg-slate-500/[0.035] transition-colors"
                      >
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {course.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                            {course.id}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                          {course.credits}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={cn(
                              "inline-block px-2 py-0.5 rounded text-[10px] font-medium",
                              isCompleted
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                                : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400",
                            )}
                          >
                            {isCompleted ? "مجتازة" : "لم تجتز"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            aria-label={`تحديد ${course.name} كمادة ناجحة بنظام ناجح أو راسب`}
                            checked={isPassFail}
                            disabled={!isCompleted}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCourseGrades((prev) => ({
                                  ...prev,
                                  [course.id]: -1,
                                }));
                              } else {
                                setCourseGrades((prev) => {
                                  const next = { ...prev };
                                  delete next[course.id];
                                  return next;
                                });
                              }
                            }}
                            className={cn(
                              "h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-slate-700 focus:ring-0 cursor-pointer accent-slate-700 dark:accent-slate-400",
                              !isCompleted && "opacity-40 cursor-not-allowed",
                            )}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            aria-label={`الدرجة الحالية في ${course.name}`}
                            placeholder={isPassFail ? "مجتاز" : "--"}
                            disabled={isPassFail}
                            value={
                              isPassFail ? "" : (courseGrades[course.id] ?? "")
                            }
                            onChange={(event) =>
                              updateGrade(
                                setCourseGrades,
                                course.id,
                                event.target.value,
                              )
                            }
                            className={cn(
                              "w-16 text-center py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500",
                              isPassFail &&
                                "opacity-40 cursor-not-allowed bg-transparent",
                            )}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            aria-label={`العلامة الافتراضية في ${course.name}`}
                            placeholder="--"
                            value={whatIfGrades[course.id] ?? ""}
                            disabled={courseGrades[course.id] > 75}
                            onChange={(event) =>
                              updateGrade(
                                setWhatIfGrades,
                                course.id,
                                event.target.value,
                              )
                            }
                            className={cn(
                              "w-16 text-center py-1 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded text-xs font-semibold text-amber-700 dark:text-amber-400 outline-none focus:border-amber-400",
                              courseGrades[course.id] > 75 &&
                                "opacity-40 cursor-not-allowed bg-transparent border-slate-200 dark:border-slate-800 text-slate-400",
                            )}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex justify-center pt-1">
          <button
            type="button"
            aria-label="إعادة تعيين جميع علامات ماذا لو"
            onClick={() => setWhatIfGrades({})}
            className="text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 size={13} />
            إعادة تعيين حسابات "ماذا لو"
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

export default GPAModal;
