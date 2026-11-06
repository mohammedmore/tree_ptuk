import React from "react";
import {
  BookOpen,
  Plus,
  Calendar,
  ArrowUp,
  ArrowDown,
  CheckCheck,
  Radio,
  ArrowLeftRight,
  Trash2,
} from "lucide-react";
import type { Course, ScheduleEntry } from "../../data";
import {
  PlanKey,
  RegistrationSectionItem,
  SeatWatcherItem,
  sortRegistrationItemsByPriority,
  calculateSectionSaturation,
  isSectionClosed,
} from "../../core/semesterRegistration";
import type { EnrolledCourse } from "../../services/studentService";
import { cn } from "../../utils";

export interface PlanItemsTableProps {
  items: RegistrationSectionItem[];
  activeTab: PlanKey;
  courseMap: Map<string, Course>;
  enrolledCoursesMap: Map<string, EnrolledCourse>;
  seatWatchList: SeatWatcherItem[];
  currentWeeklySchedule:
    | Record<string, ScheduleEntry>
    | Record<string, Record<string, ScheduleEntry>>;
  onMovePriority: (courseId: string, direction: "up" | "down") => void;
  onUpdateSection: (courseId: string, newSection: string) => void;
  onSetReserveSection: (courseId: string, reserveSection: string) => void;
  onRemoveItem: (courseId: string) => void;
  onOpenAddModal: () => void;
  onImportWeeklySchedule: () => void;
  onAddWatchedSection: (courseId: string, section: string) => void;
  onOpenSafeSwap: (courseId: string) => void;
}

