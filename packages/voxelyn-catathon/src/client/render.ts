import { adjustBrightness, createSurface2D, packRGBA, type Surface2D } from '@voxelyn/core';
import { HACK_TICKS, HOURS_PER_TICK, PITCH_TICKS, workable } from '../sim/index.js';
import { heldFrame, lookFor, packFrame, pmFrame, type SpriteFrame } from './catsprites.js';
import { ganttEntries } from './ganttlog.js';
import { CIRCUIT_TEXT, type Locale } from '../sim/text.js';
import type { Cat, HackState, Task, Track } from '../sim/types.js';

/**
 * O PAVILHAO, desenhado pixel a pixel num Surface2D do @voxelyn/core.
 *
 * O chao e um tabuleiro isometrico e os moveis sao caixas axonometricas — o
 * DNA voxel da casa — mas as COORDENADAS de jogo sao 2D de tela, as mesmas que
 * a simulacao usa para andar e para o toque. Projetar a cena inteira por
 * `projectIso` seria bonito e cobraria a conversao de cada toque; para um
 * god-hand game, toque impreciso e jogo ruim. Escolha consciente, documentada
 * na matriz de reuso.
 *
 * A direcao de arte desta cena segue tres regras:
 * 1. HIERARQUIA POR VALOR: parede mais escura, chao 10-15% mais claro, moveis
 *    intermediarios, gatos em contraste forte. A cena funciona em cinza.
 * 2. TUDO TOCA O CHAO: cada objeto tem sombra de contato (escurecida por
 *    mistura de pixel, nao por retangulo chapado) e os luminosos abrem
 *    pequenas pocas de luz — dois degraus, nunca bloom.
 * 3. CADA COR IMPORTANTE E UM ESTADO: ciano = atividade, verde = build vivo,
 *    ambar = alerta, coral = erro, violeta = selecao. Decoracao nao usa as
 *    cores de estado.
 */

export type View = {
  surface: Surface2D;
  w: number;
  h: number;
};

export const createView = (): View => ({ surface: createSurface2D(480, 270), w: 480, h: 270 });

const c = packRGBA;

// A paleta noturna do pavilhao — valores separados de proposito (regra 1).
const WALL_DEEP = c(37, 35, 52); // #252334
const CORRIDOR = c(43, 41, 62);
const FLOOR_A = c(52, 49, 69); // #343145
const FLOOR_B = c(61, 57, 79); // #3D394F — 10% acima, nunca mais que isso
const SHADOW_INK = c(29, 28, 39); // #1D1C27
const WOOD = c(154, 104, 72); // #9A6848
const WOOD_LIGHT = c(194, 138, 88); // #C28A58
const CORAL = c(223, 112, 84); // #DF7054
const CORAL_LIT = c(241, 138, 103); // #F18A67
const CREAM = c(244, 228, 200); // #F4E4C8
const VIOLET_SEL = c(140, 114, 242); // #8C72F2
const CYAN_ACT = c(84, 198, 212); // #54C6D4
const GREEN_BUILD = c(101, 211, 154); // #65D39A
const AMBER_ALERT = c(240, 181, 82); // #F0B552
const CORAL_ERR = c(235, 103, 103); // #EB6767
const SCREEN_OFF = c(40, 48, 58);
const MAGENTA = c(216, 104, 176);

/** Cracha da especialidade: o COLAR do sprite ganha a cor da trilha. */
export const SPEC_RGB: Record<Cat['specialty'], number> = {
  frontend: 0x54c6d4,
  backend: 0x8c72f2,
  devops: 0xf0b552,
  design: 0xd868b0,
  freestyler: 0xf4e4c8,
};

const TRACK_COLOR: Record<Track, number> = {
  frontend: CYAN_ACT,
  backend: VIOLET_SEL,
  devops: AMBER_ALERT,
  design: MAGENTA,
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

/**
 * Mistura o pixel EXISTENTE com uma cor — e assim que sombra de contato e poca
 * de luz funcionam aqui: dois degraus sobre o que ja esta pintado, nunca um
 * retangulo chapado por cima (packRGBA e ABGR little-endian).
 */
const mixPx = (v: View, x: number, y: number, color: number, t: number): void => {
  const xi = x | 0;
  const yi = y | 0;
  if (xi < 0 || yi < 0 || xi >= v.w || yi >= v.h) return;
  const i = yi * v.w + xi;
  const p = v.surface.pixels[i]!;
  const r = (p & 255) + (((color & 255) - (p & 255)) * t);
  const g = ((p >> 8) & 255) + ((((color >> 8) & 255) - ((p >> 8) & 255)) * t);
  const b = ((p >> 16) & 255) + ((((color >> 16) & 255) - ((p >> 16) & 255)) * t);
  v.surface.pixels[i] = c(r | 0, g | 0, b | 0);
};

/** Sombra de contato: elipse escurecida com queda para a borda. */
const contactShadow = (v: View, cx: number, cy: number, hw: number, hh: number, strength = 0.4): void => {
  for (let yy = -hh; yy <= hh; yy++) {
    for (let xx = -hw; xx <= hw; xx++) {
      const d = (xx * xx) / (hw * hw) + (yy * yy) / (hh * hh);
      if (d > 1) continue;
      mixPx(v, cx + xx, cy + yy, SHADOW_INK, strength * (1 - d * 0.7));
    }
  }
};

/** Poca de luz: a mesma elipse, para o lado claro (luminosos, regra 2). */
const lightPool = (v: View, cx: number, cy: number, hw: number, hh: number, color: number, strength: number): void => {
  for (let yy = -hh; yy <= hh; yy++) {
    for (let xx = -hw; xx <= hw; xx++) {
      const d = (xx * xx) / (hw * hw) + (yy * yy) / (hh * hh);
      if (d > 1) continue;
      mixPx(v, cx + xx, cy + yy, color, strength * (1 - d));
    }
  }
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

/* ------------------------------------------------------------- fonte 3x5 */

/**
 * A fonte de pixels da casa, expandida: o letreiro deixou de ser decoracao e
 * virou o PAINEL do projeto, entao precisa soletrar build, prazo e features.
 */
const GLYPHS: Record<string, number[]> = {
  A: [0b111, 0b101, 0b111, 0b101, 0b101],
  B: [0b110, 0b101, 0b110, 0b101, 0b110],
  C: [0b111, 0b100, 0b100, 0b100, 0b111],
  D: [0b110, 0b101, 0b101, 0b101, 0b110],
  E: [0b111, 0b100, 0b110, 0b100, 0b111],
  F: [0b111, 0b100, 0b110, 0b100, 0b100],
  G: [0b111, 0b100, 0b101, 0b101, 0b111],
  H: [0b101, 0b101, 0b111, 0b101, 0b101],
  J: [0b001, 0b001, 0b001, 0b101, 0b111],
  M: [0b101, 0b111, 0b101, 0b101, 0b101],
  I: [0b111, 0b010, 0b010, 0b010, 0b111],
  K: [0b101, 0b110, 0b100, 0b110, 0b101],
  L: [0b100, 0b100, 0b100, 0b100, 0b111],
  // N em 3px de largura nao tem diagonal: a forma "n de topo fechado" e a
  // unica que nao vira M nem Π a distancia.
  N: [0b110, 0b101, 0b101, 0b101, 0b101],
  O: [0b111, 0b101, 0b101, 0b101, 0b111],
  P: [0b111, 0b101, 0b111, 0b100, 0b100],
  R: [0b111, 0b101, 0b110, 0b101, 0b101],
  S: [0b111, 0b100, 0b111, 0b001, 0b111],
  T: [0b111, 0b010, 0b010, 0b010, 0b010],
  W: [0b101, 0b101, 0b101, 0b111, 0b101],
  X: [0b101, 0b101, 0b010, 0b101, 0b101],
  Y: [0b101, 0b101, 0b010, 0b010, 0b010],
  Z: [0b111, 0b001, 0b010, 0b100, 0b111],
  U: [0b101, 0b101, 0b101, 0b101, 0b111],
  V: [0b101, 0b101, 0b101, 0b101, 0b010],
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b111, 0b001, 0b111, 0b100, 0b111],
  '3': [0b111, 0b001, 0b111, 0b001, 0b111],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b111, 0b001, 0b111],
  '6': [0b111, 0b100, 0b111, 0b101, 0b111],
  '7': [0b111, 0b001, 0b010, 0b010, 0b010],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b111, 0b101, 0b111, 0b001, 0b111],
  '/': [0b001, 0b001, 0b010, 0b100, 0b100],
  '!': [0b010, 0b010, 0b010, 0b000, 0b010],
  '?': [0b110, 0b001, 0b010, 0b000, 0b010],
  ' ': [0, 0, 0, 0, 0],
};

const textWidth = (word: string, scale: number): number => word.length * 4 * scale - scale;

const text = (v: View, x: number, y: number, word: string, scale: number, color: number): void => {
  let cx = x;
  for (const ch of word) {
    const g = GLYPHS[ch];
    if (g) {
      for (let row = 0; row < 5; row++)
        for (let col = 0; col < 3; col++)
          if ((g[row]! >> (2 - col)) & 1) rect(v, cx + col * scale, y + row * scale, scale, scale, color);
    }
    cx += 4 * scale;
  }
};

/* -------------------------------------------------- parede, corredor, chao */

// A parede e alta de proposito: a faixa de cima fica atras dos chips do HUD
// (DOM), e o painel do projeto mora ABAIXO deles — mundo e interface nunca
// disputam os mesmos pixels.
const WALL_H = 74;
const CORRIDOR_H = 18;
const FLOOR_Y = WALL_H + CORRIDOR_H;

