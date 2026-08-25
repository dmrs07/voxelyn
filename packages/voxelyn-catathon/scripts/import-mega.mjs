#!/usr/bin/env node
/**
 * Importador do CatMegaBundle (segundo pack comprado) para modulos TS
 * embutidos no build — mesma politica do pack girlypixels: o repo e publico,
 * os arquivos crus do pack NUNCA entram nele (docs/sprites/LICENSE-cats.md).
 *
 * Emite:
 * - src/client/assets/pochiSprites.ts — o gato PM (Pochi, chibi frontal
 *   64x64): strips fatiadas em frames, formato indexado lossless.
 * - src/client/assets/catUi.ts — recortes da folha CatUserInterface/CatUI.png
 *   (chips com orelhas, botoes, paineis, patas, baloes) para o HUD.
 *
 * uso:
 *   CATATHON_MEGA_BUNDLE=<dir com CatMegaBundle/> node scripts/import-mega.mjs
 *   (default: <pacote>/assets-src/mega)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = resolve(process.env.CATATHON_MEGA_BUNDLE ?? join(PKG, 'assets-src', 'mega'));
const ROOT = join(BUNDLE, 'CatMegaBundle');

// Pochi: strips horizontais de frames 64x64, sem GIF de referencia — o
// ticksPerFrame e a batida escolhida pelo Catathon (30 Hz).
const POCHI = [
  { key: 'idle', file: 'Pochi/Sprites/Idle.png', ticksPerFrame: 5 },
  { key: 'walk', file: 'Pochi/Sprites/Running.png', ticksPerFrame: 4 },
  { key: 'surprised', file: 'Pochi/Sprites/Surprised.png', ticksPerFrame: 5 },
  { key: 'cry', file: 'Pochi/Sprites/Crying.png', ticksPerFrame: 5 },
  { key: 'happy', file: 'Pochi/Sprites/Happy.png', ticksPerFrame: 4 },
];
const POCHI_FRAME_W = 64;

// Recortes da CatUI.png — caixas medidas por scan de componentes conexos.
const UI_PIECES = {
  'chip-cream': [2, 2, 76, 28],
  'chip-pink': [2, 66, 76, 28],
  'chip-blue': [2, 98, 76, 28],
  'panel-tan-top': [263, 454, 85, 44],
  'panel-pink-top': [263, 581, 85, 44],
  'btn-light': [33, 257, 14, 14],
  'btn-light-on': [49, 258, 14, 13],
  'btn-mid': [129, 257, 14, 14],
  'btn-mid-on': [145, 258, 14, 13],
  paw: [377, 153, 35, 30],
  fish: [470, 195, 20, 11],
  'bubble-cream': [454, 584, 21, 18],
  'bubble-blue': [486, 584, 21, 18],
  'bubble-white': [454, 616, 21, 18],
  'bubble-brown': [486, 616, 21, 18],
  'cat-sleep': [419, 820, 43, 23],
  'cat-sleep2': [466, 856, 43, 32],
};

// ---------------------------------------------------------------------------
// PNG minimal -> RGBA (mesmo decoder do import-cats.mjs)
// ---------------------------------------------------------------------------
const decodePng = (path) => {
  const data = readFileSync(path);
  if (!data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error(`nao e PNG: ${path}`);
  }
  let pos = 8;
  let idat = Buffer.alloc(0);
  let plte = null;
  let trns = null;
  let w = 0, h = 0, bitd = 0, ctype = 0, interlace = 0;
  while (pos < data.length) {
    const ln = data.readUInt32BE(pos);
    const typ = data.toString('latin1', pos + 4, pos + 8);
    const chunk = data.subarray(pos + 8, pos + 8 + ln);
    if (typ === 'IHDR') {
      w = chunk.readUInt32BE(0); h = chunk.readUInt32BE(4);
      bitd = chunk[8]; ctype = chunk[9]; interlace = chunk[12];
    } else if (typ === 'PLTE') plte = chunk;
    else if (typ === 'tRNS') trns = chunk;
    else if (typ === 'IDAT') idat = Buffer.concat([idat, chunk]);
    else if (typ === 'IEND') break;
    pos += 12 + ln;
  }
  if (bitd !== 8 || interlace !== 0) throw new Error(`PNG fora do perfil: ${path}`);
  const nch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  const raw = inflateSync(idat);
  const stride = w * nch;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filt = raw[p++];
    const line = Buffer.from(raw.subarray(p, p + stride));
    p += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= nch ? line[i - nch] : 0;
      const b = prev[i];
      const cc = i >= nch ? prev[i - nch] : 0;
      let add = 0;
      if (filt === 1) add = a;
      else if (filt === 2) add = b;
      else if (filt === 3) add = (a + b) >> 1;
      else if (filt === 4) {
        const pa = Math.abs(b - cc), pb = Math.abs(a - cc), pc = Math.abs(a + b - 2 * cc);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : cc;
      }
      line[i] = (line[i] + add) & 0xff;
    }
    line.copy(out, y * stride);
    prev = line;
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (ctype === 6) out.copy(rgba, i * 4, i * 4, i * 4 + 4);
    else if (ctype === 2) { out.copy(rgba, i * 4, i * 3, i * 3 + 3); rgba[i * 4 + 3] = 255; }
    else if (ctype === 3) {
      const idx = out[i];
      plte.copy(rgba, i * 4, idx * 3, idx * 3 + 3);
      rgba[i * 4 + 3] = trns && idx < trns.length ? trns[idx] : 255;
    } else if (ctype === 0) { rgba.fill(out[i], i * 4, i * 4 + 3); rgba[i * 4 + 3] = 255; }
    else { rgba.fill(out[i * 2], i * 4, i * 4 + 3); rgba[i * 4 + 3] = out[i * 2 + 1]; }
  }
  return { w, h, rgba };
};

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const colorKey = (rgba, i) =>
  ((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]).toString(16).padStart(6, '0');

/** Indexa uma regiao (x0,y0,w,h) de uma imagem numa paleta acumulativa. */
const indexRegion = (img, x0, y0, rw, rh, palette, label) => {
  const rows = [];
  for (let y = 0; y < rh; y++) {
    let row = '';
    for (let x = 0; x < rw; x++) {
      const i = ((y0 + y) * img.w + (x0 + x)) * 4;
      let alpha = img.rgba[i + 3];
      if (alpha !== 0 && alpha !== 255) alpha = alpha < 128 ? 0 : 255;
      if (alpha === 0) { row += '.'; continue; }
      const key = colorKey(img.rgba, i);
      let idx = palette.indexOf(key);
      if (idx === -1) {
        idx = palette.length;
        if (idx >= CHARS.length) throw new Error(`paleta maior que o charset (${label})`);
        palette.push(key);
      }
      row += CHARS[idx];
    }
    rows.push(row);
  }
  // round-trip: reconstruir e comparar
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const i = ((y0 + y) * img.w + (x0 + x)) * 4;
      const ch = rows[y][x];
      if (ch === '.') {
        if (img.rgba[i + 3] >= 128) throw new Error(`round-trip alpha: ${label}`);
      } else if (img.rgba[i + 3] < 128 || colorKey(img.rgba, i) !== palette[CHARS.indexOf(ch)]) {
        throw new Error(`round-trip cor: ${label}`);
      }
    }
  }
  return rows;
};

