import { describe, expect, it } from 'vitest';
import {
  CONTENT_VERSION,
  SIMULATION_VERSION,
  encodeDeathEchoTrace,
  type DeathEchoTraceSample,
} from '@voxelyn/survival-protocol';
import type { DamageCause } from '@voxelyn/survival-sim';
import {
  DEATH_ECHO_FADE_IN_MS,
  DEATH_ECHO_HOLD_MS,
  DEATH_ECHO_REWIND_MS,
  deathEchoHologramFrame,
  deathEchoReplayDuration,
  deathEchoReplayTrace,
  hologramEffectFor,
  hologramTimecode,
  stillDeathEchoTrace,
} from './death-echo-hologram';
import { hologramFlicker } from './death-echo-hologram-draw';
import type { PlacedDeathEcho } from './death-echoes';

const ORIGIN = { x: 40.5, y: 30.5 };

const echoWith = (over: Partial<PlacedDeathEcho> = {}): PlacedDeathEcho => ({
  id: 'holo:1',
  sourceSeed: 7,
  sourceSimulationVersion: SIMULATION_VERSION,
  sourceContentVersion: CONTENT_VERSION,
  sector: 1,
  sourceWidth: 96,
  sourceHeight: 96,
  sourceX: 40,
  sourceY: 30,
  progressQ: 100,
  openness: 6,
  surface: 0,
  nearOre: false,
  facingX: 1,
  facingY: 0,
  cause: { kind: 'fire' },
  ticks: 900,
  x: ORIGIN.x,
  y: ORIGIN.y,
  cell: 30 * 96 + 40,
  projection: 'exact',
  lost: 1,
  ...over,
});

const BRUISER: DamageCause = { kind: 'enemy_contact', archetype: 'bruiser', elite: false };

/**
 * Uma fuga de oito amostras: o Prospector recua para a carcaça atirando, e um
 * Britador aparece na quarta amostra e o alcança na última. A vida cai em duas
 * amostras — o golpe que a reprodução tem de mostrar.
 */
const chase = (): DeathEchoTraceSample[] =>
  Array.from({ length: 8 }, (_, i) => ({
    x: ORIGIN.x - (7 - i) * 0.5,
    y: ORIGIN.y,
    aimX: -1,
    aimY: 0,
    firing: i % 3 === 0,
    hp: i < 5 ? 1 : i < 7 ? 0.55 : 0.2,
    ...(i >= 3
      ? {
          enemies: [
            {
              id: 9,
              archetype: 'bruiser' as const,
              elite: false,
              x: ORIGIN.x - (7 - i) * 0.5 - 3 + i * 0.3,
              y: ORIGIN.y,
            },
          ],
        }
      : {}),
  }));

const chaseEcho = (): PlacedDeathEcho => {
  const finalTrace = encodeDeathEchoTrace(chase(), ORIGIN.x, ORIGIN.y, 120, BRUISER);
  if (!finalTrace) throw new Error('fixture sem rastro');
  return echoWith({ cause: BRUISER, finalTrace });
};

