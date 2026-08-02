// A cápsula de morte, e a única definição dela.
//
// Vive no protocolo porque agora atravessa a rede. Nas etapas locais ela morava
// no cliente, e isso era honesto enquanto o único produtor e o único consumidor
// eram o mesmo processo. A partir do pool comunitário há três produtores — o
// storage local, a sala de co-op simulada pelo servidor e a re-simulação de um
// log solo — e um único consumidor: a projeção topológica.
//
// Duplicar a assinatura topológica seria o pior tipo de bug possível aqui. O
// servidor mediria `progressQ` de um jeito, o cliente pontuaria candidatas com
// outro, e o eco cairia num lugar que não corresponde a nada — sem que nenhum
// teste de nenhum dos dois lados acusasse, porque cada lado estaria correto
// sozinho. Uma definição só remove essa classe inteira de divergência.
//
// O QUE ESTE ARQUIVO NÃO FAZ: não persiste, não busca, não desenha e não decide
// política. Ele define a cápsula, valida uma que chegou de fora e projeta.

import {
  SOLID_NONE,
  SOLID_ORE,
  SOLID_ORE_CHIPPED,
  SURF_NONE,
  type DamageCause,
  type EnemyArchetype,
  type ProjectileKind,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import { CONTENT_VERSION, SIMULATION_VERSION } from './version.js';

/** Quantos ecos INTERATIVOS um setor aceita. Ver spec §7. */
export const DEATH_ECHOES_PER_SECTOR = 1;
/** Quantas sombras puramente visuais acompanham o eco interativo. */
export const DEATH_ECHO_SHADOWS_PER_SECTOR = 3;

/** Intervalo entre amostras do rastro final. */
export const DEATH_ECHO_TRACE_STEP_MS = 120;
/** Teto de amostras guardadas: ~2,9 s, os "últimos segundos" da spec. */
export const DEATH_ECHO_TRACE_SAMPLES = 24;
/** Sem dois pontos não há trajetória, só um ponto parado. */
export const DEATH_ECHO_TRACE_MIN_SAMPLES = 2;
/** Quantização espacial do rastro: oitavos de tile, em int8. */
const TRACE_UNITS_PER_TILE = 8;
const TRACE_MAX_OFFSET = 127;

/**
 * Uma amostra crua do Prospector vivo, antes de virar cápsula.
 *
 * Quem coleta é o produtor (o cliente, quadro a quadro; o servidor, tick a
 * tick); só a morte transforma a janela corrente em `DeathEchoTrace`.
 */
export type DeathEchoTraceSample = {
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  firing: boolean;
};

/**
 * Os últimos segundos, comprimidos.
 *
 * Deslocamentos são relativos à célula da morte e cabem em int8; a mira vira
 * octante. É deliberadamente grosseiro: a reprodução tem de contar uma história
 * curta, não reproduzir a luta — e no cliente o storage é `localStorage`,
 * compartilhado com o histórico de runs.
 */
export type DeathEchoTrace = {
  stepMs: number;
  /** Deslocamento em oitavos de tile a partir da célula da morte. */
  dx: number[];
  dy: number[];
  /** Octante da mira (0..7), somado a 8 quando havia disparo em curso. */
  aim: number[];
};

export type DeathEchoCapsule = {
  id: string;
  sourceSeed: number;
  /** Versões que produziram a topologia original. Ausentes em storage legado = 0. */
  sourceSimulationVersion: number;
  sourceContentVersion: number;
  sector: number;
  sourceWidth: number;
  sourceHeight: number;
  sourceX: number;
  sourceY: number;
  /** 0..255: distância da entrada em relação à distância do objetivo. */
  progressQ: number;
  /** Vizinhos abertos na janela 3×3, sem contar a própria célula. */
  openness: number;
  surface: number;
  nearOre: boolean;
  facingX: number;
  facingY: number;
  cause: DamageCause;
  ticks: number;
  /** Ausente em storage legado e em mortes curtas demais para contar algo. */
  finalTrace?: DeathEchoTrace;
};

export type DeathEchoProjection = 'exact' | 'topological';

/**
 * Uma cápsula candidata à projeção, possivelmente já representando várias mortes.
 *
 * `lost` ausente significa uma. Ele é preenchido por `groupDeathEchoesByChamber`,
 * que roda ANTES da projeção — ver o comentário lá para o porquê da ordem.
 */
export type DeathEchoCandidate = DeathEchoCapsule & { lost?: number };

export type PlacedDeathEcho = DeathEchoCapsule & {
  x: number;
  y: number;
  cell: number;
  projection: DeathEchoProjection;
  /**
   * Quantas mortes este corpo representa.
   *
   * Um no caso comum. Acima disso é um agrupamento do contrato de seed
   * compartilhada, onde dezenas de pessoas morreram na mesma câmara e cinquenta
   * entidades no mesmo lugar seriam um cemitério, não um aviso.
   */
  lost: number;
};

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

const finiteInt = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const integer = Math.floor(value);
  if (integer < min || integer > max) return null;
  return integer;
};

