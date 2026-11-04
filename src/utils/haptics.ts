/**
 * Mobile Haptic Feedback Engine
 * Triggers subtle vibration patterns via navigator.vibrate to provide physical tactile feedback
 * when students complete courses, swap sections, or perform schedule actions on mobile devices.
 */

export type HapticType =
  "light" | "selection" | "success" | "swap" | "warning" | "error";

const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  light: 12,
  selection: 18,
  success: [25, 40, 35],
  swap: [20, 35, 20],
  warning: [35, 50, 35],
  error: [50, 60, 50, 60, 50],
};

/**
 * Checks if the Web Vibration API is supported on the current device.
 */
export function isHapticsSupported(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
  );
}

/**
 * Triggers haptic vibration if supported. Silently succeeds on desktop or unsupported devices.
 */
export function triggerHaptic(type: HapticType = "light"): boolean {
  if (!isHapticsSupported()) {
    return false;
  }

  try {
    const pattern = HAPTIC_PATTERNS[type] ?? 15;
    return navigator.vibrate(pattern);
  } catch {
    // Some browsers or embedded webviews restrict vibrate without active user gesture
    return false;
  }
}
