import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  BookOpen,
  Search,
  Target,
  TrendingUp,
  Award,
  AlertTriangle,
  GraduationCap,
  Eye,
  EyeOff,
  X,
  Check,
} from "lucide-react";
import { cn, normalizeArabicText } from "../utils";
import { usePrivacyMask } from "../hooks/usePrivacyMask";
import type { Course } from "../data";
import { TOTAL_CREDITS } from "../constants";
import { getCachedStudentProfile } from "../services/studentService";
import {
  isRemedialCourse,
  calculateGPA,
  calculateDegreeCredits,
  calculateTargetGPAAnalysis,
  getTopRetakeRecommendations,
  getAcademicStandingInfo,
} from "../core/courseProgress";

interface GPAPageProps {
  courses: Course[];
  completedCourses: Set<string>;
  courseGrades: Record<string, number>;
  setCourseGrades: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  failedCourseIds: Set<string>;
  setFailedCourseIds: (ids: Set<string>) => void;
  activeMajorName?: string;
  onSelectMajor?: () => void;
  categoryRequirements?: Record<string, number>;
  totalDegreeCredits?: number;
}

export const GPAPage: React.FC<GPAPageProps> = ({
  courses,
  completedCourses,
  courseGrades,
  setCourseGrades,
  failedCourseIds,
  activeMajorName,
  onSelectMajor,
  categoryRequirements,
  totalDegreeCredits,
}) => {
  const [whatIfGrades, setWhatIfGrades] = useState<Record<string, number>>({});
  const [targetGPAInput, setTargetGPAInput] = useState("80");
  const { isPrivacyMasked, togglePrivacyMask } = usePrivacyMask();
  const [isAddPickerOpen, setIsAddPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false,
  );
  const [visualViewportInfo, setVisualViewportInfo] = useState<{
    height: number;
    offsetTop: number;
  }>(() => ({
    height: typeof window !== "undefined" ? window.innerHeight : 600,
    offsetTop: 0,
  }));

  // Track viewport resize to adapt layout
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Visual viewport tracking on mobile to keep picker above virtual keyboard
  useEffect(() => {
    if (typeof window === "undefined" || !isAddPickerOpen) return;

    const originalOverflow = document.body.style.overflow;
    if (window.innerWidth < 640) {
      document.body.style.overflow = "hidden";
    }

    const updateViewport = () => {
      if (window.visualViewport) {
        setVisualViewportInfo({
          height: window.visualViewport.height,
          offsetTop: window.visualViewport.offsetTop,
        });
      } else {
        setVisualViewportInfo({
          height: window.innerHeight,
          offsetTop: 0,
        });
      }
    };

    updateViewport();

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewport);
      window.visualViewport.addEventListener("scroll", updateViewport);
    } else {
      window.addEventListener("resize", updateViewport);
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateViewport);
        window.visualViewport.removeEventListener("scroll", updateViewport);
      } else {
        window.removeEventListener("resize", updateViewport);
      }
    };
  }, [isAddPickerOpen]);

  // Remaining courses available to add for what-if scenario (excluding completed and already added what-if)
  const remainingCoursesToAdd = useMemo(() => {
    return courses.filter(
      (c) =>
        !completedCourses.has(c.id) &&
        !failedCourseIds.has(c.id) &&
        !Object.prototype.hasOwnProperty.call(whatIfGrades, c.id),
    );
  }, [courses, completedCourses, failedCourseIds, whatIfGrades]);

  // Grouped and filtered courses for the categorized What-If picker
  const filteredGroupedCourses = useMemo(() => {
    const normQ = normalizeArabicText(searchQuery.trim().toLowerCase());
    const filtered = remainingCoursesToAdd.filter((c) => {
      if (!normQ) return true;
      const normName = normalizeArabicText(c.name.toLowerCase());
      return normName.includes(normQ) || c.id.includes(searchQuery.trim());
    });

    const groups: Record<string, Course[]> = {};
    for (const c of filtered) {
      const cat = c.category || "متطلبات أخرى";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(c);
    }

    const CATEGORY_ORDER = [
      "متطلب تخصص إجباري",
      "متطلب تخصص اختياري",
      "متطلب كلية إجباري",
      "متطلب كلية اختياري",
      "متطلب جامعة إجباري",
      "متطلب جامعة اختياري",
      "متطلب استدراكي إجباري",
    ];

    return Object.entries(groups).sort(([catA], [catB]) => {
      const idxA = CATEGORY_ORDER.indexOf(catA);
      const idxB = CATEGORY_ORDER.indexOf(catB);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return catA.localeCompare(catB);
    });
  }, [remainingCoursesToAdd, searchQuery]);

  const handleAddWhatIfCourse = (courseId: string, defaultGrade = 75) => {
    if (!courseId) return;
    setWhatIfGrades((prev) => ({
      ...prev,
      [courseId]: defaultGrade,
    }));
  };

  const handleRemoveWhatIfCourse = (courseId: string) => {
    setWhatIfGrades((prev) => {
      const next = { ...prev };
      delete next[courseId];
      return next;
    });
  };

  const handleResetWhatIf = () => {
    setWhatIfGrades({});
  };

  const [resetFeedback, setResetFeedback] = useState<string | null>(null);
  const initialGradesRef = useRef<Record<string, number>>({ ...courseGrades });

  // Restore academic record grades back to original synced official grades
  const handleRestoreOriginalGrades = () => {
    const profile = getCachedStudentProfile();
    const restoredGrades: Record<string, number> = {};

    if (profile) {
      if (
        profile.courseGrades &&
        Object.keys(profile.courseGrades).length > 0
      ) {
        Object.assign(restoredGrades, profile.courseGrades);
      }
      if (profile.semesters && profile.semesters.length > 0) {
        for (const sem of profile.semesters) {
          for (const c of sem.courses) {
            if (typeof c.grade === "number" && !isNaN(c.grade) && c.grade > 0) {
              restoredGrades[c.code] = c.grade;
            }
          }
        }
      }
      if (profile.planCourses && profile.planCourses.length > 0) {
        for (const c of profile.planCourses) {
          const cId = c.id || c.code;
          if (
            cId &&
            typeof c.grade === "number" &&
            !isNaN(c.grade) &&
            c.grade > 0
          ) {
            restoredGrades[cId] = c.grade;
          }
        }
      }
    }

    if (Object.keys(restoredGrades).length > 0) {
      setCourseGrades(restoredGrades);
      setResetFeedback("تمت استعادة درجاتك الأصلية من البوابة");
    } else if (Object.keys(initialGradesRef.current).length > 0) {
      setCourseGrades({ ...initialGradesRef.current });
      setResetFeedback("تمت استعادة العلامات الابتدائية");
    } else {
      setCourseGrades({});
      setResetFeedback("تمت إعادة ضبط العلامات");
    }

    setTimeout(() => {
      setResetFeedback(null);
    }, 2500);
  };

  // Grade change for numeric input
  const handleGradeChange = (
    courseId: string,
    value: string,
    isWhatIf: boolean,
  ) => {
    if (value === "") {
      if (isWhatIf) {
        setWhatIfGrades((prev) => {
          const next = { ...prev };
          delete next[courseId];
          return next;
        });
      } else {
        setCourseGrades((prev) => {
          const next = { ...prev };
          delete next[courseId];
          return next;
        });
      }
      return;
    }

    const num = Math.min(100, Math.max(0, parseFloat(value)));
    if (!Number.isFinite(num)) return;

    if (isWhatIf) {
      setWhatIfGrades((prev) => ({ ...prev, [courseId]: num }));
    } else {
      setCourseGrades((prev) => ({ ...prev, [courseId]: num }));
    }
  };

  // 1. What-If Courses (Top List)
  const whatIfCourses = useMemo(() => {
    return courses.filter((c) =>
      Object.prototype.hasOwnProperty.call(whatIfGrades, c.id),
    );
  }, [courses, whatIfGrades]);

  // 2. Existing Academic Record Courses (Bottom List)
  const existingCourses = useMemo(() => {
    return courses.filter(
      (c) =>
        completedCourses.has(c.id) ||
        failedCourseIds.has(c.id) ||
        (courseGrades[c.id] !== undefined && courseGrades[c.id] !== null),
    );
  }, [courses, completedCourses, failedCourseIds, courseGrades]);

  // Current GPA calculation
  const cumulativeGPA = useMemo(() => {
    return calculateGPA(
      courses,
      courseGrades,
      completedCourses,
      failedCourseIds,
    );
  }, [courses, courseGrades, completedCourses, failedCourseIds]);

  // Combined GPA with what-if grades
  const projectedGPA = useMemo(() => {
    const mergedGrades = { ...courseGrades, ...whatIfGrades };
    const mergedCompleted = new Set([
      ...Array.from(completedCourses),
      ...Object.keys(whatIfGrades),
    ]);
    return calculateGPA(
      courses,
      mergedGrades,
      mergedCompleted,
      failedCourseIds,
    );
  }, [courses, courseGrades, completedCourses, failedCourseIds, whatIfGrades]);

  const earnedCredits = useMemo(() => {
    return calculateDegreeCredits(courses, completedCourses);
  }, [courses, completedCourses]);

  const effectiveTotalCredits = useMemo(() => {
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

  const remainingCredits = useMemo(() => {
    return Math.max(0, effectiveTotalCredits - earnedCredits);
  }, [effectiveTotalCredits, earnedCredits]);

  const projectedCredits = useMemo(() => {
    const mergedCompleted = new Set([
      ...Array.from(completedCourses),
      ...Object.keys(whatIfGrades),
    ]);
    return calculateDegreeCredits(courses, mergedCompleted);
  }, [courses, completedCourses, whatIfGrades]);

  // Academic Standing & Warnings
  const standingInfo = useMemo(() => {
    return getAcademicStandingInfo(
      cumulativeGPA,
      earnedCredits,
      effectiveTotalCredits,
    );
  }, [cumulativeGPA, earnedCredits, effectiveTotalCredits]);

  // Graded attempted credits (exact denominator for cumulative GPA, including failed degree courses and excluding remedial/pass-fail)
  const gradedCredits = useMemo(() => {
    return existingCourses.reduce((sum, c) => {
      if (isRemedialCourse(c)) return sum;
      const g = courseGrades[c.id];
      if (g !== undefined && g !== null && g !== -1) return sum + c.credits;
      if (failedCourseIds.has(c.id)) return sum + c.credits;
      return sum;
    }, 0);
  }, [existingCourses, courseGrades, failedCourseIds]);

  // Target GPA Analysis: accurately uses graded attempted credits instead of earned credits
  const targetAnalysis = useMemo(() => {
    return calculateTargetGPAAnalysis(
      cumulativeGPA,
      gradedCredits,
      Math.min(
        95,
        Math.max(60, Number(targetGPAInput.replace(",", ".")) || 60),
      ),
      remainingCredits,
    );
  }, [cumulativeGPA, gradedCredits, targetGPAInput, remainingCredits]);

  // Top Retake Recommendations (includes failed courses which yield highest GPA boost, and eligible lower grades)
  const retakeRecommendations = useMemo(() => {
    return getTopRetakeRecommendations(
      courses,
      courseGrades,
      completedCourses,
      failedCourseIds,
      85,
      undefined,
      0.1,
    );
  }, [courses, courseGrades, completedCourses, failedCourseIds]);

  return (
    <main
      dir="rtl"
      className="w-full max-w-[1200px] mx-auto p-4 sm:p-6 space-y-[var(--s-6)] text-[var(--text)]"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
        <div>
          <h1 className="text-[var(--fs-xl)] font-title text-[var(--text)] m-0">
            المعدل والدرجات
          </h1>
          {activeMajorName && (
            <p className="text-[13px] text-[var(--text-2)] mt-1 mb-0">
              {onSelectMajor ? (
                <button
                  type="button"
                  onClick={onSelectMajor}
                  className="p-0 bg-transparent border-0 text-[var(--text-2)] hover:text-[var(--text)] hover:underline cursor-pointer"
                >
                  التخصص: {activeMajorName}
                </button>
              ) : (
                `التخصص: ${activeMajorName}`
              )}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={togglePrivacyMask}
          className={cn(
            "px-3 py-1.5 rounded-[var(--r-control)] border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all self-start sm:self-auto",
            isPrivacyMasked
              ? "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400"
              : "border-[var(--line-control)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--sunken)]",
          )}
          title="وضع الخصوصية: إخفاء وتمويه المعدل والدرجات عند التواجد في الأماكن العامة"
        >
          {isPrivacyMasked ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>
            {isPrivacyMasked ? "إلغاء تمويه الدرجات" : "وضع الخصوصية (تمويه)"}
          </span>
        </button>
      </div>

      {/* Academic Standing & Senior Readiness Banner */}
      <div
        className={`p-4 rounded-[var(--r-control)] border flex flex-wrap items-center justify-between gap-3 shadow-sm ${
          standingInfo.isWarning
            ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
            : standingInfo.isWarningZone
              ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
              : "bg-[var(--surface)] border-[var(--line)] text-[var(--text)]"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--surface)] shadow-xs">
            {standingInfo.isWarning ? (
              <AlertTriangle size={20} className="text-rose-500" />
            ) : standingInfo.isHonor ? (
              <Award size={20} className="text-amber-500" />
            ) : (
              <GraduationCap size={20} className="text-[var(--accent)]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[14px]">
                الحالة الأكاديمية: {standingInfo.standingText}
              </span>
              {standingInfo.isHonor && (
                <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 rounded-full">
                  شرف أكاديمي ⭐
                </span>
              )}
              {standingInfo.scholarshipTier !== "none" && (
                <span
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-bold rounded-full border",
                    standingInfo.scholarshipTier === "full"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                      : standingInfo.scholarshipTier === "partial"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
                  )}
                  title="متابعة استمرار شروط منحة التفوق الأكاديمي"
                >
                  {standingInfo.scholarshipLabel}
                </span>
              )}
            </div>
            <p className="text-[12px] opacity-80 mt-0.5 mb-0">
              {standingInfo.isWarning
                ? "تنبيه: معدلك التراكمي أقل من 60%. احرص على رفع علاماتك لتجنب صدور إنذار أكاديمي."
                : standingInfo.isWarningZone
                  ? "تنبيه حذر: معدلك التراكمي قريب من حد الإنذار (60%). استغل أدوات التوقع أدناه لتحسينه."
                  : "سجلك الأكاديمي ضمن النطاق الآمن. استمر في التميز الدراسي!"}
            </p>
          </div>
        </div>

        <div className="text-end text-[12px] tabular-nums space-y-1">
          <span className="block font-medium">
            مشروع التخرج:{" "}
            {standingInfo.canRegisterGradProject ? (
              <strong className="text-emerald-500 font-bold">
                متاح للتسجيل (أنجزت 120+ س)
              </strong>
            ) : (
              <span className="text-[var(--text-2)]">
                متبقي {standingInfo.creditsToGradProject} ساعة لفتحه
              </span>
            )}
          </span>
          <span className="block font-medium">
            التدريب الميداني:{" "}
            {standingInfo.canRegisterFieldTraining ? (
              <strong className="text-emerald-500 font-bold">
                متاح للتسجيل (أنجزت 90+ س)
              </strong>
            ) : (
              <span className="text-[var(--text-2)]">
                متبقي {standingInfo.creditsToFieldTraining} ساعة لفتحه
              </span>
            )}
          </span>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Smart Tools: Target GPA Calculator + Retake Optimizer */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-4">
        {/* 1. محاكي المعدل المستهدف */}
        <div className="self-start h-fit p-3 rounded-[var(--r-control)] bg-[var(--surface)] border border-[var(--line)] shadow-sm space-y-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)]">
                <Target size={16} />
              </div>
              <h3 className="text-[13px] font-bold text-[var(--text)] m-0">
                محاكي المعدل المستهدف
              </h3>
            </div>
            <p className="text-[11px] text-[var(--text-2)] m-0">
              حدد المعدل الذي تطمح إليه، وسيحسب النظام أقل معدل تحتاجه في
              الساعات المتبقية ({remainingCredits} س):
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="target-gpa-input"
                className="text-[11px] text-[var(--text-2)]"
              >
                المعدل المستهدف
              </label>
              <input
                id="target-gpa-input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={targetGPAInput}
                onChange={(event) =>
                  setTargetGPAInput(event.currentTarget.value)
                }
                onBlur={() => {
                  const parsed = Number(targetGPAInput.replace(",", "."));
                  setTargetGPAInput(
                    String(
                      targetGPAInput.trim() !== "" && Number.isFinite(parsed)
                        ? Math.min(95, Math.max(60, parsed))
                        : 80,
                    ),
                  );
                }}
                className="h-7 w-20 px-2 text-center text-[12px] font-bold tabular-nums rounded-[var(--r-control)] bg-[var(--surface)] border border-[var(--line-control)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                aria-label="المعدل المستهدف عند التخرج من 60 إلى 95"
              />
            </div>

            <div className="p-1.5 rounded-lg bg-[var(--sunken)] flex items-center justify-between gap-2 text-[11px]">
              <div>
                <span className="text-[var(--text-3)] block text-[10px]">
                  المعدل المطلوب في الساعات المتبقية:
                </span>
                <span
                  className={`text-[14px] font-bold tabular-nums ${
                    !targetAnalysis.isPossible
                      ? "text-rose-500"
                      : targetAnalysis.requiredRemainingGPA > 80
                        ? "text-amber-500"
                        : "text-emerald-500"
                  }`}
                  dir="ltr"
                >
                  {targetAnalysis.requiredRemainingGPA}%
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  !targetAnalysis.isPossible
                    ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                    : targetAnalysis.difficulty === "easy"
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                }`}
              >
                {targetAnalysis.difficultyLabel}
              </span>
            </div>
          </div>
        </div>

        {/* 2. محلل أفضل المواد للإعادة */}
        <div className="p-4 rounded-[var(--r-control)] bg-[var(--surface)] border border-[var(--line)] shadow-sm space-y-2.5 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500">
                  <TrendingUp size={16} />
                </div>
                <h3 className="text-[14px] font-bold text-[var(--text)] m-0">
                  محلل أفضل المواد للإعادة
                </h3>
              </div>
              {retakeRecommendations.length > 0 && (
                <span className="text-[11px] font-semibold text-[var(--text-3)] bg-[var(--sunken)] px-2 py-0.5 rounded-full">
                  {retakeRecommendations.length} مقترحة
                </span>
              )}
            </div>
            <p className="text-[12px] text-[var(--text-2)] m-0">
              المساقات الأكاديمية التي تمنح معدلك التراكمي أكبر قفزة ممكنة عند
              إعادتها:
            </p>
          </div>

          {retakeRecommendations.length === 0 ? (
            <div className="p-4 text-center text-[12px] text-[var(--text-3)] bg-[var(--sunken)] rounded-lg">
              لا توجد مواد مقترحة للإعادة حالياً تحقق زيادة في المعدل تفوق 0.1%
              (درجاتك مرتفعة أو فارق التحسين أقل من 0.1%).
            </div>
          ) : (
            <div className="space-y-1.5">
              <div
                tabIndex={0}
                aria-label="قائمة المواد المقترحة للإعادة"
                className="max-h-[160px] sm:max-h-[220px] overflow-y-auto space-y-1.5 pr-1 pl-0.5 overscroll-contain focus:outline-none"
              >
                {retakeRecommendations.map((rec) => (
                  <div
                    key={rec.course.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleAddWhatIfCourse(rec.course.id, 85)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleAddWhatIfCourse(rec.course.id, 85);
                      }
                    }}
                    className="p-2 sm:p-2.5 rounded-xl bg-[var(--sunken)] hover:bg-[var(--accent-soft)] hover:border-[var(--accent)] border border-transparent flex items-center justify-between gap-2 text-[12px] cursor-pointer transition-all group shadow-2xs"
                    title="انقر لتجربة إعادة هذه المادة بعلامة 85 في التوقع"
                  >
                    <div>
                      <span className="font-bold text-[var(--text)] group-hover:text-[var(--accent)] block text-[12px] sm:text-[13px] transition-colors leading-tight">
                        {rec.course.name}
                      </span>
                      <span className="text-[var(--text-3)] text-[10px] sm:text-[11px]">
                        علامتك الحالية: {rec.currentGrade} | ساعاتها:{" "}
                        {rec.course.credits}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-lg font-bold text-[10px] sm:text-[11px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        +{rec.potentialGpaBoost}% قفزة
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {retakeRecommendations.length > 3 && (
                <p className="text-[10px] sm:text-[11px] text-[var(--text-3)] text-center m-0 pt-1 border-t border-[var(--line-control)]">
                  مرّر لأسفل داخل القائمة لعرض بقية المواد ↕
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* المعدل المتوقع يظهر قبل قائمة المواد التي تُستخدم لحسابه */}
      <div
        aria-label="ملخص المعدلات"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
      >
        <article className="min-w-0 p-4 sm:p-5 bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-surface)] shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-[var(--text-2)]">
              المعدل التراكمي الفعلي
            </span>
            <span className="px-2 py-1 rounded-full bg-[var(--sunken)] text-[10px] text-[var(--text-3)]">
              السجل الحالي
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-[var(--fs-figure)] font-semibold text-[var(--text)] tabular-nums leading-none privacy-sensitive">
              <span dir="ltr">
                {cumulativeGPA > 0 ? `${cumulativeGPA.toFixed(2)}%` : "0.00%"}
              </span>
            </span>
          </div>
          <div
            className="mt-4 w-full bg-[var(--sunken)] h-1.5 rounded-full overflow-hidden"
            role="progressbar"
            aria-label="نسبة المعدل التراكمي الفعلي"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.max(0, cumulativeGPA))}
          >
            <div
              className="bg-[var(--accent)] h-full transition-all duration-[var(--dur-2)]"
              style={{ width: `${Math.min(100, Math.max(0, cumulativeGPA))}%` }}
            />
          </div>
          <p className="text-[13px] text-[var(--text-3)] tabular-nums mt-2 m-0">
            {earnedCredits} من أصل {effectiveTotalCredits} ساعة منجزة (
            {remainingCredits} ساعة متبقية)
          </p>
        </article>

        <article className="min-w-0 p-4 sm:p-5 bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-surface)] shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-[var(--text-2)]">
              المعدل المتوقع
            </span>
            <span className="px-2 py-1 rounded-full bg-[var(--accent-soft)] text-[10px] text-[var(--accent)]">
              حسب خطتك
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-[var(--fs-figure)] font-semibold text-[var(--accent)] tabular-nums leading-none privacy-sensitive">
              <span dir="ltr">
                {projectedGPA > 0 ? `${projectedGPA.toFixed(2)}%` : "0.00%"}
              </span>
            </span>
          </div>
          <div
            className="mt-4 w-full bg-[var(--sunken)] h-1.5 rounded-full overflow-hidden"
            role="progressbar"
            aria-label="نسبة المعدل المتوقع"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.max(0, projectedGPA))}
          >
            <div
              className="bg-[var(--accent)] h-full transition-all duration-[var(--dur-2)]"
              style={{
                width: `${Math.min(100, Math.max(0, projectedGPA))}%`,
              }}
            />
          </div>
          <p className="text-[13px] text-[var(--text-3)] tabular-nums mt-2 m-0">
            {projectedCredits} ساعة محتسبة إجمالاً
          </p>
          {cumulativeGPA >= 85 && projectedGPA < 85 && projectedGPA > 0 && (
            <div className="mt-2.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/25 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <AlertTriangle size={13} className="shrink-0" />
              <span>
                تحذير: المواد التجريبية تخفض المعدل المتوقع عن عتبة منحة التفوق
                (85%).
              </span>
            </div>
          )}
          {cumulativeGPA > 0 && cumulativeGPA < 85 && projectedGPA >= 85 && (
            <div className="mt-2.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <Sparkles size={13} className="shrink-0 text-amber-500" />
              <span>
                سيناريو ممتاز: هذه الدرجات تؤهلك للحصول على منحة التفوق
                الأكاديمي (85%+).
              </span>
            </div>
          )}
        </article>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. قائمة المواد المتوقعة (أعلى قائمة المواد) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <section className="space-y-3" aria-labelledby="projected-gpa-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line-control)] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <div>
              <h2
                id="projected-gpa-title"
                className="text-[16px] font-semibold text-[var(--text)] m-0"
              >
                المعدل المتوقع
              </h2>
              <p className="text-[12px] text-[var(--text-2)] m-0">
                أضف مواد تنوي تسجيلها وجرّب درجاتك المتوقعة لمعرفة تأثيرها على
                معدلك التراكمي
              </p>
            </div>
          </div>

          <div className="relative flex items-center gap-2">
            {/* Quick Add What-If Course Trigger */}
            <button
              type="button"
              onClick={() => {
                setIsAddPickerOpen((prev) => !prev);
                setSearchQuery("");
              }}
              className="h-[var(--control-h)] px-3 text-[13px] bg-[var(--surface)] hover:bg-[var(--sunken)] border border-[var(--accent)] rounded-[var(--r-control)] text-[var(--accent)] font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
            >
              <Plus size={15} />
              <span>إضافة مادة للتوقع</span>
            </button>

            {isAddPickerOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
                style={
                  isMobile && visualViewportInfo.height
                    ? {
                        top: `${visualViewportInfo.offsetTop}px`,
                        height: `${visualViewportInfo.height}px`,
                      }
                    : undefined
                }
              >
                {/* Backdrop to close when clicking outside */}
                <div
                  className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
                  onClick={() => {
                    setIsAddPickerOpen(false);
                    setSearchQuery("");
                  }}
                />

                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="اختر مادة لإضافتها للتوقع"
                  className="relative z-10 w-full max-w-[480px] bg-[var(--surface)] border border-[var(--line-control)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
                  style={{
                    maxHeight: isMobile
                      ? `${Math.min(520, Math.max(220, visualViewportInfo.height - 32))}px`
                      : "min(560px, 85vh)",
                  }}
                >
                  {/* Search and Header */}
                  <div className="shrink-0 p-3 sm:p-3.5 border-b border-[var(--line-control)] bg-[var(--sunken)] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] sm:text-[14px] font-bold text-[var(--text)]">
                        اختر مادة لإضافتها للتوقع
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddPickerOpen(false);
                          setSearchQuery("");
                        }}
                        className="p-1 rounded-md text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer"
                        title="إغلاق"
                      >
                        <X size={17} />
                      </button>
                    </div>

                    <div className="relative">
                      <Search
                        size={15}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none"
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ابحث باسم المادة أو رقمها..."
                        className="w-full h-9 pr-8 pl-8 rounded-lg bg-[var(--surface)] border border-[var(--line-control)] text-[16px] sm:text-xs text-[var(--text)] placeholder:text-[var(--text-3)] placeholder:text-xs outline-none focus:border-[var(--accent)]"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grouped Courses List */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3 overscroll-contain">
                    {filteredGroupedCourses.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[var(--text-3)]">
                        {searchQuery
                          ? "لا توجد مواد مطابقة للبحث."
                          : "تمت إضافة جميع المواد المتاحة للتوقع."}
                      </div>
                    ) : (
                      filteredGroupedCourses.map(
                        ([categoryName, catCourses]) => (
                          <div key={categoryName} className="space-y-1">
                            <div className="px-2 py-1 text-[11px] font-bold text-[var(--text-2)] bg-[var(--sunken)] rounded-md flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
                              <span>{categoryName}</span>
                              <span className="text-[10px] text-[var(--text-3)] tabular-nums">
                                {catCourses.length}
                              </span>
                            </div>
                            <div className="space-y-0.5">
                              {catCourses.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    handleAddWhatIfCourse(c.id);
                                    setIsAddPickerOpen(false);
                                    setSearchQuery("");
                                  }}
                                  className="w-full px-2.5 py-2 rounded-lg text-right flex items-center justify-between gap-2 hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] group transition-colors cursor-pointer"
                                >
                                  <div className="min-w-0">
                                    <span className="text-[12px] font-semibold text-[var(--text)] group-hover:text-[var(--accent)] block truncate">
                                      {c.name}
                                    </span>
                                    <span className="text-[10px] text-[var(--text-3)] font-mono tabular-nums block">
                                      {c.id}
                                    </span>
                                  </div>
                                  <span className="text-[11px] font-bold text-[var(--text-2)] shrink-0 bg-[var(--sunken)] px-1.5 py-0.5 rounded">
                                    {c.credits} س
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ),
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {whatIfCourses.length > 0 && (
              <button
                type="button"
                onClick={handleResetWhatIf}
                className="h-[var(--control-h)] px-3 text-[13px] text-[var(--danger)] hover:bg-[var(--danger-soft)]/20 rounded-[var(--r-control)] border border-[var(--line-control)] flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                title="إزالة جميع المواد المتوقعة"
              >
                <RotateCcw size={13} />
                <span>إعادة ضبط</span>
              </button>
            )}
          </div>
        </div>

        {/* What-If Table / Card */}
        <div className="border border-[var(--accent)]/30 rounded-[var(--r-control)] overflow-hidden bg-[var(--surface)] shadow-sm">
          {whatIfCourses.length === 0 ? (
            <div className="p-8 text-center bg-[var(--surface)]">
              <p className="text-[14px] text-[var(--text-2)] m-0 font-medium">
                لم تقم بإضافة مواد للتوقع بعد.
              </p>
              <p className="text-[12px] text-[var(--text-3)] mt-1 mb-0">
                اختر مادة من القائمة المنسدلة أعلاه لإضافتها واختبار تأثير
                علامتها المتوقعة.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-[12px] sm:text-[14px]">
                <thead className="bg-[var(--sunken)] border-b border-[var(--line-control)] text-[11px] sm:text-[12px] font-medium text-[var(--text-2)]">
                  <tr>
                    <th scope="col" className="p-2 sm:p-3 font-semibold">
                      المادة المتوقعة
                    </th>
                    <th
                      scope="col"
                      className="p-2 sm:p-3 font-semibold text-center w-10 sm:w-20"
                    >
                      <span className="hidden sm:inline">الساعات</span>
                      <span className="sm:hidden">س.م</span>
                    </th>
                    <th
                      scope="col"
                      className="p-2 sm:p-3 font-semibold text-center w-14 sm:w-32"
                    >
                      <span className="hidden sm:inline">
                        العلامة المتوقعة (0-100)
                      </span>
                      <span className="sm:hidden">المتوقع</span>
                    </th>
                    <th
                      scope="col"
                      className="p-2 sm:p-3 font-semibold text-end w-12 sm:w-28"
                    >
                      <span className="hidden sm:inline">النقاط</span>
                      <span className="sm:hidden">نقاط</span>
                    </th>
                    <th
                      scope="col"
                      className="p-2 sm:p-3 font-semibold text-center w-10 sm:w-16"
                    >
                      إزالة
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {whatIfCourses.map((c) => {
                    const grade = whatIfGrades[c.id] ?? 75;
                    const isRemedial = isRemedialCourse(c);
                    const points = isRemedial ? 0 : grade * c.credits;

                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-[var(--accent)]/5 transition-colors"
                      >
                        <td className="p-2 sm:p-3">
                          <span className="font-semibold text-[var(--text)] block text-[12px] sm:text-[13px] leading-tight">
                            {c.name}
                          </span>
                          <span className="text-[10px] sm:text-[12px] text-[var(--text-3)] tabular-nums block font-mono">
                            {c.id}
                          </span>
                        </td>
                        <td className="p-2 sm:p-3 text-center tabular-nums font-semibold text-[var(--text-2)] text-[12px] sm:text-[13px]">
                          <span dir="ltr">{c.credits}</span>
                        </td>
                        <td className="p-2 sm:p-3 text-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            placeholder="75"
                            value={grade !== undefined ? grade : ""}
                            onChange={(e) =>
                              handleGradeChange(c.id, e.target.value, true)
                            }
                            className="h-[28px] w-[42px] sm:h-[34px] sm:w-[72px] mx-auto px-0.5 sm:px-2 text-center rounded-[var(--r-control)] bg-[var(--surface)] text-[var(--text)] text-[12px] sm:text-[14px] font-bold border-2 border-[var(--accent)] focus:outline-none tabular-nums shadow-sm"
                            aria-label={`العلامة المتوقعة لمادة ${c.name}`}
                          />
                          <div className="flex items-center justify-center gap-1 mt-1">
                            {[60, 70, 80, 90].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() =>
                                  handleGradeChange(c.id, String(preset), true)
                                }
                                className={cn(
                                  "px-1 py-0.2 sm:px-1.5 sm:py-0.5 text-[8.5px] sm:text-[9.5px] rounded font-bold cursor-pointer transition-colors tabular-nums",
                                  grade === preset
                                    ? "bg-[var(--accent)] text-[var(--text-on-accent)] shadow-xs"
                                    : "bg-[var(--sunken)] text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--line-control)]",
                                )}
                                title={`تعيين العلامة إلى ${preset}`}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="p-2 sm:p-3 text-end tabular-nums text-[11px] sm:text-[13px] font-medium text-[var(--text)]">
                          {isRemedial ? (
                            <span className="text-[var(--text-3)]">
                              لا تدخل
                            </span>
                          ) : (
                            <span dir="ltr">
                              {points.toFixed(0)}{" "}
                              <span className="hidden sm:inline">نقطة</span>
                            </span>
                          )}
                        </td>
                        <td className="p-2 sm:p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveWhatIfCourse(c.id)}
                            className="p-1 sm:p-1.5 text-[var(--danger)] hover:bg-[var(--danger-soft)]/20 rounded-md transition-colors cursor-pointer"
                            title="إزالة المادة من التوقع"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. قائمة المواد الموجودة بالمعدل والدرجات (السجل الأكاديمي) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <section className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line-control)] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--sunken)] text-[var(--text-2)] flex items-center justify-center">
              <BookOpen size={16} />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--text)] m-0">
                مواد السجل الأكاديمي والدرجات المرصودة ({existingCourses.length}
                )
              </h2>
              <p className="text-[12px] text-[var(--text-2)] m-0">
                المساقات المجتازة والمسجلة من موقع الجامعة، مع إمكانية تعديل
                العلامة رقمياً
              </p>
            </div>
          </div>

          {/* زر إعادة ومزامنة درجات السجل الأكاديمي للأصل */}
          <div className="flex items-center gap-2">
            {resetFeedback && (
              <span className="text-[11px] sm:text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
                <Check size={14} className="text-emerald-500 shrink-0" />
                <span>{resetFeedback}</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleRestoreOriginalGrades}
              className="h-[var(--control-h)] px-3 text-[12px] sm:text-[13px] bg-[var(--surface)] hover:bg-[var(--sunken)] border border-[var(--line-control)] hover:border-[var(--accent)] text-[var(--text-2)] hover:text-[var(--text)] rounded-[var(--r-control)] font-medium flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
              title="إعادة درجات المساقات إلى درجاتها الأصلية المسحوبة من موقع الجامعة"
            >
              <RotateCcw
                size={13}
                className={
                  resetFeedback ? "animate-spin text-[var(--accent)]" : ""
                }
              />
              <span>إعادة العلامات للأصل</span>
            </button>
          </div>
        </div>

        {/* Academic Record Table */}
        <div className="border border-[var(--line)] rounded-[var(--r-control)] overflow-hidden bg-[var(--surface)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-[12px] sm:text-[14px]">
              <thead className="bg-[var(--sunken)] border-b border-[var(--line-control)] text-[11px] sm:text-[12px] font-medium text-[var(--text-2)]">
                <tr>
                  <th scope="col" className="p-2 sm:p-3 font-semibold">
                    المادة
                  </th>
                  <th
                    scope="col"
                    className="p-2 sm:p-3 font-semibold text-center w-10 sm:w-20"
                  >
                    <span className="hidden sm:inline">الساعات</span>
                    <span className="sm:hidden">س.م</span>
                  </th>
                  <th
                    scope="col"
                    className="p-2 sm:p-3 font-semibold text-center w-14 sm:w-32"
                  >
                    <span className="hidden sm:inline">
                      العلامة الفعلية (0-100)
                    </span>
                    <span className="sm:hidden">العلامة</span>
                  </th>
                  <th
                    scope="col"
                    className="p-2 sm:p-3 font-semibold text-end w-12 sm:w-28"
                  >
                    <span className="hidden sm:inline">النقاط</span>
                    <span className="sm:hidden">نقاط</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {existingCourses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-6 sm:p-8 text-center text-[var(--text-2)] text-[12px] sm:text-[13px]"
                    >
                      لم يتم سحب درجات أو مواد مجتازة بعد. سجّل الدخول بالرقم
                      الجامعي لسحب سجلك الأكاديمي تلقائياً.
                    </td>
                  </tr>
                ) : (
                  existingCourses.map((c) => {
                    const currentGrade = courseGrades[c.id];
                    const isRemedial = isRemedialCourse(c);
                    const isFailed =
                      failedCourseIds.has(c.id) ||
                      (typeof currentGrade === "number" && currentGrade < 50);

                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-[var(--sunken)] transition-colors"
                      >
                        <td className="p-2 sm:p-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-[var(--text)] block text-[12px] sm:text-[13px] leading-tight">
                              {c.name}
                            </span>
                            {isFailed && (
                              <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded">
                                راسب
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] sm:text-[12px] text-[var(--text-3)] tabular-nums block font-mono">
                            {c.id}
                          </span>
                        </td>
                        <td className="p-2 sm:p-3 text-center tabular-nums font-semibold text-[var(--text-2)] text-[12px] sm:text-[13px]">
                          <span dir="ltr">{c.credits}</span>
                        </td>
                        <td className="p-2 sm:p-3 text-center">
                          {currentGrade === -1 ? (
                            <span className="inline-block px-2 py-1 text-[11px] sm:text-[12px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-[var(--r-control)]">
                              ناجح
                            </span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              placeholder="-"
                              value={
                                currentGrade !== undefined &&
                                currentGrade !== null &&
                                currentGrade !== -1
                                  ? currentGrade
                                  : ""
                              }
                              onChange={(e) =>
                                handleGradeChange(c.id, e.target.value, false)
                              }
                              className={cn(
                                "h-[28px] w-[42px] sm:h-[32px] sm:w-[72px] mx-auto px-0.5 sm:px-2 text-center rounded-[var(--r-control)] bg-[var(--surface)] text-[var(--text)] text-[12px] sm:text-[14px] font-semibold border transition-all privacy-sensitive",
                                isFailed
                                  ? "border-rose-400 text-rose-500"
                                  : "border-[var(--line-control)]",
                                "focus:border-[var(--accent)] focus:outline-none tabular-nums shadow-sm",
                              )}
                              aria-label={`درجة مادة ${c.name}`}
                            />
                          )}
                        </td>
                        <td className="p-2 sm:p-3 text-end tabular-nums text-[11px] sm:text-[13px] text-[var(--text-3)]">
                          {isRemedial ? (
                            <>
                              <span className="hidden sm:inline">
                                لا تدخل في المعدل
                              </span>
                              <span className="sm:hidden text-[10px]">
                                مستثنى
                              </span>
                            </>
                          ) : currentGrade === -1 ? (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              غير نقطي
                            </span>
                          ) : typeof currentGrade === "number" &&
                            currentGrade > 0 ? (
                            <span
                              className="font-medium text-[var(--text)] privacy-sensitive"
                              dir="ltr"
                            >
                              {(currentGrade * c.credits).toFixed(0)}{" "}
                              <span className="hidden sm:inline">نقطة</span>
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Academic Record Summary Footer */}
          <div className="p-3.5 border-t border-[var(--line)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-2 text-[13px] text-[var(--text-2)] tabular-nums">
            <span>
              الساعات المنجزة الفعلية:{" "}
              <strong className="font-semibold text-[var(--text)]">
                {earnedCredits}
              </strong>{" "}
              من أصل {effectiveTotalCredits} ساعة
            </span>
            <span>
              المعدل التراكمي الفعلي:{" "}
              <strong className="font-semibold text-[var(--text)]" dir="ltr">
                {cumulativeGPA > 0 ? `${cumulativeGPA.toFixed(2)}%` : "0.00%"}
              </strong>
            </span>
          </div>
        </div>
      </section>
    </main>
  );
};

export default GPAPage;
