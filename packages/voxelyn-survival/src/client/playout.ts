import { TICK_MS } from '@voxelyn/survival-sim';

/**
 * O RELOGIO DE EXIBICAO do cliente online: quando mostrar o que o servidor mandou.
 *
 * Este arquivo nao sabe o que e um Prospector, um projetil ou um chunk. Ele
 * responde a uma pergunta so, e a responde para qualquer carga: dado que
 * snapshots numerados por tick chegam em instantes irregulares, QUAIS DOIS
 * desenhar agora e a que fracao entre eles.
 *
 * Ele foi extraido do `NetClient` depois de quatro defeitos seguidos morarem
 * exatamente aqui — ritmo do servidor estimado errado sob rajada de TCP, colchao
 * dimensionado pela medida errada, eventos disparados antes do mundo que os
 * produziu, estado discreto lido do quadro seguinte ao desenhado. Nenhum deles
 * tinha teste proprio, porque so era possivel alcanca-los pelo cliente inteiro:
 * abrir um socket falso, falar o protocolo, montar um `SurvivalState`. Aqui as
 * mesmas situacoes sao tres linhas de aritmetica.
 *
 * As tres pecas tem um dever cada:
 *
 * - `ArrivalStats` responde "quao rapido o servidor anda e quao irregular a rede
 *   esta", sem guardar quadro nenhum.
 * - `PlayoutClock` guarda os quadros e move o cursor, usando as respostas dela.
 * - `TickEventQueue` segura a narracao de cada tick ate o cursor chegar nele.
 */

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
 * conexao boa nao deve pagar o preco de uma ruim.
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
 * Medir sobre a janela INTEIRA do buffer resolve na raiz: ela contem rajadas
 * inteiras, entao os ticks que chegaram juntos contam junto com o tempo que eles
 * levaram para chegar.
 */
const RATE_WINDOW_MS = 250;

/** Amostra de ritmo fora desta faixa e absurda (aba suspensa, relogio corrigido). */
const MIN_PLAUSIBLE_RATE = 0.25 / TICK_MS;
const MAX_PLAUSIBLE_RATE = 4 / TICK_MS;

/**
 * O que a rede vem entregando: ritmo do servidor e irregularidade da chegada.
 *
 * Nao guarda quadros de proposito. As duas medidas que ela mantem sao aritmetica
 * pura sobre pares de numeros, e e assim que elas ficam testaveis sem servidor,
 * sem socket e sem mundo.
 */
export class ArrivalStats {
  /** Ritmo MEDIDO do servidor, em ticks por milissegundo local. */
  private rate = 1 / TICK_MS;
  /**
   * Pior intervalo recente entre chegadas, em ticks. Comeca no intervalo de uma
   * rede perfeita e sobe com a primeira irregularidade.
   */
  private worstGap = 1;

  get tickRate(): number {
    return this.rate;
  }

  /** Colchao de interpolacao deste instante, em ticks. */
  get delayTicks(): number {
    return Math.max(
      MIN_INTERP_DELAY_TICKS,
      Math.min(MAX_INTERP_DELAY_TICKS, INTERP_HEADROOM_TICKS + this.worstGap)
    );
  }

  /**
   * Uma chegada, para medir o INTERVALO.
   *
   * Quadros que vieram colados no anterior dao intervalo ~0 e nao levantam o
   * pico — corretamente: quem chega junto nao deixou a linha de render sem dado
   * nenhum. Sobe na hora, desce devagar: o colchao existe para o pior caso
   * recente, nao para o caso medio.
   */
  observeArrival(elapsedMs: number): void {
    if (elapsedMs <= 0) return;
    const gap = elapsedMs * this.rate;
    this.worstGap = gap > this.worstGap ? gap : this.worstGap + (gap - this.worstGap) * GAP_DECAY;
  }

  /**
   * A janela inteira do buffer, para medir o RITMO. Ver RATE_WINDOW_MS: e o
   * unico jeito de a rajada de TCP nao envenenar a conta.
   */
  observeSpan(spanTicks: number, spanMs: number): void {
    if (spanMs < RATE_WINDOW_MS || spanTicks <= 0) return;
    const observed = spanTicks / spanMs;
    if (observed < MIN_PLAUSIBLE_RATE || observed > MAX_PLAUSIBLE_RATE) return;
    this.rate += (observed - this.rate) * RATE_SMOOTHING;
  }
}

/** Quadros guardados (0,6 s a 20 Hz): cobre a rajada mais longa que vale seguir. */
const MAX_BUFFERED_FRAMES = 12;

