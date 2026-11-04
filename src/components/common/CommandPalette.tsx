import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Calendar,
  BookOpen,
  Zap,
  Calculator,
  Sun,
  Moon,
  ArrowRight,
  X,
} from "lucide-react";
import type { Course } from "../../data";
import { cn } from "../../utils";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  onNavigate: (route: string) => void;
  onToggleTheme: () => void;
  isDarkMode: boolean;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  courses,
  onNavigate,
  onToggleTheme,
  isDarkMode,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const defaultActions = useMemo(
    () => [
      {
        id: "nav-plan",
        title: "الخطة الشجرية (مخطط المواد)",
        icon: BookOpen,
        action: () => {
          onNavigate("#/plan");
          onClose();
        },
      },
      {
        id: "nav-weekly",
        title: "الجدول الأسبوعي الدراسي",
        icon: Calendar,
        action: () => {
          onNavigate("#/schedule");
          onClose();
        },
      },
      {
        id: "nav-registration",
        title: "بوابة التسجيل السريع والمحاكاة",
        icon: Zap,
        action: () => {
          onNavigate("#/registration");
          onClose();
        },
      },
      {
        id: "nav-gpa",
        title: "حاسبة المعدل التراكمي",
        icon: Calculator,
        action: () => {
          onNavigate("#/gpa");
          onClose();
        },
      },
      {
        id: "theme",
        title: isDarkMode
          ? "التبديل إلى الوضع الفاتح"
          : "التبديل إلى الوضع الداكن",
        icon: isDarkMode ? Sun : Moon,
        action: () => {
          onToggleTheme();
          onClose();
        },
      },
    ],
    [isDarkMode, onNavigate, onToggleTheme, onClose],
  );

  const filteredCourses = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return courses
      .filter((c) => c.name.toLowerCase().includes(q) || c.id.includes(q))
      .slice(0, 8);
  }, [courses, query]);

  const combinedItems = useMemo(() => {
    if (!query.trim()) return defaultActions;
    return [
      ...filteredCourses.map((c) => ({
        id: `course-${c.id}`,
        title: `${c.id} - ${c.name} (${c.credits} ساعات)`,
        icon: BookOpen,
        action: () => {
          onNavigate(`#/courses?code=${c.id}`);
          onClose();
        },
      })),
      ...defaultActions.filter((a) =>
        a.title.toLowerCase().includes(query.toLowerCase()),
      ),
    ];
  }, [query, defaultActions, filteredCourses, onNavigate, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          // open command palette
          if (isOpen) onClose();
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev + 1) % Math.max(1, combinedItems.length),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (prev) =>
            (prev - 1 + combinedItems.length) %
            Math.max(1, combinedItems.length),
        );
      } else if (e.key === "Enter" && combinedItems[selectedIndex]) {
        e.preventDefault();
        combinedItems[selectedIndex].action();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, combinedItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="شريط الأوامر السريعة"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        dir="rtl"
        className="w-full max-w-xl bg-[var(--surface)] border border-[var(--line-control)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--line)]">
          <Search size={18} className="text-[var(--text-3)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="ابحث عن مساق، أو اكتب أمراً للتنقل السريع..."
            className="flex-1 bg-transparent text-[var(--text)] text-[14px] outline-none placeholder:text-[var(--text-3)]"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-3)] bg-[var(--sunken)] border border-[var(--line)] rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-[320px] overflow-y-auto p-2 space-y-1">
          {combinedItems.length === 0 ? (
            <div className="py-8 text-center text-[var(--text-3)] text-[13px]">
              لا توجد نتائج مطابقة لبحثك
            </div>
          ) : (
            combinedItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-right text-[13px] transition-colors",
                    isSelected
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--text)] hover:bg-[var(--sunken)]",
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      size={16}
                      className={
                        isSelected ? "text-white" : "text-[var(--text-3)]"
                      }
                    />
                    <span className="truncate">{item.title}</span>
                  </div>
                  <ArrowRight
                    size={14}
                    className={cn(
                      "opacity-0 transition-opacity",
                      isSelected && "opacity-100",
                    )}
                  />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
