import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-gray-50 dark:bg-slate-900 rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-800 m-4">
          <div className="p-4 bg-orange-100 dark:bg-orange-900/30 rounded-full mb-4">
            <AlertTriangle size={48} className="text-orange-600 dark:text-orange-400" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 dark:text-slate-100 mb-2">عذراً، حدث خطأ غير متوقع</h2>
          <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md font-bold">
            واجه التطبيق مشكلة في عرض هذا الجزء. يرجى محاولة إعادة تحميل الصفحة أو مسح البيانات المحفوظة.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black transition-all shadow-lg"
          >
            <RefreshCw size={20} />
            تحديث الصفحة
          </button>
        </div>
      );
    }

    return this.children;
  }
}
