/**
 * @voxelyn/ai - Scenario Generator
 *
 * Builds complete world/scenario voxel data from AI-predicted layouts.
 * Handles terrain generation, biome placement, object distribution,
 * building generation, and interior room layouts.
 * 
 * Now integrates with @voxelyn/core's advanced procedural generation:
 * - GradientNoise with zoom factor, octaves, fBm
 * - Height thresholds for terrain types
 * - Raycast shadows for depth
 * - Surface/subsurface material selection
 */

import type {
  ScenarioLayout,
  BiomeRegion,
  BiomeType,
  ObjectPlacement,
  HeightmapParams,
  BuildingDefinition,
  RoomDefinition,
  BuildingStyle,
} from '../types';

import {
  buildEnhancedTerrain,
  biomeRegionsToTerrainLayers,
  DEFAULT_TERRAIN_LAYERS,
  type EnhancedHeightmapParams,
  type TerrainLayer,
  type TerrainLightingParams,
  type EnhancedTerrainResult,
} from './scenario-terrain';

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
  /** Shadow/lighting map (0 = shadow, 1 = lit) */
  lightingMap?: Float32Array;
  /** Biome index per cell */
  biomeMap?: Uint8Array;
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
  /** 
   * Use enhanced terrain generation from @voxelyn/core 
   * Enables: zoom factor, octaves, height thresholds, shadows
   */
  useEnhancedTerrain?: boolean;
  /** Enhanced heightmap parameters (when useEnhancedTerrain is true) */
  enhancedHeightmapParams?: Partial<EnhancedHeightmapParams>;
  /** Custom terrain layers (height thresholds) */
  terrainLayers?: TerrainLayer[];
  /** Lighting/shadow configuration */
  lighting?: TerrainLightingParams;
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
  dungeon: { surface: 0, underground: 1 }, // air, stone
  interior: { surface: 0, underground: 0 }, // all air
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
  leaves: 8,
  snow: 9,
  gravel: 10,
  cactus: 11,    // green cactus
  flower_red: 12,
  flower_yellow: 13,
  palm_wood: 14, // lighter brown for palm
  mushroom: 15,
  moss: 16,
  coral: 17,
  clay: 18,
  // Building materials (19+)
  cobblestone: 19,
  brick: 20,
  plank: 21,
  thatch: 22,
  tile: 23,
  marble: 24,
  sandstone: 25,
  dark_stone: 26,
  timber: 27,
  iron: 28,
  glass: 29,
  carpet: 30,
  rug: 31,
  // Furniture materials (32+)
  table_wood: 32,
  chair_wood: 33,
  bed_frame: 34,
  bed_sheets: 35,
  bookshelf: 36,
  torch: 37,
  chandelier: 38,
  barrel: 39,
  crate: 40,
  chest: 41,
  anvil: 42,
  cauldron: 43,
  throne: 44,
};

// ============================================================================
// BUILDING STYLE MATERIALS
// ============================================================================

/**
 * Default materials for each building style.
 */
const BUILDING_STYLE_MATERIALS: Record<BuildingStyle, {
  wall: number;
  floor: number;
  roof: number;
  foundation: number;
  trim: number;
}> = {
  medieval: { wall: 19, floor: 21, roof: 22, foundation: 1, trim: 27 },
  fantasy: { wall: 24, floor: 24, roof: 23, foundation: 1, trim: 28 },
  modern: { wall: 1, floor: 1, roof: 1, foundation: 1, trim: 28 },
  rustic: { wall: 6, floor: 21, roof: 22, foundation: 1, trim: 6 },
  gothic: { wall: 26, floor: 26, roof: 26, foundation: 26, trim: 28 },
  asian: { wall: 6, floor: 21, roof: 23, foundation: 1, trim: 6 },
  desert: { wall: 25, floor: 25, roof: 25, foundation: 25, trim: 6 },
  nordic: { wall: 6, floor: 21, roof: 22, foundation: 1, trim: 6 },
};

// ============================================================================
// BIOME FEATURE DEFINITIONS
// ============================================================================

type BiomeFeature = {
  type: 'tree' | 'palm' | 'cactus' | 'rock' | 'bush' | 'flower' | 'mushroom' | 'coral' | 'reed';
  density: number; // 0-1, chance per cell
  materials: number[]; // [trunk/base, top/leaves]
  minHeight: number;
  maxHeight: number;
  canopyRadius?: number;
  clusterSize?: number; // for flowers, mushrooms
};

const BIOME_FEATURES: Partial<Record<BiomeType, BiomeFeature[]>> = {
  forest: [
    { type: 'tree', density: 0.06, materials: [6, 8], minHeight: 3, maxHeight: 6, canopyRadius: 2 },
    { type: 'bush', density: 0.03, materials: [8, 8], minHeight: 1, maxHeight: 2 },
    { type: 'flower', density: 0.02, materials: [12, 13], minHeight: 1, maxHeight: 1, clusterSize: 3 },
    { type: 'mushroom', density: 0.01, materials: [15, 15], minHeight: 1, maxHeight: 2 },
    { type: 'rock', density: 0.008, materials: [1, 1], minHeight: 1, maxHeight: 3 },
  ],
  plains: [
    { type: 'tree', density: 0.01, materials: [6, 8], minHeight: 2, maxHeight: 4, canopyRadius: 2 },
    { type: 'flower', density: 0.04, materials: [12, 13], minHeight: 1, maxHeight: 1, clusterSize: 5 },
    { type: 'bush', density: 0.015, materials: [8, 8], minHeight: 1, maxHeight: 1 },
    { type: 'rock', density: 0.005, materials: [1, 10], minHeight: 1, maxHeight: 2 },
  ],
  desert: [
    { type: 'cactus', density: 0.02, materials: [11, 11], minHeight: 2, maxHeight: 5 },
    { type: 'rock', density: 0.015, materials: [3, 1], minHeight: 1, maxHeight: 3 },
    { type: 'bush', density: 0.005, materials: [2, 2], minHeight: 1, maxHeight: 1 }, // dead bush
  ],
  mountains: [
    { type: 'tree', density: 0.02, materials: [6, 8], minHeight: 2, maxHeight: 4, canopyRadius: 1 },
    { type: 'rock', density: 0.04, materials: [1, 1], minHeight: 2, maxHeight: 5 },
    { type: 'bush', density: 0.01, materials: [8, 8], minHeight: 1, maxHeight: 1 },
  ],
  swamp: [
    { type: 'tree', density: 0.04, materials: [6, 8], minHeight: 3, maxHeight: 5, canopyRadius: 2 },
    { type: 'reed', density: 0.06, materials: [7, 7], minHeight: 2, maxHeight: 3 },
    { type: 'mushroom', density: 0.03, materials: [15, 15], minHeight: 1, maxHeight: 2 },
    { type: 'rock', density: 0.01, materials: [16, 1], minHeight: 1, maxHeight: 2 }, // mossy rock
  ],
  ocean: [
    { type: 'coral', density: 0.03, materials: [17, 12], minHeight: 1, maxHeight: 3 },
    { type: 'reed', density: 0.02, materials: [7, 7], minHeight: 2, maxHeight: 4 }, // seaweed
  ],
  lake: [
    { type: 'reed', density: 0.04, materials: [7, 7], minHeight: 2, maxHeight: 3 },
  ],
  river: [
    { type: 'reed', density: 0.03, materials: [7, 7], minHeight: 1, maxHeight: 2 },
    { type: 'rock', density: 0.02, materials: [10, 1], minHeight: 1, maxHeight: 2 },
  ],
  tundra: [
    { type: 'rock', density: 0.03, materials: [1, 9], minHeight: 1, maxHeight: 3 }, // snowy rock
    { type: 'tree', density: 0.008, materials: [6, 8], minHeight: 2, maxHeight: 3, canopyRadius: 1 },
  ],
  volcanic: [
    { type: 'rock', density: 0.05, materials: [1, 1], minHeight: 2, maxHeight: 6 },
  ],
  ruins: [
    { type: 'rock', density: 0.03, materials: [1, 1], minHeight: 1, maxHeight: 4 }, // rubble
    { type: 'bush', density: 0.02, materials: [8, 8], minHeight: 1, maxHeight: 2 }, // overgrowth
  ],
};

