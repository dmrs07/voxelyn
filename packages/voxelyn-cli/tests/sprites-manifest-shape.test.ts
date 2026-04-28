import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../src/commands/sprites/config/characters.js';
import { buildManifest } from '../src/commands/sprites/write-manifest.js';

test('buildManifest produces a v1 manifest without pixellabCharacterId', () => {
  const spec = CHARACTERS.find((character) => character.id === 'striker')!;
  const manifest = buildManifest({
    spec,
    rects: {
      idle: {
        DR: [{ x: 0, y: 0, w: 48, h: 48 }],
        DL: [{ x: 0, y: 50, w: 48, h: 48 }],
        UR: [{ x: 0, y: 100, w: 48, h: 48 }],
        UL: [{ x: 0, y: 150, w: 48, h: 48 }],
      },
    },
    hashes: {
      conceptHash: 'a',
      promptHash: 'b',
      configHash: 'c',
      pipelineVersion: '1',
      atlasHash: 'd',
    },
    generatedAt: '2026-04-28T00:00:00Z',
  });

  assert.equal(manifest.id, 'striker');
  assert.equal(manifest.version, 1);
  assert.equal(manifest.source, 'pixellab');
  assert.equal(manifest.frameWidth, 48);
  assert.deepEqual(manifest.anchor, { x: 24, y: 43 });
  assert.equal(manifest.generation.atlasHash, 'd');
  assert.equal((manifest.generation as Record<string, unknown>).pixellabCharacterId, undefined);
});
