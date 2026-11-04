import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  KeyRound,
  UserCheck,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  BookOpen,
  Calendar,
  Award,
  Eye,
  EyeOff,
  User,
  Wallet,
  AlertTriangle,
  Clock,
  Lock,
  FileText,
  Layers,
  Lightbulb,
} from "lucide-react";
import { BaseModal } from "../common/BaseModal";
import {
  syncStudentProfile,
  StudentSyncProfile,
  getCachedStudentProfile,
} from "../../services/studentService";
import { usePrivacyMask } from "../../hooks/usePrivacyMask";
import { cn } from "../../utils";

const REMEMBERED_ID_KEY = "ptuk_remembered_student_id";

const SYNC_LIVE_STEPS = [
  {
    id: 1,
    label: "الاتصال الآمن ببوابة Edugate...",
    icon: Lock,
    targetProgress: 20,
  },
  {
    id: 2,
    label: "سحب كشف العلامات والفصول السابقة...",
    icon: FileText,
    targetProgress: 45,
  },
  {
    id: 3,
    label: "فحص امتحانات المستوى والإعفاءات...",
    icon: GraduationCap,
    targetProgress: 68,
  },
  {
    id: 4,
    label: "مطابقة شجرة الخطة الدراسية والمتطلبات...",
    icon: Layers,
    targetProgress: 88,
  },
  {
    id: 5,
    label: "تجهيز وحساب المعدل التراكمي وجدولك...",
    icon: Sparkles,
    targetProgress: 98,
  },
];

const ROTATING_TIPS = [
  "💡 هل تعلم؟ اجتيازك امتحان مستوى الإنجليزي بدرجة متقدمة يعفيك من إنجليزي استدراكي ولغة إنجليزية 1 معاً.",
  "⚡ نصيحة: تجنب تسجيل أكثر من مختبرين في اليوم نفسه لتقليل ضغط التقارير الأسبوعية.",
  "🎯 ميزة: المخطط الذكي يكتشف تعارض أوقات المحاضرات تلقائياً ويقترح الشعب المتوافقة فوراً.",
  "📚 معلومة: إنجاز متطلبات الكلية والجامعة مبكراً يتيح لك مرونة أكبر في اختيار مواد التخصص لاحقاً.",
  "🔒 خصوصيتك أولاً: المخطط يعمل بجلسة مشفرة مؤقتة ومباشرة مع بوابة الجامعة دون تخزين كلمات المرور.",
  "🎓 للمتفوقين: يمكنك رفع الحد الأقصى لساعات الفصل إلى 19 ساعة معتمدة إذا تجاوز معدلك التراكمي 80%.",
];

