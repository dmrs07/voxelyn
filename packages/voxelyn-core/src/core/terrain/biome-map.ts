import { RNG } from "../rng.js";

export interface BiomeShapeSample {
  /**
   * Normalized height in range [0..1]. Used by height-based shaping.
   */
  height: number;
  /**
   * Normalized density in range [0..1]. Used by density-based shaping.
   */
  density: number;
}

export interface BiomeShapeContext {
  size: readonly [number, number, number];
  seed: number;
  params?: Readonly<Record<string, number>>;
  biomeName: string;
}

export interface BiomeDefinition {
  /** Unique biome identifier (e.g. "forest", "desert"). */
  name: string;
  /** Optional shaping parameters (see LLM extension points). */
  params?: Record<string, number>;
  /**
   * Return shape information for a voxel at normalized coordinates.
   * - $x, y$ are in [0..width-1], [0..height-1]
   * - $z$ is normalized to [0..1]
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
  sample: (x: number, y: number) => BiomeBlendSample;
}

export interface BiomeBlendSample {
  indices: number[];
  weights: number[];
}

export type BiomeFieldParams = {
  size: readonly [number, number];
  seed: number;
  biomes: readonly BiomeDefinition[];
  siteCount?: number;
  maxBiomesPerCell?: number;
  jitter?: number;
  noiseScale?: number;
  blendRadius?: number;
};

type BiomeSite = {
  x: number;
  y: number;
  biomeIndex: number;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const hash2D = (x: number, y: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263) ^ seed;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 0xffffffff;
};

export function generateBiomeField(params: BiomeFieldParams): BiomeField {
  const [width, height] = params.size;
  const rng = new RNG(params.seed);
  const biomes = params.biomes;
  const siteCount = params.siteCount ?? Math.max(1, biomes.length);
  const maxBiomesPerCell = Math.max(1, Math.min(4, params.maxBiomesPerCell ?? 2));
  const jitter = params.jitter ?? 0.35;
  const noiseScale = params.noiseScale ?? 0.4;
  const blendRadius = params.blendRadius ?? 8;

  const sites: BiomeSite[] = [];
  for (let i = 0; i < siteCount; i++) {
    const biomeIndex = biomes.length === 1 ? 0 : rng.nextInt(biomes.length);
    const nx = rng.nextFloat01();
    const ny = rng.nextFloat01();
    const jx = (hash2D(i, biomeIndex, params.seed) - 0.5) * jitter;
    const jy = (hash2D(biomeIndex, i, params.seed) - 0.5) * jitter;
    sites.push({
      x: (nx + jx) * width,
      y: (ny + jy) * height,
      biomeIndex,
    });
  }

  const cellCount = width * height;
  const indices = new Uint16Array(cellCount * maxBiomesPerCell);
  const weights = new Float32Array(cellCount * maxBiomesPerCell);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cellIndex = x + y * width;
      const nearest: { d: number; biomeIndex: number }[] = [];

      for (const site of sites) {
        const dx = x - site.x;
        const dy = y - site.y;
        const noise = (hash2D(x, y, params.seed) - 0.5) * noiseScale;
        const d = Math.sqrt(dx * dx + dy * dy) * (1 + noise);
        nearest.push({ d, biomeIndex: site.biomeIndex });
      }

      nearest.sort((a, b) => a.d - b.d);
      let weightSum = 0;

      for (let i = 0; i < maxBiomesPerCell; i++) {
        const entry = nearest[i] ?? nearest[0]!;
        const t = clamp01(1 - entry.d / Math.max(1, blendRadius));
        const w = 0.2 + t * 0.8;
        indices[cellIndex * maxBiomesPerCell + i] = entry.biomeIndex;
        weights[cellIndex * maxBiomesPerCell + i] = w;
        weightSum += w;
      }

      if (weightSum > 0) {
        for (let i = 0; i < maxBiomesPerCell; i++) {
          const offset = cellIndex * maxBiomesPerCell + i;
          weights[offset] = weights[offset] / weightSum;
        }
      }
    }
  }

  return {
    size: params.size,
    maxBiomesPerCell,
    biomes,
    indices,
    weights,
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
  };
}