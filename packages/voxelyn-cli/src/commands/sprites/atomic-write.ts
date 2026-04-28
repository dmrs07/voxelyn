import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const writeAtomic = async (targetPath: string, bytes: Uint8Array): Promise<void> => {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.tmp`;
  try {
    await writeFile(tmpPath, bytes);
    await rename(tmpPath, targetPath);
  } catch (error) {
    await unlink(tmpPath).catch(() => undefined);
    throw error;
  }
};
