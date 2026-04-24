const CACHE = "boj-runners-v2";
const CACHED_ORIGINS = [
  "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/",
  "https://esm.sh/",
];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (!CACHED_ORIGINS.some((o) => e.request.url.startsWith(o))) return;
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((hit) => {
        if (hit) return hit;
        return fetch(e.request).then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        });
      }),
    ),
  );
});
