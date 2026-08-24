import { adjustBrightness, createSurface2D, packRGBA, type Surface2D } from '@voxelyn/core';
import { SLOTS } from '../sim/index.js';
import type { Cat, HackState } from '../sim/types.js';

/**
 * O PAVILHAO, desenhado pixel a pixel num Surface2D do @voxelyn/core.
 *
 * O chao e um tabuleiro isometrico e os moveis sao caixas axonometricas — o
 * DNA voxel da casa — mas as COORDENADAS de jogo sao 2D de tela, as mesmas que
 * a simulacao usa para andar e para o toque. Projetar a cena inteira por
 * `projectIso` seria bonito e cobraria a conversao de cada toque; para um
 * god-hand game, toque impreciso e jogo ruim. Escolha consciente, documentada
 * na matriz de reuso.
 */

export type View = {
  surface: Surface2D;
  w: number;
  h: number;
};

export const createView = (): View => ({ surface: createSurface2D(480, 270), w: 480, h: 270 });

const c = packRGBA;

// A paleta do pavilhao: noite de hackathon, luz fria de monitor, banner quente.
const FLOOR_A = c(52, 48, 66);
const FLOOR_B = c(46, 42, 58);
const WALL = c(34, 30, 46);
const BANNER = c(214, 110, 76);
const BANNER_TEXT = c(255, 232, 196);
const DESK_WOOD = c(126, 96, 70);
const DESK_SIDE = c(96, 70, 52);
const SCREEN_OFF = c(40, 48, 58);
const SCREEN_ON = c(120, 200, 230);
const RACK_BODY = c(58, 64, 78);
const RACK_LED = c(120, 230, 140);
const RACK_LED_BAD = c(240, 110, 90);
const PUFF = c(150, 84, 110);
const BOX = c(168, 134, 92);
const CAFE = c(104, 78, 60);
const SHADOW = c(20, 16, 24, 110);

/** Paleta de cada gato: corpo, marcacao, detalhe. A silhueta identifica. */
const CAT_COLORS: Record<string, { body: number; mark: number; belly: number; big: boolean }> = {
  bigode: { body: c(230, 218, 196), mark: c(94, 74, 62), belly: c(240, 232, 214), big: false },
  cheeto: { body: c(232, 148, 62), mark: c(196, 112, 40), belly: c(244, 210, 160), big: false },
  almofada: { body: c(142, 142, 152), mark: c(110, 110, 122), belly: c(196, 196, 204), big: true },
  smoking: { body: c(44, 42, 50), mark: c(30, 28, 36), belly: c(238, 238, 240), big: false },
};

const px = (v: View, x: number, y: number, color: number): void => {
  const xi = x | 0;
  const yi = y | 0;
  if (xi < 0 || yi < 0 || xi >= v.w || yi >= v.h) return;
  v.surface.pixels[yi * v.w + xi] = color;
};

const rect = (v: View, x: number, y: number, w: number, h: number, color: number): void => {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) px(v, x + xx, y + yy, color);
};

/** Caixa axonometrica: topo claro, frente media, lado escuro. O voxel da casa. */
const box = (v: View, x: number, y: number, w: number, h: number, depth: number, color: number): void => {
  rect(v, x, y - depth, w, depth, adjustBrightness(color, 22));
  rect(v, x, y, w, h, color);
  for (let i = 0; i < 3; i++) rect(v, x + w, y - depth + i, 1, h + depth - i, adjustBrightness(color, -28));
};

const diamond = (v: View, cx: number, cy: number, hw: number, hh: number, color: number): void => {
  for (let yy = -hh; yy <= hh; yy++) {
    const t = 1 - Math.abs(yy) / hh;
    const w = Math.round(hw * t);
    for (let xx = -w; xx <= w; xx++) px(v, cx + xx, cy + yy, color);
  }
};

