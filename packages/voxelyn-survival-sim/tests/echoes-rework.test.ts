import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import {
  ABILITY_DEFINITIONS,
  abilityDefinition,
  canChooseEcho,
  emptyResonance,
  resonanceOffers,
  wellInCombat,
} from '../src/abilities';
import { damageEntity, spawnEnemy } from '../src/entities';
import {
  FLAMETHROWER_CHANNEL_TICKS,
  FLAMETHROWER_GUARD_TICKS,
  SOLID_NONE,
  SOLID_ROCK,
  SURF_FIRE,
  SURF_GAS,
  SURF_NONE,
  SLIPSTREAM_SPEED_MUL,
  SLIPSTREAM_TICKS,
  SURF_DEEP_WATER,
  SURF_SPORES,
  SURF_WATER,
  WELL_CHOICE_REACH,
  WELL_COMBAT_RADIUS,
} from '../src/constants';
import {
  LURKER_EXPOSED,
  LURKER_HIDDEN,
  MINER_MOOD_ENRAGED,
  MINER_MOOD_PASSIVE,
  type AbilityId,
  type SurvivalState,
} from '../src/types';

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
  it('swapping away from a live breath keeps the exit window instead of a bare tick on fire', () => {
    const s = arena('flamethrower');
    reveal(s);
    cast(s);
    expect(s.playerExtra.channelingUntil).toBeGreaterThan(s.tick);
    expect(s.wellOffers[0].ability).not.toBe('flamethrower');
    stepRun(s, [{ ...emptyCommand(), choiceKind: 'echo', choose: 0 }]);
    expect(s.playerExtra.ability).toBe(s.wellOffers[0].ability);
    expect(s.playerExtra.channelingUntil).toBe(0);
    // A mesma janela que um stun daria: nunca zero, nunca o canal inteiro.
    expect(s.playerExtra.thermalGuardUntil).toBe(s.tick + FLAMETHROWER_GUARD_TICKS);
  });

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
  it('drafts fairly: with everything unlocked, no pair monopolises the well', () => {
    const tally = emptyResonance();
    for (const id of Object.keys(ABILITY_DEFINITIONS) as AbilityId[]) {
      const d = abilityDefinition(id);
      if (d.resonance) tally[d.resonance] = Math.max(tally[d.resonance], d.threshold);
    }
    const seen: Partial<Record<AbilityId, number>> = {};
    const runs = 400;
    for (let n = 1; n <= runs; n++) {
      const offers = resonanceOffers(tally, 'pulse', n * 7919, 2);
      expect(offers).toHaveLength(2);
      for (const id of offers) seen[id] = (seen[id] ?? 0) + 1;
    }
    const ids = Object.keys(seen) as AbilityId[];
    expect(ids).toHaveLength(6);
    // Fatia justa: 2 de 6 por run. Ninguem abaixo de metade dela, ninguem
    // acima de uma vez e meia — o antigo "top 2" dava 400 para duas e 0 para
    // as outras quatro.
    const fair = (runs * 2) / 6;
    for (const id of ids) {
      expect(seen[id]!).toBeGreaterThan(fair * 0.5);
      expect(seen[id]!).toBeLessThan(fair * 1.5);
    }
  });
  it('the draft still leans toward what the player did most, and changes by sector', () => {
    const tally = emptyResonance();
    for (const id of Object.keys(ABILITY_DEFINITIONS) as AbilityId[]) {
      const d = abilityDefinition(id);
      if (d.resonance) tally[d.resonance] = Math.max(tally[d.resonance], d.threshold);
    }
    tally.fire = abilityDefinition('flamethrower').threshold * 12;
    let fire = 0;
    let arc = 0;
    for (let n = 1; n <= 400; n++) {
      const offers = resonanceOffers(tally, 'pulse', n * 104729, 3);
      if (offers.includes('flamethrower')) fire++;
      if (offers.includes('arc')) arc++;
      // Na tela, a mais praticada vem primeiro.
      if (offers.includes('flamethrower')) expect(offers[0]).toBe('flamethrower');
    }
    expect(fire).toBeGreaterThan(arc * 1.5);
    expect(fire).toBeLessThan(400);
    const pairs = new Set<string>();
    for (let sector = 1; sector <= 8; sector++)
      pairs.add(resonanceOffers(tally, 'pulse', 5, sector).join('+'));
    expect(pairs.size).toBeGreaterThan(1);
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
  it('waits out combat: a live threat nearby keeps the panel shut and refuses the pick', () => {
    const s = arena();
    reveal(s);
    const stalker = spawnEnemy(s, 'stalker', s.player.x + 4, s.player.y, false);
    stalker.x = s.player.x + 4;
    stalker.y = s.player.y;
    expect(wellInCombat(s)).toBe(true);
    expect(canChooseEcho(s)).toBe(false);
    stepRun(s, [{ ...emptyCommand(), choiceKind: 'echo', choose: 0 }]);
    expect(s.playerExtra.ability).toBe('pulse');
    expect(s.wellOffers.every((o) => o.takenBy === null)).toBe(true);

    // O bicho morre: o poco abre de novo sozinho, sem precisar sair e voltar.
    stalker.alive = false;
    expect(wellInCombat(s)).toBe(false);
    expect(canChooseEcho(s)).toBe(true);
    stepRun(s, [{ ...emptyCommand(), choiceKind: 'echo', choose: 0 }]);
    expect(s.playerExtra.ability).toBe('flamethrower');
  });
  it('only a threat counts as combat: distance, passive miners, brood and hidden lurkers do not', () => {
    const s = arena();
    reveal(s);
    const place = (enemy: ReturnType<typeof spawnEnemy>, dx: number): void => {
      enemy.x = s.player.x + dx;
      enemy.y = s.player.y;
    };
    place(spawnEnemy(s, 'stalker', 0, 0, false), WELL_COMBAT_RADIUS + 1);
    const miner = spawnEnemy(s, 'miner', 0, 0, false);
    place(miner, 3);
    miner.mood = MINER_MOOD_PASSIVE;
    place(spawnEnemy(s, 'devourer_brood', 0, 0, false), 2);
    const lurker = spawnEnemy(s, 'mud_lamprey', 0, 0, false);
    place(lurker, 3);
    lurker.mood = LURKER_HIDDEN;
    expect(wellInCombat(s)).toBe(false);
    expect(canChooseEcho(s)).toBe(true);

    // O mesmo Minerador enfurecido, ou o mesmo espreitador exposto, fecham o poco.
    miner.mood = MINER_MOOD_ENRAGED;
    expect(wellInCombat(s)).toBe(true);
    miner.mood = MINER_MOOD_PASSIVE;
    lurker.mood = LURKER_EXPOSED;
    expect(wellInCombat(s)).toBe(true);
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
  it('sprint runs on the move stick at +70% for 8 s, ignoring the aim and granting no iframes', () => {
    const s = arena('slipstream');
    // Mira para o norte, direcional para o leste: o corpo vai para o leste.
    stepRun(s, [{ ...emptyCommand(), ability: true, aim: { x: 0, y: -1 } }]);
    expect(s.playerExtra.sprintUntil - s.tick).toBe(SLIPSTREAM_TICKS);
    expect(s.playerExtra.iframesUntil).toBeLessThanOrEqual(s.tick);
    const y0 = s.player.y;
    for (let n = 0; n < 10; n++) stepRun(s, [{ ...emptyCommand(), move: { x: 1, y: 0 } }]);
    expect(s.player.y).toBeCloseTo(y0, 5);
    const walked = arena('slipstream');
    for (let n = 0; n < 10; n++) stepRun(walked, [{ ...emptyCommand(), move: { x: 1, y: 0 } }]);
    expect((s.player.x - 40.5) / (walked.player.x - 40.5)).toBeCloseTo(SLIPSTREAM_SPEED_MUL, 2);
    // Correr nao e esquivar: nada de credito de evasao.
    expect(s.playerExtra.resonance.evasion).toBe(0);
    // O relogio acaba sozinho e o passo volta ao normal.
    for (let n = 0; n < SLIPSTREAM_TICKS; n++) stepRun(s, [emptyCommand()]);
    expect(s.playerExtra.sprintUntil).toBeLessThanOrEqual(s.tick);
  });
  it('sprint crosses deep water and shrugs off shallow water drag; walking drowns', () => {
    const lay = (state: SurvivalState): void => {
      const row = 40 * state.config.width;
      for (let x = 42; x <= 44; x++) state.surface[row + x] = SURF_DEEP_WATER;
      for (let x = 45; x <= 47; x++) state.surface[row + x] = SURF_WATER;
    };
    const s = arena('slipstream');
    lay(s);
    cast(s);
    const run = { ...emptyCommand(), move: { x: 1, y: 0 } };
    for (let n = 0; n < 40 && s.player.x < 48; n++) stepRun(s, [run]);
    expect(s.player.alive).toBe(true);
    expect(s.player.x).toBeGreaterThanOrEqual(48);
    // Sem correr, a primeira celula funda afoga.
    const d = arena('slipstream');
    lay(d);
    for (let n = 0; n < 40 && d.player.alive; n++) stepRun(d, [run]);
    expect(d.player.alive).toBe(false);
  });
  it('a sprint that ends over deep water sinks; walls still stop the runner; the clock is hashed', () => {
    const s = arena('slipstream');
    const row = 40 * s.config.width;
    for (let x = 42; x <= 60; x++) s.surface[row + x] = SURF_DEEP_WATER;
    cast(s);
    const run = { ...emptyCommand(), move: { x: 1, y: 0 } };
    // Entra na agua e PARA no meio dela, correndo no lugar ate o relogio vencer.
    for (let n = 0; n < 6; n++) stepRun(s, [run]);
    expect(s.player.alive).toBe(true);
    expect(s.player.x).toBeGreaterThan(42);
    while (s.playerExtra.sprintUntil > s.tick) stepRun(s, [emptyCommand()]);
    expect(s.player.alive).toBe(false);

    const w = arena('slipstream');
    for (let y = 35; y < 46; y++) w.solid[y * w.config.width + 43] = SOLID_ROCK;
    cast(w);
    for (let n = 0; n < 20; n++) stepRun(w, [run]);
    expect(w.player.x).toBeLessThan(43);
    const other = structuredClone(w);
    other.playerExtra = other.playerExtras[0];
    other.playerExtra.sprintUntil++;
    expect(hashAuthoritativeState(w)).not.toBe(hashAuthoritativeState(other));
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
