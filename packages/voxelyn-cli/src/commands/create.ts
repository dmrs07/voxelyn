import path from 'node:path';
import process from 'node:process';
import type { CliOptions } from '../types.js';
import { TEMPLATE_NAMES, getTemplate } from '../templates.js';
import { promptSelect, promptText, confirm } from '../prompts.js';
import { ensureWritableDir, isValidName, writeTemplateFiles } from '../fs.js';
import { initGit } from '../git.js';
import { formatInstallCommand, formatRunCommand, resolvePackageManager, runInstall } from '../pm.js';

const defaultName = 'voxelyn-game';
const defaultTemplate = 'vanilla';

export const runCreate = async (options: CliOptions, positionals: string[]): Promise<void> => {
  if (options.install && options.noInstall) {
    throw new Error('Use either --install or --no-install.');
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
    throw new Error('Invalid project name. Use a simple folder name without slashes.');
  }

  const template = getTemplate(templateName);
  if (!template) {
    throw new Error(`Unknown template: ${templateName}`);
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

  console.log(`Creating ${template.name} project in ${targetDir}`);
  await writeTemplateFiles(targetDir, template, name, Boolean(options.dryRun));

  if (options.git) {
    initGit(targetDir, Boolean(options.dryRun));
  }

  const pm = resolvePackageManager(options.pm);
  if (install) {
    runInstall(pm, targetDir, Boolean(options.dryRun));
  }

  console.log('');
  console.log('Summary:');
  console.log(`  Template: ${template.name}`);
  console.log(`  Directory: ${targetDir}`);
  console.log(`  Package manager: ${pm}`);
  console.log(`  Install: ${install ? 'yes' : 'no'}`);
  console.log(`  Git init: ${options.git ? 'yes' : 'no'}`);
  console.log(`  Dry run: ${options.dryRun ? 'yes' : 'no'}`);

  if (!install || options.dryRun) {
    console.log('');
    console.log('Next steps:');
    console.log(`  cd ${name}`);
    console.log(`  ${formatInstallCommand(pm)}`);
    console.log(`  ${formatRunCommand(pm, 'dev')}`);
  }
};