const drawFloor = (v: View, tick: number): void => {
  rect(v, 0, 0, v.w, WALL_H, WALL_DEEP);
  // Chao: base clara com losangos de contraste REDUZIDO — o padrao sugere
  // profundidade sem disputar com os personagens.
  rect(v, 0, FLOOR_Y, v.w, v.h - FLOOR_Y, FLOOR_A);
  for (let gy = 0; gy < 10; gy++) {
    for (let gx = -1; gx < 16; gx++) {
      if (((gx + gy) & 1) === 0) continue;
      const cx = gx * 32 + (gy % 2 === 0 ? 0 : 16);
      const cy = FLOOR_Y + 8 + gy * 22;
      if (cy > v.h + 10) continue;
      diamond(v, cx, cy, 15, 7, FLOOR_B);
    }
  }

  // O CORREDOR do pavilhao, atras do booth: e aqui que mora o "maior
  // hackathon do mundo" — silhuetas passando e luzes de booths vizinhos, em
  // paralaxe barata, sem renderizar multidao nenhuma.
  rect(v, 0, WALL_H, v.w, CORRIDOR_H, CORRIDOR);
  rect(v, 0, WALL_H, v.w, 1, adjustBrightness(CORRIDOR, -18));
  rect(v, 0, FLOOR_Y - 1, v.w, 1, adjustBrightness(FLOOR_A, 20));
  // Luzes dos booths vizinhos vazando pelas beiradas.
  lightPool(v, 6, WALL_H + 10, 26, 9, AMBER_ALERT, 0.14);
  lightPool(v, 474, WALL_H + 10, 26, 9, CYAN_ACT, 0.14);
  // Silhuetas de outros gatos competidores, cada um no proprio passo.
  for (let i = 0; i < 3; i++) {
    const speed = 0.35 + i * 0.17;
    const sx = ((tick * speed + i * 210) % (v.w + 80)) - 40;
    const sy = WALL_H + 9 + i * 3;
    const bob = Math.round(Math.sin(tick / 5 + i * 2) * 0.8);
    rect(v, sx, sy + bob, 13, 5, SHADOW_INK);
    rect(v, sx + (speed > 0 ? 11 : -2), sy - 3 + bob, 5, 4, SHADOW_INK);
    px(v, sx + 12, sy - 4 + bob, SHADOW_INK);
    px(v, sx + 15, sy - 4 + bob, SHADOW_INK);
    for (let t2 = 0; t2 < 4; t2++) px(v, sx - 1 - t2, sy - 1 + bob + Math.round(Math.sin(tick / 7 + t2) * 1), SHADOW_INK);
  }
  // A placa do corredor: escala do evento em uma linha.
  rect(v, 196, WALL_H + 2, 88, 9, adjustBrightness(WALL_DEEP, -14));
  text(v, 200, WALL_H + 4, 'HALL C 1248', 1, adjustBrightness(CREAM, -40));

  // Parede com arquitetura: pilares, paineis acusticos, placas — a sala tem
  // escala e dono, nao e um vazio roxo.
  for (const pxr of [18, 456]) {
    rect(v, pxr, 0, 7, WALL_H, adjustBrightness(WALL_DEEP, 12));
    rect(v, pxr + 6, 0, 1, WALL_H, adjustBrightness(WALL_DEEP, -20));
  }
  for (const [ax, ay] of [[32, 34], [32, 52], [434, 34], [434, 52]] as const) {
    rect(v, ax, ay, 16, 12, adjustBrightness(WALL_DEEP, 8));
    rect(v, ax + 1, ay + 1, 14, 10, adjustBrightness(WALL_DEEP, 16));
  }
  // Numero do booth no pilar esquerdo.
  rect(v, 16, 38, 11, 9, WOOD);
  text(v, 19, 40, '42', 1, CREAM);
};

/* --------------------------------------------------- o painel do projeto */

/**
 * O LETREIRO virou o painel coletivo: o maior objeto da sala agora trabalha.
 * Alterna CATATHON com features, build e prazo; a regua inferior mostra as
 * quatro trilhas, bugs e entregas. Na ultima hora, so pede uma coisa.
 */
const drawPanel = (v: View, state: HackState, tick: number, locale: Locale): void => {
  const x0 = 78;
  const w = 324;
  const y0 = 30;
  const h = 40;
  // Moldura fisica grossa + colunas que ancoram o painel no cenario.
  rect(v, x0 - 3, y0 - 3, w + 6, h + 6, adjustBrightness(WOOD, -34));
  rect(v, x0 - 1, y0 - 1, w + 2, h + 2, adjustBrightness(WOOD, -12));
  rect(v, x0, y0, w, h, CORAL);
  rect(v, x0, y0, w, 2, CORAL_LIT);
  for (const cx of [x0 + 4, x0 + w - 8]) {
    rect(v, cx, y0 + h + 2, 4, WALL_H - (y0 + h + 2), adjustBrightness(WOOD, -30));
  }
  // O brilho coral do painel banha a parede embaixo (regra 2).
  lightPool(v, x0 + w / 2, y0 + h + 4, w / 2 - 20, 6, CORAL, 0.10);

  const hoursLeft = Math.max(0, (HACK_TICKS - state.tick) * HOURS_PER_TICK);
  const shipped = state.tasks.filter((t) => t.done).length;
  const lastHour = hoursLeft <= 1 && state.phase === 'hack';

  let word: string;
  let scale = 3;
  if (lastHour) {
    word = 'SHIP IT!';
    // A ultima hora pisca — e o unico momento em que o painel grita.
    if ((tick >> 4) % 2 === 0) rect(v, x0 + 2, y0 + 2, w - 4, h - 12, CORAL_LIT);
  } else {
    const mode = ((tick / 210) | 0) % 6;
    if (mode === 1) {
      word = `FEATURES ${shipped}/12`;
      scale = 2;
    } else if (mode === 3) {
      word = state.buildBroken
        ? locale === 'pt' ? 'BUILD PERDIDO' : 'BUILD DEAD'
        : state.cableOut
          ? locale === 'pt' ? 'BUILD FORA' : 'BUILD DOWN'
          : 'BUILD OK';
      scale = 2;
    } else if (mode === 5) {
      const hh = Math.floor(hoursLeft);
      const mm = String(Math.floor((hoursLeft % 1) * 60)).padStart(2, '0');
      word = locale === 'pt' ? `FALTA ${hh}H${mm}` : `${hh}H${mm} LEFT`;
      scale = 2;
    } else {
      word = 'CATATHON';
    }
  }
  const tw = textWidth(word, scale);
  const ty = y0 + (scale === 3 ? 8 : 10);
  const tcol = lastHour
    ? (tick >> 4) % 2 === 0 ? adjustBrightness(CORAL, -60) : CREAM
    : word.startsWith('BUILD') && word !== 'BUILD OK' ? adjustBrightness(CREAM, 10)
    : CREAM;
  text(v, Math.round(x0 + (w - tw) / 2), ty, word, scale, tcol);

  // A regua de estado: quatro trilhas (feito/total), bugs vivos, entregas.
  const tracks: Track[] = ['backend', 'frontend', 'design', 'devops'];
  const barY = y0 + h - 6;
  let bx = x0 + 10;
  for (const track of tracks) {
    const all = state.tasks.filter((t) => t.track === track);
    const done = all.filter((t) => t.done).length;
    rect(v, bx, barY, 48, 3, adjustBrightness(CORAL, -40));
    rect(v, bx, barY, Math.round((done / Math.max(1, all.length)) * 48), 3, TRACK_COLOR[track]);
    bx += 56;
  }
  const bugs = state.bugs.filter((b) => !b.fixed).length;
  for (let i = 0; i < Math.min(6, bugs); i++) rect(v, bx + i * 5, barY, 3, 3, CORAL_ERR);
  rect(v, x0 + w - 26, barY, 16, 3, adjustBrightness(CORAL, -40));
  rect(v, x0 + w - 26, barY, Math.round((shipped / 12) * 16), 3, GREEN_BUILD);

  // Fitas penduradas balancam com o tick — vida sem custo.
  for (let i = 0; i < 10; i++) {
    const fx = x0 + 12 + i * 32 + Math.round(Math.sin(tick / 40 + i) * 1.5);
    rect(v, fx, y0 + h + 3, 2, 5 + (i % 3), i % 2 ? CORAL : CYAN_ACT);
  }
};

/* -------------------------------------------------------------- estacoes */

/** A tarefa em andamento de uma trilha, para o monitor reagir a ela. */
const activeTask = (state: HackState, track: Track): Task | undefined =>
  state.tasks.find((t) => t.track === track && !t.done && !t.cut && t.progress > 0);

/**
 * Uma ESTACAO completa: mesa com pernas, banco-almofada, monitor da
 * disciplina, teclado largo, cabo ate o chao, objeto de identidade e sombra
 * de contato. Espelhada por lado, para as telas olharem o centro do booth.
 */
