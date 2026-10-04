import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Uncaught error in React subtree", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
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
            عذراً، حدث خطأ غير متوقع
          </h2>
          <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md font-bold">
            واجه التطبيق مشكلة في عرض هذا الجزء. يرجى محاولة إعادة تحميل الصفحة
            أو مسح البيانات المحفوظة.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black transition-all shadow-lg"
          >
            <RefreshCw size={20} aria-hidden="true" />
            إعادة المحاولة
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
