import { DIRECTIONS, type Direction } from './direction.js';
import { AtlasLoadError } from './errors.js';
import type { AtlasManifest, ClipId, ClipManifest, FrameRect } from './types.js';

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
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
): void => {
  const x = assertFiniteNumber(spriteId, `${clipId}.${direction}[${index}].x`, rect.x);
  const y = assertFiniteNumber(spriteId, `${clipId}.${direction}[${index}].y`, rect.y);
  const w = assertFiniteNumber(spriteId, `${clipId}.${direction}[${index}].w`, rect.w);
  const h = assertFiniteNumber(spriteId, `${clipId}.${direction}[${index}].h`, rect.h);

  if (w !== frameWidth || h !== frameHeight) {
    fail(
      spriteId,
      `${clipId}.${direction}[${index}] wrong rect size, expected ${frameWidth}x${frameHeight}`,
    );
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
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
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
        `${clipId}.${direction} expected ${clip.framesPerDirection} rects, got ${rects.length}`,
      );
    }
    for (let i = 0; i < rects.length; i += 1) {
      validateRect(
        spriteId,
        clipId,
        direction,
        i,
        rects[i]!,
        imageWidth,
        imageHeight,
        frameWidth,
        frameHeight,
      );
    }
  }
};

export const validateManifest = (
  spriteId: string,
  manifest: AtlasManifest,
  imageWidth: number,
  imageHeight: number,
): void => {
  if (
    manifest.source !== 'pixellab' &&
    manifest.source !== 'gpt-sheet' &&
    manifest.source !== 'spritesheetgen' &&
    manifest.source !== 'spritesheet-v2'
  ) {
    fail(spriteId, `unexpected source ${manifest.source}`);
  }
  if (
    manifest.motion !== undefined &&
    manifest.motion !== 'procedural' &&
    manifest.motion !== 'baked'
  ) {
    fail(spriteId, `unexpected motion ${manifest.motion}`);
  }
  if (manifest.version !== 1) {
    fail(spriteId, `unsupported version ${manifest.version}`);
  }
  const frameWidth = assertFiniteNumber(spriteId, 'frameWidth', manifest.frameWidth);
  const frameHeight = assertFiniteNumber(spriteId, 'frameHeight', manifest.frameHeight);
  if (frameWidth < 1 || frameHeight < 1) {
    fail(spriteId, `frame size must be positive, got ${frameWidth}x${frameHeight}`);
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
  if (
    manifest.anchor.x < 0 ||
    manifest.anchor.y < 0 ||
    manifest.anchor.x > frameWidth ||
    manifest.anchor.y > frameHeight
  ) {
    fail(spriteId, 'anchor must be inside frame bounds');
  }

  const clipIds = Object.keys(manifest.clips) as ClipId[];
  if (clipIds.length === 0) {
    fail(spriteId, 'manifest has no clips');
  }

  for (const clipId of clipIds) {
    validateClip(
      spriteId,
      clipId,
      manifest.clips[clipId]!,
      imageWidth,
      imageHeight,
      frameWidth,
      frameHeight,
    );
  }
};
