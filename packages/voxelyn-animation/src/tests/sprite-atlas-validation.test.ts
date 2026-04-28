import { describe, expect, it } from 'vitest';
import { AtlasLoadError } from '../sprite-atlas/errors.js';
import type { AtlasManifest } from '../sprite-atlas/types.js';
import { validateManifest } from '../sprite-atlas/validate.js';

const okManifest = (): AtlasManifest => ({
  id: 'striker',
  runtimeArchetype: 'stalker',
  displayName: 'Striker',
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
    conceptHash: 'a',
    promptHash: 'b',
    configHash: 'c',
    pipelineVersion: '1',
    atlasHash: 'd',
    generatedAt: '2026-04-28T00:00:00Z',
  },
});

describe('validateManifest', () => {
  it('passes valid manifests', () => {
    expect(() => validateManifest('striker', okManifest(), 50, 200)).not.toThrow();
  });

  it('rejects wrong frame size', () => {
    const manifest = okManifest();
    manifest.frameWidth = 32;
    expect(() => validateManifest('striker', manifest, 50, 200)).toThrow(AtlasLoadError);
  });

  it('rejects wrong directions order', () => {
    const manifest = okManifest();
    manifest.directions = ['DL', 'DR', 'UR', 'UL'];
    expect(() => validateManifest('striker', manifest, 50, 200)).toThrow(AtlasLoadError);
  });

  it('rejects missing direction in clip dirs', () => {
    const manifest = okManifest();
    delete (manifest.clips.idle!.dirs as Record<string, unknown>).UL;
    expect(() => validateManifest('striker', manifest, 50, 200)).toThrow(AtlasLoadError);
  });

  it('rejects out-of-bounds rect', () => {
    const manifest = okManifest();
    manifest.clips.idle!.dirs.UL = [{ x: 100, y: 100, w: 48, h: 48 }];
    expect(() => validateManifest('striker', manifest, 50, 200)).toThrow(AtlasLoadError);
  });

  it('rejects rect with wrong size', () => {
    const manifest = okManifest();
    manifest.clips.idle!.dirs.UL = [{ x: 0, y: 150, w: 32, h: 48 }];
    expect(() => validateManifest('striker', manifest, 50, 200)).toThrow(AtlasLoadError);
  });

  it('rejects mismatched framesPerDirection vs rects.length', () => {
    const manifest = okManifest();
    manifest.clips.idle!.framesPerDirection = 2;
    expect(() => validateManifest('striker', manifest, 50, 200)).toThrow(AtlasLoadError);
  });

  it('rejects wrong source', () => {
    const manifest = okManifest();
    (manifest as unknown as { source: string }).source = 'authored';
    expect(() => validateManifest('striker', manifest, 50, 200)).toThrow(AtlasLoadError);
  });

  it('rejects wrong version', () => {
    const manifest = okManifest();
    (manifest as unknown as { version: number }).version = 2;
    expect(() => validateManifest('striker', manifest, 50, 200)).toThrow(AtlasLoadError);
  });
});
