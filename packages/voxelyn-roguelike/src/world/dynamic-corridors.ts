import { RNG } from '@voxelyn/core';
import {
  DYNAMIC_ALERT_MS,
  DYNAMIC_CLOSED_MS,
  DYNAMIC_CELL_TARGET_MAX,
  DYNAMIC_CELL_TARGET_MIN,
  DYNAMIC_OPEN_MS,
  DYNAMIC_RECHECK_PATH_MS,
  DYNAMIC_SOFTLOCK_GRACE_MS,
  DYNAMIC_WARNING_MS,
  FEATURE_GATE,
  FEATURE_ROOT_BARRIER,
  FEATURE_TERMINAL,
  SCREEN_FLASH_MS,
  SPORE_LANE_DAMAGE,
  SPORE_LANE_SLOW_MS,
  SPORE_LANE_TICK_MS,
} from '../game/constants';
import type {
  DynamicCellKind,
  DynamicCellState,
  GameState,
  LevelState,
  Vec2,
} from '../game/types';
import {
  featureFlagsAt,
  inBounds2D,
  isFeatureBlockedCell,
} from './level';

const index2D = (width: number, x: number, y: number): number => y * width + x;

const neighbors4 = (x: number, y: number): Vec2[] => [
  { x: x + 1, y },
  { x: x - 1, y },
  { x, y: y + 1 },
  { x, y: y - 1 },
];

const isBasePassable = (level: LevelState, x: number, y: number): boolean =>
  inBounds2D(level, x, y) && (level.heightMap[index2D(level.width, x, y)] ?? 1) < 0.5;

const pushAlert = (state: GameState, text: string, tone: 'info' | 'warn' | 'buff'): void => {
  state.uiAlerts.push({
    text,
    tone,
    untilMs: state.simTimeMs + DYNAMIC_ALERT_MS,
  });
  if (state.uiAlerts.length > 8) {
    state.uiAlerts.splice(0, state.uiAlerts.length - 8);
  }
};

const shouldSkipCandidate = (level: LevelState, x: number, y: number): boolean => {
  if ((x === level.entry.x && y === level.entry.y) || (x === level.exit.x && y === level.exit.y)) {
    return true;
  }

  const flags = featureFlagsAt(level, x, y);
  if ((flags & FEATURE_ROOT_BARRIER) !== 0) return true;
  if ((flags & FEATURE_GATE) !== 0) return true;
  if ((flags & FEATURE_TERMINAL) !== 0) return true;
  return false;
};

export const hasPathToGoal = (level: LevelState, start: Vec2, goal: Vec2): boolean => {
  if (!isBasePassable(level, start.x, start.y) || !isBasePassable(level, goal.x, goal.y)) return false;
  if (isFeatureBlockedCell(level, start.x, start.y) || isFeatureBlockedCell(level, goal.x, goal.y)) return false;

  const size = level.width * level.height;
  const queueX = new Int16Array(size);
  const queueY = new Int16Array(size);
  const visited = new Uint8Array(size);
  let head = 0;
  let tail = 0;

  queueX[tail] = start.x;
  queueY[tail] = start.y;
  visited[index2D(level.width, start.x, start.y)] = 1;
  tail += 1;

  while (head < tail) {
    const x = queueX[head] ?? 0;
    const y = queueY[head] ?? 0;
    head += 1;

    if (x === goal.x && y === goal.y) return true;

    for (const n of neighbors4(x, y)) {
      if (!isBasePassable(level, n.x, n.y)) continue;
      if (isFeatureBlockedCell(level, n.x, n.y)) continue;
      const ni = index2D(level.width, n.x, n.y);
      if (visited[ni] === 1) continue;
      visited[ni] = 1;
      queueX[tail] = n.x;
      queueY[tail] = n.y;
      tail += 1;
    }
  }

  return false;
};

const pickDynamicKind = (floorNumber: number, rng: RNG): DynamicCellKind => {
  const roll = rng.nextFloat01();
  if (floorNumber <= 3) {
    if (roll < 0.56) return 'root_barrier';
    if (roll < 0.88) return 'pressure_gate';
    return 'spore_lane';
  }
  if (floorNumber <= 7) {
    if (roll < 0.38) return 'root_barrier';
    if (roll < 0.7) return 'pressure_gate';
    return 'spore_lane';
  }
  if (roll < 0.26) return 'root_barrier';
  if (roll < 0.54) return 'pressure_gate';
  return 'spore_lane';
};