const isEffectSource = (value: unknown): value is 'player' | 'enemy' | 'environment' =>
  value === 'player' || value === 'enemy' || value === 'environment';

const ENEMY_ARCHETYPES = new Set<EnemyArchetype>([
  'stalker',
  'bruiser',
  'spitter',
  'bomber',
  'guardian',
  'bishop',
  'fungal_horse',
  'miner',
  'resonant',
  'mud_lamprey',
  'bellows',
  'scoriac',
  'frost_wraith',
]);
const PROJECTILE_KINDS = new Set<ProjectileKind>(['bolt', 'spit', 'rock', 'return_disc', 'cart']);
const isEnemyArchetype = (value: unknown): value is EnemyArchetype =>
  typeof value === 'string' && ENEMY_ARCHETYPES.has(value as EnemyArchetype);
const isProjectileKind = (value: unknown): value is ProjectileKind =>
  typeof value === 'string' && PROJECTILE_KINDS.has(value as ProjectileKind);

// Matriz fechada do que a simulação realmente consegue disparar. `bolt` e
// `return_disc` pertencem ao jogador; aceitar qualquer união válida aqui
// permitiria que storage adulterado — ou um POST hostil — fabricasse uma lição
// de morte que o jogo não pode produzir.
const HOSTILE_PROJECTILES_BY_ARCHETYPE: Partial<Record<EnemyArchetype, ReadonlySet<ProjectileKind>>> = {
  bruiser: new Set(['rock']),
  spitter: new Set(['spit']),
  guardian: new Set(['spit']),
  bishop: new Set(['spit']),
  // A armadilha de carrinho credita 'miner' (os automatos da operacao): a
  // capsula de morte por atropelo tem de passar pela matriz fechada.
  miner: new Set(['cart']),
};
const isValidEnemyProjectileCause = (archetype: unknown, projectile: unknown): boolean => {
  if (!isEnemyArchetype(archetype) || !isProjectileKind(projectile)) return false;
  return HOSTILE_PROJECTILES_BY_ARCHETYPE[archetype]?.has(projectile) ?? false;
};

export const isDeathEchoCause = (value: unknown): value is DamageCause => {
  if (typeof value !== 'object' || value === null) return false;
  const cause = value as Record<string, unknown>;
  switch (cause.kind) {
    case 'player_shot':
    case 'fire':
    case 'gas':
    case 'spores':
    case 'overheat':
    case 'bleedout':
    case 'unknown':
      return true;
    case 'discharge':
    case 'explosion':
      return isEffectSource(cause.source);
    case 'enemy_contact':
      return isEnemyArchetype(cause.archetype) && typeof cause.elite === 'boolean';
    case 'enemy_projectile':
      return (
        isValidEnemyProjectileCause(cause.archetype, cause.projectile) &&
        typeof cause.elite === 'boolean'
      );
    default:
      return false;
  }
};

const int8Array = (value: unknown, length: number): number[] | null => {
  if (!Array.isArray(value) || value.length !== length) return null;
  const out: number[] = [];
  for (const entry of value) {
    const integer = finiteInt(entry, -TRACE_MAX_OFFSET - 1, TRACE_MAX_OFFSET);
    if (integer === null) return null;
    out.push(integer);
  }
  return out;
};

/**
 * O rastro é OPCIONAL, e por isso a validação devolve `null` em vez de invalidar
 * a cápsula: um replay corrompido não pode custar a carcaça, que é a parte que
 * ensina.
 */
