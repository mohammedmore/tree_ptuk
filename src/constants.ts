export const courseCommonNames: Record<string, string> = {
  "15010101": "كالكولس 1",
  "15010102": "كالكولس 2",
  "12140101": "C++",
  "12140102": "جافا",
  "12140203": "داتا ستركشر",
  "12110236": "سيركت",
  "15010229": "لينير 1",
  "15010230": "لينير 2",
  "12140204": "دسكريت",
  "12140205": "خوارزميات",
  "12120207": "ديجيتال",
  "12140308": "OS",
  "12110316": "رقمية",
  "12140309": "داتا بيس",
  "12130302": "سجنال",
  "12140418": "سوفتوير",
  "12130527": "DSP",
  "12130350": "CS",
  "12140414": "اسمبلي",
  "12110355": "كنترول",
  "12140412": "ISAD",
  "12140420": "VHDL",
  "11300001": "برمجة مرئية",
  "12140523": "ويب",
  "12140535": "تنجيم",
};

export const TOTAL_CREDITS = 164; // Added this constant

export const getYearFromId = (id: string): string => {
  if (id.length >= 6) {
    const levelChar = id.charAt(5);
    const level = parseInt(levelChar);
    if (!isNaN(level) && level >= 1 && level <= 5) return level.toString();
  }
  if (id.startsWith("1520") || id.startsWith("1301")) return "1";
  if (id.startsWith("121401")) return "1";
  if (id.startsWith("121402")) return "2";
  if (id.startsWith("121403")) return "3";
  if (id.startsWith("121404")) return "4";
  if (id.startsWith("121405")) return "5";
  return "1";
};

export const SEMESTERS = [
  "السنة الأولى - الفصل الأول",
  "السنة الأولى - الفصل الثاني",
  "السنة الأولى - الصيفي",
  "السنة الثانية - الفصل الأول",
  "السنة الثانية - الفصل الثاني",
  "السنة الثانية - الصيفي",
  "السنة الثالثة - الفصل الأول",
  "السنة الثالثة - الفصل الثاني",
  "السنة الثالثة - الصيفي",
  "السنة الرابعة - الفصل الأول",
  "السنة الرابعة - الفصل الثاني",
  "السنة الرابعة - الصيفي",
  "السنة الخامسة - الفصل الأول",
  "السنة الخامسة - الفصل الثاني",
  "السنة الخامسة - الصيفي",
];

export const REGULAR_SEMESTERS = [
  "السنة الأولى - الفصل الأول",
  "السنة الأولى - الفصل الثاني",
  "السنة الثانية - الفصل الأول",
  "السنة الثانية - الفصل الثاني",
  "السنة الثالثة - الفصل الأول",
  "السنة الثالثة - الفصل الثاني",
  "السنة الرابعة - الفصل الأول",
  "السنة الرابعة - الفصل الثاني",
  "السنة الخامسة - الفصل الأول",
  "السنة الخامسة - الفصل الثاني",
] as const;

