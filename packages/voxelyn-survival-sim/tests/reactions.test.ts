import { describe, expect, it } from 'vitest';
import {
  BUDGET_REACTING_CELLS,
  CELL_STEP_INTERVAL,
  FIRE_FUEL_TICKS,
  SOLID_CRYSTAL,
  SOLID_FRAGILE,
  SOLID_NONE,
  SOLID_ROCK,
  SURF_BIOFLUID,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_GAS,
  SURF_NONE,
} from '../src/constants';
import { breakSolid, explodeAt, setSurface, stepCells } from '../src/cells';
import { spawnEnemy } from '../src/entities';
import { createRun, resolveChainedEvents } from '../src/run';
import type { SemanticEvent, SurvivalState } from '../src/types';

/** Limpa um retangulo do mapa para cenario controlado. */
const clearArea = (state: SurvivalState, x0: number, y0: number, x1: number, y1: number): void => {
  const w = state.config.width;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      state.solid[y * w + x] = SOLID_NONE;
      state.surface[y * w + x] = SURF_NONE;
      state.surfaceTimer[y * w + x] = 0;
    }
  }
};

const tickCells = (state: SurvivalState, events: SemanticEvent[], steps: number): void => {
  for (let s = 0; s < steps; s++) {
    state.tick += CELL_STEP_INTERVAL;
    stepCells(state, events);
  }
};

