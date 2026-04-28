import { RNG } from '@voxelyn/core';
import {
  BIOFLUID_DAMAGE,
  BIOFLUID_TICK_MS,
  BIOFLUID_DENSITY,
  CRYSTAL_ATTACK_BONUS,
  CRYSTAL_BUFF_MS,
  CRYSTAL_DENSITY,
  CRYSTAL_HEAL,
  FEATURE_BIOFLUID,
  FEATURE_CRYSTAL,
  FEATURE_GATE,
  FEATURE_PORTAL,
  FEATURE_PROP_BEACON,
  FEATURE_PROP_CRATE,
  FEATURE_PROP_DEBRIS,
  FEATURE_PROP_FUNGAL_CLUSTER,
  FEATURE_ROOT_BARRIER,
  FEATURE_SPORE_VENT,
  FEATURE_TERMINAL,
  FEATURE_TRACK,
  ONE_WAY_PORTAL_CHANCE,
  PROP_BEACON_DENSITY,
  PROP_CRATE_DENSITY,
  PROP_DEBRIS_DENSITY,
  PROP_FUNGAL_CLUSTER_DENSITY,
  SCREEN_FLASH_MS,
  SPORE_SLOW_MS,
  SPORE_VENT_COOLDOWN_MS,
  SPORE_VENT_DENSITY,
  TERMINAL_PUZZLE_CHANCE,
  TERMINAL_BROKEN_CHANCE,
} from '../game/constants';
import type {
  GameState,
  GateInteractable,
  LevelInteractable,
  MapModuleKind,
  PlayerState,
  TileFeatureFlags,
  Vec2,
} from '../game/types';
import { computeDistanceMap, maskIndex } from './connectivity';
import { inBounds2D, isWalkableCell, moveEntity } from './level';

export type GeneratedFeatures = {
  featureMap: Uint16Array;
  interactables: LevelInteractable[];
};

type GenerationInput = {
  mask: Uint8Array;
  width: number;
  height: number;
  entry: Vec2;
  exit: Vec2;
  seed: number;
  floorNumber: number;
  modules: MapModuleKind[];
};

const inBounds = (width: number, height: number, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < width && y < height;

const neighbors4 = (x: number, y: number): Vec2[] => [
  { x: x + 1, y },
  { x: x - 1, y },
  { x, y: y + 1 },
  { x, y: y - 1 },
];

const CARDINAL_DIRS: Vec2[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const buildMainPathSet = (
  mask: Uint8Array,
  width: number,
  height: number,
  entry: Vec2,
  exit: Vec2
): Set<number> => {
  const dist = computeDistanceMap(mask, width, height, entry);
  const out = new Set<number>();

  const endIdx = maskIndex(width, exit.x, exit.y);
  if ((dist[endIdx] ?? -1) < 0) {
    return out;
  }

  let current = { x: exit.x, y: exit.y };
  out.add(maskIndex(width, current.x, current.y));

  while (!(current.x === entry.x && current.y === entry.y)) {
    const currentDist = dist[maskIndex(width, current.x, current.y)] ?? -1;
    if (currentDist <= 0) break;

    let next = current;
    for (const neighbor of neighbors4(current.x, current.y)) {
      if (!inBounds(width, height, neighbor.x, neighbor.y)) continue;
      const ni = maskIndex(width, neighbor.x, neighbor.y);
      if (mask[ni] !== 1) continue;
      const nd = dist[ni] ?? -1;
      if (nd === currentDist - 1) {
        next = neighbor;
        break;
      }
    }

    if (next.x === current.x && next.y === current.y) break;
    current = next;
    out.add(maskIndex(width, current.x, current.y));
  }

  return out;
};

const choosePassableCells = (
  mask: Uint8Array,
  width: number,
  height: number,
  entry: Vec2,
  exit: Vec2
): number[] => {
  const out: number[] = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if ((x === entry.x && y === entry.y) || (x === exit.x && y === exit.y)) continue;
      const i = maskIndex(width, x, y);
      if (mask[i] === 1) out.push(i);
    }
  }
  return out;
};

