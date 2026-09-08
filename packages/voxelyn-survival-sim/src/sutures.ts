import {
  SOLID_NONE,
  SOLID_STITCHED_ROCK,
  SOLID_SUTURE_ANCHOR,
  SOLID_SUTURE_CRACKED,
  SURF_FIRE,
  SURF_MINERAL_SILK,
} from './constants.js';
import { breakSolid, markDirty, setSurface } from './cells.js';
import { bodyBlocked, damageEntity, moveEntity, startAction } from './entities.js';
import {
  dropSeamstress,
  seamstressStep,
  silkHelperStep,
  silkCanLand,
  silkSupported,
  summonSilkBrood,
} from './seamstress.js';
import { hasLineOfSight } from './pathing.js';
import type { Entity, SemanticEvent, SurvivalState, Suture, SutureRecipe, Vec2 } from './types.js';

export const SUTURE_WHIP_WARNING = 16;
export const SUTURE_FALL_WARNING = 32;
export const SUTURE_REWARD = 24;
/** Preserved in colony snapshots; the boss no longer re-sews spent traps. */
const SUTURE_SPENT_DELAY = 160;
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
    resewAt: -1,
  }));
export const cloneSutures = (sutures: readonly Suture[]): Suture[] =>
  sutures.map((s) => ({ ...s, cells: [...s.cells], slabCells: [...s.slabCells] }));
export const suturePoint = (state: SurvivalState, i: number): Vec2 => ({
  x: (i % state.config.width) + 0.5,
  y: Math.floor(i / state.config.width) + 0.5,
});
/** The visible load and the hittable cable share the same anchor. */
export const loadedSutureAnchor = (state: SurvivalState, queen: Entity, s: Suture): Vec2 => {
  if (queen.action?.silkFlight?.anchor !== undefined)
    return suturePoint(state, queen.action.silkFlight.anchor);
  const a = suturePoint(state, s.a),
    b = suturePoint(state, s.b);
  return Math.hypot(a.x - queen.x, a.y - queen.y) < Math.hypot(b.x - queen.x, b.y - queen.y)
    ? a
    : b;
};
/** Locked landing during a flight; colony endpoint only when inspecting an idle support. */
export const tetherEndpoint = (state: SurvivalState, queen: Entity, s: Suture): Vec2 => {
  if (queen.action?.silkFlight)
    return { x: queen.action.silkFlight.toX, y: queen.action.silkFlight.toY };
  const anchor = loadedSutureAnchor(state, queen, s);
  const cell =
    anchor.x === suturePoint(state, s.a).x && anchor.y === suturePoint(state, s.a).y
      ? s.cells[1]
      : s.cells[s.cells.length - 2];
  return suturePoint(state, cell);
};
const walkBodyBlocked = (state: SurvivalState, body: Entity, x: number, y: number): boolean =>
  body.archetype === 'seamstress'
    ? !silkCanLand(state, body, x, y)
    : bodyBlocked(state, body, x, y);

/** Body clearance is for walking only; suspended flight crosses internal terrain. */
const walkLaneClear = (state: SurvivalState, queen: Entity, to: Vec2): boolean => {
  const dx = to.x - queen.x,
    dy = to.y - queen.y,
    len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len / 0.25));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (walkBodyBlocked(state, queen, queen.x + dx * t, queen.y + dy * t)) return false;
  }
  return true;
};
const anchorExists = (state: SurvivalState, i: number): boolean =>
  state.solid[i] === SOLID_SUTURE_ANCHOR || state.solid[i] === SOLID_SUTURE_CRACKED;
