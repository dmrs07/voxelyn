import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

import { PNG } from 'pngjs';
import { chromium } from 'playwright';

import { chromiumExecutable } from './paths.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

/**
 * Servidor estatico minimo para o build. Sem dependencia externa.
 *
 * `fallbacks` sao raizes tentadas quando o caminho nao existe na principal.
 * Isso existe por causa da origem do projeto: o HTML dos demos pedia
 * `./index.js` ao lado de si mesmo, enquanto o `tsc` emitia em
 * `dist/examples/.../index.js`. Servir a raiz com o dist atras costura os dois
 * sem precisar copiar arquivo nenhum.
 */
export function serveStatic(root, fallbacks = []) {
  const roots = [root, ...fallbacks];
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    // normalize() antes de resolve() barra "../" no path: o servidor so pode
    // enxergar dentro das raizes declaradas, mesmo rodando local.
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');

    let file = null;
    for (const base of roots) {
      const candidate = resolve(base, `.${rel}`);
      if (!candidate.startsWith(base)) {
        res.writeHead(403).end();
        return;
      }
      if (!existsSync(candidate)) continue;
      file = statSync(candidate).isDirectory() ? join(candidate, 'index.html') : candidate;
      if (existsSync(file)) break;
      file = null;
    }

    if (!file) {
      res.writeHead(404).end('nao encontrado');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(res);
  });

  return new Promise((ok) => {
    server.listen(0, '127.0.0.1', () =>
      ok({
        port: server.address().port,
        close: () => new Promise((done) => server.close(done)),
      }),
    );
  });
}

/**
 * Quanta informacao existe num PNG, como desvio padrao da luminancia (0..255).
 *
 * E assim que sabemos que o jogo JA PINTOU. Esperar por tempo fixo fotografa o
 * veu de deploy ou um canvas em branco; esperar por um seletor nao ajuda,
 * porque o <canvas> existe desde o primeiro quadro, vazio. A unica pergunta
 * honesta e "ja tem imagem aqui?", e ela se responde nos pixels.
 */
export function inkiness(buffer) {
  const png = PNG.sync.read(buffer);
  const { data, width, height } = png;
  // Amostragem esparsa: a resposta e a mesma e o custo cabe num laco de espera.
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 4000)));
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += lum;
      sumSq += lum * lum;
      n += 1;
    }
  }
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sumSq / n - mean * mean));
}

/** Abaixo disto a imagem e uma cor chapada: canvas vazio ou veu fechado. */
const INK_THRESHOLD = 6;

/**
 * Marcas de "ja vi isso" que um navegador zerado nao tem.
 *
 * Todo contexto novo do Playwright e um jogador de primeira viagem, e o jogo
 * trata primeira viagem com telas que PARAM o fluxo: a Inducao abre sozinha
 * por cima do despacho e a dica de pausa cobre o primeiro quadro da run. Sem
 * semear isto, toda captura de gameplay vira foto de tela de onboarding.
 *
 * Chaves que nao existiam no commit capturado sao simplesmente ignoradas pelo
 * app — por isso a lista pode crescer sem quebrar o passado.
 */
const RETURNING_PLAYER_STORAGE = {
  'voxelyn.induction.seen': '1',
  'voxelyn.pausehint': '1',
};

async function waitForInk(page, selector, { timeout = 25_000 } = {}) {
  const deadline = Date.now() + timeout;
  let best = 0;
  while (Date.now() < deadline) {
    const target = await page.$(selector);
    if (target) {
      try {
        const ink = inkiness(await target.screenshot({ timeout: 5000 }));
        best = Math.max(best, ink);
        if (ink >= INK_THRESHOLD) return ink;
      } catch {
        /* elemento trocado no meio do quadro: tenta de novo */
      }
    }
    await page.waitForTimeout(400);
  }
  throw new Error(
    `${selector} nunca pintou (melhor variancia ${best.toFixed(1)} < ${INK_THRESHOLD}) — ` +
      `provavelmente o app nao chegou a rodar`,
  );
}

