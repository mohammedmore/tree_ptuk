export const EDUGATE_PLAN_SOURCE = "edugate_major_plan";

const COURSE_CODE_PATTERN = /^\d{6,8}$/;
const MAX_COURSE_CREDITS = 12;

/**
 * @typedef {Object} NormalizedEdugateCourse
 * @property {string} id
 * @property {string} code
 * @property {string} name
 * @property {number} credits
 * @property {string} category
 * @property {string[]} prerequisites
 * @property {string} semester
 * @property {string} recommendedSemester
 */

function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

/**
 * Validate and normalize a curriculum extracted from the student's Edugate plan.
 * The function deliberately does not infer courses, requirements, or semesters.
 *
 * @param {unknown} result
 * @returns {{ source: string, courses: NormalizedEdugateCourse[], categoryRequirements: Record<string, number>, totalDegreeCredits: number }}
 */
export function normalizeEdugateMajorPlan(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("تعذر قراءة الخطة الاسترشادية من بوابة الجامعة.");
  }

  const rawCourses = result.courses;
  if (!Array.isArray(rawCourses) || rawCourses.length === 0) {
    throw new Error("لم تُرجع بوابة الجامعة مواد للخطة الاسترشادية.");
  }

  const seenCourseCodes = new Set();
  const courses = rawCourses.map((course, index) => {
    if (!course || typeof course !== "object" || Array.isArray(course)) {
      throw new Error(`تعذر التحقق من المادة رقم ${index + 1} في الخطة.`);
    }

    const id = normalizeDigits(course.id || course.code).trim();
    const name = String(course.name ?? "").trim();
    const rawCredits = normalizeDigits(course.credits).trim();
    const credits = Number(rawCredits);

    if (!COURSE_CODE_PATTERN.test(id)) {
      throw new Error(
        `رمز المادة رقم ${index + 1} غير صالح في الخطة المستخرجة.`,
      );
    }
    if (seenCourseCodes.has(id)) {
      throw new Error(`تكرر رمز المادة ${id} في الخطة المستخرجة.`);
    }
    if (!name || name === `مساق ${id}`) {
      throw new Error(`اسم المادة ${id} غير موجود في الخطة المستخرجة.`);
    }
    if (
      rawCredits === "" ||
      !Number.isFinite(credits) ||
      credits < 0 ||
      credits > MAX_COURSE_CREDITS
    ) {
      throw new Error(`ساعات المادة ${id} غير صالحة في الخطة المستخرجة.`);
    }

    seenCourseCodes.add(id);
    const prerequisites = Array.isArray(course.prerequisites)
      ? [
          ...new Set(
            course.prerequisites.map((value) => normalizeDigits(value).trim()),
          ),
        ]
      : [];
    if (
      prerequisites.some(
        (prerequisite) => !COURSE_CODE_PATTERN.test(prerequisite),
      )
    ) {
      throw new Error(`المتطلبات السابقة للمادة ${id} غير صالحة.`);
    }

    const semester = String(
      course.semester || course.recommendedSemester || "",
    ).trim();

    return {
      ...course,
      id,
      code: id,
      name,
      credits,
      category: String(course.category || "غير مصنف").trim(),
      prerequisites,
      semester,
      recommendedSemester: semester,
    };
  });

  const categoryRequirements = {};
  const rawRequirements = result.categoryRequirements;
  if (
    rawRequirements &&
    typeof rawRequirements === "object" &&
    !Array.isArray(rawRequirements)
  ) {
    for (const [category, rawCredits] of Object.entries(rawRequirements)) {
      const rawValue = normalizeDigits(rawCredits).trim();
      const credits = Number(rawValue);
      if (
        rawValue !== "" &&
        category.trim() &&
        Number.isFinite(credits) &&
        credits >= 0 &&
        credits <= 180
      ) {
        categoryRequirements[category.trim()] = credits;
      }
    }
  }

  const rawTotal = Number(normalizeDigits(result.totalDegreeCredits));
  const totalDegreeCredits =
    Number.isFinite(rawTotal) && rawTotal >= 30 && rawTotal <= 260
      ? rawTotal
      : 0;

  return {
    source: EDUGATE_PLAN_SOURCE,
    courses,
    categoryRequirements,
    totalDegreeCredits,
  };
}
