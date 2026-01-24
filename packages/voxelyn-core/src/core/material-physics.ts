export type ReactionRule = {
  minTemperature?: number;
  maxTemperature?: number;
  minPressure?: number;
  maxPressure?: number;
  resultMaterialId: number;
  /** 0..1 deterministic rate (uses seeded hash in step). */
  rate?: number;
};

export type MaterialPhysicsPreset = {
  id: number;
  name: string;
  thermalErosionRate: number;
  thermalSlopeThreshold: number;
  hydraulicErosionRate: number;
  sedimentCapacity: number;
  depositionRate: number;
  sedimentationRate: number;
  sedimentationSlope: number;
  thermalDiffusion: number;
  reactionRules?: ReactionRule[];
};

export type MaterialPhysicsGlobals = {
  /** Global multiplier for erosion intensity. */
  erosionScale?: number;
  /** Global multiplier for sedimentation intensity. */
  sedimentScale?: number;
  /** Global multiplier for diffusion intensity. */
  diffusionScale?: number;
};

export type MaterialPhysicsStepParams = {
  width: number;
  height: number;
  step: number;
  seed: number;
  heightmap: Float32Array;
  materials: Uint16Array;
  water: Float32Array;
  sediment: Float32Array;
  temperature: Float32Array;
  pressure: Float32Array;
  presets: Record<number, MaterialPhysicsPreset>;
  globals?: MaterialPhysicsGlobals;
};

const hash2D = (x: number, y: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263) ^ seed;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 0xffffffff;
};

const getIndex = (x: number, y: number, width: number): number => x + y * width;

const getPreset = (
  materialId: number,
  presets: Record<number, MaterialPhysicsPreset>
): MaterialPhysicsPreset | undefined => presets[materialId];

/**
 * Thermal erosion (talus-based) for heightmaps.
 * Params: thermalErosionRate, thermalSlopeThreshold.
 */
export function applyThermalErosion(params: MaterialPhysicsStepParams): void {
  const { width, height, heightmap, materials, presets } = params;
  const erosionScale = params.globals?.erosionScale ?? 1;
  const delta = new Float32Array(heightmap.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = getIndex(x, y, width);
      const preset = getPreset(materials[idx] ?? 0, presets);
      if (!preset) continue;

      const h = heightmap[idx] ?? 0;
      const neighbors = [
        getIndex(x + 1, y, width),
        getIndex(x - 1, y, width),
        getIndex(x, y + 1, width),
        getIndex(x, y - 1, width),
      ];

      for (const nIdx of neighbors) {
        const nh = heightmap[nIdx] ?? 0;
        const slope = h - nh;
        if (slope <= preset.thermalSlopeThreshold) continue;
        const amount = (slope - preset.thermalSlopeThreshold) * preset.thermalErosionRate * erosionScale;
        delta[idx] = (delta[idx] ?? 0) - amount * 0.5;
        delta[nIdx] = (delta[nIdx] ?? 0) + amount * 0.5;
      }
    }
  }

  for (let i = 0; i < heightmap.length; i++) {
    heightmap[i] = Math.max(0, (heightmap[i] ?? 0) + (delta[i] ?? 0));
  }
}

/**
 * Hydraulic erosion + sediment transport.
 * Params: hydraulicErosionRate, sedimentCapacity, depositionRate.
 */
