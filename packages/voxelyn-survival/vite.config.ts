import { defineConfig } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
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
