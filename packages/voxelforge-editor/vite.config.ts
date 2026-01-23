import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(`${__dirname}/package.json`, 'utf-8'));

export default defineConfig({
  base: './',
  plugins: [svelte()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '$lib': `${__dirname}/src/lib`,
      '@voxelyn/ai': resolve(__dirname, '../voxelyn-ai/src/index.ts'),
      '@voxelyn/core': resolve(__dirname, '../voxelyn-core/src/index.ts'),
    },
    conditions: ['browser', 'import', 'module', 'default'],
  },
  server: {
    port: 5173,
    open: true,
  },
});