const drawStation = (v: View, sx: number, sy: number, track: Track, state: HackState, tick: number): void => {
  const left = sx < 240;
  const dir = left ? 1 : -1;
  const working = state.cats.some((cat) => cat.slot === `desk-${track}` && cat.mode === 'work');
  const hasBug = state.bugs.some((b) => !b.fixed && b.track === track);

  contactShadow(v, sx + 2, sy + 6, 26, 5, 0.32);
  // Almofada de assento na cor da trilha, dessaturada: o lugar do gato.
  diamond(v, sx, sy + 3, 12, 4, adjustBrightness(TRACK_COLOR[track], -70));

  // Mesa com tampo claro e pernas — nao um terminal sobre caixas.
  const dx = sx - 22;
  box(v, dx, sy - 12, 46, 10, 7, WOOD);
  rect(v, dx, sy - 19, 46, 2, WOOD_LIGHT);
  rect(v, dx + 2, sy - 2, 2, 6, adjustBrightness(WOOD, -36));
  rect(v, dx + 42, sy - 2, 2, 6, adjustBrightness(WOOD, -36));

  // Teclado largo na beira proxima do gato — a mesa CEDE o teclado quando
  // ocupada: a pose de trabalho desenha o dela sob as patas, e dois
  // teclados na mesma mesa seriam ruido.
  if (!working) {
    rect(v, sx - 7, sy - 8, 14, 4, c(58, 56, 70));
    for (let i = 0; i < 6; i++) px(v, sx - 5 + i * 2, sy - 7, c(76, 74, 90));
  }

  // Monitor no lado do CENTRO, para a tela aparecer para o jogador.
  const mx = left ? sx + 4 : sx - 20;
  const screen = (wpx: number, hpx: number, ox: number): { x: number; y: number; w: number; h: number } => {
    box(v, mx + ox, sy - 24, wpx, hpx, 2, c(30, 34, 44));
    return { x: mx + ox + 1, y: sy - 23, w: wpx - 2, h: hpx - 2 };
  };

  const drawContent = (s: { x: number; y: number; w: number; h: number }, kind: Track): void => {
    if (!working) {
      rect(v, s.x, s.y, s.w, s.h, SCREEN_OFF);
      px(v, s.x + 1, s.y + 1, adjustBrightness(SCREEN_OFF, 26));
      return;
    }
    if (kind === 'frontend') {
      rect(v, s.x, s.y, s.w, s.h, c(28, 40, 52));
      const sh = (tick >> 3) % 3;
      rect(v, s.x + 1, s.y + 1 + sh % 2, 6, 4, CYAN_ACT);
      rect(v, s.x + 8, s.y + 2, 5, 3, MAGENTA);
    } else if (kind === 'backend') {
      rect(v, s.x, s.y, s.w, s.h, c(16, 22, 26));
      const lines = 1 + ((tick >> 3) % 4);
      for (let i = 0; i < lines; i++) rect(v, s.x + 1, s.y + 1 + i * 2, 3 + ((i * 5 + (tick >> 4)) % 7), 1, GREEN_BUILD);
    } else if (kind === 'design') {
      rect(v, s.x, s.y, s.w, s.h, adjustBrightness(CREAM, -18));
      diamond(v, s.x + 4, s.y + 3, 2, 2, MAGENTA);
      rect(v, s.x + 8, s.y + 2, 4, 1, adjustBrightness(MAGENTA, -30));
      rect(v, s.x + 8, s.y + 4, 3, 1, adjustBrightness(MAGENTA, -30));
    } else {
      rect(v, s.x, s.y, s.w, s.h, c(20, 26, 34));
      for (let i = 0; i < 4; i++) {
        const bar = 1 + ((i * 3 + (tick >> 3)) % 4);
        rect(v, s.x + 1 + i * 3, s.y + s.h - 1 - bar, 2, bar, i % 2 ? AMBER_ALERT : CYAN_ACT);
      }
    }
    // A barra de progresso da tarefa VIVA da trilha, na beira da tela: o
    // monitor conta o que a simulacao esta fazendo (arte sistemica, nao skin).
    const t = activeTask(state, kind);
    if (t) {
      rect(v, s.x, s.y + s.h, s.w, 1, adjustBrightness(SCREEN_OFF, -14));
      rect(v, s.x, s.y + s.h, Math.max(1, Math.round((t.progress / t.cost) * s.w)), 1, TRACK_COLOR[kind]);
    }
  };

  if (track === 'frontend') {
    drawContent(screen(16, 11, 0), track);
    rect(v, mx + 6, sy - 13, 3, 1, c(70, 70, 80));
    // Latinha de energia: identidade do cowboy.
    rect(v, left ? mx + 18 : mx - 5, sy - 16, 3, 5, CYAN_ACT);
  } else if (track === 'devops') {
    // Dois monitores: infra se olha em dobro.
    drawContent(screen(11, 9, 0), track);
    drawContent(screen(11, 9, 12), track);
    rect(v, mx + 4, sy - 13, 3, 1, c(70, 70, 80));
  } else if (track === 'backend') {
    drawContent(screen(14, 10, 0), track);
    rect(v, mx + 5, sy - 13, 3, 1, c(70, 70, 80));
    // Mini torre local no chao, ao lado externo da mesa.
    const tx = left ? dx - 10 : dx + 48;
    contactShadow(v, tx + 4, sy + 3, 6, 2, 0.3);
    box(v, tx, sy - 8, 8, 10, 3, c(64, 68, 84));
    px(v, tx + 2, sy - 5, (tick >> 4) % 2 === 0 ? GREEN_BUILD : adjustBrightness(GREEN_BUILD, -50));
  } else {
    // Design: tela clara + tablet deitado + plantinha.
    drawContent(screen(15, 10, 0), track);
    rect(v, mx + 5, sy - 13, 3, 1, c(70, 70, 80));
    rect(v, left ? dx + 4 : dx + 34, sy - 15, 8, 4, adjustBrightness(CREAM, -30));
    const plx = left ? dx - 8 : dx + 48;
    rect(v, plx, sy - 6, 4, 4, adjustBrightness(WOOD, -20));
    px(v, plx + 1, sy - 8, GREEN_BUILD);
    px(v, plx + 2, sy - 9, adjustBrightness(GREEN_BUILD, -30));
  }

  // Cabo da mesa ao chao, caindo pelo lado externo — nada flutua ligado.
  const cx0 = left ? dx + 1 : dx + 44;
  for (let i = 0; i < 8; i++) px(v, cx0 - dir * ((i / 3) | 0), sy - 2 + i, SHADOW_INK);

  // Poca de luz fria do monitor sobre a mesa e o chao (regra 2).
  if (working) lightPool(v, mx + 8, sy - 8, 14, 6, CYAN_ACT, 0.10);
  // Bug vivo na trilha: pixels de erro saltando perto do monitor.
  if (hasBug && (tick >> 2) % 3 !== 0) {
    px(v, mx + 8 + ((tick >> 2) % 5), sy - 27 - ((tick >> 3) % 3), CORAL_ERR);
    px(v, mx + 3 + ((tick >> 3) % 7), sy - 25, CORAL_ERR);
  }
};

/* ------------------------------------------- quadro central, social, resto */

/**
 * O QUADRO de planejamento no centro: um post-it por tarefa, na cor da
 * trilha — verde quando shipada, apagado com X quando cortada. E a copia
 * fisica do painel de projeto, legivel a distancia.
 */
const drawWhiteboard = (v: View, state: HackState): void => {
  // O quadro subiu na parede (o pe nao invade a roda de decisao); os
  // post-its sao a copia fisica do kanban do painel.
  const bx = 208;
  const by = 96;
  contactShadow(v, bx + 32, by + 52, 34, 5, 0.3);
  rect(v, bx + 6, by + 44, 3, 8, adjustBrightness(WOOD, -30));
  rect(v, bx + 55, by + 44, 3, 8, adjustBrightness(WOOD, -30));
  rect(v, bx - 2, by - 2, 68, 48, adjustBrightness(WOOD, -18));
  rect(v, bx, by, 64, 44, adjustBrightness(CREAM, -8));
  rect(v, bx, by, 64, 1, CREAM);
  // Fita nos cantos.
  rect(v, bx + 1, by + 1, 4, 2, adjustBrightness(AMBER_ALERT, -30));
  rect(v, bx + 59, by + 1, 4, 2, adjustBrightness(AMBER_ALERT, -30));
  // (O rabisco de "dependencias" acima dos post-its saiu: lia como um
  // gantt falso em cima do quadro — decisao do dono. A miniatura de gantt
  // REAL, no rodape, fica.)
  // Um post-it por tarefa, ordem estavel do quadro real.
  let i = 0;
  for (const t of state.tasks) {
    const col = i % 6;
    const row = (i / 6) | 0;
    const nx = bx + 6 + col * 9;
    const ny = by + 12 + row * 8;
    const base = t.done ? GREEN_BUILD : t.cut ? adjustBrightness(CREAM, -60) : TRACK_COLOR[t.track];
    rect(v, nx, ny, 6, 6, t.cut ? adjustBrightness(base, -20) : base);
    if (t.done) {
      px(v, nx + 1, ny + 3, adjustBrightness(GREEN_BUILD, -60));
      px(v, nx + 2, ny + 4, adjustBrightness(GREEN_BUILD, -60));
      px(v, nx + 3, ny + 3, adjustBrightness(GREEN_BUILD, -60));
      px(v, nx + 4, ny + 2, adjustBrightness(GREEN_BUILD, -60));
    }
    if (t.cut) {
      for (let d = 0; d < 4; d++) {
        px(v, nx + 1 + d, ny + 1 + d, SHADOW_INK);
        px(v, nx + 4 - d, ny + 1 + d, SHADOW_INK);
      }
    }
    i++;
  }
  // A MINIATURA do gantt: as mesmas raias do painel (uma por gato, cores
  // por trilha, alarme para bug e rack), desenhadas do MESMO log — nenhuma
  // copia de estado pode ficar atrasada.
  const gx = bx + 4;
  const gw = 56;
  let laneY = by + 31;
  for (const cat of state.cats.slice(0, 4)) {
    rect(v, gx, laneY, gw, 3, adjustBrightness(CREAM, -26));
    for (const seg of ganttEntries(cat.id)) {
      const x0 = gx + Math.round((seg.start / HACK_TICKS) * gw);
      const wpx = Math.max(1, Math.round(((seg.end - seg.start) / HACK_TICKS) * gw));
      const color = seg.kind === 'task' ? TRACK_COLOR[seg.track!] : CORAL_ERR;
      rect(v, x0, laneY, Math.min(wpx, gx + gw - x0), 3, color);
    }
    laneY += 4;
  }
  // A linha do AGORA atravessa as raias.
  const nowX = gx + Math.min(gw, Math.round((state.tick / HACK_TICKS) * gw));
  rect(v, nowX, by + 30, 1, 13, adjustBrightness(WOOD, -34));
  // DECISAO aberta: um balao de "?" pisca sobre o quadro enquanto os devs
  // se juntam embaixo — o alerta existe no mundo, nao so no chip do HUD.
  const deciding = state.tasks.some(
    (t) => !t.done && !t.cut && !!t.choice && t.chosen === null && workable(state, t)
  );
  if (deciding && (state.tick >> 4) % 2 === 0) {
    const qx = bx + 26;
    const qy = by - 13;
    rect(v, qx - 3, qy - 2, 13, 11, CREAM);
    rect(v, qx - 4, qy - 1, 1, 9, adjustBrightness(CREAM, -40));
    rect(v, qx + 10, qy - 1, 1, 9, adjustBrightness(CREAM, -40));
    px(v, qx + 2, qy + 9, CREAM);
    px(v, qx + 3, qy + 10, CREAM);
    text(v, qx, qy, '?', 2, AMBER_ALERT);
  }
};

