import type { ScheduleEntry, Course } from "../data";
import { normalizeDayKey } from "./scheduleSolver";

// Mapping from canonical day key to Day-of-Week index (0: Sunday, 1: Monday, ..., 6: Saturday)
const DAY_INDEX_MAP: Record<string, number> = {
  أح: 0, // Sunday
  اث: 1, // Monday
  ثلا: 2, // Tuesday
  ار: 3, // Wednesday
  خمـ: 4, // Thursday
  سب: 6, // Saturday
};

function getNextDateForDay(targetDayIndex: number): Date {
  const now = new Date();
  const currentDay = now.getDay();
  let diff = targetDayIndex - currentDay;
  if (diff < 0) {
    diff += 7;
  }
  const result = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + diff,
  );
  return result;
}

function formatICSDate(date: Date, timeStr: string): string {
  const clean = (timeStr || "08:00").replace(/[٠-٩]/g, (d) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(d)),
  );
  let [hours, minutes] = clean.split(":").map(Number);
  if (isNaN(hours)) hours = 8;
  if (isNaN(minutes)) minutes = 0;
  if (hours >= 1 && hours <= 6) {
    hours += 12; // Convert 12-hour PM times (1 PM - 6 PM) to 24-hour (13:00 - 18:00)
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${year}${month}${day}T${hh}${mm}00`;
}

function escapeICSText(str: string): string {
  return (str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function exportScheduleToICal(
  schedule: Record<string, ScheduleEntry>,
  semesterName: string,
  courses: Course[] | Map<string, { name: string }>,
): void {
  const coursesMap =
    courses instanceof Map
      ? courses
      : new Map(courses.map((c) => [c.id, { name: c.name }]));

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PTUK Academic Planner//AR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICSText(`جدول ${semesterName}`)}`,
    "X-WR-TIMEZONE:Asia/Hebron",
  ];

  const nowStamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  let eventCount = 0;

  for (const [courseId, entry] of Object.entries(schedule)) {
    if (!entry || !entry.startTime || !entry.endTime) continue;
    const course = coursesMap.get(courseId);
    const courseName = course ? course.name : courseId;
    const rawDays = entry.days || (entry.day ? [entry.day] : []);

    for (const rawDay of rawDays) {
      const dayKey = normalizeDayKey(rawDay) ?? rawDay;
      const dayIndex = DAY_INDEX_MAP[dayKey];
      if (dayIndex === undefined) continue;

      const startDate = getNextDateForDay(dayIndex);
      const dtStart = formatICSDate(startDate, entry.startTime);
      const dtEnd = formatICSDate(startDate, entry.endTime);
      const uid = `ptuk-sched-${courseId}-${dayKey}-${eventCount++}@planner.ptuk`;

      const summary =
        `${courseName} ${entry.section ? `(شعبة ${entry.section})` : ""}`.trim();
      const location =
        entry.room || entry.location || "جامعة فلسطين التقنية - خضوري";
      const description = `المساق: ${courseName} (${courseId})\\nالشعبة: ${entry.section || "—"}\\nالمدرس: ${entry.instructor || "غير محدد"}\\nالقاعة: ${location}`;

      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        "RRULE:FREQ=WEEKLY;COUNT=16",
        `SUMMARY:${escapeICSText(summary)}`,
        `LOCATION:${escapeICSText(location)}`,
        `DESCRIPTION:${description}`,
        "STATUS:CONFIRMED",
        "END:VEVENT",
      );
    }
  }

  lines.push("END:VCALENDAR");

  const icsContent = lines.join("\r\n");
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeSemesterName = semesterName.replace(/[\/\\?%*:|"<>]/g, "_").trim();
  link.download = `جدول_${safeSemesterName || "الدراسي"}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadScheduleImage(
  elementId: string,
  filename = "schedule.png",
): Promise<void> {
  const node = document.getElementById(elementId);
  if (!node) {
    throw new Error(`العنصر ${elementId} غير موجود في الصفحة`);
  }

  // Point 20: Code-splitting html-to-image via dynamic import
  const { toPng } = await import("html-to-image");

  const isDark =
    typeof document !== "undefined" &&
    (document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark");
  const bgColor = isDark ? "#111827" : "#ffffff";

  const dataUrl = await toPng(node, {
    cacheBust: true,
    quality: 0.98,
    backgroundColor: bgColor,
    pixelRatio: 2,
  });

  const safeFilename =
    filename.replace(/[\/\\?%*:|"<>]/g, "_").trim() || "schedule.png";
  const link = document.createElement("a");
  link.download = safeFilename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
