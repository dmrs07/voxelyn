import type { PixelSprite } from '../types.js';
import type { Direction } from './direction.js';

export type ClipId = 'idle' | 'walk' | 'attack' | 'cast' | 'hit' | 'die';

export type FrameRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ClipManifest = {
  loop: boolean;
  framesPerDirection: number;
  durationMs: number;
  dirs: Record<Direction, FrameRect[]>;
};

export type AtlasManifest = {
  id: string;
  runtimeArchetype: 'player' | 'stalker' | 'bruiser' | 'spitter' | 'guardian' | 'spore_bomber';
  displayName: string;
  source: 'pixellab';
  version: 1;
  frameWidth: number;
  frameHeight: number;
  anchor: { x: number; y: number };
  directions: Direction[];
  clips: Partial<Record<ClipId, ClipManifest>>;
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

export type LoadedFrame = PixelSprite;

export type LoadedClip = {
  loop: boolean;
  durationMs: number;
  framesPerDirection: number;
  framesByDir: Record<Direction, LoadedFrame[]>;
};

export type LoadedAtlas = {
  manifest: AtlasManifest;
  clips: Partial<Record<ClipId, LoadedClip>>;
};
