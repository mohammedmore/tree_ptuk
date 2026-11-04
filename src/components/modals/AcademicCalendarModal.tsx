import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Calendar,
  Clock,
  Sparkles,
  AlertCircle,
  GraduationCap,
  BookOpen,
  Coffee,
  RefreshCw,
  Search,
  CheckCircle2,
  CalendarDays,
  ExternalLink,
} from "lucide-react";
import {
  fetchAcademicCalendar,
  syncAcademicCalendar,
  AcademicCalendarResponse,
  CalendarEvent,
} from "../../services/calendarService";
import { getEnrichedAcademicCalendar } from "../../data/ptukAcademicCalendar";
import { getDefaultSemesterCode } from "../../services/registrationService";
import { cn } from "../../utils";

interface AcademicCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_MAP: Record<
  string,
  {
    label: string;
    badgeClass: string;
    icon: React.FC<{ size?: number; className?: string }>;
  }
> = {
  registration: {
    label: "تسجيل",
    badgeClass:
      "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    icon: GraduationCap,
  },
  add_drop: {
    label: "سحب وإضافة",
    badgeClass:
      "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    icon: CalendarDays,
  },
  withdrawal: {
    label: "سحب متأخر (W)",
    badgeClass:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    icon: AlertCircle,
  },
  exam_midterm: {
    label: "امتحانات نصفية",
    badgeClass:
      "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
    icon: BookOpen,
  },
  exam_final: {
    label: "امتحانات نهائية",
    badgeClass:
      "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
    icon: Sparkles,
  },
  holiday: {
    label: "عطلة رسمية",
    badgeClass:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    icon: Coffee,
  },
  results: {
    label: "نتائج الفصل",
    badgeClass:
      "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30",
    icon: CheckCircle2,
  },
  general: {
    label: "أكاديمي",
    badgeClass:
      "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
    icon: Clock,
  },
};

