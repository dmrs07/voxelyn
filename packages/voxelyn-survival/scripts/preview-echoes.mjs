// Export a self-contained browser review. Does not replace game rendering with a mock.
// Usage: node packages/voxelyn-survival/scripts/preview-echoes.mjs /absolute/output.html
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = resolve(
  process.argv[2] ?? resolve(root, 'packages/voxelyn-survival/dist/echoes-review.html'),
);
const result = await build({
  entryPoints: [resolve(root, 'packages/voxelyn-survival/scripts/echoes-preview.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  write: false,
  outfile: 'review.js',
  minify: true,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.woff2': 'dataurl' },
  alias: {
    '@voxelyn/survival-content/assets': resolve(root, 'packages/voxelyn-survival-content/assets'),
    '@voxelyn/survival-content': resolve(root, 'packages/voxelyn-survival-content/src/index.ts'),
    '@voxelyn/survival-sim': resolve(root, 'packages/voxelyn-survival-sim/src/index.ts'),
    '@voxelyn/survival-protocol': resolve(root, 'packages/voxelyn-survival-protocol/src/index.ts'),
    '@voxelyn/core': resolve(root, 'packages/voxelyn-core/src/index.ts'),
  },
});
const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text;
const css = result.outputFiles.find((f) => f.path.endsWith('.css')).text;
// Include the actual app stylesheet so this also exposes collisions with global UI rules.
const index = await readFile(resolve(root, 'packages/voxelyn-survival/index.html'), 'utf8');
const appCss = index.match(/<style>([\s\S]*?)<\/style>/)[1];
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Echoes 2.0 · Review</title><style>${appCss}\n${css}\n
html,body{margin:0;background:#090e12;color:#d7e5df;font-family:monospace;overflow:auto}
nav{display:flex;gap:20px;align-items:center;padding:14px;position:sticky;top:0;background:#162320;z-index:100;flex-wrap:wrap}nav label{font-size:12px}nav select{margin-left:8px;color:#d7e5df;background:#14211e;padding:6px}
iframe{display:block;border:1px solid #35463f;margin:16px auto}#game{position:fixed;inset:0;width:100%;height:100%}
#status{position:fixed;bottom:4px;left:8px;font:11px monospace;color:#bccec7;background:#0b131cda;z-index:26}#replay{position:fixed;right:8px;bottom:4px;padding:6px;font:11px monospace;z-index:26}
.icon-review{display:flex;flex-wrap:wrap;gap:24px;justify-content:center;padding:50px}.icon-review h1{flex-basis:100%;text-align:center;letter-spacing:4px}.icon-review article{width:180px;background:#14201e;border:1px solid #394a43;padding:22px;text-align:center}.icon-review svg{width:88px;display:block;margin:0 auto 18px}.icon-review strong{font-size:12px}
</style></head><body><script>${js.replaceAll('</script', '<\\/script')}</script></body></html>`;
await mkdir(dirname(out), { recursive: true });
await writeFile(out, html);
console.log(`Echoes 2.0 review: ${out} (${Math.round(Buffer.byteLength(html) / 1024)} KB)`);
