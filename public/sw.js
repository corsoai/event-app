const CACHE_NAME = "corsvent-v2026-07-22-invite-1";
const OFFLINE_URL = "/offline.html";
const APP_SHELL = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/brand/corso-icon.png",
  "/brand/lbsview-gate.jpeg",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/favicon-48x48.png",
  "/apple-touch-icon.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/icons/corso-32.png",
  "/icons/corso-64.png",
  "/icons/corso-180.png",
  "/icons/corso-maskable-192.png",
  "/icons/corso-maskable-512.png",
  "/icons/corso-192.png",
  "/icons/corso-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
    ])
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  // Live data, auth, and Appwrite traffic must never be served by the offline shell cache.
  if (requestUrl.origin === self.location.origin && requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (requestUrl.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (isNavigationLikeRequest(event.request, requestUrl)) {
    event.respondWith(networkFirst(event.request, { offlineFallback: true, cacheResponse: false }));
    return;
  }

  const cacheableAsset =
    requestUrl.pathname.startsWith("/icons/") ||
    requestUrl.pathname.startsWith("/brand/") ||
    requestUrl.pathname === "/favicon.ico" ||
    requestUrl.pathname === "/favicon-16x16.png" ||
    requestUrl.pathname === "/favicon-32x32.png" ||
    requestUrl.pathname === "/favicon-48x48.png" ||
    requestUrl.pathname === "/apple-touch-icon.png" ||
    requestUrl.pathname === "/android-chrome-192x192.png" ||
    requestUrl.pathname === "/android-chrome-512x512.png" ||
    requestUrl.pathname === "/manifest.webmanifest" ||
    requestUrl.pathname === OFFLINE_URL;

  event.respondWith(cacheableAsset ? staleWhileRevalidate(event.request) : networkFirst(event.request));
});

function isNavigationLikeRequest(request, requestUrl) {
  if (request.mode === "navigate") return true;
  if (request.headers.get("accept")?.includes("text/html")) return true;
  if (requestUrl.pathname.endsWith(".html")) return true;
  const lastSegment = requestUrl.pathname.split("/").pop() || "";
  return !lastSegment.includes(".");
}

async function networkFirst(request, options = {}) {
  try {
    const response = await fetch(request);
    if (response.ok && options.cacheResponse !== false) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (options.offlineFallback) {
      const fallback = await caches.match(OFFLINE_URL);
      if (fallback) return fallback;
    }
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || new Response("", { status: 503, statusText: "Offline" });
}
