import { describe, expect, it } from 'vitest';
import { SECTOR_COUNT } from '@voxelyn/survival-sim';
import { objectiveLightSpec, objectivePropName } from './objective-prop';

describe('marcador de objetivo por setor', () => {
  it('usa o poco de descida em todo setor intermediario', () => {
    for (let sector = 1; sector < SECTOR_COUNT; sector++) {
      expect(objectivePropName(sector, false)).toBe('descent');
      // `coreTaken` nao deve transformar por engano um poco em berco vazio.
      expect(objectivePropName(sector, true)).toBe('descent');
    }
  });

  it('reserva core e coreTaken para o setor final', () => {
    for (const sector of [SECTOR_COUNT, SECTOR_COUNT + 1]) {
      expect(objectivePropName(sector, false)).toBe('core');
      expect(objectivePropName(sector, true)).toBe('coreTaken');
    }
  });

  it('mantem o poco legivel sem dar a ele o farol forte do Nucleo', () => {
    expect(objectiveLightSpec(1, false)).toEqual({ radius: 4.75, power: 0.62 });
    expect(objectiveLightSpec(SECTOR_COUNT, false)).toEqual({ radius: 6, power: 0.9 });
    expect(objectiveLightSpec(SECTOR_COUNT, true)).toBeNull();
  });
});
