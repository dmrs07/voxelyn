import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Template } from './types.js';
import { renderTemplate } from './templates.js';

export const isValidName = (name: string): boolean => {
  if (!name) return false;
  if (name.includes('..')) return false;
  if (name.includes('/') || name.includes('\\')) return false;
  if (path.isAbsolute(name)) return false;
  return true;
};

export const ensureWritableDir = async (
  dir: string,
  opts: {
    force: boolean;
    dryRun: boolean;
    yes: boolean;
    confirmOverwrite?: () => Promise<boolean>;
  }
): Promise<void> => {
  if (!existsSync(dir)) {
    if (!opts.dryRun) await mkdir(dir, { recursive: true });
    return;
  }
  const entries = await readdir(dir);
  if (entries.length > 0) {
    if (!opts.force) {
      throw new Error('Target directory is not empty. Use --force to overwrite.');
    }
    if (!opts.yes) {
      if (!opts.confirmOverwrite) {
        throw new Error('Overwrite confirmation required.');
      }
      const ok = await opts.confirmOverwrite();
      if (!ok) throw new Error('Aborted by user.');
    }
  }
};

export const writeTemplateFiles = async (
  dir: string,
  template: Template,
  name: string,
  dryRun: boolean
): Promise<void> => {
  for (const [filePath, rawContent] of Object.entries(template.files)) {
    const outPath = path.join(dir, filePath);
    const outDir = path.dirname(outPath);
    if (!dryRun) await mkdir(outDir, { recursive: true });
    const content = renderTemplate(rawContent, name);
    if (dryRun) {
      console.log(`[dry-run] write ${outPath}`);
    } else {
      await writeFile(outPath, content, 'utf8');
    }
  }
};
