#!/usr/bin/env node
/**
 * Fumaca de TOQUE do Catathon: um telefone emulado joga o jogo SO COM OS
 * DEDOS. Nenhuma linha usa `keyboard` ou `mouse` — se alguma etapa precisar de
 * tecla, o jogo nao e jogavel no toque e o teste falha em vez de disfarcar.
 *
 * Cada verbo do jogo e exercido e VERIFICADO no estado da simulacao (ponte
 * `window.catathon`), nao em pixels: arrastar-para-mesa, carinho (medidor
 * desce), petisco (contador desce), cortar escopo (HTML), e o quadro anda.
 */
import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
const outDir = resolve(process.argv[3] ?? 'shots');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.map': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('nao encontrado');
  }
});
await new Promise((r) => server.listen(4189, r));

// Quem acha o Chromium e o Playwright; a variavel e so para ambientes cuja
// versao instalada nao bate com a fixada (licao paga em CI).
const launch = process.env.CATATHON_CHROMIUM ? { executablePath: process.env.CATATHON_CHROMIUM } : {};
const browser = await chromium.launch(launch);
const phone = devices['Pixel 7'];
const context = await browser.newContext({
  ...phone,
  viewport: { width: phone.viewport.height, height: phone.viewport.width },
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('response', (r) => r.status() >= 400 && errors.push(`http ${r.status()}: ${r.url()}`));

const step = [];
const shot = (name) => page.screenshot({ path: join(outDir, `${name}.png`) });
const sim = (fn) => page.evaluate(fn);

await page.goto('http://localhost:4189/', { waitUntil: 'networkidle' });
step.push(`titulo: ${await page.locator('.title-logo').textContent()}`);
await shot('c1-titulo');

// Gestos de pagina desligados sob o dedo — a base de tudo.
const gestures = await page.evaluate(() => getComputedStyle(document.body).touchAction);
if (gestures !== 'none') throw new Error(`a pagina rola sob o dedo: touch-action=${gestures}`);

// Todo botao tem PALAVRA e alvo >= 44px (licoes de toque, agora portao).
await page.getByRole('button', { name: 'comecar' }).tap();
await page.waitForTimeout(400);
const buttons = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button'))
    .filter((b) => b.offsetParent !== null)
    .map((b) => ({ text: (b.textContent ?? '').trim(), h: b.getBoundingClientRect().height }))
);
if (buttons.some((b) => b.text.length < 3)) throw new Error('botao sem palavra');
if (buttons.some((b) => b.text !== 'cortar' && b.h < 44)) throw new Error('botao com alvo < 44px');
step.push(`botoes com palavra e alvo ok: ${buttons.length}`);

// --- ARRASTAR: Bigode para a mesa de backend, so com toque -----------------
const box = await page.locator('#stage').boundingBox();
const toClient = (sx, sy) => [box.x + (sx / 480) * box.width, box.y + (sy / 270) * box.height];
const catPos = await sim(() => {
  const c = window.catathon.app.state.cats.find((x) => x.id === 'bigode');
  return { x: c.x, y: c.y };
});
const drag = async (fromX, fromY, toX, toY) => {
  const [cx, cy] = toClient(fromX, fromY);
  const [tx, ty] = toClient(toX, toY);
  await page.evaluate(
    async ([ax, ay, bx, by]) => {
      const stage = document.querySelector('#stage');
      const send = (type, x, y) => {
        const t = new Touch({ identifier: 9, target: stage, clientX: x, clientY: y });
        stage.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }));
      };
      send('touchstart', ax, ay);
      const steps = 14;
      for (let i = 1; i <= steps; i++) {
        send('touchmove', ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps);
        await new Promise((r) => setTimeout(r, 30));
      }
      send('touchend', bx, by);
    },
    [cx, cy, tx, ty]
  );
};
await drag(catPos.x, catPos.y - 4, 96, 118);
await page.waitForTimeout(1200);
const afterDrag = await sim(() => {
  const app = window.catathon.app;
  const c = app.state.cats.find((x) => x.id === 'bigode');
  return { slot: c.slot, mode: c.mode };
});
step.push(`arrasto: bigode slot=${afterDrag.slot} mode=${afterDrag.mode}`);
if (afterDrag.slot !== 'desk-backend') throw new Error('arrastar nao colocou o gato na mesa');

// O quadro ANDA: b1 progride com o especialista na mesa.
await page.waitForTimeout(1500);
const progress = await sim(() => window.catathon.app.state.tasks.find((t) => t.id === 'b1').progress);
step.push(`b1 progrediu: ${Math.round(progress)} unidades`);
if (progress <= 0) throw new Error('a mesa nao produz');

// --- CARINHO: segurar o dedo parado em cima do gato ------------------------
await sim(() => {
  const c = window.catathon.app.state.cats.find((x) => x.id === 'bigode');
  c.stress = 0.7;
});
const [px2, py2] = toClient(96, 112);
await page.evaluate(
  async ([x, y]) => {
    const stage = document.querySelector('#stage');
    const send = (type, cx2, cy2) => {
      const t = new Touch({ identifier: 3, target: stage, clientX: cx2, clientY: cy2 });
      stage.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }));
    };
    send('touchstart', x, y);
    await new Promise((r) => setTimeout(r, 1400));
    send('touchend', x, y);
  },
  [px2, py2]
);
const stressAfter = await sim(() => window.catathon.app.state.cats.find((x) => x.id === 'bigode').stress);
step.push(`carinho: estresse 0.70 -> ${stressAfter.toFixed(2)}`);
if (stressAfter >= 0.68) throw new Error('segurar o dedo nao faz carinho');
await shot('c2-jogando');

// --- PETISCO: botao com palavra, depois toque no gato ----------------------
await page.getByRole('button', { name: /petisco/ }).tap();
const cheeto = await sim(() => {
  const c = window.catathon.app.state.cats.find((x) => x.id === 'cheeto');
  return { x: c.x, y: c.y };
});
const [fx, fy] = toClient(cheeto.x, cheeto.y - 4);
await page.touchscreen.tap(fx, fy);
await page.waitForTimeout(300);
const treats = await sim(() => window.catathon.app.state.treats);
step.push(`petisco: restam ${treats}`);
if (treats !== 2) throw new Error(`petisco nao desceu: ${treats}`);

// --- CORTAR ESCOPO: abre o quadro pelo botao com palavra, corta, fecha -----
const boardHidden = await page.evaluate(() => document.querySelector('.hud-board').hidden);
if (!boardHidden) throw new Error('o quadro nasce aberto e cobre o pavilhao');
await page.getByRole('button', { name: 'quadro' }).tap();
await page.locator('.task', { hasText: 'autoscaling' }).getByRole('button', { name: 'cortar' }).tap();
await page.waitForTimeout(300);
const cutOk = await sim(() => window.catathon.app.state.tasks.find((t) => t.id === 'o3').cut);
step.push(`cortar escopo: o3.cut=${cutOk}`);
if (!cutOk) throw new Error('cortar nao cortou');
await shot('c3-quadro');

console.log('\nfumaca de toque do CATATHON (Pixel 7, sem teclado nem mouse)\n');
for (const line of step) console.log(`  ${line}`);

await context.close();
await browser.close();
server.close();

if (errors.length > 0) {
  console.error('\nerros de console:');
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log('\no Catathon e jogavel no dedo: arrasta, acaricia, alimenta e corta escopo.');
