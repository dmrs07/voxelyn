import type { BiomeDefinition, BiomeField, BiomeFieldParams, BiomeShapeContext } from "./biome-map.js";
import { generateBiomeField } from "./biome-map.js";
import type { BiomeBlendParams } from "./biome-blend.js";
import { pickWeightedIndex, sampleBiomeBlend } from "./biome-blend.js";

export type BiomeFirstTerrainParams = {
  size: readonly [number, number, number];
  seed: number;
  biomes: readonly BiomeDefinition[];
  fieldParams?: Partial<Omit<BiomeFieldParams, "size" | "seed" | "biomes">>;
  blendParams?: BiomeBlendParams;
  densityThreshold?: number;
  /**
   * Mode for terrain generation:
   * - "height": Use shape function height (default blending)
   * - "density": Full 3D density function (caves, overhangs)
   * - "heightThreshold": Use pre-generated height map from BiomeField (video technique)
   */
  mode?: "height" | "density" | "heightThreshold";
  /**
   * Surface detection settings for material variation
   * Like the video's gradient colors - different materials at surface vs underground
   */
  surfaceDepth?: number;
};

/**
 * Extended context passed to material functions
 * Enables gradient-based material selection (video technique)
 * Extends BiomeShapeContext for compatibility
 */
export interface VoxelMaterialContext extends BiomeShapeContext {
  /** Is this voxel at the terrain surface? */
  isSurface: boolean;
  /** Depth from surface (0 = surface, 1+ = underground) */
  depthFromSurface: number;
  /** Height value at this x,y (0-1, like video's noise value) */
  terrainHeight: number;
  /** Normalized position within terrain column (0 = bottom, 1 = top) */
  columnPosition: number;
}

export type BiomeFirstTerrainResult = {
  voxels: Uint16Array;
  width: number;
  height: number;
  depth: number;
  heightmap: Float32Array;
  field: BiomeField;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const hash3D = (x: number, y: number, z: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) ^ seed;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 0xffffffff;
};

/**
 * Create extended context for material selection
 * This enables gradient-based materials like in the video
 */
const createMaterialContext = (
  biome: BiomeDefinition,
  params: BiomeFirstTerrainParams,
  terrainHeight: number,
  z: number,
  maxZ: number,
  _depth: number
): VoxelMaterialContext => {
  const [width, height, d] = params.size;
  const surfaceDepth = params.surfaceDepth ?? 2;
  const depthFromSurface = maxZ - z;
  
  return {
    size: [width, height, d] as const,
    seed: params.seed,
    params: biome.params,
    biomeName: biome.name,
    isSurface: depthFromSurface < surfaceDepth,
    depthFromSurface,
    terrainHeight,
    columnPosition: maxZ > 0 ? z / maxZ : 0,
  };
};

// ============================================================================
// HELPER FUNCTIONS FOR MATERIAL SELECTION (Video techniques)
// ============================================================================

/**
 * Select material based on depth from surface (like video's terrain type gradients)
 * 
 * Example usage in BiomeDefinition.materials:
 * ```ts
 * materials: (x, y, z01, ctx) => {
 *   return selectMaterialByDepth(ctx, [
 *     { depth: 0, material: GRASS },      // Surface
 *     { depth: 2, material: DIRT },       // 1-2 voxels below
 *     { depth: Infinity, material: STONE } // Deep underground
 *   ]);
 * }
 * ```
 */
export function selectMaterialByDepth(
  ctx: VoxelMaterialContext,
  layers: readonly { depth: number; material: number }[]
): number {
  const sortedLayers = [...layers].sort((a, b) => a.depth - b.depth);
  
  for (const layer of sortedLayers) {
    if (ctx.depthFromSurface <= layer.depth) {
      return layer.material;
    }
  }
  
  return sortedLayers[sortedLayers.length - 1]?.material ?? 0;
}

/**
 * Select material with noise-based variation (breaks up flat layers)
 * Like video's gradient but with randomness for natural look
 */
export function selectMaterialWithVariation(
  ctx: VoxelMaterialContext,
  x: number,
  y: number,
  z: number,
  layers: readonly { depth: number; material: number; variation?: number }[]
): number {
  const sortedLayers = [...layers].sort((a, b) => a.depth - b.depth);
  const noise = hash3D(x, y, z, ctx.seed);
  
  for (const layer of sortedLayers) {
    const variation = layer.variation ?? 0;
    const adjustedDepth = layer.depth + (noise - 0.5) * variation * 2;
    
    if (ctx.depthFromSurface <= adjustedDepth) {
      return layer.material;
    }
  }
  
  return sortedLayers[sortedLayers.length - 1]?.material ?? 0;
}

/**
 * Blend between two materials based on height (video's gradient technique)
 * Returns materialA at low heights, materialB at high heights
 */
export function blendMaterialByHeight(
  ctx: VoxelMaterialContext,
  materialLow: number,
  materialHigh: number,
  threshold: number = 0.5
): number {
  return ctx.terrainHeight < threshold ? materialLow : materialHigh;
}

/**
 * Select surface material based on terrain height (video's height threshold technique)
 * Like: water < 0.4, sand < 0.5, grass < 0.7, trees >= 0.7
 */
