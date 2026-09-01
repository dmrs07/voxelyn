// A GEOMETRIA do painel de status (canto superior esquerdo), sem Canvas.
//
// ---------------------------------------------------------------------------
// POR QUE ISTO EXISTE
// ---------------------------------------------------------------------------
// O painel era desenhado com uma dezena de `safeTop + N` espalhados por
// `renderHud`, e a MESMA conta repetida a mao em `renderDeathEchoReadout`
// (para a caixa-preta reservar o retangulo) e nos alvos dos voos (a lasca de
// carga pousa no contador, a Purga no glifo, o cartucho no card). Tres copias
// de uma aritmetica que ninguem testava — e a regressao que este arquivo veio
// fechar era exatamente a que uma copia nao conta: a linha de Nucleos e a
// diretiva nasceram a nove pixels uma da outra, e a diretiva mais longa
// ("O SELO DO SETOR RESISTE — DERRUBE QUEM O SUSTENTA") vazava a borda direita
// do painel, porque nenhuma das copias media texto.
//
// Aqui a altura e DERIVADA do conteudo: quantos modulos, quanto os instrumentos
// de levantamento ocupam, em quantas linhas a diretiva quebrou. O render mede
// o texto (so ele tem `measureText`), pede a geometria, e desenha nos numeros
// que ela devolve. A caixa-preta e os voos leem o retangulo que o render
// guardou do ultimo quadro — uma verdade, nao tres.
//
// ---------------------------------------------------------------------------
// A ORDEM VERTICAL E A ORDEM DE LEITURA
// ---------------------------------------------------------------------------
//   1. VITAIS   — coracao, barra de HP, trilho de calor (+ rotacao do canhao)
//   2. RECURSOS — Celulas de Purga a esquerda, carga a direita
//   3. MODULOS  — os cards, so quando ha algum
//   4. SETOR    — numero e Nucleos na MESMA linha; estrato/ocupacao abaixo
//   5. LEVANTAMENTO — mapa de saloes e previsao de onda, quando o tuning tem
//   6. DIRETIVA — o que fazer agora, quebrada em ate tres linhas
//
// Do mais rapido ao mais lento de consultar: HP se le no meio da luta, a
// diretiva se le parado. Nucleos subiu para a linha do setor porque os dois sao
// a mesma pergunta ("onde estou na descida?"), e uma linha a menos e uma linha
// que a diretiva pode usar.

import type { SafeInsets } from './module-layout';

/** Folga interna horizontal do painel. */
export const HUD_PAD = 12;
/** Fonte da diretiva; a quebra de linha e medida contra ela. */
export const HUD_OBJECTIVE_FONT = 'bold 11px monospace';
/** Avanco vertical entre linhas da diretiva. */
export const HUD_OBJECTIVE_LINE_H = 14;
/** Quantas linhas a diretiva pode ocupar antes de ser cortada. */
export const HUD_OBJECTIVE_MAX_LINES = 3;
/** Barra de acento + folga, a esquerda do texto da diretiva. */
const OBJECTIVE_ACCENT_W = 8;

export type HudPanelInput = {
  viewportWidth: number;
  safe: SafeInsets;
  /** Modulos ativos: zero esconde a fileira inteira. */
  moduleCount: number;
  /** Altura reservada aos instrumentos de levantamento (0 quando nao ha). */
  surveyHeight: number;
  /** Em quantas linhas a diretiva quebrou (>= 1). */
  objectiveLines: number;
};

export type HudRect = { x: number; y: number; width: number; height: number };

export type HudPanelLayout = HudRect & {
  innerLeft: number;
  innerRight: number;
  /** Centro do coracao voxel. */
  heart: { x: number; y: number };
  hpBar: { x: number; y: number; w: number; h: number };
  heatRail: { y: number; h: number };
  spinRail: { y: number; h: number };
  dividerA: number;
  /** Linha de recursos: baseline do texto e centro vertical dos glifos. */
  resources: { baseline: number; glyphY: number; purgeGlyphX: number };
  /** Fileira de cards; `null` sem modulos. `right` e a borda externa do painel. */
  modules: { x: number; y: number; right: number } | null;
  dividerB: number;
  sectorBaseline: number;
  biomeBaseline: number;
  /** Topo dos instrumentos de levantamento. */
  surveyTop: number;
  objective: {
    /** Onde o texto comeca (a barra de acento fica em `accentX`). */
    x: number;
    accentX: number;
    firstBaseline: number;
    lineHeight: number;
    /** Largura em que a diretiva deve ser quebrada. */
    maxWidth: number;
    lines: number;
  };
};

/**
 * A ESCALA do painel inteiro, pela tela.
 *
 * Num celular em pe o painel de 230 px come mais da metade da largura, e o
 * jogo fica atras dele. Em vez de uma segunda geometria "compacta" — que
 * seria outra copia da mesma conta, com os mesmos bugs a manter —, o painel
 * e desenhado com uma escala unica: a geometria continua em "unidades de
 * painel" e o render aplica `ctx.scale`. Todo consumidor do retangulo
 * (caixa-preta, voos) recebe o retangulo JA multiplicado.
 *
 * 0,84 num aparelho de DPR 2 ou 3 ainda e texto de 9 px CSS na diretiva —
 * legivel; abaixo disso a fonte monoespacada comeca a virar textura.
 */
