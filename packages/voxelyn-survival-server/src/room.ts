import { randomBytes } from 'node:crypto';
import {
  createRun,
  emptyCommand,
  hashAuthoritativeState,
  stepRun,
  type PlayerCommand,
  type SemanticEvent,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import {
  ChunkTracker,
  type ChunkDiff,
  type EntitySnapshot,
  type ProjectileSnapshot,
  type ServerFullResync,
  type ServerSnapshot,
  type ViewerState,
  type WorldFlags,
  SequenceGate,
} from '@voxelyn/survival-protocol';

const HASH_INTERVAL_TICKS = 20;

/**
 * Quanto tempo um slot desconectado continua reservado (e seu avatar continua
 * na sim, para que uma reconexao retome a run onde parou). Passado isso o slot
 * e APOSENTADO: o avatar sai da sim e a vaga volta a ser oferecida.
 * Curto o bastante para nao prender o parceiro que ficou — um avatar
 * desconectado nao anda, entao ele bloqueia a extracao coletiva enquanto
 * contar como "de pe" — e longo o bastante para uma queda de rede movel.
 */
const DISCONNECT_GRACE_TICKS = 20 * 45;

export type Slot = {
  slot: number;
  clientId: string | null; // null = desconectado (player permanece na sim)
  resumeToken: string;
  gate: SequenceGate;
  command: PlayerCommand;
  needsFullResync: boolean;
  lastAckSeq: number;
  lastWorldSig: string | null; // ultima WorldFlags enviada a este cliente
  disconnectedAtTick: number | null; // null = conectado
  retired: boolean; // grace expirado: token morto, vaga reofertada
};

/**
 * Sala autoritativa: possui a SurvivalState, aplica intencoes validadas por slot,
 * avanca a simulacao em ticks inteiros e produz snapshots incrementais.
 */
export class GameRoom {
  readonly state: SurvivalState;
  readonly slots: Slot[] = [];
  readonly mapHash: string;
  private readonly tracker: ChunkTracker;
  private prevAliveEnemies = new Set<number>();

  constructor(
    readonly id: string,
    readonly seed: number,
    readonly maxPlayers: number
  ) {
    this.state = createRun({ seed, playerCount: maxPlayers });
    // nenhum avatar entra na sim ate que um cliente reivindique o slot
    for (const e of this.state.playerExtras) e.joined = false;
    this.tracker = new ChunkTracker(this.state.config.width, this.state.config.height);
    this.tracker.seed(this.state);
    for (const enemy of this.state.enemies) if (enemy.alive) this.prevAliveEnemies.add(enemy.id);
    this.mapHash = hashStaticWorld(this.state);
  }

  get width(): number {
    return this.state.config.width;
  }
  get height(): number {
    return this.state.config.height;
  }

  /**
   * Token de retomada. E uma CREDENCIAL: quem o apresenta assume o avatar do
   * slot via reattach(). Nao pode derivar de seed/id/contador — o cliente
   * recebe a seed no welcome e o id da sala no proprio token, entao qualquer
   * formula deterministica deixaria o participante calcular o token do
   * parceiro e sequestrar o slot. 128 bits de CSPRNG, sem dado derivavel.
   */
  private makeToken(): string {
    return randomBytes(16).toString('hex');
  }

  /** Vagas conectadas (com cliente ativo). */
  connectedCount(): number {
    return this.slots.filter((s) => s.clientId !== null).length;
  }

  hasOpenSlot(): boolean {
    // Capacidade nao alocada, ou um slot aposentado (dono nao voltou dentro do
    // grace). Slots apenas desconectados seguem reservados pelo resume token —
    // so o dono pode reivindica-los via reattach().
    return this.slots.length < this.maxPlayers || this.slots.some((s) => s.retired);
  }

  /** Marca o avatar do slot como efetivamente em jogo, posicionado na entrada. */
  private claimAvatar(slot: number): void {
    const p = this.state.players[slot];
    const e = this.state.playerExtras[slot];
    if (!p || !e || e.joined) return;
    // o avatar so entra na sim quando reivindicado: ate la nao e alvo, nao sofre
    // dano e nao conta para co-op/extracao. Ao entrar, (re)posiciona na entrada.
    p.x = this.state.entry.x + 0.5 + slot;
    p.y = this.state.entry.y + 0.5;
    p.hp = p.maxHp;
    p.alive = true;
    e.downed = false;
    e.bleedoutAt = 0;
    e.joined = true;
  }

  /** Cria (ou reocupa) um slot para um cliente inedito. Nunca herda slot vivo. */
  attach(clientId: string): Slot | null {
    // slots apenas desconectados sao token-reservados: um visitante novo NAO os
    // herda (evita que um estranho controle o avatar e aprenda o token do
    // original). Ja um slot APOSENTADO foi abandonado e pode ser reocupado,
    // sempre com token novo — o token antigo morreu junto.
    const retired = this.slots.find((s) => s.retired);
    if (retired) {
      retired.clientId = clientId;
      retired.resumeToken = this.makeToken();
      retired.gate = new SequenceGate();
      retired.command = emptyCommand();
      retired.needsFullResync = true;
      retired.lastAckSeq = -1;
      retired.lastWorldSig = null;
      retired.disconnectedAtTick = null;
      retired.retired = false;
      this.claimAvatar(retired.slot); // avatar novo na entrada
      return retired;
    }
    if (this.slots.length >= this.maxPlayers) return null;
    this.claimAvatar(this.slots.length);
    const slot: Slot = {
      slot: this.slots.length,
      clientId,
      resumeToken: this.makeToken(),
      gate: new SequenceGate(),
      command: emptyCommand(),
      needsFullResync: true,
      lastAckSeq: -1,
      lastWorldSig: null,
      disconnectedAtTick: null,
      retired: false,
    };
    this.slots.push(slot);
    return slot;
  }

  /** Reanexa por resume token (reconexao). */
  reattach(resumeToken: string, clientId: string): Slot | null {
    const slot = this.slots.find((s) => s.resumeToken === resumeToken);
    if (!slot || slot.retired) return null; // token de slot aposentado nao vale
    slot.clientId = clientId;
    slot.disconnectedAtTick = null;
    slot.needsFullResync = true;
    return slot;
  }


  detach(clientId: string): void {
    const slot = this.slots.find((s) => s.clientId === clientId);
    if (slot) {
      slot.clientId = null;
      slot.command = emptyCommand(); // desconectado para de agir
      slot.disconnectedAtTick = this.state.tick; // inicia o grace
    }
  }

  /**
   * Aposenta slots cujo dono nao voltou dentro do grace. Sem isto o avatar
   * desconectado fica `joined` para sempre: como ele nao anda, `standingPlayers`
   * o conta na extracao coletiva e o parceiro que ficou nunca consegue extrair,
   * nem recebe um substituto (a sala tampouco expira, pois segue com um cliente
   * conectado).
   */
  private retireStaleSlots(): void {
    for (const slot of this.slots) {
      if (slot.retired || slot.disconnectedAtTick === null) continue;
      if (this.state.tick - slot.disconnectedAtTick < DISCONNECT_GRACE_TICKS) continue;
      slot.retired = true;
      slot.resumeToken = this.makeToken(); // invalida o token do dono anterior
      const extra = this.state.playerExtras[slot.slot];
      if (extra) extra.joined = false; // avatar sai da sim
    }
  }

  slotForClient(clientId: string): Slot | null {
    return this.slots.find((s) => s.clientId === clientId) ?? null;
  }

  /** Registra uma intencao validada (com dedup por sequencia). */
  applyCommand(clientId: string, seq: number, commands: PlayerCommand[]): boolean {
    const slot = this.slotForClient(clientId);
    if (!slot) return false;
    if (!slot.gate.accept(seq)) return false; // duplicata/fora de ordem
    slot.lastAckSeq = slot.gate.ackSeq;
    // usa o comando mais recente do lote como intencao corrente
    if (commands.length > 0) slot.command = commands[commands.length - 1];
    return true;
  }

  /** Avanca a simulacao um tick e produz os diffs de chunk do tick. */
  step(): { events: SemanticEvent[]; chunkDiffs: ChunkDiff[]; removed: number[] } {
    this.retireStaleSlots();
    const cmds: PlayerCommand[] = [];
    for (let s = 0; s < this.state.players.length; s++) {
      cmds[s] = this.slots[s]?.command ?? emptyCommand();
    }
    const { events } = stepRun(this.state, cmds);
    // A intencao corrente persiste entre ticks (o cliente envia a ~25 Hz, o
    // servidor roda a 20 Hz), mas campos de BORDA nao podem persistir: um
    // cliente suspenso logo apos enviar consume:true gastaria um consumivel
    // por tick ate zerar o inventario. Zera as bordas depois de aplicadas —
    // reativa-las exige uma nova mensagem do cliente.
    for (const slot of this.slots) {
      slot.command.dodge = false;
      slot.command.ability = false;
      slot.command.interact = false;
      slot.command.consume = false;
      slot.command.choose = null;
    }
    const chunkDiffs = this.tracker.diff(this.state);

    const nowAlive = new Set<number>();
    for (const e of this.state.enemies) if (e.alive) nowAlive.add(e.id);
    const removed: number[] = [];
    for (const id of this.prevAliveEnemies) if (!nowAlive.has(id)) removed.push(id);
    this.prevAliveEnemies = nowAlive;

    return { events, chunkDiffs, removed };
  }

  private entitySnapshots(): EntitySnapshot[] {
    const out: EntitySnapshot[] = [];
    for (let i = 0; i < this.state.players.length; i++) {
      // slots reservados mas nao reivindicados nao existem para os clientes
      if (!this.state.playerExtras[i].joined) continue;
      const p = this.state.players[i];
      out.push({
        id: p.id,
        kind: 'player',
        archetype: 'prospector',
        x: round3(p.x),
        y: round3(p.y),
        hp: Math.round(p.hp),
        maxHp: p.maxHp,
        alive: p.alive,
        elite: false,
        downed: this.state.playerExtras[i].downed,
        facingX: round3(this.state.playerExtras[i].aim.x),
        facingY: round3(this.state.playerExtras[i].aim.y),
      });
    }
    for (const e of this.state.enemies) {
      if (!e.alive) continue;
      out.push({
        id: e.id,
        kind: 'enemy',
        archetype: e.archetype,
        x: round3(e.x),
        y: round3(e.y),
        hp: Math.round(e.hp),
        maxHp: e.maxHp,
        alive: true,
        elite: e.elite,
        facingX: round3(e.facing.x),
        facingY: round3(e.facing.y),
      });
    }
    return out;
  }

  private viewerState(slot: number): ViewerState {
    const e = this.state.playerExtras[slot];
    return {
      slot,
      heat: round3(e.heat),
      consumables: e.consumables,
      modifiers: [...e.modifiers],
      hasCore: e.hasCore,
      downed: e.downed,
      aimX: round3(e.aim.x),
      aimY: round3(e.aim.y),
      overheated: this.state.tick < e.overheatedUntil,
    };
  }

  /** Flags de mundo consumivel (baus/nucleo/guardiao) que o cliente nao infere. */
  private worldFlags(): WorldFlags {
    const openedCaches: number[] = [];
    for (let i = 0; i < this.state.caches.length; i++) {
      if (this.state.caches[i].opened) openedCaches.push(i);
    }
    return { openedCaches, coreTaken: this.state.coreTaken, guardianAwake: this.state.guardianAwake };
  }

  private static worldSig(w: WorldFlags): string {
    return `${w.openedCaches.join(',')}|${w.coreTaken ? 1 : 0}|${w.guardianAwake ? 1 : 0}`;
  }

  private projectileSnapshots(): ProjectileSnapshot[] {
    return this.state.projectiles.map((p) => ({ id: p.id, x: round3(p.x), y: round3(p.y), hostile: p.hostile }));
  }

  buildSnapshot(
    slot: Slot,
    tickChunkDiffs: ChunkDiff[],
    removed: number[],
    events: SemanticEvent[]
  ): ServerSnapshot {
    const snap: ServerSnapshot = {
      t: 'snapshot',
      serverTick: this.state.tick,
      ackSeq: slot.lastAckSeq,
      phase: this.state.phase,
      entities: this.entitySnapshots(),
      projectiles: this.projectileSnapshots(),
      removedEntities: removed,
      chunkDiffs: tickChunkDiffs,
      events,
      contamination: round3(this.state.contamination),
      you: this.viewerState(slot.slot),
    };
    // flags de mundo so viajam quando mudam (abrir bau, pegar nucleo, acordar guardiao)
    const world = this.worldFlags();
    const sig = GameRoom.worldSig(world);
    if (sig !== slot.lastWorldSig) {
      snap.world = world;
      slot.lastWorldSig = sig;
    }
    if (this.state.tick % HASH_INTERVAL_TICKS === 0) {
      snap.authHash = hashAuthoritativeState(this.state);
    }
    return snap;
  }

  /** Reenvio completo do mundo para um cliente (join/reconnect/divergencia). */
  buildFullResync(slot?: Slot): ServerFullResync {
    const throwaway = new ChunkTracker(this.width, this.height);
    const chunkDiffs = throwaway.fullSnapshot(this.state);
    const world = this.worldFlags();
    // o resync ja carrega as flags: evita reenvia-las no snapshot seguinte
    if (slot) slot.lastWorldSig = GameRoom.worldSig(world);
    return {
      t: 'full_resync',
      serverTick: this.state.tick,
      seed: this.seed,
      chunkDiffs,
      entities: this.entitySnapshots(),
      world,
      authHash: hashAuthoritativeState(this.state),
    };
  }
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Hash FNV-1a das camadas estaticas iniciais (validacao de geracao local no cliente). */
export const hashStaticWorld = (state: SurvivalState): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < state.solid.length; i++) {
    const v = state.solid[i] | (state.surface[i] << 8);
    h ^= v & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};
