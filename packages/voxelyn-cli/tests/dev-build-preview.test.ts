import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { runDev } from '../src/commands/dev.js';
import { runBuild } from '../src/commands/build.js';
import { runPreview } from '../src/commands/preview.js';
import { createLogger } from '../src/ui.js';

const logger = createLogger({ quiet: true, noColor: true });

const setupProject = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'voxelyn-cli-'));
  const pkg = {
    name: 'demo',
    version: '0.0.0',
    scripts: {}
  };
  await writeFile(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2));
  return root;
};

test('dev/build/preview error when script missing', async () => {
  const root = await setupProject();
  const cwd = process.cwd();
  process.chdir(root);
  try {
    await assert.rejects(() => runDev({}, logger), (err: any) => err.code === 'ERR_NO_SCRIPT');
    await assert.rejects(() => runBuild({}, logger), (err: any) => err.code === 'ERR_NO_SCRIPT');
    await assert.rejects(() => runPreview({}, logger), (err: any) => err.code === 'ERR_NO_SCRIPT');
  } finally {
    process.chdir(cwd);
    await rm(root, { recursive: true, force: true });
  }
});
