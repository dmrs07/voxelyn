// Morfologia de borda: o contorno da caverna por estrato.
//
// O que estes testes cobram:
// 1. REFERENCIA: o basalto nao ganha contorno nenhum — a ausencia e a regua.
// 2. CONTORNO: parede sem face exposta ao vazio nao ganha detalhe; a Silica
//    poe os degraus NA face exposta, nao na escondida.
// 3. DETERMINISMO: mesmo indice de celula, mesmo detalhe — em qualquer
//    maquina e em qualquer quadro. E ha um portao de densidade: nem toda
//    celula tem detalhe, senao vira papel de parede.
// 4. HONESTIDADE: nenhuma cor de mentira — nada do biolum do cristal
//    reativo, nada do ouro de loot.
import { describe, expect, it } from 'vitest';
import type { StratumId } from '@voxelyn/survival-sim';
import { edgeDetailVoxels } from '../client/edge-detail';

const STRATA: StratumId[] = ['basalt', 'prismatic', 'aquifer', 'silica', 'sulfur', 'furnace', 'glacial'];

/** As duas cores que enfeite NUNCA pode vestir. */
const BIOLUM = '#59f2c2';
const LOOT = '#ffd166';

describe('morfologia de borda', () => {
  it('o basalto e a referencia: nenhum contorno, nunca', () => {
    for (let cell = 0; cell < 300; cell++) {
      expect(edgeDetailVoxels('basalt', cell, true, true)).toEqual([]);
    }
  });

  it('parede sem face exposta nao ganha detalhe em estrato nenhum', () => {
    for (const stratum of STRATA) {
      for (let cell = 0; cell < 100; cell++) {
        expect(edgeDetailVoxels(stratum, cell, false, false)).toEqual([]);
      }
    }
  });

  it('e deterministico por celula, e o portao de densidade respira', () => {
    for (const stratum of STRATA.filter((s) => s !== 'basalt')) {
      let withDetail = 0;
      for (let cell = 0; cell < 400; cell++) {
        const a = edgeDetailVoxels(stratum, cell, true, true);
        expect(edgeDetailVoxels(stratum, cell, true, true)).toEqual(a);
        if (a.length > 0) withDetail++;
      }
      // Nem deserto nem papel de parede: uma fracao com detalhe, uma sem.
      expect(withDetail).toBeGreaterThan(100);
      expect(withDetail).toBeLessThan(350);
    }
  });

  it('os degraus da Silica moram na face EXPOSTA', () => {
    for (let cell = 0; cell < 400; cell++) {
      const rightOnly = edgeDetailVoxels('silica', cell, true, false);
      for (const v of rightOnly) expect(v.dx).toBeGreaterThan(0);
      const leftOnly = edgeDetailVoxels('silica', cell, false, true);
      for (const v of leftOnly) expect(v.dx).toBeLessThan(0);
    }
  });

  it('nenhuma cor de mentira: sem biolum reativo, sem ouro de loot', () => {
    for (const stratum of STRATA) {
      for (let cell = 0; cell < 200; cell++) {
        for (const v of edgeDetailVoxels(stratum, cell, true, true)) {
          for (const color of v.ramp) {
            expect(color.toLowerCase()).not.toBe(BIOLUM);
            expect(color.toLowerCase()).not.toBe(LOOT);
          }
        }
      }
    }
  });
});
