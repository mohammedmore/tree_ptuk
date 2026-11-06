import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  Search,
  BookOpen,
  Calendar,
  Layers,
  Calculator,
  Compass,
  Download,
  Moon,
  Sun,
  Laptop,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Sliders,
  Eye,
  Printer,
  Contrast,
  X,
  Activity,
} from "lucide-react";
import type { Course } from "../../data";
import type { AppRoute } from "../../router";
import { normalizeArabicText } from "../../utils";
import { FALLBACK_MAJORS } from "../../services/majorService";
import { themeManager, type ThemeMode } from "../../themeManager";
import { triggerHaptic } from "../../utils/haptics";
import { togglePrivacyMask } from "../../services/privacyMaskStore";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  completedCourses: Set<string>;
  onNavigate: (route: AppRoute) => void;
  onSelectCourse?: (course: Course) => void;
  onOpenExport?: () => void;
  onOpenMajorSelector?: () => void;
  onSelectMajor?: (majorId: string) => void;
  onOpenComparison?: () => void;
  onOpenCalendar?: () => void;
  onOpenSystemHealth?: () => void;
  onOpenAdvisor?: () => void;
  onPrintTranscript?: () => void;
  activeMajorId?: string;
  isAdmin?: boolean;
}

interface PaletteAction {
  id: string;
  title: string;
  subtitle?: string;
  category: "navigation" | "courses" | "majors" | "theme" | "actions";
  icon: React.ReactNode;
  perform: () => void;
  keywords?: string[];
}

