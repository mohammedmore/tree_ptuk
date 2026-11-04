export interface TrackedSeat {
  courseCode: string;
  courseName: string;
  sec: string; // Specific section like "1", "2" or "all" for all closed sections
  instructor?: string;
  room?: string;
  time?: string;
  lastKnownSeats?: number;
  registered?: number;
  capacity?: number;
  isFull: boolean;
  trackedAt: string;
}

export interface SectionCapacityDetails {
  registered: number;
  capacity: number;
  available: number;
  isFull: boolean;
  label: string; // e.g. "40 / 40 طالب"
}

export interface NotificationSettings {
  webPushEnabled: boolean;
}

const STORAGE_SEATS_KEY = "ptuk_tracked_seats_v1";
const STORAGE_NOTIF_KEY = "ptuk_notif_settings_v1";

/**
 * Checks whether a given section status indicates that it is closed or full.
 * In PTUK portal: 'مغلقة', 'مغلق', 'ممتلئة', etc.
 */
export function isSectionClosed(status?: string): boolean {
  if (!status) return true; // If status is not provided, allow tracking
  const s = status.trim().toLowerCase();
  if (
    s.includes("مفتوح") ||
    s.includes("متاح") ||
    s.includes("open") ||
    s.includes("شاغر") ||
    s === "available"
  ) {
    return false;
  }
  return (
    s.includes("مغلق") ||
    s.includes("ممتلئ") ||
    s.includes("closed") ||
    s.includes("full") ||
    s.includes("لا يوجد")
  );
}

/**
 * Computes or retrieves exact student count and capacity for a section.
 * Enables students to see live enrollment before deciding to track a section.
 */
export function getSectionCapacityDetails(
  section: {
    sec?: string;
    status?: string;
    capacity?: number;
    registered?: number;
  },
  courseCode?: string,
): SectionCapacityDetails {
  const rawCap =
    typeof section.capacity === "number" && section.capacity > 0
      ? section.capacity
      : 40;

  // 1. If status string explicitly contains ratio numbers like "38/40" or "40/40"
  if (section.status) {
    const match = section.status.match(/(\d+)\s*[/\\-]\s*(\d+)/);
    if (match) {
      const reg = parseInt(match[1], 10);
      const cap = parseInt(match[2], 10) || rawCap;
      const available = Math.max(0, cap - reg);
      const isFull = reg >= cap || isSectionClosed(section.status);
      return {
        registered: reg,
        capacity: cap,
        available,
        isFull,
        label: `${reg} / ${cap} طالب`,
      };
    }
  }

  // 2. If registered count is explicitly provided
  if (typeof section.registered === "number" && section.registered >= 0) {
    const reg = section.registered;
    const available = Math.max(0, rawCap - reg);
    const isFull = reg >= rawCap || isSectionClosed(section.status);
    return {
      registered: reg,
      capacity: rawCap,
      available,
      isFull,
      label: `${reg} / ${rawCap} طالب`,
    };
  }

  // 3. If closed: section has reached or exceeded full capacity
  const closed = isSectionClosed(section.status);
  if (closed) {
    return {
      registered: rawCap,
      capacity: rawCap,
      available: 0,
      isFull: true,
      label: `${rawCap} / ${rawCap} طالب`,
    };
  }

  // 4. If open without explicit counts: report authentic open status without fabricating random/hashed numbers
  return {
    registered: 0,
    capacity: rawCap,
    available: rawCap,
    isFull: false,
    label: "مفتوحة (شواغر متاحة)",
  };
}

export function getTrackedSeats(): TrackedSeat[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_SEATS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isSectionTracked(courseCode: string, sec: string): boolean {
  const current = getTrackedSeats();
  return current.some(
    (s) => s.courseCode === courseCode && (s.sec === sec || s.sec === "all"),
  );
}

export function isCourseTracked(courseCode: string): boolean {
  const current = getTrackedSeats();
  return current.some((s) => s.courseCode === courseCode);
}

export function getTrackedSectionsForCourse(courseCode: string): TrackedSeat[] {
  const current = getTrackedSeats();
  return current.filter((s) => s.courseCode === courseCode);
}

function safeSetStorage(key: string, value: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore quota exceeded or storage error
  }
}

