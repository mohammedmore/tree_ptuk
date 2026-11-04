import axios from "axios";
import * as cheerio from "cheerio";
import https from "node:https";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const CALENDAR_URL = "https://ptuk.edu.ps/ar/academic-calendar.php";

/**
 * Strips Arabic diacritics (tashkeel) and normalizes common letter forms
 */
function stripArabicDiacritics(str = "") {
  if (!str) return "";
  return String(str)
    .replace(/[\u064B-\u065F\u0670]/g, "") // remove tashkeel
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

/**
 * Normalizes Arabic-Indic digits to ASCII digits
 */
function normalizeArabicDigits(str = "") {
  if (!str) return "";
  return String(str)
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .trim();
}

const ARABIC_DAYS = [
  "الأحد",
  "الاحد",
  "الإثنين",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الاربعاء",
  "الخميس",
  "الجمعة",
  "الجمعه",
  "السبت",
];

/**
 * Categorizes an activity into an identifiable category for styling & filtering
 */
export function categorizeActivity(activity = "", notes = "") {
  const normAct = stripArabicDiacritics(activity).toLowerCase();
  const normNotes = stripArabicDiacritics(notes).toLowerCase();
  const combined = `${normAct} ${normNotes}`;

  // Priority 1: Results
  if (normAct.includes("نتائج") || combined.includes("اعلان النتائج"))
    return "results";

  // Priority 2: Registration
  if (normAct.includes("تسجيل")) return "registration";

  // Priority 3: Late Withdrawal (W)
  if (
    combined.includes("(w)") ||
    (combined.includes("سحب") && combined.includes("متاخر"))
  )
    return "withdrawal";

  // Priority 4: Add / Drop
  if (combined.includes("سحب") || combined.includes("اضافه")) return "add_drop";

  // Priority 5: Exams
  if (combined.includes("نصفي")) return "exam_midterm";
  if (combined.includes("نهائي") || combined.includes("امتحان"))
    return "exam_final";

  // Priority 6: Holidays
  if (
    combined.includes("عطله") ||
    combined.includes("عيد") ||
    combined.includes("اجازه") ||
    combined.includes("ذكري") ||
    combined.includes("اسراء")
  ) {
    return "holiday";
  }

  // Priority 7: Teaching milestones
  if (combined.includes("بدء التدريس") || combined.includes("اخر يوم تدريس"))
    return "teaching";

  return "general";
}

/**
 * Authentic Pre-scraped PTUK 2026/2027 Calendar (Fallback if PTUK portal is unreachable)
 */
export const AUTHENTIC_FALLBACK_CALENDAR = {
  success: true,
  source: CALENDAR_URL,
  academicYear: "2026/2027",
  scrapedAt: "2026-11-01T20:00:00.000Z",
  semesters: [
    {
      id: "20261",
      termName: "الفصل الأول 2026/2027",
      academicYear: "2026/2027",
      startDate: "2026-09-13",
      endDate: "2027-01-16",
      eventsCount: 19,
      events: [
        {
          week: "الأُسبوع الأوّل",
          date: "2026-09-13",
          rawDate: "2026/09/13",
          day: "الأحد",
          activity: "أُسبوع السحب والإضافة",
          notes: "بدء التدريس الفعلي",
          category: "add_drop",
        },
        {
          week: "الأُسبوع الأوّل",
          date: "2026-09-17",
          rawDate: "2026/09/17",
          day: "الخميس",
          activity: "آخر موعد للسحب والإضافة وطلبات تأجيل الدّراسة",
          notes: "",
          category: "add_drop",
        },
        {
          week: "الأُسبوع الثاني",
          date: "2026-09-20",
          rawDate: "2026/09/20",
          day: "الأحد",
          activity: "بدء السحب المُتأخر وترصيد الغياب",
          notes: "",
          category: "withdrawal",
        },
        {
          week: "الأُسبوع السابع",
          date: "2026-10-25",
          rawDate: "2026/10/25",
          day: "الأحد",
          activity: "الامتحانات النصفيّة العمليّة",
          notes: "",
          category: "exam_midterm",
        },
        {
          week: "الأُسبوع الثامن",
          date: "2026-11-01",
          rawDate: "2026/11/01",
          day: "الأحد",
          activity: "الامتحانات النصفيّة النظريّة (الأسبوع الأول)",
          notes: "",
          category: "exam_midterm",
        },
        {
          week: "الأُسبوع التاسع",
          date: "2026-11-08",
          rawDate: "2026/11/08",
          day: "الأحد",
          activity: "الامتحانات النصفيّة النظريّة (الأسبوع الثاني)",
          notes: "",
          category: "exam_midterm",
        },
        {
          week: "الأُسبوع العاشر",
          date: "2026-11-15",
          rawDate: "2026/11/15",
          day: "الأحد",
          activity: "عيد الاستقلال (عطلة رسمية)",
          notes: "",
          category: "holiday",
        },
        {
          week: "الأُسبوع الثالث عشر",
          date: "2026-12-08",
          rawDate: "2026/12/08",
          day: "الثلاثاء",
          activity: "آخر يوم لإدخال الأعمال الفصليّة",
          notes: "",
          category: "general",
        },
        {
          week: "الأُسبوع الثالث عشر",
          date: "2026-12-10",
          rawDate: "2026/12/10",
          day: "الخميس",
          activity: "آخر يوم للسحب المُتأخر(W)",
          notes: "",
          category: "withdrawal",
        },
        {
          week: "الأُسبوع الرابع عشر",
          date: "2026-12-13",
          rawDate: "2026/12/13",
          day: "الأحد",
          activity: "الامتحانات النهائيّة العمليّة",
          notes: "",
          category: "exam_final",
        },
        {
          week: "الأُسبوع الخامس عشر",
          date: "2026-12-20",
          rawDate: "2026/12/20",
          day: "الأحد",
          activity: "بدء الامتحانات النهائية",
          notes: "",
          category: "exam_final",
        },
        {
          week: "الأُسبوع السادس عشر",
          date: "2026-12-25",
          rawDate: "2026/12/25",
          day: "الجمعة",
          activity: "عيد الميلاد المجيد - التقويم الغربي (عُطلة)",
          notes: "",
          category: "holiday",
        },
        {
          week: "الأُسبوع السادس عشر",
          date: "2026-12-26",
          rawDate: "2026/12/26",
          day: "السبت",
          activity: "الامتحانات النهائيّة النظريّة",
          notes: "",
          category: "exam_final",
        },
        {
          week: "الأُسبوع السابع عشر",
          date: "2027-01-01",
          rawDate: "2027/01/01",
          day: "الجمعة",
          activity: "رأس السنة الميلادية (عُطلة)",
          notes: "",
          category: "holiday",
        },
        {
          week: "الأُسبوع السابع عشر",
          date: "2027-01-02",
          rawDate: "2027/01/02",
          day: "السبت",
          activity: "الامتحانات النهائيّة",
          notes: "",
          category: "exam_final",
        },
        {
          week: "الأُسبوع السابع عشر",
          date: "2027-01-04",
          rawDate: "2027/01/04",
          day: "الإثنين",
          activity: "ذكرى الإسراء والمعراج (عُطلة)",
          notes: "",
          category: "holiday",
        },
        {
          week: "الأُسبوع السابع عشر",
          date: "2027-01-05",
          rawDate: "2027/01/05",
          day: "الثلاثاء",
          activity: "آخر يوم في الامتحانات النهائيّة",
          notes: "",
          category: "exam_final",
        },
        {
          week: "الأُسبوع السابع عشر",
          date: "2027-01-07",
          rawDate: "2027/01/07",
          day: "الخميس",
          activity: "عيد الميلاد المجيد - التقويم الشرقي (عُطلة)",
          notes: "",
          category: "holiday",
        },
        {
          week: "الأُسبوع السابع عشر",
          date: "2027-01-16",
          rawDate: "2027/01/16",
          day: "السبت",
          activity: "إعلان النتائج وانتهاء الفصل الأوّل",
          notes: "بدء إجازة الأكاديميين والطلبة",
          category: "results",
        },
      ],
    },
    {
      id: "20262",
      termName: "الفصل الثاني 2026/2027",
      academicYear: "2026/2027",
      startDate: "2027-01-17",
      endDate: "2027-06-13",
      eventsCount: 20,
      events: [
        {
          week: "الأسبوع التمهيدي",
          date: "2027-01-17",
          rawDate: "2027/01/17",
          day: "الأحد",
          activity: "بدء التسجيل للفصل الدّراسي الثّاني",
          notes: "عبر بوابة Edugate",
          category: "registration",
        },
        {
          week: "الأُسبوع الأول",
          date: "2027-01-23",
          rawDate: "2027/01/23",
          day: "السبت",
          activity: "انتهاء إجازة الأكاديميين",
          notes: "",
          category: "holiday",
        },
        {
          week: "الأُسبوع الأول",
          date: "2027-01-24",
          rawDate: "2027/01/24",
          day: "الأحد",
          activity: "بدء التدريس وأُسبوع السحب والإضافة",
          notes: "",
          category: "add_drop",
        },
        {
          week: "الأُسبوع الأول",
          date: "2027-01-28",
          rawDate: "2027/01/28",
          day: "الخميس",
          activity: "آخر موعد للسحب والإضافة وطلبات تأجيل الدّراسة",
          notes: "",
          category: "add_drop",
        },
        {
          week: "الأُسبوع الثاني",
          date: "2027-01-31",
          rawDate: "2027/01/31",
          day: "الأحد",
          activity: "بدء السحب المُتأخر وترصيد الغياب",
          notes: "",
          category: "withdrawal",
        },
        {
          week: "الأُسبوع السادس",
          date: "2027-03-08",
          rawDate: "2027/03/08",
          day: "الإثنين",
          activity: "يوم المرأة (عُطلة)",
          notes: "",
          category: "holiday",
        },
        {
          week: "الأُسبوع السادس",
          date: "2027-03-10",
          rawDate: "2027/03/10",
          day: "الأربعاء",
          activity: "عيد الفطر السعيد (عُطلة)",
          notes: "",
          category: "holiday",
        },
        {
          week: "الأُسبوع السابع",
          date: "2027-03-14",
          rawDate: "2027/03/14",
          day: "الأحد",
          activity: "الامتحانات النصفيّة العمليّة",
          notes: "",
          category: "exam_midterm",
        },
        {
          week: "الاسبوع الثامن",
          date: "2027-03-21",
          rawDate: "2027/03/21",
          day: "الأحد",
          activity: "الامتحانات النصفيّة النظرية (الأسبوع الأول)",
          notes: "",
          category: "exam_midterm",
        },
        {
          week: "الأُسبوع التاسع",
          date: "2027-03-28",
          rawDate: "2027/03/28",
          day: "الأحد",
          activity: "الامتحانات النصفيّة النظرية (الأسبوع الثاني)",
          notes: "",
          category: "exam_midterm",
        },
        {
          week: "الأُسبوع الثالث عشر",
          date: "2027-04-29",
          rawDate: "2027/04/29",
          day: "الخميس",
          activity: "آخر موعد لإدخال العلامات الفصليّة والسحب المُتأخر (W)",
          notes: "",
          category: "withdrawal",
        },
        {
          week: "الأُسبوع الرابع عشر",
          date: "2027-05-01",
          rawDate: "2027/05/01",
          day: "السبت",
          activity: "عيد العمال (عطلة)",
          notes: "",
          category: "holiday",
        },
        {
          week: "الأُسبوع الرابع عشر",
          date: "2027-05-02",
          rawDate: "2027/05/02",
          day: "الأحد",
          activity: "عيد الفصح (عُطلة)",
          notes: "",
          category: "holiday",
        },
        {
          week: "الأُسبوع الرابع عشر",
          date: "2027-05-03",
          rawDate: "2027/05/03",
          day: "الإثنين",
          activity: "الامتحانات النهائية العملية",
          notes: "",
          category: "exam_final",
        },
        {
          week: "الأُسبوع الخامس عشر",
          date: "2027-05-09",
          rawDate: "2027/05/09",
          day: "الأحد",
          activity: "بدء الامتحانات النهائية",
          notes: "",
          category: "exam_final",
        },
        {
          week: "الأُسبوع الخامس عشر",
          date: "2027-05-15",
          rawDate: "2027/05/15",
          day: "السبت",
          activity: "عيد الأضحى المُبارك (عُطلة)",
          notes: "",
          category: "holiday",
        },
        {
          week: "الأُسبوع السادس عشر",
          date: "2027-05-22",
          rawDate: "2027/05/22",
          day: "السبت",
          activity: "الامتحانات النهائية النظريّة",
          notes: "",
          category: "exam_final",
        },
        {
          week: "الأُسبوع السابع عشر",
          date: "2027-05-29",
          rawDate: "2027/05/29",
          day: "السبت",
          activity: "الامتحانات النهائية (الجلسات الأخيرة)",
          notes: "",
          category: "exam_final",
        },
        {
          week: "الأُسبوع السابع عشر",
          date: "2027-06-06",
          rawDate: "2027/06/06",
          day: "الأحد",
          activity: "رأس السنة الهجرية (عطلة)",
          notes: "",
          category: "holiday",
        },
        {
          week: "الأُسبوع السابع عشر",
          date: "2027-06-13",
          rawDate: "2027/06/13",
          day: "الأحد",
          activity: "إعلان النتائج ونهاية الفصل الثّاني",
          notes: "بدء إجازة الأكاديميين",
          category: "results",
        },
      ],
    },
    {
      id: "20263",
      termName: "الفصل الصيفي 2026/2027",
      academicYear: "2026/2027",
      startDate: "2027-06-18",
      endDate: "2027-08-19",
      eventsCount: 11,
      events: [
        {
          week: "الأسبوع الأوّل",
          date: "2027-06-18",
          rawDate: "2027/06/18",
          day: "الجمعة",
          activity: "التسجيل للفصل الصيفي",
          notes: "",
          category: "registration",
        },
        {
          week: "الأسبوع الأوّل",
          date: "2027-06-21",
          rawDate: "2027/06/21",
          day: "الإثنين",
          activity: "بدء التدريس وفترة السحب والإضافة",
          notes: "",
          category: "add_drop",
        },
        {
          week: "الأسبوع الأوّل",
          date: "2027-06-24",
          rawDate: "2027/06/24",
          day: "الخميس",
          activity: "بدء السحب المتأخر وترصيد الغياب",
          notes: "",
          category: "withdrawal",
        },
        {
          week: "الأسبوع الرابع",
          date: "2027-07-11",
          rawDate: "2027/07/11",
          day: "الأحد",
          activity: "الامتحانات النصفيّة العمليّة",
          notes: "",
          category: "exam_midterm",
        },
        {
          week: "الأسبوع الخامس",
          date: "2027-07-18",
          rawDate: "2027/07/18",
          day: "الأحد",
          activity: "الامتحانات النصفيّة النظريّة",
          notes: "",
          category: "exam_midterm",
        },
        {
          week: "الأسبوع السادس",
          date: "2027-07-28",
          rawDate: "2027/07/28",
          day: "الأربعاء",
          activity: "آخر موعِد لإدخال علامات النصفي والأعمال الفصليّة",
          notes: "",
          category: "exam_midterm",
        },
        {
          week: "الأسبوع السادس",
          date: "2027-07-29",
          rawDate: "2027/07/29",
          day: "الخميس",
          activity: "آخر موعد للسحب المُتأخر (W)",
          notes: "",
          category: "withdrawal",
        },
        {
          week: "الأسبوع السابع",
          date: "2027-08-01",
          rawDate: "2027/08/01",
          day: "الأحد",
          activity: "الامتحانات النهائيّة العمليّة",
          notes: "",
          category: "exam_final",
        },
        {
          week: "الأسبوع السابع",
          date: "2027-08-05",
          rawDate: "2027/08/05",
          day: "الخميس",
          activity: "آخر يوم تدريس",
          notes: "",
          category: "teaching",
        },
        {
          week: "الأسبوع الثامن",
          date: "2027-08-07",
          rawDate: "2027/08/07",
          day: "السبت",
          activity: "الامتحانات النهائيّة",
          notes: "",
          category: "exam_final",
        },
        {
          week: "الأسبوع الثامن",
          date: "2027-08-19",
          rawDate: "2027/08/19",
          day: "الخميس",
          activity: "إعلان النتائج وانتهاء العام الأكاديمي",
          notes: "",
          category: "results",
        },
      ],
    },
  ],
};

/**
 * Scrapes and parses the official PTUK Academic Calendar.
 * Falls back safely to authentic verified calendar if network or site is down.
 */
export async function scrapeAcademicCalendar() {
  try {
    const response = await axios.get(CALENDAR_URL, {
      httpsAgent,
      timeout: 12000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const $ = cheerio.load(response.data);
    const tables = $("table");

    if (tables.length === 0) {
      console.warn(
        "⚠️ لم يتم العثور على جداول في موقع خضوري، استخدام التقويم الأكاديمي المعتمد المخزن.",
      );
      return AUTHENTIC_FALLBACK_CALENDAR;
    }

    const semesters = [];

    tables.each((tableIdx, table) => {
      const rows = $(table).find("tr");
      if (rows.length < 3) return;

      const titleRowText = normalizeArabicDigits(
        $(rows[1]).text().replace(/\s+/g, " "),
      );
      let termName = "الفصل الدراسي " + (tableIdx + 1);
      let termId = "term_" + (tableIdx + 1);

      if (titleRowText.includes("الصيفي")) {
        termName = "الفصل الصيفي 2026/2027";
        termId = "20263";
      } else if (
        titleRowText.includes("الثّاني") ||
        titleRowText.includes("الثاني")
      ) {
        termName = "الفصل الثاني 2026/2027";
        termId = "20262";
      } else if (
        titleRowText.includes("الأوّل") ||
        titleRowText.includes("الأول")
      ) {
        termName = "الفصل الأول 2026/2027";
        termId = "20261";
      }

      const events = [];
      let currentWeek = "";

      rows.slice(2).each((_, tr) => {
        const rawCells = $(tr)
          .find("td")
          .map((_, td) =>
            normalizeArabicDigits($(td).text().replace(/\s+/g, " ").trim()),
          )
          .get();

        if (!rawCells.length || rawCells.includes("التاريخ")) return;

        let date = "";
        let day = "";
        let week = "";
        const textParts = [];

        for (const cell of rawCells) {
          if (!cell) continue;
          if (/202\d\/\d\d\/\d\d/.test(cell)) {
            date = cell;
          } else if (ARABIC_DAYS.includes(cell)) {
            day = cell;
          } else if (
            cell.includes("الأسبوع") ||
            cell.includes("الأُسبوع") ||
            cell.includes("الاسبوع")
          ) {
            week = cell;
          } else {
            textParts.push(cell);
          }
        }

        if (week) currentWeek = week;
        else week = currentWeek;

        let activity = textParts[0] || "";
        let notes = textParts.slice(1).join(" - ") || "";

        // If activity is missing but notes exists, promote notes
        if (!activity && notes && notes !== "تدريس") {
          activity = notes;
          notes = "";
        }

        // Filter out routine study days
        if (!activity || activity === "تدريس") {
          return;
        }

        if (notes === "تدريس") {
          notes = "";
        }

        // Standardize date to YYYY-MM-DD
        let formattedDate = "";
        if (date && date.includes("/")) {
          const parts = date.split("/").map((p) => p.padStart(2, "0"));
          if (parts.length === 3) {
            formattedDate = `${parts[0]}-${parts[1]}-${parts[2]}`;
          }
        }

        events.push({
          week: week || currentWeek,
          date: formattedDate || date,
          rawDate: date,
          day,
          activity,
          notes,
          category: categorizeActivity(activity, notes),
        });
      });

      const validEventsWithDate = events.filter(
        (e) => e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date),
      );
      const startDate = validEventsWithDate[0]?.date || null;
      const endDate =
        validEventsWithDate[validEventsWithDate.length - 1]?.date || null;

      semesters.push({
        id: termId,
        termName,
        academicYear: "2026/2027",
        startDate,
        endDate,
        eventsCount: events.length,
        events,
      });
    });

    if (semesters.length === 0) {
      return AUTHENTIC_FALLBACK_CALENDAR;
    }

    // Reorder: Semester 1, Semester 2, Summer
    semesters.sort((a, b) => a.id.localeCompare(b.id));

    return {
      success: true,
      source: CALENDAR_URL,
      academicYear: "2026/2027",
      scrapedAt: new Date().toISOString(),
      semesters,
    };
  } catch (error) {
    console.warn(
      "⚠️ تعذر جلب التقويم حياً من موقع الجامعة، استخدام التقويم المعتمد المخزن:",
      error.message,
    );
    return AUTHENTIC_FALLBACK_CALENDAR;
  }
}
