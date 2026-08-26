#!/usr/bin/env node
// Fotografa o palco do pitch em cada nivel do circuito (display-only: forca
// state.circuit pela ponte de debug e avanca o relogio ate o pitch).
import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
const outDir = resolve(process.argv[3] ?? 'shots');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.map': 'application/json' };
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
await new Promise((r) => server.listen(4191, r));

const browser = await chromium.launch({ executablePath: process.env.CATATHON_CHROMIUM });
const phone = devices['Pixel 7'];
const page = await browser.newPage({ ...phone, viewport: { width: phone.viewport.height, height: phone.viewport.width }, hasTouch: true, isMobile: true });
await page.addInitScript(() => { Date.now = () => 1756100000000; });
await page.goto('http://localhost:4191/', { waitUntil: 'networkidle' });

const VENUES = [
  ['bairro', 0.92, 0.8], ['regional', 1, 1], ['convencao', 1.06, 1.25], ['nacional', 1.12, 1.6], ['global', 1.2, 2],
];
for (const [id, tcs, ps] of VENUES) {
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /quick run/ }).tap();
  await page.waitForTimeout(300);
  for (let i = 0; i < 4; i++) await page.locator('.cand-card').nth(i).tap();
  await page.getByRole('button', { name: 'lock the team' }).tap();
  await page.waitForTimeout(400);
  await page.evaluate(([vid, vtcs, vps]) => {
    const st = window.catathon.app.state;
    st.circuit = { id: vid, taskCostScale: vtcs, prizeScale: vps };
    // plateia em varios humores: gauge alto para ver a festa
    st.tick = 14398;
  }, [id, tcs, ps]);
  await page.waitForTimeout(500);
  await page.evaluate(() => { const p = window.catathon.app.state.pitch; if (p) p.gauge = 0.82; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(outDir, `venue-${id}.png`) });
  console.log(`venue-${id}.png`);
}
await browser.close();
server.close();
