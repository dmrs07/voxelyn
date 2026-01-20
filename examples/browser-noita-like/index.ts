import {
  createGrid2D,
  createSurface2D,
  makePalette,
  packRGBA,
  paintRect,
  paintCircle,
  renderToSurface,
  stepActiveChunks,
  makeCell,
  getMaterial,
  setXY,
  getXY,
  markChunkActiveByXY,
  markChunkDirtyByXY
} from "../../packages/voxelyn-core/src/index.js";
import { presentToCanvas } from "../../packages/voxelyn-core/src/adapters/canvas2d.js";
import { RNG } from "../../packages/voxelyn-core/src/core/rng.js";

const W = 128;
const H = 128;

const MATERIAL = {
  EMPTY: 0,
  SAND: 1,
  WATER: 2,
  ROCK: 3
} as const;

const palette = makePalette(256, 0x00000000, [
  [MATERIAL.EMPTY, packRGBA(0, 0, 0, 255)],
  [MATERIAL.SAND, packRGBA(210, 180, 90, 255)],
  [MATERIAL.WATER, packRGBA(40, 90, 200, 200)],
  [MATERIAL.ROCK, packRGBA(80, 80, 80, 255)]
]);

const grid = createGrid2D(W, H, { chunkSize: 32 });
const surface = createSurface2D(W, H);

paintRect(grid, 0, H - 6, W, 6, makeCell(MATERIAL.ROCK));
paintRect(grid, 0, 0, W, 1, makeCell(MATERIAL.ROCK));
paintRect(grid, 0, 0, 1, H, makeCell(MATERIAL.ROCK));
paintRect(grid, W - 1, 0, 1, H, makeCell(MATERIAL.ROCK));

const rng = new RNG(1234);

const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("no ctx");

let last = performance.now();
let frames = 0;
let acc = 0;
const fpsEl = document.getElementById("fps");

const trySwap = (x1: number, y1: number, x2: number, y2: number): boolean => {
  const a = getXY(grid, x1, y1);
  const b = getXY(grid, x2, y2);
  if ((b & 0xff) !== MATERIAL.EMPTY) return false;
  setXY(grid, x2, y2, a);
  setXY(grid, x1, y1, makeCell(MATERIAL.EMPTY));
  markChunkActiveByXY(grid, x1, y1);
  markChunkActiveByXY(grid, x2, y2);
  markChunkDirtyByXY(grid, x1, y1);
  markChunkDirtyByXY(grid, x2, y2);
  return true;
};

const stepSand = (x: number, y: number): void => {
  if (trySwap(x, y, x, y + 1)) return;
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (trySwap(x, y, x + dir, y + 1)) return;
  trySwap(x, y, x - dir, y + 1);
};

const stepWater = (x: number, y: number): void => {
  if (trySwap(x, y, x, y + 1)) return;
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (trySwap(x, y, x + dir, y)) return;
  trySwap(x, y, x - dir, y);
};

const perCell = (i: number, x: number, y: number): void => {
  const cell = grid.cells[i] ?? 0;
  const mat = getMaterial(cell);
  if (mat === MATERIAL.SAND) stepSand(x, y);
  else if (mat === MATERIAL.WATER) stepWater(x, y);
};

const tick = (): void => {
  paintCircle(grid, 24 + (rng.nextInt(80) | 0), 4, 3, makeCell(MATERIAL.SAND));
  paintCircle(grid, 48 + (rng.nextInt(48) | 0), 4, 2, makeCell(MATERIAL.WATER));

  stepActiveChunks(grid, "bottom-up", perCell);
  renderToSurface(grid, surface, palette);
  presentToCanvas(ctx, surface);

  const now = performance.now();
  frames++;
  acc += now - last;
  last = now;
  if (fpsEl && acc >= 500) {
    const fps = Math.round((frames * 1000) / acc);
    fpsEl.textContent = `fps: ${fps}`;
    frames = 0;
    acc = 0;
  }
  requestAnimationFrame(tick);
};

requestAnimationFrame(tick);
