export type Template = {
  name: string;
  description: string;
  files: Record<string, string>;
};

export type CliOptions = {
  name?: string;
  template?: string;
  yes?: boolean;
  force?: boolean;
  pm?: string;
  git?: boolean;
  dryRun?: boolean;
  list?: boolean;
  help?: boolean;
  install?: boolean;
  noInstall?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  noColor?: boolean;
  version?: boolean;
  deployDir?: string;
  deployChannel?: string;
  deployBuild?: boolean;
  prompt?: string;
};

export type CommandName =
  | 'create'
  | 'dev'
  | 'build'
  | 'preview'
  | 'deploy'
  | 'generate'
  | 'plugin';

export type ParsedArgs = {
  command?: CommandName;
  rawCommand?: string;
  options: CliOptions;
  positionals: string[];
};
