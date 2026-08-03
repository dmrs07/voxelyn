// A camada de API nao decide nada — mas ela decide QUANDO desistir e quando
// tentar de novo, e essas duas sao regras de produto disfarcadas de encanamento.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TIMEOUT_INTERACTIVE_MS,
  TIMEOUT_SETTLE_MS,
  TIMEOUT_WAKE_MS,
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
// O despertar da origem
// ---------------------------------------------------------------------------
// Seis segundos e o teto certo para uma chamada interativa e o teto errado para
// acordar um processo hibernado, que e o comportamento padrao de quase todo
// PaaS. Com uma tentativa so, um servidor no ar era lido como um servidor fora.

describe('primeiro contato com uma origem fria', () => {
  it('tenta de novo, com teto maior, quando nao veio resposta nenhuma', async () => {
    let attempt = 0;
    const calls = stubFetch(() => {
      attempt += 1;
      if (attempt === 1) throw new DOMException('aborted', 'TimeoutError');
      return json(200, { profile: PROFILE });
    });

    const result = await fetchProfile('https://fria.example');
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(TIMEOUT_WAKE_MS).toBeGreaterThan(TIMEOUT_INTERACTIVE_MS * 3);
  });

  it('nao repete quando o servidor RESPONDEU e recusou', async () => {
    // Um 429 prova que ha alguem acordado do outro lado. Insistir so gastaria o
    // teto do limitador — e a segunda tentativa seria recusada igual.
    const calls = stubFetch(() => json(429, { error: 'rate_limited' }));
    const result = await fetchProfile('https://ocupada.example');
    expect(result).toMatchObject({ ok: false, error: 'rate_limited', status: 429 });
    expect(calls).toHaveLength(1);
  });

  // A regressao que a primeira versao desta mudanca introduziu, e que era PIOR
  // que o problema original: marcando so o sucesso, uma origem genuinamente
  // morta nunca entrava no conjunto, entao toda chamada pagava 6s + 25s. Como
  // `authorizeExpedition` espera o ticket antes de comecar a run, cada descida
  // offline travaria por meio minuto — no lugar exato que a mudanca protegia.
  it('desiste de vez: origem morta nao paga a espera longa duas vezes', async () => {
    const dead = stubFetch(() => {
      throw new TypeError('network');
    });
    const first = await fetchProfile('https://morta.example');
    expect(first).toMatchObject({ ok: false, error: 'offline' });
    expect(dead).toHaveLength(2); // a curta e a longa

    const again = stubFetch(() => {
      throw new TypeError('network');
    });
    const second = await fetchProfile('https://morta.example');
    expect(second).toMatchObject({ ok: false, error: 'offline' });
    expect(again).toHaveLength(1); // so a curta: a tentativa longa ja foi gasta
  });

  it('a espera longa e paga UMA vez por origem, e nao a cada chamada', async () => {
    // A primeira chamada descobre que ha alguem ali. A partir dai a origem esta
    // quente, e uma queda posterior e uma queda — nao um servidor hibernando.
    const warm = stubFetch(() => json(200, { profile: PROFILE }));
    await fetchProfile('https://quente.example');
    expect(warm).toHaveLength(1);

    const later = stubFetch(() => {
      throw new TypeError('network');
    });
    const result = await fetchProfile('https://quente.example');
    expect(result).toMatchObject({ ok: false, error: 'offline' });
    expect(later).toHaveLength(1);
  });
});
