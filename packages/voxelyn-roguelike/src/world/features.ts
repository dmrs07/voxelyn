import { RNG } from '@voxelyn/core';
import {
  BIOFLUID_DAMAGE,
  BIOFLUID_TICK_MS,
  BIOFLUID_DENSITY,
  CRYSTAL_ATTACK_BONUS,
  CRYSTAL_BUFF_MS,
  CRYSTAL_DENSITY,
  CRYSTAL_HEAL,
  FEATURE_BIOFLUID,
  FEATURE_CRYSTAL,
  FEATURE_GATE,
  FEATURE_PORTAL,
  FEATURE_PROP_BEACON,
  FEATURE_PROP_CRATE,
  FEATURE_PROP_DEBRIS,
  FEATURE_PROP_FUNGAL_CLUSTER,
  FEATURE_ROOT_BARRIER,
  FEATURE_SPORE_VENT,
  FEATURE_TERMINAL,
  FEATURE_TRACK,
  ONE_WAY_PORTAL_CHANCE,
  PROP_BEACON_DENSITY,
  PROP_CRATE_DENSITY,
  PROP_DEBRIS_DENSITY,
  PROP_FUNGAL_CLUSTER_DENSITY,
  SCREEN_FLASH_MS,
  SPORE_SLOW_MS,
  SPORE_VENT_COOLDOWN_MS,
  SPORE_VENT_DENSITY,
  TERMINAL_PUZZLE_CHANCE,
  TERMINAL_BROKEN_CHANCE,
} from '../game/constants';
import type {
  GameState,
  GateInteractable,
  LevelInteractable,
  MapModuleKind,
  PlayerState,
  TileFeatureFlags,
  Vec2,
} from '../game/types';
import { computeDistanceMap, maskIndex } from './connectivity';
import { inBounds2D, isWalkableCell, moveEntity } from './level';

export type GeneratedFeatures = {
  featureMap: Uint16Array;
  interactables: LevelInteractable[];
};

type GenerationInput = {
  mask: Uint8Array;
  width: number;
  height: number;
  entry: Vec2;
  exit: Vec2;
  seed: number;
  floorNumber: number;
  modules: MapModuleKind[];
};

const inBounds = (width: number, height: number, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < width && y < height;

const neighbors4 = (x: number, y: number): Vec2[] => [
  { x: x + 1, y },
  { x: x - 1, y },
  { x, y: y + 1 },
  { x, y: y - 1 },
];

const buildMainPathSet = (
  mask: Uint8Array,
  width: number,
  height: number,
  entry: Vec2,
  exit: Vec2
): Set<number> => {
  const dist = computeDistanceMap(mask, width, height, entry);
  const out = new Set<number>();

  const endIdx = maskIndex(width, exit.x, exit.y);
  if ((dist[endIdx] ?? -1) < 0) {
    return out;
  }

  let current = { x: exit.x, y: exit.y };
  out.add(maskIndex(width, current.x, current.y));

  while (!(current.x === entry.x && current.y === entry.y)) {
    const currentDist = dist[maskIndex(width, current.x, current.y)] ?? -1;
    if (currentDist <= 0) break;

    let next = current;
    for (const neighbor of neighbors4(current.x, current.y)) {
      if (!inBounds(width, height, neighbor.x, neighbor.y)) continue;
      const ni = maskIndex(width, neighbor.x, neighbor.y);
      if (mask[ni] !== 1) continue;
      const nd = dist[ni] ?? -1;
      if (nd === currentDist - 1) {
        next = neighbor;
        break;
      }
    }

    if (next.x === current.x && next.y === current.y) break;
    current = next;
    out.add(maskIndex(width, current.x, current.y));
  }

  return out;
};

const choosePassableCells = (
  mask: Uint8Array,
  width: number,
  height: number,
  entry: Vec2,
  exit: Vec2
): number[] => {
  const out: number[] = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if ((x === entry.x && y === entry.y) || (x === exit.x && y === exit.y)) continue;
      const i = maskIndex(width, x, y);
      if (mask[i] === 1) out.push(i);
    }
  }
  return out;
};

const markTracks = (
  featureMap: Uint16Array,
  width: number,
  height: number,
  rng: RNG,
  modules: MapModuleKind[]
): void => {
  if (!modules.includes('mining_zone')) return;

  const horizontal = rng.nextFloat01() < 0.5;
  if (horizontal) {
    const y = 2 + rng.nextInt(height - 4);
    for (let x = 1; x < width - 1; x += 1) {
      featureMap[maskIndex(width, x, y)] |= FEATURE_TRACK;
    }
  } else {
    const x = 2 + rng.nextInt(width - 4);
    for (let y = 1; y < height - 1; y += 1) {
      featureMap[maskIndex(width, x, y)] |= FEATURE_TRACK;
    }
  }
};

