# @voxelyn/core

Ultra-lightweight, zero-dependency headless toolkit for **pixels**, **grids**, **isometric**, and **voxel** content. Designed for games, simulations, and procedural generation.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()

## Features

- 🎨 **Surface2D** - Fast pixel buffer with RGBA8888 packing
- 📊 **Grid2D** - Chunked cellular simulation (Noita-like falling sand)
- 🏔️ **Terrain Generation** - Procedural heightmaps with noise, shadows, biomes
- 🧊 **VoxelGrid3D** - Dense 3D voxel storage
- 🎲 **Isometric** - Projection and painter's algorithm rendering
- 🔢 **Deterministic RNG** - Reproducible xorshift32 sequences
- 🌡️ **Material System** - Physics properties, behaviors, palettes

---

## Installation

```bash
npm install @voxelyn/core
# or
pnpm add @voxelyn/core
```

---

## Quick Start

```typescript
import {
  createSurface2D,
  createGrid2D,
  GradientNoise,
  createVoxelGrid3D,
  makePalette,
  packRGBA
} from '@voxelyn/core';

// Create a 256x256 pixel buffer
const surface = createSurface2D(256, 256);

// Create a cellular simulation grid
const grid = createGrid2D(512, 512, { chunkSize: 64 });

// Generate procedural terrain
const noise = new GradientNoise(12345, { octaves: 6, falloff: 0.5 });
const height = noise.sampleZoomed(x, y, 100);

// Create 3D voxel world
const voxels = createVoxelGrid3D(64, 64, 64);
```

---

## Core Modules

### Surface2D - Pixel Buffer

A minimal 2D pixel buffer using `Uint32Array` with RGBA8888 packing (little-endian).

```typescript
import { createSurface2D, setPixel, getPixel, fillRect, clearSurface, packRGBA } from '@voxelyn/core';

const surface = createSurface2D(320, 240);

// Clear to black
clearSurface(surface, packRGBA(0, 0, 0, 255));

// Set a red pixel
setPixel(surface, 10, 10, packRGBA(255, 0, 0, 255));

// Fill a blue rectangle
fillRect(surface, 50, 50, 100, 100, packRGBA(0, 0, 255, 255));

// Read pixel value
const color = getPixel(surface, 10, 10);
```

**Color Packing Math:**
```
RGBA8888 (little-endian):
pixel = R | (G << 8) | (B << 16) | (A << 24)

Unpacking:
R = pixel & 0xFF
G = (pixel >> 8) & 0xFF
B = (pixel >> 16) & 0xFF
A = (pixel >> 24) & 0xFF
```

---

### Grid2D - Cellular Simulation

Chunked 2D grid optimized for Noita-like falling sand physics. Cells are packed as `u16`: low byte = material ID (0-255), high byte = flags.

```typescript
import { 
  createGrid2D, 
  setCell, 
  getCell, 
  getMaterial, 
  getFlags,
  makeCell,
  markChunkDirty,
  stepActiveChunks
} from '@voxelyn/core';

// Create 512x512 grid with 64x64 chunks
const grid = createGrid2D(512, 512, { chunkSize: 64 });

// Cell format: [flags:8][material:8] = u16
const sandCell = makeCell(3, 0);  // Material 3 (sand), no flags
setCell(grid, 100, 50, sandCell);

// Read cell
const cell = getCell(grid, 100, 50);
const materialId = getMaterial(cell);  // 3
const flags = getFlags(cell);          // 0

// Chunk-based simulation step
stepActiveChunks(grid, 'bottom-up', (i, x, y, g) => {
  // Physics logic per cell
});
```

**Cell Packing:**
```
u16 cell = (flags << 8) | material

CELL_MATERIAL_MASK = 0xFF
CELL_FLAG_SHIFT = 8

getMaterial(cell) = cell & 0xFF
getFlags(cell) = (cell >> 8) & 0xFF
```

**Chunk Activation:**
- Only active chunks are simulated
- Dirty chunks are flagged for processing
- Enables sparse updates for large worlds

---

### Terrain Generation

