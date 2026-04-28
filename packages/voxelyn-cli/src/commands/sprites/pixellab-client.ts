import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CharacterSpec, ClipId } from './config/types.js';
import type { Direction, PixelLabClient } from './generate.js';

export type PixellabPlanItem = {
  spriteId: string;
  pixellabCharacterId: string | null;
  conceptHash: string;
  conceptArtPath: string;
  basePrompt: string;
  styleNotes: string;
  spec: CharacterSpec;
};

export type PixellabResultFrames = {
  spriteId: string;
  pixellabCharacterId: string;
  frames: Partial<Record<ClipId, Record<Direction, string[]>>>;
};

export const PLAN_PATH = '.voxelyn-cache/pixellab-plan.json';
export const RESULTS_DIR = '.voxelyn-cache/pixellab-results';

export class PixellabPlanRequired extends Error {
  constructor(
    public readonly spec: CharacterSpec,
    public readonly conceptHash: string
  ) {
    super(`PixelLab plan missing for ${spec.id} (conceptHash=${conceptHash}). Run --emit-plan first.`);
    this.name = 'PixellabPlanRequired';
  }
}

export const readPixellabPlan = async (cwd: string): Promise<PixellabPlanItem[]> => {
  try {
    return JSON.parse(await readFile(path.join(cwd, PLAN_PATH), 'utf-8')) as PixellabPlanItem[];
  } catch {
    return [];
  }
};

export const readPixellabResult = async (
  cwd: string,
  pixellabCharacterId: string
): Promise<PixellabResultFrames> =>
  JSON.parse(
    await readFile(path.join(cwd, RESULTS_DIR, `${pixellabCharacterId}.json`), 'utf-8')
  ) as PixellabResultFrames;

export const createPixelLabClient = (cwd: string): PixelLabClient => ({
  async ensureCharacter(spec, conceptHash) {
    const plan = await readPixellabPlan(cwd);
    const found = plan.find(
      (item) => item.spriteId === spec.id && item.conceptHash === conceptHash
    );
    if (found?.pixellabCharacterId) return found.pixellabCharacterId;
    throw new PixellabPlanRequired(spec, conceptHash);
  },
  async animate() {
    throw new Error('PixelLab result files are consumed by runSpritesGenerate, not animate().');
  },
});
