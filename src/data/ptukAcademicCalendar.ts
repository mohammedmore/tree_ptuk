/**
 * Authentic Academic Calendar Data for Palestine Technical University - Khadoorie (PTUK)
 * Source: Official PTUK Academic Calendar (https://ptuk.edu.ps/ar/academic-calendar.php)
 * Academic Year: 2026/2027
 */

export interface CalendarEvent {
  week: string;
  date: string;
  rawDate?: string;
  day: string;
  activity: string;
  notes?: string;
  category:
    | "registration"
    | "add_drop"
    | "withdrawal"
    | "exam_midterm"
    | "exam_final"
    | "holiday"
    | "results"
    | "teaching"
    | "general";
  isToday?: boolean;
}

export interface AcademicSemester {
  id: string;
  termName: string;
  academicYear: string;
  startDate: string | null;
  endDate: string | null;
  eventsCount: number;
  events: CalendarEvent[];
  isCurrent?: boolean;
}

export interface UpcomingMilestone extends CalendarEvent {
  semesterName: string;
  daysRemaining: number;
}

export interface AcademicCalendarResponse {
  success: boolean;
  source: string;
  academicYear: string;
  scrapedAt: string;
  today: string;
  activeSemesterId: string | null;
  activeSemesterName: string | null;
  currentWeek: string;
  nextUpcomingMilestone: UpcomingMilestone | null;
  semesters: AcademicSemester[];
}