// Um fio da teia nao tem ancoras: e sustentado pela propria teia.
const usable = (state: SurvivalState, s: Suture): boolean =>
  s.kind === 'web' || (anchorExists(state, s.a) && anchorExists(state, s.b));
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
  const goals = state.sutures.filter((s) => s.objective && !s.encounter);
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
  if (s.encounter || s.phase === 'cut' || s.phase === 'spent') return false;
  if (s.kind === 'web') {
    // Um fio da teia rompe sem chicote nem queda: ele so deixa de existir ate
    // que um Costureiro o refaca. `loose` e exatamente o estado que os
    // Costureiros procuram — o corte ja e o pedido de reparo.
    if (s.phase !== 'taut') return false;
    s.phase = 'loose';
    s.tension = 0;
    s.cutBySlot = slot;
    signal(state, s, 'snap', events);
    return true;
  }
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
    if (s.encounter || (s.phase !== 'loose' && s.phase !== 'taut')) continue;
    const a = suturePoint(state, s.cells[0]),
      b = suturePoint(state, s.cells[s.cells.length - 1]);
    if (touchesCable(from, to, a, b)) cutSuture(state, s, events, slot);
  }
  for (const queen of state.enemies) {
    if (!queen.alive || queen.archetype !== 'seamstress' || !silkSupported(queen, state.tick))
      continue;
    const b = suturePoint(state, queen.action!.silkFlight!.anchor!);
    if (cutsTether(from, to, queen, b)) dropSeamstress(state, queen, events);
  }
};

/** Seno minimo entre tiro e fio para o corte contar: 30 graus. */
export const SILK_CUT_MIN_SIN = 0.5;
/** A partir de quantos tiles do centro do corpo o fio esta EXPOSTO ao corte. */
export const SILK_CUT_EXPOSED_FROM = 1.5;
/**
 * O corte do fio ativo tem de ser INTENCIONAL: um tiro que atravessa o trecho
 * exposto, de lado.
 *
 * A regra frouxa das suturas da colonia (paralelos e rocantes contam) fazia o
 * corte acontecer sozinho: a Cerzideira puxa para um apoio ao lado do
 * jogador, o fio passa por cima dele, e todo tiro no corpo dela ja saia
 * encostado no fio. Nos ensaios, circular atirando a derrubava em 4 de 4
 * investidas sem ninguem mirar no fio. Aqui contam so os tiros que cruzam o
 * fio com pelo menos 30 graus, a 1,5 tile ou mais do corpo — o trecho que o
 * cliente desenha como cortavel.
 */
export const cutsTether = (from: Vec2, to: Vec2, body: Vec2, anchor: Vec2): boolean => {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    ex = anchor.x - body.x,
    ey = anchor.y - body.y;
  const shot = Math.hypot(dx, dy),
    cable = Math.hypot(ex, ey);
  if (shot < 1e-8 || cable < 1e-8) return false;
  const determinant = dx * ey - dy * ex;
  if (Math.abs(determinant) / (shot * cable) < SILK_CUT_MIN_SIN) return false;
  const ax = body.x - from.x,
    ay = body.y - from.y;
  const t = (ax * ey - ay * ex) / determinant,
    u = (ax * dy - ay * dx) / determinant;
  if (t < 0 || t > 1 || u < 0 || u > 1) return false;
  return u * cable >= SILK_CUT_EXPOSED_FROM;
};

