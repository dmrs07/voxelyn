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

type ActionVisualClock = {
  startTick: number;
  startedMs: number;
};

export const actionAnimation = (action: EntityActionKind): string => {
  if (action === 'detonate' || action === 'charge' || action === 'pulse' || action === 'hurl') return 'special';
  return 'attack';
};

const actionElapsedMs = (action: ActionIntent, tick: number): number =>
  Math.max(0, ((tick - action.startTick) / TICK_HZ) * 1000);

/**
 * Resolve a direção visual de locomoção sem cair no DR implícito de
 * `dirFromFacing(0, 0)`. Durante walk, o deslocamento observado é a fonte de
 * verdade; fora dele, preservamos o facing autoritativo da entidade.
 */
export const locomotionFacing = (
  base: EntityAnimState,
  fallbackX: number,
  fallbackY: number
): { x: number; y: number } => {
  const hasMoveFacing = Math.hypot(base.moveFacingX, base.moveFacingY) > 0.001;
  if (base.anim === 'walk' && hasMoveFacing) {
    return { x: base.moveFacingX, y: base.moveFacingY };
  }
  return { x: fallbackX, y: fallbackY };
};

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
  upperElapsedMs: number,
  nowMs: number
): LayeredPlayerAnimation => {
  const releaseMs = Math.max(0, ((action.releaseTick - action.startTick) / TICK_HZ) * 1000);
  const walking = base.anim === 'walk';
  const lowerFacing = locomotionFacing(base, entity.facing.x, entity.facing.y);

  return {
    kind: 'layered-player',
    lower: {
      animation: walking ? 'walk' : 'idle',
      elapsedMs: nowMs - base.animStartMs,
      facingX: lowerFacing.x,
      facingY: lowerFacing.y,
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
  private readonly actionVisualClocks = new Map<number, ActionVisualClock>();
  private readonly downedAt = new Map<number, number>();
  private readonly reviveUntil = new Map<number, { startMs: number; endMs: number }>();
  private readonly tombstonesById = new Map<number, DeathTombstone>();

  reset(): void {
    this.actions.clear();
    this.actionVisualClocks.clear();
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
        // Uma nova ação com outro startTick receberá um relógio novo na primeira
        // renderização, ancorado ao elapsed autoritativo daquele instante.
        const clock = this.actionVisualClocks.get(event.entity);
        if (clock && clock.startTick !== event.startTick) this.actionVisualClocks.delete(event.entity);
      } else if (event.t === 'player_down') {
        this.downedAt.set(event.slot + 1, nowMs);
      } else if (event.t === 'revive') {
        const id = event.slot + 1;
        this.downedAt.delete(id);
        this.reviveUntil.set(id, { startMs: nowMs, endMs: nowMs + 750 });
      } else if (event.t === 'death') {
        this.actions.delete(event.entity);
        this.actionVisualClocks.delete(event.entity);
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

  private visualActionElapsed(entityId: number, action: ActionIntent, tick: number, nowMs: number): number {
    const authoritativeElapsed = actionElapsedMs(action, tick);
    let clock = this.actionVisualClocks.get(entityId);
    if (!clock || clock.startTick !== action.startTick) {
      clock = { startTick: action.startTick, startedMs: nowMs - authoritativeElapsed };
      this.actionVisualClocks.set(entityId, clock);
    }
    // O tick continua como piso autoritativo, enquanto nowMs avança a pose e o
    // recoil nos frames intermediários de renderização.
    return Math.max(authoritativeElapsed, nowMs - clock.startedMs);
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

    // Morte sempre substitui a silhueta inteira. Hit só interrompe a composição
    // do Prospector; inimigos mantêm telegraphs de ações que a sim não cancelou.
    if (base.anim === 'die') {
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
        if (entity.archetype === 'prospector' && base.anim === 'hit') {
          return {
            anim: 'hit',
            elapsedMs: nowMs - base.animStartMs,
            facingX: entity.facing.x,
            facingY: entity.facing.y,
          };
        }

        const elapsedMs = this.visualActionElapsed(entity.id, action, state.tick, nowMs);
        if (entity.archetype === 'prospector') {
          return {
            anim: layeredPlayerAnimation(entity, base, action, elapsedMs, nowMs),
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
      this.actionVisualClocks.delete(entity.id);
    } else {
      this.actionVisualClocks.delete(entity.id);
    }

    const facing = locomotionFacing(base, entity.facing.x, entity.facing.y);
    return {
      anim: base.anim,
      elapsedMs: nowMs - base.animStartMs,
      facingX: facing.x,
      facingY: facing.y,
    };
  }

  tombstones(nowMs: number): DeathTombstone[] {
    for (const [id, tombstone] of this.tombstonesById) {
      if (nowMs >= tombstone.expiresMs) this.tombstonesById.delete(id);
    }
    return [...this.tombstonesById.values()];
  }
}
