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
