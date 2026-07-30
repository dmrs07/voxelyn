import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { requestRateLimitKey } from '../src/http-util';
import {
  IMMEDIATE_RESTART_MS,
  MemoryTelemetry,
  digestOf,
  type TelemetryEvent,
} from '../src/telemetry';
import { sanitizeEvent } from '../src/telemetry-http';

const ev = (over: Partial<TelemetryEvent> = {}): TelemetryEvent => ({
  session: 's1',
  runIndex: 1,
  msSincePreviousRun: null,
  outcome: 'dead',
  sector: 1,
  ticks: 1000,
  stars: 0,
  contamination: 0.2,
  deathCause: 'fire',
  kills: 3,
  shots: 40,
  damageTakenTenths: 500,
  damageDealtTenths: 900,
  salvageCompleted: 1,
  modulesAcquired: 1,
  discoveries: 0,
  quality: 'high',
  ...over,
});

describe('a metrica principal: vontade de jogar de novo', () => {
  // O gate da Fase 1 da spec, virado numero. Se este calculo estiver errado, a
  // decisao mais importante do jogo passa a ser tomada sobre dado errado.
  it('conta reinicio rapido apenas entre runs da mesma sessao', () => {
    const d = digestOf([
      ev({ runIndex: 1, msSincePreviousRun: null }),
      ev({ runIndex: 2, msSincePreviousRun: 4_000 }), // voltou na hora
      ev({ runIndex: 3, msSincePreviousRun: 600_000 }), // foi fazer outra coisa
    ]);
    // A PRIMEIRA run nao pode contar: ela nao e um "voltou". Incluir todas
    // diluiria a metrica pelo numero de sessoes de uma run so.
    expect(d.immediateRestartRate).toBeCloseTo(0.5, 5);
  });

  it('usa a janela declarada como fronteira', () => {
    const dentro = digestOf([ev({ msSincePreviousRun: IMMEDIATE_RESTART_MS })]);
    const fora = digestOf([ev({ msSincePreviousRun: IMMEDIATE_RESTART_MS + 1 })]);
    expect(dentro.immediateRestartRate).toBe(1);
    expect(fora.immediateRestartRate).toBe(0);
  });

  it('nao divide por zero numa sessao de uma run so', () => {
    expect(digestOf([ev()]).immediateRestartRate).toBe(0);
    expect(digestOf([]).immediateRestartRate).toBe(0);
  });
});

describe('abandono nao e morte', () => {
  // Somar os dois num balde so e o erro que faz um jogo dificil parecer
  // saudavel enquanto sangra jogador.
  it('conta abandono em balde proprio', () => {
    const d = digestOf([
      ev({ outcome: 'dead' }),
      ev({ outcome: 'abandoned' }),
      ev({ outcome: 'dead' }),
    ]);
    expect(d.abandonRate).toBeCloseTo(1 / 3, 5);
    expect(d.medianTicks.dead).not.toBeNull();
    expect(d.medianTicks.abandoned).not.toBeNull();
  });
});

describe('funil de setor', () => {
  // Alcancar o setor 3 implica ter passado pelo 1 e pelo 2: o funil so faz
  // sentido acumulado, senao "chegou ao setor 3" apareceria menor que a
  // realidade em toda run que terminou fundo.
  it('e acumulado', () => {
    const d = digestOf([
      ev({ sector: 1 }),
      ev({ sector: 2 }),
      ev({ sector: 3 }),
      ev({ sector: 3 }),
    ]);
    expect(d.sectorReach[0]).toBe(1); // todas alcancaram o setor 1
    expect(d.sectorReach[1]).toBeCloseTo(0.75, 5);
    expect(d.sectorReach[2]).toBeCloseTo(0.5, 5);
  });
});

describe('histograma de estrelas', () => {
  // E o que calibra TARGET_SECTOR_TICKS sem chute.
  it('distribui por nota', () => {
    const d = digestOf([ev({ stars: 0 }), ev({ stars: 3 }), ev({ stars: 3 }), ev({ stars: 1 })]);
    expect(d.starHistogram).toEqual([1, 1, 0, 2]);
  });
});

