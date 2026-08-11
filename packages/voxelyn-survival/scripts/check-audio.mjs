// Verificacao de fumaca do audio: o jogo REALMENTE produz som?
//
// Por que isto existe apesar das suites unitarias: `cues.test.ts` prova que o
// evento certo vira a voz certa, e `mixer.test.ts` prova que a voz certa
// sobrevive ao orcamento. Nenhum dos dois toca em `main.ts`. Um `audio.ingest`
// esquecido num dos dois loops, um contexto que nunca destrava por politica de
// autoplay, uma receita que lanca — tudo isso passa verde nos unitarios e
// entrega um jogo mudo.
//
// A tecnica: instrumentar o proprio AudioContext antes de qualquer script do
// jogo rodar e contar os nos criados durante uma run de verdade. Nao julga
// timbre (nenhum teste automatico julga), julga EXISTENCIA.
//
// Uso:
//   pnpm build && pnpm check:audio
//
// Precisa do Playwright disponivel. Ele NAO e dependencia do pacote de
// proposito: isto e uma ferramenta sob demanda, nao um portao de build, e o
// jogo nao deve arrastar um browser para o `pnpm install` de quem so quer
// compilar.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '../dist');
const PORT = 4599;

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
  console.error('check:audio precisa do Playwright. Instale com: npx playwright install chromium');
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
  // Ambientes com um Chromium ja provisionado (CI, containers de agente) muitas
  // vezes tem uma build cujo numero nao bate com o que a versao do Playwright
  // instalada procura. Apontar o binario e mais barato que baixar outro.
  executablePath: process.env.CHROMIUM_PATH || undefined,
  // O headless do CI nao tem placa de som; `--mute-audio` evita ruido no host
  // sem impedir a criacao dos nos, que e o que este teste mede.
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.addInitScript(() => {
  // Perfil de browser limpo cai na Inducao (primeira vez) em vez de comecar a
  // run — e este teste mede a run. Marca o documento como lido antes do jogo
  // carregar, como um jogador veterano.
  localStorage.setItem('voxelyn.induction.seen', '1');
  window.__audio = { contexts: 0, oscillators: 0, oscLive: 0, buffers: 0, panners: 0 };
  const Real = window.AudioContext;
  window.AudioContext = class extends Real {
    constructor(...args) {
      super(...args);
      window.__audio.contexts++;
      const osc = this.createOscillator.bind(this);
      // Alem do total CRIADO (prova que algo gerou som), o saldo VIVO: um
      // oscilador efemero que nunca recebe stop() nao dispara 'ended' e fica
      // pendurado no grafo — crescimento continuo de criados com saldo vivo
      // limitado e scheduler saudavel; os dois crescendo juntos e vazamento.
      this.createOscillator = () => {
        window.__audio.oscillators++;
        window.__audio.oscLive++;
        const node = osc();
        node.addEventListener('ended', () => window.__audio.oscLive--);
        return node;
      };
      const buf = this.createBufferSource.bind(this);
      this.createBufferSource = () => (window.__audio.buffers++, buf());
      const pan = this.createStereoPanner.bind(this);
      this.createStereoPanner = () => (window.__audio.panners++, pan());
    }
  };
});

const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));

const snapshot = () => page.evaluate(() => ({ ...window.__audio }));

await page.goto(`http://localhost:${PORT}/index.html`);
await page.waitForTimeout(1200);
const idle = await snapshot();

// O clique no botao e o gesto que destrava o audio.
await page.click('#btn-solo');
await page.waitForTimeout(600);
const started = await snapshot();

// Tiro SUSTENTADO, nao clique: o comando e amostrado uma vez por tick (50 ms),
// entao um clique instantaneo pode cair inteiro entre dois ticks.
await page.mouse.move(900, 300);
await page.mouse.down();
await page.keyboard.down('d');
await page.waitForTimeout(2500);
await page.keyboard.up('d');
await page.mouse.up();
await page.waitForTimeout(600);
const played = await snapshot();

// Janela de assentamento: as vozes efemeras do combate acima ja terminaram e
// as caudas do que a musica tenha agendado tambem. O que sobra vivo aqui tem
// de ser essencialmente o conjunto persistente (leitos + drone/pad da musica)
// mais um punhado em voo.
await page.waitForTimeout(3000);
const settled = await snapshot();

const problems = [];
// Criar o contexto no load quebraria em todo browser movel (fica 'suspended' e
// depois soa com atraso). Este teste roda com a politica de autoplay relaxada,
// entao aqui a checagem e do NOSSO codigo, nao do browser.
if (idle.contexts !== 0) problems.push('AudioContext criado antes de qualquer gesto do usuario');
if (started.contexts < 1) problems.push('nenhum AudioContext criado ao iniciar a run');
// Dois leitos de ambiencia usam buffer de ruido (fogo e gas); os outros tres
// sao osciladores (calor, contaminacao, ameaca).
if (started.buffers < 2) problems.push(`leitos de ruido nao iniciaram (buffers=${started.buffers}, esperado >= 2)`);
// Alem dos leitos tonais da ambiencia (>= 4 osciladores), o barramento de
// musica cria os proprios persistentes (drone/pad/tensao) no unlock.
if (started.oscillators < 10) problems.push(`leitos tonais + musica nao iniciaram (osciladores=${started.oscillators}, esperado >= 10)`);
if (played.oscillators <= started.oscillators && played.buffers <= started.buffers) {
  problems.push('nenhuma voz de evento disparou durante o jogo');
}
// As duas metades da prova do scheduler de musica: o total criado pode so
// crescer (notas agendadas), mas o saldo VIVO tem de ficar limitado — os
// persistentes de ambiencia + musica somam ~12; 48 da folga para vozes de
// evento em voo. Vivo acima disso e no que nao morre: vazamento.
if (settled.oscLive > 48) {
  problems.push(`osciladores vivos apos assentar: ${settled.oscLive} (esperado <= 48) — nota agendada sem stop()?`);
}
if (pageErrors.length > 0) problems.push(`erros de pagina: ${pageErrors.join(' | ')}`);

console.log(`ocioso:    ${JSON.stringify(idle)}`);
console.log(`iniciado:  ${JSON.stringify(started)}`);
console.log(`apos jogo: ${JSON.stringify(played)}`);
console.log(`assentado: ${JSON.stringify(settled)}`);

await browser.close();
server.close();

if (problems.length > 0) {
  console.error('\ncheck:audio FALHOU:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log('\ncheck:audio OK: o jogo produz som.');
