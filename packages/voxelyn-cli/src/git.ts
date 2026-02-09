import { spawnSync } from 'node:child_process';

export type LogFn = (message: string) => void;

export const initGit = (dir: string, dryRun: boolean, log: LogFn = console.log): void => {
  if (dryRun) {
    log(`[dry-run] git init ${dir}`);
    return;
  }
  const result = spawnSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  if (result.error) {
    log('git not available; skipping init');
  }
};