const placeRootBarriers = (
  featureMap: Uint16Array,
  candidates: number[],
  mainPath: Set<number>,
  rng: RNG,
  modules: MapModuleKind[]
): void => {
  if (!modules.includes('root_zone')) return;

  const target = Math.min(18, 6 + rng.nextInt(10));
  let placed = 0;
  let guard = 0;
  while (placed < target && guard < candidates.length * 3) {
    guard += 1;
    const idx = candidates[rng.nextInt(candidates.length)] ?? 0;
    if (mainPath.has(idx)) continue;
    if ((featureMap[idx] & FEATURE_ROOT_BARRIER) !== 0) continue;
    featureMap[idx] |= FEATURE_ROOT_BARRIER;
    placed += 1;
  }
};

const sampleDistinctCell = (
  candidates: number[],
  rng: RNG,
  used: Set<number>,
  predicate?: (idx: number) => boolean
): number | null => {
  if (candidates.length === 0) return null;

  for (let i = 0; i < candidates.length * 2; i += 1) {
    const idx = candidates[rng.nextInt(candidates.length)] ?? 0;
    if (used.has(idx)) continue;
    if (predicate && !predicate(idx)) continue;
    used.add(idx);
    return idx;
  }

  return null;
};

const GAMEPLAY_FEATURE_MASK =
  FEATURE_BIOFLUID |
  FEATURE_ROOT_BARRIER |
  FEATURE_SPORE_VENT |
  FEATURE_CRYSTAL |
  FEATURE_PORTAL |
  FEATURE_TERMINAL |
  FEATURE_GATE;

const placeDecorativeProps = (
  featureMap: Uint16Array,
  candidates: number[],
  rng: RNG,
  modules: MapModuleKind[],
  occupied: Set<number>
): void => {
  const canDecorate = (idx: number): boolean => (featureMap[idx] & GAMEPLAY_FEATURE_MASK) === 0;

  const fungalDensity =
    PROP_FUNGAL_CLUSTER_DENSITY +
    (modules.includes('fungal_chamber') ? 0.016 : 0) +
    (modules.includes('root_zone') ? 0.012 : 0);
  const debrisDensity =
    PROP_DEBRIS_DENSITY +
    (modules.includes('hive_tunnels') ? 0.009 : 0) +
    (modules.includes('mining_zone') ? 0.011 : 0);
  const crateDensity =
    PROP_CRATE_DENSITY +
    (modules.includes('mining_zone') ? 0.02 : 0) +
    (modules.includes('vertical_pocket') ? 0.007 : 0);
  const beaconDensity =
    PROP_BEACON_DENSITY +
    (modules.includes('mining_zone') ? 0.01 : 0) +
    (modules.includes('mirror_pocket') ? 0.008 : 0);

  const placeCount = (flag: number, targetCount: number): void => {
    for (let i = 0; i < targetCount; i += 1) {
      const idx = sampleDistinctCell(candidates, rng, occupied, canDecorate);
      if (idx == null) continue;
      featureMap[idx] |= flag;
    }
  };

  placeCount(FEATURE_PROP_FUNGAL_CLUSTER, Math.max(4, Math.floor(candidates.length * fungalDensity)));
  placeCount(FEATURE_PROP_DEBRIS, Math.max(4, Math.floor(candidates.length * debrisDensity)));
  placeCount(FEATURE_PROP_CRATE, Math.floor(candidates.length * crateDensity));
  placeCount(FEATURE_PROP_BEACON, Math.floor(candidates.length * beaconDensity));
};

