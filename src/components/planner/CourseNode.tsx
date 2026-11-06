import React, { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  Check,
  Lock,
  Pin,
  Calendar,
  Circle,
  X as XIcon,
  Flame,
} from "lucide-react";
import { cn } from "../../utils";
import { usePlannerNodeActions } from "./PlannerNodeActionsContext";

export interface CourseNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  credits: number;
  isSelected?: boolean;
  isPinned?: boolean;
  isFocused?: boolean;
  isPrerequisite?: boolean;
  isDependent?: boolean;
  isInPath?: boolean;
  isCompleted?: boolean;
  isAvailable?: boolean;
  isPlanned?: boolean;
  isElective?: boolean;
  isCriticalPath?: boolean;
  isInActiveCriticalPath?: boolean;
  criticalPathsCount?: number;
  grade?: number;
  showGrades?: boolean;
  minCredits?: number;
  hasCoRequisite?: boolean;
  offeringSeason?: "first" | "second" | "both" | "summer";
  opacity?: number;
  isDimmed?: boolean;
  toggleCompleted?: () => void;
  showDetails?: () => void;
  togglePin?: () => void;
}

export type CourseFlowNode = Node<CourseNodeData, "courseNode">;

const CourseNodeComponent = ({
  data,
  isConnectable,
}: NodeProps<CourseFlowNode>) => {
  const {
    id,
    label,
    credits,
    isSelected,
    isPinned,
    isFocused,
    isPrerequisite,
    isDependent,
    isCompleted,
    isAvailable,
    isPlanned,
    isElective,
    isCriticalPath,
    isInActiveCriticalPath,
    criticalPathsCount,
    grade,
    showGrades,
    minCredits,
    hasCoRequisite,
    offeringSeason,
    toggleCompleted,
    showDetails,
    togglePin,
    opacity = 1,
  } = data;

  const actions = usePlannerNodeActions();

  const handleDetails = () => {
    if (actions) {
      actions.onSelectDetails(id);
    } else {
      showDetails?.();
    }
  };

  const handlePin = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (actions) {
      actions.onTogglePin(id);
    } else {
      togglePin?.();
    }
  };

  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    if (actions) {
      actions.onToggleComplete(id);
    } else {
      toggleCompleted?.();
    }
  };

  const isDimmed = data.isDimmed || (opacity !== undefined && opacity < 0.8);
  const isLocked = !isCompleted && !isAvailable;

  // Determine state style with clean priority order & dual-color prerequisite/dependent highlight
  let containerStyle: string;
  let barColor: string;

  if (isCompleted) {
    containerStyle = "bg-[var(--accent-soft)] border border-[var(--accent)]";
    barColor = "bg-[var(--accent)]";
  } else if (isPrerequisite) {
    containerStyle =
      "bg-blue-500/10 border-[1.5px] border-blue-500 text-blue-600 dark:text-blue-400";
    barColor = "bg-blue-500";
  } else if (isDependent) {
    containerStyle =
      "bg-emerald-500/10 border-[1.5px] border-emerald-500 text-emerald-600 dark:text-emerald-400";
    barColor = "bg-emerald-500";
  } else if (isPlanned) {
    containerStyle =
      "bg-[var(--surface)] border-[1.5px] border-[var(--accent)]";
    barColor = "bg-[var(--accent)]";
  } else if (isAvailable) {
    containerStyle = isElective
      ? "bg-[var(--surface)] border border-dashed border-[var(--accent)]/60"
      : "bg-[var(--surface)] border border-[var(--line-control)]";
    barColor = isElective
      ? "bg-[var(--accent)]/50"
      : "bg-[var(--line-control)]";
  } else {
    // Locked
    containerStyle = isElective
      ? "bg-[var(--bg)] border border-dashed border-[var(--line-control)]/70 text-[var(--text-3)]"
      : "bg-[var(--bg)] border border-dashed border-[var(--line-control)] text-[var(--text-3)]";
    barColor = "bg-transparent";
  }

  const isHighlighted = isFocused || isPinned || isSelected;

  const statusLabel = isCompleted
    ? "منجز"
    : isPlanned
      ? "مخطط"
      : isAvailable
        ? "متاح للتسجيل"
        : "مغلق بمتطلب سابق";

  return (
    <div
      dir="rtl"
      role="button"
      tabIndex={0}
      aria-label={`مساق ${label}، رمز ${id}، ${credits} ساعات معتمدة، الحالة: ${statusLabel}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleDetails();
        }
      }}
      className={cn(
        "relative flex items-center justify-between px-2.5 py-1.5 select-none cursor-pointer rounded-[var(--r-control)]",
        "w-[200px] h-[64px] box-border transition-all duration-150 group outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
        containerStyle,
        isInActiveCriticalPath &&
          !isCompleted &&
          "border-amber-500 ring-2 ring-amber-500/70 bg-amber-500/10 shadow-xs",
        isPrerequisite &&
          "shadow-[0_0_14px_rgba(59,130,246,0.35)] ring-1 ring-blue-500/50",
        isDependent &&
          "shadow-[0_0_14px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500/50",
        isDimmed &&
          "opacity-25 grayscale-[60%] transition-opacity duration-200",
        !isDimmed && "opacity-100",
        isHighlighted &&
          "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)] shadow-sm",
        !isHighlighted &&
          !isInActiveCriticalPath &&
          !isPrerequisite &&
          !isDependent &&
          "hover:border-[var(--accent)]",
      )}
      onClick={handleDetails}
    >
      {/* Leading edge state indicator strip */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-[3px] rounded-r-[var(--r-control)]",
          barColor,
        )}
      />

      {/* Target Handle on Right (receives prerequisites) */}
      <Handle
        type="target"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-1.5 h-1.5 bg-[var(--line-control)] opacity-0 pointer-events-none"
      />

      {/* Course Info */}
      <div className="flex flex-col justify-center flex-1 min-w-0 pr-1 pl-1">
        <div className="flex items-center gap-1 min-w-0">
          <span
            className={cn(
              "text-[13.5px] font-semibold leading-[1.25] truncate",
              isLocked ? "text-[var(--text-3)]" : "text-[var(--text)]",
            )}
            title={label}
          >
            {label}
          </span>
          {showGrades && typeof grade === "number" && (
            <span
              className={cn(
                "text-[10px] font-bold tabular-nums px-1 rounded border shrink-0 leading-tight privacy-sensitive",
                grade >= 60
                  ? "text-[var(--accent)] bg-[var(--surface)] border-[var(--line-control)]"
                  : "text-[var(--danger)] bg-[var(--danger-soft)] border-[var(--danger)]",
              )}
              title={`العلامة المكتسبة: ${grade}`}
            >
              {grade}
            </span>
          )}
        </div>

        {/* Clean Meta row */}
        <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-3)] tabular-nums mt-0.5 flex-nowrap overflow-hidden">
          {isLocked && (
            <Lock size={10} className="shrink-0 text-[var(--text-3)]" />
          )}
          <bdi className="truncate font-mono text-[11px]">{id}</bdi>
          <span>•</span>
          <span className="shrink-0 tabular-nums">{credits} س</span>

          {/* Tri-state status badge: ✔ منجز / ⭕ مخطط / ✖ متبقي */}
          {isCompleted ? (
            <span
              className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-1 rounded shrink-0 leading-tight flex items-center gap-0.5"
              title="مادة منجزة بنجاح (✔)"
            >
              <Check size={9} strokeWidth={3} />
              منجز
            </span>
          ) : isPlanned ? (
            <span
              className="text-[9.5px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 px-1 rounded shrink-0 leading-tight flex items-center gap-0.5"
              title="مادة مدرجة في الخطة الفصلية (⭕)"
            >
              <Circle
                size={8}
                strokeWidth={2.5}
                className="fill-current text-sky-500"
              />
              مخطط
            </span>
          ) : (
            <span
              className="text-[9.5px] font-medium text-[var(--text-3)] bg-[var(--sunken)] border border-[var(--line-control)] px-1 rounded shrink-0 leading-tight flex items-center gap-0.5"
              title={
                isLocked
                  ? "مادة غير منجزة ومغلقة بمتطلب سابق (✖)"
                  : "مادة غير منجزة ومتاحة للتسجيل (✖)"
              }
            >
              <XIcon size={8} strokeWidth={2.5} className="text-slate-400" />
              متبقي
            </span>
          )}

          {/* Critical Path Badge */}
          {isCriticalPath && (
            <span
              className={cn(
                "text-[9px] font-bold px-1 rounded shrink-0 leading-tight flex items-center gap-0.5",
                isInActiveCriticalPath
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30",
              )}
              title={
                criticalPathsCount && criticalPathsCount > 1
                  ? `يقع ضمن ${criticalPathsCount} مسارات تخرج حرجة`
                  : "مساق في المسار الحرج المؤدي للتخرج"
              }
            >
              <Flame
                size={8.5}
                className="fill-current text-amber-500 shrink-0"
              />
              حرج
            </span>
          )}

          {isElective && (
            <span
              className="text-[9px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-1 rounded shrink-0 leading-tight"
              title="مساق اختياري"
            >
              اختياري
            </span>
          )}

          {isPrerequisite && (
            <span className="text-[9.5px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/15 border border-blue-500/30 px-1 rounded shrink-0 leading-tight">
              متطلب سابق
            </span>
          )}

          {isDependent && (
            <span className="text-[9.5px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1 rounded shrink-0 leading-tight">
              تفتحها
            </span>
          )}

          {offeringSeason === "first" && (
            <span
              className="text-[9px] text-[var(--accent)] bg-[var(--sunken)] px-1 rounded shrink-0"
              title="تطرح عادة في الفصل الأول (خريف) فقط"
            >
              خريف
            </span>
          )}
          {offeringSeason === "second" && (
            <span
              className="text-[9px] text-[var(--accent)] bg-[var(--sunken)] px-1 rounded shrink-0"
              title="تطرح عادة في الفصل الثاني (ربيع) فقط"
            >
              ربيع
            </span>
          )}

          {minCredits && minCredits > 0 ? (
            <span
              className="text-[9px] text-[var(--text-3)] bg-[var(--sunken)] px-1 rounded shrink-0"
              title={`يشترط ${minCredits} ساعة`}
            >
              {minCredits}+س
            </span>
          ) : null}

          {hasCoRequisite && (
            <span
              className="text-[9px] text-[var(--text-3)] bg-[var(--sunken)] px-1 rounded shrink-0"
              title="يشترط مساقاً متزامناً"
            >
              تزامن
            </span>
          )}
        </div>
      </div>

      {/* Trailing Controls: Pin and Completion Checkbox */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Pin button */}
        <button
          type="button"
          onClick={handlePin}
          title={isPinned ? "إلغاء تثبيت المسار" : "تثبيت مسار هذه المادة"}
          aria-label={isPinned ? "إلغاء تثبيت المسار" : "تثبيت مسار هذه المادة"}
          className={cn(
            "relative w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer before:absolute before:-inset-2 before:content-['']",
            isPinned
              ? "text-[var(--accent)] hover:bg-[var(--sunken)]"
              : "text-[var(--text-3)] opacity-0 group-hover:opacity-100 hover:text-[var(--text)] hover:bg-[var(--sunken)]",
          )}
        >
          <Pin
            size={12}
            className={cn(isPinned && "fill-current text-[var(--accent)]")}
          />
        </button>

        {/* Status Toggle Button (✔ منجز / ⭕ مخطط / ✖ متبقي) */}
        <button
          type="button"
          disabled={isLocked}
          onClick={handleToggle}
          aria-label={
            isCompleted
              ? `إلغاء إنجاز ${label} (منجز ✔)`
              : isPlanned
                ? `تحديد ${label} كمنجزة (مخطط ⭕)`
                : `تحديد ${label} كمنجزة (غير منجز ✖)`
          }
          title={
            isCompleted
              ? "مادة منجزة (✔) - انقر للإلغاء"
              : isPlanned
                ? "مادة مجدولة ومخططة (⭕) - انقر للتحديد كمنجزة"
                : isLocked
                  ? "مادة غير منجزة ومغلقة (✖) - تشترط متطلبات سابقة"
                  : "مادة غير منجزة (✖) - انقر للتحديد كمنجزة"
          }
          className={cn(
            "w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer",
            isCompleted
              ? "bg-emerald-600 text-white border border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500"
              : isPlanned
                ? "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-800 hover:border-emerald-500"
                : isLocked
                  ? "bg-[var(--sunken)] text-[var(--text-3)] border border-[var(--line)] cursor-not-allowed opacity-50"
                  : "bg-[var(--surface)] text-[var(--text-3)] border border-[var(--line-control)] hover:border-emerald-500 hover:text-emerald-600",
          )}
        >
          {isCompleted ? (
            <Check size={13} strokeWidth={2.8} />
          ) : isPlanned ? (
            <Circle size={9} strokeWidth={2.5} className="fill-current" />
          ) : isLocked ? (
            <Lock size={10} className="text-[var(--text-3)]" />
          ) : (
            <XIcon size={11} strokeWidth={2.2} />
          )}
        </button>
      </div>

      {/* Source Handle on Left (outputs dependencies) */}
      <Handle
        type="source"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-1.5 h-1.5 bg-[var(--line-control)] opacity-0 pointer-events-none"
      />
    </div>
  );
};

function areCourseNodePropsEqual(
  prevProps: NodeProps<CourseFlowNode>,
  nextProps: NodeProps<CourseFlowNode>,
): boolean {
  const p = prevProps.data;
  const n = nextProps.data;

  return (
    p.id === n.id &&
    p.label === n.label &&
    p.credits === n.credits &&
    p.isCompleted === n.isCompleted &&
    p.isAvailable === n.isAvailable &&
    p.isPlanned === n.isPlanned &&
    p.isSelected === n.isSelected &&
    p.isPinned === n.isPinned &&
    p.isFocused === n.isFocused &&
    p.isPrerequisite === n.isPrerequisite &&
    p.isDependent === n.isDependent &&
    p.isInPath === n.isInPath &&
    p.isElective === n.isElective &&
    p.opacity === n.opacity &&
    p.isDimmed === n.isDimmed &&
    p.isInActiveCriticalPath === n.isInActiveCriticalPath &&
    p.criticalPathsCount === n.criticalPathsCount &&
    p.grade === n.grade &&
    p.showGrades === n.showGrades &&
    p.minCredits === n.minCredits &&
    p.hasCoRequisite === n.hasCoRequisite &&
    p.offeringSeason === n.offeringSeason &&
    prevProps.selected === nextProps.selected
  );
}

export const CourseNode = memo(CourseNodeComponent, areCourseNodePropsEqual);
export default CourseNode;
