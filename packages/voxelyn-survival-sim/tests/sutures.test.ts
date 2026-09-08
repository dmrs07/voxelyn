import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import { damageEntity, spawnEnemy, startAction, updateEnemies } from '../src/entities';
import { impactSolid, impactSurface } from '../src/materials';
import { breakSolid } from '../src/cells';
import {
  createSutures,
  cloneSutures,
  cutSuture,
  hitSutures,
  loadedSutureAnchor,
  sewSuture,
  stepSutures,
  sutureObjective,
  stitcherStep,
} from '../src/sutures';
import {
  SOLID_NONE,
  SOLID_SUTURE_ANCHOR,
  SOLID_SUTURE_CRACKED,
  SOLID_STITCHED_ROCK,
  SURF_FIRE,
  SURF_DEEP_WATER,
  SURF_MINERAL_SILK,
} from '../src/constants';
import { sectorBiome, sectorProfile } from '../src/strata';
import { generateWorld } from '../src/worldgen';
import { sectorSeed } from '../src/sectors';
import type { Entity, SemanticEvent, SurvivalState, SutureRecipe } from '../src/types';

const fixture = (kind: 'roof' | 'gate' = 'roof', playerCount = 1) => {
  const state = createRun({ seed: 1, playerCount });
  state.solid.fill(SOLID_NONE);
  state.surface.fill(0);
  state.enemies = [];
  state.vents = [];
  state.contaminationWaves = 99;
  state.tick = 100;
  const w = state.config.width,
    cells = [10, 11, 12, 13, 14].map((x) => 12 * w + x);
  const recipe: SutureRecipe = {
    id: 0,
    a: cells[0] - 1,
    b: cells[4] + 1,
    cells,
    slabCells: kind === 'roof' ? cells.slice(1, 4) : [],
    kind,
    objective: kind === 'roof',
  };
  state.solid[recipe.a] = state.solid[recipe.b] = SOLID_SUTURE_ANCHOR;
  state.sutures = createSutures([recipe]);
  for (const i of cells) state.surface[i] = SURF_MINERAL_SILK;
  state.player.x = 12.5;
  state.player.y = 12.5;
  state.playerExtra.iframesUntil = 0;
  return state;
};

const beginPass = (state: SurvivalState, queen: Entity): void => {
  queen.x = 8.5;
  queen.y = 20.5;
  startAction(state, queen, 'tether', { x: 1, y: 0 }, 2, 30, [], 0);
  queen.nextActionAt = queen.action!.endsAt + 100;
};

const passFixture = (playerCount = 1) => {
  const state = fixture('roof', playerCount);
  state.players.forEach((p, slot) => {
    p.x = 12.5 + slot * 4;
    p.y = 20.5;
    state.playerExtras[slot].iframesUntil = 0;
  });
  const queen = spawnEnemy(state, 'seamstress', 8, 20, false);
  beginPass(state, queen);
  return { state, queen };
};

const finishPass = (state: SurvivalState, queen: Entity): SemanticEvent[] => {
  const events: SemanticEvent[] = [];
  const end = queen.action!.endsAt;
  while (state.tick < end) {
    state.tick++;
    updateEnemies(state, events);
  }
  return events;
};

