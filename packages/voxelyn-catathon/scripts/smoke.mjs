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

// Primeiro em RETRATO: o aviso de girar tem de existir (aviso, nao bloqueio).
await page.setViewportSize({ width: phone.viewport.width, height: phone.viewport.height });
await page.goto('http://localhost:4189/', { waitUntil: 'networkidle' });
step.push(`titulo: ${await page.locator('.title-logo').textContent()}`);
await shot('c0-retrato');
const hint = await page.locator('.rotate-hint').isVisible();
if (!hint) throw new Error('o aviso de girar nao aparece em retrato');
step.push('aviso de girar visivel em retrato');
await page.setViewportSize({ width: phone.viewport.height, height: phone.viewport.width });
await page.waitForTimeout(200);
await shot('c1-titulo');

// AUDIO: nenhum AudioContext antes do primeiro gesto (politica de autoplay —
// e a garantia de que o jogo nao abre ja bloqueado pelo navegador).
const earlyCtx = await sim(() => window.catathon.app.audio.unlocked);
if (earlyCtx) throw new Error('AudioContext criado antes do primeiro gesto');

// Gestos de pagina desligados sob o dedo — a base de tudo.
const gestures = await page.evaluate(() => getComputedStyle(document.body).touchAction);
if (gestures !== 'none') throw new Error(`a pagina rola sob o dedo: touch-action=${gestures}`);

// Todo botao tem PALAVRA e alvo >= 44px (licoes de toque, agora portao).
await page.getByRole('button', { name: 'comecar' }).tap();
await page.waitForTimeout(400);
const buttons = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button'))
    .filter((b) => b.offsetParent !== null)
    .map((b) => ({
      text: (b.textContent ?? '').trim(),
      h: b.getBoundingClientRect().height,
      icon: b.querySelector('.btn-icon')?.innerHTML ?? '',
    }))
);
if (buttons.some((b) => b.text.length < 3)) throw new Error('botao sem palavra');
if (buttons.some((b) => b.text !== 'cortar' && b.h < 44)) throw new Error('botao com alvo < 44px');
// Icones DISTINTOS entre si nos botoes macios (barra de acoes + som): dois
// botoes com o mesmo desenho e a ilegibilidade do »/≫ da Iliada de novo.
const cluster = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.hud .soft-btn .btn-icon')).map((n) => n.innerHTML)
);
if (new Set(cluster).size !== cluster.length) throw new Error('dois botoes macios com o mesmo icone');
// A barra de acoes existe e tem base propria (nao botoes soltos no cenario).
if (!(await page.locator('.action-bar').isVisible())) throw new Error('a barra de acoes nao existe');
step.push(`botoes com palavra, alvo e icones distintos: ${buttons.length}`);

// --- DECISAO: a tarefa com escolha nao anda ate decidir pelo projeto -------
await page.getByRole('button', { name: 'projeto' }).tap();
await page.locator('.task-choice', { hasText: 'monolito felino' }).tap();
await page.waitForTimeout(200);
const chosen = await sim(() => window.catathon.app.state.tasks.find((t) => t.id === 'b1').chosen);
if (chosen !== 'monolito') throw new Error(`a decisao nao pegou: chosen=${chosen}`);
step.push('decisao pelo dedo: b1 = monolito felino');
await page.getByRole('button', { name: 'projeto' }).tap();

// --- EQUIPE: selecionar pelo retrato abre a ficha COMPACTA no rodape -------
await page.locator('.team-bar button', { hasText: 'almofada' }).tap();
await page.waitForTimeout(250);
if (!(await page.locator('.cat-dock').isVisible())) throw new Error('a ficha compacta nao abriu');
const dockBox = await page.locator('.cat-dock').boundingBox();
const vp = page.viewportSize();
if (dockBox.y < vp.height * 0.4) throw new Error('a ficha compacta invadiu a area jogavel do topo');
step.push(`ficha compacta no rodape: ${await page.locator('.dock-name').textContent()}`);
await page.locator('.team-bar button', { hasText: 'almofada' }).tap();

// O feed e uma FAIXA unica (historico atras de toque), nao uma pilha.
if (!(await page.locator('.feed-strip').isVisible())) throw new Error('a faixa de feed nao existe');

