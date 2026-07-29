import { randomBytes } from 'node:crypto';
import {
  createRun,
  emptyCommand,
  hashAuthoritativeState,
  hashStaticWorld,
  resetPlayerProgress,
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

/**
 * Por quantos ticks a ultima intencao continua valendo sem mensagem nova.
 * O cliente envia a ~25 Hz; meio segundo cobre jitter com folga. Passado isso,
 * move/fire sao neutralizados: um PWA suspenso ou uma rede travada deixariam o
 * avatar correndo e atirando por ate 8s (o timeout do heartbeat) — tempo de
 * sobra para entrar no fogo, superaquecer e morrer numa run com permadeath.
 * A mira e preservada: ela so orienta o sprite, nao move nem dispara.
 */
const COMMAND_STALE_TICKS = 10;

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
  commandAtTick: number; // tick da ultima intencao recebida (expira continuos)
  lastResyncTick: number; // ultimo full_resync servido (cooldown anti-flood)
};

/**
 * Sala autoritativa: possui a SurvivalState, aplica intencoes validadas por slot,
 * avanca a simulacao em ticks inteiros e produz snapshots incrementais.
 */
export class GameRoom {
  readonly state: SurvivalState;
  readonly slots: Slot[] = [];
  /**
   * Hash do mundo estatico ATUAL. Nao e readonly porque a descida troca o mapa
   * inteiro; ver a reavaliacao em `step`.
   */
  mapHash: string;
  /**
   * Ligado quando o mundo muda de forma NAO-incremental (descida de setor).
   * O servidor consome a flag e reenvia o mundo completo a todos os slots.
   */
  worldReplaced = false;
  /** O resultado desta sala ja foi entregue ao ranking? */
  resultReported = false;
  private tracker: ChunkTracker;
  private prevAliveEnemies = new Set<number>();

  constructor(
    readonly id: string,
    readonly seed: number,
    readonly maxPlayers: number,
    /** Codigo de convite desta sala. Ver room-code.ts no protocolo. */
    readonly code: string = ''
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
      retired.commandAtTick = this.state.tick;
      retired.lastResyncTick = -1000;
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
      commandAtTick: this.state.tick,
      lastResyncTick: -1000,
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
      if (!extra) continue;
      extra.joined = false; // avatar sai da sim
      // O proximo ocupante e um jogador NOVO: nao pode herdar modificadores,
      // frascos nem a posse do nucleo de quem abandonou.
      if (extra.hasCore) {
        // o nucleo saiu com quem abandonou; devolve ao mundo, senao a run do
        // parceiro fica sem objetivo alcancavel por culpa alheia
        this.state.coreTaken = false;
      }
      resetPlayerProgress(extra);
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
    if (commands.length > 0) {
      slot.command = commands[commands.length - 1];
      slot.commandAtTick = this.state.tick;
    }
    return true;
  }

