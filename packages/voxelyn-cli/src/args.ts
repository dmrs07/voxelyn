import type { CliOptions, CommandName, ParsedArgs } from './types.js';

const COMMAND_ALIASES: Record<string, CommandName> = {
  create: 'create',
  dev: 'dev',
  serve: 'dev',
  build: 'build',
  preview: 'preview'
};

const setCommand = (current: CommandName | undefined, next: CommandName): CommandName => {
  if (current && current !== next) {
    throw new Error('Multiple commands specified.');
  }
  return next;
};

export const parseArgs = (argv: string[]): ParsedArgs => {
  const options: CliOptions = {};
  let command: CommandName | undefined;
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (arg.startsWith('-')) {
      if (arg === '--create') {
        command = setCommand(command, 'create');
        continue;
      }
      if (arg === '--name' && argv[i + 1]) {
        options.name = argv[++i];
        continue;
      }
      if (arg.startsWith('--name=')) {
        options.name = arg.slice('--name='.length);
        continue;
      }
      if (arg === '--template' && argv[i + 1]) {
        options.template = argv[++i];
        continue;
      }
      if (arg.startsWith('--template=')) {
        options.template = arg.slice('--template='.length);
        continue;
      }
      if (arg === '--pm' && argv[i + 1]) {
        options.pm = argv[++i];
        continue;
      }
      if (arg.startsWith('--pm=')) {
        options.pm = arg.slice('--pm='.length);
        continue;
      }
      if (arg === '--yes' || arg === '-y') {
        options.yes = true;
        continue;
      }
      if (arg === '--force') {
        options.force = true;
        continue;
      }
      if (arg === '--git') {
        options.git = true;
        continue;
      }
      if (arg === '--dry-run') {
        options.dryRun = true;
        continue;
      }
      if (arg === '--list') {
        options.list = true;
        continue;
      }
      if (arg === '--help' || arg === '-h') {
        options.help = true;
        continue;
      }
      if (arg === '--install') {
        options.install = true;
        continue;
      }
      if (arg === '--no-install') {
        options.noInstall = true;
        continue;
      }
      continue;
    }

    const normalized = COMMAND_ALIASES[arg];
    if (normalized) {
      command = setCommand(command, normalized);
      continue;
    }

    positionals.push(arg);
  }

  return { command, options, positionals };
};

export const formatHelp = (): string => `Voxelyn CLI

Usage:
  voxelyn create <name> [template] [options]
  voxelyn dev [options]
  voxelyn build [options]
  voxelyn preview [options]
  voxelyn serve [options]
  voxelyn --list

Options:
  --name <dir>        Project folder name
  --template <name>   Template: vanilla | react | svelte
  --install           Force dependency install after create
  --no-install        Skip dependency install after create
  --list              List available templates
  --yes               Non-interactive defaults
  --force             Allow non-empty folder
  --pm <pm>           npm | pnpm | yarn | bun
  --git               Initialize git repo
  --dry-run           Print actions without writing
  --help              Show help

Examples:
  voxelyn create my-game vanilla
  voxelyn create my-game --no-install
  voxelyn dev
  voxelyn build
  voxelyn preview
`;
