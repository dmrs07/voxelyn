// A APRESENTACAO do colapso do Coracao da Fornalha.
//
// O que estes testes protegem nao e a mecanica — ela vive na sim e e testada
// la. E a promessa de que o jogador VE o que o esta matando: a batida que
// pulsa, a pedra que esquenta, e o fato de que as duas param quando o chefe
// para. Um efeito continuo que nao sabe terminar e o defeito mais facil de
// enviar sem ninguem notar, porque ele so aparece depois da vitoria.

import { describe, expect, it } from 'vitest';
import { BOSS_PHASE_OVERHEAT, BOSS_PHASE_UNSTABLE } from '@voxelyn/survival-sim';
import {
  furnaceBodyTint,
  heartbeatShake,
  livePhasesOf,
  pendingGroundMarkers,
} from '../client/render';

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

describe('o telegrafo sobrevive a reconexao', () => {
  // O buraco que este bloco fecha: os eventos `stalactite` e `blast_marker`
  // anunciam a marca no tick em que ela nasce, e quem RECONECTA no meio da
  // janela de aviso nunca os recebeu. O servidor continua cobrando na hora
  // marcada — sem derivar do estado, a reconexao produzia uma pancada sem
  // telegrafo nenhum.
  const mirror = (over: Record<string, unknown> = {}) => ({
    config: { width: 100 },
    bossRuntime: { collapseCells: [], blastCells: [], ...(over.bossRuntime ?? {}) },
    enemies: [],
    ...over,
  });

  it('nao inventa marca quando nao ha nada pendente', () => {
    expect(pendingGroundMarkers(mirror())).toHaveLength(0);
  });

  it('a estalactite pendente vira marca sem nenhum evento ter chegado', () => {
    const marks = pendingGroundMarkers(
      mirror({ bossRuntime: { collapseCells: [{ idx: 12 * 100 + 34, at: 900 }], blastCells: [] } }),
    );
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ x: 34.5, y: 12.5, fireTick: 900, kind: 'stalactite' });
  });

  it('a Salva pendente tambem, tirando o relogio da ACAO do chefe', () => {
    const marks = pendingGroundMarkers(
      mirror({
        bossRuntime: { collapseCells: [], blastCells: [500, 501] },
        enemies: [{ alive: true, action: { kind: 'demolish', releaseAt: 640 } }],
      }),
    );
    expect(marks).toHaveLength(2);
    expect(marks.every((m) => m.kind === 'blast' && m.fireTick === 640)).toBe(true);
  });

  it('sem relogio nao desenha meia marca', () => {
    // Onde, mas nao quando, e pior que nada: para de comunicar urgencia e
    // continua ocupando o chao.
    const marks = pendingGroundMarkers(
      mirror({ bossRuntime: { collapseCells: [], blastCells: [500] }, enemies: [] }),
    );
    expect(marks).toHaveLength(0);
  });

  it('as duas fontes convivem na mesma lista', () => {
    const marks = pendingGroundMarkers(
      mirror({
        bossRuntime: { collapseCells: [{ idx: 200, at: 10 }], blastCells: [300] },
        enemies: [{ alive: true, action: { kind: 'demolish', releaseAt: 20 } }],
      }),
    );
    expect(marks.map((m) => m.kind).sort()).toEqual(['blast', 'stalactite']);
  });
});
