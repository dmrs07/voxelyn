import { RNG } from '@voxelyn/core';
import type { Vec2 } from '../game/types';

export const maskIndex = (width: number, x: number, y: number): number => y * width + x;

const inBounds = (width: number, height: number, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < width && y < height;

export const computeDistanceMap = (
  mask: Uint8Array,
  width: number,
  height: number,
  start: Vec2
): Int32Array => {
  const dist = new Int32Array(width * height);
  dist.fill(-1);
  if (!inBounds(width, height, start.x, start.y)) return dist;
  if (mask[maskIndex(width, start.x, start.y)] === 0) return dist;

  const queueX = new Int32Array(width * height);
  const queueY = new Int32Array(width * height);
  let qh = 0;
  let qt = 0;

  queueX[qt] = start.x;
  queueY[qt] = start.y;
  qt += 1;
  dist[maskIndex(width, start.x, start.y)] = 0;

  while (qh < qt) {
    const x = queueX[qh] ?? 0;
    const y = queueY[qh] ?? 0;
    qh += 1;

    const baseIdx = maskIndex(width, x, y);
    const nextDist = (dist[baseIdx] ?? 0) + 1;

    const n0x = x + 1;
    const n1x = x - 1;
    const n2y = y + 1;
    const n3y = y - 1;

    if (inBounds(width, height, n0x, y)) {
      const i = maskIndex(width, n0x, y);
      if (mask[i] === 1 && dist[i] === -1) {
        dist[i] = nextDist;
        queueX[qt] = n0x;
        queueY[qt] = y;
        qt += 1;
      }
    }

    if (inBounds(width, height, n1x, y)) {
      const i = maskIndex(width, n1x, y);
      if (mask[i] === 1 && dist[i] === -1) {
        dist[i] = nextDist;
        queueX[qt] = n1x;
        queueY[qt] = y;
        qt += 1;
      }
    }

    if (inBounds(width, height, x, n2y)) {
      const i = maskIndex(width, x, n2y);
      if (mask[i] === 1 && dist[i] === -1) {
        dist[i] = nextDist;
        queueX[qt] = x;
        queueY[qt] = n2y;
        qt += 1;
      }
    }

    if (inBounds(width, height, x, n3y)) {
      const i = maskIndex(width, x, n3y);
      if (mask[i] === 1 && dist[i] === -1) {
        dist[i] = nextDist;
        queueX[qt] = x;
        queueY[qt] = n3y;
        qt += 1;
      }
    }
  }

  return dist;
};

export const reconstructPathFromDistance = (
  mask: Uint8Array,
  width: number,
  height: number,
  dist: Int32Array,
  start: Vec2,
  end: Vec2
): Vec2[] => {
  const out: Vec2[] = [];
  if (!inBounds(width, height, start.x, start.y) || !inBounds(width, height, end.x, end.y)) {
    return out;
  }

  const endIdx = maskIndex(width, end.x, end.y);
  if ((dist[endIdx] ?? -1) < 0) {
    return out;
  }

  let cursor = { x: end.x, y: end.y };
  out.push(cursor);

  while (!(cursor.x === start.x && cursor.y === start.y)) {
    const currentDist = dist[maskIndex(width, cursor.x, cursor.y)] ?? -1;
    if (currentDist <= 0) {
      break;
    }

    let moved = false;
    const neighbors: Array<[number, number]> = [
      [cursor.x + 1, cursor.y],
      [cursor.x - 1, cursor.y],
      [cursor.x, cursor.y + 1],
      [cursor.x, cursor.y - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (!inBounds(width, height, nx, ny)) continue;
      const ni = maskIndex(width, nx, ny);
      if (mask[ni] !== 1) continue;
      const nd = dist[ni] ?? -1;
      if (nd === currentDist - 1) {
        cursor = { x: nx, y: ny };
        out.push(cursor);
        moved = true;
        break;
      }
    }

    if (!moved) {
      break;
    }
  }

  if (out.length === 0) return out;
  const last = out[out.length - 1];
  if (!last || last.x !== start.x || last.y !== start.y) {
    return [];
  }

  out.reverse();
  return out;
};

export const reconstructShortestPath = (
  mask: Uint8Array,
  width: number,
  height: number,
  start: Vec2,
  end: Vec2
): Vec2[] => {
  const dist = computeDistanceMap(mask, width, height, start);
  return reconstructPathFromDistance(mask, width, height, dist, start, end);
};

export const findFarthestReachable = (
  dist: Int32Array,
  width: number,
  height: number,
  fallback: Vec2
): Vec2 => {
  let best = -1;
  let bestIdx = -1;
  for (let i = 0; i < dist.length; i += 1) {
    if ((dist[i] ?? -1) > best) {
      best = dist[i] ?? -1;
      bestIdx = i;
    }
  }
  if (bestIdx < 0) return fallback;
  return { x: bestIdx % width, y: Math.floor(bestIdx / width) };
};

export const hasPath = (
  mask: Uint8Array,
  width: number,
  height: number,
  start: Vec2,
  end: Vec2
): boolean => {
  const dist = computeDistanceMap(mask, width, height, start);
  const value = dist[maskIndex(width, end.x, end.y)] ?? -1;
  return value >= 0;
};

export const computeComponents = (
  mask: Uint8Array,
  width: number,
  height: number
): Vec2[][] => {
  const visited = new Uint8Array(width * height);
  const out: Vec2[][] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const startIdx = maskIndex(width, x, y);
      if (mask[startIdx] !== 1 || visited[startIdx] === 1) continue;

      const queueX = new Int32Array(width * height);
      const queueY = new Int32Array(width * height);
      let qh = 0;
      let qt = 0;

      const component: Vec2[] = [];
      visited[startIdx] = 1;
      queueX[qt] = x;
      queueY[qt] = y;
      qt += 1;

      while (qh < qt) {
        const cx = queueX[qh] ?? 0;
        const cy = queueY[qh] ?? 0;
        qh += 1;
        component.push({ x: cx, y: cy });

        const neighbors: Array<[number, number]> = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (!inBounds(width, height, nx, ny)) continue;
          const ni = maskIndex(width, nx, ny);
          if (mask[ni] !== 1 || visited[ni] === 1) continue;
          visited[ni] = 1;
          queueX[qt] = nx;
          queueY[qt] = ny;
          qt += 1;
        }
      }

      out.push(component);
    }
  }

  return out;
};

