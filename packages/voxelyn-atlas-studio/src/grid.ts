// Operacoes puras sobre buffers RGBA (sem canvas): desenhaveis no browser e
// testaveis em Node. Alpha e sempre BINARIO (0 ou 255) — contrato da Art Bible.
import type { Grid } from './types';
import { toHex } from './palette';

export const createGrid = (w: number, h: number): Grid => ({
  w,
  h,
  buf: new Uint8Array(w * h * 4),
});

export const cloneBuf = (buf: Uint8Array): Uint8Array => new Uint8Array(buf);

export const setPx = (g: Grid, x: number, y: number, rgb: readonly number[] | null): void => {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  const i = (y * g.w + x) * 4;
  if (rgb === null) {
    g.buf[i] = 0;
    g.buf[i + 1] = 0;
    g.buf[i + 2] = 0;
    g.buf[i + 3] = 0;
    return;
  }
  g.buf[i] = rgb[0];
  g.buf[i + 1] = rgb[1];
  g.buf[i + 2] = rgb[2];
  g.buf[i + 3] = 255;
};

/** rgb do pixel, ou null se transparente/fora. */
export const getPx = (g: Grid, x: number, y: number): [number, number, number] | null => {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return null;
  const i = (y * g.w + x) * 4;
  if (g.buf[i + 3] === 0) return null;
  return [g.buf[i], g.buf[i + 1], g.buf[i + 2]];
};

export const isEmpty = (g: Grid): boolean => {
  for (let i = 3; i < g.buf.length; i += 4) if (g.buf[i] !== 0) return false;
  return true;
};

export const colorsUsed = (g: Grid): Set<string> => {
  const out = new Set<string>();
  for (let i = 0; i < g.buf.length; i += 4) {
    if (g.buf[i + 3] === 0) continue;
    out.add(toHex([g.buf[i], g.buf[i + 1], g.buf[i + 2]]));
  }
  return out;
};

/** Caixa envolvente do conteudo opaco, ou null num frame vazio. */
export const contentBounds = (
  g: Grid,
): { minX: number; minY: number; maxX: number; maxY: number } | null => {
  let minX = g.w,
    minY = g.h,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.buf[(y * g.w + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
};

/** Linha rasterizada (Bresenham). */
export const drawLine = (
  g: Grid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgb: readonly number[] | null,
  size = 1,
): void => {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    stamp(g, x, y, rgb, size);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
};

/** Carimbo quadrado size x size centrado no pixel (pincel). */
export const stamp = (
  g: Grid,
  x: number,
  y: number,
  rgb: readonly number[] | null,
  size = 1,
): void => {
  const half = Math.floor((size - 1) / 2);
  for (let oy = 0; oy < size; oy++) {
    for (let ox = 0; ox < size; ox++) {
      setPx(g, x - half + ox, y - half + oy, rgb);
    }
  }
};

export const drawRect = (
  g: Grid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgb: readonly number[] | null,
): void => {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  for (let x = minX; x <= maxX; x++) {
    setPx(g, x, minY, rgb);
    setPx(g, x, maxY, rgb);
  }
  for (let y = minY; y <= maxY; y++) {
    setPx(g, minX, y, rgb);
    setPx(g, maxX, y, rgb);
  }
};

/** Preenchimento por inundacao da regiao de mesma cor (ou transparencia). */
export const floodFill = (g: Grid, x: number, y: number, rgb: readonly number[] | null): void => {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  const key = (px: number, py: number): string => {
    const c = getPx(g, px, py);
    return c === null ? 'T' : `${c[0]},${c[1]},${c[2]}`;
  };
  const target = key(x, y);
  const replacement = rgb === null ? 'T' : `${rgb[0]},${rgb[1]},${rgb[2]}`;
  if (target === replacement) return;
  const stack: number[] = [x, y];
  while (stack.length > 0) {
    const cy = stack.pop()!;
    const cx = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= g.w || cy >= g.h) continue;
    if (key(cx, cy) !== target) continue;
    setPx(g, cx, cy, rgb);
    stack.push(cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1);
  }
};

/** Desloca o conteudo inteiro do frame; pixels que saem do canvas se perdem. */
export const shiftGrid = (g: Grid, dx: number, dy: number): void => {
  const out = new Uint8Array(g.buf.length);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
      const si = (y * g.w + x) * 4;
      const di = (ny * g.w + nx) * 4;
      out[di] = g.buf[si];
      out[di + 1] = g.buf[si + 1];
      out[di + 2] = g.buf[si + 2];
      out[di + 3] = g.buf[si + 3];
    }
  }
  g.buf.set(out);
};

/** Espelha horizontalmente (util para conferir flipPairs). */
export const flipHorizontal = (g: Grid): void => {
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < Math.floor(g.w / 2); x++) {
      const a = (y * g.w + x) * 4;
      const b = (y * g.w + (g.w - 1 - x)) * 4;
      for (let c = 0; c < 4; c++) {
        const t = g.buf[a + c];
        g.buf[a + c] = g.buf[b + c];
        g.buf[b + c] = t;
      }
    }
  }
};

/** Recopia um buffer para um canvas de outro tamanho, ancorado no topo-esquerda. */
export const resizeBuf = (
  buf: Uint8Array,
  fromW: number,
  fromH: number,
  toW: number,
  toH: number,
): Uint8Array => {
  const out = new Uint8Array(toW * toH * 4);
  const w = Math.min(fromW, toW);
  const h = Math.min(fromH, toH);
  for (let y = 0; y < h; y++) {
    out.set(buf.subarray(y * fromW * 4, y * fromW * 4 + w * 4), y * toW * 4);
  }
  return out;
};