// Special features for oasis (water + palms in desert)
const OASIS_FEATURES: BiomeFeature[] = [
  { type: 'palm', density: 0.15, materials: [14, 8], minHeight: 4, maxHeight: 7, canopyRadius: 2 },
  { type: 'bush', density: 0.05, materials: [8, 8], minHeight: 1, maxHeight: 2 },
  { type: 'flower', density: 0.03, materials: [12, 13], minHeight: 1, maxHeight: 1, clusterSize: 2 },
];

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
// SEEDED RANDOM
// ============================================================================

/**
 * Simple seeded random for deterministic generation.
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

// ============================================================================
// TERRAIN BUILDING
// ============================================================================

/**
 * Build terrain voxels from heightmap and biomes with rich detail.
 */
function buildTerrain(
  width: number,
  height: number,
  depth: number,
  heightmap: Float32Array,
  biomes: BiomeRegion[],
  options: ScenarioBuildOptions,
  seed: number = 12345
): { terrain: Uint16Array; materials: Set<number> } {
  const terrain = new Uint16Array(width * height * depth);
  const materials = new Set<number>();
  const detailNoise = new Noise(seed + 1);
  const vegetationNoise = new Noise(seed + 2);

  const biomeMats = { ...DEFAULT_BIOME_MATERIALS, ...options.biomeMaterials };
  const matMap = { ...DEFAULT_MATERIAL_MAPPING, ...options.materialMapping };

  // Biome lookup with distance blending
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

  // Get terrain layers based on depth
  const getLayerMaterial = (
    z: number,
    terrainHeight: number,
    surfaceMat: number,
    undergroundMat: number,
    x: number,
    y: number
  ): number => {
    const depthFromSurface = terrainHeight - z;
    
    // Stone layer at deeper levels
    if (depthFromSurface > 5) {
      // Add some rock variation
      const rockNoise = detailNoise.noise(x * 0.2, y * 0.2);
      return rockNoise > 0.7 ? 1 : undergroundMat;
    }
    
    // Dirt/underground layer
    if (depthFromSurface > 0) {
      return undergroundMat;
    }
    
    // Surface
    return surfaceMat;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const h = heightmap[y * width + x] ?? 0;
      const terrainHeight = Math.floor(h * depth);

      const biome = biomeAt(x, y);
      let surfaceMat = 7; // grass default
      let undergroundMat = 2; // dirt default

      if (biome) {
        if (biome.surfaceMaterial && biome.undergroundMaterial) {
          surfaceMat = resolveMat(biome.surfaceMaterial);
          undergroundMat = resolveMat(biome.undergroundMaterial);
        } else if (biome.type) {
          const biomeType = biome.type as keyof typeof biomeMats;
          const defaultMats = biomeMats[biomeType];
          if (defaultMats) {
            surfaceMat = defaultMats.surface;
            undergroundMat = defaultMats.underground;
          }
        }
      }

      // Fill terrain with layers
      for (let z = 0; z < depth; z++) {
        const idx = x + y * width + z * width * height;

        if (z <= terrainHeight) {
          terrain[idx] = getLayerMaterial(z, terrainHeight, surfaceMat, undergroundMat, x, y);
          materials.add(terrain[idx]!);
        } else {
          terrain[idx] = 0; // air
        }
      }

      // Handle water for water biomes
      if (biome && ['ocean', 'lake', 'river'].includes(biome.type)) {
        const waterLevel = Math.floor(biome.elevation * depth);
        for (let z = terrainHeight + 1; z <= waterLevel; z++) {
          if (z < depth) {
            const idx = x + y * width + z * width * height;
            terrain[idx] = 4; // water
            materials.add(4);
          }
        }
        // Add sand/gravel at water bottom
        if (terrainHeight > 0 && terrainHeight < waterLevel) {
          const bottomIdx = x + y * width + terrainHeight * width * height;
          terrain[bottomIdx] = 3; // sand
          materials.add(3);
        }
      }

      // Add vegetation detail on grass surfaces
      if (biome && ['forest', 'plains'].includes(biome.type) && surfaceMat === 7) {
        const veg = vegetationNoise.noise(x * 0.3, y * 0.3);
        const surfaceZ = terrainHeight + 1;
        
        if (surfaceZ < depth) {
          const idx = x + y * width + surfaceZ * width * height;
          
          // Forest gets dense vegetation
          if (biome.type === 'forest') {
            if (veg > 0.4) {
              // Short grass/shrubs - use darker green (7 is grass)
              terrain[idx] = 7;
              materials.add(7);
            }
            // Tall trees - handled by placeVegetation
          } else if (biome.type === 'plains') {
            // Sparse grass tufts
            if (veg > 0.7) {
              terrain[idx] = 7;
              materials.add(7);
            }
          }
        }
      }

      // Add rocky outcrops on mountains
      if (biome && biome.type === 'mountains') {
        const rockNoise = detailNoise.fbm(x * 0.15, y * 0.15, 3, 0.5);
        if (rockNoise > 0.65) {
          const extraHeight = Math.floor((rockNoise - 0.65) * 10);
          for (let ez = 1; ez <= extraHeight; ez++) {
            const z = terrainHeight + ez;
            if (z < depth) {
              const idx = x + y * width + z * width * height;
              terrain[idx] = 1; // stone
              materials.add(1);
            }
          }
        }
      }
    }
  }

  return { terrain, materials };
}

/**
 * Add vegetation voxels (trees, bushes) to terrain.
 */
