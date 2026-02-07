import { getVoxel, setVoxel } from '@voxelyn/core';
import {
  FEATURE_BIOFLUID,
  FEATURE_GATE,
  FEATURE_ROOT_BARRIER,
} from '../game/constants';
import { isPassableMaterial } from './materials';
import type { DynamicCellState, Entity, LevelState } from '../game/types';

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

export const featureFlagsAt = (level: LevelState, x: number, y: number): number => {
  if (!inBounds2D(level, x, y)) return 0;
  return level.featureMap[index2D(level.width, x, y)] ?? 0;
};

export const hasFeatureFlag = (level: LevelState, x: number, y: number, flag: number): boolean =>
  (featureFlagsAt(level, x, y) & flag) !== 0;

export const gateAt = (level: LevelState, x: number, y: number): { id: string; open: boolean } | null => {
  for (const interactable of level.interactables) {
    if (interactable.type !== 'gate') continue;
    if (interactable.x === x && interactable.y === y) {
      return { id: interactable.id, open: interactable.open };
    }
  }
  return null;
};

export const dynamicCellAt = (level: LevelState, x: number, y: number): DynamicCellState | null => {
  for (const cell of level.dynamicCells) {
    if (cell.x === x && cell.y === y) return cell;
  }
  return null;
};

export const isDynamicBlockedCell = (level: LevelState, x: number, y: number): boolean => {
  const cell = dynamicCellAt(level, x, y);
  if (!cell) return false;
  if (cell.phase !== 'closed') return false;
  return cell.kind === 'root_barrier' || cell.kind === 'pressure_gate';
};

export const isDynamicHazardCell = (level: LevelState, x: number, y: number): boolean => {
  const cell = dynamicCellAt(level, x, y);
  if (!cell) return false;
  if (cell.kind !== 'spore_lane') return false;
  return cell.phase !== 'open';
};

export const isFeatureBlockedCell = (level: LevelState, x: number, y: number): boolean => {
  const flags = featureFlagsAt(level, x, y);
  if ((flags & FEATURE_ROOT_BARRIER) !== 0) return true;

  if ((flags & FEATURE_GATE) !== 0) {
    const gate = gateAt(level, x, y);
    if (gate && !gate.open) return true;
  }

  if (isDynamicBlockedCell(level, x, y)) return true;

  return false;
};

export const isBiofluidCell = (level: LevelState, x: number, y: number): boolean =>
  (featureFlagsAt(level, x, y) & FEATURE_BIOFLUID) !== 0;

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
  if (isFeatureBlockedCell(level, x, y)) return false;
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