export function applyHydraulicErosion(params: MaterialPhysicsStepParams): void {
  const { width, height, heightmap, materials, presets, water, sediment } = params;
  const erosionScale = params.globals?.erosionScale ?? 1;
  const sedimentScale = params.globals?.sedimentScale ?? 1;
  const deltaHeight = new Float32Array(heightmap.length);
  const deltaSediment = new Float32Array(sediment.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = getIndex(x, y, width);
      const preset = getPreset(materials[idx] ?? 0, presets);
      if (!preset) continue;

      const h = heightmap[idx] ?? 0;
      const hRight = heightmap[getIndex(x + 1, y, width)] ?? 0;
      const hLeft = heightmap[getIndex(x - 1, y, width)] ?? 0;
      const hUp = heightmap[getIndex(x, y - 1, width)] ?? 0;
      const hDown = heightmap[getIndex(x, y + 1, width)] ?? 0;
      const slope = Math.max(0, h - Math.min(hRight, hLeft, hUp, hDown));

      const localWater = water[idx] ?? 0;
      const capacity = localWater * slope * preset.sedimentCapacity;
      const currentSediment = sediment[idx] ?? 0;

      if (currentSediment > capacity) {
        const deposit = (currentSediment - capacity) * preset.depositionRate * sedimentScale;
        deltaHeight[idx] = (deltaHeight[idx] ?? 0) + deposit;
        deltaSediment[idx] = (deltaSediment[idx] ?? 0) - deposit;
      } else {
        const erode = (capacity - currentSediment) * preset.hydraulicErosionRate * erosionScale;
        deltaHeight[idx] = (deltaHeight[idx] ?? 0) - erode;
        deltaSediment[idx] = (deltaSediment[idx] ?? 0) + erode;
      }
    }
  }

  for (let i = 0; i < heightmap.length; i++) {
    heightmap[i] = Math.max(0, (heightmap[i] ?? 0) + (deltaHeight[i] ?? 0));
    sediment[i] = Math.max(0, (sediment[i] ?? 0) + (deltaSediment[i] ?? 0));
  }
}

/**
 * Sedimentation pass: deposit sediment on low slopes.
 * Params: sedimentationRate, sedimentationSlope.
 */
export function applySedimentation(params: MaterialPhysicsStepParams): void {
  const { width, height, heightmap, materials, presets, sediment } = params;
  const sedimentScale = params.globals?.sedimentScale ?? 1;
  const deltaHeight = new Float32Array(heightmap.length);
  const deltaSediment = new Float32Array(sediment.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = getIndex(x, y, width);
      const preset = getPreset(materials[idx] ?? 0, presets);
      if (!preset) continue;

      const h = heightmap[idx] ?? 0;
      const hRight = heightmap[getIndex(x + 1, y, width)] ?? 0;
      const hLeft = heightmap[getIndex(x - 1, y, width)] ?? 0;
      const hUp = heightmap[getIndex(x, y - 1, width)] ?? 0;
      const hDown = heightmap[getIndex(x, y + 1, width)] ?? 0;
      const slope = Math.max(0, h - Math.min(hRight, hLeft, hUp, hDown));

      if (slope > preset.sedimentationSlope) continue;
      const availableSediment = sediment[idx] ?? 0;
      const deposit = availableSediment * preset.sedimentationRate * sedimentScale;
      deltaHeight[idx] = (deltaHeight[idx] ?? 0) + deposit;
      deltaSediment[idx] = (deltaSediment[idx] ?? 0) - deposit;
    }
  }

  for (let i = 0; i < heightmap.length; i++) {
    heightmap[i] = Math.max(0, (heightmap[i] ?? 0) + (deltaHeight[i] ?? 0));
    sediment[i] = Math.max(0, (sediment[i] ?? 0) + (deltaSediment[i] ?? 0));
  }
}

/**
 * Heat diffusion (simple Laplacian).
 * Params: thermalDiffusion.
 */
export function applyHeatDiffusion(params: MaterialPhysicsStepParams): void {
  const { width, height, temperature, materials, presets } = params;
  const diffusionScale = params.globals?.diffusionScale ?? 1;
  const next = new Float32Array(temperature.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = getIndex(x, y, width);
      const preset = getPreset(materials[idx] ?? 0, presets);
      if (!preset) {
        next[idx] = temperature[idx] ?? 0;
        continue;
      }

      const t = temperature[idx] ?? 0;
      let sum = 0;
      let count = 0;

      const neighbors: [number, number][] = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];

      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        sum += temperature[getIndex(nx, ny, width)] ?? 0;
        count++;
      }

      const avg = count > 0 ? sum / count : t;
      next[idx] = t + (avg - t) * preset.thermalDiffusion * diffusionScale;
    }
  }

  temperature.set(next);
}

