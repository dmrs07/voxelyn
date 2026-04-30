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

  it('keeps larger 48x48 sprites grounded at the anchor point', () => {
    const result = computeAnchorDraw({
      spriteWidth: 48,
      spriteHeight: 48,
      anchor: { x: 24, y: 43 },
      sx: 100,
      sy: 100,
      scale: 3,
    });

    expect(result.effectiveScale).toBeCloseTo(84 / 43);
    expect(result.drawY + 43 * result.effectiveScale).toBeCloseTo(100);
  });

  it('downscales native 181x168 sprites while preserving the foot anchor', () => {
    const result = computeAnchorDraw({
      spriteWidth: 181,
      spriteHeight: 168,
      anchor: { x: 90, y: 144 },
      sx: 100,
      sy: 100,
      scale: 3,
    });

    expect(result.effectiveScale).toBeCloseTo(84 / 144);
    expect(result.drawW).toBeCloseTo(105.58, 2);
    expect(result.drawH).toBeCloseTo(98);
    expect(result.drawY + 144 * result.effectiveScale).toBeCloseTo(100);
  });
});