export const AcademicCalendarModal: React.FC<AcademicCalendarModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [data, setData] = useState<AcademicCalendarResponse>(() =>
    getEnrichedAcademicCalendar(),
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeSemesterId, setActiveSemesterId] = useState<string>(() => {
    const enriched = getEnrichedAcademicCalendar();
    return enriched.activeSemesterId || getDefaultSemesterCode();
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const fallbackAcademicYear = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    return m >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    fetchAcademicCalendar()
      .then((res) => {
        if (res && res.semesters?.length) {
          setData(res);
          if (res.activeSemesterId && !activeSemesterId) {
            setActiveSemesterId(res.activeSemesterId);
          }
        }
      })
      .catch((err) => {
        console.warn("Calendar background sync notice:", err?.message);
      });

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await syncAcademicCalendar();
      setData(res);
      if (res.activeSemesterId) {
        setActiveSemesterId(res.activeSemesterId);
      }
    } catch (err) {
      console.error("Refresh calendar error:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const currentSemester = useMemo(() => {
    if (!data?.semesters?.length) return null;
    return (
      data.semesters.find((s) => s.id === activeSemesterId) || data.semesters[0]
    );
  }, [data, activeSemesterId]);

  const filteredEvents = useMemo(() => {
    if (!currentSemester?.events) return [];
    return currentSemester.events.filter((ev) => {
      const matchesSearch =
        !searchQuery ||
        ev.activity.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ev.notes &&
          ev.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ev.day.includes(searchQuery) ||
        ev.week.includes(searchQuery);

      const matchesCat =
        selectedCategory === "all" ||
        ev.category === selectedCategory ||
        (selectedCategory === "exams" &&
          (ev.category === "exam_midterm" || ev.category === "exam_final"));

      return matchesSearch && matchesCat;
    });
  }, [currentSemester, searchQuery, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[var(--surface-overlay)] border border-[var(--line)] rounded-2xl shadow-2xl overflow-hidden text-[var(--text)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--line)] bg-[var(--surface)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Calendar size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">
                  التقويم الأكاديمي المعتمد
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {data?.academicYear || fallbackAcademicYear}
                </span>
                {data?.currentWeek && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 hidden sm:inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    {data.currentWeek}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-[var(--text-3)]">
                المواعيد والأنشطة الأكاديمية والامتحانات الرسمية لجامعة فلسطين
                التقنية - خضوري
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="تحديث البيانات من موقع الجامعة"
              className="p-2 rounded-xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] border border-transparent hover:border-[var(--line)] transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={cn(isRefreshing && "animate-spin text-indigo-500")}
              />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] border border-transparent hover:border-[var(--line)] transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Next Upcoming Milestone Hero (if available) */}
        {data?.nextUpcomingMilestone && (
          <div className="px-4 sm:px-5 py-3 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border-b border-[var(--line)] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
              <span className="text-[12.5px] font-bold text-indigo-700 dark:text-indigo-300">
                المحطة القادمة:
              </span>
              <span className="text-[12.5px] font-medium text-[var(--text)]">
                {data.nextUpcomingMilestone.activity}
              </span>
              <span className="text-[11px] text-[var(--text-3)]">
                ({data.nextUpcomingMilestone.day}{" "}
                {data.nextUpcomingMilestone.date})
              </span>
            </div>

            <div className="text-[11.5px] font-black px-2.5 py-1 rounded-lg bg-indigo-500 text-white shadow-sm">
              {data.nextUpcomingMilestone.daysRemaining === 0
                ? "اليوم!"
                : `بعد ${data.nextUpcomingMilestone.daysRemaining} يوم`}
            </div>
          </div>
        )}

        {/* Semester Navigation Tabs & Filters */}
        <div className="p-4 sm:p-5 pb-3 border-b border-[var(--line)] space-y-3 bg-[var(--surface)]">
          {/* Semester Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {data?.semesters?.map((sem) => {
              const isActive = sem.id === activeSemesterId;
              return (
                <button
                  key={sem.id}
                  onClick={() => setActiveSemesterId(sem.id)}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-[12.5px] font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-2",
                    isActive
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
                      : "bg-[var(--surface-overlay)] text-[var(--text-2)] border-[var(--line)] hover:border-indigo-500/40",
                  )}
                >
                  <span>{sem.termName}</span>
                  {sem.isCurrent && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-black",
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                      )}
                    >
                      الجاري
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search & Category Pills */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
              />
              <input
                type="text"
                placeholder="بحث في أنشطة ومواعيد الفصل..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8.5 pr-8 pl-3 text-[12.5px] bg-[var(--surface-overlay)] border border-[var(--line-control)] rounded-xl text-[var(--text)] outline-none focus:border-indigo-500 placeholder:text-[var(--text-3)]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: "all", label: "الكل" },
                { id: "registration", label: "التسجيل" },
                { id: "add_drop", label: "السحب والإضافة" },
                { id: "withdrawal", label: "السحب المتأخر (W)" },
                { id: "exams", label: "الامتحانات" },
                { id: "holiday", label: "العطل الرسمية" },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedCategory(filter.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11.5px] font-semibold whitespace-nowrap transition-all border cursor-pointer",
                    selectedCategory === filter.id
                      ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40 font-bold"
                      : "bg-[var(--surface-overlay)] text-[var(--text-3)] border-[var(--line)] hover:text-[var(--text)]",
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Events Table / Timeline List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw
                size={24}
                className="animate-spin text-indigo-500 mx-auto"
              />
              <p className="text-[13px] text-[var(--text-3)]">
                جاري سحب وتحديث بيانات التقويم الأكاديمي من خضوري...
              </p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-3)] space-y-2">
              <Calendar size={32} className="mx-auto opacity-40" />
              <p className="text-[13px]">
                لا توجد مواعيد تطابق البحث في هذا الفصل.
              </p>
            </div>
          ) : (
            <div className="border border-[var(--line)] rounded-xl overflow-hidden bg-[var(--surface)]">
              <table className="w-full text-[12.5px] text-right">
                <thead className="bg-[var(--surface-overlay)] text-[var(--text-3)] text-[11px] font-bold border-b border-[var(--line)]">
                  <tr>
                    <th className="py-2.5 px-3">الأسبوع</th>
                    <th className="py-2.5 px-3">اليوم والتاريخ</th>
                    <th className="py-2.5 px-3">النشاط الأكاديمي</th>
                    <th className="py-2.5 px-3 hidden sm:table-cell">
                      ملاحظات
                    </th>
                    <th className="py-2.5 px-3 text-center">النوع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {filteredEvents.map((event, idx) => {
                    const catMeta =
                      CATEGORY_MAP[event.category] || CATEGORY_MAP.general;
                    const IconComponent = catMeta.icon;

                    return (
                      <tr
                        key={`${event.date}-${idx}`}
                        className={cn(
                          "transition-colors hover:bg-[var(--surface-hover)]",
                          event.isToday && "bg-indigo-500/10 font-bold",
                        )}
                      >
                        <td className="py-2.5 px-3 font-semibold text-[var(--text-2)] whitespace-nowrap">
                          {event.week ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--surface-overlay)] border border-[var(--line)]">
                              {event.week}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-bold">
                            <span>{event.day}</span>
                            <span className="text-[11.5px] font-mono text-[var(--text-3)]">
                              {event.date}
                            </span>
                            {event.isToday && (
                              <span className="text-[9.5px] px-1 py-0.5 rounded bg-emerald-500 text-white font-black">
                                اليوم
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <IconComponent
                              size={14}
                              className={cn(
                                "shrink-0",
                                event.category.includes("exam")
                                  ? "text-purple-500"
                                  : event.category === "holiday"
                                    ? "text-emerald-500"
                                    : "text-indigo-500",
                              )}
                            />
                            <span
                              className={cn(
                                "text-[12.5px]",
                                event.activity
                                  ? "font-bold text-[var(--text)]"
                                  : "text-[var(--text-3)]",
                              )}
                            >
                              {event.activity || "تدريس اعتيادي"}
                            </span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-[var(--text-3)] text-[11.5px] hidden sm:table-cell">
                          {event.notes || "-"}
                        </td>

                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={cn(
                              "text-[10.5px] px-2 py-0.5 rounded-md font-bold border",
                              catMeta.badgeClass,
                            )}
                          >
                            {catMeta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 px-5 bg-[var(--surface)] border-t border-[var(--line)] flex items-center justify-between text-[11.5px] text-[var(--text-3)]">
          <div className="flex items-center gap-2">
            <span>مصدر البيانات:</span>
            <a
              href="https://ptuk.edu.ps/ar/academic-calendar.php"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold"
            >
              <span>التقويم الأكاديمي لجامعة خضوري</span>
              <ExternalLink size={11} />
            </a>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[var(--surface-overlay)] hover:bg-[var(--surface-hover)] border border-[var(--line)] text-[var(--text)] font-bold text-[12px] cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
