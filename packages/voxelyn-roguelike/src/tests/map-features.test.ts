import { describe, expect, it } from 'vitest';
import {
  BIOFLUID_DAMAGE,
  CRYSTAL_BUFF_MS,
  FEATURE_BIOFLUID,
  FEATURE_CRYSTAL,
  FEATURE_GATE,
  FEATURE_PORTAL,
  FEATURE_PROP_BEACON,
  FEATURE_PROP_CRATE,
  FEATURE_PROP_DEBRIS,
  FEATURE_PROP_FUNGAL_CLUSTER,
  FEATURE_ROOT_BARRIER,
  FEATURE_SPORE_VENT,
  FEATURE_TERMINAL,
  SPORE_SLOW_MS,
} from '../game/constants';
import { createGameState, getPlayer } from '../game/state';
import type { LevelInteractable } from '../game/types';
import { applyPlayerFeatureInteractions } from '../world/features';
import { moveEntity } from '../world/level';

const idx = (w: number, x: number, y: number): number => y * w + x;

describe('map features', () => {
  it('places features/interactables in valid cells and keeps entry/exit clean', () => {
    const state = createGameState(4242);
    const level = state.level;
    const entryIdx = idx(level.width, level.entry.x, level.entry.y);
    const exitIdx = idx(level.width, level.exit.x, level.exit.y);

    expect(level.featureMap[entryIdx] ?? 0).toBe(0);
    expect(level.featureMap[exitIdx] ?? 0).toBe(0);

    for (const interactable of level.interactables) {
      expect(interactable.x).toBeGreaterThanOrEqual(0);
      expect(interactable.x).toBeLessThan(level.width);
      expect(interactable.y).toBeGreaterThanOrEqual(0);
      expect(interactable.y).toBeLessThan(level.height);

      const cell = idx(level.width, interactable.x, interactable.y);
      expect(level.heightMap[cell]).toBe(0);
    }

    const decorationMask =
      FEATURE_PROP_FUNGAL_CLUSTER |
      FEATURE_PROP_DEBRIS |
      FEATURE_PROP_CRATE |
      FEATURE_PROP_BEACON;
    let decorationCount = 0;
    for (let i = 0; i < level.featureMap.length; i += 1) {
      if (((level.featureMap[i] ?? 0) & decorationMask) !== 0) {
        decorationCount += 1;
      }
    }
    expect(decorationCount).toBeGreaterThan(0);
  });

  it('applies biofluid, vent and crystal effects correctly', () => {
    const state = createGameState(131313);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    const level = state.level;
    const blockedFeatures =
      FEATURE_ROOT_BARRIER |
      FEATURE_GATE |
      FEATURE_PORTAL |
      FEATURE_TERMINAL |
      FEATURE_SPORE_VENT |
      FEATURE_CRYSTAL;

    let bioIdx = -1;
    for (let i = 0; i < level.featureMap.length; i += 1) {
      const flags = level.featureMap[i] ?? 0;
      if ((flags & FEATURE_BIOFLUID) === 0) continue;
      if ((flags & blockedFeatures) !== 0) continue;
      bioIdx = i;
      break;
    }
    expect(bioIdx).toBeGreaterThanOrEqual(0);
    if (bioIdx < 0) return;

    const bioX = bioIdx % level.width;
    const bioY = Math.floor(bioIdx / level.width);
    expect(moveEntity(level, player, bioX, bioY)).toBe(true);
    player.hp = 30;
    state.simTimeMs = 1000;
    state.activeDebuffs.biofluidNextTickAt = 0;
    applyPlayerFeatureInteractions(state, player);
    expect(player.hp).toBe(30 - BIOFLUID_DAMAGE);

    const vent = level.interactables.find(
      (item): item is Extract<LevelInteractable, { type: 'spore_vent' }> =>
        item.type === 'spore_vent'
    );
    expect(vent).toBeDefined();
    if (vent) {
      expect(moveEntity(level, player, vent.x, vent.y)).toBe(true);
      state.simTimeMs = 2400;
      applyPlayerFeatureInteractions(state, player);
      expect(state.activeDebuffs.slowUntilMs).toBeGreaterThanOrEqual(state.simTimeMs + SPORE_SLOW_MS);
    }

    const crystal = level.interactables.find(
      (item): item is Extract<LevelInteractable, { type: 'crystal' }> =>
        item.type === 'crystal' && !item.used
    );
    expect(crystal).toBeDefined();
    if (crystal) {
      player.hp = Math.max(1, player.hp - 15);
      const hpBeforeCrystal = player.hp;
      expect(moveEntity(level, player, crystal.x, crystal.y)).toBe(true);
      state.simTimeMs = 4200;
      applyPlayerFeatureInteractions(state, player);
      expect(crystal.used).toBe(true);
      expect(state.activeDebuffs.crystalBuffUntilMs).toBeGreaterThanOrEqual(state.simTimeMs + CRYSTAL_BUFF_MS);
      expect(player.hp).toBeGreaterThan(hpBeforeCrystal);
    }
  });
});
