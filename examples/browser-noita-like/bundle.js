// packages/voxelyn-core/src/core/surface2d.ts
function createSurface2D(width, height, options = {}) {
  const size = width * height;
  const pixels = options.pixels ?? new Uint32Array(size);
  if (pixels.length < size) {
    throw new Error("pixels length is smaller than width*height");
  }
  return { width, height, pixels };
}

// packages/voxelyn-core/src/core/rng.ts
var RNG = class {
  /**
   * Creates a new RNG with the given seed.
   * @param seed - Initial seed value (0 uses default seed)
   */
  constructor(seed) {
    const s = seed >>> 0;
    this.state = s === 0 ? 1831565813 : s;
  }
  /**
   * Generates the next unsigned 32-bit integer.
   * @returns Random value in range [0, 2^32 - 1]
   */
  nextU32() {
    let x = this.state >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }
  /**
   * Generates a random integer in range [0, max).
   * @param max - Exclusive upper bound
   * @returns Random integer
   */
  nextInt(max) {
    if (max <= 0) return 0;
    return this.nextU32() % max | 0;
  }
  /**
   * Generates a random float in range [0, 1).
   * @returns Random float
   */
  nextFloat01() {
    return (this.nextU32() >>> 0) / 4294967296;
  }
};

// packages/voxelyn-core/src/core/traversal2d.ts
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

// packages/voxelyn-core/src/core/grid2d.ts
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
  const cellsLen = cells.length;
  for (let y = 0; y < h; y++) {
    let gi = y * gw;
    let si = y * surface2.width;
    for (let x = 0; x < w; x++) {
      const mat = gi < cellsLen ? (cells[gi] ?? 0) & CELL_MATERIAL_MASK : 0;
      gi++;
      sp[si++] = palette2[mat] ?? 0;
    }
  }
}

// packages/voxelyn-core/src/core/palette.ts
function makePalette(size = 256, fill = 0, entries = []) {
  const pal = new Uint32Array(size);
  pal.fill(fill >>> 0);
  for (const entry of entries) {
    if (!entry) continue;
    const [idx, color] = entry;
    if (idx >= 0 && idx < size) {
      pal[idx] = color >>> 0;
    }
  }
  return pal;
}
function makeMaterial(overrides) {
  const isGaseous = overrides.isGaseous ?? false;
  const isGas2 = overrides.isGas ?? isGaseous;
  return {
    id: 0,
    name: "Unnamed",
    color: 4294967295,
    density: 50,
    friction: 0.5,
    isLiquid: false,
    isGaseous,
    // Keep deprecated field for backward compatibility only.
    isGas: isGas2,
    isTransparent: false,
    flammable: false,
    ...overrides
  };
}
var DEFAULT_MATERIALS = [
  makeMaterial({
    id: 0,
    name: "Air",
    color: packRGBA(200, 220, 255, 0),
    density: 0,
    isGaseous: true,
    isTransparent: true
  }),
  makeMaterial({
    id: 1,
    name: "Stone",
    color: packRGBA(128, 128, 128),
    density: 95,
    friction: 0.8
  }),
  makeMaterial({
    id: 2,
    name: "Dirt",
    color: packRGBA(139, 90, 43),
    density: 85,
    friction: 0.7
  }),
  makeMaterial({
    id: 3,
    name: "Sand",
    color: packRGBA(194, 178, 128),
    density: 80,
    friction: 0.5
  }),
  makeMaterial({
    id: 4,
    name: "Water",
    color: packRGBA(0, 100, 200, 180),
    density: 50,
    friction: 0.1,
    isLiquid: true,
    isTransparent: true
  }),
  makeMaterial({
    id: 5,
    name: "Lava",
    color: packRGBA(255, 100, 0, 200),
    density: 60,
    friction: 0.2,
    isLiquid: true,
    flammable: true
  }),
  makeMaterial({
    id: 6,
    name: "Wood",
    color: packRGBA(139, 69, 19),
    density: 60,
    friction: 0.6,
    flammable: true
  }),
  makeMaterial({
    id: 7,
    name: "Grass",
    color: packRGBA(34, 139, 34),
    density: 55,
    friction: 0.7,
    flammable: true
  }),
  makeMaterial({
    id: 8,
    name: "Leaves",
    color: packRGBA(34, 170, 34),
    density: 20,
    friction: 0.4,
    isTransparent: true,
    flammable: true
  }),
  makeMaterial({
    id: 9,
    name: "Snow",
    color: packRGBA(240, 240, 250),
    density: 30,
    friction: 0.3
  }),
  makeMaterial({
    id: 10,
    name: "Gravel",
    color: packRGBA(102, 102, 102),
    density: 75,
    friction: 0.6
  }),
  makeMaterial({
    id: 11,
    name: "Cactus",
    color: packRGBA(50, 150, 50),
    density: 40,
    friction: 0.5,
    flammable: true
  }),
  makeMaterial({
    id: 12,
    name: "Flower Red",
    color: packRGBA(220, 50, 80),
    density: 10,
    friction: 0.3,
    flammable: true
  }),
  makeMaterial({
    id: 13,
    name: "Flower Yellow",
    color: packRGBA(255, 220, 50),
    density: 10,
    friction: 0.3,
    flammable: true
  }),
  makeMaterial({
    id: 14,
    name: "Palm Wood",
    color: packRGBA(180, 140, 90),
    density: 55,
    friction: 0.6,
    flammable: true
  }),
  makeMaterial({
    id: 15,
    name: "Mushroom",
    color: packRGBA(200, 180, 160),
    density: 20,
    friction: 0.4
  }),
  makeMaterial({
    id: 16,
    name: "Moss",
    color: packRGBA(80, 120, 60),
    density: 30,
    friction: 0.5
  }),
  makeMaterial({
    id: 17,
    name: "Coral",
    color: packRGBA(255, 120, 150),
    density: 50,
    friction: 0.6
  }),
  makeMaterial({
    id: 18,
    name: "Clay",
    color: packRGBA(150, 100, 70),
    density: 70,
    friction: 0.5
  }),
  makeMaterial({
    id: 19,
    name: "Ice",
    color: packRGBA(200, 230, 255, 200),
    density: 45,
    friction: 0.05,
    isTransparent: true
  })
];
function packRGBA(r, g, b, a = 255) {
  return ((a & 255) << 24 | (b & 255) << 16 | (g & 255) << 8 | r & 255) >>> 0;
}

// packages/voxelyn-core/src/core/terrain/noise.ts
var quintic = (t) => t * t * t * (t * (t * 6 - 15) + 10);
var lerp = (a, b, t) => a + (b - a) * t;
var GradientNoise = class {
  constructor(seed, detail) {
    const rng2 = new RNG(seed);
    this._octaves = detail?.octaves ?? 6;
    this._falloff = detail?.falloff ?? 0.5;
    this._lacunarity = detail?.lacunarity ?? 2;
    this.permutation = new Uint8Array(512);
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }
    for (let i = 255; i > 0; i--) {
      const j = rng2.nextInt(i + 1);
      const tmp = this.permutation[i];
      this.permutation[i] = this.permutation[j];
      this.permutation[j] = tmp;
    }
    for (let i = 0; i < 256; i++) {
      this.permutation[256 + i] = this.permutation[i];
    }
    this.gradients = new Float32Array(256 * 2);
    for (let i = 0; i < 256; i++) {
      const angle = rng2.nextFloat01() * Math.PI * 2;
      this.gradients[i * 2] = Math.cos(angle);
      this.gradients[i * 2 + 1] = Math.sin(angle);
    }
  }
  /** Set noise detail (octaves and falloff) - like p5.js noiseDetail() */
  setDetail(octaves, falloff = 0.5) {
    this._octaves = Math.max(1, Math.min(16, octaves));
    this._falloff = Math.max(0, Math.min(1, falloff));
  }
  get octaves() {
    return this._octaves;
  }
  get falloff() {
    return this._falloff;
  }
  get lacunarity() {
    return this._lacunarity;
  }
  grad(hash, x, y) {
    const idx = (hash & 255) * 2;
    return this.gradients[idx] * x + this.gradients[idx + 1] * y;
  }
  /** 
   * Sample raw noise at position (returns 0-1)
   * This is the basic Perlin noise sample - like calling noise(x, y) in p5.js
   */
  sample(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = quintic(xf);
    const v = quintic(yf);
    const p = this.permutation;
    const aa = p[p[xi & 255] + yi & 511];
    const ab = p[p[xi & 255] + yi + 1 & 511];
    const ba = p[p[xi + 1 & 255] + yi & 511];
    const bb = p[p[xi + 1 & 255] + yi + 1 & 511];
    const g00 = this.grad(aa, xf, yf);
    const g10 = this.grad(ba, xf - 1, yf);
    const g01 = this.grad(ab, xf, yf - 1);
    const g11 = this.grad(bb, xf - 1, yf - 1);
    const x1 = lerp(g00, g10, u);
    const x2 = lerp(g01, g11, u);
    return lerp(x1, x2, v) * 0.5 + 0.5;
  }
  /**
   * Sample noise with zoom factor - the key technique from terrain tutorials!
   * Dividing x,y by zoomFactor "zooms in" on the noise, making it smoother
   * 
   * @param x - X coordinate
   * @param y - Y coordinate  
   * @param zoomFactor - How much to zoom in (higher = smoother). Default: 100
   */
  sampleZoomed(x, y, zoomFactor = 100) {
    return this.fbm(x / zoomFactor, y / zoomFactor, this._octaves, this._lacunarity, this._falloff);
  }
  /** 
   * Fractal Brownian Motion - combines multiple octaves of noise
   * This adds detail and makes terrain look more natural
   * Like using noiseDetail() in p5.js to add more layers
   */
  fbm(x, y, octaves, lacunarity, persistence) {
    const oct = octaves ?? this._octaves;
    const lac = lacunarity ?? this._lacunarity;
    const pers = persistence ?? this._falloff;
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < oct; i++) {
      value += amplitude * this.sample(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= pers;
      frequency *= lac;
    }
    return value / maxValue;
  }
  /** Ridged noise for mountain-like features */
  ridged(x, y, octaves, lacunarity, persistence) {
    const oct = octaves ?? this._octaves;
    const lac = lacunarity ?? this._lacunarity;
    const pers = persistence ?? this._falloff;
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < oct; i++) {
      const n = 1 - Math.abs(this.sample(x * frequency, y * frequency) * 2 - 1);
      value += amplitude * n * n;
      maxValue += amplitude;
      amplitude *= pers;
      frequency *= lac;
    }
    return value / maxValue;
  }
  /** Domain-warped noise for organic distortion */
  warped(x, y, warpScale = 0.5, octaves) {
    const oct = octaves ?? Math.max(3, this._octaves - 1);
    const warpX = this.fbm(x + 5.2, y + 1.3, oct) * warpScale;
    const warpY = this.fbm(x + 9.7, y + 2.8, oct) * warpScale;
    return this.fbm(x + warpX * 10, y + warpY * 10, oct);
  }
  /** Turbulence noise - absolute value creates cloud-like patterns */
  turbulence(x, y, octaves) {
    const oct = octaves ?? this._octaves;
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < oct; i++) {
      value += amplitude * Math.abs(this.sample(x * frequency, y * frequency) * 2 - 1);
      maxValue += amplitude;
      amplitude *= this._falloff;
      frequency *= this._lacunarity;
    }
    return value / maxValue;
  }
  /** Billowy noise - inverse of ridged, creates soft round hills */
  billowy(x, y, octaves) {
    const oct = octaves ?? this._octaves;
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < oct; i++) {
      const n = this.sample(x * frequency, y * frequency);
      value += amplitude * (n * n);
      maxValue += amplitude;
      amplitude *= this._falloff;
      frequency *= this._lacunarity;
    }
    return value / maxValue;
  }
};
var CellularNoise = class {
  constructor(seed, density = 1) {
    const rng2 = new RNG(seed);
    this.gridSize = Math.ceil(density);
    const pointCount = this.gridSize * this.gridSize;
    this.points = new Float32Array(pointCount * 2);
    for (let i = 0; i < pointCount; i++) {
      this.points[i * 2] = rng2.nextFloat01();
      this.points[i * 2 + 1] = rng2.nextFloat01();
    }
  }
  /** Get distance to nearest cell center */
  sample(x, y) {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    const fracX = x - cellX;
    const fracY = y - cellY;
    let f1 = 999;
    let f2 = 999;
    let cellId = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const neighborX = cellX + dx;
        const neighborY = cellY + dy;
        const hash = Math.abs((neighborX * 127 + neighborY * 311) % (this.gridSize * this.gridSize));
        const pointX = dx + this.points[hash * 2];
        const pointY = dy + this.points[hash * 2 + 1];
        const distX = pointX - fracX;
        const distY = pointY - fracY;
        const dist = Math.sqrt(distX * distX + distY * distY);
        if (dist < f1) {
          f2 = f1;
          f1 = dist;
          cellId = hash;
        } else if (dist < f2) {
          f2 = dist;
        }
      }
    }
    return { f1, f2, cellId };
  }
  /** Get cell boundary value (f2 - f1), useful for edges */
  sampleEdge(x, y) {
    const { f1, f2 } = this.sample(x, y);
    return f2 - f1;
  }
};

