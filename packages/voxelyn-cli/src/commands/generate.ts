import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { CliError } from '../errors.js';
import type { CliOptions } from '../types.js';
import type { Logger } from '../ui.js';
import { importFromProject } from '../project-import.js';

type GenerateType = 'texture' | 'scenario' | 'object';
type OutFormat = 'bundle' | 'layout' | 'terrain-spec';
type Provider = 'auto' | 'gemini' | 'openai' | 'anthropic' | 'groq' | 'ollama' | 'copilot';

type AIGenerationResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  generationTimeMs?: number;
};

type AnyAIClient = {
  provider?: string;
  model?: string;
  predictTextureParams?: (
    prompt: string,
    palette?: unknown,
    options?: unknown
  ) => Promise<AIGenerationResult<unknown>>;
  predictScenarioLayout?: (
    prompt: string,
    palette?: unknown,
    options?: unknown
  ) => Promise<AIGenerationResult<unknown>>;
  predictObjectBlueprint?: (
    prompt: string,
    palette?: unknown,
    options?: unknown
  ) => Promise<AIGenerationResult<unknown>>;
  testConnection?: () => Promise<boolean>;
};

type AIDynamicModule = {
  createGeminiClient?: (cfg: { apiKey: string; model?: string; debug?: boolean }) => AnyAIClient;
  createClient?: (cfg: unknown) => AnyAIClient;
  createAutoClient?: (cfg?: { preferredProvider?: string; debug?: boolean }) => AnyAIClient | null;
  generateTextureFromParams?: (params: unknown, width: number, height: number) => Uint32Array;
  buildScenarioFromLayout?: (layout: unknown, options?: unknown) => {
    terrain: Uint16Array;
    heightmap: Float32Array;
    width: number;
    height: number;
    depth: number;
    lightingMap?: Float32Array;
    biomeMap?: Uint8Array;
    objects: unknown[];
    materials: Set<number>;
  };
  getScenarioPreview?: (
    result: {
      terrain: Uint16Array;
      width: number;
      height: number;
      depth: number;
    },
    colorMap?: Record<number, number>
  ) => Uint32Array;
  getScenarioStats?: (result: {
    terrain: Uint16Array;
    width: number;
    height: number;
    depth: number;
    objects: unknown[];
  }) => {
    totalVoxels: number;
    filledVoxels: number;
    objectCount: number;
    biomeBreakdown: Record<number, number>;
  };
  buildVoxelsFromBlueprint?: (
    blueprint: unknown,
    options?: unknown
  ) => {
    data: Uint16Array;
    width: number;
    height: number;
    depth: number;
    materialUsage: Map<number, number>;
    warnings?: string[];
  };
  parseScenarioIntent?: (prompt: string, locale?: 'auto' | 'pt' | 'en') => unknown;
  resolveScenarioIntent?: (
    prompt: string,
    options?: {
      mode?: 'fast' | 'balanced' | 'deep';
      strict?: boolean;
      cacheKey?: string;
      normalizeWithLLM?: (intent: unknown) => Promise<unknown>;
    }
  ) => Promise<unknown>;
  compileIntentToDirectives?: (intent: unknown) => unknown;
  enrichScenarioLayoutWithIntent?: (layout: unknown, intent: unknown, directive?: unknown) => unknown;
  DEFAULT_SCENARIO_LAYOUT?: unknown;
};

type ScenarioBuiltResult = {
  layout: Record<string, unknown>;
  intent?: unknown;
  directive?: unknown;
  terrain: Uint16Array;
  width: number;
  height: number;
  depth: number;
  heightmap: Float32Array;
  biomeMap: Uint8Array;
  lightingMap: Float32Array;
  preview: Uint32Array;
  stats: {
    totalVoxels: number;
    filledVoxels: number;
    objectCount: number;
    biomeBreakdown: Record<number, number>;
  };
  mode: 'ai' | 'procedural';
};

const DEFAULT_TEXTURE_SIZE = 64;
const DEFAULT_SCENARIO_SIZE: [number, number] = [128, 128];
const DEFAULT_SCENARIO_DEPTH = 32;
const DEFAULT_SCALE = 1;

const makeOutputDir = async (dryRun: boolean): Promise<string> => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(process.cwd(), 'assets', 'generated', stamp);
  if (!dryRun) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
};

const writeJson = async (filePath: string, data: unknown, dryRun: boolean): Promise<void> => {
  if (dryRun) return;
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
};

const writeBuffer = async (filePath: string, data: Buffer | Uint8Array, dryRun: boolean): Promise<void> => {
  if (dryRun) return;
  await writeFile(filePath, data);
};

const writeTypedArray = async (
  filePath: string,
  data: Float32Array | Uint16Array | Uint8Array,
  dryRun: boolean
): Promise<void> => {
  await writeBuffer(
    filePath,
    Buffer.from(data.buffer, data.byteOffset, data.byteLength),
    dryRun
  );
};

