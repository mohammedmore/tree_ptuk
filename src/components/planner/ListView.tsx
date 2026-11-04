import React, { memo, useMemo, useState, useRef, useEffect } from "react";
import {
  LayoutList,
  Pin,
  Trash2,
  CalendarDays,
  BookOpen,
  Lock,
  CircleCheckBig,
  Info,
  Check,
  Circle,
  X as XIcon,
  Flame,
} from "lucide-react";
import { cn } from "../../utils";
import {
  courseCommonNames,
  SEMESTERS,
  getRecommendedSemesterOfCourse,
  ELECTIVE_SLOTS_DEFS,
  SEMESTER_ELECTIVE_SLOTS,
} from "../../constants";
import { Course } from "../../data";
import { computeCriticalPath } from "../../core/courseProgress";

type ListGroupBy = "category" | "semester";

interface CoursePath {
  ancestors: Set<string>;
  descendants: Set<string>;
  allPathNodeIds: Set<string>;
}

interface ListCategory {
  key: string;
  label: string;
  badge: string;
  req?: number;
  isSemester: boolean;
}

type ListItem =
  { type: "course"; course: Course } | { type: "slot"; slotId: string };

interface ListViewProps {
  activeCourses: Course[];
  listGroupBy: ListGroupBy;
  setListGroupBy: React.Dispatch<React.SetStateAction<ListGroupBy>>;
  completedCourses: ReadonlySet<string>;
  availableCourses: Course[];
  plannedCourses: Record<string, string>;
  pinnedCourseId: string | null;
  setPinnedCourseId: React.Dispatch<React.SetStateAction<string | null>>;
  pinnedPath: CoursePath | null;
  searchQuery: string;
  toggleCourseCompletion: (courseId: string) => void;
  onOpenDetails: (courseId: string) => void;
  selectedElectives: Record<string, string>;
  setSelectedElectives: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  completedCreditsPerCategory: Record<string, number>;
  courses: Course[];
  setPlanningCourseId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsPlannerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  hoveredCourseId?: string | null;
  setHoveredCourseId?: React.Dispatch<React.SetStateAction<string | null>>;
  hoveredPath?: CoursePath | null;
  categoryRequirements?: Record<string, number>;
  totalDegreeCredits?: number;
}

