import React, { useEffect, useState, useMemo } from "react";
import { Check, X, Search, GraduationCap, BookOpen } from "lucide-react";
import {
  MajorSummary,
  fetchMajors,
  getActiveMajorId,
  setActiveMajorId,
} from "../../services/majorService";
import { cn, normalizeArabicText, wordsMatch } from "../../utils";

interface MajorSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMajor: (majorId: string) => void;
  currentMajorId?: string;
}

export const MajorSelectorModal: React.FC<MajorSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectMajor,
  currentMajorId,
}) => {
  const [majors, setMajors] = useState<MajorSummary[]>([]);
  const [activeId, setActiveId] = useState<string>(
    () => currentMajorId || getActiveMajorId(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    setActiveId(currentMajorId || getActiveMajorId());
    setIsLoading(true);
    fetchMajors()
      .then((data) => {
        if (!cancelled) {
          const valid = (data || []).filter((m) =>
            Boolean(
              m &&
              (m.cohortYear || m.name) &&
              !["cse", "swe", "cs", "ee"].includes(m.id?.toLowerCase()),
            ),
          );
          setMajors(valid);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentMajorId]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, onClose]);

  const filteredMajors = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return majors;

    const normQ = normalizeArabicText(q);

    return majors.filter((m) => {
      const nameMatch =
        normalizeArabicText(m.name).includes(normQ) || wordsMatch(m.name, q);
      const collegeMatch =
        m.college &&
        (normalizeArabicText(m.college).includes(normQ) ||
          wordsMatch(m.college, q));
      const yearMatch = m.cohortYear && m.cohortYear.includes(q);
      const idMatch = m.id.toLowerCase().includes(q.toLowerCase());

      return nameMatch || collegeMatch || yearMatch || idMatch;
    });
  }, [majors, searchQuery]);

  if (!isOpen) return null;

  const handleSelect = (id: string) => {
    setActiveId(id);
    const chosen = majors.find((m) => m.id === id);
    setActiveMajorId(id, chosen?.name);
    onSelectMajor(id);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="major-modal-title"
      className="fixed inset-0 bg-[var(--scrim)] z-[var(--z-dialog)] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-surface)] text-[var(--text)] shadow-lg animate-in fade-in duration-150"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <GraduationCap
              className="text-[var(--accent)] shrink-0"
              size={22}
            />
            <h2
              id="major-modal-title"
              className="text-[17px] font-bold text-[var(--text)] font-['Noto_Naskh_Arabic',serif]"
            >
              اختيار التخصص الجامعي
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="p-1.5 text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] rounded-[var(--r-control)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 sm:p-4 border-b border-[var(--line)] bg-[var(--sunken)]/40 shrink-0">
          <div className="relative">
            <Search
              size={15}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم التخصص، الكلية، أو سنة الدفعة (مثلاً: 2023)..."
              className="w-full h-10 pr-10 pl-9 text-xs sm:text-[13px] rounded-xl bg-[var(--surface)] border border-[var(--line-control)] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-3)] hover:text-[var(--text)] rounded-full hover:bg-[var(--sunken)] transition-colors cursor-pointer"
                title="مسح البحث"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {isLoading ? (
            <div className="py-14 text-center text-sm text-[var(--text-2)] space-y-2">
              <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto" />
              <p>جاري تحميل قائمة التخصصات...</p>
            </div>
          ) : majors.length === 0 ? (
            <div className="py-14 text-center space-y-3 px-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                <BookOpen size={24} />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="font-bold text-sm text-[var(--text)]">
                  لا توجد تخصصات مسجلة بعد في قاعدة البيانات
                </h4>
                <p className="text-xs text-[var(--text-3)] leading-relaxed">
                  تتم إضافة التخصصات والخطط العامة تلقائياً عندما يسجل أي طالب
                  دخوله عبر البوابة الجامعية (Edugate)، لتكون الخطة العامة متاحة
                  لجميع زملائه في نفس التخصص.
                </p>
              </div>
            </div>
          ) : filteredMajors.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-3)] space-y-2">
              <Search
                size={28}
                className="mx-auto opacity-40 text-indigo-400"
              />
              <p className="text-sm font-semibold text-[var(--text-2)]">
                لا توجد نتائج مطابقة لبحثك عن "{searchQuery}"
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                إعادة تعيين البحث
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredMajors.map((major) => {
                const isSelected =
                  major.id === activeId ||
                  (Boolean(activeId) &&
                    (major.id.toLowerCase() === activeId.toLowerCase() ||
                      major.name.toLowerCase() === activeId.toLowerCase()));
                return (
                  <div
                    key={major.id}
                    onClick={() => handleSelect(major.id)}
                    className={cn(
                      "p-4 rounded-[var(--r-control)] border transition-all cursor-pointer relative flex flex-col justify-between gap-3 text-right group",
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-2xs"
                        : "border-[var(--line-control)] bg-[var(--surface)] hover:bg-[var(--sunken)] hover:border-[var(--line)]",
                    )}
                  >
                    {/* Leading accent strip if selected */}
                    {isSelected && (
                      <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-[var(--accent)] rounded-r-[var(--r-control)]" />
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-[14px] text-[var(--text)] group-hover:text-[var(--accent)] transition-colors truncate">
                          {major.name}
                        </h3>
                        {major.cohortYear && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25">
                            دفعة {major.cohortYear}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[var(--text-2)] line-clamp-1">
                        {major.college}
                      </p>
                    </div>

                    <div className="border-t border-[var(--line)] pt-2.5 flex items-center justify-between text-[11px] text-[var(--text-3)] tabular-nums">
                      <div className="flex items-center gap-1.5">
                        <span>{major.totalCredits} ساعة معتمدة</span>
                        {major.coursesCount ? (
                          <>
                            <span>•</span>
                            <span>{major.coursesCount} مساق</span>
                          </>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          "font-bold text-xs flex items-center gap-1",
                          isSelected
                            ? "text-[var(--accent)]"
                            : "text-[var(--text-2)]",
                        )}
                      >
                        {isSelected ? (
                          <>
                            <Check size={14} strokeWidth={2.5} />
                            <span>التخصص الحالي</span>
                          </>
                        ) : (
                          <span>اختيار الخطة ←</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MajorSelectorModal;
