import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CliError } from './errors.js';

export type ItchDeployConfig = {
  user?: string;
  game?: string;
  channel?: string;
  dir?: string;
};

export type VoxelynConfig = {
  deploy?: {
    itch?: ItchDeployConfig;
  };
  plugins?: string[];
};

export type PackageJson = {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  voxelyn?: VoxelynConfig;
  [key: string]: unknown;
};

export const readPackageJson = async (cwd: string): Promise<PackageJson> => {
  const pkgPath = path.join(cwd, 'package.json');
  try {
    const raw = await readFile(pkgPath, 'utf8');
    return JSON.parse(raw) as PackageJson;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new CliError('ERR_PACKAGE_JSON', 'Invalid package.json JSON.');
    }
    throw new CliError('ERR_NO_PACKAGE_JSON', 'package.json not found in current directory.');
  }
};

export const writePackageJson = async (cwd: string, data: PackageJson): Promise<void> => {
  const pkgPath = path.join(cwd, 'package.json');
  const raw = JSON.stringify(data, null, 2) + '\n';
  await writeFile(pkgPath, raw, 'utf8');
};

export const readVoxelynConfig = async (cwd: string): Promise<VoxelynConfig> => {
  const pkg = await readPackageJson(cwd);
  return (pkg.voxelyn ?? {}) as VoxelynConfig;
};
