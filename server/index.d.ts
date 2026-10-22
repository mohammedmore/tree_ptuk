import type { Express } from "express";

declare module "../server/app.js" {
  const app: Express;
  export function startServer(port?: number | string): any;
  export default app;
}

declare module "../server/db.js" {
  export function getCourses(filter?: {
    codes?: string[];
    search?: string;
    majorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]>;

  export function getCourseByCode(code: string): Promise<any>;

  export function upsertCatalogCourses(catalog: any[]): Promise<{
    insertedCourses: number;
    insertedSections: number;
    totalCourses: number;
  }>;

  export function getMajors(): Array<{
    id: string;
    code: string;
    name: string;
    college: string;
    degree: string;
    totalCredits: number;
    categoryRequirements: Record<string, number>;
    description?: string;
    coursesCount: number;
  }>;

  export function getMajorById(majorId: string): any;

  export function upsertMajor(major: any): any;

  export function getSyncStatus(): {
    lastSyncTime: string | null;
    lastSyncStatus: string;
    totalCourses: number;
    totalSections: number;
    totalBlocks: number;
    durationSeconds: number;
    lastErrorMessage: string | null;
    nextScheduledSync: string | null;
    syncIntervalCron: string;
  };

  export function updateSyncStatus(update: any): any;

  export function saveStudentRecord(studentId: string, data: any): any;

  export function getStudentRecord(studentId: string): any;

  export const supabase: any;
}

declare module "../server/services/studentPortalService.js" {
  export function authenticateAndSyncStudent(
    studentId: string,
    password?: string,
    options?: { demoMode?: boolean },
  ): Promise<{
    studentId: string;
    studentName: string;
    majorId: string;
    majorName: string;
    college?: string;
    earnedCredits: number;
    gpa: number;
    passedCourseIds: string[];
    enrolledCourses: any[];
    isDemo?: boolean;
    lastSyncedAt?: string;
    note?: string;
  }>;
}
