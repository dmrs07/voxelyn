/**
 * @voxelyn/ai - Enhanced Scenario Terrain Generator
 *
 * Integrates with @voxelyn/core's advanced procedural generation:
 * - GradientNoise with zoom factor, octaves, fBm
 * - Height thresholds for terrain types (video technique)
 * - Raycast shadows for depth
 * - Surface/subsurface material selection
 * - Biome blending
 */

import {
  GradientNoise,
  CellularNoise,
  generateShadowMap,
  generateAmbientOcclusion,
  combineLighting,
  type NoiseDetailConfig,
  type LightDirection,
} from '@voxelyn/core';

import type { BiomeRegion, BiomeType, HeightmapParams } from '../types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Enhanced heightmap params using @voxelyn/core features
 */
export type EnhancedHeightmapParams = HeightmapParams & {
  /** Zoom factor for noise (higher = smoother terrain). Default: 100 */
  zoomFactor?: number;
  /** Noise detail config */
  noiseDetail?: NoiseDetailConfig;
  /** Use ridged noise for mountains */
  ridgedMountains?: boolean;
  /** Use domain warping for organic look */
  domainWarping?: boolean;
  /** Warp scale if using domain warping */
  warpScale?: number;
};

/**
 * Terrain layer definition (video technique)
 * Like: water < 0.4, sand < 0.5, grass < 0.7, trees >= 0.7
 */
export type TerrainLayer = {
  /** Height threshold (0-1). Terrain applies when height < maxHeight */
  maxHeight: number;
  /** Surface material ID */
  surfaceMaterial: number;
  /** Underground material ID */
  undergroundMaterial: number;
  /** Optional subsurface material (between surface and underground) */
  subsurfaceMaterial?: number;
  /** Surface depth (how many voxels of surface material) */
  surfaceDepth?: number;
  /** Biome type for feature placement */
  biomeType?: BiomeType;
};

/**
 * Shadow/lighting configuration
 */
export type TerrainLightingParams = {
  /** Enable shadows */
  enabled: boolean;
  /** Light direction (normalized) */
  lightDirection: { x: number; y: number };
  /** Shadow intensity (0-1) */
  intensity: number;
  /** Max shadow cast distance */
  maxDistance: number;
  /** Enable ambient occlusion */
  ambientOcclusion?: boolean;
  /** AO radius */
  aoRadius?: number;
};

/**
 * Result from enhanced terrain generation
 */
export type EnhancedTerrainResult = {
  /** 3D terrain voxels */
  terrain: Uint16Array;
  /** 2D heightmap (0-1) */
  heightmap: Float32Array;
  /** Shadow/lighting map (0-1, 0=shadow, 1=lit) */
  lightingMap: Float32Array;
  /** Biome index per cell */
  biomeMap: Uint8Array;
  /** Width */
  width: number;
  /** Height (Y dimension) */
  height: number;
  /** Depth (Z dimension) */
  depth: number;
  /** Materials used */
  materials: Set<number>;
};

// ============================================================================
// DEFAULT TERRAIN LAYERS (Video technique: height thresholds)
// ============================================================================

/**
 * Default terrain layers based on height
 * Inspired by video: water < 0.4, sand < 0.5, grass < 0.7, mountains >= 0.7
 */
export const DEFAULT_TERRAIN_LAYERS: TerrainLayer[] = [
  {
    maxHeight: 0.35,
    surfaceMaterial: 4,  // water
    undergroundMaterial: 3, // sand
    biomeType: 'ocean',
    surfaceDepth: 1,
  },
  {
    maxHeight: 0.42,
    surfaceMaterial: 3,  // sand (beach)
    undergroundMaterial: 3,
    biomeType: 'desert',
    surfaceDepth: 3,
  },
  {
    maxHeight: 0.55,
    surfaceMaterial: 7,  // grass
    undergroundMaterial: 2, // dirt
    subsurfaceMaterial: 2,
    biomeType: 'plains',
    surfaceDepth: 1,
  },
  {
    maxHeight: 0.70,
    surfaceMaterial: 7,  // grass (forest)
    undergroundMaterial: 2,
    subsurfaceMaterial: 2,
    biomeType: 'forest',
    surfaceDepth: 1,
  },
  {
    maxHeight: 0.85,
    surfaceMaterial: 1,  // stone (mountain)
    undergroundMaterial: 1,
    biomeType: 'mountains',
    surfaceDepth: 2,
  },
  {
    maxHeight: 1.0,
    surfaceMaterial: 9,  // snow (peak)
    undergroundMaterial: 1,
    biomeType: 'tundra',
    surfaceDepth: 2,
  },
];