// packages/voxelyn-core/src/core/terrain/biome-map.ts
var TERRAIN_COLORS = {
  deepWater: [20, 50, 120, 255],
  shallowWater: [40, 90, 180, 255],
  wetSand: [194, 178, 128, 255],
  drySand: [230, 210, 160, 255],
  darkGrass: [34, 139, 34, 255],
  lightGrass: [124, 200, 80, 255],
  forest: [34, 100, 34, 255],
  denseForest: [20, 60, 20, 255],
  rock: [120, 120, 130, 255],
  snow: [250, 250, 255, 255]
};
var flatShape = (baseHeight = 0.3) => (_x, _y, z01, _ctx) => ({
  height: z01 < baseHeight ? 1 : 0,
  density: z01 < baseHeight ? 0.8 : 0
});
var hillyShape = (baseHeight = 0.3, hillScale = 0.05) => (x, y, z01, ctx2) => {
  const noise = new GradientNoise(ctx2.seed);
  const hillHeight = baseHeight + noise.fbm(x * hillScale, y * hillScale, 3) * 0.3;
  return {
    height: z01 < hillHeight ? 1 : 0,
    density: z01 < hillHeight ? 0.7 + noise.sample(x * 0.1, y * 0.1) * 0.3 : 0
  };
};
var mountainShape = (baseHeight = 0.2, peakHeight = 0.9) => (x, y, z01, ctx2) => {
  const noise = new GradientNoise(ctx2.seed);
  const ridgeNoise = noise.ridged(x * 0.03, y * 0.03, 4);
  const mountainHeight = baseHeight + ridgeNoise * (peakHeight - baseHeight);
  return {
    height: z01 < mountainHeight ? 1 : 0,
    density: z01 < mountainHeight ? 0.9 : 0
  };
};
var HEIGHT_BASED_BIOMES = [
  {
    name: "deep_water",
    heightRange: [0, 0.3],
    colorGradient: { minColor: TERRAIN_COLORS.deepWater, maxColor: TERRAIN_COLORS.shallowWater },
    priority: 10,
    shape: flatShape(0.15),
    materials: () => 1
  },
  {
    name: "shallow_water",
    heightRange: [0.3, 0.4],
    colorGradient: { minColor: TERRAIN_COLORS.shallowWater, maxColor: [80, 140, 200, 255] },
    priority: 9,
    shape: flatShape(0.18),
    materials: () => 1
  },
  {
    name: "beach",
    heightRange: [0.4, 0.45],
    colorGradient: { minColor: TERRAIN_COLORS.wetSand, maxColor: TERRAIN_COLORS.drySand },
    priority: 8,
    shape: flatShape(0.22),
    materials: () => 2
  },
  {
    name: "grass",
    heightRange: [0.45, 0.6],
    colorGradient: { minColor: TERRAIN_COLORS.lightGrass, maxColor: TERRAIN_COLORS.darkGrass },
    priority: 5,
    shape: hillyShape(0.3, 0.04),
    materials: () => 3
  },
  {
    name: "forest",
    heightRange: [0.6, 0.75],
    colorGradient: { minColor: TERRAIN_COLORS.forest, maxColor: TERRAIN_COLORS.denseForest },
    priority: 6,
    shape: hillyShape(0.35, 0.03),
    materials: () => 4
  },
  {
    name: "mountain",
    heightRange: [0.75, 0.9],
    colorGradient: { minColor: [100, 100, 110, 255], maxColor: TERRAIN_COLORS.rock },
    priority: 7,
    shape: mountainShape(0.4, 0.85),
    materials: () => 8
  },
  {
    name: "snow_peak",
    heightRange: [0.9, 1],
    colorGradient: { minColor: [200, 200, 210, 255], maxColor: TERRAIN_COLORS.snow },
    priority: 8,
    shape: mountainShape(0.5, 0.95),
    materials: () => 7
  }
];
var CLIMATE_BASED_BIOMES = [
  {
    name: "ocean",
    climate: { elevationMax: 0.2 },
    colorGradient: { minColor: TERRAIN_COLORS.deepWater, maxColor: TERRAIN_COLORS.shallowWater },
    priority: 10,
    shape: flatShape(0.15),
    materials: () => 1
  },
  {
    name: "beach",
    climate: { elevationMin: 0.18, elevationMax: 0.25, moistureMin: 0.3 },
    colorGradient: { minColor: TERRAIN_COLORS.wetSand, maxColor: TERRAIN_COLORS.drySand },
    priority: 8,
    shape: flatShape(0.22),
    materials: () => 2
  },
  {
    name: "desert",
    climate: { temperatureMin: 0.6, moistureMax: 0.25, elevationMin: 0.2, elevationMax: 0.5 },
    colorGradient: { minColor: [210, 180, 140, 255], maxColor: [240, 220, 180, 255] },
    priority: 5,
    shape: hillyShape(0.25, 0.02),
    materials: () => 2
  },
  {
    name: "grassland",
    climate: { temperatureMin: 0.3, temperatureMax: 0.7, moistureMin: 0.3, moistureMax: 0.6, elevationMin: 0.2, elevationMax: 0.5 },
    colorGradient: { minColor: TERRAIN_COLORS.lightGrass, maxColor: TERRAIN_COLORS.darkGrass },
    priority: 3,
    shape: hillyShape(0.3, 0.04),
    materials: () => 3
  },
  {
    name: "forest",
    climate: { temperatureMin: 0.25, temperatureMax: 0.65, moistureMin: 0.5, elevationMin: 0.2, elevationMax: 0.6 },
    colorGradient: { minColor: TERRAIN_COLORS.forest, maxColor: TERRAIN_COLORS.denseForest },
    priority: 4,
    shape: hillyShape(0.35, 0.03),
    materials: () => 4
  },
  {
    name: "taiga",
    climate: { temperatureMax: 0.35, moistureMin: 0.3, elevationMin: 0.25, elevationMax: 0.6 },
    colorGradient: { minColor: [60, 90, 60, 255], maxColor: [40, 70, 50, 255] },
    priority: 4,
    shape: hillyShape(0.3, 0.04),
    materials: () => 5
  },
  {
    name: "tundra",
    climate: { temperatureMax: 0.2, elevationMin: 0.15, elevationMax: 0.5 },
    colorGradient: { minColor: [180, 200, 190, 255], maxColor: [220, 230, 225, 255] },
    priority: 5,
    shape: flatShape(0.25),
    materials: () => 6
  },
  {
    name: "mountains",
    climate: { elevationMin: 0.55 },
    colorGradient: { minColor: [100, 100, 110, 255], maxColor: TERRAIN_COLORS.snow },
    priority: 7,
    shape: mountainShape(0.4, 0.95),
    materials: (x, y, z01, ctx2) => {
      const noise = new GradientNoise(ctx2.seed);
      if (z01 > 0.7 + noise.sample(x * 0.1, y * 0.1) * 0.1) return 7;
      return 8;
    }
  },
  {
    name: "swamp",
    climate: { temperatureMin: 0.4, moistureMin: 0.7, elevationMin: 0.15, elevationMax: 0.3 },
    colorGradient: { minColor: [60, 80, 50, 255], maxColor: [80, 100, 60, 255] },
    priority: 6,
    shape: flatShape(0.2),
    materials: () => 9
  }
];

// packages/voxelyn-core/src/adapters/canvas2d.ts
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

// examples/browser-noita-like/wands.ts
var createWands = (mat) => [
  {
    id: "spark",
    name: "Spark Wand",
    cooldown: 6,
    spread: 0.18,
    projectileSpeed: 2.7,
    burst: 1,
    payloads: [mat.FIRE, mat.SMOKE],
    impact: "explode",
    trail: mat.FIRE
  },
  {
    id: "alchemist",
    name: "Alchemist Wand",
    cooldown: 8,
    spread: 0.22,
    projectileSpeed: 2.1,
    burst: 2,
    payloads: [mat.WATER, mat.OIL, mat.ACID],
    impact: "splash"
  },
  {
    id: "geomancer",
    name: "Geomancer Wand",
    cooldown: 10,
    spread: 0.12,
    projectileSpeed: 1.9,
    burst: 1,
    payloads: [mat.SAND, mat.ROCK, mat.WOOD],
    impact: "splash"
  }
];
var pickPayload = (wand, rng2) => {
  if (wand.payloads.length === 0) return 0;
  return wand.payloads[rng2.nextInt(wand.payloads.length)] ?? 0;
};

// examples/browser-noita-like/materials.ts
var MATERIAL = {
  EMPTY: 0,
  SAND: 1,
  WATER: 2,
  OIL: 3,
  ROCK: 4,
  WOOD: 5,
  FIRE: 6,
  SMOKE: 7,
  ACID: 8,
  STEAM: 9,
  GLASS: 10,
  CERAMIC: 11,
  SILICA: 12,
  PLAYER: 13,
  // New materials for biomes
  DIRT: 14,
  GRASS: 15,
  SNOW: 16,
  ICE: 17,
  LAVA: 18,
  OBSIDIAN: 19,
  FUNGUS: 20,
  COAL: 21
};
var MATERIAL_LABEL = {
  [MATERIAL.SAND]: "Sand",
  [MATERIAL.WATER]: "Water",
  [MATERIAL.OIL]: "Oil",
  [MATERIAL.ROCK]: "Rock",
  [MATERIAL.WOOD]: "Wood",
  [MATERIAL.ACID]: "Acid",
  [MATERIAL.STEAM]: "Steam",
  [MATERIAL.GLASS]: "Glass",
  [MATERIAL.CERAMIC]: "Ceramic",
  [MATERIAL.SILICA]: "Silica",
  [MATERIAL.DIRT]: "Dirt",
  [MATERIAL.GRASS]: "Grass",
  [MATERIAL.SNOW]: "Snow",
  [MATERIAL.ICE]: "Ice",
  [MATERIAL.LAVA]: "Lava",
  [MATERIAL.OBSIDIAN]: "Obsidian",
  [MATERIAL.FUNGUS]: "Fungus",
  [MATERIAL.COAL]: "Coal"
};
var IS_SOLID = {
  [MATERIAL.ROCK]: true,
  [MATERIAL.WOOD]: true,
  [MATERIAL.SILICA]: true,
  [MATERIAL.CERAMIC]: true,
  [MATERIAL.GLASS]: true,
  [MATERIAL.ICE]: true,
  [MATERIAL.OBSIDIAN]: true,
  [MATERIAL.DIRT]: true,
  [MATERIAL.GRASS]: true
};
var IS_FLUID = {
  [MATERIAL.WATER]: true,
  [MATERIAL.OIL]: true,
  [MATERIAL.ACID]: true,
  [MATERIAL.LAVA]: true
};
var IS_GAS = {
  [MATERIAL.SMOKE]: true,
  [MATERIAL.FIRE]: true,
  [MATERIAL.STEAM]: true
};
var IS_POWDER = {
  [MATERIAL.SAND]: true,
  [MATERIAL.SNOW]: true,
  [MATERIAL.COAL]: true
};
var IS_FLAMMABLE = {
  [MATERIAL.WOOD]: true,
  [MATERIAL.OIL]: true,
  [MATERIAL.COAL]: true,
  [MATERIAL.FUNGUS]: true,
  [MATERIAL.GRASS]: true
};
var IS_ACID_RESISTANT = {
  [MATERIAL.ROCK]: true,
  [MATERIAL.SILICA]: true,
  [MATERIAL.CERAMIC]: true,
  [MATERIAL.GLASS]: true,
  [MATERIAL.OBSIDIAN]: true,
  [MATERIAL.PLAYER]: true
};
var DENSITY = {
  [MATERIAL.EMPTY]: 0,
  [MATERIAL.STEAM]: 1,
  [MATERIAL.SMOKE]: 2,
  [MATERIAL.FIRE]: 3,
  [MATERIAL.OIL]: 40,
  [MATERIAL.WATER]: 50,
  [MATERIAL.ACID]: 55,
  [MATERIAL.LAVA]: 100,
  [MATERIAL.SAND]: 80,
  [MATERIAL.SNOW]: 30,
  [MATERIAL.COAL]: 70
};
var VISCOSITY = {
  [MATERIAL.WATER]: 1,
  [MATERIAL.OIL]: 2,
  [MATERIAL.ACID]: 1,
  [MATERIAL.LAVA]: 8
};
var createPalette = () => makePalette(256, 0, [
  [MATERIAL.EMPTY, packRGBA(0, 0, 0, 0)],
  [MATERIAL.SAND, packRGBA(212, 182, 92, 255)],
  [MATERIAL.WATER, packRGBA(40, 100, 210, 200)],
  [MATERIAL.OIL, packRGBA(50, 45, 35, 220)],
  [MATERIAL.ROCK, packRGBA(90, 90, 96, 255)],
  [MATERIAL.WOOD, packRGBA(140, 94, 45, 255)],
  [MATERIAL.FIRE, packRGBA(255, 120, 30, 220)],
  [MATERIAL.SMOKE, packRGBA(110, 110, 110, 120)],
  [MATERIAL.ACID, packRGBA(120, 240, 120, 220)],
  [MATERIAL.STEAM, packRGBA(220, 220, 230, 120)],
  [MATERIAL.GLASS, packRGBA(140, 200, 230, 140)],
  [MATERIAL.CERAMIC, packRGBA(210, 210, 220, 255)],
  [MATERIAL.SILICA, packRGBA(170, 170, 180, 255)],
  [MATERIAL.PLAYER, packRGBA(240, 200, 70, 255)],
  // New biome materials
  [MATERIAL.DIRT, packRGBA(120, 80, 50, 255)],
  [MATERIAL.GRASS, packRGBA(70, 150, 60, 255)],
  [MATERIAL.SNOW, packRGBA(245, 245, 250, 255)],
  [MATERIAL.ICE, packRGBA(180, 220, 250, 255)],
  [MATERIAL.LAVA, packRGBA(255, 90, 0, 255)],
  [MATERIAL.OBSIDIAN, packRGBA(30, 20, 35, 255)],
  [MATERIAL.FUNGUS, packRGBA(180, 120, 200, 255)],
  [MATERIAL.COAL, packRGBA(35, 35, 40, 255)]
]);
var isSolid = (mat) => IS_SOLID[mat] ?? false;
var isFluid = (mat) => IS_FLUID[mat] ?? false;
var isGas = (mat) => IS_GAS[mat] ?? false;
var isAcidResistant = (mat) => IS_ACID_RESISTANT[mat] ?? false;

