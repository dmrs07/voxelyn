import { getVoxel, setVoxel } from '@voxelyn/core';
import { isPassableMaterial } from './materials';
import type { Entity, LevelState } from '../game/types';

export const index2D = (width: number, x: number, y: number): number => y * width + x;

export const inBounds2D = (level: LevelState, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < level.width && y < level.height;

export const materialAt = (level: LevelState, x: number, y: number, z = 0): number =>
  getVoxel(level.grid, x, y, z);

export const setMaterialAt = (level: LevelState, x: number, y: number, z: number, value: number): void => {
  setVoxel(level.grid, x, y, z, value);
};

export const occupancyAt = (level: LevelState, x: number, y: number): number => {
  if (!inBounds2D(level, x, y)) return -1;
  return level.occupancy[index2D(level.width, x, y)] ?? 0;
};

export const setOccupancyAt = (level: LevelState, x: number, y: number, value: number): void => {
  if (!inBounds2D(level, x, y)) return;
  level.occupancy[index2D(level.width, x, y)] = value;
};

export const isWalkableCell = (
  level: LevelState,
  x: number,
  y: number,
  ignoreOcc = 0
): boolean => {
  if (!inBounds2D(level, x, y)) return false;
  if (!isPassableMaterial(materialAt(level, x, y, 0))) return false;
  const occ = occupancyAt(level, x, y);
  return occ === 0 || occ === ignoreOcc;
};

export const registerEntity = (level: LevelState, entity: Entity): void => {
  level.entities.set(entity.id, entity);
  if (entity.blocks && entity.alive) {
    setOccupancyAt(level, entity.x, entity.y, entity.occ);
  }
};

export const unregisterEntity = (level: LevelState, entity: Entity): void => {
  if (entity.blocks) {
    const occ = occupancyAt(level, entity.x, entity.y);
    if (occ === entity.occ) {
      setOccupancyAt(level, entity.x, entity.y, 0);
    }
  }
  level.entities.delete(entity.id);
};

export const moveEntity = (level: LevelState, entity: Entity, x: number, y: number): boolean => {
  if (!inBounds2D(level, x, y)) return false;
  if (entity.blocks) {
    const occ = occupancyAt(level, x, y);
    if (occ !== 0 && occ !== entity.occ) return false;
    setOccupancyAt(level, entity.x, entity.y, 0);
    setOccupancyAt(level, x, y, entity.occ);
  }
  entity.x = x;
  entity.y = y;
  return true;
};

export const rebuildOccupancy = (level: LevelState): void => {
  level.occupancy.fill(0);
  for (const entity of level.entities.values()) {
    if (entity.alive && entity.blocks && inBounds2D(level, entity.x, entity.y)) {
      setOccupancyAt(level, entity.x, entity.y, entity.occ);
    }
  }
};

export const nextEntityIdentity = (level: LevelState, prefix = 'e'): { id: string; occ: number } => {
  level.nextEntityOcc += 1;
  const occ = level.nextEntityOcc;
  return { id: `${prefix}${occ}`, occ };
};

export const entityByOcc = (level: LevelState, occ: number): Entity | null => {
  if (occ <= 0) return null;
  return level.entities.get(`e${occ}`) ?? null;
};
