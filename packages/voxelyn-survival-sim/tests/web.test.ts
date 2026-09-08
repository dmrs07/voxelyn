import { describe, expect, it } from 'vitest';
import { SOLID_NONE, SOLID_ROCK } from '../src/constants';
import { createRun } from '../src/run';
import { cutSuture } from '../src/sutures';
import { designWeb, spinWeb, weaveWeb, webRepairJobs, webSpeedMul } from '../src/web';

const center = { x: 24.5, y: 24.5 };
const fixture = () => {
  const state = createRun({ seed: 1 });
  state.solid.fill(SOLID_NONE);
  state.sutures = [];
  return state;
};

describe('Cerzideira web geometry', () => {
  it.each([1, 2, 5, 9])(
    'stops every spoke and spiral at an enclosing wall %i tiles from the center',
    (radius) => {
      const state = fixture();
      const w = state.config.width;
      const min = 24 - radius,
        max = 24 + radius;
      // A one-cell wall, with open floor on BOTH sides. Close walls also
      // truncate strands before they have enough cells to be emitted.
      for (let n = min; n <= max; n++) {
        state.solid[min * w + n] = state.solid[max * w + n] = SOLID_ROCK;
        state.solid[n * w + min] = state.solid[n * w + max] = SOLID_ROCK;
      }
      const inside = (cell: number) => {
        const x = cell % w,
          y = Math.floor(cell / w);
        return x > min && x < max && y > min && y < max;
      };

      state.tick = spinWeb(state, center, state.tick);
      weaveWeb(state, []);
      const web = state.sutures;
      if (radius === 1) expect(web).toHaveLength(0);
      else expect(web.length).toBeGreaterThan(0);
      expect(web.flatMap((s) => s.cells).every(inside)).toBe(true);
      expect(web.flatMap((s) => s.slabCells).every(inside)).toBe(true);

      // Detached strands would slow players outside and create repair work
      // there. Check the gameplay consumers as well as the drawn geometry.
      for (let y = 6; y <= 42; y++)
        for (let x = 6; x <= 42; x++) {
          if (inside(y * w + x) || state.solid[y * w + x] !== SOLID_NONE) continue;
          state.player.x = x + 0.5;
          state.player.y = y + 0.5;
          expect(webSpeedMul(state, state.player)).toBe(1);
        }
      for (const strand of web) cutSuture(state, strand, [], 0);
      const jobs = webRepairJobs(state, center);
      expect(jobs).toHaveLength(web.length);
      expect(jobs.flatMap((s) => s.cells).every(inside)).toBe(true);
    },
  );

  it('keeps the visible prefix at a wall and lets unobstructed arms continue', () => {
    const state = fixture();
    const w = state.config.width;
    const open = designWeb(state, center);
    const first = open[0];
    const wallX = 28;
    for (let y = 1; y < state.config.height - 1; y++) state.solid[y * w + wallX] = SOLID_ROCK;

    const web = designWeb(state, center);
    const prefix = first.cells.slice(
      0,
      first.cells.findIndex((c) => c % w === wallX),
    );
    expect(prefix.length).toBeGreaterThanOrEqual(2);
    expect(prefix.length).toBeLessThan(first.cells.length);
    expect(web[0].cells).toEqual(prefix);
    expect(web[0].b % w).toBe(wallX - 1);
    expect(web.flatMap((s) => s.cells).every((c) => c % w < wallX)).toBe(true);
    // The opposite side of the web still reaches open floor far from the boss.
    const opposite = open.filter((s) => s.cells.every((c) => c % w <= 12));
    expect(opposite.length).toBeGreaterThan(0);
    for (const strand of opposite) expect(web).toContainEqual(strand);
  });
});