#### Gradient Noise (Perlin-like)

```typescript
import { GradientNoise } from '@voxelyn/core';

const noise = new GradientNoise(seed, {
  octaves: 6,     // Layers of detail (more = finer detail)
  falloff: 0.5,   // Amplitude reduction per octave
  lacunarity: 2   // Frequency multiplier per octave
});

// Basic sample (0-1)
const value = noise.sample(x, y);

// With zoom factor (key technique!)
// Higher zoom = smoother, more "zoomed in" on the noise
const smoothValue = noise.sampleZoomed(x, y, 100);

// Fractal Brownian Motion for natural terrain
const terrainHeight = noise.fbm(x * 0.01, y * 0.01, 6);
```

#### The Math Behind fBm (Fractal Brownian Motion)

```
fBm(x, y) = Σ amplitude_i × noise(x × frequency_i, y × frequency_i)

Where for each octave i:
  frequency_i = lacunarity^i     (default: 2^i)
  amplitude_i = persistence^i    (default: 0.5^i)

Result: Low frequencies create broad hills, high frequencies add fine detail
```

**Visual representation:**
```
Octave 0: ▂▃▅▆▅▃▂▃▅         (low freq, high amplitude)
Octave 1: ╱╲╱╲╱╲╱╲╱╲         (mid freq, mid amplitude)
Octave 2: ⌇⌇⌇⌇⌇⌇⌇⌇⌇⌇         (high freq, low amplitude)
Sum:      ⛰️🏔️⛰️🗻⛰️🏔️⛰️🏔️⛰️  (natural-looking terrain)
```

#### Cellular/Worley Noise

```typescript
import { CellularNoise } from '@voxelyn/core';

const cellular = new CellularNoise(seed, 16); // 16 = density

// Returns distance to nearest cell center
const distF1 = cellular.sample(x, y);

// Returns edge patterns (F2 - F1)
const edgeValue = cellular.sampleEdge(x, y);
```

**Use cases:**
- Stone textures
- Cracked mud patterns
- Organic cell structures
- Voronoi diagrams

#### Height Thresholds (Terrain Layers)

Key technique from procedural terrain tutorials:

```typescript
const height = noise.sampleZoomed(x, y, 100);

// Layer terrain by height thresholds
if (height < 0.3) {
  material = WATER;
} else if (height < 0.5) {
  material = SAND;
} else if (height < 0.7) {
  material = GRASS;
} else if (height < 0.9) {
  material = STONE;
} else {
  material = SNOW;
}
```

#### Shadows & Ambient Occlusion

```typescript
import { generateShadowMap, generateAmbientOcclusion, combineLighting } from '@voxelyn/core';

// Raycast shadows from heightmap
const shadows = generateShadowMap(
  width, height, 
  heightMap,
  { x: -0.5, y: -0.5 },  // Light direction
  20,                     // Max ray distance
  0.4                     // Shadow intensity
);

// Soft valley shadows
const ao = generateAmbientOcclusion(width, height, heightMap, 3, 0.3);

// Combine for final lighting
const lighting = combineLighting(shadows, ao, 0.7, 0.3);
```

**Shadow Algorithm:**
```
For each pixel:
  1. Cast ray toward light source
  2. Check if any terrain point along ray is higher
  3. If blocked, mark as shadowed (darker)
  4. Shadow softness based on blocker height difference
```

---

### Biome System

Multi-biome terrain with climate simulation and smooth blending:

```typescript
import { createBiomeField, DEFAULT_BIOMES } from '@voxelyn/core';

const biomeField = createBiomeField({
  size: [256, 256],
  seed: 12345,
  biomes: DEFAULT_BIOMES,
  zoomFactor: 100,           // Terrain smoothness
  useClimate: true,          // Climate-based selection
  useHeightThresholds: true, // Layer by height
  shadows: {
    enabled: true,
    lightDirection: { x: -0.5, y: -0.5 },
    intensity: 0.4
  }
});

// Sample terrain data
const height = biomeField.getHeight(x, y);
const shadow = biomeField.getShadow(x, y);
const climate = biomeField.getClimate(x, y);
const color = biomeField.getColor(x, y);
```

