import { describe, expect, it } from 'vitest';
import { DYNAMIC_SOFTLOCK_GRACE_MS } from '../game/constants';
import { createGameState, getPlayer } from '../game/state';
import {
  hasPathToGoal,
  updateDynamicCorridors,
} from '../world/dynamic-corridors';
import { inBounds2D, isWalkableCell } from '../world/level';

describe('dynamic softlock guard', () => {
  it('recovers route when dynamic blockers temporarily trap the player', () => {
    const state = createGameState(88001);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    const dirs: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    const passableNeighbors: Array<{ x: number; y: number }> = [];
    for (const [dx, dy] of dirs) {
      const x = player.x + dx;
      const y = player.y + dy;
      if (!inBounds2D(state.level, x, y)) continue;
      if (!isWalkableCell(state.level, x, y, player.occ)) continue;
      passableNeighbors.push({ x, y });
    }

    expect(passableNeighbors.length).toBeGreaterThan(0);
    if (passableNeighbors.length === 0) return;

    for (const cell of passableNeighbors) {
      state.level.dynamicCells.push({
        id: `dyn_lock_${cell.x}_${cell.y}`,
        kind: 'pressure_gate',
        x: cell.x,
        y: cell.y,
        phase: 'closed',
        nextTransitionMs: 999999,
        openMs: 1200,
        warningMs: 300,
        closedMs: 900,
        damagePerTick: 0,
        slowMs: 0,
        nextDamageTickAt: 0,
      });
    }

    expect(
      hasPathToGoal(state.level, { x: player.x, y: player.y }, state.level.exit)
    ).toBe(false);

    state.simTimeMs = 6000;
    state.pathRecovery.blockedSinceMs = state.simTimeMs - DYNAMIC_SOFTLOCK_GRACE_MS - 1;
    state.pathRecovery.lastPathCheckAtMs = 0;
    updateDynamicCorridors(state);

    expect(state.pathRecovery.forcedOpenCount).toBeGreaterThan(0);
    expect(
      hasPathToGoal(state.level, { x: player.x, y: player.y }, state.level.exit)
    ).toBe(true);
  });
});
