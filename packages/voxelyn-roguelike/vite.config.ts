import { defineConfig } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { cpSync, existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const rootAssetsDir = resolve(repoRoot, 'assets');
const distAssetsDir = resolve(__dirname, 'dist/assets');

const rootAssetsPlugin = () => ({
  name: 'voxelyn-root-assets',
  configureServer(server: { middlewares: { use: (handler: (req: { url?: string }, res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: Buffer | string) => void }, next: () => void) => void) => void } }) {
    server.middlewares.use((req, res, next) => {
      const requestPath = decodeURIComponent((req.url ?? '').split('?')[0] ?? '');
      if (!requestPath.startsWith('/assets/')) {
        next();
        return;
      }
      const filePath = resolve(repoRoot, `.${requestPath}`);
      if (!filePath.startsWith(rootAssetsDir) || !existsSync(filePath)) {
        next();
        return;
      }
      if (filePath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
      if (filePath.endsWith('.json')) res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(readFileSync(filePath));
    });
  },
  writeBundle() {
    if (existsSync(rootAssetsDir)) {
      cpSync(rootAssetsDir, distAssetsDir, { recursive: true });
    }
  },
});

export default defineConfig({
  base: './',
  publicDir: resolve(__dirname, '../../docs'),
  plugins: [rootAssetsPlugin()],
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
