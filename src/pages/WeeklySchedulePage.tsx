import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Printer,
  Share2,
  X,
  AlertTriangle,
  Sparkles,
  Calendar,
  Image as ImageIcon,
  Plus,
  Copy,
  Edit2,
  Trash2,
  Check,
  Bookmark,
  User,
  Download,
  ChevronDown,
  GraduationCap,
  Layers,
} from "lucide-react";
import type { Course, ScheduleEntry } from "../data";
import { SEMESTERS } from "../constants";
import { cn } from "../utils";
import {
  exportScheduleToICal,
  downloadScheduleImage,
} from "../services/icalExport";
import {
  getSemesterDrafts,
  saveSemesterDrafts,
  createSemesterDraft,
  duplicateSemesterDraft,
  renameSemesterDraft,
  deleteSemesterDraft,
  getActiveDraftId,
  setActiveDraftId,
  updateDraftSchedule,
  type ScheduleDraft,
} from "../core/scheduleDrafts";
import { triggerHaptic } from "../utils/haptics";
import { DoctorScheduleModal } from "../components/modals";
import { fetchCourses } from "../services/courseService";
import {
  normalizeDayKey,
  type CatalogCourse,
} from "../services/scheduleSolver";

interface WeeklySchedulePageProps {
  plannedCourses: Record<string, string>;
  courses: Course[];
  weeklySchedule: Record<string, Record<string, ScheduleEntry>>;
  setWeeklySchedule: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, ScheduleEntry>>>
  >;
  onShareSchedule?: () => void;
  syncTimeText?: string;
  onOpenScheduleSolver?: () => void;
  completedCourses?: Set<string>;
}

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "السبت"];
const DAY_KEYS = ["أح", "اث", "ثلا", "ار", "خمـ", "سب"];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

// 6 calm session color tokens (Section 3.2)
const SESSION_COLORS = [
  { bg: "bg-[var(--c1-bg)]", bar: "bg-[var(--c1-bar)]" },
  { bg: "bg-[var(--c2-bg)]", bar: "bg-[var(--c2-bar)]" },
  { bg: "bg-[var(--c3-bg)]", bar: "bg-[var(--c3-bar)]" },
  { bg: "bg-[var(--c4-bg)]", bar: "bg-[var(--c4-bar)]" },
  { bg: "bg-[var(--c5-bg)]", bar: "bg-[var(--c5-bar)]" },
  { bg: "bg-[var(--c6-bg)]", bar: "bg-[var(--c6-bar)]" },
];

