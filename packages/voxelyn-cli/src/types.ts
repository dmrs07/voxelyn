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
};

export type CommandName = 'create' | 'dev' | 'build' | 'preview';

export type ParsedArgs = {
  command?: CommandName;
  options: CliOptions;
  positionals: string[];
};
