import { describe, expect, it } from 'vitest';
import {
  FUNGAL_HEAT_IMPACT_TICKS,
  FUNGAL_HEAT_TICKS,
  SOLID_NONE,
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
} from '../src/constants';
import { emptyCommand, stepRun } from '../src/run';
import { createRun } from '../src/run';
import type { Projectile } from '../src/types';

const thermalProjectile = (x: number, y: number): Projectile => ({
  id: 999,
  owner: 1,
  x,
  y,
  vx: 0,
  vy: 0,
  damage: 1,
  piercing: false,
  conductive: false,
  explosive: true,
  hostile: false,
  leavesBiofluid: false,
  ttl: 20,
});

describe('aquecimento fungico por projetil', () => {
  it('acelera uma celula apenas uma vez, apesar dos subpassos e ticks repetidos', () => {
    const state = createRun({ seed: 81 });
    state.vents = [];
    state.enemies = [];

    const x = 30;
    const y = 30;
    const i = y * state.config.width + x;
    state.solid[i] = SOLID_NONE;
    state.surface[i] = SURF_FUNGAL;
    state.projectiles = [thermalProjectile(x + 0.5, y + 0.5)];

    stepRun(state, [emptyCommand()]);
    expect(state.surface[i]).toBe(SURF_FUNGAL_HEATED);
    expect(state.surfaceTimer[i]).toBe(FUNGAL_HEAT_TICKS - FUNGAL_HEAT_IMPACT_TICKS);
    const afterFirstTick = state.surfaceTimer[i];

    // O mesmo projetil continua parado na mesma celula e executa mais dois
    // subpassos. Nao representa quatro novos impactos termicos.
    stepRun(state, [emptyCommand()]);
    expect(state.surface[i]).toBe(SURF_FUNGAL_HEATED);
    expect(state.surfaceTimer[i]).toBe(afterFirstTick);
  });

  it('permite que o mesmo projetil aqueça uma nova celula ao realmente entrar nela', () => {
    const state = createRun({ seed: 82 });
    state.vents = [];
    state.enemies = [];

    const ax = 30;
    const bx = 31;
    const y = 30;
    const a = y * state.config.width + ax;
    const b = y * state.config.width + bx;
    for (const i of [a, b]) {
      state.solid[i] = SOLID_NONE;
      state.surface[i] = SURF_FUNGAL;
    }
    state.projectiles = [thermalProjectile(ax + 0.5, y + 0.5)];

    stepRun(state, [emptyCommand()]);
    expect(state.surface[a]).toBe(SURF_FUNGAL_HEATED);

    state.projectiles[0].x = bx + 0.5;
    stepRun(state, [emptyCommand()]);
    expect(state.surface[b]).toBe(SURF_FUNGAL_HEATED);
    expect(state.surfaceTimer[b]).toBe(FUNGAL_HEAT_TICKS - FUNGAL_HEAT_IMPACT_TICKS);
  });
});
