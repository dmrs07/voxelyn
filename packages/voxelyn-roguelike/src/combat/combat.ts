import {
  HIT_FLASH_MS,
  MAX_PARTICLES,
  MAX_PROJECTILES,
  PROJECTILE_SPEED,
  SCREEN_FLASH_MS,
} from '../game/constants';
import type {
  Entity,
  EnemyState,
  GameState,
  ParticleState,
  PlayerState,
  ProjectileKind,
  ProjectileState,
} from '../game/types';
import { isPassableMaterial } from '../world/materials';
import {
  entityByOcc,
  inBounds2D,
  isWalkableCell,
  materialAt,
  moveEntity,
  occupancyAt,
  unregisterEntity,
} from '../world/level';
import { getPlayerAttackBonus } from '../world/features';

export type AttackResult = {
  didAttack: boolean;
  damage: number;
  killedIds: string[];
  healed: number;
};

export type ProjectileUpdateResult = {
  killedEnemyIds: string[];
  damagedPlayer: boolean;
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

const vecToAnimFacing = (x: number, y: number): 'dr' | 'dl' | 'ur' | 'ul' => {
  // Isometric cardinal directions:
  // D (+X) = DR, A (-X) = UL, S (+Y) = DL, W (-Y) = UR
  if (x > 0 && y > 0) return 'dr';
  if (x < 0 && y < 0) return 'ul';
  if (x > 0 && y < 0) return 'ur';
  if (x < 0 && y > 0) return 'dl';
  // Pure cardinal directions
  if (x > 0) return 'dr';
  if (x < 0) return 'ul';
  if (y > 0) return 'dl';
  if (y < 0) return 'ur';
  return 'dr'; // default
};

const findAdjacentEnemyTarget = (
  state: GameState,
  player: PlayerState,
  dx: number,
  dy: number
): EnemyState | null => {
  const candidates: EnemyState[] = [];

  const pushIfEnemy = (x: number, y: number): EnemyState | null => {
    if (!inBounds2D(state.level, x, y)) return null;
    const occ = occupancyAt(state.level, x, y);
    if (occ <= 0 || occ === player.occ) return null;
    const target = entityByOcc(state.level, occ);
    if (target && target.kind === 'enemy' && target.alive) {
      candidates.push(target);
      return target;
    }
    return null;
  };

  // Prefer the enemy in the input direction (if any).
  if (dx !== 0 || dy !== 0) {
    const preferred = pushIfEnemy(player.x + dx, player.y + dy);
    if (preferred) return preferred;
  }

  // Otherwise evaluate all adjacent enemies.
  pushIfEnemy(player.x + 1, player.y);
  pushIfEnemy(player.x - 1, player.y);
  pushIfEnemy(player.x, player.y + 1);
  pushIfEnemy(player.x, player.y - 1);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (a.hp !== b.hp) return a.hp - b.hp;
    return a.occ - b.occ;
  });
  return candidates[0] ?? null;
};

export const calculateDamage = (attack: number, reduction: number): number => {
  const dmg = Math.round(attack - reduction);
  return Math.max(1, dmg);
};

const pushDamageEvent = (
  state: GameState,
  sourceId: string,
  targetId: string,
  amount: number,
  x: number,
  y: number
): void => {
  state.damageEvents.push({
    sourceId,
    targetId,
    amount,
    tick: state.simTick,
    x,
    y,
  });

  if (state.damageEvents.length > 96) {
    state.damageEvents.splice(0, state.damageEvents.length - 96);
  }
};

export const spawnParticle = (
  state: GameState,
  particle: Omit<ParticleState, 'id'>
): ParticleState => {
  const id = `p${state.simTick}_${state.particles.length}_${Math.floor(state.simTimeMs)}`;
  const created: ParticleState = {
    id,
    ...particle,
  };

  state.particles.push(created);
  if (state.particles.length > MAX_PARTICLES) {
    state.particles.splice(0, state.particles.length - MAX_PARTICLES);
  }
  return created;
};

const spawnDamageNumber = (
  state: GameState,
  x: number,
  y: number,
  text: string,
  color: number
): void => {
  spawnParticle(state, {
    x,
    y,
    z: 0.45,
    vx: (Math.sin(state.simTick + x * 0.7 + y * 0.3) * 0.25),
    vy: -0.14,
    vz: 0.04,
    lifeMs: 420,
    color,
    text,
  });
};

