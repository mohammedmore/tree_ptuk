import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Play,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Plus,
  Trash2,
  Copy,
  ChevronRight,
  Layers,
  Flame,
  Wallet,
  BookOpen,
  Calendar,
  Check,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import type { Course, ScheduleEntry } from "../../data";
import {
  PlanKey,
  RegistrationPlan,
  RegistrationSectionItem,
  RegistrationExecutionSummary,
  CourseAttemptResult,
  PlanDiagnostic,
  loadRegistrationPlans,
  saveRegistrationPlans,
  createDefaultRegistrationPlans,
  validatePlanCollisions,
  checkPlanPrerequisites,
  checkPlanFinancialBalance,
  checkPlanCreditLimits,
  sortRegistrationItemsByPriority,
  recalculatePlanMetrics,
} from "../../core/semesterRegistration";
import {
  prewarmRegistration,
  executeRegistration,
  PrewarmResult,
} from "../../services/registrationService";
import {
  getCachedStudentProfile,
  StudentSyncProfile,
} from "../../services/studentService";
import { getOfficialTuitionRate } from "../../services/tuitionFeesService";
import { cn } from "../../utils";

interface SemesterRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSemester: string;
  catalogCourses: Course[];
  currentWeeklySchedule?: Record<string, ScheduleEntry>;
  onApplyRegisteredSchedule?: (schedule: Record<string, ScheduleEntry>) => void;
}

export const SemesterRegistrationModal: React.FC<
  SemesterRegistrationModalProps
