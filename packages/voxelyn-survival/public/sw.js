// Service worker do Voxelyn Survival.
// Estrategia: app shell em cache para a experiencia SOLO offline. As chamadas
// de rede (WebSocket) nao passam pelo SW; o online exige conexao, o solo nao.

// Injetados no build (vite.config.ts -> precacheManifest()).
// BUILD muda a cada bundle: e o que garante que um deploy novo instale um SW
// novo mesmo quando so o index.html mudou.
const BUILD = self.__VOXELYN_BUILD__ ?? 'dev';
const CACHE = `voxelyn-survival-${BUILD}`;

// Lista de precache injetada no build.
// PRECISA conter os bundles com hash e os atlases de sprite: o SW so e
// registrado no window.load, ou seja, DEPOIS de o navegador ja ter buscado
// esses arquivos. Como o worker recem-ativado nunca ve aqueles fetches, sem
// precache o shell fica em cache sem o JS do jogo e o solo offline — que e a
// promessa do PWA — falha ate o usuario carregar a pagina online outra vez.
// Em dev (sem build) a lista fica vazia e o shell abaixo basta.
const BUILD_ASSETS = self.__VOXELYN_PRECACHE__ ?? [];

// Teto de espera pela rede numa navegacao. Um celular com sinal ruim nao
// devolve erro: ele PENDURA o fetch por dezenas de segundos, e o launcher do
// PWA fica numa tela preta que o usuario le como "nao abriu". O shell em cache
// e do mesmo build que a rede entregaria, entao esperar mais nao compra nada.
const NAV_TIMEOUT_MS = 3000;

// OBRIGATORIOS: sem qualquer um destes o solo offline nao inicia.
// O shell HTML e buscado com 'reload' porque o cache HTTP do navegador pode
// devolver um index.html anterior, e gravar ESSE index junto dos bundles NOVOS
// deixa o cache internamente inconsistente — o proximo lancamento offline pede
// um arquivo com hash que nunca foi armazenado e abre em branco.
const SHELL = ['./', './index.html'];
// OPCIONAIS: cosmeticos/metadados. Um icone ausente nao pode derrubar o install.
// A trilha composta entra aqui pelo mesmo criterio: sem ela o solo offline
// toca o backup procedural (que vive no bundle) — musica ausente nao pode
// custar o install do PWA. E como e um arquivo de public/ (nao passa pelo
// rollup), a lista injetada do precache nunca o veria.
const OPTIONAL = [
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './audio/voxelyn-survival-theme.flac',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // addAll e atomico e rejeita se qualquer entrada falhar: e exatamente o
      // que queremos para os obrigatorios. Se um deles falhar, o install TEM de
      // falhar — engolir a falha ativaria um worker com cache parcial. Falhando,
      // o worker anterior (com cache completo) continua no ar.
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
      // Um cache por build. Sem isso os bundles de todo deploy anterior ficam
      // para sempre no aparelho, e o navegador acaba despejando a ORIGEM inteira
      // por pressao de quota — o PWA volta a depender da rede sem nenhum aviso.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('voxelyn-survival-') && key !== CACHE)
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

/**
 * Navegacao: rede primeiro (com teto de tempo), cache como rede de seguranca.
 *
 * O shell da RAIZ nunca e regravado em runtime. Quem grava e so o install, que
 * grava index e bundles de uma vez — esse par e sempre coerente. Uma gravacao em
 * runtime viria do worker ANTIGO (o novo ainda esta instalando) e colocaria o
 * index NOVO ao lado dos bundles VELHOS; se o install seguinte nao terminasse —
 * usuario fecha o app, sinal cai — o proximo lancamento offline abriria um index
 * apontando para arquivos que nao estao no cache. E a origem mais provavel de um
 * PWA que abre umas vezes e outras nao.
 */
async function handleNavigate(request) {
  const cache = await caches.open(CACHE);
  const url = new URL(request.url);
  const isRoot = url.pathname === '/' || url.pathname.endsWith('/index.html');

  try {
    const response = await withTimeout(fetch(request), NAV_TIMEOUT_MS);
    // `!ok` tambem cai para o cache: durante um deploy, atras de um portal
    // captivo ou num 5xx do host, devolver a pagina de erro do servidor apaga a
    // tela do jogo mesmo havendo um shell perfeito guardado aqui.
    if (response && response.ok) {
      // sprites.html (o visualizador interno) e cacheado pela propria URL, nunca
      // por cima da raiz: se compartilhassem chave, uma visita ao visualizador
      // faria o lancamento offline seguinte abrir ele no lugar do jogo.
      if (!isRoot) {
        const copy = response.clone();
        void cache.put(request, copy).catch(() => undefined);
      }
      return response;
    }
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

/** Assets do shell: cache primeiro (solo offline), rede so no que faltar. */
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
  if (new URL(request.url).origin !== self.location.origin) return; // nunca intercepta cross-origin

  event.respondWith(request.mode === 'navigate' ? handleNavigate(request) : handleAsset(request));
});
