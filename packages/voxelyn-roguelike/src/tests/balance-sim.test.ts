import { describe, expect, it } from 'vitest';
import {
  tryPlayerBumpAction,
  updateParticles,
  updateProjectiles,
} from '../combat/combat';
import { updateEnemiesAI } from '../entities/ai';
import { applyPlayerRegen } from '../entities/player';
import { createEnemy } from '../entities/enemy';
import {
  MATERIAL_FUNGAL_FLOOR,
  SIMULATION_STEP_MS,
} from '../game/constants';
import {
  createGameState,
  getPlayer,
  handleEnemyKills,
} from '../game/state';
import type { EnemyArchetype, EnemyState, GameState, PlayerState, PowerUpId, Vec2 } from '../game/types';
import { POWER_UP_POOL } from '../powerups/pool';
import {
  resolvePowerUpChoice,
  startNextPowerUpChoiceIfNeeded,
} from '../powerups/system';
import {
  featureFlagsAt,
  inBounds2D,
  isWalkableCell,
  nextEntityIdentity,
  registerEntity,
  setMaterialAt,
  unregisterEntity,
} from '../world/level';

type BotInput = Vec2;
type BotProfile = 'cautious' | 'brawler';

type SimResult = {
  survived: boolean;
  won: boolean;
  hp: number;
  maxHp: number;
  steps: number;
  kills: number;
  remainingEnemies: number;
};

const neighbors: Vec2[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const manhattan = (a: Vec2, b: Vec2): number =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const clearEnemies = (state: GameState): void => {
  for (const entity of Array.from(state.level.entities.values())) {
    if (entity.kind === 'enemy') unregisterEntity(state.level, entity);
  }
};

const makeArena = (state: GameState, player: PlayerState, radius = 8): void => {
  const flags = state.level.featureMap;
  for (let y = player.y - radius; y <= player.y + radius; y += 1) {
    for (let x = player.x - radius; x <= player.x + radius; x += 1) {
      if (!inBounds2D(state.level, x, y)) continue;
      setMaterialAt(state.level, x, y, 0, MATERIAL_FUNGAL_FLOOR);
      const idx = y * state.level.width + x;
      flags[idx] = 0;
    }
  }
};

const spawnArenaEnemy = (
  state: GameState,
  archetype: EnemyArchetype,
  x: number,
  y: number,
  floor = state.floorNumber
): EnemyState => {
  const identity = nextEntityIdentity(state.level);
  const enemy = createEnemy(identity.id, identity.occ, archetype, x, y, floor);
  registerEntity(state.level, enemy);
  return enemy;
};

const aliveEnemies = (state: GameState): EnemyState[] =>
  Array.from(state.level.entities.values()).filter(
    (entity): entity is EnemyState => entity.kind === 'enemy' && entity.alive
  );

const directionToward = (from: Vec2, to: Vec2): Vec2 => {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) && dx !== 0) {
    return { x: dx, y: 0 };
  }
  if (dy !== 0) return { x: 0, y: dy };
  return { x: dx, y: 0 };
};

const weakestAdjacentEnemy = (state: GameState, player: PlayerState): EnemyState | null => {
  const adjacent = aliveEnemies(state)
    .filter((enemy) => manhattan(player, enemy) === 1)
    .sort((a, b) => (a.hp - b.hp) || (b.attack - a.attack));
  return adjacent[0] ?? null;
};

const nearestEnemy = (state: GameState, player: PlayerState): EnemyState | null => {
  const enemies = aliveEnemies(state)
    .sort((a, b) => (manhattan(player, a) - manhattan(player, b)) || (a.hp - b.hp));
  return enemies[0] ?? null;
};