const markTracks = (
  featureMap: Uint16Array,
  width: number,
  height: number,
  rng: RNG,
  modules: MapModuleKind[]
): void => {
  if (!modules.includes('mining_zone')) return;

  const horizontal = rng.nextFloat01() < 0.5;
  if (horizontal) {
    const y = 2 + rng.nextInt(height - 4);
    for (let x = 1; x < width - 1; x += 1) {
      featureMap[maskIndex(width, x, y)] |= FEATURE_TRACK;
    }
  } else {
    const x = 2 + rng.nextInt(width - 4);
    for (let y = 1; y < height - 1; y += 1) {
      featureMap[maskIndex(width, x, y)] |= FEATURE_TRACK;
    }
  }
};

const placeRootBarriers = (
  featureMap: Uint16Array,
  candidates: number[],
  mainPath: Set<number>,
  rng: RNG,
  modules: MapModuleKind[]
): void => {
  if (!modules.includes('root_zone')) return;

  const target = Math.min(18, 6 + rng.nextInt(10));
  let placed = 0;
  let guard = 0;
  while (placed < target && guard < candidates.length * 3) {
    guard += 1;
    const idx = candidates[rng.nextInt(candidates.length)] ?? 0;
    if (mainPath.has(idx)) continue;
    if ((featureMap[idx] & FEATURE_ROOT_BARRIER) !== 0) continue;
    featureMap[idx] |= FEATURE_ROOT_BARRIER;
    placed += 1;
  }
};

const sampleDistinctCell = (
  candidates: number[],
  rng: RNG,
  used: Set<number>,
  predicate?: (idx: number) => boolean
): number | null => {
  if (candidates.length === 0) return null;

  for (let i = 0; i < candidates.length * 2; i += 1) {
    const idx = candidates[rng.nextInt(candidates.length)] ?? 0;
    if (used.has(idx)) continue;
    if (predicate && !predicate(idx)) continue;
    used.add(idx);
    return idx;
  }

  return null;
};

const GAMEPLAY_FEATURE_MASK =
  FEATURE_BIOFLUID |
  FEATURE_ROOT_BARRIER |
  FEATURE_SPORE_VENT |
  FEATURE_CRYSTAL |
  FEATURE_PORTAL |
  FEATURE_TERMINAL |
  FEATURE_GATE;

const hasCandidateNeighbor = (candidateSet: Set<number>, width: number, height: number, idx: number): boolean => {
  const x = idx % width;
  const y = Math.floor(idx / width);
  for (const n of neighbors4(x, y)) {
    if (!inBounds(width, height, n.x, n.y)) return true;
    if (!candidateSet.has(maskIndex(width, n.x, n.y))) return true;
  }
  return false;
};

const hasCornerWalls = (candidateSet: Set<number>, width: number, height: number, idx: number): boolean => {
  const x = idx % width;
  const y = Math.floor(idx / width);
  const blocked = {
    east: !inBounds(width, height, x + 1, y) || !candidateSet.has(maskIndex(width, x + 1, y)),
    west: !inBounds(width, height, x - 1, y) || !candidateSet.has(maskIndex(width, x - 1, y)),
    south: !inBounds(width, height, x, y + 1) || !candidateSet.has(maskIndex(width, x, y + 1)),
    north: !inBounds(width, height, x, y - 1) || !candidateSet.has(maskIndex(width, x, y - 1)),
  };
  return (
    (blocked.north && blocked.west) ||
    (blocked.north && blocked.east) ||
    (blocked.south && blocked.west) ||
    (blocked.south && blocked.east)
  );
};

const isAdjacentToSet = (width: number, height: number, idx: number, cells: Set<number>): boolean => {
  const x = idx % width;
  const y = Math.floor(idx / width);
  return neighbors4(x, y).some((n) => inBounds(width, height, n.x, n.y) && cells.has(maskIndex(width, n.x, n.y)));
};

const squaredDistanceToPoint = (width: number, idx: number, point: Vec2): number => {
  const x = idx % width;
  const y = Math.floor(idx / width);
  const dx = x - point.x;
  const dy = y - point.y;
  return dx * dx + dy * dy;
};

