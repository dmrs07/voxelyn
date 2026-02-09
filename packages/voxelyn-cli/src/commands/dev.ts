import process from 'node:process';
import type { CliOptions } from '../types.js';
import { readPackageScripts, resolvePackageManager, runScript } from '../pm.js';

export const runDev = async (options: CliOptions): Promise<void> => {
  const scripts = await readPackageScripts(process.cwd());
  if (!scripts.dev) {
    throw new Error('Missing script "dev" in package.json.');
  }
  const pm = resolvePackageManager(options.pm);
  runScript(pm, 'dev', process.cwd(), Boolean(options.dryRun));
};
