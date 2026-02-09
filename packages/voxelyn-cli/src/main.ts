import process from 'node:process';
import { formatHelp, parseArgs } from './args.js';
import { listTemplates } from './templates.js';
import { runCreate } from './commands/create.js';
import { runDev } from './commands/dev.js';
import { runBuild } from './commands/build.js';
import { runPreview } from './commands/preview.js';

export const main = async (): Promise<void> => {
  const { command: parsedCommand, options, positionals } = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(formatHelp());
    return;
  }

  if (options.list) {
    listTemplates();
    return;
  }

  let command = parsedCommand;
  if (!command) {
    if (options.name || options.template) {
      command = 'create';
    }
  }

  if (!command) {
    console.log(formatHelp());
    return;
  }

  if (command === 'create') {
    await runCreate(options, positionals);
    return;
  }

  if (command === 'dev') {
    await runDev(options);
    return;
  }

  if (command === 'build') {
    await runBuild(options);
    return;
  }

  if (command === 'preview') {
    await runPreview(options);
    return;
  }
};
