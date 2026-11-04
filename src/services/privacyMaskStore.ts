/**
 * Centralized Privacy Mask Store
 * Single source of truth for PTUK Privacy Screen Mask Mode
 * Synchronizes across React 19 components via useSyncExternalStore
 */

const STORAGE_KEY = "ptuk_privacy_mask";

function readStorage(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      localStorage.getItem(STORAGE_KEY) === "true"
    );
  } catch {
    return false;
  }
}

let isPrivacyMasked = readStorage();
const listeners = new Set<() => void>();

export function getPrivacyMask(): boolean {
  return isPrivacyMasked;
}

export function applyPrivacyMaskDOM(masked: boolean): void {
  if (typeof document === "undefined") return;
  try {
    const root = document.documentElement;
    const body = document.body;
    if (masked) {
      root.setAttribute("data-privacy-mask", "true");
      root.classList.add("privacy-mask-active");
      if (body) {
        body.setAttribute("data-privacy-mask", "true");
        body.classList.add("privacy-mask-active");
      }
    } else {
      root.removeAttribute("data-privacy-mask");
      root.classList.remove("privacy-mask-active");
      if (body) {
        body.removeAttribute("data-privacy-mask");
        body.classList.remove("privacy-mask-active");
      }
    }
  } catch {}
}

export function setPrivacyMask(masked: boolean): void {
  if (isPrivacyMasked === masked) return;
  isPrivacyMasked = masked;

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, String(masked));
    }
  } catch {}

  applyPrivacyMaskDOM(masked);

  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("ptuk-privacy-mask-toggle", {
          detail: { isPrivacyMasked: masked },
        }),
      );
    } catch {}
  }
}

export function togglePrivacyMask(): boolean {
  const next = !isPrivacyMasked;
  setPrivacyMask(next);
  return next;
}

export function subscribePrivacyMask(callback: () => void): () => void {
  listeners.add(callback);

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      const next = e.newValue === "true";
      if (next !== isPrivacyMasked) {
        isPrivacyMasked = next;
        applyPrivacyMaskDOM(next);
        callback();
      }
    }
  };

  const handleCustomEvent = (e: Event) => {
    const customEv = e as CustomEvent<{ isPrivacyMasked?: boolean }>;
    const next =
      typeof customEv.detail?.isPrivacyMasked === "boolean"
        ? customEv.detail.isPrivacyMasked
        : readStorage();
    if (next !== isPrivacyMasked) {
      isPrivacyMasked = next;
      applyPrivacyMaskDOM(next);
      callback();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
    window.addEventListener("ptuk-privacy-mask-toggle", handleCustomEvent);
  }

  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("ptuk-privacy-mask-toggle", handleCustomEvent);
    }
  };
}

// Initial sync with DOM
if (typeof window !== "undefined") {
  applyPrivacyMaskDOM(isPrivacyMasked);
}
