import { describe, expect, it } from 'vitest';
import { createRun, hashAuthoritativeState } from '../src/run';
import { damageEntity, spawnEnemy, startAction, stunEntity, updateEnemies } from '../src/entities';
import { breakSolid } from '../src/cells';
import { impactSolid } from '../src/materials';
import { createSutures, cutSuture, hitSutures, suturePoint } from '../src/sutures';
import { SOLID_NONE, SOLID_ROCK, SOLID_SUTURE_ANCHOR } from '../src/constants';
import { SEAMSTRESS_STAGE_FRENZY } from '../src/seamstress';
import { supportHolds, weaveWeb } from '../src/web';
import {
  registerWebJunctions,
  WEB_ANCHOR_HP,
  WEB_JUNCTION_HP,
  webSupportAt,
} from '../src/web-supports';
import {
  WEB_STRAND_REPAIR_TICKS,
  WEB_SUPPORT_REPAIR_TICKS,
  webRepairProgress,
} from '../src/web-repair';
import type { SurvivalState } from '../src/types';

const fixture = () => {
  const state = createRun({ seed: 1 });
  state.solid.fill(SOLID_NONE);
  state.surface.fill(0);
  state.sutures = [];
  state.enemies = [];
  state.tick = 100;
  const w = state.config.width,
    anchor = 20 * w + 30;
  state.solid[anchor] = SOLID_SUTURE_ANCHOR;
  const queen = spawnEnemy(state, 'seamstress', 20, 20, false);
  queen.silk!.stage = SEAMSTRESS_STAGE_FRENZY;
  queen.silk!.broodAt = queen.nextActionAt = 100000;
  state.bossRuntime.awake = true;
  const lines = [
    [22, 23, 24, 25, 26].map((x) => 20 * w + x),
    [22, 23, 24, 25, 26].map((x) => 24 * w + x),
    [20, 21, 22, 23, 24].map((y) => y * w + 26),
  ];
  state.sutures = createSutures(
    lines.map((cells, id) => ({
      id,
      a: cells[0],
      b: cells[cells.length - 1],
      cells,
      slabCells: cells,
      kind: 'web',
      objective: false,
    })),
  );
  for (const s of state.sutures) {
    s.phase = 'taut';
    s.tension = 100;
  }
  registerWebJunctions(state, queen);
  const worker = spawnEnemy(state, 'stitcher', 22, 19, false);
  worker.summonerId = queen.id;
  worker.nextActionAt = state.tick;
  state.player.x = 24.5;
  state.player.y = 21.5;
  state.playerExtra.iframesUntil = 100000;
  return { state, queen, worker, anchor, strand: state.sutures[0] };
};
const until = (state: SurvivalState, at: number) => {
  while (state.tick < at) {
    state.tick++;
    updateEnemies(state, []);
  }
};
const destroyAnchor = (state: SurvivalState, anchor: number) => {
  for (let n = 0; n < WEB_ANCHOR_HP; n++)
    breakSolid(state, anchor % state.config.width, Math.floor(anchor / state.config.width), []);
};

