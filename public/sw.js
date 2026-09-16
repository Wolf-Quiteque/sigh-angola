/*
 * Cache da aplicação para abertura sem rede.
 *
 * Guarda os pedidos de navegação e os ficheiros estáticos que a aplicação já
 * carregou e, quando não há rede, serve a última versão guardada. Só serve
 * para a aplicação abrir: os dados continuam no armazenamento local do
 * navegador e nada é enviado para fora do dispositivo.
 */
const CACHE = 'sigh-angola-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/')));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // Rede primeiro, para a navegação mostrar sempre a versão mais recente.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match('/')) ?? Response.error()),
    );
    return;
  }
  // Recursos estáticos: cache primeiro, para abrir depressa e sem rede.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
