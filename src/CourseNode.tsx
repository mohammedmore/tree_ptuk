import React, { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { CircleCheckBig, Lock, Info, CalendarDays, Snowflake } from "lucide-react";
import { cn } from "./utils";
import { formatOfferings } from "./courseOfferings";
import type { Course } from "./data";

interface CourseNodeData extends Record<string, unknown> {
    id: string;
    label: string;
    credits: number;
    seasonal?: Course["seasonal"];
    availableSemesters?: Course["availableSemesters"];
    isSelected?: boolean;
    isDirectPrereq?: boolean;
    isDirectDep?: boolean;
    isCompleted?: boolean;
    isAvailable?: boolean;
    isPlanned?: boolean;
    opacity?: number;
    toggleCompleted?: () => void;
    showDetails?: () => void;
    onPlan?: () => void;
    onHoverStart?: () => void;
    onHoverMove?: () => void;
    onHoverEnd?: () => void;
}

type CourseFlowNode = Node<CourseNodeData, "courseNode">;

const CourseNode = ({ data, isConnectable }: NodeProps<CourseFlowNode>) => {
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
            onMouseEnter={() => data.onHoverStart?.()}
            onMouseMove={() => data.onHoverMove?.()}
            onMouseLeave={() => data.onHoverEnd?.()}
        >
            <Handle type="target" position={Position.Right} isConnectable={isConnectable} className="w-2 h-2 opacity-0" />

            <button
                type="button"
                className="nodrag absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-600 transition-colors z-20"
                aria-label={`عرض تفاصيل ${data.label}`}
                title="عرض التفاصيل والمعلومات"
                onClick={(e) => {
                    e.stopPropagation();
                    if (showDetails) showDetails();
                }}
            >
                <Info size={14} />
            </button>

            <button
                type="button"
                className={cn(
                    "nodrag absolute top-3 left-12 w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-md z-20 border",
                    isPlanned
                        ? "bg-blue-700 text-white border-blue-700"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300 border-slate-200 dark:border-slate-600"
                )}
                aria-label={`${isPlanned ? "تعديل جدولة" : "جدولة"} ${data.label}`}
                aria-pressed={isPlanned}
                title="جدولة المساق في الخطة"
                onClick={(e) => {
                    e.stopPropagation();
                    if (onPlan) onPlan();
                }}
            >
                <CalendarDays size={14} />
            </button>

            <button
                type="button"
                className={cn(
                    "nodrag absolute top-3 left-3 w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-md z-20",
                    isCompleted
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : isLocked
                            ? "bg-slate-200 dark:bg-slate-700 text-slate-500 cursor-pointer border border-slate-300 dark:border-slate-600"
                            : "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-600 hover:border-emerald-500 hover:text-emerald-700 dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
                )}
                aria-label={`${isCompleted ? "تحديد غير مكتمل" : "تحديد مكتمل"}: ${data.label}`}
                aria-pressed={isCompleted}
                title={isCompleted ? "تحديد كغير منجز" : isLocked ? "تسجيل اجتياز سابق للمادة دون تغيير متطلباتها" : "تحديد كمنجز"}
                onClick={(e) => { e.stopPropagation(); if (toggleCompleted) toggleCompleted(); }}
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

const areCourseNodePropsEqual = (
    previous: NodeProps<CourseFlowNode>,
    next: NodeProps<CourseFlowNode>,
) => {
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
        && previousData.opacity === nextData.opacity
        && previousData.toggleCompleted === nextData.toggleCompleted
        && previousData.showDetails === nextData.showDetails
        && previousData.onPlan === nextData.onPlan
        && previousData.onHoverStart === nextData.onHoverStart
        && previousData.onHoverMove === nextData.onHoverMove
        && previousData.onHoverEnd === nextData.onHoverEnd;
};

export default memo(CourseNode, areCourseNodePropsEqual);