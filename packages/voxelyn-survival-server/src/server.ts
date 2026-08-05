import {
  CURRENT_VERSIONS,
  LIMITS,
  RateLimiter,
  checkProtocolVersion,
  decodeClientMessage,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  validateClientMessage,
  type ServerMessage,
} from '@voxelyn/survival-protocol';
import {
  DEFAULT_RUN_DEPTH,
  MAX_PLAYERS,
  normalizeRunDepth,
  type DamageCause,
  type RunDepthConfig,
  type SemanticEvent,
} from '@voxelyn/survival-sim';
import { GameRoom } from './room.js';

export type Outbound = { clientId: string; msg: ServerMessage };

/**
 * Chamado quando uma sala termina a run.
 *
 * O gancho existe para o ranking. Runs de co-op nao passam por re-simulacao e
 * nao precisam: elas foram simuladas AQUI, por este processo, a partir de
 * intencoes validadas. O resultado ja e autoritativo no instante em que nasce —
 * pedir ao cliente para reenviar um log seria pedir de volta o que o servidor
 * acabou de calcular.
 */
export type RunFinishedHook = (room: GameRoom) => void;

/**
 * Uma morte de Prospector, com a causa JÁ ASSOCIADA à posição.
 *
 * É esta associação que o cliente não consegue fazer no co-op e que o servidor
 * faz de graça: `summary.deathCause` descreve a causa que encerrou a SALA, mas
 * `playerExtras[slot].lastDamage` descreve o que matou ESTE Prospector. Casar a
 * posição local com a causa da sala fabricaria uma morte que não aconteceu — e é
 * por isso que a captura comunitária esperou até existir servidor.
 */
export type PlayerDeath = {
  slot: number;
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  tick: number;
  sector: number;
  cause: DamageCause;
};

/**
 * Chamado no MESMO tick em que um Prospector morre, e não no fim da run.
 *
 * A diferença importa: `descend` reposiciona TODOS os jogadores na entrada do
 * mapa novo, inclusive os mortos. Uma captura no fim da run leria, para quem
 * morreu no setor 1, a coordenada da entrada do setor 3 — um corpo colocado onde
 * ninguém morreu, com a topologia de um mapa que a pessoa nunca viu.
 */
export type PlayerDeathHook = (room: GameRoom, death: PlayerDeath) => void;

/**
 * Carencia antes de expirar uma sala sem clientes conectados (em ticks de 20 Hz).
 * Generosa o bastante para cobrir reconexao por resume token (~90s).
 */
