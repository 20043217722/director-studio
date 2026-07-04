// Service Worker v5 — network-first, cache-busted per deploy
const CACHE = "director-studio-v5-1783144214069";
const BASE = "/director-studio/";

self.addEventListener("install", (e) => {
  self.skipWaiting();
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
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      ),
    ])
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  if (e.request.destination === "document" || url.pathname.endsWith(".html") || url.pathname === BASE) {
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res.ok && res.headers.get("content-type")?.includes("text/html")) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        return caches.match(BASE + "index.html").then((r) => r || caches.match(BASE));
      })
    );
    return;
  }

  // Static assets: NETWORK-first, cache fallback (prevents stale 404 poisoning)
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (!res || !res.ok) throw new Error("bad response");
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => {
        return caches.match(e.request);
      })
  );
});
