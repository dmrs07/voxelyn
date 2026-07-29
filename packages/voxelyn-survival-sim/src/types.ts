import type { RNG } from '@voxelyn/core';

export type Vec2 = { x: number; y: number };

export type RunConfig = {
  seed: number;
  width?: number;
  height?: number;
  playerCount?: number;
  /**
   * Setor em que a run COMECA. Padrao 1.
   *
   * Existe porque a run deixou de ser um mapa e virou tres encadeados, e sem
   * isto nao ha como construir o estado do setor 3 diretamente. Dois
   * consumidores reais dependem disso: um cliente que reconecta no meio de uma
   * run de co-op precisa reconstruir o mundo do setor em que a sala esta, e
   * testar o Guardiao exigiria dirigir a run inteira ate ele antes de qualquer
   * asserção sobre a arena.
   */
  sector?: number;
};

export type RunPhase = 'running' | 'dead' | 'extracted' | 'extracted_with_core';
export type EnemyArchetype = 'stalker' | 'bruiser' | 'spitter' | 'bomber' | 'guardian';
export type ModuleId = 'piercing' | 'conductive' | 'explosive' | 'siphon' | 'ricochet' | 'return_disc';
export type ModuleTag = 'projectile' | 'utility' | 'volatile' | 'defensive' | 'safe';
export type ModuleLifetime =
  | { kind: 'charges'; remaining: number; maximum: number }
  | { kind: 'timer'; acquiredAtTick: number; expiresAtTick: number };
export type ActiveModule = { id: ModuleId; lifetime: ModuleLifetime };
export type EffectOrigin = { source: 'player' | 'enemy' | 'environment'; owner?: number };
export type PendingModuleChoice = {
  sourceSiteId: number;
  options: [ModuleId, ModuleId];
  createdAtTick: number;
};

/**
 * O QUE machucou. Autoritativo, produzido pela simulacao.
 *
 * Existe por causa do invariante de design "morte que ensina" (secao 15 da
 * spec): uma tela de fim que so diz "O VEIO TE CONSUMIU" nao ensina nada, e a
 * diferenca entre um jogador que volta e um que fecha a aba costuma ser saber
 * o que o matou. Tres mortes que hoje sao indistinguiveis viram licoes
 * distintas: o gas que VOCE acendeu, a poca que VOCE eletrificou, e o bruiser
 * que voce nao ouviu.
 *
 * Vive na sim e nao no cliente porque so a sim sabe. Reconstruir a causa a
 * partir dos eventos seria adivinhacao: `hit` diz quanto doeu, nunca de onde
 * veio, e o ultimo `hit` antes da morte pode ser o respingo de fogo e nao a
 * pedra que tirou 22.
 *
 * `source` em explosao e descarga e o campo que carrega a licao inteira:
 * `{ kind: 'explosion', source: 'player' }` significa "voce se explodiu", que e
 * uma morte de decisao — exatamente o tipo que o design quer que aconteca.
 */
export type DamageCause =
  | { kind: 'player_shot' }
  | { kind: 'enemy_contact'; archetype: EnemyArchetype; elite: boolean }
  | { kind: 'enemy_projectile'; archetype: EnemyArchetype; elite: boolean; projectile: ProjectileKind }
  | { kind: 'fire' }
  | { kind: 'gas' }
  | { kind: 'spores' }
  | { kind: 'discharge'; source: EffectOrigin['source'] }
  | { kind: 'explosion'; source: EffectOrigin['source'] }
  | { kind: 'overheat' }
  | { kind: 'bleedout' }
  /** Ultimo recurso: nenhum caminho de dano deveria chegar aqui. */
  | { kind: 'unknown' };

/**
 * Contadores da run. Puramente descritivos: nada aqui realimenta a simulacao.
 *
 * Sao inteiros de proposito — entram no hash autoritativo, e float acumulado em
 * ordens diferentes diverge entre maquinas. `damageTaken` e `damageDealt`
 * guardam decimos arredondados pelo mesmo motivo.
 */
