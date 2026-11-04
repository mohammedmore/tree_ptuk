export function getSqliteDb(): any;
export function optimizeSqliteDb(): boolean;
export function sqliteGetStudent(studentId: string): any;
export function sqliteSaveStudent(
  studentId: string,
  encryptedPayload: string,
): void;
