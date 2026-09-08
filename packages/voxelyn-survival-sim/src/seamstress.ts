import {
  SOLID_NONE,
  SOLID_STITCHED_ROCK,
  SOLID_SUTURE_ANCHOR,
  SOLID_SUTURE_CRACKED,
  TICK_HZ,
  MAX_ENEMIES,
} from './constants.js';
import { markDirty } from './cells.js';
import { bodyBlocked, damageEntity, spawnEnemy, startAction } from './entities.js';
import { approach, suturePoint } from './sutures.js';
import {
  SEAMSTRESS_CHAMBER_RADIUS as CHAMBER_RADIUS,
  sutureInSeamstressChamber,
  seamstressAnchorInRange,
} from './suture-layout.js';
import type { Entity, SemanticEvent, SilkFlight, SurvivalState, Vec2 } from './types.js';

export const SEAMSTRESS_GROUND_SPEED = 4;
export const SEAMSTRESS_FLIGHT_SPEED = 12;
export const SEAMSTRESS_DROP_TICKS = 36;
/** Third frame of attack, authored at 10 fps in a 20 Hz simulation. */
export const SILK_STRIKE_OFFSET = 4;
export const SILK_HELPER_CAP = 4;
export const SILK_STRIKE_RADIUS = 1.1;
/** The same footprint is used by the authoritative hit and the ground marker. */
export const silkStrike = (enemy: Entity): Vec2 & { radius: number } => {
  const queen = enemy.archetype === 'seamstress',
    f = enemy.action?.silkFlight;
  const direction = enemy.action?.direction ?? enemy.facing;
  return {
    x: (f?.toX ?? enemy.x) + (queen ? direction.x * 0.8 : 0),
    y: (f?.toY ?? enemy.y) + (queen ? direction.y * 0.8 : 0),
    radius: queen ? SILK_STRIKE_RADIUS : enemy.archetype === 'seamstress_brood' ? 0.55 : 0.85,
  };
};
const unit = (x: number, y: number): Vec2 => {
  const d = Math.hypot(x, y) || 1;
  return { x: x / d, y: y / d };
};
/** A short, bounded lead is locked with the marker; neither flight tracks afterwards. */
const silkAim = (player: Entity, seconds: number): Vec2 => {
  const scale = Math.min(seconds, 3 / (Math.hypot(player.vx, player.vy) || 1));
  return { x: player.x + player.vx * scale, y: player.y + player.vy * scale };
};
const activePlayers = (state: SurvivalState): Entity[] =>
  state.players.filter(
    (p) =>
      p.alive &&
      p.hp > 0 &&
      state.playerExtras[p.slot ?? 0].joined &&
      !state.playerExtras[p.slot ?? 0].downed,
  );

export const silkContact = (state: SurvivalState, queen: Entity, events: SemanticEvent[]): void => {
  const hit = silkStrike(queen);
  for (const player of activePlayers(state))
    if (Math.hypot(player.x - hit.x, player.y - hit.y) <= hit.radius + player.radius)
      damageEntity(state, player, 24, events, {
        kind: 'enemy_contact',
        archetype: 'seamstress',
        elite: false,
      });
};

/** Circle against every overlapped cell, including rocks between the four corner samples. */
export const silkCanLand = (state: SurvivalState, body: Entity, x: number, y: number): boolean => {
  if (bodyBlocked(state, body, x, y)) return false;
  for (let cy = Math.floor(y - body.radius); cy <= Math.floor(y + body.radius); cy++)
    for (let cx = Math.floor(x - body.radius); cx <= Math.floor(x + body.radius); cx++) {
      if (cx < 1 || cy < 1 || cx >= state.config.width - 1 || cy >= state.config.height - 1)
        return false;
      const dx = Math.max(cx - x, 0, x - cx - 1),
        dy = Math.max(cy - y, 0, y - cy - 1);
      if (
        state.solid[cy * state.config.width + cx] !== SOLID_NONE &&
        dx * dx + dy * dy < body.radius * body.radius
      )
        return false;
    }
  return true;
};

