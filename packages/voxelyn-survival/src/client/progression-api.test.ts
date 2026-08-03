// A camada de API nao decide nada — mas ela decide QUANDO desistir e quando
// tentar de novo, e essas duas sao regras de produto disfarcadas de encanamento.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TIMEOUT_INTERACTIVE_MS,
  TIMEOUT_SETTLE_MS,
  fetchProfile,
  openSession,
  purchaseKey,
  readSessionToken,
  requestRunTicketWithSession,
} from './progression-api';

type Call = { url: string; init: RequestInit };

/** Substitui o `fetch` global por uma fila de respostas roteadas por caminho. */
const stubFetch = (handler: (call: Call) => Response | Promise<Response>) => {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return Promise.resolve(handler({ url: String(url), init }));
  });
  return calls;
};

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const TICKET = { runId: 'r1', seed: 7, tuning: { maxHp: 100 } };
const PROFILE = {
  profileId: 'p1',
  profileVersion: 1,
  generation: 'G-00',
  wallet: { ore: 0, cores: 0 },
};

afterEach(() => vi.unstubAllGlobals());

describe('sessao antes do primeiro ticket', () => {
  // O caminho de quem instala o jogo e aperta "Descer" sem nunca abrir a Matriz.
  // Antes disso ele levava 401, caia em simulacao local em silencio, e perdia a
  // progressao da PRIMEIRA run — justamente aquela em que se decide se o loop
  // vale a pena.
  it('abre a sessao e repete o pedido quando o ticket volta 401', async () => {
    let ticketAttempts = 0;
    const calls = stubFetch(({ url }) => {
      if (url.includes('/session')) return json(201, { profile: PROFILE });
      ticketAttempts += 1;
      return ticketAttempts === 1
        ? json(401, { error: 'unauthenticated' })
        : json(201, { ticket: TICKET });
    });

    const result = await requestRunTicketWithSession('http://s', 7);
    expect(result.ticket.ok).toBe(true);
    if (result.ticket.ok) expect(result.ticket.value.ticket.runId).toBe('r1');
    // O perfil da sessao nova volta junto: quem chama precisa dele para o cache
    // e para o chassi, e uma segunda ida a rede so para rele-lo seria desperdicio.
    expect(result.openedProfile?.profileId).toBe('p1');
    expect(calls.map((c) => c.url.replace('http://s', ''))).toEqual([
      '/api/progression/runs',
      '/api/progression/session',
      '/api/progression/runs',
    ]);
  });

  it('nao abre sessao quando o primeiro pedido ja funciona', async () => {
    const calls = stubFetch(() => json(201, { ticket: TICKET }));
    const result = await requestRunTicketWithSession('http://s', 7);
    expect(result.ticket.ok).toBe(true);
    expect(result.openedProfile).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('nao abre sessao para um erro que nao e de autenticacao', async () => {
    const calls = stubFetch(() => json(422, { error: 'mode_not_eligible' }));
    const result = await requestRunTicketWithSession('http://s', 7);
    expect(result.ticket.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });

  // Um segundo 401 depois de a sessao ter sido criada nao e problema de sessao.
  it('tenta UMA vez: um segundo 401 nao vira laco', async () => {
    const calls = stubFetch(({ url }) =>
      url.includes('/session')
        ? json(201, { profile: PROFILE })
        : json(401, { error: 'unauthenticated' }),
    );
    const result = await requestRunTicketWithSession('http://s', 7);
    expect(result.ticket.ok).toBe(false);
    expect(calls.filter((c) => c.url.includes('/runs'))).toHaveLength(2);
  });

  it('sem servidor, devolve offline sem tentar abrir sessao', async () => {
    const calls = stubFetch(() => {
      throw new TypeError('network');
    });
    const result = await requestRunTicketWithSession('http://s', 7);
    expect(result.ticket).toMatchObject({ ok: false, error: 'offline' });
    expect(calls).toHaveLength(1);
  });
});

describe('teto de espera', () => {
  // Uma conexao ENGOLIDA nao rejeita: ela pendura. Sem teto, apertar "Descer"
  // congelava o jogo ate o timeout do sistema operacional.
  it('toda chamada leva um sinal de aborto', async () => {
    const calls = stubFetch(() => json(201, { ticket: TICKET }));
    await requestRunTicketWithSession('http://s', 7);
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it('a liquidacao espera muito mais que uma chamada interativa', () => {
    // Do outro lado ha uma re-simulacao de ate trinta minutos de jogo: abortar
    // cedo desistiria de uma carga ja conquistada.
    expect(TIMEOUT_SETTLE_MS).toBeGreaterThan(TIMEOUT_INTERACTIVE_MS * 5);
    expect(TIMEOUT_INTERACTIVE_MS).toBeLessThanOrEqual(10_000);
  });
});

describe('chave de idempotencia da compra', () => {
  it('e estavel para a mesma compra e muda quando a versao muda', () => {
    expect(purchaseKey('perfil-abc', 'CA-01', 3)).toBe(purchaseKey('perfil-abc', 'CA-01', 3));
    expect(purchaseKey('perfil-abc', 'CA-01', 4)).not.toBe(purchaseKey('perfil-abc', 'CA-01', 3));
  });

  it('sobrevive a um profileId com caracteres fora da allowlist', () => {
    expect(purchaseKey('a+b/c=d+e/f=g', 'CA-01', 1)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

// ---------------------------------------------------------------------------
// Escopo do token por origem
// ---------------------------------------------------------------------------
// O cookie tinha isto DE GRACA: o navegador nunca manda o cookie de um site para
// outro. Ao trocar para um token em header, a garantia sumiu e virou trabalho
// deste arquivo — e a primeira versao nao o fez.

describe('o token nunca sai da origem que o emitiu', () => {
  const memoryStorage = (): Storage => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      get length() {
        return map.size;
      },
    } as Storage;
  };

  // O ataque: um link com `?server=` apontando para um servidor hostil. Antes,
  // a primeira chamada anexava o token de PRODUCAO — e quem o recebesse poderia
  // repeti-lo contra a API real e assumir o perfil do jogador.
  it('nao anexa a um servidor o token emitido por outro', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    stubFetch(() => json(201, { profile: PROFILE, token: 'token-de-producao' }));
    await openSession('https://api-real.example');
    expect(readSessionToken('https://api-real.example')).toBe('token-de-producao');

    const calls = stubFetch(() => json(201, { ticket: TICKET }));
    await requestRunTicketWithSession('https://servidor-hostil.example', 1);
    const sent = new Headers(calls[0].init.headers);
    expect(sent.get('authorization')).toBeNull();
  });

  it('cada servidor guarda o proprio token', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    stubFetch(() => json(201, { profile: PROFILE, token: 'token-A' }));
    await openSession('https://a.example');
    stubFetch(() => json(201, { profile: PROFILE, token: 'token-B' }));
    await openSession('https://b.example');

    // Alternar entre dois servidores confiaveis nao pode orfanar o primeiro
    // perfil — que era o caso benigno do mesmo bug.
    expect(readSessionToken('https://a.example')).toBe('token-A');
    expect(readSessionToken('https://b.example')).toBe('token-B');
  });

  it('a origem ignora caminho e barra final, e ws vira http', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    stubFetch(() => json(201, { profile: PROFILE, token: 'token-A' }));
    await openSession('https://a.example');
    expect(readSessionToken('https://a.example/')).toBe('token-A');
    expect(readSessionToken('wss://a.example')).toBe('token-A');
    // Porta diferente e OUTRA origem: a regra e a do navegador, nao "parece o mesmo".
    expect(readSessionToken('https://a.example:8443')).toBeNull();
  });

  it('URL invalida nao guarda nem devolve token', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(readSessionToken('nao é uma url')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Um erro nosso nao pode se disfarcar de rede
// ---------------------------------------------------------------------------
// Este teste nasce de um bug que chegou a producao. Uma renomeacao trocou a URL
// por `undefined`, `httpBase(undefined)` lancou dentro do `try` que trata rede
// ausente, e a Matriz passou dias anunciando "conexao indisponivel" contra um
// servidor que respondia normalmente. O sintoma era perfeito; o diagnostico,
// impossivel sem DevTools.

describe('URL de servidor impossivel', () => {
  it('nao vira offline: tem codigo proprio e nem chega a tocar na rede', async () => {
    const calls = stubFetch(() => json(200, {}));
    // O caso real: a variavel existia, o valor nao.
    const result = await fetchProfile(undefined as unknown as string);
    expect(result).toEqual({ ok: false, error: 'bad_server_url' });
    expect(calls).toHaveLength(0);
  });

  it('vale para qualquer coisa que nao seja uma origem', async () => {
    const calls = stubFetch(() => json(200, {}));
    for (const bad of ['', '   ', 'nao é uma url']) {
      expect((await fetchProfile(bad)).ok).toBe(false);
    }
    expect(calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Esquema que o `fetch` nao atende tambem e endereco invalido
// ---------------------------------------------------------------------------
// Parseavel nao e utilizavel. `new URL` aceita `ftp://` e `file://` sem
// reclamar — o primeiro devolve uma origem truthy e o segundo devolve a STRING
// "null" —, e os dois furavam a checagem para morrer no `fetch` como `offline`.

describe('esquemas que o navegador nao busca', () => {
  it.each(['ftp://host', 'file:///tmp/x', 'javascript:alert(1)', 'data:text/plain,x'])(
    '%s e endereco invalido, e nao queda de rede',
    async (bad) => {
      const calls = stubFetch(() => json(200, {}));
      expect(await fetchProfile(bad)).toEqual({ ok: false, error: 'bad_server_url' });
      expect(calls).toHaveLength(0);
    },
  );

  // O `url.origin` descarta a credencial em silencio, entao a URL "parece" boa
  // depois de normalizada. O `fetch` nao concorda: ele recusa a URL antes de
  // mandar pacote nenhum, e a recusa voltava como `offline`.
  it.each([
    'https://user:senha@example.com',
    'https://user@example.com',
    'wss://user:senha@example.com',
  ])('%s traz credencial embutida e nao chega ao fetch', async (bad) => {
    const calls = stubFetch(() => json(200, {}));
    expect(await fetchProfile(bad)).toEqual({ ok: false, error: 'bad_server_url' });
    expect(calls).toHaveLength(0);
  });

  it('http, https, ws e wss continuam passando', async () => {
    for (const good of ['http://a.example', 'https://a.example', 'wss://a.example']) {
      const calls = stubFetch(() => json(200, { profile: PROFILE }));
      expect((await fetchProfile(good)).ok).toBe(true);
      expect(calls).toHaveLength(1);
    }
  });
});
