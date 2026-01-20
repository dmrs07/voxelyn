/**
 * VoxelForge Editor - Surface Rendering
 */

import { createSurface2D } from '@voxelyn/core';
import type { EditorDocument, GridLayer, LayerId } from '../document/types';

const unpack = (color: number) => ({
  r: color & 0xff,
  g: (color >> 8) & 0xff,
  b: (color >> 16) & 0xff,
  a: (color >> 24) & 0xff,
});

const pack = (r: number, g: number, b: number, a: number): number =>
  ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);

const blend = (dst: number, src: number, opacity: number): number => {
  const d = unpack(dst);
  const s = unpack(src);

  const sa = (s.a / 255) * opacity;
  const da = d.a / 255;
  const outA = sa + da * (1 - sa);

  if (outA <= 0) return 0;

  const outR = Math.round((s.r * sa + d.r * da * (1 - sa)) / outA);
  const outG = Math.round((s.g * sa + d.g * da * (1 - sa)) / outA);
  const outB = Math.round((s.b * sa + d.b * da * (1 - sa)) / outA);
  const outAlpha = Math.round(outA * 255);

  return pack(outR, outG, outB, outAlpha) >>> 0;
};

export const renderDocumentToSurface = (
  doc: EditorDocument,
  pendingPixels: Array<{ index: number; oldValue: number; newValue: number }>,
  activeLayerId: LayerId | null,
  isDrawing: boolean
) => {
  const surface = createSurface2D(doc.width, doc.height);
  const pixels = surface.pixels;

  const pendingMap = new Map<number, number>();
  if (isDrawing && activeLayerId && pendingPixels.length > 0) {
    for (const px of pendingPixels) {
      pendingMap.set(px.index, px.newValue);
    }
  }

  for (const layer of doc.layers) {
    if (!layer.visible || layer.type !== 'grid2d') continue;
    const grid = layer as GridLayer;
    const opacity = Math.max(0, Math.min(1, layer.opacity));

    for (let y = 0; y < grid.height; y += 1) {
      const rowOffset = y * grid.width;
      const surfaceOffset = y * surface.width;
      for (let x = 0; x < grid.width; x += 1) {
        const index = rowOffset + x;
        let cell = grid.data[index];

        if (layer.id === activeLayerId && pendingMap.has(index)) {
          cell = pendingMap.get(index) ?? cell;
        }

        const mat = cell & 0xff;
        if (mat === 0) continue;

        const material = doc.palette[mat];
        if (!material) continue;

        const srcColor = material.color >>> 0;
        const dstColor = pixels[surfaceOffset + x] ?? 0;
        pixels[surfaceOffset + x] = blend(dstColor, srcColor, opacity);
      }
    }
  }

  return surface;
};
