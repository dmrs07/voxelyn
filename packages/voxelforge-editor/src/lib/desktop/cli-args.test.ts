import { describe, expect, it } from 'vitest';
import {
  buildCreateArgs,
  buildDeployArgs,
  buildGenerateArgs,
  buildPluginArgs,
  buildPresetArgs,
  parseGenericArgsInput,
} from './cli-args';

describe('desktop CLI args builders', () => {
  it('builds create args with supported flags', () => {
    const args = buildCreateArgs({
      name: 'my-game',
      template: 'svelte',
      pm: 'pnpm',
      installMode: 'no-install',
      yes: true,
      force: true,
      git: true,
      dryRun: true,
      verbose: true,
      quiet: false,
      noColor: true,
    });

    expect(args).toEqual([
      'create',
      'my-game',
      'svelte',
      '--pm',
      'pnpm',
      '--yes',
      '--force',
      '--git',
      '--no-install',
      '--verbose',
      '--dry-run',
      '--no-color',
    ]);
  });

  it('does not emit verbose and quiet together', () => {
    const args = buildPresetArgs({
      command: 'dev',
      verbose: true,
      quiet: true,
      dryRun: false,
      noColor: false,
    });

    expect(args).toEqual(['dev']);
  });

  it('builds generate/deploy/plugin with existing flags only', () => {
    const generateArgs = buildGenerateArgs({
      type: 'scenario',
      prompt: 'spiralling O ring',
      provider: 'auto',
      size: '128x128',
      depth: 32,
      workers: 'auto',
      enhancedTerrain: 'on',
      autoView: 'off',
      detail: '',
      model: '',
      seed: '',
      textureSize: '',
      scale: '',
      maxVoxels: '',
      quality: '',
      attempts: '',
      minScore: '',
      modelEscalation: 'default',
      allowBase: false,
      strictQuality: false,
      outFormat: '',
      intentMode: '',
      intentStrict: false,
      debugAi: false,
      verbose: false,
      quiet: false,
      dryRun: true,
      noColor: false,
    });

    expect(generateArgs).toContain('--prompt');
    expect(generateArgs).toContain('--enhanced-terrain');
    expect(generateArgs).toContain('--no-auto-view');
    expect(generateArgs).toContain('--dry-run');

    const deployArgs = buildDeployArgs({
      dir: 'dist',
      channel: 'alpha',
      build: true,
      verbose: false,
      quiet: true,
      dryRun: false,
      noColor: false,
    });

    expect(deployArgs).toEqual(['deploy', '--dir', 'dist', '--channel', 'alpha', '--build', '--quiet']);

    const pluginArgs = buildPluginArgs({
      action: 'add',
      name: 'voxelyn-plugin-foo',
      dryRun: true,
      noColor: true,
      verbose: false,
      quiet: false,
    });

    expect(pluginArgs).toEqual(['plugin', 'add', 'voxelyn-plugin-foo', '--dry-run', '--no-color']);
  });

  it('tokenizes quoted generic command input', () => {
    const args = parseGenericArgsInput("generate scenario --prompt 'spiralling O ring' --size 256x256");
    expect(args).toEqual(['generate', 'scenario', '--prompt', 'spiralling O ring', '--size', '256x256']);
  });
});
