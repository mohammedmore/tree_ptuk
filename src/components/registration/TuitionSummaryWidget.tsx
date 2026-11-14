import React, { useEffect } from "react";
import { Calculator, X } from "lucide-react";
import type {
  TuitionConfig,
  TuitionCalculationResult,
} from "../../core/semesterRegistration";

export interface TuitionSummaryWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  planTitle: string;
  totalCredits: number;
  detailedTuition: TuitionCalculationResult;
  studentBalance: number | string | null | undefined;
  tuitionConfig: TuitionConfig;
  setTuitionConfig: React.Dispatch<React.SetStateAction<TuitionConfig>>;
  onOpenModal?: () => void;
  formatDisplayBalance: (val: any) => string;
}

export const TuitionSummaryWidget: React.FC<TuitionSummaryWidgetProps> = ({
  isOpen,
  onClose,
  planTitle,
  totalCredits,
  detailedTuition,
  studentBalance,
  tuitionConfig,
  setTuitionConfig,
  onOpenModal,
  formatDisplayBalance,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);
  return (
    <>
      {/* Tuition Financial Calculator Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          dir="rtl"
          onClick={onClose}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="حاسبة الرسوم المتوقعة للفصل"
            className="w-full max-w-lg bg-[var(--surface)] border border-[var(--line)] rounded-3xl text-[var(--text)] shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <Calculator size={18} className="text-emerald-500" />
                <h3 className="font-bold text-base text-[var(--text)]">
                  حاسبة الرسوم المتوقعة للفصل
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-2xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--sunken)]/50 border border-[var(--line)] space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-3)]">
                  الساعات المعتمدة في {planTitle}:
                </span>
                <span className="font-bold text-sm text-[var(--text)]">
                  {totalCredits} ساعة
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-3)]">
                  تكلفة الساعات ({totalCredits} × {detailedTuition.hourlyRate}{" "}
                  د.أ):
                </span>
                <span className="font-bold text-sm text-[var(--text)]">
                  {detailedTuition.creditsCostJOD} دينار (~
                  {detailedTuition.creditsCostILS} شيكل)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-3)]">
                  رسوم التسجيل والخدمات الثابتة:
                </span>
                <span className="font-bold text-sm text-[var(--text)]">
                  {detailedTuition.fixedFees} دينار (~
                  {Math.round(
                    detailedTuition.fixedFees * tuitionConfig.exchangeRate,
                  )}{" "}
                  شيكل)
                </span>
              </div>
              <div className="border-t border-[var(--line)] pt-2 flex justify-between items-center text-sm">
                <span className="font-bold text-[var(--text)]">
                  إجمالي الرسوم المقدرة:
                </span>
                <span className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                  {detailedTuition.totalJOD} دينار أردني (
                  {detailedTuition.totalILS} شيكل)
                </span>
              </div>
            </div>

            {/* Comparison with student balance */}
            <div className="p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-3)]">
                  رصيدك المالي المتاح في حسابك الجامعي:
                </span>
                <span className="font-mono font-bold text-[var(--text)] privacy-sensitive">
                  {formatDisplayBalance(studentBalance)}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-3)] leading-relaxed">
                يُنصح بسداد الرسوم عبر القنوات المعتمدة قبل موعد فتح التسجيل
                بوقت كافٍ لضمان تغطية الرصيد وتفادي رفض المواد.
              </p>
            </div>

            {/* Config Inputs */}
            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div className="space-y-1">
                <label className="text-[var(--text-3)] font-semibold">
                  سعر الساعة المعتمدة (دينار):
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={tuitionConfig.hourlyRate}
                  onChange={(e) =>
                    setTuitionConfig((p) => ({
                      ...p,
                      hourlyRate: Number(e.target.value) || 25,
                    }))
                  }
                  className="w-full h-9 px-3 rounded-xl bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text)] font-mono text-xs focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[var(--text-3)] font-semibold">
                  الرسوم الثابتة للفصل (دينار):
                </label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={tuitionConfig.fixedFees}
                  onChange={(e) =>
                    setTuitionConfig((p) => ({
                      ...p,
                      fixedFees: Number(e.target.value) || 25,
                    }))
                  }
                  className="w-full h-9 px-3 rounded-xl bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text)] font-mono text-xs focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90 shadow-2xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