// --- ARRASTAR: Bigode para a mesa de backend, so com toque -----------------
const box = await page.locator('#stage').boundingBox();
// O canvas usa object-fit: contain: o dedo de verdade toca o bitmap em
// caixa, nao o elemento inteiro. O mapeamento daqui espelha o do input.ts —
// antes os dois erravam igual e o erro se cancelava.
const stageScale = Math.min(box.width / 480, box.height / 270);
const stageOffX = box.x + (box.width - 480 * stageScale) / 2;
const stageOffY = box.y + (box.height - 270 * stageScale) / 2;
const toClient = (sx, sy) => [stageOffX + sx * stageScale, stageOffY + sy * stageScale];
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
const deskPos = await sim(() => {
  const s = window.catathon.slots.find((x) => x.id === 'desk-backend');
  return { x: s.x, y: s.y };
});
await drag(catPos.x, catPos.y - 4, deskPos.x, deskPos.y);
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
const energyBeforePet = await sim(() => {
  const c = window.catathon.app.state.cats.find((x) => x.id === 'bigode');
  c.stress = 0.7;
  return c.energy;
});
const [px2, py2] = toClient(deskPos.x, deskPos.y - 6);
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
const petOut = await sim(() => {
  const c = window.catathon.app.state.cats.find((x) => x.id === 'bigode');
  return { stress: c.stress, energy: c.energy };
});
step.push(`carinho: estresse 0.70 -> ${petOut.stress.toFixed(2)}`);
if (petOut.stress >= 0.68) throw new Error('segurar o dedo nao faz carinho');
// O EXPLOIT morto continua morto: carinho NAO recupera energia.
if (petOut.energy > energyBeforePet + 0.001) throw new Error('carinho recuperou energia: o exploit voltou');
step.push('carinho nao recupera energia (o exploit segue morto)');
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
await page.getByRole('button', { name: 'projeto' }).tap();
await page.locator('.task', { hasText: 'autoscaling' }).getByRole('button', { name: 'cortar' }).tap();
await page.waitForTimeout(300);
const cutOk = await sim(() => window.catathon.app.state.tasks.find((t) => t.id === 'o3').cut);
step.push(`cortar escopo: o3.cut=${cutOk}`);
if (!cutOk) throw new Error('cortar nao cortou');
await shot('c3-quadro');

// --- AUDIO ADAPTATIVO: o grafo responde ao estado, verificavel sem ouvido --
const audio1 = await sim(() => {
  const app = window.catathon.app;
  return { unlocked: app.audio.unlocked, layers: app.audio.debug.layers };
});
step.push(`audio: destravado=${audio1.unlocked} camadas=[${audio1.layers.join(',')}]`);
if (!audio1.unlocked) throw new Error('o toque nao destravou o audio');
if (!audio1.layers.includes('bed')) throw new Error('a cama harmonica nao esta ativa');
if (!audio1.layers.includes('work')) throw new Error('ha gato trabalhando e a camada de ritmo nao subiu');

// Bloqueio poe a camada de tensao (harmonia suspensa, nunca buzina).
await sim(() => {
  window.catathon.app.state.cableOut = true;
});
await page.waitForTimeout(2600); // a troca espera fronteira de compasso
const audio2 = await sim(() => window.catathon.app.audio.debug.layers);
if (!audio2.includes('tension')) throw new Error(`cabo mordido sem camada de tensao: [${audio2.join(',')}]`);
await sim(() => {
  window.catathon.app.state.cableOut = false;
});
step.push(`audio: a camada de tensao respondeu ao bloqueio`);

// --- O PITCH: fase jogavel no dedo -----------------------------------------
// Avanca o relogio ate o fim das 48h; o loop do jogo faz o resto.
await sim(() => {
  window.catathon.app.state.tick = 14398; // HACK_TICKS - 2
});
await page.waitForTimeout(500);
const phasePitch = await sim(() => window.catathon.app.state.phase);
if (phasePitch !== 'pitch') throw new Error(`as 48h acabaram e o palco nao abriu: phase=${phasePitch}`);
if (!(await page.locator('.pitch-panel').isVisible())) throw new Error('o painel do pitch nao aparece');
const g0 = await sim(() => window.catathon.app.state.pitch.gauge);
await page.locator('.pitch-ability', { hasText: 'ronronar' }).tap();
await page.waitForTimeout(300);
const g1 = await sim(() => window.catathon.app.state.pitch.gauge);
if (g1 <= g0) throw new Error(`a habilidade de palco nao mexeu na plateia: ${g0} -> ${g1}`);
step.push(`pitch: plateia ${g0.toFixed(2)} -> ${g1.toFixed(2)} com um ronrom no microfone`);
await shot('c4-pitch');
await sim(() => {
  window.catathon.app.state.pitch.ticksLeft = 30;
});
await page.waitForTimeout(1200);
if ((await sim(() => window.catathon.app.state.phase)) !== 'done') throw new Error('o pitch nao terminou');
if (!(await page.locator('.result-dims').isVisible())) throw new Error('resultado sem as cinco dimensoes');
step.push('resultado em cinco dimensoes na tela final');
await shot('c5-resultado');

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