describe('fita da caixa-preta', () => {
  it('reproduz, mostra a morte e rebobina, sempre pelo relógio do pareamento', () => {
    const echo = chaseEcho();
    const traceMs = 8 * 120;
    const opened = 5000;
    const replay = deathEchoHologramFrame(echo, opened, opened + 300);
    const death = deathEchoHologramFrame(echo, opened, opened + traceMs + 200);
    const rewind = deathEchoHologramFrame(
      echo,
      opened,
      opened + traceMs + DEATH_ECHO_HOLD_MS + 100,
    );
    expect(replay?.phase).toBe('replay');
    expect(death?.phase).toBe('death');
    expect(rewind?.phase).toBe('rewind');
    expect(replay?.timecodeMs).toBeLessThan(0);
    expect(death?.victim.anim).toBe('die');
    // Caído SOBRE a carcaça, e não no último ponto amostrado.
    expect(death?.victim.x).toBe(ORIGIN.x);
    expect(death?.victim.y).toBe(ORIGIN.y);
    expect(rewind?.alpha).toBeLessThan(1);
    // O laço fecha e recomeça do zero.
    const total = deathEchoReplayDuration(echo.finalTrace!);
    expect(total).toBe(traceMs + DEATH_ECHO_HOLD_MS + DEATH_ECHO_REWIND_MS);
    expect(deathEchoHologramFrame(echo, opened, opened + total + 300)?.timecodeMs).toBe(
      replay?.timecodeMs,
    );
  });

  it('acende a projeção em vez de aparecer de uma vez', () => {
    const echo = chaseEcho();
    expect(deathEchoHologramFrame(echo, 0, 0)?.alpha).toBe(0);
    expect(deathEchoHologramFrame(echo, 0, DEATH_ECHO_FADE_IN_MS / 2)?.alpha).toBeCloseTo(0.5, 5);
    expect(deathEchoHologramFrame(echo, 0, DEATH_ECHO_FADE_IN_MS)?.alpha).toBe(1);
  });

  it('interpola entre amostras, para o sprite no tamanho natural não pular', () => {
    const echo = chaseEcho();
    const a = deathEchoHologramFrame(echo, 0, 0)!;
    const mid = deathEchoHologramFrame(echo, 0, 60)!;
    const b = deathEchoHologramFrame(echo, 0, 120)!;
    expect(mid.victim.x).toBeGreaterThan(a.victim.x);
    expect(mid.victim.x).toBeLessThan(b.victim.x);
  });

  it('só afirma a pose que o rastro prova', () => {
    const echo = chaseEcho();
    // Amostra 0: gatilho apertado E andando — o tiro manda, e a mira também.
    const firing = deathEchoHologramFrame(echo, 0, 10)!;
    expect(firing.victim.anim).toBe('attack');
    expect(firing.victim.facingX).toBeCloseTo(-1, 5);
    // Amostra 1: só andando, e a passada aponta para onde ele foi.
    const walking = deathEchoHologramFrame(echo, 0, 130)!;
    expect(walking.victim.anim).toBe('walk');
    expect(walking.victim.facingX).toBeCloseTo(1, 5);
    // Amostra 4 → 5: a vida caiu. É o golpe.
    const hit = deathEchoHologramFrame(echo, 0, 4 * 120 + 10)!;
    expect(hit.victim.anim).toBe('hit');
  });

  it('só mostra o agressor a partir de quando a fita o viu', () => {
    const echo = chaseEcho();
    expect(deathEchoHologramFrame(echo, 0, 10)?.threat).toBeNull();
    const seen = deathEchoHologramFrame(echo, 0, 3 * 120 + 10)!;
    expect(seen.threat?.archetype).toBe('bruiser');
    expect(seen.threat?.elite).toBe(false);
    // Ele encara o Prospector, que está à direita dele.
    expect(seen.threat!.facingX).toBeGreaterThan(0);
    // Nas últimas amostras já está desferindo o golpe; caído o corpo, ainda golpeia.
    expect(deathEchoHologramFrame(echo, 0, 6 * 120 + 10)?.threat?.anim).toBe('attack');
    expect(deathEchoHologramFrame(echo, 0, 8 * 120 + 100)?.threat?.anim).toBe('attack');
    expect(deathEchoHologramFrame(echo, 0, 8 * 120 + 900)?.threat?.anim).toBe('idle');
  });

  it('nunca inventa um agressor para uma causa sem criatura', () => {
    const trace = encodeDeathEchoTrace(chase(), ORIGIN.x, ORIGIN.y, 120, { kind: 'fire' });
    const echo = echoWith({ cause: { kind: 'fire' }, finalTrace: trace! });
    const frame = deathEchoHologramFrame(echo, 0, 3 * 120 + 10)!;
    expect(frame.threat).toBeNull();
    expect(frame.effect).toBe('flames');
  });

  it('reproduz um rastro legado — sem vida nem trilha — como fuga, sem golpe', () => {
    const legacy = encodeDeathEchoTrace(
      chase().map(({ x, y, aimX, aimY, firing }) => ({ x, y, aimX, aimY, firing })),
      ORIGIN.x,
      ORIGIN.y,
      120,
      BRUISER,
    )!;
    expect(legacy.hpQ).toBeUndefined();
    expect(legacy.threat).toBeUndefined();
    const echo = echoWith({ cause: BRUISER, finalTrace: legacy });
    const frame = deathEchoHologramFrame(echo, 0, 4 * 120 + 10)!;
    expect(frame.victim.anim).not.toBe('hit');
    expect(frame.threat).toBeNull();
    // A morte continua sendo mostrada: é a parte que ensina.
    expect(deathEchoHologramFrame(echo, 0, 8 * 120 + 100)?.victim.anim).toBe('die');
  });

  it('dá uma fita parada a uma cápsula sem rastro, no ponto exato da morte', () => {
    // O co-op não contribui rastro; a caixa-preta ainda mostra o corpo em pé,
    // onde caiu, virado para onde a carcaça aponta — e a causa acontecendo.
    const echo = echoWith({ facingX: 0, facingY: 1, cause: { kind: 'gas' } });
    const trace = deathEchoReplayTrace(echo);
    expect(trace).toEqual(stillDeathEchoTrace(echo));
    expect(trace.dx.every((entry) => entry === 0)).toBe(true);
    const frame = deathEchoHologramFrame(echo, 0, 100)!;
    expect(frame.victim.anim).toBe('idle');
    expect(frame.victim.x).toBe(ORIGIN.x);
    expect(frame.victim.facingY).toBeCloseTo(1, 5);
    expect(frame.effect).toBe('cloud');
    expect(deathEchoHologramFrame(echo, 0, trace.dx.length * 120 + 50)?.victim.anim).toBe('die');
  });

  it('anuncia o efeito da causa só nos últimos instantes e o mantém na morte', () => {
    const echo = chaseEcho();
    expect(deathEchoHologramFrame(echo, 0, 100)?.effectT).toBe(0);
    const closing = deathEchoHologramFrame(echo, 0, 8 * 120 - 100)!;
    expect(closing.effectT).toBeGreaterThan(0);
    expect(closing.effectT).toBeLessThan(1);
    expect(deathEchoHologramFrame(echo, 0, 8 * 120 + 300)?.effectT).toBe(1);
  });

  it('acumula os disparos conforme a fita os alcança', () => {
    const echo = chaseEcho();
    expect(deathEchoHologramFrame(echo, 0, 10)?.shots).toHaveLength(1);
    expect(deathEchoHologramFrame(echo, 0, 3 * 120 + 10)?.shots).toHaveLength(2);
    expect(deathEchoHologramFrame(echo, 0, 8 * 120 + 10)?.shots).toHaveLength(3);
  });

  it('formata o contador em décimos, negativo antes da morte e zero depois', () => {
    const echo = chaseEcho();
    expect(hologramTimecode(deathEchoHologramFrame(echo, 0, 0)!)).toBe('-1.0');
    expect(hologramTimecode(deathEchoHologramFrame(echo, 0, 8 * 120 - 240)!)).toBe('-0.2');
    expect(hologramTimecode(deathEchoHologramFrame(echo, 0, 8 * 120 + 500)!)).toBe('0.0');
  });
});

