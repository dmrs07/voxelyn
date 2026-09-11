// CAPTURA DE VIDEO do benchmark do Magnetarca.
//
// Serve o build, abre `bench.html` no Chromium e grava a reproducao de cada log
// que `magnetarch-bot.mjs --captures` gravou. O que aparece no video e o
// encontro rodando no renderer de verdade, com o estado inicial montado pela
// MESMA funcao que o bot usou (`createMagnetarchBench`) — nao e cena montada.
//
// USO:
//   pnpm --filter @voxelyn/survival-sim build
//   node packages/voxelyn-survival-sim/tools/magnetarch-bot.mjs --runs=24 --captures --out=/tmp/caps
//   pnpm --filter @voxelyn/survival build
//   node packages/voxelyn-survival/scripts/capture-magnetarch-bench.mjs /tmp/caps /tmp/videos

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, rename } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const [capsDir, outDir] = process.argv.slice(2);
if (!capsDir || !outDir) {
  console.error('uso: capture-magnetarch-bench.mjs <dir-dos-logs> <dir-dos-videos>');
  process.exit(1);
}

const dist = resolve(import.meta.dirname, '../dist');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const file = path.startsWith('/logs/')
    ? join(resolve(capsDir), path.slice('/logs/'.length))
    : join(dist, path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('nao encontrado');
  }
});
await new Promise((r) => server.listen(4321, r));
await mkdir(outDir, { recursive: true });

const logs = (await readdir(capsDir)).filter((f) => f.endsWith('.json')).sort();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

for (const log of logs) {
  const meta = JSON.parse(await readFile(join(capsDir, log), 'utf8'));
  const context = await browser.newContext({
    viewport: { width: 960, height: 600 },
    recordVideo: { dir: outDir, size: { width: 960, height: 600 } },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:4321/bench.html?log=/logs/${log}`, { waitUntil: 'load' });
  // Espera o rig anunciar o FIM do log, com folga sobre a duracao da partida.
  await page
    .waitForFunction(() => document.getElementById('badge')?.dataset.done === 'true', null, {
      timeout: Math.max(20000, (meta.ticks / 20) * 1000 * 2.5),
    })
    .catch(() => errors.push('o rig nao chegou ao fim do log'));
  // Dois segundos de quadro final: o video precisa fechar mostrando o resultado.
  await page.waitForTimeout(2000);
  const video = page.video();
  await context.close();
  const from = await video.path();
  const to = join(outDir, `${log.replace(/\.json$/, '')}.webm`);
  await rename(from, to);
  console.log(
    `${to}  (seed ${meta.seed}, ${meta.chamber}, ${meta.strategy}, ${meta.outcome} em ${(meta.ticks / 20).toFixed(1)}s` +
      `, vida ${meta.hpLeft}/100, cauda ${(meta.flatTicks / 20).toFixed(1)}s)` +
      (errors.length ? `  ERROS: ${errors.join(' | ')}` : ''),
  );
}

await browser.close();
server.close();
