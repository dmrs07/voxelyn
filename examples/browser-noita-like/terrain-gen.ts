/**
 * Terrain generation module for Noita-like worlds
 * Uses GradientNoise and CellularNoise from voxelyn-core
 * Supports multiple biomes and procedural generation techniques
 */

import {
  makeCell,
  setXY,
  getXY,
  getMaterial,
  paintRect,
  paintCircle,
  markChunkActiveByXY,
  markChunkDirtyByXY,
} from "../../packages/voxelyn-core/src/index.js";
import type { Grid2D } from "../../packages/voxelyn-core/src/core/grid2d.js";
import { GradientNoise, CellularNoise } from "../../packages/voxelyn-core/src/core/terrain/noise.js";
import { RNG } from "../../packages/voxelyn-core/src/core/rng.js";
import { MATERIAL, isSolid } from "./materials.js";
import { BIOMES, type BiomeConfig, type BiomeType, selectBiomeByDepth } from "./biomes.js";

// ============================================================================
// TYPES
// ============================================================================

export type WorldConfig = {
  width: number;
  height: number;
  seed: number;
  biome?: BiomeType;
  /** Use cellular automata for cave smoothing */
  useCellularAutomata?: boolean;
  /** Number of CA smoothing passes */
  caIterations?: number;
};

export type ChunkConfig = {
  /** World chunk X coordinate (used for noise sampling) */
  x: number;
  /** World chunk Y coordinate (used for noise sampling) */
  y: number;
  /** Chunk width in pixels */
  width: number;
  /** Chunk height in pixels */
  height: number;
  /** World seed */
  seed: number;
  /** Biome type */
  biome: BiomeType;
  /** Grid X offset where to write the chunk (default: calculated from world coords) */
  gridOffsetX?: number;
  /** Grid Y offset where to write the chunk */
  gridOffsetY?: number;
  /** Neighboring biomes for blending */
  neighbors?: {
    left?: BiomeType;
    right?: BiomeType;
    top?: BiomeType;
    bottom?: BiomeType;
  };
};

// ============================================================================
// NOISE GENERATORS (cached per seed)
// ============================================================================

const noiseCache = new Map<number, {
  gradient: GradientNoise;
  cellular: CellularNoise;
  rng: RNG;
}>();

function getNoiseGenerators(seed: number) {
  if (!noiseCache.has(seed)) {
    noiseCache.set(seed, {
      gradient: new GradientNoise(seed, { octaves: 4, falloff: 0.5 }),
      cellular: new CellularNoise(seed + 1000, 1),
      rng: new RNG(seed),
    });
  }
  return noiseCache.get(seed)!;
}

// Clear cache when switching seeds
export function clearNoiseCache(): void {
  noiseCache.clear();
}

// ============================================================================
// CELLULAR AUTOMATA FOR CAVE SMOOTHING
// ============================================================================

/**
 * Apply cellular automata smoothing to make caves more organic
 * Rule: If a cell has >= threshold solid neighbors, it becomes solid
 */
function applyCellularAutomata(
  grid: Grid2D,
  x0: number,
  y0: number,
  width: number,
  height: number,
  solidMaterial: number,
  emptyMaterial: number,
  iterations: number = 4,
  threshold: number = 5
): void {
  // Work on a copy to avoid read-while-write issues
  const temp = new Uint8Array(width * height);
  
  const getMat = (x: number, y: number): number => {
    if (x < x0 || x >= x0 + width || y < y0 || y >= y0 + height) {
      return solidMaterial; // Treat out-of-bounds as solid
    }
    return getMaterial(getXY(grid, x, y));
  };

  const setTemp = (x: number, y: number, solid: boolean) => {
    const idx = (x - x0) + (y - y0) * width;
    temp[idx] = solid ? 1 : 0;
  };

  const getTemp = (x: number, y: number): boolean => {
    const idx = (x - x0) + (y - y0) * width;
    return temp[idx] === 1;
  };

  for (let iter = 0; iter < iterations; iter++) {
    // Read current state into temp
    for (let y = y0; y < y0 + height; y++) {
      for (let x = x0; x < x0 + width; x++) {
        const mat = getMat(x, y);
        setTemp(x, y, isSolid(mat) || mat === solidMaterial);
      }
    }

    // Apply CA rules
    for (let y = y0 + 1; y < y0 + height - 1; y++) {
      for (let x = x0 + 1; x < x0 + width - 1; x++) {
        // Count solid neighbors (8-connected)
        let solidCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (getTemp(x + dx, y + dy)) solidCount++;
          }
        }

        // Apply rule: >= threshold neighbors = solid
        const shouldBeSolid = solidCount >= threshold;
        const newMat = shouldBeSolid ? solidMaterial : emptyMaterial;
        setXY(grid, x, y, makeCell(newMat));
        markChunkDirtyByXY(grid, x, y);
      }
    }
  }
}