const header = (what) => `/**
 * GERADO por scripts/import-mega.mjs — NAO editar a mao, NAO redesenhar.
 *
 * Fonte: CatMegaBundle (pack comprado). ${what}
 * Representacao indexada LOSSLESS (round-trip verificado): cada char de
 * \`rows\` indexa a paleta, '.' e transparente.
 *
 * O repo e publico e os arquivos crus do pack nao sao redistribuidos — este
 * modulo embute os pixels no BUILD do jogo (docs/sprites/LICENSE-cats.md).
 */
`;

// ---------------------------------------------------------------------------
// Pochi
// ---------------------------------------------------------------------------
const pochiOut = [];
for (const anim of POCHI) {
  const img = decodePng(join(ROOT, anim.file));
  if (img.h !== 64 || img.w % POCHI_FRAME_W !== 0) throw new Error(`strip inesperada: ${anim.file}`);
  const count = img.w / POCHI_FRAME_W;
  const palette = [];
  const frames = [];
  for (let f = 0; f < count; f++) {
    frames.push(indexRegion(img, f * POCHI_FRAME_W, 0, POCHI_FRAME_W, 64, palette, `${anim.file}#${f}`));
  }
  pochiOut.push({ key: anim.key, ticksPerFrame: anim.ticksPerFrame, palette, frames });
  console.log(`pochi/${anim.key}: ${count} frames, paleta ${palette.length}`);
}

