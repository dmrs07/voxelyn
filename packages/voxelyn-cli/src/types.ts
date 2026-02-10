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
  provider?: 'auto' | 'gemini' | 'openai' | 'anthropic' | 'groq' | 'ollama' | 'copilot';
  model?: string;
  seed?: number;
  size?: string;
  detail?: 'low' | 'medium' | 'high';
  maxVoxels?: number;
  quality?: 'fast' | 'balanced' | 'high' | 'ultra';
  attempts?: number;
  minScore?: number;
  modelEscalation?: boolean;
  allowBase?: boolean;
  strictQuality?: boolean;
  depth?: number;
  scale?: number;
  textureSize?: string;
  outFormat?: 'bundle' | 'layout' | 'terrain-spec';
  enhancedTerrain?: boolean;
  workers?: 'auto' | number;
  debugAi?: boolean;
  intentMode?: 'fast' | 'balanced' | 'deep';
  intentStrict?: boolean;
  autoView?: boolean;
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
