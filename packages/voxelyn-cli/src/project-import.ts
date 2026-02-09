import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const importFromProject = async (
  specifier: string,
  cwd: string
): Promise<Record<string, unknown> | null> => {
  try {
    const requireFromCwd = createRequire(path.join(cwd, 'package.json'));
    const resolved = requireFromCwd.resolve(specifier);
    return (await import(pathToFileURL(resolved).href)) as Record<string, unknown>;
  } catch {
    return null;
  }
};
