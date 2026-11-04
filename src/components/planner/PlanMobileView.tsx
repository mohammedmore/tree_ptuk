import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Check,
  Lock,
  Calendar,
  Layers,
  Circle,
  X,
} from "lucide-react";
import type { Course } from "../../data";
import { cn } from "../../utils";
import { triggerHaptic } from "../../utils/haptics";

interface PlanMobileViewProps {
  columnHeaders: Array<{
    column: number;
    title: string;
    totalCredits: number;
    courseCount: number;
  }>;
  coursesByColumn: Record<number, Course[]>;
  completedCourses: Set<string>;
  plannedCourses: Record<string, string>;
  availableCoursesSet: Set<string>;
  filteredCourseIds?: Set<string> | null;
  searchQuery?: string;
  onSelectCourse: (course: Course) => void;
  onToggleComplete: (courseId: string) => void;
  onPlanCourse?: (courseId: string) => void;
}

export const PlanMobileView: React.FC<PlanMobileViewProps> = ({
  columnHeaders,
  coursesByColumn,
  completedCourses,
  plannedCourses,
  availableCoursesSet,
  filteredCourseIds,
  searchQuery = "",
  onSelectCourse,
  onToggleComplete,
  onPlanCourse,
}) => {
  // First column open by default
  const [openSections, setOpenSections] = useState<Record<number, boolean>>(
    () => ({
      0: true,
    }),
  );

  // Long-press timer ref for tactile inspection (Item 104)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = (course: Course) => {
    longPressTimerRef.current = setTimeout(() => {
      triggerHaptic("selection");
      onSelectCourse(course);
    }, 500);
  };

  const handleTouchEndOrCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Auto-expand sections with search matches or active filters (debounced 150ms to prevent mobile input jank)
  useEffect(() => {
    if (!(
      (searchQuery && searchQuery.trim().length > 0) ||
      filteredCourseIds
    )) {
      return;
    }
    const timer = setTimeout(() => {
      const autoOpen: Record<number, boolean> = {};
      columnHeaders.forEach((h) => {
        const cList = coursesByColumn[h.column] || [];
        const hasMatch = filteredCourseIds
          ? cList.some((c) => filteredCourseIds.has(c.id))
          : cList.some(
              (c) =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.id.includes(searchQuery),
            );
        if (hasMatch) autoOpen[h.column] = true;
      });
      setOpenSections(autoOpen);
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery, filteredCourseIds, columnHeaders, coursesByColumn]);

  const toggleSection = (colIdx: number) => {
    triggerHaptic("light");
    setOpenSections((prev) => ({
      ...prev,
      [colIdx]: !prev[colIdx],
    }));
  };

  const allExpanded = useMemo(() => {
    return (
      columnHeaders.length > 0 &&
      columnHeaders.every((h) => !!openSections[h.column])
    );
  }, [columnHeaders, openSections]);

  const handleToggleExpandAll = () => {
    triggerHaptic("selection");
    const nextState = !allExpanded;
    const updated: Record<number, boolean> = {};
    columnHeaders.forEach((h) => {
      updated[h.column] = nextState;
    });
    setOpenSections(updated);
  };

  const totalMatchingCourses = useMemo(() => {
    let count = 0;
    columnHeaders.forEach((h) => {
      const courses = coursesByColumn[h.column] || [];
      const visible = filteredCourseIds
        ? courses.filter((c) => filteredCourseIds.has(c.id))
        : courses;
      count += visible.length;
    });
    return count;
  }, [columnHeaders, coursesByColumn, filteredCourseIds]);

  return (
    <div dir="rtl" className="w-full space-y-3 p-3.5 pb-24">
      {/* Mobile Top Controls: Expand All / Match Count */}
      <div className="flex items-center justify-between px-1 py-0.5 text-xs text-[var(--text-3)]">
        <span>
          {filteredCourseIds
            ? `نتائج البحث: ${totalMatchingCourses} مادة`
            : `إجمالي الفصول: ${columnHeaders.length}`}
        </span>
        <button
          type="button"
          onClick={handleToggleExpandAll}
          className="flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline cursor-pointer"
        >
          <Layers size={13} />
          <span>{allExpanded ? "طي جميع الفصول" : "فتح جميع الفصول"}</span>
        </button>
      </div>

      {totalMatchingCourses === 0 && filteredCourseIds && (
        <div className="py-12 px-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] text-center space-y-2">
          <p className="text-sm font-semibold text-[var(--text)]">
            لا توجد مواد مطابقة للبحث والتصفية
          </p>
          <p className="text-xs text-[var(--text-3)]">
            جرب تغيير شروط البحث أو الفلاتر المحددة
          </p>
        </div>
      )}

      {columnHeaders.map((header) => {
        const rawCourses = coursesByColumn[header.column] || [];
        const courses = filteredCourseIds
          ? rawCourses.filter((c) => filteredCourseIds.has(c.id))
          : rawCourses;

        // If search or filter is active and this column has 0 matching courses, hide it
        if (filteredCourseIds && courses.length === 0) {
          return null;
        }

        const isOpen = !!openSections[header.column];
        const completedCount = courses.filter((c) =>
          completedCourses.has(c.id),
        ).length;
        const totalCreditsInCol = courses.reduce(
          (sum, c) => sum + (c.credits || 0),
          0,
        );

        return (
          <div
            key={header.column}
            className="border border-[var(--line)] rounded-2xl bg-[var(--surface)] overflow-hidden shadow-2xs"
          >
            {/* Header Accordion Button */}
            <button
              type="button"
              id={`semester-header-${header.column}`}
              aria-expanded={isOpen}
              aria-controls={`semester-panel-${header.column}`}
              onClick={() => toggleSection(header.column)}
              className="w-full p-3.5 flex items-center justify-between text-right bg-[var(--surface)] hover:bg-[var(--sunken)] transition-colors cursor-pointer select-none"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-[var(--text)] block">
                    {header.title}
                  </span>
                  {completedCount === courses.length && courses.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold">
                      مكتمل
                    </span>
                  )}
                </div>
                <span className="text-[12px] text-[var(--text-3)] tabular-nums block">
                  {totalCreditsInCol} ساعات • {completedCount}/{courses.length}{" "}
                  مواد منجزة
                </span>
              </div>
              <div className="text-[var(--text-3)] p-1">
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {/* Courses List */}
            {isOpen && (
              <div
                id={`semester-panel-${header.column}`}
                role="region"
                aria-labelledby={`semester-header-${header.column}`}
                className="border-t border-[var(--line)] divide-y divide-[var(--line)]"
              >
                {courses.map((c) => {
                  const isCompleted = completedCourses.has(c.id);
                  const isPlanned = Boolean(plannedCourses[c.id]);
                  const isAvailable = availableCoursesSet.has(c.id);
                  const isLocked = !isCompleted && !isAvailable;

                  let barColor = "bg-[var(--line-control)]";
                  if (isCompleted) {
                    barColor = "bg-emerald-500";
                  } else if (isPlanned) {
                    barColor = "bg-[var(--accent)]";
                  } else if (isLocked) {
                    barColor = "bg-transparent";
                  }

                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectCourse(c);
                        }
                      }}
                      onClick={() => onSelectCourse(c)}
                      onTouchStart={() => handleTouchStart(c)}
                      onTouchEnd={handleTouchEndOrCancel}
                      onTouchMove={handleTouchEndOrCancel}
                      onTouchCancel={handleTouchEndOrCancel}
                      aria-label={`عرض تفاصيل مادة ${c.name}`}
                      className={cn(
                        "relative flex items-center justify-between p-3.5 transition-all duration-150 cursor-pointer select-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-[0.99] active:bg-[var(--sunken)]",
                        isCompleted
                          ? "bg-emerald-500/5"
                          : isPlanned
                            ? "bg-[var(--accent-soft)]"
                            : "bg-[var(--surface)] hover:bg-[var(--sunken)]",
                      )}
                    >
                      {/* Leading edge strip */}
                      <div
                        className={cn(
                          "absolute right-0 top-0 bottom-0 w-[3.5px]",
                          barColor,
                        )}
                      />

                      <div className="flex-1 pr-2.5 pl-3 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              "text-[14px] font-semibold leading-snug",
                              isLocked
                                ? "text-[var(--text-3)]"
                                : "text-[var(--text)]",
                            )}
                          >
                            {c.name}
                          </span>
                          {isCompleted ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-0.5">
                              <Check size={9} strokeWidth={3} />
                              منجزة ✔
                            </span>
                          ) : isPlanned ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25 flex items-center gap-0.5">
                              <Circle
                                size={8}
                                strokeWidth={2.5}
                                className="fill-current text-sky-500"
                              />
                              مخططة ⭕
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium text-[var(--text-3)] bg-[var(--sunken)] border border-[var(--line-control)] flex items-center gap-0.5">
                              <X size={8} strokeWidth={2.5} />
                              متبقية ✖
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[12px] text-[var(--text-3)] tabular-nums">
                          {isLocked && (
                            <Lock
                              size={12}
                              className="shrink-0 text-[var(--text-3)]"
                            />
                          )}
                          <bdi className="font-mono">{c.id}</bdi>
                          <span>•</span>
                          <span>{c.credits} ساعات</span>
                          {c.category && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[120px]">
                                {c.category}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Trailing Controls: Quick Plan & Checkbox (44x44px touch targets) */}
                      <div className="flex items-center gap-2 shrink-0">
                        {onPlanCourse && !isCompleted && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic("selection");
                              onPlanCourse(c.id);
                            }}
                            title={
                              isPlanned ? "إلغاء تخطيط المادة" : "تخطيط المادة"
                            }
                            aria-label={
                              isPlanned
                                ? `إلغاء تخطيط ${c.name}`
                                : `تخطيط ${c.name}`
                            }
                            className={cn(
                              "w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border text-xs flex items-center justify-center transition-colors cursor-pointer active:scale-90",
                              isPlanned
                                ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                                : "bg-[var(--surface)] border-[var(--line-control)] text-[var(--text-3)] hover:text-[var(--text)]",
                            )}
                          >
                            <Calendar size={16} />
                          </button>
                        )}

                        {/* Completion Checkbox */}
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isLocked) {
                              triggerHaptic("selection");
                              onToggleComplete(c.id);
                            }
                          }}
                          aria-label={
                            isCompleted
                              ? `إلغاء إنجاز ${c.name}`
                              : `تحديد ${c.name} كمنجزة`
                          }
                          className={cn(
                            "w-11 h-11 min-w-[44px] min-h-[44px] shrink-0 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-90",
                            isCompleted
                              ? "bg-emerald-600 text-white border border-emerald-600 shadow-2xs"
                              : isLocked
                                ? "bg-[var(--sunken)] border border-[var(--line)] opacity-40 cursor-not-allowed"
                                : "bg-[var(--surface)] border border-[var(--line-control)] hover:border-[var(--accent)]",
                          )}
                        >
                          {isCompleted && <Check size={18} strokeWidth={2.5} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
