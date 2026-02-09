import { RNG } from '@voxelyn/core';
import {
  CA_CLOSE_IF_WALL_NEIGHBORS_GE,
  CA_ITERATIONS,
  CA_OPEN_IF_WALL_NEIGHBORS_LE,
  CA_TARGET_OPEN_MAX,
  CA_TARGET_OPEN_MIN,
} from '../game/constants';
import type { Vec2 } from '../game/types';
import { maskIndex } from './connectivity';

type CellularRules = {
  openIfWallNeighborsLE: number;
  closeIfWallNeighborsGE: number;
};

type CellularConfig = {
  iterations: number;
  rules: CellularRules;
};

const defaultConfig: CellularConfig = {
  iterations: CA_ITERATIONS,
  rules: {
    openIfWallNeighborsLE: CA_OPEN_IF_WALL_NEIGHBORS_LE,
    closeIfWallNeighborsGE: CA_CLOSE_IF_WALL_NEIGHBORS_GE,
  },
};

const inBounds = (width: number, height: number, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < width && y < height;

export const countWallNeighbors8 = (
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
): number => {
  let walls = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(width, height, nx, ny)) {
        walls += 1;
        continue;
      }
      const v = mask[maskIndex(width, nx, ny)] ?? 0;
      if (v === 0) walls += 1;
    }
  }
  return walls;
};

const markDisk = (
  out: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number
): void => {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(width, height, nx, ny)) continue;
      out[maskIndex(width, nx, ny)] = 1;
    }
  }
};

export const buildProtectedMask = (
  width: number,
  height: number,
  entry: Vec2,
  exit: Vec2,
  path: Vec2[],
  radius: number
): Uint8Array => {
  const out = new Uint8Array(width * height);
  markDisk(out, width, height, entry.x, entry.y, Math.max(0, radius));
  markDisk(out, width, height, exit.x, exit.y, Math.max(0, radius));
  for (const cell of path) {
    markDisk(out, width, height, cell.x, cell.y, Math.max(0, radius));
  }
  return out;
};

const enforceBorderWalls = (mask: Uint8Array, width: number, height: number): void => {
  for (let x = 0; x < width; x += 1) {
    mask[maskIndex(width, x, 0)] = 0;
    mask[maskIndex(width, x, height - 1)] = 0;
  }
  for (let y = 0; y < height; y += 1) {
    mask[maskIndex(width, 0, y)] = 0;
    mask[maskIndex(width, width - 1, y)] = 0;
  }
};

export const runCellularAutomata = (
  mask: Uint8Array,
  width: number,
  height: number,
  protectedMask: Uint8Array,
  config: Partial<CellularConfig> = {}
): Uint8Array => {
  const iterations = config.iterations ?? defaultConfig.iterations;
  const rules = {
    openIfWallNeighborsLE: config.rules?.openIfWallNeighborsLE ?? defaultConfig.rules.openIfWallNeighborsLE,
    closeIfWallNeighborsGE: config.rules?.closeIfWallNeighborsGE ?? defaultConfig.rules.closeIfWallNeighborsGE,
  };

  const current = new Uint8Array(mask);
  const next = new Uint8Array(mask.length);

  for (let iter = 0; iter < Math.max(0, iterations); iter += 1) {
    next.set(current);

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = maskIndex(width, x, y);
        if ((protectedMask[i] ?? 0) === 1) {
          next[i] = 1;
          continue;
        }

        const wallNeighbors = countWallNeighbors8(current, width, height, x, y);
        if (wallNeighbors >= rules.closeIfWallNeighborsGE) {
          next[i] = 0;
        } else if (wallNeighbors <= rules.openIfWallNeighborsLE) {
          next[i] = 1;
        } else {
          next[i] = current[i] ?? 0;
        }
      }
    }

    current.set(next);
    enforceBorderWalls(current, width, height);
  }

  return current;
};

export const computeOpenRatio = (mask: Uint8Array): number => {
  if (mask.length === 0) return 0;
  let open = 0;
  for (let i = 0; i < mask.length; i += 1) {
    if ((mask[i] ?? 0) === 1) open += 1;
  }
  return open / mask.length;
};

export const applyOpenRatioCorrection = (
  mask: Uint8Array,
  width: number,
  height: number,
  protectedMask: Uint8Array,
  rng: RNG,
  minRatio = CA_TARGET_OPEN_MIN,
  maxRatio = CA_TARGET_OPEN_MAX
): void => {
  const ratio = computeOpenRatio(mask);
  if (ratio >= minRatio && ratio <= maxRatio) return;

  const candidates: number[] = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = maskIndex(width, x, y);
      if ((protectedMask[i] ?? 0) === 1) continue;
      candidates.push(i);
    }
  }

  const targetOpen = ratio < minRatio
    ? Math.ceil(minRatio * mask.length)
    : Math.floor(maxRatio * mask.length);

  // Deterministic shuffle
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    const tmp = candidates[i] ?? 0;
    candidates[i] = candidates[j] ?? 0;
    candidates[j] = tmp;
  }

  let openCount = Math.round(ratio * mask.length);
  for (const idx of candidates) {
    if (ratio < minRatio) {
      if ((mask[idx] ?? 0) === 1) continue;
      mask[idx] = 1;
      openCount += 1;
      if (openCount >= targetOpen) break;
    } else {
      if ((mask[idx] ?? 0) === 0) continue;
      // Favor closing cells in dense open fields for a cave-like silhouette.
      const x = idx % width;
      const y = Math.floor(idx / width);
      const wallNeighbors = countWallNeighbors8(mask, width, height, x, y);
      if (wallNeighbors <= 2) continue;
      mask[idx] = 0;
      openCount -= 1;
      if (openCount <= targetOpen) break;
    }
  }

  if (ratio > maxRatio && openCount > targetOpen) {
    for (const idx of candidates) {
      if ((mask[idx] ?? 0) === 0) continue;
      mask[idx] = 0;
      openCount -= 1;
      if (openCount <= targetOpen) break;
    }
  }

  enforceBorderWalls(mask, width, height);
};
