/**
 * VoxelForge Editor - Surface Rendering
 */

import { createSurface2D } from '@voxelyn/core';
import type { EditorDocument, GridLayer, LayerId, BlendMode } from '../document/types';

const unpack = (color: number) => ({
  r: color & 0xff,
  g: (color >> 8) & 0xff,
  b: (color >> 16) & 0xff,
  a: (color >> 24) & 0xff,
});

const pack = (r: number, g: number, b: number, a: number): number =>
  ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);

const blendChannel = (mode: BlendMode, dst: number, src: number): number => {
  switch (mode) {
    case 'multiply':
      return Math.round((dst * src) / 255);
    case 'screen':
      return 255 - Math.round(((255 - dst) * (255 - src)) / 255);
    case 'overlay':
      return dst < 128
        ? Math.round((2 * dst * src) / 255)
        : 255 - Math.round((2 * (255 - dst) * (255 - src)) / 255);
    case 'normal':
    default:
      return src;
  }
};

const blend = (dst: number, src: number, opacity: number, mode: BlendMode): number => {
  const d = unpack(dst);
  const s = unpack(src);

  const sa = (s.a / 255) * opacity;
  const da = d.a / 255;
  const outA = sa + da * (1 - sa);

  if (outA <= 0) return 0;

  const blendR = blendChannel(mode, d.r, s.r);
  const blendG = blendChannel(mode, d.g, s.g);
  const blendB = blendChannel(mode, d.b, s.b);

  const outR = Math.round((blendR * sa + d.r * da * (1 - sa)) / outA);
  const outG = Math.round((blendG * sa + d.g * da * (1 - sa)) / outA);
  const outB = Math.round((blendB * sa + d.b * da * (1 - sa)) / outA);
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

  // Sort layers by zIndex (ascending - lower zIndex drawn first = behind)
  const sortedLayers = [...doc.layers].sort((a, b) => a.zIndex - b.zIndex);
  
  for (const layer of sortedLayers) {
    if (!layer.visible || layer.type !== 'grid2d') continue;
    const grid = layer as GridLayer;
    const opacity = Math.max(0, Math.min(1, layer.opacity));
    const blendMode = layer.blendMode ?? 'normal';

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
        pixels[surfaceOffset + x] = blend(dstColor, srcColor, opacity, blendMode);
      }
    }
  }

  return surface;
};
