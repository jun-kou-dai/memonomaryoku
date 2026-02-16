const CACHE_NAME = 'buki-memo-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: オンラインなら最新を取得、失敗したらキャッシュを返す
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // APIリクエストはキャッシュしない
  if (event.request.url.includes('api.anthropic.com')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 成功したレスポンスをキャッシュに保存
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => {
        // オフライン時はキャッシュから返す
        return caches.match(event.request);
      })
  );
});
