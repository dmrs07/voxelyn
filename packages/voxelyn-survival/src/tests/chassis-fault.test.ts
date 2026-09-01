// A FALHA DO CHASSI, medida sem relogio de verdade.
//
// O que este arquivo trava: o curto so existe com integridade baixa, vira no
// MESMO limiar em que a barra de HP fica vermelha, fica mais frequente conforme
// a integridade cai, e e deterministico — dois quadros no mesmo instante dao o
// mesmo solavanco, e dois Prospectors nao falham em unissono.

import { describe, expect, it } from 'vitest';
import { CHASSIS_FAULT_AT, FAULT_PERIOD_MS, chassisFault } from '../client/chassis-fault';

/** Quantos episodios comecam num intervalo, amostrando a cada 8 ms. */
const episodes = (hpFraction: number, slot: number, spanMs: number): number => {
  let count = 0;
  let wasActive = false;
  for (let t = 0; t < spanMs; t += 8) {
    const active = chassisFault(t, slot, hpFraction).active;
    if (active && !wasActive) count++;
    wasActive = active;
  }
  return count;
};

describe('a falha do chassi', () => {
  it('nao existe com integridade acima do limiar, nem com o chassi ja caido', () => {
    for (let t = 0; t < 5000; t += 50) {
      expect(chassisFault(t, 0, 1).active).toBe(false);
      expect(chassisFault(t, 0, CHASSIS_FAULT_AT + 0.01).active).toBe(false);
      expect(chassisFault(t, 0, 0).active).toBe(false);
    }
  });

  it('vira no mesmo limiar da barra de HP', () => {
    expect(CHASSIS_FAULT_AT).toBe(0.35);
    expect(episodes(CHASSIS_FAULT_AT, 0, 10_000)).toBeGreaterThan(0);
  });

  it('fica mais frequente conforme a integridade cai', () => {
    const atThreshold = episodes(0.34, 0, 20_000);
    const halfway = episodes(0.18, 0, 20_000);
    const nearZero = episodes(0.03, 0, 20_000);
    expect(halfway).toBeGreaterThan(atThreshold);
    expect(nearZero).toBeGreaterThan(halfway);
    expect(atThreshold).toBeCloseTo(20_000 / FAULT_PERIOD_MS.atThreshold, -1);
  });

  it('e curta: um episodio nunca ocupa mais de um terco do tempo', () => {
    for (const hp of [0.34, 0.2, 0.05]) {
      let active = 0;
      let total = 0;
      for (let t = 0; t < 20_000; t += 8) {
        total++;
        if (chassisFault(t, 0, hp).active) active++;
      }
      expect(active / total).toBeLessThan(1 / 3);
    }
  });

  it('e deterministica e limitada', () => {
    const a = chassisFault(1234, 0, 0.1);
    const b = chassisFault(1234, 0, 0.1);
    expect(a).toEqual(b);
    for (let t = 0; t < 5000; t += 8) {
      const f = chassisFault(t, 1, 0.05);
      expect(Math.abs(f.jitterX)).toBeLessThanOrEqual(2);
      expect(Math.abs(f.jitterY)).toBeLessThanOrEqual(2);
      if (!f.active) {
        expect(f.jitterX).toBe(0);
        expect(f.jitterY).toBe(0);
      }
    }
  });

  it('dois Prospectors nao falham em unissono', () => {
    let together = 0;
    let either = 0;
    for (let t = 0; t < 20_000; t += 8) {
      const a = chassisFault(t, 0, 0.2).active;
      const b = chassisFault(t, 1, 0.2).active;
      if (a || b) either++;
      if (a && b) together++;
    }
    expect(either).toBeGreaterThan(0);
    expect(together / either).toBeLessThan(0.5);
  });
});
