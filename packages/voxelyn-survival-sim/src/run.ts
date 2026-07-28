import { RNG } from '@voxelyn/core';
import {
  ABILITY_COOLDOWN_TICKS,
  ABILITY_KNOCKBACK,
  ABILITY_RADIUS,
  BLEEDOUT_TICKS,
  BOLT_COOLDOWN_TICKS,
  BOLT_DAMAGE,
  BOLT_SPEED,
  PURGE_CELL_HEAL,
  PURGE_CELL_RADIUS,
  CONTAMINATION_PER_TICK,
  DISCHARGE_DAMAGE,
  DODGE_COOLDOWN_TICKS,
  DODGE_IFRAME_TICKS,
  DODGE_SPEED,
  DODGE_TICKS,
  EXPLOSION_RADIUS,
  EXPLOSIVE_ARM_DISTANCE,
  EXTRACT_RADIUS,
  FIRE_DAMAGE_PER_TICK,
  GAS_DAMAGE_PER_TICK,
  SPORE_DAMAGE_PER_TICK,
  HEAT_DECAY_PER_TICK,
  HEAT_MAX,
  HEAT_PER_SHOT,
  MAX_PLAYERS,
  MAX_PROJECTILES,
  OVERHEAT_LOCK_TICKS,
  OVERHEAT_SELF_DAMAGE,
  PLAYER_HP,
  PLAYER_MODULE_FRIENDLY_DAMAGE_SCALE,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  REVIVE_HP_FRACTION,
  REVIVE_RADIUS,
  RETURN_DISC_MAX_DISTANCE,
  RETURN_DISC_SPEED,
  SALVAGE_SCAN_TICKS,
  RUN_SEED_MIX,
  SOLID_NONE,
  SURF_BIOFLUID,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_GAS,
  SURF_NONE,
  SURF_SPORES,
  TICK_HZ,
  WORLD_H,
  WORLD_W,
} from './constants.js';
import { dischargeAt, explodeAt, setSurface, stepCells } from './cells.js';
import { impactSolid, impactSurface, projectileClass } from './materials.js';
import {
  applyExplosionDamage,
  damageEntity,
  moveEntity,
  spawnEnemy,
  surfaceSpeedMul,
  updateEnemies,
} from './entities.js';
import { generateWorld } from './worldgen.js';
import {
  activeModule,
  consumeModuleCharge,
  expireTimedModules,
  grantOrRechargeModule,
  moduleHasCapacity,
  rollModuleChoice,
} from './modules.js';
import type {
  Entity,
  EnemyArchetype,
  PlayerCommand,
  PlayerExtra,
  RunConfig,
  SemanticEvent,
  StepResult,
  SurvivalSnapshot,
  SurvivalState,
} from './types.js';


export const emptyCommand = (): PlayerCommand => ({
  move: { x: 0, y: 0 },
  aim: { x: 1, y: 0 },
  fire: false,
  ability: false,
  dodge: false,
  interact: false,
  purge: false,
  choose: null,
});

const makePlayer = (slot: number, x: number, y: number): Entity => ({
  id: slot + 1,
  kind: 'player',
  archetype: 'prospector',
  x,
  y,
  vx: 0,
  vy: 0,
  hp: PLAYER_HP,
  maxHp: PLAYER_HP,
  radius: PLAYER_RADIUS,
  alive: true,
  elite: false,
  nextActionAt: 0,
  contactReadyAt: 0,
  rangedReadyAt: 0,
  stunnedUntil: 0,
  alertedUntil: 0,
  facing: { x: 1, y: 0 },
  slot,
});

const makeExtra = (): PlayerExtra => ({
  aim: { x: 1, y: 0 },
  heat: 0,
  overheatedUntil: 0,
  nextShotAt: 0,
  dodgeUntil: 0,
  iframesUntil: 0,
  dodgeCooldownUntil: 0,
  abilityCooldownUntil: 0,
  purgeCells: 1,
  activeModules: [],
  pendingModuleChoice: null,
  hasCore: false,
  dodgeDir: { x: 1, y: 0 },
  downed: false,
  bleedoutAt: 0,
  joined: true, // default seguro: solo/local ja esta em jogo
});

/**
 * Zera o estado PERSISTENTE de um slot (upgrades, inventario, nucleo), sem
 * tocar em posicao/vida — quem chama cuida disso. Usado quando um slot
 * abandonado e reocupado: o novo jogador nao pode herdar os modificadores,
 * os frascos nem a posse do nucleo de quem saiu.
 */
export const resetPlayerProgress = (extra: PlayerExtra): void => {
  extra.activeModules = [];
  extra.pendingModuleChoice = null;
  extra.purgeCells = 1;
  extra.hasCore = false;
  extra.heat = 0;
  extra.overheatedUntil = 0;
  extra.nextShotAt = 0;
  extra.dodgeUntil = 0;
  extra.iframesUntil = 0;
  extra.dodgeCooldownUntil = 0;
  extra.abilityCooldownUntil = 0;
  extra.aim = { x: 1, y: 0 };
  extra.dodgeDir = { x: 1, y: 0 };
};

