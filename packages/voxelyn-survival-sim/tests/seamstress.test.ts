import { describe, expect, it } from 'vitest';
import { createRun, hashAuthoritativeState } from '../src/run';
import {
  bodyBlocked,
  damageEntity,
  spawnEnemy,
  startAction,
  stunEntity,
  updateEnemies,
} from '../src/entities';
import {
  createSutures,
  cutSuture,
  hitSutures,
  loadedSutureAnchor,
  stepSutures,
  stitcherStep,
  sutureObjective,
  suturePoint,
  tetherEndpoint,
} from '../src/sutures';
import {
  dropSeamstress,
  SEAMSTRESS_DROP_TICKS,
  silkLift,
  silkCanLand,
  silkLanding,
  summonSilkBrood,
} from '../src/seamstress';
import { SOLID_NONE, SOLID_ROCK, SOLID_SUTURE_ANCHOR } from '../src/constants';
import type { Entity, SemanticEvent, SurvivalState } from '../src/types';

const fixture = (players = 1) => {
  const state = createRun({ seed: 1, playerCount: players });
  state.solid.fill(SOLID_NONE);
  state.surface.fill(0);
  state.enemies = [];
  state.tick = 100;
  const w = state.config.width;
  const cells = [13, 14, 15, 16, 17, 18].map((x) => 20 * w + x);
  state.sutures = createSutures([
    {
      id: 0,
      a: cells[0] - 1,
      b: cells[5] + 1,
      cells,
      slabCells: cells.slice(2, 4),
      kind: 'roof',
      objective: true,
    },
  ]);
  state.solid[state.sutures[0].a] = state.solid[state.sutures[0].b] = SOLID_SUTURE_ANCHOR;
  const queen = spawnEnemy(state, 'seamstress', 10, 20, false);
  state.bossRuntime.awake = true;
  state.players.forEach((p, slot) => {
    p.x = 16.3;
    p.y = 20.5 + slot * 0.2;
    state.playerExtras[slot].iframesUntil = 0;
  });
  return { state, queen };
};
const arm = (state: SurvivalState, queen: Entity) => {
  startAction(state, queen, 'tether', { x: 1, y: 0 }, 4, 30, [], state.player.id);
  queen.action!.silkFlight = {
    fromX: queen.x,
    fromY: queen.y,
    toX: 15.5,
    toY: 20.5,
    landAt: state.tick + 14,
    impactAt: state.tick + 18,
    anchor: state.sutures[0].b,
  };
  queen.nextActionAt = state.tick + 100;
};
const until = (state: SurvivalState, tick: number): SemanticEvent[] => {
  const events: SemanticEvent[] = [];
  while (state.tick < tick) {
    state.tick++;
    updateEnemies(state, events);
  }
  return events;
};