**Climate Model:**
```
Temperature: Latitude-based gradient + noise
Moisture: Pure noise field
Elevation: Height map

Biome Selection: Match climate to biome requirements
  - Desert: high temp, low moisture
  - Tundra: low temp, any moisture  
  - Forest: mid temp, high moisture
  - etc.
```

---

### VoxelGrid3D - 3D Voxel Storage

Dense 3D grid for volumetric data:

```typescript
import { createVoxelGrid3D, getVoxel, setVoxel, inBounds3D } from '@voxelyn/core';

const voxels = createVoxelGrid3D(64, 64, 64);

// Set a voxel (material ID as u16)
setVoxel(voxels, 10, 20, 30, 5);

// Get a voxel
const material = getVoxel(voxels, 10, 20, 30);

// Check bounds
if (inBounds3D(voxels, x, y, z)) {
  // Safe to access
}
```

**Indexing Math:**
```
index = (z × height + y) × width + x

For grid[64][64][64]:
  index(10, 20, 30) = (30 × 64 + 20) × 64 + 10 = 124,170
```

---

### Isometric Projection

For Diablo-like top-down 3D rendering:

```typescript
import { projectIso, forEachIsoOrder, makeDrawKey } from '@voxelyn/core';

// Project world to screen coordinates
const screen = projectIso(worldX, worldY, worldZ, tileW, tileH, zStep);
console.log(screen.sx, screen.sy);

// Iterate tiles in painter's order (back to front)
forEachIsoOrder(mapWidth, mapHeight, (x, y, order) => {
  drawTile(x, y);
});

// Create sort key for draw commands
const key = makeDrawKey(x, y, z, layer);
```

**Isometric Projection Math:**
```
screenX = (worldX - worldY) × (tileWidth / 2)
screenY = (worldX + worldY) × (tileHeight / 2) - worldZ × zStep

Painter's Order:
  Sort by (x + y) diagonal
  Draw from back to front
```

---

### RNG - Deterministic Random

Reproducible xorshift32 PRNG for simulations and replays:

```typescript
import { RNG } from '@voxelyn/core';

const rng = new RNG(12345);

// Random unsigned 32-bit integer
const u32 = rng.nextU32();

// Random integer [0, max)
const index = rng.nextInt(100);

// Random float [0, 1)
const probability = rng.nextFloat01();
```

**Xorshift32 Algorithm:**
```javascript
function nextU32() {
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}
```

**Properties:**
- Period: 2^32 - 1
- Fast (3 XOR + 3 shift operations)
- Deterministic (same seed = same sequence)
- Not cryptographically secure

---

### Material System

Define materials with physical and visual properties:

```typescript
import { makeMaterial, makePalette, packRGBA, DEFAULT_MATERIALS } from '@voxelyn/core';

// Create a custom material
const lava = makeMaterial({
  id: 5,
  name: 'Lava',
  color: packRGBA(255, 100, 0, 200),
  density: 60,        // Heavier than water
  friction: 0.2,      // Slippery
  isLiquid: true,     // Flows
  flammable: true     // Ignites things
});

// Create color palette for rendering
const palette = makePalette(256, 0x00000000, [
  [0, packRGBA(0, 0, 0, 0)],      // Air
  [1, packRGBA(128, 128, 128)],   // Stone
  [2, packRGBA(139, 90, 43)],     // Dirt
  [3, packRGBA(194, 178, 128)],   // Sand
]);
```

**Material Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `density` | 0-100 | Weight (affects physics) |
| `friction` | 0-1 | Sliding resistance |
| `isLiquid` | bool | Fluid simulation |
| `isGaseous` | bool | Gas expansion |
| `isTransparent` | bool | Visibility |
| `flammable` | bool | Can ignite |
| `isoHeight` | number | Height in iso mode |

---

### Material Behaviors

Dynamic effects for materials:

