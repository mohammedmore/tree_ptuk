import React from "react";
import type { Course } from "../../data";
import { BookOpen, CheckCircle2, Clock } from "lucide-react";
import { cn } from "../../utils";

interface CoursePeekCardProps {
  course: Course;
  isCompleted: boolean;
  isPlanned?: boolean;
}

export const CoursePeekCard: React.FC<CoursePeekCardProps> = ({
  course,
  isCompleted,
  isPlanned = false,
}) => {
  return (
    <div
      dir="rtl"
      className="w-64 p-3 rounded-xl bg-[var(--surface)] border border-[var(--line-control)] shadow-xl text-right text-[12px] space-y-2 pointer-events-none animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-semibold text-[var(--text)] block truncate">
            {course.name}
          </span>
          <span className="text-[11px] font-mono text-[var(--text-3)]">
            {course.id}
          </span>
        </div>
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0",
            isCompleted
              ? "bg-emerald-500/10 text-emerald-500"
              : isPlanned
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "bg-[var(--sunken)] text-[var(--text-3)]",
          )}
        >
          {isCompleted ? "منجز" : isPlanned ? "مخطط" : "متاح"}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-[var(--text-2)] border-t border-[var(--line)] pt-2">
        <div className="flex items-center gap-1">
          <Clock size={12} className="text-[var(--text-3)]" />
          <span>{course.credits} ساعات</span>
        </div>
        <div className="flex items-center gap-1">
          <BookOpen size={12} className="text-[var(--text-3)]" />
          <span className="truncate">{course.category || "إجباري"}</span>
        </div>
      </div>

      {course.prerequisites && course.prerequisites.length > 0 && (
        <div className="text-[10px] text-[var(--text-3)] border-t border-[var(--line)] pt-1.5">
          <span className="font-medium text-[var(--text-2)]">المتطلبات: </span>
          <span>{course.prerequisites.join("، ")}</span>
        </div>
      )}
    </div>
  );
};
