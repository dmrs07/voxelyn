import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { devlogDir } from './paths.mjs';

/**
 * Guarda o build de um commit antigo para ele rodar DENTRO do devlog.
 *
 * A screenshot conta o que o jogo parecia; o embed deixa a pessoa mexer. Para
 * a era dos demos isso e quase de graca — o bundle da areia caindo tem 10 KB,
 * menos que o PNG dele — e e o unico jeito de mostrar que o interessante ali
 * nunca foi o quadro parado, e sim a areia empilhando e a agua achando nivel.
 *
 * O build ja acontece na captura. Isto so deixa de jogar fora o resultado.
 */

/** Diretorio dos snapshots, irmao de `media/` e `carousel/`. */
export const liveDir = resolve(devlogDir, 'live');

/**
 * Teto por snapshot.
 *
 * E o que impede alguem marcar `live` num app pesado e dobrar o repositorio
 * sem perceber: o dist do Survival tem 9,28 MB (7,9 so de atlas), e as ~91
 * entradas dele dariam uns 845 MB. Passou do teto, o snapshot e recusado com
 * aviso e a entrada continua so com a screenshot.
 */
export const MAX_LIVE_BYTES = 2 * 1024 * 1024;

/** Extensoes que um navegador serve. Fonte `.ts` e README ficam de fora. */
const SERVABLE = new Set([
  '.html',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.webmanifest',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.webp',
  '.woff2',
  '.wasm',
]);

const extensionOf = (name) => {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
};

export const treeSize = (dir) => {
  let total = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  if (!existsSync(dir)) return 0;
  walk(dir);
  return total;
};

function copyServable(from, to) {
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  for (const e of readdirSync(from, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const src = join(from, e.name);
    if (e.isDirectory()) copyServable(src, join(to, e.name));
    else if (SERVABLE.has(extensionOf(e.name))) cpSync(src, join(to, e.name));
  }
}

/**
 * Copia o site construido para `docs/devlog/live/<id>/<recipe>/`.
 *
 * Copia a PASTA DA PAGINA, nao o site inteiro: num app vite a pagina esta na
 * raiz do dist e isso pega tudo, e nos demos do core ela esta em
 * `examples/browser-noita-like/`, onde o resto da arvore nao interessa.
 *
 * Os fallbacks sao copiados POR ULTIMO de proposito. E deles que vem o bundle
 * recem-construido, e ele precisa vencer qualquer `bundle.js` velho que esteja
 * versionado ao lado do HTML.
 */
export function snapshotLive(site, recipe, entryId, recipeName, log = () => {}) {
  const pageDir = dirname(recipe.page);
  const dest = resolve(liveDir, entryId, recipeName);
  rmSync(dest, { recursive: true, force: true });

  for (const base of [site.root, ...site.fallbacks]) {
    copyServable(resolve(base, pageDir === '.' ? '' : pageDir), dest);
  }

  const pageName = recipe.page.slice(recipe.page.lastIndexOf('/') + 1);
  if (!existsSync(resolve(dest, pageName))) {
    rmSync(dest, { recursive: true, force: true });
    throw new Error(`snapshot sem ${pageName}`);
  }

  const bytes = treeSize(dest);
  if (bytes > MAX_LIVE_BYTES) {
    rmSync(dest, { recursive: true, force: true });
    throw new Error(
      `snapshot de ${(bytes / 1024 / 1024).toFixed(2)} MB passa do teto de ` +
        `${(MAX_LIVE_BYTES / 1024 / 1024).toFixed(0)} MB`,
    );
  }

  log(`  -> docs/devlog/live/${entryId}/${recipeName}/ (${(bytes / 1024).toFixed(0)} KB)`);
  return { recipe: recipeName, page: pageName, bytes };
}
