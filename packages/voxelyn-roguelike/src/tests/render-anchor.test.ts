import { describe, expect, it } from 'vitest';
import { computeAnchorDraw } from '../render/sprites';

describe('computeAnchorDraw', () => {
  it('computes 32x32 authored foot rows from its anchor', () => {
    const result = computeAnchorDraw({
      spriteWidth: 32,
      spriteHeight: 32,
      anchor: { x: 16, y: 29 },
      sx: 100,
      sy: 100,
      scale: 2,
    });

    expect(result.footRowsBelow).toBe(3);
    expect(result.usefulHeight).toBe(29);
  });

  it('computes 48x48 PixelLab foot rows from its anchor', () => {
    const result = computeAnchorDraw({
      spriteWidth: 48,
      spriteHeight: 48,
      anchor: { x: 24, y: 43 },
      sx: 100,
      sy: 100,
      scale: 2,
    });

    expect(result.footRowsBelow).toBe(5);
    expect(result.usefulHeight).toBe(43);
  });
});
