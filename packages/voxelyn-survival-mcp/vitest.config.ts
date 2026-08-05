import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@voxelyn/survival-protocol': resolve(__dirname, '../voxelyn-survival-protocol/src/index.ts'),
      '@voxelyn/survival-sim': resolve(__dirname, '../voxelyn-survival-sim/src/index.ts'),
      '@voxelyn/core': resolve(__dirname, '../voxelyn-core/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
