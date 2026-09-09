import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import { abilityDefinition, emptyResonance, resonanceOffers } from '../src/abilities';
import { damageEntity, spawnEnemy } from '../src/entities';
import {
  FLAMETHROWER_CHANNEL_TICKS,
  FLAMETHROWER_GUARD_TICKS,
  SOLID_NONE,
  SOLID_ROCK,
  SURF_FIRE,
  SURF_GAS,
  SURF_NONE,
  SURF_SPORES,
  WELL_CHOICE_REACH,
} from '../src/constants';
import type { AbilityId, SurvivalState } from '../src/types';

const arena = (ability: AbilityId = 'pulse', playerCount = 1): SurvivalState => {
  const state = createRun({ seed: 207, playerCount });
  state.enemies = [];
  state.vents = [];
  state.projectiles = [];
  state.solid.fill(SOLID_NONE);
  state.surface.fill(SURF_NONE);
  state.surfaceTimer.fill(0);
  state.player.x = 40.5;
  state.player.y = 40.5;
  state.playerExtra.ability = ability;
  return state;
};
const cast = (state: SurvivalState): void => {
  stepRun(state, [{ ...emptyCommand(), ability: true, aim: { x: 1, y: 0 } }]);
};
const floor = (state: SurvivalState, surface: number): number => {
  const i = Math.floor(state.player.y) * state.config.width + Math.floor(state.player.x);
  state.surface[i] = surface;
  state.surfaceTimer[i] = 1000;
  return i;
};
const reveal = (state: SurvivalState): void => {
  state.playerExtra.resonance.fire = 12;
  state.playerExtra.resonance.current = 3;
  state.player.x = state.corePos.x + 0.5;
  state.player.y = state.corePos.y + 0.5;
  stepRun(state, [emptyCommand()]);
};

describe('Thermal Breath safety', () => {
  it('can sweep and walk on bare ground for a complete channel without self-harm', () => {
    const s = arena('flamethrower'),
      hp = s.player.hp;
    cast(s);
    for (let n = 0; n < FLAMETHROWER_CHANNEL_TICKS + FLAMETHROWER_GUARD_TICKS; n++)
      stepRun(s, [{ ...emptyCommand(), move: { x: 1, y: 0 } }]);
    expect(s.player.hp).toBe(hp);
    expect(s.surface.some((cell) => cell === SURF_FIRE)).toBe(false);
  });
  it('protects ground fire through channel + exit, then fire hurts again', () => {
    const s = arena('flamethrower'),
      hp = s.player.hp;
    floor(s, SURF_FIRE);
    cast(s);
    const guard = s.playerExtra.thermalGuardUntil;
    while (s.tick < guard - 1) stepRun(s, [emptyCommand()]);
    expect(s.player.hp).toBe(hp);
    stepRun(s, [emptyCommand()]);
    expect(s.player.hp).toBeLessThan(hp);
  });
  it('does not protect gas, weapon overheat or a boss fire attack', () => {
    const s = arena('flamethrower');
    floor(s, SURF_GAS);
    const hp = s.player.hp;
    cast(s);
    expect(s.player.hp).toBeLessThan(hp);
    const afterGas = s.player.hp;
    damageEntity(s, s.player, 4, [], { kind: 'fire' });
    expect(s.player.hp).toBeLessThan(afterGas);
    const afterBoss = s.player.hp;
    damageEntity(s, s.player, 4, [], { kind: 'overheat' });
    expect(s.player.hp).toBeLessThan(afterBoss);
  });
  it('interruptions shorten the guard to the exit window and its clock is hashed', () => {
    const s = arena('flamethrower');
    cast(s);
    s.player.stunnedUntil = s.tick + 10;
    stepRun(s, [emptyCommand()]);
    expect(s.playerExtra.thermalGuardUntil).toBe(s.tick + FLAMETHROWER_GUARD_TICKS);
    const other = structuredClone(s);
    other.playerExtra = other.playerExtras[0];
    other.playerExtra.thermalGuardUntil++;
    expect(hashAuthoritativeState(s)).not.toBe(hashAuthoritativeState(other));
  });
});

