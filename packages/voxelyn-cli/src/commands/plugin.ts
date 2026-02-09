import process from 'node:process';
import type { CliOptions } from '../types.js';
import type { Logger } from '../ui.js';
import { readPackageJson, writePackageJson } from '../config.js';
import { resolvePackageManager, runAdd, runRemove } from '../pm.js';
import { CliError } from '../errors.js';

export const runPlugin = async (
  options: CliOptions,
  positionals: string[],
  logger: Logger
): Promise<void> => {
  const action = positionals[0] ?? 'list';
  const name = positionals[1];

  const pkg = await readPackageJson(process.cwd());
  const voxelyn = (pkg.voxelyn ?? {}) as { plugins?: string[] };
  const plugins = new Set(voxelyn.plugins ?? []);

  if (action === 'list') {
    if (plugins.size === 0) {
      logger.info('No plugins installed.');
      return;
    }
    logger.info('Plugins:');
    for (const plugin of plugins) logger.info(`- ${plugin}`);
    return;
  }

  if (action === 'add') {
    if (!name) throw new CliError('ERR_PLUGIN', 'Missing plugin name.');
    if (plugins.has(name)) {
      logger.warn(`Plugin already registered: ${name}`);
    } else {
      plugins.add(name);
    }
    voxelyn.plugins = Array.from(plugins);
    pkg.voxelyn = voxelyn;
    if (options.dryRun) {
      logger.info(`[dry-run] add plugin ${name}`);
    } else {
      await writePackageJson(process.cwd(), pkg);
    }
    const pm = resolvePackageManager(options.pm);
    runAdd(pm, [name], process.cwd(), Boolean(options.dryRun), logger.info);
    logger.success(`Plugin added: ${name}`);
    return;
  }

  if (action === 'remove') {
    if (!name) throw new CliError('ERR_PLUGIN', 'Missing plugin name.');
    if (!plugins.has(name)) {
      logger.warn(`Plugin not registered: ${name}`);
    }
    plugins.delete(name);
    voxelyn.plugins = Array.from(plugins);
    pkg.voxelyn = voxelyn;
    if (options.dryRun) {
      logger.info(`[dry-run] remove plugin ${name}`);
    } else {
      await writePackageJson(process.cwd(), pkg);
    }
    const pm = resolvePackageManager(options.pm);
    runRemove(pm, [name], process.cwd(), Boolean(options.dryRun), logger.info);
    logger.success(`Plugin removed: ${name}`);
    return;
  }

  throw new CliError('ERR_PLUGIN', `Unknown plugin action: ${action}`);
};
