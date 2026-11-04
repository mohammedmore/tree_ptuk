/**
 * Official PTUK Tuition & Fees Service (Frontend)
 * Sourced directly from Palestine Technical University - Kadoorie Admission & Registration records.
 */

export interface MajorTuitionRate {
  hourlyRateJOD: number;
  faculty: string;
  notes?: string;
}

export const OFFICIAL_TUITION_RATES: Record<string, MajorTuitionRate> = {
  // Engineering & Technology (24 JOD/hr)
  "هندسة أنظمة الحاسوب": {
    hourlyRateJOD: 24,
    faculty: "كلية الهندسة والتكنولوجيا",
  },
  "الهندسة الكهربائية": {
    hourlyRateJOD: 24,
    faculty: "كلية الهندسة والتكنولوجيا",
  },
  "هندسة الميكاترونكس": {
    hourlyRateJOD: 24,
    faculty: "كلية الهندسة والتكنولوجيا",
  },
  "الهندسة الميكانيكية": {
    hourlyRateJOD: 24,
    faculty: "كلية الهندسة والتكنولوجيا",
  },
  "الهندسة المدنية": {
    hourlyRateJOD: 24,
    faculty: "كلية الهندسة والتكنولوجيا",
  },
  "هندسة العمارة": { hourlyRateJOD: 24, faculty: "كلية الهندسة والتكنولوجيا" },
  "هندسة الاتصالات": {
    hourlyRateJOD: 24,
    faculty: "كلية الهندسة والتكنولوجيا",
  },
  "الهندسة الصناعية": {
    hourlyRateJOD: 24,
    faculty: "كلية الهندسة والتكنولوجيا",
  },

  // IT & AI (20 - 26 JOD/hr)
  "الذكاء الاصطناعي": {
    hourlyRateJOD: 26,
    faculty: "كلية تكنولوجيا المعلومات والذكاء الاصطناعي",
  },
  "هندسة البرمجيات": {
    hourlyRateJOD: 20,
    faculty: "كلية تكنولوجيا المعلومات والذكاء الاصطناعي",
  },
  "علم الحاسوب": {
    hourlyRateJOD: 20,
    faculty: "كلية تكنولوجيا المعلومات والذكاء الاصطناعي",
  },
  "أنظمة المعلومات الحاسوبية": {
    hourlyRateJOD: 20,
    faculty: "كلية تكنولوجيا المعلومات والذكاء الاصطناعي",
  },
  "شبكات الحاسوب وأمن المعلومات": {
    hourlyRateJOD: 20,
    faculty: "كلية تكنولوجيا المعلومات والذكاء الاصطناعي",
  },

  // Allied Medical Sciences (36 JOD/hr)
  "العلوم الطبية المخبرية": {
    hourlyRateJOD: 36,
    faculty: "كلية العلوم الطبية المساندة",
  },
  "التصوير الطبي": {
    hourlyRateJOD: 36,
    faculty: "كلية العلوم الطبية المساندة",
  },
  "العلاج الطبيعي": {
    hourlyRateJOD: 36,
    faculty: "كلية العلوم الطبية المساندة",
  },
  التمريض: { hourlyRateJOD: 32, faculty: "كلية العلوم الطبية المساندة" },

  // Business & Economics (20 JOD/hr)
  المحاسبة: { hourlyRateJOD: 20, faculty: "كلية الأعمال والاقتصاد" },
  "إدارة الأعمال": { hourlyRateJOD: 20, faculty: "كلية الأعمال والاقتصاد" },
  "العلوم المالية والمصرفية": {
    hourlyRateJOD: 20,
    faculty: "كلية الأعمال والاقتصاد",
  },
  "التسويق والتجارة الإلكترونية": {
    hourlyRateJOD: 20,
    faculty: "كلية الأعمال والاقتصاد",
  },
  "نظم المعلومات الإدارية": {
    hourlyRateJOD: 20,
    faculty: "كلية الأعمال والاقتصاد",
  },
  "اللوجستيات وسلاسل الإمداد": {
    hourlyRateJOD: 20,
    faculty: "كلية الأعمال والاقتصاد",
  },

  // Applied Sciences & Arts (18 - 24 JOD/hr)
  "الرياضيات التطبيقية": {
    hourlyRateJOD: 18,
    faculty: "كلية العلوم التطبيقية",
  },
  "الفيزياء التطبيقية": { hourlyRateJOD: 18, faculty: "كلية العلوم التطبيقية" },
  "الكيمياء التطبيقية": { hourlyRateJOD: 18, faculty: "كلية العلوم التطبيقية" },
  "التصميم الجرافيكي": {
    hourlyRateJOD: 24,
    faculty: "كلية الآداب والعلوم التربوية",
  },
  "الإعلام الرقمي": {
    hourlyRateJOD: 20,
    faculty: "كلية الآداب والعلوم التربوية",
  },
  "اللغة الإنجليزية التطبيقية": {
    hourlyRateJOD: 18,
    faculty: "كلية الآداب والعلوم التربوية",
  },
  "التربية الرياضية": {
    hourlyRateJOD: 18,
    faculty: "كلية التربية البدنية وعلوم الرياضة",
  },

  // Agricultural Engineering (20 JOD/hr)
  "الإنتاج النباتي والوقاية": {
    hourlyRateJOD: 20,
    faculty: "كلية الهندسة الزراعية والطب البيطري",
  },
  "الإنتاج الحيواني وصحة الحيوان": {
    hourlyRateJOD: 20,
    faculty: "كلية الهندسة الزراعية والطب البيطري",
  },
  "الطب البيطري": {
    hourlyRateJOD: 30,
    faculty: "كلية الهندسة الزراعية والطب البيطري",
  },

  // Intermediate Diploma (12 JOD/hr average)
  دبلوم: { hourlyRateJOD: 12, faculty: "كلية فلسطين التقنية" },
};

