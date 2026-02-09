import { RNG } from '@voxelyn/core';
import { PLAYER_MIN_SPAWN_DISTANCE, SPAWN_COUNT_CAP } from '../game/constants';
import type { EnemyArchetype, LevelState, Vec2 } from '../game/types';
import { createEnemy } from '../entities/enemy';
import { nextEntityIdentity, registerEntity, isWalkableCell } from './level';

const distanceSq = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

const sampleArchetype = (floor: number, rng: RNG): EnemyArchetype => {
  const r = rng.nextFloat01();

  if (floor <= 3) {
    return r < 0.7 ? 'stalker' : 'bruiser';
  }

  if (floor <= 7) {
    if (r < 0.41) return 'stalker';
    if (r < 0.74) return 'bruiser';
    if (r < 0.92) return 'spitter';
    return 'spore_bomber';
  }

  if (floor <= 9) {
    if (r < 0.25) return 'stalker';
    if (r < 0.57) return 'bruiser';
    if (r < 0.82) return 'spitter';
    return 'spore_bomber';
  }

  // floor 10 base composition follows floor 9, guardian is injected separately.
  if (r < 0.24) return 'stalker';
  if (r < 0.56) return 'bruiser';
  if (r < 0.8) return 'spitter';
  return 'spore_bomber';
};

export const enemyCountForFloor = (floor: number): number => Math.min(6 + floor * 2, SPAWN_COUNT_CAP);

const randomSpawnCell = (level: LevelState, rng: RNG, minDist: number): Vec2 | null => {
  const minDistSq = minDist * minDist;
  for (let attempt = 0; attempt < 4000; attempt += 1) {
    const x = 1 + rng.nextInt(level.width - 2);
    const y = 1 + rng.nextInt(level.height - 2);
    if (distanceSq({ x, y }, level.entry) < minDistSq) continue;
    if (!isWalkableCell(level, x, y)) continue;
    return { x, y };
  }
  return null;
};

export const spawnEnemiesForFloor = (level: LevelState, floor: number, rng: RNG): string[] => {
  const spawned: string[] = [];
  const desired = enemyCountForFloor(floor);

  if (floor === 10) {
    const guardianSpot = randomSpawnCell(level, rng, PLAYER_MIN_SPAWN_DISTANCE + 4);
    if (guardianSpot) {
      const identity = nextEntityIdentity(level);
      const guardian = createEnemy(identity.id, identity.occ, 'guardian', guardianSpot.x, guardianSpot.y, floor);
      registerEntity(level, guardian);
      spawned.push(guardian.id);
    }
  }

  const reducedTarget = floor === 10 ? Math.max(8, desired - 8) : desired;

  while (spawned.length < reducedTarget + (floor === 10 ? 1 : 0)) {
    const cell = randomSpawnCell(level, rng, PLAYER_MIN_SPAWN_DISTANCE);
    if (!cell) break;
    const archetype = sampleArchetype(Math.min(floor, 9), rng);
    const identity = nextEntityIdentity(level);
    const enemy = createEnemy(identity.id, identity.occ, archetype, cell.x, cell.y, floor);
    registerEntity(level, enemy);
    spawned.push(enemy.id);
  }

  return spawned;
};
