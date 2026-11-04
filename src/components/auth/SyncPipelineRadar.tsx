import React from "react";
import {
  ShieldCheck,
  UserCheck,
  FileSpreadsheet,
  Network,
  LayoutDashboard,
  CheckCircle2,
  Loader2,
  Clock,
  Activity,
  AlertCircle,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

export interface SyncStep {
  id: number;
  title: string;
  shortDesc: string;
  icon: React.ReactNode;
}

export const SYNC_PIPELINE_STEPS: SyncStep[] = [
  {
    id: 1,
    title: "اتصال Edugate",
    shortDesc: "تشفير الجلسة وشهادة SSL",
    icon: <ShieldCheck size={14} />,
  },
  {
    id: 2,
    title: "مصادقة الهوية",
    shortDesc: "قراءة بيانات الطالب والتخصص",
    icon: <UserCheck size={14} />,
  },
  {
    id: 3,
    title: "كشف العلامات",
    shortDesc: "سحب المقررات المجتازة والدرجات",
    icon: <FileSpreadsheet size={14} />,
  },
  {
    id: 4,
    title: "مطابقة الخطة",
    shortDesc: "حساب الساعات والمعدل التراكمي",
    icon: <Network size={14} />,
  },
  {
    id: 5,
    title: "الجدول الأسبوعي",
    shortDesc: "بناء الشجرة التفاعلية للفصل",
    icon: <LayoutDashboard size={14} />,
  },
];

interface SyncPipelineRadarProps {
  elapsedSeconds: number;
  activeStepIndex: number;
  progressPercent: number;
  statusMessage: string;
  isSuccess?: boolean;
  onCancel?: () => void;
  onProceedToPlanner?: () => void;
  showActionBanner?: boolean;
}

export const SyncPipelineRadar: React.FC<SyncPipelineRadarProps> = ({
  elapsedSeconds,
  activeStepIndex,
  progressPercent,
  statusMessage,
  isSuccess = false,
  onCancel,
  onProceedToPlanner,
  showActionBanner = true,
}) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="w-full rounded-xl bg-slate-900/90 border border-slate-800 p-2.5 sm:p-3 shadow-lg text-right select-none space-y-2 shrink-0"
      role="region"
      aria-label="مسار وتفاصيل مزامنة بيانات الطالب المباشرة"
    >
      {/* 1. Header row: Timer, Status Message, Progress %, Cancel */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-bold shrink-0">
            <Clock size={11} className="text-emerald-400 animate-spin" />
            <span>⏱️ {formatTime(elapsedSeconds)}</span>
          </div>

          <div className="flex items-center gap-1.5 min-w-0 text-slate-200 truncate">
            {isSuccess ? (
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            ) : (
              <Loader2
                size={13}
                className="text-emerald-400 animate-spin shrink-0"
              />
            )}
            <span className="truncate text-[11px] sm:text-xs font-medium">
              {statusMessage}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-slate-200 font-mono bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
            {Math.round(progressPercent)}%
          </span>
          {onCancel && !isSuccess && (
            <button
              type="button"
              onClick={onCancel}
              title="إلغاء المزامنة والعودة"
              className="text-[11px] text-slate-400 hover:text-rose-400 hover:underline p-0.5 bg-transparent border-0 cursor-pointer flex items-center gap-1 transition-colors"
            >
              <AlertCircle size={11} />
              <span>إلغاء</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Slim Animated Progress Bar */}
      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-linear-to-r from-emerald-500 via-teal-400 to-emerald-300 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          style={{ width: `${Math.min(100, Math.max(6, progressPercent))}%` }}
        />
      </div>

      {/* 3. Compact Horizontal Stepper Row (All 5 stages in one slim line) */}
      <div className="grid grid-cols-5 gap-1.5 pt-0.5">
        {SYNC_PIPELINE_STEPS.map((step, idx) => {
          const isDone = isSuccess || idx < activeStepIndex;
          const isCurrent = !isSuccess && idx === activeStepIndex;

          return (
            <div
              key={step.id}
              className={`py-1.5 px-1 sm:px-2 rounded-lg border transition-all text-center flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 ${
                isCurrent
                  ? "bg-slate-800/95 border-emerald-500 shadow-xs shadow-emerald-950/50"
                  : isDone
                    ? "bg-emerald-950/25 border-emerald-500/40 text-emerald-300"
                    : "bg-slate-900/30 border-slate-800/50 opacity-40 text-slate-500"
              }`}
            >
              <span className="shrink-0 hidden sm:inline-block">
                {isDone ? (
                  <CheckCircle2 size={12} className="text-emerald-400" />
                ) : isCurrent ? (
                  <Loader2
                    size={12}
                    className="text-emerald-400 animate-spin"
                  />
                ) : (
                  <span className="text-[10px] font-mono">{step.id}</span>
                )}
              </span>

              <span
                className={`text-[10px] sm:text-[11px] font-bold truncate leading-none ${
                  isCurrent
                    ? "text-emerald-300"
                    : isDone
                      ? "text-slate-100"
                      : "text-slate-400"
                }`}
              >
                {step.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SyncPipelineRadar;
