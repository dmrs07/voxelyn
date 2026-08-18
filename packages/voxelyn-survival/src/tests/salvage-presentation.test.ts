import { describe, expect, it } from 'vitest';
import {
  cachePropChain,
  cachePropFor,
  choiceSourceTier,
  dataIntegrityPercent,
  moduleTierOf,
  romanTier,
  type CacheTier,
} from '../client/salvage-presentation';
import { MODULE_DEFINITIONS, type ModuleId, type SalvageSite } from '@voxelyn/survival-sim';
import propManifest from '@voxelyn/survival-content/assets/atlases/world-props.json';

type ManifestKind = { name: string; frames: number };
const kinds = (propManifest as { kinds: ManifestKind[] }).kinds;
const propKindIndex = (name: string): number => kinds.findIndex((k) => k.name === name);

describe('mapa de props do cofre por classe', () => {
  it('cobre todas as combinacoes classe × estado', () => {
    expect(cachePropFor(1, false)).toBe('salvageCache');
    expect(cachePropFor(1, true)).toBe('salvageCacheOpened');
    expect(cachePropFor(2, false)).toBe('salvageCacheT2');
    expect(cachePropFor(2, true)).toBe('salvageCacheT2Opened');
    expect(cachePropFor(3, false)).toBe('salvageCacheT3');
    expect(cachePropFor(3, true)).toBe('salvageCacheT3Opened');
  });

  it('todo prop mapeado existe no atlas gerado', () => {
    for (const tier of [1, 2, 3] as CacheTier[]) {
      for (const opened of [false, true]) {
        const name = cachePropFor(tier, opened);
        expect(propKindIndex(name), name).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('a cadeia de fallback termina sempre na classe I do mesmo estado', () => {
    expect(cachePropChain(1, false)).toEqual(['salvageCache']);
    expect(cachePropChain(2, false)).toEqual(['salvageCacheT2', 'salvageCache']);
    expect(cachePropChain(3, true)).toEqual(['salvageCacheT3Opened', 'salvageCacheOpened']);
    for (const tier of [2, 3] as CacheTier[]) {
      for (const opened of [false, true]) {
        const chain = cachePropChain(tier, opened);
        expect(chain).toHaveLength(2);
        for (const name of chain) {
          expect(propKindIndex(name), name).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe('tier de modulo e classe de origem', () => {
  it('o tier vem do catalogo da simulacao, nunca do cofre', () => {
    for (const id of Object.keys(MODULE_DEFINITIONS) as ModuleId[]) {
      expect(moduleTierOf(id)).toBe(MODULE_DEFINITIONS[id].tier);
    }
    expect(moduleTierOf('piercing')).toBe(1);
    expect(moduleTierOf('conductive')).toBe(2);
    expect(moduleTierOf('explosive')).toBe(3);
    expect(moduleTierOf('return_disc')).toBe(3);
  });

  it('resolve a classe do cofre de origem pelo sourceSiteId', () => {
    const site = (id: number, tier: CacheTier): SalvageSite => ({
      id,
      tier,
      terminal: { x: 0, y: 0 },
      cache: { x: 0, y: 0 },
      terminalState: 'complete',
      scanEndsAt: 0,
      cacheRevealed: true,
      cacheOpened: true,
      openedBySlot: 0,
    });
    const sites = [site(4, 1), site(9, 3), site(2, 2)];
    expect(choiceSourceTier(sites, 9)).toBe(3);
    expect(choiceSourceTier(sites, 2)).toBe(2);
    expect(choiceSourceTier(sites, 77)).toBeNull();
  });

  it('numera classes em romano, legivel em qualquer lingua', () => {
    expect(romanTier(1)).toBe('I');
    expect(romanTier(2)).toBe('II');
    expect(romanTier(3)).toBe('III');
  });

  it('integridade decorativa e deterministica e sempre alta', () => {
    for (let id = 0; id < 64; id++) {
      const percent = dataIntegrityPercent(id);
      expect(percent).toBe(dataIntegrityPercent(id));
      expect(percent).toBeGreaterThanOrEqual(86);
      expect(percent).toBeLessThanOrEqual(97);
    }
  });
});
