// A SALVA DE DEMOLICAO, conferida sem canvas.
//
// O que esta suite protege: as cargas saem do estado (celulas + relogio da
// acao), uma por vez, pousam antes do release e nunca antes de sair; o voo e
// uma parabola que comeca e termina no chao e sobe mais para mais longe, com
// teto; o tombo e o piscar somem com movimento reduzido; a detonacao nasce so
// de explosoes do Diamandis e a cratera apaga no prazo; o cenario da arena
// arma a salva pelo caminho de verdade e a simulacao detona as tres celulas.
import { describe, expect, it } from 'vitest';
import {
  DIAMANDIS_DEMOLISH_CHARGES,
  DIAMANDIS_DEMOLISH_RADIUS,
  DIAMANDIS_DEMOLISH_WINDUP_TICKS,
  emptyCommand,
  stepRun,
  type SemanticEvent,
} from '@voxelyn/survival-sim';
import {
  CRATER_MS,
  DemolitionPresentation,
  LAND_AT,
  THROW_STAGGER_TICKS,
  arcHeightTiles,
  chargeFlight,
  demolitionCharges,
  fuseBlink,
  tumbleAngle,
} from '../client/demolition-fx';
import { applyDiamandisScenario, bossOf, diamandisReadout } from '../client/arena-diamandis-debug';
import { createArenaRun, type ArenaConditions } from '../client/arena-setup';

const conditions = (): ArenaConditions => ({
  boss: 'diamandis',
  maxHp: 100,
  ability: 'pulse',
  modules: [],
  stabilisers: false,
  coop: false,
});

const fixture = (startedAt: number, cells: number[], width = 20) => ({
  config: { width },
  bossRuntime: { blastCells: cells },
  enemies: [
    {
      alive: true,
      archetype: 'diamandis',
      action: {
        kind: 'demolish',
        startedAt,
        releaseAt: startedAt + DIAMANDIS_DEMOLISH_WINDUP_TICKS,
      },
    },
  ],
});

describe('as cargas derivadas do estado', () => {
  it('uma por celula, em sequencia, pousando antes do release', () => {
    const f = fixture(100, [45, 46, 47]);
    const charges = demolitionCharges(f);
    expect(charges.length).toBe(3);
    for (const c of charges) {
      expect(c.launchTick).toBe(100 + c.index * THROW_STAGGER_TICKS);
      expect(c.landTick).toBeGreaterThan(c.launchTick);
      expect(c.landTick).toBeLessThan(c.fireTick);
      expect(c.fireTick).toBe(100 + DIAMANDIS_DEMOLISH_WINDUP_TICKS);
    }
    expect(charges[0].landTick).toBe(100 + Math.round(DIAMANDIS_DEMOLISH_WINDUP_TICKS * LAND_AT));
    expect(charges[1].landTick - charges[0].landTick).toBe(THROW_STAGGER_TICKS);
    expect(charges[0].x).toBe(5.5);
    expect(charges[0].y).toBe(2.5);
  });

  it('sem celulas, ou sem chefe em demolicao, nao ha carga', () => {
    expect(demolitionCharges(fixture(0, []))).toEqual([]);
    const f = fixture(0, [1, 2]);
    f.enemies[0].action.kind = 'drill';
    expect(demolitionCharges(f)).toEqual([]);
    f.enemies[0].alive = false;
    expect(demolitionCharges(f)).toEqual([]);
  });

  it('o voo passa por esperando, voando e pousada, e o estopim vai a 1 no release', () => {
    const [c] = demolitionCharges(fixture(100, [45]));
    expect(chargeFlight(c, 99)).toEqual({ phase: 'waiting' });
    const mid = chargeFlight(c, Math.floor((c.launchTick + c.landTick) / 2));
    expect(mid.phase).toBe('flying');
    if (mid.phase === 'flying') {
      expect(mid.t).toBeGreaterThan(0);
      expect(mid.t).toBeLessThan(1);
    }
    const landed = chargeFlight(c, c.landTick);
    expect(landed).toEqual({ phase: 'landed', fuse: 0 });
    const end = chargeFlight(c, c.fireTick);
    expect(end).toEqual({ phase: 'landed', fuse: 1 });
  });
});

