import { RNG } from '@voxelyn/core';
import {
  CHUNK,
  SOLID_CRYSTAL,
  SOLID_FRAGILE,
  SOLID_NONE,
  SOLID_ORE,
  SOLID_ROCK,
  SURF_BIOFLUID,
  SURF_FUNGAL,
  SURF_NONE,
  WORLD_W,
} from './constants.js';
import type { Vec2 } from './types.js';

export type GeneratedWorld = {
  solid: Uint8Array;
  surface: Uint8Array;
  entry: Vec2;
  corePos: Vec2;
  cachePositions: Vec2[];
  ventPositions: Vec2[];
  enemySpawns: Vec2[];
  openCells: number[];
};

const idx = (w: number, x: number, y: number): number => y * w + x;

const countWallNeighbors = (solid: Uint8Array, w: number, h: number, x: number, y: number): number => {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
        count++;
      } else if (solid[idx(w, nx, ny)] !== SOLID_NONE) {
        count++;
      }
    }
  }
  return count;
};

/** Flood fill a partir de (sx,sy); retorna indices alcancaveis. */
export const floodOpen = (solid: Uint8Array, w: number, h: number, sx: number, sy: number): Set<number> => {
  const seen = new Set<number>();
  const start = idx(w, sx, sy);
  if (solid[start] !== SOLID_NONE) return seen;
  const stack = [start];
  seen.add(start);
  while (stack.length > 0) {
    const cur = stack.pop() as number;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    const neighbors = [
      [cx - 1, cy],
      [cx + 1, cy],
      [cx, cy - 1],
      [cx, cy + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = idx(w, nx, ny);
      if (seen.has(ni) || solid[ni] !== SOLID_NONE) continue;
      seen.add(ni);
      stack.push(ni);
    }
  }
  return seen;
};

const bfsFarthest = (
  solid: Uint8Array,
  w: number,
  h: number,
  from: Vec2
): { cell: Vec2; dist: Int32Array } => {
  const dist = new Int32Array(w * h).fill(-1);
  const queue: number[] = [idx(w, from.x, from.y)];
  dist[queue[0]] = 0;
  let far = queue[0];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    if (dist[cur] > dist[far]) far = cur;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    const neighbors = [cur - 1, cur + 1, cur - w, cur + w];
    const valid = [cx > 0, cx < w - 1, cy > 0, cy < h - 1];
    for (let k = 0; k < 4; k++) {
      if (!valid[k]) continue;
      const ni = neighbors[k];
      if (dist[ni] !== -1 || solid[ni] !== SOLID_NONE) continue;
      dist[ni] = dist[cur] + 1;
      queue.push(ni);
    }
  }
  return { cell: { x: far % w, y: Math.floor(far / w) }, dist };
};

const carveBlob = (solid: Uint8Array, w: number, h: number, cx: number, cy: number, r: number): void => {
  for (let y = Math.max(1, cy - r); y <= Math.min(h - 2, cy + r); y++) {
    for (let x = Math.max(1, cx - r); x <= Math.min(w - 2, cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) solid[idx(w, x, y)] = SOLID_NONE;
    }
  }
};

