import React from "react";
import { Check, RefreshCw, WifiOff, Cloud } from "lucide-react";
import { cn } from "../../utils";

export interface SyncStatusPillProps {
  isOnline: boolean;
  isSyncing?: boolean;
  lastSyncText?: string;
  onClick?: () => void;
}

export const SyncStatusPill: React.FC<SyncStatusPillProps> = ({
  isOnline,
  isSyncing = false,
  lastSyncText,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer select-none whitespace-nowrap shrink-0",
        !isOnline
          ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
          : isSyncing
            ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30"
            : "bg-[var(--surface)] text-[var(--text-3)] border-[var(--line)] hover:text-[var(--text)] hover:border-[var(--line-control)]",
      )}
      title={lastSyncText ? `آخر مزامنة: ${lastSyncText}` : undefined}
      aria-label="حالة المزامنة والاتصال"
    >
      {!isOnline ? (
        <>
          <WifiOff size={12} className="shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">
            أوفلاين (محفوظ محلياً)
          </span>
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw size={12} className="shrink-0 animate-spin" />
          <span className="hidden sm:inline whitespace-nowrap">
            جاري المزامنة...
          </span>
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">
            {lastSyncText || "متزامن"}
          </span>
        </>
      )}
    </button>
  );
};
