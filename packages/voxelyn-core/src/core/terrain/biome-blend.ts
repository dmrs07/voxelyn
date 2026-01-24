import type { BiomeBlendSample, BiomeField } from "./biome-map.js";

export type BiomeBlendParams = {
  /** Exponent applied to weights. Higher = sharper borders. */
  sharpness?: number;
  /** Minimum weight to consider a biome in the blend. */
  minWeight?: number;
};

const normalizeWeights = (weights: number[]): number[] => {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  if (sum <= 0) return weights.map(() => 0);
  return weights.map(w => w / sum);
};

export function sampleBiomeBlend(
  field: BiomeField,
  x: number,
  y: number,
  params: BiomeBlendParams = {}
): BiomeBlendSample {
  const sample = field.sample(x, y);
  const sharpness = params.sharpness ?? 1;
  const minWeight = params.minWeight ?? 0.01;

  const adjustedWeights = sample.weights.map(w => Math.pow(w, sharpness));
  const normalized = normalizeWeights(adjustedWeights).map(w => (w < minWeight ? 0 : w));
  const finalWeights = normalizeWeights(normalized);

  return {
    indices: sample.indices,
    weights: finalWeights,
  };
}

export function pickWeightedIndex(weights: number[], t: number): number {
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i] ?? 0;
    if (t <= acc) return i;
  }
  return Math.max(0, weights.length - 1);
}