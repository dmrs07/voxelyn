import { describe, expect, it } from 'vitest';
import { tryPlayerBumpAction } from '../combat/combat';
import { createEnemy } from '../entities/enemy';
import { createGameState, getPlayer } from '../game/state';
import { registerEntity } from '../world/level';

const neighbors = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

describe('animation integration', () => {
  it('sets move/attack/hit intents during core combat flow', () => {
    const state = createGameState(555);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    const movable = neighbors
      .map((n) => ({ x: player.x + n.x, y: player.y + n.y, dx: n.x, dy: n.y }))
      .find((c) => c.x >= 0 && c.y >= 0 && c.x < state.level.width && c.y < state.level.height);

    expect(movable).toBeDefined();
    if (!movable) return;

    const moveRes = tryPlayerBumpAction(state, player, movable.dx, movable.dy, state.simTimeMs + 1000);
    if (moveRes.moved) {
      expect(player.animIntent).toBe('move');
    }

    // Place a guaranteed adjacent enemy for bump attack.
    const enemyX = player.x + 1 < state.level.width ? player.x + 1 : player.x - 1;
    const enemyY = player.y;
    const enemy = createEnemy('e999', 999, 'stalker', enemyX, enemyY, state.floorNumber);
    registerEntity(state.level, enemy);

    player.nextAttackAt = 0;
    const attackDx = enemy.x - player.x;
    const attackDy = enemy.y - player.y;
    const attackRes = tryPlayerBumpAction(state, player, attackDx, attackDy, state.simTimeMs + 2000);

    expect(attackRes.attacked).toBe(true);
    expect(player.animIntent).toBe('attack');
    expect(enemy.animIntent === 'hit' || enemy.animIntent === 'die').toBe(true);
  });
});
