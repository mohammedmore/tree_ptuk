import React, { useState, useEffect, useRef } from "react";
import CampusRunnerGame from "./CampusRunnerGame";
import SyncPipelineRadar, { SYNC_PIPELINE_STEPS } from "./SyncPipelineRadar";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";

interface LoginSyncExperienceProps {
  studentId: string;
  isSuccess?: boolean;
  onCancel?: () => void;
  onProceedToPlanner?: () => void;
}

export const LoginSyncExperience: React.FC<LoginSyncExperienceProps> = ({
  studentId,
  isSuccess = false,
  onCancel,
  onProceedToPlanner,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [progressPercent, setProgressPercent] = useState(8);
  const [hasInteractedWithGame, setHasInteractedWithGame] = useState(false);
  const [showSuccessNotice, setShowSuccessNotice] = useState(false);
  const [modalCountdown, setModalCountdown] = useState(3);
  const autoRedirectTriggeredRef = useRef(false);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 768;
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleUserPlayed = () => {
    setHasInteractedWithGame(true);
  };

  // If student was NOT actively playing the game (or on mobile device):
  // Enter IMMEDIATELY without waiting or requiring any manual click!
  useEffect(() => {
    if (
      isSuccess &&
      !hasInteractedWithGame &&
      onProceedToPlanner &&
      !autoRedirectTriggeredRef.current
    ) {
      autoRedirectTriggeredRef.current = true;
      onProceedToPlanner();
    }
  }, [isSuccess, hasInteractedWithGame, onProceedToPlanner]);

  // Keep the success notice separate from the game while allowing the student to finish the run.
  useEffect(() => {
    if (isSuccess && hasInteractedWithGame) {
      setShowSuccessNotice(true);
      setModalCountdown(3);
    }
  }, [isSuccess, hasInteractedWithGame]);

  useEffect(() => {
    if (!showSuccessNotice || !onProceedToPlanner) return;
    if (modalCountdown <= 0) {
      onProceedToPlanner();
      return;
    }
    const timer = setTimeout(() => {
      setModalCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [showSuccessNotice, modalCountdown, onProceedToPlanner]);

  // Responsive device listener: completely unmount runner game on mobile devices
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
    };
    setIsDesktop(mql.matches);
    if (mql.addEventListener) {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    } else {
      mql.addListener(handler);
      return () => mql.removeListener(handler);
    }
  }, []);

  // Elapsed seconds timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Smooth progressive progress bar across typical sync duration
  useEffect(() => {
    if (isSuccess) {
      setProgressPercent(100);
      return;
    }

    const calculated = Math.min(
      94,
      10 + Math.floor(Math.atan(elapsedSeconds / 5) * 55),
    );
    setProgressPercent((prev) => Math.max(prev, calculated));
  }, [elapsedSeconds, isSuccess]);

  // Derive active pipeline stage index (0 to 4)
  const activeStepIndex = Math.min(
    SYNC_PIPELINE_STEPS.length - 1,
    isSuccess
      ? SYNC_PIPELINE_STEPS.length - 1
      : elapsedSeconds < 4
        ? 0
        : elapsedSeconds < 8
          ? 1
          : elapsedSeconds < 13
            ? 2
            : elapsedSeconds < 18
              ? 3
              : 4,
  );

  // Dynamic status messages based on elapsed time
  let dynamicStatus = "🔐 جاري الاتصال الآمن بسيرفرات خضوري (Edugate)...";
  if (isSuccess) {
    dynamicStatus = "🎉 تمت المزامنة بنجاح! سجلك وخريطتك جاهزة الآن...";
  } else if (elapsedSeconds >= 23) {
    dynamicStatus =
      "⌛ سيرفرات الجامعة تأخذ ثوانٍ إضافية لمعالجة الضغط، نتابع جلب سجلك الأكاديمي بأمان...";
  } else if (elapsedSeconds >= 18) {
    dynamicStatus =
      "⚡ اللمسات الأخيرة... تجهيز الخريطة التفاعلية وجدولك الدراسي...";
  } else if (elapsedSeconds >= 13) {
    dynamicStatus =
      "📊 مطابقة خطة التخصص وحساب الساعات والمعدل التراكمي (GPA)...";
  } else if (elapsedSeconds >= 8) {
    dynamicStatus =
      "📜 جاري استخراج كشف العلامات والمقررات المجتازة من البوابة...";
  } else if (elapsedSeconds >= 4) {
    dynamicStatus = "🎓 تم التحقق من الحساب، جاري قراءة الملف الأكاديمي...";
  }

  return (
    <div
      dir="rtl"
      className="w-full h-full flex-1 flex flex-col justify-between overflow-hidden select-none relative"
      role="region"
      aria-label="مركز المزامنة الذكية ومسار الاتصال ولعبة الطالب"
    >
      {/* 1. Upper Section: Compact Sync Pipeline Radar */}
      <div className="shrink-0 mb-2">
        <SyncPipelineRadar
          elapsedSeconds={elapsedSeconds}
          activeStepIndex={activeStepIndex}
          progressPercent={progressPercent}
          statusMessage={dynamicStatus}
          isSuccess={isSuccess}
          onCancel={onCancel}
          onProceedToPlanner={onProceedToPlanner}
        />
      </div>

      {showSuccessNotice && (
        <section
          role="status"
          aria-live="polite"
          className="w-full max-w-2xl mx-auto mb-2 p-3 sm:p-4 rounded-[var(--r-surface)] bg-[var(--surface)] border border-[var(--accent)] shadow-sm shrink-0"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-[var(--r-control)] bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base font-bold text-[var(--text)] m-0">
                تم جلب سجلك الأكاديمي بنجاح
              </h2>
              <p className="text-xs sm:text-[13px] text-[var(--text-2)] leading-relaxed mt-1 mb-0">
                اكتمل التحقق من المواد المجتازة والمعدل والخطة الدراسية. يمكنك
                الانتقال للمخطط الآن أو متابعة اللعب.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onProceedToPlanner}
                  className="h-9 px-3 rounded-[var(--r-control)] bg-[var(--accent)] text-[var(--text-on-accent)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <span>الانتقال إلى المخطط</span>
                  <ArrowLeft size={15} />
                </button>
                <span className="text-[11px] text-[var(--text-3)]">
                  انتقال تلقائي خلال {modalCountdown} ثوانٍ
                </span>
                <button
                  type="button"
                  onClick={() => setShowSuccessNotice(false)}
                  className="mr-auto px-2 py-1 text-[11px] text-[var(--text-2)] hover:text-[var(--text)] rounded-[var(--r-control)] cursor-pointer"
                >
                  متابعة اللعب
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2. Lower Section: Runner Game on Desktop or Compact Step on Mobile */}
      {isDesktop ? (
        <div className="w-full flex-1 min-h-[160px] flex flex-col justify-end overflow-hidden pb-0">
          <CampusRunnerGame
            isSuccess={isSuccess}
            onProceedToPlanner={onProceedToPlanner}
            onUserPlayed={handleUserPlayed}
          />
        </div>
      ) : (
        /* Mobile View */
        <div className="w-full flex-1 flex flex-col items-center justify-center p-3 text-center my-auto">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl flex flex-col items-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
              {isSuccess ? (
                <CheckCircle2
                  size={26}
                  className="text-emerald-400 animate-bounce"
                />
              ) : (
                <Loader2 size={24} className="text-emerald-400 animate-spin" />
              )}
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">
                {isSuccess
                  ? "🎉 اكتملت المزامنة بنجاح!"
                  : SYNC_PIPELINE_STEPS[activeStepIndex]?.title}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed px-2">
                {isSuccess
                  ? "تم سحب سجلك الأكاديمي، جاري الدخول للمخطط..."
                  : SYNC_PIPELINE_STEPS[activeStepIndex]?.shortDesc}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginSyncExperience;
