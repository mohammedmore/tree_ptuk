/**
 * Parses only course exemptions explicitly listed in Edugate exam rows.
 *
 * @param {Array<object>} scrapedExams Extracted exam rows.
 * @returns {{ exemptionExams: Array<object>, passedCourseCodes: Set<string> }}
 */
export function parseExemptionExamRows(scrapedExams) {
  const exemptionExams = [];
  const passedCourseCodes = new Set();
  if (!Array.isArray(scrapedExams)) {
    return { exemptionExams, passedCourseCodes };
  }

  const courseNames = {
    15200099: "إنجليزي إستدراكي",
    15200106: "اللغة الإنجليزية (1)",
    15200112: "اللغة الإنجليزية (2)",
    13010006: "مهارات الحاسوب وتطبيقاته",
    15200098: "لغة عربية إستدراكية",
    15200102: "اللغة العربية",
    15200103: "مهارات اللغة العربية",
  };

  for (const item of scrapedExams) {
    const rowText = item.text || (item.cells || []).join(" ");
    if (
      (rowText.includes("رمز المقرر") && rowText.includes("اسم المقرر")) ||
      (rowText.includes("اسم الامتحان") && rowText.includes("النتيجة")) ||
      (rowText.includes("الامتحان") && rowText.includes("المقررات المعفاة"))
    ) {
      continue;
    }

    const exemptedRaw = String(item.exemptedCoursesRaw || "").trim();
    const foundCodes = Array.from(
      new Set(exemptedRaw.match(/\b\d{6,8}\b/g) || []),
    );
    if (foundCodes.length === 0) continue;

    const examName = String(item.examName || item.cells?.[0] || "").trim();
    const semester = String(item.semester || item.cells?.[1] || "").trim();
    const passedRaw = String(item.passedRaw || "").trim();
    const isExplicitFail =
      Boolean(item.hasCloseIcon) ||
      /(راسب|غير معفى|غير مجتاز|فشل|fail|no|\bلا\b)/i.test(passedRaw) ||
      /(راسب|غير معفى|غير مجتاز)/i.test(rowText);
    const isPassedOrExempt =
      !isExplicitFail &&
      (Boolean(item.hasCheckIcon) ||
        /(معفى|معفاة|ناجح|اجتياز|محتسب|معادل|نعم|pass|exempt|yes)/i.test(
          passedRaw,
        ) ||
        /(معفى|معفاة|ناجح|اجتياز|محتسب|معادل|pass|exempt)/i.test(rowText) ||
        foundCodes.length > 0);

    let examGrade = typeof item.grade === "number" ? item.grade : null;
    if (examGrade === null) {
      for (const cell of item.cells || []) {
        const value = String(cell).trim();
        const numericValue = Number(value);
        if (
          Number.isFinite(numericValue) &&
          numericValue >= 0 &&
          numericValue <= 100 &&
          value.length <= 5 &&
          !/^\d{6,8}$/.test(value)
        ) {
          examGrade = numericValue;
          break;
        }
      }
    }

    for (const code of foundCodes) {
      exemptionExams.push({
        code,
        name: courseNames[code] || `مساق ${code}`,
        examName,
        semester: semester || undefined,
        status: isPassedOrExempt
          ? "معفى حسب البيانات المعروضة في البوابة"
          : "غير مجتاز حسب البيانات المعروضة في البوابة",
        grade: examGrade,
        isPassed: isPassedOrExempt,
      });

      if (isPassedOrExempt) passedCourseCodes.add(code);
    }
  }

  return { exemptionExams, passedCourseCodes };
}
