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
  `"build:survival": "node scripts/apply-pr62-module-fit-fix.mjs && pnpm --filter @voxelyn/survival-server... build && pnpm --filter @voxelyn/survival... build"`,
  `"build:survival": "pnpm --filter @voxelyn/survival-server... build && pnpm --filter @voxelyn/survival... build"`,
);
replaceExact(
  'packages/voxelyn-survival/package.json',
  `"build:offline-check": "vite build && node scripts/check-precache.mjs && node ../../scripts/finalize-pr62-module-fit-fix.mjs"`,
  `"build:offline-check": "vite build && node scripts/check-precache.mjs"`,
);

rmSync('scripts/apply-pr62-module-fit-fix.mjs');
rmSync('scripts/finalize-pr62-module-fit-fix.mjs');

execFileSync('git', ['diff', '--check'], { stdio: 'inherit' });
execFileSync('git', ['config', 'user.name', 'github-actions[bot]']);
execFileSync('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync(
  'git',
  [
    'add', '-A', '--',
    'package.json',
    'packages/voxelyn-survival/package.json',
    'packages/voxelyn-survival/src/client/render.ts',
    'packages/voxelyn-survival/src/tests/touch-cooldown.test.ts',
    'scripts/apply-pr62-module-fit-fix.mjs',
    'scripts/finalize-pr62-module-fit-fix.mjs',
  ],
  { stdio: 'inherit' },
);

const status = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' }).trim();
if (!status) throw new Error('validated module HUD fix produced no staged changes');

execFileSync('git', ['commit', '-m', 'fix(survival): fit all active modules in compact HUD'], {
  stdio: 'inherit',
});
execFileSync(
  'git',
  ['push', 'origin', 'HEAD:feat/survival-mobile-hud-dual-stick'],
  { stdio: 'inherit' },
);
console.log('validated compact module HUD fix published');
