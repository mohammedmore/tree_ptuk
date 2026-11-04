/**
 * Central Error Handler - Formats all errors into user-friendly and actionable messages:
 * 1. Authentication/Session/Credential errors (preserved with exact feedback)
 * 2. Rate limiting errors
 * 3. Logical/Academic constraint errors (prerequisite, conflict, etc.)
 * 4. Genuine connection/network errors (server offline, port down)
 */

export interface FormattedError {
  type: "network" | "auth" | "logic";
  message: string;
  canRetry?: boolean;
}

export function formatUserError(rawError: unknown): FormattedError {
  // Always log raw technical error for developer inspection
  console.error("[Internal Error]:", rawError);

  const errorString =
    rawError instanceof Error
      ? rawError.message
      : typeof rawError === "string"
        ? rawError
        : "";

  const lower = errorString.toLowerCase();

  // 1. Authentication / Credential Errors (High Priority: never mask as network error!)
  if (
    lower.includes("بيانات الدخول") ||
    lower.includes("كلمة المرور") ||
    lower.includes("الرقم الجامعي") ||
    lower.includes("اسم المستخدم") ||
    lower.includes("غير صالحة") ||
    lower.includes("غير صحيحة") ||
    lower.includes("auth") ||
    lower.includes("password") ||
    lower.includes("جلسة") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("غير مصرح") ||
    lower.includes("unauthorized")
  ) {
    return {
      type: "auth",
      message:
        errorString.length > 5 && /[\u0600-\u06FF]/.test(errorString)
          ? errorString.replace(/\s*\(HTTP \d+\)\.?$/, "")
          : "بيانات الدخول غير صحيحة. يرجى التأكد من الرقم الجامعي وكلمة المرور.",
      canRetry: false,
    };
  }

  // 2. Rate Limiting / Throttle Errors
  if (
    lower.includes("محاولات كثيرة") ||
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("too many")
  ) {
    return {
      type: "network",
      message:
        "تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار بضع دقائق ثم إعادة المحاولة.",
      canRetry: true,
    };
  }

  // 3. Logical / Academic Constraint Errors
  if (
    lower.includes("تعارض") ||
    lower.includes("conflict") ||
    lower.includes("متطلب") ||
    lower.includes("prereq") ||
    lower.includes("مقفول") ||
    lower.includes("مغلقة") ||
    lower.includes("ساعات") ||
    lower.includes("حد")
  ) {
    return {
      type: "logic",
      message:
        errorString ||
        "لا يمكن إتمام العملية بسبب تعارض في المتطلبات أو المواعيد.",
      canRetry: false,
    };
  }

  // 4. Connection / Network Errors (Real network failure, proxy error, or server down)
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("econnrefused") ||
    lower.includes("etimedout") ||
    lower.includes("fetch failed") ||
    lower.includes("abort") ||
    lower.includes("backend_offline") ||
    lower.includes("خادم المزامنة") ||
    lower.includes("port 3001") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("504") ||
    lower.includes("500")
  ) {
    return {
      type: "network",
      message:
        "تعذر الاتصال بخادم المزامنة المحلي (Port 3001). تأكد من تشغيل الخادم عبر npm run start أو npm run dev:all.",
      canRetry: true,
    };
  }

  // 5. Clean Arabic message passthrough if provided by backend
  if (errorString && /[\u0600-\u06FF]/.test(errorString)) {
    return {
      type: "network",
      message: errorString.replace(/\s*\(HTTP \d+\)\.?$/, ""),
      canRetry: true,
    };
  }

  // Default fallback
  return {
    type: "network",
    message: "تعذر إتمام العملية حالياً. تحقق من الاتصال وحاول مجدداً.",
    canRetry: true,
  };
}