const pathExistsWithBlockingFeatures = (
  mask: Uint8Array,
  featureMap: Uint16Array,
  width: number,
  height: number,
  entry: Vec2,
  exit: Vec2
): boolean => {
  const entryIdx = maskIndex(width, entry.x, entry.y);
  const exitIdx = maskIndex(width, exit.x, exit.y);
  const isOpen = (idx: number): boolean => {
    if ((mask[idx] ?? 0) !== 1) return false;
    const flags = featureMap[idx] ?? 0;
    if ((flags & FEATURE_ROOT_BARRIER) !== 0) return false;
    if ((flags & FEATURE_PROP_CRATE) !== 0) return false;
    if ((flags & FEATURE_TERMINAL) !== 0) return false;
    return true;
  };

  if (!isOpen(entryIdx) || !isOpen(exitIdx)) return false;

  const queue = new Int32Array(width * height);
  const visited = new Uint8Array(width * height);
  let head = 0;
  let tail = 0;
  queue[tail] = entryIdx;
  visited[entryIdx] = 1;
  tail += 1;

  while (head < tail) {
    const current = queue[head] ?? 0;
    head += 1;
    if (current === exitIdx) return true;

    const x = current % width;
    const y = Math.floor(current / width);
    for (const n of neighbors4(x, y)) {
      if (!inBounds(width, height, n.x, n.y)) continue;
      const ni = maskIndex(width, n.x, n.y);
      if (visited[ni] === 1 || !isOpen(ni)) continue;
      visited[ni] = 1;
      queue[tail] = ni;
      tail += 1;
    }
  }

  return false;
};

const shuffledOffsetsInRadius = (radius: number, rng: RNG): Vec2[] => {
  const offsetsByDistance: Vec2[][] = Array.from({ length: radius + 1 }, () => []);
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const distance = Math.abs(dx) + Math.abs(dy);
      if (distance === 0 || distance > radius) continue;
      offsetsByDistance[distance]?.push({ x: dx, y: dy });
    }
  }

  const offsets: Vec2[] = [];
  for (let distance = 1; distance < offsetsByDistance.length; distance += 1) {
    const bucket = offsetsByDistance[distance] ?? [];
    for (let i = bucket.length - 1; i > 0; i -= 1) {
      const j = rng.nextInt(i + 1);
      const temp = bucket[i] ?? { x: 0, y: 0 };
      bucket[i] = bucket[j] ?? temp;
      bucket[j] = temp;
    }
    offsets.push(...bucket);
  }

  return offsets;
};

const shuffleCells = (cells: number[], rng: RNG): void => {
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    const temp = cells[i] ?? 0;
    cells[i] = cells[j] ?? temp;
    cells[j] = temp;
  }
};

const placeCells = (
  featureMap: Uint16Array,
  cells: number[],
  flag: number,
  occupied: Set<number>,
  targetCount: number
): number => {
  let placed = 0;
  for (const cell of cells) {
    if (placed >= targetCount) break;
    if (occupied.has(cell)) continue;
    featureMap[cell] |= flag;
    occupied.add(cell);
    placed += 1;
  }
  return placed;
};

const placeBiofluidLanes = (
  featureMap: Uint16Array,
  candidates: number[],
  width: number,
  height: number,
  mainPath: Set<number>,
  rng: RNG,
  occupied: Set<number>,
  targetCount: number
): void => {
  const candidateSet = new Set(candidates);
  const mainPathCells = candidates.filter((idx) => mainPath.has(idx));
  const canPlace = (idx: number): boolean =>
    candidateSet.has(idx) &&
    !occupied.has(idx) &&
    (featureMap[idx] & FEATURE_ROOT_BARRIER) === 0;

  let placed = 0;
  let guard = 0;
  const maxAttempts = Math.max(24, targetCount * 12);
  while (placed < targetCount && guard < maxAttempts) {
    guard += 1;
    const anchorPool = mainPathCells.length > 0 && rng.nextFloat01() < 0.72 ? mainPathCells : candidates;
    const anchor = anchorPool[rng.nextInt(anchorPool.length)] ?? 0;
    if (!canPlace(anchor)) continue;

    const dir = CARDINAL_DIRS[rng.nextInt(CARDINAL_DIRS.length)] ?? CARDINAL_DIRS[0]!;
    const targetLength = 4 + rng.nextInt(5);
    const ax = anchor % width;
    const ay = Math.floor(anchor / width);
    const cells: number[] = [anchor];

    const extend = (sign: -1 | 1): void => {
      for (let step = 1; cells.length < targetLength; step += 1) {
        const x = ax + dir.x * step * sign;
        const y = ay + dir.y * step * sign;
        if (!inBounds(width, height, x, y)) break;
        const idx = maskIndex(width, x, y);
        if (!canPlace(idx)) break;
        cells.push(idx);
      }
    };

    if (rng.nextFloat01() < 0.5) {
      extend(1);
      extend(-1);
    } else {
      extend(-1);
      extend(1);
    }

    const sortedCells = [...cells].sort((a, b) => {
      const ax0 = a % width;
      const ay0 = Math.floor(a / width);
      const bx0 = b % width;
      const by0 = Math.floor(b / width);
      return (ax0 - bx0) * dir.x + (ay0 - by0) * dir.y;
    });

    if (sortedCells.length < 3) continue;
    placed += placeCells(featureMap, sortedCells, FEATURE_BIOFLUID, occupied, targetCount - placed);
  }

  while (placed < targetCount) {
    const idx = sampleDistinctCell(candidates, rng, occupied, canPlace);
    if (idx == null) break;
    featureMap[idx] |= FEATURE_BIOFLUID;
    placed += 1;
  }
};

