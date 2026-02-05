import { describe, expect, it } from 'vitest';
import { acquireFrame, createFramePool, releaseFrame } from '../runtime/frame-pool.js';

describe('frame pool', () => {
  it('reuses released frames', () => {
    const pool = createFramePool();
    const a = acquireFrame(pool, 8, 8);
    a.pixels[0] = 123;
    releaseFrame(pool, a);

    const b = acquireFrame(pool, 8, 8);
    expect(b).toBe(a);
  });

  it('creates independent buckets by size', () => {
    const pool = createFramePool();
    const a = acquireFrame(pool, 8, 8);
    const b = acquireFrame(pool, 16, 8);
    expect(a).not.toBe(b);
    expect(a.width).toBe(8);
    expect(b.width).toBe(16);
  });
});