const LiveStepperWithSkeleton: React.FC = () => {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStepIdx((prev) =>
        prev < SYNC_LIVE_STEPS.length - 1 ? prev + 1 : prev,
      );
    }, 2800);

    const tipInterval = setInterval(() => {
      setTipIdx((prev) => (prev + 1) % ROTATING_TIPS.length);
    }, 3200);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 96) return prev;
        const remaining = 96 - prev;
        const increment = Math.max(1, Math.floor(remaining / 16));
        return prev + increment;
      });
    }, 250);

    return () => {
      clearInterval(stepInterval);
      clearInterval(tipInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Live Stepper Container */}
      <div className="bg-slate-900 text-white dark:bg-slate-950 p-4 sm:p-5 rounded-2xl border border-indigo-500/30 shadow-xl space-y-4">
        {/* Header with active step and progress */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-indigo-300">
              جاري المعالجة الحية من Edugate
            </span>
          </div>
          <span className="text-xs font-mono font-black text-indigo-400 bg-indigo-950/80 px-2.5 py-0.5 rounded-lg border border-indigo-800/60">
            {progress}%
          </span>
        </div>

        {/* Smooth Animated Progress Bar */}
        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/80 p-0.5">
          <div
            className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full rounded-full transition-all duration-300 ease-out shadow-sm"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps List */}
        <div className="space-y-2 pt-1">
          {SYNC_LIVE_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            const StepIcon = step.icon;

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-xl text-xs transition-all duration-300",
                  isCurrent
                    ? "bg-indigo-600/20 border border-indigo-500/50 text-indigo-200 font-bold shadow-sm"
                    : isCompleted
                      ? "text-emerald-400 opacity-90"
                      : "text-slate-500 opacity-50",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs",
                      isCurrent
                        ? "bg-indigo-500 text-white animate-pulse"
                        : isCompleted
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : "bg-slate-800 text-slate-500",
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <StepIcon size={13} />
                    )}
                  </div>
                  <span className="truncate">{step.label}</span>
                </div>

                <div>
                  {isCurrent && (
                    <RefreshCw
                      size={13}
                      className="animate-spin text-indigo-400 shrink-0"
                    />
                  )}
                  {isCompleted && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                      تم بنجاح
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rotating Tips Box */}
        <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-start gap-2.5 transition-all min-h-[46px]">
          <Lightbulb
            size={16}
            className="text-amber-400 shrink-0 mt-0.5 animate-bounce"
          />
          <p className="text-[11px] text-slate-300 leading-relaxed transition-opacity duration-300">
            {ROTATING_TIPS[tipIdx]}
          </p>
        </div>
      </div>

      {/* Pulsing Skeleton Preview of the Data */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 space-y-4 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-700/70" />
            <div className="space-y-1.5">
              <div className="w-36 h-4 rounded-md bg-slate-200 dark:bg-slate-700/70" />
              <div className="w-24 h-3 rounded-md bg-slate-200 dark:bg-slate-700/50" />
            </div>
          </div>
          <div className="w-24 h-6 rounded-xl bg-slate-200 dark:bg-slate-700/70" />
        </div>

        {/* 4 Metrics skeleton cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-3 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-2 text-center"
            >
              <div className="w-14 h-3 rounded bg-slate-200 dark:bg-slate-700/60 mx-auto" />
              <div className="w-10 h-5 rounded bg-slate-200 dark:bg-slate-700 mx-auto" />
            </div>
          ))}
        </div>

        {/* Footer badges skeleton */}
        <div className="flex items-center gap-2 pt-1">
          <div className="w-32 h-6 rounded-lg bg-slate-200 dark:bg-slate-700/60" />
          <div className="w-48 h-6 rounded-lg bg-slate-200 dark:bg-slate-700/60" />
        </div>
      </div>
    </div>
  );
};

interface StudentPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyStudentData: (profile: StudentSyncProfile) => void;
}

