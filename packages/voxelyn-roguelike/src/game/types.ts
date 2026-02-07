import type { VoxelGrid3D } from '@voxelyn/core';
import type { AnimationFacing, AnimationIntent } from '@voxelyn/animation';

export type MaterialId = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type EntityKind = 'player' | 'enemy';

export type EnemyArchetype = 'stalker' | 'bruiser' | 'spitter' | 'guardian' | 'spore_bomber';

export type ProjectileKind = 'spore_blob' | 'guardian_shard';

export type MapModuleKind =
  | 'fungal_chamber'
  | 'hive_tunnels'
  | 'mining_zone'
  | 'vertical_pocket'
  | 'root_zone'
  | 'mirror_pocket';

export type DynamicCellKind = 'root_barrier' | 'pressure_gate' | 'spore_lane';

export type DynamicCellPhase = 'open' | 'warning' | 'closed';

export type CorridorEventKind = 'spore_wave' | 'ambush_ping';

export type TileFeatureFlags = number;

export type PowerUpId =
  | 'vital_boost'
  | 'attack_boost'
  | 'swift_boots'
  | 'iron_skin'
  | 'vampiric_spores'
  | 'fungal_regen';

export type GamePhase =
  | 'running'
  | 'powerup_choice'
  | 'floor_transition'
  | 'game_over'
  | 'victory';

export type Vec2 = {
  x: number;
  y: number;
};

export type DamageEvent = {
  sourceId: string;
  targetId: string;
  amount: number;
  tick: number;
  x: number;
  y: number;
};

export type PowerUpChoice = {
  sourceEnemyId: string;
  options: [PowerUpId, PowerUpId];
};

export type EntityBase = {
  id: string;
  occ: number;
  kind: EntityKind;
  x: number;
  y: number;
  z: number;
  blocks: boolean;
  hp: number;
  maxHp: number;
  attack: number;
  damageReduction: number;
  alive: boolean;
  nextMoveAt: number;
  nextAttackAt: number;
  facing: Vec2;
  hitFlashUntilMs: number;
  alertUntilMs: number;
  animPhase: number;
  animIntent: AnimationIntent;
  animFacing: AnimationFacing;
  animSpeedMul: number;
};

export type PlayerState = EntityBase & {
  kind: 'player';
  powerUps: PowerUpId[];
  moveCooldownMs: number;
  attackCooldownMs: number;
  regenPerSecond: number;
  lifeOnHit: number;
};

export type EnemyState = EntityBase & {
  kind: 'enemy';
  archetype: EnemyArchetype;
  aiState: 'patrol' | 'chase' | 'explode_windup';
  moveCooldownMs: number;
  attackCooldownMs: number;
  detectRadius: number;
  preferredMinRange: number;
  preferredMaxRange: number;
  patrolOrigin: Vec2;
  patrolTarget: Vec2 | null;
  fuseUntilMs: number | null;
};

export type Entity = PlayerState | EnemyState;

export type FungalLight = {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  color: { r: number; g: number; b: number };
};

export type ProjectileState = {
  id: string;
  kind: ProjectileKind;
  sourceId: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  speed: number;
  damage: number;
  ttlMs: number;
  radius: number;
  alive: boolean;
};

export type ParticleState = {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  lifeMs: number;
  color: number;
  text: string | null;
};

export type TerminalInteractable = {
  id: string;
  type: 'terminal';
  x: number;
  y: number;
  active: boolean;
  linkedGateId: string;
};

export type GateInteractable = {
  id: string;
  type: 'gate';
  x: number;
  y: number;
  open: boolean;
};

export type OneWayPortalInteractable = {
  id: string;
  type: 'one_way_portal';
  x: number;
  y: number;
  target: Vec2;
};

export type CrystalInteractable = {
  id: string;
  type: 'crystal';
  x: number;
  y: number;
  used: boolean;
};

export type SporeVentInteractable = {
  id: string;
  type: 'spore_vent';
  x: number;
  y: number;
  cooldownMs: number;
  nextTriggerAt: number;
};

export type LevelInteractable =
  | TerminalInteractable
  | GateInteractable
  | OneWayPortalInteractable
  | CrystalInteractable
  | SporeVentInteractable;

export type DynamicCellState = {
  id: string;
  kind: DynamicCellKind;
  x: number;
  y: number;
  phase: DynamicCellPhase;
  nextTransitionMs: number;
  openMs: number;
  warningMs: number;
  closedMs: number;
  damagePerTick: number;
  slowMs: number;
  nextDamageTickAt: number;
};

export type CorridorEventState = {
  id: string;
  kind: CorridorEventKind;
  cells: Vec2[];
  activeUntilMs: number;
  cooldownUntilMs: number;
  nextEffectTickAt: number;
  severity: 1 | 2 | 3;
};

export type LevelState = {
  grid: VoxelGrid3D;
  entities: Map<string, Entity>;
  occupancy: Int32Array;
  entry: Vec2;
  exit: Vec2;
  floorNumber: number;
  seed: number;
  width: number;
  height: number;
  depth: number;
  nextEntityOcc: number;
  heightMap: Float32Array;
  shadowMap: Float32Array;
  aoMap: Float32Array;
  baseLightMap: Float32Array;
  fungalLights: FungalLight[];
  featureMap: Uint16Array;
  interactables: LevelInteractable[];
  layoutModules: MapModuleKind[];
  occludableWalls: Uint8Array;
  corridorCandidates: Uint8Array;
  dynamicCells: DynamicCellState[];
  corridorEvents: CorridorEventState[];
};

export type GameState = {
  baseSeed: number;
  phase: GamePhase;
  level: LevelState;
  playerId: string;
  floorNumber: number;
  simTick: number;
  simTimeMs: number;
  pendingPowerUpChoices: PowerUpChoice[];
  activePowerUpChoice: PowerUpChoice | null;
  damageEvents: DamageEvent[];
  projectiles: ProjectileState[];
  particles: ParticleState[];
  messages: string[];
  screenFlash: {
    damageMs: number;
    healMs: number;
  };
  cameraShakeMs: number;
  activeDebuffs: {
    slowUntilMs: number;
    crystalBuffUntilMs: number;
    biofluidNextTickAt: number;
    portalLockUntilMs: number;
  };
  uiAlerts: Array<{
    text: string;
    untilMs: number;
    tone: 'info' | 'warn' | 'buff';
  }>;
  pathRecovery: {
    forcedOpenCount: number;
    lastRecoverAtMs: number;
    blockedSinceMs: number;
    lastPathCheckAtMs: number;
  };
};

export type ControlSnapshot = {
  dx: number;
  dy: number;
  pickChoice: 1 | 2 | null;
};
