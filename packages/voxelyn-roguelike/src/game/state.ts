import { RNG } from '@voxelyn/core';
import { createPlayer } from '../entities/player';
import { isEnemy } from '../entities/enemy';
import { rollDistinctPowerUps } from '../powerups/system';
import { generateFloor } from '../world/generator';
import { registerEntity } from '../world/level';
import { spawnEnemiesForFloor } from '../world/spawn';
import { FLOOR_COUNT_MVP } from './constants';
import type { GameState, LevelState, PlayerState, PowerUpChoice } from './types';

const createLevelState = (baseSeed: number, floorNumber: number): LevelState => {
  const generated = generateFloor(baseSeed, floorNumber);
  return {
    grid: generated.grid,
    entities: new Map(),
    occupancy: new Int32Array(generated.width * generated.height),
    entry: generated.entry,
    exit: generated.exit,
    floorNumber,
    seed: generated.seed,
    width: generated.width,
    height: generated.height,
    depth: generated.depth,
    nextEntityOcc: 0,
  };
};

const createPlayerForLevel = (level: LevelState, previous: PlayerState | null): PlayerState => {
  const id = previous?.id ?? 'e1';
  const occ = previous?.occ ?? 1;

  const player = createPlayer(id, occ, level.entry.x, level.entry.y);
  if (previous) {
    player.hp = Math.min(previous.hp, previous.maxHp);
    player.maxHp = previous.maxHp;
    player.attack = previous.attack;
    player.damageReduction = previous.damageReduction;
    player.powerUps = [...previous.powerUps];
    player.moveCooldownMs = previous.moveCooldownMs;
    player.attackCooldownMs = previous.attackCooldownMs;
    player.regenPerSecond = previous.regenPerSecond;
    player.lifeOnHit = previous.lifeOnHit;
  }

  level.nextEntityOcc = Math.max(level.nextEntityOcc, occ);
  registerEntity(level, player);
  return player;
};

const enqueueChoiceFromEnemyKill = (state: GameState, enemyId: string): void => {
  const occ = Number(enemyId.slice(1)) || 0;
  const rng = new RNG((state.level.seed ^ state.simTick ^ (occ * 7919)) >>> 0);
  const options = rollDistinctPowerUps(rng);
  const choice: PowerUpChoice = {
    sourceEnemyId: enemyId,
    options,
  };
  state.pendingPowerUpChoices.push(choice);
};

export const createGameState = (baseSeed: number): GameState => {
  const level = createLevelState(baseSeed, 1);
  const player = createPlayerForLevel(level, null);
  spawnEnemiesForFloor(level, 1, new RNG(level.seed ^ 0x77aa55));

  return {
    baseSeed,
    phase: 'running',
    level,
    playerId: player.id,
    floorNumber: 1,
    simTick: 0,
    simTimeMs: 0,
    pendingPowerUpChoices: [],
    activePowerUpChoice: null,
    damageEvents: [],
    messages: ['Desca na mina e alcance o nucleo no andar 10.'],
  };
};

export const getPlayer = (state: GameState): PlayerState | null => {
  const entity = state.level.entities.get(state.playerId);
  if (!entity || entity.kind !== 'player') return null;
  return entity;
};

export const hasAliveGuardian = (state: GameState): boolean => {
  for (const entity of state.level.entities.values()) {
    if (entity.kind === 'enemy' && entity.archetype === 'guardian' && entity.alive) {
      return true;
    }
  }
  return false;
};

export const handleEnemyKills = (state: GameState, killedEnemyIds: string[]): void => {
  for (const enemyId of killedEnemyIds) {
    enqueueChoiceFromEnemyKill(state, enemyId);
  }
};

export const shouldAdvanceFloor = (state: GameState): boolean => {
  const player = getPlayer(state);
  if (!player || !player.alive) return false;

  return player.x === state.level.exit.x && player.y === state.level.exit.y && state.floorNumber < FLOOR_COUNT_MVP;
};

export const shouldTriggerVictory = (state: GameState): boolean => {
  if (state.floorNumber !== FLOOR_COUNT_MVP) return false;
  const player = getPlayer(state);
  if (!player || !player.alive) return false;
  if (player.x !== state.level.exit.x || player.y !== state.level.exit.y) return false;
  return !hasAliveGuardian(state);
};

export const advanceToNextFloor = (state: GameState): void => {
  const currentPlayer = getPlayer(state);
  if (!currentPlayer) {
    state.phase = 'game_over';
    return;
  }

  const nextFloor = Math.min(FLOOR_COUNT_MVP, state.floorNumber + 1);
  state.phase = 'floor_transition';
  state.floorNumber = nextFloor;

  const level = createLevelState(state.baseSeed, nextFloor);
  const player = createPlayerForLevel(level, currentPlayer);
  spawnEnemiesForFloor(level, nextFloor, new RNG(level.seed ^ 0xa551cc));

  state.level = level;
  state.playerId = player.id;
  state.pendingPowerUpChoices = [];
  state.activePowerUpChoice = null;
  state.phase = 'running';
  state.messages.push(`Andar ${nextFloor} alcancado.`);
};

export const countAliveEnemies = (state: GameState): number => {
  let count = 0;
  for (const entity of state.level.entities.values()) {
    if (isEnemy(entity) && entity.alive) count += 1;
  }
  return count;
};