const applyRawDamage = (
  state: GameState,
  levelSourceId: string,
  target: Entity,
  amount: number,
  nowMs: number
): AttackResult => {
  if (!target.alive) {
    return { didAttack: false, damage: 0, killedIds: [], healed: 0 };
  }

  const damage = calculateDamage(amount, target.damageReduction);
  target.hp -= damage;
  target.hitFlashUntilMs = Math.max(target.hitFlashUntilMs, nowMs + HIT_FLASH_MS);
  target.animIntent = 'hit';

  const killedIds: string[] = [];
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    target.animIntent = 'die';
    killedIds.push(target.id);
    unregisterEntity(state.level, target);
    if (target.kind === 'enemy') {
      state.messages.push('Inimigo eliminado.');
    }
  }

  pushDamageEvent(state, levelSourceId, target.id, damage, target.x, target.y);
  spawnDamageNumber(state, target.x, target.y, `-${damage}`, 0xff8a8aff);

  let healed = 0;
  const source = state.level.entities.get(levelSourceId);
  if (source && source.kind === 'player' && source.lifeOnHit > 0 && damage > 0) {
    const before = source.hp;
    source.hp = Math.min(source.maxHp, source.hp + source.lifeOnHit);
    healed = Math.max(0, source.hp - before);
    if (healed > 0) {
      state.screenFlash.healMs = Math.max(state.screenFlash.healMs, SCREEN_FLASH_MS);
      spawnDamageNumber(state, source.x, source.y - 0.2, `+${healed}`, 0xff8fe26fff);
      state.messages.push(`Cura +${healed}`);
    }
  }

  if (target.kind === 'player' && damage > 0) {
    state.screenFlash.damageMs = Math.max(state.screenFlash.damageMs, SCREEN_FLASH_MS);
    if (damage >= 7) {
      state.messages.push(`Dano recebido: ${damage}`);
    }
  } else if (source?.kind === 'player' && damage >= Math.max(6, Math.floor(target.maxHp * 0.22))) {
    state.messages.push('Acerto critico!');
  }

  return {
    didAttack: true,
    damage,
    killedIds,
    healed,
  };
};

export const attackEntity = (
  state: GameState,
  source: Entity,
  target: Entity,
  nowMs: number
): AttackResult => {
  if (!source.alive || !target.alive) {
    return { didAttack: false, damage: 0, killedIds: [], healed: 0 };
  }

  if (nowMs < source.nextAttackAt) {
    return { didAttack: false, damage: 0, killedIds: [], healed: 0 };
  }

  const buffedAttack = source.kind === 'player'
    ? source.attack + getPlayerAttackBonus(state)
    : source.attack;
  const result = applyRawDamage(state, source.id, target, buffedAttack, nowMs);
  source.nextAttackAt = nowMs + source.attackCooldownMs;
  source.animIntent = 'attack';
  source.animFacing = vecToAnimFacing(source.facing.x, source.facing.y);
  return result;
};

export const damageEntityDirect = (
  state: GameState,
  sourceId: string,
  target: Entity,
  amount: number,
  nowMs: number
): AttackResult => applyRawDamage(state, sourceId, target, amount, nowMs);

export const tryMoveEntity = (
  level: GameState['level'],
  entity: Entity,
  x: number,
  y: number,
  nowMs: number
): boolean => {
  if (!entity.alive) return false;
  if (nowMs < entity.nextMoveAt) return false;
  if (!isWalkableCell(level, x, y, entity.occ)) return false;

  const dx = x - entity.x;
  const dy = y - entity.y;

  const moved = moveEntity(level, entity, x, y);
  if (moved) {
    entity.nextMoveAt = nowMs + entity.moveCooldownMs;
    if (dx !== 0 || dy !== 0) {
      entity.facing = { x: Math.sign(dx), y: Math.sign(dy) };
      entity.animFacing = vecToAnimFacing(entity.facing.x, entity.facing.y);
      entity.animIntent = 'move';
      entity.animPhase = (entity.animPhase + 1) & 0xff;
    }
  }
  return moved;
};

