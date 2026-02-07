import { describe, expect, it } from 'vitest';
import { updateEnemiesAI } from '../entities/ai';
import { createEnemy } from '../entities/enemy';
import {
  MATERIAL_FUNGAL_FLOOR,
  MATERIAL_ROCK,
} from '../game/constants';
import { createGameState, getPlayer } from '../game/state';
import {
  moveEntity,
  nextEntityIdentity,
  registerEntity,
  setMaterialAt,
  unregisterEntity,
} from '../world/level';

describe('ai dynamic routing', () => {
  it('avoids active spore lane when an alternative short route exists', () => {
    const state = createGameState(99031);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    for (const entity of Array.from(state.level.entities.values())) {
      if (entity.kind === 'enemy') unregisterEntity(state.level, entity);
    }

    const px = Math.max(4, Math.min(state.level.width - 5, player.x));
    const py = Math.max(3, Math.min(state.level.height - 4, player.y));
    moveEntity(state.level, player, px, py);

    for (let y = py - 1; y <= py + 1; y += 1) {
      for (let x = px - 3; x <= px + 1; x += 1) {
        setMaterialAt(state.level, x, y, 0, MATERIAL_ROCK);
      }
    }

    const carve = [
      { x: px, y: py },
      { x: px - 1, y: py }, // direct route (hazard)
      { x: px - 2, y: py }, // enemy spawn
      { x: px - 2, y: py + 1 },
      { x: px - 1, y: py + 1 },
      { x: px, y: py + 1 }, // safer detour
    ];
    for (const cell of carve) {
      setMaterialAt(state.level, cell.x, cell.y, 0, MATERIAL_FUNGAL_FLOOR);
    }

    const identity = nextEntityIdentity(state.level);
    const enemy = createEnemy(identity.id, identity.occ, 'stalker', px - 2, py, state.floorNumber);
    registerEntity(state.level, enemy);

    state.level.dynamicCells.push({
      id: 'dyn_spore_hazard',
      kind: 'spore_lane',
      x: px - 1,
      y: py,
      phase: 'closed',
      nextTransitionMs: 999999,
      openMs: 1500,
      warningMs: 400,
      closedMs: 1200,
      damagePerTick: 1,
      slowMs: 600,
      nextDamageTickAt: 0,
    });

    updateEnemiesAI(state, 5000);
    expect(enemy.x).toBe(px - 2);
    expect(enemy.y).toBe(py + 1);
  });
});
