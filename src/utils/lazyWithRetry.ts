import React, { ComponentType, LazyExoticComponent } from "react";

/**
 * Resilient dynamic import wrapper for React.lazy.
 * Automatically handles transient network hiccups, Vite dev server restarts,
 * and stale chunk hashes between deployments.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  interval = 800,
): LazyExoticComponent<T> {
  return React.lazy(
    () =>
      new Promise<{ default: T }>((resolve, reject) => {
        const attempt = (retriesLeft: number) => {
          factory()
            .then(resolve)
            .catch((error: unknown) => {
              const errorMsg =
                error instanceof Error ? error.message : String(error);
              const isChunkError =
                errorMsg.includes(
                  "Failed to fetch dynamically imported module",
                ) ||
                errorMsg.includes("Loading chunk") ||
                errorMsg.includes("dynamically imported");

              if (retriesLeft > 0) {
                setTimeout(() => attempt(retriesLeft - 1), interval);
                return;
              }

              // In browser environments: stale chunk hashes or dev server restarts can be recovered
              // with a single hard page reload before giving up to the ErrorBoundary.
              if (isChunkError && typeof window !== "undefined") {
                const storageKey = `retry_chunk_${window.location.pathname}_${window.location.hash}`;
                const hasAutoReloaded = sessionStorage.getItem(storageKey);
                if (!hasAutoReloaded) {
                  sessionStorage.setItem(storageKey, "true");
                  window.location.reload();
                  return;
                }
                sessionStorage.removeItem(storageKey);
              }

              reject(error);
            });
        };

        attempt(retries);
      }),
  );
}
