import { createVoxelGrid3D, RNG, setVoxel } from '@voxelyn/core';
import {
  FLOOR_HASH_MAGIC,
  MATERIAL_AIR,
  MATERIAL_CORE,
  MATERIAL_ENTRY,
  MATERIAL_EXIT,
  MATERIAL_FUNGAL_FLOOR,
  MATERIAL_METAL_ORE,
  MATERIAL_ROCK,
  WORLD_DEPTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../game/constants';
import type { Vec2 } from '../game/types';
import {
  computeDistanceMap,
  ensureSingleConnectedComponent,
  findFarthestReachable,
  maskIndex,
} from './connectivity';

export type GeneratedFloor = {
  grid: ReturnType<typeof createVoxelGrid3D>;
  entry: Vec2;
  exit: Vec2;
  seed: number;
  width: number;
  height: number;
  depth: number;
  mask: Uint8Array;
};

const inBounds = (x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < WORLD_WIDTH && y < WORLD_HEIGHT;

const floorSeedFor = (baseSeed: number, floorNumber: number): number =>
  (baseSeed ^ ((floorNumber * FLOOR_HASH_MAGIC) >>> 0)) >>> 0;

const enforceBorders = (mask: Uint8Array, width: number, height: number): void => {
  for (let x = 0; x < width; x += 1) {
    mask[maskIndex(width, x, 0)] = 0;
    mask[maskIndex(width, x, height - 1)] = 0;
  }
  for (let y = 0; y < height; y += 1) {
    mask[maskIndex(width, 0, y)] = 0;
    mask[maskIndex(width, width - 1, y)] = 0;
  }
};

const nearestOddInside = (value: number, maxExclusive: number): number => {
  let v = Math.max(1, Math.min(maxExclusive - 2, value));
  if (v % 2 === 0) {
    v += 1;
    if (v >= maxExclusive - 1) v -= 2;
  }
  return v;
};

const carveMaze = (
  mask: Uint8Array,
  width: number,
  height: number,
  rng: RNG,
  startX: number,
  startY: number
): void => {
  const stack: Vec2[] = [{ x: startX, y: startY }];
  mask[maskIndex(width, startX, startY)] = 1;
  const dirs: Array<[number, number]> = [
    [2, 0],
    [-2, 0],
    [0, 2],
    [0, -2],
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1] ?? { x: startX, y: startY };
    let carved = false;

    // Shuffle-like random probing for deterministic branching.
    const order = [0, 1, 2, 3];
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = rng.nextInt(i + 1);
      const temp = order[i] ?? 0;
      order[i] = order[j] ?? 0;
      order[j] = temp;
    }

    for (const idx of order) {
      const [dx, dy] = dirs[idx] ?? [0, 0];
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx <= 0 || ny <= 0 || nx >= width - 1 || ny >= height - 1) continue;
      if (mask[maskIndex(width, nx, ny)] === 1) continue;

      const bx = current.x + dx / 2;
      const by = current.y + dy / 2;
      mask[maskIndex(width, bx, by)] = 1;
      mask[maskIndex(width, nx, ny)] = 1;
      stack.push({ x: nx, y: ny });
      carved = true;
      break;
    }

    if (!carved) {
      stack.pop();
    }
  }
};

const carveLoops = (mask: Uint8Array, width: number, height: number, rng: RNG, floorNumber: number): void => {
  const attempts = Math.floor(width * height * (0.008 + Math.min(0.018, floorNumber * 0.0015)));
  const dirs: Array<[number, number]> = [
    [2, 0],
    [-2, 0],
    [0, 2],
    [0, -2],
  ];

  for (let i = 0; i < attempts; i += 1) {
    const x = nearestOddInside(1 + rng.nextInt(width - 2), width);
    const y = nearestOddInside(1 + rng.nextInt(height - 2), height);
    const [dx, dy] = dirs[rng.nextInt(dirs.length)] ?? [2, 0];
    const tx = x + dx;
    const ty = y + dy;
    const bx = x + dx / 2;
    const by = y + dy / 2;
    if (tx <= 0 || ty <= 0 || tx >= width - 1 || ty >= height - 1) continue;

    const targetIdx = maskIndex(width, tx, ty);
    const betweenIdx = maskIndex(width, bx, by);
    if (mask[targetIdx] === 1 && mask[betweenIdx] === 0) {
      mask[betweenIdx] = 1;
    }
  }
};