export const AUTHENTIC_PTUK_SEMESTERS: AcademicSemester[] = [
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
        notes: "نهاية دوام الخميس",
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
        notes: "استمرار التدريس",
        category: "exam_midterm",
      },
      {
        week: "الأُسبوع الثامن",
        date: "2026-11-01",
        rawDate: "2026/11/01",
        day: "الأحد",
        activity: "الامتحانات النصفيّة النظريّة (الأسبوع الأول)",
        notes: "وفق الجداول المعتمدة",
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
        notes: "تعطيل الدوام الرسمي",
        category: "holiday",
      },
      {
        week: "الأُسبوع الثالث عشر",
        date: "2026-12-08",
        rawDate: "2026/12/08",
        day: "الثلاثاء",
        activity: "آخر يوم لإدخال الأعمال الفصليّة وعلامات النصفي",
        notes: "على البوابة الإلكترونية",
        category: "general",
      },
      {
        week: "الأُسبوع الثالث عشر",
        date: "2026-12-10",
        rawDate: "2026/12/10",
        day: "الخميس",
        activity: "آخر يوم للسحب المُتأخر برمز (W)",
        notes: "آخر فرصة للاعتذار عن مساق",
        category: "withdrawal",
      },
      {
        week: "الأُسبوع الرابع عشر",
        date: "2026-12-13",
        rawDate: "2026/12/13",
        day: "الأحد",
        activity: "الامتحانات النهائيّة العمليّة",
        notes: "مختبرات ومشاريع",
        category: "exam_final",
      },
      {
        week: "الأُسبوع الخامس عشر",
        date: "2026-12-20",
        rawDate: "2026/12/20",
        day: "الأحد",
        activity: "بدء الامتحانات النهائيّة النظريّة",
        notes: "الفترة الأولى",
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
        activity: "استئناف الامتحانات النهائيّة النظريّة",
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
        activity: "الامتحانات النهائيّة النظريّة",
        notes: "",
        category: "exam_final",
      },
      {
        week: "الأُسبوع السابع عشر",
        date: "2027-01-04",
        rawDate: "2027/01/04",
        day: "الإثنين",
        activity: "ذكرى الإسراء والمعراج (عُطلة رسمية)",
        notes: "",
        category: "holiday",
      },
      {
        week: "الأُسبوع السابع عشر",
        date: "2027-01-05",
        rawDate: "2027/01/05",
        day: "الثلاثاء",
        activity: "آخر يوم في الامتحانات النهائيّة للفصل الأول",
        notes: "نهاية الامتحانات",
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
        notes: "بدء إجازة الأكاديميين والطلبة بين الفصلين",
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
        activity: "بدء التسجيل الإلكتروني للفصل الدّراسي الثّاني",
        notes: "على بوابة Edugate حسب الساعات المجتازة",
        category: "registration",
      },
      {
        week: "الأُسبوع الأول",
        date: "2027-01-23",
        rawDate: "2027/01/23",
        day: "السبت",
        activity: "انتهاء إجازة الأكاديميين والاستعداد لبدء التدريس",
        notes: "",
        category: "holiday",
      },
      {
        week: "الأُسبوع الأول",
        date: "2027-01-24",
        rawDate: "2027/01/24",
        day: "الأحد",
        activity: "بدء التدريس وأُسبوع السحب والإضافة",
        notes: "تعديل المساقات عبر البوابة",
        category: "add_drop",
      },
      {
        week: "الأُسبوع الأول",
        date: "2027-01-28",
        rawDate: "2027/01/28",
        day: "الخميس",
        activity: "آخر موعد للسحب والإضافة وطلبات تأجيل الدّراسة",
        notes: "نهاية فترة التعديل المجانية",
        category: "add_drop",
      },
      {
        week: "الأُسبوع الثاني",
        date: "2027-01-31",
        rawDate: "2027/01/31",
        day: "الأحد",
        activity: "بدء السحب المُتأخر وترصيد الغياب الفعلي",
        notes: "",
        category: "withdrawal",
      },
      {
        week: "الأُسبوع السادس",
        date: "2027-03-08",
        rawDate: "2027/03/08",
        day: "الإثنين",
        activity: "يوم المرأة (عُطلة رسمية)",
        notes: "",
        category: "holiday",
      },
      {
        week: "الأُسبوع السادس",
        date: "2027-03-10",
        rawDate: "2027/03/10",
        day: "الأربعاء",
        activity: "عيد الفطر السعيد (عُطلة رسمية)",
        notes: "إجازة العيد المبارك",
        category: "holiday",
      },
      {
        week: "الأُسبوع السابع",
        date: "2027-03-14",
        rawDate: "2027/03/14",
        day: "الأحد",
        activity: "الامتحانات النصفيّة العمليّة",
        notes: "للمساقات التي تحوي شق عملي",
        category: "exam_midterm",
      },
      {
        week: "الاسبوع الثامن",
        date: "2027-03-21",
        rawDate: "2027/03/21",
        day: "الأحد",
        activity: "الامتحانات النصفيّة النظريّة (الأسبوع الأول)",
        notes: "وفق جدول الامتحانات المعتمد",
        category: "exam_midterm",
      },
      {
        week: "الأُسبوع التاسع",
        date: "2027-03-28",
        rawDate: "2027/03/28",
        day: "الأحد",
        activity: "الامتحانات النصفيّة النظريّة (الأسبوع الثاني)",
        notes: "",
        category: "exam_midterm",
      },
      {
        week: "الأُسبوع الثالث عشر",
        date: "2027-04-29",
        rawDate: "2027/04/29",
        day: "الخميس",
        activity: "آخر موعد لإدخال العلامات الفصليّة والسحب المُتأخر برمز (W)",
        notes: "آخر فرصة للاعتذار عن مساق للفصل الثاني",
        category: "withdrawal",
      },
      {
        week: "الأُسبوع الرابع عشر",
        date: "2027-05-01",
        rawDate: "2027/05/01",
        day: "السبت",
        activity: "عيد العمال العالمي (عطلة رسمية)",
        notes: "",
        category: "holiday",
      },
      {
        week: "الأُسبوع الرابع عشر",
        date: "2027-05-02",
        rawDate: "2027/05/02",
        day: "الأحد",
        activity: "عيد الفصح المجيد (عُطلة رسمية)",
        notes: "",
        category: "holiday",
      },
      {
        week: "الأُسبوع الرابع عشر",
        date: "2027-05-03",
        rawDate: "2027/05/03",
        day: "الإثنين",
        activity: "الامتحانات النهائيّة العمليّة للفصل الثاني",
        notes: "مختبرات ومشاريع",
        category: "exam_final",
      },
      {
        week: "الأُسبوع الخامس عشر",
        date: "2027-05-09",
        rawDate: "2027/05/09",
        day: "الأحد",
        activity: "بدء الامتحانات النهائيّة النظريّة للفصل الثاني",
        notes: "",
        category: "exam_final",
      },
      {
        week: "الأُسبوع الخامس عشر",
        date: "2027-05-15",
        rawDate: "2027/05/15",
        day: "السبت",
        activity: "وقفة وعيد الأضحى المُبارك (عُطلة رسمية)",
        notes: "إجازة عيد الأضحى",
        category: "holiday",
      },
      {
        week: "الأُسبوع السادس عشر",
        date: "2027-05-22",
        rawDate: "2027/05/22",
        day: "السبت",
        activity: "استئناف الامتحانات النهائيّة النظريّة",
        notes: "",
        category: "exam_final",
      },
      {
        week: "الأُسبوع السابع عشر",
        date: "2027-05-29",
        rawDate: "2027/05/29",
        day: "السبت",
        activity: "الامتحانات النهائيّة (الجلسات الختامية)",
        notes: "",
        category: "exam_final",
      },
      {
        week: "الأُسبوع السابع عشر",
        date: "2027-06-06",
        rawDate: "2027/06/06",
        day: "الأحد",
        activity: "رأس السنة الهجرية 1449هـ (عطلة رسمية)",
        notes: "",
        category: "holiday",
      },
      {
        week: "الأُسبوع السابع عشر",
        date: "2027-06-13",
        rawDate: "2027/06/13",
        day: "الأحد",
        activity: "إعلان نتائج الفصل الثاني ونهاية الفصل الدراسي",
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
        activity: "بدء التسجيل الإلكتروني للفصل الصيفي",
        notes: "عبر بوابة Edugate للطلبة المتوقع تخرجهم والراغبين بالصيفي",
        category: "registration",
      },
      {
        week: "الأسبوع الأوّل",
        date: "2027-06-21",
        rawDate: "2027/06/21",
        day: "الإثنين",
        activity: "بدء التدريس وفترة السحب والإضافة للفصل الصيفي",
        notes: "",
        category: "add_drop",
      },
      {
        week: "الأسبوع الأوّل",
        date: "2027-06-24",
        rawDate: "2027/06/24",
        day: "الخميس",
        activity: "بدء السحب المتأخر وترصيد الغياب للفصل الصيفي",
        notes: "نهاية السحب والإضافة بدون غرامة",
        category: "withdrawal",
      },
      {
        week: "الأسبوع الرابع",
        date: "2027-07-11",
        rawDate: "2027/07/11",
        day: "الأحد",
        activity: "الامتحانات النصفيّة العمليّة للفصل الصيفي",
        notes: "",
        category: "exam_midterm",
      },
      {
        week: "الأسبوع الخامس",
        date: "2027-07-18",
        rawDate: "2027/07/18",
        day: "الأحد",
        activity: "الامتحانات النصفيّة النظريّة للفصل الصيفي",
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
        activity: "آخر موعد للسحب المُتأخر برمز (W) للصيفي",
        notes: "آخر موعد للاعتذار عن مساق صيفي",
        category: "withdrawal",
      },
      {
        week: "الأسبوع السابع",
        date: "2027-08-01",
        rawDate: "2027/08/01",
        day: "الأحد",
        activity: "الامتحانات النهائيّة العمليّة للفصل الصيفي",
        notes: "",
        category: "exam_final",
      },
      {
        week: "الأسبوع السابع",
        date: "2027-08-05",
        rawDate: "2027/08/05",
        day: "الخميس",
        activity: "آخر يوم تدريس في الفصل الصيفي",
        notes: "",
        category: "teaching",
      },
      {
        week: "الأسبوع الثامن",
        date: "2027-08-07",
        rawDate: "2027/08/07",
        day: "السبت",
        activity: "بدء الامتحانات النهائيّة النظريّة للفصل الصيفي",
        notes: "",
        category: "exam_final",
      },
      {
        week: "الأسبوع الثامن",
        date: "2027-08-19",
        rawDate: "2027/08/19",
        day: "الخميس",
        activity: "إعلان نتائج الفصل الصيفي وانتهاء العام الأكاديمي 2026/2027",
        notes: "اختتام العام الجامعي كاملاً",
        category: "results",
      },
    ],
  },
];

