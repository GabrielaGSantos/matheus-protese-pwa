const CACHE_NAME = 'matheus-protese-v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Ignora requisições que não sejam GET (como POST para API)
  if (e.request.method !== 'GET') return;
  // Ignora chamadas para a API externa (supabase, etc) para não poluir o cache
  if (e.request.url.includes('supabase') || e.request.url.includes('api.php') || e.request.url.includes('/gapi')) return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Se a requisição for bem sucedida, atualiza o cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Se falhar (offline), busca no cache
        return caches.match(e.request);
      })
  );
});
