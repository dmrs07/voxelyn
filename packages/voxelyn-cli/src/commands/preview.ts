import process from 'node:process';
import type { CliOptions } from '../types.js';
import { readPackageScripts, resolvePackageManager, runScript } from '../pm.js';
import { CliError } from '../errors.js';
import type { Logger } from '../ui.js';

export const runPreview = async (options: CliOptions, logger: Logger): Promise<void> => {
  const scripts = await readPackageScripts(process.cwd());
  if (!scripts.preview) {
    throw new CliError('ERR_NO_SCRIPT', 'Missing script "preview" in package.json.');
  }
  const pm = resolvePackageManager(options.pm);
  logger.info(`Running preview with ${pm}...`);
  runScript(pm, 'preview', process.cwd(), Boolean(options.dryRun), logger.info);
};