// examples/browser-noita-like/biomes.ts
var BIOMES = {
  cavern: {
    name: "Stone Caverns",
    type: "cavern",
    terrain: {
      baseMaterial: MATERIAL.ROCK,
      secondaryMaterial: MATERIAL.DIRT,
      surfaceMaterial: MATERIAL.SAND,
      caveFill: MATERIAL.EMPTY,
      caveFrequency: 0.08,
      caveThreshold: 0.58,
      caveOctaves: 4,
      surfaceFrequency: 0.05,
      surfaceVariation: 12
    },
    fluids: {
      primaryFluid: MATERIAL.WATER,
      secondaryFluid: MATERIAL.OIL,
      poolChance: 0.3,
      poolSize: 6
    },
    features: {
      stalactiteChance: 0.08,
      veinChance: 0.02,
      veinMaterial: MATERIAL.COAL,
      platformChance: 0.05,
      platformMaterial: MATERIAL.WOOD
    },
    difficulty: {
      level: 1,
      hazardMultiplier: 1
    }
  },
  desert: {
    name: "Desert Wastes",
    type: "desert",
    terrain: {
      baseMaterial: MATERIAL.SILICA,
      secondaryMaterial: MATERIAL.ROCK,
      surfaceMaterial: MATERIAL.SAND,
      caveFill: MATERIAL.EMPTY,
      caveFrequency: 0.06,
      caveThreshold: 0.65,
      // Fewer caves
      caveOctaves: 3,
      surfaceFrequency: 0.03,
      surfaceVariation: 8
    },
    fluids: {
      primaryFluid: MATERIAL.OIL,
      // Oil instead of water
      secondaryFluid: null,
      poolChance: 0.15,
      poolSize: 5
    },
    features: {
      stalactiteChance: 0.03,
      veinChance: 0.04,
      veinMaterial: MATERIAL.GLASS,
      platformChance: 0.02,
      platformMaterial: MATERIAL.CERAMIC
    },
    difficulty: {
      level: 2,
      hazardMultiplier: 1.2
    }
  },
  frozen: {
    name: "Frozen Depths",
    type: "frozen",
    terrain: {
      baseMaterial: MATERIAL.ICE,
      secondaryMaterial: MATERIAL.ROCK,
      surfaceMaterial: MATERIAL.SNOW,
      caveFill: MATERIAL.EMPTY,
      caveFrequency: 0.07,
      caveThreshold: 0.6,
      caveOctaves: 4,
      surfaceFrequency: 0.04,
      surfaceVariation: 10
    },
    fluids: {
      primaryFluid: MATERIAL.WATER,
      secondaryFluid: null,
      poolChance: 0.25,
      poolSize: 8
    },
    features: {
      stalactiteChance: 0.12,
      // Ice stalactites
      veinChance: 0.01,
      veinMaterial: MATERIAL.SILICA,
      platformChance: 0.03,
      platformMaterial: MATERIAL.ICE
    },
    difficulty: {
      level: 3,
      hazardMultiplier: 0.8
      // Less hazards but slippery
    }
  },
  volcanic: {
    name: "Volcanic Depths",
    type: "volcanic",
    terrain: {
      baseMaterial: MATERIAL.OBSIDIAN,
      secondaryMaterial: MATERIAL.ROCK,
      surfaceMaterial: MATERIAL.COAL,
      caveFill: MATERIAL.EMPTY,
      caveFrequency: 0.09,
      caveThreshold: 0.55,
      caveOctaves: 5,
      surfaceFrequency: 0.06,
      surfaceVariation: 15
    },
    fluids: {
      primaryFluid: MATERIAL.LAVA,
      secondaryFluid: MATERIAL.WATER,
      // Steam interactions!
      poolChance: 0.4,
      poolSize: 7
    },
    features: {
      stalactiteChance: 0.1,
      veinChance: 0.05,
      veinMaterial: MATERIAL.COAL,
      platformChance: 0.04,
      platformMaterial: MATERIAL.ROCK
    },
    difficulty: {
      level: 5,
      hazardMultiplier: 1.8
    }
  },
  fungal: {
    name: "Fungal Caverns",
    type: "fungal",
    terrain: {
      baseMaterial: MATERIAL.DIRT,
      secondaryMaterial: MATERIAL.ROCK,
      surfaceMaterial: MATERIAL.FUNGUS,
      caveFill: MATERIAL.EMPTY,
      caveFrequency: 0.1,
      caveThreshold: 0.52,
      // Many caves
      caveOctaves: 4,
      surfaceFrequency: 0.08,
      surfaceVariation: 14
    },
    fluids: {
      primaryFluid: MATERIAL.WATER,
      secondaryFluid: MATERIAL.ACID,
      poolChance: 0.35,
      poolSize: 5
    },
    features: {
      stalactiteChance: 0.15,
      veinChance: 0.08,
      veinMaterial: MATERIAL.FUNGUS,
      platformChance: 0.08,
      platformMaterial: MATERIAL.WOOD
    },
    difficulty: {
      level: 4,
      hazardMultiplier: 1.4
    }
  },
  flooded: {
    name: "Flooded Caves",
    type: "flooded",
    terrain: {
      baseMaterial: MATERIAL.ROCK,
      secondaryMaterial: MATERIAL.DIRT,
      surfaceMaterial: MATERIAL.SAND,
      caveFill: MATERIAL.WATER,
      // Caves filled with water!
      caveFrequency: 0.07,
      caveThreshold: 0.6,
      caveOctaves: 4,
      surfaceFrequency: 0.04,
      surfaceVariation: 10
    },
    fluids: {
      primaryFluid: MATERIAL.WATER,
      secondaryFluid: null,
      poolChance: 0.6,
      // Many pools
      poolSize: 10
    },
    features: {
      stalactiteChance: 0.06,
      veinChance: 0.02,
      veinMaterial: MATERIAL.CERAMIC,
      platformChance: 0.06,
      platformMaterial: MATERIAL.WOOD
    },
    difficulty: {
      level: 3,
      hazardMultiplier: 1
    }
  },
  toxic: {
    name: "Toxic Depths",
    type: "toxic",
    terrain: {
      baseMaterial: MATERIAL.CERAMIC,
      // Acid resistant
      secondaryMaterial: MATERIAL.GLASS,
      surfaceMaterial: MATERIAL.SILICA,
      caveFill: MATERIAL.EMPTY,
      caveFrequency: 0.08,
      caveThreshold: 0.56,
      caveOctaves: 4,
      surfaceFrequency: 0.05,
      surfaceVariation: 12
    },
    fluids: {
      primaryFluid: MATERIAL.ACID,
      secondaryFluid: MATERIAL.WATER,
      poolChance: 0.45,
      poolSize: 6
    },
    features: {
      stalactiteChance: 0.05,
      veinChance: 0.03,
      veinMaterial: MATERIAL.GLASS,
      platformChance: 0.04,
      platformMaterial: MATERIAL.CERAMIC
    },
    difficulty: {
      level: 6,
      hazardMultiplier: 2
    }
  },
  surface: {
    name: "Surface",
    type: "surface",
    terrain: {
      baseMaterial: MATERIAL.ROCK,
      secondaryMaterial: MATERIAL.DIRT,
      surfaceMaterial: MATERIAL.GRASS,
      caveFill: MATERIAL.EMPTY,
      caveFrequency: 0.05,
      caveThreshold: 0.7,
      // Fewer caves on surface
      caveOctaves: 3,
      surfaceFrequency: 0.03,
      surfaceVariation: 20
      // More rolling hills
    },
    fluids: {
      primaryFluid: MATERIAL.WATER,
      secondaryFluid: null,
      poolChance: 0.2,
      poolSize: 8
    },
    features: {
      stalactiteChance: 0,
      veinChance: 0.01,
      veinMaterial: MATERIAL.COAL,
      platformChance: 0.03,
      platformMaterial: MATERIAL.WOOD
    },
    difficulty: {
      level: 1,
      hazardMultiplier: 0.5
    }
  }
};
function selectBiomeByDepth(depth, seed) {
  const hash = (depth * 127 + seed * 311) % 1e3 / 1e3;
  if (depth < 0.2) {
    return "surface";
  } else if (depth < 0.4) {
    return hash < 0.5 ? "cavern" : "desert";
  } else if (depth < 0.6) {
    return hash < 0.33 ? "frozen" : hash < 0.66 ? "fungal" : "flooded";
  } else if (depth < 0.8) {
    return hash < 0.5 ? "toxic" : "volcanic";
  } else {
    return "volcanic";
  }
}
function getRandomBiome(seed) {
  const types = Object.keys(BIOMES);
  const index2 = Math.abs(seed) % types.length;
  return types[index2];
}

