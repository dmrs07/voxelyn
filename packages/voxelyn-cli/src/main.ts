import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { formatHelp, parseArgs } from './args.js';
import { listTemplates } from './templates.js';
import { runCreate } from './commands/create.js';
import { runDev } from './commands/dev.js';
import { runBuild } from './commands/build.js';
import { runPreview } from './commands/preview.js';
import { runDeploy } from './commands/deploy.js';
import { runGenerate } from './commands/generate.js';
import { runPlugin } from './commands/plugin.js';
import { createLogger } from './ui.js';
import { loadPlugins } from './plugins.js';
import { readPackageJson } from './config.js';
import { CliError } from './errors.js';

const readCliVersion = async (): Promise<string> => {
  const start = fileURLToPath(import.meta.url);
  let dir = path.dirname(start);
  for (let i = 0; i < 5; i += 1) {
    const candidate = path.join(dir, 'package.json');
    if (existsSync(candidate)) {
      const pkg = await readPackageJson(dir).catch(() => null);
      if (pkg?.version) return pkg.version;
    }
    dir = path.dirname(dir);
  }
  return 'unknown';
};

export const main = async (): Promise<void> => {
  const parsed = parseArgs(process.argv.slice(2));
  const logger = createLogger({
    verbose: parsed.options.verbose,
    quiet: parsed.options.quiet,
    noColor: parsed.options.noColor
  });

  try {
    if (parsed.options.version) {
      const version = await readCliVersion();
      logger.info(`voxelyn ${version}`);
      return;
    }

    if (parsed.options.help) {
      logger.info(formatHelp());
      return;
    }

    if (parsed.options.list) {
      listTemplates(logger.info);
      return;
    }

    const pluginRegistry = await loadPlugins(process.cwd(), logger);

    let command = parsed.command;
    let positionals = [...parsed.positionals];
    const hasPluginCommand = Boolean(parsed.rawCommand && pluginRegistry.has(parsed.rawCommand));

    if (!command && parsed.rawCommand && !hasPluginCommand) {
      command = 'create';
      positionals = [parsed.rawCommand, ...positionals];
    }

    if (!command && !hasPluginCommand) {
      if (parsed.options.name || parsed.options.template) {
        command = 'create';
      }
    }

    if (!command && hasPluginCommand && parsed.rawCommand) {
      const handler = pluginRegistry.get(parsed.rawCommand);
      if (!handler) throw new CliError('ERR_PLUGIN', 'Plugin command not found.');
      await handler(parsed.options, positionals, logger);
      return;
    }

    if (!command) {
      logger.info(formatHelp());
      return;
    }

    if (command === 'create') {
      await runCreate(parsed.options, positionals, logger);
      return;
    }

    if (command === 'dev') {
      await runDev(parsed.options, logger);
      return;
    }

    if (command === 'build') {
      await runBuild(parsed.options, logger);
      return;
    }

    if (command === 'preview') {
      await runPreview(parsed.options, logger);
      return;
    }

    if (command === 'deploy') {
      await runDeploy(parsed.options, logger);
      return;
    }

    if (command === 'generate') {
      await runGenerate(parsed.options, positionals, logger);
      return;
    }

    if (command === 'plugin') {
      await runPlugin(parsed.options, positionals, logger);
      return;
    }
  } catch (err) {
    logger.error(logger.formatError(err));
    process.exitCode = 1;
  }
};
