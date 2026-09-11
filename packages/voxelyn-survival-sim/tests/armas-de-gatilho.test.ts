// AS ARMAS QUE OCUPAM O GATILHO — a Lanca, o Bacamarte e quem fica com ele.
//
// Os tres modulos com a etiqueta `weapon` nao MODIFICAM o tiro: eles o
// substituem. O que estes testes protegem, em ordem de gravidade:
//
// 1. QUEM SEGURA O GATILHO e deterministico e por TIER, entao uma Minigun
//    carregada nao e roubada por uma arma de tier 2 pega depois;
// 2. O ALCANCE de cada uma e o que a ficha promete — a Lanca enxerga alem do
//    parafuso, o Bacamarte morre no ar antes dos seis tiles;
// 3. O BACAMARTE nao arma modificador, porque cinco graos por tiro sao a versao
//    curta do problema que a Minigun ja tinha;
// 4. A CADENCIA e o CALOR saem da arma equipada, e nao do parafuso.
import { describe, expect, it } from 'vitest';
import {
  BLUNDERBUSS_DAMAGE,
  BLUNDERBUSS_HEAT_PER_SHOT,
  BLUNDERBUSS_PELLETS,
  BLUNDERBUSS_RANGE,
  BOLT_RANGE,
  PROSPECT_LANCE_DAMAGE,
  PROSPECT_LANCE_HEAT_PER_SHOT,
  PROSPECT_LANCE_RANGE,
  SOLID_NONE,
  SURF_NONE,
} from '../src/constants';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { activeWeaponModule, grantOrRechargeModule } from '../src/modules';
import type { ModuleId, SurvivalState } from '../src/types';

/** Sala limpa, sem fauna, com o Prospector no centro mirando para leste. */
const range = (equip?: ModuleId) => {
  const state = createRun({ seed: 4242 });
  const w = state.config.width;
  const px = Math.floor(w / 2);
  const py = Math.floor(state.config.height / 2);
  state.player.x = px + 0.5;
  state.player.y = py + 0.5;
  for (let y = py - 28; y <= py + 28; y++) {
    for (let x = px - 28; x <= px + 28; x++) {
      const i = y * w + x;
      state.solid[i] = SOLID_NONE;
      state.surface[i] = SURF_NONE;
      state.surfaceTimer[i] = 0;
    }
  }
  state.enemies = [];
  state.salvageSites = [];
  state.playerExtras[0].aim = { x: 1, y: 0 };
  if (equip) grantOrRechargeModule(state.playerExtras[0], equip, state.tick);
  return { state, px, py };
};

const fire = () => ({ ...emptyCommand(), aim: { x: 1, y: 0 }, fire: true });

/**
 * Ate onde o disparo CHEGA, em tiles, medido no mundo e nao na ficha.
 *
 * Anda ate o ultimo projetil do jogador sumir e devolve a maior distancia que
 * algum deles alcancou. E a unica leitura que pega um alcance que a constante
 * promete e o `ttl` nao entrega.
 */
const reach = (state: SurvivalState, px: number): number => {
  let farthest = 0;
  for (let t = 0; t < 120; t++) {
    stepRun(state, [t === 0 ? fire() : emptyCommand()]);
    for (const proj of state.projectiles) {
      if (proj.hostile) continue;
      farthest = Math.max(farthest, proj.x - (px + 0.5));
    }
    if (t > 0 && state.projectiles.length === 0) break;
  }
  return farthest;
};

describe('quem fica com o gatilho', () => {
  it('o TIER decide: a Minigun nao e roubada por uma arma de tier 2', () => {
    const { state } = range('minigun');
    grantOrRechargeModule(state.playerExtras[0], 'blunderbuss', state.tick);
    grantOrRechargeModule(state.playerExtras[0], 'prospect_lance', state.tick);
    expect(activeWeaponModule(state.playerExtras[0], state.tick)).toBe('minigun');
  });

  it('sem arma nenhuma equipada, o gatilho e do parafuso comum', () => {
    const { state } = range();
    expect(activeWeaponModule(state.playerExtras[0], state.tick)).toBeUndefined();
  });

  it('uma arma sem carga devolve o gatilho', () => {
    const { state } = range('prospect_lance');
    const module = state.playerExtras[0].activeModules[0];
    if (module.lifetime.kind === 'charges') module.lifetime.remaining = 0;
    expect(activeWeaponModule(state.playerExtras[0], state.tick)).toBeUndefined();
  });
});

