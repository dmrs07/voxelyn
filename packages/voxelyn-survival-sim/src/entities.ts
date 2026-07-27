import {
  BIOFLUID_SLOW,
  EXPLOSION_DAMAGE,
  SOLID_NONE,
  SPORE_LIFE_TICKS,
  SURF_BIOFLUID,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_NONE,
  SURF_SPORES,
  TICK_HZ,
} from './constants.js';
import { breakSolid, explodeAt, igniteCell, setSurface } from './cells.js';
import type {
  Entity,
  EntityActionKind,
  EnemyArchetype,
  SemanticEvent,
  SurvivalState,
  Vec2,
} from './types.js';

export type ArchetypeDef = {
  hp: number;
  speed: number;
  radius: number;
  contactDamage: number;
  contactCooldown: number;
  aggroRange: number;
};

export const ARCHETYPES: Record<EnemyArchetype, ArchetypeDef> = {
  stalker: { hp: 26, speed: 5.2, radius: 0.32, contactDamage: 8, contactCooldown: 10, aggroRange: 9 },
  bruiser: { hp: 95, speed: 2.3, radius: 0.46, contactDamage: 18, contactCooldown: 16, aggroRange: 7 },
  spitter: { hp: 30, speed: 2.8, radius: 0.34, contactDamage: 6, contactCooldown: 14, aggroRange: 9 },
  bomber: { hp: 18, speed: 3.7, radius: 0.3, contactDamage: 4, contactCooldown: 10, aggroRange: 9 },
  guardian: { hp: 420, speed: 2.1, radius: 0.68, contactDamage: 24, contactCooldown: 14, aggroRange: 7 },
};

export const isSolidAt = (state: SurvivalState, x: number, y: number): boolean => {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= state.config.width || cy >= state.config.height) return true;
  return state.solid[cy * state.config.width + cx] !== SOLID_NONE;
};

const circleBlocked = (state: SurvivalState, x: number, y: number, r: number): boolean =>
  isSolidAt(state, x - r, y - r) ||
  isSolidAt(state, x + r, y - r) ||
  isSolidAt(state, x - r, y + r) ||
  isSolidAt(state, x + r, y + r);

export const moveEntity = (
  state: SurvivalState,
  ent: Entity,
  dx: number,
  dy: number
): { blockedX: boolean; blockedY: boolean; blockCell: { x: number; y: number } | null } => {
  let blockCell: { x: number; y: number } | null = null;
  let blockedX = false;
  let blockedY = false;
  if (dx !== 0) {
    const nx = ent.x + dx;
    if (!circleBlocked(state, nx, ent.y, ent.radius)) ent.x = nx;
    else {
      blockedX = true;
      blockCell = { x: Math.floor(nx + Math.sign(dx) * ent.radius), y: Math.floor(ent.y) };
    }
  }
  if (dy !== 0) {
    const ny = ent.y + dy;
    if (!circleBlocked(state, ent.x, ny, ent.radius)) ent.y = ny;
    else {
      blockedY = true;
      blockCell = { x: Math.floor(ent.x), y: Math.floor(ny + Math.sign(dy) * ent.radius) };
    }
  }
  return { blockedX, blockedY, blockCell };
};

export const cellUnder = (state: SurvivalState, ent: Entity): number =>
  Math.floor(ent.y) * state.config.width + Math.floor(ent.x);

export const surfaceSpeedMul = (state: SurvivalState, ent: Entity): number =>
  state.surface[cellUnder(state, ent)] === SURF_BIOFLUID ? BIOFLUID_SLOW : 1;

/** Nuvem organica localizada deixada pela ruptura do Spore Bomber. */
const addBomberSpores = (state: SurvivalState, ent: Entity): void => {
  const cx = Math.floor(ent.x);
  const cy = Math.floor(ent.y);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= state.config.width || y >= state.config.height) continue;
      const i = y * state.config.width + x;
      if (state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
        setSurface(state, i, SURF_SPORES, SPORE_LIFE_TICKS);
      }
    }
  }
};