export type RunStats = {
  shotsFired: number;
  /** Mortes por arquetipo. Alimenta o bestiario do cliente. */
  kills: Record<EnemyArchetype, number>;
  /** Decimos de dano; dividir por 10 para exibir. */
  damageTakenTenths: number;
  damageDealtTenths: number;
  /** Solidos destruidos pelo jogador ou por reacoes que ele causou. */
  solidsDestroyed: number;
  /** Terminais de salvage concluidos. */
  salvageCompleted: number;
  modulesAcquired: number;
  purgeCellsUsed: number;
  /** Quantas vezes o jogador ficou abatido (co-op). */
  timesDowned: number;
  revivesGiven: number;
  /**
   * Reacoes sistemicas testemunhadas, para o codex do cliente.
   *
   * Bitmask e nao lista porque entra no hash: um Set nao tem ordem estavel
   * entre maquinas e um array cresceria sem teto.
   */
  discoveries: number;
};

/** Bits de `RunStats.discoveries`. Cada um e uma licao que o mundo ensinou. */
export const DISCOVERY_FIRE_SPREAD = 1 << 0;
export const DISCOVERY_DISCHARGE_POOL = 1 << 1;
export const DISCOVERY_GAS_IGNITION = 1 << 2;
export const DISCOVERY_FRAGILE_BREACH = 1 << 3;
export const DISCOVERY_SELF_HARM = 1 << 4;
export const DISCOVERY_ORE_CHAIN = 1 << 5;
export const DISCOVERY_GUARDIAN_FELLED = 1 << 6;
export const DISCOVERY_CORE_TAKEN = 1 << 7;

/**
 * O resultado congelado de uma run. Construido uma vez, quando a run termina.
 *
 * Congelado e nao derivado sob demanda porque `state` continua sendo o objeto
 * vivo depois do fim (o cliente ainda o desenha na tela de resultado), e um
 * sumario recalculado a cada quadro daria numeros que mudam enquanto o jogador
 * os le.
 */
export type RunSummary = {
  seed: number;
  phase: RunPhase;
  ticks: number;
  /** Contaminacao final, 0..1. */
  contamination: number;
  /** Nulo quando a run terminou em extracao. */
  deathCause: DamageCause | null;
  stats: RunStats;
  stars: 0 | 1 | 2 | 3;
  /** Tempo, em ticks, abaixo do qual a terceira estrela e concedida. */
  targetTicks: number;
};

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
  purgeCells: number;
  activeModules: ActiveModule[];
  pendingModuleChoice: PendingModuleChoice | null;
  hasCore: boolean;
  dodgeDir: Vec2;
  downed: boolean;
  bleedoutAt: number;
  joined: boolean;
  /**
   * O que machucou este jogador por ultimo, e quando.
   *
   * Guardado no momento do dano e nao no momento da morte porque no instante da
   * morte a informacao ja se perdeu: `resolveDownedAndDeaths` roda depois, ve
   * apenas `hp <= 0`, e nao tem como saber se foram os 22 da pedra ou os 2,2
   * do fogo que estavam por baixo.
   */
  lastDamage: { cause: DamageCause; tick: number } | null;
};

/**
 * Que COISA e o projetil, para o cliente saber desenha-lo.
 *
 * Nao da para inferir isso das flags: a pedra do bruiser e o cuspe do spitter
 * sao os dois `hostile` e mais nada, entao o cliente desenhava os dois com a
 * rampa acida — um bloco de rocha arrancado da parede aparecia como cusparada.
 * As flags dizem o que o projetil FAZ; isto diz o que ele E.
 */
export type ProjectileKind = 'bolt' | 'spit' | 'rock' | 'return_disc';

export type ProjectileModules = {
  piercing?: true;
  conductive?: true;
  siphon?: true;
  explosive?: { armAfterDistance: number };
  ricochet?: { remainingBounces: number };
};

export type DiscState = {
  phase: 'outbound' | 'returning';
  travelled: number;
  maxDistance: number;
  outboundHits: number[];
  returnHits: number[];
};

export type Projectile = {
  kind: ProjectileKind;
  id: number;
  owner: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  /** Raio de colisao autoritativo; projeteis pequenos usam o fallback historico. */
  radius?: number;
  modules?: ProjectileModules;
  distanceTravelled: number;
  disc?: DiscState;
  hostile: boolean;
  leavesBiofluid: boolean;
  ttl: number;
  hits?: number[];
  /** Celulas fungicas que este projetil ja aqueceu; evita duplicar o mesmo impacto nos subpassos. */
  heatedSurfaceCells?: number[];
};