// ============================================================================
// TERRAIN GENERATION
// ============================================================================

/**
 * Generate terrain surface using noise
 * Returns the Y coordinate of the surface at each X position
 */
function generateSurfaceHeights(
  width: number,
  baseHeight: number,
  variation: number,
  frequency: number,
  seed: number
): number[] {
  const { gradient } = getNoiseGenerators(seed);
  const heights: number[] = [];

  for (let x = 0; x < width; x++) {
    const noise = gradient.fbm(x * frequency, 0.1, 3);
    heights.push(Math.floor(baseHeight + noise * variation));
  }

  return heights;
}

/**
 * Carve caves using gradient noise
 */
function carveCaves(
  grid: Grid2D,
  x0: number,
  y0: number,
  width: number,
  height: number,
  biome: BiomeConfig,
  seed: number
): void {
  const { gradient } = getNoiseGenerators(seed);
  const { terrain } = biome;

  for (let y = y0; y < y0 + height; y++) {
    for (let x = x0; x < x0 + width; x++) {
      const cave = gradient.fbm(
        x * terrain.caveFrequency,
        y * terrain.caveFrequency,
        terrain.caveOctaves
      );

      if (cave > terrain.caveThreshold) {
        setXY(grid, x, y, makeCell(terrain.caveFill));
        markChunkActiveByXY(grid, x, y);
        markChunkDirtyByXY(grid, x, y);
      }
    }
  }
}

/**
 * Add material veins (ore, etc.)
 */
function addVeins(
  grid: Grid2D,
  x0: number,
  y0: number,
  width: number,
  height: number,
  biome: BiomeConfig,
  seed: number
): void {
  const { gradient, rng } = getNoiseGenerators(seed);
  const { features } = biome;

  if (features.veinChance <= 0) return;

  // Use different noise layer for veins
  for (let y = y0; y < y0 + height; y++) {
    for (let x = x0; x < x0 + width; x++) {
      const mat = getMaterial(getXY(grid, x, y));
      if (!isSolid(mat)) continue;

      const vein = gradient.fbm(x * 0.15, y * 0.15, 3);
      if (vein > 0.75 && rng.nextFloat01() < features.veinChance * 5) {
        setXY(grid, x, y, makeCell(features.veinMaterial));
        markChunkDirtyByXY(grid, x, y);
      }
    }
  }
}

/**
 * Add stalactites and stalagmites
 */