export const hudScale = (viewportWidth: number, viewportHeight: number): number =>
  viewportWidth < 640 || viewportHeight < 520 ? 0.84 : 1;

/** Largura do painel: um terco da tela, presa entre o compacto e o confortavel. */
export const hudPanelWidth = (viewportWidth: number): number =>
  Math.min(300, Math.max(230, viewportWidth * 0.34));

/**
 * A largura disponivel para a diretiva, sem precisar do layout inteiro: o
 * render quebra o texto ANTES de saber quantas linhas vai ter, e o layout
 * precisa do numero de linhas. Esta funcao corta o ciclo.
 */
export const hudObjectiveMaxWidth = (viewportWidth: number): number =>
  hudPanelWidth(viewportWidth) - HUD_PAD * 2 - OBJECTIVE_ACCENT_W;

export const hudPanelLayout = (input: HudPanelInput): HudPanelLayout => {
  const x = input.safe.left + 12;
  const y = input.safe.top + 10;
  const width = hudPanelWidth(input.viewportWidth);
  const innerLeft = x + HUD_PAD;
  const innerRight = x + width - HUD_PAD;

  const heart = { x: x + 20, y: y + 21 };
  const hpBar = { x: x + 42, y: y + 13, w: width - 54, h: 15 };
  const heatRail = { y: y + 32, h: 4 };
  const spinRail = { y: y + 38, h: 2 };
  const dividerA = y + 46;

  const resources = { baseline: y + 62, glyphY: y + 58, purgeGlyphX: x + 18 };

  const hasModules = input.moduleCount > 0;
  const modules = hasModules ? { x: innerLeft, y: y + 70, right: x + width } : null;
  const dividerB = hasModules ? y + 108 : y + 72;

  const sectorBaseline = dividerB + 14;
  const biomeBaseline = sectorBaseline + 13;
  const surveyTop = biomeBaseline + 6;
  const surveyHeight = Math.max(0, input.surveyHeight);

  const lines = Math.max(1, Math.min(HUD_OBJECTIVE_MAX_LINES, Math.floor(input.objectiveLines)));
  const firstBaseline = surveyTop + surveyHeight + 13;
  const lastBaseline = firstBaseline + (lines - 1) * HUD_OBJECTIVE_LINE_H;
  const height = lastBaseline + 9 - y;

  return {
    x,
    y,
    width,
    height,
    innerLeft,
    innerRight,
    heart,
    hpBar,
    heatRail,
    spinRail,
    dividerA,
    resources,
    modules,
    dividerB,
    sectorBaseline,
    biomeBaseline,
    surveyTop,
    objective: {
      x: innerLeft + OBJECTIVE_ACCENT_W,
      accentX: innerLeft,
      firstBaseline,
      lineHeight: HUD_OBJECTIVE_LINE_H,
      maxWidth: hudObjectiveMaxWidth(input.viewportWidth),
      lines,
    },
  };
};

/** Quanto tempo o rastro segura o valor antigo antes de descer. */
export const HP_GHOST_HOLD_MS = 260;

/**
 * A fracao "fantasma" da barra de HP: o rastro que fica atras do corte.
 *
 * Quando o HP cai, o preenchimento cai na hora e um segundo trilho — mais
 * claro — segura o valor antigo por um instante e depois desce ate encontrar o
 * novo. E a leitura de "quanto acabei de perder" sem numero flutuante nenhum:
 * o tamanho do rastro E o tamanho do golpe. Cura nunca deixa rastro; o fantasma
 * sobe junto.
 *
 * Pura para o teste conferir as tres fases — segura, desce, alcanca — sem
 * relogio de verdade.
 */
export const hpGhostStep = (
  ghost: number,
  current: number,
  elapsedSinceHitMs: number,
  dtMs: number,
): number => {
  if (current >= ghost) return current;
  if (elapsedSinceHitMs < HP_GHOST_HOLD_MS) return ghost;
  // Velocidade proporcional ao que falta, com um piso: rastros minusculos
  // fechariam em um quadro, rastros enormes levariam meio segundo.
  const gap = ghost - current;
  const speed = Math.max(0.0009, gap * 0.006);
  return Math.max(current, ghost - speed * dtMs);
};

/**
 * Quebra um texto em linhas que cabem em `maxWidth`, palavra a palavra.
 *
 * `measure` e injetado para a funcao ser pura: no render e `measureText` da
 * fonte da diretiva; no teste e uma conta de caracteres. Uma palavra sozinha
 * mais larga que a linha nao e cortada — vira a sua propria linha, e o render
 * decide o que fazer com ela.
 */
export const wrapHudText = (
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] => {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter((w) => w.length > 0)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measure(candidate) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
};
