/**
 * PTUK Academic Planner & Schedule Solver - Service Worker
 * Ensures offline capabilities for public curriculum and course catalog.
 * PRIVACY & SECURITY DIRECTIVE:
 * Never cache sensitive student records, registration credentials, or private transcripts.
 */

const CACHE_VERSION = "ptuk-pwa-v3-secure";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

const CORE_ASSETS = ["/", "/index.html", "/manifest.json", "/favicon.ico"];

const CACHEABLE_ORIGINS = [
  self.location.origin,
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== DATA_CACHE) {
            console.log(`[SW] Purging outdated cache: ${key}`);
            return caches.delete(key);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // 1. API Endpoints
  if (url.pathname.startsWith("/api/")) {
    const isSensitive =
      url.pathname.startsWith("/api/student") ||
      url.pathname.startsWith("/api/registration") ||
      url.pathname.startsWith("/api/sync") ||
      request.headers.has("authorization") ||
      request.headers.has("x-auth-token");

    // PRIVACY LOCKDOWN: Sensitive endpoints must NEVER be cached by Service Worker
    if (isSensitive) {
      return; // Fall through to standard network fetch without caching
    }

    // Only cache public course and major catalog data
    const isPublicCatalog =
      url.pathname.startsWith("/api/courses") ||
      url.pathname.startsWith("/api/majors");

    if (isPublicCatalog) {
      event.respondWith(
        caches.open(DATA_CACHE).then(async (cache) => {
          try {
            const networkResponse = await fetch(request);
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          } catch {
            const cachedResponse = await cache.match(request);
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response(
              JSON.stringify({
                offline: true,
                message: "أنت تعمل حالياً في وضع عدم الاتصال.",
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
        }),
      );
      return;
    }

    return;
  }

  // 2. Navigation requests: Network first, fall back to cached index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches
              .open(STATIC_CACHE)
              .then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match("/index.html").then((fallback) => {
            return fallback || caches.match("/");
          });
        }),
    );
    return;
  }

  // 3. Static assets, scripts, stylesheets, Google Fonts
  const isCacheableOrigin = CACHEABLE_ORIGINS.some(
    (origin) => url.origin === origin,
  );

  if (isCacheableOrigin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches
                .open(STATIC_CACHE)
                .then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      }),
    );
  }
});
