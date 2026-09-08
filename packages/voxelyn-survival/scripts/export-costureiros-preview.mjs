// Offline playtest package: the real arena, simulation and renderer, in a classic
// script bundle that can also be opened from file:// without module CORS rules.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(project, '../..');
const out = resolve(process.argv[2] ?? resolve(root, 'docs/media/costureiros/preview'));
await mkdir(resolve(out, 'assets'), { recursive: true });
await build({
  entryPoints: [resolve(project, 'src/client/arena-main.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  outfile: resolve(out, 'arena.js'),
  loader: { '.svg': 'dataurl' },
  define: { 'import.meta.env': '{}', 'import.meta.url': 'location.href' },
  alias: {
    '@voxelyn/survival-sim': resolve(root, 'packages/voxelyn-survival-sim/src/index.ts'),
    '@voxelyn/survival-protocol': resolve(root, 'packages/voxelyn-survival-protocol/src/index.ts'),
    '@voxelyn/survival-content': resolve(root, 'packages/voxelyn-survival-content/src/index.ts'),
    '@voxelyn/core': resolve(root, 'packages/voxelyn-core/src/index.ts'),
  },
  plugins: [
    {
      name: 'atlas-files',
      setup(builder) {
        builder.onResolve({ filter: /^@voxelyn\/survival-content\/assets\// }, (args) => ({
          path: resolve(
            root,
            'packages/voxelyn-survival-content/assets',
            args.path.split('/assets/')[1].replace(/\?url$/, ''),
          ),
          namespace: args.path.endsWith('?url') ? 'preview-asset' : 'file',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'preview-asset' }, async (args) => {
          const name = basename(args.path);
          await copyFile(args.path, resolve(out, 'assets', name));
          return { contents: `export default ${JSON.stringify('./assets/' + name)}`, loader: 'js' };
        });
      },
    },
  ],
});
const html = (await readFile(resolve(project, 'arena.html'), 'utf8')).replace(
  '<script type="module" src="./src/client/arena-main.ts"></script>',
  '<script src="./arena.js"></script>',
);
await writeFile(resolve(out, 'index.html'), html);
await writeFile(
  resolve(out, 'LEIA-ME.txt'),
  'Preview Costureiros — abra index.html e selecione A Cerzideira.\nWASD: mover. Mouse: mirar/disparar. Espaço: esquiva.\nO painel de suturas permite pausar e examinar os avisos do encontro.\nEste pacote usa a simulação e o renderer do jogo.\n',
);
console.log(out);
