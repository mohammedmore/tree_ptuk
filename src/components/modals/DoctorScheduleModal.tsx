import React, { useState, useMemo } from "react";
import {
  X,
  User,
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  Filter,
  Layers,
  List,
  LayoutGrid,
} from "lucide-react";
import type { Course } from "../../data";
import type {
  CatalogCourse,
  CatalogSection,
} from "../../services/scheduleSolver";
import { normalizeDayKey } from "../../services/scheduleSolver";
import { cn, normalizeArabicText, wordsMatch } from "../../utils";

interface DoctorScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorName: string | null;
  catalogCourses: Record<string, CatalogCourse>;
  courses: Course[];
  onSelectDoctorFilter?: (doctorName: string) => void;
}

interface DoctorSessionBlock {
  key: string;
  courseId: string;
  courseName: string;
  section: string;
  room: string;
  dayKey: string;
  dayName: string;
  startTime: string;
  endTime: string;
  activity?: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
}

const DAYS = [
  { key: "أح", name: "الأحد" },
  { key: "اث", name: "الاثنين" },
  { key: "ثلا", name: "الثلاثاء" },
  { key: "ار", name: "الأربعاء" },
  { key: "خمـ", name: "الخميس" },
  { key: "سب", name: "السبت" },
];

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

function formatScheduleTime(
  hour: number | string | undefined,
  defaultTime = "08:00",
): string {
  if (hour === undefined || hour === null) return defaultTime;
  if (typeof hour === "string") {
    const clean = hour.replace(/[٠-٩]/g, (d) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(d)),
    );
    if (clean.includes(":")) return clean;
    const parsed = parseFloat(clean);
    if (!isNaN(parsed)) hour = parsed;
    else return defaultTime;
  }
  if (typeof hour === "number" && !isNaN(hour)) {
    if (hour >= 60) {
      const h = Math.floor(hour / 60);
      const m = Math.round(hour % 60);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    const totalMinutes = Math.round(hour * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return defaultTime;
}

// Convert hours/minutes/string to minutes from 08:00
function timeToMinutesFrom8(time: number | string | undefined): number {
  if (time === undefined || time === null) return 0;
  if (typeof time === "number") {
    if (time >= 60) {
      return Math.max(0, time - 480);
    }
    return Math.max(0, Math.round((time - 8) * 60));
  }
  const clean = String(time).replace(/[٠-٩]/g, (d) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(d)),
  );
  let [h, m] = clean.split(":").map(Number);
  if (isNaN(h)) return 0;
  if (h >= 1 && h <= 6) {
    h += 12; // Convert 12-hour PM times (1 PM - 6 PM) to 24-hour (13:00 - 18:00)
  }
  return Math.max(0, (h - 8) * 60 + (m || 0));
}

const COURSE_COLOR_PALETTES = [
  {
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    border: "border-blue-500/30",
    text: "text-blue-700 dark:text-blue-300",
    accent: "bg-blue-500",
  },
  {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    border: "border-emerald-500/30",
    text: "text-emerald-700 dark:text-emerald-300",
    accent: "bg-emerald-500",
  },
  {
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    border: "border-purple-500/30",
    text: "text-purple-700 dark:text-purple-300",
    accent: "bg-purple-500",
  },
  {
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    border: "border-amber-500/30",
    text: "text-amber-800 dark:text-amber-200",
    accent: "bg-amber-500",
  },
  {
    bg: "bg-rose-500/10 dark:bg-rose-500/20",
    border: "border-rose-500/30",
    text: "text-rose-700 dark:text-rose-300",
    accent: "bg-rose-500",
  },
  {
    bg: "bg-cyan-500/10 dark:bg-cyan-500/20",
    border: "border-cyan-500/30",
    text: "text-cyan-700 dark:text-cyan-300",
    accent: "bg-cyan-500",
  },
];

export const DoctorScheduleModal: React.FC<DoctorScheduleModalProps> = ({
  isOpen,
  onClose,
  doctorName,
  catalogCourses,
  courses,
  onSelectDoctorFilter,
}) => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const coursesById = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses],
  );

  // Extract all sessions taught by this doctor
  const { doctorSessions, uniqueCourses, totalSections } = useMemo(() => {
    if (!doctorName)
      return { doctorSessions: [], uniqueCourses: [], totalSections: 0 };

    const normDoc = normalizeArabicText(doctorName);
    const sessions: DoctorSessionBlock[] = [];
    const courseIdSet = new Set<string>();
    let sectionCount = 0;

    Object.entries(catalogCourses).forEach(([courseCode, catCourse]) => {
      if (!Array.isArray(catCourse.sections)) return;

      const courseMeta = coursesById.get(courseCode);
      const courseTitle = courseMeta?.name || catCourse.name || courseCode;

      catCourse.sections.forEach((sec: CatalogSection) => {
        const secInst = sec.instructor?.trim();
        if (!secInst) return;

        const isMatch =
          secInst === doctorName ||
          normalizeArabicText(secInst) === normDoc ||
          wordsMatch(secInst, doctorName);

        if (!isMatch) return;

        sectionCount++;
        courseIdSet.add(courseCode);

        // Blocks within this section
        const blocks = Array.isArray(sec.blocks) ? sec.blocks : [];

        blocks.forEach((block, bIdx) => {
          const rawDays = block.days || [];
          rawDays.forEach((rawDay: string) => {
            const canonicalDay = normalizeDayKey(rawDay);
            if (!canonicalDay) return;

            const dayObj = DAYS.find((d) => d.key === canonicalDay);
            const dayTitle = dayObj ? dayObj.name : canonicalDay;

            const startMin = timeToMinutesFrom8(block.start);
            const endMin = timeToMinutesFrom8(block.end);
            const duration = Math.max(30, endMin - startMin);

            sessions.push({
              key: `${courseCode}-${sec.sec}-${canonicalDay}-${block.start}-${bIdx}`,
              courseId: courseCode,
              courseName: courseTitle,
              section: sec.sec,
              room: sec.room || "غير محددة",
              dayKey: canonicalDay,
              dayName: dayTitle,
              startTime: formatScheduleTime(block.start, "08:00"),
              endTime: formatScheduleTime(block.end, "09:15"),
              startMinutes: startMin,
              endMinutes: endMin,
              durationMinutes: duration,
            });
          });
        });
      });
    });

    const uniqueList = Array.from(courseIdSet).map((id) => ({
      id,
      name: coursesById.get(id)?.name || id,
      credits: coursesById.get(id)?.credits || 3,
    }));

    return {
      doctorSessions: sessions,
      uniqueCourses: uniqueList,
      totalSections: sectionCount,
    };
  }, [doctorName, catalogCourses, coursesById]);

  // Assign distinct colors per course
  const courseColorMap = useMemo(() => {
    const map = new Map<string, (typeof COURSE_COLOR_PALETTES)[0]>();
    uniqueCourses.forEach((c, idx) => {
      map.set(c.id, COURSE_COLOR_PALETTES[idx % COURSE_COLOR_PALETTES.length]);
    });
    return map;
  }, [uniqueCourses]);

  if (!isOpen || !doctorName) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] bg-[var(--surface)] border border-[var(--line-control)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--text)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <User size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-[var(--text)] font-sans">
                  جدول الدكتور: {doctorName}
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20">
                  جامعة فلسطين التقنية - خضوري
                </span>
              </div>
              <p className="text-xs text-[var(--text-3)] mt-0.5">
                مواعيد المحاضرات والقاعات وتوزيع الشعب على مدار الأسبوع
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stats Strip */}
        <div className="px-5 py-3 border-b border-[var(--line)] bg-[var(--sunken)]/60 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 font-semibold text-[var(--text-2)]">
              <BookOpen size={14} className="text-indigo-500" />
              <span>المساقات المسندة:</span>
              <span className="font-bold text-[var(--text)]">
                {uniqueCourses.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-[var(--text-2)]">
              <Layers size={14} className="text-emerald-500" />
              <span>إجمالي الشعب:</span>
              <span className="font-bold text-[var(--text)]">
                {totalSections}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-[var(--text-2)]">
              <Clock size={14} className="text-amber-500" />
              <span>عدد الجلسات الأسبوعية:</span>
              <span className="font-bold text-[var(--text)]">
                {doctorSessions.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center p-0.5 rounded-lg border border-[var(--line-control)] bg-[var(--surface)] text-xs">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1 cursor-pointer",
                  viewMode === "grid"
                    ? "bg-[var(--accent)] text-[var(--text-on-accent)] shadow-2xs"
                    : "text-[var(--text-2)] hover:text-[var(--text)]",
                )}
                title="عرض شبكة أسبوعية"
              >
                <LayoutGrid size={12} />
                <span>الشبكة الأسبوعية</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1 cursor-pointer",
                  viewMode === "list"
                    ? "bg-[var(--accent)] text-[var(--text-on-accent)] shadow-2xs"
                    : "text-[var(--text-2)] hover:text-[var(--text)]",
                )}
                title="عرض كقائمة شعب"
              >
                <List size={12} />
                <span>قائمة الشعب</span>
              </button>
            </div>

            {/* Quick Action: Filter this doctor in Courses Page */}
            {onSelectDoctorFilter && (
              <button
                type="button"
                onClick={() => {
                  onSelectDoctorFilter(doctorName);
                  onClose();
                }}
                className="px-2.5 py-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                title="تصفية مواد هذا الدكتور في دليل المواد"
              >
                <Filter size={12} />
                <span>تصفية مواده في الدليل</span>
              </button>
            )}
          </div>
        </div>

        {/* Courses Legend */}
        {uniqueCourses.length > 0 && (
          <div className="px-5 py-2.5 bg-[var(--surface)] border-b border-[var(--line)] flex flex-wrap items-center gap-2 text-xs shrink-0">
            <span className="text-[var(--text-3)] font-semibold">
              المقررات:
            </span>
            {uniqueCourses.map((c) => {
              const pal = courseColorMap.get(c.id) || COURSE_COLOR_PALETTES[0];
              return (
                <div
                  key={c.id}
                  className={cn(
                    "px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5",
                    pal.bg,
                    pal.border,
                    pal.text,
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", pal.accent)} />
                  <span>{c.name}</span>
                  <span className="text-[10px] font-mono opacity-75">
                    ({c.id})
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-4 sm:p-5 custom-scrollbar">
          {doctorSessions.length === 0 ? (
            <div className="py-16 text-center text-[var(--text-3)] space-y-2">
              <Calendar
                size={36}
                className="mx-auto opacity-40 text-indigo-400"
              />
              <p className="text-sm font-bold text-[var(--text-2)]">
                لم يتم العثور على شعب مطروحة مسندة لهذا الدكتور في الفصل الحالي
              </p>
              <p className="text-xs text-[var(--text-3)] max-w-sm mx-auto">
                قد تكون الشعب غير مسندة بعد في بوابة التسجيل أو أن المساقات لم
                تُطرح في هذا الفصل.
              </p>
            </div>
          ) : viewMode === "grid" ? (
            /* Weekly Grid View */
            <div className="min-w-[700px] border border-[var(--line-control)] rounded-xl overflow-hidden bg-[var(--surface)]">
              {/* Header row: Days */}
              <div className="grid grid-cols-[3.5rem_repeat(6,minmax(0,1fr))] border-b border-[var(--line-control)] bg-[var(--sunken)] text-xs font-bold text-center">
                <div className="py-2.5 px-1 border-l border-[var(--line-control)] text-[var(--text-3)]">
                  الوقت
                </div>
                {DAYS.map((d) => (
                  <div
                    key={d.key}
                    className="py-2.5 px-1 border-l border-[var(--line-control)] last:border-l-0 text-[var(--text)]"
                  >
                    {d.name}
                  </div>
                ))}
              </div>

              {/* Grid Hours and Slots */}
              <div className="relative grid grid-cols-[3.5rem_repeat(6,minmax(0,1fr))]">
                {/* Time ruler */}
                <div className="border-l border-[var(--line-control)] bg-[var(--sunken)]/40 divide-y divide-[var(--line-control)]">
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="h-16 flex items-start justify-center pt-1 text-[11px] font-mono text-[var(--text-3)]"
                    >
                      {`${String(h).padStart(2, "0")}:00`}
                    </div>
                  ))}
                </div>

                {/* Day Columns */}
                {DAYS.map((day) => {
                  const daySessions = doctorSessions.filter(
                    (s) => s.dayKey === day.key,
                  );

                  return (
                    <div
                      key={day.key}
                      className="relative h-[576px] border-l border-[var(--line-control)] last:border-l-0 divide-y divide-[var(--line-control)]/40 bg-[var(--surface)]"
                    >
                      {/* Hour background guide lines */}
                      {HOURS.map((h) => (
                        <div key={h} className="h-16 pointer-events-none" />
                      ))}

                      {/* Placed Session Blocks */}
                      {daySessions.map((session) => {
                        const topPx = (session.startMinutes / 60) * 64;
                        const heightPx = Math.max(
                          34,
                          (session.durationMinutes / 60) * 64 - 2,
                        );
                        const pal =
                          courseColorMap.get(session.courseId) ||
                          COURSE_COLOR_PALETTES[0];

                        return (
                          <div
                            key={session.key}
                            style={{
                              position: "absolute",
                              top: `${topPx}px`,
                              height: `${heightPx}px`,
                              right: "3px",
                              left: "3px",
                            }}
                            className={cn(
                              "rounded-lg border p-1.5 shadow-2xs overflow-hidden flex flex-col justify-between transition-all hover:z-20 hover:shadow-md cursor-default text-[11px]",
                              pal.bg,
                              pal.border,
                              pal.text,
                            )}
                            title={`${session.courseName} - شعبة ${session.section} (${session.startTime} - ${session.endTime}) - قاعة: ${session.room}`}
                          >
                            <div className="leading-tight">
                              <div className="font-bold truncate text-[11px]">
                                {session.courseName}
                              </div>
                              <div className="text-[10px] opacity-80 flex items-center justify-between gap-1 mt-0.5 font-mono">
                                <span>شعبة {session.section}</span>
                                <span className="truncate">{session.room}</span>
                              </div>
                            </div>
                            <div className="text-[9px] font-mono opacity-70 mt-auto pt-0.5 border-t border-current/15 flex items-center gap-1">
                              <Clock size={9} />
                              <span>
                                {session.startTime} - {session.endTime}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* List View */
            <div className="space-y-3">
              {doctorSessions.map((session) => {
                const pal =
                  courseColorMap.get(session.courseId) ||
                  COURSE_COLOR_PALETTES[0];

                return (
                  <div
                    key={session.key}
                    className={cn(
                      "p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all",
                      pal.bg,
                      pal.border,
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-bold text-sm", pal.text)}>
                          {session.courseName}
                        </span>
                        <span className="text-xs font-mono text-[var(--text-3)]">
                          ({session.courseId})
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--surface)] text-[var(--text)] border border-[var(--line-control)]">
                          شعبة {session.section}
                        </span>
                        {session.activity && (
                          <span className="text-[10px] text-[var(--text-3)] font-medium">
                            • {session.activity}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-2)] flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <Calendar
                            size={13}
                            className="text-[var(--text-3)]"
                          />
                          <span>
                            يوم: <strong>{session.dayName}</strong>
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={13} className="text-[var(--text-3)]" />
                          <span className="font-mono">
                            {session.startTime} - {session.endTime}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={13} className="text-[var(--text-3)]" />
                          <span>
                            القاعة: <strong>{session.room}</strong>
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--line)] bg-[var(--bg)] flex items-center justify-between shrink-0 text-xs">
          <span className="text-[var(--text-3)]">
            ملاحظة: البيانات مستخرجة مباشرة من شعب الجامعة المعتمدة لهذا الفصل.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--sunken)] border border-[var(--line-control)] hover:bg-[var(--line-control)] font-bold text-xs cursor-pointer transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
