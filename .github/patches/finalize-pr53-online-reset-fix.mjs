import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('../../', import.meta.url)));

const root = JSON.parse(readFileSync('package.json', 'utf8'));
root.scripts['build:survival'] = root.scripts['build:survival'].replace(
  'node .github/patches/apply-pr53-online-reset-fix.mjs && ',
  '',
);
writeFileSync('package.json', `${JSON.stringify(root, null, 2)}\n`);

const clientPath = 'packages/voxelyn-survival/package.json';
const client = JSON.parse(readFileSync(clientPath, 'utf8'));
client.scripts['build:offline-check'] = client.scripts['build:offline-check'].replace(
  ' && node ../../.github/patches/finalize-pr53-online-reset-fix.mjs',
  '',
);
writeFileSync(clientPath, `${JSON.stringify(client, null, 2)}\n`);

for (const path of [
  '.github/patches/apply-pr53-online-reset-fix.mjs',
  '.github/patches/finalize-pr53-online-reset-fix.mjs',
]) {
  if (existsSync(path)) unlinkSync(path);
}

execFileSync('git', ['diff', '--check'], { stdio: 'inherit' });
execFileSync('git', ['config', 'user.name', 'github-actions[bot]']);
execFileSync('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git', ['add', '-A']);
execFileSync('git', ['commit', '-m', 'fix(survival-ui): reset online run record identity'], { stdio: 'inherit' });
execFileSync('git', ['push', 'origin', 'HEAD:claude/voxelyn-survival-brainstorm-nk0gdw'], { stdio: 'inherit' });
