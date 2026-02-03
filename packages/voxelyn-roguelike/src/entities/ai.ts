import type { EnemyState, GameState, PlayerState, Vec2 } from '../game/types';
import { attackEntity, tryMoveEntity } from '../combat/combat';
import { isPassableMaterial } from '../world/materials';
import { inBounds2D, materialAt } from '../world/level';

const manhattan = (a: Vec2, b: Vec2): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const keyOf = (x: number, y: number): number => (y << 16) | x;

const neighbors4 = (x: number, y: number): Vec2[] => [
  { x: x + 1, y },
  { x: x - 1, y },
  { x, y: y + 1 },
  { x, y: y - 1 },
];

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

const greedyStepToward = (state: GameState, enemy: EnemyState, target: Vec2): Vec2 | null => {
  const options = neighbors4(enemy.x, enemy.y)
    .filter((candidate) => inBounds2D(state.level, candidate.x, candidate.y))
    .filter((candidate) => {
      if (candidate.x === target.x && candidate.y === target.y) return true;
      return state.level.occupancy[candidate.y * state.level.width + candidate.x] === 0;
    })
    .filter((candidate) => isPassableMaterial(materialAt(state.level, candidate.x, candidate.y, 0)));

  if (options.length === 0) return null;

  options.sort((a, b) => manhattan(a, target) - manhattan(b, target));
  return options[0] ?? null;
};

const greedyStepAway = (state: GameState, enemy: EnemyState, target: Vec2): Vec2 | null => {
  const options = neighbors4(enemy.x, enemy.y)
    .filter((candidate) => inBounds2D(state.level, candidate.x, candidate.y))
    .filter((candidate) => state.level.occupancy[candidate.y * state.level.width + candidate.x] === 0)
    .filter((candidate) => isPassableMaterial(materialAt(state.level, candidate.x, candidate.y, 0)));

  if (options.length === 0) return null;
  options.sort((a, b) => manhattan(b, target) - manhattan(a, target));
  return options[0] ?? null;
};

const bfsStepToward = (
  state: GameState,
  enemy: EnemyState,
  target: Vec2,
  radius: number
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

      const occ = state.level.occupancy[next.y * state.level.width + next.x] ?? 0;
      const canEnter = occ === 0 || (next.x === target.x && next.y === target.y);
      if (!canEnter) continue;

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

const tryAttackPlayer = (state: GameState, enemy: EnemyState, player: PlayerState, nowMs: number): boolean => {
  const result = attackEntity(state.level, enemy, player, nowMs, state.simTick);
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

  return greedyStepToward(state, enemy, enemy.patrolTarget);
};

const moveEnemy = (state: GameState, enemy: EnemyState, step: Vec2, nowMs: number): void => {
  tryMoveEntity(state.level, enemy, step.x, step.y, nowMs);
};

const updateEnemy = (state: GameState, enemy: EnemyState, player: PlayerState, nowMs: number): void => {
  if (!enemy.alive) return;

  const enemyPos = { x: enemy.x, y: enemy.y };
  const playerPos = { x: player.x, y: player.y };
  const distance = manhattan(enemyPos, playerPos);

  if (distance === 1) {
    tryAttackPlayer(state, enemy, player, nowMs);
    return;
  }

  const seesPlayer = distance <= enemy.detectRadius;

  if (enemy.archetype === 'spitter' || enemy.archetype === 'guardian') {
    const hasLOS = seesPlayer && hasLineOfSight(state, enemyPos, playerPos);
    const inRange = distance >= enemy.preferredMinRange && distance <= 6;

    if (hasLOS && inRange) {
      if (tryAttackPlayer(state, enemy, player, nowMs)) return;
    }

    if (nowMs >= enemy.nextMoveAt) {
      if (distance < enemy.preferredMinRange) {
        const fleeStep = greedyStepAway(state, enemy, playerPos);
        if (fleeStep) {
          moveEnemy(state, enemy, fleeStep, nowMs);
          return;
        }
      }

      if (seesPlayer) {
        const toward = bfsStepToward(state, enemy, playerPos, 12) ?? greedyStepToward(state, enemy, playerPos);
        if (toward) {
          moveEnemy(state, enemy, toward, nowMs);
          return;
        }
      }

      const patrol = patrolStep(state, enemy);
      if (patrol) moveEnemy(state, enemy, patrol, nowMs);
    }

    return;
  }

  if (seesPlayer && nowMs >= enemy.nextMoveAt) {
    const step = bfsStepToward(state, enemy, playerPos, 10) ?? greedyStepToward(state, enemy, playerPos);
    if (step) {
      moveEnemy(state, enemy, step, nowMs);
      return;
    }
  }

  if (nowMs >= enemy.nextMoveAt) {
    const patrol = patrolStep(state, enemy);
    if (patrol) moveEnemy(state, enemy, patrol, nowMs);
  }
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
