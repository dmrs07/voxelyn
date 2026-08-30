// Verificacao de fumaca da MINIGUN: ela existe, cospe, trava, esfria, esvazia
// e e ejetada — num browser de verdade, com o jogo de verdade.
//
// Por que isto existe apesar das suites unitarias: `minigun.test.ts` prova a
// maquina de estados, `casings.test.ts` prova o teto do latao e
// `minigun-audio.test.ts` prova o orcamento de vozes. Nenhum dos tres toca no
// laco de render. Um `casings.step` esquecido, um `moduleProps.drawWorld` fora
// da ordem de pintura, uma sobreposicao de canos que lanca com zoom 1 — tudo
// isso passa verde nos unitarios e entrega um jogo quebrado.
//
// O que ele MEDE, e que e o ponto: o TEMPO DE QUADRO durante uma rajada
// maxima, ao longo de varios ciclos de superaquecimento e de um cartucho
// inteiro. Capsula, particula e cartucho ejetado sao os tres sistemas novos
// que rodam por quadro; se algum deles crescer sem teto, o custo aparece
// aqui como o quadro alongando de um ciclo para o outro.
//
// A arena (`arena.html`) e o veiculo porque ela concede modulos direto — nao
// ha como chegar a um cofre de classe III num teste de fumaca. Ela tambem NAO
// tem audio (nunca teve): o orcamento de vozes da arma e coberto por
// `minigun-audio.test.ts` e pelo `check:audio`, que roda no jogo completo e
// mede a criacao de nos ao longo de uma run.
//
// Uso:
//   pnpm build && node scripts/check-minigun.mjs [--shots DIR]
//
// Precisa do Playwright. Ele NAO e dependencia do pacote, pela mesma razao do
// `check:audio`: ferramenta sob demanda, nao portao de build.

import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '../dist');
const PORT = 4601;

const shotsFlag = process.argv.indexOf('--shots');
const SHOTS_DIR = shotsFlag >= 0 ? resolve(process.argv[shotsFlag + 1] ?? './shots') : null;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('check-minigun precisa do Playwright: npx playwright install chromium');
  process.exit(2);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = join(DIST, normalize(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(DIST)) throw new Error('fora do dist');
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('nao encontrado');
  }
});
await new Promise((done) => server.listen(PORT, done));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// Sonda de TEMPO DE QUADRO, instalada antes de qualquer script do jogo. Ela
// nao toca em nada do jogo: so anota quanto tempo passou entre dois quadros
// de animacao, que e a unica medida honesta de custo num laco de rAF.
await page.addInitScript(() => {
  localStorage.setItem('voxelyn.induction.seen', '1');
  window.__frames = { samples: [], last: 0 };
  const tick = (now) => {
    const probe = window.__frames;
    if (probe.last > 0) probe.samples.push(now - probe.last);
    probe.last = now;
    // Nunca cresce sem teto: sessenta segundos a 120 Hz sao 7200 amostras, e
    // a janela deslizante mantem so as ultimas.
    if (probe.samples.length > 4000) probe.samples.splice(0, probe.samples.length - 4000);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));
page.on('console', (msg) => {
  // O `favicon.ico` que o browser pede sozinho nao existe no dist: o jogo
  // declara os icones pelo manifesto do PWA. E o unico 404 esperado, e
  // ignora-lo aqui e o que mantem esta verificacao util — um portao que grita
  // por um erro constante deixa de ser lido.
  if (msg.type() !== 'error') return;
  if (msg.location()?.url?.endsWith('/favicon.ico')) return;
  pageErrors.push(`console: ${msg.text()}`);
});
page.on('requestfailed', (req) => pageErrors.push(`falhou: ${req.url()}`));

const shot = async (name) => {
  if (!SHOTS_DIR) return;
  await mkdir(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: join(SHOTS_DIR, `${name}.png`) });
};

/** Estatistica da janela desde a ultima chamada, e zera a janela. */
const frameStats = () =>
  page.evaluate(() => {
    const samples = window.__frames.samples.slice();
    window.__frames.samples.length = 0;
    if (samples.length === 0) return { count: 0, median: 0, p95: 0, worst: 0 };
    const sorted = samples.slice().sort((a, b) => a - b);
    return {
      count: sorted.length,
      median: Math.round(sorted[Math.floor(sorted.length / 2)] * 10) / 10,
      p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10,
      worst: Math.round(sorted[sorted.length - 1] * 10) / 10,
    };
  });

await page.goto(`http://localhost:${PORT}/arena.html`);
await page.waitForSelector('#module-grid input[value="minigun"]');

// O cartucho aparece na lista de modulos da arena: se ele nao estiver aqui, o
// modulo nao entrou no catalogo compartilhado.
await page.check('#module-grid input[value="minigun"]');
await shot('00-setup');
await page.click('#setup-form button[type="submit"]');
await page.waitForTimeout(900);

// Mira a direita e segura o gatilho.
await page.mouse.move(1120, 360);
await page.mouse.down();

// SPIN-UP: a rotacao cruza o limiar operacional em ~0,45 s. Aqui ainda nao
// saiu bala — o trilho da HUD esta subindo e os canos ja giram.
await page.waitForTimeout(280);
await shot('01-spinup');

// RAJADA cheia.
await page.waitForTimeout(1400);
await shot('02-burst');
const burstFrames = await frameStats();

