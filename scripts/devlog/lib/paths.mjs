import { existsSync } from 'node:fs';
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
export const socialDir = resolve(devlogDir, 'social');

/**
 * Area de trabalho DESCARTAVEL do pipeline: worktrees de commits antigos e os
 * node_modules deles. Fica fora do repo de proposito — um worktree dentro da
 * arvore versionada seria varrido pelo proprio git e pelos globs do vite.
 */
export const workDir = resolve(repoRoot, '..', '.voxelyn-devlog-work');

/** Chromium pre-instalado no ambiente remoto de execucao. */
const REMOTE_CHROMIUM = '/opt/pw-browsers/chromium';

/**
 * Binario do Chromium a usar.
 *
 * O ambiente remoto traz um em /opt/pw-browsers cuja versao nem sempre casa
 * com a do pacote `playwright` instalado, e apontar para ele explicitamente e
 * o que faz a captura funcionar la. Numa maquina local esse caminho nao
 * existe, e a resposta certa e `undefined`: o proprio Playwright resolve o
 * navegador que ele baixou. Por isso a checagem e no DISCO — devolver o
 * caminho remoto as cegas quebraria `devlog:shoot` e `devlog:carousel` em
 * qualquer lugar que nao seja este container.
 */
export function chromiumExecutable() {
  if (process.env.VOXELYN_CHROMIUM) return process.env.VOXELYN_CHROMIUM;
  return existsSync(REMOTE_CHROMIUM) ? REMOTE_CHROMIUM : undefined;
}
