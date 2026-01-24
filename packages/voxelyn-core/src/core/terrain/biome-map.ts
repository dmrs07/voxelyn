import { RNG } from "../rng.js";
import { 
  GradientNoise, 
  CellularNoise, 
  generateHeightMap as generateNoiseHeightMap,
  clamp01,
  smoothstep,
  type NoiseDetailConfig
} from "./noise.js";
import { generateShadowMap } from "./shadows.js";

// Re-export noise types for convenience
export type { NoiseDetailConfig } from "./noise.js";
export { GradientNoise, CellularNoise } from "./noise.js";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface BiomeShapeSample {
  /** Normalized height in range [0..1]. Used by height-based shaping. */
  height: number;
  /** Normalized density in range [0..1]. Used by density-based shaping. */
  density: number;
}

export interface BiomeShapeContext {
  size: readonly [number, number, number];
  seed: number;
  params?: Readonly<Record<string, number>>;
  biomeName: string;
}

/** RGBA color as [r, g, b, a] where each component is 0-255 */
export type RGBA = readonly [number, number, number, number];

/** Color gradient definition for terrain visualization */
export interface TerrainColorGradient {
  /** Minimum color (at lowest height of this terrain type) */
  minColor: RGBA;
  /** Maximum color (at highest height of this terrain type) */
  maxColor: RGBA;
}

export interface BiomeDefinition {
  /** Unique biome identifier (e.g. "forest", "desert"). */
  name: string;
  /** Climate requirements for this biome */
  climate?: {
    temperatureMin?: number;  // 0 = frozen, 1 = scorching
    temperatureMax?: number;
    moistureMin?: number;     // 0 = arid, 1 = tropical
    moistureMax?: number;
    elevationMin?: number;    // 0 = sea level, 1 = mountain peak
    elevationMax?: number;
  };
  /** Height threshold range [min, max] for this terrain type (0-1) */
  heightRange?: readonly [number, number];
  /** Color gradient for visualization */
  colorGradient?: TerrainColorGradient;
  /** Priority for biome selection (higher = preferred when multiple match) */
  priority?: number;
  /** Which biomes can be adjacent (empty = any) */
  allowedNeighbors?: string[];
  /** Optional shaping parameters (see LLM extension points). */
  params?: Record<string, number>;
  /**
   * Return shape information for a voxel at normalized coordinates.
   * - x, y are in [0..width-1], [0..height-1]
   * - z is normalized to [0..1]
   */
  shape: (x: number, y: number, z01: number, ctx: BiomeShapeContext) => BiomeShapeSample;
  /** Return material id for a voxel at normalized coordinates. */
  materials: (x: number, y: number, z01: number, ctx: BiomeShapeContext) => number;
}

export interface BiomeField {
  size: readonly [number, number];
  maxBiomesPerCell: number;
  biomes: readonly BiomeDefinition[];
  indices: Uint16Array;
  weights: Float32Array;
  /** Height map for the terrain (normalized 0-1) */
  heightMap: Float32Array;
  /** Climate data for debugging/visualization */
  climateMap: {
    temperature: Float32Array;
    moisture: Float32Array;
    elevation: Float32Array;
  };
  /** Shadow map (0 = shadow, 1 = lit) */
  shadowMap: Float32Array;
  sample: (x: number, y: number) => BiomeBlendSample;
  /** Get climate at position */
  getClimate: (x: number, y: number) => ClimateData;
  /** Get height at position (0-1) */
  getHeight: (x: number, y: number) => number;
  /** Get shadow at position (0-1) */
  getShadow: (x: number, y: number) => number;
  /** Get interpolated color at position */
  getColor: (x: number, y: number) => RGBA;
  /** Recalculate shadows with new light direction */
  updateShadows: (lightDir: { x: number; y: number }) => void;
}

export interface BiomeBlendSample {
  indices: number[];
  weights: number[];
}

export interface ClimateData {
  temperature: number;
  moisture: number;
  elevation: number;
}

