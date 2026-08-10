import { describe, expect, it } from 'vitest';
import { solidImpactPoint } from '../src/run';

/**
 * ONDE o projetil encosta na parede.
 *
 * Este ponto deixou de ser cosmetico: alem de posicionar o burst de plasma, ele
 * e o CENTRO da detonacao de um bolt explosivo, e o centro decide quais celulas
 * quebram e acendem. Um erro aqui nao e um clarao meio tile fora — e um buraco
 * diferente no mapa, num estado que entra no hash autoritativo.
 */

/** A celula em que um ponto cai. */
const cellOf = (p: { x: number; y: number }): [number, number] => [
  Math.floor(p.x),
  Math.floor(p.y),
];

describe('ponto de contato na parede', () => {
  it('entrada pela face oeste: o contato e na face, com a normal para fora', () => {
    const hit = solidImpactPoint(2.6, 5.5, 3.2, 5.5, 3, 5);
    expect(hit.x).toBeCloseTo(3, 6);
    expect(hit.y).toBeCloseTo(5.5, 6);
    expect([hit.nx, hit.ny]).toEqual([-1, 0]);
  });

  it('entrada pela face sul: idem no eixo vertical', () => {
    const hit = solidImpactPoint(5.5, 8.4, 5.5, 7.8, 5, 7);
    expect(hit.y).toBeCloseTo(8, 6);
    expect([hit.nx, hit.ny]).toEqual([0, 1]);
  });

  /**
   * A QUINA — o caso que este teste existe para fechar.
   *
   * Quando um sub-passo cruza a linha de x E a de y antes de terminar dentro da
   * celula solida, o projetil so esta DENTRO dela depois das duas travessias.
   * Tomar a primeira (o menor `t`) devolve um ponto que ainda esta na celula
   * VIZINHA — e vizinha costuma ser vazia, entao a detonacao abriria o buraco
   * um tile ao lado do lugar em que o tiro visivelmente bateu.
   *
   * A checagem nao e sobre o numero: e sobre a CELULA. O ponto de contato,
   * empurrado um fio para dentro ao longo do movimento, tem de cair na celula
   * com que o projetil colidiu.
   */
  it('entrada por quina: o contato cai na celula que de fato foi atingida', () => {
    const prevX = 0.9;
    const prevY = 0.5;
    const x = 1.3;
    const y = 1.3;
    const hit = solidImpactPoint(prevX, prevY, x, y, 1, 1);

    const nudge = 1e-6;
    const len = Math.hypot(x - prevX, y - prevY);
    const inside = {
      x: hit.x + ((x - prevX) / len) * nudge,
      y: hit.y + ((y - prevY) / len) * nudge,
    };
    expect(cellOf(inside)).toEqual([1, 1]);
  });

  /**
   * E a normal e a da face cruzada POR ULTIMO, que e a face por onde ele
   * realmente entrou. No caso acima a travessia final e a de y, entao o contato
   * e na face sul do bloco.
   */
  it('entrada por quina: a normal e a da ultima face cruzada', () => {
    const hit = solidImpactPoint(0.9, 0.5, 1.3, 1.3, 1, 1);
    expect([hit.nx, hit.ny]).toEqual([0, -1]);
  });

  it('quina no outro sentido: a ultima travessia e a de x', () => {
    // Agora x demora mais a cruzar que y.
    const hit = solidImpactPoint(0.5, 0.9, 1.3, 1.3, 1, 1);
    const nudge = 1e-6;
    const len = Math.hypot(0.8, 0.4);
    expect(cellOf({ x: hit.x + (0.8 / len) * nudge, y: hit.y + (0.4 / len) * nudge })).toEqual([1, 1]);
    expect([hit.nx, hit.ny]).toEqual([-1, 0]);
  });

  /**
   * Tiro que NASCE dentro da pedra (encostado na parede): nao ha travessia
   * nenhuma para medir, e a ultima posicao livre e o contato honesto.
   */
  it('nascido dentro do solido: devolve a ultima posicao livre', () => {
    const hit = solidImpactPoint(3.5, 5.5, 3.7, 5.5, 3, 5);
    expect(hit.x).toBeCloseTo(3.5, 6);
    expect(hit.y).toBeCloseTo(5.5, 6);
    expect([hit.nx, hit.ny]).toEqual([-1, 0]);
  });
});
