import { RNG } from '@voxelyn/core';
import type { GameState, PowerUpChoice, PowerUpId } from '../game/types';
import { POWER_UP_IDS, POWER_UP_POOL } from './pool';

export const rollDistinctPowerUps = (rng: RNG): [PowerUpId, PowerUpId] => {
  const first = POWER_UP_IDS[rng.nextInt(POWER_UP_IDS.length)] ?? POWER_UP_IDS[0]!;
  let second = POWER_UP_IDS[rng.nextInt(POWER_UP_IDS.length)] ?? POWER_UP_IDS[0]!;

  if (POWER_UP_IDS.length > 1) {
    let guard = 0;
    while (second === first && guard < 16) {
      second = POWER_UP_IDS[rng.nextInt(POWER_UP_IDS.length)] ?? POWER_UP_IDS[0]!;
      guard += 1;
    }
    if (second === first) {
      second = POWER_UP_IDS.find((id) => id !== first) ?? first;
    }
  }

  return [first, second];
};

export const enqueuePowerUpChoice = (state: GameState, choice: PowerUpChoice): void => {
  state.pendingPowerUpChoices.push(choice);
};

export const startNextPowerUpChoiceIfNeeded = (state: GameState): void => {
  if (state.activePowerUpChoice) return;
  if (state.pendingPowerUpChoices.length === 0) return;

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
  } else {
    state.phase = 'running';
  }

  return true;
};
