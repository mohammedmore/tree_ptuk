/**
 * Normalizes Arabic text for stable message classification.
 * Converts Eastern Arabic & Persian numerals to ASCII, unifies Alef/Yaa/Taa variants,
 * and collapses consecutive whitespace.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeArabicMessage(text) {
  if (!text || typeof text !== "string") return "";

  return (
    text
      // Normalize Arabic-Indic and Persian numerals to ASCII
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      // Normalize Alef variants
      .replace(/[إأآٱ]/g, "ا")
      // Normalize Yaa variants
      .replace(/ى/g, "ي")
      // Normalize Taa Marbuta
      .replace(/ة/g, "ه")
      // Remove diacritics (Tashkeel)
      .replace(/[\u064B-\u065F\u0670]/g, "")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Message Catalog mapping regex patterns to stable error codes.
 */
export const MESSAGE_PATTERNS = [
  {
    code: "SECTION_FULL",
    pattern:
      /(مكتمل|الشعبه مغلقه|مغلقه|لا توجد شواغر|العدد مكتمل|السعه مكتمله)/i,
    userMessage: "الشعبة المطلوبة مغلقة واكتمل عددها.",
  },
  {
    code: "TIME_CONFLICT",
    pattern: /(تعارض|يوجد تعارض|تعارض في الوقت|تضارب في المواعيد)/i,
    userMessage: "يوجد تعارض في وقت المحاضرة مع مادة أخرى مسجلة.",
  },
  {
    code: "PREREQ_MISSING",
    pattern: /(متطلب سابق|لم تجتز المتطلب|متطلب اجباري|غير مستوفي الشروط)/i,
    userMessage: "لم يتم استيفاء المتطلب السابق للمساق.",
  },
  {
    code: "HOURS_LIMIT",
    pattern:
      /(تجاوز الحد الاقصي|الحد الاعلي للساعات|العبء الدراسي|الحد الاقصي المسموح)/i,
    userMessage: "تجاوزت الحد الأقصى للساعات المسموح بتسجيلها لهذا الفصل.",
  },
  {
    code: "FINANCIAL_HOLD",
    pattern:
      /(الدائره الماليه|قيد مالي|براءه ذمه|الرصيد غير كاف|مراجعه الماليه)/i,
    userMessage: "يوجد قيد مالي أو يلزم مراجعة الدائرة المالية لتسديد الرسوم.",
  },
  {
    code: "WINDOW_CLOSED",
    pattern:
      /(فتره التسجيل غير متاحه|التسجيل مغلق|غير متاح للتسجيل|لا يمكنك التسجيل|موعد التسجيل غير متاح)/i,
    userMessage: "نافذة التسجيل الإلكتروني مغلقة حالياً حسب التقويم الأكاديمي.",
  },
  {
    code: "ADVISOR_APPROVAL_REQUIRED",
    pattern: /(موافقه المرشد|مراجعه المرشد الاكاديمي|اعتماد المرشد)/i,
    userMessage: "يتطلب التسجيل مراجعة أو اعتماد المرشد الأكاديمي أولاً.",
  },
  {
    code: "ALREADY_REGISTERED",
    pattern: /(المساق مسجل مسبقا|تم تسجيل المساق|مسجل بالفعل)/i,
    userMessage: "المساق مسجل بالفعل في جدولك الحالي.",
  },
];

/**
 * Classifies raw server notice/text into a stable code.
 *
 * @param {string} rawText
 * @returns {{ code: string, userMessage: string, normalizedText: string }}
 */
export function classifyPortalMessage(rawText) {
  const normalized = normalizeArabicMessage(rawText);
  if (!normalized) {
    return {
      code: "NO_MESSAGE",
      userMessage: "لم يصدر الخادم أي رسالة توضيحية.",
      normalizedText: "",
    };
  }

  for (const entry of MESSAGE_PATTERNS) {
    if (entry.pattern.test(normalized)) {
      return {
        code: entry.code,
        userMessage: entry.userMessage,
        normalizedText: normalized,
      };
    }
  }

  return {
    code: "UNKNOWN_MESSAGE",
    userMessage: `رسالة غير مصنفة من الخادم: "${rawText.slice(0, 150)}"`,
    normalizedText: normalized,
  };
}
