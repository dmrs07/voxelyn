// O terminal de recuperacao Aurix: a moldura, o CRT e os cards de hardware da
// escolha de modulo.
//
// A tela de escolha deixou de ser "dois retangulos flutuando sobre o jogo" e
// virou UM equipamento: carcaca de metal batido, cavidade de tela rebaixada,
// vidro de fosforo com scanlines, e dentro dele dois compartimentos com os
// cartuchos fisicos (ver module-hardware.ts). A hierarquia de leitura e:
// titulo → classe do cofre → hardware → nome → tier+carga → descricao → CTA.
//
// Contratos preservados do renderChoice antigo:
//   - os retangulos de acerto SAO os cards de moduleChoiceLayout, intocados;
//   - nada aqui bloqueia a simulacao: e tinta por cima do quadro;
//   - todo texto visivel passa pelo i18n (o teste de i18n cobra isso).
//
// Layout e fases de boot sao puros e testaveis sem Canvas; so as funcoes
// draw* tocam o contexto.

import { t } from './i18n';
import { moduleChoiceLayout, type Rect, type SafeInsets } from './module-layout';
import { drawModuleHardware } from './module-hardware';
import { modulePresentation } from './module-presentation';
import { moduleTierOf, romanTier, type CacheTier } from './salvage-presentation';
import type { ModuleId } from '@voxelyn/survival-sim';

// Cores da art bible — as mesmas do PAL privado do render.
const C = {
  dark: '#0b0e14',
  steelDark: '#1d2430',
  steel: '#2e3a4d',
  steelLight: '#46566e',
  rust: '#6e4a33',
  bone: '#b8a98f',
  biolum: '#59f2c2',
  fire: '#ff7a2f',
  loot: '#ffd166',
  player: '#e8f1ff',
};

// ---------------------------------------------------------------------------
// Layout (puro)
// ---------------------------------------------------------------------------

export type TerminalLayout = {
  /** Os DOIS retangulos de acerto — identicos ao moduleChoiceLayout. */
  cards: [Rect, Rect];
  /** O vidro do CRT: cabecalho + compartimentos + rodape. */
  screen: Rect;
  /** A carcaca de metal em volta do vidro. */
  housing: Rect;
  /** Altura da banda de cabecalho dentro da tela, acima dos cards. */
  headerH: number;
  /** Modo apertado: some primeiro o texto decorativo, nunca o mecanico. */
  compact: boolean;
};

export const salvageTerminalLayout = (
  viewportWidth: number,
  viewportHeight: number,
  safe: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 },
  reserveTouchBottom = 0,
): TerminalLayout => {
  const cards = moduleChoiceLayout(viewportWidth, viewportHeight, safe, reserveTouchBottom);
  const compact = viewportHeight < 460 || cards[0].w < 300;
  const pad = 10;
  const bezel = 7;
  const headerH = compact ? 36 : 50;
  const footerH = compact ? 6 : 18;
  const cardsLeft = Math.min(cards[0].x, cards[1].x);
  const cardsRight = Math.max(cards[0].x + cards[0].w, cards[1].x + cards[1].w);
  const cardsBottom = Math.max(cards[0].y + cards[0].h, cards[1].y + cards[1].h);
  // O vidro quer `pad` de folga em volta dos cards, mas nunca as custas da
  // area segura: em viewport estreita a moldura afina em vez de vazar.
  const left = Math.max(safe.left + bezel, cardsLeft - pad);
  const right = Math.min(viewportWidth - safe.right - bezel, cardsRight + pad);
  const top = cards[0].y - headerH;
  const bottom = Math.max(
    cardsBottom + 2,
    Math.min(viewportHeight - safe.bottom - bezel, cardsBottom + footerH),
  );
  const screen: Rect = { x: left, y: top, w: right - left, h: bottom - top };
  const housing: Rect = {
    x: screen.x - bezel,
    y: screen.y - bezel,
    w: screen.w + bezel * 2,
    h: screen.h + bezel * 2,
  };
  return { cards, screen, housing, headerH, compact };
};

// ---------------------------------------------------------------------------
// Fases de boot (puro)
// ---------------------------------------------------------------------------

