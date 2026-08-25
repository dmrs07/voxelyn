import { describe, expect, it } from 'vitest';
import { packRGBA } from '@voxelyn/core';
import { heldFrame, lookFor, packFrame, type CatLook } from './catsprites.js';
import { CAT_SPRITES, type CatAnimKey } from './assets/catSprites.js';

/**
 * Regressao do cracha: em poses onde a cabeca se conecta ao dorso (sentado,
 * frames de caminhada), a banda do colar ancorada no olho chegou a
 * atravessar o corpo inteiro. A banda deve viver SO na zona do pescoco.
 */

const packRgb = (rgb: number): number =>
  packRGBA((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255);
const darkRgb = (rgb: number): number =>
  packRGBA((((rgb >> 16) & 255) * 0.62) | 0, (((rgb >> 8) & 255) * 0.62) | 0, ((rgb & 255) * 0.62) | 0);

// ciano do frontend: nenhuma pelagem do pack usa esta cor
const COLLAR = 0x54c6d4;
const MAIN = packRgb(COLLAR);
const DARK = darkRgb(COLLAR);

const collarSpan = (data: Uint32Array, w: number, h: number): number => {
  let x0 = Infinity;
  let x1 = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const color = data[y * w + x]!;
      if (color === MAIN || color === DARK) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
    }
  }
  return x1 < x0 ? 0 : x1 - x0 + 1;
};

const LONGHAIR = 1;
const ANIMS: CatAnimKey[] = ['idle', 'walk', 'run', 'sleep', 'sit', 'sitturn', 'crouch', 'hiss', 'attack', 'swat', 'turn'];

describe('cracha (colar por trilha)', () => {
  it('a banda dos longhair nunca atravessa o corpo — no maximo a largura do pescoco', () => {
    for (let coat = 0; coat < CAT_SPRITES[LONGHAIR]!.coats.length; coat++) {
      const look: CatLook = { breed: LONGHAIR, coat };
      for (const anim of ANIMS) {
        const total = CAT_SPRITES[LONGHAIR]!.anims[anim].coats[coat]!.length;
        for (let fi = 0; fi < Math.max(1, total); fi++) {
          // tick*97 percorre a timeline o bastante para visitar cada frame
          const frame = packFrame(look, anim, fi * 97, COLLAR);
          const span = collarSpan(frame.data, frame.w, frame.h);
          // zona do pescoco = [ex-6, ex+1] (8 colunas) + credencial (1 alem)
          expect(span, `${CAT_SPRITES[LONGHAIR]!.coats[coat]}/${anim} frame~${fi}`).toBeLessThanOrEqual(9);
        }
      }
    }
  });

  it('a banda existe onde o olho esta visivel (idle dos longhair)', () => {
    for (let coat = 0; coat < CAT_SPRITES[LONGHAIR]!.coats.length; coat++) {
      const frame = packFrame({ breed: LONGHAIR, coat }, 'idle', 0, COLLAR);
      expect(collarSpan(frame.data, frame.w, frame.h)).toBeGreaterThanOrEqual(4);
    }
  });

  it('pelagens com colar proprio ganham o remap sem vazar pela silhueta', () => {
    // tuxedo (shorthair) em todos os frames de walk/sit
    const look = lookFor(0x2c2a32, 'tuxedo', false);
    for (const anim of ['walk', 'sit'] as CatAnimKey[]) {
      for (let fi = 0; fi < 12; fi++) {
        const frame = packFrame(look, anim, fi * 97, COLLAR);
        expect(collarSpan(frame.data, frame.w, frame.h)).toBeLessThanOrEqual(10);
      }
    }
    expect(collarSpan(heldFrame(look, COLLAR).data, 32, 32)).toBeLessThanOrEqual(10);
  });
});
