import { describe, expect, it } from 'vitest';
import { SECTOR_COUNT } from '@voxelyn/survival-sim';
import {
  entryAtlasChain,
  objectiveAtlasChain,
  objectiveLightSpec,
  objectivePropName,
  portalKeyFor,
} from './objective-prop';

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

  it('o poco SELADO da subida nao convida: a luz dele apaga', () => {
    // Com o Nucleo na mao o poco recusa interacao (extracao de retorno);
    // mante-lo iluminado apontaria o jogador para um caminho que nao existe.
    for (let sector = 1; sector < SECTOR_COUNT; sector++) {
      expect(objectiveLightSpec(sector, true)).toBeNull();
    }
  });
});

describe('portais por bioma', () => {
  it('a ocupacao manda no flavor; sem ocupacao, o estrato', () => {
    expect(portalKeyFor('glacial', 'none')).toBe('glacial');
    expect(portalKeyFor('basalt', 'aurix')).toBe('aurix');
    expect(portalKeyFor('ferric', 'mycelial')).toBe('mycelial');
  });

  it('o poco fala o dialeto do bioma, com o descent generico de fallback', () => {
    expect(objectiveAtlasChain(1, false, 'basalt', 'none')).toEqual(['portal:basalt', 'descent']);
    expect(objectiveAtlasChain(2, false, 'ferric', 'aurix')).toEqual(['portal:aurix', 'descent']);
  });

  it('na subida o poco aparece SELADO — e o setor final segue sendo o Nucleo', () => {
    expect(objectiveAtlasChain(2, true, 'ferric', 'aurix')).toEqual(['portal:sealed', 'descent']);
    expect(objectiveAtlasChain(SECTOR_COUNT, false, 'glacial', 'none')).toEqual(['core']);
    expect(objectiveAtlasChain(SECTOR_COUNT, true, 'glacial', 'none')).toEqual(['coreTaken']);
  });

  it('a entrada vira portal de SUBIDA na volta — menos no setor 1, onde extrai', () => {
    expect(entryAtlasChain(2, true, 'silica', 'none')).toEqual(['portal:silica', 'extraction']);
    expect(entryAtlasChain(3, false, 'silica', 'none')).toEqual(['extraction']);
    expect(entryAtlasChain(1, true, 'basalt', 'none')).toEqual(['extraction']);
  });
});
