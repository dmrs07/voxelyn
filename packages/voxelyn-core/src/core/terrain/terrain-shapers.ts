import type { BiomeDefinition, BiomeField, BiomeFieldParams } from "./biome-map.js";
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
  mode?: "height" | "density";
};

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
 * Biome-first terrain generation pipeline.
 *
 * Key params for LLM shaping:
 * - BiomeDefinition.params: author custom "biome shaping" knobs (e.g. ridgeHeight, duneScale).
 * - fieldParams: Voronoi/Noise layout controls (siteCount, jitter, noiseScale, blendRadius).
 * - blendParams: blending sharpness + minWeight.
 * - mode: "height" (default) or "density" for 3D cave-like shapes.
 */
export function buildBiomeFirstTerrain(params: BiomeFirstTerrainParams): BiomeFirstTerrainResult {
  const [width, height, depth] = params.size;
  const mode = params.mode ?? "height";
  const densityThreshold = params.densityThreshold ?? 0.5;

  const field = generateBiomeField({
    size: [width, height],
    seed: params.seed,
    biomes: params.biomes,
    ...params.fieldParams,
  });

  const voxels = new Uint16Array(width * height * depth);
  const heightmap = new Float32Array(width * height);

  const biomeContext = (biome: BiomeDefinition) => ({
    size: [width, height, depth] as const,
    seed: params.seed,
    params: biome.params,
    biomeName: biome.name,
  });

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

      heightmap[x + y * width] = clamp01(blendedHeight);

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
          density = z01 <= blendedHeight ? 1 : 0;
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

        const mat = biome.materials(x, y, z01, biomeContext(biome));
        voxels[voxelIndex] = Math.max(0, Math.floor(mat));
      }
    }
  }

  return { voxels, width, height, depth, heightmap, field };
}