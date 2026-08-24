import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      // Codigo-fonte da engine, como todo pacote da casa: e o que permite rodar
      // dev e teste sem compilar o core antes. O SUBCAMINHO vem primeiro:
      // alias de string e prefixo, e a entrada nua engoliria o adapter.
      '@voxelyn/core/adapters/canvas2d': resolve(here, '../voxelyn-core/src/adapters/canvas2d.ts'),
      '@voxelyn/core': resolve(here, '../voxelyn-core/src/index.ts'),
    },
  },
  build: { target: 'es2022', outDir: 'dist', sourcemap: true },
  server: { port: 5183 },
  test: {
    environment: 'happy-dom',
  },
});
