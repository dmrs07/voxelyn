import {
  SOLID_NONE,
  SOLID_ROCK,
  SOLID_FRAGILE,
  SOLID_SUTURE_ANCHOR,
  SURF_NONE,
  SURF_MINERAL_SILK,
  SURF_DEEP_WATER,
} from './constants.js';
import type { SutureRecipe, Vec2 } from './types.js';

export const SEAMSTRESS_CHAMBER_RADIUS = 18;

/** Generation and the live encounter must agree on which supports the boss can use. */
export const sutureInSeamstressChamber = (s: SutureRecipe, w: number, boss: Vec2): boolean =>
  s.cells.some(
    (i) =>
      Math.hypot((i % w) + 0.5 - boss.x, Math.floor(i / w) + 0.5 - boss.y) <
      SEAMSTRESS_CHAMBER_RADIUS,
  );

export const seamstressAnchorInRange = (i: number, w: number, boss: Vec2): boolean => {
  const distance = Math.hypot((i % w) + 0.5 - boss.x, Math.floor(i / w) + 0.5 - boss.y);
  return distance >= 3 && distance <= 24;
};

/** Quantas ancoras a camara da Cerzideira garante em volta dela, e quantos raios as procuram. */
export const WEB_ANCHOR_MIN = 8;
export const WEB_ANCHOR_RAYS = 16;
/** Alcance dos raios, em tiles: a teia da segunda fase vai ate essas ancoras. */
export const WEB_ANCHOR_REACH = 22;

/**
 * ANCORAS EM VOLTA DA CAMARA, para a teia da segunda fase ter onde se prender.
 *
 * Dezesseis raios a partir do chefe; a primeira parede de cada um vira ancora
 * (rocha ou fragil, fora das paredes estruturais reservadas). As suturas da
 * colonia ja pagam duas ou tres; isto garante oito ou mais, espalhadas em
 * todas as direcoes, e sao tambem apoios de puxada na primeira fase. Devolve
 * as celulas encontradas (novas e existentes), sem repetir.
 */
export const ensureWebAnchors = (
  solid: Uint8Array,
  w: number,
  h: number,
  boss: Vec2,
  protectedCells: ReadonlySet<number> = new Set(),
): number[] => {
  const anchors: number[] = [];
  for (let k = 0; k < WEB_ANCHOR_RAYS; k++) {
    const angle = (k / WEB_ANCHOR_RAYS) * Math.PI * 2 + 0.2;
    const i = farWallAlong(solid, w, h, boss, angle, WEB_ANCHOR_REACH);
    if (i < 0 || solid[i] === SOLID_NONE) continue;
    if (solid[i] === SOLID_SUTURE_ANCHOR) {
      if (!anchors.includes(i)) anchors.push(i);
    } else if ((solid[i] === SOLID_ROCK || solid[i] === SOLID_FRAGILE) && !protectedCells.has(i)) {
      solid[i] = SOLID_SUTURE_ANCHOR;
      anchors.push(i);
    }
  }
  return anchors;
};

/**
 * Duas celulas de chao estao no MESMO espaco? Uma busca curta a pe, ate
 * `maxSteps`, sem atravessar parede. E o que separa um pilar no meio da sala
 * — o fio contorna e segue — de uma parede que divide duas salas, que o fio
 * nao pode saltar.
 */
export const nearbyReachable = (
  solid: Uint8Array,
  w: number,
  from: number,
  to: number,
  maxSteps: number,
): boolean => {
  if (from === to) return true;
  const seen = new Set<number>([from]);
  let frontier = [from];
  for (let step = 0; step < maxSteps && frontier.length; step++) {
    const next: number[] = [];
    for (const c of frontier)
      for (const n of [c - 1, c + 1, c - w, c + w]) {
        if (n < 0 || n >= solid.length || seen.has(n)) continue;
        if (Math.abs((n % w) - (c % w)) > 1) continue;
        if (solid[n] !== SOLID_NONE) continue;
        if (n === to) return true;
        seen.add(n);
        next.push(n);
      }
    frontier = next;
  }
  return false;
};

/**
 * A PAREDE DE FUNDO de um rumo: a primeira parede que nao e um pilar. Um
 * pilar e um solido com chao logo atras (ate tres tiles) que continua a mesma
 * sala (`nearbyReachable`); o raio o atravessa e segue. Sem parede ate
 * `reach`, devolve a celula de chao no alcance — a teia se prende ali mesmo.
 * `-1` quando o rumo sai do mapa antes de qualquer coisa.
 */