const writePpm = async (
  filePath: string,
  width: number,
  height: number,
  pixels: Uint32Array,
  dryRun: boolean
): Promise<void> => {
  const header = `P6\n${width} ${height}\n255\n`;
  const buf = Buffer.alloc(width * height * 3);

  for (let i = 0; i < pixels.length; i += 1) {
    const c = pixels[i] ?? 0;
    const r = c & 0xff;
    const g = (c >>> 8) & 0xff;
    const b = (c >>> 16) & 0xff;
    const idx = i * 3;
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
  }

  await writeBuffer(filePath, Buffer.concat([Buffer.from(header), buf]), dryRun);
};

const parseDimension = (raw: string | undefined): [number, number] | null => {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  const m = value.match(/^(\d+)x(\d+)$/);
  if (m) {
    const w = Number(m[1]);
    const h = Number(m[2]);
    if (Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0) {
      return [w, h];
    }
    return null;
  }

  const single = Number(value);
  if (Number.isInteger(single) && single > 0) {
    return [single, single];
  }

  return null;
};

const parsePositiveInt = (value: number | undefined, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const n = Math.round(value);
  return n > 0 ? n : fallback;
};

const parseScale = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_SCALE;
  }
  return value;
};

const parseProvider = (value: CliOptions['provider']): Provider => value ?? 'auto';

