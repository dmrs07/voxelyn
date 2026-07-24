import {
  CURRENT_VERSIONS,
  LIMITS,
  RateLimiter,
  checkProtocolVersion,
  decodeClientMessage,
  validateClientMessage,
  type ServerMessage,
} from '@voxelyn/survival-protocol';
import { MAX_PLAYERS } from '@voxelyn/survival-sim';
import { GameRoom } from './room.js';

export type Outbound = { clientId: string; msg: ServerMessage };

/**
 * Carencia antes de expirar uma sala sem clientes conectados (em ticks de 20 Hz).
 * Generosa o bastante para cobrir reconexao por resume token (~90s).
 */
const ABANDON_GRACE_TICKS = 20 * 90;

/**
 * Intervalo minimo entre full_resyncs para um mesmo cliente. Cada resync
 * serializa o grid inteiro (~290 KB); no limite de mensagens compartilhado
 * (40/s) um unico peer forcaria ~12 MB/s de serializacao e alocacao, o que
 * compete com o loop autoritativo. Pedidos dentro da janela nao sao perdidos:
 * ficam COALESCIDOS em needsFullResync e sao servidos assim que ela expira.
 */
const RESYNC_COOLDOWN_TICKS = 20;

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
  /** roomId -> tick em que a sala ficou sem clientes (para expiracao). */
  private readonly emptySince = new Map<string, number>();
  private tickCount = 0;
  private roomCounter = 0;
  private seedCounter = 0;
  private readonly maxPlayers: number;
  private readonly baseSeed: number;
  private readonly log: (line: Record<string, unknown>) => void;

  constructor(opts: ServerOptions = {}) {
    // Capacidade valida de uma sala autoritativa: [2, MAX_PLAYERS].
    // Teto: a sim clampa createRun a MAX_PLAYERS; uma sala maior daria ao
    // cliente extra um slot sem playerExtras, e viewerState() quebraria o loop.
    // Piso: uma sala de capacidade 1 faz a sim rodar em modo SOLO local
    // (playerCount === 1), onde abrir um bau entra em phase 'choice' — fase que
    // o protocolo nao transporta e o cliente online nao sabe responder, travando
    // a sala para sempre. Jogar sozinho online continua funcionando: e uma sala
    // de capacidade 2 com o segundo slot ainda nao reivindicado.
    this.maxPlayers = Math.max(2, Math.min(MAX_PLAYERS, opts.maxPlayersPerRoom ?? 2));
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

  private dropRoom(room: GameRoom, reason: string): void {
    const idx = this.rooms.indexOf(room);
    if (idx >= 0) {
      this.rooms.splice(idx, 1);
      this.log({ ev: 'room_close', room: room.id, reason });
    }
  }

  private reapRoom(room: GameRoom): void {
    // sala sem clientes e ja finalizada -> descarta na hora; salas 'running'
    // abandonadas expiram pela varredura periodica (sweepRooms).
    if (room.connectedCount() === 0 && room.state.phase !== 'running') {
      this.dropRoom(room, 'finished_and_empty');
    }
  }

  /**
   * Expira salas abandonadas: sem nenhum cliente conectado por
   * ABANDON_GRACE_TICKS. Sem isso, abas fechadas vazam salas e trabalho de
   * simulacao indefinidamente no servidor unico do alpha.
   */
  private sweepRooms(): void {
    for (const room of [...this.rooms]) {
      if (room.connectedCount() > 0) {
        this.emptySince.delete(room.id);
        continue;
      }
      const since = this.emptySince.get(room.id);
      if (since === undefined) {
        this.emptySince.set(room.id, this.tickCount);
      } else if (this.tickCount - since >= ABANDON_GRACE_TICKS) {
        this.emptySince.delete(room.id);
        this.dropRoom(room, 'abandoned');
      }
    }
  }

  private openRoom(): GameRoom {
    // so reaproveita sala com capacidade livre E pelo menos um cliente ativo:
    // uma sala reservada/abandonada nunca e pareada com um cliente novo.
    let room = this.rooms.find(
      (r) => r.hasOpenSlot() && r.state.phase === 'running' && r.connectedCount() > 0
    );
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

    const decoded = decodeClientMessage(raw);
    if (!decoded) return [{ clientId, msg: { t: 'reject', reason: 'mensagem invalida' } }];

    const validated = validateClientMessage(decoded);
    if (!validated.ok) return [{ clientId, msg: { t: 'reject', reason: validated.reason } }];
    const msg = validated.value;

    switch (msg.t) {
      case 'hello': {
        const vc = checkProtocolVersion(msg.versions);
        if (!vc.ok) return [{ clientId, msg: { t: 'reject', reason: vc.reason, field: vc.field } }];

        // Um socket = uma sessao. Um segundo hello anexaria o MESMO clientId a
        // outro slot/sala e sobrescreveria conn.room; no close, removeConnection
        // so desanexa a ultima, e as anteriores ficam com clientId nao-nulo para
        // sempre — connectedCount() nunca zera, a sala nunca expira e segue
        // simulando (um cliente hostil vazaria salas a vontade).
        if (conn.room) {
          return [{ clientId, msg: { t: 'reject', reason: 'sessao ja iniciada neste socket' } }];
        }

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

      case 'resync': {
        if (!conn.room) return [];
        const slot = conn.room.slotForClient(clientId);
        if (slot && this.tickCount - slot.lastResyncTick < RESYNC_COOLDOWN_TICKS) {
          // dentro do cooldown: marca pendente e serve no tick em que expirar
          slot.needsFullResync = true;
          return [];
        }
        return [this.resyncMsg(conn.room, clientId)];
      }

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
    if (slot) {
      slot.needsFullResync = false;
      slot.lastResyncTick = this.tickCount;
    }
    // NAO marca as WorldFlags como enviadas aqui: se este resync se perder, o
    // cliente ficaria sem elas para sempre. Deixa o proximo snapshot reenviar
    // (sao poucos bytes) em vez de otimizar um caminho de recuperacao.
    return { clientId, msg: room.buildFullResync() };
  }

  /** Avanca todas as salas ativas um tick e retorna snapshots para clientes conectados. */
  tick(): Outbound[] {
    const out: Outbound[] = [];
    this.tickCount += 1;
    this.sweepRooms(); // expira salas abandonadas antes de simular
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
        if (slot.clientId === null) continue;
        if (slot.needsFullResync) {
          // pedido coalescido: so sai quando o cooldown deste cliente expira
          if (this.tickCount - slot.lastResyncTick >= RESYNC_COOLDOWN_TICKS) {
            out.push(this.resyncMsg(room, slot.clientId));
          }
          continue;
        }
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
