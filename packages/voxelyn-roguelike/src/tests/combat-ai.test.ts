import { describe, expect, it } from 'vitest';
import { tryPlayerBumpAction } from '../combat/combat';
import { updateEnemiesAI } from '../entities/ai';
import { createEnemy } from '../entities/enemy';
import { MATERIAL_FUNGAL_FLOOR } from '../game/constants';
import { createGameState, getPlayer } from '../game/state';
import { nextEntityIdentity, registerEntity, setMaterialAt, unregisterEntity } from '../world/level';

describe('combat and ai', () => {
  it('bump attack damages enemy without moving through it and respects cooldown', () => {
    const state = createGameState(7777);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    for (const entity of Array.from(state.level.entities.values())) {
      if (entity.kind === 'enemy') unregisterEntity(state.level, entity);
    }

    const tx = player.x + 1;
    const ty = player.y;
    setMaterialAt(state.level, tx, ty, 0, MATERIAL_FUNGAL_FLOOR);

    const identity = nextEntityIdentity(state.level);
    const enemy = createEnemy(identity.id, identity.occ, 'stalker', tx, ty, state.floorNumber);
    registerEntity(state.level, enemy);

    const beforeHp = enemy.hp;
    const action1 = tryPlayerBumpAction(state, player, 1, 0, 1000);
    expect(action1.attacked).toBe(true);
    expect(action1.moved).toBe(false);
    expect(player.x).not.toBe(tx);
    expect(enemy.hp).toBeLessThan(beforeHp);

    const hpAfterFirst = enemy.hp;
    const action2 = tryPlayerBumpAction(state, player, 1, 0, 1000);
    expect(action2.attacked).toBe(false);
    expect(enemy.hp).toBe(hpAfterFirst);
  });

  it('stalker ai moves toward player when in detection radius', () => {
    const state = createGameState(8888);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    for (const entity of Array.from(state.level.entities.values())) {
      if (entity.kind === 'enemy') unregisterEntity(state.level, entity);
    }

    const startX = Math.max(2, player.x - 4);
    const startY = player.y;

    for (let x = startX; x <= player.x; x += 1) {
      setMaterialAt(state.level, x, startY, 0, MATERIAL_FUNGAL_FLOOR);
    }

    const identity = nextEntityIdentity(state.level);
    const stalker = createEnemy(identity.id, identity.occ, 'stalker', startX, startY, state.floorNumber);
    registerEntity(state.level, stalker);

    const beforeDistance = Math.abs(stalker.x - player.x) + Math.abs(stalker.y - player.y);
    updateEnemiesAI(state, 5000);
    const afterDistance = Math.abs(stalker.x - player.x) + Math.abs(stalker.y - player.y);

    expect(afterDistance).toBeLessThan(beforeDistance);
  });
});
