import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { CircleCheckBig, Lock, Info, CalendarDays, Snowflake } from "lucide-react";
import { cn } from "./utils";
import { formatOfferings } from "./courseOfferings";

const CourseNode = ({ data, isConnectable }: any) => {
    const { isSelected, isDirectPrereq, isDirectDep, isCompleted, isAvailable, isPlanned, toggleCompleted, showDetails, onPlan, opacity = 1, seasonal, availableSemesters } = data;
    const isLocked = !isCompleted && !isAvailable;

    const statusClass = isSelected
        ? "status-selected"
        : isDirectPrereq
          ? "status-prerequisite"
          : isDirectDep
            ? "status-dependent"
            : isCompleted
              ? "status-completed"
              : isPlanned
                ? "status-planned"
                : isAvailable
                  ? "status-available"
                  : "status-locked";
    const containerClass = cn(
        "course-node w-64 h-auto rounded-xl border p-4 flex flex-col gap-3 relative group transition-colors duration-200",
        statusClass,
        isLocked && "opacity-70",
        opacity < 1 && "opacity-40",
    );
    const badgeClass = "course-node-badge px-3 py-1.5 rounded-lg font-mono font-bold text-xs tracking-wider";

    return (
        <div
            className={containerClass}
            dir="rtl"
            onMouseEnter={(e) => data.onHoverStart && data.onHoverStart(e)}
            onMouseMove={(e) => data.onHoverMove && data.onHoverMove(e)}
            onMouseLeave={() => data.onHoverEnd && data.onHoverEnd()}
        >
            <Handle type="target" position={Position.Right} isConnectable={isConnectable} className="w-2 h-2 opacity-0" />

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (showDetails) showDetails();
                }}
                className="absolute top-3 right-3 w-7 h-7 rounded-xl flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-800 text-gray-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 border border-gray-200 dark:border-slate-600 transition-all duration-200 hover:scale-110 hover:shadow-md z-20"
                title="عرض التفاصيل والمعلومات"
            >
                <Info size={14} />
            </button>

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (onPlan) onPlan();
                }}
                className={cn(
                    "absolute top-3 left-12 w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-md z-20 border",
                    isPlanned 
                        ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none shadow-lg shadow-orange-200/50 dark:shadow-orange-900/30" 
                        : "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-800 text-gray-500 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400 border-gray-200 dark:border-slate-600"
                )}
                title="جدولة المساق في الخطة"
            >
                <CalendarDays size={14} />
            </button>

            <button
                onClick={(e) => { e.stopPropagation(); if (toggleCompleted) toggleCompleted(); }}
                className={cn(
                    "absolute top-3 left-3 w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-md z-20",
                    isCompleted 
                        ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-none shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30" 
                        : isLocked 
                            ? "bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-700 dark:to-slate-800 text-gray-400 cursor-not-allowed border border-gray-300 dark:border-slate-600" 
                            : "bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-700 border border-gray-300 dark:border-slate-600 text-gray-500 hover:border-emerald-400 hover:text-emerald-600 dark:text-slate-400 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
                )}
                title={isCompleted ? "تحديد كغير منجز" : isLocked ? "مغلقة" : "تحديد كمنجز"}
            >
                {isCompleted && <CircleCheckBig size={16} className="text-white" />}
                {isLocked && !isCompleted && <Lock size={14} />}
            </button>

            {/* Course Code Badge */}
            <div className={badgeClass}>
                {data.id}
            </div>

            {/* Course Name */}
            <div className="course-node-title text-[13px] font-bold leading-snug text-right line-clamp-2">{data.label}</div>

            {/* Credits and Info */}
            <div className="flex items-center justify-between gap-2">
                <div className="course-node-badge px-2.5 py-1 rounded-md text-xs font-bold">
                    {data.credits} ساعة
                </div>
                {availableSemesters && availableSemesters.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-slate-400 font-semibold">
                        <CalendarDays size={11} />
                        <span>{formatOfferings(availableSemesters)}</span>
                    </div>
                )}
                {seasonal && !availableSemesters && (
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-slate-400 font-semibold">
                        <Snowflake size={11} />
                        <span>
                            {seasonal === 'first' ? 'الفصل الأول فقط' : seasonal === 'second' ? 'الفصل الثاني فقط' : 'كل الفصول'}
                        </span>
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Left} isConnectable={isConnectable} className="w-2 h-2 opacity-0" />
        </div>
    );
};

const areCourseNodePropsEqual = (previous: any, next: any) => {
    const previousData = previous.data;
    const nextData = next.data;
    return previous.id === next.id
        && previous.selected === next.selected
        && previous.isConnectable === next.isConnectable
        && previousData.id === nextData.id
        && previousData.label === nextData.label
        && previousData.credits === nextData.credits
        && previousData.seasonal === nextData.seasonal
        && previousData.availableSemesters === nextData.availableSemesters
        && previousData.isSelected === nextData.isSelected
        && previousData.isDirectPrereq === nextData.isDirectPrereq
        && previousData.isDirectDep === nextData.isDirectDep
        && previousData.isCompleted === nextData.isCompleted
        && previousData.isAvailable === nextData.isAvailable
        && previousData.isPlanned === nextData.isPlanned
        && previousData.opacity === nextData.opacity;
};

export default memo(CourseNode, areCourseNodePropsEqual);