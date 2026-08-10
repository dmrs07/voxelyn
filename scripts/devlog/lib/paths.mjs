import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Raiz do monorepo (scripts/devlog/lib -> ../../..). */
export const repoRoot = resolve(here, '..', '..', '..');

export const devlogDir = resolve(repoRoot, 'docs', 'devlog');
export const planPath = resolve(devlogDir, 'plan.json');
export const entriesDir = resolve(devlogDir, 'entries');
export const mediaDir = resolve(devlogDir, 'media');
export const carouselDir = resolve(devlogDir, 'carousel');

/**
 * Area de trabalho DESCARTAVEL do pipeline: worktrees de commits antigos e os
 * node_modules deles. Fica fora do repo de proposito — um worktree dentro da
 * arvore versionada seria varrido pelo proprio git e pelos globs do vite.
 */
export const workDir = resolve(repoRoot, '..', '.voxelyn-devlog-work');

/**
 * Binario do Chromium. O ambiente remoto ja traz um em /opt/pw-browsers; numa
 * maquina local o Playwright acha o dele sozinho e `undefined` e o correto.
 */
export function chromiumExecutable() {
  if (process.env.VOXELYN_CHROMIUM) return process.env.VOXELYN_CHROMIUM;
  return '/opt/pw-browsers/chromium';
}