function addVegetation(
  terrain: Uint16Array,
  width: number,
  height: number,
  depth: number,
  heightmap: Float32Array,
  biomes: BiomeRegion[],
  seed: number
): Set<number> {
  const materials = new Set<number>();
  const rng = new SeededRandom(seed + 100);
  const noise = new Noise(seed + 101);

  const biomeAt = (x: number, y: number): BiomeRegion | undefined => {
    for (const biome of biomes) {
      const [bx, by, bw, bh] = biome.bounds;
      if (x >= bx && x < bx + bw && y >= by && y < by + bh) {
        return biome;
      }
    }
    return undefined;
  };

  // Check if position is near water (for oasis detection)
  const isNearWater = (x: number, y: number, radius: number): boolean => {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const h = heightmap[ny * width + nx] ?? 0;
          const gz = Math.floor(h * depth);
          const idx = nx + ny * width + gz * width * height;
          if (terrain[idx] === 4) return true; // water
        }
      }
    }
    return false;
  };

  // Set voxel helper
  const setVoxel = (x: number, y: number, z: number, mat: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= depth) return false;
    const idx = x + y * width + z * width * height;
    if (terrain[idx] === 0 || terrain[idx] === 4) { // air or water
      terrain[idx] = mat;
      materials.add(mat);
      return true;
    }
    return false;
  };

  // Get ground height at position
  const getGroundZ = (x: number, y: number): number => {
    const h = heightmap[y * width + x] ?? 0;
    return Math.floor(h * depth);
  };

  // Feature placement functions
  const placeTree = (x: number, y: number, feature: BiomeFeature) => {
    const groundZ = getGroundZ(x, y);
    const trunkMat = feature.materials[0] ?? 6;
    const leavesMat = feature.materials[1] ?? 8;
    const trunkHeight = feature.minHeight + Math.floor(rng.next() * (feature.maxHeight - feature.minHeight + 1));
    const canopyRadius = feature.canopyRadius ?? 2;

    // Trunk
    for (let tz = 1; tz <= trunkHeight; tz++) {
      setVoxel(x, y, groundZ + tz, trunkMat);
    }

    // Canopy (sphere-ish)
    const canopyZ = groundZ + trunkHeight;
    for (let dz = 0; dz <= canopyRadius + 1; dz++) {
      for (let dy = -canopyRadius; dy <= canopyRadius; dy++) {
        for (let dx = -canopyRadius; dx <= canopyRadius; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz * 0.5);
          if (dist <= canopyRadius + 0.5 && rng.next() > 0.1) {
            setVoxel(x + dx, y + dy, canopyZ + dz, leavesMat);
          }
        }
      }
    }
  };

  const placePalm = (x: number, y: number, feature: BiomeFeature) => {
    const groundZ = getGroundZ(x, y);
    const trunkMat = feature.materials[0] ?? 14;
    const leavesMat = feature.materials[1] ?? 8;
    const trunkHeight = feature.minHeight + Math.floor(rng.next() * (feature.maxHeight - feature.minHeight + 1));

    // Trunk (slightly curved)
    let tx = x, ty = y;
    const curveDir = rng.nextInt(4);
    for (let tz = 1; tz <= trunkHeight; tz++) {
      setVoxel(tx, ty, groundZ + tz, trunkMat);
      // Slight curve at top
      if (tz > trunkHeight - 2) {
        if (curveDir === 0 && rng.next() > 0.5) tx++;
        else if (curveDir === 1 && rng.next() > 0.5) tx--;
        else if (curveDir === 2 && rng.next() > 0.5) ty++;
        else if (curveDir === 3 && rng.next() > 0.5) ty--;
      }
    }

    // Palm fronds (radial pattern)
    const topZ = groundZ + trunkHeight + 1;
    for (let dir = 0; dir < 8; dir++) {
      const angle = (dir / 8) * Math.PI * 2;
      for (let r = 1; r <= 3; r++) {
        const fx = tx + Math.round(Math.cos(angle) * r);
        const fy = ty + Math.round(Math.sin(angle) * r);
        const fz = topZ - Math.floor(r * 0.5); // droop down
        setVoxel(fx, fy, fz, leavesMat);
      }
    }
    // Top cluster
    setVoxel(tx, ty, topZ, leavesMat);
    setVoxel(tx, ty, topZ + 1, leavesMat);
  };

  const placeCactus = (x: number, y: number, feature: BiomeFeature) => {
    const groundZ = getGroundZ(x, y);
    const mat = feature.materials[0] ?? 11;
    const cactusHeight = feature.minHeight + Math.floor(rng.next() * (feature.maxHeight - feature.minHeight + 1));

    // Main stem
    for (let tz = 1; tz <= cactusHeight; tz++) {
      setVoxel(x, y, groundZ + tz, mat);
    }

    // Arms (random, Saguaro style)
    if (cactusHeight >= 3 && rng.next() > 0.4) {
      const armZ = groundZ + Math.floor(cactusHeight * 0.5);
      const armDir = rng.nextInt(4);
      const armLen = 1 + rng.nextInt(2);
      const dx = [1, -1, 0, 0][armDir]!;
      const dy = [0, 0, 1, -1][armDir]!;
      
      setVoxel(x + dx, y + dy, armZ, mat);
      for (let az = 1; az <= armLen; az++) {
        setVoxel(x + dx, y + dy, armZ + az, mat);
      }

      // Second arm on opposite side
      if (rng.next() > 0.5) {
        const armZ2 = groundZ + Math.floor(cactusHeight * 0.6);
        setVoxel(x - dx, y - dy, armZ2, mat);
        for (let az = 1; az <= armLen; az++) {
          setVoxel(x - dx, y - dy, armZ2 + az, mat);
        }
      }
    }
  };

  const placeRock = (x: number, y: number, feature: BiomeFeature) => {
    const groundZ = getGroundZ(x, y);
    const baseMat = feature.materials[0] ?? 1;
    const topMat = feature.materials[1] ?? baseMat;
    const rockHeight = feature.minHeight + Math.floor(rng.next() * (feature.maxHeight - feature.minHeight + 1));

    // Irregular rock shape
    for (let rz = 0; rz <= rockHeight; rz++) {
      const layerRadius = Math.max(0, Math.floor((rockHeight - rz) * 0.7) + 1);
      const mat = rz === rockHeight ? topMat : baseMat;
      
      for (let dy = -layerRadius; dy <= layerRadius; dy++) {
        for (let dx = -layerRadius; dx <= layerRadius; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= layerRadius && rng.next() > 0.2) {
            setVoxel(x + dx, y + dy, groundZ + rz + 1, mat);
          }
        }
      }
    }
  };

  const placeBush = (x: number, y: number, feature: BiomeFeature) => {
    const groundZ = getGroundZ(x, y);
    const mat = feature.materials[0] ?? 8;
    const bushHeight = feature.minHeight + Math.floor(rng.next() * (feature.maxHeight - feature.minHeight + 1));

    for (let bz = 1; bz <= bushHeight; bz++) {
      setVoxel(x, y, groundZ + bz, mat);
      if (bz === 1 && rng.next() > 0.5) {
        // Spread at base
        if (rng.next() > 0.5) setVoxel(x + 1, y, groundZ + bz, mat);
        if (rng.next() > 0.5) setVoxel(x - 1, y, groundZ + bz, mat);
        if (rng.next() > 0.5) setVoxel(x, y + 1, groundZ + bz, mat);
        if (rng.next() > 0.5) setVoxel(x, y - 1, groundZ + bz, mat);
      }
    }
  };

  const placeFlower = (x: number, y: number, feature: BiomeFeature) => {
    const colors = feature.materials;
    const clusterSize = feature.clusterSize ?? 1;

    for (let i = 0; i < clusterSize; i++) {
      const fx = x + rng.nextInt(3) - 1;
      const fy = y + rng.nextInt(3) - 1;
      if (fx >= 0 && fx < width && fy >= 0 && fy < height) {
        const fz = getGroundZ(fx, fy);
        const color = colors[rng.nextInt(colors.length)] ?? 12;
        setVoxel(fx, fy, fz + 1, color);
      }
    }
  };

  const placeMushroom = (x: number, y: number, feature: BiomeFeature) => {
    const groundZ = getGroundZ(x, y);
    const mat = feature.materials[0] ?? 15;
    const mushHeight = feature.minHeight + Math.floor(rng.next() * (feature.maxHeight - feature.minHeight + 1));

    // Stem
    for (let mz = 1; mz < mushHeight; mz++) {
      setVoxel(x, y, groundZ + mz, mat);
    }
    // Cap
    const capZ = groundZ + mushHeight;
    setVoxel(x, y, capZ, mat);
    if (mushHeight > 1) {
      setVoxel(x + 1, y, capZ, mat);
      setVoxel(x - 1, y, capZ, mat);
      setVoxel(x, y + 1, capZ, mat);
      setVoxel(x, y - 1, capZ, mat);
    }
  };

  const placeReed = (x: number, y: number, feature: BiomeFeature) => {
    const groundZ = getGroundZ(x, y);
    const mat = feature.materials[0] ?? 7;
    const reedHeight = feature.minHeight + Math.floor(rng.next() * (feature.maxHeight - feature.minHeight + 1));

    for (let rz = 1; rz <= reedHeight; rz++) {
      setVoxel(x, y, groundZ + rz, mat);
    }
  };

  const placeCoral = (x: number, y: number, feature: BiomeFeature) => {
    const groundZ = getGroundZ(x, y);
    const baseMat = feature.materials[0] ?? 17;
    const tipMat = feature.materials[1] ?? 12;
    const coralHeight = feature.minHeight + Math.floor(rng.next() * (feature.maxHeight - feature.minHeight + 1));

    // Main structure
    for (let cz = 1; cz <= coralHeight; cz++) {
      const mat = cz === coralHeight ? tipMat : baseMat;
      setVoxel(x, y, groundZ + cz, mat);
    }
    // Branches
    if (coralHeight > 1) {
      const branchZ = groundZ + Math.ceil(coralHeight * 0.6);
      for (let i = 0; i < 3; i++) {
        const dx = rng.nextInt(3) - 1;
        const dy = rng.nextInt(3) - 1;
        if (dx !== 0 || dy !== 0) {
          setVoxel(x + dx, y + dy, branchZ, baseMat);
          if (rng.next() > 0.5) {
            setVoxel(x + dx, y + dy, branchZ + 1, tipMat);
          }
        }
      }
    }
  };

  // Feature placer dispatch
  const placeFeature = (x: number, y: number, feature: BiomeFeature) => {
    switch (feature.type) {
      case 'tree': placeTree(x, y, feature); break;
      case 'palm': placePalm(x, y, feature); break;
      case 'cactus': placeCactus(x, y, feature); break;
      case 'rock': placeRock(x, y, feature); break;
      case 'bush': placeBush(x, y, feature); break;
      case 'flower': placeFlower(x, y, feature); break;
      case 'mushroom': placeMushroom(x, y, feature); break;
      case 'reed': placeReed(x, y, feature); break;
      case 'coral': placeCoral(x, y, feature); break;
    }
  };

  // Main placement loop
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const biome = biomeAt(x, y);
      if (!biome) continue;

      // Get features for this biome
      let features = BIOME_FEATURES[biome.type] ?? [];

      // Special case: oasis in desert (near water)
      if (biome.type === 'desert' && isNearWater(x, y, 5)) {
        features = OASIS_FEATURES;
      }

      // Check each feature type
      for (const feature of features) {
        const featureNoise = noise.noise(x * 0.15 + feature.type.length, y * 0.15);
        
        if (rng.next() < feature.density && featureNoise > 0.3) {
          placeFeature(x, y, feature);
        }
      }
    }
  }

  return materials;
}

