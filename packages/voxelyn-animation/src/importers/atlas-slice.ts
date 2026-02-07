import type { AtlasSource, PixelSprite } from '../types.js';

export type AtlasFrameRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

const normalizeAtlasPixels = (atlas: AtlasSource): Uint32Array => {
  if ('pixels' in atlas) {
    return atlas.pixels;
  }

  const expected = atlas.width * atlas.height * 4;
  if (atlas.data.length < expected) {
    throw new Error('Atlas data insuficiente para dimensoes informadas');
  }

  const out = new Uint32Array(atlas.width * atlas.height);
  for (let i = 0, p = 0; i < out.length; i += 1, p += 4) {
    const r = atlas.data[p] ?? 0;
    const g = atlas.data[p + 1] ?? 0;
    const b = atlas.data[p + 2] ?? 0;
    const a = atlas.data[p + 3] ?? 0;
    out[i] = (r | (g << 8) | (b << 16) | (a << 24)) >>> 0;
  }
  return out;
};

export const sliceAtlasFrame = (
  atlas: AtlasSource,
  rect: AtlasFrameRect,
  out?: PixelSprite
): PixelSprite => {
  if (rect.w <= 0 || rect.h <= 0) {
    throw new Error('Frame invalido: largura/altura devem ser > 0');
  }
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > atlas.width || rect.y + rect.h > atlas.height) {
    throw new Error('Frame fora dos limites do atlas');
  }

  const pixels = normalizeAtlasPixels(atlas);
  const target: PixelSprite = out ?? {
    width: rect.w,
    height: rect.h,
    pixels: new Uint32Array(rect.w * rect.h),
  };

  if (target.width !== rect.w || target.height !== rect.h) {
    throw new Error('Sprite de saida nao corresponde ao tamanho do recorte');
  }

  for (let y = 0; y < rect.h; y += 1) {
    const srcRow = (rect.y + y) * atlas.width + rect.x;
    const dstRow = y * rect.w;
    for (let x = 0; x < rect.w; x += 1) {
      target.pixels[dstRow + x] = pixels[srcRow + x] ?? 0;
    }
  }

  return target;
};
