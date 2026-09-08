import {
  SOLID_NONE,
  SOLID_STITCHED_ROCK,
  SOLID_SUTURE_ANCHOR,
  SOLID_SUTURE_CRACKED,
  SURF_FIRE,
  SURF_MINERAL_SILK,
  TICK_HZ,
} from './constants.js';
import { breakSolid, markDirty, setSurface } from './cells.js';
import { damageEntity, moveEntity, startAction } from './entities.js';
import { hasLineOfSight } from './pathing.js';
import type { Entity, SemanticEvent, SurvivalState, Suture, SutureRecipe, Vec2 } from './types.js';

export const SUTURE_WHIP_WARNING = 16;
export const SUTURE_FALL_WARNING = 32;
export const SUTURE_REWARD = 24;
export const createSutures = (recipes: readonly SutureRecipe[]): Suture[] =>
  recipes.map((s) => ({
    ...s,
    cells: [...s.cells],
    slabCells: [...s.slabCells],
    phase: s.kind === 'roof' ? 'taut' : 'loose',
    tension: s.kind === 'roof' ? 100 : 0,
    closeAt: -1,
    whipAt: -1,
    fallAt: -1,
    cutBySlot: -1,
    recovered: false,
  }));
export const cloneSutures = (sutures: readonly Suture[]): Suture[] =>
  sutures.map((s) => ({ ...s, cells: [...s.cells], slabCells: [...s.slabCells] }));
export const suturePoint = (state: SurvivalState, i: number): Vec2 => ({
  x: (i % state.config.width) + 0.5,
  y: Math.floor(i / state.config.width) + 0.5,
});
/** The visible load and the hittable cable share the same anchor. */
export const loadedSutureAnchor = (state: SurvivalState, queen: Entity, s: Suture): Vec2 => {
  const a = suturePoint(state, s.a),
    b = suturePoint(state, s.b);
  if (queen.action?.kind === 'tether') {
    const d = queen.action.direction;
    return (a.x - queen.x) * d.x + (a.y - queen.y) * d.y >
      (b.x - queen.x) * d.x + (b.y - queen.y) * d.y
      ? a
      : b;
  }
  return Math.hypot(a.x - queen.x, a.y - queen.y) < Math.hypot(b.x - queen.x, b.y - queen.y)
    ? a
    : b;
};
const anchorExists = (state: SurvivalState, i: number): boolean =>
  state.solid[i] === SOLID_SUTURE_ANCHOR || state.solid[i] === SOLID_SUTURE_CRACKED;
const usable = (state: SurvivalState, s: Suture): boolean =>
  anchorExists(state, s.a) && anchorExists(state, s.b);
const signal = (
  state: SurvivalState,
  s: Suture,
  phase: Extract<SemanticEvent, { t: 'suture' }>['phase'],
  events: SemanticEvent[],
): void => {
  events.push({
    t: 'suture',
    phase,
    id: s.id,
    ...suturePoint(state, s.cells[Math.floor(s.cells.length / 2)]),
  });
};
export const sutureObjective = (
  state: SurvivalState,
): { done: number; total: number; rewarded: boolean } => {
  const goals = state.sutures.filter((s) => s.objective);
  return {
    done: goals.filter((s) => s.recovered).length,
    total: goals.length,
    rewarded: !!(state.sutureRewardsMask & (1 << state.sector)),
  };
};

/** A completed seam outlives its worker. Cutting never deals damage on the input tick. */
export const cutSuture = (
  state: SurvivalState,
  s: Suture,
  events: SemanticEvent[],
  slot = -1,
): boolean => {
  if (s.phase === 'cut' || s.phase === 'spent') return false;
  const loaded = s.phase === 'taut';
  s.phase = 'cut';
  s.closeAt = -1;
  s.cutBySlot = slot;
  s.whipAt = loaded ? state.tick + SUTURE_WHIP_WARNING : -1;
  s.fallAt = loaded && s.kind === 'roof' ? state.tick + SUTURE_FALL_WARNING : -1;
  signal(state, s, 'cut', events);
  for (const i of s.cells)
    if (state.solid[i] === SOLID_STITCHED_ROCK) {
      breakSolid(state, i % state.config.width, Math.floor(i / state.config.width), events);
    }
  for (const queen of state.enemies)
    if (queen.alive && queen.archetype === 'seamstress' && queen.mood === s.id + 1) {
      queen.mood = 0;
      queen.stunnedUntil = state.tick + 60;
      queen.action = undefined;
      queen.vx = queen.vy = 0;
      queen.nextActionAt = queen.stunnedUntil + 10;
      events.push({ t: 'action_end', entity: queen.id });
      events.push({
        t: 'boss_vulnerable',
        archetype: 'seamstress',
        x: queen.x,
        y: queen.y,
        open: true,
      });
    }
  return true;
};

