import type { Express } from "express";

declare module "../server/app.js" {
  const app: Express;
  export function startServer(port?: number | string): any;
  export function validateProductionSecurityEnvironment(): boolean;
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
    cohortYear?: string;
    displayName?: string;
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
  export function persistState(): void;
  export function persistStateSync(): void;

  export function saveAcademicCalendar(calendarData: any): boolean;
  export function getAcademicCalendar(): any;

  export function acquireSyncLock(): boolean;
  export function releaseSyncLock(): void;
  export function isSyncActive(): boolean;
  export function batchUpsertToSupabase(
    catalog: any[],
    batchSize?: number,
  ): Promise<{
    success: boolean;
    coursesCount?: number;
    sectionsCount?: number;
    blocksCount?: number;
    message?: string;
  }>;

  export const supabase: any;
}

declare module "../server/services/studentPortalService.js" {
  export function normalizeDigitsAndText(str: string): string;
  export function parseSemesterWeight(title: string): number;
  export function parseExemptionExamRows(scrapedExams: any[]): {
    exemptionExams: any[];
    passedCourseCodes: Set<string>;
  };
  export function authenticateAndSyncStudent(
    studentId: string,
    password?: string,
    options?: { demoMode?: boolean },
  ): Promise<{
    studentId: string;
    studentName?: string;
    cohortYear?: string;
    majorId: string;
    majorName: string;
    college?: string;
    academicStatus?: string;
    academicAdvisor?: string;
    academicWarning?: string;
    currentSemester?: string;
    financialBalance?: string;
    earnedCredits: number;
    totalCredits?: number;
    gpa: number;
    passedCourseIds: string[];
    registeredCourseIds?: string[];
    failedCourseIds?: string[];
    remainingCourseIds?: string[];
    planCourses?: any[];
    courseGrades?: Record<string, number>;
    exemptionExams?: any[];
    enrolledCourses: any[];
    semesters?: any[];
    categoryRequirements?: Record<string, number>;
    isDemo?: boolean;
    isLiveEdugate?: boolean;
    lastSyncedAt?: string;
    note?: string;
  }>;
}

declare module "../server/services/scrapers/ptukScraper.js" {
  export function parseDays(value: string): string[];
  export function scrapePTUKSchedules(
    cookieHeader: string,
    initialViewState: string,
    options?: {
      branch?: string;
      maxPages?: number;
      delayMs?: number;
    },
  ): Promise<any[]>;
  export default scrapePTUKSchedules;
}

declare module "*/ptukScraper.js" {
  export function parseDays(value: string): string[];
  export function scrapePTUKSchedules(
    cookieHeader: string,
    initialViewState: string,
    options?: {
      branch?: string;
      maxPages?: number;
      delayMs?: number;
    },
  ): Promise<any[]>;
  export default scrapePTUKSchedules;
}

declare module "../server/services/registrationEngine.js" {
  export function prewarmSession(options: {
    studentId: string;
    password?: string;
    demoMode?: boolean;
  }): Promise<{
    success: boolean;
    sessionReady: boolean;
    pingMs: number;
    serverStatus: string;
    message: string;
    timestamp?: string;
  }>;

  export function executeRegistrationBatch(params: {
    studentId: string;
    password?: string;
    plans: any;
    options?: any;
  }): Promise<any>;
}

declare module "../server/services/securityVault.js" {
  export function encryptPayload(data: any): string;
  export function decryptPayload(encryptedString: string): string | null;
  export function signSessionToken(
    payload: any,
    expiresInSeconds?: number,
  ): string;
  export function verifySessionToken(token: string): any;
  export function timingSafeEqualStrings(a: string, b: string): boolean;
  export function revokeSessionToken(token: string): boolean;
  export function isSessionTokenRevoked(token: string): boolean;
  export function isAccountLocked(studentId: string): {
    locked: boolean;
    remainingSeconds: number;
  };
  export function recordFailedLogin(studentId: string): any;
  export function recordSuccessfulLogin(studentId: string): void;
}

declare module "../server/middleware/security.js" {
  import type { RequestHandler } from "express";
  export const sanitizeQuery: RequestHandler;
  export const sanitizeBody: RequestHandler;
  export const enforceContentType: RequestHandler;
  export const additionalSecurityHeaders: RequestHandler;
  export function verifyCsrfOrigin(allowedOrigins?: string[]): RequestHandler;
  export const requireAdminAuth: RequestHandler;
  export const authenticateStudentSession: RequestHandler;
}

declare module "../server/sqliteDb.js" {
  export function getSqliteDb(): any;
  export function optimizeSqliteDb(): boolean;
  export function sqliteGetStudent(studentId: string): any;
  export function sqliteSaveStudent(
    studentId: string,
    encryptedPayload: string,
  ): void;
}

declare module "../server/services/scheduler.js" {
  export function runSyncCycle(options?: any): Promise<any>;
  export function runDatabaseMaintenance(): Promise<{
    success: boolean;
    prunedSharedSchedules: number;
  }>;
  export function startScheduler(): void;
  export function stopScheduler(): void;
}

declare module "../server/routes/registration.js" {
  import type { Router } from "express";
  export function broadcastRegistrationEvent(
    eventType: string,
    payload?: any,
  ): void;
  const router: Router;
  export default router;
}
