import { describe, expect, it } from 'vitest';
import { createEnemy } from '../entities/enemy';
import {
  advanceToNextFloor,
  createGameState,
  getPlayer,
  shouldTriggerVictory,
} from '../game/state';
import { attackEntity } from '../combat/combat';
import { nextEntityIdentity, registerEntity, unregisterEntity } from '../world/level';

describe('progression', () => {
  it('preserves player progression when advancing floor', () => {
    const state = createGameState(3030);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    player.attack += 5;
    player.powerUps.push('attack_boost');

    advanceToNextFloor(state);

    const nextPlayer = getPlayer(state);
    expect(nextPlayer).not.toBeNull();
    if (!nextPlayer) return;

    expect(state.floorNumber).toBe(2);
    expect(nextPlayer.attack).toBe(player.attack);
    expect(nextPlayer.powerUps).toContain('attack_boost');
  });

  it('triggers victory conditions on floor 10 objective without guardian', () => {
    const state = createGameState(4040);

    while (state.floorNumber < 10) {
      advanceToNextFloor(state);
    }

    for (const entity of Array.from(state.level.entities.values())) {
      if (entity.kind === 'enemy' && entity.archetype === 'guardian') {
        entity.alive = false;
        unregisterEntity(state.level, entity);
      }
    }

    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    player.x = state.level.exit.x;
    player.y = state.level.exit.y;

    expect(shouldTriggerVictory(state)).toBe(true);
  });

  it('can reach game over when player is killed', () => {
    const state = createGameState(5050);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    const identity = nextEntityIdentity(state.level);
    const killer = createEnemy(identity.id, identity.occ, 'guardian', player.x + 1, player.y, state.floorNumber);
    killer.attack = 999;
    registerEntity(state.level, killer);

    const result = attackEntity(state, killer, player, state.simTimeMs);
    expect(result.didAttack).toBe(true);
    expect(player.alive).toBe(false);
    expect(player.hp).toBe(0);
  });
});
