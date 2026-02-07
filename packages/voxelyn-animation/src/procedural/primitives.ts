import type { PixelSprite } from '../types.js';

export const clearSprite = (sprite: PixelSprite, color = 0): void => {
  sprite.pixels.fill(color >>> 0);
};

export const plot = (sprite: PixelSprite, x: number, y: number, color: number): void => {
  const px = x | 0;
  const py = y | 0;
  if (px < 0 || py < 0 || px >= sprite.width || py >= sprite.height) return;
  sprite.pixels[py * sprite.width + px] = color >>> 0;
};

export const fillRect = (
  sprite: PixelSprite,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number
): void => {
  const x0 = Math.max(0, x | 0);
  const y0 = Math.max(0, y | 0);
  const x1 = Math.min(sprite.width, (x + w) | 0);
  const y1 = Math.min(sprite.height, (y + h) | 0);
  if (x0 >= x1 || y0 >= y1) return;

  const c = color >>> 0;
  for (let yy = y0; yy < y1; yy += 1) {
    let i = yy * sprite.width + x0;
    for (let xx = x0; xx < x1; xx += 1) {
      sprite.pixels[i++] = c;
    }
  }
};

export const drawLine = (
  sprite: PixelSprite,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: number
): void => {
  let ax = x0 | 0;
  let ay = y0 | 0;
  const bx = x1 | 0;
  const by = y1 | 0;
  const dx = Math.abs(bx - ax);
  const sx = ax < bx ? 1 : -1;
  const dy = -Math.abs(by - ay);
  const sy = ay < by ? 1 : -1;
  let err = dx + dy;

  while (true) {
    plot(sprite, ax, ay, color);
    if (ax === bx && ay === by) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      ax += sx;
    }
    if (e2 <= dx) {
      err += dx;
      ay += sy;
    }
  }
};

export const fillCircle = (
  sprite: PixelSprite,
  cx: number,
  cy: number,
  radius: number,
  color: number
): void => {
  const r = Math.max(0, radius | 0);
  for (let y = -r; y <= r; y += 1) {
    for (let x = -r; x <= r; x += 1) {
      if (x * x + y * y <= r * r) {
        plot(sprite, cx + x, cy + y, color);
      }
    }
  }
};

export const mirrorHorizontal = (
  sprite: PixelSprite,
  source: PixelSprite
): void => {
  if (sprite.width !== source.width || sprite.height !== source.height) {
    throw new Error('mirrorHorizontal requer sprites com mesmas dimensoes');
  }

  const w = source.width;
  for (let y = 0; y < source.height; y += 1) {
    const row = y * w;
    for (let x = 0; x < w; x += 1) {
      sprite.pixels[row + (w - 1 - x)] = source.pixels[row + x] ?? 0;
    }
  }
};

export const copySprite = (out: PixelSprite, src: PixelSprite): void => {
  if (out.width !== src.width || out.height !== src.height) {
    throw new Error('copySprite requer sprites com mesmas dimensoes');
  }
  out.pixels.set(src.pixels);
};
