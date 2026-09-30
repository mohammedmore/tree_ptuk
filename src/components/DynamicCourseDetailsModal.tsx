import React from "react";
import { X, CalendarDays, CircleCheckBig, Trash2 } from "lucide-react";
import { cn } from "../utils";
import type { Course } from "../data";
import { courses } from "../data";
import { getCourseDetails } from "../courseExplanations";
import { SEMESTERS } from "../constants";
import {
  formatOfferings,
  getSemesterType,
  isCourseAvailableInSemester,
} from "../courseOfferings";

const coursesById = new Map(courses.map((course) => [course.id, course]));

interface DynamicCourseDetailsModalProps {
  isPlannerOpen: boolean;
  plannerSelectedCourse: Course | null;
  setPlannerSelectedCourse: (course: Course | null) => void;
  completedCourses: Set<string>;
  plannedCourses: Record<string, string>;
  setPlannedCourses: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isRescheduling: boolean;
  setIsRescheduling: React.Dispatch<React.SetStateAction<boolean>>;
  planStartSemester: string;
  planEndSemester: string;
  toggleCourseCompletion: (courseId: string) => void;
}

const DynamicCourseDetailsModal: React.FC<DynamicCourseDetailsModalProps> = ({
  isPlannerOpen,
  plannerSelectedCourse,
  setPlannerSelectedCourse,
  completedCourses,
  plannedCourses,
  setPlannedCourses,
  isRescheduling,
  setIsRescheduling,
  planStartSemester,
  planEndSemester,
  toggleCourseCompletion,
}) => {
  const closeModal = React.useCallback(() => {
    setPlannerSelectedCourse(null);
    setIsRescheduling(false);
  }, [setPlannerSelectedCourse, setIsRescheduling]);

  React.useEffect(() => {
    if (!isPlannerOpen || !plannerSelectedCourse) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPlannerSelectedCourse(null);
        setIsRescheduling(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlannerOpen, plannerSelectedCourse, setPlannerSelectedCourse, setIsRescheduling]);

  if (!isPlannerOpen || !plannerSelectedCourse) return null;

  const details = getCourseDetails(
    plannerSelectedCourse,
    courses,
    completedCourses,
  );
  const isComp = completedCourses.has(plannerSelectedCourse.id);
  const prerequisites = plannerSelectedCourse.prerequisites;
  const dependentCourses = courses.filter((c) =>
    c.prerequisites.includes(plannerSelectedCourse.id),
  );

  const foundPlanStartIdx = SEMESTERS.indexOf(planStartSemester);
  const foundPlanEndIdx = SEMESTERS.indexOf(planEndSemester);
  const planStartIdx = foundPlanStartIdx >= 0 ? foundPlanStartIdx : 0;
  const planEndIdx = foundPlanEndIdx >= 0 ? foundPlanEndIdx : SEMESTERS.length - 1;

  // Active uncompleted prerequisites sems:
  const activePrereqs = prerequisites.filter(
    (preId) => !completedCourses.has(preId),
  );
  const prereqsWithSem = activePrereqs
    .map((preId) => ({
      id: preId,
      name: coursesById.get(preId)?.name || preId,
      sem: plannedCourses[preId],
    }))
    .filter((item) => item.sem && SEMESTERS.includes(item.sem));

  const maxPrereqIndex =
    prereqsWithSem.length > 0
      ? Math.max(...prereqsWithSem.map((item) => SEMESTERS.indexOf(item.sem)))
      : -1;

  // Dependent courses planned but not completed:
  const activeDeps = dependentCourses.filter(
    (dep) => !completedCourses.has(dep.id),
  );
  const depsWithSem = activeDeps
    .map((dep) => ({
      id: dep.id,
      name: dep.name,
      sem: plannedCourses[dep.id],
    }))
    .filter((item) => item.sem && SEMESTERS.includes(item.sem));

  const minDepIndex =
    depsWithSem.length > 0
      ? Math.min(...depsWithSem.map((item) => SEMESTERS.indexOf(item.sem)))
      : SEMESTERS.length;

  // Filter valid semesters which do not cause delays/conflict
  const validSemesters = SEMESTERS.filter((semName, idx) => {
    return (
      idx >= planStartIdx &&
      idx <= planEndIdx &&
      idx > maxPrereqIndex &&
      idx < minDepIndex &&
      isCourseAvailableInSemester(
        plannerSelectedCourse.id,
        getSemesterType(semName) ?? "",
      )
    );
  });
  let critBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let critLabel = "مسار مرن وقابل للتأجيل";
  if (details.criticality === "high") {
    critBg = "bg-rose-50 text-rose-700 border-rose-200 animate-pulse";
    critLabel = "سلسلة حرجة - الأولوية القصوى";
  } else if (details.criticality === "medium") {
    critBg = "bg-amber-50 text-amber-700 border-amber-200";
    critLabel = "أهمية متوسطة - ينصح بالالتزام";
  }

  return (
    <div
      className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
      onClick={closeModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="planner-course-details-title"
        className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 flex flex-col gap-3.5 relative animate-in zoom-in-95 duration-200 text-right font-sans max-h-[90vh] overflow-y-auto"
        dir="rtl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="إغلاق تفاصيل المادة"
          onClick={closeModal}
          className="absolute top-4 left-4 p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          <X size={18} />
        </button>

        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap justify-start">
            <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md tracking-wider">
              {plannerSelectedCourse.id}
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold">
              {plannerSelectedCourse.category}
            </span>
            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-bold">
              {plannerSelectedCourse.credits} ساعات
            </span>
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border",
                details.difficulty >= 8
                  ? "bg-red-50 text-red-700 border-red-200"
                  : details.difficulty >= 6
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-105",
              )}
            >
              🔥 درجة الصعوبة: {details.difficulty}/10
            </span>
          </div>
          <h3 id="planner-course-details-title" className="text-xl font-black text-gray-950 dark:text-slate-100 leading-tight text-right">
            {plannerSelectedCourse.name}
          </h3>
          <div
            className="mt-2 flex items-center justify-end gap-1"
            aria-label={`درجة صعوبة المادة ${details.difficulty} من 10`}
          >
            <span className="text-[10px] font-bold text-gray-400 ml-1">مؤشر الصعوبة:</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                aria-hidden="true"
                className={cn(
                  "w-6 h-6 rounded-md text-[10px] font-black flex items-center justify-center",
                  details.difficulty >= star * 2
                    ? "bg-amber-100 text-amber-600 border border-amber-200"
                    : "bg-gray-50 text-gray-300 border border-gray-100"
                )}
              >
                ★
              </span>
            ))}
          </div>
        </div>

        <div
          className={`text-xs font-bold px-3 py-1 bg-gray-50 dark:bg-slate-950/20 rounded-xl border text-right ${details.trackColor}`}
        >
          المسار الأكاديمي: {details.trackName}
        </div>

        {plannerSelectedCourse.availableSemesters && (
          <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-3 text-right">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays size={14} className="text-purple-600 dark:text-purple-400" />
              <h4 className="text-xs font-black text-purple-600 dark:text-purple-400">فترات طرح المساق</h4>
            </div>
            <p className="text-xs text-purple-900 dark:text-purple-200 font-semibold">
              {formatOfferings(plannerSelectedCourse.availableSemesters)}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider text-right">
            تفاصيل المساق والشرح الفني:
          </h4>
          <p className="text-xs text-slate-705 dark:text-slate-300 leading-relaxed font-semibold bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100/60 dark:border-slate-800 text-right whitespace-pre-line">
            {details.description}
          </p>
        </div>

        <div className="border-t border-gray-100 pt-2.5 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 justify-start">
            <span
              className={`text-xs font-black px-2.5 py-1 rounded-lg border ${critBg}`}
            >
              {critLabel}
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-normal font-semibold text-right">
            {details.criticalityReason}
          </p>
          <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-2.5 text-xs text-orange-950 font-semibold leading-relaxed text-right">
            💡 {details.advice}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-2.5 flex flex-col gap-1.5 text-right">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="text-[11px] font-bold text-gray-400">
              الفصل الدراسي المخطط له:
            </div>
            <span className="text-[11px] font-extrabold text-indigo-750 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100">
              {plannedCourses[plannerSelectedCourse.id] || "غير مجدول"}
            </span>
          </div>

          {!isRescheduling ? (
            <button
              type="button"
              aria-expanded={isRescheduling}
              onClick={() => setIsRescheduling(true)}
              className="w-full py-1.5 px-3 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <CalendarDays size={14} className="text-indigo-600" />
              تغيير موعد المادة (ترحيل أو نقل لفصل آخر)
            </button>
          ) : (
            <div className="flex flex-col gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-150 animate-in fade-in duration-200 text-right">
              <div
                className={cn(
                  "p-2 rounded-lg text-[10px] leading-relaxed border font-semibold text-right",
                  details.criticality === "high"
                    ? "bg-rose-50 text-rose-800 border-rose-150"
                    : details.criticality === "medium"
                      ? "bg-amber-50 text-amber-800 border-amber-150"
                      : "bg-emerald-50 text-emerald-800 border-emerald-150",
                )}
              >
                {details.criticality === "high" ? (
                  <span>
                    ⚠️ <strong>مادة ضمن السلسلة الحرجة!</strong> تأجيل
                    هذه المادة أو نقلها لفصل متأخر جداً قد يعطل تخريجك
                    فوراً لأنها متطلب سابق لـ {dependentCourses.length}{" "}
                    مساقات تالية. يرجى محاولة حجزها في أقرب وقت.
                  </span>
                ) : details.criticality === "medium" ? (
                  <span>
                    👍 <strong>مساق متوسط الأهمية:</strong> يفتح مساقاً
                    تالياً واحداً. ننصح بتوزيعه بعناية دون تركه للفصول
                    النهائية.
                  </span>
                ) : (
                  <span>
                    ✨ <strong>مادة مرنة ولطيفة:</strong> ليس لها
                    متطلبات لاحقة! تستطيع نقلها، تأجيلها، أو حجزها في أي
                    فصل صيفي لرفع العبء الدراسي دون القلق من حدوث Block.
                  </span>
                )}
              </div>

              <div className="text-[10px] text-gray-500 font-bold mb-0.5">
                الفصول المتاحة لك فقط (ولا تسبب أي تعارض أو تأخير):
              </div>

              {validSemesters.length === 0 ? (
                <div className="p-2.5 bg-red-55 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-rose-950 dark:text-rose-200 rounded-xl text-xs font-bold leading-relaxed">
                  🚨 عذراً، لا تتوفر فصول بديلة ضمن نطاق خطتك دون التسبب
                  بتأخير! هذه المادة محصورة تماماً:
                  {prereqsWithSem.length > 0 && (
                    <div className="mt-1 text-[11px] text-rose-900 dark:text-rose-400">
                      • يجب أن تُؤخذ بعد متطلبها السابق المجدول:{" "}
                      {prereqsWithSem
                        .map((x) => `"${x.name}" (${x.sem})`)
                        .join("، ")}
                    </div>
                  )}
                  {depsWithSem.length > 0 && (
                    <div className="mt-1 text-[11px] text-rose-900 dark:text-rose-400">
                      • يجب أن تُؤخذ قبل مادتها التابعة المجدولة:{" "}
                      {depsWithSem
                        .map((x) => `"${x.name}" (${x.sem})`)
                        .join("، ")}
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-h-[140px] overflow-y-auto border border-gray-150 dark:border-slate-800 rounded-lg divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900 shadow-inner">
                  {validSemesters.map((semName) => {
                    const isCurrent =
                      plannedCourses[plannerSelectedCourse.id] ===
                      semName;
                    return (
                      <button
                        key={semName}
                        type="button"
                        onClick={() => {
                          setPlannedCourses((prev) => ({
                            ...prev,
                            [plannerSelectedCourse.id]: semName,
                          }));
                          setIsRescheduling(false);
                        }}
                        className={cn(
                          "w-full text-right p-2.5 text-[11px] font-semibold flex items-center justify-between transition-colors",
                          isCurrent
                            ? "bg-indigo-50/70 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-bold"
                            : "hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-750 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400",
                        )}
                      >
                        <span>{semName}</span>
                        {isCurrent && (
                          <span className="text-[9px] bg-indigo-600 text-white font-bold px-1.5 py-0.2 rounded">
                            الحالي
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsRescheduling(false)}
                className="w-full text-center font-bold text-[10px] text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 mt-0.5"
              >
                إلغاء و تراجع
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 dark:border-slate-800 pt-2.5 grid grid-cols-2 gap-3 text-[11px] font-semibold">
          <div className="bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-right">
            <div className="text-gray-400 font-bold mb-1 col-span-1">
              المتطلبات السابقة:
            </div>
            {prerequisites.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {prerequisites.map((preId) => {
                  const preName =
                    coursesById.get(preId)?.name ||
                    preId;
                  return (
                    <span
                      key={preId}
                      className={
                        completedCourses.has(preId)
                          ? "text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-bold text-right"
                          : "text-gray-550 dark:text-slate-400 font-bold text-right"
                      }
                    >
                      {completedCourses.has(preId) ? "✓" : "○"}{" "}
                      {preName}
                    </span>
                  );
                })}
              </div>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded text-[10px] inline-block mt-0.5">
                لا يوجد (مساق تأسيسي)
              </span>
            )}
          </div>

          <div className="bg-indigo-50/20 dark:bg-indigo-950/10 p-2.5 rounded-xl border border-indigo-100/40 dark:border-indigo-900/30 text-right">
            <div className="text-gray-400 font-bold mb-1">
              يفتح هذا المساق مستقبلاً:
            </div>
            {dependentCourses.length > 0 ? (
              <div className="flex flex-col gap-0.5 max-h-[80px] overflow-y-auto w-full text-right">
                {dependentCourses.slice(0, 4).map((dep) => (
                  <span
                    key={dep.id}
                    className="text-indigo-850 dark:text-indigo-300 font-bold whitespace-nowrap overflow-hidden text-ellipsis block text-right"
                  >
                    • {dep.name}
                  </span>
                ))}
                {dependentCourses.length > 4 && (
                  <span className="text-slate-450 dark:text-slate-500 text-[10px] text-right">
                    وغيرها من المساقات...
                  </span>
                )}
              </div>
            ) : (
              <span className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded text-[10px] block text-center mt-1">
                مساق ورقة نهائية / لا يعطل شيئاً
              </span>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-slate-800 pt-3 flex gap-2">
          <button
            type="button"
            aria-label={isComp ? "إلغاء تحديد المادة كمكتملة" : "تحديد المادة كمكتملة"}
            onClick={() => {
              toggleCourseCompletion(plannerSelectedCourse.id);
            }}
            className={cn(
              "flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm border-0",
              isComp
                ? "bg-red-50 dark:bg-red-950/40 text-red-650 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20 shadow-md disabled:opacity-50",
            )}
          >
            {isComp ? <Trash2 size={14} /> : <CircleCheckBig size={14} />}
            {isComp ? "إلغاء المادة كمنجزة" : "تحديد كمادة منجزة"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DynamicCourseDetailsModal;
