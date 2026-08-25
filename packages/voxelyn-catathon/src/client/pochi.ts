import { packRGBA } from '@voxelyn/core';
import { POCHI_ANIMS, type PochiAnimKey } from './assets/pochiSprites.js';
import type { SpriteFrame } from './catsprites.js';

/**
 * O PM e o Pochi — o chibi frontal 64px do CatMegaBundle, maior e mais
 * dramatico que o elenco (decisao de direcao de arte). O figurino (oculos +
 * gravata) e overlay Catathon baked em copias dos frames, ancorado nos
 * BRILHOS dos olhos: os unicos pixels #ffffff puros do sprite sao os olhos,
 * entao cada frame conta onde o rosto esta.
 *
 * Timeline: ticksPerFrame por animacao (o pack nao traz timing; a batida e
 * do Catathon, deterministica em 30 Hz).
 */

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const WHITE = packRGBA(255, 255, 255);
const INK = packRGBA(0x2f, 0x33, 0x40);
const GLINT = packRGBA(0xdf, 0xe8, 0xf2);
const TIE = packRGBA(0xc1, 0x44, 0x44);
const TIE_D = packRGBA(0x7e, 0x2f, 0x2f);

const cache = new Map<PochiAnimKey, SpriteFrame[]>();

const decorate = (key: PochiAnimKey): SpriteFrame[] => {
  const hit = cache.get(key);
  if (hit) return hit;
  const anim = POCHI_ANIMS[key];
  const palette = anim.palette.map((hexColor) => {
    const value = parseInt(hexColor, 16);
    return packRGBA((value >> 16) & 255, (value >> 8) & 255, value & 255);
  });
  let prev: { eyes: [number, number][]; ey: number } | null = null;
  const frames = anim.frames.map((rows) => {
    const w = rows[0]!.length;
    const h = rows.length;
    const data = new Uint32Array(w * h);
    rows.forEach((row, y) => {
      for (let x = 0; x < w; x++) {
        const ch = row[x]!;
        if (ch !== '.') data[y * w + x] = palette[CHARS.indexOf(ch)]!;
      }
    });
    const put = (x: number, y: number, color: number) => {
      if (x >= 0 && y >= 0 && x < w && y < h) data[y * w + x] = color;
    };
    // brilhos dos olhos: clusters de branco puro; lagrimas do cry tambem sao
    // claras, entao so contam os clusters na linha mais alta (olhos ficam
    // acima das bochechas).
    const clusters: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[y * w + x] !== WHITE) continue;
        let attached = false;
        for (const cl of clusters) {
          if (x >= cl.x0 - 2 && x <= cl.x1 + 2 && y >= cl.y0 - 2 && y <= cl.y1 + 2) {
            cl.x0 = Math.min(cl.x0, x); cl.x1 = Math.max(cl.x1, x);
            cl.y0 = Math.min(cl.y0, y); cl.y1 = Math.max(cl.y1, y);
            attached = true;
            break;
          }
        }
        if (!attached) clusters.push({ x0: x, x1: x, y0: y, y1: y });
      }
    }
    clusters.sort((a, b) => a.y0 - b.y0);
    const topY = clusters[0]?.y0 ?? -1;
    const eyes = clusters.filter((cl) => cl.y0 <= topY + 3).slice(0, 2)
      .map((cl) => [Math.round((cl.x0 + cl.x1) / 2), Math.round((cl.y0 + cl.y1) / 2)] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    let anchors = eyes.length > 0 ? { eyes, ey: Math.max(...eyes.map((e) => e[1])) } : prev;
    if (eyes.length > 0) prev = anchors;
    if (!anchors) return { w, h, data };
    // OCULOS: um aro por olho (5x4, o rosto do Pochi e largo) + ponte.
    for (const [ex, ey] of anchors.eyes) {
      for (let dx = -2; dx <= 2; dx++) { put(ex + dx, ey - 2, INK); put(ex + dx, ey + 2, INK); }
      for (let dy = -1; dy <= 1; dy++) { put(ex - 2, ey + dy, INK); put(ex + 2, ey + dy, INK); }
      put(ex - 1, ey - 1, GLINT);
    }
    if (anchors.eyes.length === 2) {
      const [[lx, ly], [rx]] = anchors.eyes as [[number, number], [number, number]];
      for (let x = lx + 3; x <= rx - 3; x++) put(x, ly - 1, INK); // ponte
    }
    // GRAVATA: pende do peito, centro entre os olhos.
    const cx = Math.round(anchors.eyes.reduce((s, e) => s + e[0], 0) / anchors.eyes.length);
    const ty = anchors.ey + 7;
    put(cx - 1, ty, TIE_D); put(cx, ty, TIE_D); // no
    for (let dy = 1; dy <= 3; dy++) { put(cx - 1, ty + dy, TIE); put(cx, ty + dy, TIE); }
    put(cx - 1, ty + 4, TIE_D); put(cx, ty + 4, TIE);
    put(cx - 1, ty + 5, TIE_D);
    return { w, h, data };
  });
  cache.set(key, frames);
  return frames;
};

/** Frame do PM para um tick da simulacao (display-only, fora do hash). */
export const pochiFrame = (key: PochiAnimKey, tick: number): SpriteFrame => {
  const anim = POCHI_ANIMS[key];
  const frames = decorate(key);
  return frames[((tick / anim.ticksPerFrame) | 0) % frames.length]!;
};