writeFileSync(join(PKG, 'src', 'client', 'assets', 'pochiSprites.ts'), `${header('Pochi (o gato PM), strips 64x64.')}
export type PochiAnimKey = ${POCHI.map((a) => `'${a.key}'`).join(' | ')};

export type PochiAnim = {
  ticksPerFrame: number;
  palette: string[];
  /** frames de 64x64: rows de chars indexando a paleta. */
  frames: string[][];
};

export const POCHI_ANIMS: Record<PochiAnimKey, PochiAnim> = ${JSON.stringify(
  Object.fromEntries(pochiOut.map((a) => [a.key, { ticksPerFrame: a.ticksPerFrame, palette: a.palette, frames: a.frames }])),
)};
`);

// ---------------------------------------------------------------------------
// CatUI
// ---------------------------------------------------------------------------
const uiImg = decodePng(join(ROOT, 'CatUserInterface', 'CatUI.png'));

// Os chips da folha vem com barras de vida e contador de moedas COZIDOS no
// miolo; o Catathon poe o proprio conteudo ali. Limpeza de kit: o interior
// vira a cor de fundo dominante (moldura e orelhas intactas).
const CLEAN_INTERIOR = new Set(['chip-cream', 'chip-pink', 'chip-blue']);
const cleanInterior = (img, x, y, w, h) => {
  const counts = new Map();
  for (let yy = y + 9; yy < y + h - 2; yy++) {
    for (let xx = x + 3; xx < x + w - 3; xx++) {
      const i = (yy * img.w + xx) * 4;
      if (img.rgba[i + 3] === 0) continue;
      const k = colorKey(img.rgba, i);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  let bg = ''; let bgN = -1;
  for (const [k, n] of counts) if (n > bgN) { bgN = n; bg = k; }
  const r = parseInt(bg.slice(0, 2), 16), g = parseInt(bg.slice(2, 4), 16), b = parseInt(bg.slice(4, 6), 16);
  for (let yy = y + 9; yy < y + h - 2; yy++) {
    for (let xx = x + 3; xx < x + w - 3; xx++) {
      const i = (yy * img.w + xx) * 4;
      if (img.rgba[i + 3] === 0) continue;
      img.rgba[i] = r; img.rgba[i + 1] = g; img.rgba[i + 2] = b;
    }
  }
};

const uiOut = {};
for (const [name, [x, y, w, h]] of Object.entries(UI_PIECES)) {
  if (CLEAN_INTERIOR.has(name)) cleanInterior(uiImg, x, y, w, h);
  const palette = [];
  const rows = indexRegion(uiImg, x, y, w, h, palette, `CatUI/${name}`);
  uiOut[name] = { w, h, palette, rows };
  console.log(`catui/${name}: ${w}x${h}, paleta ${palette.length}`);
}

writeFileSync(join(PKG, 'src', 'client', 'assets', 'catUi.ts'), `${header('Recortes de CatUserInterface/CatUI.png para o HUD.')}
export type CatUiPiece = { w: number; h: number; palette: string[]; rows: string[] };

export const CAT_UI: Record<string, CatUiPiece> = ${JSON.stringify(uiOut)};
`);

console.log('ok');
