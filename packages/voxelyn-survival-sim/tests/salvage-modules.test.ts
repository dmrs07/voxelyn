import { describe, expect, it } from 'vitest';
import {
  BOLT_COOLDOWN_TICKS,
  DISCHARGE_DAMAGE,
  EXPLOSIVE_ARM_DISTANCE,
  PLAYER_MODULE_FRIENDLY_DAMAGE_SCALE,
  SOLID_NONE,
  SURF_BIOFLUID,
  SURF_NONE,
} from '../src/constants';
import { dischargeAt, explodeAt } from '../src/cells';
import { spawnEnemy } from '../src/entities';
import { grantOrRechargeModule } from '../src/modules';
import {
  createRun,
  emptyCommand,
  hashAuthoritativeState,
  resetPlayerProgress,
  resolveChainedEvents,
  stepRun,
} from '../src/run';
import type { Projectile, SemanticEvent, SurvivalState } from '../src/types';

const clearArena = (state: SurvivalState, cx = 40, cy = 40, radius = 14): void => {
  state.enemies = [];
  state.vents = [];
  state.projectiles = [];
  state.player.x = cx + 0.5;
  state.player.y = cy + 0.5;
  state.player.hp = state.player.maxHp;
  state.playerExtra.heat = 0;
  state.playerExtra.overheatedUntil = 0;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const i = y * state.config.width + x;
      state.solid[i] = SOLID_NONE;
      state.surface[i] = SURF_NONE;
      state.surfaceTimer[i] = 0;
    }
  }
};

const bolt = (state: SurvivalState, overrides: Partial<Projectile> = {}): Projectile => ({
  kind: 'bolt',
  id: state.nextEntityId++,
  owner: state.player.id,
  x: state.player.x,
  y: state.player.y,
  vx: 0,
  vy: 0,
  damage: 10,
  distanceTravelled: 0,
  hostile: false,
  leavesBiofluid: false,
  ttl: 20,
  ...overrides,
});

const charges = (state: SurvivalState, id: string): number | null => {
  const module = state.playerExtra.activeModules.find((active) => active.id === id);
  if (!module || module.lifetime.kind !== 'charges') return null;
  return module.lifetime.remaining;
};

