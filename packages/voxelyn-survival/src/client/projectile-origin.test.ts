// A ORIGEM DE DESENHO de um projetil, que nao e a posicao autoritativa dele.
//
// Perto da arma o tiro e desenhado saindo da BOCA — que fica um terco de tile a
// direita do eixo do bot —, e converge para a posicao real em pouco mais de um
// tile. O corpo ja fazia isso; o que este arquivo tranca e que TUDO o que pende
// dele faca junto. Rastro, cauda, serpente do sifao, sombra e halo saem todos
// da mesma funcao, porque cada um que reprojetasse a posicao crua ficaria para
// tras da propria bala nos primeiros quadros — que sao justamente os que o
// jogador esta olhando quando aperta o gatilho.

import { describe, expect, it } from 'vitest';
import { PROSPECTOR_MUZZLES } from '@voxelyn/survival-content';
import { ProjectileView } from './projectiles';
import { MUZZLE_SETTLE_TILES } from './combat-plane';

/** Um projetil do jogador andando para +x, ja com o rumo conhecido. */
const flying = (view: ProjectileView, kind: string, steps: number, step = 0.25) => {
  const shot = { id: 1, x: 0, y: 0, hostile: false, kind, vx: 1, vy: 0 } as never;
  view.sync([shot], 0);
  for (let i = 1; i <= steps; i++) {
    view.sync([{ ...(shot as object), x: i * step } as never], i * 16);
  }
  return { ...(shot as object), x: steps * step } as never;
};

describe('origem de desenho do projetil', () => {
  it('nasce na boca: deslocado para a DIREITA da trajetoria', () => {
    const view = new ProjectileView();
    // Andando para +x, a direita do mundo e +y — a mesma rotacao que leva o
    // eixo do corpo do modelo (-y) no lado direito dele (+x).
    const shot = flying(view, 'bolt', 0);
    const [x, y] = view.worldOrigin(shot);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(PROSPECTOR_MUZZLES.bolt.lateral, 6);
  });

  it('converge para a posicao AUTORITATIVA depois de assentar', () => {
    const view = new ProjectileView();
    const steps = Math.ceil(MUZZLE_SETTLE_TILES / 0.25) + 2;
    const shot = flying(view, 'bolt', steps);
    const [x, y] = view.worldOrigin(shot);
    // Convergir nao e enfeite: a colisao acontece na posicao autoritativa, e um
    // desvio permanente faria o tiro desenhado passar ao lado do que acerta.
    expect(x).toBeCloseTo(steps * 0.25, 6);
    expect(y).toBeCloseTo(0, 6);
  });

  it('a Minigun obedece a PROPRIA boca, que e outra', () => {
    const view = new ProjectileView();
    const [, y] = view.worldOrigin(flying(view, 'flechette', 0));
    expect(y).toBeCloseTo(PROSPECTOR_MUZZLES.minigun.lateral, 6);
    expect(PROSPECTOR_MUZZLES.minigun.lateral).not.toBe(PROSPECTOR_MUZZLES.bolt.lateral);
  });

  it('o que sai do CHAO nao tem boca e nao anda de lado', () => {
    const view = new ProjectileView();
    const spit = { id: 2, x: 3, y: 4, hostile: true, kind: 'spit', vx: 1, vy: 0 } as never;
    view.sync([spit], 0);
    expect(view.worldOrigin(spit)).toEqual([3, 4]);
  });

  it('sem rastro conhecido devolve a posicao crua, e nao um palpite', () => {
    // Um projetil que este cliente ainda nao viu: sem rumo nao ha "direita" da
    // trajetoria, e inventar uma poria o tiro do lado errado metade das vezes.
    const view = new ProjectileView();
    const unseen = { id: 9, x: 1, y: 2, hostile: false, kind: 'bolt' } as never;
    expect(view.worldOrigin(unseen)).toEqual([1, 2]);
  });

  it('o desvio so encolhe ao longo do voo', () => {
    const view = new ProjectileView();
    const shot = { id: 3, x: 0, y: 0, hostile: false, kind: 'bolt', vx: 1, vy: 0 } as never;
    view.sync([shot], 0);
    let previous = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= 10; i++) {
      const moved = { ...(shot as object), x: i * 0.15 } as never;
      view.sync([moved], i * 16);
      const [, y] = view.worldOrigin(moved);
      expect(y).toBeLessThanOrEqual(previous + 1e-9);
      previous = y;
    }
  });
});
