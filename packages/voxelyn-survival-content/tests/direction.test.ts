import { describe, expect, it } from 'vitest';
// @ts-expect-error - ferramenta JS sem tipos
import { box, renderVoxels } from '../tools/voxel.mjs';

type Grid = { w: number; h: number; buf: Uint8ClampedArray };

const colorCentroid = (g: Grid, hex: string): { x: number; y: number } => {
  const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const i = (y * g.w + x) * 4;
      if (g.buf[i] === want[0] && g.buf[i + 1] === want[1] && g.buf[i + 2] === want[2] && g.buf[i + 3] > 0) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }
  if (count === 0) throw new Error(`cor ausente no frame: ${hex}`);
  return { x: sumX / count, y: sumY / count };
};

describe('direcoes voxel isometricas', () => {
  it('projeta a frente autorada no mesmo quadrante da direcao de movimento', () => {
    // Os modelos sao autorados olhando para -y. O marcador representa a frente
    // e precisa cair no quadrante visual correspondente a dr/dl/ur/ul.
    const frontMarker = [box(0, -4, 0, 1, 1, 1, 'acid')];
    const anchor = 24;
    const centroids = [0, 1, 2, 3].map((dir) =>
      colorCentroid(renderVoxels(frontMarker, dir, 48, 48, anchor, anchor) as Grid, '#a8e63c')
    );

    expect(centroids[0].x).toBeGreaterThan(anchor); // dr: direita/baixo
    expect(centroids[0].y).toBeGreaterThan(anchor);
    expect(centroids[1].x).toBeLessThan(anchor); // dl: esquerda/baixo
    expect(centroids[1].y).toBeGreaterThan(anchor);
    expect(centroids[2].x).toBeGreaterThan(anchor); // ur: direita/cima
    expect(centroids[2].y).toBeLessThan(anchor);
    expect(centroids[3].x).toBeLessThan(anchor); // ul: esquerda/cima
    expect(centroids[3].y).toBeLessThan(anchor);
  });

  it('rejeita indices fora do contrato dr/dl/ur/ul', () => {
    expect(() => renderVoxels([], 4, 16, 16, 8, 8)).toThrow(/direcao voxel invalida/);
  });
});