export const tryPlayerBumpAction = (
  state: GameState,
  player: PlayerState,
  dx: number,
  dy: number,
  nowMs: number
): {
  moved: boolean;
  attacked: boolean;
  killedEnemyIds: string[];
} => {
  if (dx === 0 && dy === 0) {
    return { moved: false, attacked: false, killedEnemyIds: [] };
  }

  const preferredFacing = { x: Math.sign(dx), y: Math.sign(dy) };
  player.facing = preferredFacing;
  player.animFacing = vecToAnimFacing(preferredFacing.x, preferredFacing.y);

  // Auto-attack any adjacent enemy when attack is ready.
  const adjacentTarget = findAdjacentEnemyTarget(state, player, dx, dy);
  if (adjacentTarget && nowMs >= player.nextAttackAt) {
    const faceX = Math.sign(adjacentTarget.x - player.x);
    const faceY = Math.sign(adjacentTarget.y - player.y);
    if (faceX !== 0 || faceY !== 0) {
      player.facing = { x: faceX, y: faceY };
      player.animFacing = vecToAnimFacing(faceX, faceY);
    }
    const result = attackEntity(state, player, adjacentTarget, nowMs);
    if (result.didAttack) {
      return {
        moved: false,
        attacked: true,
        killedEnemyIds: result.killedIds,
      };
    }
  }

  const tx = player.x + dx;
  const ty = player.y + dy;
  if (!inBounds2D(state.level, tx, ty)) {
    return { moved: false, attacked: false, killedEnemyIds: [] };
  }

  const occ = occupancyAt(state.level, tx, ty);
  if (occ > 0 && occ !== player.occ) {
    const target = entityByOcc(state.level, occ);
    if (target && target.kind === 'enemy' && target.alive) {
      const result = attackEntity(state, player, target, nowMs);
      if (result.didAttack) {
        player.animIntent = 'attack';
        return {
          moved: false,
          attacked: true,
          killedEnemyIds: result.killedIds,
        };
      }
    }
    return { moved: false, attacked: false, killedEnemyIds: [] };
  }

  const moved = tryMoveEntity(state.level, player, tx, ty, nowMs);
  if (moved) {
    // Temporary debuffs/buffs adjust movement cadence without mutating base stats.
    if (state.activeDebuffs.slowUntilMs > nowMs) {
      player.nextMoveAt += 65;
    }
    if (state.activeDebuffs.crystalBuffUntilMs > nowMs) {
      player.nextMoveAt = Math.max(nowMs, player.nextMoveAt - 24);
    }
  }
  return { moved, attacked: false, killedEnemyIds: [] };
};

export const spawnProjectile = (
  state: GameState,
  params: {
    kind: ProjectileKind;
    sourceId: string;
    x: number;
    y: number;
    z?: number;
    targetX: number;
    targetY: number;
    damage: number;
    speed?: number;
    ttlMs?: number;
    radius?: number;
  }
): ProjectileState | null => {
  const dx = params.targetX - params.x;
  const dy = params.targetY - params.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.0001) return null;

  const projectile: ProjectileState = {
    id: `proj_${state.simTick}_${state.projectiles.length}_${Math.floor(state.simTimeMs)}`,
    kind: params.kind,
    sourceId: params.sourceId,
    x: params.x,
    y: params.y,
    z: params.z ?? 0.6,
    vx: dx / len,
    vy: dy / len,
    speed: params.speed ?? PROJECTILE_SPEED,
    damage: params.damage,
    ttlMs: params.ttlMs ?? 1300,
    radius: params.radius ?? 0.18,
    alive: true,
  };

  state.projectiles.push(projectile);
  if (state.projectiles.length > MAX_PROJECTILES) {
    state.projectiles.splice(0, state.projectiles.length - MAX_PROJECTILES);
  }

  return projectile;
};

const shouldHitTarget = (source: Entity | undefined, target: Entity): boolean => {
  if (!target.alive) return false;
  if (!source) return true;
  if (source.id === target.id) return false;
  if (source.kind === 'enemy') return target.kind === 'player';
  return target.kind === 'enemy';
};

const spawnImpactParticles = (state: GameState, x: number, y: number, color: number): void => {
  for (let i = 0; i < 5; i += 1) {
    const t = (i / 5) * Math.PI * 2;
    spawnParticle(state, {
      x,
      y,
      z: 0.5,
      vx: Math.cos(t) * 0.12,
      vy: Math.sin(t) * 0.12,
      vz: 0.03 + (i % 2) * 0.01,
      lifeMs: 280,
      color,
      text: null,
    });
  }
};

const removeDeadProjectiles = (state: GameState): void => {
  if (state.projectiles.length === 0) return;
  let write = 0;
  for (let read = 0; read < state.projectiles.length; read += 1) {
    const p = state.projectiles[read];
    if (p && p.alive) {
      state.projectiles[write] = p;
      write += 1;
    }
  }
  state.projectiles.length = write;
};

