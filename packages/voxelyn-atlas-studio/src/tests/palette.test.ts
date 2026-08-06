// A paleta do Studio e um ESPELHO da paleta mestra do gerador. Este teste
// importa os dois lados e falha se qualquer cor divergir — e o que mantem o
// espelho honesto quando a Art Bible ganhar/ajustar cores.
import { describe, expect, it } from 'vitest';
import {
  COLORS as GENERATOR_COLORS,
  ALLOWED_HEX as GENERATOR_ALLOWED,
} from '../../../voxelyn-survival-content/tools/lib.mjs';
import { ALLOWED_HEX, COLORS, MAX_ATLAS_COLORS } from '../palette';

describe('paleta veio-fungico', () => {
  it('espelha exatamente a paleta mestra do gerador', () => {
    expect(Object.keys(COLORS).sort()).toEqual(Object.keys(GENERATOR_COLORS).sort());
    for (const [name, rgb] of Object.entries(GENERATOR_COLORS as Record<string, number[]>)) {
      expect(COLORS[name], `cor ${name}`).toEqual(rgb);
    }
  });

  it('espelha o conjunto de hex permitidos', () => {
    expect([...ALLOWED_HEX].sort()).toEqual([...(GENERATOR_ALLOWED as Set<string>)].sort());
  });

  it('teto de cores por atlas casa com o validador do jogo', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../../voxelyn-survival-content/tools/validate.mjs', import.meta.url),
        'utf8',
      ),
    );
    const match = source.match(/MAX_ATLAS_COLORS = (\d+)/);
    expect(match).not.toBeNull();
    expect(MAX_ATLAS_COLORS).toBe(Number(match![1]));
  });
});
