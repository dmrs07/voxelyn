import type { RNG } from '@voxelyn/core';

export type Vec2 = { x: number; y: number };

export type RunConfig = {
  seed: number;
  width?: number;
  height?: number;
  playerCount?: number; // 1 (solo, padrao) ou 2 (co-op)
};

export type RunPhase = 'running' | 'choice' | 'dead' | 'extracted' | 'extracted_with_core';

export type EnemyArchetype = 'stalker' | 'bruiser' | 'spitter' | 'bomber' | 'guardian';

export type ModifierId = 'piercing' | 'conductive' | 'explosive' | 'siphon';

export type Entity = {
  id: number;
  kind: 'player' | 'enemy';
  archetype: EnemyArchetype | 'prospector';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  alive: boolean;
  elite: boolean;
  // temporizadores em ticks absolutos
  nextActionAt: number;
  contactReadyAt: number;
  rangedReadyAt: number;
  stunnedUntil: number;
  facing: Vec2;
  slot?: number; // players: indice em playerExtras
};

export type PlayerExtra = {
  aim: Vec2;
  heat: number;
  overheatedUntil: number;
  nextShotAt: number;
  dodgeUntil: number;
  iframesUntil: number;
  dodgeCooldownUntil: number;
  abilityCooldownUntil: number;
  consumables: number;
  modifiers: ModifierId[];
  hasCore: boolean;
  dodgeDir: Vec2;
  downed: boolean; // co-op: abatido, aguardando revive
  bleedoutAt: number; // tick em que o abatido morre se nao revivido
  /**
   * Slot efetivamente ocupado por um jogador. Slots reservados mas ainda nao
   * reivindicados (co-op online aguardando o parceiro) ficam `false`: nao sao
   * alvo, nao sofrem dano/perigos, nao contam para co-op nem para a extracao
   * coletiva, e nao aparecem nos snapshots. Solo/local nasce sempre `true`.
   */
  joined: boolean;
};

export type Projectile = {
  id: number;
  owner: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  piercing: boolean;
  conductive: boolean;
  explosive: boolean;
  hostile: boolean; // true = do inimigo
  leavesBiofluid: boolean;
  ttl: number;
};

export type Cache = {
  x: number;
  y: number;
  opened: boolean;
  options: [ModifierId, ModifierId] | null;
};

export type Vent = { x: number; y: number; nextEmitAt: number };

export type SemanticEvent =
  | { t: 'hit'; x: number; y: number; amount: number; target: number }
  | { t: 'death'; x: number; y: number; entity: number; archetype: string }
  | { t: 'explosion'; x: number; y: number; radius: number }
  | { t: 'discharge'; cells: number[] }
  | { t: 'ignite'; x: number; y: number }
  | { t: 'shot'; x: number; y: number; dx: number; dy: number }
  | { t: 'dodge'; x: number; y: number }
  | { t: 'pulse'; x: number; y: number }
  | { t: 'pickup_core'; x: number; y: number }
  | { t: 'cache_open'; x: number; y: number }
  | { t: 'consume'; x: number; y: number }
  | { t: 'overheat'; x: number; y: number }
  | { t: 'guardian_awake' }
  | { t: 'player_down'; slot?: number }
  | { t: 'revive'; x: number; y: number; slot: number }
  | { t: 'extracted'; withCore: boolean }
  | { t: 'message'; text: string };

export type PlayerCommand = {
  move: Vec2; // -1..1 (normalizado pela sim)
  aim: Vec2; // direcao de mira (nao normalizada obrigatoriamente)
  fire: boolean;
  ability: boolean;
  dodge: boolean;
  interact: boolean;
  consume: boolean;
  choose: 0 | 1 | null;
};

export type SurvivalState = {
  config: Required<RunConfig>;
  rng: RNG;
  tick: number;
  phase: RunPhase;

  solid: Uint8Array;
  surface: Uint8Array;
  surfaceTimer: Uint16Array;
  chunkVersion: Uint32Array;

  entry: Vec2;
  corePos: Vec2;
  coreTaken: boolean;
  guardianAwake: boolean;
  leftEntryZone: boolean;

  // Fonte da verdade: arrays de players. player/playerExtra sao aliases do slot 0
  // (mesma referencia de objeto), preservando o caminho solo.
  players: Entity[];
  playerExtras: PlayerExtra[];
  player: Entity;
  playerExtra: PlayerExtra;
  enemies: Entity[];
  projectiles: Projectile[];
  caches: Cache[];
  vents: Vent[];
  charges: Array<{ idx: number; until: number }>;

  pendingChoice: [ModifierId, ModifierId] | null;
  contamination: number;
  nextEntityId: number;

  // fila deterministica de celulas reagindo (indices), processada com orcamento
  reactionQueue: number[];
};

export type StepResult = {
  state: SurvivalState;
  events: SemanticEvent[];
};

export type PlayerSnapshot = {
  slot: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  heat: number;
  hasCore: boolean;
  downed: boolean;
  alive: boolean;
};

export type SurvivalSnapshot = {
  tick: number;
  phase: RunPhase;
  player: { x: number; y: number; hp: number; heat: number; hasCore: boolean };
  players: PlayerSnapshot[];
  enemyCount: number;
  contamination: number;
};