describe('efeito por causa', () => {
  it('traduz toda causa da simulação para um vocabulário de desenho', () => {
    const causes: DamageCause[] = [
      { kind: 'fire' },
      { kind: 'overheat' },
      { kind: 'discharge', source: 'player' },
      { kind: 'leviathan_discharge' },
      { kind: 'explosion', source: 'enemy' },
      { kind: 'gas' },
      { kind: 'contamination' },
      { kind: 'spores' },
      BRUISER,
      { kind: 'enemy_projectile', archetype: 'spitter', elite: false, projectile: 'spit' },
      { kind: 'deep_water' },
      { kind: 'suture_fall' },
      { kind: 'suture_whip' },
      { kind: 'bleedout' },
      { kind: 'player_shot' },
      { kind: 'unknown' },
    ];
    const effects = causes.map(hologramEffectFor);
    expect(effects).toEqual([
      'flames',
      'overheat',
      'arc',
      'arc',
      'burst',
      'cloud',
      'cloud',
      'spores',
      'strike',
      'projectile',
      'sink',
      'sink',
      'strike',
      'fade',
      'none',
      'none',
    ]);
  });
});

describe('cintilação da transmissão', () => {
  it('treme sem nunca apagar a figura, e é a mesma para o mesmo instante', () => {
    for (let ms = 0; ms < 20_000; ms += 7) {
      const value = hologramFlicker(ms, 3);
      expect(value).toBeGreaterThanOrEqual(0.55);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(hologramFlicker(1234, 3)).toBe(hologramFlicker(1234, 3));
  });
});
