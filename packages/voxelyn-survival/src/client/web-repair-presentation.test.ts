import { describe, expect, it } from 'vitest';
import { createRun, spawnEnemy, startAction } from '@voxelyn/survival-sim';
import { appendWebRepairDraws } from './web-presentation';

describe('worker repair bar', () => {
  it('fills above the worker using the action clock and disappears on interruption', () => {
    const state = createRun({ seed: 1 });
    state.solid.fill(0);
    state.enemies = [];
    state.tick = 100;
    const worker = spawnEnemy(state, 'stitcher', 20, 20, false);
    worker.webRepair = { kind: 'support', target: 10, at: 11 };
    startAction(state, worker, 'stitch', { x: 1, y: 0 }, 60, 6, [], 10);
    const project = (x: number, y: number): [number, number] => [x * 10, y * 10];
    const draw = () => {
      const rects: number[][] = [];
      const ctx = {
        save() {},
        restore() {},
        fillRect(...r: number[]) {
          rects.push(r);
        },
      } as unknown as CanvasRenderingContext2D;
      const items: Array<{ depth: number; draw: () => void }> = [];
      appendWebRepairDraws(ctx, state, worker, items, project, 2);
      items.forEach((item) => item.draw());
      return rects;
    };
    state.tick = 130;
    const halfway = draw();
    expect(halfway).toHaveLength(3);
    expect(halfway[2][2]).toBe(18); // half of the 36px inner bar at zoom 2
    expect(halfway[2][1] + halfway[2][3]).toBeLessThan(project(worker.x, worker.y)[1] - 48);
    state.tick = 145;
    expect(draw()[2][2]).toBe(27);
    worker.stunnedUntil = 160;
    expect(draw()).toHaveLength(0);
    worker.stunnedUntil = 0;
    worker.action = undefined;
    expect(draw()).toHaveLength(0);
  });
});
