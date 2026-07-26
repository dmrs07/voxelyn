import { TICK_HZ, type Entity, type EntityActionKind, type SemanticEvent, type SurvivalState } from '@voxelyn/survival-sim';
import type { EntityAnimState, LayeredPlayerAnimation, SpriteAnimationSelection } from './sprites';

export type PresentedAnimation = {
  anim: SpriteAnimationSelection;
  elapsedMs: number;
  facingX: number;
  facingY: number;
};

export type DeathTombstone = {
  entity: number;
  archetype: string;
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  startedMs: number;
  expiresMs: number;
};

type ActionIntent = {
  action: EntityActionKind;
  startTick: number;
  releaseTick: number;
  endTick: number;
  dx: number;
  dy: number;
};

const actionAnimation = (action: EntityActionKind): string => {
  if (action === 'detonate' || action === 'charge' || action === 'pulse') return 'special';
  return 'attack';
};

const actionElapsedMs = (action: ActionIntent, tick: number): number =>
  Math.max(0, ((tick - action.startTick) / TICK_HZ) * 1000);

/**
 * Recoil visual curto e desacoplado da simulação. Ele nasce no release do
 * ataque e volta rapidamente a zero usando ease-out quadrático.
 */
export const recoilAtElapsed = (elapsedMs: number, releaseMs: number, durationMs = 120): number => {
  const age = elapsedMs - releaseMs;
  if (age < 0 || age >= durationMs) return 0;
  const t = age / durationMs;
  return (1 - t) * (1 - t);
};

const layeredPlayerAnimation = (
  entity: Entity,
  base: EntityAnimState,
  action: ActionIntent,
  tick: number,
  nowMs: number
): LayeredPlayerAnimation => {
  const upperElapsedMs = actionElapsedMs(action, tick);
  const releaseMs = Math.max(0, ((action.releaseTick - action.startTick) / TICK_HZ) * 1000);
  const walking = base.anim === 'walk';
  const hasMoveFacing = Math.hypot(base.moveFacingX, base.moveFacingY) > 0.001;

  return {
    kind: 'layered-player',
    lower: {
      animation: walking ? 'walk' : 'idle',
      elapsedMs: nowMs - base.animStartMs,
      facingX: walking && hasMoveFacing ? base.moveFacingX : entity.facing.x,
      facingY: walking && hasMoveFacing ? base.moveFacingY : entity.facing.y,
    },
    upper: {
      animation: actionAnimation(action.action),
      elapsedMs: upperElapsedMs,
      facingX: action.dx,
      facingY: action.dy,
    },
    recoil: recoilAtElapsed(upperElapsedMs, releaseMs),
  };
};

/** Client-side visual state that never feeds back into the authoritative simulation. */
export class EntityPresentation {
  private readonly actions = new Map<number, ActionIntent>();
  private readonly downedAt = new Map<number, number>();
  private readonly reviveUntil = new Map<number, { startMs: number; endMs: number }>();
  private readonly tombstonesById = new Map<number, DeathTombstone>();

  reset(): void {
    this.actions.clear();
    this.downedAt.clear();
    this.reviveUntil.clear();
    this.tombstonesById.clear();
  }

  ingest(events: readonly SemanticEvent[], nowMs: number): void {
    for (const event of events) {
      if (event.t === 'action_start') {
        this.actions.set(event.entity, {
          action: event.action,
          startTick: event.startTick,
          releaseTick: event.releaseTick,
          endTick: event.endTick,
          dx: event.dx,
          dy: event.dy,
        });
      } else if (event.t === 'player_down') {
        this.downedAt.set(event.slot + 1, nowMs);
      } else if (event.t === 'revive') {
        const id = event.slot + 1;
        this.downedAt.delete(id);
        this.reviveUntil.set(id, { startMs: nowMs, endMs: nowMs + 750 });
      } else if (event.t === 'death') {
        this.actions.delete(event.entity);
        this.downedAt.delete(event.entity);
        this.reviveUntil.delete(event.entity);
        this.tombstonesById.set(event.entity, {
          entity: event.entity,
          archetype: event.archetype,
          x: event.x,
          y: event.y,
          facingX: event.facingX,
          facingY: event.facingY,
          startedMs: nowMs,
          expiresMs: nowMs + 650,
        });
      }
    }
  }

  animationFor(
    entity: Entity,
    state: SurvivalState,
    base: EntityAnimState,
    nowMs: number,
    downed = false
  ): PresentedAnimation {
    const revive = this.reviveUntil.get(entity.id);
    if (revive) {
      if (nowMs < revive.endMs) {
        return { anim: 'revive', elapsedMs: nowMs - revive.startMs, facingX: entity.facing.x, facingY: entity.facing.y };
      }
      this.reviveUntil.delete(entity.id);
    }

    if (downed) {
      const start = this.downedAt.get(entity.id) ?? nowMs;
      this.downedAt.set(entity.id, start);
      return { anim: 'downed', elapsedMs: nowMs - start, facingX: entity.facing.x, facingY: entity.facing.y };
    }
    this.downedAt.delete(entity.id);

    // Estados que alteram a silhueta inteira interrompem a composição em
    // camadas. O ataque continua registrado e pode reaparecer após o hit.
    if (base.anim === 'hit' || base.anim === 'die') {
      return {
        anim: base.anim,
        elapsedMs: nowMs - base.animStartMs,
        facingX: entity.facing.x,
        facingY: entity.facing.y,
      };
    }

    const authoritative = entity.action;
    const eventIntent = this.actions.get(entity.id);
    const action: ActionIntent | undefined = authoritative
      ? {
          action: authoritative.kind,
          startTick: authoritative.startedAt,
          releaseTick: authoritative.releaseAt,
          endTick: authoritative.endsAt,
          dx: authoritative.direction.x,
          dy: authoritative.direction.y,
        }
      : eventIntent;
    if (action) {
      if (state.tick <= action.endTick) {
        const elapsedMs = actionElapsedMs(action, state.tick);
        if (entity.archetype === 'prospector') {
          return {
            anim: layeredPlayerAnimation(entity, base, action, state.tick, nowMs),
            elapsedMs,
            facingX: action.dx,
            facingY: action.dy,
          };
        }
        return {
          anim: actionAnimation(action.action),
          elapsedMs,
          facingX: action.dx,
          facingY: action.dy,
        };
      }
      this.actions.delete(entity.id);
    }

    return {
      anim: base.anim,
      elapsedMs: nowMs - base.animStartMs,
      facingX: entity.facing.x,
      facingY: entity.facing.y,
    };
  }

  tombstones(nowMs: number): DeathTombstone[] {
    for (const [id, tombstone] of this.tombstonesById) {
      if (nowMs >= tombstone.expiresMs) this.tombstonesById.delete(id);
    }
    return [...this.tombstonesById.values()];
  }
}
