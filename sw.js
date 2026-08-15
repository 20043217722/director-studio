// Service Worker v4 — SPA-aware caching for GitHub Pages
const CACHE = "director-studio-v5";
const BASE = "/director-studio/";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  // Pre-cache the root and index.html on install
  e.waitUntil(
    caches.open(CACHE).then((c) => {
      return Promise.allSettled([
        c.add(BASE),
        c.add(BASE + "index.html"),
        c.add(BASE + "manifest.json"),
      ]);
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Nuke all old caches
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      ),
    ])
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // HTML / document requests: network-first, fall back to cached index.html on failure or 404
  if (e.request.destination === "document" || url.pathname.endsWith(".html") || url.pathname === BASE) {
    e.respondWith(
      fetch(e.request).then((res) => {
        // Only cache successful HTML responses
        if (res.ok && res.headers.get("content-type")?.includes("text/html")) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Network error — serve cached index.html
        return caches.match(BASE + "index.html").then((r) => r || caches.match(BASE));
      })
    );
    return;
  }

  // Static assets: cache-first, network fallback
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