/**
 * Quanto a linha de render acelera ou freia por tick de atraso fora do alvo.
 *
 * A linha de render nao pode ser `tick * TICK_MS` somado a um deslocamento fixo:
 * isso assume que o relogio do servidor e o do navegador andam na MESMA
 * velocidade, e eles nao andam. O laco do servidor e um `setInterval` que
 * escorrega sob carga — um tick de 20 Hz que na pratica leva 55 ms faz a linha de
 * render fugir para a frente e esvaziar o buffer em segundos.
 *
 * Entao a linha anda no ritmo MEDIDO das chegadas e usa este ganho so para
 * corrigir a FASE — a distancia ate o alvo. Com o ritmo certo, a correcao tende
 * a zero e o atraso assenta no alvo.
 */
const PLAYOUT_GAIN = 0.08;

/** Teto da correcao de fase. 15% de diferenca de ritmo nao se ve; 50% se ve. */
const PLAYOUT_RATE_LIMIT = 0.15;

/** Erro grande demais para corrigir andando: reengata de uma vez (aba que voltou do fundo). */
const PLAYOUT_RESYNC_TICKS = 8;

/** Teto do passo de um quadro. Aba em segundo plano nao acumula meia hora de mundo. */
const MAX_FRAME_MS = 250;

type BufferedFrame<T> = { tick: number; recvMs: number; payload: T };

/**
 * Os dois quadros a desenhar e onde entre eles cair.
 *
 * `tick` e o do quadro JA ALCANCADO (`from`), e nao o do alvo: e ele que diz o
 * que ja aconteceu na linha de render. Ler estado discreto de `to` — vida, quem
 * existe, que ataque comecou — enquanto o corpo ainda esta a caminho dele
 * adiantaria o mundo em ate um tick inteiro.
 */
export type PlayoutSample<T> = {
  from: T;
  to: T;
  alpha: number;
  tick: number;
};

/**
 * Buffer de quadros com um cursor que anda no ritmo do servidor.
 *
 * O cursor NUNCA salta por decisao propria: ele acelera ou freia dentro de um
 * limite estreito ate assentar no colchao que `ArrivalStats` pede. Salto e o
 * defeito que este relogio existe para evitar — so acontece quando a distancia e
 * grande demais para fechar andando (aba que voltou do segundo plano).
 */
export class PlayoutClock<T> {
  private frames: BufferedFrame<T>[] = [];
  /** Instante a desenhar, em ticks de servidor (fracionario). Null antes do 1o quadro. */
  private renderTick: number | null = null;
  private lastSampleMs: number | null = null;
  private readonly stats = new ArrivalStats();

  /** Carga do quadro mais novo recebido, para quem precisa do estado mais atual. */
  get newest(): T | null {
    return this.frames[this.frames.length - 1]?.payload ?? null;
  }

  get delayTicks(): number {
    return this.stats.delayTicks;
  }

  get tickRate(): number {
    return this.stats.tickRate;
  }

  /** Esquece tudo: o que estava guardado nao descreve mais o mundo do jogador. */
  reset(): void {
    this.frames.length = 0;
    this.renderTick = null;
  }

  /**
   * Guarda um quadro. Devolve `true` quando a LINHA DO TEMPO reiniciou.
   *
   * O tick e o relogio da sala. Ele so anda para tras quando a sala e outra —
   * restart, matchmaking novo —, e ai o buffer inteiro pertence a um mundo que
   * nao existe mais: interpolar entre os dois costuraria dois jogos diferentes
   * num mesmo quadro. Quem chama precisa saber para descartar o que ELE guarda
   * daquele mundo (a fila de eventos, por exemplo).
   */
  ingest(tick: number, recvMs: number, payload: T): boolean {
    const newest = this.frames[this.frames.length - 1];
    let restarted = false;
    if (newest) {
      if (tick < newest.tick) {
        this.reset();
        restarted = true;
      } else if (tick === newest.tick) {
        // Mesmo tick reenviado (full_resync coalescido com o snapshot): o mais
        // recente e o autoritativo.
        this.frames.pop();
      } else {
        this.stats.observeArrival(recvMs - newest.recvMs);
      }
    }
    this.frames.push({ tick, recvMs, payload });
    if (this.frames.length > MAX_BUFFERED_FRAMES) this.frames.shift();
    const oldest = this.frames[0];
    const last = this.frames[this.frames.length - 1];
    this.stats.observeSpan(last.tick - oldest.tick, last.recvMs - oldest.recvMs);
    return restarted;
  }

