import {
  ARCHETYPES,
  createRun,
  hashStaticWorld,
  type Entity,
  type EnemyArchetype,
  type ModifierId,
  type PlayerCommand,
  type Projectile,
  type SemanticEvent,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import {
  ClientWorldMirror,
  CURRENT_VERSIONS,
  decodeMessage,
  encodeMessage,
  type EntitySnapshot,
  type ProjectileSnapshot,
  type ServerMessage,
  type WorldFlags,
} from '@voxelyn/survival-protocol';

export type NetStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline';

type FrameEntities = {
  tick: number;
  recvMs: number;
  entities: Map<number, EntitySnapshot>;
  projectiles: ProjectileSnapshot[];
};

/**
 * Cliente de rede sem DOM: transporta intencoes e reconstroi um SurvivalState
 * renderavel a partir da geracao local (mesma seed) + diffs de chunk + snapshots,
 * com interpolacao de entidades. Testavel em Node contra o SurvivalServer.
 */
export class NetClient {
  status: NetStatus = 'idle';
  resumeToken: string | null = null;
  slot = 0;
  readonly events: SemanticEvent[] = [];
  onEvents: ((events: SemanticEvent[]) => void) | null = null;
  onReject: ((reason: string, field?: string) => void) | null = null;
  /** Disparado quando o cliente detecta divergencia e pede um full_resync. */
  onDiverged: ((reason: string) => void) | null = null;

  private state: SurvivalState | null = null;
  private mirror: ClientWorldMirror | null = null;
  private seq = 0;
  private divergedAt = 0; // tick do ultimo pedido por divergencia (throttle)
  private pending = false;
  private lastSendMs = 0;
  private command: PlayerCommand | null = null;

  private prev: FrameEntities | null = null;
  private curr: FrameEntities | null = null;
  private viewer: { heat: number; consumables: number; modifiers: string[]; hasCore: boolean; downed: boolean; aimX: number; aimY: number; overheated: boolean } | null = null;

  constructor(private readonly send: (raw: string) => void) {}

  /** Inicia (ou reinicia) o handshake. Passe o resumeToken para reconectar. */
  connect(resumeToken?: string): void {
    this.status = resumeToken ? 'reconnecting' : 'connecting';
    this.send(encodeMessage({ t: 'hello', versions: CURRENT_VERSIONS, resumeToken }));
  }

  markOffline(): void {
    this.status = this.resumeToken ? 'reconnecting' : 'offline';
  }

  /**
   * Abandona a sessao atual para comecar uma run nova. Descarta o resume token
   * (senao o proximo hello reentraria na MESMA sala, ja terminada) e todo o
   * estado espelhado, para que nenhum frame da run antiga vaze na proxima.
   */
  resetSession(): void {
    this.resumeToken = null;
    this.state = null;
    this.mirror = null;
    this.prev = null;
    this.curr = null;
    this.viewer = null;
    this.command = null;
    this.events.length = 0;
    this.status = 'offline';
  }

  /**
   * Acumula a intencao do frame. Eixos continuos (move/aim/fire) usam o valor
   * mais recente; campos de BORDA acumulam ate pump() realmente transmitir.
   * O throttle de ~25 Hz descarta frames inteiros — sem acumular, uma esquiva
   * ou um uso que caia numa janela nao enviada desaparece, porque o frame
   * seguinte traz esses campos em false.
   */
  setCommand(cmd: PlayerCommand): void {
    if (!this.command) {
      this.command = { ...cmd, move: { ...cmd.move }, aim: { ...cmd.aim } };
      return;
    }
    const acc = this.command;
    acc.move = { ...cmd.move };
    acc.aim = { ...cmd.aim };
    acc.fire = cmd.fire;
    acc.dodge = acc.dodge || cmd.dodge;
    acc.ability = acc.ability || cmd.ability;
    acc.interact = acc.interact || cmd.interact;
    acc.consume = acc.consume || cmd.consume;
    if (cmd.choose !== null) acc.choose = cmd.choose;
  }

  /** Envia a intencao corrente (com throttle ~25 Hz para respeitar o rate limit). */
  pump(nowMs: number): void {
    if (this.status !== 'online' || !this.command) return;
    if (nowMs - this.lastSendMs < 40) return;
    this.lastSendMs = nowMs;
    this.seq += 1;
    this.send(encodeMessage({ t: 'cmd', seq: this.seq, clientTick: this.state?.tick ?? 0, commands: [this.command] }));
    // bordas transmitidas: zera o acumulador (a mensagem ja foi serializada)
    this.command.dodge = false;
    this.command.ability = false;
    this.command.interact = false;
    this.command.consume = false;
    this.command.choose = null;
  }

  requestResync(reason = 'client'): void {
    this.send(encodeMessage({ t: 'resync', reason }));
  }

  /**
   * Divergencia detectada: pede o mundo autoritativo. Estrangulado porque o
   * servidor coalesce resyncs num cooldown — insistir a cada snapshot so
   * geraria trafego sem acelerar a recuperacao.
   */
  private diverge(reason: string): void {
    const now = this.state?.tick ?? 0;
    if (this.divergedAt !== 0 && now - this.divergedAt < 40) return;
    this.divergedAt = now || 1;
    this.onDiverged?.(reason);
    this.requestResync(reason);
  }

  ping(nowMs: number): void {
    this.send(encodeMessage({ t: 'ping', seq: this.seq, clientTimeMs: nowMs }));
  }

  /** Processa uma mensagem crua do servidor. */
  receive(raw: string, nowMs = 0): void {
    const msg = decodeMessage(raw) as ServerMessage | null;
    if (!msg) return;
    switch (msg.t) {
      case 'welcome': {
        this.resumeToken = msg.resumeToken;
        this.slot = msg.playerId - 1;
        this.state = createRun({ seed: msg.seed, playerCount: 2, width: msg.worldWidth, height: msg.worldHeight });
        this.mirror = new ClientWorldMirror(msg.worldWidth, msg.worldHeight, this.state.solid, this.state.surface);
        // o renderer le as arrays do state; aponta-as para o espelho
        this.state.solid = this.mirror.solid;
        this.state.surface = this.mirror.surface;
        this.status = 'online';
        // O mundo estatico e gerado LOCALMENTE pela seed; se o hash nao bate
        // com o do servidor (versao de geracao diferente, por exemplo), todo o
        // terreno esta errado. Pede o mundo autoritativo em vez de renderizar
        // uma caverna que nao existe.
        if (msg.mapHash && hashStaticWorld(this.state) !== msg.mapHash) {
          this.diverge('mapHash divergente na geracao local');
        }
        break;
      }
      case 'full_resync': {
        if (this.mirror) this.mirror.apply(msg.chunkDiffs);
        this.divergedAt = 0; // mundo reconstruido: zera o anti-repeticao
        this.applyWorld(msg.world);
        this.ingestFrame(msg.entities, [], msg.serverTick, nowMs);
        break;
      }
      case 'snapshot': {
        if (this.mirror && this.mirror.apply(msg.chunkDiffs)) {
          this.diverge('diff de chunk incoerente com o mundo local');
        }
        if (msg.world) this.applyWorld(msg.world);
        this.ingestFrame(msg.entities, msg.projectiles, msg.serverTick, nowMs);
        if (this.state) {
          this.state.phase = msg.phase;
          this.state.contamination = msg.contamination;
          this.state.tick = msg.serverTick;
        }
        if (msg.you) {
          this.viewer = {
            heat: msg.you.heat,
            consumables: msg.you.consumables,
            modifiers: msg.you.modifiers,
            hasCore: msg.you.hasCore,
            downed: msg.you.downed,
            aimX: msg.you.aimX,
            aimY: msg.you.aimY,
            overheated: msg.you.overheated,
          };
        }
        if (msg.events.length > 0) {
          this.events.push(...msg.events);
          this.onEvents?.(msg.events);
        }
        break;
      }
      case 'reject':
        // resume token invalido (ex.: servidor reiniciou e perdeu as salas):
        // limpa o token para que o proximo handshake seja uma sessao NOVA,
        // e sinaliza o chamador para fechar/reabrir o socket (o servidor mantem
        // o socket aberto no reject, entao sem isso o cliente fica travado).
        this.resumeToken = null;
        this.status = 'offline';
        this.onReject?.(msg.reason, msg.field);
        break;
      default:
        break;
    }
  }

  /**
   * Aplica o estado autoritativo de mundo consumivel ao espelho local. O cliente
   * gera baus/nucleo pela seed, mas nao simula quem os consumiu: sem isto um bau
   * ja aberto (ou o nucleo ja retirado) continuaria desenhado para sempre.
   * Idempotente por design — reaplicar o mesmo frame nao muda nada.
   */
  private applyWorld(world: WorldFlags): void {
    const state = this.state;
    if (!state) return;
    const opened = new Set(world.openedCaches);
    for (let i = 0; i < state.caches.length; i++) state.caches[i].opened = opened.has(i);
    state.coreTaken = world.coreTaken;
    state.guardianAwake = world.guardianAwake;
  }

  private ingestFrame(entities: EntitySnapshot[], projectiles: ProjectileSnapshot[], tick: number, nowMs: number): void {
    const map = new Map<number, EntitySnapshot>();
    for (const e of entities) map.set(e.id, e);
    this.prev = this.curr;
    this.curr = { tick, recvMs: nowMs, entities: map, projectiles };
  }

  /** Reconstroi o SurvivalState renderavel com posicoes interpoladas em nowMs. */
  sampleRenderState(nowMs: number): SurvivalState | null {
    const state = this.state;
    if (!state || !this.curr) return null;

    // alpha de interpolacao entre prev e curr (janela de ~50ms por snapshot)
    let alpha = 1;
    if (this.prev) {
      const span = Math.max(1, this.curr.recvMs - this.prev.recvMs);
      alpha = Math.min(1, (nowMs - this.curr.recvMs) / span);
    }
    const lerpPos = (id: number, cx: number, cy: number): { x: number; y: number } => {
      const p = this.prev?.entities.get(id);
      if (!p) return { x: cx, y: cy };
      return { x: p.x + (cx - p.x) * alpha, y: p.y + (cy - p.y) * alpha };
    };

    // slots ausentes do frame nao existem no servidor (ex.: parceiro que ainda
    // nao entrou): marca como nao-joined para o renderer nao desenhar fantasma.
    const presentSlots = new Set<number>();
    for (const snap of this.curr.entities.values()) {
      if (snap.kind === 'player') presentSlots.add(snap.id - 1);
    }
    for (let s = 0; s < state.players.length; s++) {
      state.playerExtras[s].joined = presentSlots.has(s);
    }

    const enemies: Entity[] = [];
    for (const snap of this.curr.entities.values()) {
      const pos = lerpPos(snap.id, snap.x, snap.y);
      if (snap.kind === 'player') {
        const slot = snap.id - 1;
        const pl = state.players[slot];
        if (pl) {
          pl.x = pos.x;
          pl.y = pos.y;
          pl.hp = snap.hp;
          pl.alive = snap.alive;
          pl.facing.x = snap.facingX ?? pl.facing.x;
          pl.facing.y = snap.facingY ?? pl.facing.y;
          state.playerExtras[slot].downed = snap.downed ?? false;
          pl.action = snap.action ? {
            kind: snap.action.kind,
            phase: snap.action.phase,
            startedAt: snap.action.startedAt,
            releaseAt: snap.action.releaseAt,
            endsAt: snap.action.endsAt,
            direction: { x: snap.action.dx, y: snap.action.dy },
            target: snap.action.target,
          } : undefined;
        }
      } else {
        const def = ARCHETYPES[snap.archetype as EnemyArchetype] ?? ARCHETYPES.stalker;
        enemies.push({
          id: snap.id,
          kind: 'enemy',
          archetype: snap.archetype as EnemyArchetype,
          x: pos.x,
          y: pos.y,
          vx: 0,
          vy: 0,
          hp: snap.hp,
          maxHp: snap.maxHp,
          radius: def.radius,
          alive: true,
          elite: snap.elite,
          nextActionAt: 0,
          contactReadyAt: 0,
          rangedReadyAt: 0,
          stunnedUntil: 0,
          facing: { x: snap.facingX ?? 1, y: snap.facingY ?? 0 },
          action: snap.action ? {
            kind: snap.action.kind,
            phase: snap.action.phase,
            startedAt: snap.action.startedAt,
            releaseAt: snap.action.releaseAt,
            endsAt: snap.action.endsAt,
            direction: { x: snap.action.dx, y: snap.action.dy },
            target: snap.action.target,
          } : undefined,
        });
      }
    }
    state.enemies = enemies;

    // projeteis (posicoes autoritativas do frame corrente)
    state.projectiles = this.curr.projectiles.map(
      (p): Projectile => ({
        id: p.id,
        owner: 0,
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        damage: 0,
        piercing: false,
        conductive: false,
        explosive: false,
        hostile: p.hostile,
        leavesBiofluid: false,
        ttl: 1,
      })
    );

    // HUD do jogador local
    if (this.viewer) {
      const ex = state.playerExtras[this.slot];
      ex.heat = this.viewer.heat;
      ex.consumables = this.viewer.consumables;
      ex.modifiers = this.viewer.modifiers as ModifierId[];
      ex.hasCore = this.viewer.hasCore;
      ex.downed = this.viewer.downed;
      ex.aim.x = this.viewer.aimX;
      ex.aim.y = this.viewer.aimY;
      ex.overheatedUntil = this.viewer.overheated ? state.tick + 1 : 0;
    }

    // o renderer segue state.player/playerExtra (camera, HUD, mira): aponta-os
    // para o slot LOCAL, nao o slot 0 (senao o cliente do slot 1 renderiza o outro)
    state.player = state.players[this.slot] ?? state.players[0];
    state.playerExtra = state.playerExtras[this.slot] ?? state.playerExtras[0];
    return state;
  }

  get localSlot(): number {
    return this.slot;
  }
}
