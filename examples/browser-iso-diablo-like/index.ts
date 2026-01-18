import {
  createSurface2D,
  fillRect,
  packRGBA,
  projectIso,
  forEachIsoOrder,
  blitColorkey
} from "../../src/index.js";
import { presentToCanvas } from "../../src/adapters/canvas2d.js";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("no ctx");

const surface = createSurface2D(canvas.width, canvas.height);

const TILE_W = 32;
const TILE_H = 16;

const makeDiamond = (w: number, h: number, color: number): Uint32Array => {
  const pixels = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    const t = y < h / 2 ? y : h - 1 - y;
    const span = 1 + (t * (w - 2)) / (h / 2);
    const x0 = ((w - span) / 2) | 0;
    const x1 = x0 + span;
    for (let x = x0; x < x1; x++) {
      pixels[y * w + x] = color;
    }
  }
  return pixels;
};

const grass = makeDiamond(TILE_W, TILE_H, packRGBA(50, 120, 50, 255));
const dirt = makeDiamond(TILE_W, TILE_H, packRGBA(110, 80, 40, 255));

const tilemapW = 10;
const tilemapH = 10;

const sprite = { width: 12, height: 18, pixels: new Uint32Array(12 * 18) };
const key = packRGBA(0, 0, 0, 0);
for (let y = 0; y < sprite.height; y++) {
  for (let x = 0; x < sprite.width; x++) {
    const inside = x > 2 && x < 9 && y > 2 && y < 16;
    sprite.pixels[y * sprite.width + x] = inside
      ? packRGBA(200, 40, 40, 255)
      : key;
  }
}

const drawTile = (tx: number, ty: number): void => {
  const iso = projectIso(tx, ty, 0, TILE_W, TILE_H, 8);
  const sx = (iso.sx + canvas.width / 2 - TILE_W / 2) | 0;
  const sy = (iso.sy + 40) | 0;
  const src = (tx + ty) % 2 === 0 ? grass : dirt;
  const spriteSurface = { width: TILE_W, height: TILE_H, pixels: src };
  blitColorkey(surface, spriteSurface, sx, sy, { colorkey: key });
};

const drawSprite = (tx: number, ty: number): void => {
  const iso = projectIso(tx, ty, 1, TILE_W, TILE_H, 8);
  const sx = (iso.sx + canvas.width / 2 - sprite.width / 2) | 0;
  const sy = (iso.sy + 40 - sprite.height + 2) | 0;
  blitColorkey(surface, sprite, sx, sy, { colorkey: key });
};

const render = (): void => {
  fillRect(surface, 0, 0, surface.width, surface.height, packRGBA(20, 20, 30, 255));
  forEachIsoOrder(tilemapW, tilemapH, (x, y) => {
    drawTile(x, y);
    if (x === 5 && y === 4) drawSprite(x, y);
  });
  presentToCanvas(ctx, surface);
  requestAnimationFrame(render);
};

render();
