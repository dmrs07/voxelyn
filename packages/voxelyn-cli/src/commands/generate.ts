import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { CliError } from '../errors.js';
import type { CliOptions } from '../types.js';
import type { Logger } from '../ui.js';
import { importFromProject } from '../project-import.js';

const makeOutputDir = async (dryRun: boolean): Promise<string> => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(process.cwd(), 'assets', 'generated', stamp);
  if (!dryRun) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
};

const writeJson = async (filePath: string, data: unknown, dryRun: boolean): Promise<void> => {
  const raw = JSON.stringify(data, null, 2);
  if (dryRun) {
    return;
  }
  await writeFile(filePath, raw, 'utf8');
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
  if (dryRun) return;
  await writeFile(filePath, Buffer.concat([Buffer.from(header), buf]));
};

const generateTextureFallback = async (
  prompt: string,
  outDir: string,
  dryRun: boolean
): Promise<string> => {
  const core = await importFromProject('@voxelyn/core', process.cwd());
  if (!core) {
    throw new CliError('ERR_CORE_MISSING', 'Install @voxelyn/core to use generate fallback.');
  }
  const { GradientNoise, packRGBA } = core as {
    GradientNoise: new (seed: number, opts: { octaves: number; falloff: number }) => {
      sampleZoomed: (x: number, y: number, zoom: number) => number;
    };
    packRGBA: (r: number, g: number, b: number, a?: number) => number;
  };

  const width = 64;
  const height = 64;
  const pixels = new Uint32Array(width * height);
  const noise = new GradientNoise(Math.abs(hash(prompt)) % 100000, { octaves: 4, falloff: 0.5 });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = noise.sampleZoomed(x, y, 20);
      const c = Math.max(0, Math.min(255, Math.floor(v * 255)));
      pixels[y * width + x] = packRGBA(c, c, c, 255);
    }
  }

  const outPath = path.join(outDir, 'texture.ppm');
  await writePpm(outPath, width, height, pixels, dryRun);
  return outPath;
};

const generateScenarioFallback = async (
  prompt: string,
  outDir: string,
  dryRun: boolean
): Promise<string> => {
  const core = await importFromProject('@voxelyn/core', process.cwd());
  if (!core) {
    throw new CliError('ERR_CORE_MISSING', 'Install @voxelyn/core to use generate fallback.');
  }
  const { GradientNoise } = core as {
    GradientNoise: new (seed: number, opts: { octaves: number; falloff: number }) => {
      sampleZoomed: (x: number, y: number, zoom: number) => number;
    };
  };
  const width = 32;
  const height = 32;
  const noise = new GradientNoise(Math.abs(hash(prompt)) % 100000, { octaves: 4, falloff: 0.55 });
  const heightmap: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      heightmap.push(Number(noise.sampleZoomed(x, y, 18).toFixed(4)));
    }
  }
  const outPath = path.join(outDir, 'scenario.json');
  await writeJson(outPath, { prompt, width, height, heightmap }, dryRun);
  return outPath;
};

const hash = (input: string): number => {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return h;
};

export const runGenerate = async (
  options: CliOptions,
  positionals: string[],
  logger: Logger
): Promise<void> => {
  const type = positionals[0];
  const prompt = options.prompt ?? positionals.slice(1).join(' ').trim();

  if (!type || (type !== 'texture' && type !== 'scenario')) {
    throw new CliError('ERR_INVALID_GENERATE', 'Generate type must be "texture" or "scenario".');
  }
  if (!prompt) {
    throw new CliError('ERR_MISSING_PROMPT', 'Missing --prompt for generate.');
  }

  const outDir = await makeOutputDir(Boolean(options.dryRun));

  const aiModule = await importFromProject('@voxelyn/ai', process.cwd());
  const apiKey =
    process.env.VOXELYN_AI_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY;

  if (aiModule && apiKey) {
    logger.info('Using @voxelyn/ai for generation...');
    if (type === 'texture') {
      const { createGeminiClient, generateTextureFromParams } = aiModule as {
        createGeminiClient: (cfg: { apiKey: string }) => {
          predictTextureParams: (p: string) => Promise<{ success: boolean; data: unknown }>;
        };
        generateTextureFromParams: (params: unknown, w: number, h: number) => Uint32Array;
      };
      const client = createGeminiClient({ apiKey });
      const result = await client.predictTextureParams(prompt);
      if (result.success) {
        const pixels = generateTextureFromParams(result.data, 64, 64);
        const outPath = path.join(outDir, 'texture.ppm');
        await writePpm(outPath, 64, 64, pixels, Boolean(options.dryRun));
        logger.success(`Generated texture: ${outPath}`);
        return;
      }
    }

    if (type === 'scenario') {
      const { createGeminiClient } = aiModule as {
        createGeminiClient: (cfg: { apiKey: string }) => {
          predictScenarioLayout: (p: string) => Promise<{ success: boolean; data: unknown }>;
        };
      };
      const client = createGeminiClient({ apiKey });
      const result = await client.predictScenarioLayout(prompt);
      if (result.success) {
        const outPath = path.join(outDir, 'scenario.json');
        await writeJson(outPath, { prompt, layout: result.data }, Boolean(options.dryRun));
        logger.success(`Generated scenario: ${outPath}`);
        return;
      }
    }
  }

  logger.info('Falling back to procedural generation...');
  if (type === 'texture') {
    const outPath = await generateTextureFallback(prompt, outDir, Boolean(options.dryRun));
    logger.success(`Generated texture: ${outPath}`);
    return;
  }
  const outPath = await generateScenarioFallback(prompt, outDir, Boolean(options.dryRun));
  logger.success(`Generated scenario: ${outPath}`);
};
