import { describe, expect, it } from 'vitest';
import { createGameState, getPlayer } from '../game/state';
import { updateCorridorEvents } from '../world/corridor-events';

describe('corridor events', () => {
  it('applies spore wave effect when player is on active event cells', () => {
    const state = createGameState(77501);
    const player = getPlayer(state);
    expect(player).not.toBeNull();
    if (!player) return;

    state.level.corridorEvents = [
      {
        id: 'evt_test_spore',
        kind: 'spore_wave',
        cells: [{ x: player.x, y: player.y }],
        activeUntilMs: 4000,
        cooldownUntilMs: 9999,
        nextEffectTickAt: 0,
        severity: 2,
      },
    ];

    player.hp = 20;
    state.simTimeMs = 1000;
    updateCorridorEvents(state);
    expect(player.hp).toBeLessThan(20);
    expect(state.activeDebuffs.slowUntilMs).toBeGreaterThan(state.simTimeMs);
    expect(state.level.corridorEvents[0]?.nextEffectTickAt ?? 0).toBeGreaterThan(state.simTimeMs);
  });

  it('reschedules cooldown/activation when event is ready', () => {
    const state = createGameState(77502);
    state.level.corridorEvents = [
      {
        id: 'evt_test_ambush',
        kind: 'ambush_ping',
        cells: [{ x: state.level.entry.x, y: state.level.entry.y }],
        activeUntilMs: 0,
        cooldownUntilMs: 0,
        nextEffectTickAt: 0,
        severity: 1,
      },
    ];

    state.simTimeMs = 2200;
    updateCorridorEvents(state);
    const event = state.level.corridorEvents[0];
    expect(event).toBeDefined();
    if (!event) return;
    expect(event.cooldownUntilMs).toBeGreaterThan(state.simTimeMs);
  });
});