describe('a parabola e o tombo', () => {
  it('comeca e termina no chao, sobe mais para mais longe, com teto', () => {
    expect(arcHeightTiles(0, 6)).toBeCloseTo(0);
    expect(arcHeightTiles(1, 6)).toBeCloseTo(0);
    expect(arcHeightTiles(0.5, 4)).toBeLessThan(arcHeightTiles(0.5, 8));
    expect(arcHeightTiles(0.5, 40)).toBe(arcHeightTiles(0.5, 60));
    expect(arcHeightTiles(0.5, 60)).toBeLessThanOrEqual(1.7);
  });

  it('o tombo gira uma volta e meia por voo e some com movimento reduzido', () => {
    expect(tumbleAngle(0, 0, false)).toBe(0);
    expect(tumbleAngle(1, 0, false)).toBeCloseTo(1.5 * Math.PI * 2);
    expect(tumbleAngle(0.5, 1, false)).not.toBe(tumbleAngle(0.5, 0, false));
    expect(tumbleAngle(0.7, 2, true)).toBe(0);
  });

  it('o estopim pisca dentro de 0..1, mais rapido no fim, e fixo com movimento reduzido', () => {
    for (let t = 0; t < 3000; t += 17) {
      for (const f of [0, 0.5, 0.9]) {
        const b = fuseBlink(f, t, false);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(1);
      }
    }
    expect(fuseBlink(0.2, 123, true)).toBe(1);
    // No fim ele APAGA de verdade entre os piscos; no comeco nunca apaga.
    const lowEnd = Math.min(...Array.from({ length: 60 }, (_, i) => fuseBlink(0.95, i * 9, false)));
    const lowStart = Math.min(
      ...Array.from({ length: 60 }, (_, i) => fuseBlink(0.1, i * 9, false)),
    );
    expect(lowEnd).toBeLessThan(lowStart);
  });
});

describe('a detonacao', () => {
  const explosion = (owner: number | undefined, source: 'enemy' | 'player'): SemanticEvent => ({
    t: 'explosion',
    x: 10,
    y: 12,
    radius: DIAMANDIS_DEMOLISH_RADIUS,
    source,
    owner,
  });

  it('nasce so de explosoes do Diamandis, e a cratera apaga no prazo', () => {
    const p = new DemolitionPresentation();
    const isDiamandis = (owner: number | undefined) => owner === 7;
    expect(p.ingest([explosion(3, 'enemy')], 0, isDiamandis)).toEqual([]);
    expect(p.ingest([explosion(7, 'player')], 0, isDiamandis)).toEqual([]);
    const born = p.ingest([explosion(7, 'enemy')], 1000, isDiamandis);
    expect(born.length).toBe(1);
    expect(born[0].radius).toBe(DIAMANDIS_DEMOLISH_RADIUS);
    expect(p.blasts.length).toBe(1);
    p.step(1000 + CRATER_MS - 1);
    expect(p.blasts.length).toBe(1);
    p.step(1000 + CRATER_MS);
    expect(p.blasts.length).toBe(0);
    p.ingest([explosion(7, 'enemy')], 2000, isDiamandis);
    p.reset();
    expect(p.blasts.length).toBe(0);
  });
});

describe('o cenario da arena', () => {
  it('arma a salva pelo caminho de verdade e a simulacao detona as tres celulas', () => {
    const state = createArenaRun(conditions());
    const events = applyDiamandisScenario(state, 'demolish');
    const boss = bossOf(state)!;
    expect(boss.action?.kind).toBe('demolish');
    expect(events.filter((e) => e.t === 'blast_marker').length).toBe(DIAMANDIS_DEMOLISH_CHARGES);
    expect(diamandisReadout(state)!.charges).toBe(DIAMANDIS_DEMOLISH_CHARGES);
    const charges = demolitionCharges(state);
    expect(charges.length).toBe(DIAMANDIS_DEMOLISH_CHARGES);
    expect(chargeFlight(charges[0], state.tick).phase).toBe('flying');
    let blasts = 0;
    for (let i = 0; i < DIAMANDIS_DEMOLISH_WINDUP_TICKS + 4; i++) {
      const out = stepRun(state, [emptyCommand()]);
      blasts += out.events.filter(
        (e) => e.t === 'explosion' && e.source === 'enemy' && e.owner === boss.id,
      ).length;
    }
    expect(blasts).toBe(DIAMANDIS_DEMOLISH_CHARGES);
    expect(demolitionCharges(state)).toEqual([]);
  });
});
