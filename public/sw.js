// Service worker Magerrr (BUILD_PLAN Fase 8): cache shell + halaman terakhir, halaman offline.
// Tulis data (API) selalu lewat jaringan; tidak ada antrian tulis offline (P1).
const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const OFFLINE_URL = "/offline";
const MAX_PAGES = 30;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE_URL, "/manifest.webmanifest", "/icon.svg", "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL, PAGES, ASSETS]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

/** Halaman: jaringan dulu (data selalu terbaru), simpan salinan; offline → salinan terakhir atau /offline. */
async function page(event) {
  const { request } = event;
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic" && !response.redirected) {
      const copy = response.clone();
      event.waitUntil(caches.open(PAGES).then((cache) => cache.put(request, copy)).then(() => trim(PAGES, MAX_PAGES)));
    }
    return response;
  } catch {
    return (await caches.match(request, { cacheName: PAGES })) ?? (await caches.match(OFFLINE_URL, { cacheName: SHELL }));
  }
}

/** Aset build Next (nama berisi hash, tidak berubah): cache dulu. */
async function asset(event) {
  const { request } = event;
  const cached = await caches.match(request, { cacheName: ASSETS });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    event.waitUntil(caches.open(ASSETS).then((cache) => cache.put(request, copy)));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API, auth, gambar QRIS/kartu, dan payload RSC selalu langsung ke jaringan.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.pathname.includes("/qris/") || url.pathname.includes("/kartu/")) return;
  if (request.mode === "navigate") return event.respondWith(page(event));
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) return event.respondWith(asset(event));
});
