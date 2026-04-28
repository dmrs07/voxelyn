import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAllLoadedAtlasesForTest, getLoadedAtlas } from '../sprite-atlas/cache.js';
import { setFetcherForTest } from '../sprite-atlas/fetcher.js';
import { loadCharacterAtlas } from '../sprite-atlas/load.js';
import { preloadCharacterAtlases } from '../sprite-atlas/preload.js';
import type { AtlasManifest } from '../sprite-atlas/types.js';

const baseManifest = (id: string): AtlasManifest => ({
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
    atlasHash: 'IGNORED',
    generatedAt: '',
  },
});

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const installFetcher = (id: string, opts: { delayMs?: number; fail?: boolean } = {}) => {
  setFetcherForTest({
    fetchManifest: async () => baseManifest(id),
    fetchAndDecodePng: async () => {
      if (opts.delayMs) await delay(opts.delayMs);
      if (opts.fail) throw new Error('fetch failed');
      return { width: 50, height: 200, pixels: new Uint32Array(50 * 200) };
    },
  });
};

describe('sprite atlas loading', () => {
  beforeEach(() => {
    clearAllLoadedAtlasesForTest();
    setFetcherForTest(undefined);
  });

  it('loadCharacterAtlas caches and returns', async () => {
    installFetcher('striker');
    const atlas = await loadCharacterAtlas('striker', '/assets');
    expect(atlas.manifest.id).toBe('striker');
    expect(getLoadedAtlas('striker')).toBe(atlas);
  });

  it('concurrent loads share the same in-flight promise', async () => {
    installFetcher('striker', { delayMs: 20 });
    const [a, b] = await Promise.all([
      loadCharacterAtlas('striker', '/assets'),
      loadCharacterAtlas('striker', '/assets'),
    ]);
    expect(a).toBe(b);
  });

  it('preloadCharacterAtlases strict throws on first failure', async () => {
    installFetcher('x', { fail: true });
    await expect(preloadCharacterAtlases(['x'], '/assets', { strict: true })).rejects.toThrow(
      /fetch failed/
    );
  });

  it('preloadCharacterAtlases non-strict swallows per-id failures', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    installFetcher('x', { fail: true });
    await preloadCharacterAtlases(['x'], '/assets', { strict: false });
    expect(getLoadedAtlas('x')).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
