import { describe, expect, it } from 'vitest';
import { advanceToNextFloor, createGameState } from '../game/state';

describe('spawn expanded', () => {
  it('does not spawn spore bombers in early floors', () => {
    const state = createGameState(9001);

    while (state.floorNumber < 3) {
      advanceToNextFloor(state);
    }

    const bombers = Array.from(state.level.entities.values()).filter(
      (entity) => entity.kind === 'enemy' && entity.archetype === 'spore_bomber'
    );

    expect(bombers.length).toBe(0);
  });

  it('spawns spore bombers on deeper floors over deterministic seed sweep', () => {
    let bomberCount = 0;

    for (let seed = 0; seed < 12; seed += 1) {
      const state = createGameState(10000 + seed * 1337);
      while (state.floorNumber < 9) {
        advanceToNextFloor(state);
      }

      bomberCount += Array.from(state.level.entities.values()).filter(
        (entity) => entity.kind === 'enemy' && entity.archetype === 'spore_bomber'
      ).length;
    }

    expect(bomberCount).toBeGreaterThan(0);
  });
});
