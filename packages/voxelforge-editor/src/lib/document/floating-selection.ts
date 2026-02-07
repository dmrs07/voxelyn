import type { TransformData } from './commands';
import type { ClipboardData } from './clipboard';
import type { GridLayer, LayerId, Selection, VoxelLayer } from './types';

export type FloatingLayer = GridLayer | VoxelLayer;
export type FloatingLayerType = 'grid2d' | 'voxel3d';
export type FloatingSource = 'selection' | 'clipboard';

export type FloatingSelectionSession = {
  layerId: LayerId;
  layerType: FloatingLayerType;
  layerWidth: number;
  layerHeight: number;
  layerDepth: number;
  activeZ: number;
  source: FloatingSource;
  x: number;
  y: number;
  width: number;
  height: number;
  mask: Uint8Array;
  data: Uint16Array;
  sourceIndices: Uint32Array;
  selectionBefore: Selection;
};

const cloneSelection = (selection: Selection): Selection => ({
  ...selection,
  mask: selection.mask ? selection.mask.slice() : undefined,
});

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const indexForGrid = (width: number, height: number, x: number, y: number): number => {
  if (x < 0 || y < 0 || x >= width || y >= height) return -1;
  return y * width + x;
};

const indexForVoxelSlice = (
  width: number,
  height: number,
  depth: number,
  z: number,
  x: number,
  y: number
): number => {
  if (x < 0 || y < 0 || x >= width || y >= height) return -1;
  if (z < 0 || z >= depth) return -1;
  return x + y * width + z * width * height;
};

const indexForPoint = (
  session: Pick<FloatingSelectionSession, 'layerType' | 'layerWidth' | 'layerHeight' | 'layerDepth' | 'activeZ'>,
  x: number,
  y: number
): number => {
  if (session.layerType === 'grid2d') {
    return indexForGrid(session.layerWidth, session.layerHeight, x, y);
  }
  return indexForVoxelSlice(session.layerWidth, session.layerHeight, session.layerDepth, session.activeZ, x, y);
};

const hasMaskPixels = (mask: Uint8Array): boolean => {
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] > 0) return true;
  }
  return false;
};

export const createFloatingFromSelection = (
  layer: FloatingLayer,
  selection: Selection,
  activeZ: number
): FloatingSelectionSession | null => {
  if (!selection.active || selection.width < 1 || selection.height < 1) return null;

  const width = selection.width;
  const height = selection.height;
  const data = new Uint16Array(width * height);
  const mask = new Uint8Array(width * height);
  const sourceIndices: number[] = [];

  for (let ly = 0; ly < height; ly += 1) {
    for (let lx = 0; lx < width; lx += 1) {
      const localIndex = ly * width + lx;
      const selected = selection.mask ? selection.mask[localIndex] > 0 : true;
      if (!selected) continue;

      const gx = selection.x + lx;
      const gy = selection.y + ly;
      const index =
        layer.type === 'grid2d'
          ? indexForGrid(layer.width, layer.height, gx, gy)
          : indexForVoxelSlice(layer.width, layer.height, layer.depth, activeZ, gx, gy);

      if (index < 0) continue;
      mask[localIndex] = 1;
      data[localIndex] = layer.data[index] ?? 0;
      sourceIndices.push(index);
    }
  }

  if (!hasMaskPixels(mask)) return null;

  return {
    layerId: layer.id,
    layerType: layer.type,
    layerWidth: layer.width,
    layerHeight: layer.height,
    layerDepth: layer.type === 'voxel3d' ? layer.depth : 1,
    activeZ,
    source: 'selection',
    x: selection.x,
    y: selection.y,
    width,
    height,
    mask,
    data,
    sourceIndices: Uint32Array.from(sourceIndices),
    selectionBefore: cloneSelection(selection),
  };
};

export const createFloatingFromClipboard = (
  layer: FloatingLayer,
  clipboard: ClipboardData,
  x: number,
  y: number,
  activeZ: number,
  selectionBefore: Selection
): FloatingSelectionSession | null => {
  if (clipboard.width < 1 || clipboard.height < 1) return null;
  if (!hasMaskPixels(clipboard.mask)) return null;

  return {
    layerId: layer.id,
    layerType: layer.type,
    layerWidth: layer.width,
    layerHeight: layer.height,
    layerDepth: layer.type === 'voxel3d' ? layer.depth : 1,
    activeZ,
    source: 'clipboard',
    x,
    y,
    width: clipboard.width,
    height: clipboard.height,
    mask: clipboard.mask.slice(),
    data: clipboard.data.slice(),
    sourceIndices: new Uint32Array(0),
    selectionBefore: cloneSelection(selectionBefore),
  };
};

export const getFloatingSelection = (session: FloatingSelectionSession): Selection => ({
  active: true,
  x: session.x,
  y: session.y,
  width: session.width,
  height: session.height,
  mask: session.mask.slice(),
});

export const moveFloatingSelection = (
  session: FloatingSelectionSession,
  dx: number,
  dy: number
): FloatingSelectionSession => {
  if (dx === 0 && dy === 0) return session;
  return {
    ...session,
    x: session.x + dx,
    y: session.y + dy,
  };
};

