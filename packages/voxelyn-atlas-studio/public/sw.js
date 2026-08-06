// Service worker do Voxelyn Atlas Studio.
// Estrategia identica ao cliente Survival: app shell em precache para o editor
// funcionar 100% offline (os projetos vivem no IndexedDB do aparelho).

// Injetados no build (vite.config.ts -> precacheManifest()).
const BUILD = self.__ATLAS_STUDIO_BUILD__ ?? 'dev';
const CACHE = `voxelyn-atlas-studio-${BUILD}`;
const BUILD_ASSETS = self.__ATLAS_STUDIO_PRECACHE__ ?? [];

// Teto de espera pela rede numa navegacao: sinal ruim pendura o fetch por
// dezenas de segundos e o launcher do PWA fica numa tela preta. O shell em
// cache e do mesmo build que a rede entregaria.
const NAV_TIMEOUT_MS = 3000;

// OBRIGATORIOS: sem qualquer um destes o editor offline nao abre.
const SHELL = ['./', './index.html'];
// OPCIONAIS: um icone ausente nao pode derrubar o install.
const OPTIONAL = ['./manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll([
        ...SHELL.map((url) => new Request(url, { cache: 'reload' })),
        ...BUILD_ASSETS,
      ]);
      await Promise.all(OPTIONAL.map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('voxelyn-atlas-studio-') && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Resolve com `null` (em vez de pendurar) quando a rede passa de `ms`. */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Navegacao: rede primeiro (com teto), cache como rede de seguranca. */
async function handleNavigate(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await withTimeout(fetch(request), NAV_TIMEOUT_MS);
    if (response && response.ok) return response;
  } catch {
    /* rede indisponivel: o cache abaixo resolve */
  }
  return (
    (await cache.match(request)) ??
    (await cache.match(request, { ignoreSearch: true })) ??
    (await cache.match('./index.html')) ??
    (await cache.match('./')) ??
    new Response('Offline e sem app shell em cache.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  );
}

/** Assets do shell: cache primeiro, rede so no que faltar. */
async function handleAsset(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const copy = response.clone();
    void cache.put(request, copy).catch(() => undefined);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(request.mode === 'navigate' ? handleNavigate(request) : handleAsset(request));
});
