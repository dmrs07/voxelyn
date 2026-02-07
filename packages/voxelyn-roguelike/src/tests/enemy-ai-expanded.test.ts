import { describe, expect, it } from 'vitest';
import { updateEnemiesAI } from '../entities/ai';
import { createEnemy } from '../entities/enemy';
import { MATERIAL_FUNGAL_FLOOR } from '../game/constants';
import { createGameState, getPlayer } from '../game/state';
import { nextEntityIdentity, registerEntity, setMaterialAt, unregisterEntity } from '../world/level';

describe('enemy ai expanded', () => {
  it('spitter fires projectile when player is in range and line of sight', () => {
    const state = createGameState(7070);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    for (const entity of Array.from(state.level.entities.values())) {
      if (entity.kind === 'enemy') unregisterEntity(state.level, entity);
    }

    const sx = player.x - 4;
    const sy = player.y;
    for (let x = sx; x <= player.x; x += 1) {
      setMaterialAt(state.level, x, sy, 0, MATERIAL_FUNGAL_FLOOR);
    }

    const identity = nextEntityIdentity(state.level);
    const spitter = createEnemy(identity.id, identity.occ, 'spitter', sx, sy, state.floorNumber);
    registerEntity(state.level, spitter);

    updateEnemiesAI(state, 5000);

    expect(state.projectiles.length).toBeGreaterThan(0);
    expect(spitter.aiState).toBe('chase');
    expect(spitter.alertUntilMs).toBeGreaterThan(0);
  });

  it('spore bomber enters windup then explodes and is removed', () => {
    const state = createGameState(8080);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    for (const entity of Array.from(state.level.entities.values())) {
      if (entity.kind === 'enemy') unregisterEntity(state.level, entity);
    }

    const bx = player.x + 2;
    const by = player.y;
    setMaterialAt(state.level, bx, by, 0, MATERIAL_FUNGAL_FLOOR);

    const identity = nextEntityIdentity(state.level);
    const bomber = createEnemy(identity.id, identity.occ, 'spore_bomber', bx, by, state.floorNumber);
    registerEntity(state.level, bomber);

    updateEnemiesAI(state, 1000);
    expect(bomber.aiState).toBe('explode_windup');
    expect((bomber.fuseUntilMs ?? 0)).toBeGreaterThan(1000);

    updateEnemiesAI(state, (bomber.fuseUntilMs ?? 1000) + 1);
    expect(bomber.alive).toBe(false);
    expect(state.level.entities.has(bomber.id)).toBe(false);
  });
});
