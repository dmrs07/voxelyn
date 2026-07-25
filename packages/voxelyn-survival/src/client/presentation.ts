import { TICK_HZ, type Entity, type EntityActionKind, type SemanticEvent, type SurvivalState } from '@voxelyn/survival-sim';
import type { EntityAnimState } from './sprites';

export type PresentedAnimation = {
  anim: string;
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

    const authoritative = entity.action;
    const eventIntent = this.actions.get(entity.id);
    const action = authoritative
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
        const elapsedMs = Math.max(0, ((state.tick - action.startTick) / TICK_HZ) * 1000);
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
