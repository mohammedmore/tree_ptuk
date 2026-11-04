import React from "react";
import {
  Download,
  ImageIcon,
  X,
  Sparkles,
  Loader2,
  CircleCheckBig,
  FileSpreadsheet,
  Calendar,
} from "lucide-react";
import { cn } from "../../utils";
import type { Course, ScheduleEntry } from "../../data";
import { SEMESTERS, TOTAL_CREDITS } from "../../constants";
import {
  isRemedialCourse,
  calculateGPA,
  getAcademicStandingInfo,
} from "../../core/courseProgress";
import { getCachedStudentProfile } from "../../services/studentService";
import { normalizeDayKey } from "../../services/scheduleSolver";
import { escapeCsvValue } from "../../core/csv";

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
  categoryRequirements?: Record<string, number>;
  totalDegreeCredits?: number;
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
  categoryRequirements,
  totalDegreeCredits,
}) => {
  const [isExportLoading, setIsExportLoading] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const effectiveTotalCredits = React.useMemo(() => {
    if (totalDegreeCredits && totalDegreeCredits >= 60)
      return totalDegreeCredits;
    const student = getCachedStudentProfile();
    if (
      student?.totalCredits &&
      student.totalCredits >= 60 &&
      student.totalCredits <= 260
    ) {
      return student.totalCredits;
    }
    if (categoryRequirements && Object.keys(categoryRequirements).length > 0) {
      const sum = Object.entries(categoryRequirements).reduce(
        (acc, [cat, val]) => {
          if (cat.includes("استدراكي")) return acc;
          return acc + (Number(val) || 0);
        },
        0,
      );
      if (sum >= 60 && sum <= 260) return sum;
    }
    return TOTAL_CREDITS;
  }, [totalDegreeCredits, categoryRequirements]);
  const courseIds = React.useMemo(
    () => new Set(courses.map((course) => course.id)),
    [courses],
  );
  const coursesById = React.useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );
  const validPlannedCourses = Object.entries(plannedCourses).filter(
    ([courseId, semester]) =>
      coursesById.has(courseId) && SEMESTERS.includes(semester),
  );

  const failedSet = React.useMemo(
    () => new Set(failedCourseIds || []),
    [failedCourseIds],
  );

  const gpa = React.useMemo(() => {
    return calculateGPA(courses, courseGrades, completedCourses, failedSet);
  }, [courses, courseGrades, completedCourses, failedSet]);

  const cachedProfile = React.useMemo(
    () => getCachedStudentProfile(),
    [isExportModalOpen],
  );

  const standingInfo = React.useMemo(() => {
    return getAcademicStandingInfo(
      gpa,
      completedCredits,
      effectiveTotalCredits,
    );
  }, [gpa, completedCredits, effectiveTotalCredits]);

  React.useEffect(() => {
    if (!isExportModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isExportLoading) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isExportModalOpen, isExportLoading, onClose]);

  if (!isExportModalOpen) return null;

  const exportToJson = () => {
    try {
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
                  ? entry.days.filter(
                      (day): day is string => typeof day === "string",
                    )
                  : entry?.day
                    ? [entry.day]
                    : [],
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

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `نسخة-احتياطية-خطة-${new Date().toLocaleDateString("ar-EG")}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportError(null);
    } catch (error) {
      console.error("JSON export failed", error);
      setExportError("تعذر إنشاء ملف النسخة الاحتياطية.");
    }
  };

  // Item 84 & 122: Consolidated Excel / CSV Export with UTF-8 BOM & CWE-1236 Formula Sanitization
  const handleExportCSV = () => {
    try {
      const headerRow = [
        "رمز المساق",
        "اسم المساق",
        "الساعات المعتمدة",
        "نوع المتطلب",
        "الحالة الأكاديمية",
        "الفصل الدراسي",
        "العلامة",
      ]
        .map(escapeCsvValue)
        .join(",");

      const rows = [headerRow];

      courses.forEach((c) => {
        const isComp = completedCourses.has(c.id);
        const plannedSem = plannedCourses[c.id] || "";
        const status = isComp ? "منجز" : plannedSem ? "مخطط" : "متبقي";
        const grade =
          courseGrades[c.id] !== undefined ? String(courseGrades[c.id]) : "";
        const sem = isComp ? "فصل سابق منجز" : plannedSem || "غير مجدول";

        rows.push(
          [
            escapeCsvValue(c.id),
            escapeCsvValue(c.name || ""),
            escapeCsvValue(c.credits),
            escapeCsvValue(c.category || ""),
            escapeCsvValue(status),
            escapeCsvValue(sem),
            escapeCsvValue(grade),
          ].join(","),
        );
      });

      const csvContent = "\uFEFF" + rows.join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `خطة-المساقات-خضوري-${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportError(null);
    } catch (error) {
      console.error("CSV export failed", error);
      setExportError("تعذر تصدير ملف Excel (CSV).");
    }
  };

  const exportToIcal = () => {
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//PTUK Student Academic Plan//AR",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:الخطة الدراسية - خضوري",
      ];

      courses.forEach((c, idx) => {
        const isComp = completedCourses.has(c.id);
        const sem = plannedCourses[c.id] || "غير مجدولة";
        const status = isComp ? "منجز" : "متبقي";
        const uid = `plan-course-${c.id}-${idx}@ptuk.edu.ps`;

        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${uid}`);
        lines.push(`SUMMARY:${c.name} (${c.id}) - ${c.credits}س [${status}]`);
        lines.push(
          `DESCRIPTION:مساق: ${c.name}\\nالرمز: ${c.id}\\nالساعات: ${c.credits}\\nالفصل: ${sem}\\nالحالة: ${status}`,
        );
        lines.push(`STATUS:CONFIRMED`);
        lines.push("END:VEVENT");
      });

      lines.push("END:VCALENDAR");
      const icsBlob = new Blob([lines.join("\r\n")], {
        type: "text/calendar;charset=utf-8;",
      });
      const url = URL.createObjectURL(icsBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `تقويم-الخطة-الدراسية-${dateStr}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportError(null);
    } catch (err) {
      console.error("iCal export error:", err);
      setExportError("تعذر تصدير تقويم الخطة (.ics)");
    }
  };

  const importFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.currentTarget;
    setImportError(null);
    if (file.size > 5 * 1024 * 1024) {
      setImportError(
        "حجم ملف النسخة الاحتياطية يتجاوز الحد المسموح (5 ميغابايت).",
      );
      input.value = "";
      return;
    }
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
        if (
          ![
            "plan_start_semester",
            "plan_end_semester",
            "hide_past_semesters",
            "dark_mode",
          ].includes(key)
        ) {
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

      let snapshots: Array<readonly [string, string | null]>;
      try {
        snapshots = normalizedUpdates.map(
          ([key]) => [key, localStorage.getItem(key)] as const,
        );
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "خطأ تخزين غير معروف";
        setImportError(`تعذرت قراءة البيانات الحالية قبل الاستيراد: ${reason}`);
        input.value = "";
        return;
      }
      try {
        normalizedUpdates.forEach(([key, value]) =>
          localStorage.setItem(key, JSON.stringify(value)),
        );
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
        const reason =
          error instanceof Error ? error.message : "خطأ تخزين غير معروف";
        setImportError(
          rollbackFailed
            ? `فشل الاستيراد وتعذر التراجع عن بعض التغييرات: ${reason}`
            : `تعذر حفظ النسخة في المتصفح: ${reason}`,
        );
        input.value = "";
        return;
      }
      setImportError(null);
      alert(
        "تم استيراد النسخة الاحتياطية بنجاح. سيتم تحديث الصفحة لتطبيق البيانات.",
      );
      window.location.reload();
      input.value = "";
    };
    reader.onerror = () => {
      setImportError("تعذر قراءة الملف. اختر نسخة احتياطية أخرى.");
      input.value = "";
    };
    reader.readAsText(file);

    function isKnownCourseArray(value: unknown): boolean {
      return (
        Array.isArray(value) &&
        value.every((id) => typeof id === "string" && courseIds.has(id))
      );
    }

    function isRecord(value: unknown): value is Record<string, unknown> {
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
    }

    function isCourseMap(value: unknown): boolean {
      return (
        isRecord(value) &&
        Object.entries(value).every(
          ([slotId, id]) =>
            typeof slotId === "string" &&
            typeof id === "string" &&
            courseIds.has(id),
        )
      );
    }

    function isPlanMap(value: unknown): boolean {
      return (
        isRecord(value) &&
        Object.entries(value).every(
          ([id, semester]) =>
            courseIds.has(id) &&
            typeof semester === "string" &&
            SEMESTERS.includes(semester),
        )
      );
    }

    function isWeeklySchedule(value: unknown): boolean {
      return (
        isRecord(value) &&
        Object.entries(value).every(
          ([semester, semesterEntries]) =>
            SEMESTERS.includes(semester) &&
            isRecord(semesterEntries) &&
            Object.entries(semesterEntries).every(
              ([id, entry]) =>
                courseIds.has(id) &&
                isRecord(entry) &&
                typeof entry.startTime === "string" &&
                /^([0-1]?\d|2[0-3]):([0-5]\d)$/.test(entry.startTime) &&
                typeof entry.endTime === "string" &&
                /^([0-1]?\d|2[0-3]):([0-5]\d)$/.test(entry.endTime) &&
                (entry.days === undefined ||
                  (Array.isArray(entry.days) &&
                    entry.days.every(
                      (day) =>
                        typeof day === "string" &&
                        normalizeDayKey(day) !== null,
                    ))) &&
                (entry.day === undefined ||
                  (typeof entry.day === "string" &&
                    normalizeDayKey(entry.day) !== null)) &&
                ["section", "instructor", "room", "location"].every(
                  (field) =>
                    entry[field] === undefined ||
                    typeof entry[field] === "string",
                ),
            ),
        )
      );
    }

    function isGrades(value: unknown): boolean {
      return (
        isRecord(value) &&
        Object.entries(value).every(
          ([id, grade]) =>
            courseIds.has(id) &&
            typeof grade === "number" &&
            Number.isFinite(grade) &&
            (grade === -1 || (grade >= 0 && grade <= 100)),
        )
      );
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
    if (!element) {
      setExportError("تعذر العثور على محتوى الخطة لتصديره.");
      return;
    }
    setIsExportLoading(true);
    setExportError(null);
    try {
      // Point 20: Dynamic import for code-splitting
      const { toPng } = await import("html-to-image");
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

      const dateStr = new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.download = `خطة-التخرج-${dateStr}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed", err);
      setExportError("تعذر حفظ الخطة كصورة. حاول مرة أخرى.");
    } finally {
      setIsExportLoading(false);
    }
  };

  const exportToPdf = async () => {
    const element = document.getElementById("study-plan-printable");
    if (!element) {
      setExportError("تعذر العثور على محتوى الخطة لتصديره.");
      return;
    }
    setIsExportLoading(true);
    setExportError(null);
    try {
      // Point 20: Dynamic import for code-splitting
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);
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
      await img.decode();

      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (img.height * imgWidth) / img.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`خطة-التخرج-${dateStr}.pdf`);
    } catch (err) {
      console.error("Exporting to PDF failed:", err);
      setExportError("تعذر إنشاء ملف PDF. حاول مرة أخرى.");
    } finally {
      setIsExportLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-2 sm:p-4 transition-all duration-300",
        isExportModalOpen
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none",
      )}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        className="bg-white rounded-2xl p-0 w-full max-w-6xl max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] h-full sm:h-[90vh] shadow-xl shadow-black/5 border border-slate-200/80 animate-in zoom-in-95 duration-150 flex flex-col overflow-hidden"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 sm:p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 bg-gray-50/50">
          <div>
            <h2
              id="export-modal-title"
              className="text-xl sm:text-2xl font-black text-gray-800 flex items-center gap-3"
            >
              <Download size={28} className="text-emerald-600" />
              تنزيل وتصدير الخطة
            </h2>
            <p className="text-gray-500 text-xs sm:text-sm font-medium">
              معاينة الخطة وتحميلها بملف PDF أو صورة عالية الجودة مباشرة لجهازك
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
            <input
              type="file"
              ref={fileInputRef}
              onChange={importFromJson}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              aria-label="اختيار ملف نسخة احتياطية للاستيراد"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-9 bg-slate-50 text-slate-700 border border-slate-200/90 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-100 transition-colors active:scale-[0.98] cursor-pointer"
            >
              <Download size={14} className="rotate-180" />
              استيراد نسخة
            </button>
            <button
              type="button"
              onClick={exportToJson}
              className="min-h-9 bg-slate-50 text-slate-700 border border-slate-200/90 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-100 transition-colors active:scale-[0.98] cursor-pointer"
            >
              <Download size={14} />
              تصدير JSON
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="min-h-9 bg-slate-50 text-slate-700 border border-slate-200/90 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-100 transition-colors active:scale-[0.98] cursor-pointer"
              title="تصدير جدول المساقات كملف Excel (CSV) متوافق مع الحواسيب والهواتف"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              تصدير Excel (CSV)
            </button>
            <button
              type="button"
              onClick={exportToIcal}
              className="min-h-9 bg-slate-50 text-slate-700 border border-slate-200/90 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-100 transition-colors active:scale-[0.98] cursor-pointer"
              title="تصدير جدول الخطة كملف تقويم (.ics) متوافق مع تقويم Google و Apple"
            >
              <Calendar size={14} className="text-sky-600" />
              تقويم (.ics)
            </button>
            {importError && (
              <p
                role="alert"
                className="basis-full text-sm font-bold text-red-600"
              >
                {importError}
              </p>
            )}
            {exportError && (
              <p
                role="alert"
                className="basis-full text-sm font-bold text-red-600"
              >
                {exportError}
              </p>
            )}
            <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block"></div>
            <button
              type="button"
              onClick={exportToImage}
              disabled={isExportLoading}
              className="min-h-9 bg-slate-900 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-800 transition-colors shadow-none active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isExportLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <ImageIcon size={15} />
              )}
              حفظ كصورة (PNG)
            </button>
            <button
              type="button"
              onClick={exportToPdf}
              disabled={isExportLoading}
              className="min-h-9 bg-slate-100 text-slate-800 border border-slate-200/90 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-200 transition-colors shadow-none active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isExportLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              تحميل PDF
            </button>
            <div className="hidden sm:block h-5 w-px bg-slate-200 mx-1"></div>
            <button
              type="button"
              aria-label="إغلاق نافذة التصدير"
              onClick={onClose}
              className="min-h-9 min-w-9 flex items-center justify-center p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors active:scale-[0.98] cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-12 bg-gray-50 print:p-0 custom-scrollbar">
          <div
            id="study-plan-printable"
            className="max-w-5xl mx-auto border-2 border-gray-900 p-8 rounded-[2rem] relative bg-white shadow-2xl print:shadow-none"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b-2 border-gray-900 pb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-widest px-2.5 py-0.5 bg-emerald-700 text-white rounded-md">
                    جامعة فلسطين التقنية - خضوري
                  </span>
                  <span className="text-xs text-gray-500 font-bold">
                    عمادة القبول والتسجيل
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mt-1">
                  خارطة طريق التخرج وكشف المساقات
                </h1>
                <p className="text-sm font-bold text-gray-700">
                  <span className="privacy-sensitive">
                    {cachedProfile?.studentName
                      ? `${cachedProfile.studentName} • `
                      : ""}
                    الرقم الجامعي:{" "}
                    <span dir="ltr">{cachedProfile?.studentId || "—"}</span>
                  </span>
                  {" • "}
                  <span>
                    {cachedProfile?.majorName || "الخطة الدراسية الجامعية"}
                  </span>
                </p>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-600 mt-1">
                  <span>الحالة الأكاديمية: {standingInfo.standingText}</span>
                  {standingInfo.isHonor && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                      شرف أكاديمي ⭐
                    </span>
                  )}
                  <span>
                    • تاريخ التقرير: {new Date().toLocaleDateString("ar-EG")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-left py-2 px-4 bg-gray-900 text-white rounded-xl">
                  <div className="text-[10px] opacity-75 uppercase tracking-widest font-black">
                    عدد الساعات المنجزة
                  </div>
                  <div className="text-xl font-black privacy-sensitive">
                    {completedCredits} / {effectiveTotalCredits}
                  </div>
                </div>
                {gpa > 0 && (
                  <div className="text-left py-2 px-4 bg-emerald-700 text-white rounded-xl">
                    <div className="text-[10px] opacity-75 uppercase tracking-widest font-black">
                      المعدل التراكمي
                    </div>
                    <div className="text-xl font-black privacy-sensitive">
                      %{gpa.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-10">
              {/* Stats Summary */}
              <div className="grid grid-cols-3 gap-6">
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl">
                  <div className="text-[10px] font-black text-blue-600 uppercase mb-1">
                    إجمالي الخطة
                  </div>
                  <div className="text-xl font-black text-blue-900">
                    {validPlannedCourses.length} مساقاً
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
                          completedCourses.has(c.id) &&
                          !isRemedialCourse(c.id),
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
                          !completedCourses.has(c.id) &&
                          !isRemedialCourse(c.id),
                      )
                      .reduce((sum, c) => sum + c.credits, 0)}{" "}
                    ساعة
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                {SEMESTERS.map((semester) => {
                  const semCourses = validPlannedCourses.flatMap(
                    ([courseId, plannedSemester]) => {
                      if (plannedSemester !== semester) return [];
                      const course = coursesById.get(courseId);
                      return course ? [course] : [];
                    },
                  );
                  if (semCourses.length === 0) return null;

                  return (
                    <div
                      key={semester}
                      className="break-inside-avoid border-b-2 border-gray-300 pb-8 last:border-b-0"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <h3 className="text-lg font-black text-white bg-gray-900 px-6 py-2 rounded-xl shadow-lg">
                          {semester}
                        </h3>
                        <div className="h-0.5 flex-1 bg-gray-100"></div>
                        <div className="text-sm font-bold text-gray-400">
                          {semCourses.reduce((sum, c) => sum + c.credits, 0)}{" "}
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
