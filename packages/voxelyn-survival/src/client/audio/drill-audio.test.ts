// A BROCA NO OUVIDO: a parte pura do leito e as vozes dos transientes.
//
// O que se protege: o leito le o MESMO giro da pose (a curva da simulacao),
// a altura do uivo sobe com o giro, o chocalho so aparece no alto, a
// passagem muda a altura pelo lado (vindo sobe, indo cai), a recuperacao vem
// da memoria dos eventos e morre, e cada momento da broca tem voz propria —
// pedra, derrapagem e jogador sao vozes DIFERENTES.
import { describe, expect, it } from 'vitest';
import {
  DIAMANDIS_DRILL_SKID_RECOVERY_TICKS,
  DIAMANDIS_DRILL_TICKS,
  DIAMANDIS_DRILL_WALL_RECOVERY_TICKS,
  DIAMANDIS_DRILL_WINDUP_TICKS,
  drillSpinAt,
  type EntityAction,
  type SemanticEvent,
} from '@voxelyn/survival-sim';
import {
  drillBedInput,
  drillDopplerFactor,
  drillPulseHz,
  drillRattleLevel,
  drillWhineHz,
  emptyDrillMemory,
  noteDrillMoment,
} from './diamandis-drill-bus';
import { cuesForEvents } from './cues';
import { VOICE_SPECS } from './voices';
import { VOICE_RENDERERS } from './synth';

const drill = (startedAt: number): EntityAction => ({
  kind: 'drill',
  phase: 'windup',
  startedAt,
  releaseAt: startedAt + DIAMANDIS_DRILL_WINDUP_TICKS,
  endsAt: startedAt + DIAMANDIS_DRILL_WINDUP_TICKS + DIAMANDIS_DRILL_TICKS,
  direction: { x: 1, y: 0 },
});

describe('as curvas do leito', () => {
  it('o uivo sobe com o giro, o pulso acelera, o chocalho so no alto', () => {
    let last = 0;
    for (let s = 0; s <= 1; s += 0.05) {
      expect(drillWhineHz(s)).toBeGreaterThanOrEqual(last);
      last = drillWhineHz(s);
    }
    expect(drillWhineHz(0)).toBeCloseTo(90);
    expect(drillWhineHz(1)).toBeCloseTo(1100);
    expect(drillPulseHz(1)).toBeGreaterThan(drillPulseHz(0) * 4);
    expect(drillRattleLevel(0.5)).toBe(0);
    expect(drillRattleLevel(0.8)).toBeGreaterThan(0);
    expect(drillRattleLevel(1)).toBeCloseTo(1);
  });

  it('a passagem: vindo sobe, indo cai, parado nao muda', () => {
    expect(drillDopplerFactor(1)).toBeGreaterThan(1);
    expect(drillDopplerFactor(-1)).toBeLessThan(1);
    expect(drillDopplerFactor(0)).toBe(1);
    expect(drillDopplerFactor(5)).toBe(drillDopplerFactor(1));
  });
});

