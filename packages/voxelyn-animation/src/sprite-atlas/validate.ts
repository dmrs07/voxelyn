import { DIRECTIONS, type Direction } from './direction.js';
import { AtlasLoadError } from './errors.js';
import type { AtlasManifest, ClipId, ClipManifest, FrameRect } from './types.js';

const REQUIRED_FRAME_SIZE = 48;

const fail = (spriteId: string, reason: string): never => {
  throw new AtlasLoadError(spriteId, reason);
};

const isDirection = (value: unknown): value is Direction =>
  typeof value === 'string' && (DIRECTIONS as readonly string[]).includes(value);

const assertFiniteNumber = (spriteId: string, label: string, value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(spriteId, `${label} must be a finite number`);
  }
  return value as number;
};

const validateRect = (
  spriteId: string,
  clipId: ClipId,
  direction: Direction,
  index: number,
  rect: FrameRect,
  imageWidth: number,
  imageHeight: number
): void => {
  const x = assertFiniteNumber(spriteId, `${clipId}.${direction}[${index}].x`, rect.x);
  const y = assertFiniteNumber(spriteId, `${clipId}.${direction}[${index}].y`, rect.y);
  const w = assertFiniteNumber(spriteId, `${clipId}.${direction}[${index}].w`, rect.w);
  const h = assertFiniteNumber(spriteId, `${clipId}.${direction}[${index}].h`, rect.h);

  if (w !== REQUIRED_FRAME_SIZE || h !== REQUIRED_FRAME_SIZE) {
    fail(spriteId, `${clipId}.${direction}[${index}] wrong rect size`);
  }
  if (x < 0 || y < 0 || x + w > imageWidth || y + h > imageHeight) {
    fail(spriteId, `${clipId}.${direction}[${index}] rect out of image bounds`);
  }
};

const validateClip = (
  spriteId: string,
  clipId: ClipId,
  clip: ClipManifest,
  imageWidth: number,
  imageHeight: number
): void => {
  if (clip.framesPerDirection < 1) {
    fail(spriteId, `${clipId} framesPerDirection < 1`);
  }
  if (clip.durationMs <= 0) {
    fail(spriteId, `${clipId} durationMs <= 0`);
  }

  for (const direction of DIRECTIONS) {
    const rects = clip.dirs[direction];
    if (!Array.isArray(rects)) {
      fail(spriteId, `${clipId}.${direction} missing`);
    }
    if (rects.length !== clip.framesPerDirection) {
      fail(
        spriteId,
        `${clipId}.${direction} expected ${clip.framesPerDirection} rects, got ${rects.length}`
      );
    }
    for (let i = 0; i < rects.length; i += 1) {
      validateRect(spriteId, clipId, direction, i, rects[i]!, imageWidth, imageHeight);
    }
  }
};

export const validateManifest = (
  spriteId: string,
  manifest: AtlasManifest,
  imageWidth: number,
  imageHeight: number
): void => {
  if (manifest.source !== 'pixellab') {
    fail(spriteId, `unexpected source ${manifest.source}`);
  }
  if (manifest.version !== 1) {
    fail(spriteId, `unsupported version ${manifest.version}`);
  }
  if (manifest.frameWidth !== REQUIRED_FRAME_SIZE || manifest.frameHeight !== REQUIRED_FRAME_SIZE) {
    fail(spriteId, `expected 48x48 frames, got ${manifest.frameWidth}x${manifest.frameHeight}`);
  }
  if (
    manifest.directions.length !== DIRECTIONS.length ||
    manifest.directions.some((direction, index) => direction !== DIRECTIONS[index])
  ) {
    fail(spriteId, `directions must be exactly ${DIRECTIONS.join(',')}`);
  }
  if (!manifest.directions.every(isDirection)) {
    fail(spriteId, 'manifest contains an unknown direction');
  }
  if (
    !manifest.anchor ||
    typeof manifest.anchor.x !== 'number' ||
    typeof manifest.anchor.y !== 'number'
  ) {
    fail(spriteId, 'anchor must be {x,y} numbers');
  }

  const clipIds = Object.keys(manifest.clips) as ClipId[];
  if (clipIds.length === 0) {
    fail(spriteId, 'manifest has no clips');
  }

  for (const clipId of clipIds) {
    validateClip(spriteId, clipId, manifest.clips[clipId]!, imageWidth, imageHeight);
  }
};
