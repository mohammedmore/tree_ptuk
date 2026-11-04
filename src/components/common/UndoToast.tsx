import React, { useEffect, useState } from "react";
import { Undo2, X } from "lucide-react";
import { cn } from "../../utils";

export interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

export const UndoToast: React.FC<UndoToastProps> = ({
  message,
  onUndo,
  onDismiss,
  durationMs = 5000,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [durationMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      dir="rtl"
      className="fixed bottom-6 right-6 z-50 flex flex-col overflow-hidden rounded-2xl bg-[var(--surface)] border border-[var(--line-control)] shadow-2xl animate-in slide-in-from-bottom-4 duration-200"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-[13px] text-[var(--text)] font-medium">
          {message}
        </span>
        <button
          onClick={onUndo}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--accent)] text-white text-[12px] font-semibold hover:opacity-90 transition-opacity"
        >
          <Undo2 size={13} />
          <span>تراجع</span>
        </button>
        <button
          onClick={onDismiss}
          className="p-1 text-[var(--text-3)] hover:text-[var(--text)] rounded-md transition-colors"
          aria-label="إغلاق التنبيه"
        >
          <X size={14} />
        </button>
      </div>
      <div
        className="h-1 bg-[var(--accent)] transition-all ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};
