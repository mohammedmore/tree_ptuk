/**
 * Canonical Day Keys: "سب", "أح", "اث", "ثلا", "ار", "خمـ", "جم"
 */
export const KNOWN_DAYS = ["سب", "أح", "اث", "ثلا", "ار", "خمـ"];

export const DAY_NAMES_MAP = {
  سب: "السبت",
  أح: "الأحد",
  اث: "الاثنين",
  ثلا: "الثلاثاء",
  ار: "الأربعاء",
  خمـ: "الخميس",
  جم: "الجمعة",
};

export const REVERSE_DAY_MAP = {
  السبت: "سب",
  سبت: "سب",
  سب: "سب",
  س: "سب",
  sat: "سب",
  saturday: "سب",
  الأحد: "أح",
  الاحد: "أح",
  أحد: "أح",
  احد: "أح",
  أح: "أح",
  اح: "أح",
  ح: "أح",
  sun: "أح",
  sunday: "أح",
  الاثنين: "اث",
  الإثنين: "اث",
  اثنين: "اث",
  إثنين: "اث",
  اث: "اث",
  ن: "اث",
  mon: "اث",
  monday: "اث",
  الثلاثاء: "ثلا",
  ثلاثاء: "ثلا",
  ثلا: "ثلا",
  ثل: "ثلا",
  ث: "ثلا",
  tue: "ثلا",
  tuesday: "ثلا",
  الأربعاء: "ار",
  الاربعاء: "ار",
  أربعاء: "ار",
  اربعاء: "ار",
  ارب: "ار",
  ار: "ار",
  ر: "ار",
  wed: "ار",
  wednesday: "ار",
  الخميس: "خمـ",
  خميس: "خمـ",
  خمـ: "خمـ",
  خم: "خمـ",
  خ: "خمـ",
  thu: "خمـ",
  thursday: "خمـ",
  الجمعة: "جم",
  جمعة: "جم",
  جم: "جم",
  ج: "جم",
  fri: "جم",
  friday: "جم",
};

/**
 * Standardizes Arabic/English day strings into canonical day keys.
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeDayKey(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (KNOWN_DAYS.includes(str) || str === "جم") return str;

  const clean = str
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .trim();

  if (REVERSE_DAY_MAP[clean]) return REVERSE_DAY_MAP[clean];
  if (clean.includes("سبت") || clean === "س") return "سب";
  if (clean.includes("احد") || clean === "ح") return "أح";
  if (clean.includes("اثنين") || clean === "ن") return "اث";
  if (clean.includes("ثلاث") || clean === "ث") return "ثلا";
  if (clean.includes("اربع") || clean === "ر") return "ار";
  if (clean.includes("خميس") || clean === "خ") return "خمـ";
  if (clean.includes("جمع") || clean === "ج") return "جم";

  return null;
}

/**
 * Converts hour string or number to standard minutes from midnight.
 * @param {string|number} timeVal
 * @returns {number|null}
 */
export function parseTimeToMinutes(timeVal) {
  if (typeof timeVal === "number" && Number.isFinite(timeVal)) {
    return Math.round(timeVal * 60);
  }
  if (!timeVal) return null;
  const clean = String(timeVal).trim();
  const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(clean);
  if (match) {
    return Number(match[1]) * 60 + Number(match[2]);
  }
  const num = Number(clean);
  if (!isNaN(num) && num >= 0 && num <= 24) {
    return Math.round(num * 60);
  }
  return null;
}

/**
 * Formats minutes from midnight to HH:mm string.
 * @param {number} minutes
 * @returns {string}
 */
export function minutesToTimeString(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