/** Deterministic landing search with full body clearance; never lands inside terrain. */
export const silkLanding = (
  state: SurvivalState,
  body: Entity,
  at: Vec2,
  reach = 3,
): Vec2 | null => {
  if (silkCanLand(state, body, at.x, at.y)) return { x: at.x, y: at.y };
  let best: Vec2 | null = null,
    score = Infinity;
  const w = state.config.width;
  for (
    let y = Math.max(1, Math.floor(at.y - reach));
    y <= Math.min(state.config.height - 2, Math.ceil(at.y + reach));
    y++
  ) {
    for (
      let x = Math.max(1, Math.floor(at.x - reach));
      x <= Math.min(w - 2, Math.ceil(at.x + reach));
      x++
    ) {
      const d = Math.hypot(x + 0.5 - at.x, y + 0.5 - at.y);
      if (d <= reach && d < score && silkCanLand(state, body, x + 0.5, y + 0.5)) {
        best = { x: x + 0.5, y: y + 0.5 };
        score = d;
      }
    }
  }
  return best;
};

export const initSeamstress = (state: SurvivalState, queen: Entity): void => {
  if (queen.silk) return;
  queen.silk = {
    x: queen.x,
    y: queen.y,
    lunges: 0,
    lastAnchor: -1,
    broodAt: 0,
    repositionUntil: 0,
    comboLeft: 0,
  };
  for (const s of state.sutures) {
    if (!sutureInSeamstressChamber(s, state.config.width, queen)) continue;
    s.encounter = true;
    s.closeAt = s.whipAt = s.fallAt = -1;
    for (const i of s.cells)
      if (state.solid[i] === SOLID_STITCHED_ROCK) {
        state.solid[i] = SOLID_NONE;
        markDirty(state, i % state.config.width, Math.floor(i / state.config.width));
      }
  }
  for (const worker of state.enemies) {
    if (
      worker.archetype !== 'stitcher' ||
      worker.summonerId !== undefined ||
      Math.hypot(worker.x - queen.x, worker.y - queen.y) >= CHAMBER_RADIUS
    )
      continue;
    const site = state.sutures.find((s) => !s.encounter);
    const at = site ? silkLanding(state, worker, suturePoint(state, site.cells[0]), 3) : null;
    if (at) {
      worker.x = at.x;
      worker.y = at.y;
    } else worker.alive = false;
  }
};

export const silkSupported = (enemy: Entity, tick: number): boolean =>
  enemy.action?.silkFlight?.anchor !== undefined && tick < enemy.action.silkFlight.impactAt;

/** Height in renderer pixels at zoom 1; flight and its ground shadow share one clock. */
export const silkLift = (enemy: Entity, tick: number): number => {
  const a = enemy.action,
    f = a?.silkFlight;
  if (!a || !f || tick < a.releaseAt || tick >= f.landAt) return 0;
  const p = (tick - a.releaseAt) / Math.max(1, f.landAt - a.releaseAt);
  return Math.sin(Math.PI * p) * (f.anchor === undefined ? 20 : 38);
};

export const dropSeamstress = (
  state: SurvivalState,
  queen: Entity,
  events: SemanticEvent[],
): void => {
  const f = queen.action?.silkFlight;
  if (!f || !silkSupported(queen, state.tick)) return;
  const at =
    silkLanding(state, queen, queen, 6) ??
    silkLanding(
      state,
      queen,
      { x: f.fromX, y: f.fromY },
      Math.max(state.config.width, state.config.height),
    );
  if (at) {
    queen.x = at.x;
    queen.y = at.y;
  }
  queen.action = undefined;
  queen.mood = 0;
  queen.vx = queen.vy = 0;
  queen.stunnedUntil = state.tick + SEAMSTRESS_DROP_TICKS;
  queen.nextActionAt = queen.stunnedUntil;
  if (queen.silk) {
    queen.silk.repositionUntil = queen.stunnedUntil + 14;
    queen.silk.comboLeft = 0;
  }
  events.push({ t: 'action_end', entity: queen.id });
  events.push({
    t: 'boss_vulnerable',
    archetype: 'seamstress',
    x: queen.x,
    y: queen.y,
    open: true,
  });
};

