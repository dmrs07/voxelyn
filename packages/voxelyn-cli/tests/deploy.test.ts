import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { runDeploy } from '../src/commands/deploy.js';
import { createLogger } from '../src/ui.js';

const logger = createLogger({ quiet: true, noColor: true });

test('deploy dry-run uses config', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'voxelyn-cli-'));
  const cwd = process.cwd();
  process.chdir(root);
  try {
    const pkg = {
      name: 'demo',
      version: '0.0.0',
      scripts: { build: 'echo build' },
      voxelyn: {
        deploy: {
          itch: {
            user: 'demoUser',
            game: 'demoGame',
            channel: 'alpha',
            dir: 'dist'
          }
        }
      }
    };
    await writeFile(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2));
    await mkdir(path.join(root, 'dist'), { recursive: true });

    await runDeploy({ dryRun: true }, logger);
  } finally {
    process.chdir(cwd);
    await rm(root, { recursive: true, force: true });
  }
});