const placeDecorativeProps = (
  featureMap: Uint16Array,
  mask: Uint8Array,
  candidates: number[],
  width: number,
  height: number,
  mainPath: Set<number>,
  entry: Vec2,
  exit: Vec2,
  rng: RNG,
  modules: MapModuleKind[],
  occupied: Set<number>
): void => {
  const canDecorate = (idx: number): boolean => (featureMap[idx] & GAMEPLAY_FEATURE_MASK) === 0;
  const candidateSet = new Set(candidates);
  const pickDecorCell = (predicate: (idx: number) => boolean): number | null => {
    for (let i = 0; i < candidates.length * 2; i += 1) {
      const idx = candidates[rng.nextInt(candidates.length)] ?? 0;
      if (occupied.has(idx)) continue;
      if (!canDecorate(idx)) continue;
      if (!predicate(idx)) continue;
      return idx;
    }
    return null;
  };

  const fungalDensity =
    PROP_FUNGAL_CLUSTER_DENSITY +
    (modules.includes('fungal_chamber') ? 0.016 : 0) +
    (modules.includes('root_zone') ? 0.012 : 0);
  const debrisDensity =
    PROP_DEBRIS_DENSITY +
    (modules.includes('hive_tunnels') ? 0.009 : 0) +
    (modules.includes('mining_zone') ? 0.011 : 0);
  const crateDensity =
    PROP_CRATE_DENSITY +
    (modules.includes('mining_zone') ? 0.02 : 0) +
    (modules.includes('vertical_pocket') ? 0.007 : 0);
  const beaconDensity =
    PROP_BEACON_DENSITY +
    (modules.includes('mining_zone') ? 0.01 : 0) +
    (modules.includes('mirror_pocket') ? 0.008 : 0);

  const placeCluster = (
    flag: number,
    anchor: number,
    radius: number,
    wanted: number,
    predicate: (idx: number) => boolean = () => true
  ): number => {
    if (!canDecorate(anchor) || occupied.has(anchor) || !predicate(anchor)) return 0;

    let placed = 0;
    featureMap[anchor] |= flag;
    occupied.add(anchor);
    placed += 1;

    const ax = anchor % width;
    const ay = Math.floor(anchor / width);
    for (const offset of shuffledOffsetsInRadius(radius, rng)) {
      if (placed >= wanted) break;
      const x = ax + offset.x;
      const y = ay + offset.y;
      if (!inBounds(width, height, x, y)) continue;
      const idx = maskIndex(width, x, y);
      if (!candidateSet.has(idx) || occupied.has(idx) || !canDecorate(idx) || !predicate(idx)) continue;
      featureMap[idx] |= flag;
      occupied.add(idx);
      placed += 1;
    }

    return placed;
  };

  const placeFungalColonies = (targetCount: number): void => {
    let placed = 0;
    let guard = 0;
    while (placed < targetCount && guard < targetCount * 10) {
      guard += 1;
      const anchor = pickDecorCell((idx) => !mainPath.has(idx) && hasCornerWalls(candidateSet, width, height, idx));
      if (anchor == null) break;

      placed += placeCluster(
        FEATURE_PROP_FUNGAL_CLUSTER,
        anchor,
        2,
        Math.min(targetCount - placed, 3 + rng.nextInt(4)),
        (idx) => !mainPath.has(idx) && hasCandidateNeighbor(candidateSet, width, height, idx)
      );

      if (placed >= targetCount || rng.nextFloat01() >= 0.7) continue;
      const ax = anchor % width;
      const ay = Math.floor(anchor / width);
      const dir = CARDINAL_DIRS[rng.nextInt(CARDINAL_DIRS.length)] ?? CARDINAL_DIRS[0]!;
      const distance = 3 + rng.nextInt(2);
      const sx = ax + dir.x * distance;
      const sy = ay + dir.y * distance;
      if (!inBounds(width, height, sx, sy)) continue;
      const satellite = maskIndex(width, sx, sy);
      if (!candidateSet.has(satellite)) continue;
      placed += placeCluster(
        FEATURE_PROP_FUNGAL_CLUSTER,
        satellite,
        1,
        Math.min(targetCount - placed, 2 + rng.nextInt(3)),
        (idx) => !mainPath.has(idx) && hasCandidateNeighbor(candidateSet, width, height, idx)
      );
    }
  };

  const placeRubblePiles = (targetCount: number): void => {
    let placed = 0;
    let guard = 0;
    while (placed < targetCount && guard < targetCount * 10) {
      guard += 1;
      const anchor = pickDecorCell((idx) => hasCandidateNeighbor(candidateSet, width, height, idx));
      if (anchor == null) break;
      placed += placeCluster(
        FEATURE_PROP_DEBRIS,
        anchor,
        1,
        Math.min(targetCount - placed, 2 + rng.nextInt(3))
      );
    }

    while (placed < targetCount) {
      const idx = sampleDistinctCell(candidates, rng, occupied, canDecorate);
      if (idx == null) break;
      featureMap[idx] |= FEATURE_PROP_DEBRIS;
      placed += 1;
    }
  };

  const placeCrateRuns = (targetCount: number): void => {
    let placed = 0;
    const placedCells: number[] = [];
    const anchors = candidates.filter((idx) =>
      !occupied.has(idx) &&
      canDecorate(idx) &&
      !mainPath.has(idx) &&
      isAdjacentToSet(width, height, idx, mainPath) &&
      squaredDistanceToPoint(width, idx, entry) > 16 &&
      squaredDistanceToPoint(width, idx, exit) > 16
    );
    shuffleCells(anchors, rng);

    for (const anchor of anchors) {
      if (placed >= targetCount) break;
      if (
        occupied.has(anchor) ||
        !canDecorate(anchor) ||
        mainPath.has(anchor) ||
        !isAdjacentToSet(width, height, anchor, mainPath)
      ) {
        continue;
      }
      const dir = CARDINAL_DIRS[rng.nextInt(CARDINAL_DIRS.length)] ?? CARDINAL_DIRS[0]!;
      const ax = anchor % width;
      const ay = Math.floor(anchor / width);
      const length = Math.min(targetCount - placed, 2 + rng.nextInt(modules.includes('mining_zone') ? 3 : 2));
      const cells: number[] = [];

      for (let step = 0; step < length; step += 1) {
        const x = ax + dir.x * step;
        const y = ay + dir.y * step;
        if (!inBounds(width, height, x, y)) continue;
        const idx = maskIndex(width, x, y);
        if (!candidateSet.has(idx) || occupied.has(idx) || !canDecorate(idx)) continue;
        if (mainPath.has(idx) || !isAdjacentToSet(width, height, idx, mainPath)) continue;
        cells.push(idx);
      }

      if (cells.length < 2) continue;
      for (const cell of cells) {
        featureMap[cell] |= FEATURE_PROP_CRATE;
        occupied.add(cell);
        placedCells.push(cell);
        placed += 1;
      }
    }

    if (!pathExistsWithBlockingFeatures(mask, featureMap, width, height, entry, exit)) {
      for (const cell of placedCells) {
        featureMap[cell] &= ~FEATURE_PROP_CRATE;
        occupied.delete(cell);
      }
    }
  };

  const placeBeaconPairs = (targetCount: number): void => {
    let placed = 0;
    let guard = 0;
    while (placed < targetCount && guard < Math.max(18, targetCount * 8)) {
      guard += 1;
      const anchor = pickDecorCell((idx) => !mainPath.has(idx));
      if (anchor == null) break;

      featureMap[anchor] |= FEATURE_PROP_BEACON;
      occupied.add(anchor);
      placed += 1;
      if (placed >= targetCount) break;

      const ax = anchor % width;
      const ay = Math.floor(anchor / width);
      const dir = CARDINAL_DIRS[rng.nextInt(CARDINAL_DIRS.length)] ?? CARDINAL_DIRS[0]!;
      const pairDistance = 2 + rng.nextInt(2);
      const px = ax + dir.x * pairDistance;
      const py = ay + dir.y * pairDistance;
      if (!inBounds(width, height, px, py)) continue;
      const pair = maskIndex(width, px, py);
      if (!candidateSet.has(pair) || occupied.has(pair) || !canDecorate(pair)) continue;
      featureMap[pair] |= FEATURE_PROP_BEACON;
      occupied.add(pair);
      placed += 1;
    }
  };

  placeFungalColonies(Math.max(6, Math.floor(candidates.length * fungalDensity)));
  placeRubblePiles(Math.max(4, Math.floor(candidates.length * debrisDensity)));
  placeCrateRuns(Math.floor(candidates.length * crateDensity));
  placeBeaconPairs(Math.floor(candidates.length * beaconDensity));
};

