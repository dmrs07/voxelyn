// O RASGO DE AR da broca, conferido sem canvas.
//
// O que esta suite protege: os atos saem da acao autoritativa; a faixa do
// preparo clareia e fecha de forma monotona e trava em fogo; a onda conica e
// determinista pelo relogio, nasce na ponta, abre e apaga para tras, e para
// (mas existe) com movimento reduzido; os riscos somem com movimento reduzido;
// o cenario da arena arma a broca pelo caminho de verdade e a simulacao move o
// chefe pelo corredor.
import { describe, expect, it } from 'vitest';
import {
  DIAMANDIS_DRILL_TICKS,
  DIAMANDIS_DRILL_WINDUP_TICKS,
  emptyCommand,
  stepRun,
  type EntityAction,
} from '@voxelyn/survival-sim';
import {
  DRILL_RUN_TILES,
  EDDY_COUNT,
  LANE_LOCK_AT,
  SHEET_COUNT,
  SHEET_EVERY_MS,
  WAKE_REACH_TILES,
  bowHalfWidth,
  drillPhaseAt,
  eddiesAt,
  laneStyle,
  streaksAt,
  wakeSheetsAt,
} from '../client/drill-wake';
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

const drill = (startedAt: number): EntityAction => ({
  kind: 'drill',
  phase: 'windup',
  startedAt,
  releaseAt: startedAt + DIAMANDIS_DRILL_WINDUP_TICKS,
  endsAt: startedAt + DIAMANDIS_DRILL_WINDUP_TICKS + DIAMANDIS_DRILL_TICKS,
  direction: { x: 1, y: 0 },
});

describe('os atos', () => {
  it('preparo ate o release, avanco ate o fim; nada fora da broca', () => {
    expect(drillPhaseAt(undefined, 5)).toBeNull();
    expect(drillPhaseAt({ ...drill(0), kind: 'beam' }, 5)).toBeNull();
    const a = drill(100);
    expect(drillPhaseAt(a, 100)).toEqual({ kind: 'windup', progress: 0 });
    expect(drillPhaseAt(a, 118)!.progress).toBeCloseTo(0.5);
    expect(drillPhaseAt(a, 136)).toEqual({ kind: 'advance', progress: 0 });
    expect(drillPhaseAt(a, 136 + 23)!.progress).toBeCloseTo(0.5);
    expect(drillPhaseAt(a, 999)!.progress).toBe(1);
  });

  it('o corredor mede o que a simulacao percorre', () => {
    expect(DRILL_RUN_TILES).toBeCloseTo((7.5 * DIAMANDIS_DRILL_TICKS) / 20);
  });
});

describe('a faixa do preparo', () => {
  it('clareia e fecha de forma monotona e trava em fogo no ultimo terco', () => {
    let last = laneStyle(0);
    expect(last.color).toBe(PAL.loot);
    for (let p = 0.05; p <= 1; p += 0.05) {
      const s = laneStyle(p);
      expect(s.alpha).toBeGreaterThanOrEqual(last.alpha);
      expect(s.dash[0]).toBeGreaterThanOrEqual(last.dash[0]);
      expect(s.dash[1]).toBeLessThanOrEqual(last.dash[1]);
      expect(s.locked).toBe(p >= LANE_LOCK_AT);
      expect(s.color).toBe(s.locked ? PAL.fire : PAL.loot);
      last = s;
    }
    expect(laneStyle(1).alpha).toBeLessThanOrEqual(1);
  });
});