// examples/browser-noita-like/terrain-gen.ts
var noiseCache = /* @__PURE__ */ new Map();
function getNoiseGenerators(seed) {
  if (!noiseCache.has(seed)) {
    noiseCache.set(seed, {
      gradient: new GradientNoise(seed, { octaves: 4, falloff: 0.5 }),
      cellular: new CellularNoise(seed + 1e3, 1),
      rng: new RNG(seed)
    });
  }
  return noiseCache.get(seed);
}
function clearNoiseCache() {
  noiseCache.clear();
}
function applyCellularAutomata(grid2, x0, y0, width, height, solidMaterial, emptyMaterial, iterations = 4, threshold = 5) {
  const temp = new Uint8Array(width * height);
  const getMat2 = (x, y) => {
    if (x < x0 || x >= x0 + width || y < y0 || y >= y0 + height) {
      return solidMaterial;
    }
    return getMaterial(getXY(grid2, x, y));
  };
  const setTemp = (x, y, solid) => {
    const idx = x - x0 + (y - y0) * width;
    temp[idx] = solid ? 1 : 0;
  };
  const getTemp = (x, y) => {
    const idx = x - x0 + (y - y0) * width;
    return temp[idx] === 1;
  };
  for (let iter = 0; iter < iterations; iter++) {
    for (let y = y0; y < y0 + height; y++) {
      for (let x = x0; x < x0 + width; x++) {
        const mat = getMat2(x, y);
        setTemp(x, y, isSolid(mat) || mat === solidMaterial);
      }
    }
    for (let y = y0 + 1; y < y0 + height - 1; y++) {
      for (let x = x0 + 1; x < x0 + width - 1; x++) {
        let solidCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (getTemp(x + dx, y + dy)) solidCount++;
          }
        }
        const shouldBeSolid = solidCount >= threshold;
        const newMat = shouldBeSolid ? solidMaterial : emptyMaterial;
        setXY(grid2, x, y, makeCell(newMat));
        markChunkDirtyByXY(grid2, x, y);
      }
    }
  }
}
function generateSurfaceHeights(width, baseHeight, variation, frequency, seed) {
  const { gradient } = getNoiseGenerators(seed);
  const heights = [];
  for (let x = 0; x < width; x++) {
    const noise = gradient.fbm(x * frequency, 0.1, 3);
    heights.push(Math.floor(baseHeight + noise * variation));
  }
  return heights;
}
function carveCaves(grid2, x0, y0, width, height, biome, seed) {
  const { gradient } = getNoiseGenerators(seed);
  const { terrain } = biome;
  for (let y = y0; y < y0 + height; y++) {
    for (let x = x0; x < x0 + width; x++) {
      const cave = gradient.fbm(
        x * terrain.caveFrequency,
        y * terrain.caveFrequency,
        terrain.caveOctaves
      );
      if (cave > terrain.caveThreshold) {
        setXY(grid2, x, y, makeCell(terrain.caveFill));
        markChunkActiveByXY(grid2, x, y);
        markChunkDirtyByXY(grid2, x, y);
      }
    }
  }
}
function addVeins(grid2, x0, y0, width, height, biome, seed) {
  const { gradient, rng: rng2 } = getNoiseGenerators(seed);
  const { features } = biome;
  if (features.veinChance <= 0) return;
  for (let y = y0; y < y0 + height; y++) {
    for (let x = x0; x < x0 + width; x++) {
      const mat = getMaterial(getXY(grid2, x, y));
      if (!isSolid(mat)) continue;
      const vein = gradient.fbm(x * 0.15, y * 0.15, 3);
      if (vein > 0.75 && rng2.nextFloat01() < features.veinChance * 5) {
        setXY(grid2, x, y, makeCell(features.veinMaterial));
        markChunkDirtyByXY(grid2, x, y);
      }
    }
  }
}
function addStalactites(grid2, x0, y0, width, height, biome, seed) {
  const { rng: rng2 } = getNoiseGenerators(seed);
  const { terrain, features } = biome;
  if (features.stalactiteChance <= 0) return;
  const getMat2 = (x, y) => {
    if (x < x0 || x >= x0 + width || y < y0 || y >= y0 + height) {
      return terrain.baseMaterial;
    }
    return getMaterial(getXY(grid2, x, y));
  };
  for (let y = y0 + 1; y < y0 + height - 1; y++) {
    for (let x = x0 + 1; x < x0 + width - 1; x++) {
      const above = getMat2(x, y - 1);
      const current = getMat2(x, y);
      if (isSolid(above) && current === MATERIAL.EMPTY) {
        if (rng2.nextFloat01() < features.stalactiteChance) {
          const len = 2 + rng2.nextInt(4);
          for (let k = 0; k < len; k++) {
            if (getMat2(x, y + k) === MATERIAL.EMPTY) {
              setXY(grid2, x, y + k, makeCell(terrain.baseMaterial));
              markChunkDirtyByXY(grid2, x, y + k);
            } else {
              break;
            }
          }
        }
      }
      const below = getMat2(x, y + 1);
      if (current === MATERIAL.EMPTY && isSolid(below)) {
        if (rng2.nextFloat01() < features.stalactiteChance * 0.5) {
          const len = 1 + rng2.nextInt(3);
          for (let k = 0; k < len; k++) {
            if (getMat2(x, y - k) === MATERIAL.EMPTY) {
              setXY(grid2, x, y - k, makeCell(terrain.baseMaterial));
              markChunkDirtyByXY(grid2, x, y - k);
            } else {
              break;
            }
          }
        }
      }
    }
  }
}
function addFluidPools(grid2, x0, y0, width, height, biome, seed) {
  const { rng: rng2 } = getNoiseGenerators(seed);
  const { fluids } = biome;
  if (fluids.poolChance <= 0) return;
  const getMat2 = (x, y) => {
    if (x < x0 || x >= x0 + width || y < y0 || y >= y0 + height) {
      return MATERIAL.ROCK;
    }
    return getMaterial(getXY(grid2, x, y));
  };
  for (let attempt = 0; attempt < 10; attempt++) {
    if (rng2.nextFloat01() > fluids.poolChance) continue;
    const px = x0 + rng2.nextInt(width - 4) + 2;
    const py = y0 + rng2.nextInt(height - 4) + 2;
    if (getMat2(px, py) !== MATERIAL.EMPTY) continue;
    if (!isSolid(getMat2(px, py + fluids.poolSize))) continue;
    const fluid = rng2.nextFloat01() < 0.7 || !fluids.secondaryFluid ? fluids.primaryFluid : fluids.secondaryFluid;
    paintCircle(grid2, px, py, fluids.poolSize, makeCell(fluid));
  }
}
function addPlatforms(grid2, x0, y0, width, height, biome, seed) {
  const { rng: rng2 } = getNoiseGenerators(seed);
  const { features } = biome;
  if (features.platformChance <= 0) return;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (rng2.nextFloat01() > features.platformChance) continue;
    const px = x0 + rng2.nextInt(width - 20) + 5;
    const py = y0 + rng2.nextInt(height - 10) + 5;
    const pw = 8 + rng2.nextInt(12);
    const ph = 2 + rng2.nextInt(3);
    let valid = true;
    for (let y = py; y < py + ph && valid; y++) {
      for (let x = px; x < px + pw && valid; x++) {
        if (getMaterial(getXY(grid2, x, y)) !== MATERIAL.EMPTY) {
          valid = false;
        }
      }
    }
    if (valid) {
      paintRect(grid2, px, py, pw, ph, makeCell(features.platformMaterial));
    }
  }
}
function generateWorld(grid2, config) {
  const { width, height, seed, useCellularAutomata = true, caIterations = 4 } = config;
  const biomeType = config.biome ?? "cavern";
  const biome = BIOMES[biomeType];
  const { terrain } = biome;
  paintRect(grid2, 0, 0, width, height, makeCell(terrain.baseMaterial));
  const surfaceHeights = generateSurfaceHeights(
    width,
    height * 0.35,
    terrain.surfaceVariation,
    terrain.surfaceFrequency,
    seed
  );
  for (let x = 0; x < width; x++) {
    const surfaceY = surfaceHeights[x];
    for (let y = 0; y < surfaceY; y++) {
      setXY(grid2, x, y, makeCell(MATERIAL.EMPTY));
    }
    for (let y = surfaceY; y < Math.min(surfaceY + 2, height); y++) {
      setXY(grid2, x, y, makeCell(terrain.surfaceMaterial));
    }
    for (let y = surfaceY + 2; y < Math.min(surfaceY + 5, height); y++) {
      setXY(grid2, x, y, makeCell(terrain.secondaryMaterial));
    }
  }
  carveCaves(grid2, 0, 0, width, height, biome, seed);
  if (useCellularAutomata) {
    applyCellularAutomata(
      grid2,
      1,
      1,
      width - 2,
      height - 2,
      terrain.baseMaterial,
      terrain.caveFill,
      caIterations,
      5
    );
  }
  addVeins(grid2, 0, 0, width, height, biome, seed);
  addStalactites(grid2, 0, 0, width, height, biome, seed);
  addFluidPools(grid2, 0, 0, width, height, biome, seed);
  addPlatforms(grid2, 0, 0, width, height, biome, seed);
  paintRect(grid2, 0, 0, width, 1, makeCell(MATERIAL.ROCK));
  paintRect(grid2, 0, 0, 1, height, makeCell(MATERIAL.ROCK));
  paintRect(grid2, width - 1, 0, 1, height, makeCell(MATERIAL.ROCK));
  paintRect(grid2, 0, height - 1, width, 1, makeCell(MATERIAL.ROCK));
  for (let y = 0; y < height; y += 32) {
    for (let x = 0; x < width; x += 32) {
      markChunkActiveByXY(grid2, x, y);
      markChunkDirtyByXY(grid2, x, y);
    }
  }
}
function generateChunk(grid2, config) {
  const { x: worldChunkX, y: worldChunkY, width, height, seed, biome: biomeType } = config;
  const biome = BIOMES[biomeType];
  const { terrain } = biome;
  const worldPixelX = worldChunkX * width;
  const worldPixelY = worldChunkY * height;
  const gridOffsetX = config.gridOffsetX ?? 0;
  const gridOffsetY = config.gridOffsetY ?? 0;
  const chunkSeed = seed + worldChunkX * 1e3 + worldChunkY;
  for (let ly = 0; ly < height; ly++) {
    for (let lx = 0; lx < width; lx++) {
      const gx = gridOffsetX + lx;
      const gy = gridOffsetY + ly;
      if (gx < 0 || gx >= grid2.width || gy < 0 || gy >= grid2.height) continue;
      setXY(grid2, gx, gy, makeCell(terrain.baseMaterial));
    }
  }
  const { gradient } = getNoiseGenerators(seed);
  for (let ly = 0; ly < height; ly++) {
    for (let lx = 0; lx < width; lx++) {
      const gx = gridOffsetX + lx;
      const gy = gridOffsetY + ly;
      if (gx < 0 || gx >= grid2.width || gy < 0 || gy >= grid2.height) continue;
      const noiseX = worldPixelX + lx;
      const noiseY = worldPixelY + ly;
      const cave = gradient.fbm(
        noiseX * terrain.caveFrequency,
        noiseY * terrain.caveFrequency,
        terrain.caveOctaves
      );
      if (cave > terrain.caveThreshold) {
        setXY(grid2, gx, gy, makeCell(terrain.caveFill));
      }
    }
  }
  const localRng = new RNG(chunkSeed);
  addVeinsToChunk(grid2, gridOffsetX, gridOffsetY, worldPixelX, worldPixelY, width, height, biome, chunkSeed);
  addStalactitesToChunk(grid2, gridOffsetX, gridOffsetY, width, height, biome, chunkSeed);
  if (localRng.nextFloat01() < biome.fluids.poolChance * 0.5) {
    addFluidPoolsToChunk(grid2, gridOffsetX, gridOffsetY, width, height, biome, chunkSeed);
  }
  for (let ly = 0; ly < height; ly += 32) {
    for (let lx = 0; lx < width; lx += 32) {
      const gx = gridOffsetX + lx;
      const gy = gridOffsetY + ly;
      if (gx >= 0 && gx < grid2.width && gy >= 0 && gy < grid2.height) {
        markChunkActiveByXY(grid2, gx, gy);
        markChunkDirtyByXY(grid2, gx, gy);
      }
    }
  }
}
function addVeinsToChunk(grid2, gridOffsetX, gridOffsetY, worldOffsetX, worldOffsetY, width, height, biome, chunkSeed) {
  const { gradient } = getNoiseGenerators(chunkSeed);
  const localRng = new RNG(chunkSeed + 100);
  const { features } = biome;
  if (features.veinChance <= 0) return;
  for (let ly = 0; ly < height; ly++) {
    for (let lx = 0; lx < width; lx++) {
      const gx = gridOffsetX + lx;
      const gy = gridOffsetY + ly;
      if (gx < 0 || gx >= grid2.width || gy < 0 || gy >= grid2.height) continue;
      const mat = getMaterial(getXY(grid2, gx, gy));
      if (!isSolid(mat)) continue;
      const noiseX = worldOffsetX + lx;
      const noiseY = worldOffsetY + ly;
      const vein = gradient.fbm(noiseX * 0.15, noiseY * 0.15, 3);
      if (vein > 0.75 && localRng.nextFloat01() < features.veinChance * 5) {
        setXY(grid2, gx, gy, makeCell(features.veinMaterial));
        markChunkDirtyByXY(grid2, gx, gy);
      }
    }
  }
}
function addStalactitesToChunk(grid2, gridOffsetX, gridOffsetY, width, height, biome, chunkSeed) {
  const localRng = new RNG(chunkSeed + 200);
  const { terrain, features } = biome;
  if (features.stalactiteChance <= 0) return;
  const getMat2 = (lx, ly) => {
    const gx = gridOffsetX + lx;
    const gy = gridOffsetY + ly;
    if (gx < 0 || gx >= grid2.width || gy < 0 || gy >= grid2.height) {
      return terrain.baseMaterial;
    }
    return getMaterial(getXY(grid2, gx, gy));
  };
  for (let ly = 1; ly < height - 1; ly++) {
    for (let lx = 1; lx < width - 1; lx++) {
      const above = getMat2(lx, ly - 1);
      const current = getMat2(lx, ly);
      if (isSolid(above) && current === MATERIAL.EMPTY) {
        if (localRng.nextFloat01() < features.stalactiteChance) {
          const len = 2 + localRng.nextInt(4);
          for (let k = 0; k < len; k++) {
            if (getMat2(lx, ly + k) === MATERIAL.EMPTY) {
              const gx = gridOffsetX + lx;
              const gy = gridOffsetY + ly + k;
              if (gx >= 0 && gx < grid2.width && gy >= 0 && gy < grid2.height) {
                setXY(grid2, gx, gy, makeCell(terrain.baseMaterial));
                markChunkDirtyByXY(grid2, gx, gy);
              }
            } else {
              break;
            }
          }
        }
      }
    }
  }
}
function addFluidPoolsToChunk(grid2, gridOffsetX, gridOffsetY, width, height, biome, chunkSeed) {
  const localRng = new RNG(chunkSeed + 300);
  const { fluids } = biome;
  if (fluids.poolChance <= 0) return;
  const getMat2 = (lx, ly) => {
    const gx = gridOffsetX + lx;
    const gy = gridOffsetY + ly;
    if (gx < 0 || gx >= grid2.width || gy < 0 || gy >= grid2.height) {
      return MATERIAL.ROCK;
    }
    return getMaterial(getXY(grid2, gx, gy));
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    if (localRng.nextFloat01() > fluids.poolChance) continue;
    const lx = localRng.nextInt(width - 4) + 2;
    const ly = localRng.nextInt(height - 4) + 2;
    if (getMat2(lx, ly) !== MATERIAL.EMPTY) continue;
    if (!isSolid(getMat2(lx, ly + fluids.poolSize))) continue;
    const fluid = localRng.nextFloat01() < 0.7 || !fluids.secondaryFluid ? fluids.primaryFluid : fluids.secondaryFluid;
    const radius = Math.min(fluids.poolSize, 4);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const gx = gridOffsetX + lx + dx;
          const gy = gridOffsetY + ly + dy;
          if (gx >= 0 && gx < grid2.width && gy >= 0 && gy < grid2.height) {
            if (getMaterial(getXY(grid2, gx, gy)) === MATERIAL.EMPTY) {
              setXY(grid2, gx, gy, makeCell(fluid));
              markChunkDirtyByXY(grid2, gx, gy);
            }
          }
        }
      }
    }
  }
}
function selectChunkBiome(chunkX, chunkY, seed) {
  const { cellular } = getNoiseGenerators(seed);
  const sample = cellular.sample(chunkX * 0.3, chunkY * 0.3);
  const depth = chunkY / 10;
  return selectBiomeByDepth(depth, Math.floor(sample.cellId));
}

