import { spawnSync } from 'node:child_process';

export const initGit = (dir: string, dryRun: boolean): void => {
  if (dryRun) {
    console.log(`[dry-run] git init ${dir}`);
    return;
  }
  const result = spawnSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  if (result.error) {
    console.log('git not available; skipping init');
  }
};
