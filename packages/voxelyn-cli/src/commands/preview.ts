import process from 'node:process';
import type { CliOptions } from '../types.js';
import { readPackageScripts, resolvePackageManager, runScript } from '../pm.js';

export const runPreview = async (options: CliOptions): Promise<void> => {
  const scripts = await readPackageScripts(process.cwd());
  if (!scripts.preview) {
    throw new Error('Missing script "preview" in package.json.');
  }
  const pm = resolvePackageManager(options.pm);
  runScript(pm, 'preview', process.cwd(), Boolean(options.dryRun));
};