describe('alcance', () => {
  it('a Lanca enxerga alem do parafuso, e o parafuso alem do Bacamarte', () => {
    const bolt = range();
    const lance = range('prospect_lance');
    const shot = range('blunderbuss');
    const boltReach = reach(bolt.state, bolt.px);
    const lanceReach = reach(lance.state, lance.px);
    const pelletReach = reach(shot.state, shot.px);

    // A ORDEM e o desenho inteiro, e ela e o que nao pode inverter em silencio.
    expect(pelletReach).toBeLessThan(boltReach);
    expect(boltReach).toBeLessThan(lanceReach);

    // E cada um chega perto do que a propria ficha promete. A folga de um tile
    // e do passo de tick: o projetil morre no tick seguinte ao que cruzou.
    expect(Math.abs(boltReach - BOLT_RANGE)).toBeLessThan(1.5);
    expect(Math.abs(lanceReach - PROSPECT_LANCE_RANGE)).toBeLessThan(1.5);
    expect(Math.abs(pelletReach - BLUNDERBUSS_RANGE)).toBeLessThan(1.5);
  });
});

describe('o leque do Bacamarte', () => {
  it('poe CINCO graos no mundo por disparo, simetricos em torno da mira', () => {
    const { state } = range('blunderbuss');
    stepRun(state, [fire()]);
    const pellets = state.projectiles.filter((p) => p.kind === 'pellet');
    expect(pellets).toHaveLength(BLUNDERBUSS_PELLETS);
    // Simetria: a soma dos rumos verticais se cancela em torno da mira.
    const drift = pellets.reduce((sum, p) => sum + p.vy, 0);
    expect(Math.abs(drift)).toBeLessThan(1e-9);
    // E o do meio vai reto.
    expect(pellets.some((p) => Math.abs(p.vy) < 1e-9)).toBe(true);
  });

  it('NAO arma modificador nenhum — cinco graos nao multiplicam proc', () => {
    const { state } = range('blunderbuss');
    grantOrRechargeModule(state.playerExtras[0], 'explosive', state.tick);
    grantOrRechargeModule(state.playerExtras[0], 'piercing', state.tick);
    stepRun(state, [fire()]);
    for (const pellet of state.projectiles.filter((p) => p.kind === 'pellet')) {
      expect(pellet.modules).toBeUndefined();
    }
  });

  it('cobra UMA carga por disparo, e nao uma por grao', () => {
    const { state } = range('blunderbuss');
    const module = state.playerExtras[0].activeModules.find((m) => m.id === 'blunderbuss');
    const before = module?.lifetime.kind === 'charges' ? module.lifetime.remaining : 0;
    stepRun(state, [fire()]);
    const after = module?.lifetime.kind === 'charges' ? module.lifetime.remaining : 0;
    expect(before - after).toBe(1);
  });
});

describe('a Lanca', () => {
  it('ACEITA modificadores: um projetil a 1,11/s e mais seguro que o parafuso', () => {
    const { state } = range('prospect_lance');
    grantOrRechargeModule(state.playerExtras[0], 'piercing', state.tick);
    stepRun(state, [fire()]);
    const lance = state.projectiles.find((p) => p.kind === 'lance');
    expect(lance?.modules?.piercing).toBe(true);
  });

  it('bate mais forte que o parafuso, e o Bacamarte por grao bate mais fraco', () => {
    expect(PROSPECT_LANCE_DAMAGE).toBeGreaterThan(BLUNDERBUSS_DAMAGE * BLUNDERBUSS_PELLETS * 0.5);
    expect(BLUNDERBUSS_DAMAGE).toBeLessThan(PROSPECT_LANCE_DAMAGE);
  });
});

describe('cadencia e calor saem da ARMA', () => {
  it('cada arma cobra o proprio calor no disparo', () => {
    for (const [equip, heat] of [
      ['prospect_lance', PROSPECT_LANCE_HEAT_PER_SHOT],
      ['blunderbuss', BLUNDERBUSS_HEAT_PER_SHOT],
    ] as const) {
      const { state } = range(equip);
      const before = state.playerExtras[0].heat;
      stepRun(state, [fire()]);
      // O calor decai no mesmo tick, entao a comparacao e por piso e nao exata.
      expect(state.playerExtras[0].heat).toBeGreaterThan(before + heat * 0.8);
    }
  });

  it('a arma lenta NAO ganha uptime de graca: o teto termico fica perto da cadencia', () => {
    // A regra que sustenta as duas fichas (ver PROSPECT_LANCE_HEAT_PER_SHOT): se
    // o calor por tiro nao subisse junto com a lentidao, "cadencia reduzida"
    // seria um custo que se paga sozinho.
    const sustainable = (heatPerShot: number) => 23 / heatPerShot;
    expect(sustainable(PROSPECT_LANCE_HEAT_PER_SHOT)).toBeLessThan(20 / 18 + 0.2);
    expect(sustainable(BLUNDERBUSS_HEAT_PER_SHOT)).toBeLessThan(20 / 22 + 0.2);
  });
});