function addStalactites(
  grid: Grid2D,
  x0: number,
  y0: number,
  width: number,
  height: number,
  biome: BiomeConfig,
  seed: number
): void {
  const { rng } = getNoiseGenerators(seed);
  const { terrain, features } = biome;

  if (features.stalactiteChance <= 0) return;

  const getMat = (x: number, y: number): number => {
    if (x < x0 || x >= x0 + width || y < y0 || y >= y0 + height) {
      return terrain.baseMaterial;
    }
    return getMaterial(getXY(grid, x, y));
  };

  for (let y = y0 + 1; y < y0 + height - 1; y++) {
    for (let x = x0 + 1; x < x0 + width - 1; x++) {
      const above = getMat(x, y - 1);
      const current = getMat(x, y);

      // Stalactite: solid above, empty here
      if (isSolid(above) && current === MATERIAL.EMPTY) {
        if (rng.nextFloat01() < features.stalactiteChance) {
          const len = 2 + rng.nextInt(4);
          for (let k = 0; k < len; k++) {
            if (getMat(x, y + k) === MATERIAL.EMPTY) {
              setXY(grid, x, y + k, makeCell(terrain.baseMaterial));
              markChunkDirtyByXY(grid, x, y + k);
            } else {
              break;
            }
          }
        }
      }

      // Stalagmite: empty above, solid below
      const below = getMat(x, y + 1);
      if (current === MATERIAL.EMPTY && isSolid(below)) {
        if (rng.nextFloat01() < features.stalactiteChance * 0.5) {
          const len = 1 + rng.nextInt(3);
          for (let k = 0; k < len; k++) {
            if (getMat(x, y - k) === MATERIAL.EMPTY) {
              setXY(grid, x, y - k, makeCell(terrain.baseMaterial));
              markChunkDirtyByXY(grid, x, y - k);
            } else {
              break;
            }
          }
        }
      }
    }
  }
}

/**
 * Add fluid pools
 */
function addFluidPools(
  grid: Grid2D,
  x0: number,
  y0: number,
  width: number,
  height: number,
  biome: BiomeConfig,
  seed: number
): void {
  const { rng } = getNoiseGenerators(seed);
  const { fluids } = biome;

  if (fluids.poolChance <= 0) return;

  const getMat = (x: number, y: number): number => {
    if (x < x0 || x >= x0 + width || y < y0 || y >= y0 + height) {
      return MATERIAL.ROCK;
    }
    return getMaterial(getXY(grid, x, y));
  };

  // Find potential pool locations (empty spaces with solid floor)
  for (let attempt = 0; attempt < 10; attempt++) {
    if (rng.nextFloat01() > fluids.poolChance) continue;

    const px = x0 + rng.nextInt(width - 4) + 2;
    const py = y0 + rng.nextInt(height - 4) + 2;

    // Check if this is a good pool location
    if (getMat(px, py) !== MATERIAL.EMPTY) continue;
    if (!isSolid(getMat(px, py + fluids.poolSize))) continue;

    // Place pool
    const fluid = rng.nextFloat01() < 0.7 || !fluids.secondaryFluid
      ? fluids.primaryFluid
      : fluids.secondaryFluid;

    paintCircle(grid, px, py, fluids.poolSize, makeCell(fluid));
  }
}

/**
 * Add platforms/bridges
 */
function addPlatforms(
  grid: Grid2D,
  x0: number,
  y0: number,
  width: number,
  height: number,
  biome: BiomeConfig,
  seed: number
): void {
  const { rng } = getNoiseGenerators(seed);
  const { features } = biome;

  if (features.platformChance <= 0) return;

  for (let attempt = 0; attempt < 5; attempt++) {
    if (rng.nextFloat01() > features.platformChance) continue;

    const px = x0 + rng.nextInt(width - 20) + 5;
    const py = y0 + rng.nextInt(height - 10) + 5;
    const pw = 8 + rng.nextInt(12);
    const ph = 2 + rng.nextInt(3);

    // Only place in empty space
    let valid = true;
    for (let y = py; y < py + ph && valid; y++) {
      for (let x = px; x < px + pw && valid; x++) {
        if (getMaterial(getXY(grid, x, y)) !== MATERIAL.EMPTY) {
          valid = false;
        }
      }
    }

    if (valid) {
      paintRect(grid, px, py, pw, ph, makeCell(features.platformMaterial));
    }
  }
}

// ============================================================================
// MAIN GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate a complete world/map
 */