describe('Colônia dos Costureiros', () => {
  it('generates a bounded overlay reproducibly without changing floor connectivity', () => {
    for (const seed of [1, 5, 13, 42, 71]) {
      const profile = sectorProfile(seed, 3);
      const plain = generateWorld(sectorSeed(seed, 3), 96, 96, { ...profile, sutureCount: 0 });
      const world = generateWorld(sectorSeed(seed, 3), 96, 96, { ...profile, sutureCount: 10 });
      const again = generateWorld(sectorSeed(seed, 3), 96, 96, { ...profile, sutureCount: 10 });
      expect(world.sutures).toEqual(again.sutures);
      expect(world.sutures.length).toBeGreaterThan(0);
      expect(world.sutures.length).toBeLessThanOrEqual(10);
      expect([...world.solid].map((x) => x === 0)).toEqual([...plain.solid].map((x) => x === 0));
      const occupied = new Set<number>();
      for (const s of world.sutures) {
        expect(s.cells.length).toBeGreaterThanOrEqual(3);
        for (const cell of s.cells) {
          expect(occupied.has(cell)).toBe(false);
          occupied.add(cell);
          expect(world.surface[cell]).not.toBe(SURF_DEEP_WATER);
        }
        expect(world.solid[s.a]).toBe(SOLID_SUTURE_ANCHOR);
        expect(world.solid[s.b]).toBe(SOLID_SUTURE_ANCHOR);
      }
    }
  });

  it('can invade multiple strata and supplies its own boss through normal generation', () => {
    const strata = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const biome = sectorBiome(seed, 7);
      if (biome.occupation !== 'stitchers') continue;
      strata.add(biome.stratum);
      const state = createRun({
        seed,
        sector: 7,
        depth: { generation: 'G-04', sectorCount: 7, coreSectors: [3, 7] },
      });
      expect(state.sectorBoss.archetype).toBe('seamstress');
      expect(state.sutures.length).toBeGreaterThan(0);
      expect(state.enemies.some((e) => e.archetype === 'stitcher')).toBe(true);
    }
    expect(strata.size).toBeGreaterThanOrEqual(5);
  });

  it('warns before a taut cable whips and the suspended slab falls; both hit creatures too', () => {
    const state = fixture(),
      events: SemanticEvent[] = [];
    const mob = spawnEnemy(state, 'bruiser', 12, 12, false);
    const hp = state.player.hp,
      enemyHp = mob.hp;
    cutSuture(state, state.sutures[0], events, 0);
    stepSutures(state, events);
    expect(state.player.hp).toBe(hp);
    state.tick += 15;
    stepSutures(state, events);
    expect(state.player.hp).toBe(hp);
    state.tick++;
    stepSutures(state, events);
    expect(state.player.hp).toBeLessThan(hp);
    expect(mob.hp).toBeLessThan(enemyHp);
    expect(events.some((e) => e.t === 'suture' && e.phase === 'snap')).toBe(true);
    state.tick = 132;
    stepSutures(state, events);
    expect(events.some((e) => e.t === 'suture' && e.phase === 'fall')).toBe(true);
    expect(state.sutures[0].phase).toBe('spent');
  });

  it('a loose thread can be cut without inventing a whip or a falling slab', () => {
    const state = fixture('gate'),
      events: SemanticEvent[] = [];
    cutSuture(state, state.sutures[0], events);
    state.tick += 40;
    stepSutures(state, events);
    expect(events.filter((e) => e.t === 'hit')).toHaveLength(0);
    expect(state.sutures[0].phase).toBe('spent');
  });

  it('two basic impacts visibly crack then break an anchor and release its load', () => {
    const state = fixture(),
      s = state.sutures[0],
      events: SemanticEvent[] = [];
    const x = s.a % state.config.width,
      y = Math.floor(s.a / state.config.width);
    impactSolid(state, x, y, 'kinetic', events);
    expect(state.solid[s.a]).toBe(SOLID_SUTURE_CRACKED);
    impactSolid(state, x, y, 'kinetic', events);
    stepSutures(state, events);
    expect(state.solid[s.a]).toBe(SOLID_NONE);
    expect(s.phase).toBe('cut');
    expect(s.fallAt).toBe(132);
  });

  it('swept shots cut cables even when they travel parallel to the line', () => {
    for (const [from, to] of [
      [
        { x: 12.5, y: 11.9 },
        { x: 12.5, y: 13.1 },
      ],
      [
        { x: 11.5, y: 12.5 },
        { x: 12.5, y: 12.5 },
      ],
    ]) {
      const state = fixture();
      hitSutures(state, from, to, [], 0);
      expect(state.sutures[0].phase).toBe('cut');
    }
  });

  it('a dead worker leaves completed masonry, with no closure under living bodies', () => {
    const state = fixture('gate'),
      s = state.sutures[0],
      events: SemanticEvent[] = [];
    const worker = spawnEnemy(state, 'stitcher', 10, 12, false);
    worker.action = {
      kind: 'stitch',
      phase: 'release',
      startedAt: 80,
      releaseAt: 100,
      endsAt: 110,
      direction: { x: 1, y: 0 },
      target: 0,
    };
    for (let n = 0; n < 3; n++) sewSuture(state, worker, events);
    expect(s.phase).toBe('taut');
    expect(s.closeAt).toBe(124);
    damageEntity(state, worker, 1000, events);
    state.tick = 124;
    stepSutures(state, events);
    expect(state.solid[12 * state.config.width + 12]).toBe(SOLID_NONE);
    expect(s.cells.some((i) => state.solid[i] === SOLID_STITCHED_ROCK)).toBe(true);
    for (const i of s.cells)
      if (state.solid[i])
        expect(
          impactSolid(
            state,
            i % state.config.width,
            Math.floor(i / state.config.width),
            'kinetic',
            events,
          ).broke,
        ).toBe(true);
  });

  it('killing an active worker interrupts an unfinished job', () => {
    const state = fixture('gate'),
      worker = spawnEnemy(state, 'stitcher', 10, 12, false);
    state.player.x = 16.5;
    stitcherStep(state, worker, state.player, 0.05, []);
    expect(worker.action?.kind).toBe('stitch');
    damageEntity(state, worker, 1000, []);
    state.tick += 50;
    updateEnemies(state, []);
    expect(state.sutures[0].tension).toBe(0);
  });

  it('cutting the loaded support drops the queen and increases damage for three seconds', () => {
    const state = fixture(),
      queen = spawnEnemy(state, 'seamstress', 15, 10, false);
    queen.mood = 1;
    const initial = queen.hp;
    damageEntity(state, queen, 20, []);
    const armored = initial - queen.hp;
    hitSutures(state, { x: 15, y: 11.5 }, { x: 16, y: 11.5 }, [], 0);
    expect(queen.mood).toBe(0);
    expect(queen.stunnedUntil).toBe(160);
    const before = queen.hp;
    damageEntity(state, queen, 20, []);
    expect(before - queen.hp).toBeGreaterThan(armored * 2);
  });

  it('a puxada liga a ancora no rumo correto e aceita tiros colineares na diagonal', () => {
    const state = fixture(),
      queen = spawnEnemy(state, 'seamstress', 12, 9, false),
      s = state.sutures[0];
    queen.mood = 1;
    queen.action = {
      kind: 'tether',
      phase: 'windup',
      startedAt: 100,
      releaseAt: 124,
      endsAt: 140,
      target: 0,
      direction: { x: -1, y: 1 },
    };
    const anchor = loadedSutureAnchor(state, queen, s);
    expect(anchor.x).toBe(9.5);
    const point = (t: number) => ({
      x: queen.x + (anchor.x - queen.x) * t,
      y: queen.y + (anchor.y - queen.y) * t,
    });
    hitSutures(state, point(0.3), point(0.65), [], 0);
    expect(s.phase).toBe('cut');
    expect(queen.action).toBeUndefined();
  });

  it('a segunda fase avisa uma vez e usa eventos de boss para a puxada', () => {
    const state = fixture(),
      queen = spawnEnemy(state, 'seamstress', 12, 8, false),
      events: SemanticEvent[] = [];
    state.bossRuntime.awake = true;
    queen.hp = queen.maxHp * 0.45;
    state.player.x = 15.5;
    state.player.y = 16.5;
    stitcherStep(state, queen, state.player, 0.05, events);
    expect(queen.action?.kind).toBe('tether');
    expect(queen.action!.releaseAt - state.tick).toBe(16);
    expect(events.some((e) => e.t === 'boss_windup' && e.ability === 'tether')).toBe(true);
    stitcherStep(state, queen, state.player, 0.05, events);
    expect(events.filter((e) => e.t === 'boss_phase')).toHaveLength(1);
  });

  it('a puxada causa um unico impacto de 20 por passagem e rearma na proxima', () => {
    const { state, queen } = passFixture();
    const hp = state.player.hp;
    const first = finishPass(state, queen);
    expect(state.player.hp).toBe(hp - 20);
    expect(first.filter((e) => e.t === 'hit' && e.target === state.player.id)).toHaveLength(1);
    beginPass(state, queen);
    const second = finishPass(state, queen);
    expect(state.player.hp).toBe(hp - 40);
    expect(second.filter((e) => e.t === 'hit' && e.target === state.player.id)).toHaveLength(1);
  });

  it('cada parceiro pode receber um impacto, mesmo em pontos diferentes da puxada', () => {
    const { state, queen } = passFixture(2);
    const hp = state.players.map((p) => p.hp);
    const events = finishPass(state, queen);
    state.players.forEach((p, slot) => {
      expect(p.hp).toBe(hp[slot] - 20);
      expect(events.filter((e) => e.t === 'hit' && e.target === p.id)).toHaveLength(1);
    });
  });

  it('esquivar do primeiro contato evita dano tardio quando os iframes terminam', () => {
    const { state, queen } = passFixture();
    state.player.x = 9.5;
    state.playerExtra.iframesUntil = queen.action!.releaseAt + 1;
    const hp = state.player.hp;
    const events = finishPass(state, queen);
    expect(state.player.hp).toBe(hp);
    expect(events.filter((e) => e.t === 'hit')).toHaveLength(0);
  });

  it('o hash distingue uma puxada que ja resolveu contato sem mudar o HP', () => {
    const a = passFixture(),
      b = passFixture();
    expect(hashAuthoritativeState(a.state)).toBe(hashAuthoritativeState(b.state));
    b.queen.action!.contactedSlots = 1;
    expect(a.state.player.hp).toBe(b.state.player.hp);
    expect(hashAuthoritativeState(a.state)).not.toBe(hashAuthoritativeState(b.state));
  });

  it.each(['zero hp', 'dead', 'downed', 'not joined'])(
    'a puxada ignora um jogador %s sem registrar dano',
    (condition) => {
      const { state, queen } = passFixture();
      if (condition === 'zero hp') state.player.hp = 0;
      if (condition === 'dead') state.player.alive = false;
      if (condition === 'downed') state.playerExtra.downed = true;
      if (condition === 'not joined') state.playerExtra.joined = false;
      const before = state.stats.damageTakenTenths;
      const events = finishPass(state, queen);
      expect(events.filter((e) => e.t === 'hit')).toHaveLength(0);
      expect(state.stats.damageTakenTenths).toBe(before);
    },
  );

  it.each(['flamethrower', 'thermal impact'])(
    '%s acende a seda mineral e solta a carga com os avisos normais',
    (source) => {
      const state = fixture(),
        events: SemanticEvent[] = [],
        s = state.sutures[0];
      if (source === 'flamethrower') {
        state.player.y = 9.5;
        state.playerExtra.ability = 'flamethrower';
        const command = emptyCommand();
        command.ability = true;
        command.aim = { x: 0, y: 1 };
        events.push(...stepRun(state, [command]).events);
      } else {
        impactSurface(state, 12, 12, 'thermal', events);
        stepSutures(state, events);
      }
      expect(state.surface[s.cells[2]]).toBe(SURF_FIRE);
      expect(s.phase).toBe('cut');
      expect(s.whipAt).toBe(state.tick + 16);
      expect(s.fallAt).toBe(state.tick + 32);
      expect(events.some((e) => e.t === 'suture' && e.phase === 'cut')).toBe(true);
      expect(events.some((e) => e.t === 'suture' && e.phase === 'fall')).toBe(false);
    },
  );

  it('fire and explosion damage can release a seam; the reward is paid only once', () => {
    const state = fixture(),
      events: SemanticEvent[] = [];
    state.surface[state.sutures[0].cells[0]] = SURF_FIRE;
    stepSutures(state, events);
    state.tick += 32;
    stepSutures(state, events);
    expect(sutureObjective(state).rewarded).toBe(true);
    const total = state.stats.oreCollected;
    state.sutures = createSutures(state.sutures);
    breakSolid(state, state.sutures[0].a % state.config.width, 12, events);
    stepSutures(state, events);
    state.tick += 32;
    stepSutures(state, events);
    expect(state.stats.oreCollected).toBe(total);
  });

  it('hashes every deadline and copies runtime data without aliasing', () => {
    const a = fixture(),
      b = fixture();
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
    b.sutures[0].fallAt++;
    expect(hashAuthoritativeState(a)).not.toBe(hashAuthoritativeState(b));
    const copy = cloneSutures(a.sutures);
    copy[0].cells[0]++;
    copy[0].tension--;
    expect(copy[0].cells[0]).not.toBe(a.sutures[0].cells[0]);
    for (let n = 0; n < 100; n++) {
      stepRun(a, [emptyCommand()]);
    }
    expect(Number.isFinite(a.player.hp)).toBe(true);
  });
});
