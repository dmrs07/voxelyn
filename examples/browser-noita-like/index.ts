import {
  createGrid2D,
  createSurface2D,
  packRGBA,
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
import { createWands, pickPayload, type WandDefinition } from "./wands.js";
import { 
  MATERIAL, 
  MATERIAL_LABEL, 
  createPalette,
  isSolid,
  isFluid,
  isGas,
  isAcidResistant,
} from "./materials.js";
import { generateWorld as generateTerrainWorld, clearNoiseCache } from "./terrain-gen.js";
import { createChunkManager, type ChunkManager, type ShiftResult } from "./chunk-manager.js";
import { BIOMES, type BiomeType, getRandomBiome } from "./biomes.js";
import { 
  createCamera, 
  updateCamera, 
  snapCamera,
  screenToGrid,
  type Camera 
} from "./camera.js";

// ============================================================================
// WORLD CONFIGURATION
// ============================================================================

const W = 160;
const H = 120;
const CHUNK_SIZE = 32;

// Game state
let currentSeed = 1337;
let currentBiome: BiomeType | "random" = "cavern";
let infiniteMode = false;
let chunkManager: ChunkManager | null = null;

// Camera for infinite scrolling
let camera: Camera = createCamera({ viewWidth: W, viewHeight: H, deadZone: 4, smoothing: 0.12 });

// Use palette from materials module
const palette = createPalette();

const grid = createGrid2D(W, H, { chunkSize: CHUNK_SIZE });
const surface = createSurface2D(W, H);
let rng = new RNG(currentSeed);

const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("no ctx");

const fpsEl = document.getElementById("fps");
const statusEl = document.getElementById("status");
const biomeEl = document.getElementById("biome-display");

// ============================================================================
// INPUT STATE
// ============================================================================

const input = {
  left: false,
  right: false,
  jump: false,
  mouseX: 0,      // Screen coordinates
  mouseY: 0,
  mouseGridX: 0,  // Grid coordinates (for infinite mode)
  mouseGridY: 0,
  mouseLeft: false,
  mouseRight: false,
  mode: "wand" as "wand" | "brush" | "erase",
  brushMat: MATERIAL.SAND as number,
  brushSize: 4
};

// ============================================================================
// PLAYER STATE
// ============================================================================

const player = {
  x: Math.floor(W * 0.5),
  y: Math.floor(H * 0.35),
  width: 2,
  height: 3,
  vy: 0,
  onGround: false
};

type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  payload: number;
  impact: "explode" | "splash";
  trail?: number;
  ignorePlayerTicks: number;
};

const projectiles: Projectile[] = [];
const wands = createWands(MATERIAL);
let activeWandIndex = 0;
let wandCooldown = 0;

const lightR = new Float32Array(W * H);
const lightG = new Float32Array(W * H);
const lightB = new Float32Array(W * H);

const inBounds = (x: number, y: number): boolean => x >= 1 && x < W - 1 && y >= 1 && y < H - 1;
const getMat = (x: number, y: number): number => {
  if (x < 0 || x >= W || y < 0 || y >= H) return MATERIAL.ROCK;
  return getMaterial(getXY(grid, x, y));
};
const setMat = (x: number, y: number, mat: number): void => {
  if (!inBounds(x, y)) return;
  setXY(grid, x, y, makeCell(mat));
  markChunkActiveByXY(grid, x, y);
  markChunkDirtyByXY(grid, x, y);
};

