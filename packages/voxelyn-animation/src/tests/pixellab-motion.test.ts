import { describe, expect, it } from 'vitest';
import { renderProceduralFrame } from '../procedural/character.js';
import { buildPixelLabCharacter } from '../procedural/pixellab-character.js';
import type { PixelSprite } from '../types.js';
import type { ClipId, LoadedAtlas, LoadedClip } from '../sprite-atlas/types.js';

const W = 48;
const H = 48;
const OPAQUE = 0xff223344;

const spriteWithBlock = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  color = OPAQUE
): PixelSprite => {
  const pixels = new Uint32Array(W * H);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      pixels[y * W + x] = color >>> 0;
    }
  }
  return { width: W, height: H, pixels };
};

const makeClip = (
  id: ClipId,
  durationMs: number,
  loop: boolean,
  framesPerDirection: number,
  frame: PixelSprite
): LoadedClip => ({
  loop,
  durationMs,
  framesPerDirection,
  framesByDir: {
    DR: Array.from({ length: framesPerDirection }, () => frame),
    DL: Array.from({ length: framesPerDirection }, () => frame),
    UR: Array.from({ length: framesPerDirection }, () => frame),
    UL: Array.from({ length: framesPerDirection }, () => frame),
  },
});

const atlasWith = (
  clips: Partial<Record<ClipId, LoadedClip>>,
  motion?: LoadedAtlas['manifest']['motion']
): LoadedAtlas => ({
  manifest: {
    id: 'motion-test',
    runtimeArchetype: 'stalker',
    displayName: 'Motion Test',
    source: motion === 'baked' ? 'gpt-sheet' : 'pixellab',
    motion,
    version: 1,
    frameWidth: W,
    frameHeight: H,
    anchor: { x: 24, y: 43 },
    directions: ['DR', 'DL', 'UR', 'UL'],
    clips: {},
    generation: {
      conceptHash: '',
      promptHash: '',
      configHash: '',
      pipelineVersion: '1',
      atlasHash: '',
      generatedAt: '',
    },
  },
  clips,
});

const blank = (): PixelSprite => ({ width: W, height: H, pixels: new Uint32Array(W * H) });

const hashSprite = (sprite: PixelSprite): number => {
  let hash = 2166136261;
  for (const pixel of sprite.pixels) {
    hash ^= pixel;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const nonZeroPixels = (sprite: PixelSprite): number[] =>
  Array.from(sprite.pixels).filter((pixel) => ((pixel >>> 24) & 0xff) !== 0);

const borderHasOpaquePixels = (sprite: PixelSprite): boolean => {
  for (let x = 0; x < sprite.width; x += 1) {
    if (((sprite.pixels[x] ?? 0) >>> 24) !== 0) return true;
    if (((sprite.pixels[(sprite.height - 1) * sprite.width + x] ?? 0) >>> 24) !== 0) return true;
  }
  for (let y = 0; y < sprite.height; y += 1) {
    if (((sprite.pixels[y * sprite.width] ?? 0) >>> 24) !== 0) return true;
    if (((sprite.pixels[y * sprite.width + sprite.width - 1] ?? 0) >>> 24) !== 0) return true;
  }
  return false;
};

describe('PixelLab motion wrapper', () => {
  it('adds visible walk motion even when atlas frames are static', () => {
    const source = spriteWithBlock(18, 18, 30, 43);
    const character = buildPixelLabCharacter(
      { id: 'striker', source: 'pixellab', spriteId: 'striker', style: 'stalker' },
      atlasWith({
        idle: makeClip('idle', 1000, true, 1, source),
        walk: makeClip('walk', 760, true, 8, source),
      })
    );

    const early = blank();
    const later = blank();
    renderProceduralFrame(character, 'walk', 0, 'dr', early);
    renderProceduralFrame(character, 'walk', 360, 'dr', later);

    expect(hashSprite(early)).not.toBe(hashSprite(later));
    expect(nonZeroPixels(early).length).toBeGreaterThan(0);
    expect(nonZeroPixels(later).length).toBeGreaterThan(0);
  });

  it('applies hit tint over PixelLab art', () => {
    const source = spriteWithBlock(20, 20, 28, 42);
    const character = buildPixelLabCharacter(
      { id: 'striker', source: 'pixellab', spriteId: 'striker', style: 'stalker' },
      atlasWith({
        idle: makeClip('idle', 1000, true, 1, source),
        hit: makeClip('hit', 220, false, 4, source),
      })
    );

    const out = blank();
    renderProceduralFrame(character, 'hit', 1, 'dr', out);
    const painted = nonZeroPixels(out);

    expect(painted.length).toBeGreaterThan(0);
    expect(painted.every((pixel) => (pixel & 0x00ffffff) === 0x00ffffff)).toBe(true);
  });

  it('keeps expanded attack poses inside the atlas frame', () => {
    const source = spriteWithBlock(1, 1, 46, 46);
    const character = buildPixelLabCharacter(
      { id: 'bruiser', source: 'pixellab', spriteId: 'bruiser', style: 'bruiser' },
      atlasWith({
        idle: makeClip('idle', 1000, true, 1, source),
        attack: makeClip('attack', 680, false, 8, source),
      })
    );

    const out = blank();
    renderProceduralFrame(character, 'attack', 300, 'dr', out);

    expect(nonZeroPixels(out).length).toBeGreaterThan(0);
    expect(borderHasOpaquePixels(out)).toBe(false);
  });

  it('does not add procedural motion over baked GPT sheet frames', () => {
    const source = spriteWithBlock(18, 18, 30, 43);
    const character = buildPixelLabCharacter(
      { id: 'striker', source: 'pixellab', spriteId: 'striker', style: 'stalker' },
      atlasWith({
        idle: makeClip('idle', 1000, true, 1, source),
        walk: makeClip('walk', 760, true, 8, source),
      }, 'baked')
    );

    const early = blank();
    const later = blank();
    renderProceduralFrame(character, 'walk', 0, 'dr', early);
    renderProceduralFrame(character, 'walk', 360, 'dr', later);

    expect(hashSprite(early)).toBe(hashSprite(later));
    expect(nonZeroPixels(early).length).toBeGreaterThan(0);
  });
});