export const sewSuture = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  if (enemy.archetype === 'seamstress') {
    summonSilkBrood(state, enemy, events);
    return;
  }
  const s = state.sutures.find((s) => !s.encounter && s.id === enemy.action?.target);
  // Auxiliares convocados so costuram a TEIA: as suturas da colonia sao dos
  // operarios dela.
  if (enemy.summonerId !== undefined && s?.kind !== 'web') return;
  if (!s || !usable(state, s) || s.phase === 'cut') return;
  if (s.phase === 'spent') return;
  s.tension = Math.min(100, s.tension + 34);
  signal(state, s, 'sew', events);
  if (s.tension === 100) {
    s.phase = 'taut';
    s.closeAt = s.kind === 'gate' ? state.tick + 24 : -1;
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
    if (s.encounter) continue;
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
    if (s.whipAt < 0 && s.fallAt < 0) {
      s.phase = 'spent';
      s.resewAt = state.tick + SUTURE_SPENT_DELAY;
    }
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

export const approach = (
  state: SurvivalState,
  enemy: Entity,
  p: Vec2,
  dt: number,
  speed: number,
): void => {
  if (!hasLineOfSight(state, enemy.x, enemy.y, p.x, p.y) || !walkLaneClear(state, enemy, p)) {
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
          walkBodyBlocked(state, enemy, (j % w) + 0.5, Math.floor(j / w) + 0.5) ||
          Math.abs((j % w) - (i % w)) > 1
        )
          continue;
        from.set(j, i);
        queue.push(j);
      }
    }
    let next = from.has(goal)
      ? goal
      : queue.reduce((a, b) => {
          const distance = (i: number): number =>
            Math.hypot((i % w) + 0.5 - p.x, Math.floor(i / w) + 0.5 - p.y);
          return distance(b) < distance(a) ? b : a;
        });
    if (next === start) return;
    while (from.get(next) !== start && from.get(next) !== -1) next = from.get(next)!;
    p = suturePoint(state, next);
  }
  const dx = p.x - enemy.x,
    dy = p.y - enemy.y,
    len = Math.hypot(dx, dy) || 1;
  enemy.facing = { x: dx / len, y: dy / len };
  const stepX = enemy.facing.x * speed * dt,
    stepY = enemy.facing.y * speed * dt;
  if (!walkBodyBlocked(state, enemy, enemy.x + stepX, enemy.y)) moveEntity(state, enemy, stepX, 0);
  if (!walkBodyBlocked(state, enemy, enemy.x, enemy.y + stepY)) moveEntity(state, enemy, 0, stepY);
};

/**
 * Um Costureiro indo trabalhar numa sutura: anda ate ela e, a menos de 1,4
 * tile com linha de visao, da um ponto (18 ticks de preparo, 8 de descanso,
 * 32 ate o proximo). Tres pontos completam o fio — sao ~5 s de costura
 * visivel, o tempo de o jogador decidir se interrompe. Compartilhado pelos
 * operarios da colonia e pelos auxiliares que refazem a teia.
 */
export const sewJob = (
  state: SurvivalState,
  enemy: Entity,
  seam: Suture,
  dt: number,
  events: SemanticEvent[],
): void => {
  const p = suturePoint(state, seam.cells[0]);
  const distance = Math.hypot(p.x - enemy.x, p.y - enemy.y);
  if (distance < 1.4 && hasLineOfSight(state, enemy.x, enemy.y, p.x, p.y)) {
    const len = distance || 1;
    startAction(
      state,
      enemy,
      'stitch',
      { x: (p.x - enemy.x) / len, y: (p.y - enemy.y) / len },
      18,
      8,
      events,
      seam.id,
    );
    enemy.nextActionAt = state.tick + 32;
  } else approach(state, enemy, p, dt, enemy.summonerId !== undefined ? 3.2 : 2.7);
};

export const stitcherStep = (
  state: SurvivalState,
  enemy: Entity,
  player: Entity | null,
  dt: number,
  events: SemanticEvent[],
): void => {
  if (enemy.archetype === 'seamstress') {
    seamstressStep(state, enemy, player, dt, events);
    return;
  }
  if (enemy.summonerId !== undefined || enemy.archetype === 'seamstress_brood') {
    silkHelperStep(state, enemy, player, dt, events);
    return;
  }
  if (state.tick < enemy.nextActionAt) return;
  const distance = (s: Suture): number => {
    const p = suturePoint(state, s.cells[0]);
    return Math.hypot(p.x - enemy.x, p.y - enemy.y);
  };
  const candidates = state.sutures
    .filter((s) => !s.encounter && usable(state, s) && s.phase === 'loose')
    .sort((a, b) => distance(a) - distance(b) || a.id - b.id);
  const seam = candidates[0];
  if (seam && (!player || Math.hypot(player.x - enemy.x, player.y - enemy.y) > 2)) {
    sewJob(state, enemy, seam, dt, events);
    return;
  }
  if (!player) return;
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
  } else approach(state, enemy, player, dt, 3.2);
};
