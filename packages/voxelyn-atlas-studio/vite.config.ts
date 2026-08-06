import { defineConfig, type Plugin } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Mesmo padrao de precache do cliente Survival (ver
 * packages/voxelyn-survival/vite.config.ts): injeta no sw.js publicado a lista
 * de bundles com hash e um id de build. O SW so registra no window.load, entao
 * sem precache o shell ficaria em cache sem o JS do editor e o primeiro uso
 * offline abriria em branco.
 */
const precacheManifest = (): Plugin => ({
  name: 'atlas-studio-precache-manifest',
  apply: 'build',
  writeBundle(options, bundle) {
    const dir = options.dir ?? resolve(__dirname, 'dist');
    const swPath = resolve(dir, 'sw.js');
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
    const digest = createHash('sha256');
    for (const name of assets) digest.update(name);
    for (const [name, chunk] of Object.entries(bundle)) {
      if (!name.endsWith('.html')) continue;
      const source = 'source' in chunk ? chunk.source : '';
      digest.update(typeof source === 'string' ? source : Buffer.from(source));
    }
    const build = digest.digest('hex').slice(0, 12);
    const header =
      `self.__ATLAS_STUDIO_PRECACHE__ = ${JSON.stringify(assets)};\n` +
      `self.__ATLAS_STUDIO_BUILD__ = ${JSON.stringify(build)};\n`;
    writeFileSync(swPath, header + sw);
  },
});

export default defineConfig({
  base: './',
  plugins: [precacheManifest()],
  server: {
    port: 5177,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