export type BiomeFieldParams = {
  size: readonly [number, number];
  seed: number;
  biomes: readonly BiomeDefinition[];
  /** Zoom factor for noise sampling. Higher = smoother terrain. Default: 100 */
  zoomFactor?: number;
  /** Noise detail configuration */
  noiseDetail?: NoiseDetailConfig;
  /** Number of Voronoi sites (default: biomes.length * 3) */
  siteCount?: number;
  /** Max biomes blended per cell (default: 3) */
  maxBiomesPerCell?: number;
  /** Site position randomization (default: 0.4) */
  jitter?: number;
  /** Noise influence on distances (default: 0.3) */
  noiseScale?: number;
  /** Blend radius in cells (default: 12) */
  blendRadius?: number;
  /** Use climate-based biome selection (default: true) */
  useClimate?: boolean;
  /** Use height-threshold based terrain (like in the video). Default: false */
  useHeightThresholds?: boolean;
  /** Climate generation settings */
  climate?: {
    /** Temperature gradient direction: 'latitude' | 'radial' | 'noise' */
    temperatureMode?: 'latitude' | 'radial' | 'noise';
    /** Base temperature (0-1, default: 0.5) */
    baseTemperature?: number;
    /** Temperature variation amplitude (default: 0.4) */
    temperatureVariation?: number;
    /** Moisture noise scale (default: 0.02) */
    moistureScale?: number;
    /** Elevation noise scale (default: 0.015) */
    elevationScale?: number;
    /** Number of octaves for climate noise (default: 4) */
    octaves?: number;
  };
  /** River generation settings */
  rivers?: {
    enabled?: boolean;
    count?: number;
    width?: number;
    meanderScale?: number;
  };
  /** Shadow/lighting settings */
  shadows?: {
    enabled?: boolean;
    /** Light direction (normalized). Default: { x: -0.5, y: -0.5 } */
    lightDirection?: { x: number; y: number };
    /** Shadow intensity (0-1). Default: 0.4 */
    intensity?: number;
    /** Max shadow cast distance in cells. Default: 20 */
    maxDistance?: number;
  };
};

// ============================================================================
// COLOR UTILITIES (Biome-specific, prefixed to avoid conflicts with palette.js)
// ============================================================================

/** Linear interpolation between two colors (biome-specific) */
export const biomeLerpColor = (c1: RGBA, c2: RGBA, t: number): RGBA => {
  const clampT = Math.max(0, Math.min(1, t));
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * clampT),
    Math.round(c1[1] + (c2[1] - c1[1]) * clampT),
    Math.round(c1[2] + (c2[2] - c1[2]) * clampT),
    Math.round(c1[3] + (c2[3] - c1[3]) * clampT),
  ];
};

/** Apply shadow to a color (biome-specific) */
export const biomeApplyShadow = (color: RGBA, shadowValue: number, intensity: number = 0.4): RGBA => {
  const shadowFactor = 1 - (1 - shadowValue) * intensity;
  return [
    Math.round(color[0] * shadowFactor),
    Math.round(color[1] * shadowFactor),
    Math.round(color[2] * shadowFactor),
    color[3],
  ];
};

// ============================================================================
// HEIGHT THRESHOLD SELECTION
// ============================================================================

/**
 * Determine terrain type based on height thresholds (video technique)
 * Like checking: if height < 0.4 -> water, else if height < 0.5 -> sand, etc.
 */
function getTerrainTypeForHeight(
  height: number,
  biomes: readonly BiomeDefinition[]
): { biomeIndex: number; normalizedHeight: number } {
  // Find biome whose heightRange contains this height
  for (let i = 0; i < biomes.length; i++) {
    const biome = biomes[i]!;
    const range = biome.heightRange;
    if (range && height >= range[0] && height < range[1]) {
      // Calculate normalized height within this terrain type (for gradient)
      const normalizedHeight = (height - range[0]) / (range[1] - range[0]);
      return { biomeIndex: i, normalizedHeight };
    }
  }
  // Fallback to last biome (highest terrain)
  const lastBiome = biomes[biomes.length - 1];
  const range = lastBiome?.heightRange ?? [0.7, 1];
  const normalizedHeight = (height - range[0]) / (range[1] - range[0]);
  return { biomeIndex: biomes.length - 1, normalizedHeight: clamp01(normalizedHeight) };
}

// ============================================================================
// CLIMATE GENERATION
// ============================================================================

interface ClimateGenerator {
  temperature: Float32Array;
  moisture: Float32Array;
  elevation: Float32Array;
}

