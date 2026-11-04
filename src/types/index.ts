/**
 * Centralized TypeScript type definitions for the PTUK Planner project.
 */

// Course and academic model types
export type { Course, ScheduleEntry } from "../data";

// Major and curriculum types
export type { MajorSummary, MajorDetail } from "../services/majorService";

// Student portal and synchronization types
export type {
  EnrolledCourseBlock,
  EnrolledCourse,
  StudentSyncProfile,
} from "../services/studentService";

export type { SyncStatus } from "../services/syncService";

// Shared schedule types
export type {
  SharedCourseSnapshot,
  SharedScheduleSnapshot,
} from "../core/sharedSchedules";

// Schedule solver engine types
export type {
  MeetingOption,
  ScheduleBlock,
  CatalogSection,
  CatalogCourse,
  GeneratedScheduleCourse,
  SolverCourse,
  SolverConstraints,
  CatalogScheduleFilters,
  ScheduleStats,
  MeetingStats,
  SolvedSchedule,
} from "../services/scheduleSolver";

// Theme and appearance types
export type { ThemeName, ThemeTokens, SavedTheme } from "../themeManager";

// Course explanation & progress analysis types
export type { CourseDetail } from "../core/courseExplanations";

export type { CourseAvailabilityOptions } from "../core/courseProgress";

export type { SemesterType } from "../core/courseOfferings";

export interface CoursePathResult {
  ancestorIds: Set<string>;
  descendantIds: Set<string>;
  allRelatedIds: Set<string>;
}
