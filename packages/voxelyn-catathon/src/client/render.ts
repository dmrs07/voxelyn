import { adjustBrightness, createSurface2D, packRGBA, type Surface2D } from '@voxelyn/core';
import { HACK_TICKS, HOURS_PER_TICK, workable } from '../sim/index.js';
import { heldFrame, lookFor, packFrame, pmFrame, type SpriteFrame } from './catsprites.js';
import { ganttEntries } from './ganttlog.js';
import type { Locale } from '../sim/text.js';
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
  H: [0b101, 0b101, 0b111, 0b101, 0b101],
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
  Y: [0b101, 0b101, 0b010, 0b010, 0b010],
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

/** A mao do jogador: uma patinha. Cursor e personagem ao mesmo tempo. */
export const drawHand = (v: View, x: number, y: number, holding: boolean): void => {
  const col = c(244, 226, 198);
  rect(v, x - 3, y - 3, 7, 6, col);
  for (let i = 0; i < 3; i++) rect(v, x - 3 + i * 3, y - 5, 2, 2, col);
  if (!holding) rect(v, x - 2, y - 1, 5, 3, c(226, 160, 170));
};

export const drawScene = (v: View, state: HackState, tick: number, selected: string | null, locale: Locale = 'en'): void => {
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
