import { ALERT_FLASH_MS, BOMBER_FUSE_MS, BOMBER_RADIUS } from '../game/constants';
import type { EnemyState, GameState, PlayerState, Vec2 } from '../game/types';
import {
  applyExplosionDamage,
  attackEntity,
  spawnProjectile,
  tryMoveEntity,
} from '../combat/combat';
import { isPassableMaterial } from '../world/materials';
import {
  inBounds2D,
  isBiofluidCell,
  isDynamicHazardCell,
  isWalkableCell,
  materialAt,
  unregisterEntity,
} from '../world/level';

const manhattan = (a: Vec2, b: Vec2): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

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

const keyOf = (x: number, y: number): number => (y << 16) | x;

const neighbors4 = (x: number, y: number): Vec2[] => [
  { x: x + 1, y },
  { x: x - 1, y },
  { x, y: y + 1 },
  { x, y: y - 1 },
];

const shouldAvoidBiofluid = (enemy: EnemyState): boolean => enemy.archetype !== 'spore_bomber';

const canEnterCell = (
  state: GameState,
  enemy: EnemyState,
  candidate: Vec2,
  target: Vec2,
  avoidBiofluid: boolean
): boolean => {
  if (!inBounds2D(state.level, candidate.x, candidate.y)) return false;
  if (candidate.x === target.x && candidate.y === target.y) return true;
  if (!isWalkableCell(state.level, candidate.x, candidate.y, enemy.occ)) return false;
  if (avoidBiofluid && isBiofluidCell(state.level, candidate.x, candidate.y)) return false;
  if (avoidBiofluid && isDynamicHazardCell(state.level, candidate.x, candidate.y)) return false;
  return true;
};

const hasLineOfSight = (state: GameState, from: Vec2, to: Vec2): boolean => {
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;

  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    if (!(x0 === from.x && y0 === from.y) && !(x0 === x1 && y0 === y1)) {
      if (!inBounds2D(state.level, x0, y0)) return false;
      if (!isPassableMaterial(materialAt(state.level, x0, y0, 0))) return false;
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }

  return true;
};

const greedyStepToward = (
  state: GameState,
  enemy: EnemyState,
  target: Vec2,
  avoidBiofluid: boolean
): Vec2 | null => {
  const options = neighbors4(enemy.x, enemy.y)
    .filter((candidate) => canEnterCell(state, enemy, candidate, target, avoidBiofluid));

  if (options.length === 0) return null;

  options.sort((a, b) => manhattan(a, target) - manhattan(b, target));
  return options[0] ?? null;
};

const greedyStepAway = (
  state: GameState,
  enemy: EnemyState,
  target: Vec2,
  avoidBiofluid: boolean
): Vec2 | null => {
  const options = neighbors4(enemy.x, enemy.y)
    .filter((candidate) => isWalkableCell(state.level, candidate.x, candidate.y, enemy.occ))
    .filter((candidate) => !(avoidBiofluid && isBiofluidCell(state.level, candidate.x, candidate.y)))
    .filter((candidate) => !(avoidBiofluid && isDynamicHazardCell(state.level, candidate.x, candidate.y)));

  if (options.length === 0) return null;
  options.sort((a, b) => manhattan(b, target) - manhattan(a, target));
  return options[0] ?? null;
};

const bfsStepToward = (
  state: GameState,
  enemy: EnemyState,
  target: Vec2,
  radius: number,
  avoidBiofluid: boolean
): Vec2 | null => {
  const maxNodes = state.level.width * state.level.height;
  const queueX = new Int32Array(maxNodes);
  const queueY = new Int32Array(maxNodes);
  const visited = new Set<number>();
  const parent = new Map<number, number>();

  let qh = 0;
  let qt = 0;
  const startKey = keyOf(enemy.x, enemy.y);
  visited.add(startKey);
  queueX[qt] = enemy.x;
  queueY[qt] = enemy.y;
  qt += 1;

  let foundKey: number | null = null;

  while (qh < qt) {
    const x = queueX[qh] ?? 0;
    const y = queueY[qh] ?? 0;
    qh += 1;

    if (x === target.x && y === target.y) {
      foundKey = keyOf(x, y);
      break;
    }

    if (Math.abs(x - enemy.x) + Math.abs(y - enemy.y) > radius) continue;

    for (const next of neighbors4(x, y)) {
      if (!inBounds2D(state.level, next.x, next.y)) continue;
      const k = keyOf(next.x, next.y);
      if (visited.has(k)) continue;
      if (!isPassableMaterial(materialAt(state.level, next.x, next.y, 0))) continue;
      if (!canEnterCell(state, enemy, next, target, avoidBiofluid)) continue;

      visited.add(k);
      parent.set(k, keyOf(x, y));
      queueX[qt] = next.x;
      queueY[qt] = next.y;
      qt += 1;
    }
  }

  if (foundKey == null) return null;

  let cursor = foundKey;
  let prev = parent.get(cursor) ?? null;
  while (prev != null && prev !== startKey) {
    cursor = prev;
    prev = parent.get(cursor) ?? null;
  }

  const stepX = cursor & 0xffff;
  const stepY = cursor >>> 16;
  if (stepX === enemy.x && stepY === enemy.y) return null;
  return { x: stepX, y: stepY };
};

