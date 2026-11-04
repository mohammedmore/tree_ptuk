import React from "react";
import { WifiOff, CheckCircle2, CloudCheck } from "lucide-react";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";

export const OfflineBanner: React.FC = () => {
  const { isOnline, wasOffline } = useNetworkStatus();

  if (isOnline && !wasOffline) {
    return null;
  }

  if (isOnline && wasOffline) {
    return (
      <div
        role="status"
        className="no-print bg-emerald-600/90 text-white text-xs px-3 py-1.5 text-center font-bold flex items-center justify-center gap-2 transition-all animate-in fade-in slide-in-from-top-1 duration-200"
      >
        <CheckCircle2 size={14} className="shrink-0" />
        <span>عادت شبكة الإنترنت! تمت مزامنة كافة التعديلات تلقائياً.</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="no-print bg-amber-600/95 dark:bg-amber-700/95 text-white text-xs px-3 py-1.5 text-center font-semibold flex items-center justify-center gap-2 shadow-xs transition-all animate-in fade-in slide-in-from-top-1 duration-200"
    >
      <WifiOff size={14} className="shrink-0 animate-pulse" />
      <span>
        أنت تعمل في وضع دون اتصال (Offline). خطتك الأكاديمية وجدولك الفصلي
        محفوظان ومتاحان محلياً بالكامل.
      </span>
    </div>
  );
};
