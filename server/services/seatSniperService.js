import { getCourses } from "../db.js";
import { executeRegistrationBatch } from "./registrationEngine.js";
import { edugateCircuitBreaker } from "../utils/circuitBreaker.js";
import {
  sqliteSaveTrackedSeats,
  sqliteGetTrackedSeats,
  sqliteRemoveTrackedSeat,
} from "../sqliteDb.js";

/**
 * Normalizes section number to standard string (e.g., "1", "01" -> "1").
 */
function normalizeSec(sec) {
  if (!sec) return "1";
  const trimmed = String(sec).trim();
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? trimmed : String(parsed);
}

/**
 * Checks authentic seat availability for specified target sections.
 *
 * @param {Array<{ courseCode: string, sec: string, courseName?: string }>} targetSeats
 * @returns {Promise<Array<{ courseCode: string, sec: string, courseName: string, capacity: number, registered: number, available: number, isFull: boolean, instructor: string, time: string }>>}
 */
export async function checkTargetSeatsAvailability(targetSeats = []) {
  if (!Array.isArray(targetSeats) || targetSeats.length === 0) {
    return [];
  }

  const courseCodes = Array.from(
    new Set(targetSeats.map((s) => s.courseCode.trim())),
  );
  const courses = await getCourses({ codes: courseCodes });

  const courseMap = new Map();
  courses.forEach((c) => {
    courseMap.set(c.code, c);
  });

  return targetSeats.map((target) => {
    const course = courseMap.get(target.courseCode.trim());
    const targetSecNormalized = normalizeSec(target.sec);

    if (!course) {
      return {
        courseCode: target.courseCode,
        sec: target.sec,
        courseName: target.courseName || target.courseCode,
        capacity: 0,
        registered: 0,
        available: 0,
        isFull: true,
        instructor: "غير متاح",
        time: "",
        statusText: "المساق غير مدرج في جدول الفصل الحالي",
      };
    }

    const section = (course.sections || []).find(
      (s) => normalizeSec(s.sec) === targetSecNormalized,
    );

    if (!section) {
      return {
        courseCode: target.courseCode,
        sec: target.sec,
        courseName: course.name,
        capacity: 0,
        registered: 0,
        available: 0,
        isFull: true,
        instructor: "غير متاح",
        time: "",
        statusText: `الشعبة ${target.sec} غير معروضة في جدول المساق`,
      };
    }

    const capacity = section.capacity || 40;
    const registered = section.registered || 0;
    const available = Math.max(0, capacity - registered);
    const statusLower = (section.status || "").toLowerCase();
    const isExplicitlyClosed =
      statusLower.includes("مغلق") ||
      statusLower.includes("ممتلئ") ||
      statusLower.includes("closed") ||
      statusLower.includes("full");

    const isFull = isExplicitlyClosed || available === 0;

    return {
      courseCode: target.courseCode,
      sec: section.sec,
      courseName: course.name,
      capacity,
      registered,
      available,
      isFull,
      instructor: section.instructor || "غير محدد",
      time: section.rawTime || "",
      statusText: isFull ? "مغلقة / مكتملة" : `متاح (${available} مقعد شاغر)`,
    };
  });
}

/**
 * Checks seats and, if an opened section is detected and autoExecute is enabled,
 * immediately executes registration using cascading fallback.
 */
export async function snipeAndRegister({
  studentId,
  password,
  targetSeats = [],
  autoExecute = false,
  plan,
  semester = "20241",
  demoMode = false,
}) {
  const checkTimestamp = new Date().toISOString();
  const seatsStatus = await checkTargetSeatsAvailability(targetSeats);

  const openedSeats = seatsStatus.filter((s) => !s.isFull && s.available > 0);
  let registrationResult = null;

  if (autoExecute && openedSeats.length > 0) {
    const circuit = edugateCircuitBreaker.canExecute();
    if (!circuit.allowed) {
      return {
        checkedAt: checkTimestamp,
        totalChecked: seatsStatus.length,
        openedCount: openedSeats.length,
        openedSeats,
        allSeats: seatsStatus,
        registrationAttempted: false,
        registrationResult: {
          success: false,
          message: circuit.reason,
        },
      };
    }

    // Build plan with the opened section prioritized
    const firstOpened = openedSeats[0];
    const targetPlan = plan || {
      A: {
        name: "خطة القناص الفورية",
        items: [
          {
            courseId: firstOpened.courseCode,
            courseName: firstOpened.courseName,
            section: firstOpened.sec,
            priority: 1,
          },
        ],
      },
    };

    registrationResult = await executeRegistrationBatch({
      studentId,
      password,
      plans: targetPlan,
      primaryPlanKey: "A",
      semester,
      demoMode,
      autoFallbackOnFull: true,
      concurrencyDelayMs: 250,
    });
  }

  return {
    checkedAt: checkTimestamp,
    totalChecked: seatsStatus.length,
    openedCount: openedSeats.length,
    openedSeats,
    allSeats: seatsStatus,
    registrationAttempted: Boolean(autoExecute && openedSeats.length > 0),
    registrationResult,
  };
}

export {
  sqliteSaveTrackedSeats,
  sqliteGetTrackedSeats,
  sqliteRemoveTrackedSeat,
};
