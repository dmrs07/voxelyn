import { describe, expect, it } from 'vitest';
import { createGameState } from '../game/state';
import { isPassableMaterial } from '../world/materials';
import { materialAt } from '../world/level';

describe('spawn', () => {
  it('spawns enemies only in passable cells with minimum entry distance', () => {
    const state = createGameState(445566);
    const entry = state.level.entry;

    for (const entity of state.level.entities.values()) {
      if (entity.kind !== 'enemy') continue;

      const mat = materialAt(state.level, entity.x, entity.y, 0);
      expect(isPassableMaterial(mat)).toBe(true);

      const dx = entity.x - entry.x;
      const dy = entity.y - entry.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeGreaterThanOrEqual(8);
    }
  });
});
