import { describe, expect, it } from 'vitest';
import { createDocument, createVoxelLayer } from '../document/types';
import { renderDocumentToSurface } from './render-surface';

const RED = 0xff0000ff;
const GREEN = 0xff00ff00;

const makeDocWithVoxel = () => {
  const doc = createDocument(4, 4, 2, 'Render');
  doc.palette[1] = { ...doc.palette[1], id: 1, color: RED, name: 'Red' };
  doc.palette[2] = { ...doc.palette[2], id: 2, color: GREEN, name: 'Green' };

  const voxel = createVoxelLayer(4, 4, 2, 'Vox', 1);
  const bottomIdx = 1 + 1 * 4 + 0 * 16;
  const topIdx = 1 + 1 * 4 + 1 * 16;
  voxel.data[bottomIdx] = 1;
  voxel.data[topIdx] = 2;

  doc.layers.push(voxel);
  return { doc, voxel, bottomIdx, topIdx };
};

describe('renderDocumentToSurface voxel 2D modes', () => {
  it('renders active slice when voxel mode is slice', () => {
    const { doc } = makeDocWithVoxel();

    const z0 = renderDocumentToSurface(doc, [], null, false, new Map(), 'slice', 0);
    const z1 = renderDocumentToSurface(doc, [], null, false, new Map(), 'slice', 1);

    const pixelIndex = 1 + 1 * doc.width;
    expect(z0.pixels[pixelIndex]).toBe(RED >>> 0);
    expect(z1.pixels[pixelIndex]).toBe(GREEN >>> 0);
  });

  it('renders top projection when voxel mode is projection', () => {
    const { doc } = makeDocWithVoxel();

    const projected = renderDocumentToSurface(doc, [], null, false, new Map(), 'projection', 0);
    const pixelIndex = 1 + 1 * doc.width;

    // Top voxel should win regardless of active Z in projection mode.
    expect(projected.pixels[pixelIndex]).toBe(GREEN >>> 0);
  });

  it('applies floating overrides to voxel slice rendering', () => {
    const { doc, voxel, bottomIdx } = makeDocWithVoxel();
    const overrides = new Map([[voxel.id, new Map([[bottomIdx, 2]])]]);

    const surface = renderDocumentToSurface(doc, [], null, false, overrides, 'slice', 0);
    const pixelIndex = 1 + 1 * doc.width;
    expect(surface.pixels[pixelIndex]).toBe(GREEN >>> 0);
  });
});