const hash = (input: string): number => {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

const withTiming = async <T>(
  label: string,
  enabled: boolean,
  logger: Logger,
  action: () => Promise<T>
): Promise<T> => {
  const start = Date.now();
  try {
    return await action();
  } finally {
    if (enabled) {
      logger.info(`[generate] ${label}: ${Date.now() - start}ms`);
    }
  }
};

const guardScenarioVolume = (
  width: number,
  height: number,
  depth: number,
  force: boolean | undefined,
  logger: Logger
): void => {
  const volume = width * height * depth;
  if (volume > 64_000_000 && !force) {
    throw new CliError(
      'ERR_GENERATE_VOLUME',
      `Requested scenario volume ${volume.toLocaleString()} exceeds safety threshold. Use --force to override.`
    );
  }

  if (volume > 16_000_000) {
    logger.info(`[generate] Large volume requested (${volume.toLocaleString()} voxels).`);
  }
};

const getScenarioDefaultsFromPrompt = (
  prompt: string,
  size: [number, number],
  depth: number,
  seed: number
): Record<string, unknown> => {
  const text = prompt.toLowerCase();
  const hasWater = /(river|lake|ocean|sea|coast|water|rio|lago|mar)/.test(text);
  const hasMountain = /(mountain|ridge|peak|montanha|serra)/.test(text);
  const hasDesert = /(desert|dune|sand|deserto|duna)/.test(text);

  const primaryBiome = hasDesert ? 'desert' : hasMountain ? 'mountains' : 'plains';

  const biomes: Array<Record<string, unknown>> = [
    {
      type: primaryBiome,
      bounds: [0, 0, size[0], size[1]],
      elevation: hasMountain ? 0.58 : hasDesert ? 0.28 : 0.35,
      elevationVariation: hasMountain ? 0.28 : 0.12,
      moisture: hasDesert ? 0.15 : 0.5,
      surfaceMaterial: hasDesert ? 'sand' : hasMountain ? 'stone' : 'grass',
      undergroundMaterial: hasDesert ? 'sand' : hasMountain ? 'stone' : 'dirt',
    },
  ];

  if (hasWater) {
    biomes.push({
      type: 'river',
      bounds: [Math.floor(size[0] * 0.45), 0, Math.max(3, Math.floor(size[0] * 0.1)), size[1]],
      elevation: 0.18,
      elevationVariation: 0.03,
      moisture: 1,
      surfaceMaterial: 'water',
      undergroundMaterial: 'sand',
    });
  }

  return {
    name: 'Procedural Scenario',
    description: prompt,
    category: 'outdoor',
    size,
    depth,
    biomes,
    heightmap: {
      octaves: hasMountain ? 5 : 4,
      persistence: hasMountain ? 0.55 : 0.45,
      scale: hasMountain ? 3 : 4,
      seed,
      baseElevation: hasMountain ? 0.42 : 0.33,
      amplitude: hasMountain ? 0.5 : 0.35,
    },
    objects: [],
    seed,
  };
};

const deriveIntentPatchFromLayout = (layout: Record<string, unknown>): Record<string, unknown> => {
  const patch: Record<string, unknown> = {};
  const category = layout.category;
  if (typeof category === 'string') {
    patch.categoryIntent = category;
  }

  const sizeRaw = Array.isArray(layout.size) ? layout.size : null;
  const width = typeof sizeRaw?.[0] === 'number' ? Math.max(1, Math.round(sizeRaw[0])) : DEFAULT_SCENARIO_SIZE[0];
  const height = typeof sizeRaw?.[1] === 'number' ? Math.max(1, Math.round(sizeRaw[1])) : DEFAULT_SCENARIO_SIZE[1];
  const area = width * height;

  const worldScale =
    area >= 262_144 ? 'epic' : area >= 65_536 ? 'large' : area <= 16_384 ? 'small' : 'medium';
  const detailLevel = area >= 131_072 ? 'medium' : 'high';
  patch.scaleIntent = { worldScale, detailLevel };

  const biomes = Array.isArray(layout.biomes) ? layout.biomes : [];
  if (biomes.length > 0) {
    const totals = new Map<string, number>();
    let totalCoverage = 0;

    for (const biome of biomes) {
      if (!biome || typeof biome !== 'object') continue;
      const biomeType = typeof (biome as { type?: unknown }).type === 'string'
        ? (biome as { type: string }).type
        : null;
      if (!biomeType) continue;

      const bounds = (biome as { bounds?: unknown }).bounds;
      let coverage = 1;
      if (Array.isArray(bounds) && bounds.length >= 4) {
        const bw = typeof bounds[2] === 'number' ? Math.max(1, bounds[2]) : 1;
        const bh = typeof bounds[3] === 'number' ? Math.max(1, bounds[3]) : 1;
        coverage = bw * bh;
      }

      totals.set(biomeType, (totals.get(biomeType) ?? 0) + coverage);
      totalCoverage += coverage;
    }

    if (totals.size > 0 && totalCoverage > 0) {
      patch.biomeStrategy = Array.from(totals.entries()).map(([biome, coverage]) => {
        const weight = coverage / totalCoverage;
        return {
          biome,
          weight,
          minCoverage: Math.max(0.05, Math.min(0.7, weight * 0.6)),
          maxCoverage: Math.min(1, Math.max(0.35, weight * 1.8)),
        };
      });
    }

    const types = new Set(totals.keys());
    const waterSystem = types.has('ocean')
      ? 'oceanic'
      : types.has('river')
        ? 'river'
        : types.has('lake')
          ? 'lake'
          : 'none';
    const reliefEnergy = types.has('mountains') || types.has('volcanic') ? 'high' : 'medium';
    patch.topology = {
      waterSystem,
      reliefEnergy,
    };
  }

  const objects = Array.isArray(layout.objects) ? layout.objects : [];
  if (objects.length > 0) {
    const labels = objects
      .map((entry) =>
        entry && typeof entry === 'object' && typeof (entry as { objectType?: unknown }).objectType === 'string'
          ? ((entry as { objectType: string }).objectType).toLowerCase()
          : ''
      )
      .filter(Boolean);

    const hasSettlement = labels.some((value) =>
      /(house|village|town|settlement|camp|fort|castle|tower|road)/.test(value)
    );

    const poiArchetypes = Array.from(
      new Set(labels.filter((value) => /(ruin|temple|tower|camp|dungeon|settlement|village)/.test(value)))
    );

    patch.composition = {
      settlementPattern: hasSettlement ? 'clustered' : 'none',
      poiArchetypes,
    };
  }

  return patch;
};

const buildTopDownPreview = (
  terrain: Uint16Array,
  width: number,
  height: number,
  depth: number
): Uint32Array => {
  const preview = new Uint32Array(width * height);
  const colors: Record<number, number> = {
    0: 0x00000000,
    1: 0xff808080,
    2: 0xff5b3a23,
    3: 0xffc2b280,
    4: 0xffc86400,
    7: 0xff228b22,
    9: 0xfff0f0f0,
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx2d = x + y * width;
      for (let z = depth - 1; z >= 0; z -= 1) {
        const mat = terrain[idx2d + z * width * height] ?? 0;
        if (mat !== 0) {
          preview[idx2d] = colors[mat] ?? 0xffff00ff;
          break;
        }
      }
    }
  }

  return preview;
};

const scenarioStats = (
  terrain: Uint16Array,
  width: number,
  height: number,
  depth: number,
  objects: unknown[]
): ScenarioBuiltResult['stats'] => {
  const breakdown: Record<number, number> = {};
  let filled = 0;
  for (let i = 0; i < terrain.length; i += 1) {
    const mat = terrain[i] ?? 0;
    if (mat !== 0) {
      filled += 1;
      breakdown[mat] = (breakdown[mat] ?? 0) + 1;
    }
  }

  return {
    totalVoxels: width * height * depth,
    filledVoxels: filled,
    objectCount: objects.length,
    biomeBreakdown: breakdown,
  };
};

