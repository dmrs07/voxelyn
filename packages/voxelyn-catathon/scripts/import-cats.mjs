#!/usr/bin/env node
/**
 * Importador do pack "Animated Cat Sprites" (girlypixels, itch.io) para um
 * modulo TS embutido no build.
 *
 * O repo e PUBLICO e a licenca do pack proibe redistribuicao, entao os PNGs
 * crus NUNCA entram no repo (docs/sprites/bundle-audit.md §1). Este script le
 * o pack de um diretorio local gitignorado e emite
 * `src/client/assets/catSprites.ts`: frames em formato indexado (paleta por
 * pelagem + indices por frame), uma representacao LOSSLESS verificada por
 * round-trip — pixels, silhuetas e timing originais preservados.
 *
 * uso:
 *   CATATHON_CAT_BUNDLE=<dir com cats/> node scripts/import-cats.mjs
 *   (default: <pacote>/assets-src — extraia o zip comprado ali)
 *
 * Fatia vertical atual: longhair (4 pelagens) com Walking(10) + Idle(5).
 * Ampliar = acrescentar em ANIMS e rodar de novo.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = resolve(process.env.CATATHON_CAT_BUNDLE ?? join(PKG, 'assets-src'));
const OUT = join(PKG, 'src', 'client', 'assets', 'catSprites.ts');

const BREED = 'longhair';
const COATS = ['orange tabby', 'blue', 'orange siamese', 'white'];
const ANIMS = [
  { key: 'walk', dir: 'Walking', gif: 'Walking.gif' },
  { key: 'idle', dir: 'Idle', gif: 'Idle.gif' },
];

// ---------------------------------------------------------------------------
// PNG minimal (8-bit, color types 0/2/3/4/6, sem entrelacamento) -> RGBA
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

// GIF: delays dos frames (1/100s) — o timing ORIGINAL do pack.
const gifDelays = (path) => {
  const d = readFileSync(path);
  const delays = [];
  for (let i = 0; i < d.length - 7; i++) {
    if (d[i] === 0x21 && d[i + 1] === 0xf9 && d[i + 2] === 0x04) {
      delays.push(d.readUInt16LE(i + 4));
    }
  }
  return delays;
};

const naturalPngs = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .sort((a, b) => {
      const na = Number(a.replace(/\D+/g, '')), nb = Number(b.replace(/\D+/g, ''));
      return na - nb;
    });

// ---------------------------------------------------------------------------
// Leitura + indexacao, POR PELAGEM (indices e paleta proprios).
// ---------------------------------------------------------------------------
const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const refCoat = COATS[0];
// A mascara de alpha e identica entre pelagens da mesma raca (auditoria §6),
// mas o recolor NAO e um mapa global de paleta — o siamese tem coloracao
// "point" (face/orelhas escuras), correspondencia espacial e nao 1:1. Entao
// cada pelagem guarda seus proprios indices + paleta propria.
const palettes = COATS.map(() => []); // [coatIdx] -> ['rrggbb', ...]
const animsOut = [];

const colorKey = (rgba, i) =>
  ((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]).toString(16).padStart(6, '0');

for (const anim of ANIMS) {
  const refDir = join(BUNDLE, 'cats', BREED, refCoat, anim.dir);
  const files = naturalPngs(refDir);
  if (files.length === 0) throw new Error(`sem frames em ${refDir}`);
  const perCoat = COATS.map((coat) =>
    files.map((f) => decodePng(join(BUNDLE, 'cats', BREED, coat, anim.dir, f))));
  const coatFrames = COATS.map(() => []);
  let maskDiffs = 0; // pelagens sao ~recolors, mas ha retoques pontuais

  for (let fi = 0; fi < files.length; fi++) {
    for (let ci = 0; ci < COATS.length; ci++) {
      const img = perCoat[ci][fi];
      const ref = perCoat[0][fi];
      const rows = [];
      for (let y = 0; y < img.h; y++) {
        let row = '';
        for (let x = 0; x < img.w; x++) {
          const i = (y * img.w + x) * 4;
          let alpha = img.rgba[i + 3];
          if (alpha !== 0 && alpha !== 255) {
            // cisco de autoria: Walking10 tem 1px orfao com alpha 33% e cor
            // fora de toda paleta (#585b6e), identico nas 4 pelagens. Alpha
            // <128 cai para transparente; nada no pack chega perto do limiar.
            console.warn(`aviso: alpha ${alpha} em ${files[fi]} (${x},${y}) -> ${alpha < 128 ? 'transparente' : 'opaco'}`);
            alpha = alpha < 128 ? 0 : 255;
          }
          if ((alpha === 0) !== (ref.rgba[i + 3] === 0)) maskDiffs++;
          if (alpha === 0) { row += '.'; continue; }
          const key = colorKey(img.rgba, i);
          let idx = palettes[ci].indexOf(key);
          if (idx === -1) {
            idx = palettes[ci].length;
            if (idx >= CHARS.length) throw new Error('paleta maior que o charset');
            palettes[ci].push(key);
          }
          row += CHARS[idx];
        }
        rows.push(row);
      }
      coatFrames[ci].push({ w: img.w, h: img.h, rows });
    }
  }

  // round-trip: reconstruir cada pelagem a partir de (indices, paleta) e
  // comparar com o RGBA original — lossless comprovado.
  for (let ci = 0; ci < COATS.length; ci++) {
    for (let fi = 0; fi < files.length; fi++) {
      const src = perCoat[ci][fi];
      for (let y = 0; y < src.h; y++) {
        for (let x = 0; x < src.w; x++) {
          const i = (y * src.w + x) * 4;
          const ch = coatFrames[ci][fi].rows[y][x];
          if (ch === '.') {
            if (src.rgba[i + 3] >= 128) throw new Error('round-trip: alpha');
          } else if (src.rgba[i + 3] < 128 || colorKey(src.rgba, i) !== palettes[ci][CHARS.indexOf(ch)]) {
            throw new Error('round-trip: cor');
          }
        }
      }
    }
  }

  if (maskDiffs > 0) console.warn(`aviso: ${anim.dir}: ${maskDiffs}px de mascara divergem entre pelagens (retoques da autora)`);
  const delays = gifDelays(join(BUNDLE, 'cats', BREED, refCoat, 'Gifs', anim.gif));
  if (delays.length !== files.length) {
    console.warn(`aviso: ${anim.gif} tem ${delays.length} delays para ${files.length} frames`);
  }
  animsOut.push({ key: anim.key, coatFrames, delays });
  console.log(`${anim.dir}: ${files.length} frames x ${COATS.length} pelagens, delays(1/100s)=${delays.join(',')}`);
}

// ---------------------------------------------------------------------------
// Emissao
// ---------------------------------------------------------------------------
const ts = `/**
 * GERADO por scripts/import-cats.mjs — NAO editar a mao, NAO redesenhar.
 *
 * Fonte: pack "Animated Cat Sprites" de girlypixels
 * (https://girlypixels.itch.io/animated-cat-sprites), raca ${BREED}.
 * Representacao indexada LOSSLESS dos frames originais (round-trip verificado
 * no importador): cada char de \`rows\` indexa a paleta da pelagem, '.' e
 * transparente. \`delays\` sao os delays originais dos GIFs em 1/100s.
 * Indices por pelagem: o recolor do pack nao e mapa global de paleta (o
 * siamese tem coloracao point), so a mascara de alpha e compartilhada.
 *
 * Licenca do pack: uso comercial e modificacao permitidos; redistribuicao
 * proibida — por isso os PNGs crus nao vivem neste repo publico e este modulo
 * existe apenas para embutir os sprites no BUILD do jogo
 * (docs/sprites/bundle-audit.md §1, docs/sprites/LICENSE-cats.md).
 */

