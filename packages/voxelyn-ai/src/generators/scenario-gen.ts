/**
 * @voxelyn/ai - Scenario Generator
 *
 * Builds complete world/scenario voxel data from AI-predicted layouts.
 * Handles terrain generation, biome placement, and object distribution.
 */

import type { ScenarioLayout, BiomeRegion, BiomeType, ObjectPlacement, HeightmapParams } from '../types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of building a scenario.
 */
export type ScenarioBuildResult = {
  /** 3D terrain voxel data. */
  terrain: Uint16Array;
  /** Dimensions. */
  width: number;
  height: number; // X-Y plane
  depth: number; // Z (vertical)
  /** Heightmap as 2D array [x + y * width]. */
  heightmap: Float32Array;
  /** Object instances to place. */
  objects: PlacedObject[];
  /** Materials used. */
  materials: Set<number>;
};

/**
 * A placed object instance.
 */
export type PlacedObject = {
  type: string;
  position: [number, number, number];
  scale: number;
  rotation: number;
};

/**
 * Options for scenario building.
 */
export type ScenarioBuildOptions = {
  /** Material mapping (name -> id). */
  materialMapping?: Record<string, number>;
  /** Default materials for biomes. */
  biomeMaterials?: Partial<Record<BiomeType, { surface: number; underground: number }>>;
  /** Scale factor for terrain detail. */
  detailScale?: number;
};

// ============================================================================
// NOISE (same as other generators)
// ============================================================================

class Noise {
  private perm: number[];

  constructor(seed: number) {
    this.perm = [];
    for (let i = 0; i < 256; i++) this.perm[i] = i;
    let rng = seed;
    for (let i = 255; i > 0; i--) {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      const j = (rng % (i + 1)) | 0;
      [this.perm[i], this.perm[j]] = [this.perm[j]!, this.perm[i]!];
    }
  }

  noise(x: number, y: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    const p = this.perm;
    const a = (p[xi]! + yi) & 255;
    const b = (p[(xi + 1) & 255]! + yi) & 255;

    const aa = p[a]!;
    const ab = p[(a + 1) & 255]!;
    const ba = p[b]!;
    const bb = p[(b + 1) & 255]!;

    const grad = (h: number, gx: number, gy: number) => {
      const hh = h & 3;
      return (hh === 0 ? gx + gy : hh === 1 ? -gx + gy : hh === 2 ? gx - gy : -gx - gy);
    };

    const lerp = (t: number, a: number, b: number) => a + t * (b - a);

    return (lerp(v,
      lerp(u, grad(aa, xf, yf), grad(ba, xf - 1, yf)),
      lerp(u, grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1))
    ) + 1) / 2;
  }

  fbm(x: number, y: number, octaves: number, persistence: number): number {
    let val = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      val += amp * this.noise(x * freq, y * freq);
      max += amp;
      amp *= persistence;
      freq *= 2;
    }
    return val / max;
  }
}

// ============================================================================
// DEFAULT MATERIALS
// ============================================================================

const DEFAULT_BIOME_MATERIALS: Record<BiomeType, { surface: number; underground: number }> = {
  plains: { surface: 7, underground: 2 }, // grass, dirt
  forest: { surface: 7, underground: 2 },
  desert: { surface: 3, underground: 3 }, // sand
  mountains: { surface: 1, underground: 1 }, // stone
  ocean: { surface: 4, underground: 3 }, // water, sand
  river: { surface: 4, underground: 3 },
  lake: { surface: 4, underground: 2 },
  swamp: { surface: 2, underground: 2 }, // dirt
  tundra: { surface: 1, underground: 1 }, // snow/stone placeholder
  volcanic: { surface: 1, underground: 5 }, // stone, lava
  cave: { surface: 0, underground: 1 }, // air, stone
  urban: { surface: 1, underground: 2 }, // stone, dirt
  ruins: { surface: 1, underground: 2 },
};

const DEFAULT_MATERIAL_MAPPING: Record<string, number> = {
  air: 0,
  stone: 1,
  dirt: 2,
  sand: 3,
  water: 4,
  lava: 5,
  wood: 6,
  grass: 7,
};

// ============================================================================
// HEIGHTMAP GENERATION
// ============================================================================

/**
 * Generate heightmap from parameters.
 */
function generateHeightmap(
  width: number,
  height: number,
  params: HeightmapParams,
  biomes: BiomeRegion[]
): Float32Array {
  const noise = new Noise(params.seed);
  const heightmap = new Float32Array(width * height);

  // Create biome lookup grid
  const biomeAt = (x: number, y: number): BiomeRegion | undefined => {
    for (const biome of biomes) {
      const [bx, by, bw, bh] = biome.bounds;
      if (x >= bx && x < bx + bw && y >= by && y < by + bh) {
        return biome;
      }
    }
    return undefined;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Base noise
      const baseNoise = noise.fbm(
        x / params.scale,
        y / params.scale,
        params.octaves,
        params.persistence
      );

      // Get biome influence
      const biome = biomeAt(x, y);
      let elevation = params.baseElevation;
      let variation = params.amplitude;

      if (biome) {
        elevation = biome.elevation;
        variation = biome.elevationVariation;
      }

      // Calculate final height
      const h = elevation + (baseNoise - 0.5) * variation * 2;
      heightmap[y * width + x] = Math.max(0, Math.min(1, h));
    }
  }

  return heightmap;
}

