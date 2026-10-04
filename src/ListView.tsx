import React, { useMemo, useState } from "react";
import {
  LayoutList,
  Pin,
  Trash2,
  CalendarDays,
  BookOpen,
  Lock,
  CircleCheckBig,
  Info,
} from "lucide-react";
import { cn } from "./utils";
import {
  courseCommonNames,
  SEMESTERS,
  getRecommendedSemesterOfCourse,
  ELECTIVE_SLOTS_DEFS,
  SEMESTER_ELECTIVE_SLOTS,
} from "./constants";
import { Course } from "./data";

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
  hoveredCourseId: string | null;
  setHoveredCourseId: React.Dispatch<React.SetStateAction<string | null>>;
  hoveredPath: CoursePath | null;
}

export default function ListView({
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
}: ListViewProps) {
  const [hideCompletedInList, setHideCompletedInList] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({});

  const categories = useMemo<ListCategory[]>(
    () =>
      listGroupBy === "category"
        ? [
            {
              key: "متطلب استدراكي إجباري",
              label: "المتطلبات الاستدراكية",
              badge: "bg-slate-100 text-slate-700 border-slate-200",
              req: 3,
              isSemester: false,
            },
            {
              key: "متطلب جامعة إجباري",
              label: "متطلبات الجامعة الإجبارية",
              badge: "bg-blue-100 text-blue-700 border-blue-200",
              req: 18,
              isSemester: false,
            },
            {
              key: "متطلب جامعة اختياري",
              label: "المتطلبات الاختيارية",
              badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
              req: 6,
              isSemester: false,
            },
            {
              key: "متطلب كلية إجباري",
              label: "متطلبات الكلية الإجبارية",
              badge: "bg-teal-100 text-teal-700 border-teal-200",
              req: 18,
              isSemester: false,
            },
            {
              key: "متطلب تخصص إجباري",
              label: "متطلبات التخصص الإجبارية",
              badge: "bg-purple-100 text-purple-700 border-purple-200",
              req: 107,
              isSemester: false,
            },
            {
              key: "متطلب تخصص اختياري",
              label: "متطلبات التخصص الاختيارية",
              badge: "bg-pink-100 text-pink-700 border-pink-200",
              req: 15,
              isSemester: false,
            },
          ]
        : SEMESTERS.filter((s) => !s.includes("الصيفي")).map((s) => ({
            key: s,
            label: s,
            badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
            isSemester: true,
          })),
    [listGroupBy],
  );
  const coursesById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );
  const availableCourseIds = useMemo(
    () => new Set(availableCourses.map((course) => course.id)),
    [availableCourses],
  );

  const renderCard = (course: Course, slotLabel?: string, slotId?: string) => {
    const isComp = completedCourses.has(course.id);
    const isPlanned = !!plannedCourses[course.id];
    const isAvail = availableCourseIds.has(course.id);
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
    let statusText = "مغلقة";
    let statusIcon = <Lock size={11} />;
    let cardBorder =
      "border-gray-150 dark:border-slate-750 hover:border-gray-350 dark:hover:border-slate-600";
    let cardOpacity = 1;

    if (isComp) {
      statusBadgeColor =
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40";
      statusText = "منجز";
      statusIcon = <CircleCheckBig size={11} className="text-emerald-500" />;
      cardBorder =
        "border-emerald-250 bg-emerald-50/5 dark:bg-slate-900 dark:border-emerald-950/60 dark:ring-1 dark:ring-emerald-900/30";
    } else if (isPlanned) {
      statusBadgeColor = hasPlannedConflict
        ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40"
        : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/40";
      statusText = hasPlannedConflict
        ? "خطأ في الترتيب"
        : plannedCourses[course.id];
      statusIcon = <CalendarDays size={11} className="text-orange-500" />;
      cardBorder =
        "border-orange-250 bg-orange-50/5 dark:bg-slate-900 dark:border-orange-900/60 dark:ring-1 dark:ring-orange-900/30";
    } else if (isAvail) {
      statusBadgeColor =
        "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/60";
      statusText = "متاحة";
      statusIcon = <BookOpen size={11} className="text-blue-500" />;
      cardBorder =
        "border-blue-250 bg-blue-50/5 dark:bg-slate-900 dark:border-blue-950/60 dark:ring-1 dark:ring-blue-900/30 hover:border-blue-400";
    } else if (!prerequisitesCompleted) {
      statusText = "المتطلبات غير مكتملة";
    }

    // Override with pinned path styling (highest priority)
    if (pinnedCourseId) {
      // If any course is pinned
      if (isPinned) {
        cardBorder =
          "border-amber-450 bg-amber-50/15 ring-2 ring-amber-400 dark:ring-amber-500/50 shadow-md scale-[1.01] z-[2]";
      } else if (isAncestor) {
        cardBorder =
          "border-emerald-450 bg-emerald-50/5 ring-1 ring-emerald-300 dark:ring-emerald-500/50 shadow-sm";
      } else if (isDescendant) {
        cardBorder =
          "border-purple-450 bg-purple-50/5 ring-1 ring-purple-300 dark:ring-purple-500/50 shadow-sm";
      } else if (isPinnedPathNode) {
        cardBorder =
          "border-amber-200 bg-amber-50/5 dark:bg-amber-950/5 ring-1 ring-amber-100 dark:ring-amber-900/30";
      } else {
        // Dim courses not in the pinned path
        cardOpacity = 0.4;
      }
    } else if (hoveredCourseId) {
      // If no course is pinned, but one is hovered
      if (isHovered) {
        cardBorder =
          "border-blue-400 bg-blue-50/15 ring-2 ring-blue-300 dark:ring-blue-500/50 shadow-md scale-[1.01] z-[2]";
      } else if (isHoveredAncestor) {
        cardBorder =
          "border-emerald-300 bg-emerald-50/5 ring-1 ring-emerald-200 dark:ring-emerald-500/30 shadow-sm";
      } else if (isHoveredDescendant) {
        cardBorder =
          "border-purple-300 bg-purple-50/5 ring-1 ring-purple-200 dark:ring-purple-500/30 shadow-sm";
      } else if (isHoveredPathNode) {
        cardBorder =
          "border-blue-200 bg-blue-50/5 dark:bg-blue-950/5 ring-1 ring-blue-100 dark:ring-blue-900/30";
      } else {
        // Dim courses not in the hovered path
        cardOpacity = 0.4;
      }
    }

    return (
      <div
        key={slotId || course.id}
        className={cn(
          "course-list-card bg-white dark:bg-slate-800 p-3 rounded-xl border transition-all duration-300 flex flex-col gap-2 relative group hover:shadow-lg",
          cardBorder,
        )}
        style={{ opacity: cardOpacity }} // Apply opacity
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setHoveredCourseId(course.id);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setHoveredCourseId(null);
        }}
      >
        <div className="flex justify-between items-center text-[10px] font-bold">
          {slotLabel ? (
            <span className="text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/65 px-1.5 py-0.5 rounded border border-purple-250 dark:border-purple-900/65 font-black uppercase">
              {slotLabel}
            </span>
          ) : (
            <span className="text-blue-600 dark:text-blue-400 font-mono">
              {course.id}
            </span>
          )}
          <span className="text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-gray-100 dark:border-slate-800 shrink-0">
            {course.credits} س
          </span>
        </div>

        {slotId && ELECTIVE_SLOTS_DEFS[slotId] && (
          <div className="flex flex-col gap-1 bg-gray-50 dark:bg-slate-900 border border-gray-150 dark:border-slate-750 p-2 rounded-lg">
            <select
              value={selectedElectives[slotId] || course.id || ""}
              aria-label={`اختيار مادة ${ELECTIVE_SLOTS_DEFS[slotId].label}`}
              onChange={(e) =>
                setSelectedElectives((prev) => ({
                  ...prev,
                  [slotId]: e.target.value,
                }))
              }
              className="bg-transparent text-[11px] font-black text-gray-850 dark:text-slate-100 cursor-pointer outline-none"
            >
              {courses
                .filter(
                  (c: Course) =>
                    c.category === ELECTIVE_SLOTS_DEFS[slotId]?.category,
                )
                .map((opt: Course) => (
                  <option key={opt.id} value={opt.id} className="text-gray-900">
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
      className="flex-1 min-h-0 min-w-0 overflow-hidden bg-slate-50/40 dark:bg-slate-950/60 p-2 sm:p-5 flex flex-col"
      dir="rtl"
    >
      <div className="mb-3 sm:mb-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 sm:gap-4 bg-white dark:bg-slate-800 p-2 sm:p-3 rounded-2xl border border-gray-150 dark:border-slate-700/60 shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <LayoutList size={18} className="text-blue-500" />
          <span className="text-xs font-black text-gray-800 dark:text-slate-200">
            فرز وتصفح المواد:
          </span>
          <div className="mr-4 hidden md:flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 rounded-lg">
            <Pin size={12} className="text-amber-600 rotate-25" />
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
              ملاحظة: عند تثبيت مادة، يظهر كامل مسارها ويرتفع للأعلى.
            </span>
          </div>
        </div>
        <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-xl border border-gray-250 dark:border-slate-700">
          <button
            type="button"
            aria-pressed={listGroupBy === "category"}
            onClick={() => setListGroupBy("category")}
            className={cn(
              "px-4 py-1.5 text-xs font-black rounded-lg transition-all",
              listGroupBy === "category"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-500 hover:text-gray-800 dark:hover:text-slate-200",
            )}
          >
            حسب التصنيف
          </button>
          <button
            type="button"
            aria-pressed={listGroupBy === "semester"}
            onClick={() => setListGroupBy("semester")}
            className={cn(
              "px-4 py-1.5 text-xs font-black rounded-lg transition-all",
              listGroupBy === "semester"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-500 hover:text-gray-800 dark:hover:text-slate-200",
            )}
          >
            حسب الفصل
          </button>
        </div>
        <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 hidden lg:block" />
        <label className="flex items-center gap-2 cursor-pointer group shrink-0">
          <input
            type="checkbox"
            checked={hideCompletedInList}
            onChange={(e) => setHideCompletedInList(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-xs font-bold text-gray-600 dark:text-slate-400 group-hover:text-blue-600 transition-colors">
            إخفاء المواد المنجزة
          </span>
        </label>
      </div>

      {/* Mobile: Accordion View / Desktop: Horizontal Scroll View */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col sm:flex-row gap-3 sm:gap-5 overflow-y-auto sm:overflow-x-auto pb-4 items-start scrollbar-thin">
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
                const defaultCourse = slotDef
                  ? coursesById.get(slotDef.defaultCourseId)
                  : undefined;
                return sum + (defaultCourse?.credits || 0);
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
            if (cat.key.includes("جامعة اختياري"))
              itemsList = ["univ_1", "univ_2", "univ_3"].map(
                (slotId): ListItem => ({ type: "slot", slotId }),
              );
            else if (cat.key.includes("تخصص اختياري"))
              itemsList = [
                "spec_1",
                "spec_2",
                "spec_3",
                "spec_4",
                "spec_5",
              ].map((slotId): ListItem => ({ type: "slot", slotId }));
            else
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

          const activePathIds = pinnedPath?.allPathNodeIds;
          if (activePathIds) {
            itemsList = [...itemsList].sort((a, b) => {
              const aId =
                a.type === "course" ? a.course.id : selectedElectives[a.slotId];
              const bId =
                b.type === "course" ? b.course.id : selectedElectives[b.slotId];
              const aInPath = !!aId && activePathIds.has(aId);
              const bInPath = !!bId && activePathIds.has(bId);

              if (aInPath && !bInPath) return -1;
              if (!aInPath && bInPath) return 1;
              return 0;
            });
          }

          const isColumnDone = doneCr >= totalCr && totalCr > 0;
          const isExpanded = expandedCategories[cat.key] ?? true; // Default to expanded

          return (
            <div
              key={cat.key}
              className="w-full sm:w-72 max-w-75 shrink-0 bg-white dark:bg-slate-800 border border-gray-150 dark:border-slate-700/60 rounded-2xl flex flex-col shadow-sm overflow-hidden"
            >
              {/* Header - Clickable on mobile for accordion */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-controls={`category-content-${cat.key}`}
                aria-label={`${isExpanded ? "طي" : "توسيع"} فئة ${cat.label}`}
                className="p-4 bg-gray-50/50 dark:bg-slate-900/40 border-b border-gray-150 dark:border-slate-750 cursor-pointer sm:cursor-default"
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
                  <h3 className="text-xs font-black text-gray-800 dark:text-slate-100 truncate pr-2">
                    {cat.label}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-full border",
                        isColumnDone
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : "bg-blue-50 text-blue-700 border-blue-100",
                      )}
                    >
                      {doneCr} / {totalCr} س
                    </span>
                    <span className="sm:hidden text-gray-400">
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
                  className="h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden"
                >
                  <div
                    className={cn(
                      "h-full transition-all duration-1000",
                      isColumnDone ? "bg-emerald-500" : "bg-blue-500",
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
                    const course = selectedCourseId
                      ? coursesById.get(selectedCourseId)
                      : undefined;
                    if (course && ELECTIVE_SLOTS_DEFS[item.slotId]) {
                      return renderCard(
                        course,
                        ELECTIVE_SLOTS_DEFS[item.slotId].label,
                        item.slotId,
                      );
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