// ============================================================================
// ENHANCED HEIGHTMAP GENERATION
// ============================================================================

/**
 * Generate heightmap using @voxelyn/core's advanced noise
 * Implements the video technique: zoom factor + octaves for smooth terrain
 */
export function generateEnhancedHeightmap(
  width: number,
  height: number,
  params: EnhancedHeightmapParams
): Float32Array {
  const heightmap = new Float32Array(width * height);
  
  const zoomFactor = params.zoomFactor ?? 100;
  const noiseDetail: NoiseDetailConfig = params.noiseDetail ?? {
    octaves: params.octaves,
    falloff: params.persistence,
    lacunarity: 2,
  };

  const noise = new GradientNoise(params.seed, noiseDetail);
  
  // Secondary noise for ridged mountains
  const ridgedNoise = params.ridgedMountains
    ? new GradientNoise(params.seed + 1000, { octaves: 4, falloff: 0.5, lacunarity: 2 })
    : null;

  // Cellular noise for variation
  const cellNoise = new CellularNoise(params.seed + 2000);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = x + y * width;
      
      // Base height using zoom factor (video technique)
      let h: number;
      
      if (params.domainWarping) {
        // Organic warped terrain
        h = noise.warped(x / zoomFactor, y / zoomFactor, params.warpScale ?? 0.5);
      } else {
        // Standard fBm with zoom
        h = noise.sampleZoomed(x, y, zoomFactor);
      }

      // Add ridged mountains in high areas
      if (ridgedNoise && h > 0.6) {
        const ridged = ridgedNoise.ridged(x / (zoomFactor * 0.5), y / (zoomFactor * 0.5));
        const blend = (h - 0.6) / 0.4; // 0 at h=0.6, 1 at h=1.0
        h = h + ridged * blend * 0.2;
      }

      // Add cellular variation for rocky areas
      if (h > 0.65) {
        const cell = cellNoise.sample(x / 20, y / 20);
        h = h + (cell.f2 - cell.f1) * 0.05;
      }

      // Apply base elevation and amplitude
      h = params.baseElevation + (h - 0.5) * params.amplitude * 2;
      
      heightmap[idx] = Math.max(0, Math.min(1, h));
    }
  }

  return heightmap;
}

// ============================================================================
// TERRAIN LAYER SELECTION (Video technique: height thresholds)
// ============================================================================

/**
 * Get terrain layer for a given height
 * Like video: if height < 0.4 -> water, else if height < 0.5 -> sand, etc.
 */
export function getTerrainLayerForHeight(
  height: number,
  layers: TerrainLayer[] = DEFAULT_TERRAIN_LAYERS
): TerrainLayer {
  for (const layer of layers) {
    if (height < layer.maxHeight) {
      return layer;
    }
  }
  return layers[layers.length - 1]!;
}

/**
 * Get material for a specific depth from surface
 * Implements surface/subsurface/underground gradient (video technique)
 */
export function getMaterialAtDepth(
  layer: TerrainLayer,
  depthFromSurface: number,
  x: number,
  y: number,
  seed: number
): number {
  const surfaceDepth = layer.surfaceDepth ?? 1;
  
  // Surface layer
  if (depthFromSurface < surfaceDepth) {
    return layer.surfaceMaterial;
  }
  
  // Subsurface layer (if defined)
  if (layer.subsurfaceMaterial !== undefined && depthFromSurface < surfaceDepth + 3) {
    return layer.subsurfaceMaterial;
  }
  
  // Underground with some noise variation
  const noiseVal = hashNoise(x, y, depthFromSurface, seed);
  if (noiseVal > 0.9 && depthFromSurface > 5) {
    return 1; // Random stone in deep underground
  }
  
  return layer.undergroundMaterial;
}

// Simple hash noise for variation
function hashNoise(x: number, y: number, z: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) ^ seed;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 0xffffffff;
}

// ============================================================================
// BIOME MAP GENERATION
// ============================================================================

/**
 * Generate biome map from heightmap using terrain layers
 */
export function generateBiomeMap(
  width: number,
  height: number,
  heightmap: Float32Array,
  layers: TerrainLayer[] = DEFAULT_TERRAIN_LAYERS
): Uint8Array {
  const biomeMap = new Uint8Array(width * height);
  
  for (let i = 0; i < width * height; i++) {
    const h = heightmap[i]!;
    const layer = getTerrainLayerForHeight(h, layers);
    // Find layer index
    const layerIdx = layers.indexOf(layer);
    biomeMap[i] = layerIdx;
  }
  
  return biomeMap;
}