const drawFloor = (v: View): void => {
  rect(v, 0, 0, v.w, 64, WALL);
  for (let y = 64; y < v.h; y += 1) rect(v, 0, y, v.w, 1, (((y / 12) | 0) & 1) === 0 ? FLOOR_A : FLOOR_B);
  // Losangos isometricos por cima do gradiente de faixas: a leitura de chao
  // em diamante e a assinatura visual da engine.
  for (let gy = 0; gy < 10; gy++) {
    for (let gx = -1; gx < 16; gx++) {
      const cx = gx * 32 + (gy % 2 === 0 ? 0 : 16);
      const cy = 72 + gy * 22;
      if (cy > v.h + 10) continue;
      diamond(v, cx, cy, 15, 7, ((gx + gy) & 1) === 0 ? FLOOR_A : FLOOR_B);
    }
  }
};

const drawBanner = (v: View, tick: number): void => {
  rect(v, 60, 8, 360, 26, BANNER);
  rect(v, 60, 34, 360, 3, adjustBrightness(BANNER, -30));
  // "CATATHON" em blocos 3x5 — fonte de pixels desenhada na mao, sem asset.
  const glyphs: Record<string, number[]> = {
    C: [0b111, 0b100, 0b100, 0b100, 0b111],
    A: [0b111, 0b101, 0b111, 0b101, 0b101],
    T: [0b111, 0b010, 0b010, 0b010, 0b010],
    H: [0b101, 0b101, 0b111, 0b101, 0b101],
    O: [0b111, 0b101, 0b101, 0b101, 0b111],
    N: [0b101, 0b111, 0b111, 0b111, 0b101],
  };
  const word = 'CATATHON';
  let x = 240 - word.length * 14 / 2;
  for (const ch of word) {
    const g = glyphs[ch]!;
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 3; col++)
        if ((g[row] >> (2 - col)) & 1) rect(v, x + col * 3, 12 + row * 3, 3, 3, BANNER_TEXT);
    x += 14;
  }
  // Fitas penduradas balancam com o tick — vida sem custo.
  for (let i = 0; i < 12; i++) {
    const fx = 66 + i * 31 + Math.round(Math.sin(tick / 40 + i) * 1.5);
    rect(v, fx, 37, 2, 6 + (i % 3), i % 2 ? BANNER : c(120, 180, 220));
  }
};

const drawSlots = (v: View, state: HackState, tick: number): void => {
  for (const slot of SLOTS) {
    const sx = slot.x;
    const sy = slot.y;
    rect(v, sx - 16, sy + 4, 34, 5, SHADOW);
    if (slot.track) {
      box(v, sx - 16, sy - 8, 32, 12, 6, DESK_WOOD);
      rect(v, sx - 16, sy + 4, 32, 2, DESK_SIDE);
      // O monitor pisca quando ha gato TRABALHANDO — estado legivel sem HUD.
      const working = state.cats.some((cat) => cat.slot === slot.id && cat.mode === 'work');
      const flick = working && (tick >> 2) % 5 !== 0;
      box(v, sx - 10, sy - 16, 12, 8, 2, flick ? SCREEN_ON : SCREEN_OFF);
      rect(v, sx - 5, sy - 8, 2, 3, c(70, 70, 80));
      // Teclado.
      rect(v, sx + 4, sy - 6, 9, 4, c(60, 58, 70));
    } else if (slot.id === 'rack') {
      box(v, sx - 12, sy - 26, 24, 34, 5, RACK_BODY);
      const bad = state.cableOut || state.hairball.active || state.buildBroken;
      for (let i = 0; i < 5; i++) {
        const on = ((tick >> 3) + i) % 4 !== 0;
        rect(v, sx - 8, sy - 22 + i * 6, 3, 2, on ? (bad ? RACK_LED_BAD : RACK_LED) : c(50, 54, 64));
        rect(v, sx + 2, sy - 22 + i * 6, 6, 2, c(44, 48, 60));
      }
      if (state.cableOut) {
        // O cabo mordido, visivelmente solto no chao.
        for (let i = 0; i < 10; i++) px(v, sx - 18 - i, sy + 6 + ((i * 7) % 3), RACK_LED_BAD);
      }
    } else if (slot.id === 'puff') {
      box(v, sx - 14, sy - 4, 28, 9, 4, PUFF);
      rect(v, sx - 10, sy - 6, 20, 3, adjustBrightness(PUFF, 18));
      // A CAIXA do Smoking, ao lado do puff. Mania dele, movel de todos.
      box(v, sx + 22, sy - 4, 18, 10, 5, BOX);
      rect(v, sx + 24, sy - 8, 14, 4, adjustBrightness(BOX, -25));
    } else if (slot.id === 'cafe') {
      box(v, sx - 20, sy - 10, 40, 12, 6, CAFE);
      // Tigelas.
      rect(v, sx - 12, sy - 12, 8, 3, c(200, 200, 210));
      rect(v, sx + 4, sy - 12, 8, 3, c(200, 200, 210));
    }
  }
};