// ============================================================================
// OBJECT PLACEMENT
// ============================================================================

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
// BUILDING GENERATION
// ============================================================================

/**
 * Set a voxel in the terrain array.
 */
function setTerrainVoxel(
  terrain: Uint16Array,
  x: number,
  y: number,
  z: number,
  mat: number,
  width: number,
  height: number,
  depth: number,
  materials: Set<number>,
  overwrite = true
): boolean {
  if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= depth) return false;
  const idx = x + y * width + z * width * height;
  if (overwrite || terrain[idx] === 0) {
    terrain[idx] = mat;
    materials.add(mat);
    return true;
  }
  return false;
}

/**
 * Resolve material name to ID.
 */
function resolveMaterial(name: string, matMap: Record<string, number>): number {
  return matMap[name.toLowerCase()] ?? matMap[name] ?? 1;
}

/**
 * Generate a rectangular room with floor, walls, and optional ceiling.
 */
function generateRoom(
  terrain: Uint16Array,
  room: RoomDefinition,
  materials: Set<number>,
  matMap: Record<string, number>,
  width: number,
  height: number,
  depth: number,
  offsetX: number = 0,
  offsetY: number = 0,
  offsetZ: number = 0
): void {
  const [rx, ry, rz, rw, rh, rd] = room.bounds;
  const floorMat = resolveMaterial(room.floorMaterial, matMap);
  const wallMat = resolveMaterial(room.wallMaterial, matMap);
  const ceilingMat = room.ceilingMaterial
    ? resolveMaterial(room.ceilingMaterial, matMap)
    : wallMat;

  const startX = rx + offsetX;
  const startY = ry + offsetY;
  const startZ = rz + offsetZ;

  // Generate floor
  for (let dy = 0; dy < rh; dy++) {
    for (let dx = 0; dx < rw; dx++) {
      setTerrainVoxel(terrain, startX + dx, startY + dy, startZ, floorMat, width, height, depth, materials);
    }
  }

  // Generate walls (perimeter)
  for (let dz = 1; dz < rd; dz++) {
    for (let dy = 0; dy < rh; dy++) {
      for (let dx = 0; dx < rw; dx++) {
        const isEdgeX = dx === 0 || dx === rw - 1;
        const isEdgeY = dy === 0 || dy === rh - 1;

        if (isEdgeX || isEdgeY) {
          setTerrainVoxel(terrain, startX + dx, startY + dy, startZ + dz, wallMat, width, height, depth, materials);
        } else {
          // Interior is air
          setTerrainVoxel(terrain, startX + dx, startY + dy, startZ + dz, 0, width, height, depth, materials);
        }
      }
    }
  }

  // Generate ceiling
  for (let dy = 0; dy < rh; dy++) {
    for (let dx = 0; dx < rw; dx++) {
      setTerrainVoxel(terrain, startX + dx, startY + dy, startZ + rd - 1, ceilingMat, width, height, depth, materials);
    }
  }

  // Generate doors (carve openings)
  for (const door of room.doors) {
    const [doorX, doorY, doorZ] = door.position;
    const doorW = door.direction === 'north' || door.direction === 'south' ? 2 : 1;
    const doorH = door.direction === 'east' || door.direction === 'west' ? 2 : 1;
    const doorHeight = 3; // Door height in voxels

    for (let dz = 1; dz < doorHeight; dz++) {
      for (let dy = 0; dy < doorH; dy++) {
        for (let dx = 0; dx < doorW; dx++) {
          setTerrainVoxel(
            terrain,
            startX + doorX + dx,
            startY + doorY + dy,
            startZ + doorZ + dz,
            0, // air
            width,
            height,
            depth,
            materials
          );
        }
      }
    }
  }

  // Generate windows (carve openings)
  if (room.windows) {
    for (const window of room.windows) {
      const [winX, winY, winZ] = window.position;
      const [winW, winH] = window.size;

      for (let dz = 0; dz < winH; dz++) {
        for (let dx = 0; dx < winW; dx++) {
          // Set to glass material (29)
          setTerrainVoxel(
            terrain,
            startX + winX + dx,
            startY + winY,
            startZ + winZ + dz,
            29, // glass
            width,
            height,
            depth,
            materials
          );
        }
      }
    }
  }
}

