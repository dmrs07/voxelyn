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

// A semente da edicao nasce de Date.now() ^ 0xca7a7040; o resto do jogo anda
// por performance.now/rAF. Congelar SO o Date.now torna a fumaca
// deterministica: neste instante o quarteto 0-3 + o primeiro apetrecho cabem
// no orcamento — com relogio livre, rolagens caras travavam o "lock the team".
await page.addInitScript(() => {
  Date.now = () => 1756100000000;
});

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('response', (r) => r.status() >= 400 && errors.push(`http ${r.status()}: ${r.url()}`));

const step = [];
const shot = (name) => page.screenshot({ path: join(outDir, `${name}.png`) });
const sim = (fn) => page.evaluate(fn);

// Primeiro em RETRATO: layout de primeira classe — o palco corta o mundo
// para 440/270 (cover) e nenhum aviso de girar existe mais.
await page.setViewportSize({ width: phone.viewport.width, height: phone.viewport.height });
await page.goto('http://localhost:4189/', { waitUntil: 'networkidle' });
step.push(`titulo: ${await page.locator('.title-logo').textContent()}`);
await shot('c0-retrato');
const pStage = await page.locator('#stage').boundingBox();
if (Math.abs(pStage.width / pStage.height - 440 / 270) > 0.02) {
  throw new Error(`retrato: o palco nao cortou para 440/270 (${pStage.width}x${pStage.height})`);
}
if (await page.locator('.rotate-hint').count()) throw new Error('o aviso de girar sobreviveu ao retrato jogavel');
step.push('retrato: palco cortado 440/270, sem aviso de girar');
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

// --- RECRUTAMENTO: o e-mail do recrutador, seis crachas, um orcamento ------
await page.getByRole('button', { name: /open the email · career/ }).tap();
await page.waitForTimeout(300);
const candCount = await page.locator('.cand-card').count();
if (candCount !== 6) throw new Error(`o recrutador mandou ${candCount} curriculos (esperava 6)`);
// Slice D: o convite anuncia a CATEGORIA ESPECIAL e o RIVAL provoca — na
// primeira edicao de carreira o rival ja nasceu (e ficou no localStorage).
if (!(await page.locator('.recruit-special').isVisible())) throw new Error('o convite nao anuncia a categoria especial');
if (!(await page.locator('.recruit-rival').first().isVisible())) throw new Error('o rival nao provoca no e-mail da carreira');
step.push(`convite: ${await page.locator('.recruit-special').textContent()}`);
step.push(`rival: ${await page.locator('.recruit-rival').first().textContent()}`);
// O botao de fechar equipe NASCE desabilitado: sem equipe nao ha hackathon.
if (await page.getByRole('button', { name: 'lock the team' }).isEnabled()) {
  throw new Error('da para fechar equipe vazia');
}
for (let i = 0; i < 4; i++) await page.locator('.cand-card').nth(i).tap();
// A LOJINHA: tres ofertas; compra a primeira (portao de apetrecho no estado).
const shopCount = await page.locator('.shop-item').count();
if (shopCount !== 3) throw new Error(`a lojinha ofereceu ${shopCount} itens (esperava 3)`);
await page.locator('.shop-item').nth(0).tap();
await shot('c1b-recrutamento');
await page.getByRole('button', { name: 'lock the team' }).tap();
await page.waitForTimeout(400);
const team = await sim(() => window.catathon.app.state.cats.map((c) => ({ id: c.id, name: c.name, specialty: c.specialty, personality: c.personality })));
const gearBought = await sim(() => window.catathon.app.state.gear);
if (gearBought.length !== 1) throw new Error(`o apetrecho comprado nao chegou ao estado: ${JSON.stringify(gearBought)}`);
step.push(`apetrecho no booth: ${gearBought[0]}`);
// Consumiveis SEM doses nao aparecem (display de autor vs hidden: vacinado).
await page.waitForTimeout(200);
const ghostBtns = await page.evaluate(() => ({
  catnipLeft: window.catathon.app.state.catnipLeft,
  laserLeft: window.catathon.app.state.laserLeft,
  visible: Array.from(document.querySelectorAll('.action-bar .soft-btn')).filter((b) => b.offsetParent !== null).length,
}));
// 3 fixos: projeto (Kanban), Gantt e petiscos.
const expectedBtns = 3 + (ghostBtns.catnipLeft > 0 ? 1 : 0) + (ghostBtns.laserLeft > 0 ? 1 : 0);
if (ghostBtns.visible !== expectedBtns) {
  throw new Error(`botoes fantasmas na barra: ${ghostBtns.visible} visiveis, esperava ${expectedBtns}`);
}
if (team.length !== 4) throw new Error(`a run comecou com ${team.length} gatos`);
const bk = team.find((c) => c.specialty === 'backend');
if (!bk) throw new Error('nenhum backend contratado entre os 4 primeiros (cobertura quebrou)');
step.push(`recrutados: ${team.map((c) => c.name).join(', ')} — ${await sim(() => window.catathon.app.state.project.name)} no ${await sim(() => window.catathon.app.state.layoutName)}`);

