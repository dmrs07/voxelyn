import { describe, expect, it } from 'vitest';
import { createRun } from '@voxelyn/survival-sim';
import { DEFAULT_WINDOW_RADIUS, MAX_WINDOW_RADIUS, buildAgentSnapshot } from '../src/snapshot.js';

describe('buildAgentSnapshot', () => {
  it('describes a fresh run in terms an agent can act on', () => {
    const state = createRun({ seed: 1, playerCount: 1 });
    const snap = buildAgentSnapshot(state);

    expect(snap.tick).toBe(0);
    expect(snap.phase).toBe('running');
    expect(snap.sector).toBe(1);
    expect(snap.player.hp).toBe(state.player.hp);
    expect(snap.player.alive).toBe(true);
    expect(snap.enemies.shown.length).toBeLessThanOrEqual(snap.enemies.totalAlive);
    expect(snap.projectiles.shown.length).toBeLessThanOrEqual(snap.projectiles.total);
  });

  it('uses material NAMES, never raw numeric ids, in the terrain window', () => {
    const state = createRun({ seed: 5, playerCount: 1 });
    const snap = buildAgentSnapshot(state, 4);
    const allCells = [...snap.terrain.solid.flat(), ...snap.terrain.surface.flat()];
    for (const cell of allCells) {
      expect(typeof cell).toBe('string');
      expect(cell.length).toBeGreaterThan(0);
    }
  });

  it('sizes the terrain window from the requested radius, clipped to world bounds', () => {
    const state = createRun({ seed: 2, playerCount: 1 });
    const snap = buildAgentSnapshot(state, 3);
    expect(snap.terrain.width).toBeLessThanOrEqual(7);
    expect(snap.terrain.height).toBeLessThanOrEqual(7);
    expect(snap.terrain.solid).toHaveLength(snap.terrain.height);
    expect(snap.terrain.solid[0]).toHaveLength(snap.terrain.width);
  });

  it('falls back to the default radius when none is given', () => {
    const state = createRun({ seed: 3, playerCount: 1 });
    const snap = buildAgentSnapshot(state);
    expect(snap.terrain.width).toBeLessThanOrEqual(DEFAULT_WINDOW_RADIUS * 2 + 1);
  });

  it('clamps an out-of-range radius instead of failing', () => {
    const state = createRun({ seed: 6, playerCount: 1 });
    const snap = buildAgentSnapshot(state, 999);
    expect(snap.terrain.width).toBeLessThanOrEqual(MAX_WINDOW_RADIUS * 2 + 1);
  });

  it('reports the pending module choice only when one exists', () => {
    const state = createRun({ seed: 1, playerCount: 1 });
    expect(buildAgentSnapshot(state).pendingModuleChoice).toBeNull();
  });
});