const chooseTowardStep = (
  state: GameState,
  enemy: EnemyState,
  target: Vec2,
  radius: number
): Vec2 | null => {
  const avoidBiofluid = shouldAvoidBiofluid(enemy);
  const strict = bfsStepToward(state, enemy, target, radius, avoidBiofluid)
    ?? greedyStepToward(state, enemy, target, avoidBiofluid);
  if (strict || !avoidBiofluid) return strict;

  return bfsStepToward(state, enemy, target, radius, false)
    ?? greedyStepToward(state, enemy, target, false);
};

const chooseAwayStep = (
  state: GameState,
  enemy: EnemyState,
  target: Vec2
): Vec2 | null => {
  const avoidBiofluid = shouldAvoidBiofluid(enemy);
  const strict = greedyStepAway(state, enemy, target, avoidBiofluid);
  if (strict || !avoidBiofluid) return strict;
  return greedyStepAway(state, enemy, target, false);
};

const setChaseState = (enemy: EnemyState, nowMs: number): void => {
  if (enemy.aiState !== 'chase') {
    enemy.alertUntilMs = Math.max(enemy.alertUntilMs, nowMs + ALERT_FLASH_MS);
  }
  enemy.aiState = 'chase';
};

const faceToward = (enemy: EnemyState, target: Vec2): void => {
  const dx = Math.sign(target.x - enemy.x);
  const dy = Math.sign(target.y - enemy.y);
  if (dx !== 0 || dy !== 0) {
    enemy.facing = { x: dx, y: dy };
    enemy.animFacing = vecToAnimFacing(dx, dy);
  }
};

const tryAttackPlayer = (state: GameState, enemy: EnemyState, player: PlayerState, nowMs: number): boolean => {
  const result = attackEntity(state, enemy, player, nowMs);
  if (!result.didAttack) return false;

  if (!player.alive) {
    state.phase = 'game_over';
    state.messages.push(`Voce foi derrotado no andar ${state.floorNumber}.`);
  }
  return true;
};

const patrolStep = (state: GameState, enemy: EnemyState): Vec2 | null => {
  const origin = enemy.patrolOrigin;

  if (!enemy.patrolTarget || (enemy.patrolTarget.x === enemy.x && enemy.patrolTarget.y === enemy.y)) {
    const seed = (state.simTick + enemy.occ * 1103515245) >>> 0;
    const choices: Vec2[] = [
      { x: origin.x + ((seed % 7) - 3), y: origin.y + ((((seed >>> 3) % 7) - 3)) },
      { x: origin.x + (((seed >>> 6) % 7) - 3), y: origin.y + (((seed >>> 9) % 7) - 3) },
      { x: origin.x, y: origin.y },
    ];

    enemy.patrolTarget = choices.find((cell) =>
      inBounds2D(state.level, cell.x, cell.y) &&
      isPassableMaterial(materialAt(state.level, cell.x, cell.y, 0))
    ) ?? { ...origin };
  }

  return chooseTowardStep(state, enemy, enemy.patrolTarget, 7);
};

const moveEnemy = (state: GameState, enemy: EnemyState, step: Vec2, nowMs: number): void => {
  const fromX = enemy.x;
  const fromY = enemy.y;
  const moved = tryMoveEntity(state.level, enemy, step.x, step.y, nowMs);
  if (moved) {
    enemy.facing = { x: Math.sign(step.x - fromX), y: Math.sign(step.y - fromY) };
  }
};

const handleBomber = (state: GameState, enemy: EnemyState, player: PlayerState, nowMs: number): void => {
  const enemyPos = { x: enemy.x, y: enemy.y };
  const playerPos = { x: player.x, y: player.y };
  const distance = manhattan(enemyPos, playerPos);

  if (enemy.aiState === 'explode_windup') {
    enemy.animIntent = 'cast';
    if ((enemy.fuseUntilMs ?? 0) <= nowMs) {
      enemy.animIntent = 'die';
      applyExplosionDamage(state, enemy, BOMBER_RADIUS, enemy.attack);
      enemy.alive = false;
      unregisterEntity(state.level, enemy);
      state.messages.push('Um fungo explosivo detona!');
    }
    return;
  }

  if (distance <= 2) {
    enemy.aiState = 'explode_windup';
    enemy.fuseUntilMs = nowMs + BOMBER_FUSE_MS;
    enemy.alertUntilMs = Math.max(enemy.alertUntilMs, nowMs + ALERT_FLASH_MS);
    enemy.animIntent = 'cast';
    return;
  }

  if (distance <= enemy.detectRadius) {
    setChaseState(enemy, nowMs);
  } else {
    enemy.aiState = 'patrol';
  }

  if (nowMs < enemy.nextMoveAt) return;

  const next = enemy.aiState === 'chase'
    ? chooseTowardStep(state, enemy, playerPos, 12)
    : patrolStep(state, enemy);

  if (next) {
    moveEnemy(state, enemy, next, nowMs);
  }
};