const isTooCloseToExisting = (x: number, y: number, existing: DynamicCellState[]): boolean => {
  for (const cell of existing) {
    const dx = cell.x - x;
    const dy = cell.y - y;
    if (dx * dx + dy * dy < 9) return true;
  }
  return false;
};

const isBlockingDynamicKind = (kind: DynamicCellKind): boolean =>
  kind === 'root_barrier' || kind === 'pressure_gate';

export const buildCorridorCandidates = (
  mask: Uint8Array,
  width: number,
  height: number,
  entry: Vec2,
  exit: Vec2,
  featureMap: Uint16Array
): Uint8Array => {
  const out = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = index2D(width, x, y);
      if ((mask[i] ?? 0) !== 1) continue;
      if ((x === entry.x && y === entry.y) || (x === exit.x && y === exit.y)) continue;
      if ((featureMap[i] ?? 0) & (FEATURE_ROOT_BARRIER | FEATURE_GATE | FEATURE_TERMINAL)) continue;

      let degree = 0;
      if (mask[index2D(width, x + 1, y)] === 1) degree += 1;
      if (mask[index2D(width, x - 1, y)] === 1) degree += 1;
      if (mask[index2D(width, x, y + 1)] === 1) degree += 1;
      if (mask[index2D(width, x, y - 1)] === 1) degree += 1;
      if (degree <= 2) out[i] = 1;
    }
  }
  return out;
};

export const createDynamicCellsForLevel = (
  level: LevelState,
  seed: number
): DynamicCellState[] => {
  const rng = new RNG(seed ^ 0x73e2a1);
  const candidates: number[] = [];
  for (let i = 0; i < level.corridorCandidates.length; i += 1) {
    if ((level.corridorCandidates[i] ?? 0) === 1) {
      candidates.push(i);
    }
  }

  if (candidates.length === 0) return [];

  // Deterministic shuffle
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    const tmp = candidates[i] ?? 0;
    candidates[i] = candidates[j] ?? 0;
    candidates[j] = tmp;
  }

  const target = Math.min(
    candidates.length,
    DYNAMIC_CELL_TARGET_MIN + rng.nextInt(DYNAMIC_CELL_TARGET_MAX - DYNAMIC_CELL_TARGET_MIN + 1)
  );

  const out: DynamicCellState[] = [];
  for (const idx of candidates) {
    if (out.length >= target) break;
    const x = idx % level.width;
    const y = Math.floor(idx / level.width);
    if (shouldSkipCandidate(level, x, y)) continue;
    if (isTooCloseToExisting(x, y, out)) continue;

    const kind = pickDynamicKind(level.floorNumber, rng);
    const openMs = DYNAMIC_OPEN_MS + rng.nextInt(900);
    const warningMs = DYNAMIC_WARNING_MS + rng.nextInt(280);
    const closedMs = DYNAMIC_CLOSED_MS + rng.nextInt(320);

    out.push({
      id: `dyn_${level.floorNumber}_${x}_${y}`,
      kind,
      x,
      y,
      phase: 'open',
      nextTransitionMs: openMs,
      openMs,
      warningMs,
      closedMs,
      damagePerTick: kind === 'spore_lane' ? SPORE_LANE_DAMAGE : 0,
      slowMs: kind === 'spore_lane' ? SPORE_LANE_SLOW_MS : 0,
      nextDamageTickAt: 0,
    });
  }

  return out;
};

const transitionCell = (cell: DynamicCellState, nowMs: number): void => {
  while (nowMs >= cell.nextTransitionMs) {
    if (cell.phase === 'open') {
      cell.phase = 'warning';
      cell.nextTransitionMs += cell.warningMs;
      continue;
    }
    if (cell.phase === 'warning') {
      cell.phase = 'closed';
      cell.nextTransitionMs += cell.closedMs;
      if (cell.kind === 'spore_lane') {
        cell.nextDamageTickAt = nowMs;
      }
      continue;
    }
    cell.phase = 'open';
    cell.nextTransitionMs += cell.openMs;
    cell.nextDamageTickAt = 0;
  }
};

