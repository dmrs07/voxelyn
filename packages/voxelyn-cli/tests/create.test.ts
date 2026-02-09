import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { runCreate } from '../src/commands/create.js';
import { createLogger } from '../src/ui.js';

const logger = createLogger({ quiet: true, noColor: true });

test('create scaffolds files', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'voxelyn-cli-'));
  const cwd = process.cwd();
  process.chdir(root);

  try {
    await runCreate(
      { yes: true, noInstall: true, dryRun: false },
      ['demo', 'vanilla'],
      logger
    );

    const projectDir = path.join(root, 'demo');
    assert.equal(existsSync(path.join(projectDir, 'package.json')), true);
    assert.equal(existsSync(path.join(projectDir, '.gitignore')), true);
    assert.equal(existsSync(path.join(projectDir, 'src', 'main.ts')), true);
  } finally {
    process.chdir(cwd);
    await rm(root, { recursive: true, force: true });
  }
});