// examples/browser-noita-like/chunk-manager.ts
var ChunkManager = class {
  grid;
  config;
  /** Tracks which world chunks have been generated */
  generatedChunks = /* @__PURE__ */ new Map();
  /** Current world origin - which world chunk is at grid position (0,0) */
  worldOriginChunkX = 0;
  worldOriginChunkY = 0;
  /** Player's position in world chunk coordinates */
  playerWorldChunkX = 0;
  playerWorldChunkY = 0;
  /** Frame counter for LRU tracking */
  frameCount = 0;
  constructor(grid2, config) {
    this.grid = grid2;
    this.config = config;
    const gridChunksX = Math.floor(grid2.width / config.chunkSize);
    const gridChunksY = Math.floor(grid2.height / config.chunkSize);
    this.worldOriginChunkX = -Math.floor(gridChunksX / 2);
    this.worldOriginChunkY = -Math.floor(gridChunksY / 2);
  }
  // ==========================================================================
  // COORDINATE CONVERSION
  // ==========================================================================
  /** Get chunk key for Map storage */
  getChunkKey(worldChunkX, worldChunkY) {
    return `${worldChunkX},${worldChunkY}`;
  }
  /** Convert world position (pixels) to world chunk coordinates */
  worldPosToWorldChunk(worldX, worldY) {
    return {
      cx: Math.floor(worldX / this.config.chunkSize),
      cy: Math.floor(worldY / this.config.chunkSize)
    };
  }
  /** Convert grid position to world chunk coordinates */
  gridPosToWorldChunk(gridX, gridY) {
    const gridChunkX = Math.floor(gridX / this.config.chunkSize);
    const gridChunkY = Math.floor(gridY / this.config.chunkSize);
    return {
      cx: this.worldOriginChunkX + gridChunkX,
      cy: this.worldOriginChunkY + gridChunkY
    };
  }
  /** Convert world chunk to grid chunk coordinates */
  worldChunkToGridChunk(worldChunkX, worldChunkY) {
    return {
      gx: worldChunkX - this.worldOriginChunkX,
      gy: worldChunkY - this.worldOriginChunkY
    };
  }
  /** Convert world chunk to grid pixel position (top-left of chunk) */
  worldChunkToGridPos(worldChunkX, worldChunkY) {
    const { gx, gy } = this.worldChunkToGridChunk(worldChunkX, worldChunkY);
    return {
      x: gx * this.config.chunkSize,
      y: gy * this.config.chunkSize
    };
  }
  /** Check if a world chunk maps to a valid grid position */
  isWorldChunkInGrid(worldChunkX, worldChunkY) {
    const { x, y } = this.worldChunkToGridPos(worldChunkX, worldChunkY);
    const { chunkSize } = this.config;
    return x >= 0 && x + chunkSize <= this.grid.width && y >= 0 && y + chunkSize <= this.grid.height;
  }
  // ==========================================================================
  // CHUNK GENERATION
  // ==========================================================================
  /** Regenerate a chunk at a specific grid position from world coordinates */
  regenerateChunkAt(gridChunkX, gridChunkY) {
    const worldChunkX = this.worldOriginChunkX + gridChunkX;
    const worldChunkY = this.worldOriginChunkY + gridChunkY;
    const biome = selectChunkBiome(worldChunkX, worldChunkY, this.config.seed);
    const gridX = gridChunkX * this.config.chunkSize;
    const gridY = gridChunkY * this.config.chunkSize;
    generateChunk(this.grid, {
      x: worldChunkX,
      y: worldChunkY,
      width: this.config.chunkSize,
      height: this.config.chunkSize,
      seed: this.config.seed,
      biome,
      gridOffsetX: gridX,
      gridOffsetY: gridY
    });
    markChunkActiveByXY(this.grid, gridX, gridY);
    markChunkDirtyByXY(this.grid, gridX, gridY);
  }
  // ==========================================================================
  // GRID SHIFTING (FLOATING ORIGIN)
  // ==========================================================================
  /**
   * Shift grid contents by one chunk in the specified direction
   * This implements the "floating origin" pattern for infinite worlds
   */
  shiftGrid(directionX, directionY) {
    const { chunkSize } = this.config;
    const { width, height, cells } = this.grid;
    if (directionX !== 0) {
      if (directionX > 0) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width - chunkSize; x++) {
            const srcIdx = y * width + (x + chunkSize);
            const dstIdx = y * width + x;
            cells[dstIdx] = cells[srcIdx];
          }
          for (let x = width - chunkSize; x < width; x++) {
            const idx = y * width + x;
            cells[idx] = makeCell(MATERIAL.ROCK);
          }
        }
        this.worldOriginChunkX += 1;
      } else {
        for (let y = 0; y < height; y++) {
          for (let x = width - 1; x >= chunkSize; x--) {
            const srcIdx = y * width + (x - chunkSize);
            const dstIdx = y * width + x;
            cells[dstIdx] = cells[srcIdx];
          }
          for (let x = 0; x < chunkSize; x++) {
            const idx = y * width + x;
            cells[idx] = makeCell(MATERIAL.ROCK);
          }
        }
        this.worldOriginChunkX -= 1;
      }
    }
    if (directionY !== 0) {
      if (directionY > 0) {
        for (let y = 0; y < height - chunkSize; y++) {
          for (let x = 0; x < width; x++) {
            const srcIdx = (y + chunkSize) * width + x;
            const dstIdx = y * width + x;
            cells[dstIdx] = cells[srcIdx];
          }
        }
        for (let y = height - chunkSize; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            cells[idx] = makeCell(MATERIAL.ROCK);
          }
        }
        this.worldOriginChunkY += 1;
      } else {
        for (let y = height - 1; y >= chunkSize; y--) {
          for (let x = 0; x < width; x++) {
            const srcIdx = (y - chunkSize) * width + x;
            const dstIdx = y * width + x;
            cells[dstIdx] = cells[srcIdx];
          }
        }
        for (let y = 0; y < chunkSize; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            cells[idx] = makeCell(MATERIAL.ROCK);
          }
        }
        this.worldOriginChunkY -= 1;
      }
    }
  }
  /**
   * Generate new chunks for the edges exposed by a shift
   */
  generateEdgeChunks(directionX, directionY) {
    const gridChunksX = Math.floor(this.grid.width / this.config.chunkSize);
    const gridChunksY = Math.floor(this.grid.height / this.config.chunkSize);
    if (directionX > 0) {
      const gx = gridChunksX - 1;
      for (let gy = 0; gy < gridChunksY; gy++) {
        this.regenerateChunkAt(gx, gy);
      }
    } else if (directionX < 0) {
      for (let gy = 0; gy < gridChunksY; gy++) {
        this.regenerateChunkAt(0, gy);
      }
    }
    if (directionY > 0) {
      const gy = gridChunksY - 1;
      for (let gx = 0; gx < gridChunksX; gx++) {
        this.regenerateChunkAt(gx, gy);
      }
    } else if (directionY < 0) {
      for (let gx = 0; gx < gridChunksX; gx++) {
        this.regenerateChunkAt(gx, 0);
      }
    }
  }
  // ==========================================================================
  // MAIN UPDATE
  // ==========================================================================
  /**
   * Update chunk loading based on player grid position
   * Returns info about any grid shift that occurred
   */
  update(playerGridX, playerGridY) {
    this.frameCount++;
    const { chunkSize, scrollDirection } = this.config;
    const result = { shifted: false, deltaX: 0, deltaY: 0 };
    const gridChunksX = Math.floor(this.grid.width / chunkSize);
    const gridChunksY = Math.floor(this.grid.height / chunkSize);
    const playerGridChunkX = Math.floor(playerGridX / chunkSize);
    const playerGridChunkY = Math.floor(playerGridY / chunkSize);
    const centerGridChunkX = Math.floor(gridChunksX / 2);
    const centerGridChunkY = Math.floor(gridChunksY / 2);
    let shiftX = 0;
    let shiftY = 0;
    if (scrollDirection === "horizontal" || scrollDirection === "both") {
      const chunkDistX = playerGridChunkX - centerGridChunkX;
      if (chunkDistX > 0) {
        shiftX = 1;
      } else if (chunkDistX < -1) {
        shiftX = -1;
      }
    }
    if (scrollDirection === "vertical" || scrollDirection === "both") {
      const chunkDistY = playerGridChunkY - centerGridChunkY;
      if (chunkDistY > 0) {
        shiftY = 1;
      } else if (chunkDistY < -1) {
        shiftY = -1;
      }
    }
    if (shiftX !== 0 || shiftY !== 0) {
      if (shiftX !== 0) {
        this.shiftGrid(shiftX, 0);
        this.generateEdgeChunks(shiftX, 0);
        result.deltaX = shiftX * chunkSize;
      }
      if (shiftY !== 0) {
        this.shiftGrid(0, shiftY);
        this.generateEdgeChunks(0, shiftY);
        result.deltaY = shiftY * chunkSize;
      }
      result.shifted = true;
      for (let y = 0; y < this.grid.height; y += chunkSize) {
        for (let x = 0; x < this.grid.width; x += chunkSize) {
          markChunkActiveByXY(this.grid, x, y);
          markChunkDirtyByXY(this.grid, x, y);
        }
      }
    }
    this.playerWorldChunkX = this.worldOriginChunkX + playerGridChunkX;
    this.playerWorldChunkY = this.worldOriginChunkY + playerGridChunkY;
    return result;
  }
  // ==========================================================================
  // PUBLIC GETTERS
  // ==========================================================================
  /** Get the world origin offset in pixels */
  getWorldOrigin() {
    return {
      x: this.worldOriginChunkX * this.config.chunkSize,
      y: this.worldOriginChunkY * this.config.chunkSize
    };
  }
  /** Get debug info */
  getDebugInfo() {
    const gridChunksX = Math.floor(this.grid.width / this.config.chunkSize);
    const gridChunksY = Math.floor(this.grid.height / this.config.chunkSize);
    return {
      loadedChunks: this.generatedChunks.size,
      playerWorldChunk: `${this.playerWorldChunkX},${this.playerWorldChunkY}`,
      worldOrigin: `${this.worldOriginChunkX},${this.worldOriginChunkY}`,
      gridChunks: `${gridChunksX}x${gridChunksY}`
    };
  }
  /** Get the biome at a grid position */
  getBiomeAtGrid(gridX, gridY) {
    const { cx, cy } = this.gridPosToWorldChunk(gridX, gridY);
    return selectChunkBiome(cx, cy, this.config.seed);
  }
  /** Get player's position in world coordinates */
  getPlayerWorldPos(playerGridX, playerGridY) {
    const origin = this.getWorldOrigin();
    return {
      worldX: origin.x + playerGridX,
      worldY: origin.y + playerGridY
    };
  }
  /** Convert world position to grid position */
  worldToGrid(worldX, worldY) {
    const origin = this.getWorldOrigin();
    return {
      gridX: worldX - origin.x,
      gridY: worldY - origin.y
    };
  }
  /** Reset the chunk manager (new world) */
  reset(newSeed) {
    this.generatedChunks.clear();
    this.frameCount = 0;
    const gridChunksX = Math.floor(this.grid.width / this.config.chunkSize);
    const gridChunksY = Math.floor(this.grid.height / this.config.chunkSize);
    this.worldOriginChunkX = -Math.floor(gridChunksX / 2);
    this.worldOriginChunkY = -Math.floor(gridChunksY / 2);
    if (newSeed !== void 0) {
      this.config.seed = newSeed;
    }
    clearNoiseCache();
  }
  /** Pre-generate the initial world */
  pregenerate() {
    const gridChunksX = Math.floor(this.grid.width / this.config.chunkSize);
    const gridChunksY = Math.floor(this.grid.height / this.config.chunkSize);
    for (let gy = 0; gy < gridChunksY; gy++) {
      for (let gx = 0; gx < gridChunksX; gx++) {
        this.regenerateChunkAt(gx, gy);
      }
    }
  }
};
function createChunkManager(grid2, seed, options) {
  const config = {
    seed,
    chunkSize: options?.chunkSize ?? 32,
    loadRadius: options?.loadRadius ?? 3,
    unloadRadius: options?.unloadRadius ?? 5,
    scrollDirection: options?.scrollDirection ?? "horizontal"
  };
  return new ChunkManager(grid2, config);
}

// examples/browser-noita-like/camera.ts
function createCamera(config) {
  return {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    velX: 0,
    velY: 0,
    worldOriginX: 0,
    worldOriginY: 0,
    viewWidth: config.viewWidth,
    viewHeight: config.viewHeight,
    deadZone: config.deadZone ?? 4,
    stiffness: config.stiffness ?? 0.08,
    damping: config.damping ?? 0.75,
    zoom: config.zoom ?? 1
  };
}
function screenToWorld(camera2, screenX, screenY) {
  return {
    worldX: screenX + camera2.x,
    worldY: screenY + camera2.y
  };
}
function worldToGrid(camera2, worldX, worldY) {
  return {
    gridX: worldX - camera2.worldOriginX,
    gridY: worldY - camera2.worldOriginY
  };
}
function screenToGrid(camera2, screenX, screenY) {
  const { worldX, worldY } = screenToWorld(camera2, screenX, screenY);
  return worldToGrid(camera2, worldX, worldY);
}
var CAMERA_SNAP_THRESHOLD = 0.5;
var CAMERA_MIN_VELOCITY = 0.01;
function updateCamera(camera2, targetWorldX, targetWorldY) {
  const desiredX = targetWorldX - camera2.viewWidth * 0.5;
  const desiredY = targetWorldY - camera2.viewHeight * 0.5;
  const dx = desiredX - camera2.x;
  const dy = desiredY - camera2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= camera2.deadZone) {
    camera2.velX *= camera2.damping * 0.5;
    camera2.velY *= camera2.damping * 0.5;
  } else {
    const effectiveDx = dx - dx / distance * camera2.deadZone;
    const effectiveDy = dy - dy / distance * camera2.deadZone;
    camera2.velX = camera2.velX * camera2.damping + effectiveDx * camera2.stiffness;
    camera2.velY = camera2.velY * camera2.damping + effectiveDy * camera2.stiffness;
  }
  if (Math.abs(camera2.velX) < CAMERA_MIN_VELOCITY) camera2.velX = 0;
  if (Math.abs(camera2.velY) < CAMERA_MIN_VELOCITY) camera2.velY = 0;
  camera2.x += camera2.velX;
  camera2.y += camera2.velY;
  const newDx = desiredX - camera2.x;
  const newDy = desiredY - camera2.y;
  if (Math.abs(newDx) < CAMERA_SNAP_THRESHOLD || dx * newDx < 0) {
    camera2.x = desiredX;
    camera2.velX = 0;
  }
  if (Math.abs(newDy) < CAMERA_SNAP_THRESHOLD || dy * newDy < 0) {
    camera2.y = desiredY;
    camera2.velY = 0;
  }
}
function snapCamera(camera2, targetWorldX, targetWorldY) {
  camera2.x = targetWorldX - camera2.viewWidth * 0.5;
  camera2.y = targetWorldY - camera2.viewHeight * 0.5;
  camera2.targetX = camera2.x;
  camera2.targetY = camera2.y;
}