async function runStep(page, step, log) {
  const optional = step.optional === true;
  const attempt = async () => {
    switch (step.do) {
      case 'waitFor':
        await page.waitForSelector(step.selector, {
          state: 'visible',
          timeout: step.timeout ?? 20_000,
        });
        break;
      case 'wait':
        await page.waitForTimeout(step.ms);
        break;
      case 'waitForFonts':
        await page.evaluate(() => document.fonts.ready);
        break;
      case 'waitForInk':
        await waitForInk(page, step.selector, { timeout: step.timeout });
        break;
      case 'click':
        await page.click(step.selector, { timeout: step.timeout ?? 10_000 });
        break;
      case 'dismiss': {
        // Clica SE estiver na tela, sem esperar por ele. Um `click` normal
        // esperaria 10s por uma folha que na maioria dos commits nem abre.
        const el = await page.$(step.selector);
        if (el && (await el.isVisible())) {
          await el.click({ timeout: 5000 });
          await page.waitForTimeout(400);
        }
        break;
      }
      case 'submit':
        await page.dispatchEvent(step.selector, 'submit', {}, { timeout: step.timeout ?? 10_000 });
        break;
      case 'press':
        await page.keyboard.press(step.key);
        break;
      case 'hold':
        await page.keyboard.down(step.key);
        await page.waitForTimeout(step.ms);
        await page.keyboard.up(step.key);
        break;
      default:
        throw new Error(`passo desconhecido: ${step.do}`);
    }
  };

  try {
    await attempt();
  } catch (err) {
    if (!optional) throw err;
    log(
      `  passo opcional pulado (${step.do} ${step.selector ?? step.key ?? ''}): ${err.message.split('\n')[0]}`,
    );
  }
}

/**
 * Dirige um build servido ate o quadro da receita e devolve o PNG.
 *
 * `seed` substitui Math.random por uma sequencia fixa ANTES de qualquer script
 * da pagina rodar. Nao torna a captura bit a bit identica — o jogo tem tempo
 * real dentro —, mas tira a maior fonte de variacao: dois PNGs do mesmo commit
 * mostram o mesmo setor, com os mesmos inimigos.
 */
export async function capture(recipe, { port, seed = 20260810, debug = false, log = () => {} }) {
  const browser = await chromium.launch({ executablePath: chromiumExecutable() });
  try {
    const context = await browser.newContext({
      viewport: recipe.viewport,
      deviceScaleFactor: 2, // devlog em tela de retina; 1x fica mole no Instagram
      // O veu de deploy leva ~1,7s cobrindo a tela inteira de preto. Reduced
      // motion e o caminho que o proprio jogo oferece para pular a transicao.
      reducedMotion: 'reduce',
      // O PWA registra um service worker no load. Numa captura ele so
      // adiciona uma camada de cache entre o build e o que a foto mostra.
      serviceWorkers: 'block',
    });

    const page = await context.newPage();
    await page.addInitScript(
      ({ s, storage }) => {
        let state = s >>> 0;
        Math.random = () => {
          state = (state * 1664525 + 1013904223) >>> 0;
          return state / 4294967296;
        };
        try {
          for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
        } catch {
          /* storage bloqueado: o pior caso e a tela de onboarding aparecer */
        }
      },
      { s: seed, storage: RETURNING_PLAYER_STORAGE },
    );

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    if (debug) page.on('console', (msg) => log(`  [console:${msg.type()}] ${msg.text()}`));

    await page.goto(`http://127.0.0.1:${port}/${recipe.page}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    for (const step of recipe.steps) await runStep(page, step, log);

    // `clip` recorta no elemento em vez da janela. Vale para paginas que sao
    // uma caixa de conteudo num mar de fundo; para o jogo em tela cheia a
    // janela E o enquadramento.
    const target = recipe.clip ? await page.$(recipe.clip) : null;
    const png = await (target ?? page).screenshot({ type: 'png' });
    await context.close();
    return { png, errors };
  } finally {
    await browser.close();
  }
}
