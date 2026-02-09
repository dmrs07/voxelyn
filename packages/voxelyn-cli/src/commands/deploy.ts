import path from 'node:path';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import type { CliOptions } from '../types.js';
import { readVoxelynConfig } from '../config.js';
import { readPackageScripts, resolvePackageManager, runScript } from '../pm.js';
import { CliError } from '../errors.js';
import type { Logger } from '../ui.js';

const checkButler = (dryRun: boolean): void => {
  if (dryRun) return;
  const result = spawnSync('butler', ['-V'], { stdio: 'ignore' });
  if (result.error) {
    throw new CliError(
      'ERR_BUTLER_NOT_FOUND',
      'butler not found in PATH. Install from https://itch.io/docs/butler/'
    );
  }
};

export const runDeploy = async (options: CliOptions, logger: Logger): Promise<void> => {
  const config = await readVoxelynConfig(process.cwd());
  const itch = config.deploy?.itch ?? {};

  const user = itch.user;
  const game = itch.game;
  const channel = options.deployChannel ?? itch.channel ?? 'alpha';
  const dir = options.deployDir ?? itch.dir ?? 'dist';

  if (!user || !game) {
    throw new CliError(
      'ERR_CONFIG_MISSING',
      'Missing voxelyn.deploy.itch.user or voxelyn.deploy.itch.game in package.json.'
    );
  }

  if (options.deployBuild) {
    const scripts = await readPackageScripts(process.cwd());
    if (!scripts.build) {
      throw new CliError('ERR_NO_SCRIPT', 'Missing script "build" in package.json.');
    }
    const pm = resolvePackageManager(options.pm);
    const spinner = logger.spinner('Building before deploy');
    try {
      runScript(pm, 'build', process.cwd(), Boolean(options.dryRun), logger.info);
      spinner.stop('Build complete');
    } catch (err) {
      spinner.fail('Build failed');
      throw err;
    }
  }

  checkButler(Boolean(options.dryRun));

  const target = `${user}/${game}:${channel}`;
  const absDir = path.resolve(process.cwd(), dir);
  if (!existsSync(absDir)) {
    throw new CliError('ERR_DIR_NOT_FOUND', `Deploy directory not found: ${absDir}`);
  }

  if (options.dryRun) {
    logger.info(`[dry-run] butler push ${absDir} ${target}`);
    return;
  }

  const spinner = logger.spinner('Deploying with butler');
  const result = spawnSync('butler', ['push', absDir, target], { stdio: 'inherit' });
  if (result.error) {
    spinner.fail('Deploy failed');
    throw result.error;
  }
  spinner.stop('Deploy complete');
};