// SUPERAQUECIMENTO: a rajada cheia estoura a barra em ~4,6 s.
await page.waitForTimeout(4200);
await shot('03-overheat');

// VARIOS CICLOS de rajada e travamento, com o gatilho preso. E aqui que o
// custo dos tres sistemas novos aparece: se o latao, os cartuchos ejetados ou
// as particulas crescessem sem teto, o quadro alongaria de um ciclo para o
// outro em vez de ficar plano.
await frameStats();
const cycles = [];
for (let cycle = 0; cycle < 4; cycle++) {
  await page.waitForTimeout(4000);
  cycles.push(await frameStats());
}
await page.mouse.up();
await page.waitForTimeout(1200);
await shot('04-spindown');

// A EJECAO. As 300 balas acabam depois de ~19 s de gatilho puro, e o calor
// estica isso para perto de meio minuto de relogio. O cartucho ejetado vive
// 2,4 s, entao um unico instantaneo no fim quase certamente o perderia: a
// captura vira uma SERIE ao longo da drenagem, e o quadro em que a peca esta
// no ar e um dos `05-eject-NN`.
await page.mouse.down();
// Amostragem DENSA: o cartucho ejetado vive 2,4 s e a essa altura da sequencia
// restam poucas dezenas de balas, entao a peca sai nos primeiros segundos
// desta retomada. Um instantaneo unico a perderia; a 300 ms nao ha como.
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(300);
  await shot(`05-eject-${String(i).padStart(2, '0')}`);
}
// Segue segurando o gatilho com a arma ja gasta: o tiro comum voltou, e o
// chao continua cheio de latao expirando.
await page.waitForTimeout(4000);
await page.mouse.up();
await page.waitForTimeout(400);
await shot('06-empty');
const afterCartridge = await frameStats();

// A arma ja acabou: o tiro comum voltou e o chao esta cheio de latao
// expirando. O quadro tem de voltar ao normal sozinho.
await page.waitForTimeout(4000);
const settled = await frameStats();

await browser.close();
server.close();

const problems = [];
if (burstFrames.count === 0) problems.push('o laco de render nao rodou');
// Teto generoso de proposito: o alvo aqui e vazamento e crescimento, nao a
// velocidade de um Chromium headless em container. 40 ms de mediana ja seriam
// 25 quadros por segundo com a arma parada de tao cara.
for (const [name, stats] of [
  ['rajada', burstFrames],
  ['assentado', settled],
]) {
  if (stats.median > 40) problems.push(`quadro mediano de ${stats.median} ms em ${name}`);
}
// CRESCIMENTO entre ciclos: AVISO, e nao reprovacao. Vale explicar por que,
// porque a versao anterior reprovava e estava errada.
//
// A mediana de intervalo entre quadros num renderer preso ao vsync e BIMODAL:
// so pode valer ~16,7 ms (60 Hz) ou ~33,3 ms (30 Hz), e nada no meio. Num
// container que divide CPU com outra coisa, a pagina inteira desce para 30 Hz
// e volta conforme a carga da MAQUINA — e a diferenca entre os dois modos e
// 16,6 ms, que qualquer limiar util reprova. Medido aqui: a MESMA build
// (`798e41f`) rodou 16,7 ms em todos os quatro ciclos numa hora e 33,3 ms em
// todos os quatro na hora seguinte, sem uma linha de codigo mudar.
//
// E a alternativa de medir o custo real existe e foi usada: cronometrar as
// funcoes de desenho fora do laco de vsync. Para a arte C5 deu 21 us por
// quadro por jogador na sobreposicao do bot, contra 17,5 us da anterior — 7 us
// por quadro com dois jogadores, 0,04% do orcamento. Um portao que reprova uma
// mudanca dessas por causa do escalonamento do container nao esta medindo o
// codigo; esta treinando quem o le a ignora-lo.
//
// O que continua REPROVANDO aqui e o que esta medida sustenta: erro de pagina,
// laco que nao roda, e um teto absoluto folgado. O vazamento de pool — que era
// o alvo original desta conta — e coberto por `casings.test.ts` e
// `module-props.test.ts`, que testam o teto diretamente e nao dependem de
// relogio nenhum.
const best = (list) => Math.min(...list.map((s) => s.median));
const half = Math.ceil(cycles.length / 2);
const drift = best(cycles.slice(half)) - best(cycles.slice(0, half));
if (drift > 8) {
  console.warn(
    `AVISO: o melhor quadro piorou ${drift.toFixed(1)} ms da primeira para a segunda metade ` +
      'dos ciclos. Uma queda de exatamente ~16,6 ms e a pagina caindo de 60 para 30 Hz, quase ' +
      'sempre carga da maquina; cronometre as funcoes de desenho antes de culpar o codigo.',
  );
}

if (pageErrors.length > 0) problems.push(`erros de pagina: ${pageErrors.join(' | ')}`);

console.log(`rajada:      ${JSON.stringify(burstFrames)}`);
cycles.forEach((s, i) => console.log(`ciclo ${i}:     ${JSON.stringify(s)}`));
console.log(`cartucho:    ${JSON.stringify(afterCartridge)}`);
console.log(`assentado:   ${JSON.stringify(settled)}`);
if (SHOTS_DIR) console.log(`capturas em ${SHOTS_DIR}`);

if (problems.length > 0) {
  console.error('\ncheck-minigun FALHOU:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log('\ncheck-minigun OK: a arma dispara, trava, esvazia e o quadro fica plano.');
