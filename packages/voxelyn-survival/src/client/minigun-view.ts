// A ROTACAO DO CANHAO como o cliente a conhece, slot a slot.
//
// O problema que este arquivo resolve e estreito e vale enunciar: no solo, a
// rotacao de todo mundo e autoritativa e esta em `playerExtras[slot].minigun`.
// No co-op online, so o VIEWER recebe o proprio `minigun` — o parceiro chega
// como `EntitySnapshot`, que carrega posicao, vida e acao, e nada mais. Sem
// isto, o Prospector do parceiro apareceria com uma arma parada cuspindo
// dezesseis balas por segundo.
//
// A solucao NAO e mandar a rotacao de todo mundo por tick. Ela e integrar a
// rampa localmente a partir das TRANSICOES de fase (`minigun_spin`), com as
// MESMAS constantes que a simulacao usa — a rampa e deterministica e conhecida
// dos dois lados, entao o cliente reconstroi a curva em vez de recebe-la.
//
// O erro dessa reconstrucao e limitado por construcao: cada transicao de fase
// reancora a rotacao no valor autoritativo que veio no evento, e entre duas
// transicoes a curva e exatamente a mesma funcao. O que pode divergir e a
// fracao de tick entre o evento e o quadro, que vale poucos milesimos de
// rotacao — e o consumidor disto e um desenho de canos girando.

import {
  MINIGUN_SPIN_DOWN_PER_TICK,
  MINIGUN_SPIN_MAX,
  MINIGUN_SPIN_UP_PER_TICK,
  TICK_HZ,
  type MinigunPhase,
} from '@voxelyn/survival-sim';

export type MinigunView = {
  /** 0..1. */
  spin: number;
  phase: MinigunPhase;
  /** Quando a ultima rajada chegou, em ms do relogio do cliente. */
  lastBurstMs: number;
  /** Balas da ultima rajada: alimenta a densidade do clarao de boca. */
  lastBurstRounds: number;
};

const EMPTY: MinigunView = { spin: 0, phase: 'idle', lastBurstMs: 0, lastBurstRounds: 0 };

/** A rotacao sobe nesta fase? Vale para a integracao local entre transicoes. */
export const spinRises = (phase: MinigunPhase): boolean =>
  phase === 'spinning_up' || phase === 'firing';

/**
 * Avanca a rotacao de `dtMs` com as constantes da simulacao.
 *
 * Em UNIDADES NORMALIZADAS (0..1) e em tempo real, e nao em ticks inteiros:
 * este e o lado da apresentacao, e ele desenha a 120 Hz num monitor e a 30 Hz
 * noutro. A conversao passa por `TICK_HZ` para as duas taxas chegarem no mesmo
 * lugar no mesmo instante.
 */
export const advanceSpin = (spin: number, phase: MinigunPhase, dtMs: number): number => {
  const ticks = (Math.max(0, Math.min(250, dtMs)) / 1000) * TICK_HZ;
  const delta = (spinRises(phase) ? MINIGUN_SPIN_UP_PER_TICK : -MINIGUN_SPIN_DOWN_PER_TICK) * ticks;
  return Math.max(0, Math.min(1, spin + delta / MINIGUN_SPIN_MAX));
};

/**
 * O clarao de boca ainda esta aceso?
 *
 * A janela e um pouco MAIOR que o intervalo entre rajadas (200 ms) de
 * proposito: o clarao tem de ler como continuo enquanto o gatilho estiver
 * preso, e apagar assim que ele soltar. Uma janela menor piscaria cinco vezes
 * por segundo — que e a cadencia do EVENTO, nao a da arma, e mostrar a
 * cadencia do evento seria mostrar um detalhe de implementacao.
 */
export const MUZZLE_FLASH_WINDOW_MS = 240;

/** Registro por slot da rotacao vista pelo cliente. */
export class MinigunViews {
  private readonly bySlot = new Map<number, MinigunView>();

  clear(): void {
    this.bySlot.clear();
  }

  get(slot: number): MinigunView {
    return this.bySlot.get(slot) ?? EMPTY;
  }

  /** Uma transicao autoritativa: reancora rotacao e fase. */
  applySpin(slot: number, phase: MinigunPhase, spin: number): void {
    const view = this.ensure(slot);
    view.phase = phase;
    view.spin = Math.max(0, Math.min(1, spin / MINIGUN_SPIN_MAX));
  }

  /** Uma rajada: alimenta o clarao de boca e as capsulas. */
  applyBurst(slot: number, rounds: number, spin: number, nowMs: number): void {
    const view = this.ensure(slot);
    view.lastBurstMs = nowMs;
    view.lastBurstRounds = rounds;
    // A rajada tambem reancora: ela carrega a rotacao do tick em que foi
    // publicada, e cinco reancoragens por segundo custam nada.
    view.spin = Math.max(0, Math.min(1, spin / MINIGUN_SPIN_MAX));
  }

  /**
   * A rotacao AUTORITATIVA de um slot que o cliente conhece por inteiro.
   *
   * Chamado para o jogador local (solo e online) e para todos os slots no
   * solo. Sobrescreve a integracao local, que existe apenas para quem nao tem
   * essa informacao.
   */
  applyAuthoritative(slot: number, phase: MinigunPhase, spin: number): void {
    const view = this.ensure(slot);
    view.phase = phase;
    view.spin = Math.max(0, Math.min(1, spin / MINIGUN_SPIN_MAX));
  }

  /** Integra a rampa dos slots que so tem transicoes. */
  step(dtMs: number): void {
    for (const view of this.bySlot.values()) {
      view.spin = advanceSpin(view.spin, view.phase, dtMs);
    }
  }

  /** O clarao de boca deste slot esta aceso agora? */
  firingFlash(slot: number, nowMs: number): number {
    const view = this.bySlot.get(slot);
    if (!view || view.lastBurstMs === 0) return 0;
    const age = nowMs - view.lastBurstMs;
    if (age < 0 || age > MUZZLE_FLASH_WINDOW_MS) return 0;
    return 1 - age / MUZZLE_FLASH_WINDOW_MS;
  }

  private ensure(slot: number): MinigunView {
    let view = this.bySlot.get(slot);
    if (!view) {
      view = { spin: 0, phase: 'idle', lastBurstMs: 0, lastBurstRounds: 0 };
      this.bySlot.set(slot, view);
    }
    return view;
  }
}
