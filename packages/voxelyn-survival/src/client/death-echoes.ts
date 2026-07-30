// Memória espacial entre runs: o que o Veio conserva de uma morte.
//
// Este arquivo é deliberadamente CLIENT-SIDE. Ecos locais da primeira etapa são
// apresentação: não colidem, não dão recurso, não entram no hash e não mudam a
// reprodução `seed + comandos`. No dia em que um eco alterar gameplay, ele deixa
// de pertencer a este caminho e passa a exigir manifesto autoritativo.

import {
  SOLID_NONE,
  SOLID_ORE,
  SOLID_ORE_CHIPPED,
  SURF_NONE,
  type DamageCause,
  type EnemyArchetype,
  type ProjectileKind,
  type RunSummary,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import { CONTENT_VERSION, SIMULATION_VERSION } from '@voxelyn/survival-protocol';

const KEY = 'voxelyn.death-echoes.v1';
const SCHEMA = 1;
export const DEATH_ECHO_HISTORY_LIMIT = 24;
export const DEATH_ECHOES_PER_SECTOR = 1;

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
};

export type DeathEchoRecords = {
  schema: number;
  nextSerial: number;
  /** Mais novo primeiro. */
  echoes: DeathEchoCapsule[];
};

export type PlacedDeathEcho = DeathEchoCapsule & {
  x: number;
  y: number;
  cell: number;
  projection: 'exact' | 'topological';
};

export type ApplyDeathEchoOnceResult = {
  records: DeathEchoRecords;
  identity: string | null;
  applied: boolean;
  echo: DeathEchoCapsule | null;
};

export const emptyDeathEchoRecords = (): DeathEchoRecords => ({
  schema: SCHEMA,
  nextSerial: 1,
  echoes: [],
});

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
]);
const PROJECTILE_KINDS = new Set<ProjectileKind>(['bolt', 'spit', 'rock', 'return_disc']);
const isEnemyArchetype = (value: unknown): value is EnemyArchetype =>
  typeof value === 'string' && ENEMY_ARCHETYPES.has(value as EnemyArchetype);
const isProjectileKind = (value: unknown): value is ProjectileKind =>
  typeof value === 'string' && PROJECTILE_KINDS.has(value as ProjectileKind);

const isDamageCause = (value: unknown): value is DamageCause => {
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
        isEnemyArchetype(cause.archetype) &&
        typeof cause.elite === 'boolean' &&
        isProjectileKind(cause.projectile)
      );
    default:
      return false;
  }
};

const parseCapsule = (value: unknown): DeathEchoCapsule | null => {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Partial<DeathEchoCapsule>;
  if (typeof raw.id !== 'string' || raw.id.length === 0 || raw.id.length > 96) return null;
  if (!isDamageCause(raw.cause)) return null;
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
  return {
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

export const decodeDeathEchoRecords = (raw: string | null): DeathEchoRecords => {
  if (!raw) return emptyDeathEchoRecords();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return emptyDeathEchoRecords();
    const data = parsed as { schema?: unknown; nextSerial?: unknown; echoes?: unknown };
    if (data.schema !== SCHEMA || !Array.isArray(data.echoes)) return emptyDeathEchoRecords();
    const echoes = data.echoes
      .map(parseCapsule)
      .filter((echo): echo is DeathEchoCapsule => echo !== null)
      .slice(0, DEATH_ECHO_HISTORY_LIMIT);
    const requestedSerial = finiteInt(data.nextSerial, 1, Number.MAX_SAFE_INTEGER);
    const nextSerial = requestedSerial ?? echoes.length + 1;
    return { schema: SCHEMA, nextSerial, echoes };
  } catch {
    return emptyDeathEchoRecords();
  }
};

export const loadDeathEchoRecords = (): DeathEchoRecords => {
  try {
    return decodeDeathEchoRecords(localStorage.getItem(KEY));
  } catch {
    return emptyDeathEchoRecords();
  }
};

export const saveDeathEchoRecords = (records: DeathEchoRecords): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    // O jogo continua sem memória espacial quando storage está bloqueado.
  }
};

export const deathEchoRunIdentity = (summary: RunSummary): string =>
  `${summary.seed}:${summary.phase}:${summary.ticks}`;

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

const progressAt = (state: SurvivalState, x: number, y: number): number => {
  const width = state.config.width;
  const height = state.config.height;
  const distance = distanceField(state.solid, width, height, state.entry.x, state.entry.y);
  const here = distance[cellIndex(width, x, y)];
  if (here < 0) return 0;
  const objective = distance[cellIndex(width, state.corePos.x, state.corePos.y)];
  let denominator = objective;
  if (denominator <= 0) {
    denominator = 0;
    for (const value of distance) denominator = Math.max(denominator, value);
  }
  if (denominator <= 0) return 0;
  return Math.max(0, Math.min(255, Math.round((here / denominator) * 255)));
};

