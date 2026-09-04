// OS CENARIOS DE CONGELAMENTO DA ARENA: chegam ao estado que prometem, pelo
// caminho autoritativo, e nao vazam para a run normal.
//
// O que esta suite protege:
// 1. Cada cenario produz o medidor que o rotulo diz — e `frostbite` de fato
//    trava, `nearFull` de fato NAO trava.
// 2. O decaimento acelerado obedece as mesmas regras do natural: nunca abaixo
//    de zero, nunca sobre o latch, nunca durante a graca.
// 3. A leitura do painel bate com o estado (valor, %, latch, calor, ciclo).
// 4. O co-op de apresentacao nasce com dois Prospectors em campo, separados.
// 5. Nada do modulo de debug e alcancado por `main.ts`.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FREEZE_GRACE_TICKS,
  FREEZE_MAX,
  FREEZE_QUEEN_DOSE,
  emptyCommand,
  stepRun,
} from '@voxelyn/survival-sim';
import {
  FAST_DECAY_SCALE,
  FROST_SCENARIOS,
  applyFastDecay,
  applyFrostScenario,
  arenaFrostReadout,
} from '../client/arena-frost-debug';
import { createArenaRun, type ArenaConditions } from '../client/arena-setup';

const conditions = (coop = false): ArenaConditions => ({
  boss: 'frost_queen',
  maxHp: 100,
  ability: 'pulse',
  modules: [],
  stabilisers: false,
  coop,
});

describe('os cenarios', () => {
  it('cada cenario chega ao medidor que promete', () => {
    const state = createArenaRun(conditions(true));
    const extra = state.playerExtras[0];
    applyFrostScenario(state, 'queen');
    expect(extra.freeze).toBe(FREEZE_QUEEN_DOSE);
    applyFrostScenario(state, 'clear');
    expect(extra.freeze).toBe(0);
    applyFrostScenario(state, 'queen2');
    expect(extra.freeze).toBe(FREEZE_QUEEN_DOSE * 2);
    applyFrostScenario(state, 'nearFull');
    expect(extra.freeze).toBe(950);
    expect(extra.frostbitten).toBe(false);
    applyFrostScenario(state, 'frostbite');
    expect(extra.freeze).toBe(FREEZE_MAX);
    expect(extra.frostbitten).toBe(true);
    applyFrostScenario(state, 'hotWeapon');
    expect(extra.heat).toBeGreaterThan(80);
    applyFrostScenario(state, 'partnerHalf');
    expect(state.playerExtras[1].freeze).toBe(600);
    expect(state.playerExtras[1].frostbitten).toBe(false);
    const before = state.enemies.length;
    applyFrostScenario(state, 'wraith');
    expect(state.enemies.length).toBe(before + 1);
    expect(state.enemies[state.enemies.length - 1].archetype).toBe('frost_wraith');
    // Os eventos de dose saem pelo mesmo tipo que a simulacao emite.
    const events = applyFrostScenario(state, 'queen');
    expect(events.some((e) => e.t === 'freeze_dose')).toBe(true);
  });

  it('todo cenario listado no painel existe', () => {
    const state = createArenaRun(conditions(true));
    for (const id of FROST_SCENARIOS) expect(() => applyFrostScenario(state, id)).not.toThrow();
  });
});

describe('o decaimento acelerado', () => {
  it('e dez vezes o natural, com as mesmas regras', () => {
    const state = createArenaRun(conditions());
    // Sem a Rainha: o que se mede e o relogio, e ela dosaria de novo.
    state.enemies = [];
    const extra = state.playerExtras[0];
    applyFrostScenario(state, 'queen');
    // Na graca: nada, nem acelerado.
    for (let t = 0; t < FREEZE_GRACE_TICKS; t++) {
      stepRun(state, [emptyCommand()]);
      applyFastDecay(state);
      state.player.hp = state.player.maxHp;
    }
    expect(extra.freeze).toBe(FREEZE_QUEEN_DOSE);
    const before = extra.freeze;
    for (let t = 0; t < 20; t++) {
      stepRun(state, [emptyCommand()]);
      applyFastDecay(state);
      state.player.hp = state.player.maxHp;
    }
    // 20 ticks: 10 pontos naturais x escala.
    expect(before - extra.freeze).toBe(10 * FAST_DECAY_SCALE);
    // Nunca abaixo de zero...
    for (let t = 0; t < 400; t++) {
      stepRun(state, [emptyCommand()]);
      applyFastDecay(state);
      state.player.hp = state.player.maxHp;
    }
    expect(extra.freeze).toBe(0);
    // ...e nunca sobre o latch.
    applyFrostScenario(state, 'frostbite');
    for (let t = 0; t < 200; t++) {
      stepRun(state, [emptyCommand()]);
      applyFastDecay(state);
      state.player.hp = state.player.maxHp;
    }
    expect(extra.frostbitten).toBe(true);
    expect(extra.freeze).toBe(FREEZE_MAX);
  });
});

describe('a leitura do painel', () => {
  it('bate com o estado', () => {
    const state = createArenaRun(conditions(true));
    applyFrostScenario(state, 'frostbite');
    applyFrostScenario(state, 'hotWeapon');
    applyFrostScenario(state, 'partnerHalf');
    const r = arenaFrostReadout(state, true);
    expect(r.freeze).toBe(FREEZE_MAX);
    expect(r.percent).toBe(100);
    expect(r.frostbitten).toBe(true);
    expect(r.decayPerSecond).toBe(0); // travado: nao decai, nem acelerado
    expect(r.heat).toBe(85);
    expect(r.nextCycleInTicks).toBeGreaterThan(0);
    expect(r.partner).toEqual({ freeze: 600, frostbitten: false });
    applyFrostScenario(state, 'clear');
    applyFrostScenario(state, 'queen');
    state.tick += FREEZE_GRACE_TICKS + 1;
    expect(arenaFrostReadout(state, false).decayPerSecond).toBeCloseTo(1, 5);
    expect(arenaFrostReadout(state, true).decayPerSecond).toBeCloseTo(FAST_DECAY_SCALE, 5);
  });
});

describe('o co-op de apresentacao', () => {
  it('nasce com dois Prospectors em campo, separados', () => {
    const state = createArenaRun(conditions(true));
    expect(state.players).toHaveLength(2);
    expect(state.playerExtras[1].joined).toBe(true);
    expect(state.players[1].alive).toBe(true);
    expect(
      Math.hypot(state.players[1].x - state.players[0].x, state.players[1].y - state.players[0].y),
    ).toBeGreaterThan(0.5);
    // Sem o co-op, um so — como sempre foi.
    expect(createArenaRun(conditions(false)).players).toHaveLength(1);
  });
});

describe('o gate', () => {
  it('main.ts nao importa o modulo de debug da arena', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const main = readFileSync(resolve(here, '../client/main.ts'), 'utf8');
    expect(main).not.toMatch(/arena-frost-debug/);
    expect(main).not.toMatch(/applyFrostScenario|applyFastDecay/);
  });
});
