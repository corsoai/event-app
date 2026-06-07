const CACHE_NAME = "corso-estate-v9-resident-overlay";
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
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin === self.location.origin && requestUrl.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (requestUrl.pathname.startsWith("/_next/static/")) {
    event.respondWith(networkFirst(event.request));
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

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("", { status: 503, statusText: "Offline" });
  }
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
