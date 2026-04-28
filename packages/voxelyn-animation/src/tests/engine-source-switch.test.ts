import { beforeEach, describe, expect, it } from 'vitest';
import { createProceduralCharacter } from '../procedural/character.js';
import { clearAllLoadedAtlasesForTest, setLoadedAtlas } from '../sprite-atlas/cache.js';
import { AtlasMissingError } from '../sprite-atlas/errors.js';
import type { LoadedAtlas } from '../sprite-atlas/types.js';

const fakeLoadedAtlas = (id: string): LoadedAtlas => ({
  manifest: {
    id,
    runtimeArchetype: 'stalker',
    displayName: id,
    source: 'pixellab',
    version: 1,
    frameWidth: 48,
    frameHeight: 48,
    anchor: { x: 24, y: 43 },
    directions: ['DR', 'DL', 'UR', 'UL'],
    clips: {
      idle: {
        loop: true,
        framesPerDirection: 1,
        durationMs: 1000,
        dirs: {
          DR: [{ x: 0, y: 0, w: 48, h: 48 }],
          DL: [{ x: 0, y: 50, w: 48, h: 48 }],
          UR: [{ x: 0, y: 100, w: 48, h: 48 }],
          UL: [{ x: 0, y: 150, w: 48, h: 48 }],
        },
      },
    },
    generation: {
      conceptHash: '',
      promptHash: '',
      configHash: '',
      pipelineVersion: '1',
      atlasHash: '',
      generatedAt: '',
    },
  },
  clips: {
    idle: {
      loop: true,
      durationMs: 1000,
      framesPerDirection: 1,
      framesByDir: {
        DR: [{ width: 48, height: 48, pixels: new Uint32Array(48 * 48) }],
        DL: [{ width: 48, height: 48, pixels: new Uint32Array(48 * 48) }],
        UR: [{ width: 48, height: 48, pixels: new Uint32Array(48 * 48) }],
        UL: [{ width: 48, height: 48, pixels: new Uint32Array(48 * 48) }],
      },
    },
  },
});

const nodeEnv = (): Record<string, string | undefined> =>
  ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process!.env ??= {});

describe('createProceduralCharacter source switch', () => {
  beforeEach(() => {
    clearAllLoadedAtlasesForTest();
    nodeEnv().NODE_ENV = 'development';
  });

  it('returns a 48x48 PixelLab character when its atlas is preloaded', () => {
    setLoadedAtlas('striker', fakeLoadedAtlas('striker'));
    const character = createProceduralCharacter({
      id: 'enemy-1',
      style: 'stalker',
      source: 'pixellab',
      spriteId: 'striker',
    });

    expect(character.width).toBe(48);
    expect(character.height).toBe(48);
    expect(character.anchor).toEqual({ x: 24, y: 43 });
    expect(character.clips.idle).toBeDefined();
  });

  it('throws AtlasMissingError in development when a PixelLab atlas is missing', () => {
    expect(() =>
      createProceduralCharacter({
        id: 'enemy-1',
        style: 'stalker',
        source: 'pixellab',
        spriteId: 'striker',
      })
    ).toThrow(AtlasMissingError);
  });

  it('falls back in production when a PixelLab atlas is missing', () => {
    nodeEnv().NODE_ENV = 'production';
    const character = createProceduralCharacter({
      id: 'enemy-1',
      style: 'stalker',
      source: 'pixellab',
      spriteId: 'striker',
    });

    expect(character.width).toBe(16);
    expect(character.height).toBe(20);
    expect(character.anchor).toEqual({ x: 8, y: 20 });
  });
});
