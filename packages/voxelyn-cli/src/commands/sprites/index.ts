import process from 'node:process';
import { runSpritesGenerate } from './generate.js';
import { createNodeFs } from './node-fs.js';
import { createPixelLabClient } from './pixellab-client.js';

export const runSprites = async (
  positionals: string[],
  options: { dryRun?: boolean; emitPlan?: boolean; force?: boolean; character?: string },
  log: (msg: string) => void
): Promise<void> => {
  const subcommand = positionals[0];
  if (subcommand !== 'generate') {
    log('Usage: voxelyn sprites generate [--character <id>] [--force] [--dry-run]');
    return;
  }

  await runSpritesGenerate({
    dryRun: Boolean(options.dryRun),
    force: Boolean(options.force),
    onlyId: options.character,
    log,
    emitPlan: Boolean(options.emitPlan),
    pixellab: createPixelLabClient(process.cwd()),
    fs: createNodeFs(process.cwd()),
    cwd: process.cwd(),
  });
};