export const ABANDON_GRACE_TICKS = 20 * 90;

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
  onRunFinished?: RunFinishedHook;
  onPlayerDeath?: PlayerDeathHook;
  /**
   * A profundidade que TODA sala de co-op deste processo usa. Padrao: G-00,
   * tres setores. Ver a atribuicao no construtor para a politica e o porque.
   */
  coopDepth?: RunDepthConfig;
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
  private readonly onRunFinished: RunFinishedHook | null;
  private readonly onPlayerDeath: PlayerDeathHook | null;
  private readonly coopDepth: RunDepthConfig;

  constructor(opts: ServerOptions = {}) {
    // A sim clampa createRun a MAX_PLAYERS; se a sala aceitasse mais, o cliente
    // extra receberia um slot sem playerExtras correspondente e viewerState()
    // quebraria o loop autoritativo no tick seguinte.
    this.maxPlayers = Math.max(1, Math.min(MAX_PLAYERS, opts.maxPlayersPerRoom ?? 2));
    this.baseSeed = opts.baseSeed ?? 0x5c0ffee;
    this.log = opts.logger ?? (() => {});
    this.onRunFinished = opts.onRunFinished ?? null;
    this.onPlayerDeath = opts.onPlayerDeath ?? null;
    // A POLITICA DE PROFUNDIDADE DO CO-OP, escolhida aqui e nao por sala.
    //
    // Uma sala de co-op nao tem perfil: o handshake e anonimo e nao ha ticket.
    // Nao existe, portanto, "a geracao de quem criou a sala" para consultar —
    // e usar a menor geracao dos participantes exigiria autenticar todo mundo
    // antes de gerar o primeiro mundo, que e uma mudanca de outro tamanho.
    //
    // A politica adotada e explicita e igual a que o co-op ja usa para o tuning
    // (G-00 de fabrica, para todos): TRES setores, um Nucleo no terceiro. Uma
    // seed de co-op significa o mesmo desafio para as duas pessoas, e progressao
    // permanente de uma delas nao alonga a run da outra. O campo existe para
    // que a decisao seja configuravel e testavel em vez de implicita.
    this.coopDepth = normalizeRunDepth(opts.coopDepth ?? DEFAULT_RUN_DEPTH);
  }

  addConnection(clientId: string, nowMs = 0): void {
    this.conns.set(clientId, { clientId, room: null, rate: new RateLimiter(LIMITS.maxCommandMessagesPerSecond, 1000), lastSeenMs: nowMs });
  }

  removeConnection(clientId: string): void {
    const conn = this.conns.get(clientId);
    if (conn?.room) {
      conn.room.detach(clientId);
      this.log({ ev: 'disconnect', clientId, room: conn.room.id });
      // Inclusive salas terminais ficam disponiveis para resume token durante o
      // grace. O snapshot final pode ter se perdido antes deste close.
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

  private newRoom(code: string): GameRoom {
    const seed = (this.baseSeed + this.seedCounter++ * 0x9e3779b9) >>> 0;
    const room = new GameRoom(String(this.roomCounter++), seed, this.maxPlayers, code, this.coopDepth);
    this.rooms.push(room);
    this.log({ ev: 'room_open', room: room.id, seed, code });
    return room;
  }

  /** Codigo livre entre as salas existentes. Ver room-code.ts. */
  private freshCode(): string {
    // 28^4 combinacoes contra um punhado de salas simultaneas: a colisao e rara
    // o bastante para que algumas tentativas bastem, e o teto evita laco
    // infinito no caso patologico de o gerador injetado ser constante.
    for (let attempt = 0; attempt < 32; attempt++) {
      const code = generateRoomCode();
      if (!this.rooms.some((r) => r.code === code)) return code;
    }
    return generateRoomCode();
  }

  private openRoom(): GameRoom {
    // so reaproveita sala com capacidade livre E pelo menos um cliente ativo:
    // uma sala reservada/abandonada nunca e pareada com um cliente novo.
    const room = this.rooms.find(
      (r) => r.hasOpenSlot() && r.state.phase === 'running' && r.connectedCount() > 0
    );
    return room ?? this.newRoom(this.freshCode());
  }

  /**
   * Sala de um codigo, criando-a se ainda nao existir.
   *
   * Criar sob demanda e o que faz o convite funcionar nos DOIS sentidos: quem
   * combinou o codigo antes pode entrar primeiro, sem que exista um "dono" que
   * precise chegar antes. Sem isso, o segundo jogador receberia "sala nao
   * encontrada" toda vez que fosse o mais rapido dos dois.
   */
  private roomByCode(code: string): GameRoom | { error: string } {
    const existing = this.rooms.find((r) => r.code === code);
    if (!existing) return this.newRoom(code);
    // Sala existente so aceita quem cabe. Uma sala cheia ou ja terminada nao
    // vira sala nova com o mesmo codigo: isso separaria em silencio duas
    // pessoas que digitaram o mesmo codigo achando que se encontrariam.
    if (existing.state.phase !== 'running') return { error: 'essa sala ja terminou a descida' };
    if (!existing.hasOpenSlot()) return { error: 'sala cheia' };
    return existing;
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

        let room: GameRoom;
        if (msg.roomCode !== undefined) {
          const code = normalizeRoomCode(msg.roomCode);
          if (!isValidRoomCode(code)) {
            return [{ clientId, msg: { t: 'reject', reason: `codigo de sala invalido: ${code}` } }];
          }
          const found = this.roomByCode(code);
          if ('error' in found) return [{ clientId, msg: { t: 'reject', reason: found.error } }];
          room = found;
        } else {
          room = this.openRoom();
        }
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
        // Sem slot nao ha o que ressincronizar: mandar ~290 KB de mundo para
        // um socket que nao joga e so superficie de abuso.
        if (!slot) return [];
        if (this.tickCount - slot.lastResyncTick < RESYNC_COOLDOWN_TICKS) {
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
      roomCode: room.code,
      seed: room.seed,
      sector: room.state.sector,
      // A profundidade da SALA, nao a do perfil de quem entra: todos jogam a
      // mesma descida, e o HUD do segundo participante tem de mostrar o mesmo
      // denominador que o do primeiro.
      sectorCount: room.state.config.depth.sectorCount,
      coreSectors: [...room.state.config.depth.coreSectors],
      generation: room.state.config.depth.generation,
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
    // (sao poucos bytes) em vez de otimizar um caminho de recuperacao. O slot
    // ainda viaja: e ele que define de quem e o `you`.
    return { clientId, msg: room.buildFullResync(slot) };
  }

  /** Avanca todas as salas ativas um tick e retorna snapshots para clientes conectados. */
  tick(): Outbound[] {
    const out: Outbound[] = [];
    this.tickCount += 1;
    this.sweepRooms(); // expira salas abandonadas antes de simular
    for (const room of this.rooms) {
      const wasTerminal = room.state.phase !== 'running';
      // Salas ja terminadas nao avancam; salas correndo podem terminar NESTE passo.
      const { events, chunkDiffs, removed } = wasTerminal
        ? { events: [], chunkDiffs: [], removed: [] }
        : room.step();
      if (this.onPlayerDeath) this.reportDeaths(room, events);
      const terminal = room.state.phase !== 'running';
      // Reporta no MESMO tick que congelou o sumario, antes do snapshot final.
      // Assim o ultimo socket pode fechar logo apos recebe-lo sem perder o resultado.
      if (terminal && !room.resultReported && room.state.summary) {
        room.resultReported = true;
        this.onRunFinished?.(room);
      }
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

  /**
   * Traduz eventos de morte em mortes de Prospector, com causa por slot.
   *
   * O evento carrega o ID da entidade, e o slot e descoberto pela lista de
   * jogadores em vez de por `id - 1`: a aritmetica funciona hoje e viraria um bug
   * silencioso no dia em que a numeracao mudar — um corpo atribuido ao parceiro,
   * com a causa do parceiro.
   *
   * Sem `lastDamage` nao ha captura. Preferir ausencia a inventar `unknown`: uma
   * carcaca que nao sabe do que morreu nao ensina nada e ainda ocupa a unica vaga
   * do setor.
   */
  private reportDeaths(room: GameRoom, events: SemanticEvent[]): void {
    for (const ev of events) {
      if (ev.t !== 'death' || ev.archetype !== 'prospector') continue;
      const slot = room.state.players.findIndex((p) => p.id === ev.entity);
      if (slot < 0) continue;
      const cause = room.state.playerExtras[slot]?.lastDamage?.cause;
      if (!cause) continue;
      this.onPlayerDeath?.(room, {
        slot,
        x: ev.x,
        y: ev.y,
        facingX: ev.facingX,
        facingY: ev.facingY,
        tick: ev.tick,
        sector: room.state.sector,
        cause,
      });
    }
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

  /**
   * Sala de um codigo, se existir. Ferramenta de teste e de diagnostico
   * operacional; o caminho de entrada e sempre `hello`.
   */
  roomForCode(code: string): GameRoom | undefined {
    return this.rooms.find((r) => r.code === code);
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