/**
 * O ritmo do boot depois do gate de revelacao (choiceRevealAt):
 * rolagem de sincronismo (~150 ms) → cabecalho resolve → cartuchos acendem.
 * Total ~420 ms — um instante de maquina ligando, nunca uma cutscene. Os
 * retangulos de acerto valem desde o primeiro quadro: o boot e tinta, nao
 * bloqueio.
 */
export type ChoiceBootPhase = {
  /** Posicao 0..1 da linha de sincronismo, ou null quando ja passou. */
  roll: number | null;
  /** 0..1: opacidade do cabecalho. */
  header: number;
  /** 0..1: energizacao dos cartuchos e textos dos cards. */
  cards: number;
  /** Multiplicador de brilho da tela nos primeiros instantes. */
  flicker: number;
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const choiceBootPhase = (nowMs: number, revealAtMs: number): ChoiceBootPhase => {
  const elapsed = Math.max(0, nowMs - revealAtMs);
  return {
    roll: elapsed < 150 ? elapsed / 150 : null,
    header: clamp01((elapsed - 80) / 150),
    cards: clamp01((elapsed - 150) / 250),
    flicker: elapsed < 260 ? 0.78 + 0.22 * Math.abs(Math.sin(elapsed * 0.045)) : 1,
  };
};

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

/** Scanlines em pattern cacheado: um fillRect por quadro, nada por-pixel. */
let scanlinePattern: CanvasPattern | null = null;
const getScanlines = (ctx: CanvasRenderingContext2D): CanvasPattern | null => {
  if (scanlinePattern) return scanlinePattern;
  if (typeof document === 'undefined') return null;
  const tile = document.createElement('canvas');
  tile.width = 1;
  tile.height = 3;
  const tctx = tile.getContext('2d');
  if (!tctx) return null;
  tctx.fillStyle = 'rgba(0,0,0,0.20)';
  tctx.fillRect(0, 0, 1, 1);
  scanlinePattern = ctx.createPattern(tile, 'repeat');
  return scanlinePattern;
};

const hazardIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void => {
  // Triangulo de risco DESENHADO (nada de unicode): contorno fogo, ponto e haste.
  ctx.strokeStyle = C.fire;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x + size / 2, y);
  ctx.lineTo(x + size, y + size);
  ctx.lineTo(x, y + size);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = C.fire;
  ctx.fillRect(Math.round(x + size / 2) - 1, Math.round(y + size * 0.32), 2, Math.round(size * 0.34));
  ctx.fillRect(Math.round(x + size / 2) - 1, Math.round(y + size * 0.78), 2, 2);
};

/** Entalhes de tier: 1..3 tracos estampados — a mesma linguagem dos cofres. */
const tierNotches = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tier: CacheTier,
  color: string,
): number => {
  ctx.fillStyle = color;
  for (let i = 0; i < tier; i++) ctx.fillRect(x + i * 5, y, 3, 4);
  return tier * 5 - 2;
};

export type TerminalHeaderData = {
  cacheTier: CacheTier | null;
  integrityPercent: number;
};

/**
 * A carcaca e o vidro. Desenha tudo que nao pertence a um card: metal, CRT,
 * cabecalho e o rodape de instrucao.
 */
