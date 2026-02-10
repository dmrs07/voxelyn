import type { CliOptions, CommandName, ParsedArgs } from './types.js';

const COMMAND_ALIASES: Record<string, CommandName> = {
  create: 'create',
  dev: 'dev',
  serve: 'dev',
  build: 'build',
  preview: 'preview',
  deploy: 'deploy',
  generate: 'generate',
  plugin: 'plugin'
};

const setCommand = (current: CommandName | undefined, next: CommandName): CommandName => {
  if (current && current !== next) {
    throw new Error('Multiple commands specified.');
  }
  return next;
};

const parseNumber = (raw: string | undefined): number | undefined => {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

const parseInteger = (raw: string | undefined): number | undefined => {
  const n = parseNumber(raw);
  if (n === undefined) return undefined;
  const int = Math.trunc(n);
  return Number.isFinite(int) ? int : undefined;
};

export const parseArgs = (argv: string[]): ParsedArgs => {
  const options: CliOptions = {};
  let command: CommandName | undefined;
  let rawCommand: string | undefined;
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
      if (arg === '--verbose') {
        options.verbose = true;
        continue;
      }
      if (arg === '--quiet') {
        options.quiet = true;
        continue;
      }
      if (arg === '--no-color') {
        options.noColor = true;
        continue;
      }
      if (arg === '--version' || arg === '-v') {
        options.version = true;
        continue;
      }
      if (arg === '--dir' && argv[i + 1]) {
        options.deployDir = argv[++i];
        continue;
      }
      if (arg.startsWith('--dir=')) {
        options.deployDir = arg.slice('--dir='.length);
        continue;
      }
      if (arg === '--channel' && argv[i + 1]) {
        options.deployChannel = argv[++i];
        continue;
      }
      if (arg.startsWith('--channel=')) {
        options.deployChannel = arg.slice('--channel='.length);
        continue;
      }
      if (arg === '--build') {
        options.deployBuild = true;
        continue;
      }
      if (arg === '--prompt' && argv[i + 1]) {
        options.prompt = argv[++i];
        continue;
      }
      if (arg.startsWith('--prompt=')) {
        options.prompt = arg.slice('--prompt='.length);
        continue;
      }
      if (arg === '--provider' && argv[i + 1]) {
        options.provider = argv[++i] as CliOptions['provider'];
        continue;
      }
      if (arg.startsWith('--provider=')) {
        options.provider = arg.slice('--provider='.length) as CliOptions['provider'];
        continue;
      }
      if (arg === '--model' && argv[i + 1]) {
        options.model = argv[++i];
        continue;
      }
      if (arg.startsWith('--model=')) {
        options.model = arg.slice('--model='.length);
        continue;
      }
      if (arg === '--seed' && argv[i + 1]) {
        options.seed = parseInteger(argv[++i]);
        continue;
      }
      if (arg.startsWith('--seed=')) {
        options.seed = parseInteger(arg.slice('--seed='.length));
        continue;
      }
      if ((arg === '--size' || arg === '--tamanho') && argv[i + 1]) {
        options.size = argv[++i];
        continue;
      }
      if (arg.startsWith('--size=')) {
        options.size = arg.slice('--size='.length);
        continue;
      }
      if (arg.startsWith('--tamanho=')) {
        options.size = arg.slice('--tamanho='.length);
        continue;
      }
      if ((arg === '--detail' || arg === '--detail-level' || arg === '--detalhe') && argv[i + 1]) {
        options.detail = (argv[++i] as CliOptions['detail']) ?? options.detail;
        continue;
      }
      if (
        arg.startsWith('--detail=') ||
        arg.startsWith('--detail-level=') ||
        arg.startsWith('--detalhe=')
      ) {
        const raw =
          arg.startsWith('--detail=')
            ? arg.slice('--detail='.length)
            : arg.startsWith('--detail-level=')
              ? arg.slice('--detail-level='.length)
              : arg.slice('--detalhe='.length);
        options.detail = raw as CliOptions['detail'];
        continue;
      }
      if ((arg === '--max-voxels' || arg === '--voxels' || arg === '--qtd') && argv[i + 1]) {
        options.maxVoxels = parseInteger(argv[++i]);
        continue;
      }
      if (arg.startsWith('--max-voxels=')) {
        options.maxVoxels = parseInteger(arg.slice('--max-voxels='.length));
        continue;
      }
      if (arg.startsWith('--voxels=')) {
        options.maxVoxels = parseInteger(arg.slice('--voxels='.length));
        continue;
      }
      if (arg.startsWith('--qtd=')) {
        options.maxVoxels = parseInteger(arg.slice('--qtd='.length));
        continue;
      }
      if (arg === '--quality' && argv[i + 1]) {
        options.quality = (argv[++i] as CliOptions['quality']) ?? options.quality;
        continue;
      }
      if (arg.startsWith('--quality=')) {
        options.quality = arg.slice('--quality='.length) as CliOptions['quality'];
        continue;
      }
      if (arg === '--attempts' && argv[i + 1]) {
        options.attempts = parseInteger(argv[++i]);
        continue;
      }
      if (arg.startsWith('--attempts=')) {
        options.attempts = parseInteger(arg.slice('--attempts='.length));
        continue;
      }
      if (arg === '--min-score' && argv[i + 1]) {
        options.minScore = parseNumber(argv[++i]);
        continue;
      }
      if (arg.startsWith('--min-score=')) {
        options.minScore = parseNumber(arg.slice('--min-score='.length));
        continue;
      }
      if (arg === '--model-escalation' && argv[i + 1]) {
        const value = (argv[++i] ?? '').toLowerCase();
        options.modelEscalation = value === 'on' || value === 'true' || value === '1';
        continue;
      }
      if (arg.startsWith('--model-escalation=')) {
        const value = arg.slice('--model-escalation='.length).toLowerCase();
        options.modelEscalation = value === 'on' || value === 'true' || value === '1';
        continue;
      }
      if (arg === '--allow-base' || arg === '--allow-scene') {
        options.allowBase = true;
        continue;
      }
      if (arg === '--strict-quality') {
        options.strictQuality = true;
        continue;
      }
      if (arg === '--depth' && argv[i + 1]) {
        options.depth = parseInteger(argv[++i]);
        continue;
      }
      if (arg.startsWith('--depth=')) {
        options.depth = parseInteger(arg.slice('--depth='.length));
        continue;
      }
      if (arg === '--scale' && argv[i + 1]) {
        options.scale = parseNumber(argv[++i]);
        continue;
      }
      if (arg.startsWith('--scale=')) {
        options.scale = parseNumber(arg.slice('--scale='.length));
        continue;
      }
      if (arg === '--texture-size' && argv[i + 1]) {
        options.textureSize = argv[++i];
        continue;
      }
      if (arg.startsWith('--texture-size=')) {
        options.textureSize = arg.slice('--texture-size='.length);
        continue;
      }
      if (arg === '--out-format' && argv[i + 1]) {
        options.outFormat = argv[++i] as CliOptions['outFormat'];
        continue;
      }
      if (arg.startsWith('--out-format=')) {
        options.outFormat = arg.slice('--out-format='.length) as CliOptions['outFormat'];
        continue;
      }
      if (arg === '--enhanced-terrain') {
        options.enhancedTerrain = true;
        continue;
      }
      if (arg === '--no-enhanced-terrain') {
        options.enhancedTerrain = false;
        continue;
      }
      if (arg === '--workers' && argv[i + 1]) {
        const next = argv[++i]!;
        options.workers = next === 'auto' ? 'auto' : parseInteger(next);
        continue;
      }
      if (arg.startsWith('--workers=')) {
        const raw = arg.slice('--workers='.length);
        options.workers = raw === 'auto' ? 'auto' : parseInteger(raw);
        continue;
      }
      if (arg === '--debug-ai') {
        options.debugAi = true;
        continue;
      }
      if (arg === '--intent-mode' && argv[i + 1]) {
        options.intentMode = argv[++i] as CliOptions['intentMode'];
        continue;
      }
      if (arg.startsWith('--intent-mode=')) {
        options.intentMode = arg.slice('--intent-mode='.length) as CliOptions['intentMode'];
        continue;
      }
      if (arg === '--intent-strict') {
        options.intentStrict = true;
        continue;
      }
      if (arg === '--auto-view' && argv[i + 1]) {
        const value = (argv[++i] ?? '').toLowerCase();
        options.autoView = value === 'on' || value === 'true' || value === '1';
        continue;
      }
      if (arg.startsWith('--auto-view=')) {
        const value = arg.slice('--auto-view='.length).toLowerCase();
        options.autoView = value === 'on' || value === 'true' || value === '1';
        continue;
      }
      if (arg === '--no-auto-view') {
        options.autoView = false;
        continue;
      }
      continue;
    }

    const normalized = COMMAND_ALIASES[arg];
    if (normalized) {
      command = setCommand(command, normalized);
      continue;
    }

    if (!command && !rawCommand) {
      rawCommand = arg;
      continue;
    }

    positionals.push(arg);
  }

  return { command, rawCommand, options, positionals };
};

