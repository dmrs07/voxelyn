import type { EntityActionKind, EntityActionPhase, PlayerCommand, RunPhase, SemanticEvent } from '@voxelyn/survival-sim';
import type { VersionTriple } from './version.js';
import type { ChunkDiff } from './chunk-diff.js';

// ---------------------------------------------------------------------------
// Limites de payload e taxa (aplicados no servidor; documentados no protocolo).
// ---------------------------------------------------------------------------
export const LIMITS = {
  maxCommandsPerMessage: 8,
  maxCommandMessagesPerSecond: 40, // > TICK_HZ para tolerar jitter, com folga
  /**
   * Limite de INGRESSO (cliente -> servidor). E um controle anti-abuso sobre
   * entrada nao confiavel; comandos sao pequenos por natureza.
   */
  maxClientMessageBytes: 16 * 1024,
  /**
   * Limite de EGRESSO (servidor -> cliente). Precisa ser folgado: full_resync
   * carrega o grid inteiro (~290 KB num mundo 96x96) e e justamente o caminho
   * de recuperacao. Aplicar aqui o limite de comando descartaria TODO resync.
   */
  maxServerMessageBytes: 4 * 1024 * 1024,
  maxChunkDiffsPerSnapshot: 64,
  heartbeatIntervalMs: 2000,
  heartbeatTimeoutMs: 8000,
} as const;

// ---------------------------------------------------------------------------
// Cliente -> Servidor. Clientes enviam apenas INTENCOES, nunca fatos.
// ---------------------------------------------------------------------------
export type ClientHello = {
  t: 'hello';
  versions: VersionTriple;
  resumeToken?: string; // reconexao
  displayName?: string;
};

export type ClientCommand = {
  t: 'cmd';
  // sequencia monotonica por cliente, para ack + deduplicacao no servidor
  seq: number;
  // tick-alvo do cliente (informativo; o servidor permanece autoritativo sobre o tempo)
  clientTick: number;
  commands: PlayerCommand[];
};

export type ClientHeartbeat = {
  t: 'ping';
  seq: number;
  clientTimeMs: number;
};

export type ClientResyncRequest = {
  t: 'resync';
  reason: string;
};

export type ClientMessage = ClientHello | ClientCommand | ClientHeartbeat | ClientResyncRequest;

// ---------------------------------------------------------------------------
// Servidor -> Cliente. O servidor e autoritativo sobre tudo.
// ---------------------------------------------------------------------------
export type EntityActionSnapshot = {
  kind: EntityActionKind;
  phase: EntityActionPhase;
  startedAt: number;
  releaseAt: number;
  endsAt: number;
  dx: number;
  dy: number;
  target?: number;
};

export type EntitySnapshot = {
  id: number;
  kind: 'player' | 'enemy';
  archetype: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  elite: boolean;
  downed?: boolean; // players abatidos
  facingX?: number;
  facingY?: number;
  action?: EntityActionSnapshot;
};

/** Estado autoritativo privado do proprio viewer (HUD do jogador local). */
export type ViewerState = {
  slot: number;
  heat: number;
  consumables: number;
  modifiers: string[];
  hasCore: boolean;
  downed: boolean;
  aimX: number;
  aimY: number;
  overheated: boolean;
};

export type ProjectileSnapshot = {
  id: number;
  x: number;
  y: number;
  hostile: boolean;
};

/**
 * Estado de mundo que nao vive no grid (chunk diffs) nem nas entidades: baus
 * abertos, nucleo retirado, guardiao acordado. O cliente gera esses objetos
 * localmente pela seed, mas nao pode inferir se ja foram consumidos — sem isto
 * o renderer desenha para sempre um bau ja aberto ou um nucleo ja retirado.
 * Poucos bytes: enviado no full_resync e nos snapshots apenas quando muda.
 */
export type WorldFlags = {
  openedCaches: number[]; // indices em state.caches
  coreTaken: boolean;
  guardianAwake: boolean;
};

export type ServerWelcome = {
  t: 'welcome';
  versions: VersionTriple;
  playerId: number;
  resumeToken: string;
  seed: number;
  worldWidth: number;
  worldHeight: number;
  // hash do estado estatico inicial gerado localmente pelo cliente (validacao)
  mapHash: string;
};

export type ServerReject = {
  t: 'reject';
  reason: string;
  field?: string;
};

/**
 * Snapshot incremental. NAO contem o grid inteiro: apenas diffs de chunks
 * modificados, entidades ativas e eventos semanticos desde o ultimo snapshot.
 */
export type ServerSnapshot = {
  t: 'snapshot';
  serverTick: number;
  // maior seq de comando processado por cliente (ack + dedup)
  ackSeq: number;
  phase: RunPhase;
  entities: EntitySnapshot[];
  projectiles: ProjectileSnapshot[];
  removedEntities: number[];
  chunkDiffs: ChunkDiff[];
  events: SemanticEvent[];
  contamination: number;
  // enviado apenas nos ticks em que muda (o cliente mantem o ultimo aplicado)
  world?: WorldFlags;
  // estado privado do viewer (HUD)
  you?: ViewerState;
  // hash autoritativo periodico para deteccao de divergencia
  authHash?: string;
};

/** Reenvio completo do mundo quando ha divergencia irrecuperavel. */
export type ServerFullResync = {
  t: 'full_resync';
  serverTick: number;
  seed: number;
  // versoes de chunk + celulas completas por chunk (via chunk-diff sobre baseline vazia)
  chunkDiffs: ChunkDiff[];
  entities: EntitySnapshot[];
  // sempre presente: e a base que reconecta/late-join sincroniza de uma vez
  world: WorldFlags;
  authHash: string;
};

export type ServerHeartbeatAck = {
  t: 'pong';
  seq: number;
  clientTimeMs: number;
  serverTick: number;
};

export type ServerMessage =
  | ServerWelcome
  | ServerReject
  | ServerSnapshot
  | ServerFullResync
  | ServerHeartbeatAck;

export type AnyMessage = ClientMessage | ServerMessage;

export const encodeMessage = (msg: AnyMessage): string => JSON.stringify(msg);

/** Parse tolerante: retorna null em JSON invalido (nunca lanca). */
const decodeWithLimit = (raw: string, maxBytes: number): AnyMessage | null => {
  if (raw.length > maxBytes) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.t === 'string') {
      return parsed as AnyMessage;
    }
    return null;
  } catch {
    return null;
  }
};

/** Ingresso no servidor: entrada nao confiavel, limite apertado. */
export const decodeClientMessage = (raw: string): AnyMessage | null =>
  decodeWithLimit(raw, LIMITS.maxClientMessageBytes);

/**
 * Frames vindos do servidor no cliente. Limite generoso — apenas um teto de
 * memoria contra um peer hostil, nao o limite de comando (que descartaria
 * full_resync inteiro).
 */
export const decodeMessage = (raw: string): AnyMessage | null =>
  decodeWithLimit(raw, LIMITS.maxServerMessageBytes);
