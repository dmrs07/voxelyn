import { describe, expect, it } from 'vitest';
import { pointsNear, rasterizePolygonSelection } from './tools';

describe('lasso rasterization', () => {
  it('rasterizes a simple polygon into a bounded selection mask', () => {
    const selection = rasterizePolygonSelection([
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 4 },
      { x: 1, y: 4 },
    ]);

    expect(selection).not.toBeNull();
    if (!selection) return;

    expect(selection.x).toBe(1);
    expect(selection.y).toBe(1);
    expect(selection.width).toBe(4);
    expect(selection.height).toBe(4);

    // Interior cell should be selected.
    expect(selection.mask?.[1 * selection.width + 1]).toBe(1);
    // Edge cell should also be selected.
    expect(selection.mask?.[0]).toBe(1);
  });

  it('returns null for invalid polygon input', () => {
    const selection = rasterizePolygonSelection([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(selection).toBeNull();
  });

  it('detects proximity for polygon closing behavior', () => {
    expect(pointsNear({ x: 0, y: 0 }, { x: 1, y: 1 }, 2)).toBe(true);
    expect(pointsNear({ x: 0, y: 0 }, { x: 3, y: 3 }, 2)).toBe(false);
  });
});
