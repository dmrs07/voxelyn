// O FEIXE DE PROSPECCAO, conferido sem canvas.
//
// O que esta suite protege: o alcance derivado no cliente e o MESMO que a
// simulacao emite no `beam_line` (parede, borda, alcance cheio); o ato e a
// fracao saem da acao autoritativa; a linha de medicao clareia e fecha de forma
// monotona e trava em ambar no ultimo terco; a cabeca de leitura fica em 0..1
// e e linear com movimento reduzido; o frenesi puxa a borda para o vermelho; a
// cicatriz nasce da passagem com potencia (nunca da varredura) e apaga no prazo.
import { describe, expect, it } from 'vitest';
import {
  DIAMANDIS_BEAM_LENGTH,
  DIAMANDIS_BEAM_WINDUP_TICKS,
  SOLID_NONE,
  SOLID_ROCK,
  emptyCommand,
  startAction,
  stepRun,
  type EntityAction,
  type SemanticEvent,
} from '@voxelyn/survival-sim';
import {
  DiamandisBeamPresentation,
  FIRE_MS,
  SCORCH_MS,
  SURVEY_LOCK_AT,
  beamColors,
  beamPhaseAt,
  beamReach,
  readHeadT,
  surveyStyle,
} from '../client/diamandis-beam';
import { PAL } from '../client/palette';
import { applyDiamandisScenario, bossOf } from '../client/arena-diamandis-debug';
import { createArenaRun, type ArenaConditions } from '../client/arena-setup';

const conditions = (): ArenaConditions => ({
  boss: 'diamandis',
  maxHp: 100,
  ability: 'pulse',
  modules: [],
  stabilisers: false,
  coop: false,
});

const beamAction = (startedAt: number): EntityAction => ({
  kind: 'beam',
  phase: 'windup',
  startedAt,
  releaseAt: startedAt + DIAMANDIS_BEAM_WINDUP_TICKS,
  endsAt: startedAt + DIAMANDIS_BEAM_WINDUP_TICKS + 10,
  direction: { x: 1, y: 0 },
});

describe('o ato e a fracao', () => {
  it('fora de um feixe nao ha nada; no windup e levantamento; depois, passagem', () => {
    expect(beamPhaseAt(undefined, 10)).toBeNull();
    expect(beamPhaseAt({ ...beamAction(0), kind: 'drill' }, 10)).toBeNull();
    const a = beamAction(100);
    expect(beamPhaseAt(a, 100)).toEqual({ kind: 'survey', progress: 0 });
    expect(beamPhaseAt(a, 120)!.kind).toBe('survey');
    expect(beamPhaseAt(a, 120)!.progress).toBeCloseTo(0.5);
    expect(beamPhaseAt(a, 140)).toEqual({ kind: 'fire', progress: 0 });
    expect(beamPhaseAt(a, 145)!.progress).toBeCloseTo(0.5);
    expect(beamPhaseAt(a, 999)!.progress).toBe(1);
  });
});

describe('o alcance', () => {
  it('bate com o beam_line da simulacao, parede e alcance cheio', () => {
    const state = createArenaRun(conditions());
    const boss = bossOf(state)!;
    const w = state.config.width;
    // Um corredor limpo de 20 tiles para a ESQUERDA (o chefe nasce perto da
    // borda direita nesta arena), com uma parede no fim.
    for (let d = -22; d <= 2; d++) {
      for (let dy = -2; dy <= 2; dy++) {
        const cx = Math.floor(boss.x) + d;
        const cy = Math.floor(boss.y) + dy;
        if (cx > 0 && cy > 0 && cx < w - 1 && cy < state.config.height - 1) {
          state.solid[cy * w + cx] = SOLID_NONE;
        }
      }
    }
    const wallX = Math.floor(boss.x) - 9;
    for (let dy = -2; dy <= 2; dy++) {
      state.solid[(Math.floor(boss.y) + dy) * w + wallX] = SOLID_ROCK;
    }
    const events: SemanticEvent[] = [];
    state.bossRuntime.awake = true;
    state.bossRuntime.staggerUntil = 0;
    startAction(state, boss, 'beam', { x: -1, y: 0 }, DIAMANDIS_BEAM_WINDUP_TICKS, 10, events);
    const expected = beamReach(state, boss.x, boss.y, -1, 0);
    expect(expected).toBeGreaterThan(7);
    expect(expected).toBeLessThan(DIAMANDIS_BEAM_LENGTH);
    // A primeira varredura sai em ate quatro ticks.
    let line: SemanticEvent | undefined;
    for (let i = 0; i < 8 && !line; i++) {
      const out = stepRun(state, [emptyCommand()]);
      line = out.events.find((e) => e.t === 'beam_line');
    }
    expect(line && line.t === 'beam_line' && line.length).toBe(expected);
    // Sem parede, o alcance e o cheio.
    for (let dy = -2; dy <= 2; dy++) {
      state.solid[(Math.floor(boss.y) + dy) * w + wallX] = SOLID_NONE;
    }
    expect(beamReach(state, boss.x, boss.y, -1, 0)).toBe(DIAMANDIS_BEAM_LENGTH);
    // A borda do mapa para a linha.
    expect(beamReach(state, 1.5, boss.y, -1, 0)).toBeLessThan(3);
  });
});

