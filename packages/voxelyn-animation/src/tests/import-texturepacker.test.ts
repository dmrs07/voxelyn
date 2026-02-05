import { describe, expect, it } from 'vitest';
import { importTexturePacker } from '../importers/texturepacker.js';

const makeAtlas = () => {
  const width = 4;
  const height = 2;
  const pixels = new Uint32Array(width * height);
  for (let i = 0; i < pixels.length; i += 1) {
    pixels[i] = (i % 2 === 0 ? 0x8899aaff : 0x445566ff) >>> 0;
  }
  return { width, height, pixels };
};

describe('import texturepacker', () => {
  it('groups frames by clip prefix', () => {
    const json = {
      frames: {
        'walk_0.png': { frame: { x: 0, y: 0, w: 2, h: 2 }, duration: 80 },
        'walk_1.png': { frame: { x: 2, y: 0, w: 2, h: 2 }, duration: 80 },
        'idle_0.png': { frame: { x: 0, y: 0, w: 2, h: 2 }, duration: 120 },
      },
    };

    const imported = importTexturePacker(json, makeAtlas());
    expect(imported.source).toBe('texturepacker');
    expect(imported.clipMap.walk).toBeDefined();
    expect(imported.clipMap.idle).toBeDefined();
  });

  it('throws for malformed texturepacker payload', () => {
    expect(() => importTexturePacker({ frames: [] }, makeAtlas())).toThrow();
  });
});
