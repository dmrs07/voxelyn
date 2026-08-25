#!/usr/bin/env node
// SPRITE LAB — canvas ISOLADO de desenvolvimento de sprite: um gato por vez,
// fundo neutro, zero UI, zero movel. E o portao do fluxo de arte descrito em
// docs/art-direction.md: nenhuma pose entra no jogo sem passar por aqui.
// Gera a folha de contato: nativo, 8x, silhueta e ancoras anatomicas.
// uso: node lab.mjs <sprites.json> <out.png>
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const spec = JSON.parse(await readFile(resolve(process.argv[2]), 'utf8'));
const out = resolve(process.argv[3]);

const html = `<!doctype html><meta charset="utf-8">
<style>
  body { margin: 0; background: #b9bfca; font: 12px monospace; color: #222; }
  .sheet { display: flex; flex-direction: column; gap: 14px; padding: 14px; }
  .row { display: flex; gap: 18px; align-items: flex-start; }
  .cell { display: grid; gap: 4px; justify-items: center; }
  canvas { image-rendering: pixelated; background: #b9bfca; }
  .dark canvas { background: #3a4050; }
  .lab { font-weight: bold; }
</style>
<div class="sheet" id="sheet"></div>
<script>
const SPEC = ${JSON.stringify(spec)};
const sheet = document.getElementById('sheet');
const drawInto = (ctx, rows, pal, sc, mode) => {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      ctx.fillStyle = mode === 'sil' ? '#14161c' : (pal[ch] || '#ff00ff');
      ctx.fillRect(x * sc, y * sc, sc, sc);
    }
  });
};
const cell = (label, w, h, sc, dark, draw) => {
  const d = document.createElement('div');
  d.className = 'cell' + (dark ? ' dark' : '');
  const c = document.createElement('canvas');
  c.width = w * sc; c.height = h * sc;
  draw(c.getContext('2d'));
  const l = document.createElement('div');
  l.className = 'lab'; l.textContent = label;
  d.append(c, l);
  return d;
};
// Amostras da paleta no topo da folha.
{
  const d = document.createElement('div');
  d.className = 'row';
  for (const [ch, col] of Object.entries(SPEC.pal)) {
    const sw = document.createElement('div');
    sw.className = 'cell';
    const c = document.createElement('canvas');
    c.width = 28; c.height = 28;
    const ctx = c.getContext('2d');
    ctx.fillStyle = col; ctx.fillRect(0, 0, 28, 28);
    const l = document.createElement('div');
    l.textContent = ch + ' ' + col;
    sw.append(c, l);
    d.appendChild(sw);
  }
  sheet.appendChild(d);
}
for (const [name, s] of Object.entries(SPEC.sprites)) {
  const w = Math.max(...s.rows.map(r => r.length));
  const h = s.rows.length;
  const row = document.createElement('div');
  row.className = 'row';
  row.appendChild(cell(name + ' 1x', w, h, 1, false, (ctx) => drawInto(ctx, s.rows, SPEC.pal, 1)));
  row.appendChild(cell(name + ' 8x', w, h, 8, false, (ctx) => drawInto(ctx, s.rows, SPEC.pal, 8)));
  row.appendChild(cell('silhueta', w, h, 8, false, (ctx) => drawInto(ctx, s.rows, SPEC.pal, 8, 'sil')));
  row.appendChild(cell('ancoras', w, h, 8, false, (ctx) => {
    drawInto(ctx, s.rows, SPEC.pal, 8);
    ctx.font = 'bold 9px monospace';
    for (const [label, [ax, ay]] of Object.entries(s.anchors || {})) {
      ctx.strokeStyle = '#d81b60'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ax * 8 - 5, ay * 8 + 4); ctx.lineTo(ax * 8 + 13, ay * 8 + 4);
      ctx.moveTo(ax * 8 + 4, ay * 8 - 5); ctx.lineTo(ax * 8 + 4, ay * 8 + 13);
      ctx.stroke();
      ctx.fillStyle = '#7a0f37';
      ctx.fillText(label, ax * 8 + 12, ay * 8 - 4);
    }
  }));
  sheet.appendChild(row);
  if (s.desc) {
    const d = document.createElement('div');
    d.style.maxWidth = '900px';
    d.textContent = s.desc;
    sheet.appendChild(d);
  }
}
</script>`;

const browser = await chromium.launch(process.env.CATATHON_CHROMIUM ? { executablePath: process.env.CATATHON_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(200);
const el = await page.locator('#sheet').boundingBox();
await page.screenshot({ path: out, clip: el });
await browser.close();
console.log('ok', out);