```typescript
import { MaterialBehaviors, createBehaviorContext3D } from '@voxelyn/core';

// Burning effect
const burningBehavior = MaterialBehaviors.burning(1.0);

// Melting behavior (triggers at 800 temp)
const meltingBehavior = MaterialBehaviors.melting(800);

// Growing over time
const growingBehavior = MaterialBehaviors.growing(0.1);

// Apply behavior
const context = { x: 10, y: 20, time: 1000, temperature: 900 };
const changes = meltingBehavior(ironMaterial, context);
// changes = { isLiquid: true, friction: 0.25, density: 80 }
```

---

### Traversal Patterns

Deterministic iteration orders:

```typescript
import { 
  forEachRowMajor, 
  forEachBottomUp, 
  forEachMorton,
  forEachInRectBottomUp
} from '@voxelyn/core';

// Row-major: left-right, top-bottom
forEachRowMajor(width, height, (x, y) => { });

// Bottom-up: for falling sand physics
forEachBottomUp(width, height, (x, y) => { });

// Morton/Z-order: for spatial locality
forEachMorton(width, height, (x, y) => { });
```

**Morton Curve (Z-order):**
```
Z-order interleaves bits of x and y:
  x = 5 = 101₂
  y = 3 = 011₂
  morton = 100111₂ = 39

Provides better cache locality for spatial queries
```

---

## Adapters

### Canvas2D

```typescript
import { createSurface2D, blitToCanvas2D } from '@voxelyn/core';

const surface = createSurface2D(256, 256);
// ... draw to surface ...

const ctx = canvas.getContext('2d');
blitToCanvas2D(surface, ctx);
```

### WebGL Texture

```typescript
import { createSurface2D, uploadSurfaceToTexture } from '@voxelyn/core';

const surface = createSurface2D(256, 256);
const texture = gl.createTexture();

uploadSurfaceToTexture(gl, texture, surface);
```

---

## Use Cases

### 🎮 Falling Sand Game (Noita-like)

```typescript
import { createGrid2D, stepActiveChunks, getMaterial, setCell, makeCell } from '@voxelyn/core';

const grid = createGrid2D(512, 256, { chunkSize: 64 });

function simulate() {
  stepActiveChunks(grid, 'bottom-up', (i, x, y, g) => {
    const mat = getMaterial(g.cells[i]);
    if (mat === SAND) {
      // Try to fall
      if (canMoveTo(g, x, y + 1)) {
        swap(g, x, y, x, y + 1);
      }
    }
  });
}
```

### 🏔️ Procedural Terrain

```typescript
import { GradientNoise, generateShadowMap } from '@voxelyn/core';

const noise = new GradientNoise(seed, { octaves: 6 });
const heightMap = new Float32Array(width * height);

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    heightMap[x + y * width] = noise.sampleZoomed(x, y, 100);
  }
}

const shadows = generateShadowMap(width, height, heightMap);
```

### 🧊 Voxel Editor

```typescript
import { createVoxelGrid3D, setVoxel, getVoxel } from '@voxelyn/core';

const world = createVoxelGrid3D(64, 64, 64);

function paint(x, y, z, materialId) {
  setVoxel(world, x, y, z, materialId);
}

function erase(x, y, z) {
  setVoxel(world, x, y, z, 0); // Air
}
```

### 🎲 Roguelike Map Generation

```typescript
import { RNG, CellularNoise } from '@voxelyn/core';

const rng = new RNG(seed);
const caves = new CellularNoise(seed, 20);

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const caveness = caves.sample(x * 0.1, y * 0.1);
    map[x][y] = caveness < 0.3 ? WALL : FLOOR;
  }
}
```

---

## Performance Tips

1. **Use `Unsafe` variants** when bounds are guaranteed
2. **Chunk activation** - only simulate active regions
3. **Morton traversal** - for spatial query workloads
4. **Bottom-up iteration** - for falling physics
5. **TypedArrays** - all data uses `Uint16Array`/`Uint32Array`/`Float32Array`
6. **Zero allocations** - hot paths avoid GC pressure

---

## API Reference

Full API documentation available in TypeScript declarations (`dist/src/*.d.ts`).

---

## License

MIT © 2025 Voxelyn Team
