/**
 * Porta de reinicio da run.
 *
 * Dois problemas que ela resolve, iguais no solo e no online:
 *
 * 1. A fila de toques so e consumida pela UI (menu de escolha, tela de fim).
 *    Durante a run ninguem a le, entao cada toque no joystick/mira/botao — e
 *    cada clique de tiro no mouse — fica acumulado. Sem drenar, o primeiro
 *    teste de toque apos a morte ja encontra um toque antigo e reinicia a run
 *    instantaneamente, antes do jogador ver o resultado.
 *
 * 2. Mesmo drenando, um toque em voo no instante da morte reiniciaria na hora.
 *    Por isso a tela de fim precisa ficar visivel por um tempo minimo antes de
 *    o toque valer como "quero descer de novo".
 *
 * Sem DOM de proposito: e logica de frame, testavel em Node.
 */
export class RestartGate {
  private since = 0;

  constructor(private readonly armMs = 900) {}

  /**
   * Avalia o frame corrente.
   * @param now ms monotonico (performance.now)
   * @param terminal a run acabou (morte ou extracao)
   * @returns `drain` = descarte a fila de toques agora;
   *          `armed` = um toque/tecla neste frame vale como decisao do jogador
   *          (descer de novo ou voltar ao terminal).
   */
  frame(now: number, terminal: boolean): { drain: boolean; armed: boolean } {
    if (!terminal) {
      this.since = 0;
      return { drain: true, armed: false };
    }
    if (this.since === 0) {
      // primeiro frame da tela de fim: joga fora os toques da run
      this.since = now;
      return { drain: true, armed: false };
    }
    return { drain: false, armed: now - this.since >= this.armMs };
  }

  /** Chame ao efetivamente reiniciar, para rearmar a porta na proxima morte. */
  reset(): void {
    this.since = 0;
  }
}
