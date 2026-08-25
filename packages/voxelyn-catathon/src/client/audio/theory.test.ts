import { describe, expect, it } from 'vitest';
import { CLASSIC_TEAM, createHackathon } from '../../sim/index.js';
import {
  BASS_ROOTS,
  MOTIF,
  MOTIF_UNRESOLVED,
  PROGRESSION,
  SHIP_NOTES,
  SUSPENDED,
  activeLayers,
  barOf,
  flowNoteAt,
  hz,
  signalsOf,
  stickyLayers,
  BAR_SIM_TICKS,
  D4,
} from './theory.js';

/**
 * A musica adaptativa TESTADA como a simulacao e: as decisoes sao funcoes
 * puras, entao da para provar sem AudioContext que a direcao esta cumprida —
 * que tudo soa em re maior, que as camadas respondem ao estado certo, e que
 * as trocas so caem em fronteira de compasso.
 */

// Re maior: D E F# G A B C#, como classes de altura a partir de D.
const D_MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]);
const inKey = (midi: number): boolean => D_MAJOR.has(((midi - 62) % 12 + 12) % 12);

describe('tudo soa em re maior', () => {
  it('o motivo e a sua forma sem resolver', () => {
    for (const n of [...MOTIF, ...MOTIF_UNRESOLVED]) expect(inKey(n), `nota ${n}`).toBe(true);
    // A forma: sobe, hesita, resolve em casa.
    expect(MOTIF[0]).toBe(D4);
    expect(MOTIF[4]).toBe(D4);
    expect(MOTIF[2]).toBeGreaterThan(MOTIF[0]);
    expect(MOTIF[3]).toBeLessThan(MOTIF[2]);
  });

  it('progressao, baixo, suspensao e os pops de ship', () => {
    for (const chord of PROGRESSION) for (const n of chord) expect(inKey(n)).toBe(true);
    for (const n of BASS_ROOTS) expect(inKey(n)).toBe(true);
    for (const n of SUSPENDED) expect(inKey(n)).toBe(true);
    for (const def of Object.values(SHIP_NOTES)) for (const n of def.midi) expect(inKey(n)).toBe(true);
  });

  it('o la de referencia esta certo (hz)', () => {
    expect(hz(69)).toBeCloseTo(440, 6);
    expect(hz(62)).toBeCloseTo(293.66, 1);
  });
});

describe('as camadas respondem ao estado certo', () => {
  const base = { workingCount: 0, blocked: false, avgEnergy: 1, clock: 0.3 };

  it('a cama nunca sai; silencio total nao existe', () => {
    expect(activeLayers(base).has('bed')).toBe(true);
  });

  it('trabalho poe ritmo; tres em fluxo poem o shaker', () => {
    expect(activeLayers({ ...base, workingCount: 1 }).has('work')).toBe(true);
    expect(activeLayers({ ...base, workingCount: 1 }).has('flow')).toBe(false);
    expect(activeLayers({ ...base, workingCount: 3 }).has('flow')).toBe(true);
  });

  it('bloqueio poe a suspensao SEM tirar o groove — o baixo segue confiante', () => {
    const on = activeLayers({ ...base, workingCount: 2, blocked: true });
    expect(on.has('tension')).toBe(true);
    expect(on.has('work')).toBe(true);
  });

  it('o ultimo quinto do relogio poe o pulso do deadline', () => {
    expect(activeLayers({ ...base, clock: 0.79 }).has('deadline')).toBe(false);
    expect(activeLayers({ ...base, clock: 0.81 }).has('deadline')).toBe(true);
  });

  it('exaustao e camada de FILTRO, ligada pela energia media', () => {
    expect(activeLayers({ ...base, avgEnergy: 0.3 }).has('exhaustion')).toBe(true);
    expect(activeLayers({ ...base, avgEnergy: 0.6 }).has('exhaustion')).toBe(false);
  });

  it('os sinais derivam da simulacao, nunca de animacao', () => {
    const state = createHackathon(1, CLASSIC_TEAM, { classic: true });
    const s = signalsOf(state);
    expect(s.workingCount).toBe(0);
    expect(s.blocked).toBe(false);
    state.cableOut = true;
    expect(signalsOf(state).blocked).toBe(true);
  });
});

describe('camadas pegajosas: entrada imediata, saida em compasso', () => {
  const base = { workingCount: 0, blocked: false, avgEnergy: 1, clock: 0.3 };

  it('a camada liga NO tick da justificativa', () => {
    const last: Partial<Record<string, number>> = {};
    const on = stickyLayers(last, { ...base, workingCount: 1 }, 100);
    expect(on.has('work')).toBe(true);
  });

  it('uma pausa curta nao derruba o groove; um compasso inteiro derruba', () => {
    const last: Partial<Record<string, number>> = {};
    stickyLayers(last, { ...base, workingCount: 1 }, 100);
    // Pausa de meio compasso: a camada segura.
    const mid = stickyLayers(last, base, 100 + Math.floor(BAR_SIM_TICKS / 2));
    expect(mid.has('work')).toBe(true);
    // Um compasso inteiro sem justificativa: agora sim ela sai.
    const out = stickyLayers(last, base, 100 + BAR_SIM_TICKS + 1);
    expect(out.has('work')).toBe(false);
  });

  it('re-justificar no meio da carencia rearma o relogio', () => {
    const last: Partial<Record<string, number>> = {};
    stickyLayers(last, { ...base, workingCount: 1 }, 100);
    stickyLayers(last, { ...base, workingCount: 1 }, 160);
    const on = stickyLayers(last, base, 160 + BAR_SIM_TICKS);
    expect(on.has('work')).toBe(true);
  });
});

describe('o transporte quantiza em compasso', () => {
  it('o ciclo harmonico tem quatro compassos', () => {
    expect(barOf(0)).toBe(0);
    expect(barOf(16)).toBe(1);
    expect(barOf(63)).toBe(3);
    expect(barOf(64)).toBe(0);
  });

  it('os fragmentos do motivo em flow ficam no tom e respiram', () => {
    let notes = 0;
    let silentPhrase = true;
    for (let step = 0; step < 64 * 3; step++) {
      const n = flowNoteAt(step);
      if (n !== null) {
        notes++;
        expect(inKey(n)).toBe(true);
        if (Math.floor(step / 64) % 3 === 2) silentPhrase = false;
      }
    }
    expect(notes).toBeGreaterThan(0);
    // Uma frase em cada tres e silencio: o respiro e parte da partitura.
    expect(silentPhrase).toBe(true);
  });
});
