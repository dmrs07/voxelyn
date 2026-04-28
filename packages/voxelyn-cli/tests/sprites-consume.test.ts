import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CHARACTERS } from '../src/commands/sprites/config/characters.js';
import { runSpritesGenerate } from '../src/commands/sprites/generate.js';
import { PNG } from '../src/commands/sprites/pack-atlas.js';

const fakePngB64 = (): string => {
  const png = new PNG({ width: 48, height: 48 });
  png.data.fill(0);
  return Buffer.from(PNG.sync.write(png)).toString('base64');
};

const framesByDirection = (count: number): Record<'DR' | 'DL' | 'UR' | 'UL', string[]> => ({
  DR: Array.from({ length: count }, fakePngB64),
  DL: Array.from({ length: count }, fakePngB64),
  UR: Array.from({ length: count }, fakePngB64),
  UL: Array.from({ length: count }, fakePngB64),
});

test('consume mode produces atlas.png and atlas.json for striker', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'voxelyn-consume-'));
  const conceptDir = path.join(cwd, 'assets/concepts/characters');
  mkdirSync(conceptDir, { recursive: true });
  writeFileSync(path.join(conceptDir, 'striker.png'), Buffer.from([1]));
  mkdirSync(path.join(cwd, '.voxelyn-cache/pixellab-results'), { recursive: true });

  const spec = CHARACTERS.find((character) => character.id === 'striker')!;
  writeFileSync(
    path.join(cwd, '.voxelyn-cache/pixellab-plan.json'),
    JSON.stringify([
      {
        spriteId: 'striker',
        pixellabCharacterId: 'plab-1',
        conceptHash: 'will-be-overridden',
        conceptArtPath: 'assets/concepts/characters/striker.png',
        basePrompt: 'x',
        styleNotes: 'y',
        spec,
      },
    ])
  );
  writeFileSync(
    path.join(cwd, '.voxelyn-cache/pixellab-results/plab-1.json'),
    JSON.stringify({
      spriteId: 'striker',
      pixellabCharacterId: 'plab-1',
      frames: {
        idle: framesByDirection(6),
        walk: framesByDirection(8),
        attack: framesByDirection(8),
      },
    })
  );

  await runSpritesGenerate({
    dryRun: false,
    force: true,
    emitPlan: false,
    onlyId: 'striker',
    log: () => undefined,
    pixellab: { ensureCharacter: async () => 'plab-1', animate: async () => [] },
    fs: {
      readFile: async () => null,
      writeFileAtomic: async () => undefined,
      exists: async () => false,
      readJson: async () => undefined,
      writeJson: async () => undefined,
    },
    cwd,
  });

  assert.ok(existsSync(path.join(cwd, 'assets/sprites/characters/striker/striker.atlas.png')));
  const manifest = JSON.parse(
    readFileSync(path.join(cwd, 'assets/sprites/characters/striker/striker.atlas.json'), 'utf-8')
  );
  assert.equal(manifest.id, 'striker');
  assert.equal(manifest.frameWidth, 48);
  assert.equal(manifest.generation.atlasHash.length, 64);
});
