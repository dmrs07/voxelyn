import type { Entity, LevelState, PlayerState } from '../game/types';
import { entityByOcc, inBounds2D, isWalkableCell, moveEntity, occupancyAt, unregisterEntity } from '../world/level';

export type AttackResult = {
  didAttack: boolean;
  damage: number;
  killedIds: string[];
};

export const calculateDamage = (attack: number, reduction: number): number => {
  const dmg = Math.round(attack - reduction);
  return Math.max(1, dmg);
};

const applyDamage = (
  level: LevelState,
  source: Entity,
  target: Entity,
  amount: number,
  nowMs: number,
  simTick: number
): AttackResult => {
  const damage = calculateDamage(amount, target.damageReduction);
  target.hp -= damage;

  const killedIds: string[] = [];
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    killedIds.push(target.id);
    unregisterEntity(level, target);
  }

  source.nextAttackAt = nowMs +
    (source.kind === 'player' ? source.attackCooldownMs : source.attackCooldownMs);

  void simTick;

  return {
    didAttack: true,
    damage,
    killedIds,
  };
};

export const attackEntity = (
  level: LevelState,
  source: Entity,
  target: Entity,
  nowMs: number,
  simTick: number
): AttackResult => {
  if (!source.alive || !target.alive) {
    return { didAttack: false, damage: 0, killedIds: [] };
  }

  if (nowMs < source.nextAttackAt) {
    return { didAttack: false, damage: 0, killedIds: [] };
  }

  const result = applyDamage(level, source, target, source.attack, nowMs, simTick);

  if (source.kind === 'player' && result.damage > 0 && source.lifeOnHit > 0) {
    source.hp = Math.min(source.maxHp, source.hp + source.lifeOnHit);
  }

  return result;
};

export const tryMoveEntity = (
  level: LevelState,
  entity: Entity,
  x: number,
  y: number,
  nowMs: number
): boolean => {
  if (!entity.alive) return false;
  if (nowMs < entity.nextMoveAt) return false;
  if (!isWalkableCell(level, x, y, entity.occ)) return false;

  const moved = moveEntity(level, entity, x, y);
  if (moved) {
    const cooldown = entity.kind === 'player' ? entity.moveCooldownMs : entity.moveCooldownMs;
    entity.nextMoveAt = nowMs + cooldown;
  }
  return moved;
};

export const tryPlayerBumpAction = (
  level: LevelState,
  player: PlayerState,
  dx: number,
  dy: number,
  nowMs: number,
  simTick: number
): {
  moved: boolean;
  attacked: boolean;
  killedEnemyIds: string[];
} => {
  if (dx === 0 && dy === 0) {
    return { moved: false, attacked: false, killedEnemyIds: [] };
  }

  const tx = player.x + dx;
  const ty = player.y + dy;
  if (!inBounds2D(level, tx, ty)) {
    return { moved: false, attacked: false, killedEnemyIds: [] };
  }

  const occ = occupancyAt(level, tx, ty);
  if (occ > 0 && occ !== player.occ) {
    const target = entityByOcc(level, occ);
    if (target && target.kind === 'enemy' && target.alive) {
      const result = attackEntity(level, player, target, nowMs, simTick);
      if (result.didAttack) {
        return {
          moved: false,
          attacked: true,
          killedEnemyIds: result.killedIds,
        };
      }
    }
    return { moved: false, attacked: false, killedEnemyIds: [] };
  }

  const moved = tryMoveEntity(level, player, tx, ty, nowMs);
  return { moved, attacked: false, killedEnemyIds: [] };
};
