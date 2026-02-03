import { RNG } from '@voxelyn/core';
import { describe, expect, it } from 'vitest';
import { createGameState, getPlayer } from '../game/state';
import {
  enqueuePowerUpChoice,
  resolvePowerUpChoice,
  rollDistinctPowerUps,
  startNextPowerUpChoiceIfNeeded,
} from '../powerups/system';

describe('powerups', () => {
  it('always rolls two distinct options', () => {
    const rng = new RNG(123);
    for (let i = 0; i < 50; i += 1) {
      const [a, b] = rollDistinctPowerUps(rng);
      expect(a).not.toBe(b);
    }
  });

  it('applies chosen power-up effect to player stats', () => {
    const state = createGameState(1001);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    const beforeAttack = player.attack;

    enqueuePowerUpChoice(state, {
      sourceEnemyId: 'e999',
      options: ['attack_boost', 'vital_boost'],
    });
    startNextPowerUpChoiceIfNeeded(state);

    expect(state.phase).toBe('powerup_choice');
    expect(resolvePowerUpChoice(state, 1)).toBe(true);
    expect(player.attack).toBeGreaterThan(beforeAttack);
    expect(state.phase).toBe('running');
  });

  it('processes queued choices one by one', () => {
    const state = createGameState(1002);

    enqueuePowerUpChoice(state, {
      sourceEnemyId: 'e11',
      options: ['attack_boost', 'swift_boots'],
    });
    enqueuePowerUpChoice(state, {
      sourceEnemyId: 'e12',
      options: ['vital_boost', 'fungal_regen'],
    });

    startNextPowerUpChoiceIfNeeded(state);
    expect(state.activePowerUpChoice).not.toBeNull();
    expect(state.phase).toBe('powerup_choice');

    expect(resolvePowerUpChoice(state, 2)).toBe(true);
    expect(state.phase).toBe('powerup_choice');
    expect(state.activePowerUpChoice).not.toBeNull();

    expect(resolvePowerUpChoice(state, 1)).toBe(true);
    expect(state.activePowerUpChoice).toBeNull();
    expect(state.phase).toBe('running');
  });
});