function generateClimateMap(
  width: number,
  height: number,
  seed: number,
  heightMap: Float32Array,
  params: NonNullable<BiomeFieldParams['climate']>
): ClimateGenerator {
  const noise = new GradientNoise(seed);
  
  const temperatureMode = params.temperatureMode ?? 'latitude';
  const baseTemperature = params.baseTemperature ?? 0.5;
  const temperatureVariation = params.temperatureVariation ?? 0.4;
  const moistureScale = params.moistureScale ?? 0.02;
  const octaves = params.octaves ?? 4;

  const cellCount = width * height;
  const temperature = new Float32Array(cellCount);
  const moisture = new Float32Array(cellCount);
  // Use the provided height map as elevation
  const elevation = new Float32Array(heightMap);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = x + y * width;
      const nx = x / width;
      const ny = y / height;
      const currentElevation = elevation[idx] ?? 0.5;

      // === TEMPERATURE ===
      let temp = baseTemperature;
      
      switch (temperatureMode) {
        case 'latitude':
          // Temperature decreases from equator (center) to poles (edges)
          { const latitudeFactor = 1 - Math.abs(ny - 0.5) * 2;
          temp = baseTemperature + latitudeFactor * temperatureVariation;
          break; }
        case 'radial':
          // Temperature decreases from center
          { const cx = nx - 0.5;
          const cy = ny - 0.5;
          const radialDist = Math.sqrt(cx * cx + cy * cy) * 1.41;
          temp = baseTemperature + (1 - radialDist) * temperatureVariation;
          break; }
        case 'noise':
          // Pure noise-based temperature
          temp = noise.fbm(x * 0.01, y * 0.01, octaves);
          break;
      }
      
      // Add noise variation
      temp += (noise.fbm(x * 0.03 + 100, y * 0.03 + 100, 3) - 0.5) * 0.2;
      
      // Elevation affects temperature (higher = colder)
      temp -= currentElevation * 0.3;
      
      temperature[idx] = clamp01(temp);

      // === MOISTURE ===
      // Base moisture from domain-warped noise
      let moist = noise.warped(x * moistureScale, y * moistureScale, 0.4, octaves);
      
      // Coastal moisture (edges are wetter if treating map as island)
      const edgeDist = Math.min(nx, 1 - nx, ny, 1 - ny) * 4;
      moist += (1 - smoothstep(clamp01(edgeDist))) * 0.3;
      
      // Rain shadow effect: higher elevation on one side blocks moisture
      const windDir = noise.sample(y * 0.001, seed) * 0.5 + 0.5;
      const upwindX = x - windDir * 20;
      if (upwindX > 0 && upwindX < width) {
        const upwindIdx = Math.floor(upwindX) + y * width;
        const upwindElev = elevation[upwindIdx] ?? 0;
        if (upwindElev > currentElevation + 0.1) {
          moist *= 0.7; // Rain shadow
        }
      }
      
      // Temperature affects moisture capacity
      moist *= 0.7 + temperature[idx]! * 0.3;
      
      moisture[idx] = clamp01(moist);
    }
  }

  return { temperature, moisture, elevation };
}

// ============================================================================
// RIVER GENERATION
// ============================================================================

interface River {
  path: Array<{ x: number; y: number }>;
  width: number;
}

function generateRivers(
  width: number,
  height: number,
  elevation: Float32Array,
  seed: number,
  params: NonNullable<BiomeFieldParams['rivers']>
): River[] {
  if (!params.enabled) return [];
  
  const rng = new RNG(seed + 5000);
  const rivers: River[] = [];
  const riverCount = params.count ?? 3;
  const riverWidth = params.width ?? 2;
  const meanderScale = params.meanderScale ?? 0.1;

  for (let r = 0; r < riverCount; r++) {
    // Start from high elevation
    let bestStart = { x: 0, y: 0, elev: 0 };
    for (let attempt = 0; attempt < 20; attempt++) {
      const sx = rng.nextInt(width);
      const sy = rng.nextInt(height);
      const elev = elevation[sx + sy * width] ?? 0;
      if (elev > bestStart.elev && elev > 0.6) {
        bestStart = { x: sx, y: sy, elev };
      }
    }

    const path: Array<{ x: number; y: number }> = [{ x: bestStart.x, y: bestStart.y }];
    let cx = bestStart.x;
    let cy = bestStart.y;
    const visited = new Set<number>();

    // Flow downhill with meandering
    for (let step = 0; step < 500; step++) {
      visited.add(cx + cy * width);
      
      let bestNext = { x: cx, y: cy, elev: 999 };
      const currentElev = elevation[cx + cy * width] ?? 0;

      // Check neighbors (including diagonals)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (visited.has(nx + ny * width)) continue;

          const neighborElev = elevation[nx + ny * width] ?? 0;
          // Add meander noise
          const meander = (rng.nextFloat01() - 0.5) * meanderScale;
          const score = neighborElev + meander;

          if (score < bestNext.elev) {
            bestNext = { x: nx, y: ny, elev: score };
          }
        }
      }

      if (bestNext.x === cx && bestNext.y === cy) break;
      if (currentElev < 0.1) break; // Reached sea level

      cx = bestNext.x;
      cy = bestNext.y;
      path.push({ x: cx, y: cy });
    }

    if (path.length > 10) {
      rivers.push({ path, width: riverWidth + rng.nextFloat01() });
    }
  }

  return rivers;
}

