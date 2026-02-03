import {
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_BASE_ATTACK,
  PLAYER_BASE_HP,
  PLAYER_MOVE_COOLDOWN_MS,
} from '../game/constants';
import type { PlayerState } from '../game/types';

export const createPlayer = (id: string, occ: number, x: number, y: number): PlayerState => ({
  id,
  occ,
  kind: 'player',
  x,
  y,
  z: 0,
  blocks: true,
  hp: PLAYER_BASE_HP,
  maxHp: PLAYER_BASE_HP,
  attack: PLAYER_BASE_ATTACK,
  damageReduction: 0,
  alive: true,
  nextMoveAt: 0,
  nextAttackAt: 0,
  facing: { x: 1, y: 0 },
  hitFlashUntilMs: 0,
  alertUntilMs: 0,
  animPhase: 0,
  powerUps: [],
  moveCooldownMs: PLAYER_MOVE_COOLDOWN_MS,
  attackCooldownMs: PLAYER_ATTACK_COOLDOWN_MS,
  regenPerSecond: 0,
  lifeOnHit: 0,
});

export const clampPlayerHp = (player: PlayerState): void => {
  if (player.hp > player.maxHp) player.hp = player.maxHp;
  if (player.hp < 0) player.hp = 0;
};

export const applyPlayerRegen = (player: PlayerState, stepMs: number): void => {
  if (player.regenPerSecond <= 0 || !player.alive) return;
  const gain = (player.regenPerSecond * stepMs) / 1000;
  if (gain <= 0) return;
  player.hp = Math.min(player.maxHp, player.hp + gain);
};
