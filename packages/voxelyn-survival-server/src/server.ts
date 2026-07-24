import {
  CURRENT_VERSIONS,
  LIMITS,
  RateLimiter,
  checkProtocolVersion,
  decodeMessage,
  validateClientMessage,
  type ServerMessage,
} from '@voxelyn/survival-protocol';
import { GameRoom } from './room.js';

export type Outbound = { clientId: string; msg: ServerMessage };

export type ServerOptions = {
  maxPlayersPerRoom?: number;
  baseSeed?: number;
  logger?: (line: Record<string, unknown>) => void;
};

type Conn = {
  clientId: string;
  room: GameRoom | null;
  rate: RateLimiter;
  lastSeenMs: number;
};

/**
 * Servidor autoritativo transport-agnostic. Recebe mensagens de cliente ja
 * decodificadas (raw string), roteia para salas e produz mensagens de saida.
 * O adaptador de rede (ws) apenas transporta bytes e chama tick() no relogio.
 */
export class SurvivalServer {
  private readonly conns = new Map<string, Conn>();
  private readonly rooms: GameRoom[] = [];
  private roomCounter = 0;
  private seedCounter = 0;
  private readonly maxPlayers: number;
  private readonly baseSeed: number;
  private readonly log: (line: Record<string, unknown>) => void;

  constructor(opts: ServerOptions = {}) {
    this.maxPlayers = opts.maxPlayersPerRoom ?? 2;
    this.baseSeed = opts.baseSeed ?? 0x5c0ffee;
    this.log = opts.logger ?? (() => {});
  }

  addConnection(clientId: string, nowMs = 0): void {
    this.conns.set(clientId, { clientId, room: null, rate: new RateLimiter(LIMITS.maxCommandMessagesPerSecond, 1000), lastSeenMs: nowMs });
  }

  removeConnection(clientId: string): void {
    const conn = this.conns.get(clientId);
    if (conn?.room) {
      conn.room.detach(clientId);
      this.log({ ev: 'disconnect', clientId, room: conn.room.id });
      this.reapRoom(conn.room);
    }
    this.conns.delete(clientId);
  }

  private reapRoom(room: GameRoom): void {
    // sala vazia (nenhum slot jamais conectou de novo) e finalizada -> descarta
    const anyEver = room.slots.length > 0;
    const anyConnected = room.connectedCount() > 0;
    if (anyEver && !anyConnected && (room.state.phase !== 'running')) {
      const idx = this.rooms.indexOf(room);
      if (idx >= 0) this.rooms.splice(idx, 1);
    }
  }

  private openRoom(): GameRoom {
    let room = this.rooms.find((r) => r.hasOpenSlot() && r.state.phase === 'running');
    if (!room) {
      const seed = (this.baseSeed + this.seedCounter++ * 0x9e3779b9) >>> 0;
      room = new GameRoom(String(this.roomCounter++), seed, this.maxPlayers);
      this.rooms.push(room);
      this.log({ ev: 'room_open', room: room.id, seed });
    }
    return room;
  }

  /** Processa uma mensagem crua de um cliente; retorna respostas imediatas. */
  handleMessage(clientId: string, raw: string, nowMs = 0): Outbound[] {
    const conn = this.conns.get(clientId);
    if (!conn) return [];
    conn.lastSeenMs = nowMs;

    if (!conn.rate.allow(nowMs)) {
      return []; // rate limit: descarta silenciosamente
    }

    const decoded = decodeMessage(raw);
    if (!decoded) return [{ clientId, msg: { t: 'reject', reason: 'mensagem invalida' } }];

    const validated = validateClientMessage(decoded);
    if (!validated.ok) return [{ clientId, msg: { t: 'reject', reason: validated.reason } }];
    const msg = validated.value;

    switch (msg.t) {
      case 'hello': {
        const vc = checkProtocolVersion(msg.versions);
        if (!vc.ok) return [{ clientId, msg: { t: 'reject', reason: vc.reason, field: vc.field } }];

        // reconexao por resume token
        if (msg.resumeToken) {
          for (const room of this.rooms) {
            const slot = room.reattach(msg.resumeToken, clientId);
            if (slot) {
              conn.room = room;
              this.log({ ev: 'reconnect', clientId, room: room.id, slot: slot.slot });
              return [{ clientId, msg: this.welcome(room, slot.slot, slot.resumeToken) }, this.resyncMsg(room, clientId)];
            }
          }
          return [{ clientId, msg: { t: 'reject', reason: 'resume token invalido' } }];
        }

        const room = this.openRoom();
        const slot = room.attach(clientId);
        if (!slot) return [{ clientId, msg: { t: 'reject', reason: 'sala cheia' } }];
        conn.room = room;
        this.log({ ev: 'join', clientId, room: room.id, slot: slot.slot });
        return [{ clientId, msg: this.welcome(room, slot.slot, slot.resumeToken) }, this.resyncMsg(room, clientId)];
      }

      case 'cmd': {
        if (conn.room) conn.room.applyCommand(clientId, msg.seq, msg.commands);
        return [];
      }

      case 'ping':
        return [
          {
            clientId,
            msg: { t: 'pong', seq: msg.seq, clientTimeMs: msg.clientTimeMs, serverTick: conn.room?.state.tick ?? 0 },
          },
        ];

      case 'resync':
        if (conn.room) return [this.resyncMsg(conn.room, clientId)];
        return [];

      default:
        return [];
    }
  }

  private welcome(room: GameRoom, slot: number, resumeToken: string): ServerMessage {
    return {
      t: 'welcome',
      versions: CURRENT_VERSIONS,
      playerId: slot + 1,
      resumeToken,
      seed: room.seed,
      worldWidth: room.width,
      worldHeight: room.height,
      mapHash: room.mapHash,
    };
  }

  private resyncMsg(room: GameRoom, clientId: string): Outbound {
    const slot = room.slotForClient(clientId);
    if (slot) slot.needsFullResync = false;
    return { clientId, msg: room.buildFullResync() };
  }

  /** Avanca todas as salas ativas um tick e retorna snapshots para clientes conectados. */
  tick(): Outbound[] {
    const out: Outbound[] = [];
    for (const room of this.rooms) {
      const terminal =
        room.state.phase === 'dead' ||
        room.state.phase === 'extracted' ||
        room.state.phase === 'extracted_with_core';
      // salas terminadas nao avancam a sim, mas ainda podem emitir um snapshot final
      const { events, chunkDiffs, removed } = terminal
        ? { events: [], chunkDiffs: [], removed: [] }
        : room.step();
      for (const slot of room.slots) {
        if (slot.clientId === null || slot.needsFullResync) continue;
        out.push({ clientId: slot.clientId, msg: room.buildSnapshot(slot, chunkDiffs, removed, events) });
      }
    }
    return out;
  }

  /** Desconexoes por heartbeat expirado. */
  reapStale(nowMs: number): string[] {
    const dead: string[] = [];
    for (const conn of this.conns.values()) {
      if (nowMs - conn.lastSeenMs > LIMITS.heartbeatTimeoutMs) dead.push(conn.clientId);
    }
    for (const id of dead) this.removeConnection(id);
    return dead;
  }

  roomCount(): number {
    return this.rooms.length;
  }
  connectionCount(): number {
    return this.conns.size;
  }
  roomForClient(clientId: string): GameRoom | null {
    return this.conns.get(clientId)?.room ?? null;
  }
}
