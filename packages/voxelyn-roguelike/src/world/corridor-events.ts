import {
  EVENT_AMBUSH_ACTIVE_MS,
  EVENT_AMBUSH_CHANCE_PER_FLOOR_BASE,
  EVENT_AMBUSH_MAX,
  EVENT_MAX_COOLDOWN_MS,
  EVENT_MIN_COOLDOWN_MS,
  EVENT_SPORE_WAVE_ACTIVE_MS,
  EVENT_SPORE_WAVE_CHANCE_PER_FLOOR_BASE,
  EVENT_SPORE_WAVE_MAX,
  SCREEN_FLASH_MS,
  SPORE_LANE_SLOW_MS,
  SPORE_LANE_TICK_MS,
} from '../game/constants';
import type { CorridorEventState, GameState, LevelState, Vec2 } from '../game/types';

const index2D = (width: number, x: number, y: number): number => y * width + x;

const hashInt = (v: number): number => {
  let x = v >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
};

const hashString = (value: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

const hash01 = (seed: number): number => (hashInt(seed) & 0xffff) / 0xffff;

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

const severityForFloor = (floor: number): 1 | 2 | 3 => {
  if (floor >= 8) return 3;
  if (floor >= 4) return 2;
  return 1;
};

const buildLineCells = (
  level: LevelState,
  start: Vec2,
  dx: number,
  dy: number,
  length: number
): Vec2[] => {
  const cells: Vec2[] = [];
  for (let i = 0; i < length; i += 1) {
    const x = start.x + dx * i;
    const y = start.y + dy * i;
    if (x < 1 || y < 1 || x >= level.width - 1 || y >= level.height - 1) break;
    const idx = index2D(level.width, x, y);
    if ((level.corridorCandidates[idx] ?? 0) !== 1) break;
    cells.push({ x, y });
  }
  return cells;
};

const pickEventCells = (level: LevelState, seed: number): Vec2[] => {
  const candidates: number[] = [];
  for (let i = 0; i < level.corridorCandidates.length; i += 1) {
    if ((level.corridorCandidates[i] ?? 0) === 1) {
      candidates.push(i);
    }
  }
  if (candidates.length === 0) return [];

  const startIdx = candidates[hashInt(seed) % candidates.length] ?? candidates[0] ?? 0;
  const sx = startIdx % level.width;
  const sy = Math.floor(startIdx / level.width);

  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  const firstDir = hashInt(seed ^ 0x2ff1) % dirs.length;
  const len = 3 + (hashInt(seed ^ 0x77a2) % 5);

  for (let i = 0; i < dirs.length; i += 1) {
    const dir = dirs[(firstDir + i) % dirs.length] ?? [1, 0];
    const cells = buildLineCells(level, { x: sx, y: sy }, dir[0], dir[1], len);
    if (cells.length >= 3) return cells;
  }

  return [{ x: sx, y: sy }];
};

export const createCorridorEventsForLevel = (
  level: LevelState,
  seed: number
): CorridorEventState[] => {
  const events: CorridorEventState[] = [];
  const target = level.floorNumber >= 7 ? 3 : level.floorNumber >= 4 ? 2 : 1;
  const severity = severityForFloor(level.floorNumber);

  for (let i = 0; i < target; i += 1) {
    const eventSeed = seed ^ (i * 0x9e3779b1);
    const kind = (hashInt(eventSeed ^ 0x3344) & 1) === 0 ? 'spore_wave' : 'ambush_ping';
    const cells = pickEventCells(level, eventSeed);
    if (cells.length === 0) continue;

    const cooldownJitter = hashInt(eventSeed ^ 0x9912) % (EVENT_MAX_COOLDOWN_MS - EVENT_MIN_COOLDOWN_MS + 1);
    events.push({
      id: `evt_${level.floorNumber}_${i}_${kind}`,
      kind,
      cells,
      activeUntilMs: 0,
      cooldownUntilMs: EVENT_MIN_COOLDOWN_MS + cooldownJitter,
      nextEffectTickAt: 0,
      severity,
    });
  }

  return events;
};

export const isCellInActiveCorridorEvent = (
  level: LevelState,
  x: number,
  y: number,
  nowMs: number
): { kind: 'spore_wave' | 'ambush_ping'; severity: 1 | 2 | 3 } | null => {
  for (const event of level.corridorEvents) {
    if (nowMs >= event.activeUntilMs) continue;
    for (const cell of event.cells) {
      if (cell.x === x && cell.y === y) {
        return { kind: event.kind, severity: event.severity };
      }
    }
  }
  return null;
};

const eventChance = (event: CorridorEventState, floorNumber: number): number => {
  if (event.kind === 'spore_wave') {
    return Math.min(EVENT_SPORE_WAVE_MAX, EVENT_SPORE_WAVE_CHANCE_PER_FLOOR_BASE + floorNumber * 0.018);
  }
  return Math.min(EVENT_AMBUSH_MAX, EVENT_AMBUSH_CHANCE_PER_FLOOR_BASE + floorNumber * 0.015);
};

const activateEvent = (state: GameState, event: CorridorEventState): void => {
  const now = state.simTimeMs;
  const activeMs = event.kind === 'spore_wave'
    ? EVENT_SPORE_WAVE_ACTIVE_MS + event.severity * 180
    : EVENT_AMBUSH_ACTIVE_MS + event.severity * 120;

  event.activeUntilMs = now + activeMs;
  event.nextEffectTickAt = now;
  const jitterSeed = hashString(event.id) ^ state.simTick ^ (event.severity * 17);
  const cooldownJitter = hashInt(jitterSeed) % (EVENT_MAX_COOLDOWN_MS - EVENT_MIN_COOLDOWN_MS + 1);
  event.cooldownUntilMs = event.activeUntilMs + EVENT_MIN_COOLDOWN_MS + cooldownJitter;

  if (event.kind === 'spore_wave') {
    pushAlert(state, 'Onda de esporos no corredor!', 'warn');
  } else {
    pushAlert(state, 'Emboscada detectada!', 'warn');
    state.cameraShakeMs = Math.max(state.cameraShakeMs, 120 + event.severity * 20);
  }
};

const applyActiveEventEffects = (state: GameState, event: CorridorEventState): void => {
  if (event.kind !== 'spore_wave') return;

  const player = state.level.entities.get(state.playerId);
  if (!player || player.kind !== 'player' || !player.alive) return;
  if (state.simTimeMs < event.nextEffectTickAt) return;

  for (const cell of event.cells) {
    if (cell.x !== player.x || cell.y !== player.y) continue;
    const damage = Math.max(1, event.severity);
    player.hp = Math.max(0, player.hp - damage);
    state.activeDebuffs.slowUntilMs = Math.max(state.activeDebuffs.slowUntilMs, state.simTimeMs + SPORE_LANE_SLOW_MS);
    state.screenFlash.damageMs = Math.max(state.screenFlash.damageMs, SCREEN_FLASH_MS);
    event.nextEffectTickAt = state.simTimeMs + SPORE_LANE_TICK_MS;
    if (player.hp <= 0) {
      player.alive = false;
      state.phase = 'game_over';
    }
    return;
  }

  event.nextEffectTickAt = state.simTimeMs + SPORE_LANE_TICK_MS;
};

export const updateCorridorEvents = (state: GameState): void => {
  const now = state.simTimeMs;
  for (const event of state.level.corridorEvents) {
    if (now < event.activeUntilMs) {
      applyActiveEventEffects(state, event);
      continue;
    }

    if (now < event.cooldownUntilMs) continue;
    const seed = hashString(event.id) ^ (state.simTick * 1103515245) ^ state.level.seed;
    const roll = hash01(seed);
    if (roll <= eventChance(event, state.floorNumber)) {
      activateEvent(state, event);
      continue;
    }

    // Retry later if activation missed.
    event.cooldownUntilMs = now + EVENT_MIN_COOLDOWN_MS;
  }
};
