// ReportAndFix service worker
// Only immutable, non-user-specific assets are cached.
// Never cache HTML documents, Next.js RSC/navigation payloads, or authenticated data.
const CACHE_PREFIX = "reportandfix-static-";
const CACHE_NAME = `${CACHE_PREFIX}v3`;

const PRECACHE_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon.svg",
];

function isCacheableStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    PRECACHE_ASSETS.includes(url.pathname)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Let the browser handle navigations, app routes, API/auth requests,
  // cross-origin requests and all non-static content without interception.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    request.mode === "navigate" ||
    request.headers.has("RSC") ||
    request.headers.has("Next-Router-State-Tree") ||
    request.headers.has("Next-Router-Prefetch") ||
    !isCacheableStaticAsset(url)
  ) {
    return;
  }

  // Cache-first is safe here because these URLs are either hashed Next.js
  // build assets or explicitly listed public, non-user-specific assets.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache))
          );
        }
        return networkResponse;
      });
    })
  );
});