// ============================================================================
// TERRAIN BUILDING
// ============================================================================

/**
 * Build terrain voxels from heightmap and biomes.
 */
function buildTerrain(
  width: number,
  height: number,
  depth: number,
  heightmap: Float32Array,
  biomes: BiomeRegion[],
  options: ScenarioBuildOptions
): { terrain: Uint16Array; materials: Set<number> } {
  const terrain = new Uint16Array(width * height * depth);
  const materials = new Set<number>();

  const biomeMats = { ...DEFAULT_BIOME_MATERIALS, ...options.biomeMaterials };
  const matMap = { ...DEFAULT_MATERIAL_MAPPING, ...options.materialMapping };

  // Biome lookup
  const biomeAt = (x: number, y: number): BiomeRegion | undefined => {
    for (const biome of biomes) {
      const [bx, by, bw, bh] = biome.bounds;
      if (x >= bx && x < bx + bw && y >= by && y < by + bh) {
        return biome;
      }
    }
    return undefined;
  };

  // Resolve material name to ID
  const resolveMat = (name: string): number => {
    return matMap[name.toLowerCase()] ?? matMap[name] ?? 1;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const h = heightmap[y * width + x] ?? 0;
      const terrainHeight = Math.floor(h * depth);

      const biome = biomeAt(x, y);
      let surfaceMat = 7; // grass default
      let undergroundMat = 2; // dirt default

      if (biome) {
        // Try to resolve from biome config materials
        if (biome.surfaceMaterial && biome.undergroundMaterial) {
          surfaceMat = resolveMat(biome.surfaceMaterial);
          undergroundMat = resolveMat(biome.undergroundMaterial);
        } else if (biome.type) {
          // Fallback to biome type defaults
          const biomeType = biome.type as keyof typeof biomeMats;
          const defaultMats = biomeMats[biomeType];
          if (defaultMats) {
            surfaceMat = defaultMats.surface;
            undergroundMat = defaultMats.underground;
          }
        }
      }

      // Fill terrain
      for (let z = 0; z < depth; z++) {
        const idx = x + y * width + z * width * height;

        if (z < terrainHeight - 2) {
          // Deep underground
          terrain[idx] = undergroundMat;
          materials.add(undergroundMat);
        } else if (z < terrainHeight) {
          // Near surface
          terrain[idx] = undergroundMat;
          materials.add(undergroundMat);
        } else if (z === terrainHeight) {
          // Surface
          terrain[idx] = surfaceMat;
          materials.add(surfaceMat);
        } else {
          // Air
          terrain[idx] = 0;
        }
      }

      // Handle water for ocean/lake/river biomes
      if (biome && ['ocean', 'lake', 'river'].includes(biome.type)) {
        const waterLevel = Math.floor(biome.elevation * depth);
        for (let z = terrainHeight + 1; z <= waterLevel; z++) {
          if (z < depth) {
            const idx = x + y * width + z * width * height;
            terrain[idx] = 4; // water
            materials.add(4);
          }
        }
      }
    }
  }

  return { terrain, materials };
}

// ============================================================================
// OBJECT PLACEMENT
// ============================================================================

/**
 * Simple seeded random for object placement.
 */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

/**
 * Place objects according to rules.
 */
function placeObjects(
  placements: ObjectPlacement[],
  biomes: BiomeRegion[],
  heightmap: Float32Array,
  width: number,
  height: number,
  depth: number,
  seed: number
): PlacedObject[] {
  const objects: PlacedObject[] = [];
  const rng = new SeededRandom(seed);

  // Track placed positions for spacing
  const placed: Array<{ x: number; y: number; type: string }> = [];

  const isTooClose = (x: number, y: number, minDist: number, type: string): boolean => {
    for (const p of placed) {
      if (p.type === type) {
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy < minDist * minDist) {
          return true;
        }
      }
    }
    return false;
  };

  const getBiomeAt = (x: number, y: number): BiomeType | null => {
    for (const biome of biomes) {
      const [bx, by, bw, bh] = biome.bounds;
      if (x >= bx && x < bx + bw && y >= by && y < by + bh) {
        return biome.type;
      }
    }
    return null;
  };

  for (const placement of placements) {
    const targetCount = Math.floor((placement.density / 100) * width * height);
    let attempts = 0;
    let placedCount = 0;

    while (placedCount < targetCount && attempts < targetCount * 10) {
      attempts++;

      const x = rng.nextInt(width);
      const y = rng.nextInt(height);

      // Check biome
      const biome = getBiomeAt(x, y);
      if (!biome || !placement.biomes.includes(biome)) {
        continue;
      }

      // Check spacing
      if (isTooClose(x, y, placement.minSpacing, placement.objectType)) {
        continue;
      }

      // Get terrain height at position
      const h = heightmap[y * width + x] ?? 0;
      const z = Math.floor(h * depth) + 1;

      // Calculate scale
      const [minScale, maxScale] = placement.scaleRange;
      const scale = minScale + rng.next() * (maxScale - minScale);

      // Random rotation (0-3 for 90° increments)
      const rotation = rng.nextInt(4);

      objects.push({
        type: placement.objectType,
        position: [x, y, z],
        scale,
        rotation,
      });

      placed.push({ x, y, type: placement.objectType });
      placedCount++;
    }
  }

  return objects;
}

