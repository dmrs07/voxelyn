import { describe, expect, it } from 'vitest';
import { FEATURE_GATE, FEATURE_ROOT_BARRIER } from '../game/constants';
import { createGameState } from '../game/state';
import type { LevelState } from '../game/types';

const idx = (w: number, x: number, y: number): number => y * w + x;

const isGateClosedAt = (level: LevelState, x: number, y: number): boolean => {
  for (const item of level.interactables) {
    if (item.type !== 'gate') continue;
    if (item.x === x && item.y === y) return !item.open;
  }
  return false;
};

const isNavigableCell = (level: LevelState, x: number, y: number): boolean => {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return false;
  const i = idx(level.width, x, y);
  if ((level.heightMap[i] ?? 1) >= 0.5) return false;

  const flags = level.featureMap[i] ?? 0;
  if ((flags & FEATURE_ROOT_BARRIER) !== 0) return false;
  if ((flags & FEATURE_GATE) !== 0 && isGateClosedAt(level, x, y)) return false;
  return true;
};

const hasReachableExit = (level: LevelState): boolean => {
  if (!isNavigableCell(level, level.entry.x, level.entry.y)) return false;
  if (!isNavigableCell(level, level.exit.x, level.exit.y)) return false;

  const queueX = new Int16Array(level.width * level.height);
  const queueY = new Int16Array(level.width * level.height);
  const visited = new Uint8Array(level.width * level.height);
  let head = 0;
  let tail = 0;

  queueX[tail] = level.entry.x;
  queueY[tail] = level.entry.y;
  visited[idx(level.width, level.entry.x, level.entry.y)] = 1;
  tail += 1;

  while (head < tail) {
    const x = queueX[head] ?? 0;
    const y = queueY[head] ?? 0;
    head += 1;

    if (x === level.exit.x && y === level.exit.y) return true;

    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const;

    for (const [nx, ny] of neighbors) {
      if (!isNavigableCell(level, nx, ny)) continue;
      const i = idx(level.width, nx, ny);
      if (visited[i] === 1) continue;
      visited[i] = 1;
      queueX[tail] = nx;
      queueY[tail] = ny;
      tail += 1;
    }
  }

  return false;
};

describe('terminal/gate puzzle solvability', () => {
  it('keeps each closed gate linked to two terminals (or defaults to open gate)', () => {
    let checkedGates = 0;

    for (let seed = 0; seed < 24; seed += 1) {
      const state = createGameState(12000 + seed * 31);
      for (const gate of state.level.interactables) {
        if (gate.type !== 'gate') continue;
        checkedGates += 1;

        const linked = state.level.interactables.filter(
          (item) => item.type === 'terminal' && item.linkedGateId === gate.id
        );

        if (!gate.open) {
          expect(linked.length).toBe(2);
        } else {
          expect(linked.length).toBeLessThanOrEqual(2);
        }
      }
    }

    expect(checkedGates).toBeGreaterThan(0);
  });

  it('never soft-locks path to the floor objective', () => {
    for (let seed = 0; seed < 24; seed += 1) {
      const state = createGameState(22000 + seed * 59);
      const level = state.level;

      const initiallyReachable = hasReachableExit(level);
      if (initiallyReachable) {
        expect(initiallyReachable).toBe(true);
        continue;
      }

      for (const item of level.interactables) {
        if (item.type === 'terminal') item.active = true;
      }
      for (const gate of level.interactables) {
        if (gate.type !== 'gate') continue;
        const linked = level.interactables.filter(
          (item): item is Extract<(typeof level.interactables)[number], { type: 'terminal' }> =>
            item.type === 'terminal' && item.linkedGateId === gate.id
        );
        gate.open = linked.length === 0 || linked.every((terminal) => terminal.active);
      }

      expect(hasReachableExit(level)).toBe(true);
    }
  });
});