export const damageEntity = (
  state: SurvivalState,
  ent: Entity,
  amount: number,
  events: SemanticEvent[]
): void => {
  if (!ent.alive) return;
  if (ent.kind === 'player') {
    const extra = state.playerExtras[ent.slot ?? 0];
    if (extra.iframesUntil > state.tick || extra.downed) return;
    ent.hp = Math.max(0, ent.hp - amount);
    events.push({ t: 'hit', x: ent.x, y: ent.y, amount, target: ent.id });
    return;
  }
  ent.hp -= amount;
  events.push({ t: 'hit', x: ent.x, y: ent.y, amount, target: ent.id });
  if (ent.hp > 0) return;
  ent.hp = 0;
  ent.alive = false;
  events.push({
    t: 'death',
    x: ent.x,
    y: ent.y,
    entity: ent.id,
    archetype: ent.archetype,
    facingX: ent.facing.x,
    facingY: ent.facing.y,
    tick: state.tick,
  });
  if (ent.archetype === 'bomber') {
    explodeAt(state, ent.x, ent.y, 1.8, events);
    addBomberSpores(state, ent);
  }
};

export const spawnEnemy = (
  state: SurvivalState,
  archetype: EnemyArchetype,
  x: number,
  y: number,
  elite: boolean
): Entity => {
  const def = ARCHETYPES[archetype];
  const enemy: Entity = {
    id: state.nextEntityId++,
    kind: 'enemy',
    archetype,
    x: x + 0.5,
    y: y + 0.5,
    vx: 0,
    vy: 0,
    hp: elite ? Math.floor(def.hp * 2.2) : def.hp,
    maxHp: elite ? Math.floor(def.hp * 2.2) : def.hp,
    radius: def.radius,
    alive: true,
    elite,
    nextActionAt: 0,
    contactReadyAt: 0,
    rangedReadyAt: 0,
    stunnedUntil: 0,
    facing: { x: 1, y: 0 },
  };
  state.enemies.push(enemy);
  return enemy;
};

const distTo = (a: Entity, b: Entity): number => Math.hypot(a.x - b.x, a.y - b.y);
const normalized = (x: number, y: number): Vec2 => {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
};

const nearestTarget = (state: SurvivalState, x: number, y: number): Entity | null => {
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const p of state.players) {
    const e = state.playerExtras[p.slot ?? 0];
    if (!e.joined || !p.alive || e.downed) continue;
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
};

const startAction = (
  state: SurvivalState,
  enemy: Entity,
  action: EntityActionKind,
  direction: Vec2,
  windupTicks: number,
  recoveryTicks: number,
  events: SemanticEvent[],
  target?: number
): void => {
  const releaseAt = state.tick + windupTicks;
  enemy.action = {
    kind: action,
    phase: 'windup',
    startedAt: state.tick,
    releaseAt,
    endsAt: releaseAt + recoveryTicks,
    direction: { ...direction },
    target,
  };
  enemy.facing = { ...direction };
  events.push({
    t: 'action_start',
    entity: enemy.id,
    action,
    x: enemy.x,
    y: enemy.y,
    dx: direction.x,
    dy: direction.y,
    startTick: state.tick,
    releaseTick: releaseAt,
    endTick: releaseAt + recoveryTicks,
  });
};