/**
 * UM GATO FOFO, desenhado por procedimento.
 *
 * Fofura em 16 pixels e contorno irregular: uma franja de pixels da cor do
 * corpo, deslocada por seno do tick, faz "pelo" sem nenhum asset. A silhueta e
 * a paleta identificam o gato de longe; o MODO dita a pose — nenhuma animacao
 * existe sem um modo da simulacao correspondente.
 */
export const drawCat = (v: View, cat: Cat, tick: number, selected: boolean): void => {
  const p = CAT_COLORS[cat.id]!;
  const w = p.big ? 22 : 17;
  const h = p.big ? 13 : 11;
  const x = Math.round(cat.x - w / 2);
  const y = Math.round(cat.y - h);
  const wob = Math.sin(tick / 6 + cat.x) * 1.2;

  if (cat.mode !== 'held') rect(v, x + 2, Math.round(cat.y) + 1, w - 4, 3, SHADOW);

  if (selected) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + tick / 20;
      px(v, cat.x + Math.cos(a) * (w / 2 + 4), cat.y - h / 2 + Math.sin(a) * (h / 2 + 4), c(255, 230, 150));
    }
  }

  if (cat.mode === 'held') {
    // Dangling: o corpo estica na vertical, patas soltas. Fisica de gato.
    rect(v, x + w / 2 - 4, y - 2, 8, h + 8, p.body);
    rect(v, x + w / 2 - 3, y + h + 5, 2, 3, p.mark);
    rect(v, x + w / 2 + 1, y + h + 5, 2, 3, p.mark);
    drawHead(v, cat, x + w / 2 - 5, y - 8, p, tick);
    return;
  }
  if (cat.mode === 'nap') {
    // LOAF. A pose mais importante do jogo.
    rect(v, x + 1, y + 4, w - 2, h - 4, p.body);
    rect(v, x + 2, y + 3, w - 4, 2, p.body);
    drawHead(v, cat, x + 1, y + 1, p, tick, true);
    if ((tick >> 4) % 3 !== 2) {
      px(v, x + w + 1, y - 2, BANNER_TEXT);
      px(v, x + w + 3, y - 5, BANNER_TEXT);
    }
    return;
  }
  if (cat.mode === 'zoomies') {
    // Esticado horizontal + poeira atras.
    rect(v, x - 2, y + 3, w + 4, h - 5, p.body);
    drawHead(v, cat, cat.targetX > cat.x ? x + w - 2 : x - 6, y, p, tick);
    for (let i = 1; i <= 3; i++) px(v, cat.x - (cat.targetX > cat.x ? i * 5 : -i * 5), cat.y - 2, c(180, 170, 160, 160));
    return;
  }

  const bounce = cat.mode === 'work' ? Math.round(Math.abs(Math.sin(tick / 3)) * 1) : 0;
  const step = cat.mode === 'walk' ? Math.round(Math.abs(Math.sin(tick / 4)) * 2) : 0;

  // Corpo com franja de pelo.
  rect(v, x + 1, y + 2 - bounce, w - 2, h - 4, p.body);
  for (let i = 0; i < w - 2; i += 2) {
    const fluff = Math.sin(tick / 8 + i) > 0.2 ? 1 : 0;
    px(v, x + 1 + i, y + 1 - bounce - fluff, p.body);
  }
  rect(v, x + 2, y + h - 3, w - 4, 2, p.belly);
  // Listras do tabby / pontos do siames.
  if (cat.id === 'cheeto') for (let i = 0; i < 3; i++) rect(v, x + 4 + i * 4, y + 2 - bounce, 2, 3, p.mark);
  // Patas.
  rect(v, x + 3, y + h - 1 - step, 2, 2 + step, p.mark);
  rect(v, x + w - 5, y + h - 1 - (2 - step ? step : 0), 2, 2, p.mark);
  // Rabo balancando.
  const tx = x + w - 1;
  for (let i = 0; i < 5; i++) px(v, tx + i, y + 3 + Math.round(Math.sin(tick / 9 + i * 0.8) * 2) - bounce, p.mark);

  drawHead(v, cat, x - 1, y - 5 - bounce, p, tick);

  if (cat.mode === 'keyboard') {
    // ";;;;;" subindo do teclado: o bug nascendo, visivel.
    const t = (tick >> 2) % 4;
    for (let i = 0; i < 3; i++) px(v, cat.x - 4 + i * 4, y - 10 - t - i, c(255, 120, 110));
  }
  if (cat.mode === 'petted' && (tick >> 3) % 2 === 0) {
    px(v, cat.x + 8, y - 8, c(240, 110, 130));
    px(v, cat.x + 9, y - 9, c(240, 110, 130));
    px(v, cat.x + 10, y - 8, c(240, 110, 130));
    px(v, cat.x + 9, y - 7, c(240, 110, 130));
  }
  if (cat.mode === 'eat') rect(v, x + 2, y + h - 1, 4, 2, c(220, 190, 140));
};

