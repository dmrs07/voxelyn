import { projectIso } from '@voxelyn/core';
import { describe, expect, it } from 'vitest';
import { computeOcclusionMask } from '../render/occlusion';

const idx = (w: number, x: number, y: number): number => y * w + x;

const buildCamera = (
  width: number,
  height: number,
  heroX: number,
  heroY: number
): { cameraX: number; cameraY: number } => {
  const heroIso = projectIso(heroX - width / 2, heroY - height / 2, 0, 48, 24, 20);
  return {
    cameraX: 220 - heroIso.sx,
    cameraY: 180 - heroIso.sy,
  };
};

describe('occlusion visibility', () => {
  it('marks front wall cells while keeping side walls untouched', () => {
    const width = 9;
    const height = 9;
    const heroX = 4;
    const heroY = 4;
    const passable = new Uint8Array(width * height).fill(1);
    passable[idx(width, 4, 5)] = 0; // wall in front of hero
    passable[idx(width, 1, 5)] = 0; // distant side wall

    const camera = buildCamera(width, height, heroX, heroY);
    const result = computeOcclusionMask({
      width,
      height,
      heroX,
      heroY,
      passableMask: passable,
      cameraX: camera.cameraX,
      cameraY: camera.cameraY,
      tileW: 48,
      tileH: 24,
      zStep: 20,
      wallHeight: 56,
    });

    expect(result.mask[idx(width, 4, 5)]).toBe(1);
    expect(result.mask[idx(width, 1, 5)]).toBe(0);
  });

  it('flags heavy occlusion when multiple front walls overlap hero screen box', () => {
    const width = 9;
    const height = 9;
    const heroX = 4;
    const heroY = 4;
    const passable = new Uint8Array(width * height).fill(1);
    passable[idx(width, 4, 5)] = 0;
    passable[idx(width, 5, 4)] = 0;
    passable[idx(width, 5, 5)] = 0;

    const camera = buildCamera(width, height, heroX, heroY);
    const result = computeOcclusionMask({
      width,
      height,
      heroX,
      heroY,
      passableMask: passable,
      cameraX: camera.cameraX,
      cameraY: camera.cameraY,
      tileW: 48,
      tileH: 24,
      zStep: 20,
      wallHeight: 56,
    });

    expect(result.overlapCount).toBeGreaterThanOrEqual(2);
    expect(result.heroHeavilyOccluded).toBe(true);
  });
});
