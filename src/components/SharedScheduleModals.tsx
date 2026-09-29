import React, { useEffect, useRef, useState } from "react";
import { Copy, Link2, LoaderCircle, QrCode, Search, X } from "lucide-react";
import { BaseModal } from "./BaseModal";
import { SharedScheduleSnapshot } from "../sharedSchedules";

interface QRCodeOptions {
  text: string;
  width: number;
  height: number;
  colorDark: string;
  colorLight: string;
  correctLevel: number;
}

interface QRCodeConstructor {
  new (element: HTMLElement, options: QRCodeOptions): unknown;
}

interface ShareScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string | null;
  loading: boolean;
  error: string | null;
  onCreate: () => void;
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
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const shareUrl = code
    ? `${window.location.origin}${window.location.pathname}?code=${code}`
    : "";

  useEffect(() => {
    if (isOpen) {
      setCopyError(null);
      setCopySuccess(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const container = qrContainerRef.current;
    if (!container || !shareUrl) return;
    container.replaceChildren();
    const qrCodeConstructor = (window as Window & { QRCode?: QRCodeConstructor }).QRCode;
    if (!qrCodeConstructor) return;
    new qrCodeConstructor(container, {
      text: shareUrl,
      width: 192,
      height: 192,
      colorDark: "#0f172a",
      colorLight: "#ffffff",
      correctLevel: 1,
    });
  }, [shareUrl]);

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
          setCopyError(fallbackError instanceof Error ? fallbackError.message : "تعذر النسخ. حدد النص وانسخه يدوياً.");
          return;
        }
      }
      setCopyError(error instanceof Error ? error.message : "تعذر النسخ. حدد النص وانسخه يدوياً.");
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="مشاركة الجدول" maxWidth="max-w-md">
      <div className="p-5 space-y-4 text-center" dir="rtl">
        <p className="text-sm text-gray-600 dark:text-slate-300">
          أنشئ رمزاً ورابطاً لفتح نسخة من خطتك والجدول الأسبوعي على أي جهاز.
        </p>
        {!code && (
          <button
            onClick={onCreate}
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? <LoaderCircle className="mx-auto animate-spin" size={20} /> : "إنشاء رابط مشاركة"}
          </button>
        )}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        {copyError && <p role="alert" className="text-sm font-bold text-red-700">{copyError}</p>}
        {copySuccess && <p role="status" className="text-sm font-bold text-emerald-700">{copySuccess}</p>}
        {code && (
          <>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <p className="mb-2 text-xs font-bold text-gray-500 dark:text-slate-400">رمز الاسترجاع</p>
              <div className="font-mono text-3xl font-black tracking-[0.2em] text-slate-900 dark:text-white" dir="ltr">
                {code.slice(0, 4)} - {code.slice(4)}
              </div>
              <button
                onClick={() => void copyText(code)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold dark:border-slate-600 dark:bg-slate-700"
              >
                <Copy size={15} /> نسخ الرمز
              </button>
            </div>
            <div className="flex gap-2">
              <input readOnly value={shareUrl} dir="ltr" className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 text-left text-xs dark:border-slate-700 dark:bg-slate-800" />
              <button
                onClick={() => void copyText(shareUrl)}
                aria-label="نسخ الرابط"
                className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white"
              >
                <Link2 size={16} /> نسخ الرابط
              </button>
            </div>
            <div className="mx-auto flex min-h-52 w-52 items-center justify-center rounded-xl border border-gray-100 bg-white p-2 dark:border-slate-700">
              <div ref={qrContainerRef} aria-label="رمز QR للرابط" />
              {!window.QRCode && (
                <div className="space-y-2 text-center text-xs font-bold text-gray-500">
                  <QrCode className="mx-auto" size={36} />
                  <p>تعذر تحميل مولّد QR. يمكنك استخدام الرابط أو الرمز أعلاه.</p>
                </div>
              )}
            </div>
            <button onClick={onCreate} disabled={loading} className="text-xs font-bold text-blue-600 hover:underline">
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
  onLoad: (code: string) => Promise<void>;
}

export const LoadScheduleModal: React.FC<LoadScheduleModalProps> = ({
  isOpen,
  onClose,
  loading,
  error,
  onLoad,
}) => {
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
    else setCode("");
  }, [isOpen]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void onLoad(code);
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="استرجاع جدول برمز" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4 p-5 text-right" dir="rtl">
        <label htmlFor="shared-schedule-code" className="block text-sm font-bold text-gray-700 dark:text-slate-200">
          أدخل الرمز المكون من 8 خانات
        </label>
        <input
          ref={inputRef}
          id="shared-schedule-code"
          value={code}
          maxLength={11}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onPaste={(event) => {
            event.preventDefault();
            setCode(event.clipboardData.getData("text").toUpperCase().trim());
          }}
          placeholder="A7X9-2P4K"
          dir="ltr"
          className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-center font-mono text-2xl font-black tracking-widest outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
        />
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={loading || code.replace(/[\s-]/g, "").length !== 8}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? <LoaderCircle className="animate-spin" size={18} /> : <Search size={18} />}
          جلب الجدول
        </button>
      </form>
    </BaseModal>
  );
};

interface SharedSchedulePreviewProps {
  schedule: SharedScheduleSnapshot | null;
  code: string | null;
  onClose: () => void;
}

export const SharedSchedulePreviewModal: React.FC<SharedSchedulePreviewProps> = ({
  schedule,
  code,
  onClose,
}) => (
  <BaseModal
    isOpen={!!schedule}
    onClose={onClose}
    title={schedule?.name ?? "الجدول المشارك"}
    maxWidth="max-w-3xl"
  >
    {schedule && (
      <div className="space-y-4 p-4 sm:p-6" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-bold text-emerald-700">تم تحميل الجدول المشارك عبر الرمز: {code}</span>
          <span className="text-gray-500">{schedule.courses.length} مادة</span>
        </div>
        {schedule.courses.length === 0 ? (
          <p className="rounded-xl bg-gray-50 p-5 text-center font-bold text-gray-500 dark:bg-slate-800">لا توجد مواد في هذه اللقطة.</p>
        ) : (
          <div className="space-y-3">
            {schedule.courses.map((course, index) => (
              <article
                key={`${course.courseCode}-${course.semester}-${index}`}
                className="rounded-xl border border-gray-200 p-4 dark:border-slate-700"
                style={{ borderRightWidth: 5, borderRightColor: course.color || "#3b82f6" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-black text-gray-900 dark:text-white">{course.courseName}</h3>
                    <p className="mt-1 text-xs font-bold text-gray-500">
                      {course.courseCode} · الشعبة {course.section || "—"} · {course.credits} ساعات
                    </p>
                  </div>
                  <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold dark:bg-slate-800">{course.semester}</span>
                </div>
                <div className="mt-3 grid gap-1 text-sm text-gray-600 dark:text-slate-300 sm:grid-cols-2">
                  <span>الأيام: {course.days.join("، ") || "غير محدد"}</span>
                  <span>الوقت: {course.startTime || "—"} - {course.endTime || "—"}</span>
                  <span>المدرس: {course.instructor || "غير محدد"}</span>
                  <span>القاعة: {course.room || "غير محددة"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
        <button onClick={onClose} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-black text-white">
          <X size={17} /> إغلاق
        </button>
      </div>
    )}
  </BaseModal>
);