export const WeeklySchedulePage: React.FC<WeeklySchedulePageProps> = ({
  plannedCourses,
  courses,
  weeklySchedule,
  setWeeklySchedule,
  onShareSchedule,
  syncTimeText = "منذ قليل",
  onOpenScheduleSolver,
  completedCourses,
}) => {
  const [selectedSemester, setSelectedSemester] = useState<string>(() => {
    return (
      SEMESTERS.find((s) => Object.values(plannedCourses).includes(s)) ||
      SEMESTERS[0]
    );
  });

  // Feature 6: Schedule Drafts (A / B / C) State
  const [drafts, setDrafts] = useState<ScheduleDraft[]>(() =>
    getSemesterDrafts(selectedSemester, weeklySchedule[selectedSemester]),
  );
  const [activeDraftId, setActiveDraftIdState] = useState<string>(() => {
    return (
      getActiveDraftId(selectedSemester) || drafts[0]?.id || "draft-primary"
    );
  });
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editDraftName, setEditDraftName] = useState<string>("");

  // Feature 1: Doctor Schedule Modal State
  const [doctorScheduleName, setDoctorScheduleName] = useState<string | null>(
    null,
  );
  const [catalogCoursesMap, setCatalogCoursesMap] = useState<
    Record<string, CatalogCourse>
  >({});

  // Consolidated Export Menu State (Item 84)
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setIsExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Point 35: Mobile Agenda View State
  const [mobileDayIdx, setMobileDayIdx] = useState<number>(() => {
    const today = new Date().getDay();
    const dayMap: Record<number, number> = {
      0: 0,
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      6: 5,
    };
    return dayMap[today] ?? 0;
  });

  useEffect(() => {
    let cancelled = false;
    fetchCourses().then((courses) => {
      if (cancelled) return;
      const map: Record<string, CatalogCourse> = {};
      for (const c of courses) {
        if (c && c.id) map[c.id] = c;
      }
      setCatalogCoursesMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live Current Lecture Tracker (Item 13)
  const [currentDayIdx, setCurrentDayIdx] = useState<number>(-1);
  const [currentMinutesFrom8, setCurrentMinutesFrom8] = useState<number>(-1);

  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      const jsDay = now.getDay();
      const dayMap: Record<number, number> = {
        0: 0, // الأحد
        1: 1, // الاثنين
        2: 2, // الثلاثاء
        3: 3, // الأربعاء
        4: 4, // الخميس
        6: 5, // السبت
      };
      const dIdx = dayMap[jsDay] !== undefined ? dayMap[jsDay] : -1;
      setCurrentDayIdx(dIdx);
      const hours = now.getHours();
      const minutes =
        hours >= 8 && hours <= 18 ? (hours - 8) * 60 + now.getMinutes() : -1;
      setCurrentMinutesFrom8(minutes);
    };

    updateCurrentTime();
    const interval = setInterval(updateCurrentTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Sync drafts when changing semester
  useEffect(() => {
    const loaded = getSemesterDrafts(
      selectedSemester,
      weeklySchedule[selectedSemester],
    );
    setDrafts(loaded);
    const currentActive =
      getActiveDraftId(selectedSemester) || loaded[0]?.id || "draft-primary";
    setActiveDraftIdState(currentActive);
  }, [selectedSemester]);

  const [selectedEntryDetails, setSelectedEntryDetails] = useState<{
    courseName: string;
    courseId: string;
    entry: ScheduleEntry;
  } | null>(null);

  const coursesById = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses],
  );

  // Courses planned for this semester
  const semesterPlannedCourses = useMemo(() => {
    return Object.entries(plannedCourses)
      .filter(([, s]) => s === selectedSemester)
      .map(([id]) => id);
  }, [plannedCourses, selectedSemester]);

  // Color mapping: courseId -> session color index (0 to 5)
  const courseColorIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    semesterPlannedCourses.forEach((id, idx) => {
      map.set(id, SESSION_COLORS.length > 0 ? idx % SESSION_COLORS.length : 0);
    });
    return map;
  }, [semesterPlannedCourses]);

  // Active semester schedule entries
  const currentSchedule = useMemo(() => {
    return weeklySchedule[selectedSemester] || {};
  }, [weeklySchedule, selectedSemester]);

  // Helper to parse time strings like "08:00" to minutes from 8:00 (supporting 12h/24h & Arabic digits)
  const parseTimeToRow = (timeStr: string): number => {
    if (!timeStr) return 0;
    const clean = timeStr.replace(/[٠-٩]/g, (d) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(d)),
    );
    let [h, m] = clean.split(":").map(Number);
    if (isNaN(h)) return 0;
    if (h >= 1 && h <= 6) {
      h += 12; // Convert 12-hour PM times (1 PM - 6 PM) to 24-hour (13:00 - 18:00)
    }
    return h - 8 + (m || 0) / 60;
  };

  // Check conflicts across scheduled items on the same day and overlapping time
  const scheduledList = useMemo(() => {
    const items: Array<{
      key: string;
      courseId: string;
      courseName: string;
      entry: ScheduleEntry;
      dayIndex: number;
      startRow: number;
      durationRows: number;
      isConflict?: boolean;
    }> = [];

    Object.entries(currentSchedule).forEach(([courseId, entry]) => {
      const c = coursesById.get(courseId);
      const name = c ? c.name : courseId;
      const days = entry.days || (entry.day ? [entry.day] : []);

      days.forEach((dayName) => {
        const canonicalKey = normalizeDayKey(dayName);
        let dayIdx = canonicalKey ? DAY_KEYS.indexOf(canonicalKey) : -1;
        if (dayIdx === -1) {
          dayIdx = DAYS.indexOf(dayName);
        }
        if (dayIdx !== -1) {
          const startR = parseTimeToRow(entry.startTime);
          const endR = parseTimeToRow(entry.endTime);
          const dur = Math.max(0.5, endR - startR);

          items.push({
            key: `${courseId}-${dayName}`,
            courseId,
            courseName: name,
            entry,
            dayIndex: dayIdx,
            startRow: startR,
            durationRows: dur,
          });
        }
      });
    });

    // Detect conflicts (Online lectures never produce physical classroom conflicts)
    const isItemOnline = (entry: ScheduleEntry) => {
      const room = (entry.room || entry.location || "").trim();
      return Boolean(
        entry.isOnline === true ||
        /^\d{4,5}$/.test(room) ||
        room.includes("5000") ||
        room.includes("10000") ||
        room.includes("الكتروني") ||
        room.includes("online") ||
        room.includes("عن بعد") ||
        room.includes("moodle"),
      );
    };

    for (let i = 0; i < items.length; i++) {
      if (isItemOnline(items[i].entry)) continue;
      for (let j = i + 1; j < items.length; j++) {
        if (isItemOnline(items[j].entry)) continue;
        if (items[i].dayIndex === items[j].dayIndex) {
          const iStart = items[i].startRow;
          const iEnd = items[i].startRow + items[i].durationRows;
          const jStart = items[j].startRow;
          const jEnd = items[j].startRow + items[j].durationRows;

          if (Math.max(iStart, jStart) < Math.min(iEnd, jEnd)) {
            items[i].isConflict = true;
            items[j].isConflict = true;
          }
        }
      }
    }

    return items;
  }, [currentSchedule, coursesById]);

  // Online / Asynchronous or TBA courses (Pillar 2 & 7)
  const unscheduledOrOnlineList = useMemo(() => {
    const list: Array<{
      courseId: string;
      courseName: string;
      entry: ScheduleEntry;
      isOnline: boolean;
    }> = [];
    Object.entries(currentSchedule).forEach(([courseId, entry]) => {
      const days = entry.days || (entry.day ? [entry.day] : []);
      const isVirtualRoom = Boolean(
        (entry.room && /^\d{4,5}$/.test(entry.room.trim())) ||
        (entry.location && /^\d{4,5}$/.test(entry.location.trim())) ||
        entry.room?.includes("5000") ||
        entry.room?.includes("10000"),
      );
      const isExplicitOnline = Boolean(
        entry.isOnline === true ||
        entry.room?.includes("الكتروني") ||
        entry.location?.includes("الكتروني") ||
        entry.room?.includes("online") ||
        entry.location?.includes("online") ||
        entry.room?.includes("عن بعد") ||
        entry.location?.includes("عن بعد") ||
        entry.room?.includes("moodle") ||
        entry.location?.includes("moodle"),
      );
      const isOnline = isVirtualRoom || isExplicitOnline;

      if (days.length === 0 || isOnline) {
        list.push({
          courseId,
          courseName: coursesById.get(courseId)?.name || courseId,
          entry,
          isOnline,
        });
      }
    });
    return list;
  }, [currentSchedule, coursesById]);

  // Weekly gap hours calculation (waiting time between lectures - Item 42)
  const gapStats = useMemo(() => {
    let totalGaps = 0;
    const dayGroups: Record<number, Array<{ start: number; end: number }>> = {};
    scheduledList.forEach((item) => {
      if (!dayGroups[item.dayIndex]) dayGroups[item.dayIndex] = [];
      dayGroups[item.dayIndex].push({
        start: item.startRow,
        end: item.startRow + item.durationRows,
      });
    });

    Object.values(dayGroups).forEach((blocks) => {
      if (blocks.length <= 1) return;
      blocks.sort((a, b) => a.start - b.start);
      for (let i = 0; i < blocks.length - 1; i++) {
        const gap = blocks[i + 1].start - blocks[i].end;
        if (gap > 0) totalGaps += gap;
      }
    });

    const rounded = Math.round(totalGaps * 10) / 10;
    const rating =
      rounded === 0
        ? "جدول متراص ممتاز"
        : rounded <= 3
          ? "جدول متوازن"
          : "فترات انتظار طويلة";
    return { totalGaps: rounded, rating };
  }, [scheduledList]);

  const [isExportingPng, setIsExportingPng] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleExportICal = () => {
    exportScheduleToICal(currentSchedule, selectedSemester, coursesById);
  };

  const handleExportPng = async () => {
    try {
      setIsExportingPng(true);
      await downloadScheduleImage(
        "weekly-schedule-grid-container",
        `جدول_${selectedSemester.replace(/\s+/g, "_")}.png`,
      );
    } catch (err) {
      console.error("Export PNG error:", err);
    } finally {
      setIsExportingPng(false);
    }
  };

  // Sync schedule changes into current active draft
  useEffect(() => {
    if (activeDraftId && currentSchedule) {
      updateDraftSchedule(selectedSemester, activeDraftId, currentSchedule);
      setDrafts(getSemesterDrafts(selectedSemester));
    }
  }, [currentSchedule, activeDraftId, selectedSemester]);

  // Draft operations
  const handleSelectDraft = (draftId: string) => {
    if (draftId === activeDraftId) return;
    updateDraftSchedule(selectedSemester, activeDraftId, currentSchedule);
    const target = drafts.find((d) => d.id === draftId);
    if (!target) return;
    setActiveDraftId(selectedSemester, draftId);
    setActiveDraftIdState(draftId);
    setWeeklySchedule((prev) => ({
      ...prev,
      [selectedSemester]: target.schedule || {},
    }));
  };

  const handleCreateNewDraft = () => {
    updateDraftSchedule(selectedSemester, activeDraftId, currentSchedule);
    const newDraft = createSemesterDraft(
      selectedSemester,
      `مسودة ${drafts.length + 1}`,
      {},
    );
    const updated = getSemesterDrafts(selectedSemester);
    setDrafts(updated);
    setActiveDraftIdState(newDraft.id);
    setWeeklySchedule((prev) => ({
      ...prev,
      [selectedSemester]: {},
    }));
  };

  const handleDuplicateDraft = (draftId: string) => {
    updateDraftSchedule(selectedSemester, activeDraftId, currentSchedule);
    const duplicate = duplicateSemesterDraft(selectedSemester, draftId);
    if (!duplicate) return;
    const updated = getSemesterDrafts(selectedSemester);
    setDrafts(updated);
    setActiveDraftIdState(duplicate.id);
    setWeeklySchedule((prev) => ({
      ...prev,
      [selectedSemester]: duplicate.schedule || {},
    }));
  };

  const handleDeleteDraft = (draftId: string) => {
    const { updatedDrafts, newActiveId } = deleteSemesterDraft(
      selectedSemester,
      draftId,
    );
    setDrafts(updatedDrafts);
    setActiveDraftIdState(newActiveId);
    const nextActive = updatedDrafts.find((d) => d.id === newActiveId);
    setWeeklySchedule((prev) => ({
      ...prev,
      [selectedSemester]: nextActive?.schedule || {},
    }));
  };

  const handleSaveDraftRename = (draftId: string) => {
    if (editDraftName.trim()) {
      const updated = renameSemesterDraft(
        selectedSemester,
        draftId,
        editDraftName,
      );
      setDrafts(updated);
    }
    setEditingDraftId(null);
  };

  return (
    <div
      dir="rtl"
      className="w-full min-h-[calc(100dvh-var(--topbar-h))] bg-[var(--bg)] flex flex-col text-[var(--text)]"
    >
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 border-b border-[var(--line)] bg-[var(--bg)] shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-semibold text-[var(--text)] font-['Noto_Naskh_Arabic',serif] leading-tight">
              الجدول الأسبوعي
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-[12.5px] text-[var(--text-3)]">
                آخر تحديث للشعب: {syncTimeText}
              </span>
              {scheduledList.length > 0 && (
                <>
                  <span className="text-[12px] text-[var(--text-3)]">•</span>
                  <span className="text-[11.5px] px-2 py-0.5 rounded-full bg-[var(--sunken)] text-[var(--text-2)] border border-[var(--line)]">
                    {scheduledList.length} أوقات محاضرات
                  </span>
                  <span
                    className={cn(
                      "text-[11.5px] px-2 py-0.5 rounded-full border font-medium",
                      gapStats.totalGaps === 0
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : gapStats.totalGaps <= 3
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                    )}
                  >
                    أوقات الفراغ: {gapStats.totalGaps} س • {gapStats.rating}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Semester selector */}
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="h-[var(--control-h)] px-3 text-[13px] bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-pointer"
            >
              {SEMESTERS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {/* Smart Schedule Solver Button */}
            {onOpenScheduleSolver && (
              <button
                type="button"
                id="smart-schedule-solver-btn"
                onClick={onOpenScheduleSolver}
                className="min-h-[var(--control-h)] px-3 text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] border border-[var(--accent)] rounded-[var(--r-control)] transition-colors cursor-pointer flex items-center gap-1.5"
                title="توليد وحل الجداول واختيار الشعب المفضلة"
              >
                <Sparkles size={14} />
                <span>إنشاء جدول</span>
              </button>
            )}

            {/* Consolidated Export Menu (Item 84: 3 buttons consolidated into 1 clean popover) */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                id="export-menu-btn"
                onClick={() => {
                  triggerHaptic("selection");
                  setIsExportMenuOpen((prev) => !prev);
                }}
                disabled={scheduledList.length === 0}
                className="min-h-[var(--control-h)] px-3 text-[13px] font-medium text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--line-control)] rounded-[var(--r-control)] bg-[var(--surface)] hover:bg-[var(--sunken)] transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title="خيارات تصدير الجدول (صورة، تقويم، طباعة)"
              >
                <Download size={14} />
                <span>تصدير الجدول</span>
                <ChevronDown
                  size={13}
                  className={cn(
                    "transition-transform duration-150",
                    isExportMenuOpen && "rotate-180",
                  )}
                />
              </button>

              {isExportMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-52 bg-[var(--surface)] border border-[var(--line-control)] rounded-xl shadow-lg z-50 py-1 divide-y divide-[var(--line)] animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-1 space-y-0.5">
                    <button
                      type="button"
                      id="export-png-btn"
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        handleExportPng();
                      }}
                      disabled={isExportingPng}
                      className="w-full h-8 px-2.5 text-right text-[12px] text-[var(--text)] hover:bg-[var(--sunken)] rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span>حفظ كصورة (PNG)</span>
                      <ImageIcon size={14} className="text-[var(--text-3)]" />
                    </button>

                    <button
                      type="button"
                      id="export-ical-btn"
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        handleExportICal();
                      }}
                      className="w-full h-8 px-2.5 text-right text-[12px] text-[var(--text)] hover:bg-[var(--sunken)] rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span>تقويم الهاتف (.ics)</span>
                      <Calendar size={14} className="text-[var(--text-3)]" />
                    </button>

                    <button
                      type="button"
                      id="export-print-btn"
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        handlePrint();
                      }}
                      className="w-full h-8 px-2.5 text-right text-[12px] text-[var(--text)] hover:bg-[var(--sunken)] rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span>طباعة الجدول / PDF</span>
                      <Printer size={14} className="text-[var(--text-3)]" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Share action */}
            {onShareSchedule && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  onShareSchedule();
                }}
                disabled={scheduledList.length === 0}
                className="min-h-[var(--control-h)] px-3 text-[13px] font-medium text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--line-control)] rounded-[var(--r-control)] bg-[var(--surface)] hover:bg-[var(--sunken)] transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title="مشاركة الجدول مع زملائك برمز سحابي أو QR"
              >
                <Share2 size={14} />
                <span>مشاركة</span>
              </button>
            )}
          </div>
        </div>

        {/* Feature 6: Drafts Toolbar Row (مسودات الجداول A / B / C) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--line)] mt-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold text-[var(--text-3)] flex items-center gap-1.5 shrink-0 ml-1">
              <Bookmark size={13} className="text-amber-500" />
              <span>مسودات الجدول:</span>
            </span>

            {drafts.map((d) => {
              const isActive = d.id === activeDraftId;
              const isEditing = editingDraftId === d.id;

              return (
                <div
                  key={d.id}
                  className={cn(
                    "h-8 px-2.5 rounded-lg border text-xs flex items-center gap-1.5 transition-all shrink-0",
                    isActive
                      ? "bg-[var(--accent)] text-[var(--text-on-accent)] border-[var(--accent)] font-bold shadow-2xs"
                      : "bg-[var(--surface)] border-[var(--line-control)] text-[var(--text-2)] hover:text-[var(--text)]",
                  )}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editDraftName}
                      onChange={(e) => setEditDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveDraftRename(d.id);
                        if (e.key === "Escape") setEditingDraftId(null);
                      }}
                      onBlur={() => handleSaveDraftRename(d.id)}
                      className="w-24 h-6 px-1.5 rounded text-xs text-black bg-white outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectDraft(d.id)}
                      className="flex items-center gap-1.5 cursor-pointer"
                      title="التبديل إلى هذه المسودة"
                    >
                      <span>{d.name}</span>
                      {isActive && <Check size={12} strokeWidth={3} />}
                    </button>
                  )}

                  <div className="flex items-center gap-0.5 border-r border-current/20 pr-1 mr-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic("selection");
                        setEditingDraftId(d.id);
                        setEditDraftName(d.name);
                      }}
                      className="w-6 h-6 flex items-center justify-center hover:bg-black/10 rounded cursor-pointer opacity-75 hover:opacity-100 active:scale-90"
                      title="إعادة تسمية المسودة"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic("selection");
                        handleDuplicateDraft(d.id);
                      }}
                      className="w-6 h-6 flex items-center justify-center hover:bg-black/10 rounded cursor-pointer opacity-75 hover:opacity-100 active:scale-90"
                      title="نسخ هذه المسودة"
                    >
                      <Copy size={11} />
                    </button>
                    {drafts.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic("warning");
                          handleDeleteDraft(d.id);
                        }}
                        className="w-6 h-6 flex items-center justify-center hover:bg-rose-500/20 text-rose-500 rounded cursor-pointer opacity-75 hover:opacity-100 active:scale-90"
                        title="حذف هذه المسودة"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* New Draft Button */}
            <button
              type="button"
              onClick={handleCreateNewDraft}
              className="h-8 px-2.5 rounded-lg border border-dashed border-[var(--line-control)] bg-[var(--surface)] hover:bg-[var(--sunken)] text-[var(--text-2)] hover:text-[var(--text)] font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              title="إنشاء مسودة جدول جديدة لهذا الفصل"
            >
              <Plus size={13} className="text-[var(--accent)]" />
              <span>مسودة جديدة</span>
            </button>
          </div>

          <span className="text-[11px] text-[var(--text-3)] hidden md:inline">
            يمكنك حفظ عدة جداول بديلة (A / B / C) والتبديل بينها بنقرة واحدة
          </span>
        </div>
      </header>

      {/* Mobile Day Agenda View (Point 35: Responsive Day-by-Day View) */}
      <div className="block md:hidden p-4 space-y-4">
        {/* Day Switcher Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {DAYS.map((dayName, idx) => {
            const dayLectureCount = scheduledList.filter(
              (item) => item.dayIndex === idx,
            ).length;
            const isSelected = mobileDayIdx === idx;
            return (
              <button
                key={dayName}
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setMobileDayIdx(idx);
                }}
                className={cn(
                  "flex-1 min-w-[58px] py-2 px-1 rounded-xl text-center font-medium transition-all cursor-pointer border text-xs flex flex-col items-center gap-0.5 active:scale-95 select-none",
                  isSelected
                    ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs"
                    : "bg-[var(--surface)] text-[var(--text-2)] border-[var(--line)] hover:bg-[var(--sunken)]",
                )}
              >
                <span>{dayName}</span>
                <span
                  className={cn(
                    "text-[10px] opacity-80",
                    isSelected ? "text-white" : "text-[var(--text-3)]",
                  )}
                >
                  {dayLectureCount > 0 ? `${dayLectureCount} مواد` : "عطلة"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Day's Lecture Timeline Cards */}
        {(() => {
          const dayLectures = scheduledList
            .filter((item) => item.dayIndex === mobileDayIdx)
            .sort((a, b) => a.startRow - b.startRow);

          if (dayLectures.length === 0) {
            return (
              <div className="py-12 px-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] text-center space-y-2">
                <Calendar
                  size={28}
                  className="mx-auto text-[var(--text-3)] opacity-60"
                />
                <h3 className="text-sm font-semibold text-[var(--text)]">
                  يوم دراسي خالٍ من المحاضرات
                </h3>
                <p className="text-xs text-[var(--text-3)] max-w-xs mx-auto">
                  لا توجد محاضرات مجدولة ليوم {DAYS[mobileDayIdx]} في هذه
                  المسودة.
                </p>
              </div>
            );
          }

          return (
            <div className="space-y-2.5">
              {dayLectures.map((item) => {
                const colorIdx = courseColorIndexMap.get(item.courseId) ?? 0;
                const palette = SESSION_COLORS[colorIdx];
                return (
                  <div
                    key={item.key}
                    onClick={() =>
                      setSelectedEntryDetails({
                        courseId: item.courseId,
                        courseName: item.courseName,
                        entry: item.entry,
                      })
                    }
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 shadow-2xs",
                      palette.bg,
                      item.isConflict
                        ? "border-rose-500 ring-2 ring-rose-500/30"
                        : "border-[var(--line)]",
                    )}
                  >
                    <div className="space-y-1 truncate">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[var(--text)] truncate">
                          {item.courseName}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--line)] text-[var(--text-3)]">
                          شعبة {item.entry.section || (item.entry as any).sec}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-2)]">
                        <span className="font-mono">
                          {item.entry.startTime
                            ? `${item.entry.startTime} - ${item.entry.endTime}`
                            : (item.entry as any).time}
                        </span>
                        {item.entry.room && (
                          <span>• قاعة {item.entry.room}</span>
                        )}
                      </div>
                      {item.entry.instructor && (
                        <div className="text-[11px] text-[var(--text-3)] truncate">
                          المدرس: {item.entry.instructor}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Main Grid View (Desktop & Tablet) */}
      <div className="hidden md:flex flex-1 p-4 sm:p-6 overflow-x-auto">
        <div
          id="weekly-schedule-grid-container"
          className="min-w-[750px] border border-[var(--line)] bg-[var(--surface)] rounded-[var(--r-surface)] overflow-hidden shadow-xs"
        >
          {/* Header Row: Days of Week */}
          <div className="grid grid-cols-7 border-b border-[var(--line)] bg-[var(--sunken)]">
            <div className="py-2.5 px-3 text-center text-[12px] text-[var(--text-3)] border-l border-[var(--line)] font-medium">
              الوقت
            </div>
            {DAYS.map((day) => (
              <div
                key={day}
                className="py-2.5 px-3 text-center text-[13px] font-semibold text-[var(--text-2)] border-l last:border-l-0 border-[var(--line)]"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Time Rows */}
          <div className="relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-7 h-20 border-b last:border-b-0 border-[var(--line)]"
              >
                {/* Time label */}
                <div
                  dir="ltr"
                  className="py-1 px-2 text-center text-[12px] text-[var(--text-3)] tabular-nums border-l border-[var(--line)] bg-[var(--sunken)] flex items-start justify-center font-mono"
                >
                  {String(hour).padStart(2, "0")}:00
                </div>

                {/* Day columns */}
                {DAYS.map((_, dayIdx) => (
                  <div
                    key={dayIdx}
                    className="border-l last:border-l-0 border-[var(--line)] relative"
                  />
                ))}
              </div>
            ))}

            {/* Lecture Cards Overlay (Showing: Room, Time, Instructor, Course ID, Section #) */}
            {scheduledList.map((item) => {
              const colIdx = item.dayIndex;
              // 80px per hour
              const topPx = item.startRow * 80;
              const heightPx = item.durationRows * 80;
              const colorIdx = courseColorIndexMap.get(item.courseId) ?? 0;
              const palette = SESSION_COLORS[colorIdx];

              const isConflict = item.isConflict;
              const isLive =
                currentDayIdx === item.dayIndex &&
                currentMinutesFrom8 >= item.startRow * 60 &&
                currentMinutesFrom8 <= (item.startRow + item.durationRows) * 60;

              return (
                <div
                  key={item.key}
                  onClick={() =>
                    setSelectedEntryDetails({
                      courseName: item.courseName,
                      courseId: item.courseId,
                      entry: item.entry,
                    })
                  }
                  style={{
                    position: "absolute",
                    top: `${topPx + 2}px`,
                    height: `${heightPx - 4}px`,
                    right: `calc((100% / 7) * ${colIdx + 1})`,
                    width: `calc(100% / 7 - 4px)`,
                  }}
                  className={cn(
                    "p-1.5 select-none cursor-pointer rounded-[var(--r-control)] overflow-hidden transition-all duration-[var(--dur-2)]",
                    isConflict
                      ? "border border-dashed border-[var(--warn)] bg-[var(--warn-soft)]"
                      : isLive
                        ? cn(
                            "border-2 border-emerald-500 ring-2 ring-emerald-500/30",
                            palette.bg,
                            "shadow-md",
                          )
                        : cn(
                            "border border-[var(--line-control)]/40",
                            palette.bg,
                            "hover:brightness-95 dark:hover:brightness-110 shadow-xs",
                          ),
                  )}
                  title={`${item.courseName} (${item.courseId}) - شعبة ${item.entry.section || "—"}${isLive ? " (المحاضرة جارية الآن)" : ""}`}
                >
                  {/* Leading accent bar */}
                  {!isConflict && (
                    <div
                      className={cn(
                        "absolute right-0 top-0 bottom-0 w-[3px]",
                        isLive ? "bg-emerald-500" : palette.bar,
                      )}
                    />
                  )}

                  <div className="pr-1.5 h-full flex flex-col justify-between overflow-hidden text-right leading-tight">
                    <div className="space-y-0.5">
                      {/* Course Name & Conflict / Live indicator */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 overflow-hidden">
                          {isConflict && (
                            <AlertTriangle
                              size={12}
                              className="text-[var(--warn)] shrink-0"
                            />
                          )}
                          <span className="text-[12px] font-bold text-[var(--text)] line-clamp-1">
                            {item.courseName}
                          </span>
                        </div>
                        {isLive && (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-600 text-white animate-pulse">
                            جارية الآن
                          </span>
                        )}
                      </div>

                      {/* Course ID and Section # */}
                      <div className="flex items-center gap-1.5 text-[10.5px] text-[var(--text-2)] tabular-nums flex-wrap">
                        <span className="font-mono bg-[var(--surface)] px-1 py-0.2 rounded text-[10px] border border-[var(--line-control)] text-[var(--text-3)] font-semibold">
                          {item.courseId}
                        </span>
                        <span className="font-medium text-[var(--text)]">
                          {item.entry.section
                            ? `شعبة ${item.entry.section}`
                            : "—"}
                        </span>
                      </div>

                      {/* Instructor / الدكتور */}
                      <div className="text-[10.5px] text-[var(--text-2)] truncate">
                        <span className="text-[var(--text-3)] font-normal">
                          د.{" "}
                        </span>
                        <span>{item.entry.instructor || "غير محدد"}</span>
                      </div>
                    </div>

                    {/* Room & Time / القاعة والساعة */}
                    <div className="border-t border-[var(--line)]/50 pt-1 mt-0.5 flex items-center justify-between text-[10px] text-[var(--text-3)] tabular-nums">
                      <span
                        className="truncate max-w-[55%] font-medium text-[var(--text-2)]"
                        title={
                          item.entry.room ||
                          item.entry.location ||
                          "قاعة غير محددة"
                        }
                      >
                        {item.entry.room ||
                          item.entry.location ||
                          "قاعة غير محددة"}
                      </span>
                      <span dir="ltr" className="font-mono shrink-0">
                        {item.entry.startTime} - {item.entry.endTime}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {scheduledList.length === 0 && (
          <div className="py-12 px-4 text-center max-w-lg mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mx-auto">
              <Calendar size={24} />
            </div>
            <h3 className="text-[16px] font-semibold text-[var(--text)]">
              لا توجد شعب مجدولة لهذا الفصل بعد
            </h3>
            <p className="text-[13px] text-[var(--text-2)] leading-relaxed">
              لم تقم بإضافة أي شعب دراسية لجدول {selectedSemester}. يمكنك
              استخدام ميزة "إنشاء جدول" لتوليد أفضل الجداول الخالية من التعارضات
              بضغطة زر واحدة.
            </p>
            {onOpenScheduleSolver && (
              <button
                type="button"
                onClick={onOpenScheduleSolver}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-[var(--r-control)] text-[13px] font-medium hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
              >
                <Sparkles size={15} />
                <span>إنشاء جدول</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Online and Asynchronous / TBA Lectures Panel (Pillar 2 & 7) */}
      {unscheduledOrOnlineList.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-surface)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-[14px] font-bold text-[var(--text)] m-0">
                المحاضرات الإلكترونية والمسجلة (بدون تعارض قاعات وجاهية)
              </h3>
            </div>
            <span className="text-[11.5px] font-mono text-[var(--text-3)] tabular-nums">
              {unscheduledOrOnlineList.length} مواد
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {unscheduledOrOnlineList.map((item) => (
              <div
                key={item.courseId}
                onClick={() =>
                  setSelectedEntryDetails({
                    courseName: item.courseName,
                    courseId: item.courseId,
                    entry: item.entry,
                  })
                }
                className="p-3 rounded-[var(--r-control)] bg-[var(--sunken)]/50 border border-[var(--line-control)] hover:border-[var(--accent)] transition-all cursor-pointer flex flex-col justify-between space-y-2 group"
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-[13px] text-[var(--text)] truncate group-hover:text-[var(--accent)] transition-colors">
                      {item.courseName}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--line)] text-[var(--text-3)] font-semibold shrink-0">
                      شعبة {item.entry.section || "—"}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[var(--text-3)] block mt-0.5">
                    {item.courseId}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[var(--text-2)] border-t border-[var(--line)]/60 pt-2">
                  <span className="truncate max-w-[60%]">
                    د. {item.entry.instructor || "غير محدد"}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {item.entry.room
                      ? `قاعة ${item.entry.room} (عن بعد)`
                      : "تعليم إلكتروني"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section Details Bottom/Side Sheet */}
      {selectedEntryDetails && (
        <div
          className="fixed inset-0 bg-[var(--scrim)] z-[var(--z-menu)] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4"
          onClick={() => setSelectedEntryDetails(null)}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--line)] rounded-t-[var(--r-surface)] sm:rounded-[var(--r-surface)] w-full sm:max-w-md p-5 space-y-4 shadow-[var(--shadow-pop)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
              <div>
                <h3 className="text-[18px] font-semibold text-[var(--text)]">
                  {selectedEntryDetails.courseName}
                </h3>
                <span className="text-[13px] text-[var(--text-3)] tabular-nums">
                  {selectedEntryDetails.courseId}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntryDetails(null)}
                className="p-1 text-[var(--text-3)] hover:text-[var(--text)] rounded-[var(--r-control)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-[14px]">
              <div className="flex justify-between">
                <span className="text-[var(--text-2)]">الشعبة:</span>
                <span className="font-medium tabular-nums">
                  {selectedEntryDetails.entry.section || "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-2)]">المحاضر:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">
                    {selectedEntryDetails.entry.instructor || "غير محدد"}
                  </span>
                  {selectedEntryDetails.entry.instructor &&
                    selectedEntryDetails.entry.instructor !== "غير محدد" && (
                      <button
                        type="button"
                        onClick={() =>
                          setDoctorScheduleName(
                            selectedEntryDetails.entry.instructor!,
                          )
                        }
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 cursor-pointer transition-colors"
                        title="عرض جدول هذا الدكتور الأسبوعي"
                      >
                        <Calendar size={11} />
                        <span>جدول الدكتور</span>
                      </button>
                    )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-2)]">القاعة:</span>
                <span className="font-medium">
                  {selectedEntryDetails.entry.room ||
                    selectedEntryDetails.entry.location ||
                    "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-2)]">التوقيت:</span>
                <span dir="ltr" className="font-medium tabular-nums">
                  {selectedEntryDetails.entry.startTime} -{" "}
                  {selectedEntryDetails.entry.endTime}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              {onOpenScheduleSolver && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEntryDetails(null);
                    onOpenScheduleSolver();
                  }}
                  className="w-full min-h-[var(--control-h)] px-4 bg-[var(--accent)] text-white hover:opacity-90 font-medium text-[14px] rounded-[var(--r-control)] transition-opacity cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles size={16} />
                  <span>تغيير الشعبة عبر المولد الذكي</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const courseId = selectedEntryDetails.courseId;
                  setWeeklySchedule((prev) => {
                    const next = { ...prev };
                    if (next[selectedSemester]) {
                      const sem = { ...next[selectedSemester] };
                      delete sem[courseId];
                      next[selectedSemester] = sem;
                    }
                    return next;
                  });
                  setSelectedEntryDetails(null);
                }}
                className="w-full min-h-[var(--control-h)] px-4 text-[var(--danger)] hover:bg-[var(--danger-soft)] font-medium text-[14px] rounded-[var(--r-control)] border border-[var(--line-control)] transition-colors cursor-pointer"
              >
                إزالة من الجدول
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 1: Doctor Weekly Schedule Modal */}
      <DoctorScheduleModal
        isOpen={Boolean(doctorScheduleName)}
        onClose={() => setDoctorScheduleName(null)}
        doctorName={doctorScheduleName}
        catalogCourses={catalogCoursesMap}
        courses={courses}
      />
    </div>
  );
};

export default WeeklySchedulePage;
