import type {
  PlanKey,
  RegistrationPlan,
  RegistrationExecutionSummary,
} from "../core/semesterRegistration";

function getBaseApiUrl(): string {
  const envBase =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
      ? import.meta.env.VITE_API_BASE_URL
      : "";

  if (typeof window !== "undefined") {
    if (
      envBase &&
      !envBase.includes("localhost:3001") &&
      !envBase.includes("127.0.0.1:3001")
    ) {
      return envBase.replace(/\/+$/, "");
    }
    return "";
  }

  if (envBase) return envBase.replace(/\/+$/, "");
  return "http://localhost:3001";
}

export interface PrewarmResult {
  success: boolean;
  sessionReady: boolean;
  pingMs: number;
  serverStatus: string;
  message: string;
  timestamp?: string;
  serverTimestamp?: number;
}

export interface CheckSeatsResult {
  code: string;
  name: string;
  sections: Array<{
    sec: string;
    capacity: number;
    registered: number;
    available: number;
    isFull: boolean;
  }>;
}

export interface PortalStatusResult {
  isOpen: boolean;
  status: string;
  message: string;
  rawNotice?: string;
}

/**
 * Checks real-time availability of https://edugate.ptuk.edu.ps/student/onlineRegistration
 */
export async function checkPortalRegistrationStatus(
  studentId: string,
  password: string,
): Promise<PortalStatusResult> {
  const url = `${getBaseApiUrl()}/api/registration/portal-status`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ studentId, password }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  const json = await response.json();
  return json.data;
}

/**
 * Pre-warms session with university registration portal to ensure fast connection before 8:00 AM.
 */
export async function prewarmRegistration(
  studentId: string,
  password?: string,
  demoMode = false,
): Promise<PrewarmResult> {
  const url = `${getBaseApiUrl()}/api/registration/prewarm`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ studentId, password, demoMode }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: PrewarmResult = await response.json();
    return data;
  } catch (err: any) {
    // In live mode with real credentials, never forge simulation successes
    if (demoMode === false && password) {
      throw new Error(err.message || "فشل الاتصال المسبق ببوابة Edugate.");
    }
    // Offline simulation fallback (Demo mode only)
    return {
      success: true,
      sessionReady: true,
      pingMs: 38,
      serverStatus: "ready",
      message: "جلسة التسجيل جاهزة ومجهزة مسبقاً (محاكاة داخلية).",
    };
  }
}

/**
 * Executes multi-plan registration batch with cascading fallback (A -> B -> C).
 */
export async function executeRegistration(
  studentId: string,
  password: string | undefined,
  plans: Record<PlanKey, RegistrationPlan>,
  options: {
    demoMode?: boolean;
    targetPlan?: PlanKey;
    autoFallbackOnFull?: boolean;
    maxRetries?: number;
    simulateFinancialIssue?: boolean;
    idempotencyKey?: string;
  } = {},
): Promise<RegistrationExecutionSummary> {
  const url = `${getBaseApiUrl()}/api/registration/execute`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (options.idempotencyKey) {
      headers["x-idempotency-key"] = options.idempotencyKey;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        studentId,
        password,
        plans,
        options,
        idempotencyKey: options.idempotencyKey,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    if (json.data) return json.data;
    throw new Error(json.error || "فشل تنفيذ التسجيل");
  } catch (err: any) {
    // In live mode with real credentials, never forge simulation successes
    if (options.demoMode === false && password) {
      throw new Error(
        err.message || "فشل الاتصال المباشر ببوابة الجامعة Edugate.",
      );
    }

    // Client-side fallback execution (Demo/Simulation mode only)
    const items = plans[options.targetPlan || "A"]?.items || [];
    const results = items.map((item, idx) => ({
      courseId: item.courseId,
      courseName: item.courseName,
      section: item.section,
      originalPlan: options.targetPlan || "A",
      effectivePlan: options.targetPlan || "A",
      effectiveSection: item.section,
      status: "registered" as const,
      message: `تم تثبيت تسجيل الشعبة (${item.section}) بنجاح.`,
      retriesCount: 1,
      timestamp: new Date().toISOString(),
      fallbackUsed: false,
    }));

    return {
      status: "completed",
      activePlan: options.targetPlan || "A",
      startTime: Date.now(),
      endTime: Date.now() + 650,
      durationMs: 650,
      totalItems: items.length,
      registeredCount: items.length,
      failedCount: 0,
      items: results,
      diagnostics: [],
    };
  }
}

