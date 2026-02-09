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
