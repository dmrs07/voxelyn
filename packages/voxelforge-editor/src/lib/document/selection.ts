/**
 * VoxelForge Editor - Selection Utilities
 */

import type { Selection } from './types';

export type SelectionOp = 'replace' | 'union' | 'intersect' | 'subtract' | 'invert';

const createMask = (size: number): Uint8Array => new Uint8Array(size);

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const getSelectionMask = (selection: Selection, width: number, height: number): Uint8Array => {
  const mask = createMask(width * height);
  if (!selection.active || selection.width < 1 || selection.height < 1) return mask;

  const startX = clamp(selection.x, 0, width - 1);
  const startY = clamp(selection.y, 0, height - 1);
  const endX = clamp(selection.x + selection.width - 1, 0, width - 1);
  const endY = clamp(selection.y + selection.height - 1, 0, height - 1);

  if (selection.mask && selection.mask.length === selection.width * selection.height) {
    const selWidth = selection.width;
    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        const sx = x - selection.x;
        const sy = y - selection.y;
        const sIndex = sy * selWidth + sx;
        if (selection.mask[sIndex] > 0) {
          mask[y * width + x] = 1;
        }
      }
    }

    return mask;
  }

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      mask[y * width + x] = 1;
    }
  }

  return mask;
};

const maskToSelection = (mask: Uint8Array, width: number, height: number): Selection => {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { active: false, x: 0, y: 0, width: 0, height: 0 };
  }

  const selWidth = maxX - minX + 1;
  const selHeight = maxY - minY + 1;
  const selMask = new Uint8Array(selWidth * selHeight);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (mask[y * width + x] > 0) {
        const sx = x - minX;
        const sy = y - minY;
        selMask[sy * selWidth + sx] = 1;
      }
    }
  }

  return {
    active: true,
    x: minX,
    y: minY,
    width: selWidth,
    height: selHeight,
    mask: selMask,
  };
};

const applyOp = (base: Uint8Array, next: Uint8Array, op: SelectionOp): Uint8Array => {
  const result = new Uint8Array(base.length);

  for (let i = 0; i < base.length; i += 1) {
    const a = base[i] > 0;
    const b = next[i] > 0;

    let value = false;
    if (op === 'replace') value = b;
    if (op === 'union') value = a || b;
    if (op === 'intersect') value = a && b;
    if (op === 'subtract') value = a && !b;
    if (op === 'invert') value = !a;

    result[i] = value ? 1 : 0;
  }

  return result;
};

export const mergeSelection = (
  base: Selection,
  next: Selection,
  op: SelectionOp,
  width: number,
  height: number
): Selection => {
  const baseMask = getSelectionMask(base, width, height);
  const nextMask = getSelectionMask(next, width, height);
  const resultMask = applyOp(baseMask, nextMask, op);

  return maskToSelection(resultMask, width, height);
};

export const isSelectionEmpty = (selection: Selection): boolean =>
  !selection.active || selection.width < 1 || selection.height < 1;

export const translateSelection = (
  selection: Selection,
  dx: number,
  dy: number,
  width: number,
  height: number
): Selection => {
  if (!selection.active) return selection;

  const moved = {
    ...selection,
    x: clamp(selection.x + dx, 0, Math.max(0, width - 1)),
    y: clamp(selection.y + dy, 0, Math.max(0, height - 1)),
  };

  return moved;
};