export const captureDeathEcho = (state: SurvivalState, id: string): DeathEchoCapsule | null => {
  if (
    state.config.playerCount !== 1 ||
    state.phase !== 'dead' ||
    !state.summary ||
    !state.summary.deathCause
  ) return null;
  const width = state.config.width;
  const height = state.config.height;
  const sourceX = Math.max(0, Math.min(width - 1, Math.floor(state.player.x)));
  const sourceY = Math.max(0, Math.min(height - 1, Math.floor(state.player.y)));
  const index = cellIndex(width, sourceX, sourceY);
  return {
    id,
    sourceSeed: state.config.seed >>> 0,
    sourceSimulationVersion: SIMULATION_VERSION,
    sourceContentVersion: CONTENT_VERSION,
    sector: state.sector,
    sourceWidth: width,
    sourceHeight: height,
    sourceX,
    sourceY,
    progressQ: progressAt(state, sourceX, sourceY),
    openness: openNeighborCount(state.solid, width, height, sourceX, sourceY),
    surface: state.surface[index] ?? SURF_NONE,
    nearOre: hasOreNearby(state.solid, width, height, sourceX, sourceY),
    facingX: state.player.facing.x,
    facingY: state.player.facing.y,
    cause: state.summary.deathCause,
    ticks: state.summary.ticks,
  };
};

export const applyDeathEchoOnce = (
  records: DeathEchoRecords,
  state: SurvivalState,
  previousIdentity: string | null,
): ApplyDeathEchoOnceResult => {
  if (state.phase !== 'dead' || !state.summary) {
    return { records, identity: previousIdentity, applied: false, echo: null };
  }
  const identity = deathEchoRunIdentity(state.summary);
  if (identity === previousIdentity) return { records, identity, applied: false, echo: null };
  const echo = captureDeathEcho(state, `${identity}:${records.nextSerial}`);
  if (!echo) return { records, identity, applied: false, echo: null };
  return {
    identity,
    applied: true,
    echo,
    records: {
      schema: SCHEMA,
      nextSerial: records.nextSerial + 1,
      echoes: [echo, ...records.echoes].slice(0, DEATH_ECHO_HISTORY_LIMIT),
    },
  };
};

const hashString = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

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
  cell: number,
): number => {
  const width = state.config.width;
  const x = cell % width;
  const y = Math.floor(cell / width);
  const progressQ = objectiveDistance > 0
    ? Math.max(0, Math.min(255, Math.round((distance[cell] / objectiveDistance) * 255)))
    : 0;
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

const placeOne = (state: SurvivalState, echo: DeathEchoCapsule): PlacedDeathEcho | null => {
  const width = state.config.width;
  const height = state.config.height;
  const distance = distanceField(state.solid, width, height, state.entry.x, state.entry.y);
  const objectiveDistance = distance[cellIndex(width, state.corePos.x, state.corePos.y)];

  if (
    echo.sourceSeed === (state.config.seed >>> 0) &&
    echo.sourceSimulationVersion === SIMULATION_VERSION &&
    echo.sourceContentVersion === CONTENT_VERSION &&
    echo.sourceWidth === width &&
    echo.sourceHeight === height &&
    validCandidate(state, distance, echo.sourceX, echo.sourceY)
  ) {
    return {
      ...echo,
      x: echo.sourceX + 0.5,
      y: echo.sourceY + 0.5,
      cell: cellIndex(width, echo.sourceX, echo.sourceY),
      projection: 'exact',
    };
  }

  let bestCell = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestTie = 0xffffffff;
  for (let cell = 0; cell < state.solid.length; cell++) {
    const x = cell % width;
    const y = Math.floor(cell / width);
    if (!validCandidate(state, distance, x, y)) continue;
    const score = candidateScore(state, echo, distance, objectiveDistance, cell);
    const tie = hashString(`${state.config.seed}:${state.sector}:${echo.id}:${cell}`);
    if (score < bestScore || (score === bestScore && tie < bestTie)) {
      bestCell = cell;
      bestScore = score;
      bestTie = tie;
    }
  }
  // Uma projeção ruim é pior que ausência: faria a caixa-preta ensinar uma relação
  // espacial que a morte original nunca teve.
  if (bestCell < 0 || bestScore > 72) return null;
  return {
    ...echo,
    x: (bestCell % width) + 0.5,
    y: Math.floor(bestCell / width) + 0.5,
    cell: bestCell,
    projection: 'topological',
  };
};

export const projectDeathEchoes = (
  state: SurvivalState,
  records: DeathEchoRecords,
  limit = DEATH_ECHOES_PER_SECTOR,
): PlacedDeathEcho[] => {
  if (limit <= 0) return [];
  const placed: PlacedDeathEcho[] = [];
  const occupied = new Set<number>();
  for (const echo of records.echoes) {
    if (echo.sector !== state.sector) continue;
    const candidate = placeOne(state, echo);
    if (!candidate || occupied.has(candidate.cell)) continue;
    placed.push(candidate);
    occupied.add(candidate.cell);
    if (placed.length >= limit) break;
  }
  return placed;
};
