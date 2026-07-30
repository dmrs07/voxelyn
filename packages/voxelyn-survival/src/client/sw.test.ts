/**
 * Testes do service worker (`public/sw.js`).
 *
 * O SW nao e importavel: e um script solto, carregado pelo navegador com globais
 * proprios. Aqui ele e avaliado com `new Function` recebendo dublês de `self`,
 * `caches`, `fetch` e afins — o que permite testar exatamente o arquivo que vai
 * para producao, sem duplicar a logica num modulo espelho que poderia divergir.
 *
 * O que estes testes protegem e a promessa do PWA: **o lancamento nunca depende
 * da rede**. Cada caso abaixo corresponde a um jeito real de o app "as vezes nao
 * abrir" no celular.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

const SW_SOURCE = readFileSync(
  fileURLToPath(new URL('../../public/sw.js', import.meta.url)),
  'utf8',
);

const ORIGIN = 'https://voxelyn.test';
const BASE = `${ORIGIN}/`;

type ResponseInit = { status?: number; type?: string; headers?: Record<string, string> };

class FakeResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly type: string;
  constructor(
    readonly body: string,
    init: ResponseInit = {},
  ) {
    this.status = init.status ?? 200;
    this.ok = this.status >= 200 && this.status < 300;
    this.type = init.type ?? 'basic';
  }
  clone(): FakeResponse {
    return new FakeResponse(this.body, { status: this.status, type: this.type });
  }
}

type RequestInit = { mode?: string; cache?: string };

class FakeRequest {
  readonly url: string;
  readonly method = 'GET';
  readonly mode: string;
  readonly cache: string;
  constructor(input: string | FakeRequest, init: RequestInit = {}) {
    const from = typeof input === 'string' ? null : input;
    this.url = from ? from.url : new URL(input as string, BASE).href;
    this.mode = init.mode ?? from?.mode ?? 'cors';
    this.cache = init.cache ?? from?.cache ?? 'default';
  }
}

const keyOf = (input: string | FakeRequest): string =>
  typeof input === 'string' ? new URL(input, BASE).href : input.url;

class FakeCache {
  readonly entries = new Map<string, FakeResponse>();
  constructor(private readonly harness: Harness) {}

  async put(req: string | FakeRequest, res: FakeResponse): Promise<void> {
    this.entries.set(keyOf(req), res);
  }

  async add(url: string | FakeRequest): Promise<void> {
    const req = url instanceof FakeRequest ? url : new FakeRequest(url);
    const res = await this.harness.fetch(req);
    if (!res.ok) throw new TypeError(`add falhou: ${req.url}`);
    this.entries.set(req.url, res);
  }

  /** Atomico como o real: nada entra se qualquer entrada falhar. */
  async addAll(urls: Array<string | FakeRequest>): Promise<void> {
    const reqs = urls.map((u) => (u instanceof FakeRequest ? u : new FakeRequest(u)));
    const fetched = await Promise.all(
      reqs.map(async (req) => {
        const res = await this.harness.fetch(req);
        if (!res.ok) throw new TypeError(`addAll falhou: ${req.url}`);
        return [req.url, res] as const;
      }),
    );
    for (const [url, res] of fetched) this.entries.set(url, res);
  }

  async match(
    req: string | FakeRequest,
    options: { ignoreSearch?: boolean } = {},
  ): Promise<FakeResponse | undefined> {
    const wanted = keyOf(req);
    const direct = this.entries.get(wanted);
    if (direct) return direct;
    if (!options.ignoreSearch) return undefined;
    const bare = wanted.split('?')[0];
    for (const [url, res] of this.entries) if (url.split('?')[0] === bare) return res;
    return undefined;
  }
}

type Handler = (event: unknown) => void;

class Harness {
  readonly caches = new Map<string, FakeCache>();
  readonly listeners = new Map<string, Handler>();
  /** Rotas servidas pela "rede". `null` = pendura para sempre (sinal ruim). */
  routes = new Map<string, FakeResponse | null>();
  readonly requested: FakeRequest[] = [];
  skipWaitingCalled = false;
  claimCalled = false;
  now = 0;

  fetch = async (input: string | FakeRequest): Promise<FakeResponse> => {
    const req = input instanceof FakeRequest ? input : new FakeRequest(input);
    this.requested.push(req);
    const route = this.routes.get(new URL(req.url).pathname);
    if (route === undefined) throw new TypeError('Failed to fetch');
    if (route === null) return new Promise<FakeResponse>(() => undefined); // pendurado
    return route;
  };