/**
 * Generate a roof for a building.
 */
function generateRoof(
  terrain: Uint16Array,
  footprint: [number, number],
  roofType: BuildingDefinition['roofType'],
  roofMat: number,
  materials: Set<number>,
  width: number,
  height: number,
  depth: number,
  startX: number,
  startY: number,
  startZ: number
): void {
  const [fw, fh] = footprint;

  switch (roofType) {
    case 'flat':
      // Simple flat roof
      for (let dy = 0; dy < fh; dy++) {
        for (let dx = 0; dx < fw; dx++) {
          setTerrainVoxel(terrain, startX + dx, startY + dy, startZ, roofMat, width, height, depth, materials);
        }
      }
      break;

    case 'gabled': {
      // Peaked roof along the longer axis
      const isWidthLonger = fw >= fh;
      const peakHeight = Math.ceil((isWidthLonger ? fh : fw) / 2);

      for (let dz = 0; dz < peakHeight; dz++) {
        const inset = dz;
        if (isWidthLonger) {
          // Peak runs along X
          for (let dx = 0; dx < fw; dx++) {
            for (let dy = inset; dy < fh - inset; dy++) {
              setTerrainVoxel(terrain, startX + dx, startY + dy, startZ + dz, roofMat, width, height, depth, materials);
            }
          }
        } else {
          // Peak runs along Y
          for (let dy = 0; dy < fh; dy++) {
            for (let dx = inset; dx < fw - inset; dx++) {
              setTerrainVoxel(terrain, startX + dx, startY + dy, startZ + dz, roofMat, width, height, depth, materials);
            }
          }
        }
      }
      break;
    }

    case 'hipped': {
      // Roof slopes on all sides
      const peakHeight = Math.ceil(Math.min(fw, fh) / 2);

      for (let dz = 0; dz < peakHeight; dz++) {
        const inset = dz;
        for (let dy = inset; dy < fh - inset; dy++) {
          for (let dx = inset; dx < fw - inset; dx++) {
            setTerrainVoxel(terrain, startX + dx, startY + dy, startZ + dz, roofMat, width, height, depth, materials);
          }
        }
      }
      break;
    }

    case 'dome': {
      // Hemispherical dome
      const centerX = fw / 2;
      const centerY = fh / 2;
      const radius = Math.min(fw, fh) / 2;

      for (let dz = 0; dz <= radius; dz++) {
        const ringRadius = Math.sqrt(radius * radius - dz * dz);
        for (let dy = 0; dy < fh; dy++) {
          for (let dx = 0; dx < fw; dx++) {
            const distFromCenter = Math.sqrt(
              Math.pow(dx - centerX, 2) + Math.pow(dy - centerY, 2)
            );
            if (distFromCenter <= ringRadius) {
              setTerrainVoxel(terrain, startX + dx, startY + dy, startZ + dz, roofMat, width, height, depth, materials);
            }
          }
        }
      }
      break;
    }

    case 'tower': {
      // Conical/pyramidal tower roof
      const centerX = fw / 2;
      const centerY = fh / 2;
      const roofHeight = Math.max(fw, fh);

      for (let dz = 0; dz < roofHeight; dz++) {
        const shrink = (dz / roofHeight) * Math.min(fw, fh) / 2;
        for (let dy = 0; dy < fh; dy++) {
          for (let dx = 0; dx < fw; dx++) {
            const distX = Math.abs(dx - centerX);
            const distY = Math.abs(dy - centerY);
            const maxDist = Math.min(fw, fh) / 2 - shrink;
            if (distX <= maxDist && distY <= maxDist) {
              setTerrainVoxel(terrain, startX + dx, startY + dy, startZ + dz, roofMat, width, height, depth, materials);
            }
          }
        }
      }
      break;
    }

    case 'none':
    default:
      // No roof
      break;
  }
}

/**
 * Place furniture items in a room.
 */
function placeFurniture(
  terrain: Uint16Array,
  furniture: RoomDefinition['furniture'],
  materials: Set<number>,
  width: number,
  height: number,
  depth: number,
  roomOffsetX: number,
  roomOffsetY: number,
  roomOffsetZ: number
): void {
  const furnitureMaterials: Record<string, number> = {
    table: 32,
    chair: 33,
    bed: 34,
    bookshelf: 36,
    torch: 37,
    chandelier: 38,
    barrel: 39,
    crate: 40,
    chest: 41,
    anvil: 42,
    cauldron: 43,
    throne: 44,
    bench: 33,
    desk: 32,
    wardrobe: 36,
    shelf: 36,
    stool: 33,
    rack: 6,
    counter: 32,
    altar: 24,
    lectern: 6,
  };

  for (const item of furniture) {
    const [fx, fy, fz] = item.position;
    const mat = furnitureMaterials[item.type.toLowerCase()] ?? 6; // default to wood

    // Simple 1x1 or 2x1 furniture placement
    const px = roomOffsetX + fx;
    const py = roomOffsetY + fy;
    const pz = roomOffsetZ + fz + 1; // +1 to be above floor

    setTerrainVoxel(terrain, px, py, pz, mat, width, height, depth, materials);

    // Larger furniture items
    if (['bed', 'table', 'counter', 'altar', 'bookshelf', 'wardrobe'].includes(item.type.toLowerCase())) {
      // Place 2x1
      const rotation = item.rotation ?? 0;
      const dx = rotation % 2 === 0 ? 1 : 0;
      const dy = rotation % 2 === 1 ? 1 : 0;
      setTerrainVoxel(terrain, px + dx, py + dy, pz, mat, width, height, depth, materials);
    }

    // Tall furniture items
    if (['bookshelf', 'wardrobe', 'torch', 'chandelier'].includes(item.type.toLowerCase())) {
      setTerrainVoxel(terrain, px, py, pz + 1, mat, width, height, depth, materials);
    }
  }
}

/**
 * Generate a complete building from its definition.
 */
