export function runSyncCycle(options?: any): Promise<any>;
export function runDatabaseMaintenance(): Promise<{
  success: boolean;
  prunedSharedSchedules: number;
}>;
export function startScheduler(): void;
export function stopScheduler(): void;