export function generateWorld(grid: Grid2D, config: WorldConfig): void {
  const { width, height, seed, useCellularAutomata = true, caIterations = 4 } = config;
  const biomeType = config.biome ?? "cavern";
  const biome = BIOMES[biomeType];
  const { terrain } = biome;

  // 1. Fill with base material
  paintRect(grid, 0, 0, width, height, makeCell(terrain.baseMaterial));

  // 2. Generate surface
  const surfaceHeights = generateSurfaceHeights(
    width,
    height * 0.35,
    terrain.surfaceVariation,
    terrain.surfaceFrequency,
    seed
  );

  // Apply surface with material layers
  for (let x = 0; x < width; x++) {
    const surfaceY = surfaceHeights[x]!;

    // Clear above surface
    for (let y = 0; y < surfaceY; y++) {
      setXY(grid, x, y, makeCell(MATERIAL.EMPTY));
    }

    // Surface layer
    for (let y = surfaceY; y < Math.min(surfaceY + 2, height); y++) {
      setXY(grid, x, y, makeCell(terrain.surfaceMaterial));
    }

    // Secondary material layer
    for (let y = surfaceY + 2; y < Math.min(surfaceY + 5, height); y++) {
      setXY(grid, x, y, makeCell(terrain.secondaryMaterial));
    }
  }

  // 3. Carve caves
  carveCaves(grid, 0, 0, width, height, biome, seed);

  // 4. Apply cellular automata smoothing
  if (useCellularAutomata) {
    applyCellularAutomata(
      grid, 1, 1, width - 2, height - 2,
      terrain.baseMaterial, terrain.caveFill,
      caIterations, 5
    );
  }

  // 5. Add features
  addVeins(grid, 0, 0, width, height, biome, seed);
  addStalactites(grid, 0, 0, width, height, biome, seed);
  addFluidPools(grid, 0, 0, width, height, biome, seed);
  addPlatforms(grid, 0, 0, width, height, biome, seed);

  // 6. Add world borders
  paintRect(grid, 0, 0, width, 1, makeCell(MATERIAL.ROCK));
  paintRect(grid, 0, 0, 1, height, makeCell(MATERIAL.ROCK));
  paintRect(grid, width - 1, 0, 1, height, makeCell(MATERIAL.ROCK));
  paintRect(grid, 0, height - 1, width, 1, makeCell(MATERIAL.ROCK));

  // Mark all chunks as active for initial render
  for (let y = 0; y < height; y += 32) {
    for (let x = 0; x < width; x += 32) {
      markChunkActiveByXY(grid, x, y);
      markChunkDirtyByXY(grid, x, y);
    }
  }
}

/**
 * Generate a single chunk for infinite mode
 * 
 * @param grid - The grid to write to
 * @param config - Chunk configuration
 *   - x, y: WORLD chunk coordinates (used for noise sampling to ensure continuity)
 *   - width, height: chunk size in pixels
 *   - gridOffsetX, gridOffsetY: where to write in the grid (optional)
 * 
 * The key insight: we use world coordinates for noise sampling (so terrain is seamless)
 * but we write to wherever the chunk currently maps in the grid (which changes with shifting)
 */
