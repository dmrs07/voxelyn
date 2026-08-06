// Guarda de encerramento da Arena: garante que uma luta so se decide UMA VEZ.
//
// Existe como modulo PURO e separado de `arena-main.ts` por um motivo
// especifico: o cenario que mais importa provar — vitoria/derrota seguidas
// de um abandono tardio (fechar a aba depois de ja ter vencido) virando
// no-op — nao pode depender de DOM, rAF nem `pagehide` para ser testado.
import type { ArenaOutcome } from './arena-outcome';

export type ArenaConclusionGuard = {
  /**
   * Tenta registrar `result` como o desfecho desta luta. Devolve `true` SO na
   * primeira chamada; qualquer chamada seguinte — mesmo com um resultado
   * diferente — e no-op e devolve `false`. E o que impede um `pagehide` que
   * chega depois da vitoria (ou um duplo clique em "reconfigurar") de
   * substituir um desfecho real por 'abandoned'.
   */
  conclude: (result: ArenaOutcome) => boolean;
  /** O desfecho ja decidido, ou `null` enquanto a luta continua. */
  current: () => ArenaOutcome | null;
};

export const createArenaConclusionGuard = (): ArenaConclusionGuard => {
  let outcome: ArenaOutcome | null = null;
  return {
    conclude: (result) => {
      if (outcome !== null) return false;
      outcome = result;
      return true;
    },
    current: () => outcome,
  };
};