export const CommandPaletteModal: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  courses,
  completedCourses,
  onNavigate,
  onSelectCourse,
  onOpenExport,
  onOpenMajorSelector,
  onSelectMajor,
  onOpenComparison,
  onOpenCalendar,
  onOpenSystemHealth,
  onOpenAdvisor,
  onPrintTranscript,
  activeMajorId,
  isAdmin = false,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      triggerHaptic("light");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Construct actions
  const actions: PaletteAction[] = useMemo(() => {
    const list: PaletteAction[] = [
      // Navigation
      {
        id: "nav-plan",
        title: "الخطة الشجرية التفاعلية",
        subtitle: "عرض المتطلبات المسبقة ومسار التخرج",
        category: "navigation",
        icon: <Layers size={16} className="text-emerald-500" />,
        perform: () => onNavigate("plan"),
        keywords: ["خطة", "شجرة", "مسار", "plan", "tree"],
      },
      {
        id: "nav-courses",
        title: "دليل المواد والشعب الحية",
        subtitle: "البحث في الشعب والمحاضرين والمقاعد",
        category: "navigation",
        icon: <BookOpen size={16} className="text-blue-500" />,
        perform: () => onNavigate("courses"),
        keywords: ["مواد", "شعب", "دليل", "courses", "sections"],
      },
      {
        id: "nav-schedule",
        title: "الجدول الأسبوعي ومولد التوافقات",
        subtitle: "حل التعارضات وتوزيع المحاضرات",
        category: "navigation",
        icon: <Calendar size={16} className="text-amber-500" />,
        perform: () => onNavigate("schedule"),
        keywords: ["جدول", "أسبوعي", "تعارض", "schedule", "weekly"],
      },
      {
        id: "nav-gpa",
        title: "حاسبة المعدل الفصلي والتراكمي",
        subtitle: "توقع المعدل وسيناريوهات الدرجات",
        category: "navigation",
        icon: <Calculator size={16} className="text-purple-500" />,
        perform: () => onNavigate("gpa"),
        keywords: ["معدل", "تراكمي", "فصلي", "gpa", "calculator"],
      },
      {
        id: "nav-registration",
        title: "تثبيت وتسجيل المواد",
        subtitle: "الربط مع البوابة وحجز الشعب",
        category: "navigation",
        icon: <Compass size={16} className="text-rose-500" />,
        perform: () => onNavigate("registration"),
        keywords: ["تسجيل", "تثبيت", "بوابة", "registration"],
      },

      // Actions
      {
        id: "action-calendar",
        title: "التقويم الأكاديمي المعتمد",
        subtitle:
          "مواعيد الامتحانات النصفية والنهائية والسحب والإضافة والعطل الرسمية",
        category: "actions",
        icon: <Calendar size={16} className="text-indigo-500" />,
        perform: () => {
          if (onOpenCalendar) onOpenCalendar();
        },
        keywords: [
          "تقويم",
          "أكاديمي",
          "امتحانات",
          "نصفي",
          "نهائي",
          "سحب",
          "إضافة",
          "calendar",
          "dates",
        ],
      },
      ...(isAdmin
        ? [
            {
              id: "action-system-health",
              title: "مراقبة واستقرار النظام (Admin Observability)",
              subtitle:
                "تتبع زمن الاستجابة، حالة قاطع دورة Edugate، واستهلاك الذاكرة للمشرفين",
              category: "actions" as const,
              icon: <Activity size={16} className="text-emerald-500" />,
              perform: () => {
                if (onOpenSystemHealth) onOpenSystemHealth();
              },
              keywords: [
                "حالة",
                "النظام",
                "مراقبة",
                "أداء",
                "استقرار",
                "سيرفر",
                "health",
                "status",
                "latency",
                "observability",
                "metrics",
                "edugate",
                "admin",
              ],
            },
          ]
        : []),
      {
        id: "action-academic-advisor",
        title: "المرشد الأكاديمي والمسار الحرج (Academic Advisor)",
        subtitle:
          "كشف المواد العنقودية، محاكاة تأخير التخرج، والتوصية بالفصل القادم",
        category: "actions",
        icon: <Compass size={16} className="text-indigo-500" />,
        perform: () => {
          if (onOpenAdvisor) onOpenAdvisor();
        },
        keywords: [
          "مرشد",
          "أكاديمي",
          "مسار",
          "حرج",
          "اختناق",
          "تخرج",
          "معدل",
          "توصية",
          "advisor",
          "critical",
          "path",
          "gpa",
        ],
      },
      {
        id: "action-export",
        title: "تصدير الخطة والجدول",
        subtitle: "حفظ كملف PDF أو صورة أو تقويم iCal",
        category: "actions",
        icon: <Download size={16} className="text-indigo-500" />,
        perform: () => {
          if (onOpenExport) onOpenExport();
        },
        keywords: ["تصدير", "pdf", "ical", "حفظ", "export"],
      },
      {
        id: "action-compare",
        title: "مقارنة مادتين اختياريتين جنباً إلى جنب",
        subtitle: "مقارنة الساعات والمتطلبات ومواعيد الشعب",
        category: "actions",
        icon: <Sliders size={16} className="text-teal-500" />,
        perform: () => {
          if (onOpenComparison) onOpenComparison();
        },
        keywords: ["مقارنة", "اختياري", "مساقات", "compare"],
      },
      {
        id: "action-print-a4",
        title: "طباعة السجل الأكاديمي الورقي (A4)",
        subtitle: "إخراج وثيقة نظيفة معتمدة خالية من عناصر الواجهة",
        category: "actions",
        icon: (
          <Printer size={16} className="text-slate-600 dark:text-slate-300" />
        ),
        perform: () => {
          if (onPrintTranscript) {
            onPrintTranscript();
          } else {
            window.print();
          }
        },
        keywords: ["طباعة", "ورقي", "a4", "سجل", "print", "transcript"],
      },
      {
        id: "action-privacy-mask",
        title: "تبديل وضع حماية الخصوصية والتمويه",
        subtitle: "تمويه المعدل والدرجات تلقائياً في الأماكن العامة والمدرجات",
        category: "actions",
        icon: <Eye size={16} className="text-amber-500" />,
        perform: () => {
          togglePrivacyMask();
          triggerHaptic("selection");
        },
        keywords: [
          "خصوصية",
          "تمويه",
          "إخفاء",
          "علامات",
          "معدل",
          "privacy",
          "mask",
          "blur",
        ],
      },

      // Theme
      {
        id: "theme-light",
        title: "تفعيل الوضع المضيء (Light)",
        subtitle: "السمة الفاتحة الكلاسيكية",
        category: "theme",
        icon: <Sun size={16} className="text-amber-500" />,
        perform: () => themeManager.setTheme("light"),
        keywords: ["فاتح", "مضيء", "نهاري", "light", "sun"],
      },
      {
        id: "theme-dark",
        title: "تفعيل الوضع الداكن (Dark)",
        subtitle: "السمة الليلية المريحة للعين",
        category: "theme",
        icon: <Moon size={16} className="text-indigo-400" />,
        perform: () => themeManager.setTheme("dark"),
        keywords: ["داكن", "ليلي", "dark", "night"],
      },
      {
        id: "theme-oled",
        title: "تفعيل وضع OLED الأسود الخالص",
        subtitle: "شاشات الهاتف الحديثة وحفظ البطارية",
        category: "theme",
        icon: <Laptop size={16} className="text-emerald-400" />,
        perform: () => themeManager.setTheme("oled"),
        keywords: ["oled", "اسود", "بطارية", "black"],
      },
      {
        id: "theme-contrast",
        title: "تفعيل نمط التباين العالي (High Contrast)",
        subtitle: "وضوح فائق للقراءة تحت أشعة الشمس المباشرة",
        category: "theme",
        icon: <Contrast size={16} className="text-cyan-400" />,
        perform: () => themeManager.setTheme("high-contrast"),
        keywords: ["تباين", "عالي", "شمس", "contrast", "high-contrast"],
      },
    ];

    // Majors
    FALLBACK_MAJORS.forEach((m) => {
      list.push({
        id: `major-${m.id}`,
        title: `التبديل إلى تخصص: ${m.name}`,
        subtitle: `${m.code} • ${m.college}`,
        category: "majors",
        icon: <GraduationCap size={16} className="text-sky-500" />,
        perform: () => {
          if (onSelectMajor) onSelectMajor(m.id);
        },
        keywords: [m.name, m.code, m.college, "تخصص", "major"],
      });
    });

    // Top Courses search items
    courses.slice(0, 120).forEach((c) => {
      const isDone = completedCourses.has(c.id);
      list.push({
        id: `course-${c.id}`,
        title: `${c.name} (${c.id})`,
        subtitle: `${c.category} • ${c.credits} ساعات ${isDone ? "• [منجزة]" : ""}`,
        category: "courses",
        icon: (
          <div
            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
              isDone
                ? "bg-emerald-500 text-white"
                : "bg-[var(--accent)] text-white"
            }`}
          >
            {isDone ? "✓" : "C"}
          </div>
        ),
        perform: () => {
          if (onSelectCourse) {
            onSelectCourse(c);
          } else {
            onNavigate("courses");
          }
        },
        keywords: [c.id, c.name, c.category],
      });
    });

    return list;
  }, [
    courses,
    completedCourses,
    onNavigate,
    onSelectCourse,
    onOpenExport,
    onSelectMajor,
    onOpenComparison,
    onPrintTranscript,
  ]);

  // Filter actions based on query
  const filteredActions = useMemo(() => {
    const q = normalizeArabicText(query.trim());
    if (!q) {
      // Prioritize top navigation & common tools when query is empty
      return actions.filter(
        (a) =>
          a.category === "navigation" ||
          a.category === "actions" ||
          a.category === "theme",
      );
    }

    return actions.filter((action) => {
      const matchTitle = normalizeArabicText(action.title).includes(q);
      const matchSubtitle =
        action.subtitle && normalizeArabicText(action.subtitle).includes(q);
      const matchKeywords = action.keywords?.some((k) =>
        normalizeArabicText(k).includes(q),
      );
      return matchTitle || matchSubtitle || matchKeywords;
    });
  }, [actions, query]);

  // Keyboard navigation
  const executeSelected = useCallback(
    (index: number) => {
      const action = filteredActions[index];
      if (action) {
        triggerHaptic("selection");
        action.perform();
        onClose();
      }
    },
    [filteredActions, onClose],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (filteredActions.length > 0) {
          setSelectedIndex((prev) =>
            prev + 1 < filteredActions.length ? prev + 1 : 0,
          );
          triggerHaptic("light");
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (filteredActions.length > 0) {
          setSelectedIndex((prev) =>
            prev - 1 >= 0 ? prev - 1 : filteredActions.length - 1,
          );
          triggerHaptic("light");
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (
          filteredActions.length > 0 &&
          selectedIndex >= 0 &&
          selectedIndex < filteredActions.length
        ) {
          executeSelected(selectedIndex);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredActions, executeSelected, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (
      !listRef.current ||
      selectedIndex < 0 ||
      selectedIndex >= listRef.current.children.length
    )
      return;
    const activeEl = listRef.current.children[selectedIndex] as
      HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="لوحة الأوامر السريعة"
      className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center pt-14 sm:pt-20 px-3 sm:px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 no-print"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--surface)] border border-[var(--line-control)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--line)] bg-[var(--sunken)]/50">
          <Search size={18} className="text-[var(--text-3)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="ابحث عن مساق، إجراء، تخصص، أو نمط عرض... (Ctrl+K)"
            className="flex-1 bg-transparent border-0 outline-none text-sm font-semibold text-[var(--text)] placeholder:text-[var(--text-3)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-1 rounded text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--surface)] border border-[var(--line-control)] text-[var(--text-3)]">
            ESC للإغلاق
          </span>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-[var(--line)]/40 divide-solid divide-opacity-30"
        >
          {filteredActions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-3)]">
              لم يتم العثور على إجراءات أو مساقات مطابقة لـ «{query}»
            </div>
          ) : (
            filteredActions.map((action, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={action.id}
                  onClick={() => executeSelected(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors select-none ${
                    isSelected
                      ? "bg-[var(--accent)] text-[var(--text-on-accent)] font-bold shadow-xs"
                      : "text-[var(--text)] hover:bg-[var(--sunken)]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-[var(--sunken)] text-[var(--text)]"
                      }`}
                    >
                      {action.icon}
                    </div>
                    <div className="truncate">
                      <div className="text-[13px] leading-tight truncate">
                        {action.title}
                      </div>
                      {action.subtitle && (
                        <div
                          className={`text-[11px] truncate mt-0.5 ${
                            isSelected
                              ? "text-white/80"
                              : "text-[var(--text-3)] font-normal"
                          }`}
                        >
                          {action.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {action.category === "theme" && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-[var(--sunken)] text-[var(--text-3)]"
                        }`}
                      >
                        مظهر
                      </span>
                    )}
                    <ArrowRight
                      size={13}
                      className={`transition-transform ${
                        isSelected
                          ? "translate-x-0.5 text-white"
                          : "text-transparent"
                      }`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2 border-t border-[var(--line)] bg-[var(--sunken)]/60 text-[11px] text-[var(--text-3)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>↑↓ للتنقل</span>
            <span>↵ للاختيار</span>
            <span>ESC للإلغاء</span>
          </div>
          <span className="font-mono text-[10px]">Command Palette 2.0</span>
        </div>
      </div>
    </div>
  );
};
