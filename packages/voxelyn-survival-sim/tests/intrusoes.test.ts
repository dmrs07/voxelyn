import { describe, expect, it } from 'vitest';
import { INTRUSION_SHARE, lineageOf, sectorBiome } from '../src/strata';

// AS INTRUSOES BALANCEADAS. Medido antes: micelio 22%, Aurix 25%, rocha
// suturada 8% de todos os setores — a seda sobrevivia de um sorteio de 12%.
// Estes testes prendem o balanco novo: a mesma chance para as tres em todo
// setor sem ocupacao, sem olhar a linhagem, e a seda no topo das faixas.
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

  it('a ocupacao de casa NAO sai do sorteio: o bioma e funcao pura de (seed, setor)', () => {
    // A hidrica tem micelio em casa e a industrial tem Aurix; mesmo assim os
    // setores livres delas sorteiam as tres. Excluir a de casa exigiria saber
    // qual setor e o final (muda com a geracao), e o terreno de (seed, setor)
    // tem de ser o mesmo em qualquer geracao.
    for (const [lineage, sector] of [
      ['hydric', 2],
      ['industrial', 7],
      ['mineral', 4],
    ] as const) {
      const t = count(sector, (l) => l === lineage);
      expect(t.n).toBeGreaterThan(400);
      for (const occ of ['mycelial', 'aurix', 'stitchers'] as const) {
        const share = (100 * t[occ]) / t.n;
        expect(share, `${lineage}/${occ}`).toBeGreaterThan(INTRUSION_SHARE - 4);
        expect(share, `${lineage}/${occ}`).toBeLessThan(INTRUSION_SHARE + 4);
      }
    }
  });

  it('a rocha suturada fica no topo do sorteio: toda seed suturada de antes continua suturada', () => {
    // A faixa antiga era 88..99; a nova e 82..99. As seeds das fixtures (a
    // prancha e a arena da Cerzideira na 36, os testes dela na 66 e na 177)
    // continuam onde estavam.
    expect(sectorBiome(36, 7).occupation).toBe('stitchers');
    expect(sectorBiome(66, 3).occupation).toBe('stitchers');
    expect(sectorBiome(177, 3).occupation).toBe('stitchers');
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
