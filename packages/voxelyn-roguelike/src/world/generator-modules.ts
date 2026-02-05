import { RNG } from '@voxelyn/core';
import {
  MODULE_SELECTION_MAX,
  MODULE_SELECTION_MIN,
  MODULE_WEIGHTS_EARLY,
  MODULE_WEIGHTS_LATE,
  MODULE_WEIGHTS_MID,
} from '../game/constants';
import type { MapModuleKind } from '../game/types';
import { maskIndex } from './connectivity';

const inBounds = (width: number, height: number, x: number, y: number): boolean =>
  x > 0 && y > 0 && x < width - 1 && y < height - 1;

const carveDisk = (mask: Uint8Array, width: number, height: number, cx: number, cy: number, radius: number): void => {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (!inBounds(width, height, x, y)) continue;
      mask[maskIndex(width, x, y)] = 1;
    }
  }
};

const carveEllipse = (
  mask: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number
): void => {
  for (let y = cy - ry; y <= cy + ry; y += 1) {
    for (let x = cx - rx; x <= cx + rx; x += 1) {
      if (!inBounds(width, height, x, y)) continue;
      const nx = (x - cx) / Math.max(1, rx);
      const ny = (y - cy) / Math.max(1, ry);
      if (nx * nx + ny * ny <= 1) {
        mask[maskIndex(width, x, y)] = 1;
      }
    }
  }
};

const carveLine = (
  mask: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number
): void => {
  let ax = x0;
  let ay = y0;
  const dx = Math.abs(x1 - ax);
  const sx = ax < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - ay);
  const sy = ay < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    carveDisk(mask, width, height, ax, ay, radius);
    if (ax === x1 && ay === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      ax += sx;
    }
    if (e2 <= dx) {
      err += dx;
      ay += sy;
    }
  }
};

const applyFungalChamber = (mask: Uint8Array, width: number, height: number, rng: RNG): void => {
  const count = 1 + rng.nextInt(2);
  for (let i = 0; i < count; i += 1) {
    const cx = 8 + rng.nextInt(Math.max(1, width - 16));
    const cy = 8 + rng.nextInt(Math.max(1, height - 16));
    const rx = 4 + rng.nextInt(5);
    const ry = 3 + rng.nextInt(4);
    carveEllipse(mask, width, height, cx, cy, rx, ry);
  }
};

const applyHiveTunnels = (mask: Uint8Array, width: number, height: number, rng: RNG): void => {
  const walkers = 2 + rng.nextInt(3);
  const steps = Math.floor(width * height * 0.085);

  for (let i = 0; i < walkers; i += 1) {
    let x = 2 + rng.nextInt(width - 4);
    let y = 2 + rng.nextInt(height - 4);
    for (let s = 0; s < steps; s += 1) {
      carveDisk(mask, width, height, x, y, 1);

      const roll = rng.nextInt(8);
      if (roll <= 1) x += 1;
      else if (roll <= 3) x -= 1;
      else if (roll <= 5) y += 1;
      else y -= 1;

      x = Math.max(1, Math.min(width - 2, x));
      y = Math.max(1, Math.min(height - 2, y));
    }
  }
};

const applyMiningZone = (mask: Uint8Array, width: number, height: number, rng: RNG): void => {
  const sectors = 2 + rng.nextInt(2);
  const anchors: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < sectors; i += 1) {
    const x = 4 + rng.nextInt(Math.max(1, width - 12));
    const y = 4 + rng.nextInt(Math.max(1, height - 12));
    const rw = 4 + rng.nextInt(6);
    const rh = 3 + rng.nextInt(5);

    for (let yy = y; yy < y + rh; yy += 1) {
      for (let xx = x; xx < x + rw; xx += 1) {
        if (!inBounds(width, height, xx, yy)) continue;
        mask[maskIndex(width, xx, yy)] = 1;
      }
    }

    anchors.push({ x: x + Math.floor(rw / 2), y: y + Math.floor(rh / 2) });
  }

  for (let i = 1; i < anchors.length; i += 1) {
    const a = anchors[i - 1];
    const b = anchors[i];
    if (!a || !b) continue;
    carveLine(mask, width, height, a.x, a.y, b.x, b.y, 1);
  }
};

