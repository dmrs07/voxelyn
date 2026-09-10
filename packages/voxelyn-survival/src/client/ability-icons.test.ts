import { describe, expect, it } from 'vitest';
import {
  ABILITY_MORPH_MS,
  AbilityMorphTracker,
  abilityMorphFrame,
  abilityMorphPhase,
} from './ability-icons';

describe('re-eco do glifo de habilidade', () => {
  it('a fase vive so dentro da janela', () => {
    expect(abilityMorphPhase(1000, 999)).toBeNull();
    expect(abilityMorphPhase(1000, 1000)).toBe(0);
    expect(abilityMorphPhase(1000, 1000 + ABILITY_MORPH_MS / 2)).toBeCloseTo(0.5);
    expect(abilityMorphPhase(1000, 1000 + ABILITY_MORPH_MS)).toBeNull();
  });
  it('o velho some antes de o novo nascer, e o novo termina inteiro', () => {
    const start = abilityMorphFrame(0);
    expect(start.outScale).toBe(1);
    expect(start.outAlpha).toBe(1);
    expect(start.inAlpha).toBe(0);
    const mid = abilityMorphFrame(0.45);
    expect(mid.outAlpha).toBe(0);
    expect(mid.inScale).toBeGreaterThanOrEqual(0);
    const end = abilityMorphFrame(1);
    expect(end.outAlpha).toBe(0);
    expect(end.inAlpha).toBe(1);
    expect(end.inScale).toBeCloseTo(1, 1);
    expect(end.inAngle).toBeCloseTo(0, 5);
    expect(end.ringAlpha).toBeCloseTo(0, 5);
    // O anel so abre.
    let ring = -1;
    for (let t = 0; t <= 1; t += 0.1) {
      const r = abilityMorphFrame(t).ring;
      expect(r).toBeGreaterThan(ring);
      ring = r;
    }
  });
  it('o rastreador so anima uma TROCA dentro da mesma run', () => {
    const tracker = new AbilityMorphTracker();
    const run = {};
    expect(tracker.observe(run, 'pulse', 0)).toBeNull();
    expect(tracker.observe(run, 'pulse', 16)).toBeNull();
    const morph = tracker.observe(run, 'arc', 100);
    expect(morph).toEqual({ from: 'pulse', to: 'arc', t: 0 });
    expect(tracker.observe(run, 'arc', 100 + ABILITY_MORPH_MS / 2)?.t).toBeCloseTo(0.5);
    expect(tracker.observe(run, 'arc', 100 + ABILITY_MORPH_MS + 1)).toBeNull();
    // Run nova comecando no pulso: nao e uma troca, e um comeco.
    expect(tracker.observe({}, 'pulse', 2000)).toBeNull();
  });
});