// ============================================================================
// MAIN BUILDER
// ============================================================================

/**
 * Build a complete scenario from an AI-generated layout.
 *
 * @param layout - ScenarioLayout from Gemini prediction
 * @param options - Build options
 * @returns ScenarioBuildResult with terrain, heightmap, and object placements
 *
 * @example
 * ```ts
 * const result = await client.predictScenarioLayout('forest valley with river');
 * if (result.success) {
 *   const scenario = buildScenarioFromLayout(result.data);
 *   // scenario.terrain is Uint16Array of voxels
 *   // scenario.objects are PlacedObject instances to spawn
 * }
 * ```
 */
export function buildScenarioFromLayout(
  layout: ScenarioLayout,
  options: ScenarioBuildOptions = {}
): ScenarioBuildResult {
  const [width, height] = layout.size;
  const depth = layout.depth;

  // Generate heightmap
  const heightmap = generateHeightmap(width, height, layout.heightmap, layout.biomes);

  // Build terrain
  const { terrain, materials } = buildTerrain(
    width,
    height,
    depth,
    heightmap,
    layout.biomes,
    options
  );

  // Place objects
  const objects = placeObjects(
    layout.objects,
    layout.biomes,
    heightmap,
    width,
    height,
    depth,
    layout.seed
  );

  return {
    terrain,
    width,
    height,
    depth,
    heightmap,
    objects,
    materials,
  };
}

/**
 * Get a 2D preview of the scenario (top-down heightmap visualization).
 */
export function getScenarioPreview(
  result: ScenarioBuildResult,
  colorMap: Record<number, number> = {}
): Uint32Array {
  const { terrain, width, height, depth } = result;
  const preview = new Uint32Array(width * height);

  // Default colors for materials
  const defaultColors: Record<number, number> = {
    0: 0x00000000, // air (transparent)
    1: 0xff808080, // stone (gray)
    2: 0xff5b3a23, // dirt (brown)
    3: 0xffc2b280, // sand (tan)
    4: 0xffc86400, // water (blue - note: ABGR)
    5: 0xff0064ff, // lava (orange)
    6: 0xff134589, // wood (brown)
    7: 0xff228b22, // grass (green)
    ...colorMap,
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Find top-most non-air voxel
      for (let z = depth - 1; z >= 0; z--) {
        const mat = terrain[x + y * width + z * width * height];
        if (mat !== undefined && mat !== 0) {
          const color = defaultColors[mat] ?? 0xffff00ff; // magenta for unknown
          // Apply depth shading
          const shade = 0.6 + (z / depth) * 0.4;
          const r = Math.min(255, ((color & 0xff) * shade) | 0);
          const g = Math.min(255, (((color >> 8) & 0xff) * shade) | 0);
          const b = Math.min(255, (((color >> 16) & 0xff) * shade) | 0);
          const a = (color >> 24) & 0xff;
          preview[y * width + x] = (a << 24) | (b << 16) | (g << 8) | r;
          break;
        }
      }
    }
  }

  return preview;
}

/**
 * Get statistics about a scenario.
 */
export function getScenarioStats(result: ScenarioBuildResult): {
  totalVoxels: number;
  filledVoxels: number;
  objectCount: number;
  biomeBreakdown: Record<number, number>;
} {
  const { terrain, width, height, depth, objects } = result;
  const total = width * height * depth;
  let filled = 0;
  const breakdown: Record<number, number> = {};

  for (let i = 0; i < terrain.length; i++) {
    const mat = terrain[i];
    if (mat !== undefined && mat !== 0) {
      filled++;
      breakdown[mat] = (breakdown[mat] ?? 0) + 1;
    }
  }

  return {
    totalVoxels: total,
    filledVoxels: filled,
    objectCount: objects.length,
    biomeBreakdown: breakdown,
  };
}
