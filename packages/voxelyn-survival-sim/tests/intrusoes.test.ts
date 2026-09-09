import { describe, expect, it } from 'vitest';
import { INTRUSION_SHARE, lineageOf, sectorBiome } from '../src/strata';

// AS INTRUSOES BALANCEADAS. Medido antes: micelio 22%, Aurix 25%, rocha
// suturada 8% de todos os setores — a seda sobrevivia de um sorteio de 12%.
// Estes testes prendem o balanco novo: a mesma chance para as tres num setor
// sem ocupacao, a ocupacao de casa fora do sorteio no meio da descida, e o
// setor final sorteando as tres.
const SEEDS = 6000;
const count = (sector: number, filter: (lineage: string) => boolean) => {
  const tally = { none: 0, mycelial: 0, aurix: 0, stitchers: 0, n: 0 };
  for (let seed = 0; seed < SEEDS; seed++) {
    if (!filter(lineageOf(seed))) continue;
    const biome = sectorBiome(seed, sector);
    tally[biome.occupation]++;
    tally.n++;
  }
  return tally;
};

describe('intrusoes de ocupacao', () => {
  it('num setor sem ocupacao em casa, as tres intrusoes tem a mesma chance', () => {
    // A basaltica nao tem ocupacao em casa: o sorteio e o puro 18/18/18.
    const t = count(4, (l) => l === 'basaltic');
    expect(t.n).toBeGreaterThan(400);
    for (const occ of ['mycelial', 'aurix', 'stitchers'] as const) {
      const share = (100 * t[occ]) / t.n;
      expect(share, occ).toBeGreaterThan(INTRUSION_SHARE - 4);
      expect(share, occ).toBeLessThan(INTRUSION_SHARE + 4);
    }
  });

  it('no meio da descida a ocupacao de casa sai do sorteio, e a parte dela vai para as outras', () => {
    // A industrial tem Aurix em casa; o setor 7 (Poco Diamandis) e o unico
    // `none` dela, entao olha-se a hidrica no setor 2 (Aquifero Superior).
    const t = count(2, (l) => l === 'hydric');
    expect(t.mycelial).toBe(0);
    const aurix = (100 * t.aurix) / t.n,
      stitchers = (100 * t.stitchers) / t.n;
    expect(aurix).toBeGreaterThan(INTRUSION_SHARE * 1.5 - 5);
    expect(stitchers).toBeGreaterThan(INTRUSION_SHARE * 1.5 - 5);
  });

  it('o setor final sorteia as tres, mesmo na linhagem que tem uma delas em casa', () => {
    for (const lineage of ['hydric', 'industrial', 'mineral']) {
      const t = count(7, (l) => l === lineage);
      for (const occ of ['mycelial', 'aurix', 'stitchers'] as const)
        expect((100 * t[occ]) / t.n, `${lineage}/${occ}`).toBeGreaterThan(INTRUSION_SHARE - 5);
    }
  });

  it('o primeiro setor nunca recebe intrusao e a Fornalha nunca recebe micelio', () => {
    for (let seed = 0; seed < 500; seed++) {
      expect(sectorBiome(seed, 1).occupation).toBe('none');
      for (let sector = 2; sector <= 7; sector++) {
        const b = sectorBiome(seed, sector);
        if (b.stratum === 'furnace') expect(b.occupation).not.toBe('mycelial');
      }
    }
  });
});
