import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pickPixellabId, readPixellabIdCache } from './cache.js';
import { CHARACTERS } from './config/characters.js';
import type { CharacterSpec, ClipId } from './config/types.js';
import { sha256Bytes, sha256CanonicalJson, sha256File } from './hash.js';
import { packAtlas, PNG, type RawFramesByClip } from './pack-atlas.js';
import { PIPELINE_VERSION } from './pipeline-version.js';
import {
  PLAN_PATH,
  readPixellabPlan,
  readPixellabResult,
  type PixellabPlanItem,
} from './pixellab-client.js';
import { buildManifest } from './write-manifest.js';
import { writeAtomic } from './atomic-write.js';

export type Direction = CharacterSpec['directions'][number];

export type SpritesFs = {
  readFile(path: string): Promise<Uint8Array | null>;
  writeFileAtomic(path: string, bytes: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  readJson<T>(path: string): Promise<T | undefined>;
  writeJson(path: string, value: unknown): Promise<void>;
};

export type PixelLabClient = {
  ensureCharacter(spec: CharacterSpec, conceptHash: string): Promise<string>;
  animate(args: {
    pixellabCharacterId: string;
    direction: Direction;
    intent: string;
    frameCount: number;
    size: 48;
  }): Promise<Uint8Array[]>;
};

export type RunSpritesGenerateInput = {
  dryRun: boolean;
  force: boolean;
  emitPlan?: boolean;
  onlyId: string | undefined;
  log: (msg: string) => void;
  pixellab: PixelLabClient;
  fs: SpritesFs;
  cwd: string;
};

const DIRECTIONS: Direction[] = ['DR', 'DL', 'UR', 'UL'];

const toBase64Payload = (value: string): string => {
  const comma = value.indexOf(',');
  if (value.startsWith('data:') && comma >= 0) return value.slice(comma + 1);
  return value;
};

const decodeFramePng = (
  spriteId: string,
  clipId: ClipId,
  direction: Direction,
  frameIndex: number,
  encoded: string
): Uint8Array => {
  const png = PNG.sync.read(Buffer.from(toBase64Payload(encoded), 'base64'));
  if (png.width !== 48 || png.height !== 48) {
    throw new Error(`${spriteId} ${clipId}.${direction}[${frameIndex}] is ${png.width}x${png.height}, expected 48x48`);
  }
  return new Uint8Array(png.data);
};

const emitPlanForSpecs = async (
  input: RunSpritesGenerateInput,
  specs: CharacterSpec[]
): Promise<void> => {
  const cacheFile = path.join(input.cwd, '.voxelyn-cache/pixellab-character-ids.json');
  const cache = await readPixellabIdCache(cacheFile);
  const existing = await readPixellabPlan(input.cwd);
  const nextById = new Map(existing.map((item) => [item.spriteId, item]));

  for (const spec of specs) {
    const conceptHash = sha256File(path.join(input.cwd, spec.conceptArtPath));
    const pixellabCharacterId = pickPixellabId(cache, spec.id, conceptHash) ?? null;
    const planItem: PixellabPlanItem = {
      spriteId: spec.id,
      pixellabCharacterId,
      conceptHash,
      conceptArtPath: spec.conceptArtPath,
      basePrompt: spec.basePrompt,
      styleNotes: spec.styleNotes,
      spec,
    };
    nextById.set(spec.id, planItem);
    input.log(`[sprites] plan: ${spec.id} (${pixellabCharacterId ? 'reuse' : 'create'} character)`);
  }

  const planFile = path.join(input.cwd, PLAN_PATH);
  await mkdir(path.dirname(planFile), { recursive: true });
  await writeFile(planFile, JSON.stringify([...nextById.values()], null, 2));
};

const readRawFramesFromResult = async (
  input: RunSpritesGenerateInput,
  spec: CharacterSpec,
  planItem: PixellabPlanItem
): Promise<RawFramesByClip> => {
  if (!planItem.pixellabCharacterId) {
    throw new Error(`${spec.id} plan item does not have pixellabCharacterId`);
  }
  const result = await readPixellabResult(input.cwd, planItem.pixellabCharacterId);
  const raw: RawFramesByClip = {};

  for (const [clipId, clipSpec] of Object.entries(spec.clips) as [
    ClipId,
    NonNullable<CharacterSpec['clips'][ClipId]>,
  ][]) {
    const dirMap = result.frames[clipId];
    if (!dirMap) throw new Error(`${spec.id} result missing clip '${clipId}'`);
    raw[clipId] = { DR: [], DL: [], UR: [], UL: [] };
    for (const direction of DIRECTIONS) {
      const frames = dirMap[direction] ?? [];
      if (frames.length !== clipSpec.frames) {
        throw new Error(
          `${spec.id} ${clipId}.${direction} has ${frames.length} frames, expected ${clipSpec.frames}`
        );
      }
      raw[clipId]![direction] = frames.map((frame, index) =>
        decodeFramePng(spec.id, clipId, direction, index, frame)
      );
    }
  }

  return raw;
};

const consumeResultsForSpecs = async (
  input: RunSpritesGenerateInput,
  specs: CharacterSpec[]
): Promise<void> => {
  const plan = await readPixellabPlan(input.cwd);
  if (plan.length === 0) {
    input.log('[sprites] no plan; run with --emit-plan first');
    return;
  }

  for (const spec of specs) {
    const planItem = plan.find((item) => item.spriteId === spec.id);
    if (!planItem?.pixellabCharacterId) {
      input.log(`[sprites] skip ${spec.id} (no plan/result)`);
      continue;
    }

    const raw = await readRawFramesFromResult(input, spec, planItem);
    const packed = packAtlas(raw);
    const conceptHash = sha256File(path.join(input.cwd, spec.conceptArtPath));
    const configHash = sha256CanonicalJson(spec);
    const promptHash = sha256Bytes(new TextEncoder().encode(`${spec.basePrompt}\n${spec.styleNotes}`));
    const atlasHash = sha256Bytes(packed.png);
    const manifest = buildManifest({
      spec,
      rects: packed.rects,
      hashes: {
        conceptHash,
        promptHash,
        configHash,
        pipelineVersion: PIPELINE_VERSION,
        atlasHash,
      },
      generatedAt: new Date().toISOString(),
    });

    const outputDir = path.join(input.cwd, 'assets/sprites/characters', spec.id);
    const manifestPath = path.join(outputDir, `${spec.id}.atlas.json`);
    const existingRaw = await readFile(manifestPath, 'utf-8').catch(() => null);
    if (!input.force && existingRaw) {
      try {
        const existing = JSON.parse(existingRaw) as {
          generation?: Record<string, unknown>;
        };
        const same =
          existing.generation?.conceptHash === conceptHash &&
          existing.generation?.configHash === configHash &&
          existing.generation?.promptHash === promptHash &&
          existing.generation?.pipelineVersion === PIPELINE_VERSION;
        if (same) {
          input.log(`[sprites] skip ${spec.id}: up to date`);
          continue;
        }
      } catch {
        // Malformed existing manifests are overwritten below.
      }
    }

    await writeAtomic(path.join(outputDir, `${spec.id}.atlas.png`), packed.png);
    await writeAtomic(manifestPath, new TextEncoder().encode(JSON.stringify(manifest, null, 2)));
    input.log(
      `[sprites] wrote ${spec.id}: ${packed.imageWidth}x${packed.imageHeight}, atlasHash=${atlasHash.slice(0, 12)}...`
    );
  }
};

export const runSpritesGenerate = async (input: RunSpritesGenerateInput): Promise<void> => {
  const specs = input.onlyId
    ? CHARACTERS.filter((character) => character.id === input.onlyId)
    : CHARACTERS;

  if (input.onlyId && specs.length === 0) {
    throw new Error(`Unknown sprite character '${input.onlyId}'`);
  }

  for (const spec of specs) {
    if (input.dryRun) {
      input.log(`[sprites] would generate ${spec.id} (clips: ${Object.keys(spec.clips).join(',')})`);
      continue;
    }
  }

  if (input.dryRun) return;
  if (input.emitPlan) {
    await emitPlanForSpecs(input, specs);
    return;
  }

  await consumeResultsForSpecs(input, specs);
};
