import React, { useState, useMemo } from "react";
import {
  X,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  ArrowRightLeft,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  BookOpen,
} from "lucide-react";
import type { Course, ScheduleEntry } from "../../data";
import { fetchCourses } from "../../services/courseService";
import type { CatalogCourse } from "../../services/scheduleSolver";
import { triggerHaptic } from "../../utils/haptics";

export interface CourseComparisonDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  completedCourses: Set<string>;
  plannedCourses: Record<string, string>;
  onToggleComplete: (courseId: string) => void;
  onPlanCourse: (courseId: string) => void;
  initialCourseA?: Course | null;
  initialCourseB?: Course | null;
}

export const CourseComparisonDrawer: React.FC<CourseComparisonDrawerProps> = ({
  isOpen,
  onClose,
  courses,
  completedCourses,
  plannedCourses,
  onToggleComplete,
  onPlanCourse,
  initialCourseA,
  initialCourseB,
}) => {
  // Filter electives by default
  const electiveCourses = useMemo(() => {
    return courses.filter(
      (c) =>
        c.category.includes("اختياري") ||
        c.category.includes("جامعة") ||
        c.category.includes("تخصص"),
    );
  }, [courses]);

  const [courseAId, setCourseAId] = useState<string>(
    initialCourseA?.id || electiveCourses[0]?.id || courses[0]?.id || "",
  );
  const [courseBId, setCourseBId] = useState<string>(
    initialCourseB?.id || electiveCourses[1]?.id || courses[1]?.id || "",
  );

  React.useEffect(() => {
    if (isOpen) {
      if (initialCourseA?.id) setCourseAId(initialCourseA.id);
      if (initialCourseB?.id) setCourseBId(initialCourseB.id);
    }
  }, [isOpen, initialCourseA?.id, initialCourseB?.id]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  const courseA = useMemo(
    () => courses.find((c) => c.id === courseAId) || null,
    [courses, courseAId],
  );
  const courseB = useMemo(
    () => courses.find((c) => c.id === courseBId) || null,
    [courses, courseBId],
  );

  if (!isOpen) return null;

  const handleSwapSelection = () => {
    triggerHaptic("swap");
    const temp = courseAId;
    setCourseAId(courseBId);
    setCourseBId(temp);
  };

  const renderCourseColumn = (c: Course | null, slot: "A" | "B") => {
    if (!c) {
      return (
        <div className="flex-1 p-6 text-center text-xs text-[var(--text-3)] border border-dashed border-[var(--line)] rounded-xl">
          اختر مساقاً للمقارنة
        </div>
      );
    }

    const isCompleted = completedCourses.has(c.id);
    const isPlanned = Boolean(plannedCourses[c.id]);
    const prereqs = c.prerequisites || [];

    const prereqStatus = prereqs.map((prereqId) => {
      const pCourse = courses.find((p) => p.id === prereqId);
      const satisfied = completedCourses.has(prereqId);
      return {
        id: prereqId,
        name: pCourse?.name || prereqId,
        satisfied,
      };
    });

    const allPrereqsMet = prereqStatus.every((p) => p.satisfied);

    return (
      <div className="flex-1 flex flex-col bg-[var(--sunken)]/40 rounded-xl p-4 border border-[var(--line)] space-y-4">
        {/* Course Header */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-[var(--accent)] px-2 py-0.5 rounded bg-[var(--accent)]/10">
              {c.id}
            </span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isCompleted
                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                  : isPlanned
                    ? "bg-sky-500/20 text-sky-700 dark:text-sky-400"
                    : allPrereqsMet
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-rose-500/10 text-rose-600"
              }`}
            >
              {isCompleted
                ? "منجزة ✓"
                : isPlanned
                  ? `مخططة (${plannedCourses[c.id]})`
                  : allPrereqsMet
                    ? "متاحة للتسجيل"
                    : "متطلب غير مكتمل"}
            </span>
          </div>
          <h4 className="font-bold text-[15px] text-[var(--text)] leading-snug">
            {c.name}
          </h4>
          <p className="text-xs text-[var(--text-3)]">{c.category}</p>
        </div>

        {/* Matrix Comparison Data */}
        <div className="space-y-2 text-xs divide-y divide-[var(--line)]">
          <div className="flex items-center justify-between pt-2">
            <span className="text-[var(--text-3)]">الساعات المعتمدة:</span>
            <span className="font-bold text-[var(--text)]">
              {c.credits} ساعات
            </span>
          </div>

          <div className="pt-2 space-y-1">
            <span className="text-[var(--text-3)] block">
              المتطلبات السابقة:
            </span>
            {prereqStatus.length === 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold block text-[11px]">
                لا توجد متطلبات سابقة (متاح مباشرة)
              </span>
            ) : (
              <div className="space-y-1">
                {prereqStatus.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-[11px] bg-[var(--surface)] p-1.5 rounded border border-[var(--line)]"
                  >
                    <span className="truncate max-w-[140px]">{p.name}</span>
                    <span
                      className={`font-bold ${
                        p.satisfied
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {p.satisfied ? "مستوفى ✓" : "غير مستوفى ✕"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[var(--text-3)]">طبيعة المساق:</span>
            <span className="font-bold text-[var(--text)]">
              {c.category.includes("عملي") || c.name.includes("مختبر")
                ? "عملي / تطبيقي"
                : "نظري أكاديمي"}
            </span>
          </div>

          <div className="pt-2">
            <span className="text-[var(--text-3)] block mb-1">
              وصف المساق ومحتواه:
            </span>
            <p className="text-[11px] text-[var(--text-2)] leading-relaxed bg-[var(--surface)] p-2 rounded border border-[var(--line)]">
              {(c as any).description ||
                `مساق معتمد ضمن الخطة الدراسية يركز على تزويد الطالب بالمعارف والمهارات الأساسية في مجال «${c.name}».`}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-2 mt-auto">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onPlanCourse(c.id);
            }}
            className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isPlanned
                ? "bg-rose-500/15 text-rose-600 hover:bg-rose-500/25"
                : "bg-[var(--accent)] text-[var(--text-on-accent)] hover:opacity-90 shadow-xs"
            }`}
          >
            {isPlanned ? (
              <>
                <Trash2 size={13} />
                <span>إزالة من الخطة</span>
              </>
            ) : (
              <>
                <Plus size={13} />
                <span>اختيار وإضافة للخطة</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("success");
              onToggleComplete(c.id);
            }}
            className="w-full py-1.5 px-3 rounded-lg border border-[var(--line-control)] text-xs text-[var(--text-2)] hover:bg-[var(--surface)] font-medium transition-colors cursor-pointer"
          >
            {isCompleted ? "إلغاء الإنجاز" : "تحديد كمساق منجز"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="درج مقارنة المساقات الاختيارية"
      className="fixed inset-0 z-[var(--z-modal)] flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 no-print"
      onClick={onClose}
    >
      <div
        className="w-full max-w-full sm:max-w-2xl bg-[var(--surface)] border-r border-[var(--line)] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between bg-[var(--sunken)]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="font-bold text-[16px] text-[var(--text)]">
                مقارنة المساقات الاختيارية جنباً إلى جنب
              </h3>
              <p className="text-xs text-[var(--text-3)]">
                قارن الساعات والمتطلبات والمحتوى لاختيار الأنسب لخطتك
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--text-3)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--sunken)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Course Selectors Bar */}
        <div className="p-4 border-b border-[var(--line)] bg-[var(--sunken)]/30 flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <label className="text-[11px] font-bold text-[var(--text-3)] block mb-1">
              المساق الأول (أ):
            </label>
            <select
              value={courseAId}
              onChange={(e) => setCourseAId(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--line-control)] text-xs font-semibold rounded-lg p-2 text-[var(--text)] outline-none"
            >
              {courses.map((c) => (
                <option key={`a-${c.id}`} value={c.id}>
                  {c.name} ({c.id}) - {c.category}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSwapSelection}
            title="تبديل طرفي المقارنة"
            className="p-2 mt-4 rounded-full bg-[var(--surface)] border border-[var(--line-control)] hover:bg-[var(--accent)] hover:text-white transition-all cursor-pointer shadow-xs"
          >
            <ArrowRightLeft size={14} />
          </button>

          <div className="flex-1 w-full">
            <label className="text-[11px] font-bold text-[var(--text-3)] block mb-1">
              المساق الثاني (ب):
            </label>
            <select
              value={courseBId}
              onChange={(e) => setCourseBId(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--line-control)] text-xs font-semibold rounded-lg p-2 text-[var(--text)] outline-none"
            >
              {courses.map((c) => (
                <option key={`b-${c.id}`} value={c.id}>
                  {c.name} ({c.id}) - {c.category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Side-by-side comparison matrix body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
          {renderCourseColumn(courseA, "A")}
          {renderCourseColumn(courseB, "B")}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--line)] bg-[var(--sunken)]/50 text-[11px] text-[var(--text-3)] flex items-center justify-between">
          <span>يتم تطبيق التعديلات فوراً على خطتك وجدولك</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[var(--line-control)]/30 hover:bg-[var(--line-control)]/50 text-[var(--text)] font-semibold transition-colors cursor-pointer"
          >
            إغلاق المقارنة
          </button>
        </div>
      </div>
    </div>
  );
};
