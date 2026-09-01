import { defineConfig, type Plugin } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Injeta a lista de arquivos gerados (bundles com hash + atlases) no sw.js
 * publicado. O service worker so e registrado no window.load, entao ele nunca
 * observa os fetches iniciais desses arquivos; sem precache, o app shell fica
 * em cache sem o JS do jogo e o solo offline nao inicia no primeiro uso.
 * Os nomes so existem apos o bundle, por isso a lista e escrita aqui e nao no
 * arquivo em public/.
 *
 * Junto vai um id de build. O navegador so instala um SW novo quando o sw.js
 * muda byte a byte; se um deploy alterar apenas o index.html (nenhum hash de
 * asset muda), o sw.js sairia identico e o shell precacheado ficaria congelado
 * na versao anterior por tempo indefinido. O id tambem nomeia o cache, o que
 * faz cada build descartar o cache do build anterior no activate.
 */
const precacheManifest = (): Plugin => ({
  name: 'voxelyn-precache-manifest',
  apply: 'build',
  writeBundle(options, bundle) {
    const dir = options.dir ?? resolve(__dirname, 'dist');
    const swPath = resolve(dir, 'sw.js');
    // tudo que o bundle emitiu (js/css/png dos atlases), menos o proprio SW
    const assets = Object.keys(bundle)
      .filter((f) => f !== 'sw.js' && !f.endsWith('.html'))
      .map((f) => `./${f}`)
      .sort();
    let sw: string;
    try {
      sw = readFileSync(swPath, 'utf8');
    } catch {
      return; // sem SW no output: nada a injetar
    }
    // Cobre os hashes dos assets E o conteudo do HTML emitido: qualquer um dos
    // dois mudando produz um sw.js diferente, que e o gatilho do update.
    const digest = createHash('sha256');
    for (const name of assets) digest.update(name);
    for (const [name, chunk] of Object.entries(bundle)) {
      if (!name.endsWith('.html')) continue;
      const source = 'source' in chunk ? chunk.source : '';
      digest.update(typeof source === 'string' ? source : Buffer.from(source));
    }
    const build = digest.digest('hex').slice(0, 12);
    // A linha do precache precisa continuar sendo a PRIMEIRA:
    // scripts/check-precache.mjs ancora nela com `^`.
    const header =
      `self.__VOXELYN_PRECACHE__ = ${JSON.stringify(assets)};\n` +
      `self.__VOXELYN_BUILD__ = ${JSON.stringify(build)};\n`;
    writeFileSync(swPath, header + sw);
  },
});

export default defineConfig({
  base: './',
  plugins: [precacheManifest()],
  resolve: {
    alias: [
      // ordem importa: o prefixo de assets vem antes do pacote raiz
      {
        find: '@voxelyn/survival-content/assets',
        replacement: resolve(__dirname, '../voxelyn-survival-content/assets'),
      },
      {
        find: '@voxelyn/survival-content',
        replacement: resolve(__dirname, '../voxelyn-survival-content/src/index.ts'),
      },
      {
        find: '@voxelyn/survival-server',
        replacement: resolve(__dirname, '../voxelyn-survival-server/src/server.ts'),
      },
      {
        find: '@voxelyn/survival-protocol',
        replacement: resolve(__dirname, '../voxelyn-survival-protocol/src/index.ts'),
      },
      {
        find: '@voxelyn/survival-sim',
        replacement: resolve(__dirname, '../voxelyn-survival-sim/src/index.ts'),
      },
      { find: '@voxelyn/core', replacement: resolve(__dirname, '../voxelyn-core/src/index.ts') },
    ],
    conditions: ['browser', 'import', 'module', 'default'],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        sprites: resolve(__dirname, 'sprites.html'),
        salvage: resolve(__dirname, 'salvage.html'),
        arena: resolve(__dirname, 'arena.html'),
        replay: resolve(__dirname, 'replay.html'),
      },
    },
  },
  server: {
    port: 5175,
  },
  test: {
    environment: 'node',
    // Inclui tanto suites centrais em src/tests quanto testes colocalizados
    // junto do modulo (por exemplo client/presentation.test.ts).
    include: ['src/**/*.test.ts'],
  },
});
