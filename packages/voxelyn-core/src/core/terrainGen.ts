export type TerrainHeightCurvePoint = {
  x: number;
  y: number;
};

export type TerrainHeightCurveSpec = {
  id: string;
  points: TerrainHeightCurvePoint[];
};

export type TerrainBiomeSpec = {
  id: string;
  label: string;
  color: string;
  materialIds: string[];
  heightRange?: [number, number];
  moistureRange?: [number, number];
};

export type TerrainNoiseSpec = {
  baseFrequency: number;
  octaves: number;
  lacunarity: number;
  gain: number;
  warp: number;
  detailStrength: number;
};

export type TerrainLayerSpec = {
  id: string;
  biomeId: string;
  materialId: string;
  minHeight: number;
  maxHeight: number;
  slopeLimit?: number;
};

export type TerrainImageRefs = {
  heightmap?: string;
  biomeMask?: string;
  detailNoise?: string;
};

export type TerrainGenSpec = {
  version: 1;
  name?: string;
  size: {
    width: number;
    height: number;
  };
  seed?: number;
  biomes: TerrainBiomeSpec[];
  noise: TerrainNoiseSpec;
  heightCurves: TerrainHeightCurveSpec[];
  layers: TerrainLayerSpec[];
  images?: TerrainImageRefs;
};

export type TerrainConditioning = {
  width: number;
  height: number;
  heightMap: Float32Array;
  biomeMask: Uint8Array;
  detailNoise: Float32Array;
};

export type TerrainGenResult = {
  width: number;
  height: number;
  heightMap: Float32Array;
  biomeMask: Uint8Array;
  detailNoise: Float32Array;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const hash2d = (x: number, y: number, seed: number) => {
  let n = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 14466521;
  n = (n ^ (n >> 13)) * 1274126177;
  n = (n ^ (n >> 16)) >>> 0;
  return n / 0xffffffff;
};

const resampleFloat = (
  src: Float32Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
) => {
  const out = new Float32Array(dstW * dstH);
  for (let y = 0; y < dstH; y += 1) {
    const sy = Math.min(srcH - 1, Math.floor((y / dstH) * srcH));
    for (let x = 0; x < dstW; x += 1) {
      const sx = Math.min(srcW - 1, Math.floor((x / dstW) * srcW));
      out[y * dstW + x] = src[sy * srcW + sx] ?? 0;
    }
  }
  return out;
};

const resampleMask = (
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
) => {
  const out = new Uint8Array(dstW * dstH);
  for (let y = 0; y < dstH; y += 1) {
    const sy = Math.min(srcH - 1, Math.floor((y / dstH) * srcH));
    for (let x = 0; x < dstW; x += 1) {
      const sx = Math.min(srcW - 1, Math.floor((x / dstW) * srcW));
      out[y * dstW + x] = src[sy * srcW + sx] ?? 0;
    }
  }
  return out;
};

const buildNoiseMap = (spec: TerrainGenSpec) => {
  const { width, height } = spec.size;
  const data = new Float32Array(width * height);
  const seed = spec.seed ?? 0;
  const { baseFrequency, octaves, lacunarity, gain } = spec.noise;
  let totalAmplitude = 0;
  let amplitude = 1;
  for (let octave = 0; octave < octaves; octave += 1) {
    totalAmplitude += amplitude;
    amplitude *= gain;
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 0;
      let frequency = baseFrequency;
      amplitude = 1;
      for (let octave = 0; octave < octaves; octave += 1) {
        const sampleX = Math.floor(x * frequency);
        const sampleY = Math.floor(y * frequency);
        const n = hash2d(sampleX, sampleY, seed + octave * 1013);
        value += (n * 2 - 1) * amplitude;
        amplitude *= gain;
        frequency *= lacunarity;
      }
      value = (value / totalAmplitude + 1) * 0.5;
      data[y * width + x] = clamp01(value);
    }
  }
  return data;
};

const buildDetailNoise = (spec: TerrainGenSpec) => {
  const { width, height } = spec.size;
  const data = new Float32Array(width * height);
  const seed = (spec.seed ?? 0) + 7919;
  const { detailStrength } = spec.noise;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const n = hash2d(x * 3, y * 3, seed);
      data[y * width + x] = (n * 2 - 1) * detailStrength;
    }
  }
  return data;
};

const buildBiomeMask = (spec: TerrainGenSpec, heightMap: Float32Array) => {
  const { width, height } = spec.size;
  const mask = new Uint8Array(width * height);
  const biomes = spec.biomes;
  for (let i = 0; i < heightMap.length; i += 1) {
    const value = heightMap[i] ?? 0;
    let biomeIndex = 0;
    for (let b = 0; b < biomes.length; b += 1) {
      const biome = biomes[b];
      if (!biome?.heightRange) continue;
      const [min, max] = biome.heightRange;
      if (value >= min && value <= max) {
        biomeIndex = b;
        break;
      }
    }
    if (biomes.length > 0 && biomeIndex === 0) {
      biomeIndex = Math.min(biomes.length - 1, Math.floor(value * biomes.length));
    }
    mask[i] = biomeIndex;
  }
  return mask;
};

export const generateTerrainFromSpec = (
  spec: TerrainGenSpec,
  conditioning?: TerrainConditioning
): TerrainGenResult => {
  const { width, height } = spec.size;
  const heightMap = conditioning
    ? resampleFloat(conditioning.heightMap, conditioning.width, conditioning.height, width, height)
    : buildNoiseMap(spec);
  const biomeMask = conditioning
    ? resampleMask(conditioning.biomeMask, conditioning.width, conditioning.height, width, height)
    : buildBiomeMask(spec, heightMap);
  const detailNoise = conditioning
    ? resampleFloat(conditioning.detailNoise, conditioning.width, conditioning.height, width, height)
    : buildDetailNoise(spec);

  return {
    width,
    height,
    heightMap,
    biomeMask,
    detailNoise,
  };
};