describe('Echo unlocks and selection', () => {
  it('requires each new action threshold and excludes the equipped ability', () => {
    for (const id of ['seismic', 'slipstream', 'vent'] as const) {
      const d = abilityDefinition(id),
        tally = emptyResonance();
      tally[d.resonance!] = d.threshold - 1;
      expect(resonanceOffers(tally, 'pulse', 7, 2)).not.toContain(id);
      tally[d.resonance!]++;
      expect(resonanceOffers(tally, 'pulse', 7, 2)).toContain(id);
      expect(resonanceOffers(tally, id, 7, 2)).not.toContain(id);
    }
  });
  it('counts a dodge only when it starts and a purge only when a cell is spent', () => {
    const s = arena();
    s.playerExtra.purgeCells = 1;
    const command = { ...emptyCommand(), dodge: true, purge: true };
    stepRun(s, [command]);
    stepRun(s, [command]);
    expect(s.playerExtra.resonance.evasion).toBe(1);
    expect(s.playerExtra.resonance.purge).toBe(1);
  });
  it('freezes the real reason, counter and owner at reveal', () => {
    const s = arena();
    reveal(s);
    expect(s.wellOffers[0].unlock).toEqual({ kind: 'fire', amount: 12, required: 1, slot: 0 });
    s.playerExtra.resonance.fire = 999;
    stepRun(s, [emptyCommand()]);
    expect(s.wellOffers[0].unlock.amount).toBe(12);
  });
  it('labels a first-descent demonstration truthfully', () => {
    const s = arena();
    s.player.x = s.corePos.x + 0.5;
    s.player.y = s.corePos.y + 0.5;
    stepRun(s, [emptyCommand()]);
    expect(s.wellOffers[0].unlock).toEqual({
      kind: 'first_descent',
      amount: 0,
      required: 0,
      slot: 0,
    });
    expect(['flamethrower', 'arc', 'seeker']).toContain(s.wellOffers[0].ability);
  });
  it('accepts card 2 without descending or firing and refuses a second selection', () => {
    const s = arena();
    reveal(s);
    const choice = {
      ...emptyCommand(),
      choiceKind: 'echo' as const,
      choose: 1 as const,
      interact: true,
      fire: true,
    };
    stepRun(s, [choice]);
    expect(s.playerExtra.ability).toBe('arc');
    expect(s.sector).toBe(1);
    expect(s.stats.shotsFired).toBe(0);
    const until = s.playerExtra.abilityCooldownUntil;
    stepRun(s, [{ ...choice, choose: 0, interact: false, fire: false }]);
    expect(s.playerExtra.ability).toBe('arc');
    expect(s.playerExtra.abilityCooldownUntil).toBe(until);
  });
  it('keeping the equipped echo never refreshes its cooldown', () => {
    const s = arena();
    reveal(s);
    s.playerExtra.abilityCooldownUntil = s.tick + 200;
    const until = s.playerExtra.abilityCooldownUntil;
    stepRun(s, [{ ...emptyCommand(), choiceKind: 'echo', choose: null }]);
    expect(s.playerExtra.ability).toBe('pulse');
    expect(s.playerExtra.abilityCooldownUntil).toBe(until);
    expect(s.wellOffers.every((o) => o.takenBy === 0)).toBe(true);
  });
  it('refuses distant and incapacitated choices', () => {
    for (const condition of ['far', 'downed', 'stunned', 'cocoon', 'frozen'] as const) {
      const s = arena();
      reveal(s);
      if (condition === 'far') s.player.x += WELL_CHOICE_REACH + 2;
      if (condition === 'downed') s.playerExtra.downed = true;
      if (condition === 'stunned') s.player.stunnedUntil = s.tick + 100;
      if (condition === 'cocoon') s.playerExtra.cocoonUntil = s.tick + 100;
      if (condition === 'frozen') s.playerExtra.frostbitten = true;
      stepRun(s, [{ ...emptyCommand(), choiceKind: 'echo', choose: 0 }]);
      expect(s.playerExtra.ability).toBe('pulse');
    }
  });
  it('arbitrates simultaneous co-op choices once', () => {
    const s = arena('pulse', 2);
    reveal(s);
    s.players[1].x = s.player.x;
    s.players[1].y = s.player.y;
    const result = stepRun(
      s,
      [0, 1].map((choose) => ({ ...emptyCommand(), choose: choose as 0 | 1, choiceKind: 'echo' })),
    );
    expect(result.events.filter((e) => e.t === 'ability_taken')).toHaveLength(1);
    expect(s.playerExtras[0].ability).toBe('flamethrower');
    expect(s.playerExtras[1].ability).toBe('pulse');
  });
});

describe('new Echo abilities', () => {
  it('seismic damages and stuns enemies in reach but cannot hit through walls', () => {
    const s = arena('seismic');
    const near = spawnEnemy(s, 'stalker', 42.5, 40.5, false);
    const blocked = spawnEnemy(s, 'stalker', 40.5, 43.5, false);
    near.x = 42.5;
    near.y = 40.5;
    blocked.x = 40.5;
    blocked.y = 43.5;
    s.solid[42 * s.config.width + 40] = SOLID_ROCK;
    const hp = [near.hp, blocked.hp];
    cast(s);
    expect(near.hp).toBeLessThan(hp[0]);
    expect(near.stunnedUntil).toBeGreaterThan(s.tick);
    expect(blocked.hp).toBe(hp[1]);
  });
  it('slipstream follows aim, collides with walls and does not farm dodges', () => {
    const s = arena('slipstream');
    for (let y = 35; y < 46; y++) s.solid[y * s.config.width + 43] = SOLID_ROCK;
    cast(s);
    expect(s.playerExtra.iframesUntil).toBeGreaterThan(s.tick);
    for (let n = 0; n < 12; n++) stepRun(s, [emptyCommand()]);
    expect(s.player.x).toBeGreaterThan(41);
    expect(s.player.x).toBeLessThan(43);
    expect(s.playerExtra.resonance.evasion).toBe(0);
  });
  it('vent resets heat and local hazards without healing or spending purge cells', () => {
    const s = arena('vent');
    s.playerExtra.heat = 70;
    s.playerExtra.overheatedUntil = s.tick + 200;
    s.player.hp = 20;
    const cells = s.playerExtra.purgeCells;
    floor(s, SURF_SPORES);
    cast(s);
    expect(s.playerExtra.heat).toBe(0);
    expect(s.playerExtra.overheatedUntil).toBeLessThanOrEqual(s.tick);
    expect(s.player.hp).toBe(20);
    expect(s.playerExtra.purgeCells).toBe(cells);
    expect(s.surface[40 * s.config.width + 40]).toBe(SURF_NONE);
  });
});
