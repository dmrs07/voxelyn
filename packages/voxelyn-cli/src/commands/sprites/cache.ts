import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type PixellabIdCache = Record<string, { id: string; conceptHash: string }>;

export const readPixellabIdCache = async (filePath: string): Promise<PixellabIdCache> => {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8')) as PixellabIdCache;
  } catch {
    return {};
  }
};

export const writePixellabIdCache = async (
  filePath: string,
  cache: PixellabIdCache
): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(cache, null, 2));
};

export const pickPixellabId = (
  cache: PixellabIdCache,
  spriteId: string,
  conceptHash: string
): string | undefined => {
  const entry = cache[spriteId];
  if (!entry || entry.conceptHash !== conceptHash) return undefined;
  return entry.id;
};