// --- RETRATO JOGAVEL: HUD nas margens, toque acerta no palco cortado -------
await page.setViewportSize({ width: phone.viewport.width, height: phone.viewport.height });
await page.waitForTimeout(400);
const pRun = await page.locator('#stage').boundingBox();
const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
for (const sel of ['.team-bar', '.action-bar', '.feed-strip']) {
  const r = await page.locator(sel).boundingBox();
  if (r && overlaps(pRun, r)) throw new Error(`retrato: ${sel} cobre o palco`);
}
// Arrastar em retrato usa a conta do COVER (altura manda; corte simetrico
// em torno de 240) — espelho do input.ts, como o contain e do modo deitado.
{
  const pScale = pRun.height / 270;
  const pX0 = 240 - pRun.width / pScale / 2;
  const toP = (sx, sy) => [pRun.x + (sx - pX0) * pScale, pRun.y + sy * pScale];
  const who = team[1].id;
  const from = await page.evaluate((id) => {
    const c = window.catathon.app.state.cats.find((x) => x.id === id);
    return { x: c.x, y: c.y };
  }, who);
  const cafe = await sim(() => {
    const s = window.catathon.app.state.slots.find((x) => x.id === 'cafe');
    return { x: s.x, y: s.y };
  });
  const [ax, ay] = toP(from.x, from.y - 4);
  const [bx, by] = toP(cafe.x, cafe.y);
  await page.evaluate(
    async ([x0, y0, x1, y1]) => {
      const stage = document.querySelector('#stage');
      const send = (type, x, y) => {
        const t = new Touch({ identifier: 7, target: stage, clientX: x, clientY: y });
        stage.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }));
      };
      send('touchstart', x0, y0);
      for (let i = 1; i <= 14; i++) {
        send('touchmove', x0 + ((x1 - x0) * i) / 14, y0 + ((y1 - y0) * i) / 14);
        await new Promise((r) => setTimeout(r, 30));
      }
      send('touchend', x1, y1);
    },
    [ax, ay, bx, by]
  );
  await page.waitForTimeout(500);
  const landed = await page.evaluate((id) => window.catathon.app.state.cats.find((x) => x.id === id).slot, who);
  if (landed !== 'cafe') throw new Error(`retrato: o arrasto errou o alvo (slot=${landed})`);
  step.push('retrato jogavel: HUD nas margens e arrasto certeiro no palco cortado');
}
await shot('c1c-retrato-jogavel');
await page.setViewportSize({ width: phone.viewport.height, height: phone.viewport.width });
await page.waitForTimeout(400);

// Todo botao tem PALAVRA e alvo >= 44px (licoes de toque, agora portao).
await page.waitForTimeout(200);
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
const shortBtns = buttons.filter((b) => b.text !== 'cut' && b.h < 44);
if (shortBtns.length) throw new Error(`botao com alvo < 44px: ${JSON.stringify(shortBtns)}`);
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
await page.getByRole('button', { name: 'project' }).tap();
await page.locator('.task-choice', { hasText: 'feline monolith' }).tap();
await page.waitForTimeout(200);
const chosen = await sim(() => window.catathon.app.state.tasks.find((t) => t.id === 'b1').chosen);
if (chosen !== 'monolito') throw new Error(`a decisao nao pegou: chosen=${chosen}`);
step.push('decisao pelo dedo: b1 = feline monolith');
await page.getByRole('button', { name: 'project' }).tap();