export type CatAnimKey = ${ANIMS.map((a) => `'${a.key}'`).join(' | ')};

export type CatFrame = { w: number; h: number; rows: string[] };

export const CAT_COATS = ${JSON.stringify(COATS)} as const;

/** Paleta por pelagem: hex rrggbb na ordem dos indices dos frames. */
export const CAT_PALETTES: string[][] = ${JSON.stringify(palettes)};

/** [anim][pelagem] -> frames; delays por anim (1/100s, dos GIFs originais). */
export const CAT_ANIMS: Record<CatAnimKey, { delays: number[]; coats: CatFrame[][] }> = {
${animsOut
  .map(
    (a) =>
      `  ${a.key}: {\n    delays: ${JSON.stringify(a.delays)},\n    coats: [\n${a.coatFrames
        .map(
          (frames) =>
            `      [\n${frames
              .map(
                (f) =>
                  `        { w: ${f.w}, h: ${f.h}, rows: [\n${f.rows
                    .map((r) => `          '${r}',`)
                    .join('\n')}\n        ] },`,
              )
              .join('\n')}\n      ],`,
        )
        .join('\n')}\n    ],\n  },`,
  )
  .join('\n')}
};
`;
writeFileSync(OUT, ts);
console.log(`ok ${OUT} (${(ts.length / 1024).toFixed(1)} KiB, ${COATS.length} pelagens)`);