// ============================================================================
// MAIN TERRAIN GENERATOR
// ============================================================================

/**
 * Build enhanced terrain using @voxelyn/core features
 * 
 * Features:
 * - Smooth noise with zoom factor (video technique)
 * - Height threshold terrain types (water < sand < grass < forest < mountain < snow)
 * - Surface/subsurface/underground material layers
 * - Raycast shadows for depth perception
 * - Optional ambient occlusion
 */
export function buildEnhancedTerrain(
  width: number,
  height: number,
  depth: number,
  heightParams: EnhancedHeightmapParams,
  layers: TerrainLayer[] = DEFAULT_TERRAIN_LAYERS,
  lighting?: TerrainLightingParams
): EnhancedTerrainResult {
  const terrain = new Uint16Array(width * height * depth);
  const materials = new Set<number>();

  // Generate heightmap with advanced noise
  const heightmap = generateEnhancedHeightmap(width, height, heightParams);

  // Generate biome map
  const biomeMap = generateBiomeMap(width, height, heightmap, layers);

  // Fill terrain voxels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx2d = x + y * width;
      const h = heightmap[idx2d]!;
      const maxZ = Math.floor(h * (depth - 1));
      
      // Get terrain layer for this height
      const layer = getTerrainLayerForHeight(h, layers);

      // Fill column with appropriate materials
      for (let z = 0; z <= maxZ; z++) {
        const idx3d = x + y * width + z * width * height;
        const depthFromSurface = maxZ - z;
        
        const mat = getMaterialAtDepth(layer, depthFromSurface, x, y, heightParams.seed);
        terrain[idx3d] = mat;
        materials.add(mat);
      }

      // Handle water - fill up to water level if this is a water biome
      if (layer.biomeType === 'ocean' || layer.biomeType === 'river' || layer.biomeType === 'lake') {
        const waterLevel = Math.floor(0.38 * (depth - 1)); // Just above ocean maxHeight
        for (let z = maxZ + 1; z <= waterLevel; z++) {
          const idx3d = x + y * width + z * width * height;
          terrain[idx3d] = 4; // water
          materials.add(4);
        }
      }
    }
  }

  // Generate lighting map
  const lightingMap = new Float32Array(width * height);
  lightingMap.fill(1); // Default fully lit

  if (lighting?.enabled) {
    // Generate shadow map using @voxelyn/core
    const lightDir: LightDirection = lighting.lightDirection;
    
    const shadowMap = generateShadowMap(
      width, 
      height, 
      heightmap, 
      lightDir,
      lighting.maxDistance,
      lighting.intensity
    );
    
    // Optionally add ambient occlusion
    if (lighting.ambientOcclusion) {
      const aoMap = generateAmbientOcclusion(width, height, heightmap, lighting.aoRadius ?? 3);
      // Copy results to avoid ArrayBuffer type issues
      const combined = combineLighting(shadowMap, aoMap, 0.7, 0.3);
      lightingMap.set(combined);
    } else {
      lightingMap.set(shadowMap);
    }
  }

  return {
    terrain,
    heightmap,
    lightingMap,
    biomeMap,
    width,
    height,
    depth,
    materials,
  };
}

// ============================================================================
// BIOME REGION INTEGRATION
// ============================================================================

/**
 * Convert AI BiomeRegion to terrain layers
 * Allows AI to define custom terrain types that map to height thresholds
 */
export function biomeRegionsToTerrainLayers(
  regions: BiomeRegion[],
  materialMapping: Record<string, number>
): TerrainLayer[] {
  // Sort regions by elevation
  const sorted = [...regions].sort((a, b) => a.elevation - b.elevation);
  
  return sorted.map((region, idx) => {
    const nextElevation = sorted[idx + 1]?.elevation ?? 1.0;
    const maxHeight = region.elevation + (nextElevation - region.elevation) / 2;
    
    return {
      maxHeight: Math.min(1.0, maxHeight + region.elevationVariation),
      surfaceMaterial: materialMapping[region.surfaceMaterial] ?? 1,
      undergroundMaterial: materialMapping[region.undergroundMaterial] ?? 2,
      biomeType: region.type,
      surfaceDepth: 1,
    };
  });
}

// ============================================================================
// EXPORTS FOR SCENARIO-GEN INTEGRATION
// ============================================================================

export {
  GradientNoise,
  CellularNoise,
  generateShadowMap,
  generateAmbientOcclusion,
  combineLighting,
};