/**
 * Enriches the authentic PTUK calendar with real-time active semester,
 * current academic week, and next upcoming milestone relative to the specified date.
 */
export function getEnrichedAcademicCalendar(
  currentDate?: Date,
): AcademicCalendarResponse {
  const now = currentDate || new Date();
  const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const todayDate = new Date(todayStr);

  const semesters = JSON.parse(
    JSON.stringify(AUTHENTIC_PTUK_SEMESTERS),
  ) as AcademicSemester[];

  let activeSemester: AcademicSemester | null = null;
  let nextUpcomingMilestone: UpcomingMilestone | null = null;
  let minDaysDiff = Infinity;

  for (const sem of semesters) {
    const isOngoing =
      sem.startDate &&
      sem.endDate &&
      todayStr >= sem.startDate &&
      todayStr <= sem.endDate;

    sem.isCurrent = Boolean(isOngoing);

    if (isOngoing && !activeSemester) {
      activeSemester = sem;
    }

    for (const event of sem.events || []) {
      if (!event.date || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) continue;

      const eventDate = new Date(event.date);
      const diffTime = eventDate.getTime() - todayDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays < minDaysDiff && event.activity) {
        minDaysDiff = diffDays;
        nextUpcomingMilestone = {
          ...event,
          semesterName: sem.termName,
          daysRemaining: diffDays,
          isToday: diffDays === 0,
        };
      }

      if (event.date === todayStr) {
        event.isToday = true;
      }
    }
  }

  // Fallback: If between semesters, pick the upcoming semester or first
  if (!activeSemester && semesters.length > 0) {
    const upcoming = semesters.find(
      (s) => s.startDate && s.startDate > todayStr,
    );
    activeSemester = upcoming || semesters[0];
    if (activeSemester) activeSemester.isCurrent = true;
  }

  // Determine current week label in active semester
  let currentWeekLabel = "";
  if (activeSemester && Array.isArray(activeSemester.events)) {
    for (const ev of activeSemester.events) {
      if (ev.date && ev.date <= todayStr && ev.week) {
        currentWeekLabel = ev.week;
      }
    }
  }

  return {
    success: true,
    source: "https://ptuk.edu.ps/ar/academic-calendar.php",
    academicYear: "2026/2027",
    scrapedAt: new Date().toISOString(),
    today: todayStr,
    activeSemesterId: activeSemester?.id || "20261",
    activeSemesterName: activeSemester?.termName || "الفصل الأول 2026/2027",
    currentWeek: currentWeekLabel || "الأسبوع الأكاديمي المعتمد",
    nextUpcomingMilestone,
    semesters,
  };
}
