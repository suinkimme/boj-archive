const CACHE = 'boj-runners-v2';
const CACHED_ORIGINS = [
  'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/',
  'https://esm.sh/',
];

// 설치 즉시 활성화 (대기 단계 생략)
self.addEventListener("install", () => self.skipWaiting());

// 구버전 캐시 삭제 후 모든 탭에 즉시 적용
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

// Pyodide · esm.sh CDN 요청만 가로채 캐시에 저장 — 최초 로딩 후 재다운로드 방지
self.addEventListener('fetch', e => {
  if (!CACHED_ORIGINS.some(o => e.request.url.startsWith(o))) return;
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
