// A MATRIZ DE COR que transforma um mapa de faces em luz por pixel.
//
// ---------------------------------------------------------------------------
// O PROBLEMA
// ---------------------------------------------------------------------------
// O mapa de faces (`*.normal.png`, gerado pelo rasterizador) diz, por pixel,
// qual das tres faces do cubo o pintou: vermelho topo, verde esquerda, azul
// direita. Sao mascaras exclusivas — exatamente um canal aceso por pixel.
//
// Para iluminar, cada mascara precisa virar a cor que AQUELA face recebeu, e as
// tres precisam ser somadas. Em canvas 2D isso normalmente custa tres buffers
// intermediarios e tres composicoes por sprite por quadro, porque `multiply`
// opera canal a canal e nao sabe somar canais entre si.
//
// ---------------------------------------------------------------------------
// A SAIDA
// ---------------------------------------------------------------------------
// `feColorMatrix` faz exatamente essa conta, e faz numa passada. A matriz de
// cor e uma combinacao linear dos canais de entrada:
//
//     R' = m00*R + m01*G + m02*B
//     G' = m10*R + m11*G + m12*B
//     B' = m20*R + m21*G + m22*B
//
// Com R/G/B sendo as mascaras das tres faces, basta pôr a COR de cada face na
// coluna dela e o resultado e a soma das tres — que e a definicao de iluminar
// um corpo com tres normais. Um `drawImage` por sprite, sem buffer nenhum.
//
// Medido no Chromium: 20 sprites filtrados por quadro custam 0,57 ms, contra os
// 16,7 ms de um quadro a 60 Hz.
//
// ---------------------------------------------------------------------------
// E QUANDO NAO DA
// ---------------------------------------------------------------------------
// `ctx.filter` com `url(#...)` nao existe em todo navegador, e ha os que
// aceitam a propriedade e ignoram o filtro — o pior caso possivel, porque o
// desenho sairia sem luz nenhuma em silencio. Por isso a deteccao nao pergunta
// se a propriedade existe: ela DESENHA um pixel atraves de um filtro que zera
// um canal e confere o resultado. Falhando, o chamador volta para a iluminacao
// por silhueta, que e o que o jogo fazia antes e continua correto.

/** Um pixel de cor `rgb(...)`, decomposto em 0..1. */
const parseRgb = (css: string): [number, number, number] => {
  const parts = css.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return [1, 1, 1];
  return [Number(parts[0]) / 255, Number(parts[1]) / 255, Number(parts[2]) / 255];
};

export type FaceContribution = { color: string; alpha: number };

/**
 * Os vinte valores de `feColorMatrix` para iluminar as tres faces de uma vez.
 *
 * Cada face entra na COLUNA do proprio canal, com a cor dela ja multiplicada
 * pela forca: a coluna 0 (vermelho de entrada = mascara do topo) recebe a cor
 * do topo, a 1 a da esquerda, a 2 a da direita. A quarta coluna e o alpha de
 * entrada, que nao participa da cor, e a quinta e o termo constante — zero,
 * porque luz que aparece onde nao ha luz nenhuma seria luz inventada.
 *
 * A linha do alpha e `0 0 0 1 0`: a silhueta do mapa de faces e a do sprite, e
 * ela passa intacta. Mexer nela abriria ou fecharia o corpo em vez de ilumina-lo.
 *
 * Pura e exportada porque e a unica parte disto que faz uma afirmacao
 * verificavel sem um navegador por perto.
 */
export const faceColorMatrix = (faces: readonly FaceContribution[]): string => {
  const [top, left, right] = faces;
  const c = (f: FaceContribution | undefined): [number, number, number] => {
    if (!f || f.alpha <= 0) return [0, 0, 0];
    const [r, g, b] = parseRgb(f.color);
    return [r * f.alpha, g * f.alpha, b * f.alpha];
  };
  const [tr, tg, tb] = c(top);
  const [lr, lg, lb] = c(left);
  const [rr, rg, rb] = c(right);
  return [
    tr, lr, rr, 0, 0,
    tg, lg, rg, 0, 0,
    tb, lb, rb, 0, 0,
    0, 0, 0, 1, 0,
  ]
    .map((n) => (Number.isFinite(n) ? Number(n.toFixed(4)) : 0))
    .join(' ');
};

