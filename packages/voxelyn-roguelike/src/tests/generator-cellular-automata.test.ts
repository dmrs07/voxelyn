import { describe, expect, it } from 'vitest';
import {
  CA_TARGET_OPEN_MAX,
  CA_TARGET_OPEN_MIN,
} from '../game/constants';
import {
  buildProtectedMask,
  computeOpenRatio,
  runCellularAutomata,
} from '../world/generator-ca';
import { generateFloor } from '../world/generator';
import { hasPath, reconstructShortestPath } from '../world/connectivity';

describe('generator cellular automata', () => {
  it('remains deterministic for the same seed/floor', () => {
    const a = generateFloor(26001, 5);
    const b = generateFloor(26001, 5);
    expect(Array.from(a.mask)).toEqual(Array.from(b.mask));
    expect(a.entry).toEqual(b.entry);
    expect(a.exit).toEqual(b.exit);
  });

  it('keeps connected entry->exit and open ratio in target range over seed sweep', () => {
    for (let seed = 0; seed < 18; seed += 1) {
      const floor = generateFloor(91000 + seed * 97, (seed % 10) + 1);
      const ratio = computeOpenRatio(floor.mask);
      expect(ratio).toBeGreaterThanOrEqual(CA_TARGET_OPEN_MIN);
      expect(ratio).toBeLessThanOrEqual(CA_TARGET_OPEN_MAX);
      expect(hasPath(floor.mask, floor.width, floor.height, floor.entry, floor.exit)).toBe(true);

      const mainPath = reconstructShortestPath(
        floor.mask,
        floor.width,
        floor.height,
        floor.entry,
        floor.exit
      );
      expect(mainPath.length).toBeGreaterThan(0);
    }
  });

  it('preserves protected path cells during CA passes', () => {
    const width = 9;
    const height = 9;
    const mask = new Uint8Array(width * height);
    // Start mostly closed with a narrow intended path.
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        mask[i] = 0;
      }
    }
    const path = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
      { x: 6, y: 1 },
      { x: 7, y: 1 },
    ];
    for (const cell of path) {
      mask[cell.y * width + cell.x] = 1;
    }

    const protectedMask = buildProtectedMask(
      width,
      height,
      { x: 1, y: 1 },
      { x: 7, y: 1 },
      path,
      0
    );
    const smoothed = runCellularAutomata(mask, width, height, protectedMask, { iterations: 4 });
    for (const cell of path) {
      expect(smoothed[cell.y * width + cell.x]).toBe(1);
    }
  });
});
