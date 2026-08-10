import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { git } from './git.mjs';
import { repoRoot, workDir } from './paths.mjs';

/** Apps construiveis do monorepo, por nome de receita. */
export const APPS = {
  survival: { pkg: '@voxelyn/survival', dir: 'packages/voxelyn-survival' },
  'atlas-studio': { pkg: '@voxelyn/atlas-studio', dir: 'packages/voxelyn-atlas-studio' },
};

function run(cmd, args, cwd, { timeout = 15 * 60_000 } = {}) {
  return execFileSync(cmd, args, {
    cwd,
    timeout,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * Materializa um commit antigo numa worktree isolada, fora da arvore de
 * trabalho atual.
 *
 * Fora do repo de proposito: uma worktree ANINHADA seria varrida pelo git
 * status do repo principal e pelos globs do vite, e um `pnpm install` la
 * dentro contaminaria o workspace do dia a dia.
 */
export function prepareWorktree(sha) {
  mkdirSync(workDir, { recursive: true });
  const dir = resolve(workDir, sha.slice(0, 12));

  if (existsSync(resolve(dir, '.git'))) return dir;

  // Uma worktree meio-criada (queda no meio de uma execucao anterior) deixa o
  // git achando que o caminho esta ocupado. Limpar as duas pontas — o
  // diretorio e o registro — e o que torna a operacao reexecutavel.
  rmSync(dir, { recursive: true, force: true });
  try {
    git(['worktree', 'prune']);
  } catch {
    /* prune e higiene, nao pre-requisito */
  }

  git(['worktree', 'add', '--detach', dir, sha]);
  return dir;
}

export function removeWorktree(sha) {
  const dir = resolve(workDir, sha.slice(0, 12));
  if (!existsSync(dir)) return;
  // node_modules nao e rastreado, entao `worktree remove` recusa sem --force.
  try {
    git(['worktree', 'remove', '--force', dir]);
  } catch {
    rmSync(dir, { recursive: true, force: true });
    git(['worktree', 'prune']);
  }
}

/**
 * Instala as dependencias do app dentro da worktree.
 *
 * Duas decisoes que existem por causa do "commit de semanas atras":
 * - `--filter <pkg>...` instala so a subarvore daquele app. O monorepo inteiro
 *   arrastaria Electron e Sharp para uma captura de screenshot de browser.
 * - o lockfile congelado e a PRIMEIRA tentativa, nao a unica: em commits onde
 *   o lockfile estava defasado, `--frozen-lockfile` falha alto e a captura
 *   morreria por um motivo que nao tem nada a ver com o que queremos mostrar.
 */
export function install(dir, pkg, log = () => {}) {
  const base = ['install', '--ignore-scripts', '--filter', `${pkg}...`];
  try {
    log('pnpm install --frozen-lockfile');
    run('pnpm', [...base, '--frozen-lockfile'], dir);
  } catch (err) {
    log(`lockfile congelado recusou (${firstLine(err)}); repetindo sem congelar`);
    run('pnpm', [...base, '--no-frozen-lockfile'], dir);
  }
}

/**
 * Constroi o app e devolve o diretorio publicavel.
 *
 * Chamamos o `vite build` DIRETO em vez do script `build` do pacote porque
 * varios deles rodam `tsc --noEmit` antes. Numa captura retroativa, o
 * typecheck de um commit antigo contra o TypeScript de hoje e uma fonte de
 * falha que nao diz nada sobre a imagem que queremos: o bundle sai igual.
 */
export function build(dir, app, log = () => {}) {
  const { pkg, dir: pkgDir } = APPS[app];
  log(`vite build (${pkg})`);
  run('pnpm', ['--filter', pkg, 'exec', 'vite', 'build'], dir);
  const dist = resolve(dir, pkgDir, 'dist');
  if (!existsSync(dist)) throw new Error(`build nao produziu ${pkgDir}/dist`);
  return dist;
}

/** Um app so e construivel num commit onde o pacote dele ja existia. */
export function appExistsAt(dir, app) {
  return existsSync(resolve(dir, APPS[app].dir, 'package.json'));
}

function firstLine(err) {
  const text = `${err.stderr || err.stdout || err.message || ''}`.trim();
  return text.split('\n').find((l) => l.trim()) ?? 'erro desconhecido';
}

export { repoRoot };
