import { describe, expect, it } from 'vitest';
import { createProceduralCharacter, renderProceduralFrame } from '../procedural/character.js';
import type { PixelSprite } from '../types.js';

const makeOut = (w: number, h: number): PixelSprite => ({
  width: w,
  height: h,
  pixels: new Uint32Array(w * h),
});

const hashPixels = (pixels: Uint32Array): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < pixels.length; i += 1) {
    h ^= pixels[i] ?? 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

describe('procedural generator', () => {
  it('is deterministic for same style/time/facing', () => {
    const ch = createProceduralCharacter({ id: 'hero', style: 'player', seed: 42 });
    const outA = makeOut(ch.width, ch.height);
    const outB = makeOut(ch.width, ch.height);

    renderProceduralFrame(ch, 'idle', 120, 'dr', outA);
    renderProceduralFrame(ch, 'idle', 120, 'dr', outB);

    expect(hashPixels(outA.pixels)).toBe(hashPixels(outB.pixels));
  });

  it('varies output between different times', () => {
    const ch = createProceduralCharacter({ id: 'enemy', style: 'spitter', seed: 7 });
    const outA = makeOut(ch.width, ch.height);
    const outB = makeOut(ch.width, ch.height);

    renderProceduralFrame(ch, 'walk', 40, 'ul', outA);
    renderProceduralFrame(ch, 'walk', 240, 'ul', outB);

    expect(hashPixels(outA.pixels)).not.toBe(hashPixels(outB.pixels));
  });
});