const generateAttempt = (seed: number, w: number, h: number): GeneratedWorld | null => {
  const rng = new RNG(seed >>> 0 || 1);
  const solid = new Uint8Array(w * h).fill(SOLID_ROCK);
  const surface = new Uint8Array(w * h).fill(SURF_NONE);

  // 1) ruido inicial
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (rng.nextFloat01() > 0.44) solid[idx(w, x, y)] = SOLID_NONE;
    }
  }

  // 2) automato celular
  for (let it = 0; it < 4; it++) {
    const next = new Uint8Array(solid);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const walls = countWallNeighbors(solid, w, h, x, y);
        const i = idx(w, x, y);
        if (walls >= 5) next[i] = SOLID_ROCK;
        else if (walls <= 3) next[i] = SOLID_NONE;
      }
    }
    solid.set(next);
  }

  // 3) entrada perto da borda superior-esquerda, nucleo no ponto mais distante
  let entry: Vec2 | null = null;
  outer: for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if (solid[idx(w, x, y)] === SOLID_NONE) {
        entry = { x, y };
        break outer;
      }
    }
  }
  if (!entry) return null;
  carveBlob(solid, w, h, entry.x, entry.y, 3);

  const open = floodOpen(solid, w, h, entry.x, entry.y);
  if (open.size < w * h * 0.28) return null;

  // celulas fora da regiao principal viram parede (evita bolsoes inalcancaveis enganosos)
  for (let i = 0; i < solid.length; i++) {
    if (solid[i] === SOLID_NONE && !open.has(i)) solid[i] = SOLID_ROCK;
  }

  const { cell: corePos, dist } = bfsFarthest(solid, w, h, entry);
  if (dist[idx(w, corePos.x, corePos.y)] < Math.floor((w + h) * 0.55)) return null;
  carveBlob(solid, w, h, corePos.x, corePos.y, 4);

  const openCells: number[] = [];
  const reOpen = floodOpen(solid, w, h, entry.x, entry.y);
  for (const i of reOpen) openCells.push(i);
  openCells.sort((a, b) => a - b);

  const distFromEntry = bfsFarthest(solid, w, h, entry).dist;

  const isOpen = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < w && y < h && solid[idx(w, x, y)] === SOLID_NONE;

  // 4) decorar paredes adjacentes a areas abertas: minerio, rocha fragil, cristais
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(w, x, y);
      if (solid[i] !== SOLID_ROCK) continue;
      const touchesOpen = isOpen(x - 1, y) || isOpen(x + 1, y) || isOpen(x, y - 1) || isOpen(x, y + 1);
      if (!touchesOpen) continue;
      const roll = rng.nextFloat01();
      // parede fina (aberto dos dois lados) tem chance alta de ser fragil
      const thinH = isOpen(x - 1, y) && isOpen(x + 1, y);
      const thinV = isOpen(x, y - 1) && isOpen(x, y + 1);
      if ((thinH || thinV) && roll < 0.55) solid[i] = SOLID_FRAGILE;
      else if (roll < 0.07) solid[i] = SOLID_ORE;
      else if (roll < 0.1) solid[i] = SOLID_CRYSTAL;
    }
  }

  // 5) superficies: manchas fungicas e pocas de biofluido
  const openArr = openCells;
  const blobSurface = (surfKind: number, count: number, rMin: number, rMax: number): void => {
    for (let b = 0; b < count; b++) {
      const seedCell = openArr[rng.nextInt(openArr.length)];
      const cx = seedCell % w;
      const cy = Math.floor(seedCell / w);
      const r = rMin + rng.nextInt(rMax - rMin + 1);
      for (let y = Math.max(1, cy - r); y <= Math.min(h - 2, cy + r); y++) {
        for (let x = Math.max(1, cx - r); x <= Math.min(w - 2, cx + r); x++) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy > r * r) continue;
          const i = idx(w, x, y);
          if (solid[i] !== SOLID_NONE) continue;
          if (surface[i] === SURF_NONE && rng.nextFloat01() < 0.82) surface[i] = surfKind;
        }
      }
    }
  };
  blobSurface(SURF_FUNGAL, 26, 2, 4);
  blobSurface(SURF_BIOFLUID, 12, 1, 3);

  // area de entrada limpa (jogador nao nasce em material perigoso)
  for (let y = entry.y - 2; y <= entry.y + 2; y++) {
    for (let x = entry.x - 2; x <= entry.x + 2; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      surface[idx(w, x, y)] = SURF_NONE;
    }
  }
  // pedestal do nucleo limpo
  for (let y = corePos.y - 1; y <= corePos.y + 1; y++) {
    for (let x = corePos.x - 1; x <= corePos.x + 1; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      surface[idx(w, x, y)] = SURF_NONE;
    }
  }

  // 6) pontos de interesse sobre celulas abertas e distantes da entrada
  const pickOpenFar = (minDist: number, minGap: number, taken: Vec2[]): Vec2 | null => {
    for (let attempts = 0; attempts < 400; attempts++) {
      const cell = openArr[rng.nextInt(openArr.length)];
      const x = cell % w;
      const y = Math.floor(cell / w);
      if (distFromEntry[cell] < minDist) continue;
      let ok = true;
      for (const t of taken) {
        const dx = t.x - x;
        const dy = t.y - y;
        if (dx * dx + dy * dy < minGap * minGap) {
          ok = false;
          break;
        }
      }
      if (ok) return { x, y };
    }
    return null;
  };

  const cachePositions: Vec2[] = [];
  for (let c = 0; c < 4; c++) {
    const p = pickOpenFar(14, 10, cachePositions);
    if (p) cachePositions.push(p);
  }

  const ventPositions: Vec2[] = [];
  for (let v = 0; v < 6; v++) {
    const p = pickOpenFar(10, 8, [...ventPositions, ...cachePositions]);
    if (p) ventPositions.push(p);
  }

  const enemySpawns: Vec2[] = [];
  for (let e = 0; e < 22; e++) {
    const p = pickOpenFar(12, 3, enemySpawns);
    if (p) enemySpawns.push(p);
  }
  if (enemySpawns.length < 10) return null;

  return { solid, surface, entry, corePos, cachePositions, ventPositions, enemySpawns, openCells };
};

/** Geracao deterministica com retentativas limitadas (seed derivada) ate mapa solucionavel. */
export const generateWorld = (seed: number, w: number, h: number): GeneratedWorld => {
  for (let attempt = 0; attempt < 16; attempt++) {
    const result = generateAttempt((seed ^ (attempt * 0x85ebca6b)) >>> 0, w, h);
    if (result) return result;
  }
  throw new Error(`generateWorld: nenhum mapa solucionavel para seed ${seed}`);
};

/**
 * Indice do chunk de (x,y). O stride vem da LARGURA REAL do mundo: createRun
 * aceita dimensoes customizadas, e usar a constante do mundo padrao (96 -> 6
 * chunks) faria um mundo de 64 marcar chunks errados a partir da segunda
 * linha — e escrever fora de chunkVersion mais adiante. O ChunkTracker ja
 * calcula ceil(width/CHUNK); isto o mantem em acordo.
 */
export const chunkOf = (x: number, y: number, width: number = WORLD_W): number =>
  Math.floor(y / CHUNK) * Math.ceil(width / CHUNK) + Math.floor(x / CHUNK);

export const cellIdx = (w: number, x: number, y: number): number => y * w + x;
