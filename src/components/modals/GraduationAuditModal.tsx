import React, { useMemo, useEffect } from "react";
import {
  X,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Course } from "../../data";
import { categoryRequirements } from "../../data";
import { TOTAL_CREDITS } from "../../constants";
import { calculateDegreeCredits } from "../../core/courseProgress";
import { getCachedStudentProfile } from "../../services/studentService";
import { cn } from "../../utils";

interface GraduationAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  completedCourses: Set<string>;
  activeMajorName?: string;
  courseGrades?: Record<string, number>;
  categoryRequirements?: Record<string, number>;
}

export const GraduationAuditModal: React.FC<GraduationAuditModalProps> = ({
  isOpen,
  onClose,
  courses,
  completedCourses,
  activeMajorName = "الخطة الدراسية الجامعية",
  courseGrades = {},
  categoryRequirements: propCategoryRequirements,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const earnedCredits = useMemo(
    () => calculateDegreeCredits(courses, completedCourses),
    [courses, completedCourses],
  );

  const degreeTotalCredits = useMemo(() => {
    const student = getCachedStudentProfile();
    if (
      student?.totalCredits &&
      student.totalCredits >= 60 &&
      student.totalCredits <= 260
    ) {
      return student.totalCredits;
    }
    const activeRequirements =
      propCategoryRequirements &&
      Object.keys(propCategoryRequirements).length > 0
        ? propCategoryRequirements
        : categoryRequirements;

    const sum = Object.entries(activeRequirements).reduce((acc, [cat, cr]) => {
      if (cat.includes("استدراكي")) return acc;
      return acc + (Number(cr) || 0);
    }, 0);

    return sum >= 60 && sum <= 260 ? sum : TOTAL_CREDITS;
  }, [propCategoryRequirements]);

  const remainingCredits = Math.max(0, degreeTotalCredits - earnedCredits);
  const totalPercentage = Math.min(
    100,
    Math.round((earnedCredits / degreeTotalCredits) * 100),
  );

  // Category breakdown
  const categoryStats = useMemo(() => {
    const stats: Record<
      string,
      {
        required: number;
        earned: number;
        completedList: Course[];
        remainingList: Course[];
      }
    > = {};

    const activeRequirements =
      propCategoryRequirements &&
      Object.keys(propCategoryRequirements).length > 0
        ? propCategoryRequirements
        : categoryRequirements;

    Object.entries(activeRequirements).forEach(([cat, req]) => {
      stats[cat] = {
        required: req,
        earned: 0,
        completedList: [],
        remainingList: [],
      };
    });

    courses.forEach((c) => {
      const cat = c.category || "أخرى";
      if (!stats[cat]) {
        stats[cat] = {
          required: 0,
          earned: 0,
          completedList: [],
          remainingList: [],
        };
      }
      if (completedCourses.has(c.id)) {
        stats[cat].earned += c.credits;
        stats[cat].completedList.push(c);
      } else {
        stats[cat].remainingList.push(c);
      }
    });

    return stats;
  }, [courses, completedCourses]);

  // Special Milestones (Capstone, Training)
  const milestones = useMemo(() => {
    const trainingCourse = courses.find(
      (c) => c.name.includes("تدريب ميداني") || c.name.includes("التدريب"),
    );
    const capstone1 = courses.find((c) =>
      /مشروع.*تخرج.*1|مشروع.*التخرج.*1/.test(c.name),
    );
    const capstone2 = courses.find((c) =>
      /مشروع.*تخرج.*2|مشروع.*التخرج.*2/.test(c.name),
    );

    return [
      {
        title: "التدريب الميداني",
        course: trainingCourse,
        isCompleted: trainingCourse
          ? completedCourses.has(trainingCourse.id)
          : false,
      },
      {
        title: "مشروع تخرج (1)",
        course: capstone1,
        isCompleted: capstone1 ? completedCourses.has(capstone1.id) : false,
      },
      {
        title: "مشروع تخرج (2)",
        course: capstone2,
        isCompleted: capstone2 ? completedCourses.has(capstone2.id) : false,
      },
    ];
  }, [courses, completedCourses]);

  const isGraduationEligible =
    remainingCredits === 0 && milestones.every((m) => m.isCompleted);

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-[var(--scrim)]/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150 print:static print:bg-white print:p-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-card)] shadow-[var(--shadow-pop)] flex flex-col overflow-hidden text-[var(--text)] print:max-h-none print:shadow-none print:border-none print:w-full print:text-black"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)] print:bg-white print:border-b-2 print:border-black">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] print:border print:border-black">
              <GraduationCap size={20} />
            </div>
            <div>
              <h2 className="text-[17px] sm:text-[18px] font-bold text-[var(--text)] print:text-black">
                تقرير التدقيق الأكاديمي للتخرج
              </h2>
              <p className="text-[12px] text-[var(--text-3)] print:text-gray-700">
                جامعة فلسطين التقنية - خضوري • {activeMajorName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="p-2 text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)] rounded-[var(--r-control)] transition-colors cursor-pointer"
              title="طباعة التقرير"
            >
              <Printer size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)] rounded-[var(--r-control)] transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Overview Banner */}
          <div className="p-4 rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--sunken)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-right">
              <div className="text-[13px] text-[var(--text-2)]">
                حالة الأهلية للتخرج:
              </div>
              <div className="text-[16px] font-bold flex items-center gap-2 justify-center sm:justify-start">
                {isGraduationEligible ? (
                  <>
                    <CheckCircle2 size={18} className="text-[var(--accent)]" />
                    <span className="text-[var(--accent)]">
                      مؤهل للتخرج واستيفاء كافة المتطلبات!
                    </span>
                  </>
                ) : (
                  <>
                    <Clock size={18} className="text-[var(--warn)]" />
                    <span>
                      متبقي {remainingCredits} ساعة معتمدة لإتمام الخطة
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-center">
              <div>
                <div className="text-[20px] font-bold text-[var(--text)] tabular-nums">
                  {earnedCredits}
                </div>
                <div className="text-[11px] text-[var(--text-3)]">
                  الساعات المنجزة
                </div>
              </div>
              <div className="text-[18px] text-[var(--line-control)]">/</div>
              <div>
                <div className="text-[20px] font-bold text-[var(--text)] tabular-nums">
                  {degreeTotalCredits}
                </div>
                <div className="text-[11px] text-[var(--text-3)]">
                  إجمالي الخطة
                </div>
              </div>
              <div className="mr-2 px-2.5 py-1 rounded-full text-[13px] font-bold bg-[var(--accent-soft)] text-[var(--accent)] tabular-nums">
                {totalPercentage}%
              </div>
            </div>
          </div>

          {/* Key Milestones */}
          <div>
            <h3 className="text-[13.5px] font-bold text-[var(--text)] mb-2.5">
              محطات التخرج الإجبارية
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {milestones.map((m, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-3 rounded-[var(--r-control)] border text-[12.5px] flex items-center justify-between",
                    m.isCompleted
                      ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--text)]"
                      : "bg-[var(--surface)] border-[var(--line-control)] text-[var(--text-2)]",
                  )}
                >
                  <span className="font-semibold">{m.title}</span>
                  {m.isCompleted ? (
                    <span className="flex items-center gap-1 text-[var(--accent)] font-bold text-[11px]">
                      <CheckCircle2 size={14} /> منجز
                    </span>
                  ) : (
                    <span className="text-[var(--text-3)] text-[11px]">
                      غير مسجل بعد
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Categories Audit */}
          <div>
            <h3 className="text-[13.5px] font-bold text-[var(--text)] mb-2.5">
              تدقيق مجموعات المتطلبات
            </h3>
            <div className="space-y-3">
              {Object.entries(categoryStats).map(([cat, stat]) => {
                const isFulfilled = stat.earned >= stat.required;
                const pct =
                  stat.required > 0
                    ? Math.min(
                        100,
                        Math.round((stat.earned / stat.required) * 100),
                      )
                    : 100;

                return (
                  <div
                    key={cat}
                    className="p-3.5 rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] space-y-2"
                  >
                    <div className="flex items-center justify-between text-[13px]">
                      <div className="flex items-center gap-2">
                        {isFulfilled ? (
                          <CheckCircle2
                            size={16}
                            className="text-[var(--accent)]"
                          />
                        ) : (
                          <AlertTriangle
                            size={16}
                            className="text-[var(--warn)]"
                          />
                        )}
                        <span className="font-bold text-[var(--text)]">
                          {cat}
                        </span>
                      </div>
                      <div className="text-[12px] tabular-nums font-semibold">
                        <span
                          className={
                            isFulfilled
                              ? "text-[var(--accent)]"
                              : "text-[var(--warn)]"
                          }
                        >
                          {stat.earned}
                        </span>{" "}
                        / {stat.required} ساعة ({pct}%)
                      </div>
                    </div>

                    <div className="w-full h-1.5 bg-[var(--line)] rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-300",
                          isFulfilled
                            ? "bg-[var(--accent)]"
                            : "bg-[var(--warn)]",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {stat.remainingList.length > 0 && (
                      <div className="pt-1 text-[11.5px] text-[var(--text-2)]">
                        <span className="text-[var(--text-3)]">
                          المتبقي ({stat.remainingList.length} مادة):{" "}
                        </span>
                        {stat.remainingList.map((c) => c.name).join(" • ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--line)] bg-[var(--bg)] flex justify-end print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-[13px] font-semibold bg-[var(--accent)] text-[var(--text-on-accent)] rounded-[var(--r-control)] hover:opacity-90 transition-opacity cursor-pointer"
          >
            إغلاق التقرير
          </button>
        </div>
      </div>
    </div>
  );
};

export default GraduationAuditModal;
