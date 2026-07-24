import {
  BUDGET_DISCHARGE_CELLS,
  BUDGET_REACTING_CELLS,
  CELL_STEP_INTERVAL,
  DISCHARGE_TICKS,
  FIRE_FUEL_TICKS,
  FIRE_SPREAD_BIOFLUID,
  FIRE_SPREAD_FUNGAL,
  GAS_LIFE_TICKS,
  GAS_SPREAD_CHANCE,
  SOLID_CRYSTAL,
  SOLID_FRAGILE,
  SOLID_NONE,
  SURF_BIOFLUID,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_GAS,
  SURF_NONE,
  SURF_SCORCHED,
  VENT_BASE_INTERVAL_TICKS,
} from './constants.js';
import { chunkOf } from './worldgen.js';
import type { SemanticEvent, SurvivalState } from './types.js';

const W = (state: SurvivalState): number => state.config.width;
const H = (state: SurvivalState): number => state.config.height;

export const markDirty = (state: SurvivalState, x: number, y: number): void => {
  state.chunkVersion[chunkOf(x, y)]++;
};

export const setSurface = (state: SurvivalState, i: number, kind: number, timer: number): void => {
  state.surface[i] = kind;
  state.surfaceTimer[i] = timer;
  const x = i % W(state);
  const y = (i - x) / W(state);
  markDirty(state, x, y);
  if (kind === SURF_FIRE || kind === SURF_GAS) state.reactionQueue.push(i);
};

export const igniteCell = (state: SurvivalState, i: number, events: SemanticEvent[]): boolean => {
  const surf = state.surface[i];
  if (surf === SURF_FUNGAL || surf === SURF_BIOFLUID || surf === SURF_GAS) {
    setSurface(state, i, SURF_FIRE, FIRE_FUEL_TICKS);
    const x = i % W(state);
    events.push({ t: 'ignite', x, y: (i - x) / W(state) });
    return true;
  }
  return false;
};

/** Descarga eletrica: BFS pela poca de biofluido conectada, com orcamento. */
export const dischargeAt = (state: SurvivalState, sx: number, sy: number, events: SemanticEvent[]): void => {
  const w = W(state);
  const h = H(state);
  const startCells: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = sx + dx;
      const ny = sy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const i = ny * w + nx;
      if (state.surface[i] === SURF_BIOFLUID) startCells.push(i);
    }
  }
  if (startCells.length === 0) return;

  const seen = new Set<number>(startCells);
  const queue = [...startCells];
  let head = 0;
  while (head < queue.length && seen.size < BUDGET_DISCHARGE_CELLS) {
    const cur = queue[head++];
    const cx = cur % w;
    const neighbors = [cur - 1, cur + 1, cur - w, cur + w];
    const valid = [cx > 0, cx < w - 1, cur >= w, cur < w * (h - 1)];
    for (let k = 0; k < 4; k++) {
      if (!valid[k]) continue;
      const ni = neighbors[k];
      if (seen.has(ni) || state.surface[ni] !== SURF_BIOFLUID) continue;
      seen.add(ni);
      queue.push(ni);
    }
  }

  const cells = [...seen];
  for (const i of cells) {
    state.charges.push({ idx: i, until: state.tick + DISCHARGE_TICKS });
  }
  events.push({ t: 'discharge', cells });
};

export const explodeAt = (
  state: SurvivalState,
  ex: number,
  ey: number,
  radius: number,
  events: SemanticEvent[]
): void => {
  const w = W(state);
  const h = H(state);
  events.push({ t: 'explosion', x: ex, y: ey, radius });
  const r = Math.ceil(radius);
  for (let y = Math.max(0, Math.floor(ey) - r); y <= Math.min(h - 1, Math.floor(ey) + r); y++) {
    for (let x = Math.max(0, Math.floor(ex) - r); x <= Math.min(w - 1, Math.floor(ex) + r); x++) {
      const dx = x + 0.5 - ex;
      const dy = y + 0.5 - ey;
      if (dx * dx + dy * dy > radius * radius) continue;
      const i = y * w + x;
      if (state.solid[i] === SOLID_FRAGILE) {
        state.solid[i] = SOLID_NONE;
        state.surface[i] = SURF_SCORCHED;
        markDirty(state, x, y);
      } else if (state.solid[i] === SOLID_CRYSTAL) {
        state.solid[i] = SOLID_NONE;
        markDirty(state, x, y);
        dischargeAt(state, x, y, events);
      } else if (state.solid[i] === SOLID_NONE) {
        igniteCell(state, i, events);
      }
    }
  }
};

/**
 * Passo celular: processa fila deterministica de celulas reagindo com orcamento fixo.
 * Excedente fica na fila para o proximo passo (degrada latencia, nunca o determinismo).
 */
