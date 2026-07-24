import { RNG } from '@voxelyn/core';
import {
  ABILITY_COOLDOWN_TICKS,
  ABILITY_KNOCKBACK,
  ABILITY_RADIUS,
  BLEEDOUT_TICKS,
  BOLT_COOLDOWN_TICKS,
  BOLT_DAMAGE,
  BOLT_SPEED,
  CONSUMABLE_HEAL,
  CONSUMABLE_PURGE_RADIUS,
  CONTAMINATION_PER_TICK,
  DISCHARGE_DAMAGE,
  DODGE_COOLDOWN_TICKS,
  DODGE_IFRAME_TICKS,
  DODGE_SPEED,
  DODGE_TICKS,
  EXPLOSION_DAMAGE,
  EXPLOSION_RADIUS,
  EXTRACT_RADIUS,
  FIRE_DAMAGE_PER_TICK,
  GAS_DAMAGE_PER_TICK,
  HEAT_DECAY_PER_TICK,
  HEAT_MAX,
  HEAT_PER_SHOT,
  MAX_PLAYERS,
  MAX_PROJECTILES,
  OVERHEAT_LOCK_TICKS,
  OVERHEAT_SELF_DAMAGE,
  PLAYER_HP,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  REVIVE_HP_FRACTION,
  REVIVE_RADIUS,
  RUN_SEED_MIX,
  SOLID_NONE,
  SURF_BIOFLUID,
  SURF_FIRE,
  SURF_GAS,
  SURF_NONE,
  TICK_HZ,
  WORLD_H,
  WORLD_W,
} from './constants';
import { breakSolid, dischargeAt, explodeAt, setSurface, stepCells } from './cells';
import {
  applyExplosionDamage,
  damageEntity,
  moveEntity,
  spawnEnemy,
  surfaceSpeedMul,
  updateEnemies,
} from './entities';
import { generateWorld } from './worldgen';
import type {
  Entity,
  EnemyArchetype,
  ModifierId,
  PlayerCommand,
  PlayerExtra,
  RunConfig,
  SemanticEvent,
  StepResult,
  SurvivalSnapshot,
  SurvivalState,
} from './types';

const MODIFIER_POOL: ModifierId[] = ['piercing', 'conductive', 'explosive', 'siphon'];

export const emptyCommand = (): PlayerCommand => ({
  move: { x: 0, y: 0 },
  aim: { x: 1, y: 0 },
  fire: false,
  ability: false,
  dodge: false,
  interact: false,
  consume: false,
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
  consumables: 1,
  modifiers: [],
  hasCore: false,
  dodgeDir: { x: 1, y: 0 },
  downed: false,
  bleedoutAt: 0,
});

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
    leftEntryZone: false,
    players,
    playerExtras,
    player: players[0],
    playerExtra: playerExtras[0],
    enemies: [],
    projectiles: [],
    caches: world.cachePositions.map((p) => ({ x: p.x, y: p.y, opened: false, options: null })),
    vents: world.ventPositions.map((p) => ({ x: p.x, y: p.y, nextEmitAt: 0 })),
    charges: [],
    pendingChoice: null,
    contamination: 0,
    nextEntityId: 2,
    reactionQueue: [],
  };

  // popular inimigos: mistura deterministica, um elite no meio da lista
  const mix: EnemyArchetype[] = ['stalker', 'stalker', 'spitter', 'bruiser', 'stalker', 'spitter', 'bomber', 'bruiser', 'bomber', 'stalker'];
  const eliteIndex = Math.floor(world.enemySpawns.length / 2);
  world.enemySpawns.forEach((p, i) => {
    spawnEnemy(state, mix[i % mix.length], p.x, p.y, i === eliteIndex);
  });
  // guardiao ao lado do nucleo
  spawnEnemy(state, 'guardian', world.corePos.x + 1, world.corePos.y + 1, false);

  return state;
};

/** Players de pe (vivos e nao abatidos). */
export const standingPlayers = (state: SurvivalState): Entity[] =>
  state.players.filter((p) => p.alive && !state.playerExtras[p.slot ?? 0].downed);

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
  const targets = [...state.players, ...state.enemies];
  for (const ent of targets) {
    if (!ent.alive) continue;
    const surf = state.surface[cellIndexAt(state, ent.x, ent.y)];
    if (surf === SURF_FIRE) {
      damageEntity(state, ent, FIRE_DAMAGE_PER_TICK, events);
    } else if (surf === SURF_GAS && ent.kind === 'player') {
      // esporos afetam o prospector (criaturas do Veio sao imunes)
      damageEntity(state, ent, GAS_DAMAGE_PER_TICK, events);
    }
  }
};

