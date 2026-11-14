import React from "react";
import type { Course } from "../../data";
import { BookOpen, Clock, Snowflake, Sun } from "lucide-react";
import { cn } from "../../utils";

export interface CoursePeekCardProps {
  course: Course;
  isCompleted: boolean;
  isPlanned?: boolean;
  isEquivalent?: boolean;
  prerequisiteNames?: Record<string, string>;
  currentDegreeCredits?: number;
}

export const CoursePeekCard: React.FC<CoursePeekCardProps> = ({
  course,
  isCompleted,
  isPlanned = false,
  isEquivalent = false,
  prerequisiteNames = {},
  currentDegreeCredits,
}) => {
  return (
    <div
      dir="rtl"
      className="w-72 p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--line-control)] shadow-2xl text-right text-[12px] space-y-2.5 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="font-bold text-[var(--text)] block truncate text-[13px]">
            {course.name}
          </span>
          <span className="text-[11px] font-mono text-[var(--text-3)] block mt-0.5">
            {course.id}
          </span>
        </div>
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0",
            isEquivalent
              ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30"
              : isCompleted
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                : isPlanned
                  ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30"
                  : "bg-[var(--sunken)] text-[var(--text-3)] border border-[var(--line)]",
          )}
        >
          {isEquivalent
            ? "معادل 🎓"
            : isCompleted
              ? "منجز ✔"
              : isPlanned
                ? "مخطط له ⭕"
                : "متاح ✖"}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-[var(--text-2)] border-t border-[var(--line)] pt-2">
        <div className="flex items-center gap-1">
          <Clock size={12} className="text-[var(--text-3)]" />
          <span>{course.credits} ساعات</span>
        </div>
        <div className="flex items-center gap-1 truncate">
          <BookOpen size={12} className="text-[var(--text-3)] shrink-0" />
          <span className="truncate">{course.category || "متطلب تخصص"}</span>
        </div>
      </div>

      {course.minCredits !== undefined && course.minCredits > 0 && (
        <div className="text-[11px] text-amber-700 dark:text-amber-400 border-t border-[var(--line)] pt-1.5 flex items-center justify-between font-medium">
          <span>تتطلب إنجاز {course.minCredits} س معتمدة</span>
          {currentDegreeCredits !== undefined && (
            <span className="font-mono text-[10px] font-bold">
              ({currentDegreeCredits}/{course.minCredits})
            </span>
          )}
        </div>
      )}

      {course.seasonal && (
        <div className="text-[11px] text-[var(--text-2)] border-t border-[var(--line)] pt-1.5 flex items-center gap-1.5">
          {course.seasonal === "first" ? (
            <>
              <Snowflake size={12} className="text-blue-500 shrink-0" />
              <span>يُطرح في الفصل الأول (خريف) فقط</span>
            </>
          ) : course.seasonal === "second" ? (
            <>
              <Sun size={12} className="text-amber-500 shrink-0" />
              <span>يُطرح في الفصل الثاني (ربيع) فقط</span>
            </>
          ) : course.seasonal === "summer" ? (
            <>
              <Sun size={12} className="text-orange-500 shrink-0" />
              <span>يُطرح في الفصل الصيفي</span>
            </>
          ) : (
            <span>مطروح في كلا الفصلين</span>
          )}
        </div>
      )}

      {course.prerequisites && course.prerequisites.length > 0 && (
        <div className="text-[11px] text-[var(--text-3)] border-t border-[var(--line)] pt-1.5">
          <span className="font-semibold text-[var(--text-2)] block mb-1">
            المتطلبات السابقة:
          </span>
          <div className="flex flex-wrap gap-1">
            {course.prerequisites.map((pId) => (
              <span
                key={pId}
                className="px-1.5 py-0.5 rounded bg-[var(--sunken)] border border-[var(--line)] text-[10px] text-[var(--text)] font-medium inline-flex items-center gap-1"
              >
                <span>{prerequisiteNames[pId] || pId}</span>
                <span className="text-[9px] font-mono text-[var(--text-3)]">
                  ({pId})
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursePeekCard;
