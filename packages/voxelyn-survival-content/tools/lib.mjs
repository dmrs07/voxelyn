// Paleta mestra da art bible (docs/art/voxelyn-survival-art-bible.md) e helpers de
// rasterizacao. Fonte da verdade para gerador e validador de sprites.

export const COLORS = {
  dark: [11, 14, 20],
  rockShadow: [29, 36, 48],
  rock: [46, 58, 77],
  rockLight: [70, 86, 110],
  rust: [110, 74, 51],
  bone: [184, 169, 143],
  fungusDark: [31, 61, 51],
  fungus: [47, 107, 79],
  fungusLight: [102, 194, 138],
  biolum: [89, 242, 194],
  acid: [168, 230, 60],
  fire: [255, 122, 47],
  blood: [217, 59, 76],
  electric: [122, 184, 255],
  loot: [255, 209, 102],
  player: [232, 241, 255],
};

const toHex = ([r, g, b]) => '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');

export const HEX = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, toHex(v)]));
export const ALLOWED_HEX = new Set(Object.values(HEX));

export const grid = (w, h) => ({ w, h, buf: new Uint8Array(w * h * 4) });

export const set = (g, x, y, name) => {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  const c = COLORS[name];
  if (!c) throw new Error(`cor fora da paleta: ${name}`);
  const i = (y * g.w + x) * 4;
  g.buf[i] = c[0];
  g.buf[i + 1] = c[1];
  g.buf[i + 2] = c[2];
  g.buf[i + 3] = 255;
};

export const clearPx = (g, x, y) => {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  g.buf[(y * g.w + x) * 4 + 3] = 0;
};

export const filled = (g, x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h && g.buf[(y * g.w + x) * 4 + 3] !== 0;

export const fillRect = (g, x0, y0, w, h, name) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(g, x, y, name);
};

export const fillEllipse = (g, cx, cy, rx, ry, name) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / (rx || 1);
      const dy = (y - cy) / (ry || 1);
      if (dx * dx + dy * dy <= 1) set(g, x, y, name);
    }
  }
};

export const line = (g, x0, y0, x1, y1, name) => {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    set(g, x, y, name);
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

/** Contorno externo de 1px (art bible: outline seletivo em entidades). */
export const outlineWith = (g, name) => {
  const snapshot = new Uint8Array(g.w * g.h);
  for (let i = 0; i < g.w * g.h; i++) snapshot[i] = g.buf[i * 4 + 3] !== 0 ? 1 : 0;
  const isFilled = (x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h && snapshot[y * g.w + x] === 1;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (snapshot[y * g.w + x]) continue;
      if (isFilled(x - 1, y) || isFilled(x + 1, y) || isFilled(x, y - 1) || isFilled(x, y + 1)) {
        set(g, x, y, name);
      }
    }
  }
};

/** Clareia linhas do topo (dissolucao da animacao de morte). */
export const clearTopRows = (g, rows) => {
  for (let y = 0; y < rows; y++) for (let x = 0; x < g.w; x++) clearPx(g, x, y);
};

export const colorsUsed = (g) => {
  const seen = new Set();
  for (let i = 0; i < g.w * g.h; i++) {
    if (g.buf[i * 4 + 3] === 0) continue;
    seen.add(toHex([g.buf[i * 4], g.buf[i * 4 + 1], g.buf[i * 4 + 2]]));
  }
  return seen;
};

export const isEmpty = (g) => {
  for (let i = 0; i < g.w * g.h; i++) if (g.buf[i * 4 + 3] !== 0) return false;
  return true;
};

/** Copia frame src para o atlas na coluna col. */
export const blitToAtlas = (atlas, src, col) => {
  const ox = col * src.w;
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      if (src.buf[si + 3] === 0) continue;
      const di = (y * atlas.w + (ox + x)) * 4;
      atlas.buf[di] = src.buf[si];
      atlas.buf[di + 1] = src.buf[si + 1];
      atlas.buf[di + 2] = src.buf[si + 2];
      atlas.buf[di + 3] = 255;
    }
  }
};
