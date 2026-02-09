import { describe, expect, it } from 'vitest';
import { computeFogVisibility } from '../render/fog';

const idx = (w: number, x: number, y: number): number => y * w + x;

describe('fog visibility', () => {
  it('reveals only local BFS range without lights', () => {
    const width = 9;
    const height = 5;
    const passable = new Uint8Array(width * height);

    // Horizontal corridor y=2 from x=1..7
    for (let x = 1; x <= 7; x += 1) {
      passable[idx(width, x, 2)] = 1;
    }

    const vis = computeFogVisibility({
      width,
      height,
      passableMask: passable,
      heroX: 1,
      heroY: 2,
      baseRange: 2,
    });

    expect(vis[idx(width, 1, 2)]).toBe(1);
    expect(vis[idx(width, 3, 2)]).toBe(1);
    expect(vis[idx(width, 6, 2)]).toBe(0);
  });

  it('dynamic lights reveal farther cells beyond base corridor range', () => {
    const width = 9;
    const height = 5;
    const passable = new Uint8Array(width * height);

    for (let x = 1; x <= 7; x += 1) {
      passable[idx(width, x, 2)] = 1;
    }

    const vis = computeFogVisibility({
      width,
      height,
      passableMask: passable,
      heroX: 1,
      heroY: 2,
      baseRange: 2,
      lightSources: [{ x: 7, y: 2, radius: 2 }],
    });

    expect(vis[idx(width, 7, 2)]).toBe(1);
    // wall around a revealed corridor should be visible too
    expect(vis[idx(width, 7, 1)]).toBe(1);
  });
});