const addLight = (
  lx: number,
  ly: number,
  radius: number,
  intensity: number,
  tint: [number, number, number]
): void => {
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

// ============================================================================
// WORLD GENERATION
// ============================================================================

/**
 * Regenerate the world with new parameters
 */
const regenerateWorld = (seed?: number, biome?: BiomeType | "random"): void => {
  // Update state
  if (seed !== undefined) currentSeed = seed;
  if (biome !== undefined) currentBiome = biome;
  
  // Reset RNG
  rng = new RNG(currentSeed);
  
  // Clear noise cache for fresh generation
  clearNoiseCache();
  
  // Determine actual biome
  const actualBiome: BiomeType = currentBiome === "random" 
    ? getRandomBiome(currentSeed)
    : currentBiome;
  
  // Reset player position
  player.x = Math.floor(W * 0.5);
  player.y = Math.floor(H * 0.35);
  player.vy = 0;
  
  // Clear projectiles
  projectiles.length = 0;
  
  // Generate terrain using new module
  generateTerrainWorld(grid, {
    width: W,
    height: H,
    seed: currentSeed,
    biome: actualBiome,
    useCellularAutomata: true,
    caIterations: 4,
  });
  
  // Update biome display
  if (biomeEl) {
    const biomeName = BIOMES[actualBiome]?.name ?? actualBiome;
    biomeEl.textContent = `Biome: ${biomeName}`;
  }
  
  console.log(`Generated world: seed=${currentSeed}, biome=${actualBiome}`);
};

/**
 * Toggle infinite scrolling mode
 */
const toggleInfiniteMode = (): void => {
  infiniteMode = !infiniteMode;
  
  if (infiniteMode) {
    // Initialize chunk manager with grid shifting enabled
    chunkManager = createChunkManager(grid, currentSeed, {
      chunkSize: CHUNK_SIZE,
      loadRadius: 3,
      unloadRadius: 5,
      scrollDirection: "both", // Allow vertical too for full freedom
    });
    
    // Reset camera to follow player
    camera = createCamera({ viewWidth: W, viewHeight: H, deadZone: 4, smoothing: 0.12 });
    
    // Pre-generate initial world
    chunkManager.pregenerate();
    
    // Snap camera to player position
    snapCamera(camera, player.x, player.y);
    
    console.log("Infinite mode enabled");
  } else {
    chunkManager = null;
    camera = createCamera({ viewWidth: W, viewHeight: H, deadZone: 4, smoothing: 0.12 });
    regenerateWorld(); // Generate fixed world
    console.log("Infinite mode disabled");
  }
  
  // Update button text
  const btn = document.getElementById("btn-infinite");
  if (btn) {
    btn.textContent = infiniteMode ? "🔲 Fixed Mode" : "∞ Infinite Mode";
  }
};

// Initial world generation
regenerateWorld();

const computeLights = (): void => {
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
      addLight(px, py, 6, 1.0, [1.4, 0.85, 0.45]);
    }
  }

  addLight(player.x + 1, player.y + 1, 5, 0.8, [1.1, 0.9, 0.6]);
};

const canSwapInto = (mat: number, allowFluid = false): boolean => {
  if (mat === MATERIAL.EMPTY) return true;
  if (isGas(mat)) return true;
  if (allowFluid && isFluid(mat)) return true;
  return false;
};

