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

/**
 * Canvas de mentira que so anota onde as coisas foram desenhadas. O que este
 * teste mede e ALTURA, e altura aqui e a distancia entre o corpo do projetil e a
 * sombra dele no chao — nao ha pixel nenhum a conferir.
 */
const recordingCtx = (): { ctx: CanvasRenderingContext2D; bodies: number[]; shadows: number[] } => {
  const bodies: number[] = [];
  const shadows: number[] = [];
  const ctx = {
    globalAlpha: 1,
    fillStyle: '',
    fillRect: (_x: number, y: number) => { bodies.push(y); },
    beginPath: () => {},
    fill: () => {},
    arc: () => {},
    ellipse: (_x: number, y: number) => { shadows.push(y); },
    save: () => {},
    restore: () => {},
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, bodies, shadows };
};

describe('altura de voo', () => {
  const TILE_H = 16;
  const project = (x: number, y: number): [number, number] => [x * 32, y * TILE_H];

  const flightHeight = (hostile: boolean): number => {
    const view = new ProjectileView();
    const proj: ProjectileLike = { id: 1, x: 4, y: 4, hostile, kind: hostile ? 'spit' : 'bolt' };
    view.sync([proj], 0);
    const { ctx, bodies, shadows } = recordingCtx();
    view.draw(ctx, proj, project, 1, TILE_H);
    // A sombra fica no chao e o corpo, acima dela: a diferenca E a altura.
    return (Math.min(...shadows) - Math.min(...bodies)) / TILE_H;
  };

  it('faz o tiro do jogador sair na altura do cano, e nao da barriga', () => {
    // A arma esta montada a mais de um tile do chao; meio tile era a altura de
    // quem cospe do chao.
    expect(flightHeight(false)).toBeGreaterThan(1);
  });

  it('mantem o cuspe do inimigo rente ao chao', () => {
    expect(flightHeight(true)).toBeLessThan(1);
    expect(flightHeight(true)).toBeLessThan(flightHeight(false));
  });
});
