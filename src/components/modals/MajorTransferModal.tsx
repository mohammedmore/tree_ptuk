import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  GraduationCap,
} from "lucide-react";
import type { Course } from "../../data";
import {
  MajorSummary,
  fetchMajors,
  fetchMajorPlan,
  FALLBACK_MAJORS,
} from "../../services/majorService";
import {
  calculateGPA,
  isDegreeCreditBearing,
  calculateDegreeCredits,
} from "../../core/courseProgress";

interface MajorTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMajorId: string;
  currentMajorName: string;
  completedCourses: Set<string>;
  courseGrades: Record<string, number>;
  allCourses: Course[];
  onApplyTransfer?: (newMajorId: string) => void;
}

export const MajorTransferModal: React.FC<MajorTransferModalProps> = ({
  isOpen,
  onClose,
  currentMajorId,
  currentMajorName,
  completedCourses,
  courseGrades,
  allCourses,
  onApplyTransfer,
}) => {
  const [majors, setMajors] = useState<MajorSummary[]>(FALLBACK_MAJORS);
  const [targetMajorId, setTargetMajorId] = useState<string>("swe");
  const [targetMajorCourses, setTargetMajorCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  useEffect(() => {
    if (!isOpen) return;
    fetchMajors()
      .then(setMajors)
      .catch(() => {});
  }, [isOpen]);

  // Load target major plan
  useEffect(() => {
    if (!isOpen || !targetMajorId) return;
    setIsLoading(true);
    fetchMajorPlan(targetMajorId)
      .then((detail) => {
        setTargetMajorCourses(detail.courses);
      })
      .catch(() => {
        const fb = FALLBACK_MAJORS.find((m) => m.id === targetMajorId);
        if (fb) {
          // If fallback has courses Count, find courses in fallback
          setTargetMajorCourses(allCourses);
        }
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, targetMajorId, allCourses]);

  const targetMajor = useMemo(() => {
    return majors.find((m) => m.id === targetMajorId) || majors[0];
  }, [majors, targetMajorId]);

  const originalEarnedCredits = useMemo(
    () => calculateDegreeCredits(allCourses, completedCourses),
    [allCourses, completedCourses],
  );

  // Calculation of transferred courses
  const transferAnalysis = useMemo(() => {
    const targetCourseCodes = new Set(targetMajorCourses.map((c) => c.id));
    const targetCoursesMap = new Map(targetMajorCourses.map((c) => [c.id, c]));

    const transferredCourses: Array<{
      course: Course;
      isDirectMatch: boolean;
    }> = [];
    const untransferredCourses: Course[] = [];

    completedCourses.forEach((code) => {
      const originalCourse = allCourses.find((c) => c.id === code);
      if (!originalCourse) return;

      if (targetCourseCodes.has(code)) {
        // Direct course match in new major
        transferredCourses.push({
          course: targetCoursesMap.get(code) || originalCourse,
          isDirectMatch: true,
        });
      } else if (
        originalCourse.category.includes("جامعة") ||
        originalCourse.category.includes("حرة")
      ) {
        // University general requirement or free elective match
        transferredCourses.push({
          course: originalCourse,
          isDirectMatch: false,
        });
      } else {
        untransferredCourses.push(originalCourse);
      }
    });

    const transferredCredits = transferredCourses.reduce(
      (sum, item) =>
        sum + (isDegreeCreditBearing(item.course) ? item.course.credits : 0),
      0,
    );

    const derivedTargetCredits = targetMajor?.categoryRequirements
      ? Object.entries(targetMajor.categoryRequirements).reduce(
          (sum, [cat, cr]) => {
            if (cat.includes("استدراكي")) return sum;
            return sum + (Number(cr) || 0);
          },
          0,
        )
      : 0;
    const isTargetDiploma =
      targetMajor?.degree?.includes("دبلوم") ||
      targetMajor?.name?.includes("دبلوم");
    const isTargetFiveYear =
      Boolean(targetMajor?.college?.includes("هندسة")) &&
      !targetMajor?.name?.includes("الذكاء") &&
      !targetMajor?.name?.includes("علم الحاسوب");
    const fallbackTargetCredits = isTargetDiploma
      ? 72
      : isTargetFiveYear
        ? 164
        : 132;
    const totalTargetCredits =
      targetMajor?.totalCredits && targetMajor.totalCredits >= 60
        ? targetMajor.totalCredits
        : derivedTargetCredits >= 60 && derivedTargetCredits <= 260
          ? derivedTargetCredits
          : fallbackTargetCredits;
    const remainingCredits = Math.max(
      0,
      totalTargetCredits - transferredCredits,
    );

    // Calculate projected GPA in new major
    const transferredCourseIds = new Set(
      transferredCourses.map((t) => t.course.id),
    );
    const newGPA = calculateGPA(
      allCourses,
      courseGrades,
      transferredCourseIds,
      new Set(),
    );

    return {
      transferredCourses,
      untransferredCourses,
      transferredCredits,
      remainingCredits,
      totalTargetCredits,
      newGPA,
    };
  }, [
    targetMajorCourses,
    completedCourses,
    allCourses,
    targetMajor,
    courseGrades,
  ]);

  if (!isOpen) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[var(--scrim)]/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl bg-[var(--surface)] text-[var(--text)] rounded-[var(--r-surface)] border border-[var(--line)] shadow-[var(--shadow-pop)] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h2 className="text-[17px] font-bold m-0">
                محاكي التحويل وتغيير التخصص
              </h2>
              <p className="text-[12px] text-[var(--text-2)] m-0">
                اكتشف المواد المحتسبة والمتبقية ومعدلك الجديد في حال التحويل
                لتخصص آخر
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
          {/* Target Major Selector */}
          <div className="space-y-2">
            <label className="block text-[13px] font-semibold text-[var(--text)]">
              اختر التخصص الذي ترغب في محاكاة التحويل إليه:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {majors
                .filter((m) => m.id !== currentMajorId)
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setTargetMajorId(m.id)}
                    className={`p-3 rounded-[var(--r-control)] border text-right transition-all cursor-pointer ${
                      targetMajorId === m.id
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 font-bold"
                        : "border-[var(--line-control)] bg-[var(--surface)] hover:bg-[var(--sunken)]"
                    }`}
                  >
                    <span className="block text-[13px] text-[var(--text)]">
                      {m.name}
                    </span>
                    <span className="text-[11px] text-[var(--text-3)] block mt-0.5">
                      {m.totalCredits} ساعة معتمدة
                    </span>
                  </button>
                ))}
            </div>
          </div>

          {/* Transfer KPI Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-[var(--sunken)] text-center border border-[var(--line)]">
              <span className="text-[11px] text-[var(--text-3)] block">
                الساعات المحتسبة
              </span>
              <span className="text-[20px] font-bold text-emerald-500 tabular-nums">
                {transferAnalysis.transferredCredits}
              </span>
              <span className="text-[11px] text-[var(--text-2)] block">
                من أصل {originalEarnedCredits} س منجزة
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-[var(--sunken)] text-center border border-[var(--line)]">
              <span className="text-[11px] text-[var(--text-3)] block">
                الساعات المتبقية
              </span>
              <span className="text-[20px] font-bold text-[var(--accent)] tabular-nums">
                {transferAnalysis.remainingCredits}
              </span>
              <span className="text-[11px] text-[var(--text-2)] block">
                للتخرج من {targetMajor?.name}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-[var(--sunken)] text-center border border-[var(--line)]">
              <span className="text-[11px] text-[var(--text-3)] block">
                المعدل المحتسب الجديد
              </span>
              <span
                className="text-[20px] font-bold text-[var(--text)] tabular-nums"
                dir="ltr"
              >
                {transferAnalysis.newGPA > 0
                  ? `${transferAnalysis.newGPA.toFixed(2)}%`
                  : "0.00%"}
              </span>
              <span className="text-[11px] text-[var(--text-2)] block">
                بالمواد المعادلة
              </span>
            </div>
          </div>

          {/* Transferred Courses List */}
          <div className="space-y-2">
            <h4 className="text-[13px] font-bold text-[var(--text)] flex items-center justify-between m-0">
              <span>
                المساقات المعادلة في التخصص الجديد (
                {transferAnalysis.transferredCourses.length})
              </span>
              <span className="text-[11px] text-emerald-500 font-medium">
                ✓ يتم احتساب ساعاتها وعلاماتها
              </span>
            </h4>
            <div className="max-h-40 overflow-y-auto border border-[var(--line)] rounded-lg divide-y divide-[var(--line)] bg-[var(--surface)] text-[12px]">
              {transferAnalysis.transferredCourses.length === 0 ? (
                <div className="p-4 text-center text-[var(--text-3)]">
                  لا توجد مواد مشتركة محتسبة بعد.
                </div>
              ) : (
                transferAnalysis.transferredCourses.map(
                  ({ course, isDirectMatch }) => (
                    <div
                      key={course.id}
                      className="p-2.5 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-[var(--text)] block">
                          {course.name}
                        </span>
                        <span className="text-[11px] text-[var(--text-3)]">
                          {course.id} ({course.credits} ساعات)
                        </span>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-medium">
                        {isDirectMatch ? "مطابقة مباشرة" : "متطلب جامعة/حر"}
                      </span>
                    </div>
                  ),
                )
              )}
            </div>
          </div>

          {/* Untransferred Courses */}
          {transferAnalysis.untransferredCourses.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[13px] font-bold text-[var(--text)] flex items-center justify-between m-0">
                <span>
                  مساقات تخصصية لا تعادل في الخطة الجديدة (
                  {transferAnalysis.untransferredCourses.length})
                </span>
                <span className="text-[11px] text-rose-500 font-medium">
                  ✕ تحسب كمساقات حرة أو إضافية فقط
                </span>
              </h4>
              <div className="max-h-32 overflow-y-auto border border-rose-500/20 rounded-lg divide-y divide-rose-500/10 bg-rose-500/5 text-[12px]">
                {transferAnalysis.untransferredCourses.map((course) => (
                  <div
                    key={course.id}
                    className="p-2 flex items-center justify-between"
                  >
                    <span className="font-medium text-[var(--text)]">
                      {course.name} ({course.id})
                    </span>
                    <span className="text-[11px] text-[var(--text-3)]">
                      {course.credits}س غير محتسبة
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--line)] bg-[var(--sunken)] flex items-center justify-between">
          <span className="text-[12px] text-[var(--text-3)]">
            محاكاة استرشادية مبنية على الخطط الأكاديمية الرسمية المعتمدة في
            خضوري
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-[var(--r-control)] text-[13px] border border-[var(--line-control)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--sunken)] cursor-pointer"
            >
              إغلاق
            </button>
            {onApplyTransfer && (
              <button
                type="button"
                onClick={() => {
                  onApplyTransfer(targetMajorId);
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-[var(--r-control)] text-[13px] font-bold bg-[var(--accent)] text-white hover:opacity-90 cursor-pointer shadow-sm"
              >
                تطبيق والتحويل إلى {targetMajor?.name}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MajorTransferModal;