describe('a linha de medicao', () => {
  it('clareia e fecha de forma monotona, e trava em ambar no ultimo terco', () => {
    let last = surveyStyle(0);
    expect(last.color).toBe(PAL.electric);
    expect(last.locked).toBe(false);
    for (let p = 0.05; p <= 1; p += 0.05) {
      const s = surveyStyle(p);
      expect(s.alpha).toBeGreaterThanOrEqual(last.alpha);
      expect(s.dash[0]).toBeGreaterThanOrEqual(last.dash[0]);
      expect(s.dash[1]).toBeLessThanOrEqual(last.dash[1]);
      expect(s.locked).toBe(p >= SURVEY_LOCK_AT);
      expect(s.color).toBe(s.locked ? PAL.loot : PAL.electric);
      last = s;
    }
    expect(surveyStyle(1).alpha).toBeLessThanOrEqual(1);
  });

  it('a cabeca de leitura fica na linha, e com movimento reduzido anda linear', () => {
    for (let t = 0; t < 5000; t += 37) {
      for (const p of [0, 0.3, 0.7, 0.95]) {
        const h = readHeadT(p, t, false);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(1);
      }
    }
    expect(readHeadT(0.25, 1234, true)).toBe(0.25);
    expect(readHeadT(0.9, 99, true)).toBe(0.9);
    // Sem movimento reduzido ela ANDA.
    const a = readHeadT(0.3, 0, false);
    const b = readHeadT(0.3, 300, false);
    expect(a).not.toBe(b);
  });
});

describe('as cores da passagem', () => {
  it('o nucleo e sempre osso; o frenesi puxa a borda para o sangue', () => {
    const calm = beamColors(0);
    const wild = beamColors(3);
    expect(calm.core).toBe(PAL.player);
    expect(wild.core).toBe(PAL.player);
    expect(calm.edge).toBe(PAL.fire);
    expect(wild.edge).toBe(PAL.blood);
    expect(beamColors(1).edge).not.toBe(calm.edge);
    expect(beamColors(9).edge).toBe(wild.edge);
  });
});

describe('a memoria do feixe', () => {
  const line = (powered: boolean): SemanticEvent => ({
    t: 'beam_line',
    x: 10,
    y: 10,
    dx: 0,
    dy: 1,
    length: 12,
    powered,
  });

  it('a varredura nao deixa cicatriz; a passagem deixa, e ela apaga no prazo', () => {
    const p = new DiamandisBeamPresentation();
    expect(p.ingest([line(false)], 1000)).toEqual([]);
    expect(p.scorches.length).toBe(0);
    const fired = p.ingest([line(true)], 1000);
    expect(fired.length).toBe(1);
    expect(fired[0].length).toBe(12);
    expect(p.firedAt).toBe(1000);
    expect(p.lastFire?.dy).toBe(1);
    // A coluna fica meio segundo na tela, cheia no release e esfriando.
    expect(p.fireIntensity(999)).toBe(0);
    expect(p.fireIntensity(1000)).toBe(1);
    expect(p.fireIntensity(1000 + FIRE_MS / 2)).toBeCloseTo(0.75);
    expect(p.fireIntensity(1000 + FIRE_MS)).toBe(0);
    p.step(1000 + SCORCH_MS - 1);
    expect(p.scorches.length).toBe(1);
    p.step(1000 + SCORCH_MS);
    expect(p.scorches.length).toBe(0);
    p.ingest([line(true)], 2000);
    p.reset();
    expect(p.scorches.length).toBe(0);
    expect(p.lastFire).toBeNull();
  });
});

describe('o cenario da arena', () => {
  it('poe o jogador na linha e comeca o levantamento pelo caminho de verdade', () => {
    const state = createArenaRun(conditions());
    const events = applyDiamandisScenario(state, 'beam');
    const boss = bossOf(state)!;
    expect(boss.action?.kind).toBe('beam');
    expect(events.some((e) => e.t === 'action_start' && e.action === 'beam')).toBe(true);
    expect(
      events.some(
        (e) => e.t === 'boss_windup' && e.archetype === 'diamandis' && e.ability === 'beam',
      ),
    ).toBe(true);
    const phase = beamPhaseAt(boss.action, state.tick);
    expect(phase).toEqual({ kind: 'survey', progress: 0 });
    // A simulacao segue: varredura no windup, passagem no release.
    let survey = 0;
    let fire = 0;
    for (let i = 0; i < DIAMANDIS_BEAM_WINDUP_TICKS + 12; i++) {
      const out = stepRun(state, [emptyCommand()]);
      for (const e of out.events) {
        if (e.t !== 'beam_line') continue;
        if (e.powered) fire++;
        else survey++;
      }
    }
    expect(survey).toBeGreaterThan(5);
    expect(fire).toBe(1);
  });
});
