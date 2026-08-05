import { describe, expect, it } from 'vitest';
import { surfaceModel, SURFACE_KINDS } from '../tools/surfaces.mjs';
import { VARIANTS } from '../tools/terrain.mjs';

const airborne = (boxes) => boxes.filter((b) => b.z >= 3);

describe('contrato visual das materias organicas e volateis', () => {
  it('preserva os IDs antigos e acrescenta os novos no fim', () => {
    expect(SURFACE_KINDS.map((kind) => kind.name)).toEqual([
      'bare',
      'fungal',
      'biofluid',
      'gas',
      'fire',
      'scorched',
      'spores',
      'fungal-heated',
      'water',
      'ember',
      'ice',
      'rail',
      'rail-v',
      'silt',
      'glass',
    ]);
  });

  // As duas crostas dos Sumidouros significam coisas OPOSTAS — a areia e por
  // onde o Devorador anda por baixo, o vidro e onde ele nao pode emergir — e o
  // jogador decide correndo. Se elas convergirem em valor, a decisao vira
  // adivinhacao. O vidro tambem nao pode se confundir com o gelo, que e a outra
  // placa clara do jogo e derrete em vez de selar.
  it('separa silica, vidro e gelo por altura e por familia de cor', () => {
    for (let variant = 0; variant < VARIANTS; variant++) {
      const silt = surfaceModel('silt', variant, 0);
      const glass = surfaceModel('glass', variant, 0);
      const ice = surfaceModel('ice', variant, 0);

      // Silica e SOLTA: tem crista acima do topo da laje. Vidro e placa lisa.
      const siltTop = Math.max(...silt.map((b) => b.z + b.h));
      const glassTop = Math.max(...glass.map((b) => b.z + b.h));
      expect(siltTop, `silt v${variant}`).toBeGreaterThan(glassTop);

      // Areia e quente; vidro e gelo sao frios, e o vidro e o mais claro.
      expect(silt.some((b) => b.mat === 'silt')).toBe(true);
      expect(silt.every((b) => b.mat !== 'glass' && b.mat !== 'ice')).toBe(true);
      expect(glass.some((b) => b.mat === 'glass')).toBe(true);
      expect(ice.every((b) => b.mat !== 'glass')).toBe(true);
    }
  });

  it('esporos formam uma nuvem verde suspensa, nunca enxofre', () => {
    for (let variant = 0; variant < VARIANTS; variant++) {
      for (let frame = 0; frame < 4; frame++) {
        const cloud = airborne(surfaceModel('spores', variant, frame));
        expect(cloud.length, `spores v${variant} f${frame}`).toBeGreaterThanOrEqual(3);
        expect(cloud.length, `spores v${variant} f${frame}`).toBeLessThanOrEqual(16);
        expect(cloud.every((b) => b.mat === 'fungus' || b.mat === 'fungusDeep')).toBe(true);
        expect(cloud.every((b) => b.z >= 3 && b.z + b.h - 1 <= 6)).toBe(true);
      }
    }
  });

  it('gas continua amarelo-enxofre e nao usa a materia dos esporos', () => {
    for (let variant = 0; variant < VARIANTS; variant++) {
      for (let frame = 0; frame < 4; frame++) {
        const cloud = airborne(surfaceModel('gas', variant, frame));
        expect(cloud.length).toBeGreaterThan(0);
        expect(cloud.every((b) => b.mat === 'sulfur')).toBe(true);
      }
    }
  });

  it('fungo aquecido ainda e tapete, mas mostra ilhas secas antes do fogo', () => {
    for (let variant = 0; variant < VARIANTS; variant++) {
      for (let frame = 0; frame < 2; frame++) {
        const boxes = surfaceModel('fungal-heated', variant, frame);
        const cover = boxes.filter((b) => b.z >= 1);
        expect(cover.length).toBeGreaterThan(30);
        expect(cover.some((b) => b.mat === 'rust')).toBe(true);
        expect(cover.some((b) => b.mat === 'fungusDeep' || b.mat === 'fungus')).toBe(true);
        expect(cover.every((b) => b.mat !== 'fire' && b.mat !== 'blood')).toBe(true);
      }
    }
  });
});
