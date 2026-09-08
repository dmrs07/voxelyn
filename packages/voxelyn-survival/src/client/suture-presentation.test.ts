import { describe, expect, it } from 'vitest';
import { createRun, createSutures, spawnEnemy, startAction } from '@voxelyn/survival-sim';
import { SOLID_NONE, SOLID_SUTURE_ANCHOR } from '@voxelyn/survival-sim';
import type { SutureRecipe } from '@voxelyn/survival-sim';
import { appendSutureDraws } from './suture-presentation';

/** Um contexto que so conta o que foi pedido: a geometria e o que se testa. */
const fakeContext = () => {
  const calls: string[] = [];
  const noop = new Proxy(
    {},
    {
      get: (_t, key: string) => {
        if (key === 'calls') return calls;
        return (...args: unknown[]) => {
          calls.push(
            `${key}:${args.map((a) => (typeof a === 'number' ? a.toFixed(1) : String(a))).join(',')}`,
          );
        };
      },
      set: () => true,
    },
  );
  return noop as unknown as CanvasRenderingContext2D & { calls: string[] };
};

const fixture = () => {
  const state = createRun({ seed: 1, playerCount: 1 });
  state.solid.fill(SOLID_NONE);
  state.enemies = [];
  state.tick = 100;
  const w = state.config.width,
    cells = [10, 11, 12, 13, 14].map((x) => 12 * w + x);
  const recipe: SutureRecipe = {
    id: 0,
    a: cells[0] - 1,
    b: cells[4] + 1,
    cells,
    slabCells: [],
    kind: 'gate',
    objective: false,
  };
  state.solid[recipe.a] = state.solid[recipe.b] = SOLID_SUTURE_ANCHOR;
  state.sutures = createSutures([recipe]);
  state.sutures[0].phase = 'taut';
  state.sutures[0].tension = 100;
  const queen = spawnEnemy(state, 'seamstress', 12, 20, false);
  // Alinhada com a ancora `b`: com as duas ancoras na mesma linha, o rumo
  // (0, -1) empata as projecoes e `loadedSutureAnchor` escolhe `b`.
  queen.x = 13.5;
  queen.y = 20.5;
  queen.mood = 1;
  return { state, queen };
};

const project = (x: number, y: number): [number, number] => [x * 10, y * 10];

describe('apresentacao da amarra e do golpe', () => {
  it('sem acao nao desenha carga, fio ou perigo na camara', () => {
    const { state } = fixture();
    const items: { depth: number; draw: () => void }[] = [];
    appendSutureDraws(fakeContext(), state, items, project, 2, () => 1, 0);
    expect(items).toHaveLength(0);
  });
  it('o aviso marca somente o golpe e mantem a ancora escolhida durante o voo', () => {
    const { state, queen } = fixture();
    startAction(state, queen, 'tether', { x: 0, y: -1 }, 24, 30, [], 0);
    queen.action!.silkFlight = {
      fromX: queen.x,
      fromY: queen.y,
      toX: 13.5,
      toY: 12.5,
      landAt: 140,
      impactAt: 144,
      anchor: state.sutures[0].b,
    };
    const draw = () => {
      const ctx = fakeContext(),
        items: { depth: number; draw: () => void }[] = [];
      appendSutureDraws(ctx, state, items, project, 2, () => 1, 0);
      items.forEach((i) => i.draw());
      return ctx.calls;
    };
    const before = draw();
    // Radius 1.1 at the strike point: the needle reaches 1.6 beyond the landing.
    expect(before).toContain('moveTo:146.0,109.0');
    expect(before).toContain('lineTo:155.0,91.0'); // selected anchor B
    queen.x = 14;
    queen.y = 15;
    state.tick = 133;
    const flight = draw();
    expect(flight).toContain('moveTo:146.0,109.0');
    expect(flight).toContain('lineTo:155.0,91.0');
    state.tick = 144;
    expect(draw()).not.toContain('lineTo:155.0,91.0'); // released support after impact
  });
});
