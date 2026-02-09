import process from 'node:process';
import type { CliOptions } from '../types.js';
import { readPackageScripts, resolvePackageManager, runScript } from '../pm.js';

export const runBuild = async (options: CliOptions): Promise<void> => {
  const scripts = await readPackageScripts(process.cwd());
  if (!scripts.build) {
    throw new Error('Missing script "build" in package.json.');
  }
  const pm = resolvePackageManager(options.pm);
  runScript(pm, 'build', process.cwd(), Boolean(options.dryRun));
};
