import { describe, expect, it } from 'vitest';
import {
  BIOFLUID_DAMAGE,
  CRYSTAL_BUFF_MS,
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
  SPORE_SLOW_MS,
} from '../game/constants';
import { createGameState, getPlayer } from '../game/state';
import type { LevelInteractable } from '../game/types';
import { computeDistanceMap, maskIndex } from '../world/connectivity';
import { applyPlayerFeatureInteractions, generateLevelFeatures } from '../world/features';
import { isWalkableCell, moveEntity } from '../world/level';

const idx = (w: number, x: number, y: number): number => y * w + x;

const fullMask = (width: number, height: number): Uint8Array => new Uint8Array(width * height).fill(1);

const buildMainPathSet = (
  mask: Uint8Array,
  width: number,
  height: number,
  entry: { x: number; y: number },
  exit: { x: number; y: number }
): Set<number> => {
  const dist = computeDistanceMap(mask, width, height, entry);
  const out = new Set<number>();
  let current = { x: exit.x, y: exit.y };
  out.add(maskIndex(width, current.x, current.y));

  while (!(current.x === entry.x && current.y === entry.y)) {
    const currentDist = dist[maskIndex(width, current.x, current.y)] ?? -1;
    if (currentDist <= 0) break;
    const next = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ].find((candidate) => {
      if (candidate.x < 0 || candidate.y < 0 || candidate.x >= width || candidate.y >= height) return false;
      return (dist[maskIndex(width, candidate.x, candidate.y)] ?? -1) === currentDist - 1;
    });
    if (!next) break;
    current = next;
    out.add(maskIndex(width, current.x, current.y));
  }

  return out;
};

const candidateSetForMask = (mask: Uint8Array, width: number, height: number): Set<number> => {
  const out = new Set<number>();
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if ((mask[idx(width, x, y)] ?? 0) === 1) out.add(idx(width, x, y));
    }
  }
  return out;
};

const isCornerCell = (candidateSet: Set<number>, width: number, height: number, cell: number): boolean => {
  const x = cell % width;
  const y = Math.floor(cell / width);
  const blocked = {
    east: x + 1 >= width || !candidateSet.has(idx(width, x + 1, y)),
    west: x - 1 < 0 || !candidateSet.has(idx(width, x - 1, y)),
    south: y + 1 >= height || !candidateSet.has(idx(width, x, y + 1)),
    north: y - 1 < 0 || !candidateSet.has(idx(width, x, y - 1)),
  };
  return (
    (blocked.north && blocked.west) ||
    (blocked.north && blocked.east) ||
    (blocked.south && blocked.west) ||
    (blocked.south && blocked.east)
  );
};

const hasWallNeighborInLevel = (state: ReturnType<typeof createGameState>, x: number, y: number): boolean => {
  const level = state.level;
  const neighbors = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
  return neighbors.some((n) => {
    if (n.x < 0 || n.y < 0 || n.x >= level.width || n.y >= level.height) return true;
    return (level.heightMap[idx(level.width, n.x, n.y)] ?? 1) >= 0.5;
  });
};

const cellsWithFlag = (featureMap: Uint16Array, flag: number): number[] => {
  const cells: number[] = [];
  for (let i = 0; i < featureMap.length; i += 1) {
    if (((featureMap[i] ?? 0) & flag) !== 0) cells.push(i);
  }
  return cells;
};

const hasNeighborWithFlag = (
  featureMap: Uint16Array,
  width: number,
  height: number,
  cell: number,
  flag: number,
  maxDistance = 1
): boolean => {
  const x = cell % width;
  const y = Math.floor(cell / width);
  for (let dy = -maxDistance; dy <= maxDistance; dy += 1) {
    for (let dx = -maxDistance; dx <= maxDistance; dx += 1) {
      const distance = Math.abs(dx) + Math.abs(dy);
      if (distance === 0 || distance > maxDistance) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (((featureMap[idx(width, nx, ny)] ?? 0) & flag) !== 0) return true;
    }
  }
  return false;
};

const hasNeighborInSet = (width: number, height: number, cell: number, cells: Set<number>): boolean => {
  const x = cell % width;
  const y = Math.floor(cell / width);
  const neighbors = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
  return neighbors.some((n) => n.x >= 0 && n.y >= 0 && n.x < width && n.y < height && cells.has(idx(width, n.x, n.y)));
};

