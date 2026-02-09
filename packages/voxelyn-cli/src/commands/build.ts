import process from 'node:process';
import type { CliOptions } from '../types.js';
import { readPackageScripts, resolvePackageManager, runScript } from '../pm.js';
import { CliError } from '../errors.js';
import type { Logger } from '../ui.js';

export const runBuild = async (options: CliOptions, logger: Logger): Promise<void> => {
  const scripts = await readPackageScripts(process.cwd());
  if (!scripts.build) {
    throw new CliError('ERR_NO_SCRIPT', 'Missing script "build" in package.json.');
  }
  const pm = resolvePackageManager(options.pm);
  const spinner = logger.spinner('Building project');
  try {
    runScript(pm, 'build', process.cwd(), Boolean(options.dryRun), logger.info);
    spinner.stop('Build complete');
  } catch (err) {
    spinner.fail('Build failed');
    throw err;
  }
};
