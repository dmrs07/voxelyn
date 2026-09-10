import { describe, expect, it } from 'vitest';
import { arcBoltPoints } from './arc-chain';

describe('conductive arc topology', () => {
  it('keeps exact hit endpoints and deterministic interior branches', () => {
    const start = { x: 12, y: 28 },
      end = { x: 127, y: 180 };
    const points = arcBoltPoints(start, end, 71);
    expect(points[0]).toEqual(start);
    expect(points.at(-1)).toEqual(end);
    expect(points.length).toBeGreaterThan(3);
    expect(arcBoltPoints(start, end, 71)).toEqual(points);
    expect(arcBoltPoints(start, end, 72)).not.toEqual(points);
  });
  it('handles zero-length hops without invalid coordinates', () => {
    const p = { x: 16, y: 18 };
    expect(arcBoltPoints(p, p, 1)).toEqual([p, p]);
  });
});