describe('o que o leito le do estado', () => {
  const state = (tick: number, impactAt = -1) => ({
    tick,
    bossRuntime: { drillImpactAt: impactAt },
  });

  it('o giro e o da pose; a velocidade so na corrida; a passagem pelo lado do ouvinte', () => {
    const a = drill(0);
    const boss = { x: 10, y: 10, action: a };
    const mem = emptyDrillMemory();
    const spool = drillBedInput(state(30), boss, { x: 20, y: 10 }, mem, 1);
    expect(spool.spin).toBeCloseTo(drillSpinAt(a, 30));
    expect(spool.speed).toBe(0);
    expect(spool.approach).toBe(0);
    const run = drillBedInput(state(a.releaseAt + 20), boss, { x: 20, y: 10 }, mem, 0.7);
    expect(run.spin).toBe(1);
    expect(run.speed).toBe(1);
    expect(run.approach).toBeCloseTo(1);
    expect(run.presence).toBe(0.7);
    const away = drillBedInput(state(a.releaseAt + 20), boss, { x: 0, y: 10 }, mem, 1);
    expect(away.approach).toBeCloseTo(-1);
    const beside = drillBedInput(state(a.releaseAt + 20), boss, { x: 10, y: 20 }, mem, 1);
    expect(Math.abs(beside.approach)).toBeLessThan(1e-9);
  });

  it('o impacto trava o giro e para os pes, pelo estado ou pela memoria dos eventos', () => {
    const a = drill(0);
    const boss = { x: 10, y: 10, action: a };
    const impactAt = a.releaseAt + 15;
    const local = drillBedInput(
      state(impactAt + 3, impactAt),
      boss,
      { x: 0, y: 0 },
      emptyDrillMemory(),
      1,
    );
    expect(local.spin).toBeCloseTo(0.15);
    expect(local.speed).toBe(0);
    // O parceiro do co-op nao tem `drillImpactAt`: o evento basta.
    const mem = emptyDrillMemory();
    noteDrillMoment(mem, 'drill_impact', impactAt);
    const remote = drillBedInput(state(impactAt + 3, -1), boss, { x: 0, y: 0 }, mem, 1);
    expect(remote.spin).toBeCloseTo(0.15);
    expect(remote.speed).toBe(0);
  });

  it('sem acao, a recuperacao engasga ate zero e some; a derrapagem parte mais alto que a pedra', () => {
    const boss = { x: 10, y: 10, action: undefined };
    const wall = emptyDrillMemory();
    noteDrillMoment(wall, 'drill_impact', 100);
    const wallStart = wall.recovery!.startTick;
    expect(wall.recovery!.ticks).toBe(DIAMANDIS_DRILL_WALL_RECOVERY_TICKS);
    const w1 = drillBedInput(state(wallStart + 2), boss, { x: 0, y: 0 }, wall, 1);
    expect(w1.spin).toBeGreaterThan(0);
    expect(w1.spin).toBeLessThan(0.15);
    const skid = emptyDrillMemory();
    noteDrillMoment(skid, 'drill_skid', 100);
    expect(skid.recovery!.ticks).toBe(DIAMANDIS_DRILL_SKID_RECOVERY_TICKS);
    const s1 = drillBedInput(state(103), boss, { x: 0, y: 0 }, skid, 1);
    expect(s1.spin).toBeGreaterThan(w1.spin);
    const s2 = drillBedInput(state(110), boss, { x: 0, y: 0 }, skid, 1);
    expect(s2.spin).toBeLessThan(s1.spin);
    const done = drillBedInput(
      state(101 + DIAMANDIS_DRILL_SKID_RECOVERY_TICKS),
      boss,
      { x: 0, y: 0 },
      skid,
      1,
    );
    expect(done.spin).toBe(0);
    expect(skid.recovery).toBeNull();
    // A trava de um aviso novo apaga a batida antiga.
    noteDrillMoment(wall, 'drill_lock', 200);
    expect(wall.impactTick).toBe(-1);
  });
});

describe('as vozes dos transientes', () => {
  const moment = (state: string, intensity?: number): SemanticEvent => ({
    t: 'boss_state',
    archetype: 'diamandis',
    state: state as never,
    x: 5,
    y: 5,
    dx: 1,
    dy: 0,
    ...(intensity !== undefined ? { intensity } : {}),
  });
  const ctx = { worldWidth: 64, localPlayerId: 1 };

  it('cada momento tem a sua voz, e pedra, derrapagem e jogador sao vozes diferentes', () => {
    const voiceOf = (s: string, i?: number) =>
      cuesForEvents([moment(s, i)], ctx).map((c) => c.voice);
    expect(voiceOf('drill_bearing')).toEqual(['diamandisDrillBearing']);
    expect(voiceOf('drill_lock')).toEqual(['diamandisDrillLock']);
    expect(voiceOf('drill_impact', 1)).toEqual(['diamandisDrillWall']);
    expect(voiceOf('drill_skid')).toEqual(['diamandisDrillSkid']);
    expect(voiceOf('drill_strike', 1)).toEqual(['diamandisDrillStrike']);
    const ends = new Set([
      ...voiceOf('drill_impact', 1),
      ...voiceOf('drill_skid'),
      ...voiceOf('drill_strike', 1),
    ]);
    expect(ends.size).toBe(3);
    for (const v of [
      'diamandisDrillEngage',
      'diamandisDrillBearing',
      'diamandisDrillLock',
      'diamandisDrillLaunch',
      'diamandisDrillWall',
      'diamandisDrillSkid',
      'diamandisDrillStrike',
    ] as const) {
      expect(VOICE_RENDERERS[v], v).toBeDefined();
      expect(VOICE_SPECS[v].spatial, v).toBe(true);
    }
  });

  it('a batida pesa o que a velocidade pesava', () => {
    const slow = cuesForEvents([moment('drill_impact', 0.2)], ctx)[0].scale;
    const fast = cuesForEvents([moment('drill_impact', 1)], ctx)[0].scale;
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeLessThanOrEqual(1);
  });

  it('o arranque e o release, e o engate e o windup', () => {
    const attack = cuesForEvents(
      [{ t: 'boss_attack', archetype: 'diamandis', ability: 'drill', x: 1, y: 1, dx: 1, dy: 0 }],
      ctx,
    ).map((c) => c.voice);
    expect(attack).toContain('diamandisDrillLaunch');
    const windup = cuesForEvents(
      [
        {
          t: 'boss_windup',
          archetype: 'diamandis',
          ability: 'drill',
          x: 1,
          y: 1,
          dx: 1,
          dy: 0,
          releaseTick: 36,
        },
      ],
      ctx,
    ).map((c) => c.voice);
    expect(windup).toContain('diamandisDrillEngage');
  });
});