/** A area social: mesa baixa, tigelas, cafeteira e almofadas para dois. */
const drawSocial = (v: View, sx: number, sy: number, elapsed: number, tick: number): void => {
  contactShadow(v, sx, sy + 6, 30, 5, 0.32);
  diamond(v, sx - 26, sy + 2, 9, 4, adjustBrightness(MAGENTA, -80));
  diamond(v, sx + 26, sy + 2, 9, 4, adjustBrightness(AMBER_ALERT, -80));
  box(v, sx - 20, sy - 8, 40, 10, 6, WOOD);
  rect(v, sx - 20, sy - 14, 40, 2, WOOD_LIGHT);
  // Tigelas de verdade, com borda.
  for (const bxx of [sx - 12, sx + 2]) {
    rect(v, bxx, sy - 16, 8, 3, c(206, 206, 214));
    rect(v, bxx + 1, sy - 15, 6, 1, adjustBrightness(WOOD, -30));
  }
  // Cafeteira no canto da mesa, luzinha piscando.
  box(v, sx + 13, sy - 18, 6, 5, 2, c(70, 66, 82));
  px(v, sx + 14, sy - 16, (tick >> 5) % 2 === 0 ? AMBER_ALERT : adjustBrightness(AMBER_ALERT, -50));
  // A pizza chega na metade da madrugada. Tampa aberta e pepperoni fazem o
  // objeto ler como pizza — nao como quadrado sem funcao.
  if (elapsed > 0.5) {
    const px0 = sx + 24;
    const py0 = sy + 2;
    rect(v, px0, py0, 13, 8, adjustBrightness(c(168, 134, 92), -8));
    rect(v, px0 + 1, py0 - 7, 11, 7, adjustBrightness(CREAM, -34));
    rect(v, px0 + 2, py0 - 6, 9, 1, adjustBrightness(CREAM, -12));
    for (let row = 0; row < 5; row++) {
      rect(v, px0 + 2 + row, py0 + 1 + row, Math.max(1, 8 - row * 2), 1, adjustBrightness(AMBER_ALERT, 8));
    }
    px(v, px0 + 4, py0 + 3, CORAL_ERR);
    px(v, px0 + 8, py0 + 2, CORAL_ERR);
    if (elapsed > 0.8) rect(v, px0 + 1, py0 + 1, 5, 6, adjustBrightness(CREAM, -26));
  }
};

/** O canto de descanso: sofa baixo, manta, a CAIXA e um brinquedo. */
const drawRest = (v: View, sx: number, sy: number): void => {
  contactShadow(v, sx + 12, sy + 4, 26, 4, 0.32);
  box(v, sx - 16, sy - 6, 32, 10, 5, c(150, 84, 110));
  rect(v, sx - 16, sy - 11, 4, 10, adjustBrightness(c(150, 84, 110), 14));
  rect(v, sx - 10, sy - 8, 20, 3, adjustBrightness(MAGENTA, -40));
  // A caixa de papelao com abas abertas: o movel mais disputado do evento.
  box(v, sx + 22, sy - 5, 18, 10, 5, c(168, 134, 92));
  rect(v, sx + 21, sy - 11, 6, 3, adjustBrightness(c(168, 134, 92), -18));
  rect(v, sx + 35, sy - 11, 6, 3, adjustBrightness(c(168, 134, 92), -18));
  rect(v, sx + 26, sy - 9, 10, 4, adjustBrightness(c(120, 92, 60), -20));
  // Bolinha de brinquedo.
  px(v, sx + 44, sy + 2, CORAL_LIT);
  px(v, sx + 45, sy + 2, CORAL_LIT);
  px(v, sx + 44, sy + 3, adjustBrightness(CORAL_LIT, -30));
};

/**
 * O SERVIDOR: um dos objetos mais sistemicos da sala — maior, com cor de
 * estado (verde vivo, ambar alerta, coral erro), ventilador girando, cabo
 * subindo ate o painel e um pulso viajando quando o build esta de pe.
 */
const drawRack = (v: View, sx: number, sy: number, state: HackState, tick: number): void => {
  const status = state.buildBroken || state.cableOut ? CORAL_ERR : state.hairball.active ? AMBER_ALERT : GREEN_BUILD;
  contactShadow(v, sx, sy + 4, 18, 4, 0.36);
  box(v, sx - 13, sy - 36, 26, 42, 6, c(58, 64, 78));
  rect(v, sx - 13, sy - 36, 26, 1, adjustBrightness(c(58, 64, 78), 24));
  for (let i = 0; i < 6; i++) {
    const on = ((tick >> 3) + i) % 4 !== 0;
    rect(v, sx - 9, sy - 32 + i * 6, 3, 2, on ? status : c(50, 54, 64));
    rect(v, sx - 3, sy - 32 + i * 6, 8, 2, c(46, 50, 62));
  }
  // Ventilador: um pixel girando na grade.
  const ang = (tick / 4) % (Math.PI * 2);
  rect(v, sx + 5, sy - 10, 6, 6, c(40, 44, 56));
  px(v, sx + 8 + Math.round(Math.cos(ang) * 2), sy - 7 + Math.round(Math.sin(ang) * 2), adjustBrightness(status, 20));
  px(v, sx + 8, sy - 7, c(70, 76, 92));
  // A luz de estado banha o chao ao lado (regra 3: cor = estado).
  lightPool(v, sx, sy + 5, 16, 5, status, 0.12);

  // O cabo ate o painel: sobe a parede e corre o corredor. Um pulso de luz
  // viaja por ele enquanto o build esta vivo — a infraestrutura respirando.
  const path: [number, number][] = [];
  for (let y = sy - 36; y > FLOOR_Y - 4; y--) path.push([sx + 14, y]);
  for (let x = sx + 14; x > 404; x--) path.push([x, FLOOR_Y - 4]);
  for (let y = FLOOR_Y - 4; y > 72; y--) path.push([404, y]);
  // O cabo passa POR TRAS do quadro de planejamento: uma linha cruzando o
  // gantt por cima lia como artefato, nao como infraestrutura.
  const behindBoard = (xp: number, yp: number): boolean => xp >= 204 && xp <= 278 && yp >= 92 && yp <= 150;
  for (const [cxp, cyp] of path) if (!behindBoard(cxp, cyp)) px(v, cxp, cyp, adjustBrightness(WALL_DEEP, -26));
  if (!state.buildBroken && !state.cableOut) {
    const p = path[(tick * 2) % path.length];
    if (p && !behindBoard(p[0], p[1])) px(v, p[0], p[1], GREEN_BUILD);
  }
  if (state.cableOut) {
    // O cabo mordido, visivelmente solto no chao.
    for (let i = 0; i < 10; i++) px(v, sx - 20 - i, sy + 4 + ((i * 7) % 3), CORAL_ERR);
  }
};

/**
 * CLUTTER progressivo: o booth comeca limpo e vai acumulando canecas, latas,
 * post-its e papel amassado conforme as horas passam. Puramente derivado de
 * `state.tick` — a propria janela conta a historia do hackathon, e a mesma
 * partida produz o mesmo lixo.
 */
const drawClutter = (v: View, elapsed: number): void => {
  const mug = (x: number, y: number, col: number): void => {
    rect(v, x, y, 4, 4, col);
    px(v, x + 4, y + 1, col);
    rect(v, x + 1, y - 1, 2, 1, adjustBrightness(col, -40));
  };
  const can = (x: number, y: number): void => {
    rect(v, x, y, 3, 5, CYAN_ACT);
    rect(v, x, y, 3, 1, c(200, 206, 216));
  };
  if (elapsed > 0.08) mug(96, 104, CREAM);
  if (elapsed > 0.2) {
    can(398, 104);
    rect(v, 86, 100, 4, 4, AMBER_ALERT);
    rect(v, 386, 166, 4, 4, CYAN_ACT);
  }
  if (elapsed > 0.35) {
    mug(78, 169, adjustBrightness(MAGENTA, -20));
    rect(v, 452, 212, 6, 3, adjustBrightness(WALL_DEEP, 30));
  }
  if (elapsed > 0.65) {
    can(120, 245);
    can(348, 152);
    // Papel amassado.
    px(v, 180, 250, adjustBrightness(CREAM, -30));
    px(v, 181, 249, adjustBrightness(CREAM, -18));
    px(v, 272, 246, adjustBrightness(CREAM, -30));
  }
};

const drawSlots = (v: View, state: HackState, tick: number): void => {
  const elapsed = Math.min(1, state.tick / HACK_TICKS);
  drawWhiteboard(v, state);
  for (const slot of state.slots) {
    if (slot.track) drawStation(v, slot.x, slot.y, slot.track, state, tick);
    else if (slot.id === 'rack') drawRack(v, slot.x, slot.y, state, tick);
    else if (slot.id === 'puff') drawRest(v, slot.x, slot.y);
    else if (slot.id === 'cafe') drawSocial(v, slot.x, slot.y, elapsed, tick);
  }
  drawClutter(v, elapsed);
};

/* ------------------------------------------------------------------ gatos */

/**
 * UM GATO FOFO, desenhado por procedimento — e 30% maior que a primeira
 * versao: personagem manda mais que movel nesta cena.
 *
 * Fofura em pixels e contorno irregular: uma franja da cor do corpo,
 * deslocada por seno do tick, faz "pelo" sem asset. Cada gato usa o cracha
 * (lanyard) da propria trilha; orelhas e rabo respondem ao ESTRESSE — o
 * estado emocional e legivel na silhueta, nao so na ficha.
 */
/** Blit de um frame do pack: ancora no centro horizontal, chao na ultima linha. */
const blitFrame = (v: View, fr: SpriteFrame, cx: number, groundY: number, mirror: boolean): void => {
  const bx = Math.round(cx) - (fr.w >> 1);
  const by = Math.round(groundY) - fr.h;
  for (let yy = 0; yy < fr.h; yy++) {
    for (let xx = 0; xx < fr.w; xx++) {
      const color = fr.data[yy * fr.w + (mirror ? fr.w - 1 - xx : xx)]!;
      if (color !== 0) px(v, bx + xx, by + yy, color);
    }
  }
};