export const drawRecoveryTerminal = (
  ctx: CanvasRenderingContext2D,
  layout: TerminalLayout,
  header: TerminalHeaderData,
  boot: ChoiceBootPhase,
  nowMs: number,
): void => {
  const { screen, housing, compact } = layout;
  ctx.save();

  // --- Carcaca: metal batido em camadas, sem moldura ornamental. ---
  ctx.fillStyle = C.dark;
  ctx.fillRect(housing.x - 2, housing.y - 2, housing.w + 4, housing.h + 4);
  ctx.fillStyle = C.steelDark;
  ctx.fillRect(housing.x, housing.y, housing.w, housing.h);
  // Luz de topo-esquerda no chanfro.
  ctx.fillStyle = C.steelLight;
  ctx.fillRect(housing.x, housing.y, housing.w, 2);
  ctx.fillRect(housing.x, housing.y, 2, housing.h);
  // Costura de ferrugem rente ao vidro.
  ctx.strokeStyle = C.rust;
  ctx.lineWidth = 1;
  ctx.strokeRect(screen.x - 1.5, screen.y - 1.5, screen.w + 3, screen.h + 3);
  // Canto lascado: um dente escuro no topo-direita — equipamento de campo.
  ctx.fillStyle = C.dark;
  ctx.beginPath();
  ctx.moveTo(housing.x + housing.w - 14, housing.y);
  ctx.lineTo(housing.x + housing.w, housing.y);
  ctx.lineTo(housing.x + housing.w, housing.y + 6);
  ctx.closePath();
  ctx.fill();
  // Parafusos recartilhados nos quatro cantos.
  ctx.fillStyle = C.dark;
  for (const [sx, sy] of [
    [housing.x + 4, housing.y + 4],
    [housing.x + housing.w - 6, housing.y + 4],
    [housing.x + 4, housing.y + housing.h - 6],
    [housing.x + housing.w - 6, housing.y + housing.h - 6],
  ]) {
    ctx.fillRect(sx, sy, 3, 3);
    ctx.fillStyle = C.steelLight;
    ctx.fillRect(sx, sy, 1, 1);
    ctx.fillStyle = C.dark;
  }
  // Faixa de atencao ambar, curta, no rodape direito da carcaca.
  const stripeY = housing.y + housing.h - 5;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? C.loot : C.dark;
    ctx.fillRect(housing.x + housing.w - 34 + i * 7, stripeY, 5, 3);
  }
  // LED de energia, respirando devagar no rodape esquerdo.
  const led = 0.55 + 0.45 * Math.sin(nowMs * 0.0022);
  ctx.fillStyle = `rgba(89,242,194,${(0.35 + 0.65 * led) * boot.flicker})`;
  ctx.fillRect(housing.x + 6, stripeY, 4, 3);

  // --- O vidro do CRT. ---
  const glass = ctx.createLinearGradient(0, screen.y, 0, screen.y + screen.h);
  glass.addColorStop(0, '#071310');
  glass.addColorStop(0.5, '#0a1a15');
  glass.addColorStop(1, '#06100d');
  ctx.fillStyle = glass;
  ctx.fillRect(screen.x, screen.y, screen.w, screen.h);

  // Conteudo do cabecalho, com o brilho do boot.
  ctx.globalAlpha = boot.header * boot.flicker;
  ctx.textAlign = 'center';
  const cx = screen.x + screen.w / 2;
  if (!compact) {
    // Linha corporativa decorativa — a primeira a sumir sob pressao de espaco.
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(184,169,143,0.65)';
    ctx.textAlign = 'left';
    ctx.fillText(t('choice.terminal.brand'), screen.x + 10, screen.y + 12);
    ctx.textAlign = 'right';
    ctx.fillText(t('choice.terminal.unit'), screen.x + screen.w - 10, screen.y + 12);
    ctx.textAlign = 'center';
  }
  const titleY = screen.y + (compact ? 15 : 27);
  ctx.font = `bold ${compact ? 13 : 16}px monospace`;
  ctx.fillStyle = C.loot;
  ctx.fillText(t('choice.title'), cx, titleY);
  // Classe do cofre de ORIGEM + integridade decorativa. A classe leva
  // entalhes fisicos: legivel em escala de cinza, como no cofre do mundo.
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = C.biolum;
  const subY = titleY + (compact ? 13 : 15);
  const parts: string[] = [];
  if (header.cacheTier) parts.push(t('choice.cacheClass', { tier: romanTier(header.cacheTier) }));
  if (!compact) parts.push(t('choice.integrity', { percent: header.integrityPercent }));
  const subText = parts.join('  ·  ');
  ctx.fillText(subText, cx, subY);
  if (header.cacheTier) {
    const subW = ctx.measureText(subText).width;
    tierNotches(ctx, Math.round(cx + subW / 2 + 8), subY - 7, header.cacheTier, C.loot);
  }
  // Rodape de instrucao.
  if (!compact) {
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(184,169,143,0.6)';
    ctx.fillText(
      t('choice.select'),
      cx,
      screen.y + screen.h - 6,
    );
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.restore();
};

