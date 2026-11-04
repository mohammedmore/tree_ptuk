import React, { useEffect } from "react";
import { cn } from "../../utils";

interface ResetConfirmationModalProps {
  showResetConfirm: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ResetConfirmationModal: React.FC<ResetConfirmationModalProps> = ({
  showResetConfirm,
  onClose,
  onConfirm,
}) => {
  useEffect(() => {
    if (!showResetConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [showResetConfirm, onClose]);

  if (!showResetConfirm) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
      className="fixed inset-0 bg-[var(--scrim)] z-[var(--z-dialog)] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] p-6 bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-surface)] text-[var(--text)] shadow-none animate-in fade-in duration-150"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="reset-modal-title"
          className="text-[18px] font-semibold text-[var(--text)] mb-3"
        >
          إعادة ضبط الخطة
        </h2>
        <p className="text-[15px] text-[var(--text-2)] leading-normal mb-6">
          ستُحذف جميع المواد المنجزة، والمواد المخطط لها، والعلامات المتوقعة،
          والجدول الأسبوعي. لا يمكن التراجع عن هذا الإجراء.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[var(--control-h)] px-4 bg-transparent border border-[var(--line-control)] text-[var(--text)] rounded-[var(--r-control)] font-medium text-[15px] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="min-h-[var(--control-h)] px-4 bg-[var(--danger)] hover:opacity-90 text-[var(--text-on-accent)] rounded-[var(--r-control)] font-medium text-[15px] transition-colors cursor-pointer"
          >
            إعادة الضبط
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetConfirmationModal;
