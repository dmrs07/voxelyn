// A telemetria mede a SESSAO em volta da run, e nao a run.
//
// Os dois campos que ela existe para produzir — `runIndex` e `msSincePreviousRun`
// — sao justamente os que nenhum teste cobria, e os dois estavam errados: o
// intervalo era medido no fim (somando a duracao da propria run) e uma ida ao
// segundo plano contava como abandono, deixando a run viva para emitir um
// segundo evento terminal.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TelemetrySession } from '../client/telemetry';
import type { RunSummary } from '@voxelyn/survival-sim';

type SentEvent = {
  runIndex: number;
  msSincePreviousRun: number | null;
  outcome: string;
};

const summary = (): RunSummary =>
  ({
    phase: 'dead',
    ticks: 1200,
    stars: 2,
    contamination: 0.3,
    deathCause: { kind: 'fire' },
    stats: {
      kills: {},
      shotsFired: 10,
      damageTakenTenths: 40,
      damageDealtTenths: 90,
      salvageCompleted: 1,
      modulesAcquired: 1,
      discoveries: 2,
    },
  }) as unknown as RunSummary;

describe('TelemetrySession', () => {
  let sent: SentEvent[];

  beforeEach(() => {
    sent = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('fetch', (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body).event as SentEvent);
      return Promise.resolve({ ok: true });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const session = (): TelemetrySession =>
    new TelemetrySession(
      () => 'ws://localhost:8080',
      () => 'high',
    );

  // O intervalo tem de descrever a PAUSA entre runs, e nao a pausa mais a run.
  // Medido no fim, reiniciar em 4 s e jogar dois minutos registrava 124 s e
  // classificava o reinicio como nao-imediato — corrompendo exatamente a metrica
  // de vontade de jogar de novo.
  it('mede o intervalo ate o reinicio, sem somar a duracao da run', () => {
    const t = session();

    t.begin();
    vi.advanceTimersByTime(90_000); // primeira run: um minuto e meio
    t.finish(summary(), 2);

    vi.advanceTimersByTime(4_000); // o jogador reinicia em 4 segundos
    t.begin();
    vi.advanceTimersByTime(120_000); // e joga dois minutos
    t.finish(summary(), 3);

    expect(sent).toHaveLength(2);
    expect(sent[0]!.msSincePreviousRun).toBeNull(); // nao havia run anterior
    expect(sent[1]!.msSincePreviousRun).toBe(4_000);
  });

  it('avanca o indice de run a cada begin', () => {
    const t = session();
    t.begin();
    t.finish(summary(), 1);
    t.begin();
    t.finish(summary(), 1);

    expect(sent.map((e) => e.runIndex)).toEqual([1, 2]);
  });

  // A guarda antiga comparava com o objeto de sumario, entao um `abandon`
  // anterior nao a satisfazia: a MESMA run saia duas vezes, uma como abandonada
  // e outra como terminada, inflando contagem de runs e taxa de abandono juntas.
  it('emite UM evento terminal por run, mesmo abandonando antes de terminar', () => {
    const t = session();
    t.begin();
    t.abandon(2, 900, 0.4);
    t.finish(summary(), 2);

    expect(sent).toHaveLength(1);
    expect(sent[0]!.outcome).toBe('abandoned');
  });

  it('o proximo begin destrava o terminal de novo', () => {
    const t = session();
    t.begin();
    t.abandon(2, 900, 0.4);
    t.begin();
    t.finish(summary(), 3);

    expect(sent.map((e) => e.outcome)).toEqual(['abandoned', 'dead']);
  });

  it('o loop desenhando em repeticao nao vira sessenta eventos por segundo', () => {
    const t = session();
    t.begin();
    const s = summary();
    for (let i = 0; i < 60; i++) t.finish(s, 2);

    expect(sent).toHaveLength(1);
  });

  // Abandono tambem encerra a run para efeito de intervalo: o tempo ate a
  // proxima conta a partir dele, e nao do ultimo `finish`.
  it('o intervalo tambem parte de um abandono', () => {
    const t = session();
    t.begin();
    vi.advanceTimersByTime(30_000);
    t.abandon(1, 600, 0.1);

    vi.advanceTimersByTime(2_500);
    t.begin();
    vi.advanceTimersByTime(60_000);
    t.finish(summary(), 1);

    expect(sent[1]!.msSincePreviousRun).toBe(2_500);
  });
});