const armFlight = (
  state: SurvivalState,
  enemy: Entity,
  to: Vec2,
  windup: number,
  speed: number,
  recovery: number,
  events: SemanticEvent[],
  target: number,
  anchor?: number,
  aim?: Vec2,
): void => {
  const dir = unit(to.x - enemy.x, to.y - enemy.y);
  const travel = Math.max(
    6,
    Math.ceil((Math.hypot(to.x - enemy.x, to.y - enemy.y) / speed) * TICK_HZ),
  );
  const landAt = state.tick + windup + travel;
  const impactAt = landAt + (anchor === undefined ? 0 : SILK_STRIKE_OFFSET);
  startAction(
    state,
    enemy,
    anchor === undefined ? 'leap' : 'tether',
    aim ?? dir,
    windup,
    impactAt - state.tick - windup + recovery,
    events,
    target,
  );
  enemy.action!.silkFlight = {
    fromX: enemy.x,
    fromY: enemy.y,
    toX: to.x,
    toY: to.y,
    landAt,
    impactAt,
    anchor,
  };
  enemy.nextActionAt = enemy.action!.endsAt;
};

const pull = (
  state: SurvivalState,
  queen: Entity,
  player: Entity,
  events: SemanticEvent[],
): boolean => {
  const encounter = queen.silk!;
  const aim = silkAim(player, 0.7);
  const anchors = [...new Set(state.sutures.filter((s) => s.encounter).flatMap((s) => [s.a, s.b]))];
  const choices: Array<{ anchor: number; to: Vec2; score: number }> = [];
  for (const anchor of anchors) {
    if (
      anchor === encounter.lastAnchor ||
      !seamstressAnchorInRange(anchor, state.config.width, queen) ||
      ![SOLID_SUTURE_ANCHOR, SOLID_SUTURE_CRACKED].includes(state.solid[anchor])
    )
      continue;
    const p = suturePoint(state, anchor),
      dx = p.x - queen.x,
      dy = p.y - queen.y;
    const d = Math.hypot(dx, dy);
    // Pull towards the selected support, stopping beside the locked target to strike.
    const along = Math.max(
      2,
      Math.min(d - 1.6, ((aim.x - queen.x) * dx + (aim.y - queen.y) * dy) / d - 0.8),
    );
    const to = silkLanding(
      state,
      queen,
      { x: queen.x + (dx / d) * along, y: queen.y + (dy / d) * along },
      2,
    );
    if (!to || Math.hypot(to.x - queen.x, to.y - queen.y) < 2) continue;
    choices.push({ anchor, to, score: Math.hypot(to.x - aim.x, to.y - aim.y) });
  }
  choices.sort((a, b) => a.score - b.score || a.anchor - b.anchor);
  const choice = choices[0];
  if (!choice || choice.score > 3) return false;
  const second = queen.hp < queen.maxHp / 2;
  const chained = second && encounter.comboLeft > 0;
  encounter.comboLeft = chained ? 0 : second ? 1 : 0;
  encounter.lastAnchor = choice.anchor;
  encounter.lunges++;
  armFlight(
    state,
    queen,
    choice.to,
    chained ? 12 : second ? 16 : 20,
    SEAMSTRESS_FLIGHT_SPEED,
    second && !chained ? 6 : 14,
    events,
    player.id,
    choice.anchor,
    unit(aim.x - choice.to.x, aim.y - choice.to.y),
  );
  return true;
};

export const summonSilkBrood = (
  state: SurvivalState,
  queen: Entity,
  events: SemanticEvent[],
): void => {
  const encounter = queen.silk;
  if (!encounter || encounter.lunges < 2) return;
  const living = state.enemies.filter((e) => e.alive && e.summonerId === queen.id);
  const kinds: Array<'stitcher' | 'seamstress_brood'> = [];
  if (!living.some((e) => e.archetype === 'stitcher')) kinds.push('stitcher');
  while (kinds.length + living.length < SILK_HELPER_CAP) kinds.push('seamstress_brood');
  for (const [n, kind] of kinds.entries()) {
    if (state.enemies.filter((e) => e.alive).length >= MAX_ENEMIES) break;
    const a = (queen.id + encounter.lunges + n * 2) * 2.399963229728653;
    const body = { ...queen, radius: kind === 'stitcher' ? 0.36 : 0.25 };
    const origin =
      kind === 'stitcher'
        ? { x: encounter.x + Math.cos(a) * 9, y: encounter.y + Math.sin(a) * 9 }
        : {
            x: queen.x - queen.facing.x * 0.8 + Math.cos(a) * 0.6,
            y: queen.y - queen.facing.y * 0.8 + Math.sin(a) * 0.6,
          };
    const at = silkLanding(state, body, origin, 5);
    if (!at) continue;
    const helper = spawnEnemy(state, kind, at.x - 0.5, at.y - 0.5, false);
    helper.summonerId = queen.id;
    helper.nextActionAt = state.tick + 22 + n * 8;
    helper.alertedUntil = state.tick + 100000;
    // Hatching/arrival is visible and harmless; the first pounce gets its own warning.
    startAction(state, helper, 'stitch', queen.facing, 12 + n * 3, 8, events);
  }
  encounter.broodAt = state.tick + (queen.hp < queen.maxHp / 2 ? 100 : 160);
};