describe('causas de morte', () => {
  it('ordena da mais comum para a menos', () => {
    const d = digestOf([
      ev({ deathCause: 'fire' }),
      ev({ deathCause: 'gas' }),
      ev({ deathCause: 'fire' }),
      ev({ deathCause: null, outcome: 'extracted' }),
    ]);
    expect(d.deathCauses[0]).toEqual({ cause: 'fire', count: 2 });
    expect(d.deathCauses).toHaveLength(2);
  });
});

describe('saneamento de entrada nao confiavel', () => {
  // Clampar em vez de recusar: recusar por um campo estranho perderia o resto
  // do evento, que era o que importava. E a diferenca entre dado levemente
  // sujo e um buraco no histograma.
  it('clampa numeros absurdos em vez de descartar o evento', () => {
    const e = sanitizeEvent(
      { session: 'abcd', runIndex: 1e9, ticks: 1e12, stars: 99, sector: -5, contamination: 12 },
      'high',
    );
    expect(e).not.toBeNull();
    expect(e!.stars).toBe(3);
    expect(e!.sector).toBe(1);
    expect(e!.contamination).toBe(1);
    expect(e!.ticks).toBeLessThanOrEqual(60 * 60 * 20);
  });

  it('recusa apenas o que nao significa nada', () => {
    expect(sanitizeEvent(null, null)).toBeNull();
    expect(sanitizeEvent({}, null)).toBeNull();
    expect(sanitizeEvent({ session: 'ab' }, null)).toBeNull(); // sessao curta demais
  });

  it('desconhecido vira abandono, e nao um desfecho inventado', () => {
    expect(sanitizeEvent({ session: 'abcd', outcome: 'vitoria_total' }, null)!.outcome).toBe(
      'abandoned',
    );
  });

  it('corta strings longas', () => {
    const e = sanitizeEvent(
      { session: 'x'.repeat(500), deathCause: 'y'.repeat(500) },
      'z'.repeat(50),
    )!;
    expect(e.session.length).toBeLessThanOrEqual(40);
    expect(e.deathCause!.length).toBeLessThanOrEqual(32);
    expect(e.quality!.length).toBeLessThanOrEqual(12);
  });

  it('nao carrega nada alem dos campos declarados', () => {
    const e = sanitizeEvent({ session: 'abcd', ip: '1.2.3.4', email: 'a@b.c' }, null)!;
    expect(Object.keys(e)).not.toContain('ip');
    expect(Object.keys(e)).not.toContain('email');
  });
});

describe('store de memoria', () => {
  it('grava e agrega', async () => {
    const store = new MemoryTelemetry();
    await store.record(ev({ stars: 3 }));
    await store.record(ev({ stars: 1, msSincePreviousRun: 1000 }));
    const d = await store.digest(100);
    expect(d.runs).toBe(2);
    expect(d.sessions).toBe(1);
    expect(d.immediateRestartRate).toBe(1);
  });

  it('respeita o teto sem crescer sem limite', async () => {
    const store = new MemoryTelemetry(10);
    for (let i = 0; i < 50; i++) await store.record(ev({ ticks: i }));
    expect((await store.digest(1000)).runs).toBe(10);
  });
});

describe('limite por origem', () => {
  // A telemetria tinha o MESMO bug que a revisao corrigiu no ranking: ler o
  // primeiro elemento de X-Forwarded-For da ao cliente um limite novo a cada
  // requisicao, porque ele pode prepender valores a vontade. A correcao mora
  // num lugar so, e este teste garante que a telemetria realmente a usa.
  it('nao confia em X-Forwarded-For prependado pelo cliente', () => {
    const req = (xff: string) =>
      ({
        headers: { 'x-forwarded-for': xff },
        socket: { remoteAddress: '10.0.0.9' },
      }) as unknown as IncomingMessage;

    // Com um salto confiavel, a origem e o ULTIMO da lista (o proxy), e nao o
    // primeiro (que o cliente escolheu).
    expect(requestRateLimitKey(req('203.0.113.1, 198.51.100.77'), 1)).toBe('198.51.100.77');
    expect(requestRateLimitKey(req('203.0.113.99, 198.51.100.77'), 1)).toBe('198.51.100.77');
    // Sem proxy declarado, o cabecalho e ignorado por inteiro.
    expect(requestRateLimitKey(req('203.0.113.1, 198.51.100.77'), 0)).toBe('10.0.0.9');
  });
});