const pointSegmentDistance = (p: Vec2, a: Vec2, b: Vec2): number => {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
const touchesCable = (from: Vec2, to: Vec2, a: Vec2, b: Vec2): boolean => {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    ex = b.x - a.x,
    ey = b.y - a.y;
  const determinant = dx * ey - dy * ex;
  if (Math.abs(determinant) > 1e-8) {
    const ax = a.x - from.x,
      ay = a.y - from.y;
    const t = (ax * ey - ay * ex) / determinant,
      u = (ax * dy - ay * dx) / determinant;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }
  // Parallel, grazing and fast shots that enter from beyond an endpoint.
  return (
    Math.min(
      pointSegmentDistance(from, a, b),
      pointSegmentDistance(to, a, b),
      pointSegmentDistance(a, from, to),
      pointSegmentDistance(b, from, to),
    ) < 0.22
  );
};

/** Swept segment against the authored cable, before wall impact. No sampling gaps. */
export const hitSutures = (
  state: SurvivalState,
  from: Vec2,
  to: Vec2,
  events: SemanticEvent[],
  slot = -1,
): void => {
  for (const s of state.sutures) {
    if (s.phase !== 'loose' && s.phase !== 'taut') continue;
    const a = suturePoint(state, s.cells[0]),
      b = suturePoint(state, s.cells[s.cells.length - 1]);
    if (touchesCable(from, to, a, b)) cutSuture(state, s, events, slot);
  }
  for (const queen of state.enemies) {
    if (!queen.alive || queen.archetype !== 'seamstress' || !queen.mood) continue;
    const s = state.sutures.find((s) => s.id + 1 === queen.mood && s.phase === 'taut');
    if (!s) continue;
    const b = loadedSutureAnchor(state, queen, s);
    // The body itself is a damage target; the exposed support starts outside it.
    const gap = Math.min(1, queen.radius / (Math.hypot(b.x - queen.x, b.y - queen.y) || 1));
    const a = { x: queen.x + (b.x - queen.x) * gap, y: queen.y + (b.y - queen.y) * gap };
    if (touchesCable(from, to, a, b)) cutSuture(state, s, events, slot);
  }
};

export const sewSuture = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const s = state.sutures.find((s) => s.id === enemy.action?.target);
  if (!s || !usable(state, s) || s.phase === 'cut') return;
  const queen = enemy.archetype === 'seamstress';
  if (s.phase === 'spent' && !queen) return;
  if (s.phase === 'spent') {
    s.phase = 'loose';
    s.tension = 0;
  }
  s.tension = Math.min(100, s.tension + (queen ? 100 : 34));
  signal(state, s, 'sew', events);
  if (s.tension === 100) {
    s.phase = 'taut';
    s.closeAt = s.kind === 'gate' ? state.tick + 24 : -1;
    if (queen) enemy.mood = s.id + 1;
    signal(state, s, 'taut', events);
  }
};

