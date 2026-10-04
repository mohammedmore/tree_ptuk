import React from "react";
import {
  X,
  LayoutList,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CircleCheckBig,
  Trash2,
  CalendarDays,
  Search,
} from "lucide-react";
import { cn } from "../utils";
import type { Course } from "../data";
import { categoryRequirements } from "../data";

interface CourseListModalProps {
  isCourseListModalOpen: boolean;
  onClose: () => void;
  courseListTab: "available" | "completed" | "all";
  setCourseListTab: React.Dispatch<
    React.SetStateAction<"available" | "completed" | "all">
  >;
  availableCourses: Course[];
  completedCourses: Set<string>;
  activeCourses: Course[];
  groupedCourseList: Record<string, Course[]>;
  expandedCourseListCategories: Record<string, boolean>;
  setExpandedCourseListCategories: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  focusNode: (id: string) => void;
  toggleCourseCompletion: (courseId: string) => void;
  setPlanningCourseId: (id: string | null) => void;
  setIsPlannerOpen: (isOpen: boolean) => void;
  completedCreditsPerCategory: Record<string, number>;
  plannedCourses: Record<string, string>;
}

const CourseListModal: React.FC<CourseListModalProps> = ({
  isCourseListModalOpen,
  onClose,
  courseListTab,
  setCourseListTab,
  availableCourses,
  completedCourses,
  activeCourses,
  groupedCourseList,
  expandedCourseListCategories,
  setExpandedCourseListCategories,
  focusNode,
  toggleCourseCompletion,
  setPlanningCourseId,
  setIsPlannerOpen,
  completedCreditsPerCategory,
  plannedCourses,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    if (!isCourseListModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCourseListModalOpen, onClose]);

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  if (!isCourseListModalOpen) return null;

  const filteredGroupedCourseList = Object.entries(groupedCourseList).reduce<
    Record<string, Course[]>
  >((filteredGroups, [category, items]) => {
    const filteredItems = items.filter(
      (course) =>
        course.name.toLocaleLowerCase().includes(normalizedSearchQuery) ||
        course.id.toLocaleLowerCase().includes(normalizedSearchQuery),
    );
    if (filteredItems.length > 0) filteredGroups[category] = filteredItems;
    return filteredGroups;
  }, {});

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-list-modal-title"
        className="bg-white dark:bg-slate-900 rounded-3xl p-0 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden border border-gray-100 dark:border-slate-700 flex flex-col max-h-[90vh]"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500"></div>

        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-950/20 shrink-0">
          <h2
            id="course-list-modal-title"
            className="text-xl font-black text-gray-800 dark:text-slate-100 flex items-center gap-3"
          >
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-none">
              <LayoutList size={24} />
            </div>
            <span>قائمة المواد</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق قائمة المواد"
            className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X />
          </button>
        </div>

        {/* Tabs */}
        <div
          role="group"
          aria-label="تصفية قائمة المواد"
          className="flex border-b border-gray-100 dark:border-slate-700 px-6 pt-2 gap-6 bg-gray-50/30 dark:bg-slate-900/30 shrink-0"
        >
          <button
            type="button"
            aria-pressed={courseListTab === "available"}
            className={cn(
              "pb-3 px-1 text-sm font-black border-b-2 transition-colors",
              courseListTab === "available"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200",
            )}
            onClick={() => setCourseListTab("available")}
          >
            متاح للتسجيل ({availableCourses.length})
          </button>
          <button
            type="button"
            aria-pressed={courseListTab === "completed"}
            className={cn(
              "pb-3 px-1 text-sm font-black border-b-2 transition-colors",
              courseListTab === "completed"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200",
            )}
            onClick={() => setCourseListTab("completed")}
          >
            منجز ({completedCourses.size})
          </button>
          <button
            type="button"
            aria-pressed={courseListTab === "all"}
            className={cn(
              "pb-3 px-1 text-sm font-black border-b-2 transition-colors",
              courseListTab === "all"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200",
            )}
            onClick={() => setCourseListTab("all")}
          >
            كل المواد ({activeCourses.length})
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 scrollbar-thin">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                aria-label="البحث عن مادة بالاسم أو الرمز"
                placeholder="ابحث عن مادة باسمها أو رمزها..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-slate-200"
              />
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-gray-500 dark:text-slate-400 flex items-center gap-2">
                <BookOpen size={14} /> تصنيف المواد حسب النوع
              </h3>
              {Object.keys(groupedCourseList).length > 0 && (
                <button
                  type="button"
                  aria-label={
                    Object.values(expandedCourseListCategories).some(
                      (value) => value,
                    )
                      ? "طي جميع التصنيفات"
                      : "فرد جميع التصنيفات"
                  }
                  onClick={() => {
                    const isAnyOpen = Object.values(
                      expandedCourseListCategories,
                    ).some((v) => v === true);
                    const newState: Record<string, boolean> = {};
                    if (!isAnyOpen)
                      Object.keys(groupedCourseList).forEach((cat) => {
                        newState[cat] = true;
                      });
                    setExpandedCourseListCategories(newState);
                  }}
                  className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  {Object.values(expandedCourseListCategories).some(
                    (v) => v === true,
                  )
                    ? "طي الكل"
                    : "فرد الكل"}
                </button>
              )}
            </div>

            <div className="space-y-3">
              {Object.keys(filteredGroupedCourseList).length === 0 ? (
                <div
                  role="status"
                  className="text-center py-10 text-sm font-bold text-gray-400"
                >
                  {normalizedSearchQuery
                    ? "لا توجد مواد تطابق البحث حالياً"
                    : courseListTab === "available"
                      ? "لا توجد مواد متاحة للتسجيل حالياً"
                      : courseListTab === "completed"
                        ? "لم تُسجل أي مواد كمنجزة بعد"
                        : "لا توجد مواد لعرضها حالياً"}
                </div>
              ) : (
                Object.entries(filteredGroupedCourseList).map(
                  ([category, items], categoryIndex) => {
                    const isExpanded =
                      expandedCourseListCategories[category] === true;
                    const categoryPanelId = `course-list-category-${categoryIndex}`;
                    return (
                      <div
                        key={category}
                        className="border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm"
                      >
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={categoryPanelId}
                          onClick={() =>
                            setExpandedCourseListCategories((prev) => ({
                              ...prev,
                              [category]: !isExpanded,
                            }))
                          }
                          className="w-full flex items-center justify-between p-3.5 bg-gray-50 dark:bg-slate-800/80 hover:bg-gray-100 transition-colors"
                        >
                          <span className="text-[12px] font-black text-gray-700 dark:text-slate-200">
                            {category} ({items.length})
                          </span>
                          {isExpanded ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </button>

                        <div
                          id={categoryPanelId}
                          hidden={!isExpanded}
                          className="p-3 bg-white dark:bg-slate-900/50 space-y-2 animate-in slide-in-from-top-1 duration-200 grid grid-cols-1 sm:grid-cols-2 gap-2"
                        >
                          {items.map((c) => {
                            const isComp = completedCourses.has(c.id);
                            const req = categoryRequirements[c.category] || 999;
                            const comp =
                              completedCreditsPerCategory[c.category] || 0;
                            const isGroupCompleted = comp >= req;
                            const isElective = c.category.includes("اختياري");
                            const isLocked =
                              isGroupCompleted && isElective && !isComp;

                            return (
                              <div
                                key={c.id}
                                className="w-full p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl hover:border-blue-400 hover:shadow-md transition-all flex justify-between items-center group relative overflow-hidden"
                              >
                                <button
                                  type="button"
                                  className="flex flex-col items-start gap-1 cursor-pointer flex-1 text-right"
                                  aria-label={`عرض ${c.name} في الخريطة`}
                                  onClick={() => {
                                    focusNode(c.id);
                                    onClose();
                                  }}
                                >
                                  <span className="text-[11px] font-black text-gray-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors line-clamp-1">
                                    {c.name}
                                  </span>
                                  <span className="text-[9px] font-mono text-gray-400">
                                    {c.id}
                                  </span>
                                </button>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">
                                    {c.credits} س
                                  </span>

                                  <div className="flex gap-1 border-r border-gray-100 dark:border-slate-700 pr-1 mr-1">
                                    <button
                                      type="button"
                                      aria-label={
                                        isComp
                                          ? `إلغاء إنجاز ${c.name}`
                                          : `تحديد ${c.name} كمنجزة`
                                      }
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isLocked)
                                          toggleCourseCompletion(c.id);
                                      }}
                                      className={cn(
                                        "p-1.5 rounded-lg transition-colors",
                                        isComp
                                          ? "text-red-500 bg-red-50 dark:bg-red-900/20"
                                          : "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
                                        isLocked &&
                                          "opacity-50 cursor-not-allowed",
                                      )}
                                      title={
                                        isComp
                                          ? "إلغاء الإنجاز"
                                          : isLocked
                                            ? "المجموعة مكتملة"
                                            : "تحديد كمنجز"
                                      }
                                      disabled={isLocked}
                                    >
                                      {isComp ? (
                                        <Trash2 size={14} />
                                      ) : (
                                        <CircleCheckBig size={14} />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`${plannedCourses[c.id] ? "تعديل تخطيط" : "تخطيط"} ${c.name}`}
                                      aria-pressed={Boolean(
                                        plannedCourses[c.id],
                                      )}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPlanningCourseId(c.id);
                                        setIsPlannerOpen(true);
                                        onClose();
                                      }}
                                      className={cn(
                                        "p-1.5 rounded-lg transition-colors",
                                        plannedCourses[c.id]
                                          ? "text-orange-500 bg-orange-50 dark:bg-orange-900/20"
                                          : "text-gray-400 hover:text-orange-500",
                                      )}
                                      title="تخطيط المادة"
                                    >
                                      <CalendarDays size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  },
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseListModal;