const layoutToTerrainSpec = (layout: Record<string, unknown>): Record<string, unknown> => {
  const size = layout.size as [number, number] | undefined;
  const width = size?.[0] ?? DEFAULT_SCENARIO_SIZE[0];
  const height = size?.[1] ?? DEFAULT_SCENARIO_SIZE[1];
  const biomes = (layout.biomes as Array<Record<string, unknown>> | undefined) ?? [];
  const heightmap = (layout.heightmap as Record<string, number> | undefined) ?? {};

  return {
    version: 1,
    name: layout.name ?? 'Generated Terrain',
    seed: layout.seed,
    size: { width, height },
    biomes: biomes.map((biome, idx) => ({
      id: String(biome.type ?? `biome-${idx}`),
      label: String(biome.type ?? `Biome ${idx + 1}`),
      color: '#7f7f7f',
      materialIds: [String(biome.surfaceMaterial ?? 'grass'), String(biome.undergroundMaterial ?? 'dirt')],
      heightRange: [
        Math.max(0, Number((biome.elevation as number | undefined) ?? 0.25) - 0.15),
        Math.min(1, Number((biome.elevation as number | undefined) ?? 0.25) + 0.2),
      ],
    })),
    noise: {
      baseFrequency: 0.03,
      octaves: Number(heightmap.octaves ?? 4),
      lacunarity: 2,
      gain: Number(heightmap.persistence ?? 0.5),
      warp: 0.2,
      detailStrength: 0.08,
    },
    heightCurves: [
      {
        id: 'default',
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.6 },
          { x: 1, y: 1 },
        ],
      },
    ],
    layers: biomes.map((biome, idx) => ({
      id: `${biome.type ?? 'biome'}-${idx}`,
      biomeId: String(biome.type ?? `biome-${idx}`),
      materialId: String(biome.surfaceMaterial ?? 'grass'),
      minHeight: Math.max(0, Number((biome.elevation as number | undefined) ?? 0.25) - 0.15),
      maxHeight: Math.min(1, Number((biome.elevation as number | undefined) ?? 0.25) + 0.25),
    })),
  };
};

const resolveProviderClient = (
  aiModule: AIDynamicModule,
  options: CliOptions,
  logger: Logger
): AnyAIClient | null => {
  const provider = parseProvider(options.provider);

  if (provider === 'auto') {
    if (typeof aiModule.createAutoClient === 'function') {
      return aiModule.createAutoClient({ debug: Boolean(options.debugAi) });
    }

    const geminiKey =
      process.env.VOXELYN_AI_API_KEY ??
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_AI_API_KEY ??
      process.env.GOOGLE_API_KEY;

    if (geminiKey && typeof aiModule.createGeminiClient === 'function') {
      return aiModule.createGeminiClient({
        apiKey: geminiKey,
        model: options.model,
        debug: Boolean(options.debugAi),
      });
    }

    return null;
  }

  if (typeof aiModule.createClient !== 'function') {
    if (provider === 'gemini' && typeof aiModule.createGeminiClient === 'function') {
      const geminiKey =
        process.env.VOXELYN_AI_API_KEY ??
        process.env.GEMINI_API_KEY ??
        process.env.GOOGLE_AI_API_KEY ??
        process.env.GOOGLE_API_KEY;
      if (!geminiKey) {
        logger.info('[generate] Missing Gemini key for explicit provider=gemini.');
        return null;
      }
      return aiModule.createGeminiClient({
        apiKey: geminiKey,
        model: options.model,
        debug: Boolean(options.debugAi),
      });
    }
    logger.info('[generate] Requested provider, but createClient is not available in @voxelyn/ai.');
    return null;
  }

  const providerConfig = (() => {
    switch (provider) {
      case 'gemini': {
        const apiKey =
          process.env.VOXELYN_AI_API_KEY ??
          process.env.GEMINI_API_KEY ??
          process.env.GOOGLE_AI_API_KEY ??
          process.env.GOOGLE_API_KEY;
        return apiKey ? { provider, apiKey, model: options.model } : null;
      }
      case 'openai': {
        const apiKey = process.env.OPENAI_API_KEY;
        return apiKey ? { provider, apiKey, model: options.model } : null;
      }
      case 'anthropic': {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        return apiKey ? { provider, apiKey, model: options.model } : null;
      }
      case 'groq': {
        const apiKey = process.env.GROQ_API_KEY;
        return apiKey ? { provider, apiKey, model: options.model } : null;
      }
      case 'copilot': {
        const token = process.env.GITHUB_TOKEN ?? process.env.COPILOT_TOKEN;
        return token ? { provider, token, model: options.model } : null;
      }
      case 'ollama':
        return { provider, model: options.model, baseURL: process.env.OLLAMA_BASE_URL };
      default:
        return null;
    }
  })();

  if (!providerConfig) {
    logger.info(`[generate] Missing credentials for provider=${provider}.`);
    return null;
  }

  try {
    return aiModule.createClient(providerConfig);
  } catch (error) {
    logger.info(`[generate] Failed to create provider client (${provider}): ${String(error)}`);
    return null;
  }
};

