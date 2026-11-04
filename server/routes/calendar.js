import express from "express";
import { saveAcademicCalendar, getAcademicCalendar } from "../db.js";
import { scrapeAcademicCalendar } from "../services/scrapers/academicCalendarScraper.js";
import {
  OFFICIAL_TUITION_RATES,
  OFFICIAL_FIXED_FEES,
  getOfficialTuitionRate,
  calculateSemesterTuition,
} from "../services/tuitionFeesService.js";

const router = express.Router();

/**
 * Computes active semester, current week, and upcoming milestones based on today's date
 */
function enrichCalendarWithActiveMilestones(calendarData) {
  if (!calendarData || !Array.isArray(calendarData.semesters)) {
    return calendarData;
  }

  const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const today = new Date(todayStr);

  let activeSemester = null;
  let nextUpcomingEvent = null;
  let minDaysDiff = Infinity;

  for (const sem of calendarData.semesters) {
    const isOngoing =
      sem.startDate &&
      sem.endDate &&
      todayStr >= sem.startDate &&
      todayStr <= sem.endDate;

    sem.isCurrent = Boolean(isOngoing);

    if (isOngoing && !activeSemester) {
      activeSemester = sem;
    }

    // Scan events for upcoming milestones
    for (const event of sem.events || []) {
      if (!event.date || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) continue;

      const eventDate = new Date(event.date);
      const diffTime = eventDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays < minDaysDiff && event.activity) {
        minDaysDiff = diffDays;
        nextUpcomingEvent = {
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

  // Fallback: if today is between semesters, find nearest semester
  if (!activeSemester && calendarData.semesters.length > 0) {
    const upcoming = calendarData.semesters.find(
      (s) => s.startDate && s.startDate > todayStr,
    );
    activeSemester = upcoming || calendarData.semesters[0];
  }

  // Current week detection in active semester
  let currentWeekName = "";
  if (activeSemester && Array.isArray(activeSemester.events)) {
    for (const ev of activeSemester.events) {
      if (ev.date && ev.date <= todayStr && ev.week) {
        currentWeekName = ev.week;
      }
    }
  }

  return {
    ...calendarData,
    today: todayStr,
    activeSemesterId: activeSemester?.id || null,
    activeSemesterName: activeSemester?.termName || null,
    currentWeek: currentWeekName || "الأسبوع الجاري",
    nextUpcomingMilestone: nextUpcomingEvent,
  };
}

/**
 * GET /api/calendar
 * Returns academic calendar with real-time active semester milestones.
 */
router.get("/", async (req, res) => {
  try {
    let calendarData = getAcademicCalendar();

    if (!calendarData) {
      console.log(
        "🌐 التقويم الأكاديمي غير مخزن، جاري سحبه حياً من موقع الجامعة...",
      );
      calendarData = await scrapeAcademicCalendar();
      saveAcademicCalendar(calendarData);
    }

    const enriched = enrichCalendarWithActiveMilestones(calendarData);
    return res.json({
      success: true,
      ...enriched,
    });
  } catch (err) {
    console.error("❌ خطأ في جلب التقويم الأكاديمي:", err.message);
    return res.status(500).json({
      success: false,
      error: "تعذر استرجاع التقويم الأكاديمي.",
      message: err.message,
    });
  }
});

/**
 * POST /api/calendar/sync
 * Forces a fresh re-scrape of the academic calendar from PTUK official site.
 */
router.post("/sync", async (req, res) => {
  try {
    console.log("🔄 جاري تحديث التقويم الأكاديمي من موقع خضوري الرسمي...");
    const freshCalendar = await scrapeAcademicCalendar();
    saveAcademicCalendar(freshCalendar);
    const enriched = enrichCalendarWithActiveMilestones(freshCalendar);

    return res.json({
      success: true,
      message: "تم تحديث التقويم الأكاديمي بنجاح من خضوري.",
      ...enriched,
    });
  } catch (err) {
    console.error("❌ فشل تحديث التقويم الأكاديمي:", err.message);
    return res.status(500).json({
      success: false,
      error: "فشل تحديث التقويم الأكاديمي من موقع الجامعة.",
      message: err.message,
    });
  }
});

/**
 * GET /api/calendar/tuition-fees
 * Returns official university tuition rates and fee breakdown calculator.
 */
router.get("/tuition-fees", (req, res) => {
  try {
    const { major = "", credits = 18, freshman = "false" } = req.query;

    const isFreshman = freshman === "true" || freshman === "1";
    const creditHours = Math.max(1, Math.min(30, parseInt(credits, 10) || 18));

    const calculation = calculateSemesterTuition({
      majorName: major,
      credits: creditHours,
      isFreshman,
    });

    return res.json({
      success: true,
      officialFixedFees: OFFICIAL_FIXED_FEES,
      ratesByMajor: OFFICIAL_TUITION_RATES,
      calculation,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "تعذر حساب الرسوم الدراسية.",
      message: err.message,
    });
  }
});

export default router;