/** Processa eventos encadeados (descargas e explosoes causam dano que gera novos eventos). */
export const resolveChainedEvents = (state: SurvivalState, events: SemanticEvent[]): void => {
  for (let i = 0; i < events.length && i < 512; i++) {
    const ev = events[i];
    if (ev.t === 'discharge') {
      const cells = new Set(ev.cells);
      for (const ent of [...state.players, ...state.enemies]) {
        if (!ent.alive) continue;
        if (cells.has(cellIndexAt(state, ent.x, ent.y))) {
          damageEntity(state, ent, DISCHARGE_DAMAGE, events);
        }
      }
    } else if (ev.t === 'explosion') {
      applyExplosionDamage(state, ev.x, ev.y, ev.radius, events);
    }
  }
};

const grantModifier = (extra: PlayerExtra, picked: ModifierId): void => {
  if (!extra.modifiers.includes(picked)) extra.modifiers.push(picked);
};

const rollTwoModifiers = (state: SurvivalState): [ModifierId, ModifierId] => {
  const first = MODIFIER_POOL[state.rng.nextInt(MODIFIER_POOL.length)];
  let second = MODIFIER_POOL[state.rng.nextInt(MODIFIER_POOL.length)];
  while (second === first) second = MODIFIER_POOL[state.rng.nextInt(MODIFIER_POOL.length)];
  return [first, second];
};