describe('modulos temporarios', () => {
  it('reobter um modulo recarrega ate o maximo sem duplicar', () => {
    const state = createRun({ seed: 100 });
    const first = grantOrRechargeModule(state.playerExtra, 'piercing', state.tick);
    if (first.lifetime.kind !== 'charges') throw new Error('piercing sem cargas');
    first.lifetime.remaining = 2;

    grantOrRechargeModule(state.playerExtra, 'piercing', state.tick + 10);

    expect(state.playerExtra.activeModules).toHaveLength(1);
    expect(charges(state, 'piercing')).toBe(12);
  });

  it('piercing expira exatamente depois de 12 disparos criados', () => {
    const state = createRun({ seed: 101 });
    clearArena(state);
    grantOrRechargeModule(state.playerExtra, 'piercing', state.tick);
    let consumed = 0;
    for (let tick = 0; tick < BOLT_COOLDOWN_TICKS * 20 && state.playerExtra.activeModules.length > 0; tick++) {
      const command = emptyCommand();
      command.fire = true;
      command.aim = { x: 1, y: 0 };
      const result = stepRun(state, [command]);
      consumed += result.events.filter((event) => event.t === 'module_charge_consumed' && event.module === 'piercing').length;
      // Isola o teste do limite global de projeteis; a carga ja foi consumida no spawn.
      state.projectiles = [];
      state.playerExtra.heat = 0;
      state.playerExtra.overheatedUntil = 0;
    }
    expect(consumed).toBe(12);
    expect(charges(state, 'piercing')).toBeNull();
  });

  it('conductive nao consome em tiro comum e consome apenas ao produzir descarga', () => {
    const state = createRun({ seed: 102 });
    clearArena(state);
    grantOrRechargeModule(state.playerExtra, 'conductive', state.tick);

    const plain = emptyCommand();
    plain.fire = true;
    plain.aim = { x: 1, y: 0 };
    stepRun(state, [plain]);
    for (let i = 0; i < 4; i++) stepRun(state, [emptyCommand()]);
    expect(charges(state, 'conductive')).toBe(6);

    state.projectiles = [bolt(state, {
      x: state.player.x + 1,
      y: state.player.y,
      modules: { conductive: true },
    })];
    const cell = Math.floor(state.player.y) * state.config.width + Math.floor(state.player.x + 1);
    state.surface[cell] = SURF_BIOFLUID;
    const result = stepRun(state, [emptyCommand()]);

    expect(result.events.some((event) => event.t === 'discharge' && event.source === 'player')).toBe(true);
    expect(charges(state, 'conductive')).toBe(5);
  });

  it('siphon so consome quando um inimigo e atingido e a cura e aplicada', () => {
    const state = createRun({ seed: 103 });
    clearArena(state);
    grantOrRechargeModule(state.playerExtra, 'siphon', state.tick);
    const enemy = spawnEnemy(state, 'bruiser', state.player.x + 0.2, state.player.y, false);

    state.projectiles = [bolt(state, { modules: { siphon: true } })];
    stepRun(state, [emptyCommand()]);
    expect(charges(state, 'siphon')).toBe(12); // HP cheio: nenhum proc desperdicado

    enemy.alive = true;
    enemy.hp = enemy.maxHp;
    state.player.hp = state.player.maxHp - 5;
    state.projectiles = [bolt(state, { modules: { siphon: true } })];
    stepRun(state, [emptyCommand()]);
    expect(state.player.hp).toBe(state.player.maxHp - 3);
    expect(charges(state, 'siphon')).toBe(11);
  });

  it('explosive funciona como bolt antes de armar e explode depois da distancia definida', () => {
    const before = createRun({ seed: 104 });
    clearArena(before);
    spawnEnemy(before, 'bruiser', before.player.x, before.player.y, false);
    before.projectiles = [bolt(before, {
      modules: { explosive: { armAfterDistance: EXPLOSIVE_ARM_DISTANCE } },
      distanceTravelled: EXPLOSIVE_ARM_DISTANCE - 0.1,
    })];
    const normal = stepRun(before, [emptyCommand()]);
    expect(normal.events.some((event) => event.t === 'explosion')).toBe(false);

    const armed = createRun({ seed: 105 });
    clearArena(armed);
    spawnEnemy(armed, 'bruiser', armed.player.x, armed.player.y, false);
    armed.projectiles = [bolt(armed, {
      modules: { explosive: { armAfterDistance: EXPLOSIVE_ARM_DISTANCE } },
      distanceTravelled: EXPLOSIVE_ARM_DISTANCE,
    })];
    const detonated = stepRun(armed, [emptyCommand()]);
    expect(detonated.events.some((event) => event.t === 'explosion' && event.source === 'player')).toBe(true);
  });

  it('friendly damage de modulo usa 35%, enquanto efeitos ambientais mantem dano integral', () => {
    const playerState = createRun({ seed: 106, playerCount: 2 });
    clearArena(playerState);
    playerState.players[1].x = playerState.player.x;
    playerState.players[1].y = playerState.player.y;
    const playerEvents: SemanticEvent[] = [];
    explodeAt(playerState, playerState.player.x, playerState.player.y, 2.5, playerEvents, {
      source: 'player', owner: playerState.player.id,
    });
    const beforePlayer = playerState.players[1].hp;
    resolveChainedEvents(playerState, playerEvents);
    const playerDamage = beforePlayer - playerState.players[1].hp;

    const environmentState = createRun({ seed: 106, playerCount: 2 });
    clearArena(environmentState);
    environmentState.players[1].x = environmentState.player.x;
    environmentState.players[1].y = environmentState.player.y;
    const environmentEvents: SemanticEvent[] = [];
    explodeAt(environmentState, environmentState.player.x, environmentState.player.y, 2.5, environmentEvents, {
      source: 'environment',
    });
    const beforeEnvironment = environmentState.players[1].hp;
    resolveChainedEvents(environmentState, environmentEvents);
    const environmentDamage = beforeEnvironment - environmentState.players[1].hp;

    expect(playerDamage / environmentDamage).toBeCloseTo(PLAYER_MODULE_FRIENDLY_DAMAGE_SCALE, 5);
  });

  it('descarga ambiental continua integral e descarga de jogador e escalada', () => {
    const playerState = createRun({ seed: 107, playerCount: 2 });
    clearArena(playerState);
    const i = Math.floor(playerState.player.y) * playerState.config.width + Math.floor(playerState.player.x);
    playerState.surface[i] = SURF_BIOFLUID;
    playerState.players[1].x = playerState.player.x;
    playerState.players[1].y = playerState.player.y;
    const playerEvents: SemanticEvent[] = [];
    dischargeAt(playerState, Math.floor(playerState.player.x), Math.floor(playerState.player.y), playerEvents, { source: 'player', owner: 1 });
    const beforePlayer = playerState.players[1].hp;
    resolveChainedEvents(playerState, playerEvents);
    expect(beforePlayer - playerState.players[1].hp).toBeCloseTo(DISCHARGE_DAMAGE * PLAYER_MODULE_FRIENDLY_DAMAGE_SCALE);

    const environmentState = createRun({ seed: 107, playerCount: 2 });
    clearArena(environmentState);
    const ei = Math.floor(environmentState.player.y) * environmentState.config.width + Math.floor(environmentState.player.x);
    environmentState.surface[ei] = SURF_BIOFLUID;
    environmentState.players[1].x = environmentState.player.x;
    environmentState.players[1].y = environmentState.player.y;
    const environmentEvents: SemanticEvent[] = [];
    dischargeAt(environmentState, Math.floor(environmentState.player.x), Math.floor(environmentState.player.y), environmentEvents);
    const beforeEnvironment = environmentState.players[1].hp;
    resolveChainedEvents(environmentState, environmentEvents);
    expect(beforeEnvironment - environmentState.players[1].hp).toBeCloseTo(DISCHARGE_DAMAGE);
  });

  it('hash autoritativo inclui cargas e reset descarta modulos e escolha pendente', () => {
    const state = createRun({ seed: 108 });
    const module = grantOrRechargeModule(state.playerExtra, 'piercing', state.tick);
    state.playerExtra.pendingModuleChoice = {
      sourceSiteId: 1,
      options: ['siphon', 'ricochet'],
      createdAtTick: state.tick,
    };
    const before = hashAuthoritativeState(state);
    if (module.lifetime.kind !== 'charges') throw new Error('piercing sem cargas');
    module.lifetime.remaining--;
    expect(hashAuthoritativeState(state)).not.toBe(before);

    resetPlayerProgress(state.playerExtra);
    expect(state.playerExtra.activeModules).toEqual([]);
    expect(state.playerExtra.pendingModuleChoice).toBeNull();
  });
});