const applyVerticalPocket = (mask: Uint8Array, width: number, height: number, rng: RNG): void => {
  const pockets = 2 + rng.nextInt(3);
  const anchors: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < pockets; i += 1) {
    const x = 3 + rng.nextInt(width - 6);
    const y = 3 + rng.nextInt(height - 6);
    carveDisk(mask, width, height, x, y, 2 + (i % 2));
    anchors.push({ x, y });
  }

  for (let i = 1; i < anchors.length; i += 1) {
    const a = anchors[i - 1];
    const b = anchors[i];
    if (!a || !b) continue;
    carveLine(mask, width, height, a.x, a.y, b.x, b.y, 0);
  }
};

const applyRootZone = (mask: Uint8Array, width: number, height: number, rng: RNG): void => {
  const strands = 2 + rng.nextInt(3);

  for (let i = 0; i < strands; i += 1) {
    const horizontal = rng.nextFloat01() < 0.5;
    if (horizontal) {
      const y = 3 + rng.nextInt(height - 6);
      for (let x = 2; x < width - 2; x += 1) {
        if (rng.nextFloat01() < 0.14) continue;
        mask[maskIndex(width, x, y)] = 0;
      }
    } else {
      const x = 3 + rng.nextInt(width - 6);
      for (let y = 2; y < height - 2; y += 1) {
        if (rng.nextFloat01() < 0.14) continue;
        mask[maskIndex(width, x, y)] = 0;
      }
    }
  }
};

const applyMirrorPocket = (mask: Uint8Array, width: number, height: number, rng: RNG): void => {
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);

  const sx = 2 + rng.nextInt(Math.max(1, halfW - 3));
  const sy = 2 + rng.nextInt(Math.max(1, halfH - 3));
  const rw = 4 + rng.nextInt(Math.max(2, halfW - sx - 1));
  const rh = 4 + rng.nextInt(Math.max(2, halfH - sy - 1));

  for (let y = sy; y < Math.min(height - 2, sy + rh); y += 1) {
    for (let x = sx; x < Math.min(width - 2, sx + rw); x += 1) {
      if (rng.nextFloat01() < 0.34) continue;
      const mx = width - 1 - x;
      if (inBounds(width, height, x, y)) {
        mask[maskIndex(width, x, y)] = 1;
      }
      if (inBounds(width, height, mx, y)) {
        mask[maskIndex(width, mx, y)] = 1;
      }
    }
  }
};

const MODULE_APPLIERS: Record<MapModuleKind, (mask: Uint8Array, width: number, height: number, rng: RNG) => void> = {
  fungal_chamber: applyFungalChamber,
  hive_tunnels: applyHiveTunnels,
  mining_zone: applyMiningZone,
  vertical_pocket: applyVerticalPocket,
  root_zone: applyRootZone,
  mirror_pocket: applyMirrorPocket,
};

const weightedPick = (weights: Array<{ kind: MapModuleKind; weight: number }>, rng: RNG): MapModuleKind => {
  let total = 0;
  for (const weight of weights) {
    total += Math.max(0, weight.weight);
  }

  if (total <= 0) return weights[0]?.kind ?? 'hive_tunnels';

  let roll = rng.nextFloat01() * total;
  for (const item of weights) {
    roll -= Math.max(0, item.weight);
    if (roll <= 0) return item.kind;
  }

  return weights[weights.length - 1]?.kind ?? 'hive_tunnels';
};

const weightsForFloor = (floorNumber: number): Record<MapModuleKind, number> => {
  if (floorNumber <= 3) return MODULE_WEIGHTS_EARLY;
  if (floorNumber <= 7) return MODULE_WEIGHTS_MID;
  return MODULE_WEIGHTS_LATE;
};

export const chooseModules = (floorNumber: number, rng: RNG): MapModuleKind[] => {
  const desired = MODULE_SELECTION_MIN + rng.nextInt(MODULE_SELECTION_MAX - MODULE_SELECTION_MIN + 1);
  const weights = weightsForFloor(floorNumber);
  const pool = (Object.keys(weights) as MapModuleKind[]).map((kind) => ({ kind, weight: weights[kind] ?? 1 }));

  const chosen: MapModuleKind[] = [];
  while (chosen.length < desired && pool.length > 0) {
    const kind = weightedPick(pool, rng);
    if (!chosen.includes(kind)) {
      chosen.push(kind);
    }

    const index = pool.findIndex((entry) => entry.kind === kind);
    if (index >= 0) {
      pool.splice(index, 1);
    }
  }

  return chosen;
};

export const applyModules = (
  mask: Uint8Array,
  width: number,
  height: number,
  modules: MapModuleKind[],
  rng: RNG
): void => {
  for (const module of modules) {
    const apply = MODULE_APPLIERS[module];
    if (apply) {
      apply(mask, width, height, rng);
    }
  }
};
