/**
 * Como se abre o menu no meio da run SEM um botao na tela.
 *
 * Um botao permanente seria a solucao obvia e e a errada aqui: a tela de celular
 * ja carrega dois joysticks, quatro acoes, barra de contaminacao e o convite de
 * co-op. O menu e a coisa MENOS frequente da sessao — abre-se uma vez a cada
 * varias runs — e pagaria por isso com espaco permanente e com um alvo de toque
 * a mais para o polegar acertar por engano no meio de uma perseguicao.
 *
 * O que entra no lugar dele sao tres gestos, cada um resolvendo uma plataforma:
 *
 * 1. ESC (e P) no desktop. Nao precisa de justificativa: e onde todo jogo de PC
 *    poe a pausa, e quem tem teclado tenta isso primeiro.
 *
 * 2. O botao/gesto VOLTAR no celular. Wireado por History API em `pause-menu`.
 *    No Android e o botao de sistema, e ninguem precisa aprender nada: voltar
 *    "para fora do jogo" e exatamente o que a pessoa quer dizer.
 *
 * 3. Toque longo na FAIXA DE TOPO da tela — este arquivo. E o unico que funciona
 *    no PWA instalado do iOS, onde nao existe botao de voltar nem gesto de borda.
 *
 * Por que o topo, e por que longo: os controles todos vivem na metade de baixo
 * (joysticks ancorados no rodape, acoes logo acima da mira), entao a faixa de
 * cima e o unico lugar da tela onde um toque hoje nao significa NADA — e o unico
 * onde um gesto novo nao pode roubar uma entrada de combate. E o toque tem de ser
 * longo porque toque curto ali tambem nao e neutro: e o que reinicia a run na
 * tela de fim.
 *
 * Sem DOM de proposito, como `restart.ts`: e logica de gesto, testavel em Node.
 */

/** Quanto tempo o dedo fica parado antes de o menu abrir. */
export const PAUSE_HOLD_MS = 420;

/**
 * Quanto o dedo pode escorregar sem cancelar.
 *
 * Zero seria injusto (nenhum dedo fica imovel por 420 ms) e generoso demais
 * transformaria um arrasto em pausa. Vinte pixels e menos que a metade do raio
 * de um botao de acao.
 */
export const PAUSE_SLOP_PX = 20;

/**
 * Altura da faixa de topo que aceita o gesto, em pixels de CSS.
 *
 * O teto de 120 px e o que mantem a faixa longe dos botoes de acao em paisagem
 * de celular, que e o caso apertado: numa tela de 380 px de altura os botoes
 * comecam por volta de 150 px do topo, e a faixa para em 84.
 */
export const pauseZoneHeight = (viewportHeight: number): number =>
  Math.max(48, Math.min(viewportHeight * 0.22, 120));

/** O ponto cai na faixa que aceita o toque longo? */
export const isInPauseZone = (y: number, viewportHeight: number): boolean =>
  y >= 0 && y <= pauseZoneHeight(viewportHeight);

/**
 * Toque longo: nasce, sobrevive a um tremor pequeno e completa uma unica vez.
 *
 * `completed` e quem dispara, e nao `end`, porque o menu tem de abrir com o dedo
 * AINDA na tela — se so abrisse ao soltar, o jogador que segurou e nao viu nada
 * acontecer solta antes da hora e conclui que o gesto nao existe.
 */
export class HoldToOpen {
  private pointerId = -1;
  private originX = 0;
  private originY = 0;
  private startedAt = 0;
  private fired = false;

  constructor(
    private readonly holdMs = PAUSE_HOLD_MS,
    private readonly slopPx = PAUSE_SLOP_PX,
  ) {}

  /** Ha um toque candidato em andamento? */
  get pending(): boolean {
    return this.pointerId !== -1 && !this.fired;
  }

  begin(pointerId: number, x: number, y: number, now: number): void {
    this.pointerId = pointerId;
    this.originX = x;
    this.originY = y;
    this.startedAt = now;
    this.fired = false;
  }

  /** Move o dedo; passar do raio cancela o gesto. */
  drag(pointerId: number, x: number, y: number): void {
    if (pointerId !== this.pointerId) return;
    if (Math.hypot(x - this.originX, y - this.originY) > this.slopPx) this.cancel();
  }

  end(pointerId: number): void {
    if (pointerId === this.pointerId) this.cancel();
  }

  cancel(): void {
    this.pointerId = -1;
    this.fired = false;
  }

  /** true UMA vez, no instante em que o toque corrente completa o tempo. */
  completed(now: number): boolean {
    if (this.pointerId === -1 || this.fired) return false;
    if (now - this.startedAt < this.holdMs) return false;
    this.fired = true;
    return true;
  }
}

// ---------------------------------------------------------------------------
// A DICA DO GESTO
// ---------------------------------------------------------------------------

/** Tempo ate a primeira tentativa: o polegar pousa antes de a dica pedir leitura. */
export const PAUSE_HINT_DELAY_MS = 1600;
/** Intervalo entre tentativas enquanto o banner estiver ocupado. */
export const PAUSE_HINT_RETRY_MS = 600;
/**
 * Ate quando insistir DENTRO de uma descida.
 *
 * Existe para a dica nao brotar no meio de uma luta dez minutos depois: passado
 * o prazo ela desiste sem gravar a chave, e a proxima descida tenta de novo.
 */
export const PAUSE_HINT_DEADLINE_MS = 20000;
/** Quanto tempo a dica fica lida na tela. */
export const PAUSE_HINT_DURATION_MS = 4000;

export type PauseHintVerdict = 'show' | 'retry' | 'giveUp';

/**
 * A dica pode entrar na tela agora?
 *
 * O DEFEITO QUE ISTO CONSERTA: a dica era uma tentativa UNICA, 1,6 s depois da
 * descida, e desistia calada se o banner estivesse ocupado — "banner ocupado tem
 * prioridade, a dica fica para a proxima descida". A premissa era que um banner
 * ocupado fosse eventual. Nao e: uma descida sem servidor abre com "AURIX
 * UNREACHABLE" ocupando o banner por 4,2 s, e a tentativa cai DENTRO dessa
 * janela em toda descida.
 *
 * Medido no jogo rodando, tablet com toque, chave da dica limpa: o banner ocupa
 * de t+22 ms a t+4265 ms, a dica nunca aparece, e a chave permanece `null` —
 * como a versao antiga desistia ANTES de gravar, a descida seguinte repetia o
 * mesmo encontro. A dica era inalcancavel para sempre, e nao uma vez.
 *
 * Quem joga offline e exatamente quem mais precisa dela: e a plataforma sem
 * teclado, sem ESC e — no PWA do iOS — sem botao de voltar, onde o toque longo
 * no topo e o UNICO caminho ate o menu.
 *
 * A correcao mantem a prioridade do banner e troca a desistencia por espera.
 *
 * @param elapsedMs desde a primeira tentativa desta descida
 * @param bannerBusy o banner esta ocupado por outra mensagem
 */
export const pauseHintVerdict = (elapsedMs: number, bannerBusy: boolean): PauseHintVerdict => {
  if (!bannerBusy) return 'show';
  return elapsedMs >= PAUSE_HINT_DEADLINE_MS ? 'giveUp' : 'retry';
};