export const generateLevelFeatures = (input: GenerationInput): GeneratedFeatures => {
  const rng = new RNG(input.seed ^ 0x8f01aa77);
  const featureMap = new Uint16Array(input.width * input.height);
  const interactables: LevelInteractable[] = [];

  const candidates = choosePassableCells(input.mask, input.width, input.height, input.entry, input.exit);
  const mainPath = buildMainPathSet(input.mask, input.width, input.height, input.entry, input.exit);
  const used = new Set<number>();

  markTracks(featureMap, input.width, input.height, rng, input.modules);
  placeRootBarriers(featureMap, candidates, mainPath, rng, input.modules);

  const bioCount = Math.floor(candidates.length * BIOFLUID_DENSITY);
  for (let i = 0; i < bioCount; i += 1) {
    const idx = sampleDistinctCell(candidates, rng, used, (cell) => !mainPath.has(cell) && (featureMap[cell] & FEATURE_ROOT_BARRIER) === 0);
    if (idx == null) continue;
    featureMap[idx] |= FEATURE_BIOFLUID;
  }

  const ventCount = Math.max(1, Math.floor(candidates.length * SPORE_VENT_DENSITY));
  for (let i = 0; i < ventCount; i += 1) {
    const idx = sampleDistinctCell(candidates, rng, used, (cell) => (featureMap[cell] & FEATURE_ROOT_BARRIER) === 0);
    if (idx == null) continue;
    const x = idx % input.width;
    const y = Math.floor(idx / input.width);
    featureMap[idx] |= FEATURE_SPORE_VENT;
    interactables.push({
      id: `vent_${input.floorNumber}_${x}_${y}`,
      type: 'spore_vent',
      x,
      y,
      cooldownMs: SPORE_VENT_COOLDOWN_MS,
      nextTriggerAt: 0,
    });
  }

  const crystalCount = Math.max(1, Math.floor(candidates.length * CRYSTAL_DENSITY));
  for (let i = 0; i < crystalCount; i += 1) {
    const idx = sampleDistinctCell(candidates, rng, used, (cell) => !mainPath.has(cell) && (featureMap[cell] & FEATURE_ROOT_BARRIER) === 0);
    if (idx == null) continue;
    const x = idx % input.width;
    const y = Math.floor(idx / input.width);
    featureMap[idx] |= FEATURE_CRYSTAL;
    interactables.push({
      id: `crystal_${input.floorNumber}_${x}_${y}`,
      type: 'crystal',
      x,
      y,
      used: false,
    });
  }

  if (rng.nextFloat01() < ONE_WAY_PORTAL_CHANCE && candidates.length > 12) {
    const source = sampleDistinctCell(candidates, rng, used, (cell) => !mainPath.has(cell));
    const target = sampleDistinctCell(candidates, rng, used, (cell) => cell !== source);
    if (source != null && target != null) {
      const sx = source % input.width;
      const sy = Math.floor(source / input.width);
      const tx = target % input.width;
      const ty = Math.floor(target / input.width);
      featureMap[source] |= FEATURE_PORTAL;
      interactables.push({
        id: `portal_${input.floorNumber}_${sx}_${sy}`,
        type: 'one_way_portal',
        x: sx,
        y: sy,
        target: { x: tx, y: ty },
      });
    }
  }

  if (rng.nextFloat01() < TERMINAL_PUZZLE_CHANCE && candidates.length > 20) {
    const gateCell = sampleDistinctCell(candidates, rng, used, (cell) => !mainPath.has(cell));
    if (gateCell != null) {
      const gx = gateCell % input.width;
      const gy = Math.floor(gateCell / input.width);
      const gateId = `gate_${input.floorNumber}_${gx}_${gy}`;

      featureMap[gateCell] |= FEATURE_GATE;
      const gate: GateInteractable = {
        id: gateId,
        type: 'gate',
        x: gx,
        y: gy,
        open: false,
      };
      interactables.push(gate);

      for (let i = 0; i < 2; i += 1) {
        const terminalCell = sampleDistinctCell(candidates, rng, used, (cell) => {
          if (cell === gateCell) return false;
          const x = cell % input.width;
          const y = Math.floor(cell / input.width);
          const dx = x - gx;
          const dy = y - gy;
          return dx * dx + dy * dy >= 16;
        });
        if (terminalCell == null) continue;
        const tx = terminalCell % input.width;
        const ty = Math.floor(terminalCell / input.width);
        featureMap[terminalCell] |= FEATURE_TERMINAL;
        const broken = rng.nextFloat01() < TERMINAL_BROKEN_CHANCE;
        interactables.push({
          id: `terminal_${input.floorNumber}_${tx}_${ty}`,
          type: 'terminal',
          x: tx,
          y: ty,
          active: false,
          broken,
          linkedGateId: gateId,
        });
      }

      const linkedTerminals = interactables.filter(
        (item): item is Extract<LevelInteractable, { type: 'terminal' }> =>
          item.type === 'terminal' && item.linkedGateId === gateId
      );

      if (linkedTerminals.length > 0 && linkedTerminals.every((item) => item.broken)) {
        const pick = linkedTerminals[rng.nextInt(linkedTerminals.length)];
        if (pick) pick.broken = false;
      }

      // If we could not place both terminals, keep gate open to avoid accidental lock.
      if (linkedTerminals.length < 2) {
        gate.open = true;
      }
    }
  }

  placeDecorativeProps(featureMap, candidates, rng, input.modules, new Set<number>(used));

  const entryIdx = maskIndex(input.width, input.entry.x, input.entry.y);
  const exitIdx = maskIndex(input.width, input.exit.x, input.exit.y);
  featureMap[entryIdx] = 0;
  featureMap[exitIdx] = 0;

  for (let i = interactables.length - 1; i >= 0; i -= 1) {
    const item = interactables[i];
    if (!item) continue;
    if (
      (item.x === input.entry.x && item.y === input.entry.y) ||
      (item.x === input.exit.x && item.y === input.exit.y)
    ) {
      interactables.splice(i, 1);
    }
  }

  return {
    featureMap,
    interactables,
  };
};

