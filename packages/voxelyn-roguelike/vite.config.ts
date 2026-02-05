import { defineConfig } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@voxelyn/animation': resolve(__dirname, '../voxelyn-animation/src/index.ts'),
      '@voxelyn/core': resolve(__dirname, '../voxelyn-core/src/index.ts'),
    },
    conditions: ['browser', 'import', 'module', 'default'],
  },
  server: {
    port: 5174,
    open: true,
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