export const generateLevelFeatures = (input: GenerationInput): GeneratedFeatures => {
  const rng = new RNG(input.seed ^ 0x8f01aa77);
  const featureMap = new Uint16Array(input.width * input.height);
  const interactables: LevelInteractable[] = [];

  const candidates = choosePassableCells(input.mask, input.width, input.height, input.entry, input.exit);
  const candidateSet = new Set(candidates);
  const mainPath = buildMainPathSet(input.mask, input.width, input.height, input.entry, input.exit);
  const used = new Set<number>();

  markTracks(featureMap, input.width, input.height, rng, input.modules);
  placeRootBarriers(featureMap, candidates, mainPath, rng, input.modules);

  const bioCount = Math.max(4, Math.floor(candidates.length * BIOFLUID_DENSITY));
  placeBiofluidLanes(featureMap, candidates, input.width, input.height, mainPath, rng, used, bioCount);

  const ventCount = Math.max(1, Math.floor(candidates.length * SPORE_VENT_DENSITY));
  for (let i = 0; i < ventCount; i += 1) {
    const idx = sampleDistinctCell(candidates, rng, used, (cell) => (featureMap[cell] & FEATURE_ROOT_BARRIER) === 0);
    if (idx == null) continue;
    const x = idx % input.width;
    const y = Math.floor(idx / input.width);
    featureMap[idx] |= FEATURE_SPORE_VENT;
    interactables.push({
      id: `vent_${input.floorNumber}_${x}_${y}`,
      type: 'spore_vent',
      x,
      y,
      cooldownMs: SPORE_VENT_COOLDOWN_MS,
      nextTriggerAt: 0,
    });
  }

  const crystalCount = Math.max(1, Math.floor(candidates.length * CRYSTAL_DENSITY));
  for (let i = 0; i < crystalCount; i += 1) {
    const idx = sampleDistinctCell(candidates, rng, used, (cell) => !mainPath.has(cell) && (featureMap[cell] & FEATURE_ROOT_BARRIER) === 0);
    if (idx == null) continue;
    const x = idx % input.width;
    const y = Math.floor(idx / input.width);
    featureMap[idx] |= FEATURE_CRYSTAL;
    interactables.push({
      id: `crystal_${input.floorNumber}_${x}_${y}`,
      type: 'crystal',
      x,
      y,
      used: false,
    });
  }

  if (rng.nextFloat01() < ONE_WAY_PORTAL_CHANCE && candidates.length > 12) {
    const source = sampleDistinctCell(candidates, rng, used, (cell) => !mainPath.has(cell));
    const target = sampleDistinctCell(candidates, rng, used, (cell) => cell !== source);
    if (source != null && target != null) {
      const sx = source % input.width;
      const sy = Math.floor(source / input.width);
      const tx = target % input.width;
      const ty = Math.floor(target / input.width);
      featureMap[source] |= FEATURE_PORTAL;
      interactables.push({
        id: `portal_${input.floorNumber}_${sx}_${sy}`,
        type: 'one_way_portal',
        x: sx,
        y: sy,
        target: { x: tx, y: ty },
      });
    }
  }

  if (rng.nextFloat01() < TERMINAL_PUZZLE_CHANCE && candidates.length > 20) {
    const gateCell = sampleDistinctCell(candidates, rng, used, (cell) => !mainPath.has(cell));
    if (gateCell != null) {
      const gx = gateCell % input.width;
      const gy = Math.floor(gateCell / input.width);
      const gateId = `gate_${input.floorNumber}_${gx}_${gy}`;

      featureMap[gateCell] |= FEATURE_GATE;
      const gate: GateInteractable = {
        id: gateId,
        type: 'gate',
        x: gx,
        y: gy,
        open: false,
      };
      interactables.push(gate);

      for (let i = 0; i < 2; i += 1) {
        const terminalPredicate = (cell: number, requireWall: boolean): boolean => {
          if (cell === gateCell) return false;
          if (mainPath.has(cell)) return false;
          if (requireWall && !hasCandidateNeighbor(candidateSet, input.width, input.height, cell)) return false;
          const x = cell % input.width;
          const y = Math.floor(cell / input.width);
          const dx = x - gx;
          const dy = y - gy;
          return dx * dx + dy * dy >= 16;
        };
        const terminalCell =
          sampleDistinctCell(candidates, rng, used, (cell) => terminalPredicate(cell, true)) ??
          sampleDistinctCell(candidates, rng, used, (cell) => terminalPredicate(cell, false));
        if (terminalCell == null) continue;
        const tx = terminalCell % input.width;
        const ty = Math.floor(terminalCell / input.width);
        featureMap[terminalCell] |= FEATURE_TERMINAL;
        const broken = rng.nextFloat01() < TERMINAL_BROKEN_CHANCE;
        interactables.push({
          id: `terminal_${input.floorNumber}_${tx}_${ty}`,
          type: 'terminal',
          x: tx,
          y: ty,
          active: false,
          broken,
          linkedGateId: gateId,
        });
      }

      const linkedTerminals = interactables.filter(
        (item): item is Extract<LevelInteractable, { type: 'terminal' }> =>
          item.type === 'terminal' && item.linkedGateId === gateId
      );

      if (linkedTerminals.length > 0 && linkedTerminals.every((item) => item.broken)) {
        const pick = linkedTerminals[rng.nextInt(linkedTerminals.length)];
        if (pick) pick.broken = false;
      }

      // If we could not place both terminals, keep gate open to avoid accidental lock.
      if (linkedTerminals.length < 2) {
        gate.open = true;
      }
    }
  }

  placeDecorativeProps(
    featureMap,
    input.mask,
    candidates,
    input.width,
    input.height,
    mainPath,
    input.entry,
    input.exit,
    rng,
    input.modules,
    new Set<number>(used)
  );

  const entryIdx = maskIndex(input.width, input.entry.x, input.entry.y);
  const exitIdx = maskIndex(input.width, input.exit.x, input.exit.y);
  featureMap[entryIdx] = 0;
  featureMap[exitIdx] = 0;

  for (let i = interactables.length - 1; i >= 0; i -= 1) {
    const item = interactables[i];
    if (!item) continue;
    if (
      (item.x === input.entry.x && item.y === input.entry.y) ||
      (item.x === input.exit.x && item.y === input.exit.y)
    ) {
      interactables.splice(i, 1);
    }
  }

  return {
    featureMap,
    interactables,
  };
};