export const stepCells = (state: SurvivalState, _events: SemanticEvent[]): void => {
  if (state.tick % CELL_STEP_INTERVAL !== 0) return;
  const w = W(state);
  const h = H(state);

  // ventos de esporos emitem gas periodicamente (intensificam com contaminacao)
  for (const vent of state.vents) {
    if (state.tick >= vent.nextEmitAt) {
      const interval = Math.max(50, VENT_BASE_INTERVAL_TICKS * (1 - state.contamination * 0.6));
      vent.nextEmitAt = state.tick + Math.floor(interval);
      const i = vent.y * w + vent.x;
      if (state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
        setSurface(state, i, SURF_GAS, GAS_LIFE_TICKS);
      }
    }
  }

  // descargas expiram
  state.charges = state.charges.filter((c) => c.until > state.tick);

  const queue = state.reactionQueue;
  const budget = Math.min(queue.length, BUDGET_REACTING_CELLS);
  const nextQueue: number[] = [];
  const seenNext = new Set<number>();
  const pushNext = (i: number): void => {
    if (!seenNext.has(i)) {
      seenNext.add(i);
      nextQueue.push(i);
    }
  };

  for (let n = 0; n < budget; n++) {
    const i = queue[n];
    const kind = state.surface[i];
    const x = i % w;
    const y = (i - x) / w;

    if (kind === SURF_FIRE) {
      // espalhar para vizinhos inflamaveis
      const neighbors = [i - 1, i + 1, i - w, i + w];
      const valid = [x > 0, x < w - 1, y > 0, y < h - 1];
      for (let k = 0; k < 4; k++) {
        if (!valid[k]) continue;
        const ni = neighbors[k];
        const nsurf = state.surface[ni];
        if (nsurf === SURF_GAS) {
          setSurface(state, ni, SURF_FIRE, FIRE_FUEL_TICKS);
        } else if (nsurf === SURF_FUNGAL && state.rng.nextFloat01() < FIRE_SPREAD_FUNGAL) {
          setSurface(state, ni, SURF_FIRE, FIRE_FUEL_TICKS);
        } else if (nsurf === SURF_BIOFLUID && state.rng.nextFloat01() < FIRE_SPREAD_BIOFLUID) {
          setSurface(state, ni, SURF_FIRE, FIRE_FUEL_TICKS);
        }
      }
      const t = state.surfaceTimer[i];
      if (t <= CELL_STEP_INTERVAL) {
        state.surface[i] = SURF_SCORCHED;
        state.surfaceTimer[i] = 0;
        markDirty(state, x, y);
      } else {
        state.surfaceTimer[i] = t - CELL_STEP_INTERVAL;
        pushNext(i);
      }
    } else if (kind === SURF_GAS) {
      // difusao: gas se espalha para celulas abertas sem superficie
      if (state.rng.nextFloat01() < GAS_SPREAD_CHANCE) {
        const dir = state.rng.nextInt(4);
        const ni = [i - 1, i + 1, i - w, i + w][dir];
        const validDir = [x > 0, x < w - 1, y > 0, y < h - 1][dir];
        if (validDir && state.solid[ni] === SOLID_NONE && state.surface[ni] === SURF_NONE) {
          const t = state.surfaceTimer[i];
          if (t > 30) {
            setSurface(state, ni, SURF_GAS, Math.floor(t * 0.65));
            state.surfaceTimer[i] = Math.floor(t * 0.65);
          }
        }
      }
      const t = state.surfaceTimer[i];
      if (t <= CELL_STEP_INTERVAL) {
        state.surface[i] = SURF_NONE;
        state.surfaceTimer[i] = 0;
        markDirty(state, x, y);
      } else {
        state.surfaceTimer[i] = t - CELL_STEP_INTERVAL;
        pushNext(i);
      }
    }
  }

  // excedente da fila permanece (ordem preservada)
  for (let n = budget; n < queue.length; n++) pushNext(queue[n]);
  state.reactionQueue = nextQueue;
};

/** Quebra uma celula solida por dano direcionado (projetil perfurante, investida, explosao). */
export const breakSolid = (state: SurvivalState, x: number, y: number, events: SemanticEvent[]): boolean => {
  const w = W(state);
  const i = y * w + x;
  const solid = state.solid[i];
  if (solid === SOLID_FRAGILE) {
    state.solid[i] = SOLID_NONE;
    state.surface[i] = SURF_SCORCHED;
    markDirty(state, x, y);
    return true;
  }
  if (solid === SOLID_CRYSTAL) {
    state.solid[i] = SOLID_NONE;
    markDirty(state, x, y);
    dischargeAt(state, x, y, events);
    return true;
  }
  return false;
};