export function toggleTrackSection(
  courseCode: string,
  courseName: string,
  sec: string,
  instructor?: string,
  room?: string,
  isFull = true,
  registered?: number,
  capacity?: number,
): boolean {
  const current = getTrackedSeats();
  const exists = current.some(
    (s) => s.courseCode === courseCode && s.sec === sec,
  );

  let next: TrackedSeat[];
  let isNowTracked: boolean;

  if (exists) {
    next = current.filter(
      (s) => !(s.courseCode === courseCode && s.sec === sec),
    );
    isNowTracked = false;
  } else {
    next = [
      ...current,
      {
        courseCode,
        courseName,
        sec,
        instructor,
        room,
        isFull,
        registered,
        capacity,
        trackedAt: new Date().toISOString(),
      },
    ];
    isNowTracked = true;
  }

  safeSetStorage(STORAGE_SEATS_KEY, JSON.stringify(next));

  return isNowTracked;
}

export function removeTrackedSection(courseCode: string, sec: string): void {
  const current = getTrackedSeats();
  const next = current.filter(
    (s) => !(s.courseCode === courseCode && s.sec === sec),
  );
  safeSetStorage(STORAGE_SEATS_KEY, JSON.stringify(next));
}

export function trackMultipleSections(
  items: Array<{
    courseCode: string;
    courseName: string;
    sec: string;
    instructor?: string;
    room?: string;
    isFull?: boolean;
    registered?: number;
    capacity?: number;
  }>,
): number {
  const current = getTrackedSeats();
  const existingKeys = new Set(current.map((s) => `${s.courseCode}-${s.sec}`));
  const toAdd: TrackedSeat[] = [];

  for (const item of items) {
    const key = `${item.courseCode}-${item.sec}`;
    if (!existingKeys.has(key)) {
      toAdd.push({
        courseCode: item.courseCode,
        courseName: item.courseName,
        sec: item.sec,
        instructor: item.instructor,
        room: item.room,
        isFull: item.isFull ?? true,
        registered: item.registered,
        capacity: item.capacity,
        trackedAt: new Date().toISOString(),
      });
      existingKeys.add(key);
    }
  }

  if (toAdd.length > 0) {
    const next = [...current, ...toAdd];
    safeSetStorage(STORAGE_SEATS_KEY, JSON.stringify(next));
  }

  return toAdd.length;
}

export function getNotificationSettings(): NotificationSettings {
  if (typeof window === "undefined" || !window.localStorage) {
    return { webPushEnabled: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_NOTIF_KEY);
    return raw ? JSON.parse(raw) : { webPushEnabled: false };
  } catch {
    return { webPushEnabled: false };
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  safeSetStorage(STORAGE_NOTIF_KEY, JSON.stringify(settings));
}

export async function requestWebPushPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch {
    return false;
  }
}

/**
 * Checks and actively prompts for browser notification permission if not yet granted.
 * Returns "granted", "denied", or "unsupported".
 */
export async function ensureNotificationPermission(): Promise<
  "granted" | "denied" | "unsupported"
> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted") {
    return "granted";
  }
  if (Notification.permission === "default") {
    try {
      const res = await Notification.requestPermission();
      return res === "granted" ? "granted" : "denied";
    } catch {
      return "denied";
    }
  }
  return "denied";
}

export function playNotificationSound(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio autoplay might be suspended by browser policies until user interacts
  }
}

export function sendBrowserNotification(title: string, body: string): boolean {
  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    try {
      playNotificationSound();
      new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: `ptuk-seat-${Date.now()}`,
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function autoRequestAndNotify(
  courseName: string,
  sec: string,
): Promise<boolean> {
  const perm = await ensureNotificationPermission();
  if (perm === "granted") {
    saveNotificationSettings({
      ...getNotificationSettings(),
      webPushEnabled: true,
    });
    sendBrowserNotification(
      "🔔 تتبع المقاعد المغلقة نشط في المتصفح!",
      sec === "all"
        ? `ستصلك إشعارات المتصفح الفورية فور فتح أي مقعد في الشعب المغلقة لمادة ${courseName}.`
        : `ستصلك إشعارات المتصفح الفورية فور فتح مقعد في شعبة ${sec} لمادة ${courseName}.`,
    );
    return true;
  }
  return false;
}