const generateTextureFallback = async (
  prompt: string,
  width: number,
  height: number,
  seed: number
): Promise<{ pixels: Uint32Array; params: Record<string, unknown> }> => {
  const core = await importFromProject('@voxelyn/core', process.cwd());
  if (!core) {
    throw new CliError('ERR_CORE_MISSING', 'Install @voxelyn/core to use texture fallback.');
  }

  const { GradientNoise, packRGBA } = core as {
    GradientNoise: new (seed: number, opts: { octaves: number; falloff: number }) => {
      sampleZoomed: (x: number, y: number, zoom: number) => number;
    };
    packRGBA: (r: number, g: number, b: number, a?: number) => number;
  };

  const pixels = new Uint32Array(width * height);
  const noise = new GradientNoise(seed, { octaves: 4, falloff: 0.5 });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const n = noise.sampleZoomed(x, y, Math.max(width, height) / 2.5);
      const v = Math.max(0, Math.min(255, Math.floor(n * 255)));
      pixels[y * width + x] = packRGBA(v, v, v, 255);
    }
  }

  return {
    pixels,
    params: {
      baseType: 'rock',
      originalPrompt: prompt,
      fallback: true,
      noise: { octaves: 4, persistence: 0.5, scale: 2, seed },
    },
  };
};

const generateScenarioFallback = async (
  prompt: string,
  size: [number, number],
  depth: number,
  seed: number
): Promise<ScenarioBuiltResult> => {
  const [width, height] = size;
  const core = await importFromProject('@voxelyn/core', process.cwd());
  const layout = getScenarioDefaultsFromPrompt(prompt, size, depth, seed);
  const heightmap = new Float32Array(width * height);
  const biomeMap = new Uint8Array(width * height);
  const lightingMap = new Float32Array(width * height);
  lightingMap.fill(1);

  if (core) {
    const { GradientNoise } = core as {
      GradientNoise: new (seed: number, opts: { octaves: number; falloff: number }) => {
        sampleZoomed: (x: number, y: number, zoom: number) => number;
      };
    };

    const noise = new GradientNoise(seed, { octaves: 4, falloff: 0.5 });
    const text = prompt.toLowerCase();
    const river = /(river|stream|rio|riacho)/.test(text);
    const ring = /(ring|atoll|donut|torus|anel)/.test(text);

    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const maxR = Math.max(1, Math.min(width, height) * 0.5);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        let h = noise.sampleZoomed(x, y, Math.max(24, Math.min(width, height) * 0.7));

        const nx = (x - cx) / maxR;
        const ny = (y - cy) / maxR;
        const r = Math.sqrt(nx * nx + ny * ny);

        if (ring) {
          const band = Math.max(0, 1 - Math.abs(r - 0.55) * 4.5);
          h += band * 0.25;
        }

        if (river) {
          const rv = Math.exp(-Math.pow(nx * 2.8, 2));
          h -= rv * 0.18;
        }

        if (r > 0.72) {
          h -= (r - 0.72) * 0.45;
        }

        const clamped = Math.max(0, Math.min(1, h));
        heightmap[idx] = clamped;
        biomeMap[idx] = clamped < 0.26 ? 1 : 0;
      }
    }
  } else {
    heightmap.fill(0.35);
  }

  const terrain = new Uint16Array(width * height * depth);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx2d = y * width + x;
      const h = heightmap[idx2d] ?? 0;
      const top = Math.min(depth - 1, Math.max(0, Math.floor(h * depth)));
      const waterLevel = Math.floor(depth * 0.25);
      const isWater = (biomeMap[idx2d] ?? 0) === 1;

      for (let z = 0; z <= top; z += 1) {
        const idx3d = idx2d + z * width * height;
        terrain[idx3d] = z === top ? (isWater ? 3 : 7) : 2;
      }

      if (isWater) {
        for (let z = top + 1; z <= waterLevel && z < depth; z += 1) {
          const idx3d = idx2d + z * width * height;
          terrain[idx3d] = 4;
        }
      }
    }
  }

  const preview = buildTopDownPreview(terrain, width, height, depth);
  const stats = scenarioStats(terrain, width, height, depth, []);

  return {
    layout,
    terrain,
    width,
    height,
    depth,
    heightmap,
    biomeMap,
    lightingMap,
    preview,
    stats,
    mode: 'procedural',
  };
};

