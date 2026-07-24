import type { PlayerCommand, RunPhase, SemanticEvent } from '@voxelyn/survival-sim';
import type { VersionTriple } from './version.js';
import type { ChunkDiff } from './chunk-diff.js';

// ---------------------------------------------------------------------------
// Limites de payload e taxa (aplicados no servidor; documentados no protocolo).
// ---------------------------------------------------------------------------
export const LIMITS = {
  maxCommandsPerMessage: 8,
  maxCommandMessagesPerSecond: 40, // > TICK_HZ para tolerar jitter, com folga
  maxMessageBytes: 16 * 1024,
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
};

export type ProjectileSnapshot = {
  id: number;
  x: number;
  y: number;
  hostile: boolean;
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
export const decodeMessage = (raw: string): AnyMessage | null => {
  if (raw.length > LIMITS.maxMessageBytes) return null;
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
