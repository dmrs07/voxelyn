// ../.voxelyn-devlog-work/aab5fba8b278/src/core/surface2d.ts
function createSurface2D(width, height, options = {}) {
  const size = width * height;
  const pixels = options.pixels ?? new Uint32Array(size);
  if (pixels.length < size) {
    throw new Error("pixels length is smaller than width*height");
  }
  return { width, height, pixels };
}

// ../.voxelyn-devlog-work/aab5fba8b278/src/core/rng.ts
var RNG = class {
  constructor(seed) {
    const s = seed >>> 0;
    this.state = s === 0 ? 1831565813 : s;
  }
  nextU32() {
    let x = this.state >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }
  nextInt(max) {
    if (max <= 0) return 0;
    return this.nextU32() % max | 0;
  }
  nextFloat01() {
    return (this.nextU32() >>> 0) / 4294967296;
  }
};

// ../.voxelyn-devlog-work/aab5fba8b278/src/core/traversal2d.ts
var compact1By1 = (x) => {
  let v = x & 1431655765;
  v = (v ^ v >>> 1) & 858993459;
  v = (v ^ v >>> 2) & 252645135;
  v = (v ^ v >>> 4) & 16711935;
  v = (v ^ v >>> 8) & 65535;
  return v;
};
var mortonDecode2D = (code) => {
  return { x: compact1By1(code), y: compact1By1(code >>> 1) };
};
function forEachInRectRowMajor(x0, y0, width, height, fn) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      fn(x0 + x, y0 + y);
    }
  }
}
function forEachInRectBottomUp(x0, y0, width, height, fn) {
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      fn(x0 + x, y0 + y);
    }
  }
}
function forEachInRectMorton(x0, y0, width, height, fn) {
  const maxSide = Math.max(width, height);
  const bits = Math.max(1, Math.ceil(Math.log2(maxSide)));
  const maxCode = 1 << 2 * bits;
  for (let code = 0; code < maxCode; code++) {
    const { x, y } = mortonDecode2D(code);
    if (x < width && y < height) {
      fn(x0 + x, y0 + y);
    }
  }
}