const stepPlayer = (state: SurvivalState, slot: number, cmd: PlayerCommand, events: SemanticEvent[]): void => {
  const player = state.players[slot];
  const extra = state.playerExtras[slot];
  const dt = 1 / TICK_HZ;
  const coop = state.players.length > 1;

  // abatidos nao agem (aguardam revive); mortos idem
  if (!player.alive || extra.downed) return;

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
    state.projectiles.push({
      id: state.nextEntityId++,
      owner: player.id,
      x: player.x + extra.aim.x * 0.4,
      y: player.y + extra.aim.y * 0.4,
      vx: extra.aim.x * BOLT_SPEED,
      vy: extra.aim.y * BOLT_SPEED,
      damage: BOLT_DAMAGE,
      piercing: extra.modifiers.includes('piercing'),
      conductive: extra.modifiers.includes('conductive'),
      explosive: extra.modifiers.includes('explosive'),
      hostile: false,
      leavesBiofluid: false,
      ttl: Math.ceil(TICK_HZ * 1.4),
    });
    events.push({ t: 'shot', x: player.x, y: player.y, dx: extra.aim.x, dy: extra.aim.y });
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
        if (state.surface[i] === SURF_FIRE || state.surface[i] === SURF_GAS) {
          setSurface(state, i, SURF_NONE, 0);
        }
      }
    }
  }

  // consumivel: frasco purgante
  if (cmd.consume && extra.consumables > 0) {
    extra.consumables--;
    player.hp = Math.min(player.maxHp, player.hp + CONSUMABLE_HEAL);
    const w = state.config.width;
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    for (let y = py - CONSUMABLE_PURGE_RADIUS; y <= py + CONSUMABLE_PURGE_RADIUS; y++) {
      for (let x = px - CONSUMABLE_PURGE_RADIUS; x <= px + CONSUMABLE_PURGE_RADIUS; x++) {
        if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
        const i = y * w + x;
        if (state.surface[i] === SURF_GAS) setSurface(state, i, SURF_NONE, 0);
      }
    }
    events.push({ t: 'consume', x: player.x, y: player.y });
  }

  // interagir: revive parceiro > nucleo > cache > extracao
  if (cmd.interact) {
    // co-op: reviver parceiro abatido proximo tem prioridade
    if (coop) {
      for (let other = 0; other < state.players.length; other++) {
        if (other === slot) continue;
        const op = state.players[other];
        const oe = state.playerExtras[other];
        if (!op.alive || !oe.downed) continue;
        if (Math.hypot(player.x - op.x, player.y - op.y) <= REVIVE_RADIUS) {
          oe.downed = false;
          oe.bleedoutAt = 0;
          op.hp = Math.max(1, Math.floor(op.maxHp * REVIVE_HP_FRACTION));
          events.push({ t: 'revive', x: op.x, y: op.y, slot: other });
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
    for (const cache of state.caches) {
      if (cache.opened) continue;
      const d = Math.hypot(player.x - (cache.x + 0.5), player.y - (cache.y + 0.5));
      if (d < 1.3) {
        cache.opened = true;
        extra.consumables++;
        const options = rollTwoModifiers(state);
        cache.options = options;
        events.push({ t: 'cache_open', x: cache.x, y: cache.y });
        if (coop) {
          // co-op nao pausa a sim autoritativa: concede o primeiro modificador ao abridor
          grantModifier(extra, options[0]);
          events.push({ t: 'message', text: `Modificador acoplado: ${options[0]}.` });
        } else {
          state.pendingChoice = options;
          state.phase = 'choice';
        }
        return;
      }
    }
    // extracao coletiva: todos os players de pe precisam estar na zona de entrada
    const distEntry = Math.hypot(player.x - (state.entry.x + 0.5), player.y - (state.entry.y + 0.5));
    if (distEntry < 1.6 && state.leftEntryZone) {
      const allAtEntry = standingPlayers(state).every(
        (p) => Math.hypot(p.x - (state.entry.x + 0.5), p.y - (state.entry.y + 0.5)) <= EXTRACT_RADIUS
      );
      const anyDowned = state.playerExtras.some((e, i) => state.players[i].alive && e.downed);
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
      // cuspe inimigo que cai no chao deixa poca
      if (proj.leavesBiofluid) {
        const i = cellIndexAt(state, proj.x, proj.y);
        if (state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
          setSurface(state, i, SURF_BIOFLUID, 0);
        }
      }
      continue;
    }

    // 2 sub-passos anti-tunelamento
    for (let sub = 0; sub < 2 && !dead; sub++) {
      proj.x += proj.vx * dt * 0.5;
      proj.y += proj.vy * dt * 0.5;
      const cx = Math.floor(proj.x);
      const cy = Math.floor(proj.y);
      if (cx < 0 || cy < 0 || cx >= w || cy >= state.config.height) {
        dead = true;
        break;
      }
      const i = cy * w + cx;

      // impacto em solido
      if (state.solid[i] !== SOLID_NONE) {
        if (proj.explosive && !proj.hostile) {
          explodeAt(state, proj.x, proj.y, EXPLOSION_RADIUS, events);
          dead = true;
          break;
        }
        const broke = breakSolid(state, cx, cy, events);
        if (!(broke && proj.piercing)) dead = true;
        break;
      }

      // projetil condutivo tocando poca dispara descarga
      if (proj.conductive && !proj.hostile && state.surface[i] === SURF_BIOFLUID) {
        dischargeAt(state, cx, cy, events);
        dead = true;
        break;
      }

      // impacto em entidades
      if (proj.hostile) {
        const p = state.player;
        if (p.alive && Math.hypot(p.x - proj.x, p.y - proj.y) < p.radius + 0.2) {
          damageEntity(state, p, proj.damage, events);
          if (proj.leavesBiofluid && state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
            setSurface(state, i, SURF_BIOFLUID, 0);
          }
          dead = true;
          break;
        }
      } else {
        for (const enemy of state.enemies) {
          if (!enemy.alive) continue;
          if (Math.hypot(enemy.x - proj.x, enemy.y - proj.y) < enemy.radius + 0.2) {
            let dmg = proj.damage;
            const enemyCell = cellIndexAt(state, enemy.x, enemy.y);
            if (proj.conductive && state.surface[enemyCell] === SURF_BIOFLUID) {
              dmg *= 1.6;
              dischargeAt(state, Math.floor(enemy.x), Math.floor(enemy.y), events);
            }
            damageEntity(state, enemy, dmg, events);
            // sifao cura o dono do projetil
            const owner = state.players.find((p) => p.id === proj.owner);
            if (owner && state.playerExtras[owner.slot ?? 0].modifiers.includes('siphon')) {
              owner.hp = Math.min(owner.maxHp, owner.hp + 2);
            }
            if (proj.explosive) {
              explodeAt(state, proj.x, proj.y, EXPLOSION_RADIUS, events);
            }
            if (!proj.piercing || proj.explosive) dead = true;
            break;
          }
        }
      }
    }

    if (!dead) survivors.push(proj);
  }
  state.projectiles = survivors;
};

/** Ondas de pressao por contaminacao (thresholds unicos). */
const stepContamination = (state: SurvivalState, events: SemanticEvent[]): void => {
  state.contamination = Math.min(1, state.contamination + CONTAMINATION_PER_TICK * (state.coreTaken ? 2.2 : 1));
  const thresholds: Array<[number, number]> = [
    [0.35, 2],
    [0.6, 3],
    [0.85, 4],
  ];
  for (const [level, count] of thresholds) {
    const marker = Math.floor(level * 100);
    if (state.contamination >= level && !state.vents.some((v) => v.nextEmitAt === -marker)) {
      // usa um vent sentinel para registrar o threshold consumido (deterministico e serializavel)
      state.vents.push({ x: 0, y: 0, nextEmitAt: -marker });
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
const resolveDownedAndDeaths = (state: SurvivalState, events: SemanticEvent[]): void => {
  for (let slot = 0; slot < state.players.length; slot++) {
    const p = state.players[slot];
    const e = state.playerExtras[slot];
    if (!p.alive) continue;

    if (e.downed) {
      // abatido morre ao esgotar o tempo de sangramento
      if (state.tick >= e.bleedoutAt) {
        p.alive = false;
        events.push({ t: 'death', x: p.x, y: p.y, entity: p.id, archetype: 'prospector' });
      }
      continue;
    }

    if (p.hp <= 0) {
      p.hp = 0;
      const hasStandingAlly = state.players.some(
        (o, i) => i !== slot && o.alive && !state.playerExtras[i].downed
      );
      if (hasStandingAlly) {
        // co-op: entra em estado abatido, revivel pelo parceiro
        e.downed = true;
        e.bleedoutAt = state.tick + BLEEDOUT_TICKS;
        events.push({ t: 'player_down', slot });
      } else {
        p.alive = false;
        events.push({ t: 'player_down', slot });
        events.push({ t: 'death', x: p.x, y: p.y, entity: p.id, archetype: 'prospector' });
      }
    }
  }

  // run acaba quando nenhum player pode continuar (todos mortos ou abatidos)
  const anyActive = state.players.some((p, i) => p.alive && !state.playerExtras[i].downed);
  if (!anyActive) {
    state.phase = 'dead';
  }
};

export const stepRun = (state: SurvivalState, commands: readonly PlayerCommand[]): StepResult => {
  const events: SemanticEvent[] = [];

  if (state.phase === 'dead' || state.phase === 'extracted' || state.phase === 'extracted_with_core') {
    return { state, events };
  }

  // fase de escolha existe apenas no solo (co-op nao pausa a sim)
  if (state.phase === 'choice') {
    const cmd = commands[0] ?? emptyCommand();
    if (cmd.choose !== null && state.pendingChoice) {
      grantModifier(state.playerExtras[0], state.pendingChoice[cmd.choose]);
      const picked = state.pendingChoice[cmd.choose];
      state.pendingChoice = null;
      state.phase = 'running';
      events.push({ t: 'message', text: `Modificador acoplado: ${picked}.` });
    }
    return { state, events };
  }

  state.tick++;

  for (let slot = 0; slot < state.players.length; slot++) {
    stepPlayer(state, slot, commands[slot] ?? emptyCommand(), events);
    // interacao pode disparar fase terminal (solo choice/extracao)
    if (state.phase !== 'running') {
      resolveChainedEvents(state, events);
      return { state, events };
    }
  }

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
    players: state.players.map((p, i) => ({
      slot: i,
      x: p.x,
      y: p.y,
      hp: p.hp,
      maxHp: p.maxHp,
      heat: state.playerExtras[i].heat,
      hasCore: state.playerExtras[i].hasCore,
      downed: state.playerExtras[i].downed,
      alive: p.alive,
    })),
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

  mix(state.tick);
  mix(state.phase.length);
  mix(state.phase.charCodeAt(0));
  for (let i = 0; i < state.solid.length; i++) mix(state.solid[i] | (state.surface[i] << 8));
  for (let slot = 0; slot < state.players.length; slot++) {
    const p = state.players[slot];
    const e = state.playerExtras[slot];
    mix(Math.round(p.x * 1000));
    mix(Math.round(p.y * 1000));
    mix(Math.round(p.hp * 100));
    mix(p.alive ? 1 : 0);
    mix(e.downed ? 1 : 0);
    mix(Math.round(e.heat * 100));
    mix(e.consumables);
    mix(e.modifiers.length);
    for (const m of e.modifiers) mix(m.charCodeAt(0));
  }
  mix(state.coreTaken ? 1 : 0);
  mix(Math.round(state.contamination * 100000));
  for (const enemy of state.enemies) {
    mix(enemy.id);
    mix(Math.round(enemy.x * 1000));
    mix(Math.round(enemy.y * 1000));
    mix(Math.round(enemy.hp * 100));
    mix(enemy.alive ? 1 : 0);
  }
  for (const proj of state.projectiles) {
    mix(proj.id);
    mix(Math.round(proj.x * 1000));
    mix(Math.round(proj.y * 1000));
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};
