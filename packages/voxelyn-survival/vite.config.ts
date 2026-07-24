import { defineConfig } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@voxelyn/core': resolve(__dirname, '../voxelyn-core/src/index.ts'),
    },
    conditions: ['browser', 'import', 'module', 'default'],
  },
  server: {
    port: 5175,
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