// ../.voxelyn-devlog-work/aab5fba8b278/src/core/grid2d.ts
var CELL_MATERIAL_MASK = 255;
var CELL_FLAG_SHIFT = 8;
var CHUNK_ACTIVE = 1;
var CHUNK_DIRTY = 2;
var makeCell = (material, flags = 0) => (flags & 255) << CELL_FLAG_SHIFT | material & 255;
var getMaterial = (cell) => cell & CELL_MATERIAL_MASK;
function createGrid2D(width, height, options = {}) {
  const chunkSize = options.chunkSize ?? 64;
  const size = width * height;
  const cells = options.cells ?? new Uint16Array(size);
  const chunkCountX = Math.ceil(width / chunkSize);
  const chunkCountY = Math.ceil(height / chunkSize);
  const chunkCount = chunkCountX * chunkCountY;
  const activeFlags = new Uint8Array(chunkCount);
  const dirtyFlags = new Uint8Array(chunkCount);
  if (cells.length < size) {
    throw new Error("cells length is smaller than width*height");
  }
  return {
    width,
    height,
    chunkSize,
    chunkCountX,
    chunkCountY,
    cells,
    activeFlags,
    dirtyFlags
  };
}
function index(grid2, x, y) {
  return y * grid2.width + x;
}
function inBounds(grid2, x, y) {
  return x >= 0 && y >= 0 && x < grid2.width && y < grid2.height;
}
function getXY(grid2, x, y) {
  if (!inBounds(grid2, x, y)) return 0;
  return grid2.cells[index(grid2, x, y)] ?? 0;
}
function setXY(grid2, x, y, val) {
  if (!inBounds(grid2, x, y)) return;
  grid2.cells[index(grid2, x, y)] = val & 65535;
}
var chunkIndexFromXY = (grid2, x, y) => {
  const cx = x / grid2.chunkSize | 0;
  const cy = y / grid2.chunkSize | 0;
  return cy * grid2.chunkCountX + cx;
};
function markChunkActiveByXY(grid2, x, y) {
  if (!inBounds(grid2, x, y)) return;
  const idx = chunkIndexFromXY(grid2, x, y);
  grid2.activeFlags[idx] = CHUNK_ACTIVE;
}
function markChunkDirtyByXY(grid2, x, y) {
  if (!inBounds(grid2, x, y)) return;
  const idx = chunkIndexFromXY(grid2, x, y);
  grid2.dirtyFlags[idx] = CHUNK_DIRTY;
}
function paintRect(grid2, x, y, width, height, cellVal) {
  const x0 = Math.max(0, x) | 0;
  const y0 = Math.max(0, y) | 0;
  const x1 = Math.min(grid2.width, x + width) | 0;
  const y1 = Math.min(grid2.height, y + height) | 0;
  const cell = cellVal & 65535;
  const cxs = x0 / grid2.chunkSize | 0;
  const cxe = (x1 - 1) / grid2.chunkSize | 0;
  const cys = y0 / grid2.chunkSize | 0;
  const cye = (y1 - 1) / grid2.chunkSize | 0;
  for (let cy = cys; cy <= cye; cy++) {
    for (let cx = cxs; cx <= cxe; cx++) {
      const cidx = cy * grid2.chunkCountX + cx;
      grid2.activeFlags[cidx] = CHUNK_ACTIVE;
      grid2.dirtyFlags[cidx] = CHUNK_DIRTY;
    }
  }
  for (let yy = y0; yy < y1; yy++) {
    let row = yy * grid2.width + x0;
    for (let xx = x0; xx < x1; xx++) {
      grid2.cells[row++] = cell;
    }
  }
}
function paintCircle(grid2, cx, cy, radius, cellVal) {
  const r2 = radius * radius;
  const x0 = Math.max(0, cx - radius) | 0;
  const y0 = Math.max(0, cy - radius) | 0;
  const x1 = Math.min(grid2.width - 1, cx + radius) | 0;
  const y1 = Math.min(grid2.height - 1, cy + radius) | 0;
  const cell = cellVal & 65535;
  const cxs = x0 / grid2.chunkSize | 0;
  const cxe = x1 / grid2.chunkSize | 0;
  const cys = y0 / grid2.chunkSize | 0;
  const cye = y1 / grid2.chunkSize | 0;
  for (let cy0 = cys; cy0 <= cye; cy0++) {
    for (let cx0 = cxs; cx0 <= cxe; cx0++) {
      const cidx = cy0 * grid2.chunkCountX + cx0;
      grid2.activeFlags[cidx] = CHUNK_ACTIVE;
      grid2.dirtyFlags[cidx] = CHUNK_DIRTY;
    }
  }
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    const row = y * grid2.width;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy <= r2) {
        grid2.cells[row + x] = cell;
      }
    }
  }
}
function forEachActiveChunk(grid2, fn) {
  const size = grid2.chunkSize;
  for (let cy = 0; cy < grid2.chunkCountY; cy++) {
    for (let cx = 0; cx < grid2.chunkCountX; cx++) {
      const cidx = cy * grid2.chunkCountX + cx;
      if (grid2.activeFlags[cidx] !== CHUNK_ACTIVE) continue;
      const startX = cx * size;
      const startY = cy * size;
      const w = Math.min(size, grid2.width - startX);
      const h = Math.min(size, grid2.height - startY);
      fn(cx, cy, startX, startY, w, h, cidx);
    }
  }
}
function stepActiveChunks(grid2, order, perCellFn) {
  forEachActiveChunk(grid2, (_cx, _cy, startX, startY, w, h) => {
    const visit = (x, y) => {
      const i = y * grid2.width + x;
      perCellFn(i, x, y, grid2);
    };
    if (order === "bottom-up") {
      forEachInRectBottomUp(startX, startY, w, h, visit);
    } else if (order === "morton") {
      forEachInRectMorton(startX, startY, w, h, visit);
    } else {
      forEachInRectRowMajor(startX, startY, w, h, visit);
    }
  });
}
function renderToSurface(grid2, surface2, palette2) {
  const w = Math.min(grid2.width, surface2.width);
  const h = Math.min(grid2.height, surface2.height);
  const gw = grid2.width;
  const sp = surface2.pixels;
  const cells = grid2.cells;
  for (let y = 0; y < h; y++) {
    let gi = y * gw;
    let si = y * surface2.width;
    for (let x = 0; x < w; x++) {
      const mat = cells[gi++] & CELL_MATERIAL_MASK;
      sp[si++] = palette2[mat] ?? 0;
    }
  }
}

