import test from 'node:test';
import assert from 'node:assert/strict';
import { runSpritesGenerate } from '../src/commands/sprites/generate.js';

const makeMemFs = () => ({
  readFile: async () => null,
  writeFileAtomic: async () => undefined,
  exists: async () => false,
  readJson: async () => undefined,
  writeJson: async () => undefined,
});

test('--dry-run lists planned actions and never invokes PixelLab', async () => {
  const log: string[] = [];
  const fakeClient = {
    ensureCharacter: async () => {
      throw new Error('must not be called');
    },
    animate: async () => {
      throw new Error('must not be called');
    },
  };

  await runSpritesGenerate({
    dryRun: true,
    force: false,
    emitPlan: false,
    onlyId: undefined,
    log: (message) => log.push(message),
    pixellab: fakeClient,
    fs: makeMemFs(),
    cwd: '/repo',
  });

  assert.ok(log.some((line) => line.includes('would generate')));
  assert.ok(log.some((line) => line.includes('excavator')));
});