describe('escolha por jogador e salvamento', () => {
  it('comando duplicado e idempotente e nao concede duas vezes', () => {
    const state = createRun({ seed: 201 });
    state.playerExtra.pendingModuleChoice = {
      sourceSiteId: 0,
      options: ['piercing', 'siphon'],
      createdAtTick: state.tick,
    };
    const choose = emptyCommand();
    choose.choose = 0;
    stepRun(state, [choose]);
    const first = JSON.stringify(state.playerExtra.activeModules);
    stepRun(state, [choose]);
    expect(JSON.stringify(state.playerExtra.activeModules)).toBe(first);
  });

  it('terminal revela apenas o cofre associado ao fim da varredura', () => {
    const state = createRun({ seed: 202 });
    const first = state.salvageSites[0];
    state.player.x = first.terminal.x + 0.5;
    state.player.y = first.terminal.y + 0.5;
    const interact = emptyCommand();
    interact.interact = true;
    stepRun(state, [interact]);
    expect(first.terminalState).toBe('scanning');
    expect(state.salvageSites.slice(1).every((site) => !site.cacheRevealed)).toBe(true);

    while (state.tick < first.scanEndsAt) stepRun(state, [emptyCommand()]);
    expect(first.terminalState).toBe('complete');
    expect(first.cacheRevealed).toBe(true);
    expect(state.salvageSites.slice(1).every((site) => !site.cacheRevealed)).toBe(true);
  });

  it('cofre concede exatamente uma Celula de Purga e somente ao abridor', () => {
    const state = createRun({ seed: 203, playerCount: 2 });
    const site = state.salvageSites[0];
    site.terminalState = 'complete';
    site.cacheRevealed = true;
    state.players[0].x = site.cache.x + 0.5;
    state.players[0].y = site.cache.y + 0.5;
    state.players[1].x = site.cache.x + 0.5;
    state.players[1].y = site.cache.y + 0.5;
    const before = state.playerExtras.map((extra) => extra.purgeCells);
    const interact = emptyCommand();
    interact.interact = true;
    stepRun(state, [interact, interact]);

    expect(state.playerExtras[0].purgeCells).toBe(before[0] + 1);
    expect(state.playerExtras[1].purgeCells).toBe(before[1]);
    expect(state.playerExtras[0].pendingModuleChoice).not.toBeNull();
    expect(state.playerExtras[1].pendingModuleChoice).toBeNull();
    expect(site.cacheOpened).toBe(true);
  });
});
