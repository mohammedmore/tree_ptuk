import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const TITLE_PREFIXES = new Set([
  "د",
  "دكتور",
  "دكتوره",
  "استاذ",
  "استاذه",
  "اد",
  "ا د",
  "م",
  "مهندس",
  "مهندسه",
  "شيخ",
]);

/**
 * Normalizes Arabic text for flexible matching:
 * - Unifies Alef variants (أ, إ, آ, ء) to ا
 * - Unifies Yaa / Alif Maqsura (ى -> ي)
 * - Unifies Taa Marbuta (ة -> ه)
 * - Removes diacritics / tashkeel and tatweel
 * - Replaces punctuation with whitespace
 */
export function normalizeArabicText(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // remove invisible zero-width chars (Item 28)
    .replace(/[\u064B-\u065F\u0670]/g, "") // remove tashkeel/diacritics
    .replace(/[أإآء]/g, "ا") // normalize alefs
    .replace(/ى/g, "ي") // normalize yaa
    .replace(/ة/g, "ه") // normalize taa marbouta
    .replace(/ـ/g, "") // remove tatweel
    .replace(/[.,/#!$%^&*;:{}=\-_`~()،؟؛«»"']/g, " ") // punctuation & Arabic commas to space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if a candidate Arabic word matches a search token:
 * Handles exact prefix, substring, and handles optional "ال" (definite article)
 */
export function wordsMatch(targetWord: string, queryToken: string): boolean {
  if (!targetWord || !queryToken) return false;
  const t = normalizeArabicText(targetWord);
  const q = normalizeArabicText(queryToken);
  if (!t || !q) return false;

  if (t === q) return true;
  if (t.startsWith(q) || t.includes(q)) return true;

  // Compare without leading "ال" (if length > 3 to avoid short words)
  const tClean = t.startsWith("ال") && t.length > 3 ? t.slice(2) : t;
  const qClean = q.startsWith("ال") && q.length > 3 ? q.slice(2) : q;

  if (tClean === qClean) return true;
  if (tClean.startsWith(qClean) || tClean.includes(qClean)) return true;

  return false;
}

/**
 * Strips title honorifics (د. / أ.د. / م. / دكتور) from the beginning of doctor names
 */
export function getDoctorSignificantTokens(normalizedName: string): string[] {
  let words = normalizedName.split(" ").filter(Boolean);
  while (
    words.length > 1 &&
    (TITLE_PREFIXES.has(words[0]) || words[0] === "ا" || words[0] === "د")
  ) {
    words = words.slice(1);
  }
  return words;
}

export interface DoctorMatchResult {
  matches: boolean;
  score: number;
}

/**
 * High-precision Doctor name matcher designed for student search patterns:
 * Handles:
 * 1. Searching by First and Last name only (e.g. "سامر سعيد" matches "د. سامر عبد الله حسن سعيد")
 * 2. Typing with or without titles ("د.", "دكتور", "م.")
 * 3. Search with or without Hamza ("احمد" matches "أحمد")
 * 4. Search with or without "ال" ("شبيطة" matches "الشبيطة")
 * 5. Multi-token partial and prefix matching
 */
export function matchDoctorName(
  doctorName: string,
  query: string,
): DoctorMatchResult {
  if (!query.trim()) return { matches: true, score: 0 };
  if (!doctorName) return { matches: false, score: 0 };

  const normDoc = normalizeArabicText(doctorName);
  const normQuery = normalizeArabicText(query);

  if (!normQuery) return { matches: true, score: 0 };
  if (normDoc === normQuery) return { matches: true, score: 100 };

  const queryWords = normQuery.split(" ").filter(Boolean);
  // Strip standalone title words from query if other words exist (e.g. "دكتور سامر" -> ["سامر"])
  const filteredQueryTokens =
    queryWords.length > 1
      ? queryWords.filter((w) => !TITLE_PREFIXES.has(w))
      : queryWords;

  const docWords = getDoctorSignificantTokens(normDoc);
  const allDocWords = normDoc.split(" ").filter(Boolean);

  if (filteredQueryTokens.length === 0) return { matches: true, score: 10 };

  // Direct substring inclusion
  if (normDoc.includes(normQuery)) {
    return { matches: true, score: 85 };
  }

  // First & Last Name Match (Highest priority for university students)
  if (filteredQueryTokens.length === 2 && docWords.length >= 2) {
    const [qFirst, qLast] = filteredQueryTokens;
    const dFirst = docWords[0];
    const dLast = docWords[docWords.length - 1];

    const firstMatches = wordsMatch(dFirst, qFirst);
    const lastMatches = wordsMatch(dLast, qLast);

    if (firstMatches && lastMatches) {
      return { matches: true, score: 95 };
    }
  }

  // Multi-token match: Every query token must match at least one doctor word
  const matchedWordIndices: number[] = [];
  let isAllMatched = true;

  for (const qToken of filteredQueryTokens) {
    const matchIndex = docWords.findIndex(
      (dWord, idx) =>
        !matchedWordIndices.includes(idx) && wordsMatch(dWord, qToken),
    );

    if (matchIndex !== -1) {
      matchedWordIndices.push(matchIndex);
    } else {
      const fallbackIdx = allDocWords.findIndex((dWord) =>
        wordsMatch(dWord, qToken),
      );
      if (fallbackIdx === -1) {
        isAllMatched = false;
        break;
      }
    }
  }

  if (isAllMatched) {
    const isSequential = matchedWordIndices.every(
      (val, i, arr) => !i || arr[i - 1] < val,
    );
    const score = isSequential ? 75 : 60;
    return { matches: true, score };
  }

  return { matches: false, score: 0 };
}

export interface CourseDeliveryType {
  type: "lab" | "project" | "training" | "theory";
  label: string;
  badgeClass: string;
}

/**
 * Determines the academic delivery nature of a course (Theory vs Lab/Practical vs Project vs Training)
 * based on official PTUK naming conventions.
 */
export function getCourseDeliveryType(courseName: string): CourseDeliveryType {
  const norm = normalizeArabicText(courseName);
  if (norm.includes("مختبر") || courseName.toLowerCase().includes("lab")) {
    return {
      type: "lab",
      label: "عملي / مختبر",
      badgeClass:
        "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    };
  }
  if (norm.includes("مشروع")) {
    return {
      type: "project",
      label: "مشروع تخرج",
      badgeClass:
        "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
    };
  }
  if (norm.includes("تدريب")) {
    return {
      type: "training",
      label: "تدريب ميداني",
      badgeClass:
        "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
    };
  }
  return {
    type: "theory",
    label: "نظري",
    badgeClass:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  };
}

/**
 * Normalizes PTUK campus building names:
 * - Fixes common university typo entries (الرئيسيي -> الرئيسي, الخدامات -> الخدمات)
 * - Removes excessive whitespace and diacritics
 * - Normalizes empty or '--' markers to 'غير محدد'
 */
export function normalizeBuildingName(
  building: string | null | undefined,
): string {
  if (!building || typeof building !== "string") return "غير محدد";
  let s = building.trim();
  if (s === "--" || s === "" || s === "-") return "غير محدد";

  s = s.replace(/المبنى الرئيسيي/g, "المبنى الرئيسي");
  s = s.replace(/الخدامات الطلابية/g, "الخدمات الطلابية");
  s = s.replace(/[\u064B-\u065F\u0670]/g, ""); // remove diacritics
  s = s.replace(/\s+/g, " ");
  s = s.replace(/مبنى\s+A_A_A/g, "مبنى A_A_A");
  s = s.replace(/مبنى\s+A_A\s+_C/g, "مبنى A_A_C");
  s = s.replace(/مبنى\s+A_A_B/g, "مبنى A_A_B");
  return s.trim() || "غير محدد";
}