function generateBuilding(
  terrain: Uint16Array,
  building: BuildingDefinition,
  materials: Set<number>,
  matMap: Record<string, number>,
  width: number,
  height: number,
  depth: number,
  buildingX: number,
  buildingY: number,
  groundZ: number
): void {
  const [fw, fh] = building.footprint;
  const wallMat = resolveMaterial(building.wallMaterial, matMap);
  const foundationMat = resolveMaterial(building.foundationMaterial, matMap);
  const roofMat = resolveMaterial(building.roofMaterial, matMap);
  const styleMats = BUILDING_STYLE_MATERIALS[building.style];
  const floorMat = styleMats?.floor ?? 21;

  // Build foundation layer
  for (let dy = 0; dy < fh; dy++) {
    for (let dx = 0; dx < fw; dx++) {
      setTerrainVoxel(
        terrain,
        buildingX + dx,
        buildingY + dy,
        groundZ,
        foundationMat,
        width,
        height,
        depth,
        materials
      );
    }
  }

  // Build basement if present
  const currentZ = groundZ + 1;
  if (building.hasBasement) {
    const basementRoom: RoomDefinition = {
      type: 'storage',
      bounds: [0, 0, 0, fw, fh, building.floorHeight],
      floorMaterial: 'stone',
      wallMaterial: 'stone',
      doors: [],
      furniture: [],
    };
    generateRoom(
      terrain,
      basementRoom,
      materials,
      matMap,
      width,
      height,
      depth,
      buildingX,
      buildingY,
      groundZ - building.floorHeight
    );
  }

  // Build each floor
  for (let floor = 0; floor < building.floors; floor++) {
    const floorStartZ = currentZ + floor * building.floorHeight;

    // Generate floor rooms if defined, otherwise create default room
    const floorRooms = building.rooms.filter((r) => {
      // Check if room's Z is within this floor
      const roomFloor = Math.floor(r.bounds[2] / building.floorHeight);
      return roomFloor === floor;
    });

    if (floorRooms.length > 0) {
      for (const room of floorRooms) {
        generateRoom(
          terrain,
          room,
          materials,
          matMap,
          width,
          height,
          depth,
          buildingX,
          buildingY,
          floorStartZ
        );

        // Place furniture
        placeFurniture(
          terrain,
          room.furniture,
          materials,
          width,
          height,
          depth,
          buildingX + room.bounds[0],
          buildingY + room.bounds[1],
          floorStartZ + room.bounds[2]
        );
      }
    } else {
      // Default: single room for the entire floor
      const defaultRoom: RoomDefinition = {
        type: 'living',
        bounds: [0, 0, 0, fw, fh, building.floorHeight],
        floorMaterial: building.wallMaterial,
        wallMaterial: building.wallMaterial,
        doors: [{ position: [Math.floor(fw / 2), 0, 0], direction: 'south' }],
        furniture: [],
      };
      generateRoom(
        terrain,
        defaultRoom,
        materials,
        matMap,
        width,
        height,
        depth,
        buildingX,
        buildingY,
        floorStartZ
      );
    }
  }

  // Build roof
  const roofStartZ = currentZ + building.floors * building.floorHeight;
  generateRoof(
    terrain,
    building.footprint,
    building.roofType,
    roofMat,
    materials,
    width,
    height,
    depth,
    buildingX,
    buildingY,
    roofStartZ
  );

  // Build external features
  if (building.externalFeatures) {
    for (const feature of building.externalFeatures) {
      const [fx, fy, fz] = feature.position;
      const [fsw, fsh, fsd] = feature.size;
      const featureMat = styleMats?.trim ?? wallMat;

      switch (feature.type) {
        case 'chimney':
          // Vertical stack
          for (let dz = 0; dz < fsd; dz++) {
            setTerrainVoxel(
              terrain,
              buildingX + fx,
              buildingY + fy,
              groundZ + fz + dz,
              featureMat,
              width,
              height,
              depth,
              materials
            );
          }
          break;

        case 'balcony':
        case 'porch':
          // Platform
          for (let dy = 0; dy < fsh; dy++) {
            for (let dx = 0; dx < fsw; dx++) {
              setTerrainVoxel(
                terrain,
                buildingX + fx + dx,
                buildingY + fy + dy,
                groundZ + fz,
                floorMat,
                width,
                height,
                depth,
                materials
              );
            }
          }
          break;

        case 'stairs':
          // Staircase
          for (let dz = 0; dz < fsd; dz++) {
            const step = dz;
            for (let dy = 0; dy < fsh; dy++) {
              setTerrainVoxel(
                terrain,
                buildingX + fx + step,
                buildingY + fy + dy,
                groundZ + fz + dz,
                1, // stone
                width,
                height,
                depth,
                materials
              );
            }
          }
          break;

        case 'tower':
          // Small attached tower
          for (let dz = 0; dz < fsd; dz++) {
            for (let dy = 0; dy < fsh; dy++) {
              for (let dx = 0; dx < fsw; dx++) {
                const isEdge = dx === 0 || dx === fsw - 1 || dy === 0 || dy === fsh - 1;
                const mat = isEdge ? wallMat : 0;
                setTerrainVoxel(
                  terrain,
                  buildingX + fx + dx,
                  buildingY + fy + dy,
                  groundZ + fz + dz,
                  mat,
                  width,
                  height,
                  depth,
                  materials
                );
              }
            }
          }
          break;
      }
    }
  }
}

/**
 * Build all buildings in a scenario.
 */
function buildBuildings(
  terrain: Uint16Array,
  buildings: BuildingDefinition[],
  heightmap: Float32Array,
  materials: Set<number>,
  options: ScenarioBuildOptions,
  width: number,
  height: number,
  depth: number
): void {
  const matMap = { ...DEFAULT_MATERIAL_MAPPING, ...options.materialMapping };

  for (const building of buildings) {
    // Determine building position (center of terrain for single building)
    const [fw, fh] = building.footprint;
    const buildingX = Math.floor((width - fw) / 2);
    const buildingY = Math.floor((height - fh) / 2);

    // Get ground height at building location
    const centerIdx = buildingY * width + buildingX;
    const groundH = heightmap[centerIdx] ?? 0.3;
    const groundZ = Math.floor(groundH * depth);

    // Clear area for building first
    for (let dy = 0; dy < fh; dy++) {
      for (let dx = 0; dx < fw; dx++) {
        for (let dz = groundZ; dz < depth; dz++) {
          setTerrainVoxel(terrain, buildingX + dx, buildingY + dy, dz, 0, width, height, depth, materials, true);
        }
      }
    }

    generateBuilding(
      terrain,
      building,
      materials,
      matMap,
      width,
      height,
      depth,
      buildingX,
      buildingY,
      groundZ
    );
  }
}

/**
 * Generate a standalone interior scene (dungeon, room, etc.).
 */
function buildInterior(
  terrain: Uint16Array,
  layout: ScenarioLayout,
  materials: Set<number>,
  options: ScenarioBuildOptions,
  width: number,
  height: number,
  depth: number
): void {
  const matMap = { ...DEFAULT_MATERIAL_MAPPING, ...options.materialMapping };

  // For interior-only scenarios, fill with stone/dungeon walls and carve rooms
  const isUnderground = layout.description?.toLowerCase().includes('dungeon') ||
                        layout.description?.toLowerCase().includes('cave') ||
                        layout.description?.toLowerCase().includes('underground');

  if (isUnderground) {
    // Fill entire space with stone
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          setTerrainVoxel(terrain, x, y, z, 1, width, height, depth, materials); // stone
        }
      }
    }
  }

  // Generate rooms from buildings (interior uses building.rooms)
  if (layout.buildings && layout.buildings.length > 0) {
    for (const building of layout.buildings) {
      for (const room of building.rooms) {
        generateRoom(terrain, room, materials, matMap, width, height, depth, 0, 0, 0);
        placeFurniture(
          terrain,
          room.furniture,
          materials,
          width,
          height,
          depth,
          room.bounds[0],
          room.bounds[1],
          room.bounds[2]
        );
      }
    }
  } else {
    // Default: create a simple central room
    const roomW = Math.floor(width * 0.6);
    const roomH = Math.floor(height * 0.6);
    const roomD = Math.floor(depth * 0.5);
    const startX = Math.floor((width - roomW) / 2);
    const startY = Math.floor((height - roomH) / 2);
    const startZ = Math.floor((depth - roomD) / 2);

    const defaultRoom: RoomDefinition = {
      type: 'dungeon_cell',
      bounds: [startX, startY, startZ, roomW, roomH, roomD],
      floorMaterial: 'stone',
      wallMaterial: 'cobblestone',
      doors: [{ position: [Math.floor(roomW / 2), 0, 0], direction: 'south' }],
      furniture: [
        { type: 'torch', position: [2, 2, 0] },
        { type: 'torch', position: [roomW - 3, 2, 0] },
      ],
    };

    generateRoom(terrain, defaultRoom, materials, matMap, width, height, depth, 0, 0, 0);
    placeFurniture(
      terrain,
      defaultRoom.furniture,
      materials,
      width,
      height,
      depth,
      defaultRoom.bounds[0],
      defaultRoom.bounds[1],
      defaultRoom.bounds[2]
    );
  }
}