export function generateChunk(grid: Grid2D, config: ChunkConfig): void {
  const { x: worldChunkX, y: worldChunkY, width, height, seed, biome: biomeType } = config;
  const biome = BIOMES[biomeType];
  const { terrain } = biome;

  // World pixel coordinates (for noise sampling - these never change for a chunk)
  const worldPixelX = worldChunkX * width;
  const worldPixelY = worldChunkY * height;

  // Grid pixel coordinates (where to write in the grid)
  // If explicit offset provided, use it; otherwise default to 0 (caller handles positioning)
  const gridOffsetX = config.gridOffsetX ?? 0;
  const gridOffsetY = config.gridOffsetY ?? 0;

  // Unique seed for this chunk's random features
  const chunkSeed = seed + worldChunkX * 1000 + worldChunkY;

  // 1. Fill with base material (write to grid, sample noise from world)
  for (let ly = 0; ly < height; ly++) {
    for (let lx = 0; lx < width; lx++) {
      // Grid coordinates to write to
      const gx = gridOffsetX + lx;
      const gy = gridOffsetY + ly;
      if (gx < 0 || gx >= grid.width || gy < 0 || gy >= grid.height) continue;
      
      setXY(grid, gx, gy, makeCell(terrain.baseMaterial));
    }
  }

  // 2. Carve caves using WORLD coordinates for noise (seamless across chunks)
  const { gradient } = getNoiseGenerators(seed);

  for (let ly = 0; ly < height; ly++) {
    for (let lx = 0; lx < width; lx++) {
      const gx = gridOffsetX + lx;
      const gy = gridOffsetY + ly;
      if (gx < 0 || gx >= grid.width || gy < 0 || gy >= grid.height) continue;

      // Use WORLD coordinates for noise sampling
      const noiseX = worldPixelX + lx;
      const noiseY = worldPixelY + ly;

      const cave = gradient.fbm(
        noiseX * terrain.caveFrequency,
        noiseY * terrain.caveFrequency,
        terrain.caveOctaves
      );

      if (cave > terrain.caveThreshold) {
        setXY(grid, gx, gy, makeCell(terrain.caveFill));
      }
    }
  }

  // 3. Add features using chunk-local seed
  const localRng = new RNG(chunkSeed);
  
  // Add stalactites, veins, pools
  // These functions need to use world coords for noise but write to grid coords
  addVeinsToChunk(grid, gridOffsetX, gridOffsetY, worldPixelX, worldPixelY, width, height, biome, chunkSeed);
  addStalactitesToChunk(grid, gridOffsetX, gridOffsetY, width, height, biome, chunkSeed);

  // Fluid pools (less frequent in infinite mode)
  if (localRng.nextFloat01() < biome.fluids.poolChance * 0.5) {
    addFluidPoolsToChunk(grid, gridOffsetX, gridOffsetY, width, height, biome, chunkSeed);
  }

  // Mark chunk dirty
  for (let ly = 0; ly < height; ly += 32) {
    for (let lx = 0; lx < width; lx += 32) {
      const gx = gridOffsetX + lx;
      const gy = gridOffsetY + ly;
      if (gx >= 0 && gx < grid.width && gy >= 0 && gy < grid.height) {
        markChunkActiveByXY(grid, gx, gy);
        markChunkDirtyByXY(grid, gx, gy);
      }
    }
  }
}

/**
 * Add veins to a chunk (chunk-local version)
 */
function addVeinsToChunk(
  grid: Grid2D,
  gridOffsetX: number,
  gridOffsetY: number,
  worldOffsetX: number,
  worldOffsetY: number,
  width: number,
  height: number,
  biome: BiomeConfig,
  chunkSeed: number
): void {
  const { gradient } = getNoiseGenerators(chunkSeed);
  const localRng = new RNG(chunkSeed + 100);
  const { features } = biome;

  if (features.veinChance <= 0) return;

  for (let ly = 0; ly < height; ly++) {
    for (let lx = 0; lx < width; lx++) {
      const gx = gridOffsetX + lx;
      const gy = gridOffsetY + ly;
      if (gx < 0 || gx >= grid.width || gy < 0 || gy >= grid.height) continue;

      const mat = getMaterial(getXY(grid, gx, gy));
      if (!isSolid(mat)) continue;

      // Use world coordinates for vein noise
      const noiseX = worldOffsetX + lx;
      const noiseY = worldOffsetY + ly;
      
      const vein = gradient.fbm(noiseX * 0.15, noiseY * 0.15, 3);
      if (vein > 0.75 && localRng.nextFloat01() < features.veinChance * 5) {
        setXY(grid, gx, gy, makeCell(features.veinMaterial));
        markChunkDirtyByXY(grid, gx, gy);
      }
    }
  }
}

/**
 * Add stalactites to a chunk (chunk-local version)
 */
