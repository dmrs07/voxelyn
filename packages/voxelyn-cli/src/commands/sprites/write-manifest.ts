import type { CharacterSpec, ClipId } from './config/types.js';
import type { Direction } from './generate.js';
import type { FrameRect } from './pack-atlas.js';

export type AtlasManifest = {
  id: string;
  runtimeArchetype: CharacterSpec['runtimeArchetype'];
  displayName: string;
  source: 'pixellab';
  version: 1;
  frameWidth: 48;
  frameHeight: 48;
  anchor: CharacterSpec['anchor'];
  directions: CharacterSpec['directions'];
  clips: Partial<
    Record<
      ClipId,
      {
        loop: boolean;
        framesPerDirection: number;
        durationMs: number;
        dirs: Record<Direction, FrameRect[]>;
      }
    >
  >;
  generation: {
    conceptHash: string;
    promptHash: string;
    configHash: string;
    pipelineVersion: string;
    atlasHash: string;
    pixellabModelVersion?: string;
    generatedAt: string;
  };
};

export type BuildManifestInput = {
  spec: CharacterSpec;
  rects: Partial<Record<ClipId, Record<Direction, FrameRect[]>>>;
  hashes: {
    conceptHash: string;
    promptHash: string;
    configHash: string;
    pipelineVersion: string;
    atlasHash: string;
    pixellabModelVersion?: string;
  };
  generatedAt: string;
};

export const buildManifest = (input: BuildManifestInput): AtlasManifest => {
  const clips: AtlasManifest['clips'] = {};
  for (const [clipId, clipSpec] of Object.entries(input.spec.clips) as [
    ClipId,
    NonNullable<CharacterSpec['clips'][ClipId]>,
  ][]) {
    const rects = input.rects[clipId];
    if (!rects) continue;
    clips[clipId] = {
      loop: clipSpec.loop,
      framesPerDirection: clipSpec.frames,
      durationMs: clipSpec.durationMs,
      dirs: rects,
    };
  }

  return {
    id: input.spec.id,
    runtimeArchetype: input.spec.runtimeArchetype,
    displayName: input.spec.displayName,
    source: 'pixellab',
    version: 1,
    frameWidth: 48,
    frameHeight: 48,
    anchor: input.spec.anchor,
    directions: input.spec.directions,
    clips,
    generation: {
      conceptHash: input.hashes.conceptHash,
      promptHash: input.hashes.promptHash,
      configHash: input.hashes.configHash,
      pipelineVersion: input.hashes.pipelineVersion,
      atlasHash: input.hashes.atlasHash,
      pixellabModelVersion: input.hashes.pixellabModelVersion,
      generatedAt: input.generatedAt,
    },
  };
};
