import { packRGBA } from '@voxelyn/core';
import { TICK_MS } from '../sim/index.js';
import type { CoatPattern } from '../sim/types.js';
import { CAT_SPRITES, type CatAnimKey } from './assets/catSprites.js';

/**
 * Runtime dos sprites do pack girlypixels (ver assets/catSprites.ts):
 * decodifica o formato indexado sob demanda para arrays de cor empacotada e
 * responde "qual frame agora?" em funcao do tick da simulacao —
 * deterministico, display-only, nunca no hash.
 *
 * - O timing respeita os delays ORIGINAIS dos GIFs (TICK_HZ=30; 100ms = 3
 *   ticks), com timeline pre-computada por (raca, animacao).
 * - Cada gato GERADO do jogo e mapeado para uma (raca, pelagem) do pack por
 *   padrao (tabby/point/tuxedo/solid) + cor dominante mais proxima.
 * - shorthair/grey_tabby e RESERVADO ao PM, que ganha o figurino (oculos +
 *   colarinho/gravata) como OVERLAY baked por deteccao de olho/colar — os
 *   frames originais nunca sao alterados, o overlay vive em copias.
 */

export type SpriteFrame = {
  w: number;
  h: number;
  /** cor empacotada (ABGR) por pixel; 0 = transparente. */
  data: Uint32Array;
};

export type CatLook = { breed: number; coat: number };

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

// ---------------------------------------------------------------------------
// Decodificacao preguicosa + timelines
// ---------------------------------------------------------------------------
const frameCache = new Map<string, SpriteFrame[]>();

/**
 * CRACHA por trilha: o colar do proprio sprite vira a cor da especialidade.
 * Tres mecanismos por pelagem (docs/sprites/bundle-audit.md):
 * - own: a pelagem tem colar -> remap de paleta (cor principal -> spec,
 *   secundaria -> spec escurecida); o guizo dourado fica.
 * - donor: sem colar, mas uma irma de raca tem (mascaras ~identicas) ->
 *   pinta o spec nas POSICOES do colar da doadora, frame a frame.
 * - eye: raca sem colar nenhum (longhair) -> faixa ancorada no olho
 *   (cores exclusivas por pelagem), so em frames com olho visivel.
 */
type CollarSpec = { own?: string[]; donor?: number; eye?: string[] };
const COLLARS: CollarSpec[][] = [
  // bobtail: black and white, brown tabby, mekong, orange spotted
  [{ own: ['e6482e', 'a93b3b'] }, { own: ['394778'] }, { donor: 0 }, { donor: 0 }],
  // longhair: blue, orange siamese, orange tabby, white
  [{ eye: ['fcdf9b'] }, { eye: ['dff6f5'] }, { eye: ['f47e1b'] }, { eye: ['71aa34'] }],
  // shorthair: abyssinian, grey_tabby (PM), siamese, tuxedo
  [{ own: ['f26d8c'] }, { own: ['165a4c'] }, { own: ['564064'] }, { own: ['39314b'] }],
];
const BELL_HEX = 'f4b41b';

