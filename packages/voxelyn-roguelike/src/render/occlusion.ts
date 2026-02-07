import { projectIso } from '@voxelyn/core';
import { OCCLUSION_RADIUS } from '../game/constants';

const index2D = (width: number, x: number, y: number): number => y * width + x;

const overlaps = (
  aLeft: number,
  aTop: number,
  aRight: number,
  aBottom: number,
  bLeft: number,
  bTop: number,
  bRight: number,
  bBottom: number
): boolean => aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;

export type OcclusionInput = {
  width: number;
  height: number;
  heroX: number;
  heroY: number;
  passableMask: Uint8Array;
  cameraX: number;
  cameraY: number;
  tileW: number;
  tileH: number;
  zStep: number;
  wallHeight: number;
  radius?: number;
  output?: Uint8Array;
};

export type OcclusionResult = {
  mask: Uint8Array;
  heroHeavilyOccluded: boolean;
  overlapCount: number;
};

export const computeOcclusionMask = (input: OcclusionInput): OcclusionResult => {
  const size = input.width * input.height;
  const out = input.output && input.output.length === size ? input.output : new Uint8Array(size);
  out.fill(0);

  const radius = input.radius ?? OCCLUSION_RADIUS;
  const heroIso = projectIso(
    input.heroX - input.width / 2,
    input.heroY - input.height / 2,
    0,
    input.tileW,
    input.tileH,
    input.zStep
  );

  const heroScreenX = input.cameraX + heroIso.sx;
  const heroScreenY = input.cameraY + heroIso.sy - 10;

  const heroLeft = heroScreenX - 10;
  const heroRight = heroScreenX + 10;
  const heroTop = heroScreenY - 30;
  const heroBottom = heroScreenY + 2;

  let overlapCount = 0;
  const heroDepth = input.heroX + input.heroY;

  for (let y = 1; y < input.height - 1; y += 1) {
    for (let x = 1; x < input.width - 1; x += 1) {
      const idx = index2D(input.width, x, y);
      if (input.passableMask[idx] === 1) continue;

      const dx = x - input.heroX;
      const dy = y - input.heroY;
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;

      const cellDepth = x + y;
      if (cellDepth < heroDepth) continue;

      const iso = projectIso(
        x - input.width / 2,
        y - input.height / 2,
        0,
        input.tileW,
        input.tileH,
        input.zStep
      );

      const sx = input.cameraX + iso.sx;
      const sy = input.cameraY + iso.sy;
      if (sy < heroScreenY - input.tileH) continue;
      if (Math.abs(sx - heroScreenX) > input.tileW * 1.2) continue;

      const wallLeft = sx - input.tileW * 0.5;
      const wallRight = sx + input.tileW * 0.5;
      const wallTop = sy - input.wallHeight;
      const wallBottom = sy + input.tileH * 0.5;

      if (!overlaps(wallLeft, wallTop, wallRight, wallBottom, heroLeft, heroTop, heroRight, heroBottom)) {
        continue;
      }

      out[idx] = 1;
      overlapCount += 1;
    }
  }

  return {
    mask: out,
    heroHeavilyOccluded: overlapCount >= 2,
    overlapCount,
  };
};
