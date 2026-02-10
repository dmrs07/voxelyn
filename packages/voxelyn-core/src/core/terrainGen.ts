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

const sampleCurve = (points: TerrainHeightCurvePoint[], value: number): number => {
  if (points.length === 0) return clamp01(value);
  if (points.length === 1) return clamp01(points[0]?.y ?? value);

  if (value <= (points[0]?.x ?? 0)) {
    return clamp01(points[0]?.y ?? value);
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i];
    const p1 = points[i + 1];
    if (!p0 || !p1) continue;
    if (value >= p0.x && value <= p1.x) {
      const span = p1.x - p0.x;
      if (span === 0) return clamp01(p1.y);
      const t = (value - p0.x) / span;
      return clamp01(p0.y + (p1.y - p0.y) * t);
    }
  }

  return clamp01(points[points.length - 1]?.y ?? value);
};

const applyHeightCurves = (spec: TerrainGenSpec, source: Float32Array): Float32Array => {
  if (!spec.heightCurves.length) return source;
  const curves = spec.heightCurves.map((curve) => [...curve.points].sort((a, b) => a.x - b.x));
  const out = new Float32Array(source.length);

  for (let i = 0; i < source.length; i += 1) {
    let value = source[i] ?? 0;
    for (const points of curves) {
      value = sampleCurve(points, value);
    }
    out[i] = clamp01(value);
  }

  return out;
};

const buildNoiseMap = (spec: TerrainGenSpec) => {
  const { width, height } = spec.size;
  const data = new Float32Array(width * height);
  const seed = spec.seed ?? 0;
  const { baseFrequency, octaves, lacunarity, gain, warp } = spec.noise;
  let totalAmplitude = 0;
  let amplitude = 1;
  for (let octave = 0; octave < octaves; octave += 1) {
    totalAmplitude += amplitude;
    amplitude *= gain;
  }
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      let value = 0;
      let frequency = baseFrequency;
      amplitude = 1;
      for (let octave = 0; octave < octaves; octave += 1) {
        let sampleXf = x * frequency;
        let sampleYf = y * frequency;
        if (warp > 0) {
          const warpX = (hash2d((x + octave * 17) | 0, (y + octave * 31) | 0, seed + 3001) * 2 - 1) * warp;
          const warpY = (hash2d((x + octave * 53) | 0, (y + octave * 71) | 0, seed + 5003) * 2 - 1) * warp;
          sampleXf += warpX * frequency * 12;
          sampleYf += warpY * frequency * 12;
        }
        const sampleX = Math.floor(sampleXf);
        const sampleY = Math.floor(sampleYf);
        const n = hash2d(sampleX, sampleY, seed + octave * 1013);
        value += (n * 2 - 1) * amplitude;
        amplitude *= gain;
        frequency *= lacunarity;
      }
      value = (value / totalAmplitude + 1) * 0.5;
      data[row + x] = clamp01(value);
    }
  }
  return applyHeightCurves(spec, data);
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
  const biomeById = new Map<string, number>();
  for (let i = 0; i < biomes.length; i += 1) {
    const biome = biomes[i];
    if (biome?.id) {
      biomeById.set(biome.id, i);
    }
  }

  for (let i = 0; i < heightMap.length; i += 1) {
    const value = heightMap[i] ?? 0;

    // Layer-first mapping: if a layer matches this height, use its biomeId.
    let layerMappedBiome: number | undefined;
    for (const layer of spec.layers) {
      if (value >= layer.minHeight && value <= layer.maxHeight) {
        const idx = biomeById.get(layer.biomeId);
        if (idx !== undefined) {
          layerMappedBiome = idx;
          break;
        }
      }
    }
    if (layerMappedBiome !== undefined) {
      mask[i] = layerMappedBiome;
      continue;
    }

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