export const drawCat = (v: View, cat: Cat, tick: number, selected: boolean): void => {
  // TODOS os modos vem do pack girlypixels por aproximacao
  // (docs/sprites/bundle-audit.md §9): a anatomia, o gait e o timing sao os
  // originais comprados; o Catathon so escolhe QUAL animacao conta a acao.
  // Direcao nativa do pack e DIREITA; esquerda = espelho.
  const look = lookFor(cat.coat.body, cat.pattern, cat.big);
  const collar = SPEC_RGB[cat.specialty];
  // JITTER de fase por gato: sem isto o pavilhao inteiro balanca o rabo em
  // uchronia — cada gato entra na timeline com um offset proprio (id).
  tick += (cat.id.charCodeAt(0) * 7 + cat.id.charCodeAt(cat.id.length - 1) * 13) % 29;
  const cx = Math.round(cat.x);
  const ground = Math.round(cat.y) + 2;
  const toCenter = cat.x > 240; // parado, o gato olha para dentro do pavilhao

  if (cat.mode !== 'held') contactShadow(v, cx, ground, 8, 3, 0.34);

  // Selecao: um ANEL compacto de 1px nos pes — nada de poca saturada
  // competindo com o corpo, nada de caixa retangular em volta de um gato.
  if (selected) {
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      px(v, Math.round(cat.x + Math.cos(a) * 11), ground + Math.round(Math.sin(a) * 2.6), VIOLET_SEL);
    }
  }

  if (cat.mode === 'held') {
    // Na mao: o frame FRONTAL do Turning — o gato encara quem o segura.
    blitFrame(v, heldFrame(look, collar), cx, Math.round(cat.y) + 10, false);
    return;
  }

  if (cat.mode === 'walk') {
    blitFrame(v, packFrame(look, 'walk', tick, collar), cx, ground, cat.targetX < cx);
    return;
  }
  if (cat.mode === 'zoomies') {
    // Running + poeira atras.
    const mirror = cat.targetX < cat.x;
    blitFrame(v, packFrame(look, 'run', tick, collar), cx, ground, mirror);
    for (let i = 1; i <= 3; i++) px(v, cat.x - (mirror ? -i * 6 : i * 6), cat.y - 2, c(180, 170, 160));
    return;
  }
  if (cat.mode === 'work') {
    if (cat.slot === 'rack') {
      // Consertando o rack: Attack_swat = pata estendida na maquina.
      blitFrame(v, packFrame(look, 'swat', tick, collar), cx, ground, false);
      return;
    }
    // Na mesa o MONITOR fica na ponta interna da bancada: o gato encara a
    // tela (nunca fica de costas para o computador). Nos outros postos,
    // sentado voltado para o centro — que da no mesmo espelho.
    const mirror = toCenter;
    blitFrame(v, packFrame(look, 'sit', tick, collar), cx, ground, mirror);
    return;
  }
  if (cat.mode === 'nap') {
    const fr = packFrame(look, 'sleep', tick, collar);
    blitFrame(v, fr, cx, ground, toCenter);
    if ((tick >> 4) % 3 !== 2) {
      const zx = cx + (toCenter ? -10 : 10);
      px(v, zx, ground - fr.h - 1, CREAM);
      px(v, zx + 2, ground - fr.h - 4, CREAM);
    }
    return;
  }
  if (cat.mode === 'eat') {
    // Crouch de cabeca baixa sobre a tigela.
    blitFrame(v, packFrame(look, 'crouch', tick, collar), cx, ground, toCenter);
    rect(v, cx + (toCenter ? -13 : 8), ground - 1, 5, 2, c(220, 190, 140));
    return;
  }
  if (cat.mode === 'fight') {
    // A dupla briga com as PROPRIAS animacoes de briga do pack: um ataca,
    // o outro bufa (id decide, deterministico), pelos voando por cima.
    const anim = cat.id.charCodeAt(cat.id.length - 1) % 2 === 0 ? 'attack' : 'hiss';
    blitFrame(v, packFrame(look, anim, tick, collar), cx, ground, cat.targetX < cat.x);
    for (let i = 0; i < 4; i++) {
      const sx = cx - 12 + ((tick * 3 + i * 11) % 25);
      const sy = ground - 24 + ((tick + i * 7) % 18);
      px(v, sx, sy, CREAM);
      px(v, sx + 2, sy - 2, CREAM);
    }
    return;
  }
  if (cat.mode === 'keyboard') {
    // Sentado NO teclado, ";;;;;" subindo: o bug nascendo, visivel.
    const fr = packFrame(look, 'sit', tick, collar);
    blitFrame(v, fr, cx, ground, toCenter);
    const t = (tick >> 2) % 4;
    for (let i = 0; i < 3; i++) px(v, cx - 5 + i * 5, ground - fr.h - 2 - t - i, CORAL_ERR);
    return;
  }
  if (cat.mode === 'petted') {
    // Sitting_head_turn: o gato vira a cabeca para a mao que faz carinho.
    const fr = packFrame(look, 'sitturn', tick, collar);
    blitFrame(v, fr, cx, ground, toCenter);
    if ((tick >> 3) % 2 === 0) {
      const hx2 = cx + (toCenter ? -11 : 10);
      const hy2 = ground - fr.h + 3;
      px(v, hx2, hy2, c(240, 110, 130));
      px(v, hx2 + 1, hy2 - 1, c(240, 110, 130));
      px(v, hx2 + 2, hy2, c(240, 110, 130));
      px(v, hx2 + 1, hy2 + 1, c(240, 110, 130));
    }
    return;
  }
  // idle (e qualquer modo futuro): parado observando o pavilhao.
  blitFrame(v, packFrame(look, 'idle', tick, collar), cx, ground, toCenter);
};

const drawPm = (v: View, state: HackState, tick: number): void => {
  // O PM e o unico shorthair/grey_tabby do pavilhao (PM_LOOK), de oculos e
  // gravata — overlay Catathon baked sobre os frames originais do pack,
  // ancorado no olho/colar do proprio sprite (catsprites.ts).
  const pm = state.pm;
  const cx = Math.round(pm.x);
  const ground = Math.round(pm.y) + 2;
  const moving = Math.hypot(pm.targetX - pm.x, pm.targetY - pm.y) > 2;
  const mirror = moving ? pm.targetX < pm.x : pm.x > 240;
  contactShadow(v, cx, ground, 8, 3, 0.34);
  const fr = pmFrame(moving ? 'walk' : 'idle', tick);
  blitFrame(v, fr, cx, ground, mirror);

  // Atras da curva? O suor conta — a mesma conta do resmungo no feed.
  const alive = state.tasks.filter((t) => !t.cut);
  const behind = Math.floor((state.tick / HACK_TICKS) * alive.length) > alive.filter((t) => t.done).length;
  if (behind && (tick >> 3) % 2 === 0) px(v, cx + (mirror ? -9 : 9), ground - fr.h - 1, CYAN_ACT);
};

/* ------------------------------------------------------ o palco do pitch */

/**
 * O PITCH e CINEMATICO: quando as 48h acabam, o pavilhao inteiro da lugar a
 * um palco — a equipe demonstra o projeto num telao e uma PLATEIA de gatos
 * reage. Tudo aqui e DISPLAY derivado de (estado, tick): a plateia e
 * deterministica por semente, o telao le o gauge e a crise da sim, e nada
 * disto toca simulacao nem hash — cinematica e leitura, nunca regra.
 */