// --- EQUIPE: selecionar pelo retrato abre a ficha COMPACTA no rodape -------
await page.locator('.team-bar button').nth(2).tap();
await page.waitForTimeout(250);
if (!(await page.locator('.cat-dock').isVisible())) throw new Error('a ficha compacta nao abriu');
const dockBox = await page.locator('.cat-dock').boundingBox();
const vp = page.viewportSize();
if (dockBox.y < vp.height * 0.4) throw new Error('a ficha compacta invadiu a area jogavel do topo');
step.push(`ficha compacta no rodape: ${await page.locator('.dock-name').textContent()}`);
await page.locator('.team-bar button').nth(2).tap();

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
const catPos = await page.evaluate((id) => {
  const c = window.catathon.app.state.cats.find((x) => x.id === id);
  return { x: c.x, y: c.y };
}, bk.id);
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
  const s = window.catathon.app.state.slots.find((x) => x.id === 'desk-backend');
  return { x: s.x, y: s.y };
});
await drag(catPos.x, catPos.y - 4, deskPos.x, deskPos.y);
await page.waitForTimeout(1200);
const afterDrag = await page.evaluate((id) => {
  const c = window.catathon.app.state.cats.find((x) => x.id === id);
  return { slot: c.slot, mode: c.mode };
}, bk.id);
step.push(`arrasto: ${bk.name} slot=${afterDrag.slot} mode=${afterDrag.mode}`);
if (afterDrag.slot !== 'desk-backend') {
  const dbgS = await page.evaluate((id) => {
    const app = window.catathon.app;
    const c = app.state.cats.find((x) => x.id === id);
    return { held: app.state.held, mode: c.mode, x: c.x, y: c.y, slot: c.slot, inX: app.input.x, inY: app.input.y, inDown: app.input.down, q: app.input.queue.length, handX: app.state.handX, handY: app.state.handY, tick: app.state.tick, phase: app.phase };
  }, bk.id);
  console.error('DEBUG', JSON.stringify(dbgS), 'catPos', JSON.stringify(catPos), 'deskPos', JSON.stringify(deskPos));
  throw new Error('arrastar nao colocou o gato na mesa');
}

// O quadro ANDA: b1 progride com o especialista na mesa.
await page.waitForTimeout(1500);
const progress = await sim(() => window.catathon.app.state.tasks.find((t) => t.id === 'b1').progress);
step.push(`b1 progrediu: ${Math.round(progress)} unidades`);
if (progress <= 0) throw new Error('a mesa nao produz');

// --- CARINHO: segurar o dedo parado em cima do gato ------------------------
const energyBeforePet = await page.evaluate((id) => {
  const c = window.catathon.app.state.cats.find((x) => x.id === id);
  c.stress = 0.7;
  return c.energy;
}, bk.id);
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
const petOut = await page.evaluate((id) => {
  const c = window.catathon.app.state.cats.find((x) => x.id === id);
  return { stress: c.stress, energy: c.energy };
}, bk.id);
step.push(`carinho: estresse 0.70 -> ${petOut.stress.toFixed(2)}`);
if (petOut.stress >= 0.68) throw new Error('segurar o dedo nao faz carinho');
// O EXPLOIT morto continua morto: carinho NAO recupera energia.
if (petOut.energy > energyBeforePet + 0.001) throw new Error('carinho recuperou energia: o exploit voltou');
step.push('carinho nao recupera energia (o exploit segue morto)');
await shot('c2-jogando');

// --- PETISCO: botao com palavra, depois toque no gato ----------------------
await page.getByRole('button', { name: /treat/ }).tap();
const eater = await page.evaluate((id) => {
  const c = window.catathon.app.state.cats.find((x) => x.id === id);
  return { x: c.x, y: c.y };
}, team[1].id);
const [fx, fy] = toClient(eater.x, eater.y - 4);
await page.touchscreen.tap(fx, fy);
await page.waitForTimeout(300);
const treats = await sim(() => window.catathon.app.state.treats);
step.push(`petisco: restam ${treats}`);
if (treats !== 2) throw new Error(`petisco nao desceu: ${treats}`);

// --- CORTAR ESCOPO: abre o quadro pelo botao com palavra, corta, fecha -----
const boardHidden = await page.evaluate(() => document.querySelector('.hud-board').hidden);
if (!boardHidden) throw new Error('o quadro nasce aberto e cobre o pavilhao');
await page.getByRole('button', { name: 'project' }).tap();
// O rotulo de o3 e GERADO por run: corta pelo nome real do quadro.
const o3Label = await sim(() => window.catathon.app.state.tasks.find((t) => t.id === 'o3').label);
await page.locator('.task', { hasText: o3Label }).getByRole('button', { name: 'cut' }).tap();
await page.waitForTimeout(300);
const cutOk = await sim(() => window.catathon.app.state.tasks.find((t) => t.id === 'o3').cut);
step.push(`cortar escopo: o3.cut=${cutOk}`);
if (!cutOk) throw new Error('cortar nao cortou');
await shot('c3-quadro');