describe('a onda de proa', () => {
  it('alarga pela raiz da distancia: abre rapido perto da ponta, devagar longe', () => {
    expect(bowHalfWidth(0)).toBeGreaterThan(0);
    const near = bowHalfWidth(0.5) - bowHalfWidth(0);
    const far = bowHalfWidth(3) - bowHalfWidth(2.5);
    expect(near).toBeGreaterThan(far);
    expect(bowHalfWidth(WAKE_REACH_TILES)).toBeGreaterThan(bowHalfWidth(1));
  });

  it('os lencois nascem na ponta, correm para tras engrossando e apagando, e sao deterministas', () => {
    for (let t = 0; t < 3000; t += 31) {
      const a = wakeSheetsAt(t, false);
      const b = wakeSheetsAt(t, false);
      expect(a).toEqual(b);
      expect(a.length).toBeGreaterThan(0);
      expect(a.length).toBeLessThanOrEqual(SHEET_COUNT);
      let lastBack = -1;
      let lastThickness = -1;
      for (const sheet of a) {
        expect(sheet.back).toBeGreaterThanOrEqual(0);
        expect(sheet.back).toBeLessThanOrEqual(WAKE_REACH_TILES);
        expect(sheet.halfWidth).toBeCloseTo(bowHalfWidth(sheet.back));
        expect(sheet.alpha).toBeGreaterThan(0);
        expect(sheet.alpha).toBeLessThanOrEqual(1);
        // Da frente para tras: cada lencol esta atras do anterior e mais gordo.
        expect(sheet.back).toBeGreaterThanOrEqual(lastBack);
        expect(sheet.thickness).toBeGreaterThanOrEqual(lastThickness);
        lastBack = sheet.back;
        lastThickness = sheet.thickness;
      }
    }
  });

  it('a cada intervalo nasce um lencol novo na ponta', () => {
    const t = 10 * SHEET_EVERY_MS;
    const fresh = wakeSheetsAt(t, false)[0];
    expect(fresh.age).toBe(0);
    expect(fresh.back).toBe(0);
    expect(wakeSheetsAt(t + SHEET_EVERY_MS / 2, false)[0].back).toBeGreaterThan(0);
  });

  it('riscos helicoidais e redemoinhos ficam dentro da onda e giram com o tempo', () => {
    for (let t = 0; t < 2000; t += 47) {
      for (const s of streaksAt(t, false)) {
        expect(s.back).toBeGreaterThanOrEqual(0);
        expect(s.back + s.length).toBeLessThanOrEqual(WAKE_REACH_TILES + 0.5);
        expect(s.alpha).toBeGreaterThanOrEqual(0);
      }
      const eddies = eddiesAt(t, false);
      expect(eddies.length).toBe(EDDY_COUNT);
      for (const e of eddies) {
        expect(e.lateral).toBeLessThanOrEqual(bowHalfWidth(e.back));
        expect(e.alpha).toBeGreaterThanOrEqual(0);
      }
    }
    expect(streaksAt(100, false)[0].twist).not.toBe(streaksAt(140, false)[0].twist);
  });

  it('com movimento reduzido a onda existe mas nao corre, e os riscos somem', () => {
    expect(wakeSheetsAt(100, true)).toEqual(wakeSheetsAt(1234, true));
    expect(wakeSheetsAt(100, true).length).toBe(SHEET_COUNT);
    expect(eddiesAt(100, true)).toEqual(eddiesAt(900, true));
    expect(streaksAt(500, true)).toEqual([]);
    expect(streaksAt(500, false).length).toBeGreaterThan(0);
  });
});

describe('o cenario da arena', () => {
  it('arma a broca pelo caminho de verdade e a simulacao atravessa o corredor', () => {
    const state = createArenaRun(conditions());
    const events = applyDiamandisScenario(state, 'drill');
    const boss = bossOf(state)!;
    expect(boss.action?.kind).toBe('drill');
    expect(
      events.some(
        (e) => e.t === 'boss_windup' && e.archetype === 'diamandis' && e.ability === 'drill',
      ),
    ).toBe(true);
    expect(drillPhaseAt(boss.action, state.tick)).toEqual({ kind: 'windup', progress: 0 });
    const x0 = boss.x;
    const y0 = boss.y;
    // Parado durante o preparo: o release cai no ultimo tick, e nele a broca
    // ja da o primeiro passo.
    for (let i = 0; i < DIAMANDIS_DRILL_WINDUP_TICKS - 1; i++) stepRun(state, [emptyCommand()]);
    expect(Math.hypot(boss.x - x0, boss.y - y0)).toBeLessThan(0.05);
    expect(drillPhaseAt(boss.action, state.tick)!.kind).toBe('windup');
    stepRun(state, [emptyCommand()]);
    expect(drillPhaseAt(boss.action, state.tick)!.kind).toBe('advance');
    for (let i = 0; i < DIAMANDIS_DRILL_TICKS; i++) stepRun(state, [emptyCommand()]);
    // Andou (a arena e curta nesta seed: a borda para o corredor cedo).
    expect(Math.hypot(boss.x - x0, boss.y - y0)).toBeGreaterThan(1.5);
  });
});
