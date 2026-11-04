import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Uncaught error in React subtree", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = (): void => {
    const errorMsg = this.state.error?.message || "";
    const isDynamicImportError =
      errorMsg.includes("Failed to fetch dynamically imported module") ||
      errorMsg.includes("Loading chunk") ||
      errorMsg.includes("dynamically imported");

    if (isDynamicImportError && typeof window !== "undefined") {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  private handleClearStorageAndReload = (): void => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error("Failed to clear storage", e);
    }
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const errorMsg = this.state.error?.message || "";
      const isDynamicImportError =
        errorMsg.includes("Failed to fetch dynamically imported module") ||
        errorMsg.includes("Loading chunk") ||
        errorMsg.includes("dynamically imported");

      return (
        <div
          role="alert"
          dir="rtl"
          className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-gray-50 dark:bg-slate-900 rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-800 m-4"
        >
          <div className="p-4 bg-orange-100 dark:bg-orange-900/30 rounded-full mb-4">
            <AlertTriangle
              size={48}
              aria-hidden="true"
              className="text-orange-600 dark:text-orange-400"
            />
          </div>
          <h2 className="text-2xl font-black text-gray-800 dark:text-slate-100 mb-2">
            {isDynamicImportError
              ? "تعذر تحميل محتوى الصفحة"
              : "عذراً، حدث خطأ غير متوقع"}
          </h2>
          <p className="text-gray-600 dark:text-slate-400 mb-4 max-w-md font-bold">
            {isDynamicImportError
              ? "تعذر جلب ملفات الصفحة من خادم التطوير (تأكد من تشغيل npm run dev ثم اضغط إعادة المحاولة)."
              : "واجه التطبيق مشكلة في عرض هذا الجزء. يرجى محاولة إعادة تحميل الصفحة أو مسح البيانات المحفوظة."}
          </p>

          {this.state.error && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-xs font-mono text-left max-w-md w-full overflow-auto dir-ltr border border-red-200 dark:border-red-900/50">
              <span className="font-bold">{this.state.error.name}: </span>
              {this.state.error.message}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-sm cursor-pointer"
            >
              <RefreshCw size={18} aria-hidden="true" />
              إعادة المحاولة
            </button>
            <button
              type="button"
              onClick={this.handleClearStorageAndReload}
              className="flex items-center gap-2 px-6 py-2.5 bg-gray-200 dark:bg-slate-800 hover:bg-red-600 hover:text-white text-gray-700 dark:text-slate-200 rounded-xl font-bold transition-all cursor-pointer"
            >
              مسح الذاكرة وإعادة التحميل
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
