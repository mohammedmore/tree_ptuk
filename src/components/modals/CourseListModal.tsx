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
import { cn } from "../../utils";
import type { Course } from "../../data";
import { categoryRequirements } from "../../data";

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
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-list-modal-title"
        className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-0 w-full max-w-4xl shadow-xl relative overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[90vh]"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <h2
            id="course-list-modal-title"
            className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5"
          >
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <LayoutList size={18} />
            </div>
            <span>قائمة المواد</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق قائمة المواد"
            className="min-h-10 min-w-10 flex items-center justify-center p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div
          role="group"
          aria-label="تصفية قائمة المواد"
          className="flex border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 pt-2 gap-4 sm:gap-6 bg-slate-50/50 dark:bg-slate-900/50 shrink-0 overflow-x-auto custom-scrollbar"
        >
          <button
            type="button"
            aria-pressed={courseListTab === "available"}
            className={cn(
              "pb-2.5 px-1 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap tabular-nums cursor-pointer",
              courseListTab === "available"
                ? "border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200",
            )}
            onClick={() => setCourseListTab("available")}
          >
            متاح للتسجيل ({availableCourses.length})
          </button>
          <button
            type="button"
            aria-pressed={courseListTab === "completed"}
            className={cn(
              "pb-2.5 px-1 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap tabular-nums cursor-pointer",
              courseListTab === "completed"
                ? "border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200",
            )}
            onClick={() => setCourseListTab("completed")}
          >
            منجز ({completedCourses.size})
          </button>
          <button
            type="button"
            aria-pressed={courseListTab === "all"}
            className={cn(
              "pb-2.5 px-1 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap tabular-nums cursor-pointer",
              courseListTab === "all"
                ? "border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200",
            )}
            onClick={() => setCourseListTab("all")}
          >
            كل المواد ({activeCourses.length})
          </button>
        </div>

        <div className="p-3 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">
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
                  className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {Object.values(expandedCourseListCategories).some(
                    (v) => v === true,
                  )
                    ? "طي الكل"
                    : "فرد الكل"}
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {Object.keys(filteredGroupedCourseList).length === 0 ? (
                <div
                  role="status"
                  className="text-center py-10 text-xs sm:text-sm font-medium text-slate-400"
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
                        className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs"
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
                          className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                            {category} ({items.length})
                          </span>
                          {isExpanded ? (
                            <ChevronUp size={15} />
                          ) : (
                            <ChevronDown size={15} />
                          )}
                        </button>

                        <div
                          id={categoryPanelId}
                          hidden={!isExpanded}
                          className="p-2.5 bg-white dark:bg-slate-900/50 space-y-2 grid grid-cols-1 sm:grid-cols-2 gap-2"
                        >
                          {items.map((c) => {
                            const isComp = completedCourses.has(c.id);

                            return (
                              <div
                                key={c.id}
                                className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 transition-colors flex justify-between items-center group relative"
                              >
                                <button
                                  type="button"
                                  className="flex flex-col items-start gap-0.5 cursor-pointer flex-1 text-right"
                                  aria-label={`عرض ${c.name} في الخريطة`}
                                  onClick={() => {
                                    focusNode(c.id);
                                    onClose();
                                  }}
                                >
                                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors line-clamp-1">
                                    {c.name}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                                    {c.id}
                                  </span>
                                </button>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 tabular-nums">
                                    {c.credits} س
                                  </span>

                                  <div className="flex gap-1 border-r border-slate-200 dark:border-slate-700 pr-1 mr-1">
                                    <button
                                      type="button"
                                      aria-label={
                                        isComp
                                          ? `إلغاء إنجاز ${c.name}`
                                          : `تحديد ${c.name} كمنجزة`
                                      }
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleCourseCompletion(c.id);
                                      }}
                                      className={cn(
                                        "p-1.5 rounded transition-colors cursor-pointer",
                                        isComp
                                          ? "text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-slate-700"
                                          : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700",
                                      )}
                                      title={
                                        isComp ? "إلغاء الإنجاز" : "تحديد كمنجز"
                                      }
                                    >
                                      {isComp ? (
                                        <Trash2 size={13} />
                                      ) : (
                                        <CircleCheckBig size={13} />
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
                                        "p-1.5 rounded transition-colors cursor-pointer",
                                        plannedCourses[c.id]
                                          ? "text-slate-900 bg-slate-200 dark:text-white dark:bg-slate-600"
                                          : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700",
                                      )}
                                      title="تخطيط المادة"
                                    >
                                      <CalendarDays size={13} />
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
