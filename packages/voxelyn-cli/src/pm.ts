import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { CliError } from './errors.js';

const PM_LIST = ['npm', 'pnpm', 'yarn', 'bun'] as const;
export type PackageManager = (typeof PM_LIST)[number];

export type LogFn = (message: string) => void;

export const isPackageManager = (value: string | undefined): value is PackageManager =>
  Boolean(value && PM_LIST.includes(value as PackageManager));

export const detectPackageManager = (): PackageManager => {
  const ua = process.env.npm_config_user_agent ?? '';
  if (ua.startsWith('pnpm')) return 'pnpm';
  if (ua.startsWith('yarn')) return 'yarn';
  if (ua.startsWith('bun')) return 'bun';
  return 'npm';
};

export const resolvePackageManager = (value?: string): PackageManager => {
  if (!value) return detectPackageManager();
  if (!isPackageManager(value)) {
    throw new CliError('ERR_INVALID_PM', `Unknown package manager: ${value}`);
  }
  return value;
};

export const readPackageScripts = async (cwd: string): Promise<Record<string, string>> => {
  const pkgPath = path.join(cwd, 'package.json');
  let raw = '';
  try {
    raw = await readFile(pkgPath, 'utf8');
  } catch {
    throw new CliError('ERR_NO_PACKAGE_JSON', 'package.json not found in current directory.');
  }
  const parsed = JSON.parse(raw) as { scripts?: Record<string, string> };
  return parsed.scripts ?? {};
};

const formatCommand = (cmd: string, args: string[]): string => [cmd, ...args].join(' ');

export const formatInstallCommand = (pm: PackageManager): string =>
  pm === 'yarn' ? 'yarn install' : `${pm} install`;

export const formatRunCommand = (pm: PackageManager, script: string): string => {
  if (pm === 'yarn') return `yarn ${script}`;
  if (pm === 'bun') return `bun run ${script}`;
  return `${pm} run ${script}`;
};

export const runInstall = (
  pm: PackageManager,
  cwd: string,
  dryRun: boolean,
  log: LogFn = console.log
): void => {
  const cmd = pm;
  const args = ['install'];
  if (dryRun) {
    log(`[dry-run] ${formatInstallCommand(pm)}`);
    return;
  }
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (result.error) {
    throw result.error;
  }
};

export const runAdd = (
  pm: PackageManager,
  deps: string[],
  cwd: string,
  dryRun: boolean,
  log: LogFn = console.log
): void => {
  if (deps.length === 0) return;
  const cmd = pm;
  let args: string[] = [];
  if (pm === 'npm') args = ['install', '--save', ...deps];
  if (pm === 'pnpm') args = ['add', ...deps];
  if (pm === 'yarn') args = ['add', ...deps];
  if (pm === 'bun') args = ['add', ...deps];

  if (dryRun) {
    log(`[dry-run] ${formatCommand(cmd, args)}`);
    return;
  }
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
};

export const runRemove = (
  pm: PackageManager,
  deps: string[],
  cwd: string,
  dryRun: boolean,
  log: LogFn = console.log
): void => {
  if (deps.length === 0) return;
  const cmd = pm;
  let args: string[] = [];
  if (pm === 'npm') args = ['uninstall', ...deps];
  if (pm === 'pnpm') args = ['remove', ...deps];
  if (pm === 'yarn') args = ['remove', ...deps];
  if (pm === 'bun') args = ['remove', ...deps];

  if (dryRun) {
    log(`[dry-run] ${formatCommand(cmd, args)}`);
    return;
  }
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
};

export const runScript = (
  pm: PackageManager,
  script: string,
  cwd: string,
  dryRun: boolean,
  log: LogFn = console.log
): void => {
  const cmd = pm;
  let args: string[] = [];
  if (pm === 'npm' || pm === 'pnpm') {
    args = ['run', script];
  } else if (pm === 'yarn') {
    args = [script];
  } else if (pm === 'bun') {
    args = ['run', script];
  }

  if (dryRun) {
    log(`[dry-run] ${formatCommand(cmd, args)}`);
    return;
  }

  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (result.error) {
    throw result.error;
  }
};
