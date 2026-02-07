import { describe, expect, it } from 'vitest';
import type { GridLayer, Selection, VoxelLayer } from './types';
import {
  buildFloatingOverrides,
  buildFloatingTransformData,
  createFloatingFromClipboard,
  createFloatingFromSelection,
  flipFloatingSelection,
  moveFloatingSelection,
  rotateFloatingSelection,
} from './floating-selection';

const makeGridLayer = (width: number, height: number): GridLayer => ({
  id: 'grid',
  name: 'Grid',
  visible: true,
  locked: false,
  opacity: 1,
  blendMode: 'normal',
  zIndex: 0,
  isoHeight: 0,
  type: 'grid2d',
  width,
  height,
  data: new Uint16Array(width * height),
});

const makeVoxelLayer = (width: number, height: number, depth: number): VoxelLayer => ({
  id: 'voxel',
  name: 'Voxel',
  visible: true,
  locked: false,
  opacity: 1,
  blendMode: 'normal',
  zIndex: 0,
  isoHeight: 0,
  type: 'voxel3d',
  width,
  height,
  depth,
  data: new Uint16Array(width * height * depth),
});

describe('floating-selection', () => {
  it('extracts a masked grid selection and resolves overlap during move commit', () => {
    const layer = makeGridLayer(4, 4);
    layer.data[5] = 10;  // (1,1)
    layer.data[6] = 20;  // (2,1) hole in selection
    layer.data[9] = 30;  // (1,2)
    layer.data[10] = 40; // (2,2)

    const selection: Selection = {
      active: true,
      x: 1,
      y: 1,
      width: 2,
      height: 2,
      mask: new Uint8Array([
        1, 0,
        1, 1,
      ]),
    };

    const floating = createFloatingFromSelection(layer, selection, 0);
    expect(floating).not.toBeNull();
    if (!floating) return;

    const moved = moveFloatingSelection(floating, 1, 0);
    const overrides = buildFloatingOverrides(moved);

    expect(overrides.get(5)).toBe(0);
    expect(overrides.get(9)).toBe(0);
    expect(overrides.get(6)).toBe(10);
    expect(overrides.get(10)).toBe(30); // overlap destination should win over source clear
    expect(overrides.get(11)).toBe(40);

    const transform = buildFloatingTransformData(moved, layer.data);
    const changed = new Map(transform.pixels.map(px => [px.index, px.newValue]));
    expect(changed.get(5)).toBe(0);
    expect(changed.get(9)).toBe(0);
    expect(changed.get(6)).toBe(10);
    expect(changed.get(10)).toBe(30);
    expect(changed.get(11)).toBe(40);
  });

  it('extracts and commits voxel data only on the active Z slice', () => {
    const layer = makeVoxelLayer(3, 3, 2);
    const z0Index = 1 + 1 * 3 + 0 * 9;
    const z1Index = 1 + 1 * 3 + 1 * 9;
    layer.data[z0Index] = 99;
    layer.data[z1Index] = 7;

    const selection: Selection = {
      active: true,
      x: 1,
      y: 1,
      width: 1,
      height: 1,
    };

    const floating = createFloatingFromSelection(layer, selection, 1);
    expect(floating).not.toBeNull();
    if (!floating) return;

    const moved = moveFloatingSelection(floating, 1, 0);
    const transform = buildFloatingTransformData(moved, layer.data);
    const indices = transform.pixels.map(px => px.index).sort((a, b) => a - b);

    expect(indices).toEqual([
      13, // clear source on z=1
      14, // place destination on z=1
    ]);
    expect(indices.includes(z0Index)).toBe(false);
  });

  it('rotates and flips floating payload while preserving selected pixels', () => {
    const layer = makeGridLayer(8, 8);
    const clipboard = {
      width: 2,
      height: 2,
      data: new Uint16Array([
        1, 2,
        3, 0,
      ]),
      mask: new Uint8Array([
        1, 1,
        1, 0,
      ]),
    };

    const selectionBefore: Selection = { active: false, x: 0, y: 0, width: 0, height: 0 };
    const floating = createFloatingFromClipboard(layer, clipboard, 2, 2, 0, selectionBefore);
    expect(floating).not.toBeNull();
    if (!floating) return;

    const rotated = rotateFloatingSelection(floating, 90);
    const flipped = flipFloatingSelection(rotated, 'horizontal');

    const rotatedMaskCount = Array.from(rotated.mask).reduce((sum, v) => sum + (v > 0 ? 1 : 0), 0);
    const flippedMaskCount = Array.from(flipped.mask).reduce((sum, v) => sum + (v > 0 ? 1 : 0), 0);

    expect(rotated.width).toBe(2);
    expect(rotated.height).toBe(2);
    expect(rotatedMaskCount).toBe(3);
    expect(flippedMaskCount).toBe(3);

    const rotatedValues = Array.from(rotated.data).sort((a, b) => a - b);
    const flippedValues = Array.from(flipped.data).sort((a, b) => a - b);
    expect(rotatedValues).toEqual([0, 1, 2, 3]);
    expect(flippedValues).toEqual([0, 1, 2, 3]);
  });
});
