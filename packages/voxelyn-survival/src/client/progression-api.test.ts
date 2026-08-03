// A camada de API nao decide nada — mas ela decide QUANDO desistir e quando
// tentar de novo, e essas duas sao regras de produto disfarcadas de encanamento.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TIMEOUT_INTERACTIVE_MS,
  TIMEOUT_SETTLE_MS,
  purchaseKey,
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
