import React from "react";
import { GitFork } from "lucide-react";

export interface ScenarioSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarioName: string;
  setScenarioName: (name: string) => void;
  onConfirmSave: () => void;
}

export const ScenarioSaveModal: React.FC<ScenarioSaveModalProps> = ({
  isOpen,
  onClose,
  scenarioName,
  setScenarioName,
  onConfirmSave,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-modal)] max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="flex items-center gap-2.5 text-[var(--accent)]">
          <div className="p-2 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)]/30 shrink-0">
            <GitFork size={20} />
          </div>
          <div>
            <h3 className="font-bold text-[16px] text-[var(--text)]">
              حفظ كسيناريو جديد
            </h3>
            <p className="text-[11px] text-[var(--text-3)]">
              إنشاء مسار خطة بديلة للرجوع إليه لاحقاً
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="scenario-name-input"
            className="text-[12px] font-medium text-[var(--text-2)]"
          >
            اسم السيناريو:
          </label>
          <input
            id="scenario-name-input"
            type="text"
            autoFocus
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onConfirmSave();
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="مثلاً: خطة 4 سنوات مع صيفي"
            className="w-full h-[38px] px-3 text-[13px] bg-[var(--bg)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-[13px] font-medium rounded-[var(--r-control)] border border-[var(--line-control)] text-[var(--text-2)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={!scenarioName.trim()}
            onClick={onConfirmSave}
            className="px-4 py-2 text-[13px] font-semibold rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] transition-colors cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-40"
          >
            حفظ السيناريو
          </button>
        </div>
      </div>
    </div>
  );
};