function ListView({
  activeCourses,
  listGroupBy,
  setListGroupBy,
  completedCourses,
  availableCourses,
  plannedCourses,
  pinnedCourseId,
  setPinnedCourseId,
  pinnedPath,
  searchQuery,
  toggleCourseCompletion,
  onOpenDetails,
  selectedElectives,
  setSelectedElectives,
  completedCreditsPerCategory,
  courses = [],
  setPlanningCourseId,
  setIsPlannerOpen,
  hoveredCourseId, // New prop
  setHoveredCourseId, // New prop
  hoveredPath, // New prop
  categoryRequirements,
  totalDegreeCredits,
}: ListViewProps) {
  const [hideCompletedInList, setHideCompletedInList] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({});

  // Scroll progress indicator (Item 108)
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const isHorizontal =
        el.scrollWidth > el.clientWidth && window.innerWidth >= 640;
      const scrollVal = isHorizontal ? Math.abs(el.scrollLeft) : el.scrollTop;
      const maxScroll = isHorizontal
        ? el.scrollWidth - el.clientWidth
        : el.scrollHeight - el.clientHeight;
      if (maxScroll > 0) {
        setScrollProgress(
          Math.min(100, Math.max(0, (scrollVal / maxScroll) * 100)),
        );
      } else {
        setScrollProgress(0);
      }
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  const categories = useMemo<ListCategory[]>(() => {
    if (listGroupBy === "category") {
      const catOrder = [
        "متطلب استدراكي إجباري",
        "متطلب جامعة إجباري",
        "متطلب جامعة اختياري",
        "متطلب كلية إجباري",
        "متطلب كلية اختياري",
        "متطلب تخصص إجباري",
        "متطلب تخصص اختياري",
      ];
      const badgeMap: Record<string, string> = {
        "متطلب استدراكي إجباري": "bg-slate-100 text-slate-700 border-slate-200",
        "متطلب جامعة إجباري": "bg-blue-100 text-blue-700 border-blue-200",
        "متطلب جامعة اختياري":
          "bg-indigo-100 text-indigo-700 border-indigo-200",
        "متطلب كلية إجباري": "bg-teal-100 text-teal-700 border-teal-200",
        "متطلب كلية اختياري":
          "bg-emerald-100 text-emerald-700 border-emerald-200",
        "متطلب تخصص إجباري": "bg-purple-100 text-purple-700 border-purple-200",
        "متطلب تخصص اختياري": "bg-pink-100 text-pink-700 border-pink-200",
      };
      const labelMap: Record<string, string> = {
        "متطلب استدراكي إجباري": "المتطلبات الاستدراكية",
        "متطلب جامعة إجباري": "متطلبات الجامعة الإجبارية",
        "متطلب جامعة اختياري": "متطلبات الجامعة الاختيارية",
        "متطلب كلية إجباري": "متطلبات الكلية الإجبارية",
        "متطلب كلية اختياري": "متطلبات الكلية الاختيارية",
        "متطلب تخصص إجباري": "متطلبات التخصص الإجبارية",
        "متطلب تخصص اختياري": "متطلبات التخصص الاختيارية",
      };

      const allCats = new Set<string>();
      if (categoryRequirements) {
        Object.keys(categoryRequirements).forEach((k) => allCats.add(k));
      }
      courses.forEach((c) => {
        if (c.category) allCats.add(c.category);
      });

      const sortedCats = Array.from(allCats).sort((a, b) => {
        const idxA = catOrder.indexOf(a);
        const idxB = catOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });

      return sortedCats.map((key) => {
        const req =
          categoryRequirements?.[key] ??
          courses
            .filter((c) => c.category === key)
            .reduce((sum, c) => sum + c.credits, 0);
        return {
          key,
          label: labelMap[key] || key,
          badge: badgeMap[key] || "bg-gray-100 text-gray-700 border-gray-200",
          req,
          isSemester: false,
        };
      });
    }

    const maxYears =
      totalDegreeCredits && totalDegreeCredits <= 80
        ? 2
        : totalDegreeCredits && totalDegreeCredits <= 140
          ? 4
          : 5;
    const regularSems = SEMESTERS.filter((s) => !s.includes("الصيفي"));
    const allowedSems = regularSems.filter((s) => {
      if (s.includes("الخامسة")) return maxYears >= 5;
      if (s.includes("الرابعة")) return maxYears >= 4;
      if (s.includes("الثالثة")) return maxYears >= 3;
      return true;
    });

    return allowedSems.map((s) => ({
      key: s,
      label: s,
      badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
      isSemester: true,
    }));
  }, [listGroupBy, categoryRequirements, courses, totalDegreeCredits]);
  const coursesById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );
  const availableCourseIds = useMemo(
    () => new Set(availableCourses.map((course) => course.id)),
    [availableCourses],
  );
  const criticalPathInfo = useMemo(
    () => computeCriticalPath(courses),
    [courses],
  );

  const renderCard = (course: Course, slotLabel?: string, slotId?: string) => {
    const isComp = completedCourses.has(course.id);
    const isPlanned = !!plannedCourses[course.id];
    const isAvail = availableCourseIds.has(course.id);
    const isCritical =
      !isComp &&
      (criticalPathInfo.criticalCourseIds?.has(course.id) ||
        criticalPathInfo.courseIds?.has(course.id));
    const prerequisitesCompleted = course.prerequisites.every((prereq) =>
      completedCourses.has(prereq),
    );

    const plannedSem = plannedCourses[course.id];
    const hasPlannedConflict =
      plannedSem &&
      course.prerequisites.some((pId) => {
        if (completedCourses.has(pId)) return false;
        const pSem = plannedCourses[pId];
        if (!pSem) return true;
        return SEMESTERS.indexOf(pSem) >= SEMESTERS.indexOf(plannedSem);
      });

    const isPinned = pinnedCourseId === course.id;
    const isAncestor = pinnedPath?.ancestors.has(course.id) || false;
    const isDescendant = pinnedPath?.descendants.has(course.id) || false;
    const isPinnedPathNode = pinnedPath?.allPathNodeIds.has(course.id) || false;

    const isHovered = hoveredCourseId === course.id;
    const isHoveredAncestor = hoveredPath?.ancestors.has(course.id) || false;
    const isHoveredDescendant =
      hoveredPath?.descendants.has(course.id) || false;
    const isHoveredPathNode =
      hoveredPath?.allPathNodeIds.has(course.id) || false;

    let statusBadgeColor =
      "bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-900 dark:text-slate-500 dark:border-slate-800";
    let statusText = "مغلقة ✖";
    let statusIcon = <XIcon size={11} className="text-slate-400" />;
    let cardBorder =
      "border-gray-150 dark:border-slate-750 hover:border-gray-350 dark:hover:border-slate-600";
    let cardOpacity = 1;

    if (isComp) {
      statusBadgeColor =
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40";
      statusText = "منجز ✔";
      statusIcon = (
        <Check size={11} strokeWidth={2.8} className="text-emerald-600" />
      );
      cardBorder =
        "border-emerald-250 bg-emerald-50/5 dark:bg-slate-900 dark:border-emerald-950/60 dark:ring-1 dark:ring-emerald-900/30";
    } else if (isPlanned) {
      statusBadgeColor = hasPlannedConflict
        ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40"
        : "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60";
      statusText = hasPlannedConflict
        ? "خطأ في الترتيب ⚠️"
        : `مخطط ⭕ (${plannedCourses[course.id]})`;
      statusIcon = (
        <Circle
          size={9}
          strokeWidth={2.5}
          className="fill-current text-sky-500"
        />
      );
      cardBorder =
        "border-sky-250 bg-sky-50/5 dark:bg-slate-900 dark:border-sky-900/60 dark:ring-1 dark:ring-sky-900/30";
    } else if (isAvail) {
      statusBadgeColor =
        "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800";
      statusText = "متاح ✖";
      statusIcon = <XIcon size={11} className="text-slate-500" />;
      cardBorder =
        "border-slate-200 bg-slate-50/5 dark:bg-slate-900 dark:border-slate-800 hover:border-slate-400";
    } else if (!prerequisitesCompleted) {
      statusText = "المتطلبات غير مكتملة ✖";
      statusIcon = <Lock size={10} className="text-slate-400" />;
    }

    // Override with pinned path styling (when a course is explicitly pinned)
    if (pinnedCourseId && pinnedPath) {
      if (isPinned) {
        cardBorder =
          "border-amber-450 bg-amber-50/15 ring-2 ring-amber-400 dark:ring-amber-500/50 shadow-sm z-[2]";
      } else if (isAncestor) {
        cardBorder =
          "border-emerald-450 bg-emerald-50/5 ring-1 ring-emerald-300 dark:ring-emerald-500/50 shadow-xs";
      } else if (isDescendant) {
        cardBorder =
          "border-purple-450 bg-purple-50/5 ring-1 ring-purple-300 dark:ring-purple-500/50 shadow-xs";
      } else if (isPinnedPathNode) {
        cardBorder =
          "border-amber-200 bg-amber-50/5 dark:bg-amber-950/5 ring-1 ring-amber-100 dark:ring-amber-900/30";
      } else {
        // Dim courses not in the pinned path
        cardOpacity = 0.45;
      }
    }

    return (
      <div
        key={slotId || course.id}
        className={cn(
          "course-list-card cv-auto bg-[var(--surface)] text-[var(--text)] p-3 rounded-xl border border-[var(--line-control)] transition-colors duration-150 flex flex-col gap-2 relative group hover:border-[var(--line)] shadow-none",
          cardBorder,
        )}
        style={{ opacity: cardOpacity }}
      >
        <div className="flex justify-between items-center text-[10px] font-bold">
          {slotLabel ? (
            <span className="text-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.5 rounded border border-[var(--accent)]/30 font-black uppercase">
              {slotLabel}
            </span>
          ) : (
            <span className="text-[var(--accent)] font-mono">{course.id}</span>
          )}
          <span className="text-[var(--text-3)] bg-[var(--sunken)] px-1.5 py-0.5 rounded border border-[var(--line-control)] shrink-0">
            {course.credits} س
          </span>
        </div>

        {slotId && ELECTIVE_SLOTS_DEFS[slotId] && (
          <div className="flex flex-col gap-1 bg-[var(--sunken)] border border-[var(--line-control)] p-2 rounded-lg">
            <select
              value={selectedElectives[slotId] || course.id || ""}
              aria-label={`اختيار مادة ${ELECTIVE_SLOTS_DEFS[slotId].label}`}
              onChange={(e) =>
                setSelectedElectives((prev) => ({
                  ...prev,
                  [slotId]: e.target.value,
                }))
              }
              className="bg-transparent text-[11px] font-black text-[var(--text)] cursor-pointer outline-none"
            >
              {courses
                .filter(
                  (c: Course) =>
                    c.category === ELECTIVE_SLOTS_DEFS[slotId]?.category,
                )
                .map((opt: Course) => (
                  <option
                    key={opt.id}
                    value={opt.id}
                    className="text-[var(--text)] bg-[var(--surface)]"
                  >
                    {opt.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        <h4 className="text-[12.5px] font-extrabold text-gray-800 dark:text-slate-100 leading-snug flex flex-wrap items-center gap-1">
          <span>{course.name}</span>
          {courseCommonNames[course.id] && (
            <span className="text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-150 shrink-0">
              {courseCommonNames[course.id]}
            </span>
          )}
          {isCritical && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 shrink-0"
              title="مسار حرج: تأخير هذه المادة يؤخر سلسلة مواد متتالية حتى مشروع التخرج"
            >
              <Flame
                size={10}
                className="text-amber-500 fill-amber-500 shrink-0"
              />
              <span>عنق زجاجة</span>
            </span>
          )}
        </h4>

        {hasPlannedConflict && (
          <div className="text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-1.5 rounded-lg border border-red-100 dark:border-red-900/30 animate-pulse">
            ⚠️ تنبيه: يجب جدولة المتطلبات السابقة في فصول تسبق هذا الفصل.
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-slate-750 mt-1">
          <span
            className={cn(
              "text-[9px] font-black px-2 py-0.5 rounded border flex items-center gap-1 min-w-0",
              statusBadgeColor,
            )}
          >
            {statusIcon}
            <span className="truncate">{statusText}</span>
          </span>

          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(course.id);
              }}
              aria-label={`عرض تفاصيل ${course.name}`}
              className="min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 p-2 sm:p-1 rounded border transition-colors bg-gray-50 dark:bg-slate-900 text-gray-400 dark:text-slate-400 dark:border-slate-750 hover:bg-gray-100 dark:hover:bg-slate-750 hover:text-blue-600 dark:hover:text-blue-400"
              title="عرض التفاصيل"
            >
              <Info size={10} />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPinnedCourseId(isPinned ? null : course.id);
              }}
              aria-label={
                isPinned
                  ? `إلغاء تثبيت ${course.name}`
                  : `تثبيت مسار ${course.name}`
              }
              className={cn(
                "min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 p-2 sm:p-1 rounded border transition-colors",
                isPinned
                  ? "bg-amber-500 text-white"
                  : isHoveredPathNode && !pinnedCourseId // If hovered path is active and not pinned
                    ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                    : "bg-gray-50 dark:bg-slate-900 text-gray-400 dark:border-slate-750 hover:bg-gray-100 dark:hover:bg-slate-750",
              )}
              title="تثبيت المسار"
            >
              <Pin
                size={10}
                className={cn("transform rotate-25", isPinned && "rotate-0")}
              />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCourseCompletion(course.id);
              }}
              aria-label={
                isComp
                  ? `إلغاء إنجاز ${course.name}`
                  : `تحديد ${course.name} كمنجزة`
              }
              className={cn(
                "min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 p-2 sm:p-1 rounded border transition-colors",
                isComp
                  ? "bg-red-50 text-red-650 dark:bg-red-950/40 dark:text-red-400 border-red-100"
                  : isAvail
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "opacity-30 cursor-not-allowed",
              )}
              disabled={!isComp && !isAvail}
            >
              {isComp ? <Trash2 size={10} /> : <CircleCheckBig size={10} />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPlanningCourseId(course.id);
                setIsPlannerOpen(true);
              }}
              aria-label={`تخطيط ${course.name}`}
              className={cn(
                "min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 p-2 sm:p-1 rounded border transition-colors",
                isPlanned
                  ? "bg-orange-50 text-orange-600 dark:bg-orange-900/30 border-orange-200"
                  : "bg-gray-50 dark:bg-slate-900 text-gray-500 dark:border-slate-750 hover:bg-gray-100 dark:hover:bg-slate-750",
              )}
            >
              <CalendarDays size={10} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex-1 min-h-0 min-w-0 overflow-hidden bg-[var(--bg)] p-2 sm:p-5 flex flex-col"
      dir="rtl"
    >
      <div className="mb-3 sm:mb-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 sm:gap-4 bg-[var(--surface)] p-2.5 sm:p-3 rounded-xl border border-[var(--line)] shadow-none shrink-0">
        <div className="flex items-center gap-2">
          <LayoutList size={17} className="text-[var(--text-2)]" />
          <span className="text-xs font-bold text-[var(--text)]">
            فرز وتصفح المواد:
          </span>
        </div>
        <div className="flex bg-[var(--sunken)] p-0.5 rounded-lg border border-[var(--line-control)]">
          <button
            type="button"
            aria-pressed={listGroupBy === "category"}
            onClick={() => setListGroupBy("category")}
            className={cn(
              "px-3.5 py-1 text-xs font-semibold rounded-md transition-all active:scale-[0.98]",
              listGroupBy === "category"
                ? "bg-[var(--surface)] text-[var(--text)] shadow-xs border border-[var(--line)]"
                : "text-[var(--text-2)] hover:text-[var(--text)]",
            )}
          >
            حسب التصنيف
          </button>
          <button
            type="button"
            aria-pressed={listGroupBy === "semester"}
            onClick={() => setListGroupBy("semester")}
            className={cn(
              "px-3.5 py-1 text-xs font-semibold rounded-md transition-all active:scale-[0.98]",
              listGroupBy === "semester"
                ? "bg-[var(--surface)] text-[var(--text)] shadow-xs border border-[var(--line)]"
                : "text-[var(--text-2)] hover:text-[var(--text)]",
            )}
          >
            حسب الفصل
          </button>
        </div>
        <div className="h-5 w-px bg-[var(--line)] hidden lg:block" />
        <label className="flex items-center gap-2 cursor-pointer group shrink-0">
          <input
            type="checkbox"
            checked={hideCompletedInList}
            onChange={(e) => setHideCompletedInList(e.target.checked)}
            className="w-4 h-4 rounded text-[var(--accent)] border-[var(--line-control)] focus:ring-[var(--accent)] cursor-pointer"
          />
          <span className="text-xs font-semibold text-[var(--text-2)] group-hover:text-[var(--text)] transition-colors">
            إخفاء المواد المنجزة
          </span>
        </label>
      </div>

      {/* Scroll Progress Bar (Item 108) */}
      <div className="w-full h-[2.5px] bg-[var(--line)]/50 overflow-hidden shrink-0 rounded-full mb-1">
        <div
          className="h-full bg-[var(--accent)] transition-all duration-75 ease-out rounded-full"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Mobile: Accordion View / Desktop: Horizontal Scroll View */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 min-w-0 flex flex-col sm:flex-row gap-3 sm:gap-5 overflow-y-auto sm:overflow-x-auto pb-4 items-start scrollbar-thin"
      >
        {categories.map((cat) => {
          let itemsList: ListItem[];
          let totalCr: number;
          let doneCr: number;

          if (cat.isSemester) {
            const semCourses = activeCourses.filter(
              (course) => getRecommendedSemesterOfCourse(course) === cat.key,
            );
            const mandatory = semCourses.filter(
              (course) => !course.category.includes("اختياري"),
            );
            const slots = SEMESTER_ELECTIVE_SLOTS[cat.key] || [];
            itemsList = [
              ...mandatory.map((course): ListItem => ({
                type: "course",
                course,
              })),
              ...slots.map((slotId): ListItem => ({ type: "slot", slotId })),
            ];

            totalCr = itemsList.reduce((sum, item) => {
              if (item.type === "course") return sum + item.course.credits;
              if (item.type === "slot") {
                const slotDef = ELECTIVE_SLOTS_DEFS[item.slotId];
                const matchingCourses = courses.filter(
                  (c) => c.category === slotDef?.category,
                );
                const defaultCourse = slotDef
                  ? coursesById.get(slotDef.defaultCourseId) ||
                    matchingCourses[0]
                  : undefined;
                return sum + (defaultCourse?.credits || 3);
              }
              return sum;
            }, 0);

            doneCr = itemsList.reduce((sum, item) => {
              const cId =
                item.type === "course"
                  ? item.course.id
                  : selectedElectives[item.slotId];
              if (cId && completedCourses.has(cId)) {
                const course = cId ? coursesById.get(cId) : undefined;
                return sum + (course?.credits || 0);
              }
              return sum;
            }, 0);
          } else {
            totalCr = cat.req || 0;
            doneCr = completedCreditsPerCategory[cat.key] || 0;
            itemsList = activeCourses
              .filter((course) => course.category === cat.key)
              .map((course): ListItem => ({ type: "course", course }));
          }

          if (hideCompletedInList) {
            itemsList = itemsList.filter((item) => {
              const cId =
                item.type === "course"
                  ? item.course.id
                  : selectedElectives[item.slotId];
              return !cId || !completedCourses.has(cId);
            });
          }

          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            itemsList = itemsList.filter((item) => {
              const c =
                item.type === "course"
                  ? item.course
                  : coursesById.get(selectedElectives[item.slotId]);
              return (
                c?.name.toLowerCase().includes(q) ||
                c?.id.includes(q) ||
                (courseCommonNames[c?.id || ""] || "").toLowerCase().includes(q)
              );
            });
          }

          const isColumnDone = doneCr >= totalCr && totalCr > 0;
          const isExpanded = expandedCategories[cat.key] ?? true; // Default to expanded

          return (
            <div
              key={cat.key}
              className="w-full max-w-full sm:w-72 sm:max-w-75 shrink-0 bg-[var(--surface)] border border-[var(--line)] rounded-xl flex flex-col shadow-none overflow-hidden cv-auto"
            >
              {/* Header - Clickable on mobile for accordion */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-controls={`category-content-${cat.key}`}
                aria-label={`${isExpanded ? "طي" : "توسيع"} فئة ${cat.label}`}
                className="p-3.5 bg-[var(--sunken)] border-b border-[var(--line)] cursor-pointer sm:cursor-default"
                onClick={() =>
                  setExpandedCategories((prev) => ({
                    ...prev,
                    [cat.key]: !isExpanded,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setExpandedCategories((previous) => ({
                      ...previous,
                      [cat.key]: !isExpanded,
                    }));
                  }
                }}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-bold text-[var(--text)] truncate pr-2">
                    {cat.label}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-md border",
                        isColumnDone
                          ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30"
                          : "bg-[var(--surface)] text-[var(--text-2)] border-[var(--line-control)]",
                      )}
                    >
                      {doneCr} / {totalCr} س
                    </span>
                    <span className="sm:hidden text-[var(--text-3)]">
                      {isExpanded ? "▼" : "▶"}
                    </span>
                  </div>
                </div>
                <div
                  role="progressbar"
                  aria-label={`إنجاز ${cat.label}`}
                  aria-valuemin={0}
                  aria-valuemax={totalCr}
                  aria-valuenow={Math.min(totalCr, Math.max(0, doneCr))}
                  className="h-1 bg-[var(--line-control)] rounded-full overflow-hidden"
                >
                  <div
                    className={cn(
                      "h-full transition-all duration-500",
                      isColumnDone ? "bg-emerald-500" : "bg-[var(--accent)]",
                    )}
                    style={{
                      width: `${Math.min(100, Math.max(0, (doneCr / (totalCr || 1)) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Content - Collapsible on mobile, always visible on desktop */}
              <div
                id={`category-content-${cat.key}`}
                className={cn(
                  "flex-1 overflow-y-auto p-3 flex flex-col gap-3 scrollbar-thin",
                  !isExpanded && "hidden sm:flex",
                )}
              >
                {itemsList.map((item) => {
                  if (item.type === "course") {
                    return renderCard(item.course);
                  } else {
                    const selectedCourseId = selectedElectives[item.slotId];
                    const slotDef = ELECTIVE_SLOTS_DEFS[item.slotId];
                    const matchingCourses = courses.filter(
                      (c) => c.category === slotDef?.category,
                    );
                    const course = selectedCourseId
                      ? coursesById.get(selectedCourseId)
                      : slotDef
                        ? coursesById.get(slotDef.defaultCourseId) ||
                          matchingCourses[0]
                        : undefined;
                    if (course && slotDef) {
                      return renderCard(course, slotDef.label, item.slotId);
                    }
                    return null;
                  }
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(ListView);