  cacheStorage = {
    open: async (name: string): Promise<FakeCache> => {
      const existing = this.caches.get(name);
      if (existing) return existing;
      const created = new FakeCache(this);
      this.caches.set(name, created);
      return created;
    },
    keys: async (): Promise<string[]> => [...this.caches.keys()],
    delete: async (name: string): Promise<boolean> => this.caches.delete(name),
    match: async (req: string | FakeRequest): Promise<FakeResponse | undefined> => {
      for (const cache of this.caches.values()) {
        const hit = await cache.match(req);
        if (hit) return hit;
      }
      return undefined;
    },
  };

  load(globals: Record<string, unknown> = {}): void {
    const self = {
      __VOXELYN_PRECACHE__: ['./assets/main-abc.js'],
      __VOXELYN_BUILD__: 'build1',
      ...globals,
      location: { origin: ORIGIN },
      addEventListener: (type: string, fn: Handler) => this.listeners.set(type, fn),
      skipWaiting: async () => {
        this.skipWaitingCalled = true;
      },
      clients: {
        claim: async () => {
          this.claimCalled = true;
        },
      },
    };
    const run = new Function(
      'self',
      'caches',
      'fetch',
      'Request',
      'Response',
      'URL',
      'setTimeout',
      'clearTimeout',
      SW_SOURCE,
    );
    run(
      self,
      this.cacheStorage,
      this.fetch,
      FakeRequest,
      FakeResponse,
      URL,
      setTimeout,
      clearTimeout,
    );
  }

  async install(): Promise<void> {
    await this.dispatch('install');
  }

  async activate(): Promise<void> {
    await this.dispatch('activate');
  }

  private async dispatch(type: string): Promise<void> {
    const handler = this.listeners.get(type);
    if (!handler) throw new Error(`sem listener de ${type}`);
    let waited: Promise<unknown> = Promise.resolve();
    handler({ waitUntil: (p: Promise<unknown>) => (waited = p) });
    await waited;
  }

  /** Dispara um fetch e devolve o que o SW respondeu (ou undefined se passou). */
  async navigate(path: string): Promise<FakeResponse | undefined> {
    return this.request(new FakeRequest(path, { mode: 'navigate' }));
  }

  async request(req: FakeRequest): Promise<FakeResponse | undefined> {
    const handler = this.listeners.get('fetch');
    if (!handler) throw new Error('sem listener de fetch');
    let answered: Promise<FakeResponse> | undefined;
    handler({ request: req, respondWith: (p: Promise<FakeResponse>) => (answered = p) });
    return answered ? await answered : undefined;
  }

  currentCache(): FakeCache {
    const cache = this.caches.get('voxelyn-survival-build1');
    if (!cache) throw new Error('cache do build atual nao existe');
    return cache;
  }
}

const shellRoutes = (html: string): Array<[string, FakeResponse]> => [
  ['/', new FakeResponse(html)],
  ['/index.html', new FakeResponse(html)],
  ['/assets/main-abc.js', new FakeResponse('bundle')],
  ['/manifest.webmanifest', new FakeResponse('{}')],
  ['/icon-192.png', new FakeResponse('png')],
  ['/icon-512.png', new FakeResponse('png')],
];

describe('service worker: install', () => {
  let sw: Harness;

  beforeEach(() => {
    sw = new Harness();
    sw.routes = new Map(shellRoutes('<html>v1</html>'));
  });

  it('precacheia shell e bundles no cache do build', async () => {
    sw.load();
    await sw.install();

    const cache = sw.currentCache();
    expect([...cache.entries.keys()].sort()).toEqual([
      `${BASE}`,
      `${BASE}assets/main-abc.js`,
      `${BASE}icon-192.png`,
      `${BASE}icon-512.png`,
      `${BASE}index.html`,
      `${BASE}manifest.webmanifest`,
    ]);
    expect(sw.skipWaitingCalled).toBe(true);
  });

  it('busca o HTML com cache: reload', async () => {
    sw.load();
    await sw.install();

    // Sem 'reload' o navegador pode entregar um index.html anterior do cache
    // HTTP, e o par index+bundles gravado aqui sairia inconsistente.
    const html = sw.requested.filter((r) => r.url === BASE || r.url === `${BASE}index.html`);
    expect(html).toHaveLength(2);
    expect(html.every((r) => r.cache === 'reload')).toBe(true);
  });

  it('falha o install inteiro quando um bundle obrigatorio nao baixa', async () => {
    sw.routes.delete('/assets/main-abc.js');
    sw.load();

    // Um worker com cache parcial e pior que nenhum: ele assume o controle e o
    // lancamento offline seguinte abre em branco.
    await expect(sw.install()).rejects.toThrow();
    expect(sw.currentCache().entries.size).toBe(0);
  });

  it('sobrevive a um icone ausente (opcional nao derruba o install)', async () => {
    sw.routes.delete('/icon-512.png');
    sw.load();
    await sw.install();

    expect(sw.currentCache().entries.has(`${BASE}index.html`)).toBe(true);
    expect(sw.currentCache().entries.has(`${BASE}icon-512.png`)).toBe(false);
  });
});

