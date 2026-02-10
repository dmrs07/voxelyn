import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/args.js';

test('parse create with flags and positionals', () => {
  const parsed = parseArgs(['create', 'my-game', 'vanilla', '--no-install', '--verbose']);
  assert.equal(parsed.command, 'create');
  assert.deepEqual(parsed.positionals, ['my-game', 'vanilla']);
  assert.equal(parsed.options.noInstall, true);
  assert.equal(parsed.options.verbose, true);
});

test('parse raw command fallback', () => {
  const parsed = parseArgs(['my-game', 'react']);
  assert.equal(parsed.command, undefined);
  assert.equal(parsed.rawCommand, 'my-game');
  assert.deepEqual(parsed.positionals, ['react']);
});

test('parse version and deploy flags', () => {
  const parsed = parseArgs(['deploy', '--version', '--dir', 'dist', '--channel=alpha', '--build']);
  assert.equal(parsed.command, 'deploy');
  assert.equal(parsed.options.version, true);
  assert.equal(parsed.options.deployDir, 'dist');
  assert.equal(parsed.options.deployChannel, 'alpha');
  assert.equal(parsed.options.deployBuild, true);
});

test('parse generate scenario options (resolution, intent, workers)', () => {
  const parsed = parseArgs([
    'generate',
    'scenario',
    '--prompt',
    'vast volcanic island with settlements',
    '--provider',
    'anthropic',
    '--model',
    'claude-sonnet-4-20250514',
    '--seed',
    '1337',
    '--size',
    '256x192',
    '--depth',
    '64',
    '--scale',
    '0.75',
    '--out-format',
    'bundle',
    '--enhanced-terrain',
    '--workers',
    'auto',
    '--intent-mode',
    'deep',
    '--intent-strict',
    '--debug-ai',
  ]);

  assert.equal(parsed.command, 'generate');
  assert.deepEqual(parsed.positionals, ['scenario']);
  assert.equal(parsed.options.prompt, 'vast volcanic island with settlements');
  assert.equal(parsed.options.provider, 'anthropic');
  assert.equal(parsed.options.model, 'claude-sonnet-4-20250514');
  assert.equal(parsed.options.seed, 1337);
  assert.equal(parsed.options.size, '256x192');
  assert.equal(parsed.options.depth, 64);
  assert.equal(parsed.options.scale, 0.75);
  assert.equal(parsed.options.outFormat, 'bundle');
  assert.equal(parsed.options.enhancedTerrain, true);
  assert.equal(parsed.options.workers, 'auto');
  assert.equal(parsed.options.intentMode, 'deep');
  assert.equal(parsed.options.intentStrict, true);
  assert.equal(parsed.options.debugAi, true);
});

test('parse generate texture options including texture-size precedence inputs', () => {
  const parsed = parseArgs([
    'generate',
    'texture',
    '--prompt=weathered stone wall',
    '--size=32',
    '--texture-size=128x96',
    '--provider=gemini',
    '--no-enhanced-terrain',
    '--workers=3',
  ]);

  assert.equal(parsed.command, 'generate');
  assert.deepEqual(parsed.positionals, ['texture']);
  assert.equal(parsed.options.prompt, 'weathered stone wall');
  assert.equal(parsed.options.size, '32');
  assert.equal(parsed.options.textureSize, '128x96');
  assert.equal(parsed.options.provider, 'gemini');
  assert.equal(parsed.options.enhancedTerrain, false);
  assert.equal(parsed.options.workers, 3);
});
