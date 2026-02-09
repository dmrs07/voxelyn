import type { EnemyArchetype, MapModuleKind, MaterialId } from './types';

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
export const MAX_PARTICLES = 160;
export const MAX_PROJECTILES = 64;
export const HIT_FLASH_MS = 140;
export const ALERT_FLASH_MS = 700;
export const SCREEN_FLASH_MS = 150;
export const CAMERA_SHAKE_MS = 180;
export const FOG_BASE_RANGE = 7;
export const FUNGAL_LIGHT_REVEAL_RADIUS = 5;
export const LIGHT_DIR = { x: -0.6, y: -0.4 } as const;
export const PROJECTILE_SPEED = 7;
export const BOMBER_FUSE_MS = 900;
export const BOMBER_RADIUS = 2;
export const OCCLUSION_RADIUS = 5;
export const WALL_BASE_HEIGHT_VISIBLE = 18;
export const DITHER_PATTERN_SIZE = 4;

export const CA_ITERATIONS = 3;
export const CA_OPEN_IF_WALL_NEIGHBORS_LE = 3;
export const CA_CLOSE_IF_WALL_NEIGHBORS_GE = 5;
export const CA_PROTECT_PATH_RADIUS = 1;
export const CA_TARGET_OPEN_MIN = 0.34;
export const CA_TARGET_OPEN_MAX = 0.62;

export const FEATURE_BIOFLUID = 1 << 0;
export const FEATURE_TRACK = 1 << 1;
export const FEATURE_ROOT_BARRIER = 1 << 2;
export const FEATURE_CRYSTAL = 1 << 3;
export const FEATURE_SPORE_VENT = 1 << 4;
export const FEATURE_TERMINAL = 1 << 5;
export const FEATURE_GATE = 1 << 6;
export const FEATURE_PORTAL = 1 << 7;
export const FEATURE_PROP_FUNGAL_CLUSTER = 1 << 8;
export const FEATURE_PROP_DEBRIS = 1 << 9;
export const FEATURE_PROP_CRATE = 1 << 10;
export const FEATURE_PROP_BEACON = 1 << 11;

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
  spore_bomber: {
    hp: 26,
    attack: 11,
    moveCooldownMs: 140,
    attackCooldownMs: 800,
    detectRadius: 9,
    preferredMinRange: 1,
    preferredMaxRange: 2,
  },
};

export const SPAWN_COUNT_CAP = 28;

export const FLOOR_HASH_MAGIC = 0x9e3779b1;

export const MODULE_SELECTION_MIN = 2;
export const MODULE_SELECTION_MAX = 3;

export const MODULE_WEIGHTS_EARLY: Record<MapModuleKind, number> = {
  fungal_chamber: 3,
  hive_tunnels: 4,
  mining_zone: 3,
  vertical_pocket: 1,
  root_zone: 2,
  mirror_pocket: 1,
};

export const MODULE_WEIGHTS_MID: Record<MapModuleKind, number> = {
  fungal_chamber: 3,
  hive_tunnels: 3,
  mining_zone: 3,
  vertical_pocket: 2,
  root_zone: 3,
  mirror_pocket: 2,
};

export const MODULE_WEIGHTS_LATE: Record<MapModuleKind, number> = {
  fungal_chamber: 2,
  hive_tunnels: 3,
  mining_zone: 2,
  vertical_pocket: 3,
  root_zone: 3,
  mirror_pocket: 3,
};

export const BIOFLUID_DENSITY = 0.018;
export const SPORE_VENT_DENSITY = 0.006;
export const CRYSTAL_DENSITY = 0.004;
export const TERMINAL_PUZZLE_CHANCE = 0.55;
export const ONE_WAY_PORTAL_CHANCE = 0.35;
export const PROP_FUNGAL_CLUSTER_DENSITY = 0.026;
export const PROP_DEBRIS_DENSITY = 0.022;
export const PROP_CRATE_DENSITY = 0.012;
export const PROP_BEACON_DENSITY = 0.007;

export const SPORE_SLOW_MS = 3200;
export const SPORE_VENT_COOLDOWN_MS = 4500;
export const BIOFLUID_TICK_MS = 650;
export const BIOFLUID_DAMAGE = 2;
export const CRYSTAL_BUFF_MS = 4200;
export const CRYSTAL_ATTACK_BONUS = 5;
export const CRYSTAL_HEAL = 10;

export const DYNAMIC_CELL_TARGET_MIN = 6;
export const DYNAMIC_CELL_TARGET_MAX = 14;
export const DYNAMIC_RECHECK_PATH_MS = 450;
export const DYNAMIC_SOFTLOCK_GRACE_MS = 1200;
export const DYNAMIC_ALERT_MS = 1800;

export const DYNAMIC_OPEN_MS = 2400;
export const DYNAMIC_WARNING_MS = 900;
export const DYNAMIC_CLOSED_MS = 1100;

export const SPORE_LANE_DAMAGE = 1;
export const SPORE_LANE_SLOW_MS = 700;
export const SPORE_LANE_TICK_MS = 260;

// Pop-up sprite rendering constants
export const FEATURE_POPUP_SCALE = 2.5;
export const FEATURE_SHADOW_ALPHA = 0.2;
export const FEATURE_TILT_X = 0; // No horizontal shear - sprites stand upright

export const EVENT_AMBUSH_CHANCE_PER_FLOOR_BASE = 0.08;
export const EVENT_SPORE_WAVE_CHANCE_PER_FLOOR_BASE = 0.1;
export const EVENT_AMBUSH_MAX = 0.34;
export const EVENT_SPORE_WAVE_MAX = 0.42;
export const EVENT_SPORE_WAVE_ACTIVE_MS = 1700;
export const EVENT_AMBUSH_ACTIVE_MS = 1250;
export const EVENT_MIN_COOLDOWN_MS = 2600;
export const EVENT_MAX_COOLDOWN_MS = 5200;

export const INTERACT_RANGE = 1;
export const INSPECT_OVERLAY_MS = 2200;
export const TERMINAL_BROKEN_CHANCE = 0.55;
export const TERMINAL_REPAIR_RADIUS = 6;

export const INSPECT_TEXTS = {
  fungal_cluster: 'Uma colonia de fungos pulsa em silencio.',
  debris: 'Escombros oxidados de mineracao antiga.',
  crate: 'Caixa de suprimentos vazia, coberta de poeira.',
  beacon: 'Sinalizador gasto. Ainda emite um brilho fraco.',
  track: 'Trilhos tortos, lembranca da mineracao.',
  terminal_broken: 'Terminal quebrado. Elimine inimigos proximos para consertar.',
  terminal_ready: 'Terminal quebrado. Pronto para conserto.',
  terminal_active: 'Terminal ativo.',
} as const;
