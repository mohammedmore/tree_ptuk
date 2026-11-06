import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Activity,
  Server,
  Database,
  Cpu,
  Clock,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Copy,
  Check,
  Radio,
  FileCode2,
  Lock,
  Key,
} from "lucide-react";
import { cn } from "../../utils";

interface SystemHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ObservabilityData {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: {
    seconds: number;
    formatted: string;
  };
  requests: {
    total: number;
    rps: number;
    rateLimitHits: number;
    statusCodes: {
      "2xx": number;
      "3xx": number;
      "4xx": number;
      "5xx": number;
    };
    errorRatePercent: number;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
    sampleCount: number;
  };
  topRoutes: Array<{
    route: string;
    count: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    errors: number;
  }>;
  system: {
    eventLoopLagMs: number;
    memory: {
      heapUsedMb: number;
      heapTotalMb: number;
      rssMb: number;
      heapUtilizationPercent: number;
    };
    nodeVersion: string;
    platform: string;
  };
  circuitBreaker: {
    name: string;
    state: "CLOSED" | "OPEN" | "HALF_OPEN";
    consecutiveFailures: number;
    tripCount: number;
    lastFailureTime: string | null;
    lastSuccessTime: string | null;
    lastErrorMessage: string | null;
  };
  database: {
    engine: string;
    metrics: {
      sizeFormatted?: string;
      walFormatted?: string;
      studentsCount?: number;
      activeSessionsCount?: number;
      revokedTokensCount?: number;
      accountLockoutsCount?: number;
    } | null;
  };
}