export const createRun = (config: RunConfig): SurvivalState => {
  const width = config.width ?? WORLD_W;
  const height = config.height ?? WORLD_H;
  const playerCount = Math.max(1, Math.min(MAX_PLAYERS, config.playerCount ?? 1));
  const world = generateWorld((config.seed ^ RUN_SEED_MIX) >>> 0, width, height);
  const rng = new RNG((config.seed * 0x85ebca6b + 0xc2b2ae35) >>> 0 || 1);

  // posicoes de spawn proximas a entrada (deterministicas, sem sobrepor)
  const offsets = [
    { x: 0.5, y: 0.5 },
    { x: 1.5, y: 0.5 },
  ];
  const players: Entity[] = [];
  const playerExtras: PlayerExtra[] = [];
  for (let s = 0; s < playerCount; s++) {
    players.push(makePlayer(s, world.entry.x + offsets[s].x, world.entry.y + offsets[s].y));
    playerExtras.push(makeExtra());
  }

  const state: SurvivalState = {
    config: { seed: config.seed, width, height, playerCount },
    rng,
    tick: 0,
    phase: 'running',
    solid: world.solid,
    surface: world.surface,
    surfaceTimer: new Uint16Array(width * height),
    chunkVersion: new Uint32Array(Math.ceil(width / 16) * Math.ceil(height / 16)),
    entry: world.entry,
    corePos: world.corePos,
    coreTaken: false,
    guardianAwake: false,
    guardianSummoned: false,
    arenaClosed: false,
    arenaBarrierCells: [],
    guardianPath: [],
    guardianPathAt: -1000,
    leftEntryZone: false,
    players,
    playerExtras,
    player: players[0],
    playerExtra: playerExtras[0],
    enemies: [],
    projectiles: [],
    salvageSites: world.salvageSites.map((site) => ({
      ...site,
      terminalState: 'inactive' as const,
      scanEndsAt: 0,
      cacheRevealed: false,
      cacheOpened: false,
      openedBySlot: null,
    })),
    vents: world.ventPositions.map((p) => ({ x: p.x, y: p.y, nextEmitAt: 0 })),
    charges: [],
    contamination: 0,
    contaminationWaves: 0,
    // reserva todos os ids de player (1..playerCount) antes dos inimigos, para
    // que nenhum inimigo colida com um id de player nos snapshots por id
    nextEntityId: playerCount + 1,
    reactionQueue: [],
  };

  // popular inimigos: mistura deterministica, um elite no meio da lista
  const mix: EnemyArchetype[] = ['stalker', 'stalker', 'spitter', 'bruiser', 'stalker', 'spitter', 'bomber', 'bruiser', 'bomber', 'stalker'];
  const eliteIndex = Math.floor(world.enemySpawns.length / 2);
  world.enemySpawns.forEach((p, i) => {
    spawnEnemy(state, mix[i % mix.length], p.x, p.y, i === eliteIndex);
  });
  // Posicao reservada pelo worldgen com folga para o corpo grande do Guardian.
  spawnEnemy(state, 'guardian', world.guardianSpawn.x, world.guardianSpawn.y, false);

  return state;
};

/** Slots efetivamente em jogo (reivindicados por um jogador). */
export const joinedPlayers = (state: SurvivalState): Entity[] =>
  state.players.filter((p) => state.playerExtras[p.slot ?? 0].joined);

/** Players de pe (em jogo, vivos e nao abatidos). */
export const standingPlayers = (state: SurvivalState): Entity[] =>
  state.players.filter((p) => {
    const e = state.playerExtras[p.slot ?? 0];
    return e.joined && p.alive && !e.downed;
  });

/** Player de pe mais proximo de (x,y), ou null. */
export const nearestStandingPlayer = (state: SurvivalState, x: number, y: number): Entity | null => {
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const p of standingPlayers(state)) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
};

const cellIndexAt = (state: SurvivalState, x: number, y: number): number =>
  Math.floor(y) * state.config.width + Math.floor(x);

const applyCellHazards = (state: SurvivalState, events: SemanticEvent[]): void => {
  const targets = [...joinedPlayers(state), ...state.enemies];
  for (const ent of targets) {
    if (!ent.alive) continue;
    const surf = state.surface[cellIndexAt(state, ent.x, ent.y)];
    if (surf === SURF_FIRE) {
      damageEntity(state, ent, FIRE_DAMAGE_PER_TICK, events);
    } else if (surf === SURF_GAS && ent.kind === 'player') {
      // Gas sulfuroso e toxico; criaturas do Veio sao imunes ao proprio ambiente.
      damageEntity(state, ent, GAS_DAMAGE_PER_TICK, events);
    } else if (surf === SURF_SPORES && ent.kind === 'player') {
      // Esporos do bomber sao organicos e irritantes, mas nao volateis/explosivos.
      damageEntity(state, ent, SPORE_DAMAGE_PER_TICK, events);
    }
  }
};

/** Processa eventos encadeados (descargas e explosoes causam dano que gera novos eventos). */
export const resolveChainedEvents = (state: SurvivalState, events: SemanticEvent[]): void => {
  for (let i = 0; i < events.length && i < 512; i++) {
    const ev = events[i];
    if (ev.t === 'discharge') {
      const cells = new Set(ev.cells);
      for (const ent of [...joinedPlayers(state), ...state.enemies]) {
        if (!ent.alive) continue;
        if (!cells.has(cellIndexAt(state, ent.x, ent.y))) continue;
        const scale = ev.source === 'player' && ent.kind === 'player'
          ? PLAYER_MODULE_FRIENDLY_DAMAGE_SCALE
          : 1;
        damageEntity(state, ent, DISCHARGE_DAMAGE * scale, events);
      }
    } else if (ev.t === 'explosion') {
      applyExplosionDamage(
        state,
        ev.x,
        ev.y,
        ev.radius,
        events,
        ev.source === 'player' ? PLAYER_MODULE_FRIENDLY_DAMAGE_SCALE : 1
      );
    }
  }
};