> = ({
  isOpen,
  onClose,
  selectedSemester,
  catalogCourses,
  currentWeeklySchedule = {},
  onApplyRegisteredSchedule,
}) => {
  const [activeTab, setActiveTab] = useState<PlanKey>("A");
  const [plans, setPlans] = useState<Record<PlanKey, RegistrationPlan>>(() =>
    loadRegistrationPlans(selectedSemester),
  );
  const [activeView, setActiveView] = useState<"plans" | "console">("plans");

  // Prewarm state
  const [prewarmStatus, setPrewarmStatus] = useState<PrewarmResult | null>(
    null,
  );
  const [isPrewarming, setIsPrewarming] = useState(false);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionSummary, setExecutionSummary] =
    useState<RegistrationExecutionSummary | null>(null);
  const [autoFallback, setAutoFallback] = useState(true);

  // Scheduling Timer state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState("08:00:00");
  const [countdownText, setCountdownText] = useState<string>("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Student Profile
  const cachedProfile = useMemo(() => getCachedStudentProfile(), [isOpen]);
  const studentId = cachedProfile?.studentId || "";
  const passedCourseIds = useMemo(
    () => new Set(cachedProfile?.passedCourseIds || []),
    [cachedProfile],
  );

  // Course map for fast lookup
  const courseMap = useMemo(
    () => new Map(catalogCourses.map((c) => [c.id, c])),
    [catalogCourses],
  );

  // Reload plans when semester changes or modal opens
  useEffect(() => {
    if (!isOpen) return;
    const loaded = loadRegistrationPlans(selectedSemester);
    setPlans(loaded);

    // Initial pre-warming check
    handlePrewarm();
  }, [isOpen, selectedSemester]);

  // Persist whenever plans change
  const updatePlans = (
    updater: (
      prev: Record<PlanKey, RegistrationPlan>,
    ) => Record<PlanKey, RegistrationPlan>,
  ) => {
    setPlans((prev) => {
      const next = updater(prev);
      saveRegistrationPlans(selectedSemester, next);
      return next;
    });
  };

  const currentPlan = plans[activeTab];

  const isSummerSemester = selectedSemester.includes("الصيفي");
  const hasAcademicWarning = Boolean(
    (cachedProfile?.academicWarning &&
      cachedProfile.academicWarning !== "لا يوجد") ||
    cachedProfile?.academicStatus?.includes("إنذار") ||
    cachedProfile?.academicStatus?.includes("ملاحظة") ||
    (typeof cachedProfile?.gpa === "number" &&
      cachedProfile.gpa > 0 &&
      cachedProfile.gpa < 60),
  );

  // Pre-flight diagnostics
  const collisionDiags = useMemo(
    () => validatePlanCollisions(currentPlan.items),
    [currentPlan.items],
  );

  const prereqDiags = useMemo(
    () =>
      checkPlanPrerequisites(
        currentPlan.items,
        passedCourseIds,
        catalogCourses,
      ),
    [currentPlan.items, passedCourseIds, catalogCourses],
  );

  const hourlyRate = useMemo(
    () =>
      cachedProfile?.majorName
        ? getOfficialTuitionRate(cachedProfile.majorName).hourlyRateJOD
        : 24,
    [cachedProfile?.majorName],
  );

  const financialCheck = useMemo(
    () =>
      checkPlanFinancialBalance(
        currentPlan.totalCredits,
        cachedProfile?.financialBalance,
        hourlyRate,
      ),
    [currentPlan.totalCredits, cachedProfile?.financialBalance, hourlyRate],
  );

  const creditLimitDiags = useMemo(
    () =>
      checkPlanCreditLimits(currentPlan.totalCredits, selectedSemester, {
        hasAcademicWarning,
        gpa: cachedProfile?.gpa,
      }),
    [
      currentPlan.totalCredits,
      selectedSemester,
      hasAcademicWarning,
      cachedProfile?.gpa,
    ],
  );

  const allDiagnostics = useMemo(() => {
    const list: PlanDiagnostic[] = [
      ...collisionDiags,
      ...prereqDiags,
      ...creditLimitDiags,
    ];
    if (financialCheck.diagnostic) {
      list.push(financialCheck.diagnostic);
    }
    return list;
  }, [collisionDiags, prereqDiags, creditLimitDiags, financialCheck]);

  // Prewarm Gateway
  const handlePrewarm = async () => {
    setIsPrewarming(true);
    try {
      const res = await prewarmRegistration(studentId, undefined, true);
      setPrewarmStatus(res);
    } finally {
      setIsPrewarming(false);
    }
  };

  // Import from current Weekly Schedule into active plan
  const handleImportFromWeeklySchedule = () => {
    const scheduleEntries = Object.entries(currentWeeklySchedule);
    if (scheduleEntries.length === 0) return;

    const importedItems: RegistrationSectionItem[] = [];

    for (const [courseId, entry] of scheduleEntries) {
      const course = courseMap.get(courseId);
      const courseName = course?.name || courseId;
      const credits = course?.credits || 3;
      const section = entry.section || "1";
      const isLab = credits === 1;

      importedItems.push({
        courseId,
        courseName,
        section,
        credits,
        instructor: entry.instructor,
        room: entry.room,
        timeText: `${entry.startTime}-${entry.endTime} ${entry.day}`,
        priority: isLab ? 1 : 2,
        category: course?.category,
        blocks: [
          {
            days: entry.days || (entry.day ? [entry.day] : []),
            start: parseFloat(entry.startTime?.replace(":", ".") || "8.5"),
            end: parseFloat(entry.endTime?.replace(":", ".") || "9.5"),
            rawTime: `${entry.startTime}-${entry.endTime}`,
          },
        ],
      });
    }

    updatePlans((prev) => ({
      ...prev,
      [activeTab]: recalculatePlanMetrics({
        ...prev[activeTab],
        items: importedItems,
      }),
    }));
  };

  // Copy Plan A to B or C
  const handleCopyPlan = (from: PlanKey, to: PlanKey) => {
    updatePlans((prev) => ({
      ...prev,
      [to]: recalculatePlanMetrics({
        ...prev[to],
        items: prev[from].items.map((item) => ({
          ...item,
          // bump section as default alternative if possible
          section: String(parseInt(item.section, 10) + 1 || "2"),
        })),
      }),
    }));
  };

  // Remove Item
  const handleRemoveItem = (courseId: string) => {
    updatePlans((prev) => ({
      ...prev,
      [activeTab]: recalculatePlanMetrics({
        ...prev[activeTab],
        items: prev[activeTab].items.filter((i) => i.courseId !== courseId),
      }),
    }));
  };

  // Change Item Section
  const handleUpdateSection = (courseId: string, newSec: string) => {
    updatePlans((prev) => ({
      ...prev,
      [activeTab]: recalculatePlanMetrics({
        ...prev[activeTab],
        items: prev[activeTab].items.map((i) =>
          i.courseId === courseId ? { ...i, section: newSec } : i,
        ),
      }),
    }));
  };

  // Change Item Priority
  const handleUpdatePriority = (courseId: string, priority: number) => {
    updatePlans((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        items: prev[activeTab].items.map((i) =>
          i.courseId === courseId ? { ...i, priority } : i,
        ),
      },
    }));
  };

  // Execute Registration
  const handleExecuteNow = async () => {
    if (currentPlan.items.length === 0) return;

    setActiveView("console");
    setIsExecuting(true);
    setIsScheduled(false);

    try {
      const summary = await executeRegistration(studentId, undefined, plans, {
        demoMode: true,
        targetPlan: activeTab,
        autoFallbackOnFull: autoFallback,
        maxRetries: 3,
      });
      setExecutionSummary(summary);

      // If registered successfully and callback provided, apply to live schedule
      if (onApplyRegisteredSchedule && summary.registeredCount > 0) {
        const newSched: Record<string, ScheduleEntry> = {};
        for (const item of summary.items) {
          if (item.status === "registered") {
            const planItem =
              plans[item.effectivePlan]?.items.find(
                (i) => i.courseId === item.courseId,
              ) || currentPlan.items.find((i) => i.courseId === item.courseId);

            newSched[item.courseId] = {
              day: planItem?.blocks?.[0]?.days?.[0] || "الأحد",
              startTime: "08:30",
              endTime: "09:30",
              section: item.effectiveSection,
              instructor: planItem?.instructor,
              room: planItem?.room,
              days: planItem?.blocks?.[0]?.days,
            };
          }
        }
        onApplyRegisteredSchedule(newSched);
      }
    } finally {
      setIsExecuting(false);
    }
  };

  // Countdown timer handler for 08:00:00 AM launch
  useEffect(() => {
    if (!isScheduled) {
      if (timerRef.current) clearInterval(timerRef.current);
      setCountdownText("");
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const [h, m, s] = scheduledTime.split(":").map(Number);
      const target = new Date();
      target.setHours(h, m, s, 0);

      // If time has passed today, target tomorrow
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      const diffMs = target.getTime() - now.getTime();
      if (diffMs <= 1000) {
        clearInterval(interval);
        setIsScheduled(false);
        handleExecuteNow();
      } else {
        const diffSec = Math.floor(diffMs / 1000);
        const hours = Math.floor(diffSec / 3600);
        const minutes = Math.floor((diffSec % 3600) / 60);
        const seconds = diffSec % 60;
        setCountdownText(
          `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
        );
      }
    }, 1000);

    timerRef.current = interval;
    return () => clearInterval(interval);
  }, [isScheduled, scheduledTime, plans, activeTab, autoFallback]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      dir="rtl"
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-surface)] text-[var(--text)] shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between shrink-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Zap size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text)] font-['Noto_Naskh_Arabic',serif]">
                  نظام تسجيل الفصل السريع (Fast Registrar)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                  تجهيز خطط التسجيل والسحب والإضافة
                </span>
              </div>
              <p className="text-xs text-[var(--text-3)] line-clamp-1">
                تخطيط ثلاث خطط بديلة (أ، ب، ج) مع إرسال فائق السرعة لتجاوز ضغط
                السيرفر وضمان مقاعد الشعب
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Prewarm Indicator */}
            <button
              type="button"
              onClick={handlePrewarm}
              disabled={isPrewarming}
              className={cn(
                "hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                prewarmStatus?.sessionReady
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-[var(--sunken)] text-[var(--text-2)] border-[var(--line-control)]",
              )}
              title="فحص الاتصال بجلسة التسجيل مسبقاً"
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  prewarmStatus?.sessionReady
                    ? "bg-emerald-500 animate-ping"
                    : "bg-amber-500",
                )}
              />
              <span>
                {isPrewarming
                  ? "جاري الفحص..."
                  : prewarmStatus?.sessionReady
                    ? `الجلسة مهيأة (${prewarmStatus.pingMs}ms)`
                    : "تهيئة الجلسة"}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] rounded-[var(--r-control)] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Top View Toggle: Plans Editor vs Execution Console */}
        <div className="px-4 py-2 border-b border-[var(--line)] bg-[var(--sunken)]/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveView("plans")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                activeView === "plans"
                  ? "bg-[var(--surface)] text-[var(--accent)] shadow-xs border border-[var(--line)]"
                  : "text-[var(--text-3)] hover:text-[var(--text)]",
              )}
            >
              <Layers size={14} />
              <span>إدارة الخطط الثلاث (A / B / C)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView("console")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                activeView === "console"
                  ? "bg-[var(--surface)] text-[var(--accent)] shadow-xs border border-[var(--line)]"
                  : "text-[var(--text-3)] hover:text-[var(--text)]",
              )}
            >
              <Flame size={14} />
              <span>شاشة الإطلاق والتسجيل المباشر</span>
              {executionSummary && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>
          </div>

          {/* Quick Balance Preview */}
          <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
            <Wallet size={14} className="text-emerald-500" />
            <span>الرصيد الجامعي:</span>
            <span className="font-bold text-[var(--text)] font-mono">
              {cachedProfile?.financialBalance || "0 دائن"}
            </span>
          </div>
        </div>

        {/* Body Content */}
        {activeView === "plans" ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Plan Tabs Selector */}
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-[var(--sunken)] rounded-xl border border-[var(--line)]">
              {(["A", "B", "C"] as PlanKey[]).map((key) => {
                const plan = plans[key];
                const isSelected = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={cn(
                      "p-2.5 rounded-lg text-right transition-all cursor-pointer flex flex-col gap-1 relative",
                      isSelected
                        ? "bg-[var(--surface)] shadow-xs border border-[var(--line)] text-[var(--text)]"
                        : "text-[var(--text-3)] hover:text-[var(--text)]",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm font-['Noto_Naskh_Arabic',serif]">
                        {plan.title}
                      </span>
                      <span
                        className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono",
                          isSelected
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[var(--line-control)] text-[var(--text-3)]",
                        )}
                      >
                        {key}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-3)] tabular-nums">
                      <span>{plan.items.length} مساقات</span>
                      <span>•</span>
                      <span>{plan.totalCredits} ساعة</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Fast Plan Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-gradient-to-r from-indigo-500/5 to-transparent border border-[var(--line)]">
              <div className="text-xs text-[var(--text-2)] leading-relaxed">
                <span className="font-bold text-[var(--text)]">
                  {currentPlan.title}:
                </span>{" "}
                <span>{currentPlan.description}</span>
              </div>

              <div className="flex items-center gap-2">
                {activeTab === "A" ? (
                  <button
                    type="button"
                    onClick={handleImportFromWeeklySchedule}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Calendar size={13} />
                    <span>
                      استيراد جدول الفصل الحالي (
                      {Object.keys(currentWeeklySchedule).length})
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCopyPlan("A", activeTab)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--line-control)] transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Copy size={13} />
                    <span>نسخ المساقات من الخطة (أ)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Pre-Flight Diagnostics Alerts */}
            {allDiagnostics.length > 0 && (
              <div className="space-y-2">
                {allDiagnostics.map((diag, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-3 rounded-xl border flex items-start gap-2.5 text-xs leading-relaxed",
                      diag.type === "error"
                        ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
                        : diag.type === "warning"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                          : "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300",
                    )}
                  >
                    {diag.type === "error" ? (
                      <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5 flex-1">
                      <p className="font-bold">{diag.title}</p>
                      <p className="opacity-90">{diag.detail}</p>
                      {diag.suggestedAction && (
                        <p className="font-semibold text-[11px] underline opacity-80 pt-0.5">
                          الإجراء المقترح: {diag.suggestedAction}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Plan Course Items List */}
            {currentPlan.items.length === 0 ? (
              <div className="py-12 text-center space-y-3 px-4 border-2 border-dashed border-[var(--line-control)] rounded-2xl">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
                  <BookOpen size={24} />
                </div>
                <div className="space-y-1 max-w-sm mx-auto">
                  <h4 className="font-bold text-sm text-[var(--text)]">
                    الخطة ({activeTab}) فارغة حالياً
                  </h4>
                  <p className="text-xs text-[var(--text-3)] leading-relaxed">
                    اضغط زر استيراد الجدول من الأعلى لإدراج موادك الحالية فوراً،
                    أو انسخ الشعب من الخطة الأساسية.
                  </p>
                </div>
                {activeTab === "A" &&
                  Object.keys(currentWeeklySchedule).length > 0 && (
                    <button
                      type="button"
                      onClick={handleImportFromWeeklySchedule}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20 hover:opacity-90 transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus size={14} />
                      <span>استيراد جدولك الأسبوعي الحالي</span>
                    </button>
                  )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--text-3)] px-1">
                  <span>
                    المساقات المرشحة للتسجيل ({currentPlan.items.length})
                  </span>
                  <span>الأولوية: (1: قصوى للمختبرات والمقاعد المحدودة)</span>
                </div>

                <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-xl overflow-hidden bg-[var(--surface)]">
                  {sortRegistrationItemsByPriority(currentPlan.items).map(
                    (item) => (
                      <div
                        key={item.courseId}
                        className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--sunken)]/40 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[var(--text)]">
                              {item.courseName}
                            </span>
                            <span className="font-mono text-[11px] text-[var(--text-3)]">
                              ({item.courseId})
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                              {item.credits} ساعات
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
                            <span>
                              الدكتور: {item.instructor || "غير محدد"}
                            </span>
                            <span>•</span>
                            <span>الموعد: {item.timeText || "حسب الشعبة"}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 self-end sm:self-auto">
                          {/* Section Selector */}
                          <div className="flex items-center gap-1 text-xs">
                            <label className="text-[var(--text-3)] text-[11px]">
                              شعبة:
                            </label>
                            <input
                              type="text"
                              value={item.section}
                              onChange={(e) =>
                                handleUpdateSection(
                                  item.courseId,
                                  e.target.value,
                                )
                              }
                              className="w-12 h-7 text-center font-bold text-xs rounded-lg bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                            />
                          </div>

                          {/* Priority Selector */}
                          <div className="flex items-center gap-1 text-xs">
                            <label className="text-[var(--text-3)] text-[11px]">
                              الأولوية:
                            </label>
                            <select
                              value={item.priority}
                              onChange={(e) =>
                                handleUpdatePriority(
                                  item.courseId,
                                  Number(e.target.value),
                                )
                              }
                              className="h-7 px-1.5 text-xs rounded-lg bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                            >
                              <option value={1}>1 (قصوى)</option>
                              <option value={2}>2 (عادية)</option>
                              <option value={3}>3 (اختياري)</option>
                            </select>
                          </div>

                          {/* Delete Item */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.courseId)}
                            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                            title="حذف من الخطة"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Execution & Launch Console View */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Live Launch Status Bar */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-transparent border border-indigo-500/30 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Flame
                      className="text-amber-500 animate-bounce"
                      size={20}
                    />
                    <h3 className="font-bold text-base text-[var(--text)]">
                      محرك الإرسال الفائق (Ultra-Fast Dispatcher)
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--text-3)]">
                    يرسل الطلبات ببيانات خفيفة مباشرة لسيرفر البوابة ويتفادى
                    تحميل الصفحات الثقيلة
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExecuteNow}
                    disabled={isExecuting || currentPlan.items.length === 0}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:opacity-95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {isExecuting ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>جاري الإرسال والمحاولة...</span>
                      </>
                    ) : (
                      <>
                        <Play size={15} />
                        <span>
                          تطبيق {currentPlan.title} في الجدول الأسبوعي
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Countdown & Scheduling Settings */}
              <div className="pt-3 border-t border-indigo-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[var(--text-2)]">
                    <input
                      type="checkbox"
                      checked={autoFallback}
                      onChange={(e) => setAutoFallback(e.target.checked)}
                      className="rounded accent-indigo-600"
                    />
                    <span>
                      التبديل التلقائي الفوري للشعبة البديلة (من الخطة ب/ج) عند
                      امتلاء الشعبة
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-[var(--text-3)]" />
                  <span className="text-[var(--text-3)]">موعد الفتح:</span>
                  <input
                    type="time"
                    step="1"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-24 px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--line-control)] text-xs font-mono font-bold text-[var(--text)] text-center"
                  />
                  <button
                    type="button"
                    onClick={() => setIsScheduled((prev) => !prev)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                      isScheduled
                        ? "bg-amber-500 text-black border-amber-600 animate-pulse"
                        : "bg-[var(--surface)] text-[var(--text-2)] border-[var(--line-control)]",
                    )}
                  >
                    {isScheduled
                      ? `مجدول (${countdownText})`
                      : "جدولة الإطلاق التلقائي"}
                  </button>
                </div>
              </div>
            </div>

            {/* Execution Results Summary */}
            {executionSummary && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text)]">
                    نتائج محاولة التسجيل الأخيرة:
                  </span>
                  <span className="text-[var(--text-3)] font-mono">
                    استغرقت: {executionSummary.durationMs}ms
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block">
                      تم تثبيتها بنجاح
                    </span>
                    <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400 font-mono">
                      {executionSummary.registeredCount}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 block">
                      استخدمت شعبة بديلة
                    </span>
                    <span className="font-bold text-lg text-amber-600 dark:text-amber-400 font-mono">
                      {
                        executionSummary.items.filter((i) => i.fallbackUsed)
                          .length
                      }
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/25">
                    <span className="text-[11px] text-red-600 dark:text-red-400 block">
                      تعذر تسجيلها
                    </span>
                    <span className="font-bold text-lg text-red-600 dark:text-red-400 font-mono">
                      {executionSummary.failedCount}
                    </span>
                  </div>
                </div>

                {/* Per-Course Live Log */}
                <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-xl overflow-hidden bg-[var(--surface)] text-xs">
                  {executionSummary.items.map((res) => {
                    const isSuccess = res.status === "registered";
                    const isFull = res.status === "full";
                    const isFinancial = res.status === "financial_issue";

                    return (
                      <div
                        key={res.courseId}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-[var(--sunken)]/30"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--text)]">
                              {res.courseName}
                            </span>
                            <span className="font-mono text-[11px] text-[var(--text-3)]">
                              ({res.courseId})
                            </span>
                            <span className="px-2 py-0.2 rounded-md font-mono text-[10px] font-bold bg-[var(--sunken)] border border-[var(--line-control)]">
                              شعبة {res.effectiveSection}
                            </span>
                            {res.fallbackUsed && (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                بديل من الخطة ({res.effectivePlan})
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--text-2)]">
                            {res.message}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isSuccess ? (
                            <span className="px-2 py-1 rounded-lg font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 flex items-center gap-1">
                              <CheckCircle2 size={13} />
                              <span>مسجل</span>
                            </span>
                          ) : isFull ? (
                            <span className="px-2 py-1 rounded-lg font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 flex items-center gap-1">
                              <AlertTriangle size={13} />
                              <span>اكتمل العدد</span>
                            </span>
                          ) : isFinancial ? (
                            <span className="px-2 py-1 rounded-lg font-bold text-red-600 dark:text-red-400 bg-red-500/10 flex items-center gap-1">
                              <Wallet size={13} />
                              <span>رصيد غير كافٍ</span>
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-lg font-bold text-red-600 dark:text-red-400 bg-red-500/10 flex items-center gap-1">
                              <AlertCircle size={13} />
                              <span>تعذر</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-[var(--line)] bg-[var(--sunken)]/60 flex items-center justify-between shrink-0 text-xs text-[var(--text-3)]">
          <div className="flex items-center gap-3">
            <span>
              الخطة النشطة:{" "}
              <strong className="text-[var(--text)]">
                {currentPlan.title}
              </strong>
            </span>
            <span>•</span>
            <span>
              الساعات:{" "}
              <strong className="text-[var(--text)]">
                {currentPlan.totalCredits} س
              </strong>
            </span>
            <span>•</span>
            <span>
              الرسوم التقديرية:{" "}
              <strong className="text-[var(--text)] font-mono">
                {currentPlan.estimatedTuition} د.أ
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--surface)] border border-[var(--line-control)] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-all cursor-pointer"
            >
              إغلاق النافذة
            </button>
            <button
              type="button"
              onClick={handleExecuteNow}
              disabled={isExecuting || currentPlan.items.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-95 shadow-md shadow-[var(--accent)]/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Zap size={14} />
              <span>تطبيق الخطة في الجدول الأسبوعي</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SemesterRegistrationModal;
