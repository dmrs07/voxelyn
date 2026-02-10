export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';
export type TemplateName = 'vanilla' | 'react' | 'svelte';
export type PresetCommand = 'dev' | 'build' | 'preview' | 'serve';
export type PluginAction = 'add' | 'remove' | 'list';

export type GlobalFlags = {
  verbose?: boolean;
  quiet?: boolean;
  dryRun?: boolean;
  noColor?: boolean;
};

export type CreateCommandInput = GlobalFlags & {
  name: string;
  template: TemplateName;
  pm?: PackageManager | '';
  yes?: boolean;
  force?: boolean;
  git?: boolean;
  installMode?: 'default' | 'install' | 'no-install';
};

export type GenerateCommandInput = GlobalFlags & {
  type: string;
  prompt: string;
  provider?: string;
  model?: string;
  seed?: number | '';
  size?: string;
  textureSize?: string;
  depth?: number | '';
  scale?: number | '';
  detail?: 'low' | 'medium' | 'high' | '';
  maxVoxels?: number | '';
  quality?: 'fast' | 'balanced' | 'high' | 'ultra' | '';
  attempts?: number | '';
  minScore?: number | '';
  modelEscalation?: 'default' | 'on' | 'off';
  allowBase?: boolean;
  strictQuality?: boolean;
  outFormat?: 'bundle' | 'layout' | 'terrain-spec' | '';
  enhancedTerrain?: 'default' | 'on' | 'off';
  workers?: string;
  intentMode?: 'fast' | 'balanced' | 'deep' | '';
  intentStrict?: boolean;
  autoView?: 'default' | 'on' | 'off';
  debugAi?: boolean;
};

export type DeployCommandInput = GlobalFlags & {
  dir?: string;
  channel?: string;
  build?: boolean;
};

export type PluginCommandInput = GlobalFlags & {
  action: PluginAction;
  name?: string;
};

export type PresetCommandInput = GlobalFlags & {
  command: PresetCommand;
};

const pushGlobalFlags = (args: string[], flags: GlobalFlags): void => {
  if (flags.verbose && !flags.quiet) args.push('--verbose');
  if (flags.quiet && !flags.verbose) args.push('--quiet');
  if (flags.dryRun) args.push('--dry-run');
  if (flags.noColor) args.push('--no-color');
};

const appendValue = (args: string[], flag: string, value: string | number | undefined | null | ''): void => {
  if (value === undefined || value === null || value === '') return;
  args.push(flag, String(value));
};

export const buildCreateArgs = (input: CreateCommandInput): string[] => {
  const args = ['create', input.name.trim(), input.template];
  if (input.pm) appendValue(args, '--pm', input.pm);
  if (input.yes) args.push('--yes');
  if (input.force) args.push('--force');
  if (input.git) args.push('--git');
  if (input.installMode === 'install') args.push('--install');
  if (input.installMode === 'no-install') args.push('--no-install');
  pushGlobalFlags(args, input);
  return args;
};

export const buildGenerateArgs = (input: GenerateCommandInput): string[] => {
  const args = ['generate', input.type.trim(), '--prompt', input.prompt.trim()];
  appendValue(args, '--provider', input.provider);
  appendValue(args, '--model', input.model);
  appendValue(args, '--seed', input.seed === '' ? undefined : input.seed);
  appendValue(args, '--size', input.size);
  appendValue(args, '--texture-size', input.textureSize);
  appendValue(args, '--depth', input.depth === '' ? undefined : input.depth);
  appendValue(args, '--scale', input.scale === '' ? undefined : input.scale);
  appendValue(args, '--detail', input.detail);
  appendValue(args, '--max-voxels', input.maxVoxels === '' ? undefined : input.maxVoxels);
  appendValue(args, '--quality', input.quality);
  appendValue(args, '--attempts', input.attempts === '' ? undefined : input.attempts);
  appendValue(args, '--min-score', input.minScore === '' ? undefined : input.minScore);
  if (input.modelEscalation === 'on') args.push('--model-escalation', 'on');
  if (input.modelEscalation === 'off') args.push('--model-escalation', 'off');
  if (input.allowBase) args.push('--allow-base');
  if (input.strictQuality) args.push('--strict-quality');
  appendValue(args, '--out-format', input.outFormat);
  if (input.enhancedTerrain === 'on') args.push('--enhanced-terrain');
  if (input.enhancedTerrain === 'off') args.push('--no-enhanced-terrain');
  appendValue(args, '--workers', input.workers);
  appendValue(args, '--intent-mode', input.intentMode);
  if (input.intentStrict) args.push('--intent-strict');
  if (input.autoView === 'on') args.push('--auto-view', 'on');
  if (input.autoView === 'off') args.push('--no-auto-view');
  if (input.debugAi) args.push('--debug-ai');
  pushGlobalFlags(args, input);
  return args;
};

export const buildDeployArgs = (input: DeployCommandInput): string[] => {
  const args = ['deploy'];
  appendValue(args, '--dir', input.dir);
  appendValue(args, '--channel', input.channel);
  if (input.build) args.push('--build');
  pushGlobalFlags(args, input);
  return args;
};

export const buildPluginArgs = (input: PluginCommandInput): string[] => {
  const args = ['plugin', input.action];
  if (input.action !== 'list' && input.name && input.name.trim().length > 0) {
    args.push(input.name.trim());
  }
  pushGlobalFlags(args, input);
  return args;
};

export const buildPresetArgs = (input: PresetCommandInput): string[] => {
  const args = [input.command];
  pushGlobalFlags(args, input);
  return args;
};

const tokenizeQuoted = (value: string): string[] => {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const out: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (quote) {
      if (char === quote) {
        quote = null;
        continue;
      }
      current += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        out.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    out.push(current);
  }

  return out;
};

export const parseGenericArgsInput = (value: string): string[] => tokenizeQuoted(value);