const stepPlayer = (state: SurvivalState, slot: number, cmd: PlayerCommand, events: SemanticEvent[]): void => {
  const player = state.players[slot];
  const extra = state.playerExtras[slot];
  const dt = 1 / TICK_HZ;
  const coop = state.config.playerCount > 1;

  // slots nao reivindicados, abatidos e mortos nao agem
  if (!extra.joined || !player.alive || extra.downed) return;

  // Escolha privada do slot: idempotente e nao pausa movimento/simulacao.
  if (cmd.choose !== null && extra.pendingModuleChoice) {
    const pending = extra.pendingModuleChoice;
    const picked = pending.options[cmd.choose];
    const recharged = Boolean(activeModule(extra, picked));
    grantOrRechargeModule(extra, picked, state.tick);
    extra.pendingModuleChoice = null;
    events.push({
      t: 'module_selected',
      slot,
      module: picked,
      sourceSiteId: pending.sourceSiteId,
      recharged,
    });
  }

  // mira
  const aimLen = Math.hypot(cmd.aim.x, cmd.aim.y);
  if (aimLen > 0.01) {
    extra.aim.x = cmd.aim.x / aimLen;
    extra.aim.y = cmd.aim.y / aimLen;
    player.facing.x = extra.aim.x;
    player.facing.y = extra.aim.y;
  }

  // esquiva
  if (cmd.dodge && state.tick >= extra.dodgeCooldownUntil) {
    const moveLen = Math.hypot(cmd.move.x, cmd.move.y);
    const dir = moveLen > 0.01
      ? { x: cmd.move.x / moveLen, y: cmd.move.y / moveLen }
      : { x: player.facing.x, y: player.facing.y };
    extra.dodgeDir = dir;
    extra.dodgeUntil = state.tick + DODGE_TICKS;
    extra.iframesUntil = state.tick + DODGE_IFRAME_TICKS;
    extra.dodgeCooldownUntil = state.tick + DODGE_COOLDOWN_TICKS;
    events.push({ t: 'dodge', x: player.x, y: player.y });
  }

  // movimento
  if (state.tick < extra.dodgeUntil) {
    moveEntity(state, player, extra.dodgeDir.x * DODGE_SPEED * dt, extra.dodgeDir.y * DODGE_SPEED * dt);
  } else {
    const moveLen = Math.hypot(cmd.move.x, cmd.move.y);
    if (moveLen > 0.01) {
      const clamped = Math.min(1, moveLen);
      const nx = (cmd.move.x / moveLen) * clamped;
      const ny = (cmd.move.y / moveLen) * clamped;
      const speed = PLAYER_SPEED * surfaceSpeedMul(state, player);
      moveEntity(state, player, nx * speed * dt, ny * speed * dt);
    }
  }

  // extracao so libera depois de deixar a zona de entrada uma vez
  if (!state.leftEntryZone) {
    const distFromEntry = Math.hypot(player.x - (state.entry.x + 0.5), player.y - (state.entry.y + 0.5));
    if (distFromEntry > 4) state.leftEntryZone = true;
  }

  // calor decai
  extra.heat = Math.max(0, extra.heat - HEAT_DECAY_PER_TICK);

  // disparo principal
  if (
    cmd.fire &&
    state.tick >= extra.nextShotAt &&
    state.tick >= extra.overheatedUntil &&
    state.projectiles.length < MAX_PROJECTILES
  ) {
    extra.nextShotAt = state.tick + BOLT_COOLDOWN_TICKS;
    extra.heat += HEAT_PER_SHOT;

    const launchDisc = moduleHasCapacity(extra, 'return_disc', state.tick) &&
      consumeModuleCharge(extra, 'return_disc', slot, events);
    if (launchDisc) {
      state.projectiles.push({
        kind: 'return_disc',
        id: state.nextEntityId++,
        owner: player.id,
        x: player.x + extra.aim.x * 0.45,
        y: player.y + extra.aim.y * 0.45,
        vx: extra.aim.x * RETURN_DISC_SPEED,
        vy: extra.aim.y * RETURN_DISC_SPEED,
        damage: BOLT_DAMAGE * 0.85,
        distanceTravelled: 0,
        disc: {
          phase: 'outbound',
          travelled: 0,
          maxDistance: RETURN_DISC_MAX_DISTANCE,
          outboundHits: [],
          returnHits: [],
        },
        hostile: false,
        leavesBiofluid: false,
        ttl: Math.ceil(TICK_HZ * 3),
      });
    } else {
      const modules: NonNullable<SurvivalState['projectiles'][number]['modules']> = {};
      if (moduleHasCapacity(extra, 'piercing', state.tick) && consumeModuleCharge(extra, 'piercing', slot, events)) {
        modules.piercing = true;
      }
      if (moduleHasCapacity(extra, 'explosive', state.tick) && consumeModuleCharge(extra, 'explosive', slot, events)) {
        modules.explosive = { armAfterDistance: EXPLOSIVE_ARM_DISTANCE };
      }
      if (moduleHasCapacity(extra, 'ricochet', state.tick) && consumeModuleCharge(extra, 'ricochet', slot, events)) {
        modules.ricochet = { remainingBounces: 1 };
      }
      if (moduleHasCapacity(extra, 'conductive', state.tick)) modules.conductive = true;
      if (moduleHasCapacity(extra, 'siphon', state.tick)) modules.siphon = true;

      state.projectiles.push({
        kind: 'bolt',
        id: state.nextEntityId++,
        owner: player.id,
        x: player.x + extra.aim.x * 0.4,
        y: player.y + extra.aim.y * 0.4,
        vx: extra.aim.x * BOLT_SPEED,
        vy: extra.aim.y * BOLT_SPEED,
        damage: BOLT_DAMAGE,
        modules: Object.keys(modules).length > 0 ? modules : undefined,
        distanceTravelled: 0,
        hostile: false,
        leavesBiofluid: false,
        ttl: Math.ceil(TICK_HZ * 1.4),
      });
    }
    events.push({
      t: 'action_start', entity: player.id, action: 'player_shot', x: player.x, y: player.y,
      dx: extra.aim.x, dy: extra.aim.y, startTick: state.tick, releaseTick: state.tick, endTick: state.tick + 7,
    });
    events.push({ t: 'shot', x: player.x, y: player.y, dx: extra.aim.x, dy: extra.aim.y, owner: player.id });
    if (extra.heat >= HEAT_MAX) {
      extra.overheatedUntil = state.tick + OVERHEAT_LOCK_TICKS;
      extra.heat = HEAT_MAX * 0.55;
      damageEntity(state, player, OVERHEAT_SELF_DAMAGE, events);
      events.push({ t: 'overheat', x: player.x, y: player.y });
    }
  }

  // habilidade: pulso cinetico (empurra criaturas, apaga fogo, dissipa gas)
  if (cmd.ability && state.tick >= extra.abilityCooldownUntil) {
    extra.abilityCooldownUntil = state.tick + ABILITY_COOLDOWN_TICKS;
    events.push({
      t: 'action_start', entity: player.id, action: 'pulse', x: player.x, y: player.y,
      dx: player.facing.x, dy: player.facing.y, startTick: state.tick, releaseTick: state.tick, endTick: state.tick + 8,
    });
    events.push({ t: 'pulse', x: player.x, y: player.y });
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d <= ABILITY_RADIUS && d > 0.001) {
        enemy.vx += (dx / d) * ABILITY_KNOCKBACK * TICK_HZ * 0.25;
        enemy.vy += (dy / d) * ABILITY_KNOCKBACK * TICK_HZ * 0.25;
        enemy.stunnedUntil = state.tick + 6;
      }
    }
    const w = state.config.width;
    const r = Math.ceil(ABILITY_RADIUS);
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    for (let y = py - r; y <= py + r; y++) {
      for (let x = px - r; x <= px + r; x++) {
        if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
        const dx = x + 0.5 - player.x;
        const dy = y + 0.5 - player.y;
        if (dx * dx + dy * dy > ABILITY_RADIUS * ABILITY_RADIUS) continue;
        const i = y * w + x;
        if (state.surface[i] === SURF_FIRE || state.surface[i] === SURF_GAS || state.surface[i] === SURF_SPORES) {
          setSurface(state, i, SURF_NONE, 0);
        }
      }
    }
  }

  // Celula de Purga: cartucho interno de cura e descontaminacao.
  if (cmd.purge && extra.purgeCells > 0) {
    extra.purgeCells--;
    player.hp = Math.min(player.maxHp, player.hp + PURGE_CELL_HEAL);
    const w = state.config.width;
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    for (let y = py - PURGE_CELL_RADIUS; y <= py + PURGE_CELL_RADIUS; y++) {
      for (let x = px - PURGE_CELL_RADIUS; x <= px + PURGE_CELL_RADIUS; x++) {
        if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
        const i = y * w + x;
        if (state.surface[i] === SURF_GAS || state.surface[i] === SURF_SPORES) {
          setSurface(state, i, SURF_NONE, 0);
        }
      }
    }
    events.push({ t: 'purge_cell_used', slot, x: player.x, y: player.y });
  }

  // interagir: revive parceiro > nucleo > terminal/cofre > extracao
  if (cmd.interact) {
    // co-op: reviver parceiro abatido proximo tem prioridade
    if (coop) {
      for (let other = 0; other < state.players.length; other++) {
        if (other === slot) continue;
        const op = state.players[other];
        const oe = state.playerExtras[other];
        if (!oe.joined || !op.alive || !oe.downed) continue;
        if (Math.hypot(player.x - op.x, player.y - op.y) <= REVIVE_RADIUS) {
          oe.downed = false;
          oe.bleedoutAt = 0;
          op.hp = Math.max(1, Math.floor(op.maxHp * REVIVE_HP_FRACTION));
          events.push({ t: 'revive', x: op.x, y: op.y, slot: other, tick: state.tick });
          events.push({ t: 'message', text: `Parceiro revivido.` });
          return;
        }
      }
    }

    const distCore = Math.hypot(player.x - (state.corePos.x + 0.5), player.y - (state.corePos.y + 0.5));
    if (!state.coreTaken && distCore < 1.6) {
      state.coreTaken = true;
      extra.hasCore = true;
      events.push({ t: 'pickup_core', x: player.x, y: player.y });
      events.push({ t: 'message', text: 'Nucleo extraido. O Veio despertou - volte para a entrada!' });
      return;
    }
    for (const site of state.salvageSites) {
      const terminalDistance = Math.hypot(
        player.x - (site.terminal.x + 0.5),
        player.y - (site.terminal.y + 0.5)
      );
      if (site.terminalState === 'inactive' && terminalDistance < 1.45) {
        site.terminalState = 'scanning';
        site.scanEndsAt = state.tick + SALVAGE_SCAN_TICKS;
        events.push({
          t: 'terminal_activated',
          siteId: site.id,
          x: site.terminal.x,
          y: site.terminal.y,
          completesAtTick: site.scanEndsAt,
        });
        const offsets = [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, 2]] as const;
        let spawned = 0;
        for (let i = 0; i < offsets.length && spawned < 2 + site.tier; i++) {
          const [dx, dy] = offsets[(i + site.id) % offsets.length];
          const x = site.terminal.x + dx;
          const y = site.terminal.y + dy;
          if (x < 1 || y < 1 || x >= state.config.width - 1 || y >= state.config.height - 1) continue;
          if (state.solid[y * state.config.width + x] !== SOLID_NONE) continue;
          spawnEnemy(state, spawned === 0 && site.tier > 1 ? 'spitter' : 'stalker', x, y, false);
          spawned++;
        }
        return;
      }

      const cacheDistance = Math.hypot(
        player.x - (site.cache.x + 0.5),
        player.y - (site.cache.y + 0.5)
      );
      if (site.cacheRevealed && !site.cacheOpened && cacheDistance < 1.35) {
        site.cacheOpened = true;
        site.openedBySlot = slot;
        extra.purgeCells++;
        const options = rollModuleChoice(state.config.seed, site.id, site.tier, extra, state.tick);
        extra.pendingModuleChoice = {
          sourceSiteId: site.id,
          options,
          createdAtTick: state.tick,
        };
        events.push({ t: 'salvage_cache_opened', siteId: site.id, slot, x: site.cache.x, y: site.cache.y });
        events.push({ t: 'purge_cell_acquired', slot, amount: 1 });
        return;
      }
    }
    // extracao coletiva: todos os players de pe precisam estar na zona de entrada
    const distEntry = Math.hypot(player.x - (state.entry.x + 0.5), player.y - (state.entry.y + 0.5));
    if (distEntry < 1.6 && state.leftEntryZone) {
      const allAtEntry = standingPlayers(state).every(
        (p) => Math.hypot(p.x - (state.entry.x + 0.5), p.y - (state.entry.y + 0.5)) <= EXTRACT_RADIUS
      );
      const anyDowned = state.playerExtras.some((e, i) => e.joined && state.players[i].alive && e.downed);
      if (allAtEntry && !anyDowned) {
        const withCore = state.playerExtras.some((e) => e.hasCore);
        state.phase = withCore ? 'extracted_with_core' : 'extracted';
        events.push({ t: 'extracted', withCore });
      } else if (anyDowned) {
        events.push({ t: 'message', text: 'Revele o parceiro abatido antes de extrair.' });
      } else {
        events.push({ t: 'message', text: 'Aguarde todos na saida para extrair.' });
      }
    }
  }
};