export const seamstressStep = (
  state: SurvivalState,
  queen: Entity,
  player: Entity | null,
  dt: number,
  events: SemanticEvent[],
): void => {
  initSeamstress(state, queen);
  const encounter = queen.silk!;
  if (!state.bossRuntime.awake) {
    if (
      !player ||
      (Math.hypot(player.x - queen.x, player.y - queen.y) > 18 && queen.alertedUntil <= state.tick)
    )
      return;
    state.bossRuntime.awake = true;
    queen.nextActionAt = state.tick + 24;
    events.push({ t: 'boss_awake', archetype: 'seamstress', x: queen.x, y: queen.y });
  }
  if (!player) return;
  if (queen.hp < queen.maxHp / 2 && !(state.bossRuntime.phasesFired & 1)) {
    state.bossRuntime.phasesFired |= 1;
    events.push({ t: 'boss_phase', archetype: 'seamstress', phase: 1, x: queen.x, y: queen.y });
  }
  if (state.tick < queen.nextActionAt) return;
  if (state.tick < encounter.repositionUntil) {
    const d = unit(player.x - queen.x, player.y - queen.y);
    approach(
      state,
      queen,
      { x: queen.x - d.y * 3, y: queen.y + d.x * 3 },
      dt,
      SEAMSTRESS_GROUND_SPEED,
    );
    return;
  }
  if (
    encounter.lunges >= 2 &&
    state.tick >= encounter.broodAt &&
    state.enemies.filter((e) => e.alive && e.summonerId === queen.id).length < SILK_HELPER_CAP &&
    encounter.comboLeft === 0
  ) {
    startAction(state, queen, 'stitch', queen.facing, 18, 12, events);
    queen.nextActionAt = queen.action!.endsAt;
    return;
  }
  if (pull(state, queen, player, events)) return;
  const d = Math.hypot(player.x - queen.x, player.y - queen.y);
  if (d < 2 && state.tick >= queen.contactReadyAt) {
    // Contact shares the same four-frame strike: release is the third frame.
    startAction(
      state,
      queen,
      'contact',
      unit(player.x - queen.x, player.y - queen.y),
      12,
      12,
      events,
      player.id,
    );
    queen.contactReadyAt = queen.action!.endsAt + 6;
  } else approach(state, queen, player, dt, SEAMSTRESS_GROUND_SPEED);
};

export const silkHelperStep = (
  state: SurvivalState,
  enemy: Entity,
  player: Entity | null,
  dt: number,
  events: SemanticEvent[],
): void => {
  if (!player || state.tick < enemy.nextActionAt) return;
  const brood = enemy.archetype === 'seamstress_brood';
  const d = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  if (d < 1.25) {
    const retreat =
      d > 0.01
        ? unit(enemy.x - player.x, enemy.y - player.y)
        : unit(Math.cos(enemy.id), Math.sin(enemy.id));
    approach(
      state,
      enemy,
      { x: enemy.x + retreat.x * 2, y: enemy.y + retreat.y * 2 },
      dt,
      brood ? 3.8 : 3.2,
    );
    return;
  }
  if (d <= (brood ? 4.5 : 7)) {
    const aim = silkAim(player, brood ? 0.55 : 0.85);
    const reach = brood ? 4.5 : 7;
    const distance = Math.hypot(aim.x - enemy.x, aim.y - enemy.y);
    const scale = Math.min(1, reach / (distance || 1));
    const to = silkLanding(
      state,
      enemy,
      { x: enemy.x + (aim.x - enemy.x) * scale, y: enemy.y + (aim.y - enemy.y) * scale },
      1.5,
    );
    if (to) {
      armFlight(
        state,
        enemy,
        to,
        brood ? 14 : 22,
        brood ? 7 : 9,
        brood ? 18 : 26,
        events,
        player.id,
      );
      return;
    }
  }
  approach(state, enemy, player, dt, brood ? 3.8 : 3.2);
};

