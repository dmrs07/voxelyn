import { describe, expect, it } from 'vitest';
import {
  CELL_STEP_INTERVAL,
  FUNGAL_HEAT_IMPACT_TICKS,
  SOLID_NONE,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
} from '../src/constants';
import { explodeAt, heatFungalCell, stepCells } from '../src/cells';
import { createRun } from '../src/run';
import type { SemanticEvent } from '../src/types';

describe('secagem repetida do tapete fungico', () => {
  it('uma segunda explosao acelera a secagem sem pular direto para fogo', () => {
    const state = createRun({ seed: 43 });
    state.vents = [];
    state.reactionQueue = [];

    const x = 30;
    const y = 30;
    const i = y * state.config.width + x;
    state.solid[i] = SOLID_NONE;
    state.surface[i] = SURF_FUNGAL;

    expect(heatFungalCell(state, i, true)).toBe(true);
    expect(state.surface[i]).toBe(SURF_FUNGAL_HEATED);
    const beforeSecondHeat = state.surfaceTimer[i];

    const events: SemanticEvent[] = [];
    explodeAt(state, x + 0.5, y + 0.5, 0.4, events);

    expect(state.surface[i]).toBe(SURF_FUNGAL_HEATED);
    expect(state.surfaceTimer[i]).toBe(
      Math.max(CELL_STEP_INTERVAL, beforeSecondHeat - FUNGAL_HEAT_IMPACT_TICKS)
    );
    expect(events.some((event) => event.t === 'ignite')).toBe(false);

    const remaining = state.surfaceTimer[i];
    for (let elapsed = CELL_STEP_INTERVAL; elapsed < remaining; elapsed += CELL_STEP_INTERVAL) {
      state.tick += CELL_STEP_INTERVAL;
      stepCells(state, events);
      expect(state.surface[i]).toBe(SURF_FUNGAL_HEATED);
    }

    state.tick += CELL_STEP_INTERVAL;
    stepCells(state, events);
    expect(state.surface[i]).toBe(SURF_FIRE);
    expect(events.some((event) => event.t === 'ignite')).toBe(true);
  });
});
