import { describe, expect, it } from 'vitest';
import { createProceduralCharacter, renderProceduralFrame } from '../procedural/character.js';
import { AUTHORED_SPRITES } from '../procedural/characters/authored/index.js';
import type { PixelSprite, ProceduralCharacter } from '../types.js';

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

const nonZeroCount = (pixels: Uint32Array): number => {
  let c = 0;
  for (let i = 0; i < pixels.length; i += 1) {
    if ((pixels[i] ?? 0) !== 0) c += 1;
  }
  return c;
};

const styles: Array<NonNullable<ProceduralCharacter['style']>> = [
  'player',
  'stalker',
  'bruiser',
  'spitter',
  'spore_bomber',
  'guardian',
];

describe('authored sprites', () => {
  it('registers a def for every procedural style', () => {
    for (const style of styles) {
      expect(AUTHORED_SPRITES[style]).toBeDefined();
      expect(AUTHORED_SPRITES[style].width).toBe(32);
      expect(AUTHORED_SPRITES[style].height).toBe(32);
    }
  });

  it('creates 32x32 characters when useAuthored is true', () => {
    for (const style of styles) {
      const ch = createProceduralCharacter({ id: `auth-${style}`, style, useAuthored: true, seed: 3 });
      expect(ch.width).toBe(32);
      expect(ch.height).toBe(32);
      expect(ch.clips.idle).toBeDefined();
      expect(ch.clips.walk).toBeDefined();
      expect(ch.clips.attack).toBeDefined();
      expect(ch.clips.hit).toBeDefined();
      expect(ch.clips.die).toBeDefined();
    }
  });

  it('falls back to procedural 16x20 when useAuthored is not set', () => {
    const ch = createProceduralCharacter({ id: 'proc', style: 'stalker', seed: 1 });
    expect(ch.width).toBe(16);
    expect(ch.height).toBe(20);
  });

  it('renders deterministic frames for a given (clip, tMs, facing)', () => {
    const ch = createProceduralCharacter({ id: 'hero', style: 'player', useAuthored: true, seed: 9 });
    const a = makeOut(32, 32);
    const b = makeOut(32, 32);
    renderProceduralFrame(ch, 'idle', 200, 'dr', a);
    renderProceduralFrame(ch, 'idle', 200, 'dr', b);
    expect(hashPixels(a.pixels)).toBe(hashPixels(b.pixels));
  });

  it('idle and attack produce different output for the same time and facing', () => {
    const ch = createProceduralCharacter({ id: 'guardian', style: 'guardian', useAuthored: true });
    const idle = makeOut(32, 32);
    const atk = makeOut(32, 32);
    renderProceduralFrame(ch, 'idle', 100, 'dr', idle);
    renderProceduralFrame(ch, 'attack', 100, 'dr', atk);
    expect(hashPixels(idle.pixels)).not.toBe(hashPixels(atk.pixels));
  });

  it('paints non-zero pixels for every authored style in idle state', () => {
    for (const style of styles) {
      const ch = createProceduralCharacter({ id: `paint-${style}`, style, useAuthored: true });
      const out = makeOut(32, 32);
      renderProceduralFrame(ch, 'idle', 50, 'dr', out);
      expect(nonZeroCount(out.pixels)).toBeGreaterThan(10);
    }
  });

  it('mirrors DL from DR (left-facing differs from right-facing for asymmetric poses)', () => {
    const ch = createProceduralCharacter({ id: 'mirror-stalker', style: 'stalker', useAuthored: true });
    const dr = makeOut(32, 32);
    const dl = makeOut(32, 32);
    renderProceduralFrame(ch, 'walk', 50, 'dr', dr);
    renderProceduralFrame(ch, 'walk', 50, 'dl', dl);
    expect(hashPixels(dr.pixels)).not.toBe(hashPixels(dl.pixels));
  });
});