const stepProjectiles = (state: SurvivalState, events: SemanticEvent[]): void => {
  const dt = 1 / TICK_HZ;
  const w = state.config.width;
  const survivors: typeof state.projectiles = [];

  for (const proj of state.projectiles) {
    let dead = false;
    proj.ttl--;
    if (proj.ttl <= 0) {
      if (proj.leavesBiofluid) {
        const i = cellIndexAt(state, proj.x, proj.y);
        if (state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
          setSurface(state, i, SURF_BIOFLUID, 0);
        }
      }
      continue;
    }

    const owner = state.players.find((player) => player.id === proj.owner);
    const ownerSlot = owner?.slot;
    const ownerExtra = ownerSlot === undefined ? undefined : state.playerExtras[ownerSlot];
    const origin = proj.hostile
      ? { source: 'enemy' as const, owner: proj.owner }
      : owner
        ? { source: 'player' as const, owner: proj.owner }
        : { source: 'environment' as const };

    // Return Disc follows the owner's current position on the return leg.
    if (proj.disc?.phase === 'returning') {
      if (!owner || !ownerExtra?.joined || !owner.alive) continue;
      const dx = owner.x - proj.x;
      const dy = owner.y - proj.y;
      const length = Math.hypot(dx, dy);
      if (length < owner.radius + 0.35) continue;
      proj.vx = (dx / Math.max(length, 0.001)) * RETURN_DISC_SPEED;
      proj.vy = (dy / Math.max(length, 0.001)) * RETURN_DISC_SPEED;
    }

    // 2 sub-passos anti-tunelamento.
    for (let sub = 0; sub < 2 && !dead; sub++) {
      const prevX = proj.x;
      const prevY = proj.y;
      const stepX = proj.vx * dt * 0.5;
      const stepY = proj.vy * dt * 0.5;
      proj.x += stepX;
      proj.y += stepY;
      const travelled = Math.hypot(stepX, stepY);
      proj.distanceTravelled += travelled;
      if (proj.disc?.phase === 'outbound') {
        proj.disc.travelled += travelled;
        if (proj.disc.travelled >= proj.disc.maxDistance) {
          proj.disc.phase = 'returning';
        }
      }

      const cx = Math.floor(proj.x);
      const cy = Math.floor(proj.y);
      if (cx < 0 || cy < 0 || cx >= w || cy >= state.config.height) {
        if (proj.disc?.phase === 'outbound') {
          proj.x = prevX;
          proj.y = prevY;
          proj.disc.phase = 'returning';
          break;
        }
        dead = true;
        break;
      }
      const i = cy * w + cx;
      const explosiveArmed = Boolean(
        proj.modules?.explosive && proj.distanceTravelled >= proj.modules.explosive.armAfterDistance
      );
      const conductiveReady = Boolean(
        proj.modules?.conductive && ownerExtra && moduleHasCapacity(ownerExtra, 'conductive', state.tick)
      );
      const cls = projectileClass(proj, conductiveReady);

      if (state.solid[i] !== SOLID_NONE) {
        if (proj.disc) {
          proj.x = prevX;
          proj.y = prevY;
          proj.disc.phase = 'returning';
          break;
        }

        if (proj.modules?.ricochet && proj.modules.ricochet.remainingBounces > 0) {
          const enteredX = Math.floor(prevX) !== cx;
          const enteredY = Math.floor(prevY) !== cy;
          if (enteredX) proj.vx *= -1;
          if (enteredY) proj.vy *= -1;
          if (!enteredX && !enteredY) {
            if (Math.abs(proj.vx) >= Math.abs(proj.vy)) proj.vx *= -1;
            else proj.vy *= -1;
          }
          proj.x = prevX;
          proj.y = prevY;
          proj.modules.ricochet.remainingBounces--;
          break;
        }

        if (explosiveArmed && !proj.hostile) {
          explodeAt(state, proj.x, proj.y, EXPLOSION_RADIUS, events, origin);
          dead = true;
          break;
        }

        const eventStart = events.length;
        const { stop, broke } = impactSolid(state, cx, cy, cls, events, origin);
        if (
          conductiveReady && ownerExtra && ownerSlot !== undefined &&
          events.slice(eventStart).some((event) => event.t === 'discharge')
        ) {
          consumeModuleCharge(ownerExtra, 'conductive', ownerSlot, events);
        }
        if (stop && !(broke && proj.modules?.piercing)) dead = true;
        break;
      }

      const surfaceBeforeImpact = state.surface[i];
      const heatsFungal =
        cls === 'thermal' &&
        (surfaceBeforeImpact === SURF_FUNGAL || surfaceBeforeImpact === SURF_FUNGAL_HEATED);
      const alreadyHeatedHere = heatsFungal && proj.heatedSurfaceCells?.includes(i);

      if (!alreadyHeatedHere) {
        const eventStart = events.length;
        const consumedBySurface = impactSurface(state, cx, cy, cls, events, origin);
        if (
          conductiveReady && ownerExtra && ownerSlot !== undefined &&
          events.slice(eventStart).some((event) => event.t === 'discharge')
        ) {
          consumeModuleCharge(ownerExtra, 'conductive', ownerSlot, events);
        }
        if (heatsFungal) (proj.heatedSurfaceCells ??= []).push(i);
        if (consumedBySurface) {
          dead = true;
          break;
        }
      }

      if (
        conductiveReady && ownerExtra && ownerSlot !== undefined &&
        state.surface[i] === SURF_BIOFLUID &&
        consumeModuleCharge(ownerExtra, 'conductive', ownerSlot, events)
      ) {
        dischargeAt(state, cx, cy, events, origin);
        dead = true;
        break;
      }

      if (proj.hostile) {
        for (const player of state.players) {
          const extra = state.playerExtras[player.slot ?? 0];
          if (!extra.joined || !player.alive || extra.downed) continue;
          if (Math.hypot(player.x - proj.x, player.y - proj.y) < player.radius + 0.2) {
            damageEntity(state, player, proj.damage, events);
            if (proj.leavesBiofluid && state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
              setSurface(state, i, SURF_BIOFLUID, 0);
            }
            dead = true;
            break;
          }
        }
        if (dead) break;
      } else {
        for (const enemy of state.enemies) {
          if (!enemy.alive) continue;
          const discHits = proj.disc
            ? (proj.disc.phase === 'outbound' ? proj.disc.outboundHits : proj.disc.returnHits)
            : undefined;
          if (discHits?.includes(enemy.id) || proj.hits?.includes(enemy.id)) continue;
          if (Math.hypot(enemy.x - proj.x, enemy.y - proj.y) >= enemy.radius + 0.2) continue;

          let damage = proj.damage;
          const enemyCell = cellIndexAt(state, enemy.x, enemy.y);
          if (
            proj.modules?.conductive && ownerExtra && ownerSlot !== undefined &&
            state.surface[enemyCell] === SURF_BIOFLUID &&
            moduleHasCapacity(ownerExtra, 'conductive', state.tick) &&
            consumeModuleCharge(ownerExtra, 'conductive', ownerSlot, events)
          ) {
            damage *= 1.6;
            dischargeAt(state, Math.floor(enemy.x), Math.floor(enemy.y), events, origin);
          }
          damageEntity(state, enemy, damage, events);

          if (
            proj.modules?.siphon && owner && ownerExtra && ownerSlot !== undefined &&
            owner.hp < owner.maxHp && moduleHasCapacity(ownerExtra, 'siphon', state.tick) &&
            consumeModuleCharge(ownerExtra, 'siphon', ownerSlot, events)
          ) {
            owner.hp = Math.min(owner.maxHp, owner.hp + 2);
          }

          if (explosiveArmed) {
            explodeAt(state, proj.x, proj.y, EXPLOSION_RADIUS, events, origin);
            dead = true;
          } else if (proj.disc) {
            discHits?.push(enemy.id);
          } else if (proj.modules?.piercing) {
            (proj.hits ??= []).push(enemy.id);
          } else {
            dead = true;
          }
          break;
        }
      }
    }

    if (dead && proj.leavesBiofluid) {
      const i = cellIndexAt(state, proj.x, proj.y);
      if (i >= 0 && i < state.solid.length && state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
        setSurface(state, i, SURF_BIOFLUID, 0);
      }
    }
    if (!dead) survivors.push(proj);
  }
  state.projectiles = survivors;
};