export const farWallAlong = (
  solid: Uint8Array,
  w: number,
  h: number,
  from: Vec2,
  angle: number,
  reach: number,
): number => {
  const cellAt = (r: number): number => {
    const x = Math.floor(from.x + Math.cos(angle) * r),
      y = Math.floor(from.y + Math.sin(angle) * r);
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) return -1;
    return y * w + x;
  };
  let lastFloor = -1;
  for (let r = 1; r <= reach; r += 0.5) {
    const c = cellAt(r);
    if (c < 0) return lastFloor;
    if (solid[c] === SOLID_NONE) {
      lastFloor = c;
      continue;
    }
    // Ha chao logo atras, na mesma sala? Entao e pilar: segue.
    let resumed = -1;
    for (let q = r + 0.5; q <= Math.min(reach, r + 3); q += 0.5) {
      const n = cellAt(q);
      if (n < 0) break;
      if (solid[n] === SOLID_NONE) {
        resumed = n;
        r = q - 0.5;
        break;
      }
    }
    if (resumed >= 0 && lastFloor >= 0 && nearbyReachable(solid, w, lastFloor, resumed, 8))
      continue;
    return c;
  }
  return lastFloor;
};

/** Occupation overlay: existing walls become anchors; no route is carved or sealed at spawn. */
export const generateSutures = (
  solid: Uint8Array,
  surface: Uint8Array,
  w: number,
  h: number,
  seed: number,
  count: number,
  entry: Vec2,
  core: Vec2,
  boss: Vec2,
  protectedCells: ReadonlySet<number> = new Set(),
): SutureRecipe[] => {
  if (count <= 0) return [];
  const candidates: Array<{ a: number; b: number; cells: number[]; rank: number }> = [];
  const eligible = (i: number): boolean =>
    !protectedCells.has(i) && (solid[i] === SOLID_ROCK || solid[i] === SOLID_FRAGILE);
  const distance = (i: number, p: Vec2): number =>
    Math.hypot((i % w) - p.x, Math.floor(i / w) - p.y);
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const a = y * w + x;
      if (!eligible(a)) continue;
      for (const step of [1, w]) {
        const cells: number[] = [];
        for (let n = 1; n <= 11; n++) {
          const b = a + step * n;
          if (b >= solid.length || (step === 1 && Math.floor(b / w) !== y)) break;
          if (solid[b] !== SOLID_NONE) {
            if (
              n >= 4 &&
              eligible(b) &&
              cells.every(
                (i) =>
                  surface[i] !== SURF_DEEP_WATER && distance(i, entry) > 8 && distance(i, core) > 3,
              )
            ) {
              const mid = cells[Math.floor(cells.length / 2)];
              const noise = (Math.imul(a ^ seed, 0x45d9f3b) ^ Math.imul(b, 0x27d4eb2d)) >>> 0;
              // First nest near the boss; remaining seams spread by a pure seed hash.
              candidates.push({
                a,
                b,
                cells,
                rank: distance(mid, boss) < 12 ? noise / 0xffffffff : 2 + noise / 0xffffffff,
              });
            }
            break;
          }
          cells.push(b);
        }
      }
    }
  candidates.sort((a, b) => a.rank - b.rank || a.a - b.a || a.b - b.b);
  const result: SutureRecipe[] = [];
  const used = new Set<number>();
  for (const candidate of candidates) {
    if (result.length >= Math.min(12, count)) break;
    const middle = candidate.cells[Math.floor(candidate.cells.length / 2)];
    if ([candidate.a, candidate.b, ...candidate.cells].some((i) => used.has(i))) continue;
    if (
      result.some(
        (s) =>
          distance(middle, {
            x: s.cells[Math.floor(s.cells.length / 2)] % w,
            y: Math.floor(s.cells[Math.floor(s.cells.length / 2)] / w),
          }) < 5,
      )
    )
      continue;
    const id = result.length;
    const kind = id % 2 === 0 ? 'roof' : 'gate';
    const slabCells =
      kind === 'roof'
        ? candidate.cells.slice(
            Math.max(0, Math.floor(candidate.cells.length / 2) - 1),
            Math.floor(candidate.cells.length / 2) + 2,
          )
        : [];
    result.push({
      id,
      a: candidate.a,
      b: candidate.b,
      cells: candidate.cells,
      slabCells,
      kind,
      objective: kind === 'roof' && id < 5,
    });
    solid[candidate.a] = solid[candidate.b] = SOLID_SUTURE_ANCHOR;
    for (const i of candidate.cells) {
      used.add(i);
      if (surface[i] === SURF_NONE) surface[i] = SURF_MINERAL_SILK;
    }
    used.add(candidate.a);
    used.add(candidate.b);
  }
  return result;
};
