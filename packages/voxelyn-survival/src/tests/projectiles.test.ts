import { describe, expect, it } from 'vitest';
import { ProjectileView, type ProjectileLike } from '../client/projectiles';

type Track = { x: number; y: number; dx: number; dy: number };
const tracks = (view: ProjectileView): Map<number, Track> =>
  (view as unknown as { tracks: Map<number, Track> }).tracks;

const shot = (id: number, x: number, y: number, hostile = false): ProjectileLike => ({ id, x, y, hostile });

describe('rastreio de projeteis', () => {
  it('deriva a direcao do movimento entre quadros', () => {
    const view = new ProjectileView();
    view.sync([shot(1, 10, 10)], 0);
    view.sync([shot(1, 12, 10)], 16);
    const t = tracks(view).get(1)!;
    expect(t.dx).toBeCloseTo(1);
    expect(t.dy).toBeCloseTo(0);
  });

  it('mantem a ultima direcao quando o projetil nao anda entre quadros', () => {
    const view = new ProjectileView();
    view.sync([shot(1, 10, 10)], 0);
    view.sync([shot(1, 10, 12)], 16);
    // Mesmo tick servido duas vezes: sem esta guarda a direcao zeraria e o
    // rastro colapsaria, piscando a cada quadro repetido.
    view.sync([shot(1, 10, 12)], 32);
    const t = tracks(view).get(1)!;
    expect(t.dy).toBeCloseTo(1);
  });

  // Ids sao reciclados pela simulacao. Sem limpar os que sumiram, um tiro novo
  // herdava a direcao do tiro anterior de mesmo id — e saia com o rastro
  // apontando para o lado errado no primeiro quadro.
  it('esquece projeteis que sairam de cena', () => {
    const view = new ProjectileView();
    view.sync([shot(1, 10, 10)], 0);
    view.sync([shot(1, 14, 10)], 16);
    expect(tracks(view).get(1)!.dx).toBeCloseTo(1);

    view.sync([], 32); // acertou algo e sumiu
    expect(tracks(view).size).toBe(0);

    // id 1 reaproveitado por um tiro em outra direcao
    view.sync([shot(1, 50, 50)], 48);
    view.sync([shot(1, 50, 54)], 64);
    const t = tracks(view).get(1)!;
    expect(t.dx).toBeCloseTo(0);
    expect(t.dy).toBeCloseTo(1);
  });

  it('nao vaza memoria ao longo de muitos tiros', () => {
    const view = new ProjectileView();
    for (let i = 0; i < 500; i++) view.sync([shot(i, i, i)], i * 16);
    expect(tracks(view).size).toBe(1);
    view.clear();
    expect(tracks(view).size).toBe(0);
  });

  it('acompanha varios projeteis ao mesmo tempo', () => {
    const view = new ProjectileView();
    view.sync([shot(1, 0, 0), shot(2, 20, 20)], 0);
    view.sync([shot(1, 0, 3), shot(2, 17, 20)], 16);
    expect(tracks(view).get(1)!.dy).toBeCloseTo(1);
    expect(tracks(view).get(2)!.dx).toBeCloseTo(-1);
  });
});
