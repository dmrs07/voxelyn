import { SOLID_NONE, SOLID_SUTURE_ANCHOR, SOLID_SUTURE_CRACKED } from './constants.js';
import { markDirty } from './cells.js';
import { cutSuture, suturePoint } from './sutures.js';
import type { Entity, SemanticEvent, SurvivalState, Vec2, WebSupport } from './types.js';

export const WEB_ANCHOR_HP = 6;
export const WEB_JUNCTION_HP = 3;
export const WEB_JUNCTION_RADIUS = 0.45;
export const webSupportMaxHp = (s: WebSupport): number =>
  s.kind === 'anchor' ? WEB_ANCHOR_HP : WEB_JUNCTION_HP;

export const webSupports = (state: SurvivalState): WebSupport[] =>
  state.enemies.flatMap((e) => (e.alive ? (e.silk?.supports ?? []) : []));
export const webSupportAt = (state: SurvivalState, cell: number): WebSupport | undefined =>
  webSupports(state).find((s) => s.cell === cell);

export const registerWebJunctions = (state: SurvivalState, queen: Entity): void => {
  if (!queen.silk) return;
  const supports = (queen.silk.supports ??= []);
  const known = new Set(supports.map((s) => s.cell));
  for (const strand of state.sutures) {
    if (strand.kind !== 'web') continue;
    for (const cell of [strand.a, strand.b]) {
      if (known.has(cell)) continue;
      known.add(cell);
      supports.push({ cell, kind: 'junction', hp: WEB_JUNCTION_HP });
    }
  }
};

/** Called by every solid-damage path; colony anchors retain their existing rules. */
export const damageWebAnchor = (
  state: SurvivalState,
  cell: number,
  events: SemanticEvent[],
): boolean => {
  const support = webSupportAt(state, cell);
  if (!support || support.kind !== 'anchor') return true;
  support.hp = Math.max(0, support.hp - 1);
  if (support.hp === 0) return true;
  state.solid[cell] = support.hp <= WEB_ANCHOR_HP / 2 ? SOLID_SUTURE_CRACKED : SOLID_SUTURE_ANCHOR;
  const p = suturePoint(state, cell);
  markDirty(state, Math.floor(p.x), Math.floor(p.y));
  events.push({ t: 'chip', ...p });
  return false;
};

/** A junction takes repeated aimed impacts; its destruction severs all incident strands. */
export const hitWebJunctions = (
  state: SurvivalState,
  from: Vec2,
  to: Vec2,
  events: SemanticEvent[],
  slot: number,
): Set<number> => {
  const guarded = new Set<number>();
  const dx = to.x - from.x,
    dy = to.y - from.y,
    len2 = dx * dx + dy * dy;
  if (len2 === 0) return guarded;
  for (const support of webSupports(state)) {
    if (support.kind !== 'junction' || support.hp <= 0) continue;
    if (
      !state.sutures.some(
        (s) =>
          s.kind === 'web' && s.phase === 'taut' && (s.a === support.cell || s.b === support.cell),
      )
    )
      continue;
    const p = suturePoint(state, support.cell);
    const t = ((p.x - from.x) * dx + (p.y - from.y) * dy) / len2;
    const closest = Math.max(0, Math.min(1, t));
    if (Math.hypot(p.x - from.x - closest * dx, p.y - from.y - closest * dy) > WEB_JUNCTION_RADIUS)
      continue;
    guarded.add(support.cell);
    // Cross the plane through the knot once, so a slow projectile does not
    // pay multiple impacts while overlapping the same knot on adjacent ticks.
    if (t < 0 || t >= 1) continue;
    support.hp--;
    events.push({ t: 'chip', ...p });
    if (support.hp === 0)
      for (const strand of state.sutures)
        if (strand.kind === 'web' && (strand.a === support.cell || strand.b === support.cell))
          cutSuture(state, strand, events, slot);
  }
  return guarded;
};

/** A reconstructed wall must never appear inside a living body. */
export const canRestoreWebSupport = (state: SurvivalState, support: WebSupport): boolean => {
  if (support.kind === 'junction') return true;
  const solid = state.solid[support.cell];
  if (solid === SOLID_SUTURE_ANCHOR || solid === SOLID_SUTURE_CRACKED) return true;
  if (solid !== SOLID_NONE) return false;
  const p = suturePoint(state, support.cell);
  return ![...state.players, ...state.enemies].some(
    (e) =>
      e.alive && Math.abs(e.x - p.x) < e.radius + 0.55 && Math.abs(e.y - p.y) < e.radius + 0.55,
  );
};

export const restoreWebSupport = (state: SurvivalState, support: WebSupport): boolean => {
  if (!canRestoreWebSupport(state, support)) return false;
  support.hp = webSupportMaxHp(support);
  if (support.kind === 'anchor') {
    state.solid[support.cell] = SOLID_SUTURE_ANCHOR;
    const p = suturePoint(state, support.cell);
    markDirty(state, Math.floor(p.x), Math.floor(p.y));
  }
  return true;
};