const stepSalvageSites = (state: SurvivalState, events: SemanticEvent[]): void => {
  for (const site of state.salvageSites) {
    if (site.terminalState !== 'scanning' || state.tick < site.scanEndsAt) continue;
    site.terminalState = 'complete';
    site.cacheRevealed = true;
    events.push({
      t: 'terminal_scan_complete',
      siteId: site.id,
      x: site.terminal.x,
      y: site.terminal.y,
    });
    events.push({
      t: 'salvage_cache_revealed',
      siteId: site.id,
      x: site.cache.x,
      y: site.cache.y,
    });
  }
};

/** Ondas de pressao por contaminacao (thresholds unicos). */
const stepContamination = (state: SurvivalState, events: SemanticEvent[]): void => {
  state.contamination = Math.min(1, state.contamination + CONTAMINATION_PER_TICK * (state.coreTaken ? 2.2 : 1));
  const thresholds: Array<[number, number]> = [
    [0.35, 2],
    [0.6, 3],
    [0.85, 4],
  ];
  for (let w = 0; w < thresholds.length; w++) {
    const [level, count] = thresholds[w];
    // contador one-shot: vents sao reescritos por stepCells, entao um sentinel
    // ali seria apagado e a onda dispararia repetidamente.
    if (state.contamination >= level && state.contaminationWaves <= w) {
      state.contaminationWaves = w + 1;
      events.push({ t: 'message', text: 'O Veio se agita - a contaminacao aumenta.' });
      let spawned = 0;
      for (let attempt = 0; attempt < 80 && spawned < count; attempt++) {
        const x = state.rng.nextInt(state.config.width);
        const y = state.rng.nextInt(state.config.height);
        const i = y * state.config.width + x;
        if (state.solid[i] !== SOLID_NONE) continue;
        const ref = nearestStandingPlayer(state, x + 0.5, y + 0.5) ?? state.players[0];
        const d = Math.hypot(x + 0.5 - ref.x, y + 0.5 - ref.y);
        if (d < 11 || d > 26) continue;
        spawnEnemy(state, spawned % 2 === 0 ? 'stalker' : 'bomber', x, y, false);
        spawned++;
      }
    }
  }
};