// ============================================================================
// BIOME SELECTION
// ============================================================================

function selectBiomeForClimate(
  temperature: number,
  moisture: number,
  elevation: number,
  biomes: readonly BiomeDefinition[],
  rng: RNG
): number {
  const candidates: Array<{ index: number; score: number }> = [];

  for (let i = 0; i < biomes.length; i++) {
    const biome = biomes[i]!;
    const climate = biome.climate;

    if (!climate) {
      // No climate requirements = always valid with base score
      candidates.push({ index: i, score: biome.priority ?? 1 });
      continue;
    }

    // Check if climate matches
    const tempMin = climate.temperatureMin ?? 0;
    const tempMax = climate.temperatureMax ?? 1;
    const moistMin = climate.moistureMin ?? 0;
    const moistMax = climate.moistureMax ?? 1;
    const elevMin = climate.elevationMin ?? 0;
    const elevMax = climate.elevationMax ?? 1;

    if (temperature < tempMin || temperature > tempMax) continue;
    if (moisture < moistMin || moisture > moistMax) continue;
    if (elevation < elevMin || elevation > elevMax) continue;

    // Calculate fitness score (how well it matches center of ranges)
    const tempFit = 1 - Math.abs(temperature - (tempMin + tempMax) / 2) / Math.max(0.01, (tempMax - tempMin) / 2);
    const moistFit = 1 - Math.abs(moisture - (moistMin + moistMax) / 2) / Math.max(0.01, (moistMax - moistMin) / 2);
    const elevFit = 1 - Math.abs(elevation - (elevMin + elevMax) / 2) / Math.max(0.01, (elevMax - elevMin) / 2);

    const score = (tempFit + moistFit + elevFit) / 3 * (biome.priority ?? 1);
    candidates.push({ index: i, score });
  }

  if (candidates.length === 0) {
    return 0; // Fallback to first biome
  }

  // Sort by score and pick with some randomness
  candidates.sort((a, b) => b.score - a.score);
  
  // Weighted random selection from top candidates
  const topCount = Math.min(3, candidates.length);
  let totalScore = 0;
  for (let i = 0; i < topCount; i++) {
    totalScore += candidates[i]!.score;
  }

  let pick = rng.nextFloat01() * totalScore;
  for (let i = 0; i < topCount; i++) {
    pick -= candidates[i]!.score;
    if (pick <= 0) {
      return candidates[i]!.index;
    }
  }

  return candidates[0]!.index;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

type BiomeSite = {
  x: number;
  y: number;
  biomeIndex: number;
};

export function generateBiomeField(params: BiomeFieldParams): BiomeField {
  const [width, height] = params.size;
  const rng = new RNG(params.seed);
  const biomes = params.biomes;
  const useClimate = params.useClimate ?? true;
  const useHeightThresholds = params.useHeightThresholds ?? false;
  const zoomFactor = params.zoomFactor ?? 100;
  const noiseDetail = params.noiseDetail ?? { octaves: 6, falloff: 0.5, lacunarity: 2 };
  const siteCount = params.siteCount ?? Math.max(biomes.length * 3, 8);
  const maxBiomesPerCell = Math.max(1, Math.min(4, params.maxBiomesPerCell ?? 3));
  const jitter = params.jitter ?? 0.4;
  const noiseScale = params.noiseScale ?? 0.3;
  const blendRadius = params.blendRadius ?? 12;

  // Generate height map first (the core technique from the video!)
  const heightMap = generateNoiseHeightMap(width, height, params.seed, zoomFactor, noiseDetail);

  // Generate climate maps (using height map as elevation base)
  const climateParams = params.climate ?? {};
  const climate = generateClimateMap(width, height, params.seed, heightMap, climateParams);

  // Generate shadows if enabled
  const shadowParams = params.shadows ?? { enabled: false };
  const shadowMap = new Float32Array(width * height);
  shadowMap.fill(1);
  
  if (shadowParams.enabled) {
    const lightDir = shadowParams.lightDirection ?? { x: -0.5, y: -0.5 };
    const maxDist = shadowParams.maxDistance ?? 20;
    const intensity = shadowParams.intensity ?? 0.4;
    const generated = generateShadowMap(width, height, heightMap, lightDir, maxDist, intensity);
    for (let i = 0; i < generated.length; i++) {
      shadowMap[i] = generated[i]!;
    }
  }

  // Generate rivers
  const riverParams = params.rivers ?? { enabled: false };
  const rivers = generateRivers(width, height, climate.elevation, params.seed, riverParams);

  // Create river mask
  const riverMask = new Float32Array(width * height);
  for (const river of rivers) {
    for (const point of river.path) {
      const r = Math.ceil(river.width);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const px = point.x + dx;
          const py = point.y + dy;
          if (px < 0 || px >= width || py < 0 || py >= height) continue;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= river.width) {
            const idx = px + py * width;
            riverMask[idx] = Math.max(riverMask[idx]!, 1 - dist / river.width);
          }
        }
      }
    }
  }

  // Allocate output arrays
  const cellCount = width * height;
  const indices = new Uint16Array(cellCount * maxBiomesPerCell);
  const weights = new Float32Array(cellCount * maxBiomesPerCell);

  // Height threshold mode (simple, like in the video)
  if (useHeightThresholds && biomes.some(b => b.heightRange)) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cellIndex = x + y * width;
        const h = heightMap[cellIndex] ?? 0.5;
        
        const { biomeIndex } = getTerrainTypeForHeight(h, biomes);
        
        // Set primary biome with full weight
        indices[cellIndex * maxBiomesPerCell] = biomeIndex;
        weights[cellIndex * maxBiomesPerCell] = 1;
        
        // Zero out other slots
        for (let i = 1; i < maxBiomesPerCell; i++) {
          indices[cellIndex * maxBiomesPerCell + i] = biomeIndex;
          weights[cellIndex * maxBiomesPerCell + i] = 0;
        }
        
        // Apply river influence
        const riverInfluence = riverMask[cellIndex] ?? 0;
        if (riverInfluence > 0.3) {
          const waterBiomeIdx = biomes.findIndex(b => 
            b.name.toLowerCase().includes('water') || 
            b.name.toLowerCase().includes('river')
          );
          if (waterBiomeIdx >= 0) {
            indices[cellIndex * maxBiomesPerCell] = waterBiomeIdx;
          }
        }
      }
    }
  } else {
    // Voronoi-based mode with climate selection
    const noise = new GradientNoise(params.seed + 100, noiseDetail);
    const sites: BiomeSite[] = [];
    const minDist = Math.max(width, height) / Math.sqrt(siteCount * 2);

    for (let attempt = 0; attempt < siteCount * 10 && sites.length < siteCount; attempt++) {
      const nx = rng.nextFloat01();
      const ny = rng.nextFloat01();
      
      const jx = (noise.sample(nx * 10, ny * 10) - 0.5) * jitter;
      const jy = (noise.sample(nx * 10 + 100, ny * 10 + 100) - 0.5) * jitter;
      const x = clamp01(nx + jx) * width;
      const y = clamp01(ny + jy) * height;

      let tooClose = false;
      for (const site of sites) {
        const dx = x - site.x;
        const dy = y - site.y;
        if (Math.sqrt(dx * dx + dy * dy) < minDist * 0.7) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const cellX = Math.floor(clamp01(x / width) * (width - 1));
      const cellY = Math.floor(clamp01(y / height) * (height - 1));
      const cellIdx = cellX + cellY * width;

      let biomeIndex: number;
      if (useClimate && biomes.some(b => b.climate)) {
        biomeIndex = selectBiomeForClimate(
          climate.temperature[cellIdx] ?? 0.5,
          climate.moisture[cellIdx] ?? 0.5,
          climate.elevation[cellIdx] ?? 0.5,
          biomes,
          rng
        );
      } else {
        biomeIndex = rng.nextInt(biomes.length);
      }

      sites.push({ x, y, biomeIndex });
    }

    // Ensure at least one site per biome
    for (let i = 0; i < biomes.length && sites.length < siteCount; i++) {
      const hasBiome = sites.some(s => s.biomeIndex === i);
      if (!hasBiome) {
        const x = rng.nextFloat01() * width;
        const y = rng.nextFloat01() * height;
        sites.push({ x, y, biomeIndex: i });
      }
    }

    // Calculate biome weights for each cell
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cellIndex = x + y * width;
        const riverInfluence = riverMask[cellIndex] ?? 0;
        
        const nearest: Array<{ d: number; biomeIndex: number }> = [];

        for (const site of sites) {
          const dx = x - site.x;
          const dy = y - site.y;
          const distNoise = noise.sample(x * 0.05, y * 0.05);
          const noiseOffset = (distNoise - 0.5) * noiseScale * blendRadius;
          const d = Math.sqrt(dx * dx + dy * dy) + noiseOffset;
          nearest.push({ d, biomeIndex: site.biomeIndex });
        }

        nearest.sort((a, b) => a.d - b.d);

        let weightSum = 0;
        for (let i = 0; i < maxBiomesPerCell; i++) {
          const entry = nearest[i] ?? nearest[0]!;
          const t = clamp01(1 - entry.d / Math.max(1, blendRadius));
          const w = smoothstep(t) * (1 - i * 0.2);
          indices[cellIndex * maxBiomesPerCell + i] = entry.biomeIndex;
          weights[cellIndex * maxBiomesPerCell + i] = Math.max(0.01, w);
          weightSum += w;
        }

        if (weightSum > 0) {
          for (let i = 0; i < maxBiomesPerCell; i++) {
            const offset = cellIndex * maxBiomesPerCell + i;
            const currentWeight = weights[offset] ?? 0;
            weights[offset] = currentWeight / weightSum;
          }
        }

        if (riverInfluence > 0.3) {
          const waterBiomeIdx = biomes.findIndex(b => 
            b.name.toLowerCase().includes('water') || 
            b.name.toLowerCase().includes('river') ||
            b.name.toLowerCase().includes('wetland')
          );
          if (waterBiomeIdx >= 0) {
            const waterWeight = riverInfluence * 0.8;
            for (let i = 0; i < maxBiomesPerCell; i++) {
              const offset = cellIndex * maxBiomesPerCell + i;
              weights[offset] = (weights[offset] ?? 0) * (1 - waterWeight);
            }
            weights[cellIndex * maxBiomesPerCell] = (weights[cellIndex * maxBiomesPerCell] ?? 0) + waterWeight;
            indices[cellIndex * maxBiomesPerCell] = waterBiomeIdx;
          }
        }
      }
    }
  }

  // Create the result object with methods
  const result: BiomeField = {
    size: params.size,
    maxBiomesPerCell,
    biomes,
    indices,
    weights,
    heightMap,
    climateMap: climate,
    shadowMap,

    sample: (x: number, y: number): BiomeBlendSample => {
      const cx = Math.max(0, Math.min(width - 1, Math.floor(x)));
      const cy = Math.max(0, Math.min(height - 1, Math.floor(y)));
      const cellIndex = cx + cy * width;
      const outIndices: number[] = [];
      const outWeights: number[] = [];

      for (let i = 0; i < maxBiomesPerCell; i++) {
        const offset = cellIndex * maxBiomesPerCell + i;
        outIndices.push(indices[offset] ?? 0);
        outWeights.push(weights[offset] ?? 0);
      }

      return { indices: outIndices, weights: outWeights };
    },

    getClimate: (x: number, y: number): ClimateData => {
      const cx = Math.max(0, Math.min(width - 1, Math.floor(x)));
      const cy = Math.max(0, Math.min(height - 1, Math.floor(y)));
      const idx = cx + cy * width;
      return {
        temperature: climate.temperature[idx] ?? 0.5,
        moisture: climate.moisture[idx] ?? 0.5,
        elevation: climate.elevation[idx] ?? 0.5,
      };
    },

    getHeight: (x: number, y: number): number => {
      const cx = Math.max(0, Math.min(width - 1, Math.floor(x)));
      const cy = Math.max(0, Math.min(height - 1, Math.floor(y)));
      return heightMap[cx + cy * width] ?? 0.5;
    },

    getShadow: (x: number, y: number): number => {
      const cx = Math.max(0, Math.min(width - 1, Math.floor(x)));
      const cy = Math.max(0, Math.min(height - 1, Math.floor(y)));
      return shadowMap[cx + cy * width] ?? 1;
    },

    getColor: (x: number, y: number): RGBA => {
      const cx = Math.max(0, Math.min(width - 1, Math.floor(x)));
      const cy = Math.max(0, Math.min(height - 1, Math.floor(y)));
      const cellIndex = cx + cy * width;
      const h = heightMap[cellIndex] ?? 0.5;
      const shadow = shadowMap[cellIndex] ?? 1;
      
      // Get biome and calculate gradient color
      const biomeIdx = indices[cellIndex * maxBiomesPerCell] ?? 0;
      const biome = biomes[biomeIdx];
      
      if (biome?.colorGradient) {
        const range = biome.heightRange ?? [0, 1];
        const normalizedH = clamp01((h - range[0]) / (range[1] - range[0]));
        const color = biomeLerpColor(biome.colorGradient.minColor, biome.colorGradient.maxColor, normalizedH);
        return biomeApplyShadow(color, shadow, shadowParams.intensity ?? 0.4);
      }
      
      // Fallback: grayscale based on height
      const gray = Math.round(h * 255 * shadow);
      return [gray, gray, gray, 255];
    },

    updateShadows: (lightDir: { x: number; y: number }): void => {
      const maxDist = shadowParams.maxDistance ?? 20;
      const intensity = shadowParams.intensity ?? 0.4;
      const newShadows = generateShadowMap(width, height, heightMap, lightDir, maxDist, intensity);
      for (let i = 0; i < newShadows.length; i++) {
        shadowMap[i] = newShadows[i]!;
      }
    },
  };

  return result;
}