const carveRooms = (mask: Uint8Array, width: number, height: number, rng: RNG): void => {
  const rooms = rng.nextInt(3);
  for (let i = 0; i < rooms; i += 1) {
    const cx = 4 + rng.nextInt(width - 8);
    const cy = 4 + rng.nextInt(height - 8);
    const rx = 1 + rng.nextInt(3);
    const ry = 1 + rng.nextInt(3);

    for (let y = cy - ry; y <= cy + ry; y += 1) {
      for (let x = cx - rx; x <= cx + rx; x += 1) {
        if (!inBounds(x, y)) continue;
        const nx = (x - cx) / Math.max(1, rx);
        const ny = (y - cy) / Math.max(1, ry);
        if (nx * nx + ny * ny <= 1) {
          mask[maskIndex(width, x, y)] = 1;
        }
      }
    }
  }
};

const findNearestPassable = (mask: Uint8Array, width: number, height: number, from: Vec2): Vec2 => {
  if (mask[maskIndex(width, from.x, from.y)] === 1) return from;

  for (let r = 1; r < Math.max(width, height); r += 1) {
    for (let y = from.y - r; y <= from.y + r; y += 1) {
      for (let x = from.x - r; x <= from.x + r; x += 1) {
        if (!inBounds(x, y)) continue;
        if (mask[maskIndex(width, x, y)] === 1) {
          return { x, y };
        }
      }
    }
  }

  return { x: 1, y: 1 };
};

const buildMask = (seed: number, floorNumber: number): Uint8Array => {
  const rng = new RNG(seed + 17);
  const mask = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);

  const startX = nearestOddInside(Math.floor(WORLD_WIDTH / 2), WORLD_WIDTH);
  const startY = nearestOddInside(Math.floor(WORLD_HEIGHT / 2), WORLD_HEIGHT);
  carveMaze(mask, WORLD_WIDTH, WORLD_HEIGHT, rng, startX, startY);
  carveLoops(mask, WORLD_WIDTH, WORLD_HEIGHT, rng, floorNumber);

  carveRooms(mask, WORLD_WIDTH, WORLD_HEIGHT, rng);
  enforceBorders(mask, WORLD_WIDTH, WORLD_HEIGHT);

  return mask;
};

const writeGrid = (
  mask: Uint8Array,
  entry: Vec2,
  exit: Vec2,
  seed: number,
  floorNumber: number
): ReturnType<typeof createVoxelGrid3D> => {
  const grid = createVoxelGrid3D(WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH);
  const rng = new RNG(seed + 999);
  const objectiveMaterial = floorNumber === 10 ? MATERIAL_CORE : MATERIAL_EXIT;

  for (let z = 0; z < WORLD_DEPTH; z += 1) {
    for (let y = 0; y < WORLD_HEIGHT; y += 1) {
      for (let x = 0; x < WORLD_WIDTH; x += 1) {
        setVoxel(grid, x, y, z, MATERIAL_AIR);
      }
    }
  }

  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      const idx = maskIndex(WORLD_WIDTH, x, y);
      const passable = mask[idx] === 1;

      if (passable) {
        setVoxel(grid, x, y, 0, MATERIAL_FUNGAL_FLOOR);
      } else {
        const rockMaterial = rng.nextFloat01() < 0.08 ? MATERIAL_METAL_ORE : MATERIAL_ROCK;
        setVoxel(grid, x, y, 0, rockMaterial);
      }
    }
  }

  setVoxel(grid, entry.x, entry.y, 0, MATERIAL_ENTRY);
  setVoxel(grid, exit.x, exit.y, 0, objectiveMaterial);

  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      const base = mask[maskIndex(WORLD_WIDTH, x, y)] === 1 ? MATERIAL_AIR : MATERIAL_ROCK;
      for (let z = 1; z < WORLD_DEPTH; z += 1) {
        setVoxel(grid, x, y, z, base);
      }
    }
  }

  return grid;
};

export const generateFloor = (baseSeed: number, floorNumber: number): GeneratedFloor => {
  const seed = floorSeedFor(baseSeed, floorNumber);
  const rng = new RNG(seed + 1337);
  const mask = buildMask(seed, floorNumber);

  let entry = findNearestPassable(mask, WORLD_WIDTH, WORLD_HEIGHT, {
    x: Math.floor(WORLD_WIDTH / 2),
    y: Math.floor(WORLD_HEIGHT / 2),
  });

  ensureSingleConnectedComponent(mask, WORLD_WIDTH, WORLD_HEIGHT, entry, rng);
  entry = findNearestPassable(mask, WORLD_WIDTH, WORLD_HEIGHT, entry);

  const distances = computeDistanceMap(mask, WORLD_WIDTH, WORLD_HEIGHT, entry);
  const exit = findFarthestReachable(distances, WORLD_WIDTH, WORLD_HEIGHT, entry);

  const grid = writeGrid(mask, entry, exit, seed, floorNumber);

  return {
    grid,
    entry,
    exit,
    seed,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    depth: WORLD_DEPTH,
    mask,
  };
};