export const stepSutures = (state: SurvivalState, events: SemanticEvent[]): void => {
  const bodies = [
    ...state.players.filter(
      (p) =>
        p.alive &&
        state.playerExtras[p.slot ?? 0].joined &&
        !state.playerExtras[p.slot ?? 0].downed,
    ),
    ...state.enemies.filter((e) => e.alive),
  ];
  for (const s of state.sutures) {
    if (s.phase === 'loose' || s.phase === 'taut') {
      if (!usable(state, s) || s.cells.some((i) => state.surface[i] === SURF_FIRE))
        cutSuture(state, s, events);
    }
    if (s.phase === 'taut' && s.closeAt >= 0 && state.tick >= s.closeAt) {
      s.closeAt = -1;
      for (const i of s.cells) {
        const p = suturePoint(state, i);
        // Never entomb any living body. Basic bolts can always reopen the repair.
        if (
          state.solid[i] === SOLID_NONE &&
          !bodies.some(
            (e) => Math.abs(e.x - p.x) < e.radius + 0.55 && Math.abs(e.y - p.y) < e.radius + 0.55,
          )
        ) {
          state.solid[i] = SOLID_STITCHED_ROCK;
          markDirty(state, p.x | 0, p.y | 0);
        }
      }
    }
    if (s.phase !== 'cut') continue;
    if (s.whipAt >= 0 && state.tick >= s.whipAt) {
      s.whipAt = -1;
      signal(state, s, 'snap', events);
      for (const e of bodies)
        if (
          s.cells.some((i) => {
            const p = suturePoint(state, i);
            return Math.abs(e.x - p.x) < e.radius + 0.5 && Math.abs(e.y - p.y) < e.radius + 0.5;
          })
        ) {
          damageEntity(state, e, 18, events, { kind: 'suture_whip' });
        }
    }
    if (s.fallAt >= 0 && state.tick >= s.fallAt) {
      s.fallAt = -1;
      s.recovered = s.objective || s.recovered;
      signal(state, s, 'fall', events);
      for (const e of bodies)
        if (
          s.slabCells.some((i) => {
            const p = suturePoint(state, i);
            return Math.abs(e.x - p.x) < e.radius + 0.55 && Math.abs(e.y - p.y) < e.radius + 0.55;
          })
        ) {
          damageEntity(state, e, 34, events, { kind: 'suture_fall' });
        }
      for (const i of s.slabCells)
        if (state.solid[i] === SOLID_NONE) setSurface(state, i, SURF_MINERAL_SILK, 0);
    }
    if (s.whipAt < 0 && s.fallAt < 0) s.phase = 'spent';
  }
  const objective = sutureObjective(state);
  if (objective.total > 0 && objective.done === objective.total && !objective.rewarded) {
    state.sutureRewardsMask |= 1 << state.sector;
    state.stats.oreCollected += SUTURE_REWARD;
    const s = state.sutures.find((s) => s.objective)!;
    const p = suturePoint(state, s.cells[0]);
    signal(state, s, 'reward', events);
    events.push({ t: 'ore_gained', ...p, amount: SUTURE_REWARD, total: state.stats.oreCollected });
  }
};

const approach = (
  state: SurvivalState,
  enemy: Entity,
  p: Vec2,
  dt: number,
  speed: number,
): void => {
  if (!hasLineOfSight(state, enemy.x, enemy.y, p.x, p.y)) {
    // Walk-only bounded BFS. A repair worker cannot secretly bore through the stratum.
    const w = state.config.width,
      start = Math.floor(enemy.y) * w + Math.floor(enemy.x),
      goal = Math.floor(p.y) * w + Math.floor(p.x);
    const from = new Map<number, number>([[start, -1]]),
      queue = [start];
    for (let n = 0; n < queue.length && n < 512 && !from.has(goal); n++) {
      const i = queue[n];
      for (const j of [i - w, i - 1, i + 1, i + w]) {
        if (
          j < 0 ||
          j >= state.solid.length ||
          from.has(j) ||
          state.solid[j] !== SOLID_NONE ||
          Math.abs((j % w) - (i % w)) > 1
        )
          continue;
        from.set(j, i);
        queue.push(j);
      }
    }
    if (!from.has(goal)) return;
    let next = goal;
    while (from.get(next) !== start && from.get(next) !== -1) next = from.get(next)!;
    p = suturePoint(state, next);
  }
  const dx = p.x - enemy.x,
    dy = p.y - enemy.y,
    len = Math.hypot(dx, dy) || 1;
  enemy.facing = { x: dx / len, y: dy / len };
  moveEntity(state, enemy, enemy.facing.x * speed * dt, enemy.facing.y * speed * dt);
};