describe('reacoes sistemicas', () => {
  it('fogo se propaga pela vegetacao fungica e a consome', () => {
    const state = createRun({ seed: 7 });
    const w = state.config.width;
    clearArea(state, 40, 40, 60, 60);
    for (let y = 45; y <= 55; y++) {
      for (let x = 45; x <= 55; x++) {
        state.surface[y * w + x] = SURF_FUNGAL;
      }
    }
    const events: SemanticEvent[] = [];
    setSurface(state, 50 * w + 50, SURF_FIRE, FIRE_FUEL_TICKS);

    tickCells(state, events, 40);

    let _fungalLeft = 0;
    let scorchedOrFire = 0;
    for (let y = 45; y <= 55; y++) {
      for (let x = 45; x <= 55; x++) {
        const surf = state.surface[y * w + x];
        if (surf === SURF_FUNGAL) _fungalLeft++;
        else scorchedOrFire++;
      }
    }
    expect(scorchedOrFire).toBeGreaterThan(30); // a queimada se espalhou de verdade
  });

  it('gas de esporos inflama instantaneamente em contato com fogo', () => {
    const state = createRun({ seed: 7 });
    const w = state.config.width;
    clearArea(state, 20, 20, 30, 30);
    for (let x = 22; x <= 28; x++) state.surface[25 * w + x] = SURF_GAS;
    for (let x = 22; x <= 28; x++) state.surfaceTimer[25 * w + x] = 200;
    for (let x = 22; x <= 28; x++) state.reactionQueue.push(25 * w + x);

    const events: SemanticEvent[] = [];
    setSurface(state, 25 * w + 21, SURF_FIRE, FIRE_FUEL_TICKS);
    tickCells(state, events, 10);

    let fireCount = 0;
    for (let x = 22; x <= 28; x++) {
      if (state.surface[25 * w + x] === SURF_FIRE) fireCount++;
    }
    expect(fireCount).toBeGreaterThanOrEqual(5); // corrente de gas virou corrente de fogo
  });

  it('cristal quebrado descarrega pela poca de biofluido conectada e fere quem esta nela', () => {
    const state = createRun({ seed: 7 });
    const w = state.config.width;
    clearArea(state, 60, 60, 75, 66);
    // poca conectada de biofluido
    for (let x = 62; x <= 72; x++) state.surface[63 * w + x] = SURF_BIOFLUID;
    // cristal encostado na poca
    state.solid[63 * w + 61] = SOLID_CRYSTAL;
    // inimigo parado dentro da poca
    const enemy = spawnEnemy(state, 'bruiser', 70, 63, false);
    const hpBefore = enemy.hp;

    const events: SemanticEvent[] = [];
    const broke = breakSolid(state, 61, 63, events);
    expect(broke).toBe(true);
    resolveChainedEvents(state, events);

    expect(events.some((e) => e.t === 'discharge')).toBe(true);
    expect(enemy.hp).toBeLessThan(hpBefore);
  });

  // O cliente desfaz o bloco no material dele, e quando o evento chega a grade
  // ja mudou — sem `solid` no evento nao ha como saber o que caiu ali.
  it('anuncia o solido que caiu, com o material', () => {
    const state = createRun({ seed: 11 });
    const w = state.config.width;
    clearArea(state, 20, 20, 30, 26);
    state.solid[23 * w + 22] = SOLID_FRAGILE;
    state.solid[23 * w + 24] = SOLID_CRYSTAL;

    const events: SemanticEvent[] = [];
    expect(breakSolid(state, 22, 23, events)).toBe(true);
    expect(breakSolid(state, 24, 23, events)).toBe(true);

    const breaks = events.filter((e) => e.t === 'break') as Array<
      Extract<SemanticEvent, { t: 'break' }>
    >;
    expect(breaks.map((b) => b.solid)).toEqual([SOLID_FRAGILE, SOLID_CRYSTAL]);
    // Coordenada no CENTRO da celula: os cacos saem do meio do bloco, nao do
    // canto, senao o entulho nasce deslocado meio tile.
    expect(breaks[0]).toMatchObject({ x: 22.5, y: 23.5 });
  });

  it('nao anuncia quebra quando nada foi destruido', () => {
    const state = createRun({ seed: 12 });
    const w = state.config.width;
    clearArea(state, 40, 40, 46, 46);
    state.solid[43 * w + 43] = SOLID_ROCK;
    const events: SemanticEvent[] = [];
    expect(breakSolid(state, 43, 43, events)).toBe(false);
    expect(events.some((e) => e.t === 'break')).toBe(false);
  });

  it('explosao rompe rocha fragil e abre caminho', () => {
    const state = createRun({ seed: 7 });
    const w = state.config.width;
    clearArea(state, 10, 50, 20, 56);
    state.solid[53 * w + 15] = SOLID_FRAGILE;
    state.solid[53 * w + 16] = SOLID_FRAGILE;

    const events: SemanticEvent[] = [];
    explodeAt(state, 15.5, 53.5, 2.2, events);
    resolveChainedEvents(state, events);

    expect(state.solid[53 * w + 15]).toBe(SOLID_NONE);
    expect(state.solid[53 * w + 16]).toBe(SOLID_NONE);
    expect(events.some((e) => e.t === 'explosion')).toBe(true);
  });

  it('a fila de reacoes respeita o orcamento por passo (degradacao previsivel)', () => {
    const state = createRun({ seed: 7 });
    const w = state.config.width;
    // incendio muito maior que o orcamento
    const total = BUDGET_REACTING_CELLS + 2000;
    let placed = 0;
    outer: for (let y = 1; y < state.config.height - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        state.solid[i] = SOLID_NONE;
        state.surface[i] = SURF_FIRE;
        state.surfaceTimer[i] = 30000; // timer alto para medir quem foi processado
        state.reactionQueue.push(i);
        placed++;
        if (placed >= total) break outer;
      }
    }

    const events: SemanticEvent[] = [];
    state.tick = CELL_STEP_INTERVAL;
    stepCells(state, events);

    // apenas celulas processadas tiveram o timer decrementado
    let processed = 0;
    for (let i = 0; i < state.surface.length; i++) {
      if (state.surface[i] === SURF_FIRE && state.surfaceTimer[i] > 0 && state.surfaceTimer[i] < 30000) {
        processed++;
      }
    }
    expect(processed).toBeLessThanOrEqual(BUDGET_REACTING_CELLS);
    expect(processed).toBeGreaterThan(0);
    // o excedente permanece na fila para o proximo passo
    expect(state.reactionQueue.length).toBeGreaterThan(0);
  });
});