const pushAlert = (state: GameState, text: string, tone: 'info' | 'warn' | 'buff'): void => {
  state.uiAlerts.push({
    text,
    tone,
    untilMs: state.simTimeMs + 2200,
  });

  if (state.uiAlerts.length > 8) {
    state.uiAlerts.splice(0, state.uiAlerts.length - 8);
  }
};

const featureFlagsAt = (state: GameState, x: number, y: number): TileFeatureFlags => {
  if (!inBounds2D(state.level, x, y)) return 0;
  return state.level.featureMap[maskIndex(state.level.width, x, y)] ?? 0;
};

export const activateTerminal = (state: GameState, interactable: Extract<LevelInteractable, { type: 'terminal' }>): void => {
  if (interactable.active) return;
  interactable.active = true;
  pushAlert(state, 'Terminal ativado.', 'info');

  const required = state.level.interactables.filter(
    (item): item is Extract<LevelInteractable, { type: 'terminal' }> =>
      item.type === 'terminal' && item.linkedGateId === interactable.linkedGateId
  );
  const allActive = required.length > 0 && required.every((item) => item.active);
  if (allActive) {
    const gate = state.level.interactables.find(
      (item): item is GateInteractable => item.type === 'gate' && item.id === interactable.linkedGateId
    );
    if (gate && !gate.open) {
      gate.open = true;
      pushAlert(state, 'Portao destravado!', 'buff');
    }
  }
};

