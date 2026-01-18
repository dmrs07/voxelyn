import type { Surface2D } from "../../core/surface2d";

export type Sprite = {
  width: number;
  height: number;
  pixels: Uint32Array;
};

export type BlitOptions = {
  colorkey?: number;
  alphaThreshold?: number;
};

export function blitColorkey(
  dst: Surface2D,
  sprite: Sprite,
  dx: number,
  dy: number,
  options: BlitOptions = {}
): void {
  const cw = sprite.width | 0;
  const ch = sprite.height | 0;
  const colorkey = (options.colorkey ?? 0) >>> 0;
  const alphaThreshold = (options.alphaThreshold ?? 0) | 0;

  let sx0 = 0;
  let sy0 = 0;
  let sx1 = cw;
  let sy1 = ch;

  if (dx < 0) sx0 = -dx;
  if (dy < 0) sy0 = -dy;
  if (dx + cw > dst.width) sx1 = dst.width - dx;
  if (dy + ch > dst.height) sy1 = dst.height - dy;

  if (sx0 >= sx1 || sy0 >= sy1) return;

  const dp = dst.pixels;
  const sp = sprite.pixels;
  const dw = dst.width | 0;

  for (let sy = sy0; sy < sy1; sy++) {
    let di = (dy + sy) * dw + (dx + sx0);
    let si = sy * cw + sx0;
    for (let sx = sx0; sx < sx1; sx++) {
      const c = sp[si++];
      if (c !== colorkey) {
        if (alphaThreshold > 0) {
          const a = (c >>> 24) & 0xff;
          if (a <= alphaThreshold) {
            di++;
            continue;
          }
        }
        dp[di++] = c;
      } else {
        di++;
      }
    }
  }
}

export function blitColorkeyUnsafe(
  dst: Surface2D,
  sprite: Sprite,
  dx: number,
  dy: number,
  colorkey: number
): void {
  const cw = sprite.width | 0;
  const ch = sprite.height | 0;
  const ck = colorkey >>> 0;
  const dp = dst.pixels;
  const sp = sprite.pixels;
  const dw = dst.width | 0;

  for (let sy = 0; sy < ch; sy++) {
    let di = (dy + sy) * dw + dx;
    let si = sy * cw;
    for (let sx = 0; sx < cw; sx++) {
      const c = sp[si++];
      if (c !== ck) dp[di] = c;
      di++;
    }
  }
}
