// Service worker do Voxelyn Survival.
// Estrategia: app shell em cache para a experiencia SOLO offline. As chamadas
// de rede (WebSocket) nao passam pelo SW; o online exige conexao, o solo nao.
const CACHE = 'voxelyn-survival-v1';

// Lista de precache injetada no build (vite.config.ts -> precacheManifest()).
// PRECISA conter os bundles com hash e os atlases de sprite: o SW so e
// registrado no window.load, ou seja, DEPOIS de o navegador ja ter buscado
// esses arquivos. Como o worker recem-ativado nunca ve aqueles fetches, sem
// precache o shell fica em cache sem o JS do jogo e o solo offline — que e a
// promessa do PWA — falha ate o usuario carregar a pagina online outra vez.
// Em dev (sem build) a lista fica vazia e o shell abaixo basta.
const BUILD_ASSETS = self.__VOXELYN_PRECACHE__ ?? [];
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', ...BUILD_ASSETS];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // addAll e atomico: um 404 em qualquer entrada aborta o install inteiro e
      // o SW nunca ativa. Cacheia uma a uma para nao perder o resto por causa
      // de um arquivo ausente.
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => undefined))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // nunca intercepta cross-origin

  // network-first para navegacao (pega updates), cache como fallback offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./').then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // cache-first para assets do shell (offline solo)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
