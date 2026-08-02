// O rastro dos espreitadores: pegadas espacadas, memoria com prazo.
//
// O que os testes cobram:
// 1. ESPACAMENTO: pegada nova so quando o bicho ANDOU — parado nao acumula.
// 2. PRAZO: pegadas vencem na ordem e o gelo lembra mais que a agua.
// 3. DETERMINISMO: nada de sorteio — mesmo movimento, mesmo rastro.
import { describe, expect, it } from 'vitest';
import { decayTrail, TRAIL_SPACING, trailAge, trailTtlMs, updateTrail, type LurkerTrail } from '../client/lurker-trail';

const fresh = (inWater: boolean): LurkerTrail => ({ ttlMs: trailTtlMs(inWater), inWater, points: [] });

describe('rastro de espreitador', () => {
  it('pegada nova so quando ha deslocamento real', () => {
    const trail = fresh(true);
    updateTrail(trail, 10, 10, 0);
    expect(trail.points.length).toBe(1);
    // Tremidinha menor que o espacamento: nenhuma pegada nova.
    updateTrail(trail, 10 + TRAIL_SPACING * 0.5, 10, 16);
    updateTrail(trail, 10, 10 + TRAIL_SPACING * 0.4, 33);
    expect(trail.points.length).toBe(1);
    // Andou de verdade (com folga acima do espacamento — 10.7-10 em float
    // fica um epsilon ABAIXO de 0.7): registra.
    updateTrail(trail, 10 + TRAIL_SPACING * 1.1, 10, 50);
    expect(trail.points.length).toBe(2);
  });

  it('pegadas vencem em ordem e a entrada esvazia sozinha', () => {
    const trail = fresh(true);
    updateTrail(trail, 0, 0, 0);
    updateTrail(trail, 1, 0, 100);
    updateTrail(trail, 2, 0, 200);
    expect(trail.points.length).toBe(3);
    // Passado o prazo da primeira pegada, ela cai — as outras ficam.
    decayTrail(trail, trail.ttlMs + 50);
    expect(trail.points.map((p) => p.at)).toEqual([100, 200]);
    decayTrail(trail, trail.ttlMs + 1000);
    expect(trail.points).toEqual([]);
  });

  it('o gelo lembra mais que a agua', () => {
    expect(trailTtlMs(false)).toBeGreaterThan(trailTtlMs(true));
  });

  it('a idade normaliza de 0 a 1 e satura', () => {
    const trail = fresh(false);
    updateTrail(trail, 0, 0, 1000);
    const pt = trail.points[0];
    expect(trailAge(trail, pt, 1000)).toBe(0);
    expect(trailAge(trail, pt, 1000 + trail.ttlMs / 2)).toBeCloseTo(0.5, 5);
    expect(trailAge(trail, pt, 1000 + trail.ttlMs * 3)).toBe(1);
  });

  it('mesmo movimento, mesmo rastro — nao ha sorteio nenhum', () => {
    const a = fresh(true);
    const b = fresh(true);
    for (let t = 0; t < 20; t++) {
      const x = 10 + t * 0.4;
      const y = 10 + Math.sin(t) * 2;
      updateTrail(a, x, y, t * 50);
      updateTrail(b, x, y, t * 50);
    }
    expect(a).toEqual(b);
  });
});