// ============================================================================
// PRESET BIOME DEFINITIONS (with height thresholds like in the video)
// ============================================================================

/** Default colors for terrain types */
export const TERRAIN_COLORS = {
  deepWater:   [20, 50, 120, 255] as RGBA,
  shallowWater: [40, 90, 180, 255] as RGBA,
  wetSand:     [194, 178, 128, 255] as RGBA,
  drySand:     [230, 210, 160, 255] as RGBA,
  darkGrass:   [34, 139, 34, 255] as RGBA,
  lightGrass:  [124, 200, 80, 255] as RGBA,
  forest:      [34, 100, 34, 255] as RGBA,
  denseForest: [20, 60, 20, 255] as RGBA,
  rock:        [120, 120, 130, 255] as RGBA,
  snow:        [250, 250, 255, 255] as RGBA,
};

/** Create a simple shape function for flat terrain */
export const flatShape = (baseHeight: number = 0.3) => 
  (_x: number, _y: number, z01: number, _ctx: BiomeShapeContext): BiomeShapeSample => ({
    height: z01 < baseHeight ? 1 : 0,
    density: z01 < baseHeight ? 0.8 : 0,
  });

/** Create a hilly shape function */
export const hillyShape = (baseHeight: number = 0.3, hillScale: number = 0.05) => 
  (x: number, y: number, z01: number, ctx: BiomeShapeContext): BiomeShapeSample => {
    const noise = new GradientNoise(ctx.seed);
    const hillHeight = baseHeight + noise.fbm(x * hillScale, y * hillScale, 3) * 0.3;
    return {
      height: z01 < hillHeight ? 1 : 0,
      density: z01 < hillHeight ? 0.7 + noise.sample(x * 0.1, y * 0.1) * 0.3 : 0,
    };
  };

