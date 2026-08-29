// Rasteriza um SVG em PNG pelo Chromium do Playwright.
//
//   node scripts/render-svg.mjs entrada.svg saida.png [escala]
//
// Existe porque a prancha de tipologia do Prospector é autorada em SVG (texto
// vetorial, cotas nítidas em qualquer zoom) mas precisa sair também em bitmap:
// slicer, celular e impressora não abrem SVG com a mesma boa vontade. O
// navegador é o único rasterizador do repo que honra `image-rendering:
// pixelated` — e sem ele os voxels de 4px saem borrados por interpolação, que é
// justamente a informação que a prancha existe para preservar.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

import { chromiumExecutable } from './devlog/lib/paths.mjs';

const [, , svgPath, outPath, scaleArg] = process.argv;
if (!svgPath || !outPath) {
  console.error('uso: node scripts/render-svg.mjs entrada.svg saida.png [escala]');
  process.exit(1);
}

const svg = readFileSync(svgPath, 'utf8');
const dims = svg.match(/<svg[^>]*\bwidth="(\d+(?:\.\d+)?)"[^>]*\bheight="(\d+(?:\.\d+)?)"/);
if (!dims) throw new Error(`${svgPath}: o <svg> precisa declarar width e height em px`);
const width = Math.ceil(Number(dims[1]));
const height = Math.ceil(Number(dims[2]));
const scale = Number(scaleArg ?? 2);

const browser = await chromium.launch({ executablePath: chromiumExecutable() });
try {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: scale,
  });
  await page.setContent(`<style>html,body{margin:0;padding:0;background:#0b0e14}</style>${svg}`, {
    waitUntil: 'load',
  });
  writeFileSync(
    outPath,
    await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } }),
  );
} finally {
  await browser.close();
}
console.log(`${outPath} ${width * scale}x${height * scale}`);
