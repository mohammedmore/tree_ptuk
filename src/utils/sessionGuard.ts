import {
  getStudentSessionToken,
  logoutStudent,
} from "../services/studentService";

/**
 * Enterprise Inactivity Guard
 * Protects students on shared university library and lab computers.
 * Automatically terminates session and invalidates tokens after 30 minutes of user inactivity.
 */
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
let lastActivity = Date.now();
let checkInterval: any = null;

function recordActivity(): void {
  lastActivity = Date.now();
}

export function initSessionGuard(): void {
  if (typeof window === "undefined") return;

  const events: Array<keyof WindowEventMap> = [
    "mousedown",
    "keydown",
    "touchstart",
    "scroll",
  ];
  events.forEach((evt) => {
    window.addEventListener(evt, recordActivity, { passive: true });
  });

  if (checkInterval) {
    clearInterval(checkInterval);
  }

  checkInterval = setInterval(() => {
    const token = getStudentSessionToken();
    if (!token) return;

    if (Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS) {
      console.warn(
        "🔒 [SECURITY] Session timed out due to 30 minutes of inactivity on shared device.",
      );
      logoutStudent().catch(() => {});
    }
  }, 30 * 1000);
}
