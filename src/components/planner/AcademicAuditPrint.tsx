import React, { useMemo } from "react";
import type { Course } from "../../data";
import {
  calculateDegreeCredits,
  calculateGPA,
} from "../../core/courseProgress";
import { parseSemesterWeight } from "../../utils/semesterUtils";
import {
  getStudentCreditLimits,
  hasStudentAcademicWarning,
} from "../../core/academicPolicy";
import type { StudentSyncProfile } from "../../services/studentService";

export interface AcademicAuditPrintProps {
  courses: Course[];
  completedCourses: Set<string>;
  plannedCourses: Record<string, string>;
  courseGrades?: Record<string, number>;
  activeMajorName?: string;
  studentName?: string;
  studentId?: string;
  totalCredits?: number;
  college?: string;
  currentStudent?: StudentSyncProfile | null;
  categoryRequirements?: Record<string, number>;
}

export const AcademicAuditPrint: React.FC<AcademicAuditPrintProps> = ({
  courses,
  completedCourses,
  plannedCourses,
  courseGrades = {},
  activeMajorName = "الخطة الدراسية الجامعية",
  studentName = "طالب جامعي",
  studentId = "—",
  totalCredits = 132,
  college = "عمادة القبول والتسجيل",
  currentStudent = null,
  categoryRequirements = {},
}) => {
  const earnedCredits = calculateDegreeCredits(courses, completedCourses);
  const effectiveTotalCredits = totalCredits >= 60 ? totalCredits : 132;
  const gpa = calculateGPA(courses, courseGrades, completedCourses);
  const completionPercentage = Math.round(
    (earnedCredits / effectiveTotalCredits) * 100,
  );

  const hasWarning = hasStudentAcademicWarning(currentStudent);
  const creditLimits = getStudentCreditLimits({
    student: currentStudent,
    isHighGpa: (currentStudent?.gpa ?? gpa) >= 80,
  });

  const currentDate = new Date().toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // 1. Group planned courses by semester and sort them chronologically
  const plannedSemestersData = useMemo(() => {
    const semMap = new Map<string, Course[]>();
    for (const [courseId, semName] of Object.entries(plannedCourses)) {
      if (!semName) continue;
      const c = courses.find((item) => item.id === courseId);
      if (!c) continue;
      if (!semMap.has(semName)) {
        semMap.set(semName, []);
      }
      semMap.get(semName)!.push(c);
    }

    const sortedSemesters = Array.from(semMap.keys()).sort(
      (a, b) => parseSemesterWeight(a) - parseSemesterWeight(b),
    );

    return sortedSemesters.map((semName) => {
      const semCourses = semMap.get(semName) || [];
      const totalSemCredits = semCourses.reduce(
        (sum, c) => sum + (c.credits || 0),
        0,
      );
      const isSummer = semName.includes("صيفي");
      const semLimit = isSummer
        ? creditLimits.maxCredits === 21
          ? 12
          : creditLimits.maxCredits === 14
            ? 6
            : 10
        : creditLimits.maxCredits;

      return {
        semesterName: semName,
        courses: semCourses,
        totalCredits: totalSemCredits,
        isSummer,
        creditLimit: semLimit,
        isOverLimit: totalSemCredits > semLimit,
      };
    });
  }, [plannedCourses, courses, creditLimits]);

  const totalPlannedCredits = useMemo(() => {
    return plannedSemestersData.reduce((acc, sem) => acc + sem.totalCredits, 0);
  }, [plannedSemestersData]);

  // 2. Identify remaining courses that are NOT completed and NOT planned yet
  const remainingUnplannedCourses = useMemo(() => {
    return courses.filter(
      (c) => !completedCourses.has(c.id) && !plannedCourses[c.id],
    );
  }, [courses, completedCourses, plannedCourses]);

  const remainingUnplannedCredits = useMemo(() => {
    return remainingUnplannedCourses.reduce(
      (sum, c) => sum + (c.credits || 0),
      0,
    );
  }, [remainingUnplannedCourses]);

  // 3. Completed courses list
  const completedList = useMemo(() => {
    return courses.filter((c) => completedCourses.has(c.id));
  }, [courses, completedCourses]);

  // 4. Category fulfillment summary
  const categorySummary = useMemo(() => {
    const cats: Record<
      string,
      { required: number; completed: number; planned: number }
    > = {};

    for (const [catName, reqHours] of Object.entries(categoryRequirements)) {
      cats[catName] = { required: reqHours, completed: 0, planned: 0 };
    }

    courses.forEach((c) => {
      const cat = c.category || "متطلب أخرى";
      if (!cats[cat]) {
        cats[cat] = { required: 0, completed: 0, planned: 0 };
      }
      if (completedCourses.has(c.id)) {
        cats[cat].completed += c.credits || 0;
      } else if (plannedCourses[c.id]) {
        cats[cat].planned += c.credits || 0;
      }
    });

    return Object.entries(cats).filter(
      ([, data]) => data.required > 0 || data.completed > 0 || data.planned > 0,
    );
  }, [courses, completedCourses, plannedCourses, categoryRequirements]);

  return (
    <div
      id="academic-audit-print-document"
      className="hidden print:block text-black bg-white font-['IBM_Plex_Sans_Arabic',serif] p-6 max-w-[210mm] mx-auto text-right leading-normal text-[11px]"
      dir="rtl"
    >
      {/* Official University Header */}
      <div className="border-b-2 border-black pb-3 mb-3 flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-[17px] font-bold text-black font-['Noto_Naskh_Arabic',serif]">
            جامعة فلسطين التقنية - خضوري
          </h1>
          <h2 className="text-[13px] font-semibold text-gray-800">
            عمادة القبول والتسجيل • {college}
          </h2>
          <p className="text-[11.5px] font-medium text-gray-700">
            وثيقة السجل الأكاديمي ومسار الخطة الدراسية المعتمدة
          </p>
        </div>

        <div className="text-left text-[10px] text-gray-600 font-mono space-y-0.5">
          <div>تاريخ الإصدار: {currentDate}</div>
          <div>رقم الوثيقة: PTUK-PLAN-{Date.now().toString().slice(-6)}</div>
          <div>الحالة: وثيقة رسمية معتمدة</div>
        </div>
      </div>

      {/* Student Details Card */}
      <div className="border border-black rounded-md p-2.5 mb-3 bg-gray-50/70 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11.5px]">
        <div>
          <span className="text-gray-600 block text-[9.5px]">اسم الطالب:</span>
          <span className="font-bold text-black privacy-sensitive">
            {studentName}
          </span>
        </div>
        <div>
          <span className="text-gray-600 block text-[9.5px]">
            الرقم الجامعي:
          </span>
          <span className="font-mono font-bold text-black privacy-sensitive">
            {studentId}
          </span>
        </div>
        <div>
          <span className="text-gray-600 block text-[9.5px]">
            التخصص الأكاديمي:
          </span>
          <span className="font-bold text-black">{activeMajorName}</span>
        </div>
        <div>
          <span className="text-gray-600 block text-[9.5px]">
            المعدل التراكمي العام:
          </span>
          <span className="font-bold text-black privacy-sensitive">
            {typeof currentStudent?.gpa === "number"
              ? currentStudent.gpa.toFixed(2)
              : gpa.toFixed(2)}
            %
          </span>
        </div>
        <div>
          <span className="text-gray-600 block text-[9.5px]">
            الحالة الأكاديمية:
          </span>
          <span className="font-bold text-black">
            {hasWarning ? "تحت الملاحظة (إنذار)" : "منتظم (وضع سليم)"}
          </span>
        </div>
        <div>
          <span className="text-gray-600 block text-[9.5px]">
            سقف تسجيل الساعات:
          </span>
          <span className="font-bold text-black">
            {creditLimits.maxCredits}س{" "}
            {creditLimits.isHighGpaOrGraduating
              ? "(سقف المتفوقين تلقائي)"
              : hasWarning
                ? "(مقيد بالإنذار)"
                : "(طالب منتظم)"}
          </span>
        </div>
        <div>
          <span className="text-gray-600 block text-[9.5px]">
            ساعات التخرج المطلوبة:
          </span>
          <span className="font-mono font-bold text-black">
            {effectiveTotalCredits} ساعة
          </span>
        </div>
        <div>
          <span className="text-gray-600 block text-[9.5px]">
            نسبة الإنجاز الإجمالية:
          </span>
          <span className="font-mono font-bold text-black privacy-sensitive">
            {completionPercentage}%
          </span>
        </div>
      </div>

      {/* Credit Hours Summary Bar */}
      <div className="flex items-center justify-between border-y border-black/80 py-1.5 mb-3 text-[11px] font-semibold bg-gray-100/70 px-2">
        <div>
          المطلوبة للتخرج:{" "}
          <span className="font-mono font-bold">{effectiveTotalCredits}</span> س
        </div>
        <div>
          المنجزة بالسجل:{" "}
          <span className="font-mono font-bold text-black privacy-sensitive">
            {earnedCredits}
          </span>{" "}
          س
        </div>
        <div>
          المخططة مستقبلاً:{" "}
          <span className="font-mono font-bold text-black">
            {totalPlannedCredits}
          </span>{" "}
          س
        </div>
        <div>
          المتبقية بدون تخطيط:{" "}
          <span className="font-mono font-bold">
            {remainingUnplannedCredits}
          </span>{" "}
          س
        </div>
        <div>
          المجموع الكلي المنجز + المخطط:{" "}
          <span className="font-mono font-bold">
            {earnedCredits + totalPlannedCredits}
          </span>{" "}
          / {effectiveTotalCredits} س
        </div>
      </div>

      {/* SECTION 1: Planned Pathway / Roadmap by Semester */}
      <div className="mb-4">
        <div className="flex items-center justify-between border-r-4 border-black pr-2 mb-2">
          <h2 className="text-[13px] font-bold text-black">
            أولاً: مسار الخطة الدراسية المخطط لها حسب الفصول (Roadmap)
          </h2>
          <span className="text-[10px] text-gray-700 font-medium">
            إجمالي المساقات المخططة: {Object.keys(plannedCourses).length} مساقات
            ({totalPlannedCredits} ساعة معتمدة)
          </span>
        </div>

        {plannedSemestersData.length === 0 ? (
          <div className="border border-dashed border-gray-400 p-3 text-center text-gray-600 text-[11px] rounded mb-3">
            لم يتم بعد توزيع مساقات مستقبلية على الفصول الدراسية في المخطط.
          </div>
        ) : (
          <div className="space-y-3">
            {plannedSemestersData.map((sem, sIdx) => (
              <div
                key={sIdx}
                className="page-break-inside-avoid border border-black rounded-sm overflow-hidden mb-2"
              >
                <div className="bg-gray-200/80 px-2 py-1 flex items-center justify-between border-b border-black font-bold text-[11px]">
                  <div className="flex items-center gap-2">
                    <span>{sem.semesterName}</span>
                    {sem.isSummer && (
                      <span className="text-[9.5px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 rounded">
                        فصل صيفي
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[10.5px]">
                    <span>عدد المساقات: {sem.courses.length}</span>
                    <span>
                      إجمالي الساعات: <strong>{sem.totalCredits}</strong> /{" "}
                      {sem.creditLimit} س
                    </span>
                    {sem.isOverLimit && (
                      <span className="text-red-700 font-bold bg-red-100 px-1 rounded">
                        تجاوز السقف (+{sem.totalCredits - sem.creditLimit}س)
                      </span>
                    )}
                  </div>
                </div>

                <table className="w-full text-right border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-gray-100 border-b border-black font-bold">
                      <th className="py-1 px-2 border-l border-black w-24">
                        رمز المساق
                      </th>
                      <th className="py-1 px-2 border-l border-black">
                        اسم المقرر الدراسي
                      </th>
                      <th className="py-1 px-2 border-l border-black w-12 text-center">
                        الساعات
                      </th>
                      <th className="py-1 px-2 border-l border-black w-36">
                        التصنيف
                      </th>
                      <th className="py-1 px-2 border-l border-black">
                        المتطلب السابق
                      </th>
                      <th className="py-1 px-2 w-20 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300">
                    {sem.courses.map((c) => {
                      const prereqs =
                        c.prerequisites && c.prerequisites.length > 0
                          ? c.prerequisites
                              .map((p) => {
                                const isPPassed = completedCourses.has(p);
                                return `${p}${isPPassed ? " (مستوفى ✓)" : " (قيد الإنجاز)"}`;
                              })
                              .join("، ")
                          : "—";

                      return (
                        <tr
                          key={c.id}
                          className="border-b border-gray-200 hover:bg-gray-50"
                        >
                          <td className="py-1 px-2 border-l border-black font-mono font-bold">
                            {c.id}
                          </td>
                          <td className="py-1 px-2 border-l border-black font-medium">
                            {c.name}
                          </td>
                          <td className="py-1 px-2 border-l border-black text-center font-mono font-bold">
                            {c.credits}
                          </td>
                          <td className="py-1 px-2 border-l border-black text-gray-700">
                            {c.category}
                          </td>
                          <td className="py-1 px-2 border-l border-black text-[9.5px] text-gray-600">
                            {prereqs}
                          </td>
                          <td className="py-1 px-2 text-center font-bold text-blue-900">
                            مخطط للتسجيل
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Completed Courses in Academic Transcript */}
      <div className="mb-4 page-break-inside-avoid">
        <div className="flex items-center justify-between border-r-4 border-black pr-2 mb-2">
          <h2 className="text-[13px] font-bold text-black">
            ثانياً: سجل المقررات المنجزة والمجتازة بنجاح (Completed Courses)
          </h2>
          <span className="text-[10px] text-gray-700 font-medium">
            عدد المقررات المنجزة: {completedList.length} مقررات ({earnedCredits}{" "}
            ساعة معتمدة)
          </span>
        </div>

        {completedList.length === 0 ? (
          <div className="border border-dashed border-gray-400 p-2 text-center text-gray-600 text-[10.5px] rounded mb-3">
            لا توجد مقررات مجتازة مسجلة في السجل الأكاديمي حالياً.
          </div>
        ) : (
          <table className="w-full text-right border-collapse text-[10px] border border-black mb-2">
            <thead>
              <tr className="bg-gray-100 border-b border-black font-bold">
                <th className="py-1 px-2 border-l border-black w-24">
                  رمز المساق
                </th>
                <th className="py-1 px-2 border-l border-black">
                  اسم المقرر الدراسي
                </th>
                <th className="py-1 px-2 border-l border-black w-12 text-center">
                  الساعات
                </th>
                <th className="py-1 px-2 border-l border-black w-40">
                  التصنيف
                </th>
                <th className="py-1 px-2 border-l border-black w-20 text-center">
                  النتيجة
                </th>
                <th className="py-1 px-2 w-16 text-center">العلامة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {completedList.map((c) => {
                const grade = courseGrades[c.id];
                return (
                  <tr key={c.id} className="border-b border-gray-200">
                    <td className="py-0.5 px-2 border-l border-black font-mono font-bold">
                      {c.id}
                    </td>
                    <td className="py-0.5 px-2 border-l border-black font-medium">
                      {c.name}
                    </td>
                    <td className="py-0.5 px-2 border-l border-black text-center font-mono font-bold">
                      {c.credits}
                    </td>
                    <td className="py-0.5 px-2 border-l border-black text-gray-700">
                      {c.category}
                    </td>
                    <td className="py-0.5 px-2 border-l border-black text-center font-bold text-emerald-800">
                      ناجح
                    </td>
                    <td className="py-0.5 px-2 text-center font-mono font-bold privacy-sensitive">
                      {grade !== undefined && grade > 0 ? grade : "P"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* SECTION 3: Remaining Unplanned Courses */}
      {remainingUnplannedCourses.length > 0 && (
        <div className="mb-4 page-break-inside-avoid">
          <div className="flex items-center justify-between border-r-4 border-black pr-2 mb-2">
            <h2 className="text-[13px] font-bold text-black">
              ثالثاً: المقررات المتبقية بالخطة التي لم تُجدول بعد (Remaining
              Unplanned)
            </h2>
            <span className="text-[10px] text-gray-700 font-medium">
              المتبقي بدون جدولة: {remainingUnplannedCourses.length} مقررات (
              {remainingUnplannedCredits} ساعة معتمدة)
            </span>
          </div>

          <table className="w-full text-right border-collapse text-[10px] border border-black mb-2">
            <thead>
              <tr className="bg-gray-100 border-b border-black font-bold">
                <th className="py-1 px-2 border-l border-black w-24">
                  رمز المساق
                </th>
                <th className="py-1 px-2 border-l border-black">
                  اسم المقرر الدراسي
                </th>
                <th className="py-1 px-2 border-l border-black w-12 text-center">
                  الساعات
                </th>
                <th className="py-1 px-2 border-l border-black w-40">
                  التصنيف
                </th>
                <th className="py-1 px-2 w-48">المتطلب السابق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {remainingUnplannedCourses.map((c) => (
                <tr key={c.id} className="border-b border-gray-200">
                  <td className="py-0.5 px-2 border-l border-black font-mono font-bold">
                    {c.id}
                  </td>
                  <td className="py-0.5 px-2 border-l border-black font-medium">
                    {c.name}
                  </td>
                  <td className="py-0.5 px-2 border-l border-black text-center font-mono font-bold">
                    {c.credits}
                  </td>
                  <td className="py-0.5 px-2 border-l border-black text-gray-700">
                    {c.category}
                  </td>
                  <td className="py-0.5 px-2 text-[9.5px] text-gray-600">
                    {c.prerequisites?.join("، ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SECTION 4: Category Fulfillment Breakdown */}
      {categorySummary.length > 0 && (
        <div className="mb-4 page-break-inside-avoid">
          <h2 className="text-[13px] font-bold border-r-4 border-black pr-2 mb-2 text-black">
            رابعاً: تدقيق استيفاء متطلبات التخرج حسب الفئات
          </h2>
          <table className="w-full text-right border-collapse text-[10px] border border-black mb-2">
            <thead>
              <tr className="bg-gray-100 border-b border-black font-bold">
                <th className="py-1 px-2 border-l border-black">
                  فئة المتطلب الدراسي
                </th>
                <th className="py-1 px-2 border-l border-black text-center w-20">
                  الساعات المطلوبة
                </th>
                <th className="py-1 px-2 border-l border-black text-center w-20">
                  الساعات المنجزة
                </th>
                <th className="py-1 px-2 border-l border-black text-center w-20">
                  الساعات المخططة
                </th>
                <th className="py-1 px-2 border-l border-black text-center w-20">
                  المتبقي المطلوب
                </th>
                <th className="py-1 px-2 text-center w-24">حالة الاستيفاء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {categorySummary.map(([catName, data], cIdx) => {
                const totalFulfilled = data.completed + data.planned;
                const remainingNeeded = Math.max(
                  0,
                  data.required - data.completed,
                );
                const isFulfilled = totalFulfilled >= data.required;

                return (
                  <tr key={cIdx} className="border-b border-gray-200">
                    <td className="py-0.5 px-2 border-l border-black font-medium">
                      {catName}
                    </td>
                    <td className="py-0.5 px-2 border-l border-black text-center font-mono font-bold">
                      {data.required}
                    </td>
                    <td className="py-0.5 px-2 border-l border-black text-center font-mono font-bold privacy-sensitive">
                      {data.completed}
                    </td>
                    <td className="py-0.5 px-2 border-l border-black text-center font-mono font-bold">
                      {data.planned}
                    </td>
                    <td className="py-0.5 px-2 border-l border-black text-center font-mono font-bold">
                      {remainingNeeded}
                    </td>
                    <td className="py-0.5 px-2 text-center font-bold">
                      {isFulfilled ? (
                        <span className="text-emerald-800">
                          مستوفى بالخطة ✓
                        </span>
                      ) : (
                        <span className="text-amber-800">
                          ينقص {Math.max(0, data.required - totalFulfilled)}س
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Official Signatures & Seal Section */}
      <div className="mt-6 pt-3 border-t-2 border-black grid grid-cols-4 gap-4 text-center text-[11px] font-semibold page-break-inside-avoid">
        <div className="space-y-8">
          <div>توقيع الطالب</div>
          <div className="border-b border-dashed border-black w-28 mx-auto"></div>
        </div>

        <div className="space-y-8">
          <div>توقيع المرشد الأكاديمي</div>
          <div className="border-b border-dashed border-black w-28 mx-auto"></div>
        </div>

        <div className="space-y-1">
          <div className="text-[10px] text-gray-600 mb-1">
            خاتم عمادة القبول والتسجيل
          </div>
          <div className="w-16 h-16 border-2 border-dashed border-black rounded-full mx-auto flex items-center justify-center text-[9px] text-gray-400 font-bold">
            الختم الرسمي
          </div>
        </div>

        <div className="space-y-8">
          <div>توقيع عميد الكلية</div>
          <div className="border-b border-dashed border-black w-28 mx-auto"></div>
        </div>
      </div>
    </div>
  );
};