export const updateProjectiles = (state: GameState, stepMs: number): ProjectileUpdateResult => {
  const killedEnemyIds: string[] = [];
  let damagedPlayer = false;

  for (const projectile of state.projectiles) {
    if (!projectile.alive) continue;

    projectile.ttlMs -= stepMs;
    if (projectile.ttlMs <= 0) {
      projectile.alive = false;
      continue;
    }

    const source = state.level.entities.get(projectile.sourceId);
    const moveAmount = projectile.speed * (stepMs / 1000);
    const subSteps = Math.max(1, Math.ceil(moveAmount / 0.25));
    const sub = moveAmount / subSteps;

    for (let i = 0; i < subSteps && projectile.alive; i += 1) {
      projectile.x += projectile.vx * sub;
      projectile.y += projectile.vy * sub;

      const cx = Math.round(projectile.x);
      const cy = Math.round(projectile.y);
      if (!inBounds2D(state.level, cx, cy)) {
        projectile.alive = false;
        break;
      }

      if (!isPassableMaterial(materialAt(state.level, cx, cy, 0))) {
        spawnImpactParticles(state, projectile.x, projectile.y, 0xfff0b05fff);
        projectile.alive = false;
        break;
      }

      const occ = occupancyAt(state.level, cx, cy);
      if (occ <= 0) continue;
      const target = entityByOcc(state.level, occ);
      if (!target || !shouldHitTarget(source, target)) continue;

      const result = damageEntityDirect(
        state,
        source?.id ?? projectile.sourceId,
        target,
        projectile.damage,
        state.simTimeMs
      );

      if (target.kind === 'player' && result.damage > 0) {
        damagedPlayer = true;
      }

      for (const id of result.killedIds) {
        const killed = state.level.entities.get(id);
        if (!killed || killed.kind === 'enemy') {
          killedEnemyIds.push(id);
        }
      }

      spawnImpactParticles(state, projectile.x, projectile.y, 0xff9bdbff);
      projectile.alive = false;
    }
  }

  removeDeadProjectiles(state);

  return {
    killedEnemyIds,
    damagedPlayer,
  };
};

export const applyExplosionDamage = (
  state: GameState,
  source: EnemyState,
  radius: number,
  amount: number
): string[] => {
  const killedEnemyIds: string[] = [];

  for (const target of Array.from(state.level.entities.values())) {
    if (!target.alive || target.id === source.id) continue;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    if (Math.hypot(dx, dy) > radius + 0.001) continue;

    const result = damageEntityDirect(state, source.id, target, amount, state.simTimeMs);
    for (const killedId of result.killedIds) {
      const e = state.level.entities.get(killedId);
      if (!e || e.kind === 'enemy') {
        killedEnemyIds.push(killedId);
      }
    }
  }

  for (let i = 0; i < 18; i += 1) {
    const t = (i / 18) * Math.PI * 2;
    const r = radius * (0.3 + 0.7 * ((i % 3) / 2));
    spawnParticle(state, {
      x: source.x + Math.cos(t) * r * 0.4,
      y: source.y + Math.sin(t) * r * 0.4,
      z: 0.5,
      vx: Math.cos(t) * (0.08 + (i % 4) * 0.02),
      vy: Math.sin(t) * (0.08 + (i % 4) * 0.02),
      vz: 0.03 + (i % 2) * 0.02,
      lifeMs: 420,
      color: 0xff84f2a2,
      text: null,
    });
  }

  state.cameraShakeMs = Math.max(state.cameraShakeMs, 180);
  state.screenFlash.damageMs = Math.max(state.screenFlash.damageMs, SCREEN_FLASH_MS);

  return killedEnemyIds;
};

export const updateParticles = (state: GameState, stepMs: number): void => {
  for (const particle of state.particles) {
    particle.lifeMs -= stepMs;
    if (particle.lifeMs <= 0) {
      particle.lifeMs = 0;
      continue;
    }

    particle.x += particle.vx * (stepMs / 50);
    particle.y += particle.vy * (stepMs / 50);
    particle.z += particle.vz * (stepMs / 50);
    particle.vz -= 0.0015 * stepMs;

    // Gentle drag keeps floating numbers readable.
    particle.vx *= clamp01(1 - 0.002 * stepMs);
    particle.vy *= clamp01(1 - 0.002 * stepMs);
  }

  let write = 0;
  for (let read = 0; read < state.particles.length; read += 1) {
    const particle = state.particles[read];
    if (particle && particle.lifeMs > 0) {
      state.particles[write] = particle;
      write += 1;
    }
  }
  state.particles.length = write;
};
