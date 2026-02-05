import { describe, expect, it } from 'vitest';
import { createGameState, getPlayer } from '../game/state';
import { updateDynamicCorridors } from '../world/dynamic-corridors';
import { inBounds2D, isWalkableCell } from '../world/level';

describe('dynamic corridors', () => {
  it('cycles open -> warning -> closed -> open deterministically', () => {
    const state = createGameState(55221);
    const cell = state.level.dynamicCells[0];
    expect(cell).toBeDefined();
    if (!cell) return;

    cell.kind = 'pressure_gate';
    cell.phase = 'open';
    cell.openMs = 100;
    cell.warningMs = 70;
    cell.closedMs = 90;
    cell.nextTransitionMs = 100;

    state.simTimeMs = 100;
    updateDynamicCorridors(state);
    expect(cell.phase).toBe('warning');

    state.simTimeMs = 170;
    updateDynamicCorridors(state);
    expect(cell.phase).toBe('closed');

    state.simTimeMs = 260;
    updateDynamicCorridors(state);
    expect(cell.phase).toBe('open');
  });

  it('blocks passability when a blocking dynamic cell is closed', () => {
    const state = createGameState(55222);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    const dirs: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    let target: { x: number; y: number } | null = null;
    for (const [dx, dy] of dirs) {
      const x = player.x + dx;
      const y = player.y + dy;
      if (!inBounds2D(state.level, x, y)) continue;
      if (!isWalkableCell(state.level, x, y, player.occ)) continue;
      target = { x, y };
      break;
    }

    expect(target).not.toBeNull();
    if (!target) return;

    state.level.dynamicCells.push({
      id: `dyn_test_${target.x}_${target.y}`,
      kind: 'pressure_gate',
      x: target.x,
      y: target.y,
      phase: 'closed',
      nextTransitionMs: 999999,
      openMs: 1000,
      warningMs: 300,
      closedMs: 900,
      damagePerTick: 0,
      slowMs: 0,
      nextDamageTickAt: 0,
    });

    expect(isWalkableCell(state.level, target.x, target.y, player.occ)).toBe(false);
  });
});