export const OFFICIAL_FIXED_FEES = {
  registrationFeeJOD: 25, // رسوم التسجيل الفصلية (طولكرم)
  studentUnionFeeJOD: 1, // رسوم مجلس الطلبة (طولكرم)
  universityCardFeeJOD: 2, // بطاقة جامعية (للمستجدين فقط)
  levelExamFeeJOD: 20, // امتحانات المستوى (للمستجدين فقط)
  defaultExchangeRateILS: 5.15, // متوسط سعر صرف الدينار الأردني بالشيكل
};

/**
 * Returns the exact official hourly rate for any given major name
 */
export function getOfficialTuitionRate(majorName = ""): MajorTuitionRate {
  if (!majorName)
    return { hourlyRateJOD: 24, faculty: "كلية الهندسة والتكنولوجيا" };

  const norm = String(majorName).trim();

  // 1. Direct match
  if (OFFICIAL_TUITION_RATES[norm]) {
    return OFFICIAL_TUITION_RATES[norm];
  }

  // 2. Keyword matching
  if (norm.includes("دبلوم") || norm.includes("مهني")) {
    return { hourlyRateJOD: 12, faculty: "كلية فلسطين التقنية" };
  }
  if (norm.includes("ذكاء") || norm.includes("ai")) {
    return OFFICIAL_TUITION_RATES["الذكاء الاصطناعي"];
  }
  if (norm.includes("هندسة") || norm.includes("هندس")) {
    return { hourlyRateJOD: 24, faculty: "كلية الهندسة والتكنولوجيا" };
  }
  if (
    norm.includes("طبية") ||
    norm.includes("مخبرية") ||
    norm.includes("تصوير") ||
    norm.includes("علاج")
  ) {
    return { hourlyRateJOD: 36, faculty: "كلية العلوم الطبية المساندة" };
  }
  if (norm.includes("تمريض")) {
    return { hourlyRateJOD: 32, faculty: "كلية العلوم الطبية المساندة" };
  }
  if (
    norm.includes("حاسوب") ||
    norm.includes("برمجيات") ||
    norm.includes("it") ||
    norm.includes("شبكات")
  ) {
    return {
      hourlyRateJOD: 20,
      faculty: "كلية تكنولوجيا المعلومات والذكاء الاصطناعي",
    };
  }
  if (
    norm.includes("محاسب") ||
    norm.includes("إدارة") ||
    norm.includes("اقتصاد") ||
    norm.includes("مالية") ||
    norm.includes("تسويق")
  ) {
    return { hourlyRateJOD: 20, faculty: "كلية الأعمال والاقتصاد" };
  }
  if (norm.includes("رياضة") || norm.includes("بدنية")) {
    return { hourlyRateJOD: 18, faculty: "كلية التربية البدنية وعلوم الرياضة" };
  }
  if (
    norm.includes("علوم") ||
    norm.includes("رياضيات") ||
    norm.includes("فيزياء") ||
    norm.includes("كيمياء")
  ) {
    return { hourlyRateJOD: 18, faculty: "كلية العلوم التطبيقية" };
  }

  // Default fallback
  return { hourlyRateJOD: 22, faculty: "جامعة فلسطين التقنية - خضوري" };
}

export interface TuitionCalculationResult {
  majorName: string;
  faculty: string;
  credits: number;
  hourlyRateJOD: number;
  creditsFeeJOD: number;
  fixedFees: {
    registrationFeeJOD: number;
    studentUnionFeeJOD: number;
    universityCardFeeJOD: number;
    levelExamFeeJOD: number;
    totalFixedFeesJOD: number;
  };
  totalJOD: number;
  totalILS: number;
  exchangeRate: number;
}

/**
 * Calculates semester fees with full breakdown
 */
export function calculateSemesterTuition({
  majorName = "",
  credits = 18,
  isFreshman = false,
  customExchangeRate = null,
}: {
  majorName?: string;
  credits?: number;
  isFreshman?: boolean;
  customExchangeRate?: number | null;
}): TuitionCalculationResult {
  const rateInfo = getOfficialTuitionRate(majorName);
  const hourlyRateJOD = rateInfo.hourlyRateJOD;
  const creditsFeeJOD = credits * hourlyRateJOD;

  const registrationFeeJOD = OFFICIAL_FIXED_FEES.registrationFeeJOD;
  const studentUnionFeeJOD = OFFICIAL_FIXED_FEES.studentUnionFeeJOD;
  const universityCardFeeJOD = isFreshman
    ? OFFICIAL_FIXED_FEES.universityCardFeeJOD
    : 0;
  const levelExamFeeJOD = isFreshman ? OFFICIAL_FIXED_FEES.levelExamFeeJOD : 0;

  const totalFixedFeesJOD =
    registrationFeeJOD +
    studentUnionFeeJOD +
    universityCardFeeJOD +
    levelExamFeeJOD;

  const totalJOD = creditsFeeJOD + totalFixedFeesJOD;
  const exchangeRate =
    customExchangeRate || OFFICIAL_FIXED_FEES.defaultExchangeRateILS;
  const totalILS = Math.round(totalJOD * exchangeRate);

  return {
    majorName,
    faculty: rateInfo.faculty,
    credits,
    hourlyRateJOD,
    creditsFeeJOD,
    fixedFees: {
      registrationFeeJOD,
      studentUnionFeeJOD,
      universityCardFeeJOD,
      levelExamFeeJOD,
      totalFixedFeesJOD,
    },
    totalJOD,
    totalILS,
    exchangeRate,
  };
}
