/**
 * VoxelForge Editor - Selection Clipboard Utilities
 */

import type { GridLayer, Selection } from './types';
import type { PaintData } from './commands';
import { getSelectionMask } from './selection';

export type ClipboardData = {
  width: number;
  height: number;
  data: Uint16Array;
  mask: Uint8Array;
};

export const copySelectionFromLayer = (
  layer: GridLayer,
  selection: Selection
): ClipboardData | null => {
  if (!selection.active || selection.width < 1 || selection.height < 1) return null;

  const mask = getSelectionMask(selection, layer.width, layer.height);
  const width = selection.width;
  const height = selection.height;
  const data = new Uint16Array(width * height);
  const localMask = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const gx = selection.x + x;
      const gy = selection.y + y;
      if (gx < 0 || gy < 0 || gx >= layer.width || gy >= layer.height) continue;

      const globalIndex = gy * layer.width + gx;
      if (mask[globalIndex] === 0) continue;

      const localIndex = y * width + x;
      data[localIndex] = layer.data[globalIndex];
      localMask[localIndex] = 1;
    }
  }

  return { width, height, data, mask: localMask };
};

export const createEraseDataFromSelection = (
  layer: GridLayer,
  selection: Selection
): PaintData | null => {
  if (!selection.active || selection.width < 1 || selection.height < 1) return null;

  const mask = getSelectionMask(selection, layer.width, layer.height);
  const pixels: PaintData['pixels'] = [];

  for (let y = 0; y < layer.height; y += 1) {
    for (let x = 0; x < layer.width; x += 1) {
      const idx = y * layer.width + x;
      if (mask[idx] === 0) continue;

      const oldValue = layer.data[idx];
      const newValue = (oldValue & 0xff00) | 0;
      if (oldValue !== newValue) {
        pixels.push({ index: idx, oldValue, newValue });
      }
    }
  }

  return { layerId: layer.id, pixels };
};

export const buildPasteData = (
  layer: GridLayer,
  clipboard: ClipboardData,
  destX: number,
  destY: number
): PaintData => {
  const pixels: PaintData['pixels'] = [];

  for (let y = 0; y < clipboard.height; y += 1) {
    for (let x = 0; x < clipboard.width; x += 1) {
      const localIndex = y * clipboard.width + x;
      if (clipboard.mask[localIndex] === 0) continue;

      const gx = destX + x;
      const gy = destY + y;
      if (gx < 0 || gy < 0 || gx >= layer.width || gy >= layer.height) continue;

      const globalIndex = gy * layer.width + gx;
      const oldValue = layer.data[globalIndex];
      const newValue = clipboard.data[localIndex];

      if (oldValue !== newValue) {
        pixels.push({ index: globalIndex, oldValue, newValue });
      }
    }
  }

  return { layerId: layer.id, pixels };
};
