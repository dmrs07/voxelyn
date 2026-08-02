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
    ]);
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