export const parseDeathEchoTrace = (value: unknown): DeathEchoTrace | null => {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Partial<DeathEchoTrace>;
  const stepMs = finiteInt(raw.stepMs, 16, 1000);
  if (stepMs === null || !Array.isArray(raw.dx)) return null;
  const length = raw.dx.length;
  if (length < DEATH_ECHO_TRACE_MIN_SAMPLES || length > DEATH_ECHO_TRACE_SAMPLES) return null;
  const dx = int8Array(raw.dx, length);
  const dy = int8Array(raw.dy, length);
  if (!dx || !dy) return null;
  if (!Array.isArray(raw.aim) || raw.aim.length !== length) return null;
  const aim: number[] = [];
  for (const entry of raw.aim) {
    const octant = finiteInt(entry, 0, 15);
    if (octant === null) return null;
    aim.push(octant);
  }
  return { stepMs, dx, dy, aim };
};

/** Teto do id: cabe `seed:phase:ticks:serial` com folga, e nada mais. */
export const DEATH_ECHO_ID_MAX = 96;

/**
 * Valida uma cápsula vinda de FORA — storage local, corpo HTTP, resposta de pool.
 *
 * Todos os três são igualmente não confiáveis, e por isso passam pelo mesmo
 * portão. `localStorage` é editável pelo jogador; um pool é editável por quem
 * hospeda; um POST é editável por qualquer um. Um validador por origem seria
 * três chances de esquecer o mesmo campo.
 */
export const parseDeathEchoCapsule = (value: unknown): DeathEchoCapsule | null => {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Partial<DeathEchoCapsule>;
  if (typeof raw.id !== 'string' || raw.id.length === 0 || raw.id.length > DEATH_ECHO_ID_MAX) {
    return null;
  }
  if (!isDeathEchoCause(raw.cause)) return null;
  const sourceSeed = finiteInt(raw.sourceSeed, 0, 0xffffffff);
  const sourceSimulationVersion = finiteInt(raw.sourceSimulationVersion ?? 0, 0, 0x7fffffff);
  const sourceContentVersion = finiteInt(raw.sourceContentVersion ?? 0, 0, 0x7fffffff);
  const sector = finiteInt(raw.sector, 1, 32);
  const sourceWidth = finiteInt(raw.sourceWidth, 1, 4096);
  const sourceHeight = finiteInt(raw.sourceHeight, 1, 4096);
  const sourceX = finiteInt(raw.sourceX, 0, 4095);
  const sourceY = finiteInt(raw.sourceY, 0, 4095);
  const progressQ = finiteInt(raw.progressQ, 0, 255);
  const openness = finiteInt(raw.openness, 0, 8);
  const surface = finiteInt(raw.surface, 0, 255);
  const ticks = finiteInt(raw.ticks, 0, 0x7fffffff);
  if (
    sourceSeed === null || sourceSimulationVersion === null || sourceContentVersion === null ||
    sector === null || sourceWidth === null || sourceHeight === null ||
    sourceX === null || sourceY === null || progressQ === null || openness === null ||
    surface === null || ticks === null || sourceX >= sourceWidth || sourceY >= sourceHeight ||
    typeof raw.nearOre !== 'boolean' || typeof raw.facingX !== 'number' ||
    !Number.isFinite(raw.facingX) || typeof raw.facingY !== 'number' || !Number.isFinite(raw.facingY)
  ) return null;
  const finalTrace = raw.finalTrace === undefined ? null : parseDeathEchoTrace(raw.finalTrace);
  return {
    ...(finalTrace ? { finalTrace } : {}),
    id: raw.id,
    sourceSeed,
    sourceSimulationVersion,
    sourceContentVersion,
    sector,
    sourceWidth,
    sourceHeight,
    sourceX,
    sourceY,
    progressQ,
    openness,
    surface,
    nearOre: raw.nearOre,
    facingX: raw.facingX,
    facingY: raw.facingY,
    cause: raw.cause,
    ticks,
  };
};

// ---------------------------------------------------------------------------
// Rastro
// ---------------------------------------------------------------------------

