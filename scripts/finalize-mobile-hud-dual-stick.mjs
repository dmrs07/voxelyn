import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
process.chdir(root);

const replaceExact = (path, before, after) => {
  const source = readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one scaffold command, found ${count}`);
  writeFileSync(path, source.replace(before, after), 'utf8');
};

replaceExact(
  'package.json',
  `"build:survival": "node scripts/apply-mobile-hud-dual-stick.mjs && pnpm --filter @voxelyn/survival-server... build && pnpm --filter @voxelyn/survival... build"`,
  `"build:survival": "pnpm --filter @voxelyn/survival-server... build && pnpm --filter @voxelyn/survival... build"`,
);
replaceExact(
  'packages/voxelyn-survival/package.json',
  `"build:offline-check": "vite build && node scripts/check-precache.mjs && node ../../scripts/finalize-mobile-hud-dual-stick.mjs"`,
  `"build:offline-check": "vite build && node scripts/check-precache.mjs"`,
);

rmSync('scripts/apply-mobile-hud-dual-stick.mjs');
rmSync('scripts/finalize-mobile-hud-dual-stick.mjs');

execFileSync('git', ['diff', '--check'], { stdio: 'inherit' });
execFileSync('git', ['config', 'user.name', 'github-actions[bot]']);
execFileSync('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git', ['add', '-A']);

const status = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
if (!status) throw new Error('validated mobile HUD patch produced no changes');

execFileSync('git', ['commit', '-m', 'feat(survival): improve mobile HUD and dual-stick controls'], {
  stdio: 'inherit',
});
execFileSync(
  'git',
  ['push', 'origin', 'HEAD:feat/survival-mobile-hud-dual-stick'],
  { stdio: 'inherit' },
);
console.log('validated mobile HUD product commit published');