export const SystemHealthModal: React.FC<SystemHealthModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number>(3000);
  const [copied, setCopied] = useState<boolean>(false);
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [isAuthRequired, setIsAuthRequired] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchStats = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const savedKey =
      typeof window !== "undefined"
        ? window.sessionStorage?.getItem("ptuk_admin_key") || ""
        : "";
    const token =
      typeof window !== "undefined"
        ? window.localStorage?.getItem("ptuk_student_token") || ""
        : "";

    const headers: Record<string, string> = { Accept: "application/json" };
    if (savedKey) headers["x-api-key"] = savedKey;
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch("/api/observability/stats", {
        signal: controller.signal,
        headers,
      });

      if (res.status === 401 || res.status === 403) {
        setIsAuthRequired(true);
        setError("يتطلب صلاحيات المشرفين (Admin Access) لعرض مؤشرات النظام.");
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const payload = (await res.json()) as ObservabilityData;
      setData(payload);
      setError(null);
      setIsAuthRequired(false);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "تعذر جلب مقاييس الأداء والمراقبة.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAdminAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminKeyInput.trim()) return;
    setAuthSubmitting(true);
    try {
      const res = await fetch("/api/observability/stats", {
        headers: {
          Accept: "application/json",
          "x-api-key": adminKeyInput.trim(),
        },
      });
      if (res.ok) {
        if (typeof window !== "undefined") {
          window.sessionStorage?.setItem(
            "ptuk_admin_key",
            adminKeyInput.trim(),
          );
          window.sessionStorage?.setItem("ptuk_admin_authorized", "true");
        }
        setIsAuthRequired(false);
        setError(null);
        const payload = (await res.json()) as ObservabilityData;
        setData(payload);
      } else {
        setError("مفتاح الإدارة غير صالح. تم رفض الوصول.");
      }
    } catch {
      setError("حدث خطأ أثناء الاتصال بالخادم للتحقق من الصلاحيات.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    fetchStats();

    if (refreshInterval > 0) {
      const timer = setInterval(() => {
        fetchStats();
      }, refreshInterval);
      return () => clearInterval(timer);
    }
  }, [isOpen, refreshInterval, fetchStats]);

  const handleCopyJson = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const isHealthy = data?.status === "healthy";
  const isDegraded = data?.status === "degraded";
  const circuitState = data?.circuitBreaker?.state || "CLOSED";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="لوحة مراقبة الأداء واستقرار النظام"
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[var(--surface)] text-[var(--text)] border border-[var(--line)] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)] bg-[var(--surface-sunken)]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2.5 rounded-2xl flex items-center justify-center text-white shadow-sm",
                isHealthy
                  ? "bg-emerald-500 shadow-emerald-500/20"
                  : isDegraded
                    ? "bg-amber-500 shadow-amber-500/20"
                    : "bg-rose-500 shadow-rose-500/20",
              )}
            >
              <Activity size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  مراقبة الأداء واستقرار النظام
                </h2>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                    isHealthy
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : isDegraded
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full animate-ping",
                      isHealthy
                        ? "bg-emerald-500"
                        : isDegraded
                          ? "bg-amber-500"
                          : "bg-rose-500",
                    )}
                  />
                  {isHealthy
                    ? "النظام يعمل بكفاءة"
                    : isDegraded
                      ? "أداء مقيد / قيد الفحص"
                      : "تحذير: النظام تحت ضغط"}
                </span>
              </div>
              <p className="text-xs text-[var(--text-3)] font-medium">
                تتبع حي لمقاييس Latency، بوابات Edugate، واستهلاك الموارد
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto refresh select */}
            <div className="hidden sm:flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--line)] px-2.5 py-1 rounded-xl text-xs">
              <Radio
                size={13}
                className={
                  refreshInterval > 0
                    ? "text-emerald-500 animate-spin"
                    : "text-[var(--text-3)]"
                }
              />
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="bg-transparent text-[var(--text)] text-xs font-semibold focus:outline-hidden cursor-pointer"
                aria-label="معدل التحديث التلقائي"
              >
                <option value={1000}>تحديث كل 1 ثانية</option>
                <option value={3000}>تحديث كل 3 ثوانٍ</option>
                <option value={5000}>تحديث كل 5 ثوانٍ</option>
                <option value={10000}>تحديث كل 10 ثوانٍ</option>
                <option value={0}>إيقاف التحديث التلقائي</option>
              </select>
            </div>

            {/* Manual refresh button */}
            <button
              onClick={() => {
                setLoading(true);
                fetchStats();
              }}
              disabled={loading}
              className="p-2 rounded-xl text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] border border-[var(--line)] transition-colors cursor-pointer"
              title="تحديث يدوي الآن"
              aria-label="تحديث يدوي"
            >
              <RefreshCw
                size={16}
                className={cn(loading && "animate-spin text-[var(--accent)]")}
              />
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              aria-label="إغلاق النافذة"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {isAuthRequired && !data ? (
            <div className="max-w-md mx-auto py-10 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto shadow-sm">
                <Lock size={30} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base sm:text-lg font-bold text-[var(--text)]">
                  لوحة مراقبة الخادم (Admin Restricted)
                </h3>
                <p className="text-xs text-[var(--text-3)] leading-relaxed">
                  هذه اللوحة مخصصة لمسؤولي ومطوري النظام فقط لمتابعة صحة السيرفر
                  وحركة الطلبات. يرجى إدخال مفتاح الإدارة للمتابعة.
                </p>
              </div>

              <form onSubmit={handleAdminAuthSubmit} className="space-y-3">
                <input
                  type="password"
                  value={adminKeyInput}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                  placeholder="أدخل مفتاح الإدارة (ADMIN_API_KEY)..."
                  className="w-full h-11 px-4 text-xs sm:text-sm bg-[var(--surface-sunken)] border border-[var(--line-control)] rounded-xl focus:outline-hidden focus:border-[var(--accent)] text-[var(--text)] text-center font-mono placeholder:text-[var(--text-3)]"
                />
                {error && (
                  <p className="text-xs font-semibold text-rose-500">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={authSubmitting || !adminKeyInput.trim()}
                  className="w-full h-10 px-4 rounded-xl bg-[var(--accent)] text-[var(--text-on-accent)] text-xs font-bold hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {authSubmitting
                    ? "جاري التحقق..."
                    : "تأكيد والوصول إلى اللوحة"}
                </button>
              </form>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center gap-3 text-xs sm:text-sm">
                  <AlertTriangle size={18} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Key Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Card 1: Latency */}
                <div className="p-4 rounded-2xl bg-[var(--surface-sunken)]/50 border border-[var(--line)] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-3)] mb-2">
                    <span>زمن الاستجابة (Latency)</span>
                    <Clock size={16} className="text-sky-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-black tracking-tight text-[var(--text)]">
                      {data?.latency?.avg ?? 0}
                      <span className="text-xs font-bold text-[var(--text-3)] mr-1">
                        ms
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-2)] pt-2 border-t border-[var(--line)]/60">
                      <span>
                        p50: <b>{data?.latency?.p50 ?? 0}ms</b>
                      </span>
                      <span>
                        p95: <b>{data?.latency?.p95 ?? 0}ms</b>
                      </span>
                      <span>
                        p99: <b>{data?.latency?.p99 ?? 0}ms</b>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Edugate Circuit Breaker */}
                <div className="p-4 rounded-2xl bg-[var(--surface-sunken)]/50 border border-[var(--line)] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-3)] mb-2">
                    <span>بوابة الجامعة (Edugate)</span>
                    <ShieldCheck
                      size={16}
                      className={
                        circuitState === "CLOSED"
                          ? "text-emerald-500"
                          : circuitState === "HALF_OPEN"
                            ? "text-amber-500"
                            : "text-rose-500"
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider",
                          circuitState === "CLOSED"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : circuitState === "HALF_OPEN"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {circuitState === "CLOSED"
                          ? "مستقر (Closed)"
                          : circuitState === "HALF_OPEN"
                            ? "فحص أولي (Canary)"
                            : "معزول (Tripped)"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-2)] pt-2 border-t border-[var(--line)]/60">
                      <span>
                        الإخفاقات:{" "}
                        <b>
                          {data?.circuitBreaker?.consecutiveFailures ?? 0}/3
                        </b>
                      </span>
                      <span>
                        مرات الحماية:{" "}
                        <b>{data?.circuitBreaker?.tripCount ?? 0}</b>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Memory Usage */}
                <div className="p-4 rounded-2xl bg-[var(--surface-sunken)]/50 border border-[var(--line)] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-3)] mb-2">
                    <span>ذاكرة النظام (Heap Memory)</span>
                    <Cpu size={16} className="text-violet-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <div className="text-2xl font-black tracking-tight text-[var(--text)]">
                        {data?.system?.memory?.heapUsedMb ?? 0}
                        <span className="text-xs font-bold text-[var(--text-3)] mr-1">
                          MB
                        </span>
                      </div>
                      <span className="text-xs font-bold text-[var(--text-3)]">
                        من {data?.system?.memory?.heapTotalMb ?? 0} MB
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-[var(--line)] rounded-full h-1.5 overflow-hidden mt-1">
                      <div
                        className="bg-violet-500 h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            data?.system?.memory?.heapUtilizationPercent ?? 0,
                            100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card 4: Database Storage */}
                <div className="p-4 rounded-2xl bg-[var(--surface-sunken)]/50 border border-[var(--line)] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-3)] mb-2">
                    <span>قاعدة البيانات (SQLite)</span>
                    <Database size={16} className="text-amber-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-black tracking-tight text-[var(--text)]">
                      {data?.database?.metrics?.sizeFormatted || "0 KB"}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-2)] pt-2 border-t border-[var(--line)]/60">
                      <span>
                        سجل WAL:{" "}
                        <b>{data?.database?.metrics?.walFormatted || "0 KB"}</b>
                      </span>
                      <span>
                        الطلاب:{" "}
                        <b>{data?.database?.metrics?.studentsCount ?? 0}</b>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Runtime & Request Statistics Grid */}
              <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-sunken)]/30 border border-[var(--line)] space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">
                  إحصائيات التشغيل والطلبات المباشرة
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)]">
                    <span className="text-[11px] font-semibold text-[var(--text-3)] block mb-1">
                      مدة التشغيل المتواصل
                    </span>
                    <span className="text-sm sm:text-base font-black text-[var(--text)]">
                      {data?.uptime?.formatted || "0s"}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)]">
                    <span className="text-[11px] font-semibold text-[var(--text-3)] block mb-1">
                      معدل الطلبات (RPS)
                    </span>
                    <span className="text-sm sm:text-base font-black text-sky-600 dark:text-sky-400">
                      {data?.requests?.rps ?? 0} req/s
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)]">
                    <span className="text-[11px] font-semibold text-[var(--text-3)] block mb-1">
                      تأخر حلقة الأحداث (Event Loop)
                    </span>
                    <span
                      className={cn(
                        "text-sm sm:text-base font-black",
                        (data?.system?.eventLoopLagMs ?? 0) > 50
                          ? "text-amber-500"
                          : "text-emerald-500",
                      )}
                    >
                      {data?.system?.eventLoopLagMs ?? 0} ms
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)]">
                    <span className="text-[11px] font-semibold text-[var(--text-3)] block mb-1">
                      نسبة الخطأ الإجمالية
                    </span>
                    <span
                      className={cn(
                        "text-sm sm:text-base font-black",
                        (data?.requests?.errorRatePercent ?? 0) > 5
                          ? "text-rose-500"
                          : "text-emerald-500",
                      )}
                    >
                      {data?.requests?.errorRatePercent ?? 0}%
                    </span>
                  </div>
                </div>

                {/* Status Code Breakdown Pills */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--line)] text-xs text-[var(--text-2)]">
                  <span>توزيع استجابات الخادم (HTTP Status):</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                      2xx: {data?.requests?.statusCodes?.["2xx"] ?? 0}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">
                      3xx: {data?.requests?.statusCodes?.["3xx"] ?? 0}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                      4xx: {data?.requests?.statusCodes?.["4xx"] ?? 0}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
                      5xx: {data?.requests?.statusCodes?.["5xx"] ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Top Routes Latency Table */}
              {data?.topRoutes && data.topRoutes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">
                    أداء مسارات الـ API الأكثر طلباً (Top Routes)
                  </h3>
                  <div className="border border-[var(--line)] rounded-2xl overflow-hidden bg-[var(--surface)]">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-[var(--surface-sunken)]/60 text-[var(--text-3)] font-semibold border-b border-[var(--line)]">
                        <tr>
                          <th className="py-2.5 px-4">المسار (Route)</th>
                          <th className="py-2.5 px-4 text-center">الطلبات</th>
                          <th className="py-2.5 px-4 text-center">
                            متوسط الزمن
                          </th>
                          <th className="py-2.5 px-4 text-center">
                            أدنى / أقصى
                          </th>
                          <th className="py-2.5 px-4 text-center">الأخطاء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line)]">
                        {data.topRoutes.map((r, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-[var(--surface-hover)]/50 transition-colors"
                          >
                            <td className="py-2.5 px-4 font-mono font-medium text-[var(--text)]">
                              {r.route}
                            </td>
                            <td className="py-2.5 px-4 text-center font-bold">
                              {r.count}
                            </td>
                            <td className="py-2.5 px-4 text-center font-bold">
                              <span
                                className={cn(
                                  r.avgMs > 150
                                    ? "text-rose-500"
                                    : r.avgMs > 50
                                      ? "text-amber-500"
                                      : "text-emerald-500",
                                )}
                              >
                                {r.avgMs} ms
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center text-[var(--text-3)]">
                              {r.minMs} / {r.maxMs} ms
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              {r.errors > 0 ? (
                                <span className="px-1.5 py-0.5 rounded-sm bg-rose-500/10 text-rose-500 font-bold">
                                  {r.errors}
                                </span>
                              ) : (
                                <span className="text-[var(--text-3)]">0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 border-t border-[var(--line)] bg-[var(--surface-sunken)]/40 shrink-0 text-xs text-[var(--text-3)]">
          <div className="flex items-center gap-3">
            <span>
              الإصدار: <b>Node.js {data?.system?.nodeVersion || "20"}</b>
            </span>
            <span>•</span>
            <span>
              المنصة: <b>{data?.system?.platform || "Server"}</b>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-500" />
                  <span className="text-emerald-500 font-bold">تم النسخ!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>نسخ التقرير التشخيصي (JSON)</span>
                </>
              )}
            </button>

            <a
              href="/metrics"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors cursor-pointer"
              title="عرض مقاييس Prometheus الخام"
            >
              <FileCode2 size={14} />
              <span>Prometheus /metrics</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthModal;