export const applyPlayerFeatureInteractions = (state: GameState, player: PlayerState): void => {
  const now = state.simTimeMs;
  const flags = featureFlagsAt(state, player.x, player.y);

  if ((flags & FEATURE_BIOFLUID) !== 0 && now >= state.activeDebuffs.biofluidNextTickAt) {
    player.hp = Math.max(0, player.hp - BIOFLUID_DAMAGE);
    state.activeDebuffs.biofluidNextTickAt = now + BIOFLUID_TICK_MS;
    state.screenFlash.damageMs = Math.max(state.screenFlash.damageMs, SCREEN_FLASH_MS);
    pushAlert(state, 'Biofluido corrosivo!', 'warn');
    if (player.hp <= 0) {
      player.alive = false;
      state.phase = 'game_over';
      return;
    }
  }

  for (const interactable of state.level.interactables) {
    if (interactable.x !== player.x || interactable.y !== player.y) continue;

    if (interactable.type === 'spore_vent') {
      if (now >= interactable.nextTriggerAt) {
        interactable.nextTriggerAt = now + interactable.cooldownMs;
        state.activeDebuffs.slowUntilMs = Math.max(state.activeDebuffs.slowUntilMs, now + SPORE_SLOW_MS);
        pushAlert(state, 'Esporos reduziram sua velocidade!', 'warn');
      }
      continue;
    }

    if (interactable.type === 'crystal') {
      if (!interactable.used) {
        interactable.used = true;
        player.hp = Math.min(player.maxHp, player.hp + CRYSTAL_HEAL);
        state.activeDebuffs.crystalBuffUntilMs = Math.max(state.activeDebuffs.crystalBuffUntilMs, now + CRYSTAL_BUFF_MS);
        state.screenFlash.healMs = Math.max(state.screenFlash.healMs, SCREEN_FLASH_MS);
        pushAlert(state, 'Cristal energizado! Buff temporario.', 'buff');
      }
      continue;
    }

    if (interactable.type === 'terminal') {
      if (interactable.broken) continue;
      if (!interactable.active) {
        activateTerminal(state, interactable);
      }
      continue;
    }

    if (interactable.type === 'one_way_portal') {
      if (now < state.activeDebuffs.portalLockUntilMs) continue;
      const target = interactable.target;
      if (isWalkableCell(state.level, target.x, target.y, player.occ)) {
        moveEntity(state.level, player, target.x, target.y);
        state.activeDebuffs.portalLockUntilMs = now + 400;
        pushAlert(state, 'Portal unidirecional acionado.', 'info');
      }
      continue;
    }
  }

  if (now > state.activeDebuffs.crystalBuffUntilMs && state.activeDebuffs.crystalBuffUntilMs !== 0) {
    state.activeDebuffs.crystalBuffUntilMs = 0;
  }
};

export const getPlayerAttackBonus = (state: GameState): number => {
  if (state.activeDebuffs.crystalBuffUntilMs > 0 && state.simTimeMs <= state.activeDebuffs.crystalBuffUntilMs) {
    return CRYSTAL_ATTACK_BONUS;
  }
  return 0;
};