// ============================================================================
// LAYOUT ENRICHMENT
// ============================================================================

/**
 * Enriches a layout by detecting keywords and adding missing biomes.
 * This compensates for AI models that generate overly simple layouts.
 */
function enrichLayout(layout: ScenarioLayout): ScenarioLayout {
  const desc = (layout.name + ' ' + layout.description).toLowerCase();
  const [width, height] = layout.size;
  const biomes = [...layout.biomes];
  const existingTypes = new Set(biomes.map(b => b.type));

  // Oasis detection: desert without water
  if (desc.includes('oasis') && existingTypes.has('desert') && !existingTypes.has('lake')) {
    const centerX = Math.floor(width * 0.35);
    const centerY = Math.floor(height * 0.35);
    const lakeSize = Math.floor(Math.min(width, height) * 0.25);
    
    // Add lake at center
    biomes.push({
      type: 'lake',
      bounds: [centerX, centerY, lakeSize, lakeSize],
      elevation: 0.18,
      elevationVariation: 0.02,
      moisture: 1,
      surfaceMaterial: 'water',
      undergroundMaterial: 'sand',
    });
    
    // Add grass/plains ring around lake
    const ringSize = lakeSize + 8;
    const ringX = centerX - 4;
    const ringY = centerY - 4;
    biomes.push({
      type: 'plains',
      bounds: [ringX, ringY, ringSize, ringSize],
      elevation: 0.25,
      elevationVariation: 0.05,
      moisture: 0.7,
      surfaceMaterial: 'grass',
      undergroundMaterial: 'dirt',
    });
  }

  // Valley detection: needs mountains on sides
  if (desc.includes('valley') && !existingTypes.has('mountains')) {
    const mtHeight = Math.floor(height * 0.25);
    biomes.unshift({
      type: 'mountains',
      bounds: [0, 0, width, mtHeight],
      elevation: 0.7,
      elevationVariation: 0.25,
      moisture: 0.3,
      surfaceMaterial: 'stone',
      undergroundMaterial: 'stone',
    });
    biomes.unshift({
      type: 'mountains',
      bounds: [0, height - mtHeight, width, mtHeight],
      elevation: 0.7,
      elevationVariation: 0.25,
      moisture: 0.3,
      surfaceMaterial: 'stone',
      undergroundMaterial: 'stone',
    });
  }

  // River detection: add river if mentioned but missing
  if ((desc.includes('river') || desc.includes('stream')) && !existingTypes.has('river')) {
    const riverWidth = Math.max(4, Math.floor(width * 0.1));
    const riverX = Math.floor((width - riverWidth) / 2);
    biomes.push({
      type: 'river',
      bounds: [riverX, 0, riverWidth, height],
      elevation: 0.2,
      elevationVariation: 0.02,
      moisture: 1,
      surfaceMaterial: 'water',
      undergroundMaterial: 'sand',
    });
  }

  // Beach/coastal detection
  if ((desc.includes('beach') || desc.includes('coast')) && !existingTypes.has('ocean')) {
    const oceanWidth = Math.floor(width * 0.3);
    biomes.unshift({
      type: 'ocean',
      bounds: [0, 0, oceanWidth, height],
      elevation: 0.15,
      elevationVariation: 0.03,
      moisture: 1,
      surfaceMaterial: 'water',
      undergroundMaterial: 'sand',
    });
  }

  // Island detection
  if (desc.includes('island') && !existingTypes.has('ocean')) {
    // Surround with ocean
    const margin = Math.floor(Math.min(width, height) * 0.15);
    biomes.unshift({
      type: 'ocean',
      bounds: [0, 0, width, margin],
      elevation: 0.12,
      elevationVariation: 0.02,
      moisture: 1,
      surfaceMaterial: 'water',
      undergroundMaterial: 'sand',
    });
    biomes.unshift({
      type: 'ocean',
      bounds: [0, height - margin, width, margin],
      elevation: 0.12,
      elevationVariation: 0.02,
      moisture: 1,
      surfaceMaterial: 'water',
      undergroundMaterial: 'sand',
    });
    biomes.unshift({
      type: 'ocean',
      bounds: [0, 0, margin, height],
      elevation: 0.12,
      elevationVariation: 0.02,
      moisture: 1,
      surfaceMaterial: 'water',
      undergroundMaterial: 'sand',
    });
    biomes.unshift({
      type: 'ocean',
      bounds: [width - margin, 0, margin, height],
      elevation: 0.12,
      elevationVariation: 0.02,
      moisture: 1,
      surfaceMaterial: 'water',
      undergroundMaterial: 'sand',
    });
  }

  // Lake detection
  if (desc.includes('lake') && !existingTypes.has('lake') && !existingTypes.has('ocean')) {
    const lakeSize = Math.floor(Math.min(width, height) * 0.3);
    const lakeX = Math.floor((width - lakeSize) / 2);
    const lakeY = Math.floor((height - lakeSize) / 2);
    biomes.push({
      type: 'lake',
      bounds: [lakeX, lakeY, lakeSize, lakeSize],
      elevation: 0.18,
      elevationVariation: 0.02,
      moisture: 1,
      surfaceMaterial: 'water',
      undergroundMaterial: 'sand',
    });
  }

  // Swamp detection
  if ((desc.includes('swamp') || desc.includes('marsh')) && !existingTypes.has('swamp')) {
    const swampSize = Math.floor(Math.min(width, height) * 0.4);
    const swampX = Math.floor((width - swampSize) / 2);
    const swampY = Math.floor((height - swampSize) / 2);
    biomes.push({
      type: 'swamp',
      bounds: [swampX, swampY, swampSize, swampSize],
      elevation: 0.22,
      elevationVariation: 0.08,
      moisture: 0.9,
      surfaceMaterial: 'dirt',
      undergroundMaterial: 'dirt',
    });
  }

  return {
    ...layout,
    biomes,
  };
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
  // Enrich layout with missing elements based on description
  const enrichedLayout = enrichLayout(layout);
  
  const [width, height] = enrichedLayout.size;
  const depth = enrichedLayout.depth;
  const seed = enrichedLayout.seed;
  const category = enrichedLayout.category ?? 'outdoor';

  // Use enhanced terrain if requested
  const useEnhanced = options.useEnhancedTerrain ?? false;

  // Enhanced terrain result (if using enhanced mode)
  let enhancedResult: EnhancedTerrainResult | null = null;

  // Generate heightmap (used even for buildings to determine ground level)
  let heightmap: Float32Array;
  
  if (useEnhanced && (category === 'outdoor' || category === 'mixed')) {
    // Use @voxelyn/core enhanced heightmap generation
    const enhancedParams: EnhancedHeightmapParams = {
      octaves: enrichedLayout.heightmap.octaves,
      persistence: enrichedLayout.heightmap.persistence,
      scale: enrichedLayout.heightmap.scale,
      seed: enrichedLayout.heightmap.seed,
      baseElevation: enrichedLayout.heightmap.baseElevation,
      amplitude: enrichedLayout.heightmap.amplitude,
      // Enhanced features
      zoomFactor: options.enhancedHeightmapParams?.zoomFactor ?? 80,
      noiseDetail: options.enhancedHeightmapParams?.noiseDetail,
      ridgedMountains: options.enhancedHeightmapParams?.ridgedMountains ?? true,
      domainWarping: options.enhancedHeightmapParams?.domainWarping ?? false,
      warpScale: options.enhancedHeightmapParams?.warpScale ?? 0.5,
      ...options.enhancedHeightmapParams,
    };
    
    // Determine terrain layers
    const terrainLayers = options.terrainLayers 
      ?? (enrichedLayout.biomes.length > 0 
          ? biomeRegionsToTerrainLayers(enrichedLayout.biomes, { ...DEFAULT_MATERIAL_MAPPING, ...options.materialMapping })
          : DEFAULT_TERRAIN_LAYERS);
    
    // Build enhanced terrain with shadows
    enhancedResult = buildEnhancedTerrain(
      width,
      height,
      depth,
      enhancedParams,
      terrainLayers,
      options.lighting ?? {
        enabled: true,
        lightDirection: { x: -0.6, y: -0.4 },
        intensity: 0.35,
        maxDistance: 20,
        ambientOcclusion: true,
        aoRadius: 3,
      }
    );
    
    heightmap = enhancedResult.heightmap;
  } else {
    heightmap = generateHeightmap(width, height, enrichedLayout.heightmap, enrichedLayout.biomes);
  }

  // Initialize terrain and materials based on category
  let terrain: Uint16Array;
  let materials: Set<number>;
  let objects: PlacedObject[] = [];
  let lightingMap: Float32Array | undefined;
  let biomeMap: Uint8Array | undefined;

  switch (category) {
    case 'interior': {
      // Pure interior scene - no terrain, just rooms
      terrain = new Uint16Array(width * height * depth);
      materials = new Set<number>();
      
      buildInterior(terrain, enrichedLayout, materials, options, width, height, depth);
      break;
    }

    case 'building': {
      // Building on flat ground
      terrain = new Uint16Array(width * height * depth);
      materials = new Set<number>();
      
      // Create flat ground
      const groundZ = Math.floor(depth * 0.2);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          for (let z = 0; z <= groundZ; z++) {
            const mat = z === groundZ ? 7 : 2; // grass on top, dirt below
            setTerrainVoxel(terrain, x, y, z, mat, width, height, depth, materials);
          }
          // Update heightmap for building placement
          heightmap[y * width + x] = groundZ / depth;
        }
      }
      
      // Generate buildings
      if (enrichedLayout.buildings && enrichedLayout.buildings.length > 0) {
        buildBuildings(terrain, enrichedLayout.buildings, heightmap, materials, options, width, height, depth);
      }
      break;
    }

    case 'mixed': {
      // Terrain with buildings - use enhanced if available
      if (enhancedResult) {
        terrain = enhancedResult.terrain;
        materials = enhancedResult.materials;
        lightingMap = enhancedResult.lightingMap;
        biomeMap = enhancedResult.biomeMap;
      } else {
        const terrainResult = buildTerrain(
          width,
          height,
          depth,
          heightmap,
          enrichedLayout.biomes,
          options,
          seed
        );
        terrain = terrainResult.terrain;
        materials = terrainResult.materials;
      }

      // Add vegetation
      const vegMaterials = addVegetation(
        terrain,
        width,
        height,
        depth,
        heightmap,
        enrichedLayout.biomes,
        seed
      );
      vegMaterials.forEach(m => materials.add(m));

      // Generate buildings on terrain
      if (enrichedLayout.buildings && enrichedLayout.buildings.length > 0) {
        buildBuildings(terrain, enrichedLayout.buildings, heightmap, materials, options, width, height, depth);
      }

      // Place objects
      objects = placeObjects(
        enrichedLayout.objects,
        enrichedLayout.biomes,
        heightmap,
        width,
        height,
        depth,
        seed
      );
      break;
    }

    case 'outdoor':
    default: {
      // Use enhanced terrain if available
      if (enhancedResult) {
        terrain = enhancedResult.terrain;
        materials = enhancedResult.materials;
        lightingMap = enhancedResult.lightingMap;
        biomeMap = enhancedResult.biomeMap;
      } else {
        // Standard terrain generation
        const terrainResult = buildTerrain(
          width,
          height,
          depth,
          heightmap,
          enrichedLayout.biomes,
          options,
          seed
        );
        terrain = terrainResult.terrain;
        materials = terrainResult.materials;
      }

      // Add trees and vegetation
      const vegMaterials = addVegetation(
        terrain,
        width,
        height,
        depth,
        heightmap,
        enrichedLayout.biomes,
        seed
      );
      vegMaterials.forEach(m => materials.add(m));

      // Place objects
      objects = placeObjects(
        enrichedLayout.objects,
        enrichedLayout.biomes,
        heightmap,
        width,
        height,
        depth,
        seed
      );
      break;
    }
  }

  return {
    terrain,
    width,
    height,
    depth,
    heightmap,
    lightingMap,
    biomeMap,
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

  // Default colors for materials (ABGR format for canvas)
  const defaultColors: Record<number, number> = {
    0: 0x00000000, // air (transparent)
    1: 0xff808080, // stone (gray)
    2: 0xff5b3a23, // dirt (brown)
    3: 0xffc2b280, // sand (tan)
    4: 0xffc86400, // water (blue)
    5: 0xff0064ff, // lava (orange)
    6: 0xff134589, // wood (brown)
    7: 0xff228b22, // grass (green)
    8: 0xff22aa22, // leaves (bright green)
    9: 0xfff0f0f0, // snow (white)
    10: 0xff666666, // gravel (dark gray)
    11: 0xff329632, // cactus (green)
    12: 0xff5032dc, // flower red
    13: 0xff32dcff, // flower yellow
    14: 0xff5a8cb4, // palm wood
    15: 0xffa0b4c8, // mushroom
    16: 0xff3c7850, // moss
    17: 0xff9678ff, // coral
    18: 0xff466496, // clay
    19: 0xff787878, // cobblestone (dark gray)
    20: 0xff4040a0, // brick (reddish)
    21: 0xff5080c0, // plank (light wood)
    22: 0xff60b0d0, // thatch (straw yellow)
    23: 0xff6060c0, // tile (terracotta)
    24: 0xffffffff, // marble (white)
    25: 0xff80c0f0, // sandstone (tan-orange)
    26: 0xff404040, // dark_stone
    27: 0xff205080, // timber (dark brown)
    28: 0xffa0a0a0, // iron (metallic)
    29: 0x80ffc8a0, // glass (semi-transparent cyan)
    30: 0xff4050a0, // carpet (red)
    31: 0xff2040a0, // rug (darker red)
    32: 0xff306090, // table_wood
    33: 0xff305080, // chair_wood
    34: 0xff204060, // bed_frame
    35: 0xfff0f0f0, // bed_sheets (white)
    36: 0xff204080, // bookshelf (dark wood)
    37: 0xff00c8ff, // torch (orange glow)
    38: 0xff50ffff, // chandelier (yellow)
    39: 0xff305070, // barrel (brown)
    40: 0xff406080, // crate (wood)
    41: 0xff608080, // chest (metal trim)
    42: 0xff404040, // anvil (dark metal)
    43: 0xff504040, // cauldron (iron)
    44: 0xff00d0ff, // throne (gold)
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