const octantOf = (x: number, y: number): number => {
  if (x === 0 && y === 0) return 0;
  return ((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8;
};

const quantizeOffset = (value: number): number =>
  Math.max(
    -TRACE_MAX_OFFSET,
    Math.min(TRACE_MAX_OFFSET, Math.round(value * TRACE_UNITS_PER_TILE)),
  );

/**
 * Fecha a janela corrente de amostras num rastro guardável.
 *
 * Devolve `null` quando a janela é curta demais: uma morte de dois quadros não
 * tem história para contar, e a spec já exclui mortes muito curtas do pool.
 */
export const encodeDeathEchoTrace = (
  samples: readonly DeathEchoTraceSample[],
  originX: number,
  originY: number,
  stepMs: number = DEATH_ECHO_TRACE_STEP_MS,
): DeathEchoTrace | null => {
  const window = samples.slice(-DEATH_ECHO_TRACE_SAMPLES);
  if (window.length < DEATH_ECHO_TRACE_MIN_SAMPLES) return null;
  return {
    stepMs,
    dx: window.map((sample) => quantizeOffset(sample.x - originX)),
    dy: window.map((sample) => quantizeOffset(sample.y - originY)),
    aim: window.map(
      (sample) => octantOf(sample.aimX, sample.aimY) + (sample.firing ? 8 : 0),
    ),
  };
};

export type DeathEchoTracePoint = {
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  firing: boolean;
};

/** Duração total da reprodução, em ms. */
export const deathEchoTraceDuration = (trace: DeathEchoTrace): number =>
  trace.dx.length * trace.stepMs;

/** Devolve a amostra `index` de volta ao mundo, ancorada na carcaça. */
export const decodeDeathEchoTracePoint = (
  trace: DeathEchoTrace,
  index: number,
  originX: number,
  originY: number,
): DeathEchoTracePoint | null => {
  if (index < 0 || index >= trace.dx.length) return null;
  const code = trace.aim[index];
  const angle = (code & 7) * (Math.PI / 4);
  return {
    x: originX + trace.dx[index] / TRACE_UNITS_PER_TILE,
    y: originY + trace.dy[index] / TRACE_UNITS_PER_TILE,
    aimX: Math.cos(angle),
    aimY: Math.sin(angle),
    firing: (code & 8) !== 0,
  };
};

// ---------------------------------------------------------------------------
// Topologia
// ---------------------------------------------------------------------------

const cellIndex = (width: number, x: number, y: number): number => y * width + x;

const distanceField = (
  solid: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
): Int32Array => {
  const distance = new Int32Array(width * height).fill(-1);
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return distance;
  const start = cellIndex(width, startX, startY);
  if (solid[start] !== SOLID_NONE) return distance;
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  distance[start] = 0;
  while (head < tail) {
    const current = queue[head++];
    const x = current % width;
    const y = Math.floor(current / width);
    const neighbors = [current - 1, current + 1, current - width, current + width];
    const valid = [x > 0, x < width - 1, y > 0, y < height - 1];
    for (let i = 0; i < neighbors.length; i++) {
      if (!valid[i]) continue;
      const next = neighbors[i];
      if (distance[next] !== -1 || solid[next] !== SOLID_NONE) continue;
      distance[next] = distance[current] + 1;
      queue[tail++] = next;
    }
  }
  return distance;
};

const openNeighborCount = (
  solid: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number => {
  let count = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      if (ox === 0 && oy === 0) continue;
      const nx = x + ox;
      const ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (solid[cellIndex(width, nx, ny)] === SOLID_NONE) count++;
    }
  }
  return count;
};

const hasOreNearby = (
  solid: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): boolean => {
  for (let oy = -2; oy <= 2; oy++) {
    for (let ox = -2; ox <= 2; ox++) {
      const nx = x + ox;
      const ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const material = solid[cellIndex(width, nx, ny)];
      if (material === SOLID_ORE || material === SOLID_ORE_CHIPPED) return true;
    }
  }
  return false;
};

const progressFrom = (
  distance: Int32Array,
  objectiveDistance: number,
  fallbackMax: number,
  cell: number,
): number => {
  const here = distance[cell];
  if (here < 0) return 0;
  const denominator = objectiveDistance > 0 ? objectiveDistance : fallbackMax;
  if (denominator <= 0) return 0;
  return Math.max(0, Math.min(255, Math.round((here / denominator) * 255)));
};

/**
 * O papel que uma célula cumpre na jornada, e não a coordenada dela.
 *
 * É a assinatura inteira que a reprojeção compara: o quão fundo, o quão aberto,
 * que chão, e se havia minério por perto. Produtores e consumidor chamam ESTA
 * função — a razão de o módulo existir.
 */
export type DeathEchoTopology = {
  progressQ: number;
  openness: number;
  surface: number;
  nearOre: boolean;
};

export const deathEchoTopology = (
  state: SurvivalState,
  x: number,
  y: number,
): DeathEchoTopology => {
  const width = state.config.width;
  const height = state.config.height;
  const distance = distanceField(state.solid, width, height, state.entry.x, state.entry.y);
  let fallbackMax = 0;
  for (const value of distance) fallbackMax = Math.max(fallbackMax, value);
  const objective = distance[cellIndex(width, state.corePos.x, state.corePos.y)];
  const cell = cellIndex(width, x, y);
  return {
    progressQ: progressFrom(distance, objective, fallbackMax, cell),
    openness: openNeighborCount(state.solid, width, height, x, y),
    surface: state.surface[cell] ?? SURF_NONE,
    nearOre: hasOreNearby(state.solid, width, height, x, y),
  };
};

/** Onde a morte aconteceu, na linguagem da cápsula. */
export type DeathEchoOrigin = {
  id: string;
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  cause: DamageCause;
  ticks: number;
  trace?: readonly DeathEchoTraceSample[];
};

/**
 * Constrói a cápsula a partir de um estado autoritativo e de uma morte nele.
 *
 * Não sabe QUEM morreu e não deve saber: recebe posição, direção e causa já
 * associadas por quem tem prova disso. No co-op é o servidor, que simulou; no
 * solo é o cliente para si mesmo, ou a re-simulação do log.
 */
export const buildDeathEchoCapsule = (
  state: SurvivalState,
  origin: DeathEchoOrigin,
): DeathEchoCapsule => {
  const width = state.config.width;
  const height = state.config.height;
  const sourceX = Math.max(0, Math.min(width - 1, Math.floor(origin.x)));
  const sourceY = Math.max(0, Math.min(height - 1, Math.floor(origin.y)));
  const topology = deathEchoTopology(state, sourceX, sourceY);
  const finalTrace = origin.trace
    ? encodeDeathEchoTrace(origin.trace, sourceX + 0.5, sourceY + 0.5)
    : null;
  return {
    ...(finalTrace ? { finalTrace } : {}),
    id: origin.id.slice(0, DEATH_ECHO_ID_MAX),
    sourceSeed: state.config.seed >>> 0,
    sourceSimulationVersion: SIMULATION_VERSION,
    sourceContentVersion: CONTENT_VERSION,
    sector: state.sector,
    sourceWidth: width,
    sourceHeight: height,
    sourceX,
    sourceY,
    progressQ: topology.progressQ,
    openness: topology.openness,
    surface: topology.surface,
    nearOre: topology.nearOre,
    facingX: origin.facingX,
    facingY: origin.facingY,
    cause: origin.cause,
    ticks: origin.ticks,
  };
};

// ---------------------------------------------------------------------------
// Projeção
// ---------------------------------------------------------------------------

const hashString = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/** Hash estável de string, exposto porque serial e desempate usam o mesmo. */
export const deathEchoHash = hashString;

const squaredDistance = (ax: number, ay: number, bx: number, by: number): number =>
  (ax - bx) ** 2 + (ay - by) ** 2;

const isReservedCell = (state: SurvivalState, x: number, y: number): boolean => {
  if (squaredDistance(x, y, state.entry.x, state.entry.y) < 7 ** 2) return true;
  if (squaredDistance(x, y, state.corePos.x, state.corePos.y) < 6 ** 2) return true;
  for (const site of state.salvageSites) {
    if (squaredDistance(x, y, site.terminal.x, site.terminal.y) < 4 ** 2) return true;
    if (squaredDistance(x, y, site.cache.x, site.cache.y) < 4 ** 2) return true;
  }
  for (const enemy of state.enemies) {
    if (enemy.alive && squaredDistance(x, y, enemy.x, enemy.y) < 3 ** 2) return true;
  }
  return false;
};

const candidateScore = (
  state: SurvivalState,
  echo: DeathEchoCapsule,
  distance: Int32Array,
  objectiveDistance: number,
  fallbackMax: number,
  cell: number,
): number => {
  const width = state.config.width;
  const x = cell % width;
  const y = Math.floor(cell / width);
  const progressQ = progressFrom(distance, objectiveDistance, fallbackMax, cell);
  const progressPenalty = Math.abs(progressQ - echo.progressQ) / 255 * 100;
  const opennessPenalty = Math.abs(openNeighborCount(state.solid, width, state.config.height, x, y) - echo.openness) * 5;
  const surfacePenalty = state.surface[cell] === echo.surface ? 0 : echo.surface === SURF_NONE ? 4 : 18;
  const orePenalty = hasOreNearby(state.solid, width, state.config.height, x, y) === echo.nearOre ? 0 : 8;
  return progressPenalty + opennessPenalty + surfacePenalty + orePenalty;
};

const validCandidate = (
  state: SurvivalState,
  distance: Int32Array,
  x: number,
  y: number,
): boolean => {
  const width = state.config.width;
  const height = state.config.height;
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  const cell = cellIndex(width, x, y);
  return state.solid[cell] === SOLID_NONE && distance[cell] >= 0 && !isReservedCell(state, x, y);
};

/** Pontuação acima disto é pior que ausência. */
const MAX_ACCEPTABLE_SCORE = 72;

/**
 * A cápsula veio do MESMO mundo que este estado gerou?
 *
 * Só nesse caso a coordenada original ainda significa algo. Versões diferentes de
 * simulação ou conteúdo produzem outro mapa a partir da mesma seed, e reusar a
 * célula ali seria afirmar uma relação espacial que nunca existiu.
 */
const sharesWorld = (state: SurvivalState, echo: DeathEchoCapsule): boolean =>
  echo.sourceSeed === (state.config.seed >>> 0) &&
  echo.sourceSimulationVersion === SIMULATION_VERSION &&
  echo.sourceContentVersion === CONTENT_VERSION &&
  echo.sourceWidth === state.config.width &&
  echo.sourceHeight === state.config.height;

const placeOne = (
  state: SurvivalState,
  echo: DeathEchoCandidate,
  taken: ReadonlySet<number>,
): PlacedDeathEcho | null => {
  const width = state.config.width;
  const height = state.config.height;
  const lost = echo.lost ?? 1;
  const distance = distanceField(state.solid, width, height, state.entry.x, state.entry.y);
  let fallbackMax = 0;
  for (const value of distance) fallbackMax = Math.max(fallbackMax, value);
  const objectiveDistance = distance[cellIndex(width, state.corePos.x, state.corePos.y)];

  if (
    sharesWorld(state, echo) &&
    validCandidate(state, distance, echo.sourceX, echo.sourceY) &&
    !taken.has(cellIndex(width, echo.sourceX, echo.sourceY))
  ) {
    return {
      ...echo,
      x: echo.sourceX + 0.5,
      y: echo.sourceY + 0.5,
      cell: cellIndex(width, echo.sourceX, echo.sourceY),
      projection: 'exact',
      lost,
    };
  }

  let bestCell = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestTie = 0xffffffff;
  for (let cell = 0; cell < state.solid.length; cell++) {
    if (taken.has(cell)) continue;
    const x = cell % width;
    const y = Math.floor(cell / width);
    if (!validCandidate(state, distance, x, y)) continue;
    const score = candidateScore(state, echo, distance, objectiveDistance, fallbackMax, cell);
    const tie = hashString(`${state.config.seed}:${state.sector}:${echo.id}:${cell}`);
    if (score < bestScore || (score === bestScore && tie < bestTie)) {
      bestCell = cell;
      bestScore = score;
      bestTie = tie;
    }
  }
  // Uma projeção ruim é pior que ausência: faria a caixa-preta ensinar uma relação
  // espacial que a morte original nunca teve.
  if (bestCell < 0 || bestScore > MAX_ACCEPTABLE_SCORE) return null;
  return {
    ...echo,
    x: (bestCell % width) + 0.5,
    y: Math.floor(bestCell / width) + 0.5,
    cell: bestCell,
    projection: 'topological',
    lost,
  };
};

/**
 * Coloca ecos num mapa JÁ VÁLIDO.
 *
 * A regra que rege a função inteira: o mapa nunca é alterado para acomodar uma
 * morte. Nada de abrir corredor, mover chefe ou substituir um POI. Uma posição
 * ruim produz ausência, não worldgen adulterado.
 *
 * A ordem da lista é a prioridade: quem vem primeiro escolhe primeiro, e quem
 * chega depois não pode ocupar a mesma célula.
 */
export const projectDeathEchoes = (
  state: SurvivalState,
  echoes: readonly DeathEchoCandidate[],
  limit: number = DEATH_ECHOES_PER_SECTOR,
): PlacedDeathEcho[] => {
  if (limit <= 0) return [];
  const placed: PlacedDeathEcho[] = [];
  const occupied = new Set<number>();
  for (const echo of echoes) {
    if (echo.sector !== state.sector) continue;
    const candidate = placeOne(state, echo, occupied);
    if (!candidate) continue;
    placed.push(candidate);
    occupied.add(candidate.cell);
    if (placed.length >= limit) break;
  }
  return placed;
};

// ---------------------------------------------------------------------------
// Agrupamento
// ---------------------------------------------------------------------------

/** Raio, em tiles, dentro do qual duas mortes contam como "a mesma câmara". */
export const DEATH_ECHO_CLUSTER_RADIUS = 6;

/**
 * Colapsa mortes da mesma câmara num único corpo que conta quantas foram.
 *
 * Existe para o contrato de seed compartilhada. Ali as coordenadas são reais e
 * todo mundo joga o mesmo mapa, então a mesma câmara letal acumula dezenas de
 * cápsulas — e cinquenta carcaças no mesmo lugar deixam de ser um aviso e viram
 * um cemitério, que é ruído.
 *
 * RODA ANTES DA PROJEÇÃO, e a ordem é o ponto inteiro. Agrupar depois significaria
 * agrupar o que sobrou do teto de corpos: vinte cápsulas da mesma câmara viravam
 * quatro corpos, o sobrevivente anunciava no máximo quatro perdas, e as dezesseis
 * descartadas nunca eram contadas. Pior, as que disputavam a MESMA célula exata
 * perdiam a disputa e eram espalhadas para células topológicas sem relação
 * nenhuma — o contrato produzia corpos em lugares onde ninguém morreu.
 *
 * Agrupando antes, o teto passa a valer para CÂMARAS e não para cápsulas, que é o
 * que "no máximo quatro corpos por setor" sempre quis dizer.
 *
 * Só agrupa o que veio do MESMO mundo. Duas cápsulas de seeds diferentes têm
 * células de origem sem relação, e aproximá-las por coordenada seria comparar
 * endereços de cidades diferentes.
 *
 * O sobrevivente é o PRIMEIRO da lista, não uma média: um corpo inventado no
 * centro de massa não morreu em lugar nenhum. Ele passa a representar as outras
 * mortes, e a causa que o painel narra continua sendo a causa autoritativa de uma
 * morte real — por isso o texto diz "predominante".
 */
export const groupDeathEchoesByChamber = (
  state: SurvivalState,
  capsules: readonly DeathEchoCapsule[],
  radius: number = DEATH_ECHO_CLUSTER_RADIUS,
): DeathEchoCandidate[] => {
  const out: DeathEchoCandidate[] = [];
  const chambers: DeathEchoCandidate[] = [];
  for (const capsule of capsules) {
    if (!sharesWorld(state, capsule)) {
      out.push(capsule);
      continue;
    }
    const host = chambers.find(
      (candidate) =>
        squaredDistance(candidate.sourceX, candidate.sourceY, capsule.sourceX, capsule.sourceY) <=
        radius ** 2,
    );
    if (host) {
      host.lost = (host.lost ?? 1) + 1;
      continue;
    }
    // A MESMA referência entra nas duas listas: `chambers` é o índice de busca e
    // `out` preserva a ordem de prioridade, então incrementar `lost` no host
    // atualiza o candidato que será projetado.
    const chamber: DeathEchoCandidate = { ...capsule, lost: 1 };
    chambers.push(chamber);
    out.push(chamber);
  }
  return out;
};
