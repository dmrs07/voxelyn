import { FOG_BASE_RANGE } from '../game/constants';

const DIR4: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const DIR8: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const idx = (width: number, x: number, y: number): number => y * width + x;

export type FogLightSource = {
  x: number;
  y: number;
  radius: number;
};

export type FogVisibilityInput = {
  width: number;
  height: number;
  passableMask: Uint8Array;
  heroX: number;
  heroY: number;
  baseRange?: number;
  lightSources?: FogLightSource[];
  output?: Uint8Array;
};

export const computeFogVisibility = (input: FogVisibilityInput): Uint8Array => {
  const width = input.width;
  const height = input.height;
  const passableMask = input.passableMask;
  const size = width * height;
  const output = input.output && input.output.length === size ? input.output : new Uint8Array(size);
  output.fill(0);

  if (input.heroX < 0 || input.heroY < 0 || input.heroX >= width || input.heroY >= height) {
    return output;
  }

  const start = idx(width, input.heroX, input.heroY);
  const baseRange = input.baseRange ?? FOG_BASE_RANGE;

  if (passableMask[start] === 1) {
    const queueX = new Int16Array(size);
    const queueY = new Int16Array(size);
    const queueD = new Int16Array(size);
    let qh = 0;
    let qt = 0;

    const visited = new Uint8Array(size);
    visited[start] = 1;
    queueX[qt] = input.heroX;
    queueY[qt] = input.heroY;
    queueD[qt] = 0;
    qt += 1;

    while (qh < qt) {
      const x = queueX[qh] ?? input.heroX;
      const y = queueY[qh] ?? input.heroY;
      const d = queueD[qh] ?? 0;
      qh += 1;

      const c = idx(width, x, y);
      output[c] = 1;

      if (d >= baseRange) continue;

      for (const [dx, dy] of DIR4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

        const ni = idx(width, nx, ny);
        if (visited[ni] === 1 || passableMask[ni] === 0) continue;

        visited[ni] = 1;
        queueX[qt] = nx;
        queueY[qt] = ny;
        queueD[qt] = d + 1;
        qt += 1;
      }
    }
  } else {
    output[start] = 1;
  }

  for (const light of input.lightSources ?? []) {
    const r = Math.max(1, light.radius);
    const r2 = r * r;
    const minX = Math.max(0, Math.floor(light.x - r));
    const maxX = Math.min(width - 1, Math.ceil(light.x + r));
    const minY = Math.max(0, Math.floor(light.y - r));
    const maxY = Math.min(height - 1, Math.ceil(light.y + r));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x - light.x;
        const dy = y - light.y;
        if (dx * dx + dy * dy > r2) continue;
        output[idx(width, x, y)] = 1;
      }
    }
  }

  // Reveal walls around visible passable spaces for readability.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(width, x, y);
      if (output[i] === 0 || passableMask[i] === 0) continue;

      for (const [dx, dy] of DIR8) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = idx(width, nx, ny);
        if (passableMask[ni] === 0) {
          output[ni] = 1;
        }
      }
    }
  }

  return output;
};