const longestStraightRun = (featureMap: Uint16Array, width: number, height: number, flag: number): number => {
  let best = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (((featureMap[idx(width, x, y)] ?? 0) & flag) === 0) continue;

      if (x === 0 || ((featureMap[idx(width, x - 1, y)] ?? 0) & flag) === 0) {
        let run = 0;
        for (let nx = x; nx < width && ((featureMap[idx(width, nx, y)] ?? 0) & flag) !== 0; nx += 1) {
          run += 1;
        }
        best = Math.max(best, run);
      }

      if (y === 0 || ((featureMap[idx(width, x, y - 1)] ?? 0) & flag) === 0) {
        let run = 0;
        for (let ny = y; ny < height && ((featureMap[idx(width, x, ny)] ?? 0) & flag) !== 0; ny += 1) {
          run += 1;
        }
        best = Math.max(best, run);
      }
    }
  }
  return best;
};

describe('map features', () => {
  it('places features/interactables in valid cells and keeps entry/exit clean', () => {
    const state = createGameState(4242);
    const level = state.level;
    const entryIdx = idx(level.width, level.entry.x, level.entry.y);
    const exitIdx = idx(level.width, level.exit.x, level.exit.y);

    expect(level.featureMap[entryIdx] ?? 0).toBe(0);
    expect(level.featureMap[exitIdx] ?? 0).toBe(0);

    for (const interactable of level.interactables) {
      expect(interactable.x).toBeGreaterThanOrEqual(0);
      expect(interactable.x).toBeLessThan(level.width);
      expect(interactable.y).toBeGreaterThanOrEqual(0);
      expect(interactable.y).toBeLessThan(level.height);

      const cell = idx(level.width, interactable.x, interactable.y);
      expect(level.heightMap[cell]).toBe(0);
    }

    const decorationMask =
      FEATURE_PROP_FUNGAL_CLUSTER |
      FEATURE_PROP_DEBRIS |
      FEATURE_PROP_CRATE |
      FEATURE_PROP_BEACON;
    let decorationCount = 0;
    for (let i = 0; i < level.featureMap.length; i += 1) {
      if (((level.featureMap[i] ?? 0) & decorationMask) !== 0) {
        decorationCount += 1;
      }
    }
    expect(decorationCount).toBeGreaterThan(0);
  });

  it('arranges special props into readable patterns', () => {
    const width = 24;
    const height = 24;
    const mask = fullMask(width, height);
    const entry = { x: 2, y: 2 };
    const exit = { x: 21, y: 21 };
    const generated = generateLevelFeatures({
      mask,
      width,
      height,
      entry,
      exit,
      seed: 99021,
      floorNumber: 4,
      modules: ['fungal_chamber', 'mining_zone', 'mirror_pocket'],
    });
    const mainPath = buildMainPathSet(mask, width, height, entry, exit);

    expect(longestStraightRun(generated.featureMap, width, height, FEATURE_BIOFLUID)).toBeGreaterThanOrEqual(3);
    expect(cellsWithFlag(generated.featureMap, FEATURE_BIOFLUID).some((cell) => mainPath.has(cell))).toBe(true);

    const fungalCells = cellsWithFlag(generated.featureMap, FEATURE_PROP_FUNGAL_CLUSTER);
    const candidateSet = candidateSetForMask(mask, width, height);
    const fungalWithNeighbor = fungalCells.filter((cell) =>
      hasNeighborWithFlag(generated.featureMap, width, height, cell, FEATURE_PROP_FUNGAL_CLUSTER)
    );
    expect(fungalCells.length).toBeGreaterThanOrEqual(6);
    expect(fungalWithNeighbor.length / fungalCells.length).toBeGreaterThan(0.55);
    expect(fungalCells.some((cell) => isCornerCell(candidateSet, width, height, cell))).toBe(true);

    const debrisCells = cellsWithFlag(generated.featureMap, FEATURE_PROP_DEBRIS);
    expect(debrisCells.some((cell) => hasNeighborWithFlag(generated.featureMap, width, height, cell, FEATURE_PROP_DEBRIS)))
      .toBe(true);

    const crateCells = cellsWithFlag(generated.featureMap, FEATURE_PROP_CRATE);
    expect(crateCells.some((cell) => hasNeighborWithFlag(generated.featureMap, width, height, cell, FEATURE_PROP_CRATE)))
      .toBe(true);
    expect(crateCells.every((cell) => !mainPath.has(cell))).toBe(true);
    expect(crateCells.every((cell) => hasNeighborInSet(width, height, cell, mainPath))).toBe(true);

    const beaconCells = cellsWithFlag(generated.featureMap, FEATURE_PROP_BEACON);
    expect(beaconCells.some((cell) => hasNeighborWithFlag(generated.featureMap, width, height, cell, FEATURE_PROP_BEACON, 3)))
      .toBe(true);
  });

  it('makes blocking props solid without removing the objective route', () => {
    let sawCrate = false;
    let sawTerminal = false;

    for (let seed = 0; seed < 36; seed += 1) {
      const state = createGameState(60600 + seed * 17);
      const player = getPlayer(state);
      expect(player).not.toBeNull();
      if (!player) continue;

      for (let i = 0; i < state.level.featureMap.length; i += 1) {
        const flags = state.level.featureMap[i] ?? 0;
        if ((flags & FEATURE_PROP_CRATE) === 0) continue;
        sawCrate = true;
        expect(isWalkableCell(state.level, i % state.level.width, Math.floor(i / state.level.width), player.occ))
          .toBe(false);
      }

      for (const item of state.level.interactables) {
        if (item.type !== 'terminal') continue;
        sawTerminal = true;
        expect(isWalkableCell(state.level, item.x, item.y, player.occ)).toBe(false);
        expect(hasWallNeighborInLevel(state, item.x, item.y)).toBe(true);
      }
    }

    expect(sawCrate).toBe(true);
    expect(sawTerminal).toBe(true);
  });

  it('applies biofluid, vent and crystal effects correctly', () => {
    const state = createGameState(131313);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    const level = state.level;
    const blockedFeatures =
      FEATURE_ROOT_BARRIER |
      FEATURE_GATE |
      FEATURE_PORTAL |
      FEATURE_TERMINAL |
      FEATURE_SPORE_VENT |
      FEATURE_CRYSTAL;

    let bioIdx = -1;
    for (let i = 0; i < level.featureMap.length; i += 1) {
      const flags = level.featureMap[i] ?? 0;
      if ((flags & FEATURE_BIOFLUID) === 0) continue;
      if ((flags & blockedFeatures) !== 0) continue;
      bioIdx = i;
      break;
    }
    expect(bioIdx).toBeGreaterThanOrEqual(0);
    if (bioIdx < 0) return;

    const bioX = bioIdx % level.width;
    const bioY = Math.floor(bioIdx / level.width);
    expect(moveEntity(level, player, bioX, bioY)).toBe(true);
    player.hp = 30;
    state.simTimeMs = 1000;
    state.activeDebuffs.biofluidNextTickAt = 0;
    applyPlayerFeatureInteractions(state, player);
    expect(player.hp).toBe(30 - BIOFLUID_DAMAGE);

    const vent = level.interactables.find(
      (item): item is Extract<LevelInteractable, { type: 'spore_vent' }> =>
        item.type === 'spore_vent'
    );
    expect(vent).toBeDefined();
    if (vent) {
      expect(moveEntity(level, player, vent.x, vent.y)).toBe(true);
      state.simTimeMs = 2400;
      applyPlayerFeatureInteractions(state, player);
      expect(state.activeDebuffs.slowUntilMs).toBeGreaterThanOrEqual(state.simTimeMs + SPORE_SLOW_MS);
    }

    const crystal = level.interactables.find(
      (item): item is Extract<LevelInteractable, { type: 'crystal' }> =>
        item.type === 'crystal' && !item.used
    );
    expect(crystal).toBeDefined();
    if (crystal) {
      player.hp = Math.max(1, player.hp - 15);
      const hpBeforeCrystal = player.hp;
      expect(moveEntity(level, player, crystal.x, crystal.y)).toBe(true);
      state.simTimeMs = 4200;
      applyPlayerFeatureInteractions(state, player);
      expect(crystal.used).toBe(true);
      expect(state.activeDebuffs.crystalBuffUntilMs).toBeGreaterThanOrEqual(state.simTimeMs + CRYSTAL_BUFF_MS);
      expect(player.hp).toBeGreaterThan(hpBeforeCrystal);
    }
  });
});