const releaseAction = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const action = enemy.action;
  if (!action || action.phase !== 'windup') return;
  action.phase = 'release';
  const target = action.target === undefined
    ? null
    : state.players.find((p) => p.id === action.target && p.alive && !state.playerExtras[p.slot ?? 0].downed) ?? null;

  if (action.kind === 'detonate') {
    damageEntity(state, enemy, enemy.hp, events);
    return;
  }
  if (action.kind === 'ranged') {
    const def = ARCHETYPES[enemy.archetype as EnemyArchetype];
    state.projectiles.push({
      id: state.nextEntityId++,
      owner: enemy.id,
      x: enemy.x,
      y: enemy.y,
      vx: action.direction.x * 7,
      vy: action.direction.y * 7,
      damage: enemy.archetype === 'guardian' ? 14 : 9,
      piercing: false,
      conductive: false,
      explosive: false,
      hostile: true,
      leavesBiofluid: true,
      ttl: Math.ceil(((def.aggroRange + 4) / 7) * TICK_HZ),
    });
    events.push({ t: 'shot', x: enemy.x, y: enemy.y, dx: action.direction.x, dy: action.direction.y, owner: enemy.id });
  } else if (action.kind === 'contact' && target) {
    const def = ARCHETYPES[enemy.archetype as EnemyArchetype];
    if (distTo(enemy, target) < enemy.radius + target.radius + 0.45) {
      damageEntity(state, target, def.contactDamage * (enemy.elite ? 1.4 : 1), events);
    }
  } else if (action.kind === 'charge') {
    enemy.vx = action.direction.x * 7;
    enemy.vy = action.direction.y * 7;
  } else if (action.kind === 'slam' && target) {
    const def = ARCHETYPES[enemy.archetype as EnemyArchetype];
    if (distTo(enemy, target) < 2.1) damageEntity(state, target, def.contactDamage * 1.2, events);
  }
};

/** Returns true while an authoritative action owns the enemy's pose/movement. */
const advanceAction = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): boolean => {
  const action = enemy.action;
  if (!action) return false;
  if (state.tick >= action.releaseAt && action.phase === 'windup') releaseAction(state, enemy, events);
  if (!enemy.alive) return true;
  if (state.tick >= action.endsAt) {
    enemy.action = undefined;
    return false;
  }
  if (action.phase === 'release') action.phase = 'recovery';
  return true;
};

