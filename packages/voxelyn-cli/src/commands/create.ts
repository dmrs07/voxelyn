import path from 'node:path';
import process from 'node:process';
import type { CliOptions } from '../types.js';
import { TEMPLATE_NAMES, getTemplate } from '../templates.js';
import { promptSelect, promptText, confirm } from '../prompts.js';
import { ensureWritableDir, isValidName, writeTemplateFiles } from '../fs.js';
import { initGit } from '../git.js';
import { formatInstallCommand, formatRunCommand, resolvePackageManager, runInstall } from '../pm.js';
import { CliError } from '../errors.js';
import type { Logger } from '../ui.js';

const defaultName = 'voxelyn-game';
const defaultTemplate = 'vanilla';

export const runCreate = async (
  options: CliOptions,
  positionals: string[],
  logger: Logger
): Promise<void> => {
  if (options.install && options.noInstall) {
    throw new CliError('ERR_CONFLICT_INSTALL', 'Use either --install or --no-install.');
  }

  let name = options.name ?? positionals[0];
  let templateName = options.template ?? positionals[1];

  if (!options.yes && process.stdin.isTTY) {
    if (!name) {
      name = await promptText('Project name (voxelyn-game): ', defaultName);
    }
    if (!templateName) {
      templateName = await promptSelect('Template', TEMPLATE_NAMES, defaultTemplate);
    }
  }

  if (!name) name = defaultName;
  if (!templateName) templateName = defaultTemplate;

  if (!isValidName(name)) {
    throw new CliError('ERR_INVALID_NAME', 'Invalid project name. Use a simple folder name without slashes.');
  }

  const template = getTemplate(templateName);
  if (!template) {
    throw new CliError('ERR_INVALID_TEMPLATE', `Unknown template: ${templateName}`);
  }

  const install = options.noInstall ? false : options.install ?? true;
  const targetDir = path.resolve(process.cwd(), name);

  await ensureWritableDir(targetDir, {
    force: Boolean(options.force),
    dryRun: Boolean(options.dryRun),
    yes: Boolean(options.yes),
    confirmOverwrite: () =>
      confirm(`Directory ${name} is not empty. Continue and overwrite?`, false)
  });

  logger.info(`Creating ${template.name} project in ${targetDir}`);
  await writeTemplateFiles(targetDir, template, name, Boolean(options.dryRun), logger.info);

  if (options.git) {
    initGit(targetDir, Boolean(options.dryRun), logger.info);
  }

  const pm = resolvePackageManager(options.pm);
  if (install) {
    const spinner = logger.spinner('Installing dependencies');
    try {
      runInstall(pm, targetDir, Boolean(options.dryRun), logger.info);
      spinner.stop('Dependencies installed');
    } catch (err) {
      spinner.fail('Install failed');
      throw err;
    }
  }

  logger.info('');
  logger.info('Summary:');
  logger.info(`  Template: ${template.name}`);
  logger.info(`  Directory: ${targetDir}`);
  logger.info(`  Package manager: ${pm}`);
  logger.info(`  Install: ${install ? 'yes' : 'no'}`);
  logger.info(`  Git init: ${options.git ? 'yes' : 'no'}`);
  logger.info(`  Dry run: ${options.dryRun ? 'yes' : 'no'}`);

  if (!install || options.dryRun) {
    logger.info('');
    logger.info('Next steps:');
    logger.info(`  cd ${name}`);
    logger.info(`  ${formatInstallCommand(pm)}`);
    logger.info(`  ${formatRunCommand(pm, 'dev')}`);
  }
};