export const stitcherStep = (
  state: SurvivalState,
  enemy: Entity,
  player: Entity | null,
  dt: number,
  events: SemanticEvent[],
): void => {
  const queen = enemy.archetype === 'seamstress';
  if (queen && enemy.hp < enemy.maxHp / 2 && !(state.bossRuntime.phasesFired & 1)) {
    state.bossRuntime.phasesFired |= 1;
    events.push({ t: 'boss_phase', archetype: 'seamstress', phase: 1, x: enemy.x, y: enemy.y });
  }
  if (queen && !state.bossRuntime.awake) {
    if (
      !player ||
      (Math.hypot(player.x - enemy.x, player.y - enemy.y) > 18 && enemy.alertedUntil <= state.tick)
    )
      return;
    state.bossRuntime.awake = true;
    enemy.nextActionAt = state.tick + 30;
    events.push({ t: 'boss_awake', archetype: 'seamstress', x: enemy.x, y: enemy.y });
  }
  if (state.tick < enemy.nextActionAt) return;
  const distance = (s: Suture): number => {
    const p = suturePoint(state, s.cells[0]);
    return Math.hypot(p.x - enemy.x, p.y - enemy.y);
  };
  const candidates = state.sutures
    .filter(
      (s) =>
        usable(state, s) &&
        (!queen || distance(s) < 10) &&
        (s.phase === 'loose' || (queen && s.phase === 'spent')),
    )
    .sort((a, b) => distance(a) - distance(b) || a.id - b.id);
  const seam = candidates[0];
  if (seam && (!player || Math.hypot(player.x - enemy.x, player.y - enemy.y) > 2)) {
    const p = suturePoint(state, seam.cells[0]);
    if (distance(seam) < (queen ? 8 : 1.4) && hasLineOfSight(state, enemy.x, enemy.y, p.x, p.y)) {
      const len = Math.hypot(p.x - enemy.x, p.y - enemy.y) || 1;
      startAction(
        state,
        enemy,
        'stitch',
        { x: (p.x - enemy.x) / len, y: (p.y - enemy.y) / len },
        queen ? 24 : 18,
        8,
        events,
        seam.id,
      );
      enemy.nextActionAt = state.tick + (queen ? 65 : 32);
    } else approach(state, enemy, p, dt, 2.7);
    return;
  }
  if (!player) return;
  if (queen) {
    // Choose a different reachable endpoint. Score the swept lane so pulls threaten
    // the player, instead of repeatedly pulling into the anchor already underfoot.
    const choices = state.sutures
      .filter((s) => s.phase === 'taut' && usable(state, s))
      .flatMap((s) =>
        [s.cells[1], s.cells[s.cells.length - 2]].map((cell) => {
          const p = suturePoint(state, cell);
          const dx = p.x - enemy.x,
            dy = p.y - enemy.y,
            distance = Math.hypot(dx, dy);
          const along = Math.max(
            0,
            Math.min(
              1,
              ((player.x - enemy.x) * dx + (player.y - enemy.y) * dy) / (distance * distance || 1),
            ),
          );
          const laneGap = Math.hypot(
            player.x - enemy.x - dx * along,
            player.y - enemy.y - dy * along,
          );
          return {
            s,
            p,
            distance,
            score: laneGap * 2 + Math.hypot(p.x - player.x, p.y - player.y) * 0.3,
          };
        }),
      )
      .filter(
        (c) =>
          c.distance > 2 &&
          c.distance <= 14 &&
          hasLineOfSight(state, enemy.x, enemy.y, c.p.x, c.p.y),
      )
      .sort((a, b) => a.score - b.score || a.s.id - b.s.id);
    const target = choices[0];
    if (target && Math.hypot(player.x - enemy.x, player.y - enemy.y) > 2) {
      enemy.mood = target.s.id + 1;
      const direction = {
        x: (target.p.x - enemy.x) / target.distance,
        y: (target.p.y - enemy.y) / target.distance,
      };
      startAction(
        state,
        enemy,
        'tether',
        direction,
        enemy.hp < enemy.maxHp / 2 ? 16 : 24,
        Math.ceil((target.distance / 8) * TICK_HZ),
        events,
        target.s.id,
      );
      enemy.nextActionAt = enemy.action!.endsAt + 14;
      return;
    }
  }
  const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  if (dist < enemy.radius + player.radius + 0.6 && state.tick >= enemy.contactReadyAt) {
    const len = dist || 1;
    startAction(
      state,
      enemy,
      'contact',
      { x: (player.x - enemy.x) / len, y: (player.y - enemy.y) / len },
      12,
      8,
      events,
      player.id,
    );
    enemy.contactReadyAt = state.tick + 28;
  } else approach(state, enemy, player, dt, queen ? 2.8 : 3.2);
};

export const seamstressStride = (
  state: SurvivalState,
  enemy: Entity,
  dt: number,
  events: SemanticEvent[],
): void => {
  if (enemy.action?.kind !== 'tether' || enemy.action.phase === 'windup') return;
  moveEntity(state, enemy, enemy.action.direction.x * 8 * dt, enemy.action.direction.y * 8 * dt);
  for (const p of state.players)
    if (
      p.alive &&
      state.playerExtras[p.slot ?? 0].joined &&
      Math.hypot(p.x - enemy.x, p.y - enemy.y) < p.radius + enemy.radius
    ) {
      damageEntity(state, p, 20, events, {
        kind: 'enemy_contact',
        archetype: 'seamstress',
        elite: false,
      });
    }
};
