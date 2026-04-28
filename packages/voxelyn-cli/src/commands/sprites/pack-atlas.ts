import { createRequire } from 'node:module';
import type { ClipId } from './config/types.js';
import type { Direction } from './generate.js';

type PngImage = {
  width: number;
  height: number;
  data: Uint8Array;
};

type PngCtor = {
  new (opts: { width: number; height: number }): PngImage;
  sync: {
    write(image: PngImage): Buffer;
    read(bytes: Buffer): PngImage;
  };
};

const require = createRequire(import.meta.url);
export const PNG = (require('pngjs') as { PNG: PngCtor }).PNG;

export type FrameRect = { x: number; y: number; w: number; h: number };

export type RawFramesByClip = Partial<Record<ClipId, Record<Direction, Uint8Array[]>>>;

export type PackedAtlas = {
  imageWidth: number;
  imageHeight: number;
  rects: Partial<Record<ClipId, Record<Direction, FrameRect[]>>>;
  png: Uint8Array;
};

const FRAME = 48;
const GUTTER = 2;
const STRIDE = FRAME + GUTTER;
const DIRECTIONS: Direction[] = ['DR', 'DL', 'UR', 'UL'];
const CLIP_ORDER: ClipId[] = ['idle', 'walk', 'attack', 'cast', 'hit', 'die'];

export const packAtlas = (raw: RawFramesByClip): PackedAtlas => {
  const presentClips = CLIP_ORDER.filter((clipId) => raw[clipId]);
  let maxFramesPerDirection = 0;
  for (const clipId of presentClips) {
    for (const direction of DIRECTIONS) {
      maxFramesPerDirection = Math.max(maxFramesPerDirection, raw[clipId]![direction].length);
    }
  }

  const columns = maxFramesPerDirection;
  const rows = presentClips.length * DIRECTIONS.length;
  const imageWidth = columns * FRAME + Math.max(0, columns - 1) * GUTTER;
  const imageHeight = rows * FRAME + Math.max(0, rows - 1) * GUTTER;
  const png = new PNG({ width: imageWidth, height: imageHeight });
  png.data.fill(0);

  const rects: PackedAtlas['rects'] = {};
  let rowIndex = 0;
  for (const clipId of presentClips) {
    rects[clipId] = { DR: [], DL: [], UR: [], UL: [] };
    for (const direction of DIRECTIONS) {
      const frames = raw[clipId]![direction];
      for (let i = 0; i < frames.length; i += 1) {
        const dx = i * STRIDE;
        const dy = rowIndex * STRIDE;
        const src = frames[i]!;
        if (src.byteLength !== FRAME * FRAME * 4) {
          throw new Error(`${clipId}.${direction}[${i}] must be raw 48x48 RGBA bytes`);
        }
        for (let y = 0; y < FRAME; y += 1) {
          const srcOffset = y * FRAME * 4;
          const dstOffset = ((dy + y) * imageWidth + dx) * 4;
          png.data.set(src.subarray(srcOffset, srcOffset + FRAME * 4), dstOffset);
        }
        rects[clipId]![direction].push({ x: dx, y: dy, w: FRAME, h: FRAME });
      }
      rowIndex += 1;
    }
  }

  return {
    imageWidth,
    imageHeight,
    rects,
    png: new Uint8Array(PNG.sync.write(png)),
  };
};