describe('Cerzideira: single support, arrival strike and jumping brood', () => {
  it.each([66, 177])(
    'seed %i generates enough supports to attack twice and summon helpers',
    (seed) => {
      const state = createRun({ seed, sector: 3 });
      const queen = state.enemies.find((e) => e.archetype === 'seamstress')!;
      expect(queen).toBeDefined();
      const anchors = [
        ...new Set(state.sutures.filter((s) => s.encounter).flatMap((s) => [s.a, s.b])),
      ].filter((i) => {
        const p = suturePoint(state, i);
        const distance = Math.hypot(p.x - queen.x, p.y - queen.y);
        return state.solid[i] === SOLID_SUTURE_ANCHOR && distance >= 3 && distance <= 24;
      });
      expect(anchors.length).toBeGreaterThanOrEqual(2);
      expect(hashAuthoritativeState(createRun({ seed, sector: 3 }))).toBe(
        hashAuthoritativeState(state),
      );
      expect(silkCanLand(state, queen, queen.x, queen.y)).toBe(true);

      // Use the generated terrain and the real AI, without arming a tether or injecting helpers.
      state.playerExtra.iframesUntil = 10000;
      state.enemies = [queen];
      const origin = { x: queen.x, y: queen.y };
      const events: SemanticEvent[] = [];
      for (let n = 0; n < 8; n++) {
        const target = silkLanding(state, state.player, {
          x: origin.x + Math.cos((n * Math.PI) / 4) * 6,
          y: origin.y + Math.sin((n * Math.PI) / 4) * 6,
        });
        if (!target) continue;
        state.player.x = target.x;
        state.player.y = target.y;
        events.push(...until(state, state.tick + 80));
        if (state.enemies.some((e) => e.summonerId === queen.id)) break;
      }
      expect(queen.silk!.lunges).toBeGreaterThanOrEqual(2);
      expect(
        events.filter((e) => e.t === 'boss_attack' && e.ability === 'tether').length,
      ).toBeGreaterThanOrEqual(2);
      const helpers = state.enemies.filter((e) => e.alive && e.summonerId === queen.id);
      expect(helpers.some((e) => e.archetype === 'seamstress_brood')).toBe(true);
      expect(helpers.length).toBeLessThanOrEqual(4);
    },
  );
  it('removes chamber hazards while preserving independent colony sutures', () => {
    const { state } = fixture();
    const chamber = state.sutures[0];
    expect(chamber.encounter).toBe(true);
    expect(cutSuture(state, chamber, [])).toBe(false);
    expect(sutureObjective(state).total).toBe(0);
    chamber.closeAt = chamber.whipAt = chamber.fallAt = 100;
    const hp = state.player.hp;
    stepSutures(state, []);
    expect(state.player.hp).toBe(hp);
    expect(state.solid[chamber.cells[2]]).toBe(SOLID_NONE);
  });
  it('keeps the selected anchor and landing even after direction or position changes', () => {
    const { state, queen } = fixture();
    arm(state, queen);
    queen.action!.direction = { x: -1, y: 0 };
    queen.x = 17;
    expect(loadedSutureAnchor(state, queen, state.sutures[0])).toEqual({ x: 19.5, y: 20.5 });
    expect(tetherEndpoint(state, queen, state.sutures[0])).toEqual({ x: 15.5, y: 20.5 });
  });
  it('flies through internal rock, does not hit bodies in transit, and strikes on exactly one tick', () => {
    const { state, queen } = fixture();
    arm(state, queen);
    for (const y of [19, 20, 21]) state.solid[y * state.config.width + 13] = SOLID_ROCK;
    state.player.x = 11.5;
    until(state, 109);
    expect(queen.x).toBeGreaterThan(12.5);
    expect(silkLift(queen, state.tick)).toBeGreaterThan(30);
    expect(state.player.hp).toBe(state.player.maxHp);
    state.player.x = 16.3;
    const before = until(state, 117);
    expect(before.some((e) => e.t === 'boss_attack')).toBe(false);
    expect(state.player.hp).toBe(state.player.maxHp);
    const impact = until(state, 118);
    expect(impact.filter((e) => e.t === 'boss_attack')).toHaveLength(1);
    expect(impact.filter((e) => e.t === 'hit')).toHaveLength(1);
    expect(state.player.hp).toBe(state.player.maxHp - 24);
    until(state, 132);
    expect(state.player.hp).toBe(state.player.maxHp - 24);
    expect(bodyBlocked(state, queen, queen.x, queen.y)).toBe(false);
  });
  it('resolves every live partner once and consumes a dodged impact', () => {
    const { state, queen } = fixture(2);
    arm(state, queen);
    state.playerExtras[0].iframesUntil = 119;
    until(state, 132);
    expect(state.players[0].hp).toBe(state.players[0].maxHp);
    expect(state.players[1].hp).toBe(state.players[1].maxHp - 24);
  });
  it('cutting the exposed cable cancels the strike, lands safely, and exposes 36 ticks', () => {
    const { state, queen } = fixture();
    arm(state, queen);
    until(state, 109);
    for (const y of [19, 20, 21])
      state.solid[y * state.config.width + Math.floor(queen.x)] = SOLID_ROCK;
    const armored = queen.hp;
    damageEntity(state, queen, 20, []);
    expect(armored - queen.hp).toBe(11);
    const events: SemanticEvent[] = [];
    hitSutures(state, { x: 17.5, y: 19.5 }, { x: 17.5, y: 21.5 }, events, 0);
    expect(queen.action).toBeUndefined();
    expect(queen.stunnedUntil).toBe(109 + SEAMSTRESS_DROP_TICKS);
    expect(bodyBlocked(state, queen, queen.x, queen.y)).toBe(false);
    expect(state.sutures[0].phase).toBe('taut');
    expect(state.sutures[0].whipAt).toBe(-1);
    const hp = queen.hp;
    damageEntity(state, queen, 20, []);
    expect(hp - queen.hp).toBe(30);
    expect(until(state, 132).some((e) => e.t === 'hit' || e.t === 'boss_attack')).toBe(false);
  });
  it.each(['support breaks', 'stun', 'landing blocked'])(
    'settles safely if %s changes in flight',
    (reason) => {
      const { state, queen } = fixture();
      arm(state, queen);
      until(state, 109);
      if (reason === 'support breaks') state.solid[state.sutures[0].b] = SOLID_NONE;
      else if (reason === 'stun') {
        state.solid[Math.floor(queen.y) * state.config.width + Math.floor(queen.x)] = SOLID_ROCK;
        stunEntity(state, queen, 12);
      } else for (const y of [19, 20, 21]) state.solid[y * state.config.width + 15] = SOLID_ROCK;
      const hp = state.player.hp;
      until(state, 119);
      expect(bodyBlocked(state, queen, queen.x, queen.y)).toBe(false);
      expect(state.player.hp).toBe(hp);
    },
  );
  it('teaches two lunges alone, then spawns at most three brood and one stitcher', () => {
    const { state, queen } = fixture();
    queen.silk!.lunges = 1;
    summonSilkBrood(state, queen, []);
    expect(state.enemies.filter((e) => e.summonerId)).toHaveLength(0);
    queen.silk!.lunges = 2;
    summonSilkBrood(state, queen, []);
    summonSilkBrood(state, queen, []);
    const helpers = state.enemies.filter((e) => e.summonerId === queen.id);
    expect(helpers).toHaveLength(4);
    expect(helpers.filter((e) => e.archetype === 'stitcher')).toHaveLength(1);
    expect(helpers.filter((e) => e.archetype === 'seamstress_brood')).toHaveLength(3);
    expect(new Set(helpers.map((e) => `${e.x},${e.y}`)).size).toBe(4);
    damageEntity(state, queen, 10000, []);
    expect(state.stats.kills.seamstress_brood).toBe(0);
    expect(helpers.every((e) => !e.alive && !e.action)).toBe(true);
  });
  it.each(['seamstress_brood', 'stitcher'] as const)(
    '%s locks the jump mark and allows dodging the landing',
    (kind) => {
      const { state, queen } = fixture();
      queen.nextActionAt = 10000;
      const helper = spawnEnemy(state, kind, 13, 20, false);
      helper.summonerId = queen.id;
      stitcherStep(state, helper, state.player, 0.05, []);
      const flight = { ...helper.action!.silkFlight! };
      expect(helper.action!.releaseAt - state.tick).toBe(kind === 'stitcher' ? 22 : 14);
      state.player.y += 4;
      until(state, flight.impactAt + 1);
      expect(helper.action!.silkFlight).toEqual(flight);
      expect(helper.x).toBeCloseTo(flight.toX);
      expect(helper.y).toBeCloseTo(flight.toY);
      expect(state.player.hp).toBe(state.player.maxHp);
    },
  );
  it('chains different supports below half HP and repositions after a drop', () => {
    const { state, queen } = fixture();
    queen.hp = queen.maxHp * 0.45;
    stitcherStep(state, queen, state.player, 0.05, []);
    const first = queen.action!.silkFlight!.anchor;
    expect(queen.silk!.comboLeft).toBe(1);
    queen.action = undefined;
    queen.nextActionAt = state.tick;
    queen.x = 17;
    state.player.x = 14;
    stitcherStep(state, queen, state.player, 0.05, []);
    expect(queen.action!.silkFlight!.anchor).not.toBe(first);
    expect(queen.action!.releaseAt - state.tick).toBe(12);
    dropSeamstress(state, queen, []);
    expect(queen.silk!.comboLeft).toBe(0);
    state.tick = queen.stunnedUntil;
    const at = { x: queen.x, y: queen.y };
    stitcherStep(state, queen, state.player, 0.05, []);
    expect(queen.action).toBeUndefined();
    expect(Math.hypot(queen.x - at.x, queen.y - at.y)).toBeGreaterThan(0);
  });
  it('walks around isolated pillars after a drop without clipping the body', () => {
    const { state, queen } = fixture();
    state.sutures = [];
    state.solid.fill(0);
    state.solid[20 * state.config.width + 13] = SOLID_ROCK;
    state.player.x = 17.5;
    for (let i = 0; i < 100; i++) {
      state.tick++;
      updateEnemies(state, []);
      expect(silkCanLand(state, queen, queen.x, queen.y)).toBe(true);
    }
    expect(queen.x).toBeGreaterThan(14);
  });
  it.each(['zero hp', 'dead', 'downed', 'not joined'])(
    'does not strike a player who is %s',
    (condition) => {
      const { state, queen } = fixture();
      arm(state, queen);
      if (condition === 'zero hp') state.player.hp = 0;
      if (condition === 'dead') state.player.alive = false;
      if (condition === 'downed') state.playerExtra.downed = true;
      if (condition === 'not joined') state.playerExtra.joined = false;
      expect(until(state, 119).filter((e) => e.t === 'hit')).toHaveLength(0);
    },
  );
  it('hashes locked targets, anchor, deadlines, ownership and encounter cadence', () => {
    const a = fixture(),
      b = fixture();
    arm(a.state, a.queen);
    arm(b.state, b.queen);
    const baseline = hashAuthoritativeState(a.state);
    expect(baseline).toBe(hashAuthoritativeState(b.state));
    for (const key of ['toX', 'toY', 'fromX', 'fromY', 'landAt', 'impactAt', 'anchor'] as const) {
      b.queen.action!.silkFlight![key]!++;
      expect(hashAuthoritativeState(b.state), key).not.toBe(baseline);
      b.queen.action!.silkFlight![key]!--;
    }
    b.queen.silk!.lunges++;
    expect(hashAuthoritativeState(b.state)).not.toBe(baseline);
  });
});
