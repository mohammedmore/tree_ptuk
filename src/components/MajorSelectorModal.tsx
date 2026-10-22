import React, { useEffect, useState } from "react";
import {
  Layers,
  GraduationCap,
  BookOpen,
  Check,
  Building2,
  Clock,
  Sparkles,
  ChevronLeft,
} from "lucide-react";
import { BaseModal } from "./BaseModal";
import {
  MajorSummary,
  fetchMajors,
  getActiveMajorId,
  setActiveMajorId,
} from "../services/majorService";

interface MajorSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMajor: (majorId: string) => void;
}

export const MajorSelectorModal: React.FC<MajorSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectMajor,
}) => {
  const [majors, setMajors] = useState<MajorSummary[]>([]);
  const [activeId, setActiveId] = useState<string>(() => getActiveMajorId());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    setIsLoading(true);
    fetchMajors()
      .then((data) => {
        if (!cancelled) setMajors(data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleSelect = (id: string) => {
    setActiveId(id);
    setActiveMajorId(id);
    onSelectMajor(id);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Layers className="text-indigo-600 dark:text-indigo-400" size={24} />
          <span>اختيار التخصص الجامعي</span>
        </div>
      }
      maxWidth="max-w-2xl"
    >
      <div className="p-4 sm:p-6 space-y-4" dir="rtl">
        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3.5 text-xs sm:text-sm text-indigo-800 dark:text-indigo-300 flex items-start gap-3">
          <Sparkles className="shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" size={18} />
          <p className="leading-relaxed">
            يدعم النظام شجرة المتطلبات والخطط الدراسية لجميع تخصصات الجامعة. اختر تخصصك
            لعرض الشجرة التفاعلية، حساب الساعات التراكمية، ومحاكي الجداول المخصص لك.
          </p>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
            <p className="text-sm">جاري تحميل قائمة التخصصات...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {majors.map((major) => {
              const isSelected = major.id === activeId;
              return (
                <div
                  key={major.id}
                  onClick={() => handleSelect(major.id)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 left-3 bg-indigo-600 text-white rounded-full p-1 shadow-sm">
                      <Check size={14} />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {major.code}
                      </span>
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                        {major.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-2">
                      <Building2 size={13} />
                      <span>{major.college}</span>
                    </div>

                    {major.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">
                        {major.description}
                      </p>
                    )}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock size={13} />
                      <span>{major.totalCredits} ساعة معتمدة</span>
                    </div>
                    <div className="flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400">
                      <span>{isSelected ? "التخصص النشط" : "اختر التخصص"}</span>
                      <ChevronLeft size={14} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BaseModal>
  );
};
