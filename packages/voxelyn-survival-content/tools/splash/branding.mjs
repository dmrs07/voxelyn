// BRANDING: o wordmark, a tagline e a assinatura ficcional, compostos
// deterministicamente sobre o beauty.
//
// REGRA CENTRAL: nenhuma letra e desenhada. O texto e tipografia de verdade,
// posta por um motor de layout de verdade (o Chromium que ja acompanha o
// repositorio via Playwright), com as FONTES DO PROPRIO JOGO — os woff2 de
// Chakra Petch que o cliente serve em `index.html`, embutidos aqui como data
// URI. Isso e o que garante que o kerning, o espacamento e as formas sejam os
// mesmos que o jogador ve no menu, e nao uma aproximacao.
//
// O logo Aurix e o SVG real do jogo (`src/assets/aurix-mark.svg`), um traçado
// vetorial pixel a pixel. Ele entra por referencia, nunca redesenhado.
//
// A camada sai com FUNDO TRANSPARENTE e e combinada com o beauty por mistura
// alfa aqui no Node. Duas razoes: o render 3D nunca precisa saber que existe
// texto (o briefing pede a versao sem branding como entrega separada), e a
// composicao fica sendo uma operacao aritmetica auditavel em vez de uma captura
// de tela do conjunto.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { COLORS } from '../lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const survivalRoot = resolve(here, '../../../voxelyn-survival');

const hex = ([r, g, b]) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;

const dataUri = (path, mime) => `data:${mime};base64,${readFileSync(path).toString('base64')}`;

/**
 * LAYOUT em fracoes do quadro, nunca em pixels.
 *
 * A mesma composicao tem de sair identica em 3840x2160 e em 1920x1080 — e
 * tambem nos crops seguros de outras proporcoes. Com medidas relativas a ALTURA
 * do quadro (e nao a largura), a tipografia mantem a mesma presenca quando a
 * proporcao muda, que e o comportamento certo: um corte mais estreito nao deve
 * encolher o titulo.
 */
export const LAYOUT = {
  /** Canto inferior direito, com a margem de seguranca da referencia. */
  right: 0.045,
  bottom: 0.055,
  /** Altura da caixa de cada linha do wordmark, em fracao da altura do quadro. */
  titleSize: 0.115,
  titleTracking: 0.055,
  titleLeading: 0.90,
  taglineSize: 0.030,
  signatureSize: 0.0225,
  signatureTracking: 0.34,
  markSize: 0.032,
};

/**
 * O documento da camada de branding.
 *
 * Escrito como HTML e nao como SVG porque o que se precisa aqui e de LAYOUT DE
 * TEXTO — kerning, entrelinha, alinhamento a direita de tres blocos de tamanhos
 * diferentes —, e um SVG resolveria isso com coordenadas calculadas a mao para
 * cada resolucao. O HTML deixa o motor fazer a conta, e o resultado e o mesmo em
 * qualquer tamanho porque toda medida esta em unidades de viewport.
 */