const drawHead = (
  v: View,
  cat: Cat,
  hx: number,
  hy: number,
  p: { body: number; mark: number; belly: number },
  tick: number,
  asleep = false
): void => {
  rect(v, hx, hy, 9, 8, cat.id === 'bigode' ? p.body : p.body);
  // Mascara do siames / smoking do tuxedo.
  if (cat.id === 'bigode') rect(v, hx + 2, hy + 3, 5, 4, adjustBrightness(p.mark, 30));
  if (cat.id === 'smoking') rect(v, hx + 3, hy + 5, 3, 3, p.belly);
  // Orelhas.
  px(v, hx + 1, hy - 1, p.mark);
  px(v, hx + 2, hy - 2, p.mark);
  px(v, hx + 6, hy - 2, p.mark);
  px(v, hx + 7, hy - 1, p.mark);
  // Olhos: fechados dormindo, piscando de vez em quando.
  const blink = asleep || (tick % 140) < 6;
  const eye = blink ? p.mark : c(30, 60, 50);
  rect(v, hx + 2, hy + 3, 1, blink ? 1 : 2, eye);
  rect(v, hx + 6, hy + 3, 1, blink ? 1 : 2, eye);
};

/** A mao do jogador: uma patinha. Cursor e personagem ao mesmo tempo. */
export const drawHand = (v: View, x: number, y: number, holding: boolean): void => {
  const col = c(244, 226, 198);
  rect(v, x - 3, y - 3, 7, 6, col);
  for (let i = 0; i < 3; i++) rect(v, x - 3 + i * 3, y - 5, 2, 2, col);
  if (!holding) rect(v, x - 2, y - 1, 5, 3, c(226, 160, 170));
};

export const drawScene = (v: View, state: HackState, tick: number, selected: string | null): void => {
  drawFloor(v);
  drawBanner(v, tick);
  drawSlots(v, state, tick);
  const order = [...state.cats].sort((a, b) => a.y - b.y);
  for (const cat of order) if (cat.mode !== 'held') drawCat(v, cat, tick, selected === cat.id);
  // O gato seguro desenha por ultimo, acima de tudo: esta na tua mao.
  const held = state.cats.find((cat) => cat.mode === 'held');
  if (held) drawCat(v, held, tick, false);
};