export function selectSurfaceMaterialByHeight(
  ctx: VoxelMaterialContext,
  heightMaterials: readonly { maxHeight: number; material: number }[]
): number {
  const sorted = [...heightMaterials].sort((a, b) => a.maxHeight - b.maxHeight);
  
  for (const hm of sorted) {
    if (ctx.terrainHeight < hm.maxHeight) {
      return hm.material;
    }
  }
  
  return sorted[sorted.length - 1]?.material ?? 0;
}

/**
 * Biome-first terrain generation pipeline.
 *
 * Key params for LLM shaping:
 * - BiomeDefinition.params: author custom "biome shaping" knobs (e.g. ridgeHeight, duneScale).
 * - fieldParams: Voronoi/Noise layout controls (siteCount, jitter, noiseScale, blendRadius).
 * - blendParams: blending sharpness + minWeight.
 * - mode: 
 *   - "height" (default): blend shape functions
 *   - "density": 3D cave-like shapes
 *   - "heightThreshold": use field.heightMap with height thresholds (video technique)
 */
export function buildBiomeFirstTerrain(params: BiomeFirstTerrainParams): BiomeFirstTerrainResult {
  const [width, height, depth] = params.size;
  const mode = params.mode ?? "height";
  const densityThreshold = params.densityThreshold ?? 0.5;

  // Enable height map generation when using heightThreshold mode
  const fieldParams = {
    ...params.fieldParams,
    useHeightThresholds: mode === "heightThreshold" ? true : params.fieldParams?.useHeightThresholds,
  };

  const field = generateBiomeField({
    size: [width, height],
    seed: params.seed,
    biomes: params.biomes,
    ...fieldParams,
  });

  const voxels = new Uint16Array(width * height * depth);
  const heightmap = new Float32Array(width * height);

  const biomeContext = (biome: BiomeDefinition) => ({
    size: [width, height, depth] as const,
    seed: params.seed,
    params: biome.params,
    biomeName: biome.name,
  });

  // Mode: heightThreshold - use pre-calculated height map from BiomeField
  // Video technique: use noise-based height with threshold terrain types
  if (mode === "heightThreshold" && field.heightMap) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx2d = x + y * width;
        const h = field.heightMap[idx2d] ?? 0;
        heightmap[idx2d] = h;

        // Get biome from field's sample function
        const blend = field.sample(x, y);
        const biomeIndex = blend.indices[0] ?? 0;
        const biome = params.biomes[biomeIndex];
        if (!biome) continue;

        // Convert height (0-1) to voxel depth  
        const maxZ = Math.floor(h * (depth - 1));
        
        // Fill column with surface/subsurface awareness (video gradient technique)
        for (let z = 0; z <= maxZ; z++) {
          const z01 = depth <= 1 ? 0 : z / (depth - 1);
          const voxelIndex = x + y * width + z * width * height;
          
          // Create extended context with surface detection
          const ctx = createMaterialContext(biome, params, h, z, maxZ, depth);
          const mat = biome.materials(x, y, z01, ctx);
          voxels[voxelIndex] = Math.max(0, Math.floor(mat));
        }
      }
    }

    return { voxels, width, height, depth, heightmap, field };
  }

  // Original modes: "height" and "density"
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const blend = sampleBiomeBlend(field, x, y, params.blendParams);
      let blendedHeight = 0;

      for (let i = 0; i < blend.indices.length; i++) {
        const biomeIndex = blend.indices[i] ?? 0;
        const weight = blend.weights[i] ?? 0;
        const biome = params.biomes[biomeIndex];
        if (!biome || weight <= 0) continue;
        const sample = biome.shape(x, y, 0, biomeContext(biome));
        blendedHeight += clamp01(sample.height) * weight;
      }

      const terrainH = clamp01(blendedHeight);
      heightmap[x + y * width] = terrainH;
      const maxZ = Math.floor(terrainH * (depth - 1));

      for (let z = 0; z < depth; z++) {
        const z01 = depth <= 1 ? 0 : z / (depth - 1);
        const voxelIndex = x + y * width + z * width * height;
        let density = 0;

        if (mode === "density") {
          for (let i = 0; i < blend.indices.length; i++) {
            const biomeIndex = blend.indices[i] ?? 0;
            const weight = blend.weights[i] ?? 0;
            const biome = params.biomes[biomeIndex];
            if (!biome || weight <= 0) continue;
            const sample = biome.shape(x, y, z01, biomeContext(biome));
            density += clamp01(sample.density) * weight;
          }
        } else {
          density = z01 <= terrainH ? 1 : 0;
        }

        if (density <= densityThreshold) {
          voxels[voxelIndex] = 0;
          continue;
        }

        const pick = pickWeightedIndex(blend.weights, hash3D(x, y, z, params.seed));
        const biomeIndex = blend.indices[pick] ?? 0;
        const biome = params.biomes[biomeIndex];
        if (!biome) {
          voxels[voxelIndex] = 0;
          continue;
        }

        // Extended context with surface info for gradient materials (video technique)
        const ctx = createMaterialContext(biome, params, terrainH, z, maxZ, depth);
        const mat = biome.materials(x, y, z01, ctx);
        voxels[voxelIndex] = Math.max(0, Math.floor(mat));
      }
    }
  }

  return { voxels, width, height, depth, heightmap, field };
}