const writeScenarioBundle = async (
  outDir: string,
  prompt: string,
  seed: number,
  scale: number,
  provider: string,
  model: string,
  scenario: ScenarioBuiltResult,
  dryRun: boolean
): Promise<void> => {
  await writeJson(path.join(outDir, 'scenario.layout.json'), scenario.layout, dryRun);
  await writeJson(path.join(outDir, 'scenario.intent.json'), scenario.intent ?? null, dryRun);
  await writeJson(path.join(outDir, 'scenario.stats.json'), scenario.stats, dryRun);
  await writeJson(
    path.join(outDir, 'scenario.scale.json'),
    { voxelScale: scale, width: scenario.width, height: scenario.height, depth: scenario.depth },
    dryRun
  );

  await writeTypedArray(path.join(outDir, 'scenario.heightmap.f32'), scenario.heightmap, dryRun);
  await writeTypedArray(path.join(outDir, 'scenario.biome.u8'), scenario.biomeMap, dryRun);
  await writeTypedArray(path.join(outDir, 'scenario.lighting.f32'), scenario.lightingMap, dryRun);
  await writeTypedArray(path.join(outDir, 'scenario.terrain.u16'), scenario.terrain, dryRun);
  await writePpm(path.join(outDir, 'scenario.preview.ppm'), scenario.width, scenario.height, scenario.preview, dryRun);

  const terrainSpec = layoutToTerrainSpec(scenario.layout);
  await writeJson(path.join(outDir, 'terrain.spec.json'), terrainSpec, dryRun);

  await writeJson(
    path.join(outDir, 'manifest.json'),
    {
      version: 1,
      type: 'scenario',
      mode: scenario.mode,
      prompt,
      seed,
      provider,
      model,
      scale,
      size: [scenario.width, scenario.height],
      depth: scenario.depth,
      files: [
        'scenario.layout.json',
        'scenario.intent.json',
        'scenario.stats.json',
        'scenario.scale.json',
        'scenario.heightmap.f32',
        'scenario.biome.u8',
        'scenario.lighting.f32',
        'scenario.terrain.u16',
        'scenario.preview.ppm',
        'terrain.spec.json',
      ],
    },
    dryRun
  );
};

const writeTextureBundle = async (
  outDir: string,
  prompt: string,
  seed: number,
  scale: number,
  provider: string,
  model: string,
  width: number,
  height: number,
  pixels: Uint32Array,
  params: unknown,
  mode: 'ai' | 'procedural',
  dryRun: boolean
): Promise<void> => {
  await writeJson(path.join(outDir, 'texture.params.json'), params, dryRun);
  await writeJson(
    path.join(outDir, 'texture.meta.json'),
    { width, height, seed, scale, mode },
    dryRun
  );
  await writePpm(path.join(outDir, 'texture.ppm'), width, height, pixels, dryRun);
  await writeJson(
    path.join(outDir, 'manifest.json'),
    {
      version: 1,
      type: 'texture',
      mode,
      prompt,
      seed,
      provider,
      model,
      scale,
      size: [width, height],
      files: ['texture.params.json', 'texture.meta.json', 'texture.ppm'],
    },
    dryRun
  );
};

const writeObjectBundle = async (
  outDir: string,
  prompt: string,
  seed: number,
  scale: number,
  provider: string,
  model: string,
  blueprint: unknown,
  voxels: {
    data: Uint16Array;
    width: number;
    height: number;
    depth: number;
    materialUsage: Map<number, number>;
    warnings?: string[];
  },
  mode: 'ai' | 'procedural',
  dryRun: boolean
): Promise<void> => {
  await writeJson(path.join(outDir, 'object.blueprint.json'), blueprint, dryRun);
  await writeTypedArray(path.join(outDir, 'object.voxels.u16'), voxels.data, dryRun);
  await writeJson(
    path.join(outDir, 'object.meta.json'),
    {
      width: voxels.width,
      height: voxels.height,
      depth: voxels.depth,
      materialUsage: Object.fromEntries(voxels.materialUsage.entries()),
      warnings: voxels.warnings ?? [],
      scale,
      seed,
      mode,
    },
    dryRun
  );
  await writeJson(
    path.join(outDir, 'manifest.json'),
    {
      version: 1,
      type: 'object',
      mode,
      prompt,
      seed,
      provider,
      model,
      scale,
      bounds: [voxels.width, voxels.height, voxels.depth],
      files: ['object.blueprint.json', 'object.voxels.u16', 'object.meta.json'],
    },
    dryRun
  );
};

