import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import path from 'path';
import { readFileSync } from 'fs';
import type { Plugin } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(`${__dirname}/package.json`, 'utf-8'));
const BUNDLE_ID_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

function bundleIndexPlugin(): Plugin {
  return {
    name: 'bundle-index',
    configureServer(server) {
      server.middlewares.use('/api/bundles', (_req, res) => {
        const configuredRoot = process.env.VOXELYN_BUNDLES_DIR;
        const generatedDir = configuredRoot
          ? path.resolve(configuredRoot)
          : path.resolve(process.cwd(), 'assets/generated');
        const entries: { id: string; type: string; prompt?: string; mode?: string }[] = [];

        let dirs: string[] = [];
        try {
          dirs = fs
            .readdirSync(generatedDir, { withFileTypes: true })
            .filter((d) => d.isDirectory() && BUNDLE_ID_PATTERN.test(d.name))
            .map((d) => d.name)
            .sort()
            .reverse();
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify([]));
          return;
        }

        for (const dir of dirs) {
          const manifestPath = path.join(generatedDir, dir, 'manifest.json');
          const legacyPath = path.join(generatedDir, dir, 'scenario.json');

          if (fs.existsSync(manifestPath)) {
            try {
              const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
              entries.push({
                id: dir,
                type: manifest.type ?? 'unknown',
                prompt: manifest.prompt,
                mode: manifest.mode,
              });
            } catch {
              entries.push({ id: dir, type: 'error' });
            }
          } else if (fs.existsSync(legacyPath)) {
            try {
              const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
              entries.push({
                id: dir,
                type: 'scenario',
                prompt: legacy.prompt,
                mode: 'legacy',
              });
            } catch {
              entries.push({ id: dir, type: 'legacy' });
            }
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(entries));
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [svelte(), bundleIndexPlugin()],
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
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
