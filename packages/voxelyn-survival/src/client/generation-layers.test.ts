// As camadas de geracao, conferidas pelo que elas PROMETEM ao cliente.
//
// O pacote de conteudo nao conhece `ProspectorGeneration` (ele so depende de
// `@voxelyn/core`), entao a lista de atlas la e literal. Este teste e quem
// paga por essa separacao: toda geracao da simulacao acima do G-00 precisa de
// uma camada assada, empilhada em ordem, e o G-00 — o co-op padronizado, toda
// primeira descida — nao pode carregar nenhuma.

import { describe, expect, it } from 'vitest';
import { SECTORS_BY_GENERATION, type ProspectorGeneration } from '@voxelyn/survival-sim';
import { GENERATION_LAYER_SPRITE_IDS, generationLayerSpriteIds } from '@voxelyn/survival-content';

const GENERATIONS = Object.keys(SECTORS_BY_GENERATION) as ProspectorGeneration[];

describe('cobertura de arte das geracoes', () => {
  it('toda geracao acima do G-00 empilha uma camada a mais que a anterior', () => {
    let previous: readonly string[] = [];
    for (const generation of GENERATIONS) {
      const layers = generationLayerSpriteIds(generation);
      if (generation === 'G-00') {
        expect(layers).toEqual([]);
      } else {
        expect(layers.length, generation).toBe(previous.length + 1);
        // Acumulo: as camadas de antes continuam, na mesma ordem.
        expect(layers.slice(0, previous.length)).toEqual(previous);
        expect(GENERATION_LAYER_SPRITE_IDS).toContain(layers[layers.length - 1]);
      }
      previous = layers;
    }
  });

  it('nenhum atlas sobrando para uma geracao que nao existe', () => {
    const last = GENERATIONS[GENERATIONS.length - 1];
    expect([...generationLayerSpriteIds(last)]).toEqual([...GENERATION_LAYER_SPRITE_IDS]);
  });

  it('uma etiqueta desconhecida e o chassi de fabrica', () => {
    expect(generationLayerSpriteIds('G-99')).toEqual([]);
    expect(generationLayerSpriteIds('')).toEqual([]);
  });
});
