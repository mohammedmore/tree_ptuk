import React, { useState, useRef } from "react";
import {
  GraduationCap,
  KeyRound,
  UserCheck,
  Search,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Eye,
  EyeOff,
  User,
} from "lucide-react";
import {
  syncStudentProfile,
  StudentSyncProfile,
} from "../../services/studentService";
import LoginSyncExperience from "../auth/LoginSyncExperience";
import { playSyncSound } from "../../utils/syncAudio";
import { triggerHaptic } from "../../utils/haptics";

interface StudentLoginGateProps {
  onLoginSuccess: (profile: StudentSyncProfile) => void;
  onContinueAsGuest: () => void;
  onOpenRetrieveSchedule?: () => void;
}

const REMEMBERED_ID_KEY = "ptuk_remembered_student_id";

export const StudentLoginGate: React.FC<StudentLoginGateProps> = ({
  onLoginSuccess,
  onContinueAsGuest,
  onOpenRetrieveSchedule,
}) => {
  const [studentId, setStudentId] = useState(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(REMEMBERED_ID_KEY) || "";
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
  const [isSuccess, setIsSuccess] = useState(false);
  const [profileReady, setProfileReady] = useState<StudentSyncProfile | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCancelSync = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsSuccess(false);
    setProfileReady(null);
  };

  const handleProceedToPlanner = () => {
    if (profileReady) {
      onLoginSuccess(profileReady);
    }
  };

  const handleLogin = async () => {
    const trimmedUser = studentId.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser) {
      setError("يرجى إدخال اسم المستخدم أو الرقم الجامعي الخاص بك.");
      return;
    }
    if (!trimmedPass) {
      setError("يرجى إدخال كلمة سر الجامعة (بوابة Edugate).");
      return;
    }

    const startTime = Date.now();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    setIsSuccess(false);
    setProfileReady(null);
    setError(null);

    // Save or clear remembered student ID/username safely
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        if (rememberMe && trimmedUser) {
          window.localStorage.setItem(REMEMBERED_ID_KEY, trimmedUser);
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
      const profile = await syncStudentProfile(
        trimmedUser,
        trimmedPass,
        false,
        controller.signal,
      );

      // Instant 0-second cached login: proceed immediately without delay!
      if (profile.fromCache || Date.now() - startTime < 800) {
        onLoginSuccess(profile);
        return;
      }

      setProfileReady(profile);
      setIsSuccess(true);
      playSyncSound("complete");
      triggerHaptic("success");
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "تعذر تسجيل الدخول. يرجى التحقق من اسم المستخدم وكلمة مرور الجامعة.",
      );
      setIsLoading(false);
      setIsSuccess(false);
      setProfileReady(null);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const isNumericId = /^\d{4,10}$/.test(studentId.trim());
  const detectedCohort =
    isNumericId && studentId.trim().length >= 4
      ? studentId.trim().substring(0, 4)
      : "";

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm text-slate-900 dark:text-slate-100 overflow-y-auto"
    >
      <div
        className={`relative w-full ${isLoading ? "max-w-lg" : "max-w-md"} bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-5 sm:p-7 space-y-5 my-auto transition-all`}
      >
        {/* Header Branding */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 mb-1">
            <GraduationCap size={24} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            بوابة التخطيط الأكاديمي
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            جامعة فلسطين التقنية - خضوري
          </p>
        </div>

        {/* Error Alert */}
        {error && !isLoading && (
          <div
            role="alert"
            className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg p-3 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5"
          >
            <AlertCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">تعذر تسجيل الدخول</p>
              <p className="leading-relaxed opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Interactive Waiting Experience or Form */}
        {isLoading ? (
          <LoginSyncExperience
            studentId={studentId.trim()}
            isSuccess={isSuccess}
            onCancel={handleCancelSync}
            onProceedToPlanner={handleProceedToPlanner}
          />
        ) : (
          <form
            id="student-login-form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleLogin();
            }}
            className="space-y-3.5"
          >
            {/* Student Username / ID Field */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label
                  htmlFor="student-id-input"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  اسم المستخدم أو الرقم الجامعي
                </label>
                {detectedCohort && (
                  <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    <Calendar size={11} />
                    <span>دفعة {detectedCohort}</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  id="student-id-input"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck="false"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="مثال: 202410616 أو m.hadrob"
                  disabled={isLoading}
                  required
                  className="w-full pl-3 pr-9 py-2.5 min-h-[42px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500 text-xs sm:text-sm font-mono tracking-wider transition-colors"
                />
                <UserCheck
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
              </div>
            </div>

            {/* University Password Field with Toggle */}
            <div>
              <label
                htmlFor="student-password-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                كلمة مرور بوابة Edugate
              </label>
              <div className="relative">
                <input
                  id="student-password-input"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  required
                  className="w-full pl-10 pr-9 py-2.5 min-h-[42px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500 text-xs sm:text-sm transition-colors font-mono"
                />
                <KeyRound
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                  }
                  aria-pressed={showPassword}
                  tabIndex={0}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-slate-800 focus:ring-slate-400"
                  />
                  <span>تذكر الحساب</span>
                </label>
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <ShieldCheck size={12} className="text-slate-400" />
                  <span>اتصال محمي ومباشر</span>
                </span>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 min-h-[44px] px-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white font-bold rounded-lg text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <GraduationCap size={16} />
              <span>دخول وسحب الخطة والسجل الأكاديمي</span>
            </button>
          </form>
        )}

        {/* Guest Mode & Retrieve Section */}
        {!isLoading && (
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 my-1">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <span className="text-[11px] text-slate-400 px-1">
                أو تصفح بدون حساب
              </span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>

            <button
              type="button"
              onClick={onContinueAsGuest}
              className="w-full min-h-[42px] py-2.5 px-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-lg text-xs sm:text-sm transition-colors flex items-center justify-between border border-slate-200 dark:border-slate-700 cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center gap-2">
                <User size={16} className="text-slate-500" />
                <span>دخول كضيف (بدون كلمة سر)</span>
              </div>
              <ArrowRight size={15} className="rotate-180 text-slate-400" />
            </button>

            {onOpenRetrieveSchedule && (
              <button
                type="button"
                onClick={() => {
                  onContinueAsGuest();
                  onOpenRetrieveSchedule();
                }}
                className="w-full min-h-[38px] py-2 px-3 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-medium rounded-lg text-xs transition-colors flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <Search size={13} />
                <span>استرجاع جدول مشترك برمز</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentLoginGate;