export const PlanItemsTable: React.FC<PlanItemsTableProps> = ({
  items,
  activeTab,
  courseMap,
  enrolledCoursesMap,
  seatWatchList,
  currentWeeklySchedule,
  onMovePriority,
  onUpdateSection,
  onSetReserveSection,
  onRemoveItem,
  onOpenAddModal,
  onImportWeeklySchedule,
  onAddWatchedSection,
  onOpenSafeSwap,
}) => {
  if (items.length === 0) {
    return (
      <div className="py-16 text-center space-y-4 px-4 border-2 border-dashed border-[var(--line-control)] rounded-3xl bg-[var(--surface)]/50">
        <div className="w-14 h-14 rounded-3xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
          <BookOpen size={28} />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="font-bold text-base text-[var(--text)]">
            هذه الخطة فارغة حالياً
          </h3>
          <p className="text-xs text-[var(--text-3)] leading-relaxed">
            يمكنك استيراد مواد جدولك الأسبوعي بضغطة زر، أو إضافة مساقات وشعب
            مخصصة يدوياً لتجهيزها للإرسال الفوري عند فتح التسجيل.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onOpenAddModal}
            className="px-4 py-2 rounded-2xl text-xs font-bold bg-[var(--accent)] text-white shadow-sm hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>إضافة مادة</span>
          </button>
          {activeTab === "A" &&
            Object.keys(currentWeeklySchedule).length > 0 && (
              <button
                type="button"
                onClick={onImportWeeklySchedule}
                className="px-4 py-2 rounded-2xl text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Calendar size={14} />
                <span>استيراد جدولك الأسبوعي الحالي</span>
              </button>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-[var(--text-3)] px-1">
        <span>المساقات المجهزة في هذه الخطة ({items.length})</span>
        <span>الأولوية تُحسب تلقائياً (المختبرات والشعب الحرجة أولاً)</span>
      </div>

      <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-3xl overflow-hidden bg-[var(--surface)] shadow-2xs">
        {sortRegistrationItemsByPriority(items).map((item, idx) => {
          const catalogCourse = courseMap.get(item.courseId);
          const availableSections = catalogCourse?.sections || [];
          const secObj = availableSections.find(
            (s) => String(s.sec).trim() === String(item.section).trim(),
          );
          const secSat = calculateSectionSaturation(
            secObj?.registered,
            secObj?.capacity,
          );
          const isEnrolledInPortal = enrolledCoursesMap.has(item.courseId);
          const enrolledSec = enrolledCoursesMap.get(item.courseId)?.sec;

          return (
            <div
              key={item.courseId}
              className="p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--sunken)]/30 transition-colors"
            >
              <div className="flex items-start gap-3 flex-1">
                {/* Priority Reordering Buttons */}
                <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => onMovePriority(item.courseId, "up")}
                    title="تقديم أولوية الإرسال"
                    className="p-1 rounded-md text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === items.length - 1}
                    onClick={() => onMovePriority(item.courseId, "down")}
                    title="تأخير أولوية الإرسال"
                    className="p-1 rounded-md text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>

                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm sm:text-base text-[var(--text)]">
                      {item.courseName}
                    </span>
                    <span className="font-mono text-xs text-[var(--text-3)]">
                      ({item.courseId})
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                      {item.credits} ساعات
                    </span>
                    {item.priority === 1 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25">
                        أولوية أولى (إرسال فوري)
                      </span>
                    )}
                    {/* Enrolled in Portal Badge */}
                    {isEnrolledInPortal && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCheck size={12} />
                        <span>مسجل فعلياً بالبوابة (شعبة {enrolledSec})</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-3)]">
                    <span>المدرس: {item.instructor || "غير محدد"}</span>
                    <span>•</span>
                    <span>الموعد: {item.timeText || "حسب جدول الشعبة"}</span>
                    {item.room && (
                      <>
                        <span>•</span>
                        <span>القاعة: {item.room}</span>
                      </>
                    )}
                  </div>

                  {/* Section Saturation Indicator */}
                  {secObj && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          secSat.status === "full"
                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25"
                            : secSat.status === "critical"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
                        )}
                      >
                        {secSat.badgeText} ({secSat.registered}/
                        {secSat.capacity})
                      </span>
                      <div className="w-16 bg-[var(--sunken)] rounded-full h-1.5 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            secSat.status === "full"
                              ? "bg-rose-500"
                              : secSat.status === "critical"
                                ? "bg-amber-500"
                                : "bg-emerald-500",
                          )}
                          style={{ width: `${secSat.percent}%` }}
                        />
                      </div>
                      {secSat.status === "full" &&
                        !seatWatchList.some(
                          (w) =>
                            w.courseId === item.courseId &&
                            String(w.section) === String(item.section),
                        ) && (
                          <button
                            type="button"
                            onClick={() =>
                              onAddWatchedSection(item.courseId, item.section)
                            }
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                            title="الشعبة مغلقة - اضغط لمراقبتها وتنبيهك عند شغر مقعد فوراً"
                          >
                            <Radio size={10} />
                            <span>مراقبة المقعد</span>
                          </button>
                        )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto shrink-0">
                {/* Primary Section Selector */}
                <div className="flex items-center gap-1.5 text-xs">
                  <label className="text-[var(--text-3)] font-semibold">
                    الشعبة:
                  </label>
                  {availableSections.length > 0 ? (
                    <select
                      value={item.section}
                      onChange={(e) =>
                        onUpdateSection(item.courseId, e.target.value)
                      }
                      className={cn(
                        "h-8 px-2 text-xs rounded-xl bg-[var(--sunken)] border text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-bold",
                        isSectionClosed(secSat?.registered, secSat?.capacity)
                          ? "border-rose-500/50 text-rose-600 dark:text-rose-400"
                          : "border-[var(--line-control)]",
                      )}
                    >
                      {availableSections.map((s) => {
                        const isFull = isSectionClosed(
                          s.registered,
                          s.capacity,
                        );
                        const avail = Math.max(
                          0,
                          (s.capacity || 40) - (s.registered || 0),
                        );
                        return (
                          <option key={s.sec} value={s.sec}>
                            شعبة {s.sec} - {s.instructor || "مدرس"} (
                            {isFull ? "مغلقة (ممتلئة)" : `${avail} مقعد شاغر`})
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={item.section}
                      onChange={(e) =>
                        onUpdateSection(item.courseId, e.target.value)
                      }
                      className="w-14 h-8 text-center font-bold text-xs rounded-xl bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  )}
                </div>

                {/* Reserve Section Fallback Selector */}
                {availableSections.length > 1 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <label
                      className="text-[var(--text-3)] font-semibold"
                      title="شعبة بديلة للتسجيل فوراً في حال امتلاء الشعبة الأساسية"
                    >
                      الاحتياطية:
                    </label>
                    <select
                      value={item.reserveSection || ""}
                      onChange={(e) =>
                        onSetReserveSection(item.courseId, e.target.value)
                      }
                      className={cn(
                        "h-8 px-2 text-xs rounded-xl bg-[var(--sunken)] border transition-colors focus:outline-none font-semibold",
                        item.reserveSection
                          ? "border-amber-500/50 text-amber-700 dark:text-amber-300 font-bold"
                          : "border-[var(--line-control)] text-[var(--text-3)]",
                      )}
                      title="شعبة احتياطية للتسجيل فوراً في جزء من الثانية إذا أغلقت الشعبة الأساسية"
                    >
                      <option value="">(بدون احتياط)</option>
                      {availableSections
                        .filter(
                          (s) =>
                            String(s.sec).trim() !==
                            String(item.section).trim(),
                        )
                        .map((s) => {
                          const isFull = isSectionClosed(
                            s.registered,
                            s.capacity,
                          );
                          const avail = Math.max(
                            0,
                            (s.capacity || 40) - (s.registered || 0),
                          );
                          return (
                            <option key={s.sec} value={s.sec}>
                              شعبة {s.sec} - {s.instructor || "مدرس"} (
                              {isFull ? "مغلقة (ممتلئة)" : `${avail} مقعد شاغر`}
                              )
                            </option>
                          );
                        })}
                    </select>
                  </div>
                )}

                {/* Safe Swap Action */}
                {availableSections.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onOpenSafeSwap(item.courseId)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--surface)] hover:bg-[var(--sunken)] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--line-control)] transition-all cursor-pointer flex items-center gap-1"
                    title="التبديل الآمن إلى شعبة بديلة أخرى دون تعارض"
                  >
                    <ArrowLeftRight size={13} className="text-indigo-500" />
                    <span>تبديل</span>
                  </button>
                )}

                {/* Add to Seat Watcher */}
                <button
                  type="button"
                  onClick={() =>
                    onAddWatchedSection(item.courseId, item.section)
                  }
                  className="p-1.5 rounded-xl text-[var(--text-3)] hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
                  title="مراقبة المقاعد الشاغرة لهذه الشعبة"
                >
                  <Radio size={15} />
                </button>

                {/* Delete Item */}
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.courseId)}
                  className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                  title="إزالة المساق من هذه الخطة"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
