import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, spawnEnemy, stepRun } from '../src/index';

describe('authoritative enemy action presentation', () => {
  it('telegraphs bomber detonation before death', () => {
    const state = createRun({ seed: 123, width: 32, height: 32 });
    state.enemies = [];
    const bomber = spawnEnemy(state, 'bomber', Math.floor(state.player.x), Math.floor(state.player.y));
    bomber.x = state.player.x + 1.5;
    bomber.y = state.player.y;
    const first = stepRun(state, [emptyCommand()]);
    const start = first.events.find((event) => event.t === 'action_start' && event.entity === bomber.id);
    expect(start?.t).toBe('action_start');
    if (start?.t === 'action_start') expect(start.releaseTick - start.startTick).toBeGreaterThanOrEqual(10);
    expect(bomber.alive).toBe(true);
    for (let i = 0; i < 12; i++) stepRun(state, [emptyCommand()]);
    expect(bomber.alive).toBe(false);
  });
});
