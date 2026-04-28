import { RNG } from '@voxelyn/core';
import { describe, expect, it } from 'vitest';
import { createEnemy } from '../entities/enemy';
import { POWERUP_KILLS_PER_CHOICE_EARLY } from '../game/constants';
import { createGameState, getPlayer, handleEnemyKills } from '../game/state';
import { POWER_UP_POOL } from '../powerups/pool';
import {
  enqueuePowerUpChoice,
  resolvePowerUpChoice,
  rollDistinctPowerUps,
  startNextPowerUpChoiceIfNeeded,
} from '../powerups/system';
import { nextEntityIdentity, registerEntity, unregisterEntity } from '../world/level';

const clearEnemies = (state: ReturnType<typeof createGameState>): void => {
  for (const entity of Array.from(state.level.entities.values())) {
    if (entity.kind === 'enemy') unregisterEntity(state.level, entity);
  }
};

describe('powerups', () => {
  it('rolls two distinct options while pool has multiple choices', () => {
    const rng = new RNG(123);
    const state = createGameState(9999);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    for (let i = 0; i < 25; i += 1) {
      const rolled = rollDistinctPowerUps(rng, player);
      expect(rolled).not.toBeNull();
      if (!rolled) return;
      const [a, b] = rolled;
      expect(a).not.toBe(b);
    }
  });

  it('excludes power-ups that reached max stacks', () => {
    const rng = new RNG(456);
    const state = createGameState(1000);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    const cappedId = 'attack_boost';
    const cap = POWER_UP_POOL[cappedId].maxStacks ?? 0;
    for (let i = 0; i < cap; i += 1) {
      player.powerUps.push(cappedId);
    }

    const rolled = rollDistinctPowerUps(rng, player);
    expect(rolled).not.toBeNull();
    if (!rolled) return;
    const [a, b] = rolled;
    expect(a).not.toBe(cappedId);
    expect(b).not.toBe(cappedId);
  });

  it('returns null when no power-ups remain', () => {
    const rng = new RNG(789);
    const state = createGameState(1003);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    for (const [id, def] of Object.entries(POWER_UP_POOL)) {
      const max = def.maxStacks ?? 0;
      for (let i = 0; i < max; i += 1) {
        player.powerUps.push(id as keyof typeof POWER_UP_POOL);
      }
    }

    const rolled = rollDistinctPowerUps(rng, player);
    expect(rolled).toBeNull();
  });

  it('applies chosen power-up effect to player stats', () => {
    const state = createGameState(1001);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    const beforeAttack = player.attack;
    clearEnemies(state);

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
    clearEnemies(state);

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

  it('gates reward choices behind a kill meter instead of every kill', () => {
    const state = createGameState(1004);
    clearEnemies(state);

    handleEnemyKills(state, ['e101', 'e102', 'e103']);
    expect(state.pendingPowerUpChoices.length).toBe(0);
    expect(state.powerUpKillCharge).toBe(POWERUP_KILLS_PER_CHOICE_EARLY - 1);

    handleEnemyKills(state, ['e104']);
    expect(state.pendingPowerUpChoices.length).toBe(1);
    expect(state.powerUpKillCharge).toBe(0);
  });

  it('waits to open reward choices while a threat is nearby', () => {
    const state = createGameState(1005);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    clearEnemies(state);

    const identity = nextEntityIdentity(state.level);
    const enemyX = player.x + 1 < state.level.width ? player.x + 1 : player.x - 1;
    const enemy = createEnemy(identity.id, identity.occ, 'stalker', enemyX, player.y, state.floorNumber);
    registerEntity(state.level, enemy);

    enqueuePowerUpChoice(state, {
      sourceEnemyId: 'e777',
      options: ['attack_boost', 'swift_boots'],
    });
    startNextPowerUpChoiceIfNeeded(state);

    expect(state.activePowerUpChoice).toBeNull();
    expect(state.phase).toBe('running');
    expect(state.pendingPowerUpChoices.length).toBe(1);
  });
});