export const formatHelp = (): string => `Voxelyn CLI

Usage:
  voxelyn create <name> [template] [options]
  voxelyn dev [options]
  voxelyn build [options]
  voxelyn preview [options]
  voxelyn serve [options]
  voxelyn deploy [options]
  voxelyn generate <type> --prompt "..."
  voxelyn plugin <add|remove|list> [name]
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
  --verbose           Verbose logging
  --quiet             Suppress non-error output
  --no-color          Disable ANSI colors
  --version           Show CLI version
  --help              Show help

Deploy options:
  --dir <path>        Directory to deploy (default: dist)
  --channel <name>    Itch.io channel (default: alpha)
  --build             Run build before deploy

Generate options:
  --prompt <text>     Prompt for generation
  --provider <name>   auto | gemini | openai | anthropic | groq | ollama | copilot
  --model <id>        Model id override
  --seed <int>        Seed override for deterministic generation
  --size <N|WxH>      Output resolution for texture/scenario
  --detail <level>    Object detail: low | medium | high
  --max-voxels <N>    Object voxel budget (aliases: --voxels, --qtd)
  --quality <profile> fast | balanced | high | ultra
  --attempts <N>      Object generation attempts
  --min-score <0..1>  Minimum quality score target
  --model-escalation <on|off>  Escalate model/temperature across attempts
  --allow-base        Allow baseplate/backdrop primitives
  --strict-quality    Fail if quality target is not reached
  --texture-size <N|WxH>  Texture resolution (overrides --size for texture)
  --depth <int>       Scenario vertical depth (z layers)
  --scale <float>     World/voxel scale multiplier
  --out-format <fmt>  bundle | layout | terrain-spec
  --enhanced-terrain / --no-enhanced-terrain  Toggle enhanced terrain pipeline
  --workers <auto|N>  Scenario worker parallelism
  --intent-mode <m>   fast | balanced | deep
  --intent-strict     Enforce strict intent constraints
  --auto-view <on|off>  Generate deterministic view.settings.json
  --no-auto-view      Disable auto view.settings generation
  --debug-ai          Verbose AI debug logging

Examples:
  voxelyn create my-game vanilla
  voxelyn deploy --build --channel=alpha
  voxelyn generate texture --prompt "stone"
  voxelyn generate scenario --prompt "vast volcanic island" --size 256x256 --depth 64 --workers auto
  voxelyn plugin list
`;