/**
 * Apply reaction rules based on temperature and pressure.
 */
export function applyMaterialReactions(params: MaterialPhysicsStepParams): void {
  const { width, height, materials, temperature, pressure, presets, seed, step } = params;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = getIndex(x, y, width);
      const preset = getPreset(materials[idx] ?? 0, presets);
      if (!preset?.reactionRules || preset.reactionRules.length === 0) continue;

      const temp = temperature[idx] ?? 0;
      const press = pressure[idx] ?? 0;

      for (const rule of preset.reactionRules) {
        const minT = rule.minTemperature ?? -Infinity;
        const maxT = rule.maxTemperature ?? Infinity;
        const minP = rule.minPressure ?? -Infinity;
        const maxP = rule.maxPressure ?? Infinity;
        if (temp < minT || temp > maxT || press < minP || press > maxP) continue;

        const rate = rule.rate ?? 1;
        if (rate < 1) {
          const chance = hash2D(x + step, y - step, seed);
          if (chance > rate) continue;
        }

        materials[idx] = rule.resultMaterialId;
        break;
      }
    }
  }
}

/**
 * Deterministic physics step applying erosion, sedimentation, diffusion, and reactions.
 */
export function simulateMaterialPhysicsStep(params: MaterialPhysicsStepParams): void {
  applyThermalErosion(params);
  applyHydraulicErosion(params);
  applySedimentation(params);
  applyHeatDiffusion(params);
  applyMaterialReactions(params);
}

/**
 * Presets tuned for LLM-controlled parameters.
 *
 * Extension points:
 * - thermalErosionRate / thermalSlopeThreshold
 * - hydraulicErosionRate / sedimentCapacity / depositionRate
 * - sedimentationRate / sedimentationSlope
 * - thermalDiffusion
 * - reactionRules (temperature/pressure thresholds + rate)
 */
export const MaterialPhysicsPresets: Record<string, MaterialPhysicsPreset> = {
  sand: {
    id: 3,
    name: "Sand",
    thermalErosionRate: 0.6,
    thermalSlopeThreshold: 0.02,
    hydraulicErosionRate: 0.5,
    sedimentCapacity: 0.4,
    depositionRate: 0.5,
    sedimentationRate: 0.7,
    sedimentationSlope: 0.04,
    thermalDiffusion: 0.12,
  },
  water: {
    id: 4,
    name: "Water",
    thermalErosionRate: 0.05,
    thermalSlopeThreshold: 0.1,
    hydraulicErosionRate: 0.9,
    sedimentCapacity: 0.8,
    depositionRate: 0.4,
    sedimentationRate: 0.2,
    sedimentationSlope: 0.03,
    thermalDiffusion: 0.6,
  },
  rock: {
    id: 1,
    name: "Rock",
    thermalErosionRate: 0.15,
    thermalSlopeThreshold: 0.08,
    hydraulicErosionRate: 0.1,
    sedimentCapacity: 0.1,
    depositionRate: 0.05,
    sedimentationRate: 0.05,
    sedimentationSlope: 0.02,
    thermalDiffusion: 0.2,
  },
  lava: {
    id: 5,
    name: "Lava",
    thermalErosionRate: 0.1,
    thermalSlopeThreshold: 0.06,
    hydraulicErosionRate: 0.05,
    sedimentCapacity: 0.2,
    depositionRate: 0.1,
    sedimentationRate: 0.05,
    sedimentationSlope: 0.02,
    thermalDiffusion: 0.45,
    reactionRules: [
      {
        maxTemperature: 700,
        resultMaterialId: 1,
        rate: 0.35,
      },
    ],
  },
};