  /**
   * Os dois quadros que cercam o instante a desenhar, e onde entre eles cair.
   *
   * O instante alvo vem do RELOGIO, nao da chegada dos pacotes. E isso que faz o
   * movimento avancar a mesma fracao de tick a cada quadro de render,
   * independentemente de os snapshots chegarem colados ou espacados.
   *
   * Fora do intervalo coberto pelo buffer nao ha o que interpolar: adiante dele o
   * mundo ainda nao chegou (segura o ultimo quadro em vez de extrapolar para uma
   * posicao que o servidor nunca confirmou), atras dele o cliente ficou dormente
   * e o certo e reengatar no quadro mais velho que tem.
   */
  sample(nowMs: number): PlayoutSample<T> | null {
    const frames = this.frames;
    if (frames.length === 0) return null;
    const newest = frames[frames.length - 1];
    const oldest = frames[0];
    const targetTick = this.advance(nowMs, oldest.tick, newest.tick);

    if (frames.length === 1 || targetTick >= newest.tick) {
      return { from: newest.payload, to: newest.payload, alpha: 1, tick: newest.tick };
    }
    if (targetTick <= oldest.tick) {
      return { from: oldest.payload, to: oldest.payload, alpha: 1, tick: oldest.tick };
    }

    for (let i = frames.length - 1; i > 0; i--) {
      const from = frames[i - 1];
      if (targetTick < from.tick) continue;
      const to = frames[i];
      const span = to.tick - from.tick;
      const alpha = span <= 0 ? 1 : (targetTick - from.tick) / span;
      return {
        from: from.payload,
        to: to.payload,
        alpha: Math.max(0, Math.min(1, alpha)),
        tick: from.tick,
      };
    }
    return { from: oldest.payload, to: frames[1].payload, alpha: 1, tick: oldest.tick };
  }

  /**
   * Avanca o cursor deste quadro e devolve o instante a desenhar.
   *
   * O alvo e ficar `delayTicks` atras do ultimo quadro recebido. Perto demais, o
   * proximo atraso de rede deixa o mundo sem para onde interpolar e ele congela;
   * longe demais, o jogo inteiro responde tarde sem ganhar nada.
   */
  private advance(nowMs: number, oldestTick: number, newestTick: number): number {
    const elapsedMs = this.lastSampleMs === null
      ? 0
      : Math.min(MAX_FRAME_MS, Math.max(0, nowMs - this.lastSampleMs));
    this.lastSampleMs = nowMs;

    const delay = this.stats.delayTicks;
    const error = newestTick - (this.renderTick ?? newestTick) - delay;
    if (this.renderTick === null || Math.abs(error) > PLAYOUT_RESYNC_TICKS) {
      // Primeiro quadro, ou distancia grande demais para fechar andando: a aba
      // ficou em segundo plano, a run trocou de sala, a conexao voltou.
      this.renderTick = newestTick - delay;
    } else {
      const correction = Math.max(-PLAYOUT_RATE_LIMIT, Math.min(PLAYOUT_RATE_LIMIT, error * PLAYOUT_GAIN));
      this.renderTick += elapsedMs * this.stats.tickRate * (1 + correction);
    }

    // Nunca adiante do que chegou (extrapolar e inventar posicao que o servidor
    // nao confirmou), nunca atras do que o buffer ainda guarda.
    this.renderTick = Math.max(oldestTick, Math.min(newestTick, this.renderTick));
    return this.renderTick;
  }
}

/**
 * Teto de grupos de eventos esperando a linha de render alcanca-los.
 *
 * Tres segundos a 20 Hz. So enche se ninguem estiver desenhando (aba em segundo
 * plano para o rAF); passando disso os mais velhos sao despachados na hora, para
 * a fila nao crescer sem limite nem engolir evento nenhum.
 */
const MAX_PENDING_TICKS = 60;

/**
 * A narracao de cada tick, segurada ate o mundo daquele tick ser desenhado.
 *
 * Eventos dizem o que aconteceu num tick: telegraph de ataque, morte, explosao,
 * som, vibracao. Dispara-los na CHEGADA os punha a frente do mundo que os
 * produziu — o corpo e desenhado com o atraso do colchao, entao a explosao
 * acendia antes de a criatura chegar onde ela explodiu, e o relogio visual da
 * acao ja nascia adiantado.
 */
export class TickEventQueue<T> {
  private pending: Array<{ tick: number; events: T[] }> = [];

  constructor(private readonly dispatch: (events: T[]) => void) {}

  clear(): void {
    this.pending.length = 0;
  }

  get size(): number {
    return this.pending.length;
  }

  push(tick: number, events: T[]): void {
    if (events.length === 0) return;
    this.pending.push({ tick, events });
    // Ninguem desenhando: despacha os mais velhos em vez de guardar sem limite.
    // Nada e descartado — so deixa de esperar.
    while (this.pending.length > MAX_PENDING_TICKS) {
      this.dispatch(this.pending.shift()!.events);
    }
  }

  /** Solta tudo que a linha de render ja alcancou, em ordem de tick. */
  flush(renderedTick: number): void {
    while (this.pending.length > 0 && this.pending[0].tick <= renderedTick) {
      this.dispatch(this.pending.shift()!.events);
    }
  }
}