/**
 * As tres luzes na ordem em que as MASCARAS do atlas as esperam.
 *
 * Direcoes espelhadas reaproveitam a arte de outra direcao invertida em x, e o
 * mapa de faces e espelhado junto. Nesta projecao a face que aparece a ESQUERDA
 * na tela e sempre a que olha para +y do mundo — entao, depois do espelhamento,
 * os pixels que carregam a mascara VERDE (autorada como esquerda) estao
 * ocupando o lado direito da tela, onde as superficies olham para +x. As duas
 * luzes trocam de coluna.
 *
 * Sem isso, metade das direcoes do jogo recebe a luz no lado errado do corpo — e
 * como a outra metade fica certa, o defeito se apresenta como "as vezes a luz
 * fica estranha", que e a forma mais cara de encontrar um bug.
 */
export const orderFacesForDraw = <T>(faces: readonly [T, T, T], flip: boolean): readonly [T, T, T] =>
  flip ? [faces[0], faces[2], faces[1]] : faces;

const FILTER_ID = 'voxelyn-face-light';

let element: SVGFEColorMatrixElement | null = null;
let supported: boolean | null = null;

/** Cria (uma vez) o filtro SVG e devolve o no `feColorMatrix` para atualizar. */
const filterElement = (): SVGFEColorMatrixElement | null => {
  if (element) return element;
  if (typeof document === 'undefined') return null;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  const filter = document.createElementNS(NS, 'filter');
  filter.setAttribute('id', FILTER_ID);
  // sRGB e OBRIGATORIO: o padrao do SVG e operar em luz linear, e a matriz
  // seria aplicada sobre canais convertidos — a luz sairia com outra cor e
  // outra forca das que o sistema de iluminacao calculou.
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  const matrix = document.createElementNS(NS, 'feColorMatrix') as SVGFEColorMatrixElement;
  matrix.setAttribute('type', 'matrix');
  matrix.setAttribute('values', '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0');
  filter.appendChild(matrix);
  svg.appendChild(filter);
  document.body.appendChild(svg);
  element = matrix;
  return element;
};

/**
 * O navegador de fato APLICA um filtro de matriz num canvas?
 *
 * Desenha vermelho puro atraves de uma matriz que zera o vermelho e le o pixel
 * de volta. Uma leitura de um pixel, uma vez por sessao — e a unica prova que
 * nao mente, porque `'filter' in ctx` responde `true` em navegadores que depois
 * ignoram `url(#...)` sem avisar.
 */
export const faceLightSupported = (): boolean => {
  if (supported !== null) return supported;
  supported = false;
  try {
    const matrix = filterElement();
    if (!matrix) return supported;
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const ctx = probe.getContext('2d', { willReadFrequently: true });
    if (!ctx || typeof ctx.filter !== 'string') return supported;
    const source = document.createElement('canvas');
    source.width = 1;
    source.height = 1;
    const sctx = source.getContext('2d');
    if (!sctx) return supported;
    sctx.fillStyle = '#ff0000';
    sctx.fillRect(0, 0, 1, 1);
    // Zera o vermelho e leva tudo para o verde: se o filtro rodou, o pixel sai
    // verde; se foi ignorado, sai vermelho.
    matrix.setAttribute('values', '0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 1 0');
    ctx.filter = `url(#${FILTER_ID})`;
    ctx.drawImage(source, 0, 0);
    ctx.filter = 'none';
    const [r, g] = ctx.getImageData(0, 0, 1, 1).data;
    supported = r === 0 && g > 200;
  } catch {
    // Canvas indisponivel, DOM restrito, filtro recusado: sem luz por pixel.
    supported = false;
  }
  return supported;
};

/**
 * Arma o filtro para as tres faces e devolve o valor de `ctx.filter`.
 *
 * Devolve `null` quando nao ha suporte — e o chamador nao deve desenhar o
 * caminho por pixel nesse caso.
 */
export const armFaceLight = (faces: readonly FaceContribution[]): string | null => {
  if (!faceLightSupported()) return null;
  const matrix = filterElement();
  if (!matrix) return null;
  matrix.setAttribute('values', faceColorMatrix(faces));
  return `url(#${FILTER_ID})`;
};

/** Descarta o estado do modulo. Existe para o teste; em jogo ele vive a sessao. */
export const resetFaceLight = (): void => {
  element = null;
  supported = null;
};