/** Create a mountainous shape function */
export const mountainShape = (baseHeight: number = 0.2, peakHeight: number = 0.9) => 
  (x: number, y: number, z01: number, ctx: BiomeShapeContext): BiomeShapeSample => {
    const noise = new GradientNoise(ctx.seed);
    const ridgeNoise = noise.ridged(x * 0.03, y * 0.03, 4);
    const mountainHeight = baseHeight + ridgeNoise * (peakHeight - baseHeight);
    return {
      height: z01 < mountainHeight ? 1 : 0,
      density: z01 < mountainHeight ? 0.9 : 0,
    };
  };

/** 
 * Default biomes with HEIGHT THRESHOLDS (like in the video!)
 * Use with useHeightThresholds: true
 */
export const HEIGHT_BASED_BIOMES: BiomeDefinition[] = [
  {
    name: 'deep_water',
    heightRange: [0, 0.3],
    colorGradient: { minColor: TERRAIN_COLORS.deepWater, maxColor: TERRAIN_COLORS.shallowWater },
    priority: 10,
    shape: flatShape(0.15),
    materials: () => 1,
  },
  {
    name: 'shallow_water',
    heightRange: [0.3, 0.4],
    colorGradient: { minColor: TERRAIN_COLORS.shallowWater, maxColor: [80, 140, 200, 255] },
    priority: 9,
    shape: flatShape(0.18),
    materials: () => 1,
  },
  {
    name: 'beach',
    heightRange: [0.4, 0.45],
    colorGradient: { minColor: TERRAIN_COLORS.wetSand, maxColor: TERRAIN_COLORS.drySand },
    priority: 8,
    shape: flatShape(0.22),
    materials: () => 2,
  },
  {
    name: 'grass',
    heightRange: [0.45, 0.6],
    colorGradient: { minColor: TERRAIN_COLORS.lightGrass, maxColor: TERRAIN_COLORS.darkGrass },
    priority: 5,
    shape: hillyShape(0.3, 0.04),
    materials: () => 3,
  },
  {
    name: 'forest',
    heightRange: [0.6, 0.75],
    colorGradient: { minColor: TERRAIN_COLORS.forest, maxColor: TERRAIN_COLORS.denseForest },
    priority: 6,
    shape: hillyShape(0.35, 0.03),
    materials: () => 4,
  },
  {
    name: 'mountain',
    heightRange: [0.75, 0.9],
    colorGradient: { minColor: [100, 100, 110, 255], maxColor: TERRAIN_COLORS.rock },
    priority: 7,
    shape: mountainShape(0.4, 0.85),
    materials: () => 8,
  },
  {
    name: 'snow_peak',
    heightRange: [0.9, 1.0],
    colorGradient: { minColor: [200, 200, 210, 255], maxColor: TERRAIN_COLORS.snow },
    priority: 8,
    shape: mountainShape(0.5, 0.95),
    materials: () => 7,
  },
];

