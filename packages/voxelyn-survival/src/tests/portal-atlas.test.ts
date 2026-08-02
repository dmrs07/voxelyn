// O contrato entre os portais e o atlas world-props.
//
// Todo par estrato x ocupacao que a sim pode sortear precisa resolver para um
// frame que EXISTE no atlas — um portal ausente cairia no `descent` generico
// sem ninguem notar, e o bioma perderia justamente o objeto que o jogador
// mais procura. O poco selado da extracao de retorno entra no mesmo contrato.
import { describe, expect, it } from 'vitest';
import propManifest from '@voxelyn/survival-content/assets/atlases/world-props.json';
import type { OccupationId, StratumId } from '@voxelyn/survival-sim';
import { entryAtlasChain, objectiveAtlasChain, portalKeyFor } from '../client/objective-prop';

const STRATA: StratumId[] = [
  'basalt', 'prismatic', 'aquifer', 'sulfur', 'furnace', 'silica', 'glacial', 'ferric',
];
const OCCUPATIONS: OccupationId[] = ['none', 'mycelial', 'aurix'];

type ManifestKind = { name: string; frames: number };
const kinds = (propManifest as { kinds: ManifestKind[] }).kinds;
const byName = new Map(kinds.map((k) => [k.name, k]));

describe('portais no atlas world-props', () => {
  it('todo par estrato x ocupacao resolve para um portal ANIMADO que existe', () => {
    for (const stratum of STRATA) {
      for (const occupation of OCCUPATIONS) {
        const name = `portal:${portalKeyFor(stratum, occupation)}`;
        const kind = byName.get(name);
        expect(kind, `${name} ausente do atlas`).toBeDefined();
        // Animado: a cruz-guia convergente e o proprio significado de
        // "transporte" — um frame parado nao diz "entre".
        expect(kind!.frames, `${name} deveria animar`).toBe(6);
      }
    }
  });

  it('o poco selado existe, parado — tampa nao anima', () => {
    const sealed = byName.get('portal:sealed');
    expect(sealed).toBeDefined();
    expect(sealed!.frames).toBe(1);
  });

  it('toda cadeia de desenho termina num fallback que tambem existe no atlas', () => {
    for (const stratum of STRATA) {
      for (const occupation of OCCUPATIONS) {
        for (const coreTaken of [false, true]) {
          for (const sector of [1, 2, 3]) {
            const chains = [
              objectiveAtlasChain(sector, coreTaken, stratum, occupation),
              entryAtlasChain(sector, coreTaken, stratum, occupation),
            ];
            for (const chain of chains) {
              expect(chain.length).toBeGreaterThan(0);
              for (const name of chain) {
                expect(byName.has(name), `${name} nao existe no atlas`).toBe(true);
              }
            }
          }
        }
      }
    }
  });
});
