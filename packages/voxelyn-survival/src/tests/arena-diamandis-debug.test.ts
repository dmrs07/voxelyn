// OS CENARIOS DO DIAMANDIS NA ARENA: chegam ao estado que prometem, pelo
// caminho autoritativo, e a leitura do painel bate com a simulacao.
//
// O que esta suite protege:
// 1. Os oito rumos poem o chassi de frente para o quadro que o rotulo diz.
// 2. Soltar passa pela vida (a simulacao solta e chama os Coveiros no tick
//    seguinte); arrancar cria um carregador de verdade, com a peca no `mood`
//    e o bit em `modulesLost`; abater o carregador derruba a peca e paga.
// 3. O frenesi maximo chega ao teto e a leitura mostra os tres arrancados.
// 4. Nada do modulo de debug e alcancado por `main.ts`.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DIAMANDIS_FRENZY_CAP,
  DIAMANDIS_MODULE_COUNT,
  DIAMANDIS_MODULE_ORE,
  DIAMANDIS_RIP_STAGGER_TICKS,
  emptyCommand,
  stepRun,
} from '@voxelyn/survival-sim';
import { DIRS8_BY_ANGLE } from '@voxelyn/survival-content';
import {
  DIAMANDIS_SCENARIOS,
  FACING_BY_DIR,
  applyDiamandisScenario,
  bossOf,
  carrierOf,
  diamandisReadout,
  type DiamandisScenario,
} from '../client/arena-diamandis-debug';
import { createArenaRun, type ArenaConditions } from '../client/arena-setup';

const conditions = (): ArenaConditions => ({
  boss: 'diamandis',
  maxHp: 100,
  ability: 'pulse',
  modules: [],
  stabilisers: false,
  coop: false,
});

const tick = (state: ReturnType<typeof createArenaRun>, n = 1): void => {
  for (let i = 0; i < n; i++) stepRun(state, [emptyCommand()]);
};

describe('os oito rumos', () => {
  it('cada botao de rumo poe o chassi de frente para aquele quadro', () => {
    const state = createArenaRun(conditions());
    const faces: Array<[DiamandisScenario, string]> = [
      ['faceR', 'r'],
      ['faceDR', 'dr'],
      ['faceD', 'd'],
      ['faceDL', 'dl'],
      ['faceL', 'l'],
      ['faceUL', 'ul'],
      ['faceU', 'u'],
      ['faceUR', 'ur'],
    ];
    expect(faces.map(([, d]) => d).sort()).toEqual([...DIRS8_BY_ANGLE].sort());
    for (const [scenario, dir] of faces) {
      applyDiamandisScenario(state, scenario);
      expect(diamandisReadout(state)?.facing).toBe(dir);
      expect(bossOf(state)?.facing).toEqual(FACING_BY_DIR[dir]);
    }
    expect(DIAMANDIS_SCENARIOS).toContain('faceU');
  });
});

describe('as pecas', () => {
  it('soltar desce a vida ate o limiar e a simulacao solta a peca no tick seguinte', () => {
    const state = createArenaRun(conditions());
    applyDiamandisScenario(state, 'wake');
    const before = diamandisReadout(state)!;
    expect(before.parts.every((p) => p.state === 'mounted')).toBe(true);
    expect(before.nextExposeAt).not.toBeNull();
    applyDiamandisScenario(state, 'exposeNext');
    expect(bossOf(state)!.hp / bossOf(state)!.maxHp).toBeLessThan(before.nextExposeAt!);
    tick(state, 2);
    const after = diamandisReadout(state)!;
    expect(after.parts[0].state).toBe('loose');
    expect(after.parts[1].state).toBe('mounted');
    // A equipe de resgate veio junto, pelo caminho da simulacao.
    expect(after.undertakers).toBeGreaterThan(0);
  });

  it('arrancar cria um carregador de verdade, com a peca, e o frenesi sobe', () => {
    const state = createArenaRun(conditions());
    const events = applyDiamandisScenario(state, 'ripNext');
    expect(events.some((e) => e.t === 'boss_module' && e.state === 'detached')).toBe(true);
    expect(events.some((e) => e.t === 'boss_state' && e.state === 'frenzy')).toBe(true);
    const carrier = carrierOf(state);
    expect(carrier).not.toBeNull();
    expect(carrier!.mood).toBe(1);
    const r = diamandisReadout(state)!;
    expect(r.parts[0].state).toBe('gone');
    expect(r.parts[0].carrier).toBe(carrier!.id);
    expect(r.carriers).toBe(1);
    // O latch: no tick do arranque o multiplicador ainda e 1; no seguinte, 1,15.
    expect(r.multiplier).toBe(1);
    expect(r.staggerLeft).toBe(DIAMANDIS_RIP_STAGGER_TICKS);
    tick(state);
    expect(diamandisReadout(state)!.multiplier).toBeCloseTo(1.15);
  });

  it('abater o carregador derruba a peca e paga a lasca dela', () => {
    const state = createArenaRun(conditions());
    applyDiamandisScenario(state, 'ripNext');
    const ore = state.stats.oreCollected;
    const events = applyDiamandisScenario(state, 'killCarrier');
    expect(events.some((e) => e.t === 'boss_module' && e.state === 'dropped')).toBe(true);
    expect(events.some((e) => e.t === 'ore_gained' && e.amount === DIAMANDIS_MODULE_ORE)).toBe(
      true,
    );
    expect(state.stats.oreCollected).toBe(ore + DIAMANDIS_MODULE_ORE);
    expect(carrierOf(state)).toBeNull();
    // A peca continua fora do chassi: recuperar devolve o minerio, nao a arma.
    expect(diamandisReadout(state)!.parts[0].state).toBe('gone');
  });

  it('frenesi maximo arranca tudo e chega ao teto; reset devolve tudo', () => {
    const state = createArenaRun(conditions());
    applyDiamandisScenario(state, 'frenzyMax');
    tick(state);
    const r = diamandisReadout(state)!;
    expect(r.parts.every((p) => p.state === 'gone')).toBe(true);
    expect(r.stacks).toBe(DIAMANDIS_MODULE_COUNT);
    expect(r.multiplier).toBe(DIAMANDIS_FRENZY_CAP);
    applyDiamandisScenario(state, 'reset');
    const back = diamandisReadout(state)!;
    expect(back.parts.every((p) => p.state === 'mounted')).toBe(true);
    expect(back.stacks).toBe(0);
    expect(back.multiplier).toBe(1);
    expect(back.hpFraction).toBe(1);
    expect(back.undertakers).toBe(0);
  });

  it('o colapso do reator e o jogador ao lado sao cenarios proprios', () => {
    const state = createArenaRun(conditions());
    expect(diamandisReadout(state)!.reactor).toBe(false);
    applyDiamandisScenario(state, 'reactor');
    expect(diamandisReadout(state)!.reactor).toBe(true);
    applyDiamandisScenario(state, 'beside');
    const boss = bossOf(state)!;
    expect(Math.hypot(state.player.x - boss.x, state.player.y - boss.y)).toBeLessThan(5);
  });
});

describe('isolamento', () => {
  it('main.ts nao alcanca o modulo de debug do Diamandis', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const main = readFileSync(resolve(here, '../client/main.ts'), 'utf8');
    expect(main).not.toContain('arena-diamandis-debug');
    const render = readFileSync(resolve(here, '../client/render.ts'), 'utf8');
    expect(render).not.toContain('arena-diamandis-debug');
  });
});