const safeRetreat = (state: GameState, player: PlayerState): BotInput | null => {
  const enemies = aliveEnemies(state);
  if (enemies.length === 0) return null;

  const options = neighbors
    .map((n) => ({ dx: n.x, dy: n.y, x: player.x + n.x, y: player.y + n.y }))
    .filter((candidate) => isWalkableCell(state.level, candidate.x, candidate.y, player.occ))
    .map((candidate) => {
      const nearestDistance = Math.min(...enemies.map((enemy) => manhattan(candidate, enemy)));
      const adjacentThreat = enemies
        .filter((enemy) => manhattan(candidate, enemy) === 1)
        .reduce((sum, enemy) => sum + enemy.attack, 0);
      const featurePenalty = featureFlagsAt(state.level, candidate.x, candidate.y) === 0 ? 0 : 4;
      return {
        ...candidate,
        score: nearestDistance * 5 - adjacentThreat * 2 - featurePenalty,
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = options[0];
  if (!best) return null;
  return { x: best.dx, y: best.dy };
};

const choosePowerUp = (state: GameState): 1 | 2 => {
  const choice = state.activePowerUpChoice;
  const player = getPlayer(state);
  if (!choice || !player) return 1;

  const score = (id: PowerUpId): number => {
    if (id === 'vital_boost') return player.hp < player.maxHp * 0.48 ? 100 : 35;
    if (id === 'iron_skin') return 80;
    if (id === 'attack_boost') return 75;
    if (id === 'fungal_regen') return 60;
    if (id === 'vampiric_spores') return 50;
    if (id === 'swift_boots') return 45;
    return POWER_UP_POOL[id] ? 1 : 0;
  };

  return score(choice.options[0]) >= score(choice.options[1]) ? 1 : 2;
};

const chooseBotInput = (state: GameState, profile: BotProfile): BotInput => {
  const player = getPlayer(state);
  if (!player) return { x: 0, y: 0 };

  const adjacent = weakestAdjacentEnemy(state, player);
  if (adjacent) {
    if (profile === 'brawler') return directionToward(player, adjacent);
    if (state.simTimeMs >= player.nextAttackAt) {
      return directionToward(player, adjacent);
    }
    return safeRetreat(state, player) ?? directionToward(player, adjacent);
  }

  const nearest = nearestEnemy(state, player);
  if (!nearest) return { x: 0, y: 0 };

  const distance = manhattan(player, nearest);
  if (player.hp < player.maxHp * 0.28 && distance <= 4) {
    return safeRetreat(state, player) ?? { x: 0, y: 0 };
  }

  return directionToward(player, nearest);
};

const simulateStep = (state: GameState, input: BotInput): number => {
  state.simTick += 1;
  state.simTimeMs += SIMULATION_STEP_MS;

  state.screenFlash.damageMs = Math.max(0, state.screenFlash.damageMs - SIMULATION_STEP_MS);
  state.screenFlash.healMs = Math.max(0, state.screenFlash.healMs - SIMULATION_STEP_MS);
  state.cameraShakeMs = Math.max(0, state.cameraShakeMs - SIMULATION_STEP_MS);
  state.uiAlerts = state.uiAlerts.filter((item) => item.untilMs > state.simTimeMs);

  for (const entity of state.level.entities.values()) {
    if (!entity.alive) {
      entity.animIntent = 'die';
    } else if (entity.animIntent !== 'die' && state.simTimeMs >= entity.nextMoveAt) {
      entity.animIntent = 'idle';
    }
  }

  if (state.phase === 'powerup_choice') {
    resolvePowerUpChoice(state, choosePowerUp(state));
    updateParticles(state, SIMULATION_STEP_MS);
    return 0;
  }

  const player = getPlayer(state);
  if (!player || !player.alive) {
    state.phase = 'game_over';
    return 0;
  }

  applyPlayerRegen(player, SIMULATION_STEP_MS);

  let kills = 0;
  if (input.x !== 0 || input.y !== 0) {
    const action = tryPlayerBumpAction(state, player, input.x, input.y, state.simTimeMs);
    kills += action.killedEnemyIds.length;
    if (action.killedEnemyIds.length > 0) handleEnemyKills(state, action.killedEnemyIds);
  }

  updateEnemiesAI(state, state.simTimeMs);
  const playerAfterAi = getPlayer(state);
  if (!playerAfterAi || !playerAfterAi.alive) {
    state.phase = 'game_over';
    return kills;
  }

  const projectileResult = updateProjectiles(state, SIMULATION_STEP_MS);
  kills += projectileResult.killedEnemyIds.length;
  if (projectileResult.killedEnemyIds.length > 0) {
    handleEnemyKills(state, projectileResult.killedEnemyIds);
  }

  updateParticles(state, SIMULATION_STEP_MS);
  startNextPowerUpChoiceIfNeeded(state);
  return kills;
};

const runArena = (
  seed: number,
  enemies: Array<{ archetype: EnemyArchetype; offset: Vec2; floor?: number }>,
  profile: BotProfile,
  maxSteps = 900
): SimResult => {
  const state = createGameState(seed);
  const player = getPlayer(state);
  expect(player).not.toBeNull();
  if (!player) {
    return { survived: false, won: false, hp: 0, maxHp: 0, steps: 0, kills: 0, remainingEnemies: 0 };
  }

  clearEnemies(state);
  makeArena(state, player);

  for (const enemy of enemies) {
    spawnArenaEnemy(
      state,
      enemy.archetype,
      player.x + enemy.offset.x,
      player.y + enemy.offset.y,
      enemy.floor ?? state.floorNumber
    );
  }

  let kills = 0;
  let steps = 0;
  for (; steps < maxSteps; steps += 1) {
    const enemiesLeft = aliveEnemies(state).length;
    if (state.phase === 'game_over' || enemiesLeft === 0) break;
    kills += simulateStep(state, chooseBotInput(state, profile));
  }

  const finalPlayer = getPlayer(state);
  const remainingEnemies = aliveEnemies(state).length;
  return {
    survived: Boolean(finalPlayer?.alive),
    won: remainingEnemies === 0 && Boolean(finalPlayer?.alive),
    hp: Math.ceil(finalPlayer?.hp ?? 0),
    maxHp: finalPlayer?.maxHp ?? 0,
    steps,
    kills,
    remainingEnemies,
  };
};

describe('balance sim', () => {
  it('keeps bruiser pressure dangerous but playable across bot profiles', () => {
    const singleBruiser = Array.from({ length: 8 }, (_, i) =>
      runArena(41000 + i * 17, [
        { archetype: 'bruiser', offset: { x: 4, y: 0 } },
      ], 'cautious')
    );
    const doubleBruiser = Array.from({ length: 8 }, (_, i) =>
      runArena(42000 + i * 17, [
        { archetype: 'bruiser', offset: { x: 4, y: 0 } },
        { archetype: 'stalker', offset: { x: 0, y: 4 } },
      ], 'cautious')
    );
    const brawlerBruiser = Array.from({ length: 8 }, (_, i) =>
      runArena(43000 + i * 17, [
        { archetype: 'bruiser', offset: { x: 4, y: 0 } },
      ], 'brawler')
    );
    const brawlerDouble = Array.from({ length: 8 }, (_, i) =>
      runArena(44000 + i * 17, [
        { archetype: 'bruiser', offset: { x: 4, y: 0 } },
        { archetype: 'bruiser', offset: { x: 0, y: 4 } },
      ], 'brawler')
    );
    const midFloorBruiser = Array.from({ length: 8 }, (_, i) =>
      runArena(45000 + i * 17, [
        { archetype: 'bruiser', offset: { x: 4, y: 0 }, floor: 5 },
      ], 'brawler')
    );

    const singleWins = singleBruiser.filter((r) => r.won).length;
    const doubleWins = doubleBruiser.filter((r) => r.won).length;
    const brawlerWins = brawlerBruiser.filter((r) => r.won).length;
    const brawlerDoubleWins = brawlerDouble.filter((r) => r.won).length;
    const midFloorWins = midFloorBruiser.filter((r) => r.won).length;
    const singleAvgHp = singleBruiser.reduce((sum, r) => sum + r.hp, 0) / singleBruiser.length;
    const doubleAvgHp = doubleBruiser.reduce((sum, r) => sum + r.hp, 0) / doubleBruiser.length;
    const brawlerAvgHp = brawlerBruiser.reduce((sum, r) => sum + r.hp, 0) / brawlerBruiser.length;
    const brawlerDoubleAvgHp = brawlerDouble.reduce((sum, r) => sum + r.hp, 0) / brawlerDouble.length;
    const midFloorAvgHp = midFloorBruiser.reduce((sum, r) => sum + r.hp, 0) / midFloorBruiser.length;

    console.info('[balance-sim] single bruiser', { singleWins, singleAvgHp, singleBruiser });
    console.info('[balance-sim] bruiser + stalker', { doubleWins, doubleAvgHp, doubleBruiser });
    console.info('[balance-sim] brawler single bruiser', { brawlerWins, brawlerAvgHp, brawlerBruiser });
    console.info('[balance-sim] brawler double bruiser', { brawlerDoubleWins, brawlerDoubleAvgHp, brawlerDouble });
    console.info('[balance-sim] brawler floor 5 bruiser', { midFloorWins, midFloorAvgHp, midFloorBruiser });

    expect(singleWins).toBeGreaterThanOrEqual(7);
    expect(singleAvgHp).toBeGreaterThanOrEqual(38);
    expect(singleAvgHp).toBeLessThanOrEqual(82);
    expect(doubleWins).toBeGreaterThanOrEqual(5);
    expect(doubleAvgHp).toBeGreaterThanOrEqual(20);
    expect(brawlerWins).toBeGreaterThanOrEqual(7);
    expect(brawlerAvgHp).toBeGreaterThanOrEqual(30);
    expect(brawlerDoubleWins).toBeGreaterThanOrEqual(4);
    expect(brawlerDoubleAvgHp).toBeGreaterThanOrEqual(22);
    expect(brawlerDoubleAvgHp).toBeLessThanOrEqual(45);
    expect(midFloorWins).toBeGreaterThanOrEqual(6);
    expect(midFloorAvgHp).toBeGreaterThanOrEqual(35);
    expect(midFloorAvgHp).toBeLessThanOrEqual(70);
  });
});
