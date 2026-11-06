import React from "react";
import { Radio, X, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "../../utils";
import type { SeatWatcherItem } from "../../core/semesterRegistration";

export interface SeatWatcherPanelProps {
  isOpen: boolean;
  onClose: () => void;
  seatWatchList: SeatWatcherItem[];
  isCheckingSeats: boolean;
  onCheckWatchedSeats: () => void;
  onRemoveWatchedSection: (courseId: string, section: string) => void;
}

export const SeatWatcherPanel: React.FC<SeatWatcherPanelProps> = ({
  isOpen,
  onClose,
  seatWatchList,
  isCheckingSeats,
  onCheckWatchedSeats,
  onRemoveWatchedSection,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      dir="rtl"
    >
      <div
        className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--line)] rounded-3xl text-[var(--text)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Radio size={20} className="text-amber-500 animate-pulse" />
            <div>
              <h3 className="font-bold text-base text-[var(--text)]">
                مراقبة المقاعد الشاغرة (Seat Watcher)
              </h3>
              <p className="text-xs text-[var(--text-3)]">
                متابعة الشعب الممتلئة والتنبيه فور قيام طالب آخر بسحبها (Drop)
                لحجزها فوراً
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-2xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-3)]">
              قائمة الشعب قيد المراقبة ({seatWatchList.length}):
            </span>
            <button
              type="button"
              onClick={onCheckWatchedSeats}
              disabled={isCheckingSeats || seatWatchList.length === 0}
              className="px-3 py-1.5 rounded-xl bg-[var(--accent)] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                size={13}
                className={isCheckingSeats ? "animate-spin" : ""}
              />
              <span>تحديث السعة الآن</span>
            </button>
          </div>

          {seatWatchList.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-3)] border-2 border-dashed border-[var(--line)] rounded-3xl">
              لم تقم بإضافة أي شعبة للمراقبة بعد. اضغط أيقونة الرادار بجانب أي
              شعبة في خطتك لإدراجها هنا.
            </div>
          ) : (
            <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-3xl overflow-hidden bg-[var(--surface)]">
              {seatWatchList.map((item) => (
                <div
                  key={`${item.courseId}-${item.section}`}
                  className="p-3.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text)]">
                        {item.courseName}
                      </span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                        شعبة {item.section}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-3)]">
                      {item.instructor && `المدرس: ${item.instructor} • `}
                      {item.lastChecked && `آخر فحص: ${item.lastChecked}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                        item.isAvailable
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 animate-bounce"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25",
                      )}
                    >
                      {item.isAvailable
                        ? `شاغر (${item.available} مقعد!)`
                        : `ممتلئة (${item.registered}/${item.capacity})`}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        onRemoveWatchedSection(item.courseId, item.section)
                      }
                      className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                      title="حذف من المراقبة"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
