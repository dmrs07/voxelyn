import { describe, expect, it } from 'vitest';
import { importAseprite } from '../importers/aseprite.js';

const makeAtlas = () => {
  const width = 4;
  const height = 2;
  const pixels = new Uint32Array(width * height);
  // frame0 (0..1,0..1)
  pixels[0] = 0xff0000ff;
  pixels[1] = 0xff0000ff;
  pixels[4] = 0xff0000ff;
  pixels[5] = 0xff0000ff;
  // frame1 (2..3,0..1)
  pixels[2] = 0x00ff00ff;
  pixels[3] = 0x00ff00ff;
  pixels[6] = 0x00ff00ff;
  pixels[7] = 0x00ff00ff;
  return { width, height, pixels };
};

describe('import aseprite', () => {
  it('imports tags and creates normalized clip map', () => {
    const json = {
      frames: [
        { frame: { x: 0, y: 0, w: 2, h: 2 }, duration: 100 },
        { frame: { x: 2, y: 0, w: 2, h: 2 }, duration: 100 },
      ],
      meta: {
        frameTags: [
          { name: 'idle', from: 0, to: 0, direction: 'forward' },
          { name: 'walk', from: 0, to: 1, direction: 'forward' },
        ],
      },
    };

    const imported = importAseprite(json, makeAtlas());
    expect(imported.source).toBe('aseprite');
    expect(imported.clipMap.idle).toBeDefined();
    expect(imported.clipMap.walk).toBeDefined();
    expect(imported.set.idle).toBeDefined();
  });

  it('throws on invalid frame data', () => {
    const bad = {
      frames: [{ duration: 100 }],
    };
    expect(() => importAseprite(bad, makeAtlas())).toThrow();
  });
});
