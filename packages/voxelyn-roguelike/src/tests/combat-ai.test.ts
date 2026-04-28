import { describe, expect, it } from 'vitest';
import { calculateDamage, tryPlayerBumpAction } from '../combat/combat';
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
    state.level.featureMap.fill(0);

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

  it('auto-attacks adjacent enemy even if input points elsewhere', () => {
    const state = createGameState(4545);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    for (const entity of Array.from(state.level.entities.values())) {
      if (entity.kind === 'enemy') unregisterEntity(state.level, entity);
    }
    state.level.featureMap.fill(0);

    const tx = player.x + 1;
    const ty = player.y;
    setMaterialAt(state.level, tx, ty, 0, MATERIAL_FUNGAL_FLOOR);

    const identity = nextEntityIdentity(state.level);
    const enemy = createEnemy(identity.id, identity.occ, 'stalker', tx, ty, state.floorNumber);
    registerEntity(state.level, enemy);

    player.nextAttackAt = 0;
    const beforeHp = enemy.hp;
    const action = tryPlayerBumpAction(state, player, -1, 0, 2000);

    expect(action.attacked).toBe(true);
    expect(action.moved).toBe(false);
    expect(enemy.hp).toBeLessThan(beforeHp);
  });

  it('guardian ward reduces player damage against nearby enemies', () => {
    const state = createGameState(4646);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    for (const entity of Array.from(state.level.entities.values())) {
      if (entity.kind === 'enemy') unregisterEntity(state.level, entity);
    }
    state.level.featureMap.fill(0);

    const tx = player.x + 1;
    const ty = player.y;
    const gy = player.y + 1 < state.level.height - 1 ? player.y + 1 : player.y - 1;
    setMaterialAt(state.level, tx, ty, 0, MATERIAL_FUNGAL_FLOOR);
    setMaterialAt(state.level, tx, gy, 0, MATERIAL_FUNGAL_FLOOR);

    const targetIdentity = nextEntityIdentity(state.level);
    const target = createEnemy(targetIdentity.id, targetIdentity.occ, 'stalker', tx, ty, state.floorNumber);
    registerEntity(state.level, target);

    const guardianIdentity = nextEntityIdentity(state.level);
    const guardian = createEnemy(guardianIdentity.id, guardianIdentity.occ, 'guardian', tx, gy, state.floorNumber);
    registerEntity(state.level, guardian);

    const beforeHp = target.hp;
    const action = tryPlayerBumpAction(state, player, 1, 0, 1000);

    expect(action.attacked).toBe(true);
    expect(beforeHp - target.hp).toBe(calculateDamage(player.attack, target.damageReduction + 2));
    expect(state.uiAlerts.some((alert) => alert.text.includes('Guardian'))).toBe(true);
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

  it('striker detects loud player movement through vibration beyond normal range', () => {
    const state = createGameState(8989);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    for (const entity of Array.from(state.level.entities.values())) {
      if (entity.kind === 'enemy') unregisterEntity(state.level, entity);
    }

    const direction = player.x + 11 < state.level.width - 1 ? 1 : -1;
    const startX = player.x + direction * 11;
    const startY = player.y;

    const minX = Math.min(startX, player.x);
    const maxX = Math.max(startX, player.x);
    for (let x = minX; x <= maxX; x += 1) {
      setMaterialAt(state.level, x, startY, 0, MATERIAL_FUNGAL_FLOOR);
    }

    const identity = nextEntityIdentity(state.level);
    const striker = createEnemy(identity.id, identity.occ, 'stalker', startX, startY, state.floorNumber);
    registerEntity(state.level, striker);

    player.animIntent = 'move';
    player.nextMoveAt = 6000;

    const beforeDistance = Math.abs(striker.x - player.x) + Math.abs(striker.y - player.y);
    updateEnemiesAI(state, 5000);
    const afterDistance = Math.abs(striker.x - player.x) + Math.abs(striker.y - player.y);

    expect(beforeDistance).toBeGreaterThan(striker.detectRadius);
    expect(striker.aiState).toBe('chase');
    expect(afterDistance).toBeLessThan(beforeDistance);
    expect(striker.animSpeedMul).toBeGreaterThan(1);
  });
});
