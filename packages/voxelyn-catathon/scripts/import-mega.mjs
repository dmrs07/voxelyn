#!/usr/bin/env node
/**
 * Importador do CatMegaBundle (segundo pack comprado) para modulos TS
 * embutidos no build — mesma politica do pack girlypixels: o repo e publico,
 * os arquivos crus do pack NUNCA entram nele (docs/sprites/LICENSE-cats.md).
 *
 * Emite src/client/assets/catUi.ts — recortes da folha
 * CatUserInterface/CatUI.png para o HUD, cada peca no papel que a autora
 * desenhou: PILULAS em branco para chips informativos, botoes redondos para
 * acoes, baloes para o feed. O cartao de PERFIL (orelhas + barras + moeda)
 * fica reservado para retratos — nunca vira fundo de chip.
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

// Recortes da CatUI.png — caixas medidas por scan de componentes conexos.
const UI_PIECES = {
  // pilulas EM BRANCO (fundos de chip): azulada, tan, marrom, rosada
  'pill-blue': [0, 736, 48, 16],
  'pill-tan': [128, 736, 48, 16],
  'pill-brown': [0, 768, 48, 16],
  'pill-rose': [128, 768, 48, 16],
  // botoes redondos (claro/escuro, com estado pressionado)
  'btn-light': [33, 257, 14, 14],
  'btn-light-on': [49, 258, 14, 13],
  'btn-mid': [129, 257, 14, 14],
  'btn-mid-on': [145, 258, 14, 13],
  // decoracao/icones
  paw: [377, 153, 35, 30],
  fish: [470, 195, 20, 11],
  'bubble-cream': [454, 584, 21, 18],
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
// CatUI
// ---------------------------------------------------------------------------
const uiImg = decodePng(join(ROOT, 'CatUserInterface', 'CatUI.png'));

const uiOut = {};
for (const [name, [x, y, w, h]] of Object.entries(UI_PIECES)) {
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