export const StudentPortalModal: React.FC<StudentPortalModalProps> = ({
  isOpen,
  onClose,
  onApplyStudentData,
}) => {
  const [studentId, setStudentId] = useState(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return (
          window.localStorage.getItem(REMEMBERED_ID_KEY) ||
          getCachedStudentProfile()?.studentId ||
          ""
        );
      }
    } catch {
      // Storage unavailable or private mode
    }
    return "";
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedProfile, setSyncedProfile] = useState<StudentSyncProfile | null>(
    () => getCachedStudentProfile(),
  );
  const { isPrivacyMasked, togglePrivacyMask } = usePrivacyMask();

  const handleSync = async () => {
    const userToUse = studentId.trim();
    const passToUse = password.trim();

    if (!userToUse) {
      setError("يرجى إدخال اسم المستخدم أو الرقم الجامعي.");
      return;
    }
    if (!passToUse) {
      setError("يرجى إدخال كلمة سر الجامعة (بوابة Edugate).");
      return;
    }

    setIsLoading(true);
    setError(null);

    // Save or clear remembered username / ID safely
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        if (rememberMe && userToUse) {
          window.localStorage.setItem(REMEMBERED_ID_KEY, userToUse);
        } else if (!rememberMe) {
          window.localStorage.removeItem(REMEMBERED_ID_KEY);
        }
      } catch (storageErr) {
        console.warn(
          "Storage access restricted or quota exceeded:",
          storageErr,
        );
      }
    }

    try {
      const profile = await syncStudentProfile(userToUse, passToUse, false);
      setSyncedProfile(profile);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "فشلت عملية المزامنة مع بوابة الجامعة.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!syncedProfile) return;
    onApplyStudentData(syncedProfile);
    onClose();
  };

  const hasWarning =
    syncedProfile?.academicWarning &&
    !syncedProfile.academicWarning.includes("لا يوجد") &&
    syncedProfile.academicWarning.trim().length > 0;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <GraduationCap
              className="text-indigo-600 dark:text-indigo-400"
              size={24}
            />
            <span>مزامنة بوابة الطالب (Edugate PTUK)</span>
          </div>
          <button
            type="button"
            onClick={togglePrivacyMask}
            className={cn(
              "px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all mr-2",
              isPrivacyMasked
                ? "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400"
                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100",
            )}
            title="وضع الخصوصية: تمويه المعلومات والبيانات الشخصية والمالية"
          >
            {isPrivacyMasked ? <EyeOff size={14} /> : <Eye size={14} />}
            <span className="hidden sm:inline">
              {isPrivacyMasked ? "إلغاء التمويه" : "تمويه البيانات"}
            </span>
          </button>
        </div>
      }
      maxWidth="max-w-2xl"
    >
      <div className="p-4 sm:p-5 space-y-4" dir="rtl">
        {error && (
          <div
            role="alert"
            className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-2xl p-4 text-xs sm:text-sm text-rose-800 dark:text-rose-300 flex items-start gap-3 animate-shake"
          >
            <AlertCircle
              className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400"
              size={18}
            />
            <div className="space-y-1">
              <span className="font-bold block">تعذر إتمام المزامنة</span>
              <p className="leading-relaxed opacity-95">{error}</p>
            </div>
          </div>
        )}

        {/* Sync Form */}
        <form
          id="portal-sync-form"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSync();
          }}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="modal-student-id"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              اسم الطالب / اسم المستخدم (أو الرقم الجامعي)
            </label>
            <div className="relative">
              <input
                id="modal-student-id"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="مثال: m.m.hadrob أو 202410616"
                disabled={isLoading}
                required
                className="w-full pl-3 pr-11 py-3.5 min-h-[48px] rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono tracking-wider font-bold transition-all shadow-sm"
              />
              <UserCheck
                size={18}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="modal-student-password"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              كلمة سر الجامعة (Edugate Password)
            </label>
            <div className="relative">
              <input
                id="modal-student-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={isLoading}
                required
                className="w-full pl-12 pr-11 py-3.5 min-h-[48px] rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all shadow-sm font-mono"
              />
              <KeyRound
                size={18}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                }
                aria-pressed={showPassword}
                tabIndex={0}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400 font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                />
                <span>تذكر اسم الحساب</span>
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                🔒 جلسة مشفرة مؤقتة ومباشرة مع بوابة Edugate
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[48px] py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={17} className="animate-spin" />
                  <span>جاري المزامنة مع بوابة خضوري...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={17} />
                  <span>مزامنة بوابتي الآن</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Stepper & Skeleton Loading State */}
        {isLoading && <LiveStepperWithSkeleton />}

        {/* Synced Profile Preview */}
        {!isLoading && syncedProfile && (
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 sm:p-5 space-y-4">
            {/* Top header row */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                <div>
                  <div
                    className={cn(
                      "font-extrabold text-sm text-slate-900 dark:text-slate-100 privacy-sensitive transition-all duration-200",
                      isPrivacyMasked && "blur-md select-none",
                    )}
                  >
                    {syncedProfile.studentName || "طالب خضوري"}
                  </div>
                  <div
                    className={cn(
                      "text-xs text-slate-500 dark:text-slate-400 font-mono privacy-sensitive transition-all duration-200",
                      isPrivacyMasked && "blur-md select-none",
                    )}
                  >
                    #{syncedProfile.studentId}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-xl font-bold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  Edugate مباشر
                </span>
                {syncedProfile.cohortYear && (
                  <span className="text-[11px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-xl font-mono font-bold border border-indigo-200 dark:border-indigo-800">
                    دفعة {syncedProfile.cohortYear}
                  </span>
                )}
              </div>
            </div>

            {/* Academic Advisor and Status Alerts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {syncedProfile.academicAdvisor && (
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-2.5">
                  <User size={16} className="text-indigo-500 shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] text-slate-400 block">
                      المرشد الأكاديمي
                    </span>
                    <span
                      className={cn(
                        "font-bold text-slate-800 dark:text-slate-200 text-xs truncate block privacy-sensitive transition-all duration-200",
                        isPrivacyMasked && "blur-md select-none",
                      )}
                    >
                      {syncedProfile.academicAdvisor}
                    </span>
                  </div>
                </div>
              )}

              {syncedProfile.financialBalance && (
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-2.5">
                  <Wallet size={16} className="text-emerald-500 shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] text-slate-400 block">
                      الرصيد المالي
                    </span>
                    <span
                      className={cn(
                        "font-bold text-slate-800 dark:text-slate-200 text-xs truncate block font-mono privacy-sensitive transition-all duration-200",
                        isPrivacyMasked && "blur-md select-none",
                      )}
                    >
                      {syncedProfile.financialBalance}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {hasWarning && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                <span className="font-bold">تنبيه السجل الأكاديمي:</span>
                <span
                  className={cn(
                    "privacy-sensitive transition-all duration-200",
                    isPrivacyMasked && "blur-md select-none",
                  )}
                >
                  {syncedProfile.academicWarning}
                </span>
              </div>
            )}

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                  <Award size={14} className="text-amber-500" />
                  <span>المعدل التراكمي</span>
                </div>
                <div
                  className={cn(
                    "font-black text-indigo-600 dark:text-indigo-400 text-base privacy-sensitive transition-all duration-200",
                    isPrivacyMasked && "blur-md select-none",
                  )}
                >
                  {syncedProfile.gpa}%
                </div>
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                  <BookOpen size={14} className="text-emerald-500" />
                  <span>المواد المجتازة</span>
                </div>
                <div
                  className={cn(
                    "font-black text-emerald-600 dark:text-emerald-400 text-base privacy-sensitive transition-all duration-200",
                    isPrivacyMasked && "blur-md select-none",
                  )}
                >
                  {syncedProfile.passedCourseIds?.length || 0}
                  <span className="text-[10px] text-slate-400 font-normal mr-1">
                    مساق
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                  <Calendar size={14} className="text-blue-500" />
                  <span>ساعات مقطوعة</span>
                </div>
                <div
                  className={cn(
                    "font-black text-slate-800 dark:text-slate-200 text-base privacy-sensitive transition-all duration-200",
                    isPrivacyMasked && "blur-md select-none",
                  )}
                >
                  {syncedProfile.earnedCredits}
                  <span className="text-[10px] text-slate-400 font-normal mr-1">
                    ساعة
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                  <Clock size={14} className="text-violet-500" />
                  <span>شعب مسجلة</span>
                </div>
                <div className="font-black text-violet-600 dark:text-violet-400 text-base">
                  {syncedProfile.enrolledCourses?.length || 0}
                  <span className="text-[10px] text-slate-400 font-normal mr-1">
                    شعبة
                  </span>
                </div>
              </div>
            </div>

            {/* Department and College badge */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
              <div className="flex items-center gap-1.5 truncate">
                <GraduationCap size={14} className="text-indigo-500 shrink-0" />
                <span className="font-bold text-slate-700 dark:text-slate-300 truncate">
                  {syncedProfile.majorName}
                </span>
                {syncedProfile.college && (
                  <span className="text-slate-400 truncate">
                    ({syncedProfile.college})
                  </span>
                )}
              </div>
              {syncedProfile.currentSemester && (
                <span className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg shrink-0">
                  {syncedProfile.currentSemester}
                </span>
              )}
            </div>

            {/* Exemption / Placement Exams Section */}
            {syncedProfile.exemptionExams &&
              syncedProfile.exemptionExams.length > 0 && (
                <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl space-y-1.5 text-xs">
                  <div className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2
                      size={15}
                      className="text-emerald-600 dark:text-emerald-400 shrink-0"
                    />
                    <span>امتحانات المستوى والمقررات المعفاة:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {syncedProfile.exemptionExams.map((exam, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 shadow-sm"
                      >
                        <span>✓ {exam.name || exam.code}</span>
                        <span className="text-[10px] opacity-75 font-normal">
                          ({exam.status})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {/* Apply Button */}
            <button
              type="button"
              onClick={handleApply}
              className="w-full min-h-[48px] py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <CheckCircle2 size={18} />
              <span>تطبيق بيانات وسجل الطالب على الخطة والجدول</span>
            </button>
          </div>
        )}
      </div>
    </BaseModal>
  );
};

export default StudentPortalModal;
