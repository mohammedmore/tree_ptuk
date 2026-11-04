import React, { useEffect, useRef, useState } from "react";
import { Copy, Link2, LoaderCircle, QrCode, Search, X } from "lucide-react";
import * as QRCode from "qrcode";
import { BaseModal } from "../common/BaseModal";
import {
  normalizeScheduleCode,
  type SharedScheduleSnapshot,
} from "../../core/sharedSchedules";

interface ShareScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string | null;
  loading: boolean;
  error: string | null;
  onCreate: (options?: { pinCode?: string }) => void;
}

export const ShareScheduleModal: React.FC<ShareScheduleModalProps> = ({
  isOpen,
  onClose,
  code,
  loading,
  error,
  onCreate,
}) => {
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const [pinInput, setPinInput] = useState("");
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const shareUrl = code
    ? (() => {
        const url = new URL(window.location.href);
        url.searchParams.set("code", code);
        return url.toString();
      })()
    : "";

  useEffect(() => {
    if (isOpen) {
      setCopyError(null);
      setCopySuccess(null);
      setQrError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const container = qrContainerRef.current;
    if (!container || !shareUrl) return;
    container.replaceChildren();
    let cancelled = false;
    setQrError(null);
    void QRCode.toCanvas(shareUrl, {
      width: 192,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((canvas) => {
        if (!cancelled) container.appendChild(canvas);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error("Unable to generate shared schedule QR code", error);
          setQrError("تعذر إنشاء رمز QR. يمكنك نسخ الرابط واستخدامه مباشرة.");
        }
      });
    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [shareUrl]);

  useEffect(() => {
    if (code) setCopyError(null);
  }, [code]);

  const copyWithFallback = (value: string): void => {
    const temporaryInput = document.createElement("textarea");
    temporaryInput.value = value;
    temporaryInput.setAttribute("readonly", "");
    temporaryInput.style.position = "fixed";
    temporaryInput.style.opacity = "0";
    document.body.appendChild(temporaryInput);
    try {
      temporaryInput.select();
      if (!document.execCommand("copy")) {
        throw new Error("تعذر النسخ. حدد النص وانسخه يدوياً.");
      }
    } finally {
      temporaryInput.remove();
    }
  };

  const copyText = async (value: string) => {
    try {
      setCopyError(null);
      setCopySuccess(null);
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        copyWithFallback(value);
      }
      setCopySuccess("تم النسخ إلى الحافظة.");
    } catch (error) {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          copyWithFallback(value);
          setCopySuccess("تم النسخ إلى الحافظة.");
          return;
        } catch (fallbackError) {
          setCopyError(
            fallbackError instanceof Error
              ? fallbackError.message
              : "تعذر النسخ. حدد النص وانسخه يدوياً.",
          );
          return;
        }
      }
      setCopyError(
        error instanceof Error
          ? error.message
          : "تعذر النسخ. حدد النص وانسخه يدوياً.",
      );
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="مشاركة الجدول"
      maxWidth="max-w-md"
    >
      <div className="p-5 space-y-4 text-center" dir="rtl">
        <p className="text-sm text-gray-600 dark:text-slate-300">
          أنشئ رمزاً ورابطاً لفتح نسخة من خطتك والجدول الأسبوعي على أي جهاز.
        </p>
        {!code && (
          <div className="space-y-3">
            <div className="text-right space-y-1">
              <label
                htmlFor="share-pin-input"
                className="block text-xs font-bold text-gray-600 dark:text-slate-300"
              >
                تعيين رمز PIN للحماية (اختياري - Item 73):
              </label>
              <input
                id="share-pin-input"
                type="password"
                maxLength={16}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="اتركه فارغاً للمشاركة العامة"
                className="w-full h-9 px-3 rounded-lg border border-[var(--line-control)] bg-[var(--surface)] text-[var(--text)] text-xs font-mono text-center outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                onCreate(pinInput ? { pinCode: pinInput } : undefined)
              }
              disabled={loading}
              className="w-full min-h-11 rounded-xl bg-[var(--accent)] px-4 py-3 font-black text-[var(--text-on-accent)] transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <LoaderCircle className="mx-auto animate-spin" size={20} />
              ) : (
                "إنشاء رابط مشاركة"
              )}
            </button>
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-[var(--danger-soft)] p-3 text-sm font-bold text-[var(--danger)]"
          >
            {error}
          </p>
        )}
        {copyError && (
          <p role="alert" className="text-sm font-bold text-[var(--danger)]">
            {copyError}
          </p>
        )}
        {copySuccess && (
          <p role="status" className="text-sm font-bold text-[var(--accent)]">
            {copySuccess}
          </p>
        )}
        {code && (
          <>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--sunken)] p-4">
              <p className="mb-2 text-xs font-bold text-[var(--text-3)]">
                رمز الاسترجاع
              </p>
              <div
                className="font-mono text-3xl font-black tracking-[0.2em] text-[var(--text)]"
                dir="ltr"
              >
                {code.slice(0, 4)} - {code.slice(4)}
              </div>
              <button
                type="button"
                onClick={() => void copyText(code)}
                aria-label="نسخ رمز الاسترجاع"
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line-control)] bg-[var(--surface)] text-[var(--text)] px-3 py-2 text-sm font-bold cursor-pointer hover:bg-[var(--sunken)] transition-colors"
              >
                <Copy size={15} /> نسخ الرمز
              </button>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                aria-label="رابط مشاركة الجدول"
                value={shareUrl}
                dir="ltr"
                className="min-w-0 flex-1 min-h-11 rounded-lg border border-[var(--line-control)] bg-[var(--surface)] text-[var(--text)] px-3 text-left text-xs"
              />
              <button
                type="button"
                onClick={() => void copyText(shareUrl)}
                aria-label="نسخ الرابط"
                className="flex shrink-0 min-h-11 items-center gap-1 rounded-lg bg-[var(--accent)] px-3 text-xs font-bold text-[var(--text-on-accent)] cursor-pointer hover:opacity-90 transition-opacity"
              >
                <Link2 size={16} /> نسخ الرابط
              </button>
            </div>
            <div className="mx-auto flex min-h-52 w-52 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2">
              <div ref={qrContainerRef} role="img" aria-label="رمز QR للرابط" />
              {qrError && (
                <div
                  role="status"
                  className="space-y-2 text-center text-xs font-bold text-[var(--text-3)]"
                >
                  <QrCode className="mx-auto" size={36} />
                  <p>{qrError}</p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                onCreate(pinInput ? { pinCode: pinInput } : undefined)
              }
              disabled={loading}
              className="text-xs font-bold text-[var(--accent)] hover:underline"
            >
              إنشاء رمز جديد
            </button>
          </>
        )}
      </div>
    </BaseModal>
  );
};