// ../.voxelyn-devlog-work/aab5fba8b278/src/core/palette.ts
function makePalette(size = 256, fill = 0, entries = []) {
  const pal = new Uint32Array(size);
  pal.fill(fill >>> 0);
  for (let i = 0; i < entries.length; i++) {
    const [idx, color] = entries[i];
    if (idx >= 0 && idx < size) {
      pal[idx] = color >>> 0;
    }
  }
  return pal;
}
function packRGBA(r, g, b, a = 255) {
  return ((a & 255) << 24 | (b & 255) << 16 | (g & 255) << 8 | r & 255) >>> 0;
}

// ../.voxelyn-devlog-work/aab5fba8b278/src/adapters/canvas2d.ts
function presentToCanvas(ctx2, surface2) {
  const imageData = ctx2.getImageData(0, 0, surface2.width, surface2.height);
  const bytes = new Uint8ClampedArray(surface2.pixels.buffer);
  if (bytes.byteLength === imageData.data.byteLength) {
    imageData.data.set(bytes);
  } else {
    const min = Math.min(bytes.byteLength, imageData.data.byteLength);
    imageData.data.set(bytes.subarray(0, min));
  }
  ctx2.putImageData(imageData, 0, 0);
}

// ../.voxelyn-devlog-work/aab5fba8b278/examples/browser-noita-like/index.ts
var W = 128;
var H = 128;
var MATERIAL = {
  EMPTY: 0,
  SAND: 1,
  WATER: 2,
  ROCK: 3
};
var palette = makePalette(256, 0, [
  [MATERIAL.EMPTY, packRGBA(0, 0, 0, 255)],
  [MATERIAL.SAND, packRGBA(210, 180, 90, 255)],
  [MATERIAL.WATER, packRGBA(40, 90, 200, 200)],
  [MATERIAL.ROCK, packRGBA(80, 80, 80, 255)]
]);
var grid = createGrid2D(W, H, { chunkSize: 32 });
var surface = createSurface2D(W, H);
paintRect(grid, 0, H - 6, W, 6, makeCell(MATERIAL.ROCK));
paintRect(grid, 0, 0, W, 1, makeCell(MATERIAL.ROCK));
paintRect(grid, 0, 0, 1, H, makeCell(MATERIAL.ROCK));
paintRect(grid, W - 1, 0, 1, H, makeCell(MATERIAL.ROCK));
var rng = new RNG(1234);
var canvas = document.getElementById("c");
var ctx = canvas.getContext("2d");
if (!ctx) throw new Error("no ctx");
var last = performance.now();
var frames = 0;
var acc = 0;
var fpsEl = document.getElementById("fps");
var trySwap = (x1, y1, x2, y2) => {
  const a = getXY(grid, x1, y1);
  const b = getXY(grid, x2, y2);
  if ((b & 255) !== MATERIAL.EMPTY) return false;
  setXY(grid, x2, y2, a);
  setXY(grid, x1, y1, makeCell(MATERIAL.EMPTY));
  markChunkActiveByXY(grid, x1, y1);
  markChunkActiveByXY(grid, x2, y2);
  markChunkDirtyByXY(grid, x1, y1);
  markChunkDirtyByXY(grid, x2, y2);
  return true;
};
var stepSand = (x, y) => {
  if (trySwap(x, y, x, y + 1)) return;
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (trySwap(x, y, x + dir, y + 1)) return;
  trySwap(x, y, x - dir, y + 1);
};
var stepWater = (x, y) => {
  if (trySwap(x, y, x, y + 1)) return;
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (trySwap(x, y, x + dir, y)) return;
  trySwap(x, y, x - dir, y);
};
var perCell = (i, x, y) => {
  const cell = grid.cells[i] ?? 0;
  const mat = getMaterial(cell);
  if (mat === MATERIAL.SAND) stepSand(x, y);
  else if (mat === MATERIAL.WATER) stepWater(x, y);
};
var tick = () => {
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
    const fps = Math.round(frames * 1e3 / acc);
    fpsEl.textContent = `fps: ${fps}`;
    frames = 0;
    acc = 0;
  }
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