const packHex = (hexColor: string): number => {
  const value = parseInt(hexColor, 16);
  return packRGBA((value >> 16) & 255, (value >> 8) & 255, value & 255);
};
const packRgb = (rgb: number): number =>
  packRGBA((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255);
const darkRgb = (rgb: number): number =>
  packRGBA((((rgb >> 16) & 255) * 0.62) | 0, (((rgb >> 8) & 255) * 0.62) | 0, ((rgb & 255) * 0.62) | 0);

/** collar = 0xRRGGBB da trilha; ausente = cores originais do pack. */
const decode = (breed: number, key: CatAnimKey, coat: number, collar?: number): SpriteFrame[] => {
  const id = `${breed}:${key}:${coat}:${collar ?? -1}`;
  const hit = frameCache.get(id);
  if (hit) return hit;
  const spec = CAT_SPRITES[breed]!;
  const collarSpec = collar === undefined ? null : COLLARS[breed]![coat]!;
  const palette = spec.palettes[coat]!.map((hexColor) => {
    if (collarSpec?.own && collar !== undefined) {
      const at = collarSpec.own.indexOf(hexColor);
      if (at === 0) return packRgb(collar);
      if (at > 0) return darkRgb(collar);
    }
    return packHex(hexColor);
  });
  const frames = spec.anims[key].coats[coat]!.map((frame) => {
    const data = new Uint32Array(frame.w * frame.h);
    frame.rows.forEach((row, y) => {
      for (let x = 0; x < frame.w; x++) {
        const ch = row[x]!;
        if (ch !== '.') data[y * frame.w + x] = palette[CHARS.indexOf(ch)]!;
      }
    });
    return { w: frame.w, h: frame.h, data };
  });
  if (collarSpec && collar !== undefined && collarSpec.donor !== undefined) {
    // pinta o colar nas posicoes da pelagem doadora (mesma raca); onde a
    // doadora tem o GUIZO, esta pelagem ganha a credencial
    const donorCoat = collarSpec.donor;
    const donorColors = COLLARS[breed]![donorCoat]!.own!;
    const main = packHex(donorColors[0]!);
    const dark = donorColors[1] !== undefined ? packHex(donorColors[1]) : 0;
    const bell = packHex(BELL_HEX);
    const donorFrames = decode(breed, key, donorCoat);
    frames.forEach((frame, fi) => {
      const donor = donorFrames[fi];
      if (!donor || donor.w !== frame.w || donor.h !== frame.h) return;
      let bx = -1, by = 0;
      for (let i = 0; i < frame.data.length; i++) {
        const d = donor.data[i]!;
        if (d === bell) {
          const x = i % frame.w;
          if (x > bx) { bx = x; by = (i / frame.w) | 0; }
          continue;
        }
        if (frame.data[i] === 0) continue;
        if (d === main) frame.data[i] = packRgb(collar);
        else if (dark !== 0 && d === dark) frame.data[i] = darkRgb(collar);
      }
      if (bx >= 0) badgeCard(frame, bx, by, collar);
    });
  }
  if (collarSpec?.own && collar !== undefined) {
    // o GUIZO do colar original vira a CREDENCIAL pendurada
    for (const frame of frames) {
      const bell = packHex(BELL_HEX);
      let bx = -1, by = 0;
      for (let i = 0; i < frame.data.length; i++) {
        if (frame.data[i] === bell) {
          const x = i % frame.w;
          if (x > bx) { bx = x; by = (i / frame.w) | 0; }
        }
      }
      if (bx >= 0) badgeCard(frame, bx, by, collar);
    }
  }
  if (collarSpec?.eye && collar !== undefined) {
    // faixa de colar ancorada no olho (longhair nao tem colar no pack)
    const eyes = collarSpec.eye.map(packHex);
    for (const frame of frames) {
      let ex = 0, ey = 0, en = 0;
      for (let y = 0; y < frame.h; y++) {
        for (let x = 0; x < frame.w; x++) {
          if (eyes.includes(frame.data[y * frame.w + x]!)) { ex += x; ey += y; en++; }
        }
      }
      if (en === 0) continue; // olho fechado/oculto: cracha coberto pelo pelo
      ex = Math.round(ex / en); ey = Math.round(ey / en);
      const put = (x: number, y: number, color: number) => {
        const i = y * frame.w + x;
        if (x >= 0 && y >= 0 && x < frame.w && y < frame.h && frame.data[i] !== 0) frame.data[i] = color;
      };
      for (let dx = -4; dx <= -1; dx++) put(ex + dx, ey + 4, packRgb(collar));
      for (let dx = -4; dx <= -2; dx++) put(ex + dx, ey + 5, darkRgb(collar));
      badgeCard(frame, ex - 1, ey + 6, collar);
    }
  }
  frameCache.set(id, frames);
  return frames;
};

const CARD = packRGBA(242, 230, 204);
const CARD_EDGE = packRGBA(198, 184, 158);

/**
 * A CREDENCIAL do cracha original: cartaozinho creme pendurado no colar com
 * o ponto da cor da trilha. Desenha SEM mascara — um cracha pendura e pode
 * sair 1px da silhueta, como qualquer coisa dependurada num gato.
 */
const badgeCard = (frame: SpriteFrame, bx: number, by: number, collar: number): void => {
  const put = (x: number, y: number, color: number) => {
    if (x >= 0 && y >= 0 && x < frame.w && y < frame.h) frame.data[y * frame.w + x] = color;
  };
  put(bx - 1, by, CARD);
  put(bx, by, CARD);
  put(bx + 1, by, CARD);
  put(bx - 1, by + 1, CARD_EDGE);
  put(bx, by + 1, packRgb(collar));
  put(bx + 1, by + 1, CARD_EDGE);
};

const timelineCache = new Map<string, Uint16Array>();

const timeline = (breed: number, key: CatAnimKey): Uint16Array => {
  const id = `${breed}:${key}`;
  const hit = timelineCache.get(id);
  if (hit) return hit;
  const delays = CAT_SPRITES[breed]!.anims[key].delays;
  const perFrame = delays.map((d) => Math.max(1, Math.round((d * 10) / TICK_MS)));
  const total = perFrame.reduce((a, b) => a + b, 0);
  const line = new Uint16Array(Math.max(1, total));
  let at = 0;
  perFrame.forEach((ticks, frameIdx) => {
    line.fill(frameIdx, at, at + ticks);
    at += ticks;
  });
  timelineCache.set(id, line);
  return line;
};

/**
 * Frame corrente. Fallback de aproximacao: pelagem sem a animacao (unico
 * caso real: bobtail/mekong sem Hissing) cai para `attack`.
 */
export const packFrame = (look: CatLook, key: CatAnimKey, tick: number, collar?: number): SpriteFrame => {
  let frames = decode(look.breed, key, look.coat, collar);
  if (frames.length === 0) {
    key = 'attack';
    frames = decode(look.breed, key, look.coat, collar);
  }
  const line = timeline(look.breed, key);
  return frames[line[tick % line.length]! % frames.length]!;
};

/** Pose de carregado: o frame FRONTAL do Turning (gato encarando a mao). */
export const heldFrame = (look: CatLook, collar?: number): SpriteFrame => {
  const frames = decode(look.breed, 'turn', look.coat, collar);
  return frames[frames.length >> 1]!;
};

// ---------------------------------------------------------------------------
// Gato gerado -> (raca, pelagem) do pack
// ---------------------------------------------------------------------------
type Category = 'tabby' | 'point' | 'tuxedo' | 'solid';

/** Categoria visual de cada pelagem, na ordem de CAT_SPRITES. */
const COAT_CATEGORY: Category[][] = [
  ['tuxedo', 'tabby', 'point', 'tabby'], // bobtail: b&w, brown tabby, mekong, orange spotted
  ['solid', 'point', 'tabby', 'solid'], // longhair: blue, orange siamese, orange tabby, white
  ['tabby', 'tabby', 'point', 'tuxedo'], // shorthair: abyssinian, grey_tabby, siamese, tuxedo
];

/** O PM e o unico shorthair/grey_tabby do pavilhao. */
export const PM_LOOK: CatLook = { breed: 2, coat: 1 };

const PATTERN_PREF: Record<CoatPattern, Category[]> = {
  tabby: ['tabby'],
  siames: ['point'],
  tuxedo: ['tuxedo'],
  solid: ['solid'],
  sphynx: ['solid', 'point'], // nao ha sphynx no pack: o mais "liso" que houver
};

/** Cor de corpo dominante por pelagem (indice mais frequente do Idle1, sem contorno escuro). */
const coatBody: [number, number, number][][] = CAT_SPRITES.map((spec) =>
  spec.anims.idle.coats.map((frames, ci) => {
    const counts = new Map<string, number>();
    for (const row of frames[0]!.rows) {
      for (const ch of row) if (ch !== '.') counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    let best = '';
    let bestCount = -1;
    for (const [ch, n] of counts) {
      const hexColor = spec.palettes[ci]![CHARS.indexOf(ch)]!;
      const value = parseInt(hexColor, 16);
      const lum = ((value >> 16) & 255) + ((value >> 8) & 255) + (value & 255);
      if (lum < 150) continue; // contorno/sombra nao representam a pelagem
      if (n > bestCount) { bestCount = n; best = hexColor; }
    }
    const value = parseInt(best, 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }));

const lookCache = new Map<string, CatLook>();

/**
 * (raca, pelagem) do pack para um gato gerado: candidatos do mesmo padrao
 * visual, desempate por cor dominante mais proxima do `coat.body` gerado.
 * Gatos `big` puxam para longhair (a raca fofa do pack).
 */
export const lookFor = (body: number, pattern: CoatPattern, big: boolean): CatLook => {
  const id = `${body}:${pattern}:${big}`;
  const hit = lookCache.get(id);
  if (hit) return hit;
  const r = (body >> 16) & 255;
  const g = (body >> 8) & 255;
  const b = body & 255;
  const isPm = (bi: number, ci: number) => bi === PM_LOOK.breed && ci === PM_LOOK.coat;
  const candidates: { breed: number; coat: number; dist: number }[] = [];
  const collect = (want: Category | null) => {
    for (let bi = 0; bi < CAT_SPRITES.length; bi++) {
      for (let ci = 0; ci < CAT_SPRITES[bi]!.coats.length; ci++) {
        if (isPm(bi, ci)) continue;
        if (want !== null && COAT_CATEGORY[bi]![ci] !== want) continue;
        const [cr, cg, cb] = coatBody[bi]![ci]!;
        let dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
        if (big && CAT_SPRITES[bi]!.breed === 'longhair') dist *= 0.5;
        candidates.push({ breed: bi, coat: ci, dist });
      }
    }
  };
  for (const category of PATTERN_PREF[pattern]) {
    collect(category);
    if (candidates.length > 0) break;
  }
  if (candidates.length === 0) collect(null);
  candidates.sort((a, c) => a.dist - c.dist);
  const look = { breed: candidates[0]!.breed, coat: candidates[0]!.coat };
  lookCache.set(id, look);
  return look;
};

// ---------------------------------------------------------------------------
// PM: overlay de oculos + colarinho/gravata baked em COPIAS dos frames do
// grey_tabby, ancorado pelas cores exclusivas de olho e colar do proprio pack.
// ---------------------------------------------------------------------------
const EYE_A = packRGBA(0x71, 0xaa, 0x34);
const EYE_B = packRGBA(0xb6, 0xd5, 0x3c);
const COLLAR = packRGBA(0x16, 0x5a, 0x4c);
const INK = packRGBA(0x2f, 0x33, 0x40);
const GLINT = packRGBA(0xdf, 0xe8, 0xf2);
const TIE = packRGBA(0xc1, 0x44, 0x44);
const TIE_D = packRGBA(0x7e, 0x2f, 0x2f);
const SHIRT = packRGBA(0xee, 0xf1, 0xea);

const pmCache = new Map<CatAnimKey, SpriteFrame[]>();

const pmDecorate = (key: CatAnimKey): SpriteFrame[] => {
  const hit = pmCache.get(key);
  if (hit) return hit;
  let prev: { ex: number; ey: number } | null = null;
  const frames = decode(PM_LOOK.breed, key, PM_LOOK.coat).map((src) => {
    const data = src.data.slice();
    const put = (x: number, y: number, color: number) => {
      if (x >= 0 && y >= 0 && x < src.w && y < src.h) data[y * src.w + x] = color;
    };
    let ex = 0, ey = 0, en = 0, cx = -1, cy = 0;
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const color = src.data[y * src.w + x]!;
        if (color === EYE_A || color === EYE_B) { ex += x; ey += y; en++; }
        if (color === COLLAR && x > cx) { cx = x; cy = y; }
      }
    }
    if (en > 0) { ex = Math.round(ex / en); ey = Math.round(ey / en); prev = { ex, ey }; }
    else if (prev) { ex = prev.ex; ey = prev.ey; } // piscada: o oculos fica
    else { ex = -99; ey = -99; }
    // lente 3x3 COLADA no olho (aro de 1px, olho visivel) + haste curta
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const) {
      put(ex + dx, ey + dy, INK);
    }
    put(ex - 1, ey - 1, GLINT);
    put(ex - 2, ey - 1, INK); // haste
    if (cx >= 0) {
      // colarinho + gravata pendendo RETA para baixo do colar
      put(cx - 1, cy, SHIRT); put(cx - 3, cy, SHIRT);
      put(cx - 2, cy + 1, TIE_D); put(cx - 1, cy + 1, TIE_D); // no
      put(cx - 2, cy + 2, TIE); put(cx - 1, cy + 2, TIE);
      put(cx - 2, cy + 3, TIE); put(cx - 1, cy + 3, TIE);
      put(cx - 2, cy + 4, TIE_D); put(cx - 1, cy + 4, TIE);
      put(cx - 2, cy + 5, TIE_D);
    }
    return { w: src.w, h: src.h, data };
  });
  pmCache.set(key, frames);
  return frames;
};

/** Frame do PM (grey_tabby + figurino) para um tick. */
export const pmFrame = (key: CatAnimKey, tick: number): SpriteFrame => {
  const frames = pmDecorate(key);
  const line = timeline(PM_LOOK.breed, key);
  return frames[line[tick % line.length]! % frames.length]!;
};
