import React from "react";
import { Handle, Position } from "@xyflow/react";
import { CircleCheckBig, Lock, Info, CalendarDays } from "lucide-react";
import { cn } from "./utils";

const CourseNode = ({ data, isConnectable }: any) => {
    const { isSelected, isAncestor, isDescendant, isDirectPrereq, isDirectDep, isCompleted, isAvailable, isCriticalPath, isPlanned, toggleCompleted, showDetails, onPlan, opacity = 1 } = data;
    const isLocked = !isCompleted && !isAvailable;

    let containerClass = "w-52 h-24 bg-white border border-gray-200 rounded-xl p-3 flex flex-col justify-between shadow-sm relative group";
    let idClass = "text-[10px] text-gray-400 font-bold tracking-wider uppercase";
    let titleClass = "text-[11px] font-bold text-gray-700 leading-tight text-center px-6 line-clamp-2";

    if (isSelected) {
        containerClass = "w-52 h-24 bg-white border-2 border-blue-500 rounded-xl p-3 flex flex-col justify-between shadow-lg scale-105 z-10 relative group";
        idClass = "text-[10px] text-blue-600 font-bold tracking-wider uppercase";
        titleClass = "text-[11px] font-bold text-gray-900 leading-tight text-center px-6 line-clamp-2";
    } else if (isDirectPrereq) {
        containerClass = "w-52 h-24 bg-emerald-100 border-2 border-emerald-600 rounded-xl p-3 flex flex-col justify-between shadow-md relative group scale-105 z-10";
    } else if (isDirectDep) {
        containerClass = "w-52 h-24 bg-indigo-50 border-2 border-indigo-500 rounded-xl p-3 flex flex-col justify-between shadow-md relative group scale-105 z-10";
    } else if (isCompleted) {
        containerClass = "w-52 h-24 bg-[#f0fdf4] border-2 border-emerald-400 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:shadow-md cursor-pointer transition-all relative group";
        idClass = "text-[10px] text-emerald-600 font-bold tracking-wider uppercase";
    } else if (isPlanned) {
        containerClass = "w-52 h-24 bg-orange-50 border-2 border-orange-400 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:shadow-md cursor-pointer transition-all relative group";
    } else if (isAvailable) {
        containerClass = "w-52 h-24 bg-blue-50 border-2 border-blue-400 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:shadow-md cursor-pointer transition-all relative group";
    } else if (opacity < 1) {
        containerClass = "w-52 h-24 bg-white border border-gray-200 rounded-xl p-3 flex flex-col justify-between opacity-40 shadow-none relative group";
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
                className="absolute top-3 right-3 w-5 h-5 rounded flex items-center justify-center bg-gray-50 dark:bg-slate-700 text-gray-400 hover:text-blue-500 dark:text-slate-400 dark:hover:text-blue-400 border border-gray-200 dark:border-slate-600 transition-colors z-20"
                title="عرض التفاصيل والمعلومات"
            >
                <Info size={12} />
            </button>

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (onPlan) onPlan();
                }}
                className={cn(
                    "absolute top-3 left-9 w-5 h-5 rounded flex items-center justify-center transition-colors z-20 border",
                    isPlanned ? "bg-orange-500 text-white border-none" : "bg-gray-50 dark:bg-slate-700 text-gray-400 hover:text-orange-500 dark:border-slate-600"
                )}
                title="جدولة المساق في الخطة"
            >
                <CalendarDays size={12} />
            </button>

            <button
                onClick={(e) => { e.stopPropagation(); if (toggleCompleted) toggleCompleted(); }}
                className={cn(
                    "absolute top-3 left-3 w-5 h-5 rounded flex items-center justify-center transition-colors z-20",
                    isCompleted ? "bg-emerald-500 border-none text-white" : isLocked ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white border border-gray-300 hover:border-emerald-400",
                )}
                title={isCompleted ? "تحديد كغير منجز" : isLocked ? "مغلقة" : "تحديد كمنجز"}
            >
                {isCompleted && <CircleCheckBig size={14} className="text-white" />}
                {isLocked && !isCompleted && <Lock size={12} />}
            </button>

            <div className="flex-1 flex flex-col justify-center py-1">
                <div className="flex items-center justify-center gap-1.5 mb-1 px-6">
                    <span className={cn(idClass, "shrink-0 font-mono")}>{data.id}</span>
                    {data.commonName && (
                        <span className="text-[8px] font-black text-blue-600 bg-blue-50/80 px-1 rounded border border-blue-150 shrink-0">
                            {data.commonName}
                        </span>
                    )}
                </div>
                <div className={titleClass}>{data.label}</div>
            </div>

            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100/50">
                <span className="text-[10px] font-medium text-gray-500 bg-gray-100/50 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                    {data.category}
                </span>
                <span className="text-[10px] font-bold text-gray-600 bg-gray-100/50 px-1.5 py-0.5 rounded">
                    {data.credits} س
                </span>
            </div>

            <Handle type="source" position={Position.Left} isConnectable={isConnectable} className="w-2 h-2 opacity-0" />
        </div>
    );
};

export default CourseNode;