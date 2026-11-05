import React, { useState, useMemo } from "react";
import {
  X,
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  MapPin,
  Search,
  Check,
} from "lucide-react";
import type { Course, ScheduleEntry } from "../../data";
import {
  normalizeDayKey,
  type CatalogCourse,
  type CatalogSection,
} from "../../services/scheduleSolver";
import { analyzeSectionSwap } from "../../core/sectionSwap";
import { cn } from "../../utils";
import { triggerHaptic } from "../../utils/haptics";

export interface SectionSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  courseName: string;
  currentSection: string;
  catalogCourse?: CatalogCourse | null;
  currentSchedule: Record<string, ScheduleEntry>;
  coursesById: Map<string, Course>;
  onSelectSection: (section: CatalogSection) => void;
}

export const SectionSwapModal: React.FC<SectionSwapModalProps> = ({
  isOpen,
  onClose,
  courseId,
  courseName,
  currentSection,
  catalogCourse,
  currentSchedule,
  coursesById,
  onSelectSection,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const rawSections: CatalogSection[] = useMemo(() => {
    return catalogCourse?.sections || [];
  }, [catalogCourse]);

  const evaluatedSections = useMemo(() => {
    return rawSections.map((sec) => {
      const isCurrent = String(sec.sec) === String(currentSection);
      const analysis = analyzeSectionSwap(
        courseId,
        sec,
        currentSchedule,
        coursesById,
      );
      return {
        section: sec,
        isCurrent: isCurrent || analysis.isSameSection,
        hasConflict: analysis.hasConflictWithOtherCourses,
        conflictingCourse: analysis.conflictingCourseName,
      };
    });
  }, [rawSections, currentSection, currentSchedule, courseId, coursesById]);

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return evaluatedSections;
    return evaluatedSections.filter((item) => {
      const secNum = String(item.section.sec || "");
      const inst = (item.section.instructor || "").toLowerCase();
      const room = (item.section.room || "").toLowerCase();
      return secNum.includes(q) || inst.includes(q) || room.includes(q);
    });
  }, [evaluatedSections, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="section-swap-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--line)] bg-[var(--surface-sunken)]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h2
                id="section-swap-title"
                className="text-base sm:text-lg font-black text-[var(--text)]"
              >
                استبدال شعبة المساق
              </h2>
              <p className="text-xs text-[var(--text-3)] font-medium">
                {courseName} ({courseId}) • الشعبة الحالية:{" "}
                <b className="text-[var(--text)] font-mono">{currentSection || "غير محددة"}</b>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Input */}
        {rawSections.length > 3 && (
          <div className="p-3.5 border-b border-[var(--line)] bg-[var(--surface)] shrink-0">
            <div className="relative">
              <Search
                size={14}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم الشعبة، اسم المدرس، أو القاعة..."
                className="w-full h-9 pr-9 pl-3 text-xs bg-[var(--surface-sunken)] border border-[var(--line-control)] rounded-xl focus:outline-hidden focus:border-[var(--accent)] text-[var(--text)]"
              />
            </div>
          </div>
        )}

        {/* Section List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredSections.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-3)] space-y-2">
              <AlertTriangle size={24} className="mx-auto text-amber-500/60" />
              <p>لا توجد شعب مطروحة مسجلة لهذا المساق في دليل هذا الفصل.</p>
            </div>
          ) : (
            filteredSections.map(({ section, isCurrent, hasConflict, conflictingCourse }) => {
              const firstBlock = section.blocks?.[0];
              const daysText = firstBlock?.days?.join("، ") || "غير محدد";
              const timeText = firstBlock?.rawTime || "غير محدد";

              return (
                <div
                  key={section.sec}
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                    isCurrent
                      ? "bg-[var(--accent-soft)]/40 border-[var(--accent)]/50 ring-1 ring-[var(--accent)]/30"
                      : hasConflict
                        ? "bg-rose-500/5 border-rose-500/20"
                        : "bg-[var(--surface-sunken)]/40 border-[var(--line)] hover:border-[var(--accent)]/50",
                  )}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[var(--text)]">
                        شعبة {section.sec}
                      </span>
                      {isCurrent && (
                        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--text-on-accent)]">
                          شعبتك الحالية
                        </span>
                      )}
                      {!isCurrent && !hasConflict && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 size={11} />
                          <span>متوافقة تماماً بدون تعارض</span>
                        </span>
                      )}
                      {!isCurrent && hasConflict && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <AlertTriangle size={11} />
                          <span>تعارض مع: {conflictingCourse || "مساق آخر"}</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[11px] text-[var(--text-2)] pt-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <User size={12} className="text-[var(--text-3)] shrink-0" />
                        <span className="truncate">{section.instructor || "مدرس غير محدد"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <Clock size={12} className="text-[var(--text-3)] shrink-0" />
                        <span className="font-mono truncate">{daysText}: {timeText}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin size={12} className="text-[var(--text-3)] shrink-0" />
                        <span className="truncate">{section.room || "قاعة غير محددة"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center justify-end">
                    {isCurrent ? (
                      <span className="text-xs text-[var(--text-3)] font-medium flex items-center gap-1">
                        <Check size={14} className="text-[var(--accent)]" />
                        <span>مختارة حالياً</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("selection");
                          onSelectSection(section);
                        }}
                        className={cn(
                          "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs",
                          hasConflict
                            ? "bg-[var(--surface)] hover:bg-rose-500 hover:text-white border border-[var(--line-control)] text-[var(--text-2)]"
                            : "bg-[var(--accent)] hover:brightness-105 text-[var(--text-on-accent)]",
                        )}
                      >
                        {hasConflict ? "اختيار رغم التعارض" : "اختيار هذه الشعبة"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--line)] bg-[var(--surface-sunken)]/40 flex items-center justify-between text-xs text-[var(--text-3)] shrink-0">
          <span>
            إجمالي الشعب المطروحة: <b>{rawSections.length} شعبة</b>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-[var(--line-control)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text)] transition-colors cursor-pointer"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

export default SectionSwapModal;
