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

// OBRIGATORIOS: sem qualquer um destes o solo offline nao inicia. Se um deles
// falhar, o install TEM de falhar — engolir a falha ativaria um worker com
// cache parcial, e o index em cache apontaria para um bundle que nao existe.
// Falhando, o worker anterior (com cache completo) continua no ar.
const REQUIRED = ['./', './index.html', ...BUILD_ASSETS];
// OPCIONAIS: cosmeticos/metadados. Um icone ausente nao pode derrubar o install.
const OPTIONAL = ['./manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (c) => {
        // addAll e atomico e rejeita se qualquer entrada falhar: e exatamente o
        // que queremos para os obrigatorios.
        await c.addAll(REQUIRED);
        await Promise.all(OPTIONAL.map((u) => c.add(u).catch(() => undefined)));
      })
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
    // A raiz e o shell do JOGO. Guardar toda navegacao sob './' faria uma visita
    // a sprites.html (o visualizador interno) substituir esse shell, e o proximo
    // lancamento offline abriria o visualizador em vez do jogo. Cada navegacao
    // e cacheada pela propria URL; './' so e atualizado pela propria raiz.
    const isRoot = url.pathname === '/' || url.pathname.endsWith('/index.html');
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const byUrl = res.clone();
            caches.open(CACHE).then((c) => c.put(req, byUrl));
            if (isRoot) {
              const asRoot = res.clone();
              caches.open(CACHE).then((c) => c.put('./', asRoot));
            }
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((r) => r || (isRoot ? caches.match('./').then((x) => x || caches.match('./index.html')) : undefined))
        )
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
