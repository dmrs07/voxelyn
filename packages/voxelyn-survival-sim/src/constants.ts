// Simulacao autoritativa: tempo em ticks inteiros a 20 Hz.
export const TICK_HZ = 20;
export const TICK_MS = 1000 / TICK_HZ;

export const WORLD_W = 96;
export const WORLD_H = 96;
export const CHUNK = 16;
export const CHUNKS_X = WORLD_W / CHUNK;
export const CHUNKS_Y = WORLD_H / CHUNK;

// Camada solida (paredes / vazio).
export const SOLID_NONE = 0;
export const SOLID_ROCK = 1;
export const SOLID_FRAGILE = 2;
export const SOLID_ORE = 3;
export const SOLID_CRYSTAL = 4;
// Estados intermediarios: existem para o jogador VER o material mudando antes
// de ceder. Sem o estagio visivel, corrosao e rachadura viram morte invisivel,
// que e justamente o que o design proibe.
export const SOLID_FRAGILE_WEAK = 5; // frágil corroído, cede ao proximo toque
export const SOLID_ORE_SPENT = 6; // veio esgotado ou contaminado: nao conduz
export const SOLID_CRYSTAL_DULL = 7; // cristal opaco: nao emite luz nem descarrega
export const SOLID_ORE_CHIPPED = 8; // veio ja lascado, a um golpe de esgotar

// Camada de superficie (o que cobre o chao de uma celula aberta).
export const SURF_NONE = 0;
export const SURF_FUNGAL = 1;
export const SURF_BIOFLUID = 2;
export const SURF_GAS = 3;
export const SURF_FIRE = 4;
export const SURF_SCORCHED = 5;

// Orcamentos por tick (degradacao previsivel via fila deterministica).
export const BUDGET_REACTING_CELLS = 4096;
export const BUDGET_DISCHARGE_CELLS = 256;
export const MAX_PROJECTILES = 96;
export const MAX_ENEMIES = 48;

// Cadencia da simulacao celular (a cada N ticks).
export const CELL_STEP_INTERVAL = 3;

export const FIRE_FUEL_TICKS = 46;
export const FIRE_DAMAGE_PER_TICK = 2.2;
export const GAS_LIFE_TICKS = 220;
export const GAS_DAMAGE_PER_TICK = 0.55;
export const GAS_SPREAD_CHANCE = 0.14;
export const FIRE_SPREAD_FUNGAL = 0.4;
export const FIRE_SPREAD_BIOFLUID = 0.85;
export const BIOFLUID_SLOW = 0.55;
export const DISCHARGE_DAMAGE = 26;
export const DISCHARGE_TICKS = 6;

// Propagacao por material solido. Orcamentos separados do biofluido porque um
// veio de minerio atravessa a sala inteira e nao pode custar um tick.
export const BUDGET_VEIN_CELLS = 64;
export const BUDGET_RESONANCE_CELLS = 24;


export const PLAYER_HP = 100;
export const PLAYER_SPEED = 4.6; // tiles/s
export const PLAYER_RADIUS = 0.34;
export const DODGE_SPEED = 11;
export const DODGE_TICKS = 4; // impulso
export const DODGE_IFRAME_TICKS = 7;
export const DODGE_COOLDOWN_TICKS = 18;

export const HEAT_PER_SHOT = 9;
export const HEAT_MAX = 100;
export const HEAT_DECAY_PER_TICK = 1.15;
export const OVERHEAT_LOCK_TICKS = 36;
export const OVERHEAT_SELF_DAMAGE = 6;

export const BOLT_SPEED = 13; // tiles/s
export const BOLT_DAMAGE = 14;
export const BOLT_COOLDOWN_TICKS = 5;

export const ABILITY_COOLDOWN_TICKS = 120; // pulso cinetico
export const ABILITY_RADIUS = 2.6;
export const ABILITY_KNOCKBACK = 3.2;

export const CONSUMABLE_HEAL = 18;
export const CONSUMABLE_PURGE_RADIUS = 3;

export const EXPLOSION_RADIUS = 2.4;
export const EXPLOSION_DAMAGE = 42;

export const CONTAMINATION_PER_TICK = 1 / (TICK_HZ * 60 * 14); // ~14 min ate 1.0
export const VENT_BASE_INTERVAL_TICKS = 160;

export const ENEMY_MIN_SPAWN_DIST = 12;
export const GUARDIAN_HP = 420;

// Co-op: estado abatido, revive e extracao coletiva.
export const MAX_PLAYERS = 2;
export const BLEEDOUT_TICKS = 20 * TICK_HZ; // ~20s abatido antes de morrer
export const REVIVE_RADIUS = 1.5;
export const REVIVE_HP_FRACTION = 0.35;
export const EXTRACT_RADIUS = 3;

export const RUN_SEED_MIX = 0x9e3779b9;
