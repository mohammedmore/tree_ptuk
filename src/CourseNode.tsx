import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { CircleCheckBig, Lock, Info, CalendarDays, Snowflake } from "lucide-react";
import { cn } from "./utils";
import { formatOfferings } from "./courseOfferings";

const CourseNode = ({ data, isConnectable }: any) => {
    const { isSelected, isAncestor, isDescendant, isDirectPrereq, isDirectDep, isCompleted, isAvailable, isCriticalPath, isPlanned, toggleCompleted, showDetails, onPlan, opacity = 1, seasonal, availableSemesters } = data;
    const isLocked = !isCompleted && !isAvailable;

    let containerClass = "w-64 h-auto bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-2 shadow-sm relative group";
    let idClass = "text-[11px] text-gray-400 font-bold tracking-wider uppercase";
    let titleClass = "text-[13px] font-bold text-gray-700 leading-tight text-right line-clamp-3";

    if (isSelected) {
        containerClass = "w-64 h-auto bg-white border-2 border-blue-500 rounded-2xl p-4 flex flex-col gap-2 shadow-lg scale-105 z-10 relative group";
        idClass = "text-[11px] text-blue-600 font-bold tracking-wider uppercase";
        titleClass = "text-[13px] font-bold text-gray-900 leading-tight text-right line-clamp-3";
    } else if (isDirectPrereq) {
        containerClass = "w-64 h-auto bg-emerald-100 border-2 border-emerald-600 rounded-2xl p-4 flex flex-col gap-2 shadow-md relative group scale-105 z-10";
    } else if (isDirectDep) {
        containerClass = "w-64 h-auto bg-indigo-50 border-2 border-indigo-500 rounded-2xl p-4 flex flex-col gap-2 shadow-md relative group scale-105 z-10";
    } else if (isCompleted) {
        containerClass = "w-64 h-auto bg-[#f0fdf4] border-2 border-emerald-400 rounded-2xl p-4 flex flex-col gap-2 shadow-sm hover:shadow-md cursor-pointer transition-all relative group";
        idClass = "text-[11px] text-emerald-600 font-bold tracking-wider uppercase";
    } else if (isPlanned) {
        containerClass = "w-64 h-auto bg-orange-50 border-2 border-orange-400 rounded-2xl p-4 flex flex-col gap-2 shadow-sm hover:shadow-md cursor-pointer transition-all relative group";
    } else if (isAvailable) {
        containerClass = "w-64 h-auto bg-blue-50 border-2 border-blue-400 rounded-2xl p-4 flex flex-col gap-2 shadow-sm hover:shadow-md cursor-pointer transition-all relative group";
    } else if (opacity < 1) {
        containerClass = "w-64 h-auto bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-2 opacity-40 shadow-none relative group";
    }

    return (
        <div
            className={cn(containerClass, "transition-all duration-300")}
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
                className="absolute top-3 right-3 w-6 h-6 rounded flex items-center justify-center bg-gray-50 dark:bg-slate-700 text-gray-400 hover:text-blue-500 dark:text-slate-400 dark:hover:text-blue-400 border border-gray-200 dark:border-slate-600 transition-colors z-20"
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
                    "absolute top-3 left-12 w-6 h-6 rounded flex items-center justify-center transition-colors z-20 border",
                    isPlanned ? "bg-orange-500 text-white border-none" : "bg-gray-50 dark:bg-slate-700 text-gray-400 hover:text-orange-500 dark:border-slate-600"
                )}
                title="جدولة المساق في الخطة"
            >
                <CalendarDays size={14} />
            </button>

            <button
                onClick={(e) => { e.stopPropagation(); if (toggleCompleted) toggleCompleted(); }}
                className={cn(
                    "absolute top-3 left-3 w-6 h-6 rounded flex items-center justify-center transition-colors z-20",
                    isCompleted ? "bg-emerald-500 border-none text-white" : isLocked ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white border border-gray-300 hover:border-emerald-400",
                )}
                title={isCompleted ? "تحديد كغير منجز" : isLocked ? "مغلقة" : "تحديد كمنجز"}
            >
                {isCompleted && <CircleCheckBig size={16} className="text-white" />}
                {isLocked && !isCompleted && <Lock size={14} />}
            </button>

            <div className="pt-2">
                <div className="flex items-center gap-2 mb-1">
                    <span className={cn(idClass, "shrink-0 font-mono")}>{data.id}</span>
                    {data.commonName && (
                        <span className="text-[9px] font-black text-blue-600 bg-blue-50/80 px-1.5 py-0.5 rounded border border-blue-150 shrink-0">
                            {data.commonName}
                        </span>
                    )}
                </div>
                <div className={titleClass}>{data.label}</div>
            </div>

            <div className="space-y-2 text-[11px] font-medium">
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-gray-50/50 dark:bg-slate-800/30 rounded-lg">
                    <span className="text-gray-500 dark:text-slate-400">الفئة:</span>
                    <span className="text-gray-700 dark:text-slate-200 font-semibold text-right">{data.category}</span>
                </div>
                
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg">
                    <span className="text-blue-600 dark:text-blue-400">الساعات:</span>
                    <span className="text-blue-700 dark:text-blue-300 font-bold">{data.credits} ساعة</span>
                </div>

                {availableSemesters && availableSemesters.length > 0 && (
                    <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-purple-50/50 dark:bg-purple-900/20 rounded-lg">
                        <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                            <CalendarDays size={12} />
                            <span>الفصول:</span>
                        </div>
                        <span className="text-purple-700 dark:text-purple-300 font-semibold text-right" title={`متاح في: ${formatOfferings(availableSemesters)}`}>
                            {formatOfferings(availableSemesters)}
                        </span>
                    </div>
                )}
                {seasonal && !availableSemesters && (
                    <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <Snowflake size={12} />
                            <span>الفصول:</span>
                        </div>
                        <span className="text-blue-700 dark:text-blue-300 font-semibold">
                            {seasonal === 'first' ? 'الفصل الأول فقط' : seasonal === 'second' ? 'الفصل الثاني فقط' : 'كل الفصول'}
                        </span>
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Left} isConnectable={isConnectable} className="w-2 h-2 opacity-0" />
        </div>
    );
};

export default memo(CourseNode);