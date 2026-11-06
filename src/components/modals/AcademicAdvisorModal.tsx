import React, { useState, useMemo } from "react";
import {
  X,
  Compass,
  AlertTriangle,
  GitFork,
  Target,
  Sparkles,
  Calculator,
  CheckCircle2,
  Lock,
  ChevronRight,
  TrendingUp,
  Layers,
  HelpCircle,
  ArrowRight,
  Info,
  GraduationCap,
  Calendar,
  Sun,
  Printer,
} from "lucide-react";
import type { Course } from "../../data";
import {
  calculateCurriculumCriticalPath,
  simulateCourseDelayImpact,
  recommendOptimalUpcomingSemester,
  simulateGpaForecast,
  generateGraduationRoadmap,
  generateGraduationRoadmapICS,
  downloadICSFile,
  CourseBottleneckAnalysis,
} from "../../core/academicAdvisor";
import { cn } from "../../utils";

interface AcademicAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  completedCourses: Set<string>;
  studentGpa?: number;
  hasAcademicWarning?: boolean;
  completedHours?: number;
  onApplyRecommendedPlan?: (courses: Course[]) => void;
}

export const AcademicAdvisorModal: React.FC<AcademicAdvisorModalProps> = ({
  isOpen,
  onClose,
  courses,
  completedCourses,
  studentGpa = 75,
  hasAcademicWarning = false,
  completedHours = 45,
  onApplyRecommendedPlan,
}) => {
  const [activeTab, setActiveTab] = useState<
    "bottlenecks" | "whatif" | "recommendation" | "gpa" | "roadmap"
  >("bottlenecks");

  const [roadmapIncludeSummer, setRoadmapIncludeSummer] = useState(false);
  const [roadmapCreditsPerTerm, setRoadmapCreditsPerTerm] = useState(18);
  const [roadmapWarning, setRoadmapWarning] = useState(hasAcademicWarning);

  const [selectedCourseForWhatIf, setSelectedCourseForWhatIf] =
    useState<string>("");

  const roadmapResult = useMemo(() => {
    return generateGraduationRoadmap({
      courses,
      completedCourses,
      currentGpa: studentGpa,
      academicWarning: roadmapWarning,
      targetCreditsPerSemester: roadmapCreditsPerTerm,
      includeSummer: roadmapIncludeSummer,
      maxYears: 6,
    });
  }, [
    courses,
    completedCourses,
    studentGpa,
    roadmapWarning,
    roadmapCreditsPerTerm,
    roadmapIncludeSummer,
  ]);

  const handlePrintGraduationRoadmap = () => {
    const printWindow = window.open("", "_blank", "width=850,height=900");
    if (!printWindow) return;

    const semestersHtml = roadmapResult.semesters
      .map(
        (sem) => `
      <div style="margin-bottom: 1.5rem; page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #edf2f7; padding-bottom: 8px; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 14px; font-weight: 800; color: #1e293b;">${sem.semesterLabel}</h3>
          <span style="font-size: 12px; font-weight: bold; color: #4f46e5; background: #eef2ff; padding: 2px 8px; border-radius: 4px;">${sem.totalCredits} ساعة معتمدة</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f8fafc; color: #64748b; text-align: right;">
              <th style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">رمز المساق</th>
              <th style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">اسم المساق</th>
              <th style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">الساعات</th>
              <th style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">النوع والتصنيف</th>
            </tr>
          </thead>
          <tbody>
            ${sem.courses
              .map(
                (c) => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 8px; font-family: monospace; font-weight: bold; color: #0f172a;">${c.id}</td>
                <td style="padding: 6px 8px; color: #1e293b; font-weight: 500;">${c.name}</td>
                <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: #4338ca;">${c.credits}</td>
                <td style="padding: 6px 8px; color: #64748b; font-size: 11px;">${c.category || "متطلب خطة"}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `,
      )
      .join("");

    printWindow.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>خريطة التخرج الأكاديمية - جامعة فلسطين التقنية خضوري</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #0f172a; line-height: 1.5; }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm; size: A4; }
    }
  </style>
</head>
<body>
  <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 800;">جامعة فلسطين التقنية - خضوري (PTUK)</h2>
    <h3 style="margin: 0; font-size: 15px; color: #475569;">وثيقة الخطة الاسترشادية للتخرج بحل القيود الأكاديمية (CSP Engine)</h3>
    <div style="margin-top: 12px; font-size: 12px; color: #334155; display: flex; justify-content: space-around; background: #f8fafc; padding: 8px; border-radius: 6px;">
      <span>الساعات المنجزة: <strong>${completedHours} س</strong></span>
      <span>المعدل التراكمي: <strong>${studentGpa}%</strong></span>
      <span>الفصول المتوقعة للتخرج: <strong>${roadmapResult.estimatedGraduationSemesters} فصول</strong></span>
      <span>الساعات المتبقية: <strong>${roadmapResult.remainingCredits} س</strong></span>
    </div>
  </div>
  ${semestersHtml}
  <div style="margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px;">
    تم إنشاء هذه الوثيقة آلياً عبر نظام المنسق الذكي وجدولة المساقات PTUK Academic Planner.
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`);
    printWindow.document.close();
  };

  // Calculate authentic Critical Path Report
  const criticalPathReport = useMemo(() => {
    return calculateCurriculumCriticalPath(courses, completedCourses);
  }, [courses, completedCourses]);

  // Default what-if selection to top bottleneck if not selected
  const activeWhatIfCourseId = useMemo(() => {
    if (selectedCourseForWhatIf) return selectedCourseForWhatIf;
    if (criticalPathReport.bottlenecks.length > 0) {
      return criticalPathReport.bottlenecks[0].courseId;
    }
    return "";
  }, [selectedCourseForWhatIf, criticalPathReport]);

  const whatIfAnalysis = useMemo(() => {
    if (!activeWhatIfCourseId) return null;
    return simulateCourseDelayImpact(
      activeWhatIfCourseId,
      courses,
      completedCourses,
    );
  }, [activeWhatIfCourseId, courses, completedCourses]);

  // Recommended Next Semester Schedule
  const recommendation = useMemo(() => {
    return recommendOptimalUpcomingSemester({
      courses,
      completedCourses,
      currentGpa: studentGpa,
      academicWarning: hasAcademicWarning,
      earnedCredits: completedHours,
    });
  }, [
    courses,
    completedCourses,
    studentGpa,
    hasAcademicWarning,
    completedHours,
  ]);

  // GPA Forecast State
  const [expectedGrades, setExpectedGrades] = useState<Record<string, number>>(
    {},
  );

  const forecastResult = useMemo(() => {
    const upcomingWithGrades = recommendation.recommendedCourses.map((c) => ({
      courseId: c.id,
      courseName: c.name,
      credits: c.credits,
      expectedGrade: expectedGrades[c.id] ?? 78,
    }));

    return simulateGpaForecast({
      currentGpa: studentGpa,
      completedHours,
      upcomingCourses: upcomingWithGrades,
    });
  }, [recommendation, expectedGrades, studentGpa, completedHours]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="المرشد الأكاديمي الذكي ومحلل المسار الحرج"
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[var(--surface)] text-[var(--text)] border border-[var(--line)] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)] bg-[var(--surface-sunken)]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl flex items-center justify-center text-white bg-indigo-600 shadow-md shadow-indigo-600/20">
              <Compass size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  المرشد الأكاديمي ومحلل المسار الحرج للتخرج
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  لوائح PTUK المعتمدة
                </span>
              </div>
              <p className="text-xs text-[var(--text-3)] font-medium">
                تحليل رياضي لسلاسل متطلبات التخصص، كشف الاختناقات، وتفادي تأخير
                التخرج
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-[var(--line)] overflow-x-auto shrink-0 bg-[var(--surface)]">
          <button
            onClick={() => setActiveTab("bottlenecks")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
              activeTab === "bottlenecks"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]",
            )}
          >
            <GitFork size={15} />
            <span>المسار الحرج واختناقات المواد</span>
          </button>

          <button
            onClick={() => setActiveTab("whatif")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
              activeTab === "whatif"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]",
            )}
          >
            <HelpCircle size={15} />
            <span>محاكي تأثير التأجيل (What-If)</span>
          </button>

          <button
            onClick={() => setActiveTab("recommendation")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
              activeTab === "recommendation"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]",
            )}
          >
            <Sparkles size={15} />
            <span>الخطة المقترحة للفصل القادم</span>
          </button>

          <button
            onClick={() => setActiveTab("gpa")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
              activeTab === "gpa"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]",
            )}
          >
            <Calculator size={15} />
            <span>محاكي المعدل التراكمي (GPA)</span>
          </button>

          <button
            onClick={() => setActiveTab("roadmap")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
              activeTab === "roadmap"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]",
            )}
          >
            <GraduationCap size={15} />
            <span>خريطة التخرج لأربع سنوات</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: BOTTLENECK ANALYSIS */}
          {activeTab === "bottlenecks" && (
            <div className="space-y-6">
              {/* Critical Path Metric Banner */}
              <div className="p-4 sm:p-5 rounded-3xl bg-linear-to-r from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-right">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    أطول سلسلة متطلبات متتالية حتى التخرج (Critical Path Depth)
                  </span>
                  <div className="text-2xl font-black text-[var(--text)]">
                    {criticalPathReport.longestPathLength}{" "}
                    <span className="text-sm font-semibold text-[var(--text-3)]">
                      فصول دراسية متتابعة كحد أدنى
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-2)]">
                    المساقات المترابطة بالتسلسل لا يمكن تسجيلها في نفس الفصل
                    وتتطلب اجتيازاً مرتباً بالترتيب.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)] text-center shrink-0 min-w-36">
                  <span className="text-[11px] font-semibold text-[var(--text-3)] block mb-1">
                    الساعات المتبقية
                  </span>
                  <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                    {criticalPathReport.totalRemainingCredits} ساعة
                  </span>
                </div>
              </div>

              {/* Bottlenecks List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] flex items-center justify-between">
                  <span>
                    المواد العنقودية الأكثر خطورة (Top Bottleneck Courses)
                  </span>
                  <span className="text-[11px] font-normal text-[var(--text-3)]">
                    مرتبة حسب عدد المواد المحجوبة وعمق السلسلة
                  </span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {criticalPathReport.bottlenecks.slice(0, 8).map((b) => (
                    <div
                      key={b.courseId}
                      className={cn(
                        "p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3",
                        b.isCriticalBottleneck
                          ? "bg-amber-500/5 border-amber-500/30 dark:bg-amber-500/10"
                          : "bg-[var(--surface-sunken)]/40 border-[var(--line)]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[var(--text-3)]">
                              {b.courseId}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-[var(--line)]/50 text-[var(--text-2)]">
                              {b.credits} ساعات
                            </span>
                            {b.isCriticalBottleneck && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                مادة حرجـة
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-[var(--text)] mt-1">
                            {b.courseName}
                          </h4>
                        </div>

                        {b.isEligibleToRegister ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg shrink-0"
                            title="جميع المتطلبات السابقة مكتملة ويمكنك تسجيلها فوراً"
                          >
                            <CheckCircle2 size={12} />
                            متاح للتسجيل
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-lg shrink-0"
                            title={`بانتظار المتطلب السابق: ${b.unmetPrerequisites.join(", ")}`}
                          >
                            <Lock size={12} />
                            مغلق (متطلب غير مستوفى)
                          </span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-[var(--line)]/60 flex items-center justify-between text-xs text-[var(--text-2)]">
                        <span>
                          تحجب مباشرة: <b>{b.directDependents.length} مساقات</b>
                        </span>
                        <span>
                          إجمالي ما يعتمد عليها:{" "}
                          <b>{b.allDownstreamDependents.length} مساقاً</b>
                        </span>
                        <span>
                          عمق الفصول: <b>{b.chainDepth}</b>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WHAT-IF DELAY SIMULATOR */}
          {activeTab === "whatif" && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-[var(--surface-sunken)]/50 border border-[var(--line)] space-y-3">
                <label className="block text-xs font-bold text-[var(--text-2)]">
                  اختر المساق لمعاينة أثر تأجيله أو الرسوب فيه:
                </label>
                <select
                  value={activeWhatIfCourseId}
                  onChange={(e) => setSelectedCourseForWhatIf(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-sm font-bold text-[var(--text)] focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                >
                  {courses
                    .filter((c) => !completedCourses.has(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} - {c.name} ({c.credits} ساعات)
                      </option>
                    ))}
                </select>
              </div>

              {whatIfAnalysis && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Risk Badge Card */}
                  <div
                    className={cn(
                      "p-5 rounded-3xl border flex items-start gap-4",
                      whatIfAnalysis.academicRiskLevel === "CRITICAL"
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                        : whatIfAnalysis.academicRiskLevel === "HIGH"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                          : whatIfAnalysis.academicRiskLevel === "MEDIUM"
                            ? "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    <div className="p-2.5 rounded-2xl bg-[var(--surface)] text-current shrink-0 shadow-xs">
                      <AlertTriangle size={24} />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-black">
                          مستوى الخطورة الأكاديمية:{" "}
                          {whatIfAnalysis.academicRiskLevel === "CRITICAL"
                            ? "حرج جداً (يؤخر التخرج)"
                            : whatIfAnalysis.academicRiskLevel === "HIGH"
                              ? "مرتفع (يحجب مسارات متتالية)"
                              : whatIfAnalysis.academicRiskLevel === "MEDIUM"
                                ? "متوسط"
                                : "منخفض (مساق نهائي / اختياري)"}
                        </h4>
                      </div>
                      <p className="text-xs leading-relaxed opacity-90">
                        {whatIfAnalysis.adviceSummary}
                      </p>
                    </div>
                  </div>

                  {/* Impact Numbers Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-[var(--surface-sunken)]/40 border border-[var(--line)] text-center">
                      <span className="text-[11px] font-semibold text-[var(--text-3)] block mb-1">
                        تأخير التخرج المتوقع
                      </span>
                      <span className="text-xl font-black text-rose-500">
                        {whatIfAnalysis.estimatedSemesterDelay > 0
                          ? `+${whatIfAnalysis.estimatedSemesterDelay} فصل دراسي`
                          : "لا يؤخر مباشرة"}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[var(--surface-sunken)]/40 border border-[var(--line)] text-center">
                      <span className="text-[11px] font-semibold text-[var(--text-3)] block mb-1">
                        مساقات تُحجب في الفصل القادم
                      </span>
                      <span className="text-xl font-black text-amber-500">
                        {whatIfAnalysis.directlyBlockedCourses.length} مساق
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[var(--surface-sunken)]/40 border border-[var(--line)] text-center">
                      <span className="text-[11px] font-semibold text-[var(--text-3)] block mb-1">
                        إجمالي المساقات المتأثرة
                      </span>
                      <span className="text-xl font-black text-indigo-500">
                        {whatIfAnalysis.totalDownstreamBlockedCount} مساق
                      </span>
                    </div>
                  </div>

                  {/* Blocked Courses List */}
                  {whatIfAnalysis.directlyBlockedCourses.length > 0 && (
                    <div className="p-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] space-y-2">
                      <h5 className="text-xs font-bold text-[var(--text-2)]">
                        المساقات الممنوعة مباشرة من التسجيل في الفصل القادم إذا
                        لم تجتز هذا المساق:
                      </h5>
                      <div className="divide-y divide-[var(--line)]">
                        {whatIfAnalysis.directlyBlockedCourses.map((c) => (
                          <div
                            key={c.id}
                            className="py-2 flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-[var(--text)]">
                              {c.id} - {c.name}
                            </span>
                            <span className="text-[var(--text-3)]">
                              {c.credits} ساعات • {c.category}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SMART SEMESTER RECOMMENDATION */}
          {activeTab === "recommendation" && (
            <div className="space-y-6">
              {/* Recommendation Summary Banner */}
              <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-sunken)]/40 border border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-right">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    الحالة الأكاديمية المعتمدة لجامعة خضوري
                  </span>
                  <div className="text-lg sm:text-xl font-black text-[var(--text)]">
                    {recommendation.academicStanding}
                  </div>
                  <p className="text-xs text-[var(--text-2)]">
                    تم تحديد المواد تلقائياً لفك أقصى عدد ممكن من الاختناقات مع
                    الالتزام بنصاب الساعات القانوني.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)] text-center shrink-0 min-w-28">
                    <span className="text-[11px] font-semibold text-[var(--text-3)] block mb-1">
                      إجمالي الساعات
                    </span>
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                      {recommendation.totalCredits} /{" "}
                      {recommendation.creditLimit}
                    </span>
                  </div>

                  {onApplyRecommendedPlan && (
                    <button
                      onClick={() => {
                        onApplyRecommendedPlan(
                          recommendation.recommendedCourses,
                        );
                        onClose();
                      }}
                      className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <CheckCircle2 size={16} />
                      <span>اعتماد هذه الخطة</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Recommended Courses Table */}
              <div className="border border-[var(--line)] rounded-2xl overflow-hidden bg-[var(--surface)]">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[var(--surface-sunken)]/60 text-[var(--text-3)] font-semibold border-b border-[var(--line)]">
                    <tr>
                      <th className="py-2.5 px-4">رمز المساق</th>
                      <th className="py-2.5 px-4">اسم المساق</th>
                      <th className="py-2.5 px-4 text-center">الساعات</th>
                      <th className="py-2.5 px-4">سبب التوصية والاختيار</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {recommendation.recommendedCourses.map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-[var(--surface-hover)]/50 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-[var(--text)]">
                          {c.id}
                        </td>
                        <td className="py-3 px-4 font-bold text-[var(--text)]">
                          {c.name}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-indigo-600 dark:text-indigo-400">
                          {c.credits}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-2)] text-[11px]">
                          {recommendation.selectionReasons[c.id] || "متطلب خطة"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: GPA TARGET SIMULATOR */}
          {activeTab === "gpa" && (
            <div className="space-y-6">
              {/* Forecast Outcome Banner */}
              <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-sunken)]/40 border border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-right">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    المعدل التراكمي المتوقع بعد اجتياز الفصل القادم
                  </span>
                  <div className="flex items-baseline gap-2 justify-center sm:justify-start">
                    <span className="text-3xl font-black text-[var(--text)]">
                      {forecastResult.projectedGpa}%
                    </span>
                    <span
                      className={cn(
                        "text-xs font-black px-2 py-0.5 rounded-md",
                        forecastResult.gpaDifference >= 0
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/10 text-rose-500",
                      )}
                    >
                      {forecastResult.gpaDifference >= 0 ? "+" : ""}
                      {forecastResult.gpaDifference}%
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[var(--text-2)]">
                    {forecastResult.statusText}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs shrink-0">
                  <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)]">
                    <span className="text-[10px] text-[var(--text-3)] block mb-1">
                      المعدل الحالي
                    </span>
                    <span className="font-black text-[var(--text)]">
                      {studentGpa}%
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)]">
                    <span className="text-[10px] text-[var(--text-3)] block mb-1">
                      الساعات المنجزة
                    </span>
                    <span className="font-black text-[var(--text)]">
                      {completedHours} س
                    </span>
                  </div>
                </div>
              </div>

              {/* Course Expected Grade Inputs */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">
                  تعديل العلامات المتوقعة لمساقات الفصل القادم:
                </h4>

                <div className="space-y-2">
                  {recommendation.recommendedCourses.map((c) => {
                    const grade = expectedGrades[c.id] ?? 78;
                    return (
                      <div
                        key={c.id}
                        className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-4 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-mono text-[10px] text-[var(--text-3)] block">
                            {c.id}
                          </span>
                          <span className="font-bold text-[var(--text)] truncate block">
                            {c.name} ({c.credits} ساعات)
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <input
                            type="range"
                            min="50"
                            max="100"
                            step="1"
                            value={grade}
                            onChange={(e) =>
                              setExpectedGrades((prev) => ({
                                ...prev,
                                [c.id]: Number(e.target.value),
                              }))
                            }
                            className="w-24 sm:w-36 accent-indigo-600 cursor-pointer"
                          />
                          <span className="w-12 text-center font-black text-sm text-indigo-600 dark:text-indigo-400 bg-[var(--surface-sunken)] py-1 rounded-lg border border-[var(--line)]">
                            {grade}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: 4-YEAR GRADUATION ROADMAP */}
          {activeTab === "roadmap" && (
            <div className="space-y-6">
              {/* Controls & Preferences */}
              <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-sunken)]/40 border border-[var(--line)] flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={roadmapIncludeSummer}
                      onChange={(e) =>
                        setRoadmapIncludeSummer(e.target.checked)
                      }
                      className="rounded accent-indigo-600 cursor-pointer"
                    />
                    <Sun size={14} className="text-amber-500" />
                    <span>تضمين الفصول الصيفية</span>
                  </label>

                  <div className="h-4 w-px bg-[var(--line)] hidden sm:block" />

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--text-3)] font-medium">
                      الحد المستهدف للفصل:
                    </span>
                    <select
                      value={roadmapCreditsPerTerm}
                      onChange={(e) =>
                        setRoadmapCreditsPerTerm(Number(e.target.value))
                      }
                      className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs font-bold text-[var(--text)] cursor-pointer"
                    >
                      <option value={15}>15 ساعة</option>
                      <option value={16}>16 ساعة</option>
                      <option value={17}>17 ساعة</option>
                      <option value={18}>18 ساعة (الافتراضي)</option>
                      <option value={19}>19 ساعة (الحد الأقصى)</option>
                    </select>
                  </div>

                  <div className="h-4 w-px bg-[var(--line)] hidden sm:block" />

                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={roadmapWarning}
                      onChange={(e) => setRoadmapWarning(e.target.checked)}
                      className="rounded accent-rose-600 cursor-pointer"
                    />
                    <AlertTriangle size={14} className="text-amber-500" />
                    <span>حساب قيود الإنذار الأكاديمي (14 س)</span>
                  </label>
                </div>

                {roadmapResult.semesters.length > 0 &&
                  onApplyRecommendedPlan && (
                    <button
                      onClick={() => {
                        if (roadmapResult.semesters[0]) {
                          onApplyRecommendedPlan(
                            roadmapResult.semesters[0].courses,
                          );
                          onClose();
                        }
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <CheckCircle2 size={13} />
                      <span>تطبيق الفصل القادم بالخطة</span>
                    </button>
                  )}

                <button
                  onClick={() => {
                    const icsData = generateGraduationRoadmapICS(roadmapResult);
                    downloadICSFile(icsData, "ptuk-graduation-roadmap.ics");
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[var(--line-control)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text)] text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  title="تصدير الخطة إلى تقويم Google Calendar أو Apple Calendar"
                >
                  <Calendar size={13} className="text-indigo-500" />
                  <span>تصدير التقويم (.ics)</span>
                </button>

                <button
                  onClick={handlePrintGraduationRoadmap}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[var(--line-control)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text)] text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  title="طباعة أو تصدير وثيقة الخطة الأكاديمية (PDF)"
                >
                  <Printer size={13} className="text-purple-500" />
                  <span>طباعة الخطة (PDF)</span>
                </button>
              </div>

              {/* Graduation Metrics Banner */}
              <div className="p-4 sm:p-5 rounded-3xl bg-linear-to-r from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-right">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    مسار التخرج الكامل بحل القيود الأكاديمية (CSP)
                  </span>
                  <div className="flex items-baseline gap-2 justify-center sm:justify-start">
                    <span className="text-3xl font-black text-[var(--text)]">
                      {roadmapResult.estimatedGraduationSemesters} فصول دراسية
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      {Math.ceil(
                        roadmapResult.estimatedGraduationSemesters /
                          (roadmapIncludeSummer ? 3 : 2),
                      )}{" "}
                      سنوات متبقية
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[var(--text-2)]">
                    {roadmapResult.isFullyResolved
                      ? "جميع متطلبات التخرج مجدولة بتوافق 100% مع الشروط السابقة وسقوف الساعات."
                      : `تنبيه: يوجد ${roadmapResult.unresolvedCourses.length} مساقات بحاجة لمعالجة استثنائية.`}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs shrink-0">
                  <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)]">
                    <span className="text-[10px] text-[var(--text-3)] block mb-1">
                      الساعات المتبقية
                    </span>
                    <span className="font-black text-[var(--text)]">
                      {roadmapResult.remainingCredits} /{" "}
                      {roadmapResult.totalCurriculumCredits} س
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)]">
                    <span className="text-[10px] text-[var(--text-3)] block mb-1">
                      المساقات الحرجة
                    </span>
                    <span className="font-black text-indigo-600 dark:text-indigo-400">
                      {roadmapResult.criticalBottlenecks.length} مساق
                    </span>
                  </div>
                </div>
              </div>

              {/* Semesters Progression List */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">
                  توزيع الفصول الدراسية المقترحة حتى التخرج:
                </h4>

                <div className="space-y-3">
                  {roadmapResult.semesters.map((sem, sIdx) => {
                    const isSummer = sem.termType === "summer";
                    return (
                      <div
                        key={sem.semesterNumber}
                        className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 hover:border-indigo-500/30 transition-all shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center justify-center">
                              {sIdx + 1}
                            </span>
                            <span className="font-bold text-sm text-[var(--text)]">
                              {sem.semesterLabel}
                            </span>
                            {isSummer && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                صيفي
                              </span>
                            )}
                          </div>

                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-[var(--surface-sunken)] border border-[var(--line)] text-[var(--text-2)] tabular-nums">
                            {sem.totalCredits} / {sem.maxCredits} س
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {sem.courses.map((c) => {
                            const isBottleneck =
                              roadmapResult.criticalBottlenecks.some(
                                (b) => b.courseId === c.id,
                              );
                            return (
                              <div
                                key={c.id}
                                className="p-2.5 rounded-xl bg-[var(--surface-sunken)]/30 border border-[var(--line)]/60 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1">
                                    <span
                                      className="font-mono text-[10px] text-[var(--text-3)] block"
                                      dir="ltr"
                                    >
                                      {c.id}
                                    </span>
                                    {isBottleneck && (
                                      <span className="text-[9px] font-bold px-1 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                                        ⚡ حرج
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-bold text-[var(--text)] truncate block mt-0.5">
                                    {c.name}
                                  </span>
                                </div>
                                <span className="font-bold text-[11px] text-[var(--text-2)] px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--line)] tabular-nums shrink-0">
                                  {c.credits} س
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--line)] bg-[var(--surface-sunken)]/40 shrink-0 text-xs text-[var(--text-3)]">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-indigo-500" />
            <span>
              جميع الحسابات تتبع اللائحة الأكاديمية لجامعة فلسطين التقنية -
              خضوري (PTUK)
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text)] font-semibold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default AcademicAdvisorModal;
