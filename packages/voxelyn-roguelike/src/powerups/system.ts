import { RNG } from '@voxelyn/core';
import { POWERUP_SAFE_CHOICE_RADIUS } from '../game/constants';
import type { GameState, PlayerState, PowerUpChoice, PowerUpId } from '../game/types';
import { POWER_UP_IDS, POWER_UP_POOL } from './pool';

export const getPowerUpStacks = (player: PlayerState): Record<PowerUpId, number> => {
  const counts = {} as Record<PowerUpId, number>;
  for (const id of POWER_UP_IDS) {
    counts[id] = 0;
  }
  for (const id of player.powerUps) {
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
};

const getAvailablePowerUps = (player: PlayerState): PowerUpId[] => {
  const stacks = getPowerUpStacks(player);
  return POWER_UP_IDS.filter((id) => {
    const def = POWER_UP_POOL[id];
    const maxStacks = def?.maxStacks ?? Number.POSITIVE_INFINITY;
    return (stacks[id] ?? 0) < maxStacks;
  });
};

export const rollDistinctPowerUps = (rng: RNG, player: PlayerState): [PowerUpId, PowerUpId] | null => {
  const available = getAvailablePowerUps(player);
  if (available.length < 2) return null;

  const first = available[rng.nextInt(available.length)] ?? available[0]!;
  let second = available[rng.nextInt(available.length)] ?? available[0]!;

  if (available.length > 1) {
    let guard = 0;
    while (second === first && guard < 16) {
      second = available[rng.nextInt(available.length)] ?? available[0]!;
      guard += 1;
    }
    if (second === first) {
      second = available.find((id) => id !== first) ?? first;
    }
  }

  return [first, second];
};

export const enqueuePowerUpChoice = (state: GameState, choice: PowerUpChoice): void => {
  state.pendingPowerUpChoices.push(choice);
};

const hasNearbyThreat = (state: GameState): boolean => {
  const player = state.level.entities.get(state.playerId);
  if (!player || player.kind !== 'player') return true;

  for (const entity of state.level.entities.values()) {
    if (entity.kind !== 'enemy' || !entity.alive) continue;
    const dx = Math.abs(entity.x - player.x);
    const dy = Math.abs(entity.y - player.y);
    if (dx + dy <= POWERUP_SAFE_CHOICE_RADIUS) return true;
  }

  return state.projectiles.some((projectile) => projectile.alive);
};

export const startNextPowerUpChoiceIfNeeded = (state: GameState): void => {
  if (state.activePowerUpChoice) return;
  if (state.pendingPowerUpChoices.length === 0) return;
  if (hasNearbyThreat(state)) return;

  const next = state.pendingPowerUpChoices.shift() ?? null;
  if (!next) return;

  state.activePowerUpChoice = next;
  state.phase = 'powerup_choice';
};

export const resolvePowerUpChoice = (state: GameState, pick: 1 | 2): boolean => {
  const active = state.activePowerUpChoice;
  if (!active) return false;

  const selected = pick === 1 ? active.options[0] : active.options[1];
  const player = state.level.entities.get(state.playerId);
  if (!player || player.kind !== 'player') return false;

  const definition = POWER_UP_POOL[selected];
  if (!definition) return false;

  definition.apply(player);
  player.powerUps.push(selected);
  state.messages.push(`Power-up adquirido: ${definition.name}`);

  state.activePowerUpChoice = null;
  if (state.pendingPowerUpChoices.length > 0) {
    startNextPowerUpChoiceIfNeeded(state);
  }

  if (!state.activePowerUpChoice) {
    state.phase = 'running';
  }

  return true;
};
