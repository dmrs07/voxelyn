import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runSpritesGenerate } from '../src/commands/sprites/generate.js';

const makeMemFs = () => ({
  readFile: async () => null,
  writeFileAtomic: async () => undefined,
  exists: async () => false,
  readJson: async () => undefined,
  writeJson: async () => undefined,
});

test('--emit-plan writes pixellab-plan.json with all 6 entries', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'voxelyn-plan-'));
  const conceptDir = path.join(cwd, 'assets/concepts/characters');
  mkdirSync(conceptDir, { recursive: true });
  for (const id of ['excavator', 'striker', 'bruiser', 'spitter', 'spore_bomber', 'guardian']) {
    writeFileSync(path.join(conceptDir, `${id}.png`), Buffer.from([0, 1, 2]));
  }

  await runSpritesGenerate({
    dryRun: false,
    force: false,
    emitPlan: true,
    onlyId: undefined,
    log: () => undefined,
    pixellab: { ensureCharacter: async () => '', animate: async () => [] },
    fs: makeMemFs(),
    cwd,
  });

  const plan = JSON.parse(
    readFileSync(path.join(cwd, '.voxelyn-cache/pixellab-plan.json'), 'utf-8')
  ) as unknown[];
  assert.equal(plan.length, 6);
});