const pushAlert = (state: GameState, text: string, tone: 'info' | 'warn' | 'buff'): void => {
  state.uiAlerts.push({
    text,
    tone,
    untilMs: state.simTimeMs + 2200,
  });

  if (state.uiAlerts.length > 8) {
    state.uiAlerts.splice(0, state.uiAlerts.length - 8);
  }
};

const featureFlagsAt = (state: GameState, x: number, y: number): TileFeatureFlags => {
  if (!inBounds2D(state.level, x, y)) return 0;
  return state.level.featureMap[maskIndex(state.level.width, x, y)] ?? 0;
};

export const activateTerminal = (state: GameState, interactable: Extract<LevelInteractable, { type: 'terminal' }>): void => {
  if (interactable.active) return;
  interactable.active = true;
  pushAlert(state, 'Terminal ativado.', 'info');

  const required = state.level.interactables.filter(
    (item): item is Extract<LevelInteractable, { type: 'terminal' }> =>
      item.type === 'terminal' && item.linkedGateId === interactable.linkedGateId
  );
  const allActive = required.length > 0 && required.every((item) => item.active);
  if (allActive) {
    const gate = state.level.interactables.find(
      (item): item is GateInteractable => item.type === 'gate' && item.id === interactable.linkedGateId
    );
    if (gate && !gate.open) {
      gate.open = true;
      pushAlert(state, 'Portao destravado!', 'buff');
    }
  }
};

export const applyPlayerFeatureInteractions = (state: GameState, player: PlayerState): void => {
  const now = state.simTimeMs;
  const flags = featureFlagsAt(state, player.x, player.y);

  if ((flags & FEATURE_BIOFLUID) !== 0 && now >= state.activeDebuffs.biofluidNextTickAt) {
    player.hp = Math.max(0, player.hp - BIOFLUID_DAMAGE);
    state.activeDebuffs.biofluidNextTickAt = now + BIOFLUID_TICK_MS;
    state.screenFlash.damageMs = Math.max(state.screenFlash.damageMs, SCREEN_FLASH_MS);
    pushAlert(state, 'Biofluido corrosivo!', 'warn');
    if (player.hp <= 0) {
      player.alive = false;
      state.phase = 'game_over';
      return;
    }
  }

  for (const interactable of state.level.interactables) {
    if (interactable.x !== player.x || interactable.y !== player.y) continue;

    if (interactable.type === 'spore_vent') {
      if (now >= interactable.nextTriggerAt) {
        interactable.nextTriggerAt = now + interactable.cooldownMs;
        state.activeDebuffs.slowUntilMs = Math.max(state.activeDebuffs.slowUntilMs, now + SPORE_SLOW_MS);
        pushAlert(state, 'Esporos reduziram sua velocidade!', 'warn');
      }
      continue;
    }

    if (interactable.type === 'crystal') {
      if (!interactable.used) {
        interactable.used = true;
        player.hp = Math.min(player.maxHp, player.hp + CRYSTAL_HEAL);
        state.activeDebuffs.crystalBuffUntilMs = Math.max(state.activeDebuffs.crystalBuffUntilMs, now + CRYSTAL_BUFF_MS);
        state.screenFlash.healMs = Math.max(state.screenFlash.healMs, SCREEN_FLASH_MS);
        pushAlert(state, 'Cristal energizado! Buff temporario.', 'buff');
      }
      continue;
    }

    if (interactable.type === 'terminal') {
      if (interactable.broken) continue;
      if (!interactable.active) {
        activateTerminal(state, interactable);
      }
      continue;
    }

    if (interactable.type === 'one_way_portal') {
      if (now < state.activeDebuffs.portalLockUntilMs) continue;
      const target = interactable.target;
      if (isWalkableCell(state.level, target.x, target.y, player.occ)) {
        moveEntity(state.level, player, target.x, target.y);
        state.activeDebuffs.portalLockUntilMs = now + 400;
        pushAlert(state, 'Portal unidirecional acionado.', 'info');
      }
      continue;
    }
  }

  if (now > state.activeDebuffs.crystalBuffUntilMs && state.activeDebuffs.crystalBuffUntilMs !== 0) {
    state.activeDebuffs.crystalBuffUntilMs = 0;
  }
};

export const getPlayerAttackBonus = (state: GameState): number => {
  if (state.simTimeMs <= state.activeDebuffs.crystalBuffUntilMs) {
    return CRYSTAL_ATTACK_BONUS;
  }
  return 0;
};
