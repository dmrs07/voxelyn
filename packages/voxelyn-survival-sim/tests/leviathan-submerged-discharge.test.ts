import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { damageEntity, spawnEnemy } from '../src/entities';
import { delugeDepth } from '../src/cells';
import { emptyBossRuntime } from '../src/bosses';
import { DEVOURER_SURFACED } from '../src/types';
import {
  DELUGE_MAX_DEPTH,
  LEVIATHAN_SHOCK_DAMAGE,
  LEVIATHAN_SHOCK_WINDUP_TICKS,
  PROSPECTOR_HEAD_HEIGHT,
  SOLID_NONE,
} from '../src/constants';

const floodedDuel = (seed = 9001) => {
  const state = createRun({ seed });
  const w = state.config.width;
  const px = Math.floor(w / 2);
  const py = Math.floor(state.config.height / 2);
  state.player.x = px + 0.5;
  state.player.y = py + 0.5;
  for (let y = py - 18; y <= py + 18; y++) {
    for (let x = px - 18; x <= px + 18; x++) state.solid[y * w + x] = SOLID_NONE;
  }
  state.enemies = [];
  const boss = spawnEnemy(state, 'sheet_leviathan', px + 6, py, false);
  state.bossRuntime.awake = true;
  state.tick = 1000;
  state.bossRuntime.delugeAt = 0;
  state.bossRuntime.delugeX = boss.x;
  state.bossRuntime.delugeY = boss.y;
  state.delugeFieldBucket = -1;
  return { state, boss, w };
};

const beginShock = (state: ReturnType<typeof floodedDuel>['state']) => {
  const result = stepRun(state, [emptyCommand()]);
  expect(
    result.events.some((event) => event.t === 'action_start' && event.action === 'massive_shock'),
  ).toBe(true);
};

describe('Leviata do Lencol — combate realmente submerso', () => {
  it('o nivel final passa claramente da cabeca do Prospector', () => {
    const { state, w } = floodedDuel();
    const cell = Math.floor(state.player.y) * w + Math.floor(state.player.x);
    expect(delugeDepth(state, cell)).toBe(DELUGE_MAX_DEPTH);
    expect(delugeDepth(state, cell)).toBeGreaterThan(PROSPECTOR_HEAD_HEIGHT);
  });

  it('spawna exatamente duas bolhas validas, nao sobrepostas e assimetricas', () => {
    const { state, boss, w } = floodedDuel(9002);
    beginShock(state);
    const bubbles = state.bossRuntime.protectiveBubbles;
    expect(bubbles).toHaveLength(2);
    for (const bubble of bubbles) {
      expect(state.solid[Math.floor(bubble.y) * w + Math.floor(bubble.x)]).toBe(SOLID_NONE);
      expect(
        delugeDepth(state, Math.floor(bubble.y) * w + Math.floor(bubble.x)),
      ).toBeGreaterThanOrEqual(PROSPECTOR_HEAD_HEIGHT);
    }
    expect(Math.hypot(bubbles[0].x - bubbles[1].x, bubbles[0].y - bubbles[1].y)).toBeGreaterThan(
      bubbles[0].radius + bubbles[1].radius,
    );
    expect(
      Math.abs(
        Math.hypot(bubbles[0].x - boss.x, bubbles[0].y - boss.y) -
          Math.hypot(bubbles[1].x - boss.x, bubbles[1].y - boss.y),
      ),
    ).toBeGreaterThan(1);
  });

  it('mantem a janela, protege so a descarga e estoura os dois abrigos', () => {
    const { state } = floodedDuel(9003);
    beginShock(state);
    const bubble = state.bossRuntime.protectiveBubbles[0];
    const hp = state.player.hp;
    // Outro dano continua funcionando dentro do abrigo: nao e invulnerabilidade.
    state.player.x = bubble.x;
    state.player.y = bubble.y;
    damageEntity(state, state.player, 3, [], { kind: 'fire' });
    expect(state.player.hp).toBeLessThan(hp);
    const afterFire = state.player.hp;
    for (let i = 1; i < LEVIATHAN_SHOCK_WINDUP_TICKS; i++) {
      const events = stepRun(state, [emptyCommand()]).events;
      expect(events.some((event) => event.t === 'leviathan_discharge')).toBe(false);
      expect(state.bossRuntime.protectiveBubbles).toHaveLength(2);
    }
    const events = stepRun(state, [emptyCommand()]).events;
    expect(events.some((event) => event.t === 'leviathan_discharge')).toBe(true);
    expect(state.player.hp).toBe(afterFire);
    expect(state.bossRuntime.protectiveBubbles).toHaveLength(0);
  });

  it('fora do abrigo recebe dano brutal, e morte/reset limpam estado', () => {
    const { state, boss } = floodedDuel(9004);
    beginShock(state);
    state.player.x = boss.x + 12;
    state.player.y = boss.y + 12;
    const hp = state.player.hp;
    for (let i = 0; i < LEVIATHAN_SHOCK_WINDUP_TICKS; i++) stepRun(state, [emptyCommand()]);
    expect(hp - state.player.hp).toBe(LEVIATHAN_SHOCK_DAMAGE);
    expect(state.bossRuntime.protectiveBubbles).toHaveLength(0);

    state.bossRuntime.leviathanShockRecoverAt = -1;
    boss.action = undefined;
    beginShock(state);
    boss.mood = DEVOURER_SURFACED;
    damageEntity(state, boss, boss.hp, [], { kind: 'player_shot' });
    stepRun(state, [emptyCommand()]);
    expect(state.bossRuntime.protectiveBubbles).toHaveLength(0);
    expect(emptyBossRuntime().protectiveBubbles).toHaveLength(0);
    expect(emptyBossRuntime().leviathanShockAt).toBe(-1);
  });
});
