export interface ScrapedCalendarSemester {
  id: string;
  termName: string;
  academicYear: string;
  startDate: string | null;
  endDate: string | null;
  eventsCount: number;
  events: Array<{
    week: string;
    date: string;
    rawDate: string;
    day: string;
    activity: string;
    notes: string;
    category: string;
  }>;
}

export interface ScrapedCalendarResponse {
  success: boolean;
  source: string;
  academicYear: string;
  scrapedAt: string;
  semesters: ScrapedCalendarSemester[];
}

export function categorizeActivity(activity?: string, notes?: string): string;
export function scrapeAcademicCalendar(): Promise<ScrapedCalendarResponse>;
export const AUTHENTIC_FALLBACK_CALENDAR: ScrapedCalendarResponse;