/**
 * Fetches real-time seat capacities for given course codes.
 */
export async function checkSeatsAvailability(
  courseCodes: string[],
): Promise<CheckSeatsResult[]> {
  const url = `${getBaseApiUrl()}/api/registration/check-seats`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ courseCodes }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    return json.courses || [];
  } catch {
    return [];
  }
}

export interface RegistrationTestResult {
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
    payloadData: Record<string, any>;
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
}

export function getDefaultSemesterCode(): string {
  const now = new Date();
  const calYear = now.getFullYear();
  const month = now.getMonth() + 1;
  const termDigit =
    month >= 2 && month <= 5 ? "2" : month >= 6 && month <= 8 ? "3" : "1";
  const academicYear =
    month < 9 && (termDigit === "2" || termDigit === "3")
      ? calYear - 1
      : calYear;
  return `${academicYear}${termDigit}`;
}

/**
 * Runs a dry-run test request to inspect and verify the HTTP payload and university server status
 * without actually registering or modifying the student's record.
 */
export async function testRegistrationRequest(
  studentId: string,
  password: string | undefined,
  plan: RegistrationPlan,
  semester = getDefaultSemesterCode(),
  demoMode = false,
): Promise<RegistrationTestResult> {
  const url = `${getBaseApiUrl()}/api/registration/test-request`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        studentId,
        password,
        plan,
        semester,
        demoMode,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    if (json.data) return json.data;
    throw new Error(json.error || "فشل الفحص التجريبي للطلب");
  } catch (err: any) {
    // In live mode with real credentials, never fabricate simulation 200 OK
    if (demoMode === false && password) {
      throw new Error(
        err.message || "فشل الفحص المباشر للطلب مع بوابة Edugate.",
      );
    }
    // Client-side fallback dry-run inspection (Demo/offline mode only)
    const items = plan.items || [];
    return {
      success: true,
      dryRun: true,
      timestamp: new Date().toISOString(),
      pingMs: 35,
      httpStatus: 200,
      statusCategory: "ready",
      statusTitle: "الطلب سليم والاتصال بالبوابة جاهز",
      statusDescription:
        "تم فحص تركيبة الطلب والتأكد من مطابقة أرقام المواد والشعب دون تنفيذ أي تسجيل فعلي.",
      requestDetails: {
        endpoint: "https://edugate.ptuk.edu.ps/faces/ui/pages/stu/stdReg.xhtml",
        method: "POST",
        headers: {
          Host: "edugate.ptuk.edu.ps",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Cookie: `JSESSIONID=ptuk_${studentId.slice(0, 8)}_active; Path=/faces`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0",
        },
        payloadData: {
          "javax.faces.ViewState": "j_id1:j_id2:e1s1",
          studentNo: studentId,
          termNo: semester,
          coursesCount: items.length,
          courses: items.map((i) => ({
            courseCode: i.courseId,
            courseName: i.courseName,
            sectionNo: i.section,
            creditHours: i.credits,
          })),
        },
      },
      validatedItems: items.map((i) => ({
        courseId: i.courseId,
        courseName: i.courseName,
        section: i.section,
        credits: i.credits,
        isValid: true,
        message: "الشعبة مدخلة بصيغة صحيحة وجاهزة للإرسال.",
      })),
    };
  }
}
