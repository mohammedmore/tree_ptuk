import React, { useState } from "react";
import {
  GraduationCap,
  KeyRound,
  UserCheck,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
} from "lucide-react";
import {
  syncStudentProfile,
  StudentSyncProfile,
} from "../services/studentService";

interface StudentLoginGateProps {
  onLoginSuccess: (profile: StudentSyncProfile) => void;
  onContinueAsGuest: () => void;
}

export const StudentLoginGate: React.FC<StudentLoginGateProps> = ({
  onLoginSuccess,
  onContinueAsGuest,
}) => {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (demoMode = false) => {
    const idToUse = demoMode ? (studentId || "202110123") : studentId;
    if (!idToUse.trim()) {
      setError("يرجى إدخال الرقم الجامعي الخاص بك.");
      return;
    }
    if (!demoMode && !password.trim()) {
      setError("يرجى إدخال كلمة مرور بوابة خضوري (Edugate).");
      return;
    }

    setIsLoading(true);
    setError(null);
    setLoadingStep("جاري الاتصال ببوابة خضوري الجامعية (Edugate)...");

    try {
      setTimeout(() => {
        setLoadingStep("جاري التحقق من بيانات الدخول وسحب خطة التخصص...");
      }, 1500);

      const profile = await syncStudentProfile(idToUse, password, demoMode);

      setLoadingStep("تم بنجاح! جاري بناء شجرة المواد والمتطلبات...");
      setTimeout(() => {
        onLoginSuccess(profile);
      }, 600);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر تسجيل الدخول. يرجى التحقق من الرقم الجامعي وكلمة المرور.",
      );
    } finally {
      setIsLoading(false);
      setLoadingStep("");
    }
  };

  const detectedCohort = studentId.trim().length >= 4 ? studentId.trim().substring(0, 4) : "";

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-slate-100 overflow-y-auto"
    >
      <div className="w-full max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 my-auto">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 mb-2 shadow-inner">
            <GraduationCap size={36} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            بوابة التخطيط الأكاديمي
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            جامعة فلسطين التقنية - خضوري (PTUK)
          </p>
        </div>

        {/* Feature Notice */}
        <div className="bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-3.5 text-xs text-indigo-900 dark:text-indigo-300 space-y-1.5 leading-relaxed">
          <div className="flex items-center gap-2 font-bold text-indigo-700 dark:text-indigo-400">
            <ShieldCheck size={16} />
            <span>تسجيل دخول أكاديمي مباشر</span>
          </div>
          <p>
            أدخل رقمك الجامعي وكلمة سر البوابة للتحقق عبر خوادم الجامعة الحقيقية.
            يقوم النظام فوراً بسحب خطة تخصصك بحسب دفعتك (أول 4 خانات)، تحديد المواد
            المجتازة والمسجلة، وبناء شجرة المتطلبات التفاعلية المخصصة لك.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl p-3.5 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
            <AlertCircle size={18} className="shrink-0 text-rose-600 mt-0.5" />
            <p className="leading-relaxed font-semibold">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                الرقم الجامعي
              </label>
              {detectedCohort && (
                <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                  <Calendar size={12} />
                  <span>دفعة {detectedCohort}</span>
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="مثال: 202110123"
                disabled={isLoading}
                className="w-full pl-3 pr-10 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono tracking-wider font-bold"
              />
              <UserCheck
                size={18}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              كلمة مرور بوابة خضوري (Edugate)
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleLogin(false);
                }}
                className="w-full pl-3 pr-10 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <KeyRound
                size={18}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              🔒 لا يتم تخزين كلمة المرور؛ تُستخدم فقط لمصادقة جلسة البوابة وسحب المواد.
            </p>
          </div>
        </div>

        {/* Loading status text */}
        {isLoading && (
          <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-3 text-center text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center gap-2">
            <RefreshCw size={14} className="animate-spin" />
            <span>{loadingStep || "جاري المعالجة..."}</span>
          </div>
        )}

        {/* Primary Actions */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={() => void handleLogin(false)}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 active:from-indigo-800 active:to-blue-800 text-white font-extrabold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>جاري سحب الخطة والتأكد من البوابة...</span>
              </>
            ) : (
              <>
                <GraduationCap size={18} />
                <span>دخول وسحب الخطة الأكاديمية</span>
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handleLogin(true)}
              disabled={isLoading}
              className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <Sparkles size={14} className="text-amber-500" />
              <span>تجربة بحساب تجريبي</span>
            </button>

            <button
              type="button"
              onClick={onContinueAsGuest}
              disabled={isLoading}
              className="py-2.5 px-3 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
            >
              <span>تصفح كزائر</span>
              <ArrowRight size={14} className="rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