// --- EVENTO SOCIAL: o pavilhao interrompe com uma escolha A/B --------------
await sim(() => {
  const st = window.catathon.app.state;
  st.social[0].kind = 'workshop';
  st.social[0].at = st.tick + 15;
});
await page.waitForTimeout(700);
if (!(await page.locator('.social-modal').isVisible())) throw new Error('o modal do evento social nao abriu');
await shot('c3b-social');
await page.locator('.social-a').tap();
await page.waitForTimeout(250);
const socialTaken = await sim(() => window.catathon.app.state.social[0]);
if (!socialTaken.resolved || socialTaken.taken !== 'a') throw new Error('a escolha A nao resolveu o evento');
const boosted = await sim(() => window.catathon.app.state.cats.some((c) => c.speedBoost > 0));
if (!boosted) throw new Error('o workshop nao aplicou o boost');
step.push('evento social pelo dedo: workshop, opcao A, +8% aplicado');

// --- O CHIP DE BUG e clicavel e abre o projeto (achado de revisao) ---------
await page.getByRole('button', { name: 'project' }).tap(); // fecha o quadro
await sim(() => {
  const st = window.catathon.app.state;
  st.bugs.push({ id: 99, track: 'design', by: st.cats[0].id, cost: 600, progress: 0, fixed: false });
});
await page.waitForTimeout(250);
await page.locator('.hud-bugs').tap();
await page.waitForTimeout(150);
if (await page.evaluate(() => document.querySelector('.hud-board').hidden)) {
  throw new Error('o chip de bug nao abre o projeto');
}
step.push('chip de bug clicavel: abre o projeto');
await page.getByRole('button', { name: 'project' }).tap();
await sim(() => {
  window.catathon.app.state.bugs = window.catathon.app.state.bugs.filter((b) => b.id !== 99);
});

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
// Um gato NAO-cowboy: o cursor do cowboy pode mudar o slide e derrubar o
// gauge de proposito — gate deterministico pede palco sem risco.
const safeCat = team.find((c) => c.personality !== 'cowboy') ?? team[0];
await page.locator('.pitch-ability', { hasText: safeCat.name.toLowerCase() }).tap();
await page.waitForTimeout(300);
const g1 = await sim(() => window.catathon.app.state.pitch.gauge);
if (safeCat.personality !== 'cowboy' && g1 <= g0) {
  throw new Error(`a habilidade de palco nao mexeu na plateia: ${g0} -> ${g1}`);
}
step.push(`pitch: plateia ${g0.toFixed(2)} -> ${g1.toFixed(2)} com a gracinha de ${safeCat.name}`);
await shot('c4-pitch');
await sim(() => {
  window.catathon.app.state.pitch.ticksLeft = 30;
});
await page.waitForTimeout(1200);
if ((await sim(() => window.catathon.app.state.phase)) !== 'done') throw new Error('o pitch nao terminou');
if (!(await page.locator('.result-dims').isVisible())) throw new Error('resultado sem as cinco dimensoes');
if (!(await page.locator('.result-prize').isVisible())) throw new Error('resultado sem o premio');
// O EXTRATO do premio (achado de revisao): a fumaca escolheu monolito, entao
// ha divida — o extrato tem parcela nao-zero em QUALQUER desfecho.
if (!(await page.locator('.result-ledger').isVisible())) throw new Error('resultado sem o extrato do premio');
step.push(`extrato: ${await page.locator('.result-ledger').textContent()}`);
// Slice D: o pos-jogo mostra o DUELO com o rival e a REPUTACAO da carreira.
if (!(await page.locator('.result-rival').isVisible())) throw new Error('o resultado nao mostra o duelo com o rival');
if (!(await page.locator('.result-rep').isVisible())) throw new Error('o resultado nao mostra a reputacao');
step.push(`duelo: ${await page.locator('.result-rival').textContent()}`);
const career = await page.evaluate(() => JSON.parse(localStorage.getItem('catathon-career') ?? 'null'));
if (!career || typeof career.wallet !== 'number' || career.runs < 1) {
  throw new Error(`a carreira nao persistiu: ${JSON.stringify(career)}`);
}
if (typeof career.rep !== 'number' || !career.rival || typeof career.rival.skill !== 'number') {
  throw new Error(`a carreira nao guarda reputacao/rival: ${JSON.stringify(career)}`);
}
step.push(`resultado com premio e carreira persistida (carteira: ${career.wallet}, runs: ${career.runs}, rep: ${career.rep}, rival: ${career.rival.name})`);
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
