import React from "react";
import { Download, ImageIcon, X, Sparkles, Loader2, CircleCheckBig } from "lucide-react";
import { cn } from "../utils";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { Course, ScheduleEntry } from "../data";
import { SEMESTERS, TOTAL_CREDITS } from "../constants";

interface ExportModalProps {
  isExportModalOpen: boolean;
  onClose: () => void;
  completedCredits: number;
  plannedCourses: Record<string, string>;
  completedCourses: Set<string>;
  courses: Course[];
  courseGrades: Record<string, number>;
  weeklySchedule: Record<string, Record<string, ScheduleEntry>>;
  selectedElectives: Record<string, string>;
  failedCourseIds: string[];
  planStartSemester: string;
  planEndSemester: string;
  hidePastSemesters: boolean;
  darkMode: boolean;
}

const ExportModal: React.FC<ExportModalProps> = ({
  isExportModalOpen,
  onClose,
  completedCredits,
  plannedCourses,
  completedCourses,
  courses,
  courseGrades,
  weeklySchedule,
  selectedElectives,
  failedCourseIds,
  planStartSemester,
  planEndSemester,
  hidePastSemesters,
  darkMode,
}) => {
  const [isExportLoading, setIsExportLoading] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const gpa = React.useMemo(() => {
    let totalPoints = 0;
    let totalCreditsWithGrades = 0;
    
    (Object.entries(courseGrades) as [string, number][]).forEach(([courseId, grade]) => {
      if (!completedCourses.has(courseId)) return;
      const course = courses.find(c => c.id === courseId);
      if (course && grade > 0) {
        totalPoints += grade * course.credits;
        totalCreditsWithGrades += course.credits;
      }
    });
    
    if (totalCreditsWithGrades === 0) return 0;
    return totalPoints / totalCreditsWithGrades;
  }, [courseGrades, completedCourses, courses]);

  if (!isExportModalOpen) return null;

  const exportToJson = () => {
    const safeWeeklySchedule = Object.fromEntries(
      Object.entries(weeklySchedule).map(([semester, entries]) => [
        semester,
        Object.fromEntries(
          Object.entries(entries ?? {}).map(([courseId, entry]) => [
            courseId,
            {
              courseId,
              startTime: entry?.startTime || "08:00",
              endTime: entry?.endTime || "09:00",
              section: entry?.section || "",
              instructor: entry?.instructor || "",
              room: entry?.room || entry?.location || "",
              days: Array.isArray(entry?.days)
                ? entry.days.filter((day): day is string => typeof day === "string")
                : entry?.day ? [entry.day] : [],
            },
          ]),
        ),
      ]),
    );
    const data = {
      completed_courses: Array.from(completedCourses),
      planned_courses: plannedCourses,
      version: 2,
      weekly_schedule: safeWeeklySchedule,
      selected_electives_map: selectedElectives,
      course_grades: courseGrades,
      failed_course_ids: failedCourseIds,
      plan_start_semester: planStartSemester,
      plan_end_semester: planEndSemester,
      hide_past_semesters: hidePastSemesters,
      dark_mode: darkMode,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `نسخة-احتياطية-خطة-${new Date().toLocaleDateString("ar-EG")}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.currentTarget;
    const reader = new FileReader();
    reader.onload = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.target?.result ?? ""));
      } catch {
        setImportError("ملف النسخة الاحتياطية ليس JSON صالحاً.");
        input.value = "";
        return;
      }
      if (!isRecord(parsed)) {
        setImportError("بنية ملف النسخة الاحتياطية غير صالحة.");
        input.value = "";
        return;
      }
      if (parsed.version !== undefined && parsed.version !== 2) {
        setImportError("إصدار النسخة الاحتياطية غير مدعوم.");
        input.value = "";
        return;
      }

      const entries: Array<[string, unknown, (value: unknown) => boolean]> = [
          ["completed_courses", parsed.completed_courses, isKnownCourseArray],
          ["planned_courses", parsed.planned_courses, isPlanMap],
          ["weekly_schedule", parsed.weekly_schedule, isWeeklySchedule],
          ["selected_electives_map", parsed.selected_electives_map, isCourseMap],
          ["course_grades", parsed.course_grades, isGrades],
          ["failed_course_ids", parsed.failed_course_ids, isKnownCourseArray],
          ["plan_start_semester", parsed.plan_start_semester, isSemester],
          ["plan_end_semester", parsed.plan_end_semester, isSemester],
          ["hide_past_semesters", parsed.hide_past_semesters, isBoolean],
          ["dark_mode", parsed.dark_mode, isBoolean],
      ];
      const updates = entries.filter(([key]) => Object.hasOwn(parsed, key));
      if (updates.length === 0) {
        setImportError("النسخة الاحتياطية لا تحتوي بيانات قابلة للاستيراد.");
        input.value = "";
        return;
      }

      const normalizedUpdates = updates.map(([key, value]) => {
        if (parsed.version !== undefined || typeof value !== "string") {
          return [key, value] as const;
        }
        if (!["plan_start_semester", "plan_end_semester", "hide_past_semesters", "dark_mode"].includes(key)) {
          return [key, value] as const;
        }
        try {
          return [key, JSON.parse(value)] as const;
        } catch {
          return [key, value] as const;
        }
      });

      const invalidUpdate = normalizedUpdates.find(([key, value]) => {
        const validator = entries.find(([entryKey]) => entryKey === key)?.[2];
        return !validator || !validator(value);
      });
      if (invalidUpdate) {
        setImportError(`القيمة في "${invalidUpdate[0]}" غير صالحة.`);
        input.value = "";
        return;
      }

      const snapshots = normalizedUpdates.map(([key]) => [key, localStorage.getItem(key)] as const);
      try {
        normalizedUpdates.forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
      } catch (error) {
        let rollbackFailed = false;
        snapshots.forEach(([key, value]) => {
          try {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
          } catch {
            rollbackFailed = true;
          }
        });
        const reason = error instanceof Error ? error.message : "خطأ تخزين غير معروف";
        setImportError(rollbackFailed
          ? `فشل الاستيراد وتعذر التراجع عن بعض التغييرات: ${reason}`
          : `تعذر حفظ النسخة في المتصفح: ${reason}`);
        input.value = "";
        return;
      }
      setImportError(null);
      alert("تم استيراد النسخة الاحتياطية بنجاح. سيتم تحديث الصفحة لتطبيق البيانات.");
      window.location.reload();
      input.value = "";
    };
    reader.onerror = () => {
      setImportError("تعذر قراءة الملف. اختر نسخة احتياطية أخرى.");
      input.value = "";
    };
    reader.readAsText(file);

    function isKnownCourseArray(value: unknown): boolean {
      return Array.isArray(value) && value.every((id) => typeof id === "string");
    }
    function isRecord(value: unknown): value is Record<string, unknown> {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }
    function isCourseMap(value: unknown): boolean {
      return isRecord(value)
        && Object.values(value).every((id) => typeof id === "string");
    }
    function isPlanMap(value: unknown): boolean {
      return isRecord(value)
        && Object.entries(value).every(([id, semester]) => (
          typeof id === "string" && typeof semester === "string" && SEMESTERS.includes(semester)
        ));
    }
    function isWeeklySchedule(value: unknown): boolean {
      return isRecord(value) && Object.entries(value).every(([semester, semesterEntries]) => (
        SEMESTERS.includes(semester)
        && isRecord(semesterEntries)
        && Object.entries(semesterEntries).every(([id, entry]) => (
          typeof id === "string"
          && isRecord(entry)
          && typeof entry.startTime === "string"
          && typeof entry.endTime === "string"
          && (entry.days === undefined || (Array.isArray(entry.days) && entry.days.every((day) => typeof day === "string")))
          && ["section", "instructor", "room", "location", "day"].every((field) => (
            entry[field] === undefined || typeof entry[field] === "string"
          ))
        ))
      ));
    }
    function isGrades(value: unknown): boolean {
      return isRecord(value) && Object.entries(value).every(([id, grade]) => (
        typeof id === "string"
        && typeof grade === "number"
        && Number.isFinite(grade)
        && (grade === -1 || (grade >= 0 && grade <= 100))
      ));
    }
    function isSemester(value: unknown): boolean {
      return typeof value === "string" && SEMESTERS.includes(value);
    }
    function isBoolean(value: unknown): boolean {
      return typeof value === "boolean";
    }
  };

  const exportToImage = async () => {
    const element = document.getElementById("study-plan-printable");
    if (!element) return;

    setIsExportLoading(true);
    try {
      // Small delay to ensure styles and fonts are ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      const dataUrl = await toPng(element, {
        backgroundColor: "#ffffff",
        quality: 1,
        cacheBust: true,
        pixelRatio: 3, // High resolution for the long image
        style: {
          margin: "0",
          padding: "40px",
          borderRadius: "0",
        },
      });

      const link = document.createElement("a");
      link.download = `خطة-التخرج-${new Date().toLocaleDateString("ar-EG")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setIsExportLoading(false);
    }
  };

  const exportToPdf = async () => {
    const element = document.getElementById("study-plan-printable");
    if (!element) return;

    setIsExportLoading(true);
    try {
      // Small delay to ensure styles are fully loaded
      await new Promise((resolve) => setTimeout(resolve, 500));

      const dataUrl = await toPng(element, {
        backgroundColor: "#ffffff",
        quality: 1,
        cacheBust: true,
        pixelRatio: 2, // 2 is optimal for sharp results without excessive file size
        style: {
          margin: "0",
          padding: "40px",
          borderRadius: "0",
        },
      });

      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const pdf = new jsPDF("p", "mm", "a4");
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 295; // A4 height in mm
        const imgHeight = (img.height * imgWidth) / img.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(`خطة-التخرج-${new Date().toLocaleDateString("ar-EG")}.pdf`);
        setIsExportLoading(false);
      };
    } catch (err) {
      console.error("Exporting to PDF failed:", err);
      setIsExportLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 transition-all duration-300",
        isExportModalOpen
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none",
      )}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-0 w-full max-w-6xl h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-3">
              <Download size={28} className="text-emerald-600" />
              تنزيل وتصدير الخطة
            </h2>
            <p className="text-gray-500 text-sm font-medium">
              معاينة الخطة وتحميلها بملف PDF أو صورة عالية الجودة مباشرة
              لجهازك
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={importFromJson} 
              accept=".json" 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all"
            >
              <Sparkles size={18} className="text-blue-500" />
              استيراد نسخة
            </button>
            <button
              onClick={exportToJson}
              className="bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all"
            >
              <Download size={18} className="text-gray-500" />
              تصدير نسخة JSON
            </button>
            {importError && (
              <p role="alert" className="basis-full text-sm font-bold text-red-600">
                {importError}
              </p>
            )}
            <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block"></div>
            <button
              onClick={exportToImage}
              disabled={isExportLoading}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {isExportLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <ImageIcon size={20} />
              )}
              حفظ كصورة (PNG)
            </button>
            <button
              onClick={exportToPdf}
              disabled={isExportLoading}
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-250 disabled:opacity-50"
            >
              {isExportLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Download size={20} />
              )}
              تحميل كـ ملف PDF
            </button>
            <div className="hidden sm:block h-8 w-px bg-gray-200 mx-1"></div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Instructions for better results */}
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-2 text-[11px] text-amber-700 font-medium flex items-center gap-2">
          <Sparkles size={14} />
          <span>
            نصيحة: إذا كنت تستخدم المتصفح داخل تطبيق آخر، يفضل "حفظ كصورة"
            للحصول على أفضل نتيجة.
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-12 bg-gray-50 print:p-0">
          <div
            id="study-plan-printable"
            className="max-w-5xl mx-auto border-2 border-gray-900 p-8 rounded-[2rem] relative bg-white shadow-2xl print:shadow-none"
          >
            <div className="flex justify-between items-center mb-10 border-b-2 border-gray-900 pb-8">
              <div className="space-y-1">
                <h1 className="text-3xl font-black text-gray-900">
                  خارطة طريق التخرج
                </h1>
                <p className="text-lg font-bold text-gray-600">
                  هندسة أنظمة الحاسوب - PTUK
                </p>
              </div>
              <div className="text-left py-2 px-4 bg-gray-900 text-white rounded-xl">
                <div className="text-xs opacity-70 uppercase tracking-widest font-black">
                  عدد الساعات المنجزة
                </div>
                <div className="text-2xl font-black">
                  {completedCredits} / {TOTAL_CREDITS}
                </div>
              </div>
              {gpa > 0 && (
                <div className="text-left py-2 px-4 bg-indigo-600 text-white rounded-xl">
                  <div className="text-xs opacity-70 uppercase tracking-widest font-black">
                    المعدل التراكمي
                  </div>
                  <div className="text-2xl font-black">
                    %{gpa.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-10">
              {/* Stats Summary */}
              <div className="grid grid-cols-3 gap-6">
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl">
                  <div className="text-[10px] font-black text-blue-600 uppercase mb-1">
                    إجمالي الخطة
                  </div>
                  <div className="text-xl font-black text-blue-900">
                    {Object.keys(plannedCourses).length} مساقاً
                  </div>
                </div>
                <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl">
                  <div className="text-[10px] font-black text-emerald-600 uppercase mb-1">
                    ساعات منجزة في الخطة
                  </div>
                  <div className="text-xl font-black text-emerald-900">
                    {courses
                      .filter(
                        (c) =>
                          plannedCourses[c.id] &&
                          completedCourses.has(c.id),
                      )
                      .reduce((sum, c) => sum + c.credits, 0)}{" "}
                    ساعة
                  </div>
                </div>
                <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-2xl">
                  <div className="text-[10px] font-black text-orange-600 uppercase mb-1">
                    ساعات متبقية في الخطة
                  </div>
                  <div className="text-xl font-black text-orange-900">
                    {courses
                      .filter(
                        (c) =>
                          plannedCourses[c.id] &&
                          !completedCourses.has(c.id),
                      )
                      .reduce((sum, c) => sum + c.credits, 0)}{" "}
                    ساعة
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                {SEMESTERS.map((semester) => {
                  const semCourses = Object.entries(plannedCourses)
                    .filter(([, s]) => s === semester)
                    .map(([id]) => courses.find((c) => c.id === id)!)
                    .filter(Boolean);
                  if (semCourses.length === 0) return null;

                  return (
                    <div key={semester} className="break-inside-avoid">
                      <div className="flex items-center gap-4 mb-4">
                        <h3 className="text-lg font-black text-white bg-gray-900 px-6 py-2 rounded-xl shadow-lg">
                          {semester}
                        </h3>
                        <div className="h-0.5 flex-1 bg-gray-100"></div>
                        <div className="text-sm font-bold text-gray-400">
                          {semCourses.reduce(
                            (sum, c) => sum + c.credits,
                            0,
                          )}{" "}
                          ساعة معتمدة
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {semCourses.map((course) => (
                          <div
                            key={course.id}
                            className="group p-4 bg-white border border-gray-100 rounded-2xl flex flex-col justify-between hover:border-gray-900 transition-all duration-300 pointer-events-auto cursor-pointer"
                          >
                            <div>
                              <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-1">
                                {course.id}
                              </div>
                              <div className="text-sm font-bold text-gray-800 leading-tight group-hover:text-blue-600 transition-colors">
                                {course.name}
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center">
                              <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-lg">
                                {course.credits} ساعة
                              </span>
                              <div
                                className={cn(
                                  "flex items-center gap-1.5 text-[10px] font-black",
                                  completedCourses.has(course.id)
                                    ? "text-emerald-600"
                                    : "text-orange-500",
                                )}
                              >
                                {completedCourses.has(course.id) ? (
                                  <>
                                    <CircleCheckBig size={10} /> منجز
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={10} /> مخطط
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