export const runGenerate = async (
  options: CliOptions,
  positionals: string[],
  logger: Logger
): Promise<void> => {
  const type = positionals[0] as GenerateType | undefined;
  const prompt = options.prompt ?? positionals.slice(1).join(' ').trim();

  if (!type || !['texture', 'scenario', 'object'].includes(type)) {
    throw new CliError('ERR_INVALID_GENERATE', 'Generate type must be "texture", "scenario", or "object".');
  }
  if (!prompt) {
    throw new CliError('ERR_MISSING_PROMPT', 'Missing --prompt for generate.');
  }

  const outFormat: OutFormat = options.outFormat ?? 'bundle';
  const dryRun = Boolean(options.dryRun);
  const debug = Boolean(options.debugAi || options.verbose);

  const textureSize =
    parseDimension(options.textureSize) ??
    (type === 'texture' ? parseDimension(options.size) : null) ??
    [DEFAULT_TEXTURE_SIZE, DEFAULT_TEXTURE_SIZE];

  const scenarioSize = parseDimension(options.size) ?? DEFAULT_SCENARIO_SIZE;
  const scenarioDepth = parsePositiveInt(options.depth, DEFAULT_SCENARIO_DEPTH);
  const scale = parseScale(options.scale);
  const seed = parsePositiveInt(options.seed, hash(prompt));

  if (type === 'scenario') {
    guardScenarioVolume(scenarioSize[0], scenarioSize[1], scenarioDepth, options.force, logger);
  }

  const outDir = await makeOutputDir(dryRun);
  const aiModuleRaw = await importFromProject('@voxelyn/ai', process.cwd());
  const aiModule = aiModuleRaw as unknown as AIDynamicModule | null;

  const client = aiModule ? resolveProviderClient(aiModule, options, logger) : null;
  const providerName = client?.provider ?? parseProvider(options.provider);
  const modelName = client?.model ?? options.model ?? 'procedural';

  if (options.workers && options.workers !== 1) {
    logger.info('[generate] Workers requested; falling back to single-thread for unsupported stages.');
  }

  if (type === 'texture') {
    const [width, height] = textureSize;
    const aiTexture = async (): Promise<{ pixels: Uint32Array; params: unknown } | null> => {
      if (!aiModule || !client?.predictTextureParams || !aiModule.generateTextureFromParams) {
        return null;
      }

      const result = await client.predictTextureParams(prompt, undefined, {
        targetSize: Math.max(width, height),
      });

      if (!result.success || !result.data) {
        logger.info(`[generate] AI texture generation failed: ${result.error ?? 'unknown'}`);
        return null;
      }

      return {
        pixels: aiModule.generateTextureFromParams(result.data, width, height),
        params: result.data,
      };
    };

    const texture = await withTiming('texture', debug, logger, async () => {
      const ai = await aiTexture();
      if (ai) return { ...ai, mode: 'ai' as const };
      const fallback = await generateTextureFallback(prompt, width, height, seed);
      return { ...fallback, mode: 'procedural' as const };
    });

    await writeTextureBundle(
      outDir,
      prompt,
      seed,
      scale,
      providerName,
      modelName,
      width,
      height,
      texture.pixels,
      texture.params,
      texture.mode,
      dryRun
    );

    logger.success(`Generated texture bundle: ${outDir}`);
    return;
  }

  if (type === 'object') {
    const aiObject = async (): Promise<{ blueprint: unknown; voxels: ReturnType<NonNullable<AIDynamicModule['buildVoxelsFromBlueprint']>> } | null> => {
      if (!aiModule || !client?.predictObjectBlueprint || !aiModule.buildVoxelsFromBlueprint) {
        return null;
      }

      const result = await client.predictObjectBlueprint(prompt);
      if (!result.success || !result.data) {
        logger.info(`[generate] AI object generation failed: ${result.error ?? 'unknown'}`);
        return null;
      }

      return {
        blueprint: result.data,
        voxels: aiModule.buildVoxelsFromBlueprint(result.data, {
          scale,
        }) as ReturnType<NonNullable<AIDynamicModule['buildVoxelsFromBlueprint']>>,
      };
    };

    const objectResult = await withTiming('object', debug, logger, async () => {
      const ai = await aiObject();
      if (ai) return { ...ai, mode: 'ai' as const };

      const size = Math.max(4, Math.min(24, Math.floor(8 * scale)));
      const data = new Uint16Array(size * size * size);
      for (let z = 0; z < size; z += 1) {
        for (let y = 0; y < size; y += 1) {
          for (let x = 0; x < size; x += 1) {
            const idx = x + y * size + z * size * size;
            if (x === 0 || y === 0 || z === 0 || x === size - 1 || y === size - 1 || z === size - 1) {
              data[idx] = 6;
            }
          }
        }
      }

      return {
        mode: 'procedural' as const,
        blueprint: {
          name: 'Fallback Object',
          description: prompt,
          bounds: [size, size, size],
          primitives: [
            {
              type: 'box',
              position: [0, 0, 0],
              size: [size, size, size],
              material: 6,
            },
          ],
          materialMapping: { wood: 6 },
          seed,
        },
        voxels: {
          data,
          width: size,
          height: size,
          depth: size,
          materialUsage: new Map<number, number>([[6, data.reduce((acc, v) => (v === 6 ? acc + 1 : acc), 0)]]),
          warnings: ['Procedural fallback object was used.'],
        },
      };
    });

    await writeObjectBundle(
      outDir,
      prompt,
      seed,
      scale,
      providerName,
      modelName,
      objectResult.blueprint,
      objectResult.voxels,
      objectResult.mode,
      dryRun
    );

    logger.success(`Generated object bundle: ${outDir}`);
    return;
  }

  // Scenario
  const scenario = await withTiming('scenario', debug, logger, async () => {
    if (aiModule && client?.predictScenarioLayout && aiModule.buildScenarioFromLayout) {
      const result = await client.predictScenarioLayout(prompt, undefined, {
        targetSize: scenarioSize,
        depth: scenarioDepth,
        useEnhancedTerrain: options.enhancedTerrain ?? true,
      });

      if (result.success && result.data) {
        let layout = result.data as Record<string, unknown>;
        layout = {
          ...layout,
          size: scenarioSize,
          depth: scenarioDepth,
          seed,
          originalPrompt: prompt,
        };

        let intent: unknown;
        let directive: unknown;

        if (aiModule.resolveScenarioIntent) {
          const normalizedPatch = deriveIntentPatchFromLayout(layout);
          intent = await aiModule.resolveScenarioIntent(prompt, {
            mode: options.intentMode ?? 'balanced',
            strict: Boolean(options.intentStrict),
            cacheKey: `${prompt}:${seed}:${scenarioSize[0]}x${scenarioSize[1]}:${scenarioDepth}:${providerName}:${modelName}:${options.intentMode ?? 'balanced'}`,
            normalizeWithLLM: async () => normalizedPatch,
          });
        } else if (aiModule.parseScenarioIntent) {
          intent = aiModule.parseScenarioIntent(prompt, 'auto');
        }

        if (intent && aiModule.compileIntentToDirectives) {
          directive = aiModule.compileIntentToDirectives(intent);
        }

        if (intent && aiModule.enrichScenarioLayoutWithIntent) {
          layout = aiModule.enrichScenarioLayoutWithIntent(layout, intent, directive) as Record<string, unknown>;
        }

        const built = aiModule.buildScenarioFromLayout(layout, {
          useEnhancedTerrain: options.enhancedTerrain ?? true,
          resolutionScale: scale,
          workers: options.workers,
          chunkSize: 64,
          intent,
          intentDirective: directive,
        });

        const preview = aiModule.getScenarioPreview
          ? aiModule.getScenarioPreview(built)
          : buildTopDownPreview(built.terrain, built.width, built.height, built.depth);

        const stats = aiModule.getScenarioStats
          ? aiModule.getScenarioStats({ ...built, objects: built.objects })
          : scenarioStats(built.terrain, built.width, built.height, built.depth, built.objects ?? []);

        return {
          layout,
          intent,
          directive,
          terrain: built.terrain,
          width: built.width,
          height: built.height,
          depth: built.depth,
          heightmap: built.heightmap,
          biomeMap: built.biomeMap ?? new Uint8Array(built.width * built.height),
          lightingMap: built.lightingMap ?? new Float32Array(built.width * built.height).fill(1),
          preview,
          stats,
          mode: 'ai' as const,
        } satisfies ScenarioBuiltResult;
      }

      logger.info(`[generate] AI scenario generation failed: ${result.error ?? 'unknown'}`);
    }

    return generateScenarioFallback(prompt, scenarioSize, scenarioDepth, seed);
  });

  if (outFormat === 'layout') {
    await writeJson(path.join(outDir, 'scenario.layout.json'), scenario.layout, dryRun);
    await writeJson(
      path.join(outDir, 'manifest.json'),
      {
        version: 1,
        type: 'scenario',
        mode: scenario.mode,
        prompt,
        seed,
        provider: providerName,
        model: modelName,
        files: ['scenario.layout.json'],
      },
      dryRun
    );
    logger.success(`Generated scenario layout: ${outDir}`);
    return;
  }

  if (outFormat === 'terrain-spec') {
    const terrainSpec = layoutToTerrainSpec(scenario.layout);
    await writeJson(path.join(outDir, 'terrain.spec.json'), terrainSpec, dryRun);
    await writeJson(
      path.join(outDir, 'manifest.json'),
      {
        version: 1,
        type: 'scenario',
        mode: scenario.mode,
        prompt,
        seed,
        provider: providerName,
        model: modelName,
        files: ['terrain.spec.json'],
      },
      dryRun
    );
    logger.success(`Generated terrain spec: ${outDir}`);
    return;
  }

  await writeScenarioBundle(
    outDir,
    prompt,
    seed,
    scale,
    providerName,
    modelName,
    scenario,
    dryRun
  );

  logger.success(`Generated scenario bundle: ${outDir}`);
};
