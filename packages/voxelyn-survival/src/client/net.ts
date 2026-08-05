import {
  ARCHETYPES,
  createRun,
  hashStaticWorld,
  type Entity,
  type EnemyArchetype,
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
  type ViewerState,
  type WorldFlags,
} from '@voxelyn/survival-protocol';
import { PlayoutClock, TickEventQueue } from './playout';

export type NetStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline';

/** A carga util de um quadro. O tick e o instante de chegada pertencem ao relogio. */
type FrameEntities = {
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

  /**
   * QUANDO desenhar cada quadro. Ver `playout.ts`: este cliente cuida do
   * protocolo e da montagem do mundo, o relogio cuida do tempo.
   */
  private readonly playout = new PlayoutClock<FrameEntities>();
  /** A narracao de cada tick, segurada ate a linha de render alcanca-la. */
  private readonly eventQueue = new TickEventQueue<SemanticEvent>((events) => {
    this.events.push(...events);
    this.onEvents?.(events);
  });
  private viewer: ViewerState | null = null;

  constructor(private readonly send: (raw: string) => void) {}

  /**
   * Regera o mundo estatico local para outro setor, preservando a conexao.
   *
   * O `SurvivalState` do cliente e so um espelho renderavel: recria-lo aqui e
   * seguro porque nada de autoritativo vive nele — posicoes, vida e flags
   * chegam do servidor no mesmo resync que disparou esta chamada.
   */
  private rebuildWorld(sector: number): void {
    const current = this.state;
    if (!current) return;
    const next = createRun({
      seed: current.config.seed,
      sector,
      playerCount: current.config.playerCount,
      width: current.config.width,
      height: current.config.height,
    });
    this.mirror = new ClientWorldMirror(
      current.config.width,
      current.config.height,
      next.solid,
      next.surface
    );
    next.solid = this.mirror.solid;
    next.surface = this.mirror.surface;
    // O resultado da run e da RUN, nao do setor: preserva-lo evita que a tela
    // de resultado pisque em branco se um resync chegar depois do fim.
    next.summary = current.summary;
    this.state = next;
  }

  /**
   * Codigo da sala a que este cliente quer se juntar. Null = matchmaking aberto.
   *
   * Campo e nao parametro de `connect` porque a reconexao automatica chama
   * `connect` sozinha, de dentro do `onclose` do socket, sem acesso ao que o
   * jogador digitou no menu. Se o codigo nao sobrevivesse aqui, a primeira
   * queda de rede jogaria o jogador numa sala qualquer, longe do parceiro.
   */
  roomCode: string | null = null;

  /** Codigo da sala em que este cliente ESTA, informado pelo servidor. */
  activeRoomCode: string | null = null;

  /** Inicia (ou reinicia) o handshake. Passe o resumeToken para reconectar. */
  connect(resumeToken?: string): void {
    this.status = resumeToken ? 'reconnecting' : 'connecting';
    this.send(
      encodeMessage({
        t: 'hello',
        versions: CURRENT_VERSIONS,
        resumeToken,
        ...(this.roomCode ? { roomCode: this.roomCode } : {}),
      })
    );
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
    this.resetPlayout();
    this.viewer = null;
    this.command = null;
    this.events.length = 0;
    this.activeRoomCode = null;
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
    acc.purge = acc.purge || cmd.purge;
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
    this.command.purge = false;
    this.command.choose = null;
  }

  /** Quantos jogadores o servidor esta reportando neste instante. */
  playerCount(): number {
    const newest = this.playout.newest;
    if (!newest) return 0;
    let count = 0;
    for (const snap of newest.entities.values()) if (snap.kind === 'player') count++;
    return count;
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
        this.activeRoomCode = msg.roomCode;
        // `sector` e obrigatorio na geracao local: com tres setores por run, a
        // seed sozinha deixou de identificar um mundo. Entrar numa sala ja no
        // setor 2 gerando o mapa do setor 1 produziria divergencia imediata.
        this.state = createRun({
          seed: msg.seed,
          sector: msg.sector,
          playerCount: 2,
          width: msg.worldWidth,
          height: msg.worldHeight,
        });
        this.mirror = new ClientWorldMirror(msg.worldWidth, msg.worldHeight, this.state.solid, this.state.surface);
        // o renderer le as arrays do state; aponta-as para o espelho
        this.state.solid = this.mirror.solid;
        this.state.surface = this.mirror.surface;
        // Mundo recem-criado: nada do que estava bufferizado descreve ele. Vale
        // para o primeiro handshake (onde o buffer ja esta vazio) e, sobretudo,
        // para a RECONEXAO — a sala pode ter descido enquanto o socket estava
        // caido, e ai os quadros guardados sao de outro setor.
        this.resetPlayout();
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
        // Um resync pode chegar porque a sala DESCEU: nesse caso o mundo
        // estatico local pertence ao setor anterior e precisa ser regerado.
        // Aplicar os diffs sobre o espelho velho costuraria os dois mapas.
        if (this.state && msg.sector !== this.state.sector) {
          this.rebuildWorld(msg.sector);
          // E o buffer de quadros costuraria os dois SETORES, pelo mesmo motivo.
          //
          // O relogio da sala nao reinicia na descida — `descend` incrementa o
          // setor e segue contando os ticks —, entao a guarda de tick andando
          // para tras nunca dispara aqui. O que ficava no buffer eram quadros de
          // um mundo que deixou de existir: criaturas que nao estao mais la e o
          // Prospector no poco do mapa velho. Com a linha de render um tick e
          // meio atras, ela interpolava do poco antigo ate a entrada do mapa
          // novo, e o personagem atravessava a tela deslizando por cima de um
          // mapa onde aquele caminho nao existe. Descer e um CORTE.
          this.resetPlayout();
        }
        if (this.mirror) this.mirror.apply(msg.chunkDiffs);
        this.divergedAt = 0; // mundo reconstruido: zera o anti-repeticao
        this.applyWorld(msg.world);
        // Nulo quando o servidor nao soube a quem o resync pertencia: e melhor
        // manter o ultimo ViewerState conhecido do que adotar o de outro slot.
        if (msg.you) this.viewer = msg.you;
        // Mesma razao do snapshot, e mais forte aqui: o resync E o caminho de
        // quem reconectou, e e nele que a carga zerada apareceria na tela.
        if (this.state && typeof msg.cargoOre === 'number') {
          this.state.stats.oreCollected = msg.cargoOre;
        }
        this.ingestFrame(msg.entities, msg.projectiles, msg.serverTick, nowMs);
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
          // `tick` NAO e copiado daqui: quem o define e `sampleRenderState`, com
          // o tick do quadro que esta sendo desenhado. Adiantar o relogio para o
          // ultimo snapshot recebido faria a apresentacao julgar expirada uma
          // acao que, na linha do tempo do desenho, ainda esta acontecendo.
          // O cliente online nao simula: contagem de abates, causa de morte e
          // estrelas so existem porque o servidor as manda. Nunca sobrescreve
          // com undefined — snapshots de sala em andamento omitem o campo, e
          // apaga-lo limparia o resultado logo depois de ele chegar.
          if (msg.summary) this.state.summary = msg.summary;
        }
        if (msg.you) {
          this.viewer = msg.you;
        }
        // A carga da SALA. `oreCollected` e contador de equipe: a lasca que o
        // parceiro arranca conta para os dois, e o espelho local nao simula
        // mineracao nenhuma para descobrir isso sozinho.
        if (this.state && typeof msg.cargoOre === 'number') {
          this.state.stats.oreCollected = msg.cargoOre;
        }
        // (O telegrafo do carrinho NAO precisa de tratamento aqui: os
        // relogios dos trilhos viajam nas WorldFlags — `railTimers` — que o
        // applyWorld acima ja aplicou. Pisar num gatilho muda o worldSig e
        // dispara o envio no proprio tick do aviso; e o full_resync sempre
        // as carrega, entao quem entra NO MEIO do aviso tambem o ve.)
        this.eventQueue.push(msg.serverTick, msg.events);
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
    for (let i = 0; i < state.salvageSites.length; i++) {
      const flags = world.salvageSites[i];
      if (!flags) continue;
      const site = state.salvageSites[i];
      site.terminalState = flags.terminalState;
      site.scanEndsAt = flags.scanEndsAt;
      site.cacheRevealed = flags.cacheRevealed;
      site.cacheOpened = flags.cacheOpened;
    }
    state.coreTaken = world.coreTaken;
    state.bossRuntime.awake = world.bossAwake;
    // Substitui a lista inteira em vez de casar por indice: as ofertas nao tem
    // identidade estavel entre setores — elas nascem no poco e somem na descida —,
    // e um merge posicional deixaria um Eco do setor anterior no mapa novo.
    //
    // Servidor antigo nao manda o campo: lista vazia mantem o resto do mundo
    // funcionando, e o pior que acontece e o co-op nao mostrar Eco nenhum.
    state.wellOffers = (world.wellOffers ?? []).map((offer) => ({
      ability: offer.ability,
      x: offer.x,
      y: offer.y,
      takenBy: offer.takenBy,
    }));
    // Relogios dos trilhos, por indice: a geometria dos tramos vem da seed
    // (mesma ordem deterministica do worldgen), so o TEMPO e autoritativo.
    // E o que faz o telegrafo do carrinho existir online — inclusive para
    // quem entra ou reconecta NO MEIO do aviso, porque o full_resync sempre
    // carrega as WorldFlags. Servidor antigo nao manda o campo: fica tudo
    // em zero, como antes.
    const timers = world.railTimers;
    if (timers) {
      for (let i = 0; i < state.railTracks.length && i < timers.length; i++) {
        state.railTracks[i].readyAt = timers[i].readyAt;
        // O firingAt so ANDA PARA FRENTE. A linha de render corre atras do
        // servidor de proposito (quadro bufferizado), e o snapshot do
        // DISPARO — que zera o relogio — chega um a tres ticks antes de o
        // proprio carrinho alcancar o tick desenhado: zerar aqui apagaria o
        // aviso ~100ms antes de o perigo aparecer. Deixado quieto, o aviso
        // expira sozinho no instante exato em que a linha de render cruza o
        // firingAt antigo (`firingAt > tick` vira falso) — e um valor no
        // passado nao desenha nada, entao nao ha o que limpar.
        if (timers[i].firingAt > state.railTracks[i].firingAt) {
          state.railTracks[i].firingAt = timers[i].firingAt;
        }
      }
    }
  }

  /**
   * Entrega um quadro autoritativo ao relogio de exibicao.
   *
   * O mapa por id nasce aqui porque e forma de LEITURA do mundo — o resto do
   * cliente procura entidade por id —, nao decisao de tempo.
   */
  private ingestFrame(entities: EntitySnapshot[], projectiles: ProjectileSnapshot[], tick: number, nowMs: number): void {
    const map = new Map<number, EntitySnapshot>();
    for (const e of entities) map.set(e.id, e);
    // Linha do tempo reiniciada (sala nova): a narracao guardada e daquele mundo.
    if (this.playout.ingest(tick, nowMs, { entities: map, projectiles })) this.eventQueue.clear();
  }

  /**
   * Esquece o mundo bufferizado: quadros, linha de render e eventos na fila.
   *
   * Chamado quando o que esta guardado deixa de descrever o mundo em que o
   * jogador esta — sala nova ou setor novo. Os eventos vao junto de proposito:
   * eles narram um mapa que nao existe mais, e solta-los depois do corte poria
   * fumaca e estrondo em coordenadas que agora significam outra coisa.
   */
  private resetPlayout(): void {
    this.playout.reset();
    this.eventQueue.clear();
  }

  /** Reconstroi o SurvivalState renderavel com posicoes interpoladas em nowMs. */
  sampleRenderState(nowMs: number): SurvivalState | null {
    const state = this.state;
    const sample = this.playout.sample(nowMs);
    if (!state || !sample) return null;
    const { from, to, alpha } = sample;

    // O quadro JA ALCANCADO manda em tudo que nao e posicao — vida, acao, quem
    // existe. A posicao desenhada esta entre `from` e `to`, entao ler o resto de
    // `to` mostraria o mundo ate um tick inteiro adiantado: uma criatura sumiria
    // antes de o corpo dela chegar ao ponto onde morreu, e um telegraph de ataque
    // acenderia antes do tick que o disparou. O que ja aconteceu na linha de
    // render e o que `from` conta; o resto ainda nao aconteceu.
    state.tick = sample.tick;
    const interpolated = from !== to && alpha > 0;
    const lerpPos = (id: number, cx: number, cy: number): { x: number; y: number } => {
      const target = interpolated ? to.entities.get(id) : undefined;
      // Sem alvo no quadro seguinte a entidade morreu ali: segurar a ultima
      // posicao conhecida e mais honesto que empurra-la para lugar nenhum.
      if (!target) return { x: cx, y: cy };
      return { x: cx + (target.x - cx) * alpha, y: cy + (target.y - cy) * alpha };
    };

    // slots ausentes do frame nao existem no servidor (ex.: parceiro que ainda
    // nao entrou): marca como nao-joined para o renderer nao desenhar fantasma.
    const presentSlots = new Set<number>();
    for (const snap of from.entities.values()) {
      if (snap.kind === 'player') presentSlots.add(snap.id - 1);
    }
    for (let s = 0; s < state.players.length; s++) {
      state.playerExtras[s].joined = presentSlots.has(s);
    }

    const enemies: Entity[] = [];
    for (const snap of from.entities.values()) {
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
          pl.stunnedUntil = snap.stunnedUntil ?? 0;
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
          mood: snap.mood,
          // O espelho do cliente nao simula: `alertedUntil` so existe aqui para
          // satisfazer o tipo compartilhado com a sim. Zero e o valor honesto —
          // quem decide aggro e o servidor, e este campo nunca e lido no cliente.
          alertedUntil: 0,
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
          stunnedUntil: snap.stunnedUntil ?? 0,
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

    // Projeteis viajam a 13 tiles/s — quase dois terços de tile por tick. Sem
    // interpolar, eles saltam de snapshot em snapshot enquanto tudo em volta
    // desliza; lidos do quadro seguinte, chegam ao alvo antes das criaturas que
    // vao acertar. Mesma linha do tempo do resto, pelo mesmo motivo.
    const projectileTargets = interpolated
      ? new Map(to.projectiles.map((p) => [p.id, p]))
      : null;
    state.projectiles = from.projectiles.map(
      (p): Projectile => {
        const target = projectileTargets?.get(p.id);
        return {
          id: p.id,
          owner: 0,
          x: target ? p.x + (target.x - p.x) * alpha : p.x,
          y: target ? p.y + (target.y - p.y) * alpha : p.y,
          vx: 0,
          vy: 0,
          kind: p.kind,
          damage: 0,
          // Reconstroi so o que o DESENHO consulta. Nao e o estado do modulo: as
          // cargas, o alcance de armar e os rebotes restantes vivem no servidor,
          // e copia-los pela metade aqui criaria uma segunda fonte de verdade
          // sobre uma mecanica que o cliente nem simula.
          modules:
            p.armed || p.piercing || p.bouncy
              ? {
                  ...(p.armed ? { explosive: { armAfterDistance: 0 } } : {}),
                  ...(p.piercing ? { piercing: true as const } : {}),
                  ...(p.bouncy ? { ricochet: { remainingBounces: 1 } } : {}),
                }
              : undefined,
          distanceTravelled: p.armed ? 1 : 0,
          hostile: p.hostile,
          leavesBiofluid: false,
          ttl: 1,
        };
      }
    );

    // HUD do jogador local
    if (this.viewer) {
      const ex = state.playerExtras[this.slot];
      ex.heat = this.viewer.heat;
      ex.purgeCells = this.viewer.purgeCells;
      ex.activeModules = this.viewer.activeModules.map((module) => ({
        id: module.id,
        lifetime: { ...module.lifetime },
      }));
      ex.pendingModuleChoice = this.viewer.pendingModuleChoice ? {
        sourceSiteId: this.viewer.pendingModuleChoice.sourceSiteId,
        options: [...this.viewer.pendingModuleChoice.options] as [typeof this.viewer.pendingModuleChoice.options[0], typeof this.viewer.pendingModuleChoice.options[1]],
        createdAtTick: this.viewer.pendingModuleChoice.createdAtTick,
      } : null;
      ex.hasCore = this.viewer.hasCore;
      ex.downed = this.viewer.downed;
      // A MIRA vem do proprio aparelho, nao do eco do servidor.
      //
      // Tudo mais neste bloco e estado que so o servidor conhece — calor, cargas,
      // Nucleo. A mira nao: ela E a entrada deste jogador, e o `you` do snapshot
      // so devolve o que ele mesmo mandou, uma ida e volta atras. Desenhar o eco
      // fazia o retículo arrastar atras do cursor no co-op e responder na hora no
      // solo, com o mesmo controle — a sensacao de "a mira demora a calibrar".
      //
      // Isto NAO adianta o tiro: quem dispara continua sendo o servidor, com a
      // mira que chegou nele. O que muda e a mira desenhada parar de mentir
      // sobre para onde o jogador esta apontando AGORA.
      const localAim = this.command?.aim;
      const aiming = localAim ? Math.hypot(localAim.x, localAim.y) > 0.01 : false;
      ex.aim.x = aiming && localAim ? localAim.x : this.viewer.aimX;
      ex.aim.y = aiming && localAim ? localAim.y : this.viewer.aimY;
      ex.overheatedUntil = this.viewer.overheated ? state.tick + 1 : 0;
      // Timers privados de recarga: o radial do HUD segue o SERVIDOR. Antes o
      // online predizia a partir do toque com duracao fixa — errada para toda
      // habilidade que nao fosse o pulso, e otimista para o sopro, que so cobra
      // o cooldown no fim do canal.
      ex.dodgeCooldownUntil = this.viewer.dodgeCooldownUntil;
      ex.abilityCooldownUntil = this.viewer.abilityCooldownUntil;
      ex.channelingUntil = this.viewer.channelingUntil;
      // A habilidade equipada viaja junto: os timers sozinhos nao bastam — a
      // duracao do radial e a projecao do canal saem do cooldown DELA, e o
      // espelho local nascia com `pulse` e nunca sabia da troca no poco.
      ex.ability = this.viewer.ability;
    }

    // o renderer segue state.player/playerExtra (camera, HUD, mira): aponta-os
    // para o slot LOCAL, nao o slot 0 (senao o cliente do slot 1 renderiza o outro)
    state.player = state.players[this.slot] ?? state.players[0];
    state.playerExtra = state.playerExtras[this.slot] ?? state.playerExtras[0];
    // Por ultimo, com o mundo deste quadro ja montado: quem ouve os eventos
    // desenha FX e toca som em cima do estado que acabou de ser preparado.
    this.eventQueue.flush(sample.tick);
    return state;
  }

  get localSlot(): number {
    return this.slot;
  }
}
