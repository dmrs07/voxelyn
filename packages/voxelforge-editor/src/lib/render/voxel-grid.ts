import type { EditorDocument, GridLayer, VoxelLayer } from '../document/types';
import { createVoxelGrid3D, type VoxelGrid3D } from '@voxelyn/core';

export type VoxelBounds = {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  empty: boolean;
};

/**
 * Builds a composite voxel grid from the editor document respecting layer order and zIndex.
 */
export const buildVoxelGridFromDocument = (doc: EditorDocument): VoxelGrid3D => {
  const width = doc.width;
  const height = doc.height;
  const depth = doc.depth;
  const data = new Uint16Array(width * height * depth);

  const visibleLayers = doc.layers.filter(layer => layer.visible);
  const sortedLayers = [...visibleLayers].sort((a, b) => a.zIndex - b.zIndex);

  for (const layer of sortedLayers) {
    if (layer.type === 'voxel3d') {
      const voxelLayer = layer as VoxelLayer;
      const zOffset = Math.round(voxelLayer.zIndex);
      const maxW = Math.min(voxelLayer.width, width);
      const maxH = Math.min(voxelLayer.height, height);
      const maxD = Math.min(voxelLayer.depth, depth);

      for (let z = 0; z < maxD; z += 1) {
        const targetZ = z + zOffset;
        if (targetZ < 0 || targetZ >= depth) continue;
        for (let y = 0; y < maxH; y += 1) {
          const row = (z * voxelLayer.height + y) * voxelLayer.width;
          const targetRow = (targetZ * height + y) * width;
          for (let x = 0; x < maxW; x += 1) {
            const cell = voxelLayer.data[row + x] ?? 0;
            if ((cell & 0xff) === 0) continue;
            data[targetRow + x] = cell;
          }
        }
      }
      continue;
    }

    if (layer.type === 'grid2d') {
      const gridLayer = layer as GridLayer;
      const targetZ = Math.max(0, Math.min(depth - 1, Math.round(gridLayer.zIndex)));
      const maxW = Math.min(gridLayer.width, width);
      const maxH = Math.min(gridLayer.height, height);
      for (let y = 0; y < maxH; y += 1) {
        const row = y * gridLayer.width;
        const targetRow = (targetZ * height + y) * width;
        for (let x = 0; x < maxW; x += 1) {
          const cell = gridLayer.data[row + x] ?? 0;
          if ((cell & 0xff) === 0) continue;
          data[targetRow + x] = cell;
        }
      }
    }
  }

  return createVoxelGrid3D(width, height, depth, { data });
};

/**
 * Computes the axis-aligned bounds of non-empty voxels.
 */
export const computeVoxelBounds = (grid: VoxelGrid3D): VoxelBounds => {
  const { width, height, depth, data } = grid;
  let minX = width;
  let minY = height;
  let minZ = depth;
  let maxX = -1;
  let maxY = -1;
  let maxZ = -1;

  const slice = width * height;
  for (let i = 0; i < data.length; i += 1) {
    const cell = data[i] ?? 0;
    if ((cell & 0xff) === 0) continue;
    const z = Math.floor(i / slice);
    const rem = i - z * slice;
    const y = Math.floor(rem / width);
    const x = rem - y * width;

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const empty = maxX < 0 || maxY < 0 || maxZ < 0;
  return {
    minX: empty ? 0 : minX,
    minY: empty ? 0 : minY,
    minZ: empty ? 0 : minZ,
    maxX: empty ? 0 : maxX,
    maxY: empty ? 0 : maxY,
    maxZ: empty ? 0 : maxZ,
    empty,
  };
};

/**
 * Builds a composite voxel grid and its bounds for fast intersection checks.
 */
export const buildVoxelGridFromDocumentWithBounds = (
  doc: EditorDocument
): { grid: VoxelGrid3D; bounds: VoxelBounds } => {
  const grid = buildVoxelGridFromDocument(doc);
  const bounds = computeVoxelBounds(grid);
  return { grid, bounds };
};