/** Converte players com hp<=0 em abatidos (co-op) ou mortos; encerra a run se todos cairem. */
/**
 * Mata o player do slot e DEVOLVE o nucleo ao mundo se ele o carregava.
 * Sem isso o morto continua com hasCore: ele sai de standingPlayers e de
 * anyDowned, mas a extracao calcula withCore sobre TODOS os extras, entao o
 * parceiro sairia sozinho com 'extracted_with_core' sem nunca ter o nucleo.
 */
const killPlayer = (state: SurvivalState, slot: number, events: SemanticEvent[]): void => {
  const p = state.players[slot];
  const e = state.playerExtras[slot];
  p.alive = false;
  e.activeModules = [];
  e.pendingModuleChoice = null;
  if (e.hasCore) {
    e.hasCore = false;
    state.coreTaken = false; // volta ao pedestal, recuperavel pelo parceiro
    events.push({ t: 'message', text: 'O nucleo caiu com o portador.' });
  }
  events.push({
    t: 'death', x: p.x, y: p.y, entity: p.id, archetype: 'prospector',
    facingX: p.facing.x, facingY: p.facing.y, tick: state.tick,
  });
};

const resolveDownedAndDeaths = (state: SurvivalState, events: SemanticEvent[]): void => {
  for (let slot = 0; slot < state.players.length; slot++) {
    const p = state.players[slot];
    const e = state.playerExtras[slot];
    if (!e.joined || !p.alive) continue;

    if (e.downed) {
      // abatido morre ao esgotar o tempo de sangramento
      if (state.tick >= e.bleedoutAt) {
        killPlayer(state, slot, events);
      }
      continue;
    }

    if (p.hp <= 0) {
      p.hp = 0;
      const hasStandingAlly = state.players.some(
        (o, i) => i !== slot && state.playerExtras[i].joined && o.alive && !state.playerExtras[i].downed
      );
      if (hasStandingAlly) {
        // co-op: entra em estado abatido, revivel pelo parceiro
        e.downed = true;
        e.bleedoutAt = state.tick + BLEEDOUT_TICKS;
        events.push({
          t: 'player_down', slot, x: p.x, y: p.y,
          facingX: p.facing.x, facingY: p.facing.y, tick: state.tick,
        });
      } else {
        events.push({
          t: 'player_down', slot, x: p.x, y: p.y,
          facingX: p.facing.x, facingY: p.facing.y, tick: state.tick,
        });
        killPlayer(state, slot, events);
      }
    }
  }

  // run acaba quando nenhum player pode continuar (todos mortos ou abatidos)
  const joined = state.players.filter((_, i) => state.playerExtras[i].joined);
  const anyActive = joined.some((p) => p.alive && !state.playerExtras[p.slot ?? 0].downed);
  if (joined.length > 0 && !anyActive) {
    state.phase = 'dead';
  }
};

