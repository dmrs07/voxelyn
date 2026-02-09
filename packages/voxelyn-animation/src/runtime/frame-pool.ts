import type { PixelSprite } from '../types.js';

const keyOf = (w: number, h: number): string => `${w}x${h}`;

export type FramePool = {
  buckets: Map<string, PixelSprite[]>;
};

export const createFramePool = (): FramePool => ({
  buckets: new Map(),
});

export const acquireFrame = (pool: FramePool, width: number, height: number): PixelSprite => {
  const key = keyOf(width, height);
  const bucket = pool.buckets.get(key);
  if (bucket && bucket.length > 0) {
    const reused = bucket.pop();
    if (reused) return reused;
  }

  return {
    width,
    height,
    pixels: new Uint32Array(width * height),
  };
};

export const releaseFrame = (pool: FramePool, frame: PixelSprite): void => {
  const key = keyOf(frame.width, frame.height);
  const bucket = pool.buckets.get(key);
  if (bucket) {
    bucket.push(frame);
    return;
  }
  pool.buckets.set(key, [frame]);
};
