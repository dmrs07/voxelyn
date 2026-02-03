import type { EnemyArchetype, MaterialId } from './types';

export const WORLD_WIDTH = 64;
export const WORLD_HEIGHT = 64;
export const WORLD_DEPTH = 4;

export const FLOOR_COUNT_MVP = 10;

export const SIMULATION_HZ = 20;
export const SIMULATION_STEP_MS = 1000 / SIMULATION_HZ;

export const PLAYER_BASE_HP = 100;
export const PLAYER_BASE_ATTACK = 12;
export const PLAYER_MOVE_COOLDOWN_MS = 90;
export const PLAYER_ATTACK_COOLDOWN_MS = 280;

export const PLAYER_MIN_SPAWN_DISTANCE = 8;

export const MATERIAL_AIR: MaterialId = 0;
export const MATERIAL_ROCK: MaterialId = 1;
export const MATERIAL_FUNGAL_FLOOR: MaterialId = 2;
export const MATERIAL_METAL_ORE: MaterialId = 3;
export const MATERIAL_EXIT: MaterialId = 4;
export const MATERIAL_ENTRY: MaterialId = 5;
export const MATERIAL_CORE: MaterialId = 6;

export const PASSABLE_MATERIALS = new Set<MaterialId>([
  MATERIAL_FUNGAL_FLOOR,
  MATERIAL_EXIT,
  MATERIAL_ENTRY,
  MATERIAL_CORE,
]);

export const ENEMY_ARCHETYPE_STATS: Record<
  EnemyArchetype,
  {
    hp: number;
    attack: number;
    moveCooldownMs: number;
    attackCooldownMs: number;
    detectRadius: number;
    preferredMinRange: number;
    preferredMaxRange: number;
  }
> = {
  stalker: {
    hp: 16,
    attack: 4,
    moveCooldownMs: 100,
    attackCooldownMs: 320,
    detectRadius: 8,
    preferredMinRange: 1,
    preferredMaxRange: 1,
  },
  bruiser: {
    hp: 32,
    attack: 9,
    moveCooldownMs: 180,
    attackCooldownMs: 650,
    detectRadius: 6,
    preferredMinRange: 1,
    preferredMaxRange: 1,
  },
  spitter: {
    hp: 20,
    attack: 6,
    moveCooldownMs: 140,
    attackCooldownMs: 700,
    detectRadius: 10,
    preferredMinRange: 3,
    preferredMaxRange: 5,
  },
  guardian: {
    hp: 95,
    attack: 14,
    moveCooldownMs: 150,
    attackCooldownMs: 700,
    detectRadius: 12,
    preferredMinRange: 2,
    preferredMaxRange: 6,
  },
};

export const SPAWN_COUNT_CAP = 28;

export const FLOOR_HASH_MAGIC = 0x9e3779b1;