export const stepRun = (state: SurvivalState, commands: readonly PlayerCommand[]): StepResult => {
  const events: SemanticEvent[] = [];

  if (state.phase === 'dead' || state.phase === 'extracted' || state.phase === 'extracted_with_core') {
    return { state, events };
  }

  state.tick++;

  for (let slot = 0; slot < state.players.length; slot++) {
    expireTimedModules(state.playerExtras[slot], state.tick, slot, events);
    stepPlayer(state, slot, commands[slot] ?? emptyCommand(), events);
    if (state.phase !== 'running') {
      resolveChainedEvents(state, events);
      resolveDownedAndDeaths(state, events);
      return { state, events };
    }
  }

  stepSalvageSites(state, events);
  stepProjectiles(state, events);
  updateEnemies(state, events);
  stepCells(state, events);
  applyCellHazards(state, events);
  stepContamination(state, events);
  resolveChainedEvents(state, events);
  resolveDownedAndDeaths(state, events);

  return { state, events };
};

export const createSnapshot = (state: SurvivalState, viewerId?: string): SurvivalSnapshot => {
  void viewerId; // filtragem por viewer fica a cargo do servidor
  return {
    tick: state.tick,
    phase: state.phase,
    player: {
      x: state.player.x,
      y: state.player.y,
      hp: state.player.hp,
      heat: state.playerExtra.heat,
      hasCore: state.playerExtra.hasCore,
    },
    players: joinedPlayers(state).map((p) => {
      const i = p.slot ?? 0;
      return {
        slot: i,
        x: p.x,
        y: p.y,
        hp: p.hp,
        maxHp: p.maxHp,
        heat: state.playerExtras[i].heat,
        hasCore: state.playerExtras[i].hasCore,
        downed: state.playerExtras[i].downed,
        alive: p.alive,
      };
    }),
    enemyCount: state.enemies.filter((e) => e.alive).length,
    contamination: state.contamination,
  };
};

