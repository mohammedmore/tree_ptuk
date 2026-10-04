export interface MeetingOption {
  days?: string[];
  day?: string;
  startTime: string;
  endTime: string;
  section?: string;
  instructor?: string;
  room?: string;
}

export interface ScheduleBlock {
  days: string[];
  start: number;
  end: number;
}

export interface CatalogSection {
  sec: string;
  instructor?: string;
  room?: string;
  status?: string;
  building?: string;
  blocks: ScheduleBlock[];
}

export interface CatalogCourse {
  id: string;
  name: string;
  type?: string;
  category?: string;
  color?: string;
  sections?: CatalogSection[];
}

export interface GeneratedScheduleCourse {
  courseCode: string;
  courseName: string;
  courseType: string;
  color: string;
  section: CatalogSection;
}

export interface SolverCourse {
  id: string;
  name?: string;
  options?: MeetingOption[];
  candidates?: MeetingOption[];
}

export interface SolverConstraints {
  maxWorkDays?: number;
  offDays?: string[];
  preferredStart?: string;
  preferredEnd?: string;
  maxResults?: number;
  nodeLimit?: number;
}

export interface CatalogScheduleFilters {
  /** Meeting-day keys that must remain free, for example "سب" or "أح". */
  freeDays?: string[];
  /** Section numbers to omit, keyed by course code. */
  excludedSections?: Record<string, string[]>;
  /** Required section number, keyed by course code. */
  pinnedSections?: Record<string, string>;
  /** Preferred ordering for generated schedules. */
  timePreference?: "morning" | "late" | "";
  /** Maximum allowed gap between consecutive classes, in hours. */
  maxGap?: number | null;
}

export interface ScheduleStats {
  byDay: Record<string, Array<{ start: number; end: number }>>;
  usedDays: string[];
  maxGap: number;
  totalGap: number;
  maxClasses: number;
  earliestStart: number;
  latestEnd: number;
}

export interface MeetingStats {
  courseCount: number;
  workDays: number;
  days: string[];
  totalHours: number;
  earliestStart: string | null;
  latestEnd: string | null;
}

export interface SolvedSchedule {
  entries: Array<MeetingOption & { courseId: string }>;
  stats: MeetingStats;
  score: number;
}

export function hasConflict(
  schedule: Array<{ section: CatalogSection }>,
  newSection: CatalogSection,
): boolean;
export function generateAllSchedules(
  courses?: CatalogCourse[],
  filters?: CatalogScheduleFilters,
): GeneratedScheduleCourse[][];
export function solveSchedule(
  courses: SolverCourse[],
  constraints?: SolverConstraints,
): {
  schedules: SolvedSchedule[];
  exploredNodes: number;
  truncated: boolean;
};
export function getStats(
  schedule?:
    GeneratedScheduleCourse[] | MeetingOption[] | Record<string, MeetingOption>,
): ScheduleStats | MeetingStats;
