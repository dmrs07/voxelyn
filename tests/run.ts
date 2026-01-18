import {
  createGrid2D,
  createSurface2D,
  makePalette,
  packRGBA,
  renderToSurface
} from "../src/index.js";
import {
  forEachRowMajor,
  forEachBottomUp,
  forEachMorton,
  forEachChunkOrder
} from "../src/core/traversal2d.js";

const assert = (cond: boolean, msg: string): void => {
  if (!cond) throw new Error(msg);
};

const g = createGrid2D(4, 4, { chunkSize: 2 });
assert(g.chunkCountX === 2, "chunkCountX");
assert(g.chunkCountY === 2, "chunkCountY");

let count = 0;
forEachRowMajor(4, 4, () => count++);
assert(count === 16, "row-major count");

count = 0;
forEachBottomUp(4, 4, () => count++);
assert(count === 16, "bottom-up count");

count = 0;
forEachMorton(4, 4, () => count++);
assert(count === 16, "morton count");

count = 0;
forEachChunkOrder(g, 1234, () => count++);
assert(count === 4, "chunk order count");

const surface = createSurface2D(2, 2);
const palette = makePalette(4, 0, [[1, packRGBA(255, 0, 0, 255)]]);

surface.pixels[0] = palette[1] ?? 0;
assert(surface.pixels[0] !== 0, "palette color");

console.log("tests ok");