interface LoadScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  onLoad: (code: string, pin?: string) => Promise<void>;
}

export const LoadScheduleModal: React.FC<LoadScheduleModalProps> = ({
  isOpen,
  onClose,
  loading,
  error,
  onLoad,
}) => {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    } else {
      setCode("");
      setPin("");
    }
  }, [isOpen]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedCode = normalizeScheduleCode(code);
    if (/^[A-HJ-KM-NP-Z2-9]{8}$/.test(normalizedCode))
      void onLoad(normalizedCode, pin.trim() || undefined);
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="استرجاع جدول برمز"
      maxWidth="max-w-md"
    >
      <form
        onSubmit={handleSubmit}
        aria-busy={loading}
        className="space-y-4 p-5 text-right"
        dir="rtl"
      >
        <label
          htmlFor="shared-schedule-code"
          className="block text-sm font-bold text-gray-700 dark:text-slate-200"
        >
          أدخل الرمز المكون من 8 خانات
        </label>
        <input
          ref={inputRef}
          id="shared-schedule-code"
          value={code}
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onPaste={(event) => {
            event.preventDefault();
            setCode(normalizeScheduleCode(event.clipboardData.getData("text")));
          }}
          placeholder="A7X9-2P4K"
          dir="ltr"
          className="w-full rounded-xl border-2 border-[var(--line-control)] bg-[var(--surface)] text-[var(--text)] px-4 py-3 text-center font-mono text-2xl font-black tracking-widest outline-none focus:border-[var(--accent)]"
          aria-describedby="shared-schedule-code-help"
        />
        <p
          id="shared-schedule-code-help"
          className="text-xs text-[var(--text-3)]"
        >
          يقبل الحقل الرمز مع شرطة أو مسافات؛ ستتم إزالة الفواصل تلقائياً.
        </p>
        <div className="space-y-1">
          <label
            htmlFor="shared-schedule-pin"
            className="block text-xs font-semibold text-[var(--text-2)]"
          >
            رمز الحماية (PIN) - اختياري إن كان الجدول محمياً:
          </label>
          <input
            id="shared-schedule-pin"
            type="password"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="مثال: 1234"
            dir="ltr"
            className="w-full rounded-xl border border-[var(--line-control)] bg-[var(--surface)] text-[var(--text)] px-3 py-2 text-center font-mono text-base font-bold outline-none focus:border-[var(--accent)]"
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-[var(--danger-soft)] p-3 text-sm font-bold text-[var(--danger)]"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={
            loading ||
            !/^[A-HJ-KM-NP-Z2-9]{8}$/.test(normalizeScheduleCode(code))
          }
          className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 font-black text-[var(--text-on-accent)] transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <LoaderCircle className="animate-spin" size={18} />
          ) : (
            <Search size={18} />
          )}
          جلب الجدول
        </button>
      </form>
    </BaseModal>
  );
};

