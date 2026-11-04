import React, { useState, useRef } from "react";
import { formatUserError, FormattedError } from "../utils/errorHandler";
import {
  syncStudentProfile,
  StudentSyncProfile,
} from "../services/studentService";
import { cn } from "../utils";
import LoginSyncExperience from "../components/auth/LoginSyncExperience";
import { playSyncSound } from "../utils/syncAudio";
import { triggerHaptic } from "../utils/haptics";

interface LoginPageProps {
  onLoginSuccess: (profile: StudentSyncProfile) => void;
  onContinueAsGuest: () => void;
  onRetrieveCode: (code: string) => Promise<void>;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onContinueAsGuest,
  onRetrieveCode,
}) => {
  const [username, setUsername] = useState(() => {
    return (
      (typeof window !== "undefined" &&
        localStorage.getItem("ptuk_remembered_student_id")) ||
      ""
    );
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [profileReady, setProfileReady] = useState<StudentSyncProfile | null>(
    null,
  );
  const profileReadyRef = useRef<StudentSyncProfile | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Field validation messages
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [pageError, setPageError] = useState<FormattedError | null>(null);

  // In-place inline schedule retrieve mode
  const [showRetrieveInline, setShowRetrieveInline] = useState(false);
  const [retrieveCode, setRetrieveCode] = useState("");
  const [isRetrieving, setIsRetrieving] = useState(false);

  const handleCancelSync = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsSuccess(false);
    setProfileReady(null);
    profileReadyRef.current = null;
  };

  const handleProceedToPlanner = () => {
    const profile = profileReadyRef.current || profileReady;
    if (profile) {
      onLoginSuccess(profile);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError("");
    setPasswordError("");
    setPageError(null);

    const cleanUser = username.trim();
    if (!cleanUser) {
      setUsernameError("أدخل اسم المستخدم أو الرقم الجامعي.");
      return;
    }
    if (!password) {
      setPasswordError("أدخل كلمة المرور.");
      return;
    }

    const startTime = Date.now();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    setIsSuccess(false);
    setProfileReady(null);

    try {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          if (rememberMe) {
            localStorage.setItem("ptuk_remembered_student_id", cleanUser);
          } else {
            localStorage.removeItem("ptuk_remembered_student_id");
          }
        }
      } catch {
        // Ignore storage write issues on private browsing
      }

      const profile = await syncStudentProfile(
        cleanUser,
        password,
        false,
        controller.signal,
      );

      // Instant 0-second cached login: proceed immediately without delay!
      if (profile.fromCache || Date.now() - startTime < 800) {
        onLoginSuccess(profile);
        return;
      }

      // If it was a live Edugate scraping run (~15-25s), allow student to review or click proceed
      profileReadyRef.current = profile;
      setProfileReady(profile);
      setIsSuccess(true);
      playSyncSound("complete");
      triggerHaptic("success");

      // We do NOT forcefully terminate the student's game;
      // they can proceed with the prominent button or finish their run smoothly!
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // Student cancelled sync intentionally
        return;
      }
      const formatted = formatUserError(err);
      setPageError(formatted);
      setIsLoading(false);
      setIsSuccess(false);
      setProfileReady(null);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleRetrieveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retrieveCode.trim()) return;

    setIsRetrieving(true);
    setPageError(null);
    try {
      await onRetrieveCode(retrieveCode.trim());
    } catch (err) {
      setPageError(formatUserError(err));
    } finally {
      setIsRetrieving(false);
    }
  };

  return (
    <main
      dir="rtl"
      className={cn(
        "w-full bg-[var(--bg)] text-[var(--text)] transition-all",
        isLoading
          ? "min-h-[calc(100vh-52px)] md:h-[calc(100vh-52px)] md:max-h-[calc(100vh-52px)] overflow-hidden flex flex-col items-center justify-center md:justify-between px-2 sm:px-6 pt-2 pb-2 md:pb-0"
          : "min-h-[calc(100vh-52px)] flex justify-center px-4 pt-[var(--s-8)] pb-12",
      )}
    >
      <div
        className={cn(
          "w-full text-right transition-all flex flex-col",
          isLoading
            ? "max-w-4xl flex-1 md:h-full justify-center md:justify-between overflow-hidden"
            : "max-w-[400px]",
        )}
      >
        {/* Title & University Subtitle */}
        {isLoading ? (
          <div className="mb-1.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-[var(--text)] m-0">
                بوابة التخطيط الأكاديمي
              </h1>
              <span className="text-xs text-[var(--text-3)] hidden sm:inline">
                • جامعة فلسطين التقنية - خضوري
              </span>
            </div>
            <span className="text-[11px] font-mono text-[var(--text-3)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--line)]">
              {username.trim()}
            </span>
          </div>
        ) : (
          <div className="mb-[var(--s-6)]">
            <h1 className="text-[var(--fs-xl)] font-title text-[var(--text)] m-0">
              بوابة التخطيط الأكاديمي
            </h1>
            <p className="text-[15px] text-[var(--text-2)] mt-1 mb-0">
              جامعة فلسطين التقنية - خضوري
            </p>
          </div>
        )}

        {/* Page Error Banner */}
        {pageError && !isLoading && (
          <div
            role="alert"
            className="mb-[var(--s-5)] p-3 rounded-[var(--r-control)] bg-[var(--danger-soft)] border-r-[3px] border-[var(--danger)] text-[var(--text)] text-[13px] leading-relaxed"
          >
            <p className="m-0 font-medium">{pageError.message}</p>
            {pageError.canRetry && (
              <button
                type="button"
                onClick={(e) => handleLogin(e)}
                className="mt-2 text-[13px] font-medium text-[var(--text)] underline cursor-pointer p-0 bg-transparent border-0"
              >
                إعادة المحاولة
              </button>
            )}
          </div>
        )}

        {/* Active Sync Experience or Regular Form */}
        {isLoading ? (
          <LoginSyncExperience
            studentId={username.trim()}
            isSuccess={isSuccess}
            onCancel={handleCancelSync}
            onProceedToPlanner={handleProceedToPlanner}
          />
        ) : !showRetrieveInline ? (
          <form
            onSubmit={handleLogin}
            noValidate
            className="space-y-[var(--s-4)]"
          >
            {/* Username / Student ID */}
            <div>
              <label
                htmlFor="username-input"
                className="block text-[13px] font-medium text-[var(--text-2)] mb-1.5"
              >
                اسم المستخدم أو الرقم الجامعي
              </label>
              <input
                id="username-input"
                type="text"
                autoComplete="username"
                dir="ltr"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (usernameError) setUsernameError("");
                }}
                disabled={isLoading}
                className={cn(
                  "w-full h-[var(--control-h)] px-3 rounded-[var(--r-control)] bg-[var(--surface)] text-[var(--text)] text-[15px] border box-border focus:outline-none",
                  usernameError
                    ? "border-[var(--danger)]"
                    : "border-[var(--line-control)]",
                )}
              />
              {usernameError && (
                <p className="mt-1 text-[13px] text-[var(--danger)] m-0">
                  {usernameError}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password-input"
                className="block text-[13px] font-medium text-[var(--text-2)] mb-1.5"
              >
                كلمة مرور بوابة Edugate
              </label>
              <div className="relative">
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  disabled={isLoading}
                  className={cn(
                    "w-full h-[var(--control-h)] pr-3 pl-16 rounded-[var(--r-control)] bg-[var(--surface)] text-[var(--text)] text-[15px] border box-border focus:outline-none",
                    passwordError
                      ? "border-[var(--danger)]"
                      : "border-[var(--line-control)]",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                  }
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-[var(--text-2)] hover:text-[var(--text)] px-1 py-0.5 cursor-pointer bg-transparent border-0"
                >
                  {showPassword ? "إخفاء" : "إظهار"}
                </button>
              </div>
              {passwordError && (
                <p className="mt-1 text-[13px] text-[var(--danger)] m-0">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded-[4px] border-[var(--line-control)] text-[var(--accent)] accent-[var(--accent)] cursor-pointer"
              />
              <label
                htmlFor="remember-me"
                className="text-[13px] text-[var(--text-2)] cursor-pointer select-none"
              >
                تذكر الحساب
              </label>
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="w-full h-[var(--control-h)] px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] font-medium text-[15px] rounded-[var(--r-control)] transition-colors cursor-pointer flex items-center justify-center mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              دخول وجلب السجل
            </button>
          </form>
        ) : (
          /* In-Place Retrieve by Code */
          <form
            onSubmit={handleRetrieveSubmit}
            className="space-y-[var(--s-4)]"
          >
            <div>
              <label
                htmlFor="retrieve-code-input"
                className="block text-[13px] font-medium text-[var(--text-2)] mb-1.5"
              >
                الرمز السري للخطة المسترجعة
              </label>
              <input
                id="retrieve-code-input"
                type="text"
                dir="ltr"
                placeholder="ABCD-1234"
                value={retrieveCode}
                onChange={(e) => setRetrieveCode(e.target.value)}
                disabled={isRetrieving}
                className="w-full h-[var(--control-h)] px-3 rounded-[var(--r-control)] bg-[var(--surface)] text-[var(--text)] text-[15px] border border-[var(--line-control)] box-border focus:outline-none uppercase font-mono tracking-wider"
              />
            </div>
            <button
              type="submit"
              disabled={isRetrieving || !retrieveCode.trim()}
              aria-busy={isRetrieving}
              className="w-full h-[var(--control-h)] px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] font-medium text-[15px] rounded-[var(--r-control)] transition-colors cursor-pointer flex items-center justify-center disabled:opacity-60"
            >
              {isRetrieving ? "جارٍ الاسترجاع …" : "استرجاع الخطة"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRetrieveInline(false);
                setPageError(null);
              }}
              className="w-full text-center text-[13px] text-[var(--text-2)] hover:text-[var(--text)] hover:underline p-1 bg-transparent border-0 cursor-pointer"
            >
              إلغاء والعودة لبيانات الدخول
            </button>
          </form>
        )}

        {/* Secondary Navigation Links */}
        {!showRetrieveInline && !isLoading && (
          <div className="mt-[var(--s-5)] flex items-center justify-start gap-[var(--s-5)] text-[15px]">
            <button
              type="button"
              onClick={onContinueAsGuest}
              className="text-[var(--text-2)] hover:text-[var(--text)] hover:underline p-0 bg-transparent border-0 cursor-pointer"
            >
              تصفح كضيف
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRetrieveInline(true);
                setPageError(null);
              }}
              className="text-[var(--text-2)] hover:text-[var(--text)] hover:underline p-0 bg-transparent border-0 cursor-pointer"
            >
              استرجاع جدول برمز
            </button>
          </div>
        )}
      </div>
    </main>
  );
};

export default LoginPage;