// examples/browser-noita-like/sprite.ts
var PALETTE = [
  [0, 0, 0, 0],
  // 0 - transparente
  [24, 20, 37, 255],
  // 1 - contorno (preto)
  [78, 52, 146, 255],
  // 2 - chapéu (roxo)
  [136, 84, 208, 255],
  // 3 - roupa (roxo claro)
  [255, 226, 177, 255],
  // 4 - rosto/mão (pele)
  [245, 190, 70, 255],
  // 5 - detalhe dourado
  [255, 255, 255, 255],
  // 6 - olhos/brilho
  [255, 0, 0, 255],
  // 7 - dano (vermelho)
  [0, 255, 0, 255],
  // 8 - item pickup (verde)
  [255, 255, 0, 255]
  // 9 - partícula (amarelo)
];
var particles = [];
function spawnParticle(x, y, colorIndex = 9, speed = 1, life = 20) {
  particles.push({
    x,
    y,
    vx: (Math.random() - 0.5) * speed,
    vy: (Math.random() - 0.5) * speed,
    life,
    maxLife: life,
    colorIndex
  });
}
function updateParticles() {
  for (let p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.life--;
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    if (particles[i].life <= 0) particles.splice(i, 1);
  }
}
function renderParticles(ctx2) {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    const [r, g, b] = PALETTE[p.colorIndex];
    ctx2.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
    ctx2.fillRect(p.x, p.y, 1, 1);
  }
}
var spriteFlashTicks = 0;
var WIZARD_SPRITE_FRAMES = {
  idle: {
    right: [
      new Uint8Array([
        0,
        0,
        0,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        1,
        4,
        4,
        4,
        6,
        0,
        4,
        4,
        0,
        6,
        4,
        4,
        4,
        1,
        0,
        0,
        1,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        5,
        3,
        3,
        5,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        0,
        0,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ])
    ]
  },
  walk: {
    right: [
      new Uint8Array([
        0,
        0,
        0,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        1,
        4,
        4,
        4,
        6,
        0,
        4,
        4,
        0,
        6,
        4,
        4,
        4,
        1,
        0,
        0,
        1,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        5,
        3,
        3,
        3,
        3,
        5,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        0,
        0,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]),
      new Uint8Array([
        0,
        0,
        0,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        1,
        4,
        4,
        4,
        6,
        0,
        4,
        4,
        0,
        6,
        4,
        4,
        4,
        1,
        0,
        0,
        1,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        5,
        3,
        3,
        3,
        3,
        5,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        0,
        0,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ])
    ]
  },
  fly: {
    right: [
      new Uint8Array([
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        1,
        4,
        4,
        6,
        0,
        4,
        4,
        0,
        6,
        4,
        4,
        4,
        4,
        1,
        0,
        0,
        1,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        5,
        3,
        3,
        5,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ])
    ]
  },
  jump: {
    right: [
      new Uint8Array([
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        1,
        4,
        4,
        4,
        0,
        0,
        6,
        6,
        0,
        0,
        4,
        4,
        4,
        1,
        0,
        0,
        1,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        5,
        3,
        3,
        3,
        3,
        5,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ])
    ]
  },
  hurt: {
    right: [
      new Uint8Array(Array(256).fill(7))
      // quadrado vermelho
    ]
  },
  dead: {
    right: [
      new Uint8Array([
        0,
        0,
        0,
        0,
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        3,
        3,
        3,
        1,
        1,
        3,
        3,
        3,
        1,
        0,
        0,
        0,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        1,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        1,
        0,
        0,
        1,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        1,
        0,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ])
    ]
  },
  pickup: {
    right: [
      new Uint8Array([
        0,
        0,
        0,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        0,
        1,
        4,
        4,
        4,
        8,
        0,
        4,
        4,
        0,
        8,
        4,
        4,
        4,
        1,
        0,
        0,
        1,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        5,
        3,
        3,
        5,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        1,
        0,
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        0,
        0,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ])
    ]
  }
};
function drawSprite(ctx2, x, y, sprite, palette2 = PALETTE, flipHorizontally = false) {
  const size = 16;
  const imageData = ctx2.createImageData(size, size);
  const useFlash = spriteFlashTicks > 0;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const srcCol = flipHorizontally ? size - 1 - col : col;
      const srcIdx = row * size + srcCol;
      const dstIdx = row * size + col;
      const colorIndex = useFlash ? 6 : sprite[srcIdx];
      const [r, g, b, a] = palette2[colorIndex];
      imageData.data[dstIdx * 4 + 0] = r;
      imageData.data[dstIdx * 4 + 1] = g;
      imageData.data[dstIdx * 4 + 2] = b;
      imageData.data[dstIdx * 4 + 3] = a;
    }
  }
  ctx2.putImageData(imageData, Math.round(x), Math.round(y));
  if (spriteFlashTicks > 0) spriteFlashTicks--;
}
function drawAnimatedSprite(ctx2, x, y, frames2, tick2, palette2 = PALETTE, flip = false) {
  const frame = frames2[Math.floor(tick2 / 10) % frames2.length];
  drawSprite(ctx2, x, y, frame, palette2, flip);
}

