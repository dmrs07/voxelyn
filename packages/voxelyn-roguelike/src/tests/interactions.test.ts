import { describe, expect, it } from 'vitest';
import {
  FEATURE_PROP_BEACON,
  FEATURE_PROP_CRATE,
  FEATURE_PROP_DEBRIS,
  FEATURE_PROP_FUNGAL_CLUSTER,
  INSPECT_OVERLAY_MS,
} from '../game/constants';
import { attemptInteractionAt, confirmInteractionModal } from '../game/interactions';
import { createGameState, getPlayer } from '../game/state';
import type { LevelInteractable } from '../game/types';
import { createEnemy } from '../entities/enemy';
import { inBounds2D, isWalkableCell, moveEntity, nextEntityIdentity, registerEntity, unregisterEntity } from '../world/level';

const findNearbyWalkable = (state: ReturnType<typeof createGameState>, x: number, y: number): { x: number; y: number } | null => {
  for (let r = 1; r <= 4; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds2D(state.level, nx, ny)) continue;
        if (dx === 0 && dy === 0) continue;
        if (isWalkableCell(state.level, nx, ny, 0)) {
          return { x: nx, y: ny };
        }
      }
    }
  }
  return null;
};

describe('interactions', () => {
  it('requires clearing enemies before terminal repair', () => {
    const state = createGameState(424242);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    const terminal = state.level.interactables.find(
      (item) => item.type === 'terminal'
    ) as Extract<LevelInteractable, { type: 'terminal' }> | undefined;
    expect(terminal).toBeDefined();
    if (!terminal) return;

    terminal.broken = true;
    terminal.active = false;

    expect(moveEntity(state.level, player, terminal.x, terminal.y)).toBe(true);

    const enemyPos = findNearbyWalkable(state, terminal.x, terminal.y);
    expect(enemyPos).not.toBeNull();
    if (!enemyPos) return;

    const { id, occ } = nextEntityIdentity(state.level);
    const enemy = createEnemy(id, occ, 'stalker', enemyPos.x, enemyPos.y, state.floorNumber);
    registerEntity(state.level, enemy);

    state.simTimeMs = 1000;
    const handledBlocked = attemptInteractionAt(state, { x: terminal.x, y: terminal.y });
    expect(handledBlocked).toBe(true);
    expect(state.interactionModal).toBeNull();
    expect(state.inspectOverlay).not.toBeNull();

    unregisterEntity(state.level, enemy);
    state.inspectOverlay = null;

    const handledReady = attemptInteractionAt(state, { x: terminal.x, y: terminal.y });
    expect(handledReady).toBe(true);
    expect(state.interactionModal).not.toBeNull();

    confirmInteractionModal(state);
    expect(terminal.broken).toBe(false);
    expect(terminal.active).toBe(true);
  });

  it('creates inspect overlay for decorative props', () => {
    const state = createGameState(80808);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    const decorationMask =
      FEATURE_PROP_FUNGAL_CLUSTER |
      FEATURE_PROP_DEBRIS |
      FEATURE_PROP_CRATE |
      FEATURE_PROP_BEACON;

    let targetIdx = -1;
    for (let i = 0; i < state.level.featureMap.length; i += 1) {
      if (((state.level.featureMap[i] ?? 0) & decorationMask) !== 0) {
        targetIdx = i;
        break;
      }
    }
    expect(targetIdx).toBeGreaterThanOrEqual(0);
    if (targetIdx < 0) return;

    const x = targetIdx % state.level.width;
    const y = Math.floor(targetIdx / state.level.width);
    expect(moveEntity(state.level, player, x, y)).toBe(true);

    state.simTimeMs = 2000;
    const handled = attemptInteractionAt(state, { x, y });
    expect(handled).toBe(true);
    expect(state.inspectOverlay).not.toBeNull();
    expect(state.inspectOverlay?.untilMs).toBe(state.simTimeMs + INSPECT_OVERLAY_MS);
  });
});
