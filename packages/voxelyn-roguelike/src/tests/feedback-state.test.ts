import { describe, expect, it } from 'vitest';
import { attackEntity } from '../combat/combat';
import { createEnemy } from '../entities/enemy';
import { createGameState, getPlayer } from '../game/state';
import { MATERIAL_FUNGAL_FLOOR } from '../game/constants';
import { nextEntityIdentity, registerEntity, setMaterialAt, unregisterEntity } from '../world/level';

describe('feedback state', () => {
  it('sets hit flash and screen damage flash when player is hit', () => {
    const state = createGameState(30303);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    for (const entity of Array.from(state.level.entities.values())) {
      if (entity.kind === 'enemy') unregisterEntity(state.level, entity);
    }

    const identity = nextEntityIdentity(state.level);
    const enemy = createEnemy(identity.id, identity.occ, 'guardian', player.x + 1, player.y, state.floorNumber);
    registerEntity(state.level, enemy);

    const before = player.hp;
    const result = attackEntity(state, enemy, player, 1200);

    expect(result.didAttack).toBe(true);
    expect(player.hp).toBeLessThan(before);
    expect(player.hitFlashUntilMs).toBeGreaterThan(1200);
    expect(state.screenFlash.damageMs).toBeGreaterThan(0);
  });

  it('sets heal flash on life-on-hit recovery', () => {
    const state = createGameState(40404);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    for (const entity of Array.from(state.level.entities.values())) {
      if (entity.kind === 'enemy') unregisterEntity(state.level, entity);
    }

    player.lifeOnHit = 2;
    player.hp = Math.max(1, player.hp - 10);

    const ex = player.x + 1;
    const ey = player.y;
    setMaterialAt(state.level, ex, ey, 0, MATERIAL_FUNGAL_FLOOR);

    const identity = nextEntityIdentity(state.level);
    const enemy = createEnemy(identity.id, identity.occ, 'stalker', ex, ey, state.floorNumber);
    enemy.hp = 30;
    enemy.maxHp = 30;
    registerEntity(state.level, enemy);

    const hpBefore = player.hp;
    attackEntity(state, player, enemy, 1300);

    expect(player.hp).toBeGreaterThan(hpBefore);
    expect(state.screenFlash.healMs).toBeGreaterThan(0);
  });
});