export type SalvageSite = {
  id: number;
  tier: 1 | 2 | 3;
  terminal: Vec2;
  cache: Vec2;
  terminalState: 'inactive' | 'scanning' | 'complete';
  scanEndsAt: number;
  cacheRevealed: boolean;
  cacheOpened: boolean;
  openedBySlot: number | null;
};
export type Vent = { x: number; y: number; nextEmitAt: number };

export type SemanticEvent =
  | { t: 'action_start'; entity: number; action: EntityActionKind; x: number; y: number; dx: number; dy: number; startTick: number; releaseTick: number; endTick: number }
  | { t: 'hit'; x: number; y: number; amount: number; target: number }
  | { t: 'death'; x: number; y: number; entity: number; archetype: string; facingX: number; facingY: number; tick: number }
  | { t: 'explosion'; x: number; y: number; radius: number; source: 'player' | 'enemy' | 'environment'; owner?: number }
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
  | { t: 'discharge'; cells: number[]; source: 'player' | 'enemy' | 'environment'; owner?: number }
  | { t: 'ignite'; x: number; y: number }
  | { t: 'shot'; x: number; y: number; dx: number; dy: number; owner: number }
  | { t: 'dodge'; x: number; y: number }
  | { t: 'pulse'; x: number; y: number }
  | { t: 'pickup_core'; x: number; y: number }
  | { t: 'terminal_activated'; siteId: number; x: number; y: number; completesAtTick: number }
  | { t: 'terminal_scan_complete'; siteId: number; x: number; y: number }
  | { t: 'salvage_cache_revealed'; siteId: number; x: number; y: number }
  | { t: 'salvage_cache_opened'; siteId: number; slot: number; x: number; y: number }
  | { t: 'purge_cell_acquired'; slot: number; amount: number }
  | { t: 'purge_cell_used'; slot: number; x: number; y: number }
  | { t: 'module_selected'; slot: number; module: ModuleId; sourceSiteId: number; recharged: boolean }
  | { t: 'module_charge_consumed'; slot: number; module: ModuleId; remaining: number; maximum: number }
  | { t: 'module_expired'; slot: number; module: ModuleId }
  | { t: 'overheat'; x: number; y: number }
  | { t: 'guardian_awake' }
  /** O mundo inteiro foi trocado: o cliente precisa redesenhar do zero. */
  | { t: 'sector_entered'; sector: number; final: boolean }
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
  purge: boolean;
  choose: 0 | 1 | null;
};

export type SurvivalState = {
  config: Required<RunConfig>;
  rng: RNG;
  tick: number;
  phase: RunPhase;
  /**
   * Setor atual da descida, de 1 a SECTOR_COUNT.
   *
   * Nos setores anteriores ao ultimo, `corePos` marca o POCO de descida e nao
   * ha Guardiao nem nucleo; alcanca-lo troca o mundo inteiro por um novo em vez
   * de terminar a run. E a mesma posicao reaproveitada de proposito: o worldgen
   * ja garante que ela seja alcancavel a partir da entrada, que e exatamente a
   * garantia que o poco precisa. Gerar um segundo ponto especial exigiria
   * repetir essa prova para ele.
   */
  sector: number;
  /** Tick em que o setor atual comecou; o cronometro da run continua global. */
  sectorStartedAt: number;
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
  /** Celulas vazias convertidas pelo cerco; removidas quando o Guardian morre. */
  arenaBarrierCells: number[];
  guardianPath: number[];
  guardianPathAt: number;
  leftEntryZone: boolean;
  players: Entity[];
  playerExtras: PlayerExtra[];
  player: Entity;
  playerExtra: PlayerExtra;
  enemies: Entity[];
  projectiles: Projectile[];
  salvageSites: SalvageSite[];
  vents: Vent[];
  charges: Array<{ idx: number; until: number }>;
  contamination: number;
  contaminationWaves: number;
  nextEntityId: number;
  reactionQueue: number[];
  stats: RunStats;
  /** Preenchido uma unica vez, no tick em que a run termina. */
  summary: RunSummary | null;
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
