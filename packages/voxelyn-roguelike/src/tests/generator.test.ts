import { describe, expect, it } from 'vitest';
import { generateFloor } from '../world/generator';

describe('generator', () => {
  it('is deterministic for same seed and floor', () => {
    const a = generateFloor(12345, 4);
    const b = generateFloor(12345, 4);

    expect(a.seed).toBe(b.seed);
    expect(a.entry).toEqual(b.entry);
    expect(a.exit).toEqual(b.exit);
    expect(Array.from(a.mask)).toEqual(Array.from(b.mask));
    expect(Array.from(a.grid.data)).toEqual(Array.from(b.grid.data));
  });

  it('uses only valid material ids', () => {
    const floor = generateFloor(77, 2);
    const allowed = new Set([0, 1, 2, 3, 4, 5, 6]);

    for (const value of floor.grid.data) {
      expect(allowed.has(value & 0xffff)).toBe(true);
    }
  });
});
