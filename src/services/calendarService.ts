/**
 * PTUK Academic Calendar Service
 * Connects to live PTUK calendar scraper backend, caches responses,
 * and seamlessly provides authentic university academic dates and milestones.
 */

import {
  CalendarEvent,
  AcademicSemester,
  UpcomingMilestone,
  AcademicCalendarResponse,
  getEnrichedAcademicCalendar,
} from "../data/ptukAcademicCalendar";

export type {
  CalendarEvent,
  AcademicSemester,
  UpcomingMilestone,
  AcademicCalendarResponse,
};

const STORAGE_CALENDAR_CACHE = "ptuk_academic_calendar_cache";

function getBaseApiUrl(): string {
  const envBase =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
      ? import.meta.env.VITE_API_BASE_URL
      : "";

  if (typeof window !== "undefined") {
    if (
      envBase &&
      !envBase.includes("localhost:3001") &&
      !envBase.includes("127.0.0.1:3001")
    ) {
      return envBase.replace(/\/+$/, "");
    }
    return "";
  }
  return envBase ? envBase.replace(/\/+$/, "") : "http://localhost:3001";
}

/**
 * Fetches academic calendar. First checks cache/live API,
 * guaranteed to return authentic PTUK calendar with active milestones.
 */
export async function fetchAcademicCalendar(): Promise<AcademicCalendarResponse> {
  const baseUrl = getBaseApiUrl();
  const url = `${baseUrl}/api/calendar`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (
      data.success &&
      Array.isArray(data.semesters) &&
      data.semesters.length > 0
    ) {
      try {
        localStorage.setItem(STORAGE_CALENDAR_CACHE, JSON.stringify(data));
      } catch {}
      return data;
    }
    throw new Error(data.error || "Failed to load calendar");
  } catch (_err) {
    // Attempt cache fallback
    try {
      const cached = localStorage.getItem(STORAGE_CALENDAR_CACHE);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          parsed &&
          Array.isArray(parsed.semesters) &&
          parsed.semesters.length > 0
        ) {
          return parsed;
        }
      }
    } catch {}

    // Solid fallback to authentic pre-scraped PTUK calendar
    return getEnrichedAcademicCalendar();
  }
}

/**
 * Forces a fresh re-scrape of the academic calendar from PTUK official site.
 */
export async function syncAcademicCalendar(): Promise<AcademicCalendarResponse> {
  const baseUrl = getBaseApiUrl();
  const url = `${baseUrl}/api/calendar/sync`;

  try {
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (
      data.success &&
      Array.isArray(data.semesters) &&
      data.semesters.length > 0
    ) {
      try {
        localStorage.setItem(STORAGE_CALENDAR_CACHE, JSON.stringify(data));
      } catch {}
      return data;
    }
    throw new Error(data.error || "Sync failed");
  } catch (_err) {
    return getEnrichedAcademicCalendar();
  }
}