const trySwap = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  allowFluid = false
): boolean => {
  if (!inBounds(x2, y2)) return false;
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

// Full cell swap (used for density-based movement like oil floating on water)
const swap = (x1: number, y1: number, x2: number, y2: number): void => {
  const a = getXY(grid, x1, y1);
  const b = getXY(grid, x2, y2);
  setXY(grid, x1, y1, b);
  setXY(grid, x2, y2, a);
  markChunkActiveByXY(grid, x1, y1);
  markChunkActiveByXY(grid, x2, y2);
  markChunkDirtyByXY(grid, x1, y1);
  markChunkDirtyByXY(grid, x2, y2);
};

const stepSand = (x: number, y: number): void => {
  if (trySwap(x, y, x, y + 1, true)) return;
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (trySwap(x, y, x + dir, y + 1, true)) return;
  trySwap(x, y, x - dir, y + 1, true);
};

const stepWater = (x: number, y: number): void => {
  // Convert adjacent fire into steam
  if (getMat(x, y - 1) === MATERIAL.FIRE) setMat(x, y - 1, MATERIAL.STEAM);
  if (getMat(x + 1, y) === MATERIAL.FIRE) setMat(x + 1, y, MATERIAL.STEAM);
  if (getMat(x - 1, y) === MATERIAL.FIRE) setMat(x - 1, y, MATERIAL.STEAM);
  if (getMat(x, y + 1) === MATERIAL.FIRE) setMat(x, y + 1, MATERIAL.STEAM);

  // 1. Gravity - try to fall straight down
  if (trySwap(x, y, x, y + 1, true)) return;

  // 2. Diagonal down movement
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (trySwap(x, y, x + dir, y + 1, true)) return;
  if (trySwap(x, y, x - dir, y + 1, true)) return;

  // 3. Pressure simulation - count water above
  let pressure = 0;
  for (let py = y - 1; py >= Math.max(0, y - 10); py--) {
    if (getMat(x, py) === MATERIAL.WATER) pressure++;
    else break;
  }

  // 4. Spread horizontally based on pressure
  const spreadChance = Math.min(90, 30 + pressure * 10);
  if (rng.nextInt(100) < spreadChance) {
    const spreadDir = rng.nextInt(2) === 0 ? -1 : 1;
    const maxDist = 2 + (pressure >> 1);

    // Try spreading in primary direction
    for (let dist = 1; dist <= maxDist; dist++) {
      const nx = x + spreadDir * dist;
      if (!inBounds(nx, y)) break;
      const matAt = getMat(nx, y);
      if (matAt === MATERIAL.EMPTY || isGas(matAt)) {
        swap(x, y, nx, y);
        return;
      }
      if (isSolid(matAt)) break;
    }

    // Try opposite direction
    for (let dist = 1; dist <= maxDist; dist++) {
      const nx = x - spreadDir * dist;
      if (!inBounds(nx, y)) break;
      const matAt = getMat(nx, y);
      if (matAt === MATERIAL.EMPTY || isGas(matAt)) {
        swap(x, y, nx, y);
        return;
      }
      if (isSolid(matAt)) break;
    }
  }

  // 5. Under high pressure, water can rise through side paths
  if (pressure > 5 && rng.nextInt(100) < 10) {
    for (const dx of [dir, -dir]) {
      if (inBounds(x + dx, y - 1)) {
        const matSide = getMat(x + dx, y);
        const matUp = getMat(x + dx, y - 1);
        if ((matSide === MATERIAL.EMPTY || isGas(matSide)) &&
            (matUp === MATERIAL.EMPTY || isGas(matUp))) {
          swap(x, y, x + dx, y - 1);
          return;
        }
      }
    }
  }
};

const stepOil = (x: number, y: number): void => {
  // Oil floats on water - swap if water below
  const below = getMat(x, y + 1);
  if (below === MATERIAL.WATER) {
    swap(x, y, x, y + 1);
    return;
  }

  // 1. Gravity - try to fall
  if (trySwap(x, y, x, y + 1, true)) return;

  // 2. Diagonal down movement
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (trySwap(x, y, x + dir, y + 1, true)) return;
  if (trySwap(x, y, x - dir, y + 1, true)) return;

  // 3. Pressure simulation - count oil above
  let pressure = 0;
  for (let py = y - 1; py >= Math.max(0, y - 8); py--) {
    if (getMat(x, py) === MATERIAL.OIL) pressure++;
    else break;
  }

  // 4. Oil is more viscous - lower spread chance
  const spreadChance = Math.min(70, 15 + pressure * 8);
  if (rng.nextInt(100) < spreadChance) {
    const spreadDir = rng.nextInt(2) === 0 ? -1 : 1;
    const maxDist = 1 + (pressure >> 1);

    for (let dist = 1; dist <= maxDist; dist++) {
      const nx = x + spreadDir * dist;
      if (!inBounds(nx, y)) break;
      const matAt = getMat(nx, y);
      if (matAt === MATERIAL.EMPTY || isGas(matAt)) {
        swap(x, y, nx, y);
        return;
      }
      if (isSolid(matAt)) break;
    }

    for (let dist = 1; dist <= maxDist; dist++) {
      const nx = x - spreadDir * dist;
      if (!inBounds(nx, y)) break;
      const matAt = getMat(nx, y);
      if (matAt === MATERIAL.EMPTY || isGas(matAt)) {
        swap(x, y, nx, y);
        return;
      }
      if (isSolid(matAt)) break;
    }
  }
};

const igniteIfFlammable = (x: number, y: number): void => {
  const mat = getMat(x, y);
  if (mat === MATERIAL.WOOD || mat === MATERIAL.OIL) {
    if (rng.nextFloat01() < 0.35) {
      setMat(x, y, MATERIAL.FIRE);
    }
  }
};

const stepFire = (x: number, y: number): void => {
  // Fire meeting water turns into steam
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

const stepSmoke = (x: number, y: number): void => {
  if (y <= 1) {
    if (rng.nextFloat01() < 0.02) setMat(x, y, MATERIAL.EMPTY);
    return;
  }
  if (trySwap(x, y, x, y - 1, false)) return;
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (trySwap(x, y, x + dir, y - 1, false)) return;
  if (trySwap(x, y, x - dir, y - 1, false)) return;
  if (rng.nextFloat01() < 0.005) setMat(x, y, MATERIAL.EMPTY);
};

const stepSteam = (x: number, y: number): void => {
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

const stepAcid = (x: number, y: number): void => {
  // Acid corrodes materials below it
  const below = getMat(x, y + 1);
  if (!isAcidResistant(below) && below !== MATERIAL.EMPTY && below !== MATERIAL.ACID) {
    if (rng.nextFloat01() < 0.6) {
      setMat(x, y + 1, MATERIAL.ACID);
      setMat(x, y, MATERIAL.EMPTY);
      return;
    }
  }

  // Corrode adjacent materials
  const left = getMat(x - 1, y);
  if (!isAcidResistant(left) && left !== MATERIAL.EMPTY && left !== MATERIAL.ACID && rng.nextFloat01() < 0.35) {
    setMat(x - 1, y, MATERIAL.ACID);
  }

  const right = getMat(x + 1, y);
  if (!isAcidResistant(right) && right !== MATERIAL.EMPTY && right !== MATERIAL.ACID && rng.nextFloat01() < 0.35) {
    setMat(x + 1, y, MATERIAL.ACID);
  }

  // 1. Gravity - try to fall
  if (trySwap(x, y, x, y + 1, true)) return;

  // 2. Diagonal down
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (trySwap(x, y, x + dir, y + 1, true)) return;
  if (trySwap(x, y, x - dir, y + 1, true)) return;

  // 3. Pressure simulation
  let pressure = 0;
  for (let py = y - 1; py >= Math.max(0, y - 8); py--) {
    if (getMat(x, py) === MATERIAL.ACID) pressure++;
    else break;
  }

  // 4. Spread based on pressure
  const spreadChance = Math.min(85, 25 + pressure * 10);
  if (rng.nextInt(100) < spreadChance) {
    const spreadDir = rng.nextInt(2) === 0 ? -1 : 1;
    const maxDist = 2 + (pressure >> 1);

    for (let dist = 1; dist <= maxDist; dist++) {
      const nx = x + spreadDir * dist;
      if (!inBounds(nx, y)) break;
      const matAt = getMat(nx, y);
      if (matAt === MATERIAL.EMPTY || isGas(matAt)) {
        swap(x, y, nx, y);
        return;
      }
      if (isSolid(matAt) || isAcidResistant(matAt)) break;
    }

    for (let dist = 1; dist <= maxDist; dist++) {
      const nx = x - spreadDir * dist;
      if (!inBounds(nx, y)) break;
      const matAt = getMat(nx, y);
      if (matAt === MATERIAL.EMPTY || isGas(matAt)) {
        swap(x, y, nx, y);
        return;
      }
      if (isSolid(matAt) || isAcidResistant(matAt)) break;
    }
  }

  // Slow decay
  if (rng.nextFloat01() < 0.002) setMat(x, y, MATERIAL.EMPTY);
};

const canPlacePlayerAt = (x: number, y: number): boolean => {
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

const clearPlayer = (): void => {
  for (let py = 0; py < player.height; py++) {
    for (let px = 0; px < player.width; px++) {
      const cx = player.x + px;
      const cy = player.y + py;
      if (getMat(cx, cy) === MATERIAL.PLAYER) setMat(cx, cy, MATERIAL.EMPTY);
    }
  }
};

const placePlayer = (): void => {
  for (let py = 0; py < player.height; py++) {
    for (let px = 0; px < player.width; px++) {
      setMat(player.x + px, player.y + py, MATERIAL.PLAYER);
    }
  }
};

const updatePlayer = (): void => {
  clearPlayer();

  const moveX = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  player.onGround = !canPlacePlayerAt(player.x, player.y + 1);

  if (input.jump && player.onGround) {
    player.vy = -4;
  }

  player.vy = Math.min(player.vy + 1, 4);

  if (moveX !== 0) {
    const nextX = player.x + moveX;
    if (canPlacePlayerAt(nextX, player.y)) player.x = nextX;
  }

  const steps = Math.abs(player.vy);
  const stepDir = Math.sign(player.vy);
  for (let i = 0; i < steps; i++) {
    const nextY = player.y + stepDir;
    if (canPlacePlayerAt(player.x, nextY)) {
      player.y = nextY;
    } else {
      player.vy = 0;
      break;
    }
  }

  placePlayer();
};

const spawnProjectile = (wand: WandDefinition): void => {
  const aimBaseX = player.x + player.width * 0.5;
  const aimBaseY = player.y + 1;
  // Use grid coordinates for aiming
  const dx = input.mouseGridX - aimBaseX;
  const dy = input.mouseGridY - aimBaseY;
  const baseAngle = Math.atan2(dy, dx);
  const dirX = Math.cos(baseAngle);
  const originX = player.x + (dirX >= 0 ? player.width : -1);
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

const explodeAt = (x: number, y: number): void => {
  paintCircle(grid, x, y, 3, makeCell(MATERIAL.FIRE));
  paintCircle(grid, x, y, 4, makeCell(MATERIAL.SMOKE));
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      igniteIfFlammable(x + dx, y + dy);
    }
  }
};

const splashAt = (x: number, y: number, payload: number): void => {
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

const updateProjectiles = (): void => {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]!;
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
      if (!inBounds(gx, gy)) {
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
      if (p.trail !== undefined) {
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

const perCell = (i: number, x: number, y: number): void => {
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

const updateBrush = (): void => {
  if (!input.mouseLeft && !input.mouseRight) return;
  const mat = input.mode === "erase" ? MATERIAL.EMPTY : input.brushMat;
  if (input.mode === "wand" && input.mouseLeft) return;

  // Use grid coordinates for brush painting
  const mx = Math.round(input.mouseGridX);
  const my = Math.round(input.mouseGridY);

  if (input.mouseLeft) {
    paintCircle(grid, mx, my, input.brushSize, makeCell(mat));
  }
  if (input.mouseRight) {
    paintCircle(grid, mx, my, input.brushSize, makeCell(MATERIAL.EMPTY));
  }
};

const updateWand = (): void => {
  if (input.mode !== "wand") return;
  if (!input.mouseLeft) return;
  if (wandCooldown > 0) return;
  const wand = wands[activeWandIndex] ?? wands[0];
  if (!wand) return;
  spawnProjectile(wand);
  wandCooldown = wand.cooldown;
};

const updateHud = (): void => {
  if (!statusEl) return;
  const matName = MATERIAL_LABEL[input.brushMat] ?? "Unknown";
  const wand = wands[activeWandIndex];
  const wandName = wand ? wand.name : "Unknown Wand";
  
  let statusText = `Mode: ${input.mode.toUpperCase()} · Wand: ${wandName} · Brush: ${matName} · Size: ${input.brushSize}`;
  
  // Add infinite mode debug info
  if (infiniteMode && chunkManager) {
    const debug = chunkManager.getDebugInfo();
    const worldPos = chunkManager.getPlayerWorldPos(player.x, player.y);
    statusText += ` · World: (${worldPos.worldX.toFixed(0)}, ${worldPos.worldY.toFixed(0)})`;
    statusText += ` · Chunk: ${debug.playerWorldChunk}`;
  }
  
  statusEl.textContent = statusText;
};

const projectileColor = (payload: number): number => {
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

const drawProjectiles = (): void => {
  for (const projectile of projectiles) {
    const len = Math.max(1, Math.hypot(projectile.vx, projectile.vy));
    const dx = projectile.vx / len;
    const dy = projectile.vy / len;
    const color = projectileColor(projectile.payload);
    const tipColor = packRGBA(255, 255, 255, 255);

    for (let t = 0; t < 4; t++) {
      const px = (projectile.x - dx * t) | 0;
      const py = (projectile.y - dy * t) | 0;
      if (px >= 0 && px < W && py >= 0 && py < H) {
        surface.pixels[py * W + px] = t === 0 ? tipColor : color;
      }
    }
  }
};

const applyPostProcess = (): void => {
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
      const a = (color >>> 24) & 0xff;
      if (a === 0) continue;

      const above = y > 0 ? (pixels[idx - w] ?? 0) : 0;
      const edgeBoost = ((above >>> 24) & 0xff) === 0 ? 0.12 : 0;
      const dither = ((x + y) & 1) === 0 ? -0.02 : 0.02;
      const lightIdx = idx;
      const lightMulR = Math.min(2, 0.45 + lightR[lightIdx]);
      const lightMulG = Math.min(2, 0.45 + lightG[lightIdx]);
      const lightMulB = Math.min(2, 0.45 + lightB[lightIdx]);
      const shade = shadeBase + edgeBoost + dither;

      let r = (color & 0xff) * shade * lightMulR;
      let g = ((color >> 8) & 0xff) * shade * lightMulG;
      let b = ((color >> 16) & 0xff) * shade * lightMulB;

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
      color = (a << 24) | (b << 16) | (g << 8) | r;
      pixels[idx] = color >>> 0;
    }
  }
};

const drawBackground = (): void => {
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

let last = performance.now();
let frames = 0;
let acc = 0;

/**
 * Apply grid shift to all entity positions
 * When the grid shifts, entities need to move in the opposite direction
 * to stay in the same world position
 */
const applyGridShift = (shift: ShiftResult): void => {
  if (!shift.shifted) return;
  
  // Move player in opposite direction of shift to maintain world position
  player.x -= shift.deltaX;
  player.y -= shift.deltaY;
  
  // Move all projectiles
  for (const proj of projectiles) {
    proj.x -= shift.deltaX;
    proj.y -= shift.deltaY;
  }
  
  // Update camera origin to track world position
  camera.worldOriginX += shift.deltaX;
  camera.worldOriginY += shift.deltaY;
};

const tick = (): void => {
  // Update chunk manager in infinite mode (handles grid shifting)
  if (infiniteMode && chunkManager) {
    const shift = chunkManager.update(player.x, player.y);
    applyGridShift(shift);
    
    // Update camera to follow player smoothly
    updateCamera(camera, player.x, player.y);
    
    // Convert screen mouse coords to grid coords
    const gridCoords = screenToGrid(camera, input.mouseX, input.mouseY);
    input.mouseGridX = gridCoords.gridX;
    input.mouseGridY = gridCoords.gridY;
  } else {
    // In fixed mode, mouse coords are direct grid coords
    input.mouseGridX = input.mouseX;
    input.mouseGridY = input.mouseY;
  }
  
  updatePlayer();
  updateBrush();
  updateWand();
  updateProjectiles();

  stepActiveChunks(grid, "bottom-up", perCell);
  renderToSurface(grid, surface, palette);
  drawProjectiles();
  computeLights();
  applyPostProcess();
  presentToCanvas(ctx, surface);
  drawBackground();

  if (wandCooldown > 0) wandCooldown -= 1;

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
  updateHud();
  requestAnimationFrame(tick);
};

const setMode = (mode: "wand" | "brush" | "erase"): void => {
  input.mode = mode;
};

const setBrushFromKey = (key: string): void => {
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

const cycleWand = (direction: number): void => {
  if (wands.length === 0) return;
  activeWandIndex = (activeWandIndex + direction + wands.length) % wands.length;
};

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyA") input.left = true;
  if (event.code === "KeyD") input.right = true;
  if (event.code === "Space") input.jump = true;
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
});

canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  input.mouseX = Math.floor(((event.clientX - rect.left) / rect.width) * W);
  input.mouseY = Math.floor(((event.clientY - rect.top) / rect.height) * H);
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

// ============================================================================
// UI EVENT HANDLERS
// ============================================================================

// Generate World button
const btnGenerate = document.getElementById("btn-generate");
if (btnGenerate) {
  btnGenerate.addEventListener("click", () => {
    const seedInput = document.getElementById("input-seed") as HTMLInputElement | null;
    const biomeSelect = document.getElementById("select-biome") as HTMLSelectElement | null;
    
    const seed = seedInput?.value ? parseInt(seedInput.value, 10) : Math.floor(Math.random() * 100000);
    const biome = (biomeSelect?.value ?? "random") as BiomeType | "random";
    
    // Update input with new seed if random
    if (seedInput && !seedInput.value) {
      seedInput.value = seed.toString();
    }
    
    regenerateWorld(seed, biome);
  });
}

// Biome selector
const selectBiome = document.getElementById("select-biome") as HTMLSelectElement | null;
if (selectBiome) {
  selectBiome.addEventListener("change", () => {
    currentBiome = selectBiome.value as BiomeType | "random";
  });
}

// Seed input
const inputSeed = document.getElementById("input-seed") as HTMLInputElement | null;
if (inputSeed) {
  inputSeed.addEventListener("change", () => {
    const val = parseInt(inputSeed.value, 10);
    if (!isNaN(val)) {
      currentSeed = val;
    }
  });
}

// Infinite mode button
const btnInfinite = document.getElementById("btn-infinite");
if (btnInfinite) {
  btnInfinite.addEventListener("click", () => {
    toggleInfiniteMode();
  });
}

// Keyboard shortcut for regeneration
window.addEventListener("keydown", (event) => {
  if (event.code === "KeyG" && event.ctrlKey) {
    event.preventDefault();
    regenerateWorld(Math.floor(Math.random() * 100000), currentBiome);
  }
});

updateHud();
requestAnimationFrame(tick);