/** FNV-1a 32-bit sobre o estado autoritativo. */
export const hashAuthoritativeState = (state: SurvivalState): string => {
  let h = 0x811c9dc5;
  const mix = (v: number): void => {
    h ^= v & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 16) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 24) & 0xff;
    h = Math.imul(h, 0x01000193);
  };
  const mixString = (value: string): void => {
    mix(value.length);
    for (let i = 0; i < value.length; i++) mix(value.charCodeAt(i));
  };

  mix(state.tick);
  mixString(state.phase);
  for (let i = 0; i < state.solid.length; i++) mix(state.solid[i] | (state.surface[i] << 8));
  for (let slot = 0; slot < state.players.length; slot++) {
    const p = state.players[slot];
    const e = state.playerExtras[slot];
    if (!e.joined) continue;
    mix(slot);
    mix(Math.round(p.x * 1000));
    mix(Math.round(p.y * 1000));
    mix(Math.round(p.hp * 100));
    mix(p.alive ? 1 : 0);
    mix(e.downed ? 1 : 0);
    mix(Math.round(e.heat * 100));
    mix(e.purgeCells);
    mix(e.activeModules.length);
    for (const module of e.activeModules) {
      mixString(module.id);
      mixString(module.lifetime.kind);
      if (module.lifetime.kind === 'charges') {
        mix(module.lifetime.remaining);
        mix(module.lifetime.maximum);
      } else {
        mix(module.lifetime.acquiredAtTick);
        mix(module.lifetime.expiresAtTick);
      }
    }
    if (e.pendingModuleChoice) {
      mix(1);
      mix(e.pendingModuleChoice.sourceSiteId);
      mix(e.pendingModuleChoice.createdAtTick);
      mixString(e.pendingModuleChoice.options[0]);
      mixString(e.pendingModuleChoice.options[1]);
    } else {
      mix(0);
    }
  }
  for (const site of state.salvageSites) {
    mix(site.id);
    mix(site.tier);
    mixString(site.terminalState);
    mix(site.scanEndsAt);
    mix(site.cacheRevealed ? 1 : 0);
    mix(site.cacheOpened ? 1 : 0);
    mix(site.openedBySlot ?? -1);
  }
  mix(state.coreTaken ? 1 : 0);
  mix(Math.round(state.contamination * 100000));
  mix(state.contaminationWaves);
  mix(state.guardianSummoned ? 1 : 0);
  mix(state.arenaClosed ? 1 : 0);
  mix(state.arenaBarrierCells.length);
  for (const cell of state.arenaBarrierCells) mix(cell);
  for (const enemy of state.enemies) {
    mix(enemy.id);
    mix(Math.round(enemy.x * 1000));
    mix(Math.round(enemy.y * 1000));
    mix(Math.round(enemy.hp * 100));
    mix(enemy.alive ? 1 : 0);
    if (enemy.action) {
      mixString(enemy.action.kind);
      mix(enemy.action.startedAt);
      mix(enemy.action.releaseAt);
      mix(enemy.action.endsAt);
      mix(Math.round(enemy.action.direction.x * 1000));
      mix(Math.round(enemy.action.direction.y * 1000));
    }
  }
  for (const proj of state.projectiles) {
    mix(proj.id);
    mixString(proj.kind);
    mix(proj.owner);
    mix(Math.round(proj.x * 1000));
    mix(Math.round(proj.y * 1000));
    mix(Math.round(proj.vx * 1000));
    mix(Math.round(proj.vy * 1000));
    mix(Math.round(proj.distanceTravelled * 1000));
    mix(proj.ttl);
    mix(proj.modules?.piercing ? 1 : 0);
    mix(proj.modules?.conductive ? 1 : 0);
    mix(proj.modules?.siphon ? 1 : 0);
    mix(proj.modules?.explosive ? Math.round(proj.modules.explosive.armAfterDistance * 1000) : 0);
    mix(proj.modules?.ricochet?.remainingBounces ?? 0);
    if (proj.disc) {
      mixString(proj.disc.phase);
      mix(Math.round(proj.disc.travelled * 1000));
      mix(proj.disc.outboundHits.length);
      for (const id of proj.disc.outboundHits) mix(id);
      mix(proj.disc.returnHits.length);
      for (const id of proj.disc.returnHits) mix(id);
    }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};

/** Hash FNV-1a das camadas estaticas iniciais (validacao de geracao local no cliente). */
export const hashStaticWorld = (state: SurvivalState): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < state.solid.length; i++) {
    const v = state.solid[i] | (state.surface[i] << 8);
    h ^= v & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};
