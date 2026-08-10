import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import esbuild from 'esbuild';

import { git } from './git.mjs';
import { repoRoot, workDir } from './paths.mjs';

/**
 * Apps construiveis do monorepo, por nome.
 *
 * Sao QUATRO porque o devlog cobre sete meses, e o que existia para ser
 * fotografado mudou tres vezes nesse periodo: o editor VoxelForge desde
 * janeiro, o roguelike desde fevereiro, o Survival desde julho e o Atlas
 * Studio desde agosto. Capturar 18/01 com o app de agosto seria justamente a
 * mentira que este pipeline existe para evitar.
 */
export const APPS = {
  // Os demos do core, que existem desde o PRIMEIRO commit e sao a origem
  // visual do projeto: o Noita-like e o iso Diablo-like em cima da biblioteca
  // headless, meses antes de existir um jogo.
  examples: {
    kind: 'esbuild',
    dir: '.',
    probe: 'examples/browser-noita-like/index.html',
    entries: ['examples/browser-noita-like/index.ts', 'examples/browser-iso-diablo-like/index.ts'],
  },
  editor: {
    kind: 'vite',
    pkg: '@voxelforge/editor',
    dir: 'packages/voxelforge-editor',
    probe: 'packages/voxelforge-editor/package.json',
  },
  roguelike: {
    kind: 'vite',
    pkg: '@voxelyn/roguelike',
    dir: 'packages/voxelyn-roguelike',
    probe: 'packages/voxelyn-roguelike/package.json',
  },
  survival: {
    kind: 'vite',
    pkg: '@voxelyn/survival',
    dir: 'packages/voxelyn-survival',
    probe: 'packages/voxelyn-survival/package.json',
  },
  'atlas-studio': {
    kind: 'vite',
    pkg: '@voxelyn/atlas-studio',
    dir: 'packages/voxelyn-atlas-studio',
    probe: 'packages/voxelyn-atlas-studio/package.json',
  },
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
export function install(dir, app, log = () => {}) {
  // Os demos da origem nao tem dependencia nenhuma: importam a biblioteca por
  // caminho relativo, e quem empacota e o esbuild DESTE checkout. Nada a
  // instalar dentro da worktree.
  if (APPS[app].kind === 'esbuild') return;

  const base = ['install', '--ignore-scripts', '--filter', `${APPS[app].pkg}...`];
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
/**
 * Empacota os demos do core com o esbuild deste checkout.
 *
 * O `tsc` do repositorio original nao servia: ele reescrevia os `.ts` em
 * `.js` mantendo os especificadores como estavam — `from "../../src/index"`,
 * sem extensao —, e nenhum browser resolve isso. Ou seja, o demo nunca rodou
 * direto do output do tsc; quem abrisse aquilo veria tela preta.
 *
 * O esbuild resolve o `.ts` e entrega um bundle que o browser executa. O
 * CODIGO e o do commit, byte a byte — o que muda e so quem costura os
 * modulos, que e uma questao de ferramenta, nao de conteudo. A imagem
 * continua sendo a daquele dia.
 */
function buildExamples(dir, app, log) {
  const out = resolve(dir, '.devlog-build');
  let built = 0;

  for (const entry of app.entries) {
    const source = resolve(dir, entry);
    if (!existsSync(source)) continue; // demo que ainda nao existia nesse commit
    const js = entry.replace(/\.ts$/, '.js');
    log(`esbuild ${entry}`);
    // Dois destinos, mesmo bundle: o HTML da origem pede `./index.js` ao lado
    // de si, e o HTML de fevereiro em diante pede `../../dist/examples/...`.
    // Escrever nos dois cobre as duas eras sem detectar qual e qual.
    for (const target of [resolve(out, js), resolve(out, 'dist', js)]) {
      mkdirSync(dirname(target), { recursive: true });
      esbuild.buildSync({
        entryPoints: [source],
        bundle: true,
        format: 'esm',
        target: 'es2020',
        outfile: target,
        logLevel: 'silent',
      });
    }
    built += 1;
  }

  if (!built) throw new Error('nenhum demo do core neste commit');
  return { root: dir, fallbacks: [out] };
}

export function build(dir, app, log = () => {}) {
  const { kind, pkg, dir: pkgDir } = APPS[app];

  if (kind === 'esbuild') return buildExamples(dir, APPS[app], log);

  log(`vite build (${pkg})`);
  run('pnpm', ['--filter', pkg, 'exec', 'vite', 'build'], dir);
  const dist = resolve(dir, pkgDir, 'dist');
  if (!existsSync(dist)) throw new Error(`build nao produziu ${pkgDir}/dist`);
  return { root: dist, fallbacks: [] };
}

/** Um app so e construivel num commit onde ele ja existia. */
export function appExistsAt(dir, app) {
  return existsSync(resolve(dir, APPS[app].probe));
}

function firstLine(err) {
  const text = `${err.stderr || err.stdout || err.message || ''}`.trim();
  return text.split('\n').find((l) => l.trim()) ?? 'erro desconhecido';
}

export { repoRoot };
