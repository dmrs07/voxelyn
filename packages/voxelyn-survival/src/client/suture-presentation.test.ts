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

describe('apresentacao das suturas', () => {
  it('sem puxada, o apoio carregado ganha a marca da ancora mas nenhuma faixa', () => {
    const { state } = fixture();
    const items: { depth: number; draw: () => void }[] = [];
    const ctx = fakeContext();
    appendSutureDraws(ctx, state, items, project, 2, () => 1, 0);
    for (const item of items) item.draw();
    // A marca da ancora e um losango de quatro cantos fechado; a faixa seria um
    // preenchimento (`fill`), que nao existe sem acao.
    expect(ctx.calls.some((c) => c === 'closePath:')).toBe(true);
    expect(ctx.calls.some((c) => c.startsWith('fill:'))).toBe(false);
  });

  it('durante o preparo a faixa vai do corpo ao fim da puxada, com a largura do corpo', () => {
    const { state, queen } = fixture();
    startAction(state, queen, 'tether', { x: 0, y: -1 }, 24, 20, [], 0);
    state.tick = 112;
    const items: { depth: number; draw: () => void }[] = [];
    const ctx = fakeContext();
    appendSutureDraws(ctx, state, items, project, 2, () => 1, 0);
    for (const item of items) item.draw();
    // O destino e a segunda celula a partir da ancora `b`: (13.5, 12.5). As
    // bordas da faixa correm em x = 13.5 +- 0.72 ate la, em tela x10.
    expect(ctx.calls.some((c) => c === 'fill:')).toBe(true);
    const edge = ctx.calls.filter((c) => c.startsWith('lineTo:'));
    expect(edge.some((c) => c === 'lineTo:127.8,125.0')).toBe(true);
    expect(edge.some((c) => c === 'lineTo:142.2,125.0')).toBe(true);
  });

  it('no arranque a faixa continua, agora a partir de onde o corpo esta', () => {
    const { state, queen } = fixture();
    startAction(state, queen, 'tether', { x: 0, y: -1 }, 2, 20, [], 0);
    state.tick = 110;
    queen.action!.phase = 'recovery';
    queen.y = 16.5;
    const items: { depth: number; draw: () => void }[] = [];
    const ctx = fakeContext();
    appendSutureDraws(ctx, state, items, project, 2, () => 1, 0);
    for (const item of items) item.draw();
    expect(ctx.calls.some((c) => c === 'moveTo:127.8,165.0')).toBe(true);
    expect(ctx.calls.some((c) => c === 'lineTo:127.8,125.0')).toBe(true);
  });
});
