import React from "react";
import {
  Zap,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
} from "lucide-react";
import { cn } from "../../utils";
import { triggerHaptic } from "../../utils/haptics";

export interface PortalStatusInfo {
  isOpen: boolean;
  message: string;
  timestamp?: string;
}

export interface PrewarmStatusCardProps {
  isLiveMode: boolean;
  onToggleMode: (live: boolean) => void;
  livePassword: string;
  onOpenAuthModal: () => void;
  isCheckingPortal: boolean;
  portalStatus: PortalStatusInfo | null;
  onCheckPortalStatus: () => void;
  isOnline?: boolean;
  isSlowNetwork?: boolean;
  networkRtt?: number;
}

export const PrewarmStatusCard: React.FC<PrewarmStatusCardProps> = ({
  isLiveMode,
  onToggleMode,
  livePassword,
  onOpenAuthModal,
  isCheckingPortal,
  portalStatus,
  onCheckPortalStatus,
  isOnline = true,
  isSlowNetwork = false,
  networkRtt,
}) => {
  return (
    <div className="p-4 rounded-3xl bg-[var(--surface)] border border-[var(--line)] shadow-xs space-y-3.5">
      {/* Network Health Warning if Offline or High Latency */}
      {!isOnline && (
        <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <WifiOff size={16} className="shrink-0" />
          <span>
            أنت غير متصل بالإنترنت حالياً. تم تفعيل وضع عدم الاتصال وتخزين الخطة
            محلياً.
          </span>
        </div>
      )}

      {isOnline && isSlowNetwork && (
        <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge size={16} className="shrink-0 text-amber-500" />
            <span>
              استجابة الشبكة بطيئة نسبياً
              {networkRtt ? ` (${networkRtt}ms)` : ""}. يُنصح بالاتصال بشبكة
              مستقرة قبل موعد التسجيل.
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[var(--text-3)]">
            وضع التشغيل:
          </span>
          <div className="inline-flex p-1 rounded-2xl bg-[var(--sunken)] border border-[var(--line-control)] text-xs">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                onToggleMode(false);
              }}
              className={cn(
                "px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5",
                !isLiveMode
                  ? "bg-[var(--surface)] text-[var(--accent)] shadow-2xs"
                  : "text-[var(--text-2)] hover:text-[var(--text)]",
              )}
            >
              <Sparkles size={13} />
              <span>محاكاة وتخطيط أسبوعي</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                onToggleMode(true);
                if (!livePassword) {
                  onOpenAuthModal();
                }
              }}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                isLiveMode
                  ? "bg-rose-500 text-white shadow-2xs"
                  : "text-[var(--text-2)] hover:text-[var(--text)]",
              )}
            >
              <Zap
                size={13}
                className={isLiveMode ? "text-amber-300" : "text-rose-500"}
              />
              <span>تسجيل إلكتروني حقيقي (Edugate Live)</span>
            </button>
          </div>
        </div>

        <a
          href="https://edugate.ptuk.edu.ps/student/onlineRegistration"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1 font-semibold"
        >
          <span>رابط البوابة: onlineRegistration</span>
          <ArrowRight size={12} className="rotate-180" />
        </a>
      </div>

      {/* Dynamic Mode Details */}
      {!isLiveMode ? (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-[var(--text-2)] flex items-start gap-2.5">
          <ShieldAlert size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5 leading-relaxed">
            <span className="font-bold text-amber-700 dark:text-amber-300 block">
              وضع المحاكاة والتخطيط الأسبوعي (Local Simulation)
            </span>
            <span>
              يقوم بحساب التعارضات واعتماد الخطة محلياً في جدولك داخل التطبيق.
              للانتقال للتسجيل الرسمي الفعلي في سيرفرات خضوري، فعّل وضع{" "}
              <strong>(Edugate Live)</strong> أعلاه.
            </span>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-[var(--text)] space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="font-bold text-rose-700 dark:text-rose-300">
                متصل بمسار البوابة الرسمي:
                https://edugate.ptuk.edu.ps/student/onlineRegistration
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCheckPortalStatus}
                disabled={isCheckingPortal}
                className="px-3 py-1.5 rounded-xl font-bold text-xs bg-[var(--surface)] hover:bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text)] shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCheckingPortal ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Gauge size={13} className="text-indigo-500" />
                )}
                <span>فحص جاهزية نافذة التسجيل الآن</span>
              </button>

              <button
                type="button"
                onClick={onOpenAuthModal}
                className="px-3 py-1.5 rounded-xl font-bold text-xs bg-[var(--surface)] hover:bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text-2)] shadow-2xs cursor-pointer"
              >
                {livePassword ? "تعديل كلمة المرور" : "إدخال كلمة المرور"}
              </button>
            </div>
          </div>

          {portalStatus && (
            <div
              className={cn(
                "p-2.5 rounded-xl border text-xs flex items-start gap-2",
                portalStatus.isOpen
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300",
              )}
            >
              {portalStatus.isOpen ? (
                <CheckCircle2
                  size={16}
                  className="shrink-0 mt-0.5 text-emerald-500"
                />
              ) : (
                <AlertTriangle
                  size={16}
                  className="shrink-0 mt-0.5 text-amber-500"
                />
              )}
              <div className="space-y-0.5">
                <span className="font-bold block">
                  {portalStatus.isOpen
                    ? "نافذة التسجيل مفتوحة رسمياً ومتاحة للإرسال"
                    : "نافذة التسجيل غير متاحة حالياً"}
                </span>
                <p className="text-[11px] opacity-90">{portalStatus.message}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
