import {
  FEATURE_PROP_BEACON,
  FEATURE_PROP_CRATE,
  FEATURE_PROP_DEBRIS,
  FEATURE_PROP_FUNGAL_CLUSTER,
  FEATURE_TRACK,
  INSPECT_OVERLAY_MS,
  INSPECT_TEXTS,
  INTERACT_RANGE,
  TERMINAL_REPAIR_RADIUS,
} from './constants';
import type { GameState, LevelInteractable, Vec2 } from './types';
import { inBounds2D, featureFlagsAt } from '../world/level';
import { activateTerminal } from '../world/features';

const manhattan = (a: Vec2, b: Vec2): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const pushAlert = (state: GameState, text: string, tone: 'info' | 'warn' | 'buff'): void => {
  state.uiAlerts.push({
    text,
    tone,
    untilMs: state.simTimeMs + 1800,
  });
  if (state.uiAlerts.length > 8) {
    state.uiAlerts.splice(0, state.uiAlerts.length - 8);
  }
};

const setInspectOverlay = (state: GameState, text: string): void => {
  state.inspectOverlay = {
    text,
    untilMs: state.simTimeMs + INSPECT_OVERLAY_MS,
  };
};

const interactablesAt = (state: GameState, x: number, y: number): LevelInteractable[] =>
  state.level.interactables.filter((item) => item.x === x && item.y === y);

const countEnemiesNear = (state: GameState, center: Vec2, radius: number): number => {
  let count = 0;
  for (const entity of state.level.entities.values()) {
    if (entity.kind !== 'enemy' || !entity.alive) continue;
    if (manhattan(center, { x: entity.x, y: entity.y }) <= radius) {
      count += 1;
    }
  }
  return count;
};

const inspectTextForFlags = (flags: number): string | null => {
  if ((flags & FEATURE_PROP_FUNGAL_CLUSTER) !== 0) return INSPECT_TEXTS.fungal_cluster;
  if ((flags & FEATURE_PROP_DEBRIS) !== 0) return INSPECT_TEXTS.debris;
  if ((flags & FEATURE_PROP_CRATE) !== 0) return INSPECT_TEXTS.crate;
  if ((flags & FEATURE_PROP_BEACON) !== 0) return INSPECT_TEXTS.beacon;
  if ((flags & FEATURE_TRACK) !== 0) return INSPECT_TEXTS.track;
  return null;
};

export const attemptInteractionAt = (state: GameState, target: Vec2): boolean => {
  const player = state.level.entities.get(state.playerId);
  if (!player || player.kind !== 'player' || !player.alive) return false;
  if (!inBounds2D(state.level, target.x, target.y)) return false;

  if (manhattan({ x: player.x, y: player.y }, target) > INTERACT_RANGE) {
    pushAlert(state, 'Muito longe.', 'warn');
    return true;
  }

  const interactables = interactablesAt(state, target.x, target.y);
  for (const item of interactables) {
    if (item.type === 'terminal') {
      if (item.broken) {
        const enemies = countEnemiesNear(state, { x: item.x, y: item.y }, TERMINAL_REPAIR_RADIUS);
        if (enemies > 0) {
          setInspectOverlay(state, INSPECT_TEXTS.terminal_broken);
          return true;
        }
        // Terminal is broken and no enemies nearby - show repair modal
        state.interactionModal = {
          kind: 'terminal_repair',
          sourceId: item.id,
          text: INSPECT_TEXTS.terminal_ready,
        };
        return true;
      }

      if (!item.active) {
        activateTerminal(state, item);
        return true;
      }

      setInspectOverlay(state, INSPECT_TEXTS.terminal_active);
      return true;
    }
  }

  const flags = featureFlagsAt(state.level, target.x, target.y);
  const inspectText = inspectTextForFlags(flags);
  if (inspectText) {
    setInspectOverlay(state, inspectText);
    return true;
  }

  return false;
};

export const confirmInteractionModal = (state: GameState): boolean => {
  const modal = state.interactionModal;
  if (!modal) return false;

  if (modal.kind === 'terminal_repair') {
    const terminal = state.level.interactables.find(
      (item): item is Extract<LevelInteractable, { type: 'terminal' }> =>
        item.type === 'terminal' && item.id === modal.sourceId
    );
    if (terminal) {
      terminal.broken = false;
      activateTerminal(state, terminal);
      pushAlert(state, 'Terminal consertado.', 'buff');
    }
  }

  state.interactionModal = null;
  return true;
};

export const cancelInteractionModal = (state: GameState): boolean => {
  if (!state.interactionModal) return false;
  state.interactionModal = null;
  return true;
};