const carveDisk = (mask: Uint8Array, width: number, height: number, x: number, y: number, radius: number): void => {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(width, height, nx, ny)) continue;
      mask[maskIndex(width, nx, ny)] = 1;
    }
  }
};

export const carveLine = (
  mask: Uint8Array,
  width: number,
  height: number,
  start: Vec2,
  end: Vec2,
  radius = 1
): void => {
  let x0 = start.x;
  let y0 = start.y;
  const x1 = end.x;
  const y1 = end.y;

  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    carveDisk(mask, width, height, x0, y0, radius);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
};

const nearestPair = (a: Vec2[], b: Vec2[]): [Vec2, Vec2] => {
  let bestA = a[0] ?? { x: 0, y: 0 };
  let bestB = b[0] ?? { x: 0, y: 0 };
  let bestScore = Number.POSITIVE_INFINITY;

  for (const pa of a) {
    for (const pb of b) {
      const dx = pa.x - pb.x;
      const dy = pa.y - pb.y;
      const score = dx * dx + dy * dy;
      if (score < bestScore) {
        bestScore = score;
        bestA = pa;
        bestB = pb;
      }
    }
  }

  return [bestA, bestB];
};

export const ensureSingleConnectedComponent = (
  mask: Uint8Array,
  width: number,
  height: number,
  anchor: Vec2,
  rng: RNG
): void => {
  if (!inBounds(width, height, anchor.x, anchor.y)) return;
  if (mask[maskIndex(width, anchor.x, anchor.y)] === 0) {
    carveDisk(mask, width, height, anchor.x, anchor.y, 1);
  }

  for (let i = 0; i < 32; i += 1) {
    const components = computeComponents(mask, width, height);
    if (components.length <= 1) return;

    let main = components.find((component) =>
      component.some((cell) => cell.x === anchor.x && cell.y === anchor.y)
    );

    if (!main) {
      main = components.reduce((acc, current) => (current.length > acc.length ? current : acc), components[0]!);
    }

    const detached = components.filter((component) => component !== main);
    if (detached.length === 0) return;

    // Connect one detached component per pass, nearest first with slight randomization.
    detached.sort((a, b) => a.length - b.length);
    const target = detached[rng.nextInt(Math.min(2, detached.length))] ?? detached[0]!;
    const [start, end] = nearestPair(main, target);
    carveLine(mask, width, height, start, end, 1);
  }
};
