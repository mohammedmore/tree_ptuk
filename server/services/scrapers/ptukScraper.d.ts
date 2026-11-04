export interface ScheduleBlock {
  days: string[];
  start: number;
  end: number;
  rawTime: string;
}

export interface CourseSection {
  sec: string;
  room: string;
  status: string;
  instructor: string;
  building: string;
  gender?: string;
  blocks: ScheduleBlock[];
}

export interface ScrapedCourse {
  code: string;
  name: string;
  type: string;
  sections: CourseSection[];
}

export function parseDays(value: string): string[];

export function scrapePTUKSchedules(
  cookieHeader: string,
  initialViewState: string,
  options?: {
    branch?: string;
    maxPages?: number;
    delayMs?: number;
  },
): Promise<ScrapedCourse[]>;

export default scrapePTUKSchedules;