describe('reinforced supports and repair-first Stitchers', () => {
  it('requires six impacts for a chamber anchor through projectile and direct damage paths', () => {
    const { state, anchor } = fixture();
    const p = suturePoint(state, anchor);
    for (let n = 1; n <= WEB_ANCHOR_HP; n++) {
      const broke =
        n % 2
          ? impactSolid(state, Math.floor(p.x), Math.floor(p.y), 'kinetic', []).broke
          : breakSolid(state, Math.floor(p.x), Math.floor(p.y), []);
      expect(broke).toBe(n === WEB_ANCHOR_HP);
      expect(webSupportAt(state, anchor)!.hp).toBe(WEB_ANCHOR_HP - n);
      expect(supportHolds(state, anchor)).toBe(n < WEB_ANCHOR_HP);
    }
    expect(state.solid[anchor]).toBe(SOLID_NONE);
  });

  it('keeps colony anchors on the existing two-shot rule', () => {
    const { state, anchor } = fixture();
    state.enemies = [];
    const p = suturePoint(state, anchor);
    expect(impactSolid(state, Math.floor(p.x), Math.floor(p.y), 'kinetic', []).broke).toBe(false);
    expect(impactSolid(state, Math.floor(p.x), Math.floor(p.y), 'kinetic', []).broke).toBe(true);
  });

  it('a junction absorbs three aimed impacts, then severs its attached strand', () => {
    const { state, strand } = fixture();
    const p = suturePoint(state, strand.a);
    for (let n = 1; n <= WEB_JUNCTION_HP; n++) {
      hitSutures(state, { x: p.x, y: p.y - 1 }, { x: p.x, y: p.y + 1 }, [], 0);
      expect(webSupportAt(state, strand.a)!.hp).toBe(WEB_JUNCTION_HP - n);
      expect(supportHolds(state, strand.a)).toBe(n < WEB_JUNCTION_HP);
      expect(strand.phase).toBe(n < WEB_JUNCTION_HP ? 'taut' : 'loose');
    }
  });

  it('one slow projectile counts once while traversing a junction over multiple ticks', () => {
    const { state, strand } = fixture();
    const p = suturePoint(state, strand.a);
    for (const [from, to] of [
      [-0.6, -0.3],
      [-0.3, 0],
      [0, 0.3],
      [0.3, 0.6],
    ])
      hitSutures(state, { x: p.x, y: p.y + from }, { x: p.x, y: p.y + to }, [], 0);
    expect(webSupportAt(state, strand.a)!.hp).toBe(WEB_JUNCTION_HP - 1);
    expect(strand.phase).toBe('taut');
  });

  it('an aimed support hit only drops the attached boss when the junction actually breaks', () => {
    const { state, queen, strand } = fixture();
    const p = suturePoint(state, strand.b);
    startAction(state, queen, 'tether', { x: 1, y: 0 }, 5, 40, [], state.player.id);
    queen.action!.silkFlight = {
      fromX: queen.x,
      fromY: queen.y,
      toX: 24.5,
      toY: 20.5,
      landAt: state.tick + 25,
      impactAt: state.tick + 29,
      anchor: strand.b,
    };
    for (let n = 1; n <= WEB_JUNCTION_HP; n++) {
      hitSutures(state, { x: p.x, y: p.y - 1 }, { x: p.x, y: p.y + 1 }, [], 0);
      expect(queen.action?.silkFlight !== undefined).toBe(n < WEB_JUNCTION_HP);
    }
    expect(queen.stunnedUntil).toBeGreaterThan(state.tick);
  });

  it('ordinary strand sections still open a lane with one crossing shot', () => {
    const { state, strand } = fixture();
    hitSutures(state, { x: 24.5, y: 19.5 }, { x: 24.5, y: 21.5 }, [], 0);
    expect(strand.phase).toBe('loose');
    expect(webSupportAt(state, strand.a)!.hp).toBe(WEB_JUNCTION_HP);
  });

  it('scheduled weaving cannot restore strands attached to a junction destroyed during ascent', () => {
    const { state, strand } = fixture();
    const pending = state.sutures[2];
    pending.phase = 'spent';
    pending.tension = 0;
    pending.resewAt = state.tick + 1;
    const p = suturePoint(state, strand.b);
    for (let n = 0; n < WEB_JUNCTION_HP; n++)
      hitSutures(state, { x: p.x, y: p.y - 1 }, { x: p.x, y: p.y + 1 }, [], 0);
    state.tick++;
    weaveWeb(state, []);
    expect(pending.phase).toBe('loose');
    expect(pending.resewAt).toBe(-1);
    expect(webSupportAt(state, strand.b)!.hp).toBe(0);
  });

  it('repairs in two seconds even with a player next to the worker; progress matches completion', () => {
    const { state, worker, strand } = fixture();
    state.player.x = worker.x + 0.7;
    state.player.y = worker.y;
    cutSuture(state, strand, [], 0);
    updateEnemies(state, []);
    expect(worker.webRepair?.kind).toBe('strand');
    expect(worker.action?.kind).toBe('stitch');
    const start = state.tick;
    until(state, start + WEB_STRAND_REPAIR_TICKS / 2);
    expect(webRepairProgress(state, worker)).toBe(0.5);
    until(state, start + WEB_STRAND_REPAIR_TICKS - 1);
    expect(strand.phase).toBe('loose');
    until(state, start + WEB_STRAND_REPAIR_TICKS);
    expect(strand.phase).toBe('taut');
    expect(worker.webRepair).toBeUndefined();
    expect(webRepairProgress(state, worker)).toBeNull();
  });

  it('rebuilds a destroyed anchor at its recorded site after three seconds', () => {
    const { state, worker, anchor } = fixture();
    destroyAnchor(state, anchor);
    worker.x = 29.5;
    worker.y = 20.5;
    updateEnemies(state, []);
    expect(worker.webRepair).toMatchObject({ kind: 'support', target: anchor });
    const start = state.tick;
    until(state, start + WEB_SUPPORT_REPAIR_TICKS - 1);
    expect(state.solid[anchor]).toBe(SOLID_NONE);
    until(state, start + WEB_SUPPORT_REPAIR_TICKS);
    expect(state.solid[anchor]).toBe(SOLID_SUTURE_ANCHOR);
    expect(webSupportAt(state, anchor)!.hp).toBe(WEB_ANCHOR_HP);
    expect(supportHolds(state, anchor)).toBe(true);
  });

  it('rebuilds the junction before its attached strands and restores it as a pull support', () => {
    const { state, worker, strand } = fixture();
    const p = suturePoint(state, strand.a);
    for (let n = 0; n < WEB_JUNCTION_HP; n++)
      hitSutures(state, { x: p.x, y: p.y - 1 }, { x: p.x, y: p.y + 1 }, [], 0);
    updateEnemies(state, []);
    expect(worker.webRepair).toMatchObject({ kind: 'support', target: strand.a });
    until(state, state.tick + WEB_SUPPORT_REPAIR_TICKS);
    expect(webSupportAt(state, strand.a)!.hp).toBe(WEB_JUNCTION_HP);
    expect(state.solid[strand.a]).toBe(SOLID_NONE);
    until(state, state.tick + 6 + WEB_STRAND_REPAIR_TICKS);
    expect(strand.phase).toBe('taut');
    expect(supportHolds(state, strand.a)).toBe(true);
  });

  it.each(['stun', 'death'])(
    '%s interrupts reconstruction before its completion tick',
    (interrupt) => {
      const { state, worker, strand } = fixture();
      cutSuture(state, strand, [], 0);
      updateEnemies(state, []);
      const start = state.tick;
      until(state, start + 20);
      if (interrupt === 'stun') stunEntity(state, worker, 20);
      else damageEntity(state, worker, 10000, []);
      expect(webRepairProgress(state, worker)).toBeNull();
      until(state, start + WEB_STRAND_REPAIR_TICKS + 1);
      expect(strand.phase).toBe('loose');
    },
  );

  it('assigns different jobs to different workers', () => {
    const { state, queen, worker, strand } = fixture();
    cutSuture(state, strand, [], 0);
    cutSuture(state, state.sutures[1], [], 0);
    const other = spawnEnemy(state, 'stitcher', 22, 23, false);
    other.summonerId = queen.id;
    other.nextActionAt = state.tick;
    updateEnemies(state, []);
    expect(worker.webRepair?.target).toBe(strand.id);
    expect(other.webRepair?.target).toBe(state.sutures[1].id);
  });

  it('skips an anchor behind a dividing wall and repairs reachable web damage', () => {
    const { state, worker, anchor, strand } = fixture();
    destroyAnchor(state, anchor);
    for (let y = 1; y < state.config.height - 1; y++)
      state.solid[y * state.config.width + 28] = SOLID_ROCK;
    cutSuture(state, strand, [], 0);
    updateEnemies(state, []);
    expect(worker.webRepair).toMatchObject({ kind: 'strand', target: strand.id });
  });

  it('cancels anchor reconstruction if a player occupies the site during the channel', () => {
    const { state, worker, anchor } = fixture();
    destroyAnchor(state, anchor);
    worker.x = 29.5;
    worker.y = 20.5;
    updateEnemies(state, []);
    expect(worker.webRepair?.target).toBe(anchor);
    state.player.x = 30.5;
    state.player.y = 20.5;
    until(state, state.tick + WEB_SUPPORT_REPAIR_TICKS);
    expect(state.solid[anchor]).toBe(SOLID_NONE);
    expect(webSupportAt(state, anchor)!.hp).toBe(0);
  });

  it('attacks when there is no repair work', () => {
    const { state, worker } = fixture();
    updateEnemies(state, []);
    expect(worker.webRepair).toBeUndefined();
    expect(worker.action?.silkFlight).toBeDefined();
  });

  it('hashes both support durability and the reserved repair job', () => {
    const { state, worker, strand } = fixture();
    const before = hashAuthoritativeState(state);
    webSupportAt(state, strand.a)!.hp--;
    expect(hashAuthoritativeState(state)).not.toBe(before);
    cutSuture(state, strand, [], 0);
    updateEnemies(state, []);
    const reserved = hashAuthoritativeState(state);
    expect(hashAuthoritativeState(structuredClone(state))).toBe(reserved);
    worker.webRepair!.at++;
    expect(hashAuthoritativeState(state)).not.toBe(reserved);
  });
});