/**
 * Efeitos de vidro por cima de TUDO (cards inclusive): scanlines, vinheta,
 * rolagem de sincronismo do boot e reflexo interno. Chamar por ultimo.
 */
export const drawCrtOverlay = (
  ctx: CanvasRenderingContext2D,
  layout: TerminalLayout,
  boot: ChoiceBootPhase,
  detail: boolean,
): void => {
  const { screen } = layout;
  ctx.save();
  ctx.beginPath();
  ctx.rect(screen.x, screen.y, screen.w, screen.h);
  ctx.clip();

  const lines = getScanlines(ctx);
  if (lines) {
    ctx.fillStyle = lines;
    ctx.fillRect(screen.x, screen.y, screen.w, screen.h);
  }

  if (detail) {
    // Vinheta: o vidro escurece nas bordas.
    const vignette = ctx.createRadialGradient(
      screen.x + screen.w / 2,
      screen.y + screen.h / 2,
      Math.min(screen.w, screen.h) * 0.35,
      screen.x + screen.w / 2,
      screen.y + screen.h / 2,
      Math.max(screen.w, screen.h) * 0.72,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = vignette;
    ctx.fillRect(screen.x, screen.y, screen.w, screen.h);
    // Reflexo interno discreto no canto superior-esquerdo do vidro.
    ctx.fillStyle = 'rgba(232,241,255,0.016)';
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y);
    ctx.lineTo(screen.x + screen.w * 0.24, screen.y);
    ctx.lineTo(screen.x, screen.y + screen.h * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  // Rolagem de sincronismo do boot: uma banda clara descendo o vidro.
  if (boot.roll !== null) {
    const y = screen.y + screen.h * boot.roll;
    const band = ctx.createLinearGradient(0, y - 22, 0, y + 10);
    band.addColorStop(0, 'rgba(89,242,194,0)');
    band.addColorStop(0.8, 'rgba(89,242,194,0.20)');
    band.addColorStop(1, 'rgba(89,242,194,0)');
    ctx.fillStyle = band;
    ctx.fillRect(screen.x, y - 22, screen.w, 32);
  }
  ctx.restore();
};

/** Quebra de linha por medida, local para nao depender do util privado do render. */
const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
};

export type ModuleCardData = {
  id: ModuleId;
  index: number;
  /** Ja instalado: a escolha e RECARGA, e o card diz isso — nunca um segundo slot. */
  active: boolean;
};

/**
 * Um compartimento de modulo: moldura de baia, cartucho fisico, tier real do
 * modulo (do catalogo, nunca do cofre), carga, descricao e CTA.
 */
export const drawModuleChoiceCard = (
  ctx: CanvasRenderingContext2D,
  card: Rect,
  data: ModuleCardData,
  boot: ChoiceBootPhase,
  nowMs: number,
): void => {
  const presentation = modulePresentation(data.id);
  const tier = moduleTierOf(data.id);
  const volatile = presentation.risk === 'volatile';
  ctx.save();

  // A baia: recesso escuro com moldura fina — o perigo e sinalizado na
  // moldura (fogo para volatil), mas o vermelho NUNCA significa tier.
  ctx.fillStyle = 'rgba(11,20,17,0.88)';
  ctx.fillRect(card.x, card.y, card.w, card.h);
  ctx.strokeStyle = volatile ? 'rgba(255,122,47,0.75)' : 'rgba(89,242,194,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(card.x + 0.5, card.y + 0.5, card.w - 1, card.h - 1);
  // Cantoneiras claras: a baia parece parafusada no vidro.
  ctx.strokeStyle = volatile ? C.fire : C.biolum;
  ctx.lineWidth = 1.4;
  const corner = 7;
  ctx.beginPath();
  for (const [cxp, cyp, dx, dy] of [
    [card.x, card.y, 1, 1],
    [card.x + card.w, card.y, -1, 1],
    [card.x, card.y + card.h, 1, -1],
    [card.x + card.w, card.y + card.h, -1, -1],
  ]) {
    ctx.moveTo(cxp + dx * corner, cyp);
    ctx.lineTo(cxp, cyp);
    ctx.lineTo(cxp, cyp + dy * corner);
  }
  ctx.stroke();

  const alpha = boot.cards * boot.flicker;
  ctx.globalAlpha = alpha;

  // Linha 1: indice do compartimento (esq) e TIER DO MODULO (dir, com
  // entalhes — o mesmo codigo fisico dos cofres, legivel sem cor).
  const padX = 10;
  const rowY = card.y + 14;
  ctx.font = '8px monospace';
  ctx.fillStyle = 'rgba(184,169,143,0.7)';
  ctx.textAlign = 'left';
  ctx.fillText(t('choice.moduleIndex', { index: data.index + 1 }), card.x + padX, rowY);
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = C.loot;
  ctx.textAlign = 'right';
  const tierText = t('choice.moduleTier', { tier: romanTier(tier) });
  const notchW = tier * 5 - 2;
  ctx.fillText(tierText, card.x + card.w - padX - notchW - 6, rowY);
  tierNotches(ctx, Math.round(card.x + card.w - padX - notchW), rowY - 7, tier, C.loot);
  ctx.textAlign = 'left';

  // O cartucho: a peca mais distinta do card. Acende com o boot; o volatil
  // pulsa morno por conta propria (module-hardware). O tamanho e quantizado
  // pela unidade de pixel-art e limitado pela ALTURA que sobra depois de
  // reservar nome, carga, uma linha de descricao e o CTA — descricao cede
  // espaco por ultimo, nunca por causa de um cartucho grande demais.
  const unit = Math.max(2, Math.min(Math.floor((card.w - 80) / 32), Math.floor((card.h - 96) / 26), 5));
  const hwSize = unit * 32;
  const hwH = unit * 26;
  const hwCy = card.y + 18 + hwH / 2;
  drawModuleHardware(ctx, data.id, card.x + card.w / 2, hwCy, hwSize, {
    lit: boot.cards,
    nowMs,
  });

  // Nome do modulo.
  let textY = card.y + 22 + hwH + 12;
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = C.player;
  ctx.fillText(presentation.label, card.x + padX, textY);
  textY += 14;

  // Carga/vida: e RECARGA quando o modulo ja esta instalado — o card nunca
  // finge um segundo slot.
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = data.active ? C.loot : C.biolum;
  ctx.fillText(
    data.active
      ? t('choice.recharge', { lifetime: presentation.lifetimeLabel })
      : presentation.lifetimeLabel,
    card.x + padX,
    textY,
  );
  // Selo de risco na mesma linha, a direita: icone DESENHADO + texto.
  if (volatile) {
    ctx.textAlign = 'right';
    ctx.fillStyle = C.fire;
    const voltText = t('choice.volatile');
    ctx.fillText(voltText, card.x + card.w - padX, textY);
    const vw2 = ctx.measureText(voltText).width;
    hazardIcon(ctx, card.x + card.w - padX - vw2 - 13, textY - 8, 9);
    ctx.textAlign = 'left';
  }
  textY += 13;

  // CTA no rodape do card — reservado ANTES da descricao, que cede espaco.
  const ctaY = card.y + card.h - 10;
  ctx.font = '9px monospace';
  ctx.fillStyle = C.bone;
  const descMax = Math.max(0, Math.floor((ctaY - 14 - textY) / 12 + 1));
  const lines = wrapText(ctx, presentation.shortDescription, card.w - padX * 2);
  for (const line of lines.slice(0, descMax)) {
    ctx.fillText(line, card.x + padX, textY);
    textY += 12;
  }

  // O CTA: instalar ou recarregar, com a tecla. Pulso contido no fosforo.
  const ctaPulse = 0.8 + 0.2 * Math.sin(nowMs * 0.004 + data.index * Math.PI);
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = data.active
    ? `rgba(255,209,102,${ctaPulse * alpha})`
    : `rgba(89,242,194,${ctaPulse * alpha})`;
  ctx.textAlign = 'center';
  ctx.fillText(
    t(data.active ? 'choice.rechargeAction' : 'choice.install', { index: data.index + 1 }),
    card.x + card.w / 2,
    ctaY,
  );
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
  ctx.restore();
};
