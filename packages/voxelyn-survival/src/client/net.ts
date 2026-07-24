import {
  ARCHETYPES,
  createRun,
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
  onReject: ((reason: string) => void) | null = null;

  private state: SurvivalState | null = null;
  private mirror: ClientWorldMirror | null = null;
  private seq = 0;
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

  setCommand(cmd: PlayerCommand): void {
    this.command = cmd;
  }

  /** Envia a intencao corrente (com throttle ~25 Hz para respeitar o rate limit). */
  pump(nowMs: number): void {
    if (this.status !== 'online' || !this.command) return;
    if (nowMs - this.lastSendMs < 40) return;
    this.lastSendMs = nowMs;
    this.seq += 1;
    this.send(encodeMessage({ t: 'cmd', seq: this.seq, clientTick: this.state?.tick ?? 0, commands: [this.command] }));
  }

  requestResync(reason = 'client'): void {
    this.send(encodeMessage({ t: 'resync', reason }));
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
        break;
      }
      case 'full_resync': {
        if (this.mirror) this.mirror.apply(msg.chunkDiffs);
        this.ingestFrame(msg.entities, [], msg.serverTick, nowMs);
        break;
      }
      case 'snapshot': {
        if (this.mirror) this.mirror.apply(msg.chunkDiffs);
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
        this.onReject?.(msg.reason);
        break;
      default:
        break;
    }
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
