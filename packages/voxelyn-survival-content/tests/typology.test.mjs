// A prancha de tipologia (docs/prospector) é gerada do modelo, mas a tabela que
// diz QUAIS caixas formam cada peça vive no gerador e endereça por índice. Este
// teste é o que impede a tabela de sair de fase com o Prospector em silêncio:
// uma caixa nova, removida ou reordenada em `prospectorParts` faz `buildTypology`
// abortar, e o CI reclama antes de alguém levar uma prancha errada para a
// impressora.
import { describe, expect, it } from 'vitest';

import { buildTypology } from '../tools/typology.mjs';

describe('tipologia do Prospector', () => {
  const { parts, pieces, all, env } = buildTypology({ tiles: false });

  it('cataloga TODA caixa do modelo, uma única vez', () => {
    const catalogued = pieces.flatMap((p) => p.instances.flat());
    expect(catalogued).toHaveLength(all.length);
    // Uma caixa em duas peças passaria na contagem e mentiria na prancha.
    expect(new Set(catalogued).size).toBe(all.length);
  });

  it('mantém as camadas de runtime coerentes com as três do atlas', () => {
    for (const p of pieces) {
      for (const boxes of p.instances) {
        for (const b of boxes) expect(parts[p.layer]).toContain(b);
      }
    }
  });

  it('conta duas instâncias exatamente das peças espelhadas', () => {
    const pares = pieces.filter((p) => p.count > 1).map((p) => p.id);
    expect(pares.sort()).toEqual(['canela', 'coxa', 'jarrete', 'ombreira', 'pe']);
    for (const p of pieces) expect(p.count).toBeLessThanOrEqual(2);
  });

  it('publica a feature mínima, e ela é o meio-passo', () => {
    // O meio-passo é a unidade de detalhe fino do modelo (MODEL_SCALE 2). Se a
    // menor aresta do bot descesse abaixo dela, a nota de impressão da prancha
    // — "0,5 u é a menor feature" — passaria a ser falsa.
    const menor = Math.min(...pieces.map((p) => p.minFeature));
    expect(menor).toBe(0.5);
  });

  it('mede o envelope no modelo, e ele cabe na altura de ficha', () => {
    expect(env).toEqual({ w: 7, d: 8.5, h: 15 });
  });
});
