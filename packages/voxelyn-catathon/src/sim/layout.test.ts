import { describe, expect, it } from 'vitest';
import { LAYOUTS } from './gen.js';

/**
 * Regra do dono: o RACK nunca ocupa o espaco do quadro de planejamento.
 * O quadro e fixo na cena (x 204..278, y 92..150) e a roda de decisao vive
 * logo abaixo (ate y~170); o rack e um gabinete alto (caixa sx-13..sx+19,
 * sy-42..sy+4). Dois layouts ja violaram isto (server-corner, cubiculos).
 */
const BOARD = { x0: 204, x1: 278, y0: 92, y1: 170 };

describe('layouts curados', () => {
  it('o rack nunca colide com o quadro/roda de decisao', () => {
    for (const layout of LAYOUTS) {
      const rack = layout.slots.find((s) => s.id === 'rack')!;
      const rx0 = rack.x - 13;
      const rx1 = rack.x + 19;
      const ry0 = rack.y - 42;
      const ry1 = rack.y + 4;
      const collide = rx0 < BOARD.x1 && rx1 > BOARD.x0 && ry0 < BOARD.y1 && ry1 > BOARD.y0;
      expect(collide, `${layout.id}: rack em (${rack.x},${rack.y})`).toBe(false);
    }
  });
});