/** Called before actions, so a destroyed support or dead mother cannot leave an invisible attack. */
export const silkMaintenance = (
  state: SurvivalState,
  enemy: Entity,
  events: SemanticEvent[],
): boolean => {
  if (
    enemy.summonerId !== undefined &&
    !state.enemies.some((e) => e.alive && e.id === enemy.summonerId)
  ) {
    const at = silkLanding(state, enemy, enemy, 6);
    if (at) {
      enemy.x = at.x;
      enemy.y = at.y;
    }
    enemy.hp = 0;
    enemy.alive = false;
    enemy.action = undefined;
    events.push({ t: 'action_end', entity: enemy.id });
    events.push({
      t: 'death',
      entity: enemy.id,
      archetype: enemy.archetype,
      x: enemy.x,
      y: enemy.y,
      facingX: enemy.facing.x,
      facingY: enemy.facing.y,
      tick: state.tick,
    });
    return true;
  }
  if (
    enemy.archetype === 'seamstress' &&
    state.tick === enemy.stunnedUntil &&
    (enemy.silk?.repositionUntil ?? 0) > state.tick
  )
    events.push({
      t: 'boss_vulnerable',
      archetype: 'seamstress',
      x: enemy.x,
      y: enemy.y,
      open: false,
    });
  const anchor = enemy.action?.silkFlight?.anchor;
  if (
    anchor !== undefined &&
    ![SOLID_SUTURE_ANCHOR, SOLID_SUTURE_CRACKED].includes(state.solid[anchor])
  )
    dropSeamstress(state, enemy, events);
  return false;
};

/** No contact during travel. One authoritative impact, also the sound/VFX tick. */
export const silkStride = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const action = enemy.action,
    f: SilkFlight | undefined = action?.silkFlight;
  if (!action || !f || state.tick < action.releaseAt) return;
  if (state.tick <= f.landAt) {
    const p = Math.min(
      1,
      (state.tick - action.releaseAt) / Math.max(1, f.landAt - action.releaseAt),
    );
    enemy.x = f.fromX + (f.toX - f.fromX) * p;
    enemy.y = f.fromY + (f.toY - f.fromY) * p;
  }
  if (state.tick >= f.landAt && !action.landed) {
    const to = silkLanding(
      state,
      enemy,
      { x: f.toX, y: f.toY },
      Math.max(state.config.width, state.config.height),
    );
    if (!to) return;
    enemy.x = to.x;
    enemy.y = to.y;
    if (Math.hypot(to.x - f.toX, to.y - f.toY) > 0.01) {
      // Terrain changed under the locked mark: land safely and cancel its damage.
      action.contactedSlots = 15;
    }
    action.landed = true;
  }
  if (state.tick !== f.impactAt) return;
  const queen = enemy.archetype === 'seamstress';
  const hit = silkStrike(enemy);
  if (queen)
    events.push({
      t: 'boss_attack',
      archetype: 'seamstress',
      ability: 'tether',
      ...hit,
      dx: action.direction.x,
      dy: action.direction.y,
    });
  else events.push({ t: 'suture', phase: 'snap', id: -enemy.id, ...hit });
  if (action.contactedSlots === 15) return;
  for (const p of activePlayers(state)) {
    if (Math.hypot(p.x - hit.x, p.y - hit.y) > hit.radius + p.radius) continue;
    action.contactedSlots = (action.contactedSlots ?? 0) | (1 << (p.slot ?? 0));
    damageEntity(state, p, queen ? 24 : enemy.archetype === 'seamstress_brood' ? 7 : 12, events, {
      kind: 'enemy_contact',
      archetype: enemy.archetype as 'seamstress' | 'seamstress_brood' | 'stitcher',
      elite: false,
    });
  }
};