const rotateDataAndMask = (
  data: Uint16Array,
  mask: Uint8Array,
  width: number,
  height: number,
  angle: 90 | 180 | 270
): { data: Uint16Array; mask: Uint8Array; width: number; height: number } => {
  if (angle === 180) {
    const outData = new Uint16Array(width * height);
    const outMask = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const src = y * width + x;
        const dst = (height - 1 - y) * width + (width - 1 - x);
        outData[dst] = data[src] ?? 0;
        outMask[dst] = mask[src] ?? 0;
      }
    }
    return { data: outData, mask: outMask, width, height };
  }

  const outWidth = height;
  const outHeight = width;
  const outData = new Uint16Array(outWidth * outHeight);
  const outMask = new Uint8Array(outWidth * outHeight);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const src = y * width + x;
      let dx = 0;
      let dy = 0;
      if (angle === 90) {
        dx = height - 1 - y;
        dy = x;
      } else {
        dx = y;
        dy = width - 1 - x;
      }
      const dst = dy * outWidth + dx;
      outData[dst] = data[src] ?? 0;
      outMask[dst] = mask[src] ?? 0;
    }
  }

  return { data: outData, mask: outMask, width: outWidth, height: outHeight };
};

export const rotateFloatingSelection = (
  session: FloatingSelectionSession,
  angle: 90 | 180 | 270
): FloatingSelectionSession => {
  const rotated = rotateDataAndMask(session.data, session.mask, session.width, session.height, angle);

  const centerX = session.x + session.width / 2;
  const centerY = session.y + session.height / 2;
  const nextX = Math.round(centerX - rotated.width / 2);
  const nextY = Math.round(centerY - rotated.height / 2);

  return {
    ...session,
    x: nextX,
    y: nextY,
    width: rotated.width,
    height: rotated.height,
    data: rotated.data,
    mask: rotated.mask,
  };
};

export const flipFloatingSelection = (
  session: FloatingSelectionSession,
  axis: 'horizontal' | 'vertical'
): FloatingSelectionSession => {
  const outData = new Uint16Array(session.width * session.height);
  const outMask = new Uint8Array(session.width * session.height);

  for (let y = 0; y < session.height; y += 1) {
    for (let x = 0; x < session.width; x += 1) {
      const src = y * session.width + x;
      const dx = axis === 'horizontal' ? session.width - 1 - x : x;
      const dy = axis === 'vertical' ? session.height - 1 - y : y;
      const dst = dy * session.width + dx;
      outData[dst] = session.data[src] ?? 0;
      outMask[dst] = session.mask[src] ?? 0;
    }
  }

  return {
    ...session,
    data: outData,
    mask: outMask,
  };
};

export const isPointInFloatingSelection = (
  session: FloatingSelectionSession,
  x: number,
  y: number
): boolean => {
  const lx = x - session.x;
  const ly = y - session.y;
  if (lx < 0 || ly < 0 || lx >= session.width || ly >= session.height) return false;
  return (session.mask[ly * session.width + lx] ?? 0) > 0;
};

export const buildFloatingOverrides = (session: FloatingSelectionSession): Map<number, number> => {
  const overrides = new Map<number, number>();

  if (session.source === 'selection') {
    for (let i = 0; i < session.sourceIndices.length; i += 1) {
      overrides.set(session.sourceIndices[i] ?? 0, 0);
    }
  }

  for (let ly = 0; ly < session.height; ly += 1) {
    for (let lx = 0; lx < session.width; lx += 1) {
      const localIndex = ly * session.width + lx;
      if ((session.mask[localIndex] ?? 0) === 0) continue;

      const gx = session.x + lx;
      const gy = session.y + ly;
      const globalIndex = indexForPoint(session, gx, gy);
      if (globalIndex < 0) continue;

      overrides.set(globalIndex, session.data[localIndex] ?? 0);
    }
  }

  return overrides;
};

export const buildFloatingTransformData = (
  session: FloatingSelectionSession,
  layerData: Uint16Array
): TransformData => {
  const overrides = buildFloatingOverrides(session);
  const pixels: TransformData['pixels'] = [];

  for (const [index, newValue] of overrides) {
    const oldValue = layerData[index] ?? 0;
    if (oldValue !== newValue) {
      pixels.push({ index, oldValue, newValue });
    }
  }

  pixels.sort((a, b) => a.index - b.index);

  return {
    layerId: session.layerId,
    pixels,
    selectionBefore: cloneSelection(session.selectionBefore),
    selectionAfter: getFloatingSelection(session),
  };
};

export const buildClipboardFromFloating = (session: FloatingSelectionSession): ClipboardData => ({
  width: session.width,
  height: session.height,
  data: session.data.slice(),
  mask: session.mask.slice(),
});

export const clampFloatingToLayer = (session: FloatingSelectionSession): FloatingSelectionSession => {
  const maxX = Math.max(0, session.layerWidth - 1);
  const maxY = Math.max(0, session.layerHeight - 1);
  return {
    ...session,
    x: clamp(session.x, -session.width + 1, maxX),
    y: clamp(session.y, -session.height + 1, maxY),
  };
};