export const brandingHtml = ({ width, height }) => {
  const chakra700 = dataUri(
    join(survivalRoot, 'src/assets/fonts/chakra-petch-700.woff2'),
    'font/woff2'
  );
  const chakra600 = dataUri(
    join(survivalRoot, 'src/assets/fonts/chakra-petch-600.woff2'),
    'font/woff2'
  );
  const mark = readFileSync(join(survivalRoot, 'src/assets/aurix-mark.svg'), 'utf8');

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face {
    font-family: 'Chakra Petch';
    font-style: normal;
    font-weight: 700;
    src: url('${chakra700}') format('woff2');
  }
  @font-face {
    font-family: 'Chakra Petch';
    font-style: normal;
    font-weight: 600;
    src: url('${chakra600}') format('woff2');
  }
  html, body { margin: 0; padding: 0; background: transparent; }
  body { width: ${width}px; height: ${height}px; overflow: hidden; }

  .stack {
    position: absolute;
    right: ${LAYOUT.right * 100}vh;
    bottom: ${LAYOUT.bottom * 100}vh;
    text-align: right;
    font-family: 'Chakra Petch', system-ui, sans-serif;
    /* Sem antialiasing subpixel: a camada e transparente e vai ser combinada
       por alfa, e subpixel deixaria franja colorida nas bordas das letras. */
    -webkit-font-smoothing: antialiased;
  }

  .title {
    font-weight: 700;
    font-size: ${LAYOUT.titleSize * 100}vh;
    line-height: ${LAYOUT.titleLeading};
    letter-spacing: ${LAYOUT.titleTracking}em;
    /* O tracking abre um vao a DIREITA da ultima letra que o alinhamento conta
       como parte da linha. Sem compensar, as duas linhas do wordmark ficam
       desalinhadas da tagline por exatamente um espacamento. */
    margin-right: -${LAYOUT.titleTracking}em;
    text-transform: uppercase;
  }
  /* VOXELYN em pedra palida e SURVIVAL no ciano do Veio: as duas cores da
     paleta mestra que a hierarquia luminosa da cena ja usa, e nao um par novo.
     O degrade vertical e suave e vai do valor mais claro ao meio-tom da mesma
     familia — e o que da leitura de metal sem virar textura desenhada. */
  .voxelyn {
    background-image: linear-gradient(180deg, ${hex(COLORS.player)} 0%, ${hex(COLORS.chalk)} 46%, ${hex(COLORS.brass)} 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  /* O degrade de SURVIVAL fica dentro da familia FRIA: ciano do Veio, azul do
     condutor, pedra clara. A primeira versao descia para fungusLight e
     fungus — que sao os verdes do fungo — e a palavra terminava verde-musgo,
     uma cor que na cena significa outra coisa (o tapete organico do chao) e que
     a referencia nao tem em lugar nenhum do titulo. */
  .survival {
    background-image: linear-gradient(180deg, ${hex(COLORS.biolum)} 0%, ${hex(COLORS.biolum)} 52%, ${hex(COLORS.electric)} 84%, ${hex(COLORS.mist)} 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  /* Sombra projetada em duas camadas: uma curta e dura que descola a letra do
     fundo, e uma longa e difusa que a assenta. Sao as mesmas duas que um
     compositor poria, e existem porque a splash e escura e o wordmark cai sobre
     rocha — sem elas, as serifas finas do Chakra Petch somem no ruido do
     basalto. */
  .title, .tagline, .signature { filter:
    drop-shadow(0 ${0.0025 * height}px ${0.004 * height}px rgba(0,0,0,0.85))
    drop-shadow(0 ${0.010 * height}px ${0.022 * height}px rgba(0,0,0,0.55)); }

  .tagline {
    margin-top: ${LAYOUT.taglineSize * 0.75 * 100}vh;
    font-weight: 600;
    font-style: italic;
    font-size: ${LAYOUT.taglineSize * 100}vh;
    letter-spacing: 0.012em;
    color: ${hex(COLORS.chalk)};
  }
  /* "Vein" em negrito e no ambar dos equipamentos: e o unico realce da tagline,
     e ele nomeia a coisa que a imagem inteira mostra. */
  .tagline b { font-weight: 700; color: ${hex(COLORS.loot)}; }

  .signature {
    margin-top: ${LAYOUT.signatureSize * 2.6 * 100}vh;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: ${LAYOUT.signatureSize * 1.1 * 100}vh;
  }
  .signature svg { height: ${LAYOUT.markSize * 100}vh; width: auto; display: block; }
  .signature svg path { fill: ${hex(COLORS.loot)}; }
  .signature .name {
    font-weight: 600;
    font-size: ${LAYOUT.signatureSize * 100}vh;
    letter-spacing: ${LAYOUT.signatureTracking}em;
    margin-right: -${LAYOUT.signatureTracking}em;
    color: ${hex(COLORS.bone)};
    text-transform: uppercase;
  }
</style></head>
<body>
  <div class="stack">
    <div class="title voxelyn">Voxelyn</div>
    <div class="title survival">Survival</div>
    <div class="tagline">the <b>Vein</b> is alive — survive it</div>
    <div class="signature">
      <svg viewBox="0 0 375 350" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${mark}</svg>
      <span class="name">Aurix Dynamics</span>
    </div>
  </div>
</body></html>`;
};

/**
 * Rasteriza a camada de branding com fundo transparente.
 *
 * `omitBackground` e o que devolve alfa de verdade em vez de um retangulo
 * branco. O Chromium usado e o que o repositorio ja tem para os screenshots do
 * devlog — nenhuma dependencia nova entra por causa da splash.
 */
export const renderBrandingLayer = async ({ width, height }) => {
  const { chromium } = await import('playwright');
  const { chromiumExecutable } = await import(
    pathToFileURL(resolve(here, '../../../../scripts/devlog/lib/paths.mjs')).href
  );
  // O resolvedor de binario e o MESMO que o pipeline de devlog usa. Ele existe
  // porque o ambiente remoto traz um Chromium em /opt/pw-browsers cuja versao
  // nem sempre casa com a do pacote `playwright`, e o padrao do Playwright
  // procura um `chrome-headless-shell` que ali nao esta. Reusar em vez de
  // recopiar mantem uma decisao de ambiente num lugar so.
  const browser = await chromium.launch({ executablePath: chromiumExecutable() });
  try {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    await page.setContent(brandingHtml({ width, height }), { waitUntil: 'load' });
    // As fontes sao data URI, entao carregam sincronamente com o documento — mas
    // esperar por `document.fonts.ready` e barato e elimina a unica corrida que
    // sobraria: capturar antes de o layout reflowar com a metrica certa.
    // eslint-disable-next-line no-undef -- roda dentro da pagina, nao no Node
    await page.evaluate(() => document.fonts.ready);
    const buffer = await page.screenshot({ type: 'png', omitBackground: true });
    return PNG.sync.read(buffer);
  } finally {
    await browser.close();
  }
};

/**
 * Combina a camada sobre o beauty por mistura alfa, em espaco LINEAR.
 *
 * Misturar em sRGB e o erro classico de composicao: a borda antialiasada de uma
 * letra clara sobre fundo escuro fica visivelmente mais escura do que deveria,
 * porque a media de dois valores gama nao e a media das luminancias. Numa
 * imagem que e quase toda sombra, com um wordmark palido por cima, o defeito
 * apareceria como um contorno sujo em cada glifo.
 */
const srgbToLinear = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const linearToSrgb = (v) => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, c)) * 255);
};

export const composite = (base, layer, width, height) => {
  const out = new Uint8Array(base.length);
  out.set(base);
  for (let i = 0; i < width * height; i++) {
    const a = layer.data[i * 4 + 3] / 255;
    if (a === 0) continue;
    for (let c = 0; c < 3; c++) {
      const src = srgbToLinear(layer.data[i * 4 + c]);
      const dst = srgbToLinear(out[i * 4 + c]);
      out[i * 4 + c] = linearToSrgb(src * a + dst * (1 - a));
    }
  }
  return out;
};
