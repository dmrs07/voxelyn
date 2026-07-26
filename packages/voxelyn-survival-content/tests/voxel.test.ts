import { describe, expect, it } from 'vitest';
// @ts-expect-error - ferramenta JS sem tipos
import { box, collapse, renderVoxels } from '../tools/voxel.mjs';
// @ts-expect-error - ferramenta JS sem tipos
import { fitSpriteToMargin, grid } from '../tools/lib.mjs';

type Grid = { w: number; h: number; buf: Uint8ClampedArray };

const countColor = (g: Grid, hex: string): number => {
  const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let n = 0;
  for (let i = 0; i < g.w * g.h; i++) {
    if (g.buf[i * 4 + 3] === 0) continue;
    if (g.buf[i * 4] === want[0] && g.buf[i * 4 + 1] === want[1] && g.buf[i * 4 + 2] === want[2]) n++;
  }
  return n;
};

const boundingBox = (g: Grid) => {
  let minX = g.w, minY = g.h, maxX = -1, maxY = -1;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.buf[(y * g.w + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
};

describe('rasterizador voxel', () => {
  // A camera enxerga as faces +x/+y, mas os modelos sao autorados com a frente
  // em -y. Sem a rotacao de base os seis personagens ficavam de costas em 'dr'
  // — a direcao em que andam PARA a camera — e visor, nucleo e fenda dos olhos
  // vazavam so pela aresta do topo. Nada detectava isso: o atlas era gerado,
  // validado e publicado com todo mundo virado ao contrario.
  it('mostra a face autorada como frente na direcao dr', () => {
    const model = [
      box(-2, -1, 0, 5, 3, 4, 'rock'),
      box(-2, -2, 1, 5, 1, 2, 'acid'), // frente autorada: -y
    ];
    const front = countColor(renderVoxels(model, 0, 32, 32, 14, 24) as Grid, '#a8e63c');
    const back = countColor(renderVoxels(model, 2, 32, 32, 14, 24) as Grid, '#a8e63c');
    // De frente a placa aparece inteira; de costas so a aresta do topo escapa.
    expect(front).toBeGreaterThan(back * 3);
  });

  it('gera as quatro direcoes a partir do mesmo modelo', () => {
    const model = [box(-2, -1, 0, 5, 3, 4, 'rock'), box(2, -1, 4, 1, 1, 2, 'loot')];
    const seen = new Set(
      [0, 1, 2, 3].map((d) => Buffer.from((renderVoxels(model, d, 32, 32, 14, 24) as Grid).buf).toString('base64'))
    );
    expect(seen.size).toBe(4);
  });
});

describe('collapse', () => {
  const body = [box(-2, -1, 0, 5, 3, 12, 'rock')];

  it('nao altera o modelo em t=0', () => {
    expect(collapse(body, 0)).toEqual(body);
  });

  it('achata e encolhe o volume ate virar entulho', () => {
    const intact = boundingBox(renderVoxels(body, 0, 48, 56, 22, 50) as Grid);
    const rubble = boundingBox(renderVoxels(collapse(body, 1), 0, 48, 56, 22, 50) as Grid);
    const tall = intact.maxY - intact.minY;
    // O monte tem de ficar BAIXO: sem isso a morte era o corpo inteiro afundando
    // com a silhueta intacta.
    expect(rubble.maxY - rubble.minY).toBeLessThan(tall / 2);
    // ...e nao mais largo que a criatura de pe, senao estoura o frame.
    expect(rubble.maxX - rubble.minX).toBeLessThanOrEqual(intact.maxX - intact.minX);
  });

  it('e deterministico: o mesmo modelo desaba sempre igual', () => {
    expect(collapse(body, 0.5)).toEqual(collapse(body, 0.5));
  });
});

describe('fitSpriteToMargin', () => {
  const stamp = (w: number, h: number, x0: number, y0: number, x1: number, y1: number): Grid => {
    const g = grid(w, h) as Grid;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * w + x) * 4;
        g.buf[i] = 255; g.buf[i + 1] = 255; g.buf[i + 2] = 255; g.buf[i + 3] = 255;
      }
    }
    return g;
  };

  it('aplica o MESMO deslocamento a todos os frames', () => {
    // Uma pose alta e uma pose agachada. Enquadrar frame a frame alinhava as
    // duas pela base e o agachamento sumia; o deslocamento comum preserva a
    // diferenca de altura, que e a propria informacao da animacao.
    const tall = stamp(32, 40, 10, 10, 20, 30);
    const crouched = stamp(32, 40, 10, 20, 20, 30);
    const [a, b] = fitSpriteToMargin([tall, crouched], 2) as Grid[];
    const boxA = boundingBox(a);
    const boxB = boundingBox(b);
    expect(boxB.minY - boxA.minY).toBe(10);
    expect(boxA.maxY).toBe(boxB.maxY);
  });

  it('lanca em vez de reescalar quando o conteudo nao cabe', () => {
    // Reescalar em silencio fazia o personagem mudar de tamanho no meio da
    // animacao. Um modelo grande demais e bug no modelo, nao algo a esconder.
    const oversized = stamp(32, 40, 0, 0, 31, 39);
    expect(() => fitSpriteToMargin([oversized], 2)).toThrow(/nao cabe/);
  });
});