  /** Avanca a simulacao um tick e produz os diffs de chunk do tick. */
  step(): { events: SemanticEvent[]; chunkDiffs: ChunkDiff[]; removed: number[] } {
    this.retireStaleSlots();
    const cmds: PlayerCommand[] = [];
    for (let s = 0; s < this.state.players.length; s++) {
      const slot = this.slots[s];
      if (!slot) {
        cmds[s] = emptyCommand();
        continue;
      }
      // intencao velha demais: para de andar e de atirar (mantem a mira)
      if (this.state.tick - slot.commandAtTick > COMMAND_STALE_TICKS) {
        slot.command.move = { x: 0, y: 0 };
        slot.command.fire = false;
      }
      cmds[s] = slot.command;
    }
    const sectorBefore = this.state.sector;
    const { events } = stepRun(this.state, cmds);

    // A descida troca o MUNDO ESTATICO inteiro. Duas coisas ficariam velhas em
    // silencio se nao fossem refeitas aqui:
    //
    // - `mapHash`, que o cliente usa para conferir que gerou o mesmo mapa. Com
    //   o hash do setor anterior, todo cliente que entrasse depois da descida
    //   seria acusado de divergencia estando certo.
    // - a linha de base do ChunkTracker, que descreve o mundo ANTERIOR. Sem
    //   re-semear, o diff do tick seguinte seria calculado contra o mapa errado
    //   e cada cliente receberia uma colcha de retalhos dos dois setores.
    //
    // O resync integral vai junto: descer nao e uma mudanca incremental, e
    // tentar exprimi-la como diff custaria mais bytes que o mundo inteiro.
    const descended = this.state.sector !== sectorBefore;
    if (descended) {
      this.mapHash = hashStaticWorld(this.state);
      this.tracker = new ChunkTracker(this.state.config.width, this.state.config.height);
      this.tracker.seed(this.state);
      this.prevAliveEnemies = new Set();
      this.worldReplaced = true;
      for (const slot of this.slots) {
        slot.needsFullResync = true;
        // Passa por cima do cooldown de resync. Ele existe para conter cliente
        // que PEDE resync em loop; esta troca foi decidida pelo servidor, e
        // segurar o mundo novo por um cooldown deixaria o jogador andando num
        // mapa que nao existe mais.
        slot.lastResyncTick = Number.NEGATIVE_INFINITY;
      }
    }
    // A intencao corrente persiste entre ticks (o cliente envia a ~25 Hz, o
    // servidor roda a 20 Hz), mas campos de BORDA nao podem persistir: um
    // cliente suspenso logo apos enviar purge:true gastaria uma Celula de Purga
    // por tick ate zerar o inventario. Zera as bordas depois de aplicadas —
    // reativa-las exige uma nova mensagem do cliente.
    for (const slot of this.slots) {
      slot.command.dodge = false;
      slot.command.ability = false;
      slot.command.interact = false;
      slot.command.purge = false;
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
        stunnedUntil: p.stunnedUntil,
        action: p.action ? {
          kind: p.action.kind,
          phase: p.action.phase,
          startedAt: p.action.startedAt,
          releaseAt: p.action.releaseAt,
          endsAt: p.action.endsAt,
          dx: round3(p.action.direction.x),
          dy: round3(p.action.direction.y),
          target: p.action.target,
        } : undefined,
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
        stunnedUntil: e.stunnedUntil,
        mood: e.mood,
        action: e.action ? {
          kind: e.action.kind,
          phase: e.action.phase,
          startedAt: e.action.startedAt,
          releaseAt: e.action.releaseAt,
          endsAt: e.action.endsAt,
          dx: round3(e.action.direction.x),
          dy: round3(e.action.direction.y),
          target: e.action.target,
        } : undefined,
      });
    }
    return out;
  }

  private viewerState(slot: number): ViewerState {
    const e = this.state.playerExtras[slot];
    return {
      slot,
      heat: round3(e.heat),
      purgeCells: e.purgeCells,
      activeModules: e.activeModules.map((module) => ({
        id: module.id,
        lifetime: { ...module.lifetime },
      })),
      pendingModuleChoice: e.pendingModuleChoice ? {
        sourceSiteId: e.pendingModuleChoice.sourceSiteId,
        options: [...e.pendingModuleChoice.options] as [typeof e.pendingModuleChoice.options[0], typeof e.pendingModuleChoice.options[1]],
        createdAtTick: e.pendingModuleChoice.createdAtTick,
      } : null,
      hasCore: e.hasCore,
      downed: e.downed,
      aimX: round3(e.aim.x),
      aimY: round3(e.aim.y),
      overheated: this.state.tick < e.overheatedUntil,
    };
  }

  /** Flags de mundo consumivel (baus/nucleo/guardiao) que o cliente nao infere. */
  private worldFlags(): WorldFlags {
    return {
      salvageSites: this.state.salvageSites.map((site) => ({
        terminalState: site.terminalState,
        scanEndsAt: site.scanEndsAt,
        cacheRevealed: site.cacheRevealed,
        cacheOpened: site.cacheOpened,
      })),
      coreTaken: this.state.coreTaken,
      guardianAwake: this.state.guardianAwake,
    };
  }

  private static worldSig(w: WorldFlags): string {
    return JSON.stringify(w);
  }

  private projectileSnapshots(): ProjectileSnapshot[] {
    return this.state.projectiles.map((p) => ({
      id: p.id,
      x: round3(p.x),
      y: round3(p.y),
      hostile: p.hostile,
      kind: p.kind,
      armed: Boolean(p.modules?.explosive && p.distanceTravelled >= p.modules.explosive.armAfterDistance),
    }));
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
    // O resultado viaja em TODO snapshot de uma sala terminada, e nao uma vez
    // so: quem reconecta depois do fim da run, ou entra atrasado no ultimo
    // segundo, tambem tem de ver a tela de resultado. O custo e nulo na
    // pratica — uma sala terminal nao gera mais nada.
    if (this.state.summary) snap.summary = this.state.summary;
    return snap;
  }

  /**
   * Reenvio completo do mundo para um cliente (join/reconnect/divergencia).
   *
   * `slot` identifica o DESTINATARIO e decide de quem e o `you`; quem quiser
   * tambem dar as WorldFlags por entregues pede isso separadamente. Os dois
   * eram o mesmo parametro, e como o caminho normal de resync omitia o slot de
   * proposito (para nao dar as flags por entregues se a mensagem se perdesse),
   * todo cliente recebia o estado privado do slot 0.
   */
  buildFullResync(slot: Slot | null, markWorldFlagsSent = false): ServerFullResync {
    const throwaway = new ChunkTracker(this.width, this.height);
    const chunkDiffs = throwaway.fullSnapshot(this.state);
    const world = this.worldFlags();
    if (slot && markWorldFlagsSent) slot.lastWorldSig = GameRoom.worldSig(world);
    return {
      t: 'full_resync',
      serverTick: this.state.tick,
      seed: this.seed,
      sector: this.state.sector,
      chunkDiffs,
      entities: this.entitySnapshots(),
      projectiles: this.projectileSnapshots(),
      you: slot ? this.viewerState(slot.slot) : null,
      world,
      authHash: hashAuthoritativeState(this.state),
    };
  }
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

