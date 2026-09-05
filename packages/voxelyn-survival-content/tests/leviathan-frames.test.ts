import { describe, expect, it } from 'vitest';
// @ts-expect-error - ferramenta JS sem tipos
import { renderVoxels } from '../tools/voxel.mjs';
// @ts-expect-error - ferramenta JS sem tipos
import { ENTITY_SPECS, LEVIATHAN_WING_RANKS, leviathanBodyPiece } from '../tools/entities.mjs';

type Grid = { w: number; h: number; buf: Uint8ClampedArray };
type Spec = {
  id: string;
  frameWidth: number;
  frameHeight: number;
  anchorX: number;
  anchorY: number;
  authoredDirs: string[];
};

const bounds = (g: Grid) => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.buf[(y * g.w + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, maxX, minY, maxY };
};

// O corpo do Leviata vive em dois atlas de oito rumos, e o quadro de cada um
// e o menor que enquadra as OITO rotacoes das suas pecas com 2px de margem. O
// gerador ja recusa um quadro que nao cabe; este teste diz, em pixels, quanto
// sobra — e cobra que a asa mais larga continue larga: e a largura, e nao o
// comprimento, que faz uma raia.
describe('os quadros das pecas do Leviata', () => {
  const specOf = (id: string): Spec => {
    const spec = (ENTITY_SPECS as Spec[]).find((s) => s.id === id);
    if (!spec) throw new Error(`spec ausente: ${id}`);
    return spec;
  };
  const ranksOf = (id: string): number[] =>
    id.endsWith('wings')
      ? [0, 1, 2, 3].slice(0, LEVIATHAN_WING_RANKS)
      : [4, 5, 6, 7].filter((r) => r >= LEVIATHAN_WING_RANKS);

  for (const id of ['part-sheet-leviathan-wings', 'part-sheet-leviathan-tail']) {
    it(`${id}: as oito rotacoes de cada posto cabem no quadro com 2px de margem`, () => {
      const spec = specOf(id);
      expect(spec.authoredDirs).toHaveLength(8);
      const W = 320;
      const H = 240;
      const AX = 160;
      const AY = 170;
      for (const rank of ranksOf(id)) {
        for (let dir = 0; dir < 8; dir++) {
          const b = bounds(renderVoxels(leviathanBodyPiece(rank), dir, W, H, AX, AY) as Grid);
          expect(b.minX).toBeGreaterThanOrEqual(AX - spec.anchorX + 2);
          expect(b.maxX).toBeLessThanOrEqual(AX + (spec.frameWidth - spec.anchorX) - 3);
          expect(b.maxY - b.minY + 1).toBeLessThanOrEqual(spec.frameHeight - 4);
        }
      }
    });
  }

  it('a raiz das asas tem mais de quatro tiles de vao', () => {
    // Vista de frente (`d`), o vao e a largura na tela: um tile e 32px.
    const b = bounds(renderVoxels(leviathanBodyPiece(1), 5, 320, 240, 160, 170) as Grid);
    expect(b.maxX - b.minX + 1).toBeGreaterThan(4 * 32);
  });
});