export const courseRecommendedSemesters: Record<string, string> = {
  "12140101": "السنة الأولى - الفصل الأول",
  "15010101": "السنة الأولى - الفصل الأول",
  "15020101": "السنة الأولى - الفصل الأول",
  "15020105": "السنة الأولى - الفصل الأول",
  "15200106": "السنة الأولى - الفصل الأول",
  "13010006": "السنة الأولى - الفصل الأول",
  "15200099": "السنة الأولى - الفصل الأول",
  "12140102": "السنة الأولى - الفصل الثاني",
  "15010102": "السنة الأولى - الفصل الثاني",
  "15020102": "السنة الأولى - الفصل الثاني",
  "15020106": "السنة الأولى - الفصل الثاني",
  "15200112": "السنة الأولى - الفصل الثاني",
  "12210137": "السنة الأولى - الفصل الثاني",
  "12140203": "السنة الثانية - الفصل الأول",
  "12110236": "السنة الثانية - الفصل الأول",
  "15010229": "السنة الثانية - الفصل الأول",
  "12140208": "السنة الثانية - الفصل الأول",
  "12140204": "السنة الثانية - الفصل الأول",
  "15200104": "السنة الثانية - الفصل الأول",
  "12140205": "السنة الثانية - الفصل الثاني",
  "12120205": "السنة الثانية - الفصل الثاني",
  "15010230": "السنة الثانية - الفصل الثاني",
  "12110237": "السنة الثانية - الفصل الثاني",
  "13010007": "السنة الثانية - الفصل الثاني",
  "12120207": "السنة الثانية - الفصل الثاني",
  "15200101": "السنة الثانية - الفصل الثاني",
  "12140309": "السنة الثالثة - الفصل الأول",
  "12140314": "السنة الثالثة - الفصل الأول",
  "12120208": "السنة الثالثة - الفصل الأول",
  "12110316": "السنة الثالثة - الفصل الأول",
  "12120206": "السنة الثالثة - الفصل الأول",
  "12210444": "السنة الثالثة - الفصل الأول",
  "12130302": "السنة الثالثة - الفصل الأول",
  "15200102": "السنة الثالثة - الفصل الأول",
  "12140312": "السنة الثالثة - الفصل الثاني",
  "12140313": "السنة الثالثة - الفصل الثاني",
  "12140418": "السنة الثالثة - الفصل الثاني",
  "12130527": "السنة الثالثة - الفصل الثاني",
  "12130303": "السنة الثالثة - الفصل الثاني",
  "12140210": "السنة الثالثة - الفصل الثاني",
  "12140414": "السنة الثالثة - الفصل الثاني",
  "12110355": "السنة الرابعة - الفصل الأول",
  "12140415": "السنة الرابعة - الفصل الأول",
  "12140413": "السنة الرابعة - الفصل الأول",
  "12140308": "السنة الرابعة - الفصل الأول",
  "12140533": "السنة الرابعة - الفصل الأول",
  "12140420": "السنة الرابعة - الفصل الثاني",
  "12140523": "السنة الرابعة - الفصل الثاني",
  "12140532": "السنة الرابعة - الفصل الثاني",
  "12130350": "السنة الرابعة - الفصل الثاني",
  "12140412": "السنة الرابعة - الفصل الثاني",
  "12140521": "السنة الخامسة - الفصل الأول",
  "12310599": "السنة الخامسة - الفصل الأول",
  "12140435": "السنة الخامسة - الفصل الأول",
  "15010325": "السنة الخامسة - الفصل الأول",
  "12140524": "السنة الخامسة - الفصل الثاني",
  "12140527": "السنة الخامسة - الفصل الثاني",
  "15200107": "السنة الخامسة - الفصل الثاني",
};

