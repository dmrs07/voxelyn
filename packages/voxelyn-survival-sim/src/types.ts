import type { RNG } from '@voxelyn/core';

export type Vec2 = { x: number; y: number };

export type RunConfig = {
  seed: number;
  width?: number;
  height?: number;
  playerCount?: number;
};

export type RunPhase = 'running' | 'choice' | 'dead' | 'extracted' | 'extracted_with_core';
export type EnemyArchetype = 'stalker' | 'bruiser' | 'spitter' | 'bomber' | 'guardian';
export type ModifierId = 'piercing' | 'conductive' | 'explosive' | 'siphon';

export type EntityActionKind =
  | 'player_shot'
  | 'ranged'
  | 'contact'
  | 'charge'
  | 'detonate'
  | 'slam'
  | 'hurl'
  | 'pulse';
export type EntityActionPhase = 'windup' | 'release' | 'recovery';
export type EntityAction = {
  kind: EntityActionKind;
  phase: EntityActionPhase;
  startedAt: number;
  releaseAt: number;
  endsAt: number;
  direction: Vec2;
  target?: number;
};

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
  nextActionAt: number;
  contactReadyAt: number;
  rangedReadyAt: number;
  stunnedUntil: number;
  /**
   * Ate quando este inimigo continua caçando por ter LEVADO DANO.
   *
   * Sem isto o aggro era so distancia, recalculado a cada tick — entao dava para
   * matar qualquer coisa de fora do raio dela sem que ela reagisse. Com alcance
   * de tiro de 18 tiles contra raios de aggro de 7 a 9, isso nao era um caso de
   * borda: era o jeito normal de lutar.
   */
  alertedUntil: number;
  facing: Vec2;
  action?: EntityAction;
  slot?: number;
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
  downed: boolean;
  bleedoutAt: number;
  joined: boolean;
};

/**
 * Que COISA e o projetil, para o cliente saber desenha-lo.
 *
 * Nao da para inferir isso das flags: a pedra do bruiser e o cuspe do spitter
 * sao os dois `hostile` e mais nada, entao o cliente desenhava os dois com a
 * rampa acida — um bloco de rocha arrancado da parede aparecia como cusparada.
 * As flags dizem o que o projetil FAZ; isto diz o que ele E.
 */
export type ProjectileKind = 'bolt' | 'spit' | 'rock';

export type Projectile = {
  kind: ProjectileKind;
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
  hostile: boolean;
  leavesBiofluid: boolean;
  ttl: number;
  hits?: number[];
  /** Celulas fungicas que este projetil ja aqueceu; evita duplicar o mesmo impacto nos subpassos. */
  heatedSurfaceCells?: number[];
};

export type Cache = { x: number; y: number; opened: boolean; options: [ModifierId, ModifierId] | null };
export type Vent = { x: number; y: number; nextEmitAt: number };

export type SemanticEvent =
  | { t: 'action_start'; entity: number; action: EntityActionKind; x: number; y: number; dx: number; dy: number; startTick: number; releaseTick: number; endTick: number }
  | { t: 'hit'; x: number; y: number; amount: number; target: number }
  | { t: 'death'; x: number; y: number; entity: number; archetype: string; facingX: number; facingY: number; tick: number }
  | { t: 'explosion'; x: number; y: number; radius: number }
  /**
   * Um solido deixou de existir. Carrega QUAL material caiu para o cliente
   * poder desfazer o bloco no material certo; sem isso ele teria de adivinhar
   * pela grade, e a grade ja mudou quando o evento chega.
   */
  | { t: 'break'; x: number; y: number; solid: number }
  /**
   * Material cedendo por corrosao, sem ainda ter caido. O ESTADO em si viaja
   * pelo diff de chunk (o cliente ve o bloco enfraquecido no grid); este evento
   * so marca o instante, para o cliente cuspir respingo no lugar certo.
   */
  | { t: 'corrode'; x: number; y: number; solid: number }
  /** Lasca arrancada de um veio de minerio por impacto cinetico. */
  | { t: 'chip'; x: number; y: number }
  | { t: 'discharge'; cells: number[] }
  | { t: 'ignite'; x: number; y: number }
  | { t: 'shot'; x: number; y: number; dx: number; dy: number; owner: number }
  | { t: 'dodge'; x: number; y: number }
  | { t: 'pulse'; x: number; y: number }
  | { t: 'pickup_core'; x: number; y: number }
  | { t: 'cache_open'; x: number; y: number }
  | { t: 'consume'; x: number; y: number }
  | { t: 'overheat'; x: number; y: number }
  | { t: 'guardian_awake' }
  | { t: 'player_down'; slot: number; x: number; y: number; facingX: number; facingY: number; tick: number }
  | { t: 'revive'; x: number; y: number; slot: number; tick: number }
  | { t: 'extracted'; withCore: boolean }
  | { t: 'message'; text: string };

export type PlayerCommand = {
  move: Vec2;
  aim: Vec2;
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
  guardianSummoned: boolean;
  /**
   * Rota atual do guardiao, em indices de celula, e o tick em que foi calculada.
   *
   * Vive no estado e nao na entidade porque e DERIVADO: da para recalcular a
   * qualquer momento a partir da grade, entao nao entra no hash autoritativo nem
   * precisa viajar num snapshot. O cliente so desenha; quem persegue e o
   * servidor.
   */
  /** A arena ja foi lacrada? Separado de `guardianSummoned` porque o cerco pode
   * ter de esperar o jogador entrar no raio, enquanto os invocados saem na hora. */
  arenaClosed: boolean;
  guardianPath: number[];
  guardianPathAt: number;
  leftEntryZone: boolean;
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
  contaminationWaves: number;
  nextEntityId: number;
  reactionQueue: number[];
};

export type StepResult = { state: SurvivalState; events: SemanticEvent[] };
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
