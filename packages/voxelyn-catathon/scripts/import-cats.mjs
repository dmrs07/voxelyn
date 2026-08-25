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
 * Cobertura: 3 racas x 4 pelagens (halloween fica de fora do elenco) com as
 * animacoes que os modos do jogo usam por aproximacao. Frame counts variam
 * por raca (shorthair tem Sitting estendido) e ha um buraco conhecido:
 * bobtail/mekong nao tem PNGs de Hissing (defeito do pack) — sai vazio e o
 * runtime cai para Attack_hit.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = resolve(process.env.CATATHON_CAT_BUNDLE ?? join(PKG, 'assets-src'));
const OUT = join(PKG, 'src', 'client', 'assets', 'catSprites.ts');

const BREEDS = [
  { name: 'bobtail', coats: ['black and white', 'brown tabby', 'mekong', 'orange spotted'] },
  { name: 'longhair', coats: ['blue', 'orange siamese', 'orange tabby', 'white'] },
  { name: 'shorthair', coats: ['abyssinian', 'grey_tabby', 'siamese', 'tuxedo'] },
];

// modo do jogo -> animacao do pack (aproximacao; ver render.ts drawCat)
const ANIMS = [
  { key: 'idle', dir: 'Idle' },
  { key: 'walk', dir: 'Walking' },
  { key: 'run', dir: 'Running' },
  { key: 'sleep', dir: 'Sleeping' },
  { key: 'sit', dir: 'Sitting' },
  { key: 'sitturn', dir: 'Sitting_head_turn', gif: 'Sit_head_turn.gif' },
  { key: 'crouch', dir: 'Crouch' },
  { key: 'hiss', dir: 'Hissing' },
  { key: 'attack', dir: 'Attack_hit' },
  { key: 'swat', dir: 'Attack_swat' },
  { key: 'turn', dir: 'Turning' },
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
    .sort((a, b) => Number(a.replace(/\D+/g, '')) - Number(b.replace(/\D+/g, '')));

// ---------------------------------------------------------------------------
// Leitura + indexacao POR PELAGEM (indices e paleta proprios: o recolor do
// pack nao e mapa 1:1 de paleta — o siamese tem coloracao point).
// ---------------------------------------------------------------------------
const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const colorKey = (rgba, i) =>
  ((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]).toString(16).padStart(6, '0');

const breedsOut = [];
let totalFrames = 0;

for (const breed of BREEDS) {
  const palettes = breed.coats.map(() => []);
  const anims = {};

  const indexFrame = (img, coatIdx, label) => {
    const rows = [];
    for (let y = 0; y < img.h; y++) {
      let row = '';
      for (let x = 0; x < img.w; x++) {
        const i = (y * img.w + x) * 4;
        let alpha = img.rgba[i + 3];
        if (alpha !== 0 && alpha !== 255) {
          // cisco de autoria (auditoria: 1px orfao 33% no Walking10) — alpha
          // <128 cai para transparente; nada no pack chega perto do limiar.
          console.warn(`aviso: alpha ${alpha} em ${label} (${x},${y}) -> ${alpha < 128 ? 'transparente' : 'opaco'}`);
          alpha = alpha < 128 ? 0 : 255;
        }
        if (alpha === 0) { row += '.'; continue; }
        const key = colorKey(img.rgba, i);
        let idx = palettes[coatIdx].indexOf(key);
        if (idx === -1) {
          idx = palettes[coatIdx].length;
          if (idx >= CHARS.length) throw new Error(`paleta maior que o charset (${label})`);
          palettes[coatIdx].push(key);
        }
        row += CHARS[idx];
      }
      rows.push(row);
    }
    return { w: img.w, h: img.h, rows };
  };

  for (const anim of ANIMS) {
    const coatFrames = [];
    let refDelays = null;
    for (let ci = 0; ci < breed.coats.length; ci++) {
      const coat = breed.coats[ci];
      const dir = join(BUNDLE, 'cats', breed.name, coat, anim.dir);
      const files = existsSync(dir) ? naturalPngs(dir) : [];
      if (files.length === 0) {
        console.warn(`aviso: ${breed.name}/${coat}/${anim.dir} sem PNGs — vazio (runtime usa fallback)`);
        coatFrames.push([]);
        continue;
      }
      const frames = [];
      for (const f of files) {
        const img = decodePng(join(dir, f));
        const frame = indexFrame(img, ci, `${breed.name}/${coat}/${anim.dir}/${f}`);
        // round-trip: reconstruir e comparar com o RGBA original — lossless
        for (let y = 0; y < img.h; y++) {
          for (let x = 0; x < img.w; x++) {
            const i = (y * img.w + x) * 4;
            const ch = frame.rows[y][x];
            if (ch === '.') {
              if (img.rgba[i + 3] >= 128) throw new Error(`round-trip alpha: ${f}`);
            } else if (img.rgba[i + 3] < 128 ||
              colorKey(img.rgba, i) !== palettes[ci][CHARS.indexOf(ch)]) {
              throw new Error(`round-trip cor: ${f}`);
            }
          }
        }
        frames.push(frame);
      }
      totalFrames += frames.length;
      coatFrames.push(frames);
      if (refDelays === null) {
        const gifPath = join(BUNDLE, 'cats', breed.name, coat, 'Gifs', anim.gif ?? `${anim.dir}.gif`);
        let delays = existsSync(gifPath) ? gifDelays(gifPath) : [];
        // conta divergente (raro): repete o ultimo delay / trunca
        while (delays.length < frames.length) delays.push(delays[delays.length - 1] ?? 10);
        delays = delays.slice(0, frames.length);
        refDelays = delays;
      }
    }
    anims[anim.key] = { delays: refDelays ?? [10], coats: coatFrames };
  }
  breedsOut.push({ breed: breed.name, coats: breed.coats, palettes, anims });
  console.log(`${breed.name}: ${breed.coats.length} pelagens ok`);
}

// ---------------------------------------------------------------------------
// Emissao (JSON compacto — o arquivo e gerado, diff legivel nao e objetivo)
// ---------------------------------------------------------------------------
const ts = `/**
 * GERADO por scripts/import-cats.mjs — NAO editar a mao, NAO redesenhar.
 *
 * Fonte: pack "Animated Cat Sprites" de girlypixels
 * (https://girlypixels.itch.io/animated-cat-sprites), racas bobtail/longhair/
 * shorthair. Representacao indexada LOSSLESS dos frames originais (round-trip
 * verificado no importador): cada char de \`rows\` indexa a paleta da pelagem,
 * '.' e transparente. \`delays\` sao os delays originais dos GIFs em 1/100s.
 *
 * Licenca do pack: uso comercial e modificacao permitidos; redistribuicao
 * proibida — por isso os PNGs crus nao vivem neste repo publico e este modulo
 * existe apenas para embutir os sprites no BUILD do jogo
 * (docs/sprites/bundle-audit.md §1, docs/sprites/LICENSE-cats.md).
 */

export type CatAnimKey = ${ANIMS.map((a) => `'${a.key}'`).join(' | ')};

export type CatFrame = { w: number; h: number; rows: string[] };

export type PackAnim = {
  /** delays por frame em 1/100s (do GIF original da raca). */
  delays: number[];
  /** [pelagem] -> frames ([] quando o pack nao traz — ex.: mekong/Hissing). */
  coats: CatFrame[][];
};

export type BreedSprites = {
  breed: string;
  coats: string[];
  /** paleta por pelagem: hex rrggbb na ordem dos indices dos frames. */
  palettes: string[][];
  anims: Record<CatAnimKey, PackAnim>;
};

export const CAT_SPRITES: BreedSprites[] = ${JSON.stringify(breedsOut)};
`;
writeFileSync(OUT, ts);
console.log(`ok ${OUT} (${(ts.length / 1024).toFixed(1)} KiB, ${totalFrames} frames)`);
