import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { writeAtomic } from './atomic-write.js';
import type { SpritesFs } from './generate.js';

const resolvePath = (cwd: string, filePath: string): string =>
  path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);

export const createNodeFs = (cwd: string): SpritesFs => ({
  async readFile(filePath) {
    try {
      return new Uint8Array(await readFile(resolvePath(cwd, filePath)));
    } catch {
      return null;
    }
  },
  async writeFileAtomic(filePath, bytes) {
    await writeAtomic(resolvePath(cwd, filePath), bytes);
  },
  async exists(filePath) {
    try {
      await access(resolvePath(cwd, filePath));
      return true;
    } catch {
      return false;
    }
  },
  async readJson<T>(filePath: string): Promise<T | undefined> {
    try {
      return JSON.parse(await readFile(resolvePath(cwd, filePath), 'utf-8')) as T;
    } catch {
      return undefined;
    }
  },
  async writeJson(filePath, value) {
    await writeFile(resolvePath(cwd, filePath), JSON.stringify(value, null, 2));
  },
});