export const getRecommendedSemesterOfCourse = (course: {
  id: string;
  category: string;
  semester?: string;
  recommendedSemester?: string;
  prerequisites?: string[];
  name?: string;
}): string => {
  // 1. If explicit semester is already specified on course, normalize and validate
  const rawSem = course.semester || course.recommendedSemester;
  if (rawSem) {
    if (SEMESTERS.includes(rawSem)) return rawSem;

    // Check term
    const isSummer = rawSem.includes("صيفي") || rawSem.includes("الصيفي");
    const isSecond =
      !isSummer &&
      (rawSem.includes("الثاني") ||
        rawSem.includes("ثاني") ||
        rawSem.includes("2"));
    const term = isSummer
      ? "الصيفي"
      : isSecond
        ? "الفصل الثاني"
        : "الفصل الأول";

    // Check academic year
    let yStr = "";
    if (rawSem.includes("الأولى") || rawSem.includes("الاولى"))
      yStr = "السنة الأولى";
    else if (rawSem.includes("الثانية") || rawSem.includes("الثانيه"))
      yStr = "السنة الثانية";
    else if (rawSem.includes("الثالثة") || rawSem.includes("الثالثه"))
      yStr = "السنة الثالثة";
    else if (rawSem.includes("الرابعة") || rawSem.includes("الرابعه"))
      yStr = "السنة الرابعة";
    else if (rawSem.includes("الخامسة") || rawSem.includes("الخامسه"))
      yStr = "السنة الخامسة";

    if (!yStr) {
      const yFromId = getYearFromId(course.id);
      yStr =
        {
          "1": "السنة الأولى",
          "2": "السنة الثانية",
          "3": "السنة الثالثة",
          "4": "السنة الرابعة",
          "5": "السنة الخامسة",
        }[yFromId] || "السنة الأولى";
    }

    const resolved = `${yStr} - ${term}`;
    if (SEMESTERS.includes(resolved)) return resolved;
  }

  // 2. If present in pre-configured CSE map, use it
  if (courseRecommendedSemesters[course.id]) {
    return courseRecommendedSemesters[course.id];
  }

  // 3. Determine academic year
  const yearStr = getYearFromId(course.id);
  const yearWord =
    {
      "1": "السنة الأولى",
      "2": "السنة الثانية",
      "3": "السنة الثالثة",
      "4": "السنة الرابعة",
      "5": "السنة الخامسة",
    }[yearStr] || "السنة الأولى";

  // 4. University electives - distribute evenly
  if (course.category === "متطلب جامعة اختياري") {
    const lastChar = course.id.charAt(course.id.length - 1);
    return parseInt(lastChar, 10) % 2 === 0
      ? `${yearWord} - الفصل الأول`
      : `${yearWord} - الفصل الثاني`;
  }

  // 5. Specialization electives - distribute evenly
  if (course.category === "متطلب تخصص اختياري") {
    const lastChar = course.id.charAt(course.id.length - 1);
    return parseInt(lastChar, 10) % 2 === 0
      ? `${yearWord} - الفصل الأول`
      : `${yearWord} - الفصل الثاني`;
  }

  // 6. Mandatory courses: balance between Semester 1 and Semester 2
  const name = course.name || "";
  const yNum = parseInt(yearStr, 10) || 1;
  const hasPrereqsInSameYear =
    Array.isArray(course.prerequisites) &&
    course.prerequisites.some((p) => {
      const pYear = parseInt(getYearFromId(p), 10) || 1;
      return pYear === yNum;
    });
  const isSecondPart =
    name.includes("(2)") ||
    name.includes(" 2") ||
    name.includes("ثاني") ||
    name.includes("الثاني") ||
    name.includes("مختبر") ||
    name.includes("عملي");
  const lastDigit = parseInt(course.id.slice(-1), 10) || 0;

  // Part 2 courses or courses with prerequisites in same year go to Semester 2
  const isSemester2 =
    isSecondPart || hasPrereqsInSameYear || lastDigit % 2 === 0;

  return `${yearWord} - ${isSemester2 ? "الفصل الثاني" : "الفصل الأول"}`;
};

export const ELECTIVE_SLOTS_DEFS: Record<
  string,
  { id: string; category: string; label: string; defaultCourseId: string }
> = {
  univ_1: {
    id: "univ_1",
    category: "متطلب جامعة اختياري",
    label: "مساق اختياري جامعة (1)",
    defaultCourseId: "13020001",
  },
  univ_2: {
    id: "univ_2",
    category: "متطلب جامعة اختياري",
    label: "مساق اختياري جامعة (2)",
    defaultCourseId: "13020009",
  },
  univ_3: {
    id: "univ_3",
    category: "متطلب جامعة اختياري",
    label: "مساق اختياري جامعة (3)",
    defaultCourseId: "13020026",
  },
  spec_1: {
    id: "spec_1",
    category: "متطلب تخصص اختياري",
    label: "مساق اختياري تخصص (1)",
    defaultCourseId: "12140416",
  },
  spec_2: {
    id: "spec_2",
    category: "متطلب تخصص اختياري",
    label: "مساق اختياري تخصص (2)",
    defaultCourseId: "12140549",
  },
  spec_3: {
    id: "spec_3",
    category: "متطلب تخصص اختياري",
    label: "مساق اختياري تخصص (3)",
    defaultCourseId: "12140505",
  },
  spec_4: {
    id: "spec_4",
    category: "متطلب تخصص اختياري",
    label: "مساق اختياري تخصص (4)",
    defaultCourseId: "12140510",
  },
  spec_5: {
    id: "spec_5",
    category: "متطلب تخصص اختياري",
    label: "مساق اختياري تخصص (5)",
    defaultCourseId: "12140526",
  },
};

export const SEMESTER_ELECTIVE_SLOTS: Record<string, string[]> = {
  "السنة الثانية - الفصل الأول": ["univ_1", "univ_2"],
  "السنة الرابعة - الفصل الأول": ["spec_1"],
  "السنة الرابعة - الفصل الثاني": ["spec_2"],
  "السنة الخامسة - الفصل الأول": ["spec_3", "univ_3"],
  "السنة الخامسة - الفصل الثاني": ["spec_4", "spec_5"],
};
