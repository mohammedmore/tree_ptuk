import React, { useEffect, useState } from "react";
import { X, MessageCircle } from "lucide-react";
import * as QRCode from "qrcode";
import { BaseModal } from "./BaseModal";

interface SupportModalProps {
  isSupportModalOpen: boolean;
  onClose: () => void;
}

const SupportModal: React.FC<SupportModalProps> = ({
  isSupportModalOpen,
  onClose,
}) => {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupportModalOpen) return;

    let cancelled = false;
    setQrError(null);
    void QRCode.toDataURL("https://wa.me/972568718784", {
      width: 250,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((dataUrl) => {
        if (!cancelled) setQrImage(dataUrl);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error("Unable to generate WhatsApp support QR code", error);
          setQrImage(null);
          setQrError(
            "تعذر إنشاء الرمز. يمكنك بدء المحادثة من رابط واتساب أعلاه.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isSupportModalOpen]);

  return (
    <BaseModal
      isOpen={isSupportModalOpen}
      onClose={onClose}
      ariaLabel="الدعم الفني والاقتراحات"
      maxWidth="max-w-lg"
      className="rounded-3xl"
    >
      <div
        className="p-6 sm:p-8 flex flex-col gap-5 text-right font-sans"
        dir="rtl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق نافذة الدعم"
          className="absolute top-4 left-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-all"
          title="إغلاق"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <div>
          <div className="flex items-center gap-2.5 mb-2 justify-start">
            <span className="p-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-305 rounded-xl">
              <MessageCircle
                size={24}
                aria-hidden="true"
                className="text-emerald-600 dark:text-emerald-400 animate-pulse"
              />
            </span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300 px-2.5 py-1 rounded-md">
              تواصل مباشر
            </span>
          </div>
          <h3 className="text-xl font-black text-gray-900 dark:text-slate-100 text-right leading-tight mb-1">
            الدعم الفني والاقتراحات
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
            موقع خريطة فلسطين الأكاديمية - هندسة أنظمة الحاسوب
          </p>
        </div>

        <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed font-semibold bg-gray-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-gray-100 dark:border-slate-850 text-right">
          إذا واجهتك أي مشكلة تقنية أثناء استخدام الخريطة الأكاديمية، أو رغبت في
          رفع اقتراح لتطوير الموقع وتحسين تجربة الطلاب، يسعدنا تواصلك المباشر مع
          مطور الموقع <strong>(محمد حدرب)</strong> عبر الخيارات المتاحة أدناه:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Facebook Card */}
          <a
            href="https://www.facebook.com/mhmd.hdrb.2025"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10 hover:bg-blue-50/50 dark:hover:bg-blue-950/25 hover:border-blue-300 dark:hover:border-blue-800 transition-all group flex flex-col justify-between h-32 shadow-sm hover:shadow-md cursor-pointer text-right"
          >
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-blue-600 dark:text-blue-400 font-bold text-xs bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-md">
                  فيسبوك
                </span>
                <svg
                  aria-hidden="true"
                  className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
                </svg>
              </div>
              <h4 className="font-extrabold text-sm text-gray-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                مطور الخريطة
              </h4>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold mt-0.5">
                @mhmd.hdrb.2025
              </p>
            </div>
            <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-2">
              زيارة الملف الشخصي ←
            </span>
          </a>

          {/* WhatsApp Card */}
          <a
            href="https://wa.me/972568718784"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/25 hover:border-emerald-300 dark:hover:border-emerald-800 transition-all group flex flex-col justify-between h-32 shadow-sm hover:shadow-md cursor-pointer text-right"
          >
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md">
                  واتساب
                </span>
                <svg
                  aria-hidden="true"
                  className="w-5 h-5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12.012 2c-5.506 0-9.973 4.467-9.973 9.974 0 2.006.591 3.877 1.614 5.451L2.03 22l4.71-.97c1.513.822 3.232 1.29 5.059 1.29l.006-.001c5.507 0 9.973-4.467 9.973-9.973 0-5.507-4.467-9.973-9.974-9.973zm-.006 17.154h-.005a7.17 7.17 0 0 1-3.667-1.002H8.33l-2.723.56.57-2.656-.05-.078a7.17 7.17 0 0 1-1.096-3.82c0-3.957 3.218-7.174 7.178-7.174 1.917 0 3.719.747 5.074 2.104a7.135 7.135 0 0 1 2.101 5.074c-.001 3.959-3.218 7.177-7.175 7.192zm3.931-5.367c-.215-.108-1.272-.63-1.468-.702-.197-.072-.34-.108-.483.108-.144.215-.556.702-.68.845-.125.143-.25.161-.466.054-.215-.108-.91-.336-1.734-1.071-.64-.572-1.073-1.278-1.199-1.493-.125-.215-.013-.331.094-.438.097-.096.215-.25.323-.376.108-.125.143-.215.215-.359.071-.144.035-.269-.018-.376s-.483-1.164-.662-1.594c-.175-.42-.35-.362-.483-.369h-.414c-.143 0-.376.054-.573.269s-.751.735-.751 1.79c0 1.054.767 2.072.874 2.215s1.509 2.302 3.655 3.228c.511.22 1.096.353 1.472.333.376-.021 1.15-.47 1.311-.925.162-.455.162-.845.114-.925-.049-.08-.179-.125-.394-.233z" />
                </svg>
              </div>
              <h4 className="font-extrabold text-sm text-gray-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                مراسلة واتساب فورية
              </h4>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold mt-0.5">
                محادثة مباشرة دون حفظ الرقم
              </p>
            </div>
            <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-2">
              بدء المحادثة ←
            </span>
          </a>
        </div>

        {/* Replicated WhatsApp QR Card view */}
        <div className="flex flex-col items-center bg-emerald-500/10 dark:bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/20 dark:border-emerald-500/10 mt-2">
          <span className="text-xs font-bold text-gray-700 dark:text-slate-300 mb-3 block text-center">
            أو امسح رمز كود الواتساب التالي:
          </span>

          <div
            className="w-64 bg-[#128C7E] rounded-3xl overflow-hidden shadow-xl p-6 flex flex-col items-center text-center relative font-sans select-none animate-in fade-in zoom-in-95 duration-300"
            dir="ltr"
          >
            <div className="w-12 h-12 bg-black rounded-full border-4 border-white flex items-center justify-center absolute -top-6 left-1/2 -translate-x-1/2 shadow-inner">
              <span className="text-white text-base font-black">M</span>
            </div>
            {/* White card sub-container */}
            <div className="bg-white rounded-2xl w-full p-5 mt-4 shadow-md flex flex-col items-center">
              <h4 className="text-gray-900 font-bold text-sm tracking-wide">
                Mohammed Hodrob
              </h4>
              <p className="text-gray-400 text-[10px] font-semibold mt-1">
                WhatsApp contact
              </p>

              {/* Real QR image generator pointing to decoded WhatsApp url */}
              <div className="bg-white p-2.5 rounded-lg border border-gray-150 mt-4 relative group">
                {qrImage ? (
                  <img
                    src={qrImage}
                    alt="رمز QR لبدء محادثة واتساب مع مطور الموقع"
                    className="w-40 h-40 object-contain transition-transform group-hover:scale-105 duration-200"
                  />
                ) : (
                  <div
                    role="status"
                    className="w-40 h-40 flex items-center justify-center px-3 text-xs font-bold text-gray-600"
                  >
                    {qrError ?? "جارٍ إنشاء رمز واتساب..."}
                  </div>
                )}

                {/* Tiny WhatsApp icon badge right in the center */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow">
                  <svg
                    aria-hidden="true"
                    className="w-6 h-6 text-[#128C7E]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 1.76.46 3.42 1.26 4.87L1.13 22.8l6.12-1.22c1.4.74 3 1.15 4.75 1.15 5.52 0 10-4.48 10-10S17.52 2 12 2z" />
                    <path
                      d="M15.3 14.98c-.14.2-.73.4-1 .4-.25 0-.58-.08-1.78-.58-1.53-.63-2.52-2.2-2.6-2.3-.08-.1-.64-.85-.64-1.63 0-.78.4-1.16.55-1.32.14-.15.3-.22.45-.22H11c.14 0 .32.06.46.25.15.2.5 1.25.55 1.34.05.1.08.2.01.32-.07.12-.1.25-.21.37-.1.12-.22.2-.33.34-.1.1-.23.23-.1.46.14.23.63 1.03 1.35 1.67.92.83 1.7 1.08 1.94 1.2.23.12.37.1.5-.04.14-.15.6-.7.76-.94s.3-.2.53-.1.15 0 2.22 1.06c.15.1.25.15.3.23.05.08.05.47-.1.87z"
                      fill="white"
                    />
                  </svg>
                </div>
              </div>
            </div>{" "}
            {/* This is the missing closing div for "White card sub-container" */}
            {/* Subtitle bottom text */}
            <p className="text-white text-[10px] font-bold text-center leading-relaxed mt-4 px-2 w-full">
              Scan this code using the WhatsApp camera to get my number
            </p>
            <p
              className="text-white/80 text-[10px] font-bold text-center mt-1"
              dir="rtl"
            >
              امسح الرمز بكاميرا واتساب الرسمية للبدء في مراسلتي
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 border-t border-gray-150 dark:border-slate-800 pt-4 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-750 dark:text-slate-200 text-xs font-extrabold rounded-xl transition-all cursor-pointer text-center"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

export default SupportModal;
