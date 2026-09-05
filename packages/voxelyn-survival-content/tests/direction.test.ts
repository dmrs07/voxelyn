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
      if (
        g.buf[i] === want[0] &&
        g.buf[i + 1] === want[1] &&
        g.buf[i + 2] === want[2] &&
        g.buf[i + 3] > 0
      ) {
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
      colorCentroid(renderVoxels(frontMarker, dir, 48, 48, anchor, anchor) as Grid, '#a8e63c'),
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

  it('projeta os quatro rumos intermediarios na horizontal e na vertical da tela', () => {
    // O mesmo marcador de frente, nos meios-passos: `r` cai a direita da
    // ancora na MESMA altura, `d` abaixo dela na MESMA coluna, e assim por
    // diante. E o que separa um rumo intermediario de um quadrante repetido.
    const frontMarker = [box(0, -4, 0, 1, 1, 1, 'acid')];
    const anchor = 24;
    const centroids = [4, 5, 6, 7].map((dir) =>
      colorCentroid(renderVoxels(frontMarker, dir, 48, 48, anchor, anchor) as Grid, '#a8e63c'),
    );
    // O marcador e um voxel de 2x2 finos girado 45 graus: a silhueta dele e
    // serrilhada em um voxel, e o centroide anda ate ~4px com isso.
    const level = 6;
    expect(centroids[0].x).toBeGreaterThan(anchor + 4); // r: direita
    expect(Math.abs(centroids[0].y - anchor)).toBeLessThan(level);
    expect(centroids[1].y).toBeGreaterThan(anchor + 2); // d: baixo
    expect(Math.abs(centroids[1].x - anchor)).toBeLessThan(level);
    expect(centroids[2].x).toBeLessThan(anchor - 4); // l: esquerda
    expect(Math.abs(centroids[2].y - anchor)).toBeLessThan(level);
    expect(centroids[3].y).toBeLessThan(anchor - 2); // u: cima
    expect(Math.abs(centroids[3].x - anchor)).toBeLessThan(level);
  });

  it('re-rasteriza o meio-passo sem furo: uma laje girada continua macica', () => {
    // Uma laje de 6x6 autorada girada 45 graus vira um losango na grade fina.
    // Se a reamostragem deixasse celulas vazias no interior, o topo mostraria
    // pixels transparentes DENTRO da silhueta: contamos o topo pintado contra
    // a area do losango projetado.
    const slab = [box(-3, -3, 0, 6, 6, 1, 'rock')];
    const g = renderVoxels(slab, 5, 96, 64, 48, 40) as Grid;
    // Um furo e um pixel transparente ENTRE dois pintados na mesma linha. A
    // borda serrilhada deixa alguns nas quinas (um voxel de degrau); o
    // interior de uma laje macica nao deixa nenhum — um furo por celula
    // perdida seriam dezenas por linha.
    let painted = 0;
    let gaps = 0;
    for (let y = 0; y < g.h; y++) {
      let first = -1;
      let last = -1;
      for (let x = 0; x < g.w; x++) {
        if (g.buf[(y * g.w + x) * 4 + 3] > 0) {
          painted++;
          if (first < 0) first = x;
          last = x;
        }
      }
      for (let x = first; first >= 0 && x <= last; x++) {
        if (g.buf[(y * g.w + x) * 4 + 3] === 0) gaps++;
      }
    }
    // A laje reta pinta 792px; a girada tem a mesma area de topo.
    expect(painted).toBeGreaterThan(700);
    expect(gaps).toBeLessThan(painted * 0.03);
  });

  it('rejeita indices fora do contrato dos oito rumos', () => {
    expect(() => renderVoxels([], 8, 16, 16, 8, 8)).toThrow(/direcao voxel invalida/);
  });
});