function addStalactitesToChunk(
  grid: Grid2D,
  gridOffsetX: number,
  gridOffsetY: number,
  width: number,
  height: number,
  biome: BiomeConfig,
  chunkSeed: number
): void {
  const localRng = new RNG(chunkSeed + 200);
  const { terrain, features } = biome;

  if (features.stalactiteChance <= 0) return;

  const getMat = (lx: number, ly: number): number => {
    const gx = gridOffsetX + lx;
    const gy = gridOffsetY + ly;
    if (gx < 0 || gx >= grid.width || gy < 0 || gy >= grid.height) {
      return terrain.baseMaterial;
    }
    return getMaterial(getXY(grid, gx, gy));
  };

  for (let ly = 1; ly < height - 1; ly++) {
    for (let lx = 1; lx < width - 1; lx++) {
      const above = getMat(lx, ly - 1);
      const current = getMat(lx, ly);

      // Stalactite: solid above, empty here
      if (isSolid(above) && current === MATERIAL.EMPTY) {
        if (localRng.nextFloat01() < features.stalactiteChance) {
          const len = 2 + localRng.nextInt(4);
          for (let k = 0; k < len; k++) {
            if (getMat(lx, ly + k) === MATERIAL.EMPTY) {
              const gx = gridOffsetX + lx;
              const gy = gridOffsetY + ly + k;
              if (gx >= 0 && gx < grid.width && gy >= 0 && gy < grid.height) {
                setXY(grid, gx, gy, makeCell(terrain.baseMaterial));
                markChunkDirtyByXY(grid, gx, gy);
              }
            } else {
              break;
            }
          }
        }
      }
    }
  }
}

/**
 * Add fluid pools to a chunk (chunk-local version)
 */
function addFluidPoolsToChunk(
  grid: Grid2D,
  gridOffsetX: number,
  gridOffsetY: number,
  width: number,
  height: number,
  biome: BiomeConfig,
  chunkSeed: number
): void {
  const localRng = new RNG(chunkSeed + 300);
  const { fluids } = biome;

  if (fluids.poolChance <= 0) return;

  const getMat = (lx: number, ly: number): number => {
    const gx = gridOffsetX + lx;
    const gy = gridOffsetY + ly;
    if (gx < 0 || gx >= grid.width || gy < 0 || gy >= grid.height) {
      return MATERIAL.ROCK;
    }
    return getMaterial(getXY(grid, gx, gy));
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    if (localRng.nextFloat01() > fluids.poolChance) continue;

    const lx = localRng.nextInt(width - 4) + 2;
    const ly = localRng.nextInt(height - 4) + 2;

    if (getMat(lx, ly) !== MATERIAL.EMPTY) continue;
    if (!isSolid(getMat(lx, ly + fluids.poolSize))) continue;

    const fluid = localRng.nextFloat01() < 0.7 || !fluids.secondaryFluid
      ? fluids.primaryFluid
      : fluids.secondaryFluid;

    // Paint small pool
    const radius = Math.min(fluids.poolSize, 4);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const gx = gridOffsetX + lx + dx;
          const gy = gridOffsetY + ly + dy;
          if (gx >= 0 && gx < grid.width && gy >= 0 && gy < grid.height) {
            if (getMaterial(getXY(grid, gx, gy)) === MATERIAL.EMPTY) {
              setXY(grid, gx, gy, makeCell(fluid));
              markChunkDirtyByXY(grid, gx, gy);
            }
          }
        }
      }
    }
  }
}

/**
 * Select biome for a chunk based on its position
 */
export function selectChunkBiome(chunkX: number, chunkY: number, seed: number): BiomeType {
  // Use cellular noise for biome regions
  const { cellular } = getNoiseGenerators(seed);
  const sample = cellular.sample(chunkX * 0.3, chunkY * 0.3);
  
  // Depth influences biome selection
  const depth = chunkY / 10; // Normalize depth
  
  return selectBiomeByDepth(depth, Math.floor(sample.cellId));
}