const applySporeLaneEffects = (state: GameState): void => {
  const player = state.level.entities.get(state.playerId);
  if (!player || player.kind !== 'player' || !player.alive) return;

  const now = state.simTimeMs;
  for (const cell of state.level.dynamicCells) {
    if (cell.kind !== 'spore_lane') continue;
    if (cell.phase !== 'closed') continue;
    if (player.x !== cell.x || player.y !== cell.y) continue;
    if (now < cell.nextDamageTickAt) continue;

    player.hp = Math.max(0, player.hp - cell.damagePerTick);
    cell.nextDamageTickAt = now + SPORE_LANE_TICK_MS;
    state.activeDebuffs.slowUntilMs = Math.max(state.activeDebuffs.slowUntilMs, now + cell.slowMs);
    state.screenFlash.damageMs = Math.max(state.screenFlash.damageMs, SCREEN_FLASH_MS);
    pushAlert(state, 'Faixa de esporos ativa!', 'warn');

    if (player.hp <= 0) {
      player.alive = false;
      state.phase = 'game_over';
      return;
    }
  }
};

const recoverPathIfNeeded = (state: GameState): void => {
  const player = state.level.entities.get(state.playerId);
  if (!player || player.kind !== 'player' || !player.alive) return;

  const now = state.simTimeMs;
  if (now - state.pathRecovery.lastPathCheckAtMs < DYNAMIC_RECHECK_PATH_MS) return;
  state.pathRecovery.lastPathCheckAtMs = now;

  const hasPath = hasPathToGoal(state.level, { x: player.x, y: player.y }, state.level.exit);
  if (hasPath) {
    state.pathRecovery.blockedSinceMs = 0;
    return;
  }

  if (state.pathRecovery.blockedSinceMs === 0) {
    state.pathRecovery.blockedSinceMs = now;
    return;
  }

  if (now - state.pathRecovery.blockedSinceMs < DYNAMIC_SOFTLOCK_GRACE_MS) return;

  const candidates = state.level.dynamicCells
    .filter((cell) => cell.phase === 'closed' && isBlockingDynamicKind(cell.kind))
    .sort((a, b) => {
      const da = Math.abs(a.x - player.x) + Math.abs(a.y - player.y);
      const db = Math.abs(b.x - player.x) + Math.abs(b.y - player.y);
      return da - db;
    });

  let recovered = false;
  for (const cell of candidates) {
    const prevPhase = cell.phase;
    const prevNext = cell.nextTransitionMs;
    cell.phase = 'open';
    cell.nextTransitionMs = now + cell.openMs;
    if (hasPathToGoal(state.level, { x: player.x, y: player.y }, state.level.exit)) {
      recovered = true;
      break;
    }
    cell.phase = prevPhase;
    cell.nextTransitionMs = prevNext;
  }

  if (!recovered && candidates.length > 0) {
    for (const cell of candidates) {
      cell.phase = 'open';
      cell.nextTransitionMs = now + cell.openMs;
      if (hasPathToGoal(state.level, { x: player.x, y: player.y }, state.level.exit)) {
        recovered = true;
        break;
      }
    }
  }

  if (recovered) {
    state.pathRecovery.forcedOpenCount += 1;
    state.pathRecovery.lastRecoverAtMs = now;
    state.pathRecovery.blockedSinceMs = 0;
    pushAlert(state, 'Corredor de emergencia liberado.', 'info');
  }
};

export const updateDynamicCorridors = (state: GameState): void => {
  const now = state.simTimeMs;
  for (const cell of state.level.dynamicCells) {
    const prev = cell.phase;
    transitionCell(cell, now);
    if (prev !== cell.phase && cell.phase === 'warning') {
      pushAlert(state, 'Instabilidade no corredor!', 'warn');
    }
  }

  applySporeLaneEffects(state);
  if (state.phase !== 'game_over') {
    recoverPathIfNeeded(state);
  }
};