// examples/browser-noita-like/index.ts
var W = 160;
var H = 120;
var CHUNK_SIZE = 32;
var currentSeed = 1337;
var currentBiome = "cavern";
var infiniteMode = false;
var chunkManager = null;
var camera = createCamera({ viewWidth: W, viewHeight: H, deadZone: 4, stiffness: 0.08, damping: 0.75 });
var palette = createPalette();
var grid = createGrid2D(W, H, { chunkSize: CHUNK_SIZE });
var surface = createSurface2D(W, H);
var rng = new RNG(currentSeed);
var canvas = document.getElementById("c");
var ctx = canvas.getContext("2d");
if (!ctx) throw new Error("no ctx");
var fpsEl = document.getElementById("fps");
var statusEl = document.getElementById("status");
var biomeEl = document.getElementById("biome-display");
var input = {
  left: false,
  right: false,
  jump: false,
  fly: false,
  // Flight key (W)
  mouseX: 0,
  // Screen coordinates
  mouseY: 0,
  mouseGridX: 0,
  // Grid coordinates (for infinite mode)
  mouseGridY: 0,
  mouseLeft: false,
  mouseRight: false,
  mode: "wand",
  brushMat: MATERIAL.SAND,
  brushSize: 4
};
var PLAYER_ACCEL = 0.35;
var PLAYER_MAX_SPEED = 1.8;
var PLAYER_FRICTION = 0.82;
var PLAYER_AIR_FRICTION = 0.92;
var PLAYER_GRAVITY = 0.28;
var PLAYER_JUMP_FORCE = 3.8;
var PLAYER_MAX_FALL = 5;
var PLAYER_COYOTE_TIME = 6;
var PLAYER_FLY_FORCE = 0.45;
var PLAYER_MAX_AIR_TIME = 120;
var player = {
  x: Math.floor(W * 0.5),
  y: Math.floor(H * 0.35),
  width: 2,
  height: 3,
  vx: 0,
  // Horizontal velocity
  vy: 0,
  onGround: false,
  facingRight: true,
  // For projectile origin
  coyoteCounter: 0,
  // Frames since leaving ground
  wasOnGround: false,
  // Previous frame ground state
  airTime: 0
  // Flight time counter
};
var animationTick = 0;
var projectiles = [];
var wands = createWands(MATERIAL);
var activeWandIndex = 0;
var wandCooldown = 0;
var lightR = new Float32Array(W * H);
var lightG = new Float32Array(W * H);
var lightB = new Float32Array(W * H);
var inBounds2 = (x, y) => x >= 1 && x < W - 1 && y >= 1 && y < H - 1;
var getMat = (x, y) => {
  if (x < 0 || x >= W || y < 0 || y >= H) return MATERIAL.ROCK;
  return getMaterial(getXY(grid, x, y));
};
var setMat = (x, y, mat) => {
  if (!inBounds2(x, y)) return;
  setXY(grid, x, y, makeCell(mat));
  markChunkActiveByXY(grid, x, y);
  markChunkDirtyByXY(grid, x, y);
};
var addLight = (lx, ly, radius, intensity, tint) => {
  const r2 = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    const y = ly + dy;
    if (y < 0 || y >= H) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      const x = lx + dx;
      if (x < 0 || x >= W) continue;
      const dist2 = dx * dx + dy * dy;
      if (dist2 > r2) continue;
      const falloff = 1 - Math.sqrt(dist2) / radius;
      const idx = y * W + x;
      const boost = falloff * intensity;
      lightR[idx] += boost * tint[0];
      lightG[idx] += boost * tint[1];
      lightB[idx] += boost * tint[2];
    }
  }
};
var findSpawnLocation = (x0, y0, radius = 15) => {
  for (let dx = 0; dx <= radius; dx++) {
    for (const sign of [1, -1]) {
      if (dx === 0 && sign === -1) continue;
      const x = x0 + dx * sign;
      if (x < 0 || x >= W - player.width) continue;
      for (let y = Math.max(0, y0 - 20); y < H - player.height - 1; y++) {
        let canFit = true;
        for (let py = 0; py < player.height && canFit; py++) {
          for (let px = 0; px < player.width && canFit; px++) {
            const mat = getMat(x + px, y + py);
            if (mat !== MATERIAL.EMPTY && !isGas(mat)) {
              canFit = false;
            }
          }
        }
        if (canFit) {
          let hasSolidBelow = false;
          for (let px = 0; px < player.width; px++) {
            const matBelow = getMat(x + px, y + player.height);
            if (isSolid(matBelow)) {
              hasSolidBelow = true;
              break;
            }
          }
          if (hasSolidBelow) {
            return { x, y };
          }
        }
      }
    }
  }
  return { x: x0, y: Math.min(y0, Math.floor(H * 0.2)) };
};
var regenerateWorld = (seed, biome) => {
  if (seed !== void 0) currentSeed = seed;
  if (biome !== void 0) currentBiome = biome;
  rng = new RNG(currentSeed);
  clearNoiseCache();
  const actualBiome = currentBiome === "random" ? getRandomBiome(currentSeed) : currentBiome;
  projectiles.length = 0;
  generateWorld(grid, {
    width: W,
    height: H,
    seed: currentSeed,
    biome: actualBiome,
    useCellularAutomata: true,
    caIterations: 4
  });
  const spawn = findSpawnLocation(Math.floor(W * 0.5), Math.floor(H * 0.35));
  player.x = spawn.x;
  player.y = spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.airTime = 0;
  if (biomeEl) {
    const biomeName = BIOMES[actualBiome]?.name ?? actualBiome;
    biomeEl.textContent = `Biome: ${biomeName}`;
  }
  console.log(`Generated world: seed=${currentSeed}, biome=${actualBiome}`);
};
var toggleInfiniteMode = () => {
  infiniteMode = !infiniteMode;
  if (infiniteMode) {
    chunkManager = createChunkManager(grid, currentSeed, {
      chunkSize: CHUNK_SIZE,
      loadRadius: 3,
      unloadRadius: 5,
      scrollDirection: "both"
      // Allow vertical too for full freedom
    });
    camera = createCamera({ viewWidth: W, viewHeight: H, deadZone: 4, stiffness: 0.08, damping: 0.75 });
    chunkManager.pregenerate();
    snapCamera(camera, player.x, player.y);
    console.log("Infinite mode enabled");
  } else {
    chunkManager = null;
    camera = createCamera({ viewWidth: W, viewHeight: H, deadZone: 4, stiffness: 0.08, damping: 0.75 });
    regenerateWorld();
    console.log("Infinite mode disabled");
  }
  const btn = document.getElementById("btn-infinite");
  if (btn) {
    btn.textContent = infiniteMode ? "\u{1F532} Fixed Mode" : "\u221E Infinite Mode";
  }
};
regenerateWorld();
var computeLights = () => {
  const baseR = 0.18;
  const baseG = 0.2;
  const baseB = 0.24;
  for (let i = 0; i < lightR.length; i++) {
    lightR[i] = baseR;
    lightG[i] = baseG;
    lightB[i] = baseB;
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const mat = getMat(x, y);
      if (mat === MATERIAL.FIRE) {
        addLight(x, y, 7, 1.1, [1.4, 0.85, 0.45]);
      } else if (mat === MATERIAL.ACID) {
        addLight(x, y, 6, 0.9, [0.45, 1.2, 0.5]);
      } else if (mat === MATERIAL.WATER) {
        addLight(x, y, 5, 0.6, [0.4, 0.6, 1.2]);
      }
    }
  }
  for (const projectile of projectiles) {
    const px = Math.round(projectile.x);
    const py = Math.round(projectile.y);
    if (projectile.payload === MATERIAL.ACID) {
      addLight(px, py, 5, 0.8, [0.45, 1.2, 0.5]);
    } else if (projectile.payload === MATERIAL.WATER) {
      addLight(px, py, 4, 0.5, [0.4, 0.6, 1.2]);
    } else if (projectile.payload === MATERIAL.OIL) {
      addLight(px, py, 4, 0.4, [1.1, 0.8, 0.4]);
    } else if (projectile.payload === MATERIAL.FIRE) {
      addLight(px, py, 6, 1, [1.4, 0.85, 0.45]);
    }
  }
  addLight(player.x + 1, player.y + 1, 5, 0.8, [1.1, 0.9, 0.6]);
};
var canSwapInto = (mat, allowFluid = false) => {
  if (mat === MATERIAL.EMPTY) return true;
  if (isGas(mat)) return true;
  if (allowFluid && isFluid(mat)) return true;
  return false;
};
var trySwap = (x1, y1, x2, y2, allowFluid = false) => {
  if (!inBounds2(x2, y2)) return false;
  const a = getXY(grid, x1, y1);
  const b = getXY(grid, x2, y2);
  if (!canSwapInto(getMaterial(b), allowFluid)) return false;
  setXY(grid, x2, y2, a);
  setXY(grid, x1, y1, makeCell(MATERIAL.EMPTY));
  markChunkActiveByXY(grid, x1, y1);
  markChunkActiveByXY(grid, x2, y2);
  markChunkDirtyByXY(grid, x1, y1);
  markChunkDirtyByXY(grid, x2, y2);
  return true;
};
var swap = (x1, y1, x2, y2) => {
  const a = getXY(grid, x1, y1);
  const b = getXY(grid, x2, y2);
  setXY(grid, x1, y1, b);
  setXY(grid, x2, y2, a);
  markChunkActiveByXY(grid, x1, y1);
  markChunkActiveByXY(grid, x2, y2);
  markChunkDirtyByXY(grid, x1, y1);
  markChunkDirtyByXY(grid, x2, y2);
};
var stepSand = (x, y) => {
  if (trySwap(x, y, x, y + 1, true)) return;
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (trySwap(x, y, x + dir, y + 1, true)) return;
  trySwap(x, y, x - dir, y + 1, true);
};
var stepWater = (x, y) => {
  if (getMat(x, y - 1) === MATERIAL.FIRE) setMat(x, y - 1, MATERIAL.STEAM);
  if (getMat(x + 1, y) === MATERIAL.FIRE) setMat(x + 1, y, MATERIAL.STEAM);
  if (getMat(x - 1, y) === MATERIAL.FIRE) setMat(x - 1, y, MATERIAL.STEAM);
  if (getMat(x, y + 1) === MATERIAL.FIRE) setMat(x, y + 1, MATERIAL.STEAM);
  if (trySwap(x, y, x, y + 1, true)) return;
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (trySwap(x, y, x + dir, y + 1, true)) return;
  if (trySwap(x, y, x - dir, y + 1, true)) return;
  let pressure = 0;
  for (let py = y - 1; py >= Math.max(0, y - 10); py--) {
    if (getMat(x, py) === MATERIAL.WATER) pressure++;
    else break;
  }
  const spreadChance = Math.min(90, 30 + pressure * 10);
  if (rng.nextInt(100) < spreadChance) {
    const spreadDir = rng.nextInt(2) === 0 ? -1 : 1;
    const maxDist = 2 + (pressure >> 1);
    for (let dist = 1; dist <= maxDist; dist++) {
      const nx = x + spreadDir * dist;
      if (!inBounds2(nx, y)) break;
      const matAt = getMat(nx, y);
      if (matAt === MATERIAL.EMPTY || isGas(matAt)) {
        swap(x, y, nx, y);
        return;
      }
      if (isSolid(matAt)) break;
    }
    for (let dist = 1; dist <= maxDist; dist++) {
      const nx = x - spreadDir * dist;
      if (!inBounds2(nx, y)) break;
      const matAt = getMat(nx, y);
      if (matAt === MATERIAL.EMPTY || isGas(matAt)) {
        swap(x, y, nx, y);
        return;
      }
      if (isSolid(matAt)) break;
    }
  }
  if (pressure > 5 && rng.nextInt(100) < 10) {
    for (const dx of [dir, -dir]) {
      if (inBounds2(x + dx, y - 1)) {
        const matSide = getMat(x + dx, y);
        const matUp = getMat(x + dx, y - 1);
        if ((matSide === MATERIAL.EMPTY || isGas(matSide)) && (matUp === MATERIAL.EMPTY || isGas(matUp))) {
          swap(x, y, x + dx, y - 1);
          return;
        }
      }
    }
  }
};
var stepOil = (x, y) => {
  const below = getMat(x, y + 1);
  if (below === MATERIAL.WATER) {
    swap(x, y, x, y + 1);
    return;
  }
  if (trySwap(x, y, x, y + 1, true)) return;
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (trySwap(x, y, x + dir, y + 1, true)) return;
  if (trySwap(x, y, x - dir, y + 1, true)) return;
  let pressure = 0;
  for (let py = y - 1; py >= Math.max(0, y - 8); py--) {
    if (getMat(x, py) === MATERIAL.OIL) pressure++;
    else break;
  }
  const spreadChance = Math.min(70, 15 + pressure * 8);
  if (rng.nextInt(100) < spreadChance) {
    const spreadDir = rng.nextInt(2) === 0 ? -1 : 1;
    const maxDist = 1 + (pressure >> 1);
    for (let dist = 1; dist <= maxDist; dist++) {
      const nx = x + spreadDir * dist;
      if (!inBounds2(nx, y)) break;
      const matAt = getMat(nx, y);
      if (matAt === MATERIAL.EMPTY || isGas(matAt)) {
        swap(x, y, nx, y);
        return;
      }
      if (isSolid(matAt)) break;
    }
    for (let dist = 1; dist <= maxDist; dist++) {
      const nx = x - spreadDir * dist;
      if (!inBounds2(nx, y)) break;
      const matAt = getMat(nx, y);
      if (matAt === MATERIAL.EMPTY || isGas(matAt)) {
        swap(x, y, nx, y);
        return;
      }
      if (isSolid(matAt)) break;
    }
  }
};
var igniteIfFlammable = (x, y) => {
  const mat = getMat(x, y);
  if (mat === MATERIAL.WOOD || mat === MATERIAL.OIL) {
    if (rng.nextFloat01() < 0.35) {
      setMat(x, y, MATERIAL.FIRE);
    }
  }
};
var stepFire = (x, y) => {
  if (getMat(x, y + 1) === MATERIAL.WATER || getMat(x, y - 1) === MATERIAL.WATER) {
    setMat(x, y, MATERIAL.STEAM);
    return;
  }
  const above = getMat(x, y - 1);
  if (above === MATERIAL.EMPTY || above === MATERIAL.SMOKE) {
    trySwap(x, y, x, y - 1, false);
    return;
  }
  igniteIfFlammable(x + 1, y);
  igniteIfFlammable(x - 1, y);
  igniteIfFlammable(x, y + 1);
  igniteIfFlammable(x, y - 1);
  if (rng.nextFloat01() < 0.08) {
    setMat(x, y, MATERIAL.SMOKE);
  } else if (rng.nextFloat01() < 0.04) {
    setMat(x, y, MATERIAL.EMPTY);
  }
};
var stepSmoke = (x, y) => {
  if (y <= 1) {
    if (rng.nextFloat01() < 0.02) setMat(x, y, MATERIAL.EMPTY);
    return;
  }
  if (trySwap(x, y, x, y - 1, false)) return;
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (trySwap(x, y, x + dir, y - 1, false)) return;
  if (trySwap(x, y, x - dir, y - 1, false)) return;
  if (rng.nextFloat01() < 5e-3) setMat(x, y, MATERIAL.EMPTY);
};
var stepSteam = (x, y) => {
  if (y <= 1) {
    if (rng.nextFloat01() < 0.04) setMat(x, y, MATERIAL.EMPTY);
    return;
  }
  if (trySwap(x, y, x, y - 1, false)) return;
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (trySwap(x, y, x + dir, y - 1, false)) return;
  if (trySwap(x, y, x - dir, y - 1, false)) return;
  if (rng.nextFloat01() < 0.02) setMat(x, y, MATERIAL.EMPTY);
};
var stepAcid = (x, y) => {
  const below = getMat(x, y + 1);
  if (!isAcidResistant(below) && below !== MATERIAL.EMPTY && below !== MATERIAL.ACID) {
    if (rng.nextFloat01() < 0.6) {
      setMat(x, y + 1, MATERIAL.ACID);
      setMat(x, y, MATERIAL.EMPTY);
      return;
    }
  }
  const left = getMat(x - 1, y);
  if (!isAcidResistant(left) && left !== MATERIAL.EMPTY && left !== MATERIAL.ACID && rng.nextFloat01() < 0.35) {
    setMat(x - 1, y, MATERIAL.ACID);
  }
  const right = getMat(x + 1, y);
  if (!isAcidResistant(right) && right !== MATERIAL.EMPTY && right !== MATERIAL.ACID && rng.nextFloat01() < 0.35) {
    setMat(x + 1, y, MATERIAL.ACID);
  }
  if (trySwap(x, y, x, y + 1, true)) return;
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (trySwap(x, y, x + dir, y + 1, true)) return;
  if (trySwap(x, y, x - dir, y + 1, true)) return;
  let pressure = 0;
  for (let py = y - 1; py >= Math.max(0, y - 8); py--) {
    if (getMat(x, py) === MATERIAL.ACID) pressure++;
    else break;
  }
  const spreadChance = Math.min(85, 25 + pressure * 10);
  if (rng.nextInt(100) < spreadChance) {
    const spreadDir = rng.nextInt(2) === 0 ? -1 : 1;
    const maxDist = 2 + (pressure >> 1);
    for (let dist = 1; dist <= maxDist; dist++) {
      const nx = x + spreadDir * dist;
      if (!inBounds2(nx, y)) break;
      const matAt = getMat(nx, y);
      if (matAt === MATERIAL.EMPTY || isGas(matAt)) {
        swap(x, y, nx, y);
        return;
      }
      if (isSolid(matAt) || isAcidResistant(matAt)) break;
    }
    for (let dist = 1; dist <= maxDist; dist++) {
      const nx = x - spreadDir * dist;
      if (!inBounds2(nx, y)) break;
      const matAt = getMat(nx, y);
      if (matAt === MATERIAL.EMPTY || isGas(matAt)) {
        swap(x, y, nx, y);
        return;
      }
      if (isSolid(matAt) || isAcidResistant(matAt)) break;
    }
  }
  if (rng.nextFloat01() < 2e-3) setMat(x, y, MATERIAL.EMPTY);
};
var canPlacePlayerAt = (x, y) => {
  for (let py = 0; py < player.height; py++) {
    for (let px = 0; px < player.width; px++) {
      const mat = getMat(x + px, y + py);
      if (mat !== MATERIAL.EMPTY && mat !== MATERIAL.WATER && mat !== MATERIAL.OIL && mat !== MATERIAL.SMOKE && mat !== MATERIAL.FIRE) {
        return false;
      }
    }
  }
  return true;
};
var clearPlayer = () => {
  for (let py = 0; py < player.height; py++) {
    for (let px = 0; px < player.width; px++) {
      const cx = player.x + px;
      const cy = player.y + py;
      if (getMat(cx, cy) === MATERIAL.PLAYER) setMat(cx, cy, MATERIAL.EMPTY);
    }
  }
};
var placePlayer = () => {
  for (let py = 0; py < player.height; py++) {
    for (let px = 0; px < player.width; px++) {
      setMat(player.x + px, player.y + py, MATERIAL.PLAYER);
    }
  }
};
var updatePlayer = () => {
  clearPlayer();
  player.wasOnGround = player.onGround;
  player.onGround = !canPlacePlayerAt(player.x, player.y + 1);
  if (player.onGround) {
    player.coyoteCounter = PLAYER_COYOTE_TIME;
  } else if (player.coyoteCounter > 0) {
    player.coyoteCounter--;
  }
  const inputX = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  if (inputX !== 0) {
    player.vx += inputX * PLAYER_ACCEL;
    player.vx = Math.max(-PLAYER_MAX_SPEED, Math.min(PLAYER_MAX_SPEED, player.vx));
    player.facingRight = inputX > 0;
  } else {
    const friction = player.onGround ? PLAYER_FRICTION : PLAYER_AIR_FRICTION;
    player.vx *= friction;
    if (Math.abs(player.vx) < 0.1) player.vx = 0;
  }
  if (input.jump && player.coyoteCounter > 0) {
    player.vy = -PLAYER_JUMP_FORCE;
    player.coyoteCounter = 0;
  }
  if (input.fly && player.airTime < PLAYER_MAX_AIR_TIME && !player.onGround) {
    player.vy -= PLAYER_FLY_FORCE;
    player.airTime++;
    if (player.airTime % 4 === 0) {
      spawnParticle(player.x + 1, player.y + player.height, 9, 0.8, 15);
    }
  }
  player.vy = Math.min(player.vy + PLAYER_GRAVITY, PLAYER_MAX_FALL);
  const stepsX = Math.ceil(Math.abs(player.vx));
  const stepDirX = Math.sign(player.vx);
  let remainingVx = Math.abs(player.vx);
  for (let i = 0; i < stepsX && remainingVx > 0; i++) {
    const step = Math.min(1, remainingVx);
    const nextX = player.x + stepDirX;
    if (canPlacePlayerAt(nextX, player.y)) {
      player.x = nextX;
      remainingVx -= step;
    } else {
      player.vx = 0;
      break;
    }
  }
  const stepsY = Math.ceil(Math.abs(player.vy));
  const stepDirY = Math.sign(player.vy);
  let remainingVy = Math.abs(player.vy);
  for (let i = 0; i < stepsY && remainingVy > 0; i++) {
    const step = Math.min(1, remainingVy);
    const nextY = player.y + stepDirY;
    if (canPlacePlayerAt(player.x, nextY)) {
      player.y = nextY;
      remainingVy -= step;
    } else {
      player.vy = 0;
      break;
    }
  }
  if (player.onGround) {
    player.airTime = 0;
  }
  placePlayer();
};
var spawnProjectile = (wand) => {
  const aimBaseX = player.x + player.width * 0.5;
  const aimBaseY = player.y + 1;
  const dx = input.mouseGridX - aimBaseX;
  const dy = input.mouseGridY - aimBaseY;
  const baseAngle = Math.atan2(dy, dx);
  const originX = player.x + (player.facingRight ? player.width : -1);
  const originY = player.y + 1;
  for (let i = 0; i < wand.burst; i++) {
    const jitter = (rng.nextFloat01() - 0.5) * wand.spread;
    const angle = baseAngle + jitter;
    const spawnOffset = 0.8;
    projectiles.push({
      x: originX + Math.cos(angle) * spawnOffset,
      y: originY + Math.sin(angle) * spawnOffset,
      vx: Math.cos(angle) * wand.projectileSpeed,
      vy: Math.sin(angle) * wand.projectileSpeed,
      life: 70,
      payload: pickPayload(wand, rng),
      impact: wand.impact,
      trail: wand.trail,
      ignorePlayerTicks: 2
    });
  }
};
var explodeAt = (x, y) => {
  paintCircle(grid, x, y, 3, makeCell(MATERIAL.FIRE));
  paintCircle(grid, x, y, 4, makeCell(MATERIAL.SMOKE));
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      igniteIfFlammable(x + dx, y + dy);
    }
  }
};
var splashAt = (x, y, payload) => {
  paintCircle(grid, x, y, 2, makeCell(payload));
  if (payload === MATERIAL.ACID) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (rng.nextFloat01() < 0.2) {
          setMat(x + dx, y + dy, MATERIAL.ACID);
        }
      }
    }
  }
};
var updateProjectiles = () => {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.vy += 0.04;
    const steps = Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy)));
    const stepX = p.vx / steps;
    const stepY = p.vy / steps;
    let hit = false;
    for (let s = 0; s < steps; s++) {
      p.x += stepX;
      p.y += stepY;
      const gx = Math.round(p.x);
      const gy = Math.round(p.y);
      if (!inBounds2(gx, gy)) {
        hit = true;
        break;
      }
      const mat = getMat(gx, gy);
      if (mat === MATERIAL.PLAYER && p.ignorePlayerTicks > 0) {
        continue;
      }
      if (mat !== MATERIAL.EMPTY && mat !== MATERIAL.SMOKE && mat !== MATERIAL.FIRE && mat !== MATERIAL.STEAM) {
        if (p.impact === "explode" || p.payload === MATERIAL.FIRE) {
          explodeAt(gx, gy);
        } else {
          splashAt(gx, gy, p.payload);
        }
        hit = true;
        break;
      }
      if (p.trail !== void 0) {
        setMat(gx, gy, p.trail);
      }
    }
    p.life -= 1;
    if (p.ignorePlayerTicks > 0) p.ignorePlayerTicks -= 1;
    if (hit || p.life <= 0) {
      projectiles.splice(i, 1);
    }
  }
};
var perCell = (i, x, y) => {
  const cell = grid.cells[i] ?? 0;
  const mat = getMaterial(cell);
  switch (mat) {
    case MATERIAL.SAND:
      stepSand(x, y);
      break;
    case MATERIAL.WATER:
      stepWater(x, y);
      break;
    case MATERIAL.OIL:
      stepOil(x, y);
      break;
    case MATERIAL.FIRE:
      stepFire(x, y);
      break;
    case MATERIAL.SMOKE:
      stepSmoke(x, y);
      break;
    case MATERIAL.STEAM:
      stepSteam(x, y);
      break;
    case MATERIAL.ACID:
      stepAcid(x, y);
      break;
    default:
      break;
  }
};
var updateBrush = () => {
  if (!input.mouseLeft && !input.mouseRight) return;
  const mat = input.mode === "erase" ? MATERIAL.EMPTY : input.brushMat;
  if (input.mode === "wand" && input.mouseLeft) return;
  const mx = Math.round(input.mouseGridX);
  const my = Math.round(input.mouseGridY);
  if (input.mouseLeft) {
    paintCircle(grid, mx, my, input.brushSize, makeCell(mat));
  }
  if (input.mouseRight) {
    paintCircle(grid, mx, my, input.brushSize, makeCell(MATERIAL.EMPTY));
  }
};
var updateWand = () => {
  if (input.mode !== "wand") return;
  if (!input.mouseLeft) return;
  if (wandCooldown > 0) return;
  const wand = wands[activeWandIndex] ?? wands[0];
  if (!wand) return;
  spawnProjectile(wand);
  wandCooldown = wand.cooldown;
};
var updateHud = () => {
  if (!statusEl) return;
  const matName = MATERIAL_LABEL[input.brushMat] ?? "Unknown";
  const wand = wands[activeWandIndex];
  const wandName = wand ? wand.name : "Unknown Wand";
  let statusText = `Mode: ${input.mode.toUpperCase()} \xB7 Wand: ${wandName} \xB7 Brush: ${matName} \xB7 Size: ${input.brushSize}`;
  if (infiniteMode && chunkManager) {
    const debug = chunkManager.getDebugInfo();
    const worldPos = chunkManager.getPlayerWorldPos(player.x, player.y);
    statusText += ` \xB7 World: (${worldPos.worldX.toFixed(0)}, ${worldPos.worldY.toFixed(0)})`;
    statusText += ` \xB7 Chunk: ${debug.playerWorldChunk}`;
  }
  statusEl.textContent = statusText;
};
var projectileColor = (payload) => {
  switch (payload) {
    case MATERIAL.ACID:
      return packRGBA(120, 240, 120, 255);
    case MATERIAL.WATER:
      return packRGBA(70, 130, 230, 255);
    case MATERIAL.OIL:
      return packRGBA(90, 70, 40, 255);
    case MATERIAL.ROCK:
      return packRGBA(110, 110, 120, 255);
    case MATERIAL.SAND:
      return packRGBA(220, 190, 110, 255);
    case MATERIAL.WOOD:
      return packRGBA(150, 100, 50, 255);
    case MATERIAL.FIRE:
      return packRGBA(255, 160, 40, 255);
    default:
      return packRGBA(230, 230, 230, 255);
  }
};
var drawProjectiles = () => {
  for (const projectile of projectiles) {
    const len = Math.max(1, Math.hypot(projectile.vx, projectile.vy));
    const dx = projectile.vx / len;
    const dy = projectile.vy / len;
    const color = projectileColor(projectile.payload);
    const tipColor = packRGBA(255, 255, 255, 255);
    for (let t = 0; t < 4; t++) {
      const px = projectile.x - dx * t | 0;
      const py = projectile.y - dy * t | 0;
      if (px >= 0 && px < W && py >= 0 && py < H) {
        surface.pixels[py * W + px] = t === 0 ? tipColor : color;
      }
    }
  }
};
var applyPostProcess = () => {
  const pixels = surface.pixels;
  const w = surface.width;
  const h = surface.height;
  const vignetteRadius = Math.min(w, h) * 0.6;
  const cx = w * 0.5;
  const cy = h * 0.55;
  for (let y = 0; y < h; y++) {
    const shadeBase = 0.78 + (1 - y / h) * 0.35;
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      let color = pixels[idx] ?? 0;
      const a = color >>> 24 & 255;
      if (a === 0) continue;
      const above = y > 0 ? pixels[idx - w] ?? 0 : 0;
      const edgeBoost = (above >>> 24 & 255) === 0 ? 0.12 : 0;
      const dither = (x + y & 1) === 0 ? -0.02 : 0.02;
      const lightIdx = idx;
      const lightMulR = Math.min(2, 0.45 + lightR[lightIdx]);
      const lightMulG = Math.min(2, 0.45 + lightG[lightIdx]);
      const lightMulB = Math.min(2, 0.45 + lightB[lightIdx]);
      const shade = shadeBase + edgeBoost + dither;
      let r = (color & 255) * shade * lightMulR;
      let g = (color >> 8 & 255) * shade * lightMulG;
      let b = (color >> 16 & 255) * shade * lightMulB;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const vig = Math.min(1, dist / vignetteRadius);
      const vigMul = 1 - vig * 0.25;
      r *= vigMul;
      g *= vigMul;
      b *= vigMul;
      r = Math.min(255, Math.max(0, r)) | 0;
      g = Math.min(255, Math.max(0, g)) | 0;
      b = Math.min(255, Math.max(0, b)) | 0;
      color = a << 24 | b << 16 | g << 8 | r;
      pixels[idx] = color >>> 0;
    }
  }
};
var drawBackground = () => {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#0a0d15");
  gradient.addColorStop(0.6, "#0d101a");
  gradient.addColorStop(1, "#05070c");
  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const vignette = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.6,
    canvas.width * 0.1,
    canvas.width * 0.5,
    canvas.height * 0.6,
    canvas.width * 0.7
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
};
var drawPlayerSprite = () => {
  let pose = "idle";
  if (!player.onGround && input.fly && player.airTime > 0) {
    pose = "fly";
  } else if (!player.onGround) {
    pose = "jump";
  } else if (Math.abs(player.vx) > 0.1) {
    pose = "walk";
  }
  const flip = !player.facingRight;
  const spriteX = player.x - 7;
  const spriteY = player.y - 13;
  drawAnimatedSprite(
    ctx,
    spriteX,
    spriteY,
    WIZARD_SPRITE_FRAMES[pose].right,
    animationTick,
    PALETTE,
    flip
  );
};
var last = performance.now();
var frames = 0;
var acc = 0;
var applyGridShift = (shift) => {
  if (!shift.shifted) return;
  player.x -= shift.deltaX;
  player.y -= shift.deltaY;
  for (const proj of projectiles) {
    proj.x -= shift.deltaX;
    proj.y -= shift.deltaY;
  }
  camera.worldOriginX += shift.deltaX;
  camera.worldOriginY += shift.deltaY;
};
var tick = () => {
  animationTick++;
  if (infiniteMode && chunkManager) {
    const shift = chunkManager.update(player.x, player.y);
    applyGridShift(shift);
    updateCamera(camera, player.x, player.y);
    const gridCoords = screenToGrid(camera, input.mouseX, input.mouseY);
    input.mouseGridX = gridCoords.gridX;
    input.mouseGridY = gridCoords.gridY;
  } else {
    input.mouseGridX = input.mouseX;
    input.mouseGridY = input.mouseY;
  }
  updatePlayer();
  updateBrush();
  updateWand();
  updateProjectiles();
  updateParticles();
  stepActiveChunks(grid, "bottom-up", perCell);
  renderToSurface(grid, surface, palette);
  drawProjectiles();
  computeLights();
  applyPostProcess();
  presentToCanvas(ctx, surface);
  drawPlayerSprite();
  renderParticles(ctx);
  drawBackground();
  if (wandCooldown > 0) wandCooldown -= 1;
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
  updateHud();
  requestAnimationFrame(tick);
};
var setMode = (mode) => {
  input.mode = mode;
};
var setBrushFromKey = (key) => {
  switch (key) {
    case "Digit1":
      input.brushMat = MATERIAL.SAND;
      break;
    case "Digit2":
      input.brushMat = MATERIAL.WATER;
      break;
    case "Digit3":
      input.brushMat = MATERIAL.OIL;
      break;
    case "Digit4":
      input.brushMat = MATERIAL.WOOD;
      break;
    case "Digit5":
      input.brushMat = MATERIAL.ROCK;
      break;
    case "Digit6":
      input.brushMat = MATERIAL.ACID;
      break;
    case "Digit7":
      input.brushMat = MATERIAL.STEAM;
      break;
    case "Digit8":
      input.brushMat = MATERIAL.GLASS;
      break;
    case "Digit9":
      input.brushMat = MATERIAL.CERAMIC;
      break;
    case "Digit0":
      input.brushMat = MATERIAL.SILICA;
      break;
  }
};
var cycleWand = (direction) => {
  if (wands.length === 0) return;
  activeWandIndex = (activeWandIndex + direction + wands.length) % wands.length;
};
window.addEventListener("keydown", (event) => {
  if (event.code === "KeyA") input.left = true;
  if (event.code === "KeyD") input.right = true;
  if (event.code === "Space") input.jump = true;
  if (event.code === "KeyW") input.fly = true;
  if (event.code === "KeyV") setMode("wand");
  if (event.code === "KeyB") setMode("brush");
  if (event.code === "KeyE") setMode("erase");
  if (event.code === "KeyQ") cycleWand(-1);
  if (event.code === "KeyR") cycleWand(1);
  setBrushFromKey(event.code);
});
window.addEventListener("keyup", (event) => {
  if (event.code === "KeyA") input.left = false;
  if (event.code === "KeyD") input.right = false;
  if (event.code === "Space") input.jump = false;
  if (event.code === "KeyW") input.fly = false;
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  input.mouseX = Math.floor((event.clientX - rect.left) / rect.width * W);
  input.mouseY = Math.floor((event.clientY - rect.top) / rect.height * H);
});
canvas.addEventListener("mousedown", (event) => {
  if (event.button === 0) input.mouseLeft = true;
  if (event.button === 2) input.mouseRight = true;
});
canvas.addEventListener("mouseup", (event) => {
  if (event.button === 0) input.mouseLeft = false;
  if (event.button === 2) input.mouseRight = false;
});
canvas.addEventListener("wheel", (event) => {
  const next = input.brushSize + (event.deltaY > 0 ? -1 : 1);
  input.brushSize = Math.min(12, Math.max(1, next));
});
var btnGenerate = document.getElementById("btn-generate");
if (btnGenerate) {
  btnGenerate.addEventListener("click", () => {
    const seedInput = document.getElementById("input-seed");
    const biomeSelect = document.getElementById("select-biome");
    const seed = seedInput?.value ? parseInt(seedInput.value, 10) : Math.floor(Math.random() * 1e5);
    const biome = biomeSelect?.value ?? "random";
    if (seedInput && !seedInput.value) {
      seedInput.value = seed.toString();
    }
    regenerateWorld(seed, biome);
  });
}
var selectBiome = document.getElementById("select-biome");
if (selectBiome) {
  selectBiome.addEventListener("change", () => {
    currentBiome = selectBiome.value;
  });
}
var inputSeed = document.getElementById("input-seed");
if (inputSeed) {
  inputSeed.addEventListener("change", () => {
    const val = parseInt(inputSeed.value, 10);
    if (!isNaN(val)) {
      currentSeed = val;
    }
  });
}
var btnInfinite = document.getElementById("btn-infinite");
if (btnInfinite) {
  btnInfinite.addEventListener("click", () => {
    toggleInfiniteMode();
  });
}
window.addEventListener("keydown", (event) => {
  if (event.code === "KeyG" && event.ctrlKey) {
    event.preventDefault();
    regenerateWorld(Math.floor(Math.random() * 1e5), currentBiome);
  }
});
updateHud();
requestAnimationFrame(tick);
