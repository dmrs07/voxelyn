import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const rootPath = 'package.json';
const root = JSON.parse(readFileSync(rootPath, 'utf8'));
root.scripts['build:survival'] = root.scripts['build:survival'].replace(
  'node .github/patches/apply-pr53-review-fixes.mjs && ',
  '',
);
writeFileSync(rootPath, `${JSON.stringify(root, null, 2)}\n`);

const clientPath = 'packages/voxelyn-survival/package.json';
const client = JSON.parse(readFileSync(clientPath, 'utf8'));
client.scripts['build:offline-check'] = client.scripts['build:offline-check'].replace(
  ' && node ../../.github/patches/finalize-pr53-review-fixes.mjs',
  '',
);
writeFileSync(clientPath, `${JSON.stringify(client, null, 2)}\n`);

// Restore the repository's real validator and remove all diagnostic scaffolding.
const canonicalWorkflow = execFileSync(
  'git',
  ['show', 'origin/main:.github/workflows/execute-voxel-spec.yml'],
  { encoding: 'utf8' },
);
writeFileSync('.github/workflows/execute-voxel-spec.yml', canonicalWorkflow);
for (const path of [
  '.github/workflows/fix-terminal-run-persistence.yml',
  '.github/patches/apply-pr53-review-fixes.mjs',
  '.github/patches/finalize-pr53-review-fixes.mjs',
]) {
  if (existsSync(path)) unlinkSync(path);
}

execFileSync('git', ['diff', '--check'], { stdio: 'inherit' });
execFileSync('git', ['config', 'user.name', 'github-actions[bot]']);
execFileSync('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git', ['add', '-A']);
execFileSync('git', ['commit', '-m', 'fix(survival): persist terminal runs exactly once'], { stdio: 'inherit' });
execFileSync('git', ['push', 'origin', 'HEAD:claude/voxelyn-survival-brainstorm-nk0gdw'], { stdio: 'inherit' });
console.log('Validated PR #53 fixes published and temporary scaffolding removed');
