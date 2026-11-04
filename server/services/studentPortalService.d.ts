export function normalizeDigitsAndText(str: string): string;
export function parseSemesterWeight(title: string): number;
export function inferMajorFromCourses(
  courses?: any[],
  studentId?: string,
): {
  id: string;
  name: string;
  college?: string;
  majorId?: string;
  majorName?: string;
  confidence?: number;
};
export function applyCurriculumPrerequisitesAndSemesters(
  courses: any[],
  majorId?: string,
  majorName?: string,
): any[];
export function parseExemptionExamRows(scrapedExams: any[]): any[];
export function closeSharedBrowser(): Promise<void>;
export function authenticateAndSyncStudent(
  studentId: string,
  password?: string,
  options?: any,
): Promise<any>;
export const AI_CURRICULUM_COURSES: any[];
export const AI_CATEGORY_REQUIREMENTS: Record<string, number>;