/** Default biomes with CLIMATE requirements (more complex simulation) */
export const CLIMATE_BASED_BIOMES: BiomeDefinition[] = [
  {
    name: 'ocean',
    climate: { elevationMax: 0.2 },
    colorGradient: { minColor: TERRAIN_COLORS.deepWater, maxColor: TERRAIN_COLORS.shallowWater },
    priority: 10,
    shape: flatShape(0.15),
    materials: () => 1,
  },
  {
    name: 'beach',
    climate: { elevationMin: 0.18, elevationMax: 0.25, moistureMin: 0.3 },
    colorGradient: { minColor: TERRAIN_COLORS.wetSand, maxColor: TERRAIN_COLORS.drySand },
    priority: 8,
    shape: flatShape(0.22),
    materials: () => 2,
  },
  {
    name: 'desert',
    climate: { temperatureMin: 0.6, moistureMax: 0.25, elevationMin: 0.2, elevationMax: 0.5 },
    colorGradient: { minColor: [210, 180, 140, 255], maxColor: [240, 220, 180, 255] },
    priority: 5,
    shape: hillyShape(0.25, 0.02),
    materials: () => 2,
  },
  {
    name: 'grassland',
    climate: { temperatureMin: 0.3, temperatureMax: 0.7, moistureMin: 0.3, moistureMax: 0.6, elevationMin: 0.2, elevationMax: 0.5 },
    colorGradient: { minColor: TERRAIN_COLORS.lightGrass, maxColor: TERRAIN_COLORS.darkGrass },
    priority: 3,
    shape: hillyShape(0.3, 0.04),
    materials: () => 3,
  },
  {
    name: 'forest',
    climate: { temperatureMin: 0.25, temperatureMax: 0.65, moistureMin: 0.5, elevationMin: 0.2, elevationMax: 0.6 },
    colorGradient: { minColor: TERRAIN_COLORS.forest, maxColor: TERRAIN_COLORS.denseForest },
    priority: 4,
    shape: hillyShape(0.35, 0.03),
    materials: () => 4,
  },
  {
    name: 'taiga',
    climate: { temperatureMax: 0.35, moistureMin: 0.3, elevationMin: 0.25, elevationMax: 0.6 },
    colorGradient: { minColor: [60, 90, 60, 255], maxColor: [40, 70, 50, 255] },
    priority: 4,
    shape: hillyShape(0.3, 0.04),
    materials: () => 5,
  },
  {
    name: 'tundra',
    climate: { temperatureMax: 0.2, elevationMin: 0.15, elevationMax: 0.5 },
    colorGradient: { minColor: [180, 200, 190, 255], maxColor: [220, 230, 225, 255] },
    priority: 5,
    shape: flatShape(0.25),
    materials: () => 6,
  },
  {
    name: 'mountains',
    climate: { elevationMin: 0.55 },
    colorGradient: { minColor: [100, 100, 110, 255], maxColor: TERRAIN_COLORS.snow },
    priority: 7,
    shape: mountainShape(0.4, 0.95),
    materials: (x, y, z01, ctx) => {
      const noise = new GradientNoise(ctx.seed);
      if (z01 > 0.7 + noise.sample(x * 0.1, y * 0.1) * 0.1) return 7;
      return 8;
    },
  },
  {
    name: 'swamp',
    climate: { temperatureMin: 0.4, moistureMin: 0.7, elevationMin: 0.15, elevationMax: 0.3 },
    colorGradient: { minColor: [60, 80, 50, 255], maxColor: [80, 100, 60, 255] },
    priority: 6,
    shape: flatShape(0.2),
    materials: () => 9,
  },
];

/** Alias for backwards compatibility */
export const DEFAULT_BIOMES = CLIMATE_BASED_BIOMES;
