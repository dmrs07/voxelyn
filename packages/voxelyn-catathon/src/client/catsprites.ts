import { packRGBA } from '@voxelyn/core';
import { TICK_MS } from '../sim/index.js';
import { CAT_ANIMS, CAT_PALETTES, type CatAnimKey } from './assets/catSprites.js';

/**
 * Runtime dos sprites do pack girlypixels (ver assets/catSprites.ts): decodifica
 * o formato indexado UMA vez para arrays de cor empacotada e responde "qual
 * frame agora?" em funcao do tick da simulacao — deterministico, display-only.
 *
 * O timing respeita os delays ORIGINAIS dos GIFs do pack: cada frame vira um
 * numero inteiro de ticks (TICK_HZ=30, delay tipico 100ms = 3 ticks) e a
 * timeline e um lookup pre-computado.
 */

export type SpriteFrame = {
  w: number;
  h: number;
  /** cor empacotada (ABGR) por pixel; 0 = transparente. */
  data: Uint32Array;
};

type AnimRuntime = {
  /** [pelagem][frame] */
  coats: SpriteFrame[][];
  /** tick-do-ciclo -> indice do frame */
  timeline: Uint16Array;
};

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

const buildAnim = (key: CatAnimKey): AnimRuntime => {
  const anim = CAT_ANIMS[key];
  const coats = anim.coats.map((frames, coatIdx) => {
    const palette = CAT_PALETTES[coatIdx]!.map((hexColor) => {
      const value = parseInt(hexColor, 16);
      return packRGBA((value >> 16) & 255, (value >> 8) & 255, value & 255);
    });
    return frames.map((frame) => {
      const data = new Uint32Array(frame.w * frame.h);
      frame.rows.forEach((row, y) => {
        for (let x = 0; x < frame.w; x++) {
          const ch = row[x]!;
          if (ch !== '.') data[y * frame.w + x] = palette[CHARS.indexOf(ch)]!;
        }
      });
      return { w: frame.w, h: frame.h, data };
    });
  });
  const perFrameTicks = anim.delays.map((d) => Math.max(1, Math.round((d * 10) / TICK_MS)));
  const total = perFrameTicks.reduce((a, b) => a + b, 0);
  const timeline = new Uint16Array(total);
  let at = 0;
  perFrameTicks.forEach((ticks, frameIdx) => {
    timeline.fill(frameIdx, at, at + ticks);
    at += ticks;
  });
  return { coats, timeline };
};

const ANIMS: Record<CatAnimKey, AnimRuntime> = {
  walk: buildAnim('walk'),
  idle: buildAnim('idle'),
};

/** Frame corrente de uma animacao para um tick da simulacao. */
export const spriteFrame = (key: CatAnimKey, coatIdx: number, tick: number): SpriteFrame => {
  const anim = ANIMS[key];
  const frames = anim.coats[coatIdx % anim.coats.length]!;
  return frames[anim.timeline[tick % anim.timeline.length]!]!;
};

/**
 * Cor de corpo dominante de cada pelagem do pack (indice de paleta mais
 * frequente no Idle1, ignorando o contorno escuro) — a ponte entre a pelagem
 * GERADA do gato e a pelagem comprada mais parecida.
 */
const coatBody: [number, number, number][] = CAT_ANIMS.idle.coats.map((frames, ci) => {
  const counts = new Map<string, number>();
  const first = frames[0]!;
  for (const row of first.rows) {
    for (const ch of row) if (ch !== '.') counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  let best = '';
  let bestCount = -1;
  for (const [ch, n] of counts) {
    const hexColor = CAT_PALETTES[ci]![CHARS.indexOf(ch)]!;
    const value = parseInt(hexColor, 16);
    const lum = ((value >> 16) & 255) + ((value >> 8) & 255) + (value & 255);
    if (lum < 150) continue; // contorno/sombra nao representam a pelagem
    if (n > bestCount) { bestCount = n; best = hexColor; }
  }
  const value = parseInt(best, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
});

/** Pelagem do pack mais proxima da cor de corpo GERADA do gato (0xRRGGBB). */
export const coatIndexFor = (body: number): number => {
  const r = (body >> 16) & 255;
  const g = (body >> 8) & 255;
  const b = body & 255;
  let best = 0;
  let bestDist = Infinity;
  for (let ci = 0; ci < coatBody.length; ci++) {
    const [cr, cg, cb] = coatBody[ci]!;
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestDist) { bestDist = d; best = ci; }
  }
  return best;
};
