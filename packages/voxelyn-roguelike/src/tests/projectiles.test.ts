import { describe, expect, it } from 'vitest';
import { spawnProjectile, updateProjectiles } from '../combat/combat';
import { createEnemy } from '../entities/enemy';
import { createGameState, getPlayer } from '../game/state';
import { MATERIAL_FUNGAL_FLOOR, MATERIAL_ROCK } from '../game/constants';
import { nextEntityIdentity, registerEntity, setMaterialAt, unregisterEntity } from '../world/level';

describe('projectiles', () => {
  it('travels and damages enemy target on collision', () => {
    const state = createGameState(1919);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    for (const entity of Array.from(state.level.entities.values())) {
      if (entity.kind === 'enemy') unregisterEntity(state.level, entity);
    }

    const ex = player.x + 4;
    const ey = player.y;
    for (let x = player.x; x <= ex; x += 1) {
      setMaterialAt(state.level, x, ey, 0, MATERIAL_FUNGAL_FLOOR);
    }

    const enemyIdentity = nextEntityIdentity(state.level);
    const enemy = createEnemy(enemyIdentity.id, enemyIdentity.occ, 'stalker', ex, ey, state.floorNumber);
    registerEntity(state.level, enemy);

    spawnProjectile(state, {
      kind: 'guardian_shard',
      sourceId: player.id,
      x: player.x,
      y: player.y,
      targetX: enemy.x,
      targetY: enemy.y,
      damage: 9,
      speed: 8,
      ttlMs: 1200,
    });

    for (let i = 0; i < 12; i += 1) {
      state.simTimeMs += 50;
      updateProjectiles(state, 50);
    }

    expect(enemy.hp).toBeLessThan(enemy.maxHp);
    expect(state.projectiles.length).toBe(0);
  });

  it('gets blocked by walls before reaching target', () => {
    const state = createGameState(2929);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    for (const entity of Array.from(state.level.entities.values())) {
      if (entity.kind === 'enemy') unregisterEntity(state.level, entity);
    }

    const ex = player.x + 5;
    const ey = player.y;

    for (let x = player.x; x <= ex; x += 1) {
      setMaterialAt(state.level, x, ey, 0, MATERIAL_FUNGAL_FLOOR);
    }
    setMaterialAt(state.level, player.x + 2, ey, 0, MATERIAL_ROCK);

    const enemyIdentity = nextEntityIdentity(state.level);
    const enemy = createEnemy(enemyIdentity.id, enemyIdentity.occ, 'stalker', ex, ey, state.floorNumber);
    registerEntity(state.level, enemy);

    spawnProjectile(state, {
      kind: 'spore_blob',
      sourceId: player.id,
      x: player.x,
      y: player.y,
      targetX: enemy.x,
      targetY: enemy.y,
      damage: 12,
      speed: 8,
      ttlMs: 1200,
    });

    for (let i = 0; i < 12; i += 1) {
      state.simTimeMs += 50;
      updateProjectiles(state, 50);
    }

    expect(enemy.hp).toBe(enemy.maxHp);
    expect(state.projectiles.length).toBe(0);
  });
});
