import { defineConfig, type Plugin } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Injeta a lista de arquivos gerados (bundles com hash + atlases) no sw.js
 * publicado. O service worker so e registrado no window.load, entao ele nunca
 * observa os fetches iniciais desses arquivos; sem precache, o app shell fica
 * em cache sem o JS do jogo e o solo offline nao inicia no primeiro uso.
 * Os nomes so existem apos o bundle, por isso a lista e escrita aqui e nao no
 * arquivo em public/.
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
    const header = `self.__VOXELYN_PRECACHE__ = ${JSON.stringify(assets)};\n`;
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
      },
    },
  },
  server: {
    port: 5175,
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