describe('service worker: activate', () => {
  it('descarta os caches dos builds anteriores', async () => {
    const sw = new Harness();
    sw.routes = new Map(shellRoutes('<html>v2</html>'));
    await sw.cacheStorage.open('voxelyn-survival-build0');
    sw.load();
    await sw.install();
    await sw.activate();

    expect([...sw.caches.keys()]).toEqual(['voxelyn-survival-build1']);
    expect(sw.claimCalled).toBe(true);
  });
});

describe('service worker: navegacao', () => {
  let sw: Harness;

  beforeEach(async () => {
    sw = new Harness();
    sw.routes = new Map(shellRoutes('<html>cacheado</html>'));
    sw.load();
    await sw.install();
  });

  it('serve a resposta da rede quando ela responde', async () => {
    sw.routes.set('/', new FakeResponse('<html>fresco</html>'));

    const res = await sw.navigate('/');

    expect(res?.body).toBe('<html>fresco</html>');
  });

  it('abre pelo cache quando a rede pendura', async () => {
    // Celular com sinal ruim nao devolve erro: o fetch fica pendurado. Sem teto
    // de tempo o launcher do PWA fica numa tela preta que o usuario le como
    // "nao abriu".
    sw.routes.set('/', null);

    const res = await Promise.race([
      sw.navigate('/'),
      new Promise((resolve) => setTimeout(() => resolve('travou'), 5000)),
    ]);

    expect((res as FakeResponse)?.body).toBe('<html>cacheado</html>');
  }, 10_000);

  it('abre pelo cache quando a rede falha', async () => {
    sw.routes.delete('/');

    expect((await sw.navigate('/'))?.body).toBe('<html>cacheado</html>');
  });

  it('abre pelo cache quando o host devolve erro', async () => {
    // Janela de deploy, portal captivo, 5xx: devolver a pagina de erro do
    // servidor apaga o jogo mesmo havendo um shell perfeito guardado.
    sw.routes.set('/', new FakeResponse('<html>502 Bad Gateway</html>', { status: 502 }));

    expect((await sw.navigate('/'))?.body).toBe('<html>cacheado</html>');
  });

  it('cai no shell mesmo quando a URL de lancamento tem query', async () => {
    sw.routes.delete('/');

    expect((await sw.navigate('/?room=ABCD'))?.body).toBe('<html>cacheado</html>');
  });

  it('nao regrava a raiz em runtime', async () => {
    // A gravacao viria do worker ANTIGO: colocaria o index NOVO ao lado dos
    // bundles VELHOS. Se o install do worker novo nao terminasse, o proximo
    // lancamento offline abriria um index apontando para arquivos ausentes.
    sw.routes.set('/', new FakeResponse('<html>build seguinte</html>'));
    await sw.navigate('/');

    expect((await sw.currentCache().match('./'))?.body).toBe('<html>cacheado</html>');
    expect((await sw.currentCache().match('./index.html'))?.body).toBe('<html>cacheado</html>');
  });

  it('cacheia sprites.html pela propria URL, sem tocar na raiz', async () => {
    sw.routes.set('/sprites.html', new FakeResponse('<html>visualizador</html>'));

    await sw.navigate('/sprites.html');

    expect((await sw.currentCache().match('./sprites.html'))?.body).toBe(
      '<html>visualizador</html>',
    );
    expect((await sw.currentCache().match('./'))?.body).toBe('<html>cacheado</html>');
  });

  it('devolve 503 legivel quando nao ha rede nem shell', async () => {
    const virgin = new Harness();
    virgin.routes = new Map();
    virgin.load();
    const res = await virgin.navigate('/');

    // Nunca `undefined`: respondWith(undefined) vira TypeError e o navegador
    // mostra a tela de erro de rede em vez de qualquer diagnostico.
    expect(res?.status).toBe(503);
  });
});

describe('service worker: assets', () => {
  let sw: Harness;

  beforeEach(async () => {
    sw = new Harness();
    sw.routes = new Map(shellRoutes('<html>shell</html>'));
    sw.load();
    await sw.install();
  });

  it('serve bundle do cache sem tocar na rede', async () => {
    sw.routes.delete('/assets/main-abc.js');

    const res = await sw.request(new FakeRequest('/assets/main-abc.js'));

    expect(res?.body).toBe('bundle');
  });

  it('ignora requisicoes cross-origin', async () => {
    const res = await sw.request(new FakeRequest('https://outra.test/x.js'));

    expect(res).toBeUndefined();
  });

  it('ignora requisicoes que nao sao GET', async () => {
    const post = new FakeRequest('/leaderboard');
    Object.defineProperty(post, 'method', { value: 'POST' });

    expect(await sw.request(post)).toBeUndefined();
  });
});
