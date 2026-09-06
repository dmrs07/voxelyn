// O RUIDO DE PERLIN, conferido: determinista pela semente, zero nos nos,
// dentro de [-1, 1], continuo, e o `fbm` e o contorno irregular que a
// detonacao usa herdam tudo isso (e o contorno FECHA).
import { describe, expect, it } from 'vitest';
import { blobRadius, fbm01, fbm2, perlin2 } from '../client/noise';

describe('perlin2', () => {
  it('e determinista pela semente e muda com ela', () => {
    expect(perlin2(3.37, 8.21, 5)).toBe(perlin2(3.37, 8.21, 5));
    expect(perlin2(3.37, 8.21, 5)).not.toBe(perlin2(3.37, 8.21, 6));
  });

  it('e zero em toda coordenada inteira e fica em [-1, 1]', () => {
    for (let x = -3; x <= 3; x++)
      for (let y = -3; y <= 3; y++) expect(perlin2(x, y, 9) + 0).toBe(0);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 4000; i++) {
      const v = perlin2(i * 0.173, i * 0.091 + 0.5, 42);
      min = Math.min(min, v);
      max = Math.max(max, v);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
    // E USA o intervalo: nao e um ruido timido.
    expect(max).toBeGreaterThan(0.5);
    expect(min).toBeLessThan(-0.5);
  });

  it('e continuo: passos pequenos dao diferencas pequenas', () => {
    for (let i = 0; i < 500; i++) {
      const x = i * 0.37;
      const y = i * 0.11;
      expect(Math.abs(perlin2(x + 0.001, y, 3) - perlin2(x, y, 3))).toBeLessThan(0.01);
    }
  });
});

describe('fbm', () => {
  it('fica em [-1, 1], e o [0, 1] e a versao deslocada', () => {
    for (let i = 0; i < 1000; i++) {
      const v = fbm2(i * 0.213, i * 0.077, 7);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
      const u = fbm01(i * 0.213, i * 0.077, 7);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(u).toBeCloseTo(0.5 + 0.5 * v, 9);
    }
  });

  it('mais oitavas, mais detalhe: a variacao em passo curto cresce', () => {
    let rough1 = 0;
    let rough4 = 0;
    for (let i = 0; i < 400; i++) {
      const x = i * 0.05;
      rough1 += Math.abs(fbm2(x + 0.05, 0.5, 11, 1) - fbm2(x, 0.5, 11, 1));
      rough4 += Math.abs(fbm2(x + 0.05, 0.5, 11, 4) - fbm2(x, 0.5, 11, 4));
    }
    expect(rough4).toBeGreaterThan(rough1);
  });
});

describe('o contorno irregular', () => {
  it('fica dentro de [1 - amount, 1 + amount], fecha, e evolui com o tempo', () => {
    for (let a = 0; a <= Math.PI * 2; a += 0.05) {
      const f = blobRadius(a, 0.3, 21, 0.25);
      expect(f).toBeGreaterThanOrEqual(0.75);
      expect(f).toBeLessThanOrEqual(1.25);
    }
    expect(blobRadius(0, 0.3, 21, 0.25)).toBeCloseTo(blobRadius(Math.PI * 2, 0.3, 21, 0.25), 9);
    expect(blobRadius(1, 0, 21, 0.25)).not.toBe(blobRadius(1, 0.5, 21, 0.25));
    // Nao e um circulo: ha angulos com raio diferente.
    const radii = new Set<number>();
    for (let a = 0; a < Math.PI * 2; a += 0.5)
      radii.add(Math.round(blobRadius(a, 0, 21, 0.25) * 1000));
    expect(radii.size).toBeGreaterThan(3);
  });
});
