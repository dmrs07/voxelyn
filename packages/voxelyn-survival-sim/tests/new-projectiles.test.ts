import { describe, expect, it } from 'vitest';
import { RETURN_DISC_MAX_DISTANCE, RETURN_DISC_SPEED, SOLID_FRAGILE, SOLID_NONE, SOLID_ROCK, SURF_NONE } from '../src/constants';
import { spawnEnemy } from '../src/entities';
import { createRun, emptyCommand, stepRun } from '../src/run';
import type { Projectile, SurvivalState } from '../src/types';

const clearArena = (state: SurvivalState): void => {
  state.enemies = [];
  state.vents = [];
  state.projectiles = [];
  state.player.x = 40.5;
  state.player.y = 40.5;
  for (let y = 30; y <= 50; y++) {
    for (let x = 30; x <= 50; x++) {
      const i = y * state.config.width + x;
      state.solid[i] = SOLID_NONE;
      state.surface[i] = SURF_NONE;
    }
  }
};

const projectile = (state: SurvivalState, override: Partial<Projectile>): Projectile => ({
  kind: 'bolt',
  id: state.nextEntityId++,
  owner: state.player.id,
  x: state.player.x,
  y: state.player.y,
  vx: 13,
  vy: 0,
  damage: 10,
  distanceTravelled: 0,
  hostile: false,
  leavesBiofluid: false,
  ttl: 120,
  ...override,
});

describe('Ricochet Lens', () => {
  it('rebate deterministicamente uma unica vez e nao entra em loop', () => {
    const state = createRun({ seed: 301 });
    clearArena(state);
    state.solid[40 * state.config.width + 41] = SOLID_ROCK;
    state.solid[40 * state.config.width + 38] = SOLID_ROCK;
    state.projectiles = [projectile(state, {
      x: 40.2,
      modules: { ricochet: { remainingBounces: 1 } },
    })];

    for (let i = 0; i < 4; i++) stepRun(state, [emptyCommand()]);
    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0].vx).toBeLessThan(0);
    expect(state.projectiles[0].modules?.ricochet?.remainingBounces).toBe(0);

    for (let i = 0; i < 20 && state.projectiles.length > 0; i++) stepRun(state, [emptyCommand()]);
    expect(state.projectiles).toHaveLength(0);
  });

  // Regressao: o rebote era testado ANTES de `impactSolid`, entao a primeira
  // parede de cada tiro nunca chegava a reagir. Um modulo tier 1 anunciado como
  // seguro desligava a escavacao por 10 disparos, sem dizer.
  it('a parede fragil ainda cede ao tiro que vai ricochetear', () => {
    const wallSolidAfterShot = (modules: Projectile['modules']): number => {
      const state = createRun({ seed: 307 });
      clearArena(state);
      const wall = 40 * state.config.width + 44;
      state.solid[wall] = SOLID_FRAGILE;
      state.projectiles = [projectile(state, { x: 40.2, modules })];
      for (let i = 0; i < 8; i++) stepRun(state, [emptyCommand()]);
      return state.solid[wall];
    };

    expect(wallSolidAfterShot(undefined)).toBe(SOLID_NONE);
    expect(wallSolidAfterShot({ ricochet: { remainingBounces: 1 } })).toBe(SOLID_NONE);
  });

  it('nao gasta o rebote no que cedeu: a carga sobra para a proxima parede firme', () => {
    const state = createRun({ seed: 311 });
    clearArena(state);
    const fragile = 40 * state.config.width + 44;
    const rock = 40 * state.config.width + 47;
    state.solid[fragile] = SOLID_FRAGILE;
    state.solid[rock] = SOLID_ROCK;
    // piercing para o tiro sobreviver a fragil e chegar na rocha no mesmo voo
    state.projectiles = [projectile(state, {
      x: 40.2,
      modules: { piercing: true, ricochet: { remainingBounces: 1 } },
    })];

    // 14 ticks: tempo de quebrar a fragil (~t6), rebater na rocha (~t11) e
    // ainda estar voltando, sem chegar na borda limpa da arena.
    for (let i = 0; i < 14 && state.projectiles.length > 0; i++) stepRun(state, [emptyCommand()]);
    expect(state.solid[fragile]).toBe(SOLID_NONE); // a fragil cedeu
    expect(state.solid[rock]).toBe(SOLID_ROCK); // a rocha aguentou
    // o rebote nao foi consumido na fragil: sobrou para a rocha, e o tiro voltou
    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0].modules?.ricochet?.remainingBounces).toBe(0);
    expect(state.projectiles[0].vx).toBeLessThan(0);
  });
});

describe('Return Disc', () => {
  it('pode atingir o mesmo inimigo uma vez na ida e uma vez na volta', () => {
    const state = createRun({ seed: 302 });
    clearArena(state);
    const enemy = spawnEnemy(state, 'bruiser', 43, 40.5, false);
    enemy.stunnedUntil = 100_000;
    const hp = enemy.hp;
    state.projectiles = [projectile(state, {
      kind: 'return_disc',
      vx: RETURN_DISC_SPEED,
      damage: 10,
      disc: {
        phase: 'outbound',
        travelled: 0,
        maxDistance: RETURN_DISC_MAX_DISTANCE,
        outboundHits: [],
        returnHits: [],
      },
    })];

    for (let tick = 0; tick < 100 && state.projectiles.length > 0; tick++) {
      enemy.x = 43;
      enemy.y = 40.5;
      enemy.stunnedUntil = 100_000;
      stepRun(state, [emptyCommand()]);
    }

    expect(hp - enemy.hp).toBe(20);
    expect(state.projectiles).toHaveLength(0); // retornou ao dono e foi recolhido
  });

  it('expira com seguranca se o dono desaparecer durante o retorno', () => {
    const state = createRun({ seed: 303 });
    clearArena(state);
    state.projectiles = [projectile(state, {
      kind: 'return_disc',
      disc: {
        phase: 'returning',
        travelled: 5,
        maxDistance: RETURN_DISC_MAX_DISTANCE,
        outboundHits: [],
        returnHits: [],
      },
    })];
    state.player.alive = false;
    stepRun(state, [emptyCommand()]);
    expect(state.projectiles).toHaveLength(0);
  });
});