export const updateEnemies = (state: SurvivalState, events: SemanticEvent[]): void => {
  const dt = 1 / TICK_HZ;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    if (advanceAction(state, enemy, events)) continue;
    if (enemy.stunnedUntil > state.tick) continue;

    const def = ARCHETYPES[enemy.archetype as EnemyArchetype];
    const player = nearestTarget(state, enemy.x, enemy.y);
    const dist = player ? distTo(enemy, player) : Infinity;
    const aggro = player !== null && dist <= def.aggroRange + (enemy.elite ? 3 : 0);

    if (enemy.archetype === 'guardian' && !state.guardianAwake) {
      if (state.coreTaken || dist < 7) {
        state.guardianAwake = true;
        events.push({ t: 'guardian_awake' });
      } else continue;
    }

    let dirX = 0;
    let dirY = 0;
    const speed = def.speed * (enemy.elite ? 1.12 : 1) * surfaceSpeedMul(state, enemy);

    if (aggro && player) {
      const toward = normalized(player.x - enemy.x, player.y - enemy.y);
      dirX = toward.x;
      dirY = toward.y;

      if (enemy.archetype === 'bomber' && dist < 2.05) {
        startAction(state, enemy, 'detonate', toward, 12, 4, events, player.id);
        continue;
      }

      if ((enemy.archetype === 'spitter' || enemy.archetype === 'guardian') && state.tick >= enemy.rangedReadyAt) {
        const rangedDistance = enemy.archetype === 'guardian' ? 6.5 : 5.5;
        if (dist <= rangedDistance) {
          const windup = enemy.archetype === 'guardian' ? 10 : 6;
          enemy.rangedReadyAt = state.tick + (enemy.archetype === 'guardian' ? 44 : 56);
          startAction(state, enemy, 'ranged', toward, windup, 5, events, player.id);
          continue;
        }
      }

      const contactRange = enemy.radius + player.radius + 0.18;
      if (dist < contactRange && state.tick >= enemy.contactReadyAt && enemy.archetype !== 'bomber') {
        const windup = enemy.archetype === 'guardian' ? 7 : enemy.archetype === 'bruiser' ? 5 : 3;
        enemy.contactReadyAt = state.tick + def.contactCooldown;
        startAction(state, enemy, enemy.archetype === 'guardian' ? 'slam' : 'contact', toward, windup, 4, events, player.id);
        continue;
      }

      if (enemy.archetype === 'spitter' && dist < 5) {
        dirX = -dirX;
        dirY = -dirY;
      }
      if (enemy.archetype === 'stalker') {
        const side = enemy.id % 2 === 0 ? 1 : -1;
        const ox = dirX;
        dirX += -dirY * 0.45 * side;
        dirY += ox * 0.45 * side;
        const flank = normalized(dirX, dirY);
        dirX = flank.x;
        dirY = flank.y;
        const aheadX = enemy.x + dirX * 0.8;
        const aheadY = enemy.y + dirY * 0.8;
        const ai = Math.floor(aheadY) * state.config.width + Math.floor(aheadX);
        if (ai >= 0 && ai < state.surface.length && state.surface[ai] === SURF_FIRE) {
          const temp = dirX;
          dirX = -dirY;
          dirY = temp;
        }
      }
      if (enemy.archetype === 'guardian' && state.tick >= enemy.nextActionAt && dist > 2.2) {
        enemy.nextActionAt = state.tick + 100;
        startAction(state, enemy, 'charge', toward, 8, 8, events, player.id);
        continue;
      }
    } else if (state.tick >= enemy.nextActionAt) {
      enemy.nextActionAt = state.tick + 40 + state.rng.nextInt(60);
      const angle = state.rng.nextFloat01() * Math.PI * 2;
      enemy.vx = Math.cos(angle) * def.speed * 0.35;
      enemy.vy = Math.sin(angle) * def.speed * 0.35;
    }

    if (Math.hypot(enemy.vx, enemy.vy) > 0.05) {
      const moved = moveEntity(state, enemy, enemy.vx * dt, enemy.vy * dt);
      if (moved.blockCell && (enemy.archetype === 'bruiser' || enemy.archetype === 'guardian')) {
        breakSolid(state, moved.blockCell.x, moved.blockCell.y, events);
      }
      enemy.vx *= enemy.archetype === 'guardian' ? 0.92 : 0.82;
      enemy.vy *= enemy.archetype === 'guardian' ? 0.92 : 0.82;
    }

    if (dirX !== 0 || dirY !== 0) {
      enemy.facing.x = dirX;
      enemy.facing.y = dirY;
      const moved = moveEntity(state, enemy, dirX * speed * dt, dirY * speed * dt);
      if (moved.blockCell && (enemy.archetype === 'bruiser' || enemy.archetype === 'guardian')) {
        breakSolid(state, moved.blockCell.x, moved.blockCell.y, events);
      } else if ((moved.blockedX || moved.blockedY) && aggro) {
        moveEntity(state, enemy, (moved.blockedX ? 0 : dirX) * speed * dt * 0.6, (moved.blockedY ? 0 : dirY) * speed * dt * 0.6);
      }
    }

    if (enemy.elite) {
      const i = cellUnder(state, enemy);
      if (state.surface[i] === SURF_FUNGAL) igniteCell(state, i, events);
    }
  }

  const guardian = state.enemies.find((e) => e.archetype === 'guardian');
  if (guardian && guardian.alive && guardian.hp < guardian.maxHp * 0.5 && !state.guardianSummoned) {
    state.guardianSummoned = true;
    spawnEnemy(state, 'stalker', Math.floor(guardian.x) - 2, Math.floor(guardian.y), false);
    spawnEnemy(state, 'stalker', Math.floor(guardian.x) + 2, Math.floor(guardian.y), false);
  }
};

export const applyExplosionDamage = (
  state: SurvivalState,
  ex: number,
  ey: number,
  radius: number,
  events: SemanticEvent[]
): void => {
  const joined = state.players.filter((p) => state.playerExtras[p.slot ?? 0].joined);
  for (const ent of [...joined, ...state.enemies]) {
    if (!ent.alive) continue;
    const d = Math.hypot(ent.x - ex, ent.y - ey);
    if (d <= radius + ent.radius) {
      damageEntity(state, ent, EXPLOSION_DAMAGE * Math.max(0.35, 1 - d / (radius + 0.001)), events);
    }
  }
};
