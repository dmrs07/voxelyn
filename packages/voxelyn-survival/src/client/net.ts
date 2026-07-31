import {
  ARCHETYPES,
  TICK_MS,
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

export type NetStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline';

type FrameEntities = {
  tick: number;
  recvMs: number;
  entities: Map<number, EntitySnapshot>;
  projectiles: ProjectileSnapshot[];
};

/**
 * Quantos ticks de servidor o render fica ATRAS do ultimo quadro recebido.
 *
 * Este e o colchao que absorve o jitter da rede. Sem ele — interpolando entre os
 * dois ultimos quadros pelo INTERVALO DE CHEGADA deles, como era antes — o
 * desenho ficava refem do relogio errado: dois snapshots que chegam colados (o
 * caso normal em TCP, que entrega em rajada depois de qualquer atraso) davam um
 * intervalo de poucos milissegundos, a interpolacao terminava no primeiro quadro
 * de render e o personagem SALTAVA um tick inteiro de uma vez; o intervalo
 * seguinte, longo, deixava ele parado. Medido com 10-90 ms de jitter: 367 de 379
 * quadros com deslocamento ZERO e o resto em saltos de 0,23 tile.
 *
 * O tamanho e MEDIDO, nao fixo, porque ele se paga em pontaria. Todo tick de
 * colchao e um tick a mais de defasagem entre onde o inimigo esta desenhado e
 * onde o servidor vai resolver o tiro — quem mira no que ve, mira atras. Uma
 * conexao boa nao deve pagar o preco de uma ruim: o colchao acompanha o pico de
 * atraso observado, com folga, e desce sozinho quando a rede acalma.
 */
const MIN_INTERP_DELAY_TICKS = 1;
const MAX_INTERP_DELAY_TICKS = 3;
/**
 * Folga sobre o pior INTERVALO entre chegadas ja observado.
 *
 * O que o colchao precisa cobrir e o INTERVALO, nao o "atraso" de cada quadro.
 * No instante em que um quadro chega, a linha de render esta `delay` ticks atras
 * dele e vai andar sozinha ate o proximo chegar; se o proximo demora G ticks de
 * tempo, ela so nao alcanca o fim do buffer se `delay >= G`.
 *
 * Medir a lateness de cada quadro subdimensionava o colchao justamente no padrao
 * que mais aparece em TCP: dois snapshots colados a cada 100 ms. Ali cada quadro
 * chega "um tick depois" do anterior — lateness baixa —, mas o intervalo entre
 * PARES e de quase dois ticks, e era nele que a linha de render encostava.
 *
 * A folga cobre o proximo intervalo sair um pouco pior que o pior ja visto.
 */
const INTERP_HEADROOM_TICKS = 0.35;
/** Quao rapido o pior intervalo medido e esquecido quando a rede melhora. */
const GAP_DECAY = 0.02;

/** Quadros guardados (0,6 s a 20 Hz): cobre a rajada mais longa que vale seguir. */
const MAX_BUFFERED_FRAMES = 12;

/**
 * Quanto a linha de render acelera ou freia por tick de atraso fora do alvo.
 *
 * A linha de render nao pode ser `tick * TICK_MS` somado a um deslocamento fixo:
 * isso assume que o relogio do servidor e o do navegador andam na MESMA
 * velocidade, e eles nao andam. O laco do servidor e um `setInterval` que
 * escorrega sob carga — um tick de 20 Hz que na pratica leva 55 ms faz a linha de
 * render fugir para a frente e esvaziar o buffer em segundos, devolvendo
 * exatamente o congela-e-salta que este arquivo veio consertar.
 *
 * Entao a linha anda no ritmo MEDIDO das chegadas e usa este ganho so para
 * corrigir a FASE — a distancia ate o alvo de `INTERP_DELAY_TICKS`. Com o ritmo
 * certo, a correcao tende a zero e o atraso assenta no alvo.
 */
const PLAYOUT_GAIN = 0.08;

/** Teto da correcao de fase. 15% de diferenca de ritmo nao se ve; 50% se ve. */
const PLAYOUT_RATE_LIMIT = 0.15;

/** Erro grande demais para corrigir andando: reengata de uma vez (aba que voltou do fundo). */
const PLAYOUT_RESYNC_TICKS = 8;

/** Teto do passo de um quadro. Aba em segundo plano nao acumula meia hora de mundo. */
const MAX_FRAME_MS = 250;

/** Quanto peso cada medida tem na estimativa de ritmo do servidor. */
const RATE_SMOOTHING = 0.05;

/**
 * Janela minima para medir o ritmo do servidor.
 *
 * A medida NAO pode ser feita entre dois quadros vizinhos. Em TCP e comum a rede
 * soltar dois snapshots de 20 Hz colados a cada 100 ms; entre os dois membros do
 * par o tempo decorrido e zero — amostra imprestavel, descartada — e entre um par
 * e o proximo passa 100 ms com apenas UM tick de diferenca para o quadro que
 * ficou de baseline. Toda amostra aceita dizia entao 0,01 tick/ms, metade do
 * ritmo real, e a media convergia para a metade errada: a linha de render andava
 * a meia velocidade, o buffer a alcancava e o movimento voltava a congelar. Foi
 * medido: `tickRate` estacionava em 0,01000 e 62% dos quadros ficavam parados.
 *
 * Medir entre o quadro mais VELHO e o mais NOVO do buffer resolve na raiz: a
 * janela contem rajadas inteiras, entao os ticks que chegaram juntos contam
 * junto com o tempo que eles levaram para chegar.
 */
const RATE_WINDOW_MS = 250;

/**
 * Teto de grupos de eventos esperando a linha de render alcanca-los.
 *
 * Tres segundos a 20 Hz. So enche se ninguem estiver desenhando (aba em segundo
 * plano para o rAF); passando disso os mais velhos sao despachados na hora, para
 * a fila nao crescer sem limite nem engolir evento nenhum.
 */
const MAX_PENDING_EVENT_FRAMES = 60;

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

  /** Quadros recebidos, em ordem crescente de tick de servidor. */
  private frames: FrameEntities[] = [];
  /** Instante a desenhar, em ticks de servidor (fracionario). Null antes do 1o quadro. */
  private renderTick: number | null = null;
  /** Ritmo MEDIDO do servidor, em ticks por milissegundo local. */
  private tickRate = 1 / TICK_MS;
  /**
   * Pior intervalo recente entre chegadas, em ticks. Comeca no intervalo de uma
   * rede perfeita (um tick) e sobe com a primeira irregularidade.
   */
  private gapTicks = 1;
  private lastSampleMs: number | null = null;
  /** Eventos por tick, esperando a linha de render alcanca-los. Ver `queueEvents`. */
  private pendingEvents: Array<{ tick: number; events: SemanticEvent[] }> = [];
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
    this.frames = [];
    this.renderTick = null;
    this.lastSampleMs = null;
    this.pendingEvents = [];
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
    const newest = this.frames[this.frames.length - 1];
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
        if (msg.events.length > 0) this.queueEvents(msg.serverTick, msg.events);
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
    state.guardianAwake = world.guardianAwake;
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
  }

  private ingestFrame(entities: EntitySnapshot[], projectiles: ProjectileSnapshot[], tick: number, nowMs: number): void {
    const map = new Map<number, EntitySnapshot>();
    for (const e of entities) map.set(e.id, e);
    const newest = this.frames[this.frames.length - 1];
    if (newest) {
      if (tick < newest.tick) {
        // O tick e o relogio da SALA. Ele so anda para tras quando a sala e
        // outra (restart, matchmaking novo): o buffer inteiro pertence a um
        // mundo que nao existe mais, e interpolar entre os dois costuraria dois
        // jogos diferentes num mesmo quadro.
        this.resetPlayout();
      } else if (tick === newest.tick) {
        // Mesmo tick reenviado (full_resync coalescido com o snapshot): o mais
        // recente e o autoritativo.
        this.frames.pop();
      } else {
        this.trackArrival(tick - newest.tick, nowMs - newest.recvMs);
      }
    }
    this.frames.push({ tick, recvMs: nowMs, entities: map, projectiles });
    if (this.frames.length > MAX_BUFFERED_FRAMES) this.frames.shift();
    this.trackTickRate();
  }

  /**
   * Aprende com a chegada de um quadro: o RITMO do servidor e o ATRASO da rede.
   *
   * Ritmo: uma unica chegada nao diz nada — o jitter esta todo dentro dela —,
   * mas a media longa converge para a razao real entre os dois relogios, que e o
   * que a linha de render precisa para nao fugir nem ficar para tras.
   *
   * Atraso: o quanto este quadro chegou depois do que a cadencia media previa. E
   * o pico dele, e nao a media, que dimensiona o colchao — o colchao existe
   * exatamente para o pior caso recente. Sobe na hora, desce devagar.
   */
  private trackArrival(tickDelta: number, elapsedMs: number): void {
    if (elapsedMs <= 0 || tickDelta <= 0) return;
    // Intervalo desta chegada, em ticks de tempo. Quadros que vieram colados no
    // anterior dao intervalo ~0 e nao levantam o pico — corretamente: quem chega
    // junto nao deixou a linha de render sem dado nenhum.
    const gap = elapsedMs * this.tickRate;
    this.gapTicks = gap > this.gapTicks
      ? gap
      : this.gapTicks + (gap - this.gapTicks) * GAP_DECAY;
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
    this.frames.length = 0;
    this.renderTick = null;
    this.pendingEvents.length = 0;
  }

  /**
   * Reestima o ritmo do servidor sobre a JANELA INTEIRA do buffer.
   *
   * Ver RATE_WINDOW_MS: medir entre quadros vizinhos e o que a rajada de TCP
   * envenena. Aqui os extremos da janela e que mandam, e uma rajada dentro dela
   * contribui com os ticks dela e com o tempo dela, nas duas pontas da divisao.
   */
  private trackTickRate(): void {
    const oldest = this.frames[0];
    const newest = this.frames[this.frames.length - 1];
    if (!oldest || !newest) return;
    const spanMs = newest.recvMs - oldest.recvMs;
    const spanTicks = newest.tick - oldest.tick;
    if (spanMs < RATE_WINDOW_MS || spanTicks <= 0) return;
    const observed = spanTicks / spanMs;
    // Amostra absurda (aba suspensa, relogio corrigido) nao entra na media.
    if (observed < 0.25 / TICK_MS || observed > 4 / TICK_MS) return;
    this.tickRate += (observed - this.tickRate) * RATE_SMOOTHING;
  }

  /**
   * Guarda os eventos de um tick ate a linha de render chegar nele.
   *
   * Eventos sao a NARRACAO do que aconteceu num tick: telegraph de ataque, morte,
   * explosao, som, vibracao. Dispara-los na chegada, como era antes, os punha a
   * frente do mundo que os produziu — o corpo e desenhado com o atraso do colchao
   * de interpolacao, entao a explosao acendia antes de a criatura chegar onde ela
   * explodiu, e o relogio visual da acao ja nascia adiantado. Enfileirar aqui e
   * despachar em `sampleRenderState` poe as duas coisas na MESMA linha do tempo.
   */
  private queueEvents(tick: number, events: SemanticEvent[]): void {
    this.pendingEvents.push({ tick, events });
    // Ninguem desenhando (aba em segundo plano): despacha os mais velhos em vez
    // de guardar sem limite. Nada e descartado — so deixa de esperar.
    while (this.pendingEvents.length > MAX_PENDING_EVENT_FRAMES) {
      this.dispatchEvents(this.pendingEvents.shift()!.events);
    }
  }

  private dispatchEvents(events: SemanticEvent[]): void {
    this.events.push(...events);
    this.onEvents?.(events);
  }

  /** Solta tudo que a linha de render ja alcancou, em ordem de tick. */
  private flushEvents(renderedTick: number): void {
    while (this.pendingEvents.length > 0 && this.pendingEvents[0].tick <= renderedTick) {
      this.dispatchEvents(this.pendingEvents.shift()!.events);
    }
  }

  /** Colchao de interpolacao deste instante, em ticks. Ver MIN/MAX_INTERP_DELAY_TICKS. */
  private get interpDelayTicks(): number {
    return Math.max(
      MIN_INTERP_DELAY_TICKS,
      Math.min(MAX_INTERP_DELAY_TICKS, INTERP_HEADROOM_TICKS + this.gapTicks)
    );
  }

  /**
   * Os dois quadros que cercam o instante a desenhar, e onde entre eles cair.
   *
   * O instante alvo vem do RELOGIO, nao da chegada dos pacotes: `nowMs` traduzido
   * para a linha do tempo do servidor e recuado `INTERP_DELAY_TICKS`. E isso que
   * faz o movimento avancar a mesma fracao de tick a cada quadro de render,
   * independentemente de os snapshots chegarem colados ou espacados.
   *
   * Fora do intervalo coberto pelo buffer nao ha o que interpolar: adiante dele o
   * mundo simplesmente ainda nao chegou (segura o ultimo quadro em vez de
   * extrapolar para uma posicao que o servidor nunca confirmou), atras dele o
   * cliente ficou dormente e o certo e reengatar no quadro mais velho que tem.
   */
  private sampleFrames(nowMs: number): { from: FrameEntities; to: FrameEntities; alpha: number } | null {
    const frames = this.frames;
    if (frames.length === 0) return null;
    const newest = frames[frames.length - 1];
    const oldest = frames[0];
    const targetTick = this.advancePlayout(nowMs, oldest.tick, newest.tick);

    if (frames.length === 1 || targetTick >= newest.tick) return { from: newest, to: newest, alpha: 1 };
    if (targetTick <= oldest.tick) return { from: oldest, to: oldest, alpha: 1 };

    for (let i = frames.length - 1; i > 0; i--) {
      const from = frames[i - 1];
      if (targetTick < from.tick) continue;
      const to = frames[i];
      const span = to.tick - from.tick;
      const alpha = span <= 0 ? 1 : (targetTick - from.tick) / span;
      return { from, to, alpha: Math.max(0, Math.min(1, alpha)) };
    }
    return { from: oldest, to: frames[1], alpha: 1 };
  }

  /**
   * Avanca a linha de render deste quadro e devolve o instante a desenhar.
   *
   * O alvo e ficar `INTERP_DELAY_TICKS` atras do ultimo quadro recebido. Perto
   * demais, o proximo atraso de rede deixa o mundo sem para onde interpolar e
   * ele congela; longe demais, o jogo inteiro responde tarde sem ganhar nada. A
   * correcao e sempre um ajuste de RITMO, nunca um salto — um salto e o defeito,
   * nao o conserto.
   */
  private advancePlayout(nowMs: number, oldestTick: number, newestTick: number): number {
    const elapsedMs = this.lastSampleMs === null
      ? 0
      : Math.min(MAX_FRAME_MS, Math.max(0, nowMs - this.lastSampleMs));
    this.lastSampleMs = nowMs;

    const delay = this.interpDelayTicks;
    const error = newestTick - (this.renderTick ?? newestTick) - delay;
    if (this.renderTick === null || Math.abs(error) > PLAYOUT_RESYNC_TICKS) {
      // Primeiro quadro, ou distancia grande demais para fechar andando: a aba
      // ficou em segundo plano, a run trocou de sala, a conexao voltou.
      this.renderTick = newestTick - delay;
    } else {
      const correction = Math.max(-PLAYOUT_RATE_LIMIT, Math.min(PLAYOUT_RATE_LIMIT, error * PLAYOUT_GAIN));
      this.renderTick += elapsedMs * this.tickRate * (1 + correction);
    }

    // Nunca adiante do que chegou (extrapolar e inventar posicao que o servidor
    // nao confirmou), nunca atras do que o buffer ainda guarda.
    this.renderTick = Math.max(oldestTick, Math.min(newestTick, this.renderTick));
    return this.renderTick;
  }

  /** Reconstroi o SurvivalState renderavel com posicoes interpoladas em nowMs. */
  sampleRenderState(nowMs: number): SurvivalState | null {
    const state = this.state;
    const sample = this.sampleFrames(nowMs);
    if (!state || !sample) return null;
    const { from, to, alpha } = sample;

    // O quadro JA ALCANCADO manda em tudo que nao e posicao — vida, acao, quem
    // existe. A posicao desenhada esta entre `from` e `to`, entao ler o resto de
    // `to` mostraria o mundo ate um tick inteiro adiantado: uma criatura sumiria
    // antes de o corpo dela chegar ao ponto onde morreu, e um telegraph de ataque
    // acenderia antes do tick que o disparou. O que ja aconteceu na linha de
    // render e o que `from` conta; o resto ainda nao aconteceu.
    state.tick = from.tick;
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
          modules: p.armed ? { explosive: { armAfterDistance: 0 } } : undefined,
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
    }

    // o renderer segue state.player/playerExtra (camera, HUD, mira): aponta-os
    // para o slot LOCAL, nao o slot 0 (senao o cliente do slot 1 renderiza o outro)
    state.player = state.players[this.slot] ?? state.players[0];
    state.playerExtra = state.playerExtras[this.slot] ?? state.playerExtras[0];
    // Por ultimo, com o mundo deste quadro ja montado: quem ouve os eventos
    // desenha FX e toca som em cima do estado que acabou de ser preparado.
    this.flushEvents(from.tick);
    return state;
  }

  get localSlot(): number {
    return this.slot;
  }
}
