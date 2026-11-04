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
}): Promise<{
  status: "completed" | "partial" | "failed";
  activePlan: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  totalItems: number;
  registeredCount: number;
  failedCount: number;
  items: Array<{
    courseId: string;
    courseName: string;
    section: string;
    originalPlan: string;
    effectivePlan: string;
    effectiveSection: string;
    status: string;
    message: string;
    retriesCount: number;
    timestamp: string;
    fallbackUsed?: boolean;
  }>;
  diagnostics: Array<{
    type: "warning" | "error" | "info" | "success";
    code: string;
    title: string;
    detail: string;
    courseId?: string;
    suggestedAction?: string;
  }>;
}>;

export function testRegistrationRequest(params: {
  studentId: string;
  password?: string;
  plan: any;
  demoMode?: boolean;
  semester?: string;
}): Promise<{
  success: boolean;
  dryRun: boolean;
  timestamp: string;
  pingMs: number;
  httpStatus: number;
  statusCategory: "ready" | "warning" | "error";
  statusTitle: string;
  statusDescription: string;
  errorType?: string;
  errorRawDetail?: string;
  requestDetails: {
    endpoint: string;
    method: string;
    headers: Record<string, string>;
    payloadData: any;
  };
  validatedItems: Array<{
    courseId: string;
    courseName: string;
    section: string;
    credits?: number;
    isValid: boolean;
    message: string;
    seatsAvailable?: number;
  }>;
}>;