const handleRangedEnemy = (state: GameState, enemy: EnemyState, player: PlayerState, nowMs: number): void => {
  const enemyPos = { x: enemy.x, y: enemy.y };
  const playerPos = { x: player.x, y: player.y };
  const distance = manhattan(enemyPos, playerPos);

  if (distance === 1) {
    faceToward(enemy, playerPos);
    tryAttackPlayer(state, enemy, player, nowMs);
    return;
  }

  const seesPlayer = distance <= enemy.detectRadius;
  if (seesPlayer) {
    setChaseState(enemy, nowMs);
  } else {
    enemy.aiState = 'patrol';
  }

  const hasLOS = seesPlayer && hasLineOfSight(state, enemyPos, playerPos);
  const inRange = distance >= enemy.preferredMinRange && distance <= 6;

  if (hasLOS && inRange && nowMs >= enemy.nextAttackAt) {
    faceToward(enemy, playerPos);
    enemy.animIntent = 'cast';
    spawnProjectile(state, {
      kind: enemy.archetype === 'guardian' ? 'guardian_shard' : 'spore_blob',
      sourceId: enemy.id,
      x: enemy.x,
      y: enemy.y,
      targetX: player.x,
      targetY: player.y,
      damage: enemy.attack,
      speed: enemy.archetype === 'guardian' ? 8 : 6.5,
      ttlMs: enemy.archetype === 'guardian' ? 1200 : 1450,
      radius: enemy.archetype === 'guardian' ? 0.2 : 0.16,
    });
    enemy.nextAttackAt = nowMs + enemy.attackCooldownMs;
  }

  if (nowMs < enemy.nextMoveAt) return;

  if (distance < enemy.preferredMinRange) {
    const fleeStep = chooseAwayStep(state, enemy, playerPos);
    if (fleeStep) {
      moveEnemy(state, enemy, fleeStep, nowMs);
      return;
    }
  }

  if (enemy.aiState === 'chase' && seesPlayer) {
    const shouldAdvance = distance > enemy.preferredMaxRange || !hasLOS;
    if (shouldAdvance) {
      const toward = chooseTowardStep(state, enemy, playerPos, 12);
      if (toward) {
        moveEnemy(state, enemy, toward, nowMs);
        return;
      }
    }
  }

  const patrol = patrolStep(state, enemy);
  if (patrol) {
    moveEnemy(state, enemy, patrol, nowMs);
  }
};

const handleMeleeEnemy = (state: GameState, enemy: EnemyState, player: PlayerState, nowMs: number): void => {
  const enemyPos = { x: enemy.x, y: enemy.y };
  const playerPos = { x: player.x, y: player.y };
  const distance = manhattan(enemyPos, playerPos);

  if (distance === 1) {
    faceToward(enemy, playerPos);
    tryAttackPlayer(state, enemy, player, nowMs);
    return;
  }

  const seesPlayer = distance <= enemy.detectRadius;
  if (seesPlayer) {
    setChaseState(enemy, nowMs);
  } else {
    enemy.aiState = 'patrol';
  }

  if (nowMs < enemy.nextMoveAt) return;

  if (enemy.aiState === 'chase') {
    const step = chooseTowardStep(state, enemy, playerPos, 10);
    if (step) {
      moveEnemy(state, enemy, step, nowMs);
      return;
    }
  }

  const patrol = patrolStep(state, enemy);
  if (patrol) {
    moveEnemy(state, enemy, patrol, nowMs);
  }
};

const updateEnemy = (state: GameState, enemy: EnemyState, player: PlayerState, nowMs: number): void => {
  if (!enemy.alive) return;

  if (enemy.archetype === 'spore_bomber') {
    handleBomber(state, enemy, player, nowMs);
    return;
  }

  if (enemy.archetype === 'spitter' || enemy.archetype === 'guardian') {
    handleRangedEnemy(state, enemy, player, nowMs);
    return;
  }

  handleMeleeEnemy(state, enemy, player, nowMs);
};

export const updateEnemiesAI = (state: GameState, nowMs: number): void => {
  const player = state.level.entities.get(state.playerId);
  if (!player || player.kind !== 'player' || !player.alive) {
    state.phase = 'game_over';
    return;
  }

  const enemies = Array.from(state.level.entities.values()).filter(
    (entity): entity is EnemyState => entity.kind === 'enemy' && entity.alive
  );

  for (const enemy of enemies) {
    updateEnemy(state, enemy, player, nowMs);
    if (state.phase === 'game_over') return;
  }
};
