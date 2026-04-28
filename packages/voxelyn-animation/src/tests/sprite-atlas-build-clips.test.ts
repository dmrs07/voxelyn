import { describe, expect, it } from 'vitest';
import { buildClipsFromAtlas } from '../sprite-atlas/build-clips.js';
import type { AtlasManifest } from '../sprite-atlas/types.js';

const W = 48;
const H = 48;

const makeImage = (width: number, height: number): Uint32Array => {
  const pixels = new Uint32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      pixels[y * width + x] = ((x & 0xff) | ((y & 0xff) << 8)) >>> 0;
    }
  }
  return pixels;
};

const makeManifest = (): AtlasManifest => ({
  id: 'fix',
  runtimeArchetype: 'stalker',
  displayName: 'fix',
  source: 'pixellab',
  version: 1,
  frameWidth: W,
  frameHeight: H,
  anchor: { x: 24, y: 43 },
  directions: ['DR', 'DL', 'UR', 'UL'],
  clips: {
    idle: {
      loop: true,
      framesPerDirection: 1,
      durationMs: 1000,
      dirs: {
        DR: [{ x: 0, y: 0, w: W, h: H }],
        DL: [{ x: 0, y: 50, w: W, h: H }],
        UR: [{ x: 0, y: 100, w: W, h: H }],
        UL: [{ x: 0, y: 150, w: W, h: H }],
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
});

describe('buildClipsFromAtlas', () => {
  it('extracts frames at the configured rects', () => {
    const decoded = { width: 50, height: 200, pixels: makeImage(50, 200) };
    const clips = buildClipsFromAtlas(makeManifest(), decoded);
    const idle = clips.idle!;

    expect(idle.framesByDir.DR).toHaveLength(1);
    expect(idle.framesByDir.DR[0]!.width).toBe(W);
    expect(idle.framesByDir.DR[0]!.height).toBe(H);
    expect(idle.framesByDir.DR[0]!.pixels[0]).toBe(decoded.pixels[0]);
    expect(idle.framesByDir.UL[0]!.pixels[0]).toBe(decoded.pixels[150 * 50]);
  });

  it('copies frame pixels instead of returning subarray views', () => {
    const decoded = { width: 50, height: 200, pixels: makeImage(50, 200) };
    const clips = buildClipsFromAtlas(makeManifest(), decoded);
    const frame = clips.idle!.framesByDir.DR[0]!;

    decoded.pixels[0] = 0xdeadbeef;

    expect(frame.pixels[0]).not.toBe(0xdeadbeef);
    expect(frame.pixels.buffer).not.toBe(decoded.pixels.buffer);
  });
});
