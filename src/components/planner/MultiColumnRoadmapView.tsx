import React from "react";
import {
  Clock,
  CheckCircle2,
  Lock,
  Unlock,
  Trash2,
  Plus,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import type { Course } from "../../data";
import type { BottleneckInfo } from "../../utils/planningEnhancements";
import { triggerHaptic } from "../../utils/haptics";
import { cn } from "../../utils";

export interface MultiColumnRoadmapViewProps {
  multiScrollRef: React.RefObject<HTMLDivElement | null>;
  semesters: readonly string[];
  transcriptSemestersMap: Map<string, any>;
  lockedSemesters: Set<string>;
  plannedCourses: Record<string, string>;
  coursesById: Map<string, Course>;
  activeSemester: string;
  localHighGpa: boolean;
  dragOverSemester: string | null;
  draggedCourseId: string | null;
  bottleneckMap: Map<string, BottleneckInfo>;
  getSemesterCreditLimit: (sem: string, isHighGpa: boolean) => number;
  checkCoursePrerequisites: (
    course: Course,
    sem: string,
  ) => {
    ok: boolean;
    missingPrereqNames: string[];
    creditThresholdViolated?: boolean;
    minCreditsRequired?: number;
  };
  checkCourseSeasonality: (
    course: Course,
    sem: string,
  ) => { isMismatch: boolean; label: string };
  setDragOverSemester: (sem: string | null) => void;
  setDraggedCourseId: (id: string | null) => void;
  handleMoveCourseToSemester: (courseId: string, sem: string) => void;
  handleToggleLockSemester: (sem: string) => void;
  handleRemoveCourse: (courseId: string) => void;
  onSelectSemester: (sem: string) => void;
}

export const MultiColumnRoadmapView: React.FC<MultiColumnRoadmapViewProps> = ({
  multiScrollRef,
  semesters,
  transcriptSemestersMap,
  lockedSemesters,
  plannedCourses,
  coursesById,
  activeSemester,
  localHighGpa,
  dragOverSemester,
  draggedCourseId,
  bottleneckMap,
  getSemesterCreditLimit,
  checkCoursePrerequisites,
  checkCourseSeasonality,
  setDragOverSemester,
  setDraggedCourseId,
  handleMoveCourseToSemester,
  handleToggleLockSemester,
  handleRemoveCourse,
  onSelectSemester,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg)] overflow-hidden">
      {/* Horizontal Scroll Columns */}
      <div
        ref={multiScrollRef}
        className="flex-1 overflow-x-auto p-4 sm:p-6 bg-[var(--bg)] custom-scrollbar min-h-0"
      >
        <div className="flex items-start gap-4 min-w-max pb-16">
          {semesters.map((sem) => {
            const transRecord = transcriptSemestersMap.get(sem);
            const isSemFromTranscript = Boolean(transRecord);
            const isLocked = lockedSemesters.has(sem);
            const isDragOver = dragOverSemester === sem;

            const semCourses = isSemFromTranscript
              ? []
              : Object.entries(plannedCourses)
                  .filter(([, s]) => s === sem)
                  .map(([id]) => coursesById.get(id))
                  .filter((c): c is Course => Boolean(c));

            const semCredits = isSemFromTranscript
              ? transRecord!.isCurrentOrInProgress
                ? transRecord!.registeredCredits || transRecord!.totalCredits
                : transRecord!.passedCredits
              : semCourses.reduce((sum, c) => sum + c.credits, 0);

            const semLimit = getSemesterCreditLimit(sem, localHighGpa);
            const isOver = !isSemFromTranscript && semCredits > semLimit;
            const isCurrent = sem === activeSemester;

            return (
              <div
                key={sem}
                data-semester={sem}
                onDragOver={(e) => {
                  if (!isSemFromTranscript && !isLocked) {
                    e.preventDefault();
                    setDragOverSemester(sem);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverSemester === sem) {
                    setDragOverSemester(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverSemester(null);
                  if (draggedCourseId && !isSemFromTranscript && !isLocked) {
                    handleMoveCourseToSemester(draggedCourseId, sem);
                    setDraggedCourseId(null);
                  }
                }}
                className={cn(
                  "w-[290px] sm:w-[320px] shrink-0 bg-[var(--surface)] border rounded-2xl flex flex-col shadow-sm overflow-hidden transition-all",
                  isDragOver &&
                    "ring-2 ring-[var(--accent)] border-[var(--accent)] bg-[var(--accent-soft)]/15 scale-[1.01]",
                  isCurrent
                    ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20 shadow-md"
                    : isSemFromTranscript
                      ? transRecord?.isCurrentOrInProgress
                        ? "border-blue-500/30"
                        : "border-emerald-500/30"
                      : isLocked
                        ? "border-amber-500/30 bg-amber-500/[0.02]"
                        : "border-[var(--line)]",
                )}
              >
                {/* Semester Header */}
                <div
                  className={cn(
                    "p-3.5 border-b",
                    isSemFromTranscript
                      ? transRecord?.isCurrentOrInProgress
                        ? "border-blue-500/20 bg-blue-500/5"
                        : "border-emerald-500/20 bg-emerald-500/5"
                      : isLocked
                        ? "border-amber-500/20 bg-amber-500/5"
                        : "border-[var(--line)] bg-[var(--sunken)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex flex-col min-w-0 pr-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-[14px] text-[var(--text)] truncate">
                          {sem}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--accent)] text-[var(--text-on-accent)]">
                            الحالي
                          </span>
                        )}
                        {isSemFromTranscript && (
                          <span
                            className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-0.5",
                              transRecord?.isCurrentOrInProgress
                                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                            )}
                          >
                            {transRecord?.isCurrentOrInProgress ? (
                              <>
                                <Clock size={10} />
                                قيد الدراسة
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={10} />
                                معتمد
                              </>
                            )}
                          </span>
                        )}
                        {isLocked && !isSemFromTranscript && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-0.5">
                            <Lock size={10} />
                            مقفل
                          </span>
                        )}
                      </div>
                      {isSemFromTranscript && transRecord && (
                        <span
                          className={cn(
                            "text-[11px] font-medium truncate mt-0.5",
                            transRecord.isCurrentOrInProgress
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-emerald-600 dark:text-emerald-400",
                          )}
                        >
                          {transRecord.originalTitle}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={cn(
                          "text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-md",
                          isSemFromTranscript
                            ? transRecord?.isCurrentOrInProgress
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold"
                            : isOver
                              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                              : "bg-[var(--surface)] text-[var(--text-2)] border border-[var(--line-control)]",
                        )}
                      >
                        {isSemFromTranscript
                          ? transRecord!.isCurrentOrInProgress
                            ? `${transRecord!.registeredCredits || transRecord!.totalCredits} س مسجلة`
                            : `${transRecord!.passedCredits} س محتسبة`
                          : `${semCredits} / ${semLimit} س`}
                      </span>

                      {!isSemFromTranscript && (
                        <button
                          type="button"
                          onClick={() => handleToggleLockSemester(sem)}
                          className={cn(
                            "p-1 rounded-md transition-colors cursor-pointer",
                            isLocked
                              ? "text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30"
                              : "text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface)] border border-transparent",
                          )}
                          title={
                            isLocked
                              ? "الفصل مقفل ومحمي (انقر لفتح القفل)"
                              : "قفل الفصل لمنع التعديل التلقائي"
                          }
                        >
                          {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress strip */}
                  <div className="w-full h-1 bg-[var(--line)] rounded-full mt-2.5 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        isSemFromTranscript
                          ? "bg-emerald-500"
                          : isOver
                            ? "bg-rose-500"
                            : "bg-[var(--accent)]",
                      )}
                      style={{
                        width: isSemFromTranscript
                          ? "100%"
                          : `${Math.min(100, (semCredits / semLimit) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Planned Course Cards */}
                <div className="p-3 space-y-2.5 flex-1 max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar">
                  {isSemFromTranscript && transRecord ? (
                    /* Official Transcript Courses */
                    transRecord.courses.map((tc: any) => (
                      <div
                        key={tc.code}
                        className="p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors flex items-center justify-between text-[12px]"
                      >
                        <div className="overflow-hidden min-w-0 pr-1 flex-1">
                          <span className="font-semibold text-[13px] text-[var(--text)] truncate block">
                            {tc.name}
                          </span>
                          <div className="text-[10px] text-[var(--text-3)] font-mono flex items-center gap-1.5 mt-0.5">
                            <span dir="ltr">{tc.code}</span>
                            <span>•</span>
                            <span>{tc.credits} س</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-left">
                          {tc.grade !== null &&
                          typeof tc.grade === "number" &&
                          tc.grade >= 0 ? (
                            <span
                              className={cn(
                                "font-bold tabular-nums text-[13px] block privacy-sensitive",
                                tc.grade >= 60
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-amber-600",
                              )}
                            >
                              {tc.grade}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10">
                              {tc.status || "ناجح"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : semCourses.length > 0 ? (
                    semCourses.map((c) => {
                      const prereqStatus = checkCoursePrerequisites(c, sem);
                      const seasonInfo = checkCourseSeasonality(c, sem);
                      const bInfo = bottleneckMap.get(c.id);

                      return (
                        <div
                          key={c.id}
                          draggable={!isLocked}
                          onDragStart={() => setDraggedCourseId(c.id)}
                          onDragEnd={() => setDraggedCourseId(null)}
                          className={cn(
                            "p-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-control)] transition-all shadow-2xs",
                            draggedCourseId === c.id &&
                              "opacity-40 ring-2 ring-[var(--accent)]",
                            !isLocked
                              ? "cursor-grab active:cursor-grabbing"
                              : "",
                          )}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="font-mono text-[10px] text-[var(--text-3)] block"
                                  dir="ltr"
                                >
                                  {c.id}
                                </span>
                                {bInfo && bInfo.isBottleneck && (
                                  <span
                                    className={cn(
                                      "text-[9px] font-bold px-1.5 py-0.2 rounded inline-flex items-center gap-0.5",
                                      bInfo.trackColor === "indigo"
                                        ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                                        : bInfo.trackColor === "cyan"
                                          ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20"
                                          : bInfo.trackColor === "amber"
                                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                            : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
                                    )}
                                    title={`مسار ${bInfo.trackName}: متطلب لـ ${bInfo.dependentCount} مساقات لاحقة (عمق ${bInfo.depth})`}
                                  >
                                    <span>⚡</span>
                                    <span>{bInfo.badgeLabel}</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[13px] font-semibold text-[var(--text)] block leading-snug truncate mt-0.5">
                                {c.name}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-[var(--accent)] px-1.5 py-0.5 bg-[var(--accent-soft)] rounded-md tabular-nums shrink-0">
                              {c.credits} س
                            </span>
                          </div>

                          {/* Seasonal Alert if mismatch */}
                          {seasonInfo.isMismatch && (
                            <div className="mt-2 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] flex items-center gap-1">
                              <AlertTriangle
                                size={12}
                                className="shrink-0 text-amber-500"
                              />
                              <span>تنبيه موسمي: {seasonInfo.label}</span>
                            </div>
                          )}

                          {/* Prerequisite Alert if violated */}
                          {!prereqStatus.ok && (
                            <div className="mt-2 p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1">
                              <AlertCircle
                                size={12}
                                className="shrink-0 text-rose-500"
                              />
                              <span>
                                {prereqStatus.creditThresholdViolated
                                  ? `يتطلب إنجاز ${prereqStatus.minCreditsRequired} س قبل هذا الفصل`
                                  : `متطلب سابق ناقص: ${prereqStatus.missingPrereqNames.join("، ")}`}
                              </span>
                            </div>
                          )}

                          {/* Delete action */}
                          {!isLocked && (
                            <div className="mt-2 pt-2 border-t border-[var(--line)] flex items-center justify-end text-[11px] text-[var(--text-3)]">
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic("warning");
                                  handleRemoveCourse(c.id);
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-rose-500/10 text-rose-500/80 hover:text-rose-500 transition-colors cursor-pointer active:scale-90 shrink-0"
                                title="إزالة من الخطة"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-[12px] text-[var(--text-3)] border border-dashed border-[var(--line)] rounded-xl">
                      لا توجد مواد مخططة لهذا الفصل
                    </div>
                  )}
                </div>

                {/* Column Footer */}
                <div className="p-2.5 border-t border-[var(--line)] bg-[var(--sunken)]/50">
                  {isSemFromTranscript ? (
                    <button
                      type="button"
                      onClick={() => onSelectSemester(sem)}
                      className={cn(
                        "w-full py-1.5 text-[12px] font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer",
                        transRecord?.isCurrentOrInProgress
                          ? "text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                          : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10",
                      )}
                    >
                      {transRecord?.isCurrentOrInProgress ? (
                        <>
                          <Clock size={13} />
                          <span>عرض مساقات الفصل (قيد الدراسة)</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={13} />
                          <span>عرض كشف درجات الفصل</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectSemester(sem)}
                      className="w-full py-1.5 text-[12px] font-medium text-[var(--text-2)] hover:text-[var(--accent)] hover:bg-[var(--surface)] rounded-lg transition-colors border border-dashed border-[var(--line-control)] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>إضافة أو تعديل مواد</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
