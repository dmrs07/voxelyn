// A APRESENTACAO do colapso do Coracao da Fornalha.
//
// O que estes testes protegem nao e a mecanica — ela vive na sim e e testada
// la. E a promessa de que o jogador VE o que o esta matando: a batida que
// pulsa, a pedra que esquenta, e o fato de que as duas param quando o chefe
// para. Um efeito continuo que nao sabe terminar e o defeito mais facil de
// enviar sem ninguem notar, porque ele so aparece depois da vitoria.

import { describe, expect, it } from 'vitest';
import { BOSS_PHASE_OVERHEAT, BOSS_PHASE_UNSTABLE } from '@voxelyn/survival-sim';
import { furnaceBodyTint, heartbeatShake, livePhasesOf } from '../client/render';

const NONE = 0;
const OVERHEAT = BOSS_PHASE_OVERHEAT;
const UNSTABLE = BOSS_PHASE_OVERHEAT | BOSS_PHASE_UNSTABLE;

/** Amplitude maxima da batida ao longo de um ciclo inteiro, amostrada fino. */
const peakOver = (phases: number, ms: number): number => {
  let peak = 0;
  for (let t = 0; t < ms; t += 2) peak = Math.max(peak, heartbeatShake(phases, t));
  return peak;
};

describe('a batida do coracao', () => {
  it('nao existe antes do colapso', () => {
    expect(peakOver(NONE, 3000)).toBe(0);
  });

  it('pulsa: ha instantes fortes e instantes quase parados', () => {
    // O que distingue uma BATIDA de um tremor constante e o vale entre os
    // picos. Sem ele o efeito le como motor ligado, e a informacao "ha um
    // corpo batendo do outro lado da sala" nao chega.
    let low = Number.POSITIVE_INFINITY;
    let high = 0;
    for (let t = 0; t < 2000; t += 2) {
      const v = heartbeatShake(OVERHEAT, t);
      low = Math.min(low, v);
      high = Math.max(high, v);
    }
    expect(high).toBeGreaterThan(1);
    expect(low).toBeLessThan(high * 0.1);
  });

  it('a instabilidade acelera E aprofunda a MESMA batida', () => {
    expect(peakOver(UNSTABLE, 3000)).toBeGreaterThan(peakOver(OVERHEAT, 3000));
    // Mais rapida: mais picos no mesmo intervalo.
    const beats = (phases: number): number => {
      let count = 0;
      let above = false;
      for (let t = 0; t < 6000; t += 2) {
        const hot = heartbeatShake(phases, t) > 1;
        if (hot && !above) count++;
        above = hot;
      }
      return count;
    };
    expect(beats(UNSTABLE)).toBeGreaterThan(beats(OVERHEAT));
  });

  it('e deterministica: o mesmo instante da o mesmo tremor', () => {
    // Sem `Math.random` no meio: dois clientes de co-op no mesmo quadro tem de
    // ver a mesma camara. (O jitter fica no chamador, que ja e aleatorio.)
    for (const t of [0, 137, 451, 889]) {
      expect(heartbeatShake(UNSTABLE, t)).toBe(heartbeatShake(UNSTABLE, t));
    }
  });
});

describe('o corpo do chefe durante o colapso', () => {
  it('nao ganha cor nenhuma antes do colapso', () => {
    expect(furnaceBodyTint(NONE, 0)).toBeUndefined();
  });

  it('esquenta no colapso e vai ao branco na instabilidade', () => {
    const hot = furnaceBodyTint(OVERHEAT, 0);
    const white = furnaceBodyTint(UNSTABLE, 0);
    expect(hot).toBeDefined();
    expect(white).toBeDefined();
    expect(hot!.color).toContain('217,59,76'); // vermelho de forja
    expect(white!.color).toContain('255,233,184'); // a cor da base do ciclone
    expect(white!.alpha).toBeGreaterThan(hot!.alpha);
  });

  it('pulsa no MESMO relogio do tremor', () => {
    // Se as duas leituras batessem fora de fase, o jogador leria duas ameacas
    // em vez de uma.
    let brightest = 0;
    let brightestAt = 0;
    let strongest = 0;
    let strongestAt = 0;
    for (let t = 0; t < 900; t += 2) {
      const tint = furnaceBodyTint(OVERHEAT, t)!;
      if (tint.alpha > brightest) {
        brightest = tint.alpha;
        brightestAt = t;
      }
      const beat = heartbeatShake(OVERHEAT, t);
      if (beat > strongest) {
        strongest = beat;
        strongestAt = t;
      }
    }
    expect(Math.abs(brightestAt - strongestAt)).toBeLessThanOrEqual(4);
  });
});

describe('o colapso TERMINA com o chefe', () => {
  const withHeart = (alive: boolean, phases: number) => ({
    enemies: [{ archetype: 'furnace_heart', alive }],
    bossRuntime: { phasesFired: phases },
  });

  it('a camara treme enquanto o dono dela esta de pe', () => {
    expect(livePhasesOf(withHeart(true, OVERHEAT))).toBe(OVERHEAT);
  });

  it('e para no instante em que ele cai', () => {
    // `phasesFired` e MEMORIA e nunca apaga — uma fase de uma vez nao volta
    // atras. Sem este filtro a sala tremeria para sempre depois do abate, que
    // e o oposto exato do alivio que o abate promete.
    expect(livePhasesOf(withHeart(false, UNSTABLE))).toBe(0);
    expect(heartbeatShake(livePhasesOf(withHeart(false, UNSTABLE)), 0)).toBe(0);
    expect(furnaceBodyTint(livePhasesOf(withHeart(false, UNSTABLE)), 0)).toBeUndefined();
  });

  it('e nao acende por um chefe que nem entrou na sala', () => {
    expect(livePhasesOf({ enemies: [], bossRuntime: { phasesFired: UNSTABLE } })).toBe(0);
  });
});
