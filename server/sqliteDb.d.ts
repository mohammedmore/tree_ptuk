export function getSqliteDb(): any;
export function optimizeSqliteDb(): boolean;
export function getSqliteMetrics(): any;
export function sqliteGetStudent(studentId: string): any;
export function sqliteSaveStudent(
  studentId: string,
  encryptedPayload: string,
): void;
export function sqliteRevokeToken(signature: string, expiresAt: number): void;
export function sqliteGetRevokedTokens(): Array<{
  signature: string;
  expires_at: number;
}>;
export function sqliteSaveAccountLockout(
  studentId: string,
  attempts: number,
  firstAttemptAt: number,
  lockedUntil: number,
): void;
export function sqliteGetAccountLockouts(): Array<{
  student_id: string;
  attempts: number;
  first_attempt_at: number;
  locked_until: number;
}>;
export function sqliteDeleteAccountLockout(studentId: string): void;
export function sqlitePruneExpiredSecurityState(): void;
export function sqliteUpsertCohortPlan(
  majorId: string,
  cohortYear: string,
  planData: any,
): void;
export function sqliteGetCohortPlan(majorId: string, cohortYear: string): any;
export function sqliteSaveTrackedSeats(
  studentId: string,
  seats: Array<{ courseCode: string; sec: string; courseName?: string }>,
): void;
export function sqliteGetTrackedSeats(
  studentId: string,
): Array<{ courseCode: string; sec: string; courseName?: string }>;
export function sqliteRemoveTrackedSeat(
  studentId: string,
  courseCode: string,
  secNumber: string,
): void;