/** Hash visual (so display): a mesma edicao senta a mesma plateia. */
const vhash = (seed: number, a: number, b: number): number => {
  let h = (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(a + 1, 0xc2b2ae35) ^ Math.imul(b + 1, 0x27d4eb2f)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 0x100000000;
};

/** Pelagens da plateia: tons de gato, nunca as cores de estado (regra 3). */
const CROWD_COATS: readonly number[] = [
  c(184, 138, 84),
  c(230, 218, 196),
  c(142, 142, 152),
  c(64, 60, 70),
  c(216, 148, 62),
  c(120, 82, 64),
  c(206, 206, 214),
  c(96, 100, 116),
];

type CrowdMood = 'hyped' | 'warm' | 'cold' | 'shock';

/**
 * Um gato da PLATEIA, visto de costas (ele olha o palco, como voce). A
 * silhueta e de GATO SENTADO de verdade: ancas largas afinando para os
 * ombros, cabeca redonda MENOR que o corpo, orelhas triangulares com
 * orelha interna, e o rabo longo enrolado na base — o medidor emocional de
 * um gato de verdade. Empolgado PULA; morno balanca; frio congela e o rabo
 * mal se mexe. Alguns sao rajados (listras pela semente): plateia e povo,
 * nao clone.
 */
const drawAudienceCat = (
  v: View,
  x: number,
  y: number,
  body: number,
  tick: number,
  phase: number,
  mood: CrowdMood,
  striped = false
): void => {
  let bob = 0;
  if (mood === 'hyped') bob = -Math.round(Math.abs(Math.sin(tick / 5 + phase * 6.28)) * 3);
  else if (mood === 'warm') bob = -Math.round(Math.abs(Math.sin(tick / 11 + phase * 6.28)) * 1);
  const yy = y + bob;
  const head = adjustBrightness(body, 10);
  const dark = adjustBrightness(body, -26);
  const inner = adjustBrightness(body, -42);
  contactShadow(v, x + 5, y + 1, 7, 2, 0.28);

  // ANCAS -> OMBROS (de baixo para cima): a pera sentada do gato de costas.
  rect(v, x + 1, yy - 1, 9, 1, dark); // a base assenta em sombra
  rect(v, x, yy - 4, 11, 3, body);
  rect(v, x + 1, yy - 5, 9, 1, body);
  rect(v, x + 2, yy - 7, 7, 2, body);

  // CABECA redonda, menor que o corpo, com o topo aparado (nada de bloco).
  rect(v, x + 3, yy - 11, 5, 4, head);
  px(v, x + 2, yy - 9, head);
  px(v, x + 8, yy - 9, head);
  px(v, x + 2, yy - 10, head);
  px(v, x + 8, yy - 10, head);

  // ORELHAS triangulares de verdade, com a orelha interna escura.
  px(v, x + 2, yy - 12, body);
  px(v, x + 3, yy - 12, body);
  px(v, x + 3, yy - 13, body);
  px(v, x + 7, yy - 12, body);
  px(v, x + 8, yy - 12, body);
  px(v, x + 7, yy - 13, body);
  px(v, x + 3, yy - 12, inner);
  px(v, x + 7, yy - 12, inner);

  // LISTRAS de rajado (alguns): tres riscos no lombo e um na cabeca.
  if (striped) {
    px(v, x + 3, yy - 4, dark);
    px(v, x + 5, yy - 5, dark);
    px(v, x + 7, yy - 4, dark);
    px(v, x + 5, yy - 11, dark);
  }

  // O RABO: longo, enrolado na base e com a ponta viva — rapido na
  // empolgacao, pendulo no morno, quase parado no frio.
  const wagSpeed = mood === 'hyped' ? 4 : mood === 'warm' ? 12 : 30;
  const wag = mood === 'shock' ? 0 : Math.round(Math.sin(tick / wagSpeed + phase * 6) * 2);
  px(v, x + 10, yy - 1, dark);
  px(v, x + 11, yy - 2, dark);
  px(v, x + 12, yy - 4, body);
  px(v, x + 12, yy - 6 + wag, body);
  px(v, x + 11, yy - 8 + wag, head);

  if (mood === 'shock') {
    // O susto da crise: exclamacao coral sobre algumas cabecas.
    rect(v, x + 5, y - 20, 1, 4, CORAL_ERR);
    px(v, x + 5, y - 15, CORAL_ERR);
  }
};

/** Coracaozinho de plateia conquistada (o mesmo do carinho). */
const heart = (v: View, x: number, y: number): void => {
  px(v, x, y, c(240, 110, 130));
  px(v, x + 1, y - 1, c(240, 110, 130));
  px(v, x + 2, y, c(240, 110, 130));
  px(v, x + 1, y + 1, c(240, 110, 130));
};

/**
 * O NIVEL DO DESAFIO muda o LUGAR: cada palco do circuito tem o proprio
 * salao — do varal de luzinhas na garagem do Bairro a arena do Global com
 * quatro holofotes e fundao de silhuetas. Quick/daily jogam no generico
 * (regional). Tudo estatico por edicao: o palco e identidade, nao sorteio.
 */
type VenueSpec = {
  /** A plataforma (sempre centrada em 240). */
  stageX: number;
  stageW: number;
  /** O telao (y0 fixo em 34; Bairro projeta num lencol). */
  screen: { x: number; w: number; h: number };
  /** As fontes dos holofotes ([] = sem holofote: e uma garagem). */
  beams: readonly number[];
  /** As fileiras da plateia: quanto maior o palco, mais gatos. */
  rows: readonly { y: number; n: number; off: number; gap: number }[];
  /** Varal de luzinhas (bairro), cortinas tematicas (convencao). */
  garland: boolean;
  drapes: boolean;
  /** Fotografos com flash (nacional+) e o fundao lotado (global). */
  press: boolean;
  backwall: boolean;
  /** Lencol de projetor em vez de LED (bairro). */
  bedsheet: boolean;
};

const VENUES: Record<string, VenueSpec> = {
  bairro: {
    stageX: 150,
    stageW: 180,
    screen: { x: 198, w: 88, h: 52 },
    beams: [],
    rows: [
      { y: 194, n: 5, off: 92, gap: 60 },
      { y: 226, n: 4, off: 122, gap: 64 },
    ],
    garland: true,
    drapes: false,
    press: false,
    backwall: false,
    bedsheet: true,
  },
  regional: {
    stageX: 112,
    stageW: 256,
    screen: { x: 172, w: 136, h: 62 },
    beams: [128, 352],
    rows: [
      { y: 186, n: 9, off: 48, gap: 42 },
      { y: 212, n: 8, off: 68, gap: 42 },
      { y: 238, n: 9, off: 50, gap: 42 },
    ],
    garland: false,
    drapes: false,
    press: false,
    backwall: false,
    bedsheet: false,
  },
  convencao: {
    stageX: 104,
    stageW: 272,
    screen: { x: 164, w: 152, h: 66 },
    beams: [120, 360],
    rows: [
      { y: 186, n: 10, off: 38, gap: 40 },
      { y: 212, n: 9, off: 58, gap: 40 },
      { y: 238, n: 10, off: 40, gap: 40 },
    ],
    garland: false,
    drapes: true,
    press: false,
    backwall: false,
    bedsheet: false,
  },
  nacional: {
    stageX: 96,
    stageW: 288,
    screen: { x: 152, w: 176, h: 70 },
    beams: [96, 240, 384],
    rows: [
      { y: 184, n: 11, off: 28, gap: 40 },
      { y: 210, n: 10, off: 48, gap: 40 },
      { y: 236, n: 11, off: 30, gap: 40 },
    ],
    garland: false,
    drapes: false,
    press: true,
    backwall: false,
    bedsheet: false,
  },
  global: {
    stageX: 84,
    stageW: 312,
    screen: { x: 140, w: 200, h: 74 },
    beams: [70, 180, 300, 410],
    rows: [
      { y: 184, n: 12, off: 20, gap: 38 },
      { y: 208, n: 11, off: 40, gap: 38 },
      { y: 232, n: 12, off: 22, gap: 38 },
    ],
    garland: false,
    drapes: false,
    press: true,
    backwall: true,
    bedsheet: false,
  },
};

const venueFor = (state: HackState): VenueSpec => VENUES[state.circuit?.id ?? 'regional'] ?? VENUES.regional!;

/** O TELAO da demo: mock animado do projeto, glitch na crise, veredito no fim. */
const drawDemoScreen = (
  v: View,
  state: HackState,
  tick: number,
  crisisOpen: boolean,
  improvRecent: boolean,
  locale: Locale,
  venue: VenueSpec
): void => {
  const x0 = venue.screen.x;
  const y0 = 34;
  const w = venue.screen.w;
  const h = venue.screen.h;
  if (venue.bedsheet) {
    // A GARAGEM projeta num LENCOL pendurado: varal, pregadores e as
    // dobras do tecido por cima da imagem — charme de bairro.
    rect(v, x0 - 6, y0 - 6, w + 12, 2, adjustBrightness(WOOD, -20));
    px(v, x0 - 2, y0 - 4, CORAL_LIT);
    px(v, x0 + w + 1, y0 - 4, CORAL_LIT);
    rect(v, x0 - 3, y0 - 3, w + 6, h + 6, adjustBrightness(CREAM, -14));
  } else {
    // Moldura fisica de LED + trave superior com refletores.
    rect(v, x0 - 4, y0 - 4, w + 8, h + 8, adjustBrightness(WALL_DEEP, -20));
    rect(v, x0 - 2, y0 - 2, w + 4, h + 4, c(30, 34, 44));
    rect(v, x0 - 8, y0 - 8, w + 16, 3, c(52, 56, 70));
    const nLights = Math.max(3, Math.floor(w / 33));
    for (let i = 0; i < nLights; i++) {
      const lx = x0 + 6 + i * Math.floor((w - 12) / (nLights - 1));
      rect(v, lx, y0 - 6, 4, 2, adjustBrightness(AMBER_ALERT, (tick >> 4) % nLights === i ? 30 : -30));
    }
  }

  const done = state.phase === 'done';
  const r = state.result;
  if (done && r) {
    if (r.crashed) {
      // A tela azul da vergonha (coral, na verdade): o veredito mais lido.
      rect(v, x0, y0, w, h, adjustBrightness(CORAL_ERR, -55));
      if ((tick >> 4) % 4 !== 3) {
        text(v, x0 + (w - textWidth(locale === 'pt' ? 'ERRO' : 'ERROR', 3)) / 2, y0 + 14, locale === 'pt' ? 'ERRO' : 'ERROR', 3, CREAM);
        text(v, x0 + (w - textWidth('MIAU?', 2)) / 2, y0 + 40, 'MIAU?', 2, adjustBrightness(CREAM, -30));
      }
    } else {
      // O placar final no telao — a nota que a plateia viu nascer.
      rect(v, x0, y0, w, h, adjustBrightness(GREEN_BUILD, -62));
      const scoreWord = String(r.score);
      text(v, x0 + (w - textWidth(scoreWord, 4)) / 2, y0 + 10, scoreWord, 4, CREAM);
      const sub = state.project.name.toUpperCase();
      text(v, x0 + (w - textWidth(sub, 1)) / 2, y0 + 46, sub, 1, adjustBrightness(CREAM, -24));
    }
    return;
  }

  if (crisisOpen) {
    // A DEMO TRAVOU AO VIVO: estatica, fatias deslocadas e o cursor morto.
    rect(v, x0, y0, w, h, c(16, 20, 28));
    for (let row = 0; row < h; row += 3) {
      const shift = Math.floor(vhash(state.seed, row, tick >> 1) * 14) - 7;
      const bright = vhash(state.seed, row + 99, tick >> 2);
      if (bright > 0.6) rect(v, x0 + Math.max(0, shift), y0 + row, w - Math.abs(shift), 1, bright > 0.85 ? CORAL_ERR : c(60, 70, 86));
    }
    if ((tick >> 3) % 2 === 0) text(v, x0 + (w - textWidth('?!', 3)) / 2, y0 + 22, '?!', 3, CORAL_ERR);
    return;
  }

  // A DEMO AO VIVO: cabecalho com o nome do projeto e mocks que alternam —
  // fluxo (frontend), painel (dados) e o grafo de features shipadas.
  rect(v, x0, y0, w, h, c(24, 32, 42));
  rect(v, x0, y0, w, 10, adjustBrightness(CYAN_ACT, -52));
  const name = state.project.name.toUpperCase();
  text(v, x0 + 3, y0 + 2, name, 1, CREAM);
  if (improvRecent) {
    // O improviso heroico acabou de salvar a demo: selo verde no canto.
    text(v, x0 + w - textWidth(locale === 'pt' ? 'VIVO!' : 'LIVE!', 1) - 3, y0 + 2, locale === 'pt' ? 'VIVO!' : 'LIVE!', 1, GREEN_BUILD);
  }
  const mode = ((tick / 110) | 0) % 3;
  const cy0 = y0 + 13;
  const innerH = h - 15;
  if (mode === 0) {
    // O fluxo do app: cards navegando (a demo clica de tela em tela).
    const slide = (tick >> 4) % 3;
    const cw = Math.floor((w - 20) / 3);
    for (let i = 0; i < 3; i++) {
      const cx0 = x0 + 7 + i * (cw + 3);
      const active = i === slide;
      const ch = innerH - 8;
      rect(v, cx0, cy0 + 3, cw, ch, active ? c(38, 50, 64) : c(30, 40, 52));
      rect(v, cx0 + 2, cy0 + 5, Math.floor(cw * 0.55), 4, active ? CYAN_ACT : adjustBrightness(CYAN_ACT, -35));
      rect(v, cx0 + 2, cy0 + 12, cw - 5, 2, adjustBrightness(CREAM, -50));
      rect(v, cx0 + 2, cy0 + 16, Math.floor(cw * 0.7), 2, adjustBrightness(CREAM, -55));
      diamond(v, cx0 + cw - 6, cy0 + ch - 3, 3, 2, active ? MAGENTA : adjustBrightness(MAGENTA, -40));
      if (active) rect(v, cx0, cy0 + ch + 4, cw, 1, CYAN_ACT);
    }
  } else if (mode === 1) {
    // O painel de dados ao vivo: barras subindo com o tick.
    const bars = Math.max(4, Math.floor((w - 16) / 16));
    for (let i = 0; i < bars; i++) {
      const bar = 4 + ((i * 7 + (tick >> 3)) % (innerH - 6));
      rect(v, x0 + 10 + i * 16, cy0 + innerH - 2 - bar, 9, bar, i % 3 === 0 ? AMBER_ALERT : i % 3 === 1 ? CYAN_ACT : MAGENTA);
    }
    rect(v, x0 + 6, cy0 + innerH - 1, w - 12, 1, adjustBrightness(CREAM, -55));
  } else {
    // O grafo do projeto: um no por feature shipada, na cor da trilha.
    const colStep = Math.floor((w - 24) / 6);
    const rowStep = Math.max(10, Math.floor((innerH - 10) / 2));
    let i = 0;
    for (const t of state.tasks) {
      const col = i % 6;
      const row2 = (i / 6) | 0;
      const nx = x0 + 12 + col * colStep;
      const ny = cy0 + 6 + row2 * rowStep;
      const colr = t.done ? TRACK_COLOR[t.track] : adjustBrightness(c(70, 78, 94), -10);
      if (col > 0) rect(v, nx - colStep + 6, ny + 2, colStep - 7, 1, adjustBrightness(c(70, 78, 94), -18));
      rect(v, nx, ny, 5, 5, colr);
      if (t.done && (tick >> 3) % 6 === i % 6) rect(v, nx, ny, 5, 1, CREAM);
      i++;
    }
  }
  if (venue.bedsheet) {
    // As DOBRAS do lencol por cima da projecao: a garagem nao esconde que e
    // garagem — e esse e o charme.
    for (const fx of [x0 + Math.floor(w * 0.28), x0 + Math.floor(w * 0.62), x0 + Math.floor(w * 0.85)]) {
      for (let yy = 0; yy < h; yy++) mixPx(v, fx + Math.round(Math.sin(yy / 9) * 1.5), y0 + yy, CREAM, 0.1);
    }
  }
  // O brilho do telao banha o palco (regra 2).
  lightPool(v, x0 + w / 2, y0 + h + 10, Math.floor(w * 0.55), 10, CYAN_ACT, 0.08);
};

/**
 * A CENA DO PITCH: salao escuro, holofotes, o palco com a equipe
 * demonstrando, o PM roendo unha na coxia e a plateia reagindo ao gauge.
 * A habilidade de palco recem-usada vira NUMERO DE PALCO (a pose da
 * personalidade); a crise congela a sala; o improviso explode em confete.
 */
const drawPitchScene = (v: View, state: HackState, tick: number, locale: Locale): void => {
  const p = state.pitch!;
  const g = p.gauge;
  const done = state.phase === 'done';
  const r = state.result;
  const crisisOpen = !done && p.crisisUntil > 0 && state.tick < p.crisisUntil && !p.crisisResolved;

  // Os ULTIMOS eventos de palco (janela curta): quem esta performando, e o
  // improviso que acabou de salvar a demo.
  let lastAbility: { cat: string; effect: number; tick: number } | null = null;
  let improvAt = -1;
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i]!;
    if (e.tick < state.tick - 120) break;
    if (e.kind === 'ability' && !lastAbility) lastAbility = { cat: e.cat, effect: e.effect, tick: e.tick };
    if (e.kind === 'improviso' && improvAt < 0) improvAt = e.tick;
  }
  const improvRecent = improvAt >= 0 && state.tick - improvAt < 90;
  const venue = venueFor(state);
  const isGarage = venue.bedsheet;

  // O SALAO: cada nivel do circuito tem o proprio — a garagem do Bairro e
  // quente e apertada; a arena do Global e um breu onde so o palco existe.
  const wallDim = isGarage ? -2 : venue.backwall ? -22 : -12;
  const floorDim = isGarage ? -6 : venue.backwall ? -22 : -14;
  rect(v, 0, 0, v.w, 118, adjustBrightness(WALL_DEEP, wallDim));
  rect(v, 0, 118, v.w, v.h - 118, adjustBrightness(FLOOR_A, floorDim));
  for (let gy = 0; gy < 6; gy++) {
    for (let gx = -1; gx < 16; gx++) {
      if (((gx + gy) & 1) === 0) continue;
      diamond(v, gx * 32 + (gy % 2 === 0 ? 0 : 16), 130 + gy * 24, 15, 7, adjustBrightness(FLOOR_B, floorDim - 2));
    }
  }
  if (isGarage) {
    // A garagem: porta basculante ao fundo, prateleira com caixas, e o
    // trofeu de papelao que da nome ao sonho.
    for (let gy2 = 0; gy2 < 5; gy2++) rect(v, 24, 12 + gy2 * 12, 92, 1, adjustBrightness(WALL_DEEP, 14));
    rect(v, 24, 10, 92, 1, adjustBrightness(WALL_DEEP, 22));
    box(v, 380, 58, 64, 6, 4, adjustBrightness(WOOD, -22));
    box(v, 388, 52, 14, 8, 4, c(168, 134, 92));
    box(v, 412, 52, 18, 8, 4, adjustBrightness(c(168, 134, 92), -12));
    rect(v, 440, 44, 8, 10, c(168, 134, 92));
    px(v, 441, 42, AMBER_ALERT);
    px(v, 446, 42, AMBER_ALERT);
  }
  if (venue.drapes) {
    // A CONVENCAO veste o salao: cortinas tematicas nas laterais.
    for (const [dx0, col] of [[8, MAGENTA], [452, CYAN_ACT]] as const) {
      rect(v, dx0, 0, 20, 116, adjustBrightness(col, -68));
      for (let i = 0; i < 4; i++) rect(v, dx0 + 2 + i * 5, 0, 1, 116, adjustBrightness(col, -56));
      rect(v, dx0, 112, 20, 4, adjustBrightness(col, -50));
    }
  }
  // O letreiro do salao: CATATHON + o NOME do palco do circuito.
  text(v, Math.round((v.w - textWidth('CATATHON', 2)) / 2), 6, 'CATATHON', 2, adjustBrightness(CORAL, isGarage ? -30 : -18));
  const stageName = state.circuit ? (CIRCUIT_TEXT[locale][state.circuit.id]?.name ?? '') : '';
  if (stageName) {
    const nm = stageName.toUpperCase();
    text(v, Math.round((v.w - textWidth(nm, 1)) / 2), 20, nm, 1, adjustBrightness(CREAM, -46));
  }

  // HOLOFOTES por nivel: a garagem nao tem nenhum (tem varal); a arena tem
  // quatro. A crise esfria todos para coral.
  const beamCol = crisisOpen ? CORAL_ERR : CREAM;
  for (const src of venue.beams) {
    for (let y = 12; y < 122; y += 1) {
      const t2 = (y - 12) / 110;
      const cx0 = src + (240 - src) * t2;
      const half = 2 + t2 * 22;
      for (let xx = -half; xx <= half; xx += 2) mixPx(v, cx0 + xx, y, beamCol, venue.beams.length > 2 ? 0.038 : 0.045);
    }
  }
  if (venue.garland) {
    // O VARAL de luzinhas da garagem: a unica iluminacao cenica do Bairro.
    for (let x = 60; x < 420; x += 6) {
      const sag = Math.round(Math.sin(((x - 60) / 360) * Math.PI) * 9);
      px(v, x, 16 + sag, adjustBrightness(WOOD, -30));
      if (x % 18 === 0) {
        const cols = [CORAL_LIT, AMBER_ALERT, CYAN_ACT, MAGENTA];
        const col = cols[(x / 18) % cols.length | 0]!;
        const on = ((tick >> 4) + x / 18) % 5 !== 0;
        rect(v, x, 17 + sag, 2, 3, on ? col : adjustBrightness(col, -50));
        if (on) lightPool(v, x + 1, 19 + sag, 5, 4, col, 0.15);
      }
    }
  }

  // O PALCO: plataforma de madeira com frente iluminada e a contagem do
  // tempo de palco correndo na beira — a cena tambem e o relogio.
  box(v, venue.stageX, 132, venue.stageW, 22, 10, WOOD);
  rect(v, venue.stageX, 122, venue.stageW, 2, WOOD_LIGHT);
  contactShadow(v, 240, 158, Math.floor(venue.stageW / 2) + 8, 6, 0.35);
  const ticksFrac = done ? 0 : Math.max(0, p.ticksLeft / PITCH_TICKS);
  rect(v, venue.stageX + 4, 150, venue.stageW - 8, 2, adjustBrightness(WOOD, -40));
  rect(v, venue.stageX + 4, 150, Math.round((venue.stageW - 8) * ticksFrac), 2, AMBER_ALERT);
  lightPool(v, 240, 130, Math.floor(venue.stageW / 2), 12, beamCol, isGarage ? 0.07 : 0.1);

  // O TELAO da demo, centro do numero inteiro.
  drawDemoScreen(v, state, tick, crisisOpen, improvRecent, locale, venue);

  // O PUPITRE com o laptop da demo, ligado ao telao.
  box(v, 254, 124, 20, 8, 5, adjustBrightness(WOOD, -16));
  rect(v, 257, 117, 12, 2, c(58, 62, 76));
  rect(v, 257, 115, 12, 3, crisisOpen ? adjustBrightness(CORAL_ERR, -20) : c(40, 52, 66));
  for (let i = 0; i < 6; i++) px(v, 272, 110 - i, adjustBrightness(WALL_DEEP, -30));

  // A EQUIPE NO PALCO. O apresentador da vez fica a frente, DE FRENTE para a
  // plateia (frame frontal do Turning); quem acabou de usar a habilidade faz
  // o proprio numero — a pose da personalidade, nao um aceno generico.
  const cats = state.cats;
  const performing = lastAbility && state.tick - lastAbility.tick < 55 ? lastAbility.cat : null;
  const presenterIdx = performing
    ? Math.max(0, cats.findIndex((cc) => cc.id === performing))
    : ((tick / 260) | 0) % Math.max(1, cats.length);
  const sideSpots = [
    venue.stageX + 40,
    venue.stageX + 82,
    venue.stageX + venue.stageW - 82,
    venue.stageX + venue.stageW - 40,
  ];
  let spot = 0;
  cats.forEach((cat, i) => {
    const look = lookFor(cat.coat.body, cat.pattern, cat.big);
    const collar = SPEC_RGB[cat.specialty];
    const jitter = (cat.id.charCodeAt(0) * 7 + cat.id.charCodeAt(cat.id.length - 1) * 13) % 29;
    const t3 = tick + jitter;
    if (done && r?.crashed) {
      // Demo crashada: a equipe encolhe no palco. A plateia ja entendeu.
      blitFrame(v, packFrame(look, 'crouch', t3, collar), sideSpots[spot++ % 4]!, 130, i % 2 === 0);
      return;
    }
    if (i === presenterIdx) {
      const cx0 = 234;
      const ground = 131;
      contactShadow(v, cx0, ground, 9, 3, 0.3);
      if (performing && state.tick - (lastAbility?.tick ?? 0) < 55) {
        // O NUMERO: cacar o cursor corre o palco; a encarada vira a cabeca;
        // o ronrom senta soberano; o paozinho amassa de olhos fechados.
        if (cat.personality === 'cowboy') {
          const dash = Math.sin(t3 / 5) * 30;
          blitFrame(v, packFrame(look, 'run', t3, collar), cx0 + dash, ground, Math.cos(t3 / 5) < 0);
          if (lastAbility && lastAbility.effect < 0 && (tick >> 3) % 2 === 0) {
            // O cursor mudou o slide: a gafe existe na cena.
            text(v, cx0 - 2, ground - 34, '!', 2, AMBER_ALERT);
          }
        } else if (cat.personality === 'perfeccionista') {
          blitFrame(v, packFrame(look, 'sitturn', t3, collar), cx0, ground, false);
        } else if (cat.personality === 'calmo') {
          blitFrame(v, packFrame(look, 'sit', t3, collar), cx0, ground, false);
          if ((t3 >> 3) % 2 === 0) {
            px(v, cx0 + 12, ground - 26 - ((t3 >> 3) % 4), CREAM);
            px(v, cx0 + 15, ground - 30 - ((t3 >> 4) % 3), CREAM);
          }
        } else {
          blitFrame(v, packFrame(look, 'crouch', t3, collar), cx0, ground, false);
          if ((t3 >> 2) % 2 === 0) px(v, cx0 - 8, ground - 4, CREAM);
          else px(v, cx0 - 6, ground - 4, CREAM);
        }
      } else if (improvRecent) {
        // O heroi do improviso ATACA o laptop: o conserto ao vivo e cena.
        blitFrame(v, packFrame(look, 'swat', t3, collar), 246, ground, false);
        if ((tick >> 2) % 2 === 0) px(v, 262, 112 - ((tick >> 2) % 4), GREEN_BUILD);
      } else {
        // Apresentando: de frente para a plateia, como quem segura o palco.
        blitFrame(v, heldFrame(look, collar), cx0, ground + 8, false);
      }
      if (crisisOpen && (tick >> 3) % 2 === 0) text(v, cx0 + 12, ground - 36, '!', 2, CORAL_ERR);
    } else {
      const sx = sideSpots[spot++ % 4]!;
      blitFrame(v, packFrame(look, 'sit', t3, collar), sx, 129, sx > 240);
    }
  });

  // O PM na coxia, aos pes do palco: orgulhoso — ou suando na crise.
  const pmFr = pmFrame('idle', tick);
  contactShadow(v, 92, 160, 8, 3, 0.3);
  blitFrame(v, pmFr, 92, 158, false);
  if (crisisOpen && (tick >> 3) % 2 === 0) px(v, 100, 158 - pmFr.h - 1, CYAN_ACT);

  // O FUNDAO do Global: alem das fileiras, uma arquibancada de silhuetas —
  // a arena e maior do que a tela consegue sentar.
  const crashedEnd = done && r?.crashed === true;
  const winEnd = done && (r?.outcome === 'grand-prize' || r?.outcome === 'podio');
  if (venue.backwall && !crashedEnd) {
    for (let x = 4; x < 476; x += 13) {
      const hb = vhash(state.seed, x, 11);
      const bob2 = g > 0.6 ? Math.round(Math.abs(Math.sin(tick / 6 + hb * 6.28)) * 2) : 0;
      const sy2 = 262 + Math.floor(hb * 4) - bob2;
      rect(v, x, sy2 - 6, 9, 8, SHADOW_INK);
      // Orelhas em triangulo ate na silhueta: fundao de gatos, nao de imps.
      px(v, x + 1, sy2 - 7, SHADOW_INK);
      px(v, x + 2, sy2 - 7, SHADOW_INK);
      px(v, x + 1, sy2 - 8, SHADOW_INK);
      px(v, x + 6, sy2 - 7, SHADOW_INK);
      px(v, x + 7, sy2 - 7, SHADOW_INK);
      px(v, x + 7, sy2 - 8, SHADOW_INK);
      if (winEnd || g > 0.85) if (vhash(state.seed, x, 12) > 0.7 && (tick + x) % 40 < 20) heart(v, x + 3, sy2 - 14);
    }
  }

  // A IMPRENSA felina (Nacional para cima): fotografos no fosso, flashes
  // estourando — mais quando a plateia esta de pe.
  if (venue.press) {
    for (const [fx2, ph] of [[70, 0.2], [402, 0.7], [240, 0.45]] as const) {
      const body = c(64, 60, 70);
      drawAudienceCat(v, fx2, 172, body, tick, ph, 'warm');
      rect(v, fx2 + 2, 160, 5, 3, c(40, 44, 54));
      px(v, fx2 + 4, 161, CYAN_ACT);
      const flashBeat = (tick + Math.floor(ph * 97)) % (g > 0.6 ? 46 : 90);
      if (flashBeat < 3) {
        lightPool(v, fx2 + 4, 156, 10, 8, CREAM, 0.5);
      }
    }
  }

  // A PLATEIA: fileiras deterministicas por semente — MAIS fileiras e mais
  // gatos quanto maior o palco. O gauge decide o humor de cada um (cada
  // gato tem o proprio limiar de entusiasmo); o frio esvazia cadeiras —
  // perder a plateia e VISIVEL, nao so uma barra.
  venue.rows.forEach((row, ri) => {
    for (let i = 0; i < row.n; i++) {
      const id = ri * 37 + i;
      const hx = vhash(state.seed, id, 1);
      const x = row.off + i * row.gap + Math.floor(vhash(state.seed, id, 2) * 10);
      // O hype de influencer LOTA a sala; o frio esvazia; o crash despede.
      const leaveAt = 0.12 + hx * 0.26 - state.hype * 0.6;
      if (crashedEnd && hx > 0.3) continue;
      if (!done && g < leaveAt) continue;
      const enthusiasm = 0.3 + vhash(state.seed, id, 3) * 0.55;
      let mood: CrowdMood;
      if (crisisOpen) mood = vhash(state.seed, id, 4) < 0.5 ? 'shock' : 'cold';
      else if (crashedEnd) mood = 'cold';
      else if (winEnd || g > enthusiasm) mood = 'hyped';
      else if (g > enthusiasm - 0.3) mood = 'warm';
      else mood = 'cold';
      const body = CROWD_COATS[Math.floor(vhash(state.seed, id, 5) * CROWD_COATS.length)]!;
      drawAudienceCat(v, x, row.y, body, tick, hx, mood, vhash(state.seed, id, 13) < 0.4);
      // Coracoes sobem da plateia conquistada — o voto popular tem rosto.
      if (mood === 'hyped' && vhash(state.seed, id, 6) > 0.6) {
        const beat = (tick + id * 9) % 46;
        if (beat < 26) heart(v, x + 3, row.y - 18 - (beat >> 1));
      }
    }
  });

  // CONFETE: plateia acima de 80%, improviso heroico ou o podio no fim.
  const celebrating = (!done && (g >= 0.8 || improvRecent)) || winEnd;
  if (celebrating) {
    const heavy = winEnd ? 46 : 26;
    for (let i = 0; i < heavy; i++) {
      const cx0 = 20 + vhash(state.seed, i, 7) * 440;
      const speed = 0.8 + vhash(state.seed, i, 8) * 1.2;
      const cy0 = (tick * speed + vhash(state.seed, i, 9) * 260) % 240;
      const cols = [CORAL_LIT, CYAN_ACT, AMBER_ALERT, MAGENTA, CREAM];
      const col = cols[i % cols.length]!;
      px(v, cx0 + Math.round(Math.sin((tick + i * 13) / 9) * 2), cy0, col);
      px(v, cx0, cy0 - 2, adjustBrightness(col, -25));
    }
  }
};