interface SharedSchedulePreviewProps {
  schedule: SharedScheduleSnapshot | null;
  code: string | null;
  warning?: string;
  onClose: () => void;
  onApply: () => void;
}

export const SharedSchedulePreviewModal: React.FC<
  SharedSchedulePreviewProps
> = ({ schedule, code, warning, onClose, onApply }) => {
  const gradedCourses =
    schedule?.courses.filter((course) => {
      const grade = course.grade ?? schedule.courseGrades?.[course.courseCode];
      return (
        (course.completed || course.failed) &&
        grade !== -1 &&
        (typeof grade === "number" || course.failed)
      );
    }) ?? [];
  const gradedCredits = gradedCourses.reduce(
    (sum, course) => sum + course.credits,
    0,
  );
  const weightedAverage = gradedCredits
    ? gradedCourses.reduce(
        (sum, course) =>
          sum +
          (course.grade ?? schedule?.courseGrades?.[course.courseCode] ?? 0) *
            course.credits,
        0,
      ) / gradedCredits
    : null;

  return (
    <BaseModal
      isOpen={!!schedule}
      onClose={onClose}
      title={schedule?.name ?? "الجدول المشارك"}
      maxWidth="max-w-3xl"
    >
      {schedule && (
        <div className="space-y-4 p-4 sm:p-6" dir="rtl">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-bold text-emerald-700">
              تم تحميل الخطة عبر الرمز: {code}
            </span>
            <span className="text-gray-500">
              {schedule.courses.length} مادة في المنهاج
            </span>
          </div>
          {warning && (
            <p
              role="status"
              className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800"
            >
              تم جلب الخطة. {warning} شغّل ملف إصلاح دالة العدّاد في Supabase
              لتفعيل العداد.
            </p>
          )}
          {schedule.version === 2 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                ["المواد المنجزة", schedule.completedCourses.length],
                ["المواد المخفقة", schedule.failedCourseIds?.length ?? 0],
                ["المواد المخططة", Object.keys(schedule.plannedCourses).length],
                [
                  "المواد ذات العلامات",
                  Object.keys(schedule.courseGrades ?? {}).length,
                ],
                [
                  "معدل العلامات",
                  weightedAverage === null
                    ? "—"
                    : `${weightedAverage.toFixed(2)}%`,
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl bg-[var(--sunken)] p-3 text-center border border-[var(--line)]"
                >
                  <div className="text-xl font-black text-[var(--accent)]">
                    {value}
                  </div>
                  <div className="text-xs font-bold text-[var(--text-3)]">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}
          {schedule.courses.length === 0 ? (
            <p className="rounded-xl bg-[var(--sunken)] p-5 text-center font-bold text-[var(--text-3)] border border-[var(--line)]">
              لا توجد مواد في هذه اللقطة.
            </p>
          ) : (
            <div className="max-h-[55vh] space-y-3 overflow-y-auto">
              {schedule.courses.map((course, index) => (
                <article
                  key={`${course.courseCode}-${course.semester}-${index}`}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
                  style={{
                    borderRightWidth: 5,
                    borderRightColor: course.color || "var(--accent)",
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-black text-[var(--text)]">
                        {course.courseName}
                      </h3>
                      <p className="mt-1 text-xs font-bold text-[var(--text-3)]">
                        {course.courseCode} · {course.credits} ساعات ·{" "}
                        {course.category}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {course.semester && (
                        <span className="rounded-lg bg-[var(--sunken)] text-[var(--text-2)] px-2 py-1 text-xs font-bold border border-[var(--line)]">
                          {course.semester}
                        </span>
                      )}
                      {course.completed && (
                        <span className="rounded-lg bg-[var(--accent-soft)] px-2 py-1 text-xs font-bold text-[var(--accent)]">
                          منجزة
                        </span>
                      )}
                      {course.failed && (
                        <span className="rounded-lg bg-[var(--danger-soft)] px-2 py-1 text-xs font-bold text-[var(--danger)]">
                          إعادة
                        </span>
                      )}
                      {course.grade !== null && course.grade !== undefined && (
                        <span className="rounded-lg bg-[var(--sunken)] text-[var(--text)] px-2 py-1 text-xs font-bold border border-[var(--line)]">
                          {course.grade === -1
                            ? "ناجح/راسب"
                            : `العلامة: ${course.grade}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-1 text-sm text-[var(--text-2)] sm:grid-cols-2">
                    <span>الفصل: {course.semester || "غير مخططة"}</span>
                    <span>الشعبة: {course.section || "—"}</span>
                    <span>الأيام: {course.days.join("، ") || "غير محدد"}</span>
                    <span>
                      الوقت: {course.startTime || "—"} - {course.endTime || "—"}
                    </span>
                    <span>المدرس: {course.instructor || "غير محدد"}</span>
                    <span>القاعة: {course.room || "غير محددة"}</span>
                    {(course.prerequisites?.length ?? 0) > 0 && (
                      <span className="sm:col-span-2">
                        المتطلبات السابقة: {course.prerequisites?.join("، ")}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          {schedule.preferences && (
            <div className="rounded-xl bg-[var(--sunken)] p-3 text-xs font-bold text-[var(--text-2)] border border-[var(--line)]">
              إعدادات الخطة: من {schedule.preferences.planStartSemester} إلى{" "}
              {schedule.preferences.planEndSemester}
              {" · "}إخفاء الفصول السابقة:{" "}
              {schedule.preferences.hidePastSemesters ? "نعم" : "لا"}
              {" · "}المظهر: {schedule.preferences.darkMode ? "داكن" : "فاتح"}
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="flex flex-1 min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line-control)] bg-[var(--surface)] px-4 py-3 font-black text-[var(--text)] cursor-pointer hover:bg-[var(--sunken)] transition-colors"
            >
              <X size={17} /> إغلاق
            </button>
            <button
              type="button"
              onClick={onApply}
              className="flex flex-1 min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 font-black text-[var(--text-on-accent)] hover:opacity-90 cursor-pointer transition-opacity"
            >
              استبدال خطتي بهذه الخطة
            </button>
          </div>
        </div>
      )}
    </BaseModal>
  );
};
