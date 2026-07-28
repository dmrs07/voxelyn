import { describe, expect, it } from 'vitest';
import {
  EXPLOSIVE_ARM_DISTANCE,
  RETURN_DISC_MAX_DISTANCE,
  RETURN_DISC_SPEED,
  SOLID_FRAGILE,
  SOLID_NONE,
  SOLID_ROCK,
  SURF_GAS,
  SURF_NONE,
} from '../src/constants';
import { spawnEnemy } from '../src/entities';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { grantOrRechargeModule } from '../src/modules';
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
    grantOrRechargeModule(state.playerExtra, 'ricochet', state.tick);
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
      grantOrRechargeModule(state.playerExtra, 'ricochet', state.tick);
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
    grantOrRechargeModule(state.playerExtra, 'piercing', state.tick);
    grantOrRechargeModule(state.playerExtra, 'ricochet', state.tick);
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

describe('modulos empilham no mesmo tiro', () => {
  const fire = () => {
    const command = emptyCommand();
    command.fire = true;
    command.aim = { x: 1, y: 0 };
    return command;
  };

  // O Return Disc decide o VEICULO, nao substitui o resto do equipamento.
  // Antes ele era um caminho alternativo (`if disco else bolt`) e engolia em
  // silencio todos os outros modulos ativos.
  it('o disco sai com os demais modulos armados junto', () => {
    const state = createRun({ seed: 320 });
    clearArena(state);
    for (const id of ['return_disc', 'piercing', 'explosive', 'conductive', 'siphon'] as const) {
      grantOrRechargeModule(state.playerExtra, id, state.tick);
    }
    stepRun(state, [fire()]);

    const shot = state.projectiles.find((p) => !p.hostile);
    expect(shot?.kind).toBe('return_disc');
    expect(shot?.disc?.phase).toBe('outbound');
    expect(shot?.modules?.conductive).toBe(true);
    expect(shot?.modules?.siphon).toBe(true);
    expect(shot?.modules?.piercing).toBe(true);
    expect(shot?.modules?.explosive).toBeDefined();
  });

  it('sem Return Disc o mesmo equipamento sai num bolt, e nao some', () => {
    const state = createRun({ seed: 321 });
    clearArena(state);
    grantOrRechargeModule(state.playerExtra, 'conductive', state.tick);
    grantOrRechargeModule(state.playerExtra, 'ricochet', state.tick);
    stepRun(state, [fire()]);

    const shot = state.projectiles.find((p) => !p.hostile);
    expect(shot?.kind).toBe('bolt');
    expect(shot?.modules?.conductive).toBe(true);
    expect(shot?.modules?.ricochet?.remainingBounces).toBe(1);
  });

  // O gatilho arma; quem paga e o proc.
  it('o tiro que nao acerta nada nao cobra carga nenhuma', () => {
    const state = createRun({ seed: 322 });
    clearArena(state);
    // Corredor mais longo que o alcance do bolt (13 u/s por 1.4 s): ele precisa
    // morrer de TTL, e nao numa parede — bater na parede E um proc.
    for (let y = 38; y <= 42; y++) {
      for (let x = 30; x <= 80; x++) state.solid[y * state.config.width + x] = SOLID_NONE;
    }
    for (const id of ['piercing', 'explosive', 'ricochet'] as const) {
      grantOrRechargeModule(state.playerExtra, id, state.tick);
    }
    const before = state.playerExtra.activeModules.map((m) =>
      m.lifetime.kind === 'charges' ? m.lifetime.remaining : -1);

    stepRun(state, [fire()]);
    // deixa o bolt viver ate o TTL sem encontrar parede nem inimigo
    for (let tick = 0; tick < 40 && state.projectiles.length > 0; tick++) {
      stepRun(state, [emptyCommand()]);
    }
    expect(state.projectiles).toHaveLength(0);

    const after = state.playerExtra.activeModules.map((m) =>
      m.lifetime.kind === 'charges' ? m.lifetime.remaining : -1);
    expect(after).toEqual(before);
  });

  // A flag no projetil diz o que ele FOI ARMADO para fazer, nao o que ainda PODE
  // fazer. Com a capacidade fora de `projectileClass`, um tiro cuja carga acabou
  // em pleno voo continuava valendo como termico: acendia uma nuvem de enxofre e
  // produzia uma explosao inteira de graca, porque a ignicao de gas nao passa
  // pelo ponto que cobra o modulo.
  it('bolt com a flag de explosive mas sem carga nao reage como termico', () => {
    const state = createRun({ seed: 330 });
    clearArena(state);
    expect(state.playerExtra.activeModules).toHaveLength(0); // a carga acabou
    const gasCell = 40 * state.config.width + 41;
    state.surface[gasCell] = SURF_GAS;
    state.projectiles = [projectile(state, {
      modules: { explosive: { armAfterDistance: EXPLOSIVE_ARM_DISTANCE } },
      distanceTravelled: EXPLOSIVE_ARM_DISTANCE + 1,
    })];

    const result = stepRun(state, [emptyCommand()]);
    expect(result.events.some((event) => event.t === 'explosion')).toBe(false);
    expect(state.surface[gasCell]).toBe(SURF_GAS); // a nuvem continua la

    // com o modulo em maos, o MESMO tiro acende: o que muda e a carga, nao a flag
    const armed = createRun({ seed: 330 });
    clearArena(armed);
    grantOrRechargeModule(armed.playerExtra, 'explosive', armed.tick);
    armed.surface[gasCell] = SURF_GAS;
    armed.projectiles = [projectile(armed, {
      modules: { explosive: { armAfterDistance: EXPLOSIVE_ARM_DISTANCE } },
      distanceTravelled: EXPLOSIVE_ARM_DISTANCE + 1,
    })];
    expect(stepRun(armed, [emptyCommand()]).events.some((event) => event.t === 'explosion')).toBe(true);
  });

  it('o Return Disc cobra na volta, nao no lancamento', () => {
    const state = createRun({ seed: 323 });
    clearArena(state);
    grantOrRechargeModule(state.playerExtra, 'return_disc', state.tick);
    const remaining = (): number => {
      const module = state.playerExtra.activeModules.find((m) => m.id === 'return_disc');
      return module?.lifetime.kind === 'charges' ? module.lifetime.remaining : -1;
    };

    stepRun(state, [fire()]);
    const disc = state.projectiles.find((p) => p.kind === 'return_disc');
    expect(disc?.disc?.phase).toBe('outbound');
    expect(remaining()).toBe(5); // lancado de graca

    for (let tick = 0; tick < 40 && disc?.disc?.phase === 'outbound'; tick++) {
      stepRun(state, [emptyCommand()]);
    }
    expect(disc?.disc?.phase).toBe('returning');
    expect(remaining()).toBe(4); // a carga saiu quando ele de fato voltou
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