/** A mao do jogador: uma patinha. Cursor e personagem ao mesmo tempo. */
export const drawHand = (v: View, x: number, y: number, holding: boolean): void => {
  const col = c(244, 226, 198);
  rect(v, x - 3, y - 3, 7, 6, col);
  for (let i = 0; i < 3; i++) rect(v, x - 3 + i * 3, y - 5, 2, 2, col);
  if (!holding) rect(v, x - 2, y - 1, 5, 3, c(226, 160, 170));
};

export const drawScene = (v: View, state: HackState, tick: number, selected: string | null, locale: Locale = 'en'): void => {
  // As 48h acabaram: o pavilhao da lugar ao PALCO — plateia, telao e a
  // equipe demonstrando. A cena do booth so volta na proxima edicao.
  if (state.phase !== 'hack' && state.pitch) {
    drawPitchScene(v, state, tick, locale);
    return;
  }
  drawFloor(v, tick);
  drawPanel(v, state, tick, locale);
  drawSlots(v, state, tick);
  // O PM desenha antes do elenco: presenca constante, nunca por cima de
  // quem o jogador pode pegar.
  drawPm(v, state, tick);
  const order = [...state.cats].sort((a, b) => a.y - b.y);
  for (const cat of order) if (cat.mode !== 'held') drawCat(v, cat, tick, selected === cat.id);
  // O gato seguro desenha por ultimo, acima de tudo: esta na tua mao.
  const held = state.cats.find((cat) => cat.mode === 'held');
  if (held) drawCat(v, held, tick, false);
};
