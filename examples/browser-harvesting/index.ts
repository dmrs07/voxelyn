// index.ts - Main game loop for Cozy Harvest Farm
// Isometric farming game with sub-tile movement, day/night cycle, and crop growth

import {
  createSurface2D,
  clearSurface,
  setPixel,
  fillRect,
  blitColorkey,
  packRGBA,
  type Sprite,
} from "../../packages/voxelyn-core/src/index.js";
import { presentToCanvas } from "../../packages/voxelyn-core/src/adapters/canvas2d.js";

import {
  PALETTE,
  FARMER_SPRITES,
  WHEAT_STAGES,
  TILE_GRASS,
  TILE_TILLED,
  TILE_WATERED,
  TOOL_ICONS,
  particles,
  spawnBurst,
  updateParticles,
  type SpriteFrame,
} from "./sprites.js";

import {
  GRID_SIZE,
  TILE_W,
  TILE_H,
  initGrid,
  getTile,
  tillTile,
  plantCrop,
  waterTile,
  harvestCrop,
  advanceDay,
  gridToScreen,
  forEachTile,
} from "./farm-grid.js";

// ============================================================================
// CANVAS SETUP
// ============================================================================
const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const W = canvas.width;
const H = canvas.height;
const surface = createSurface2D(W, H);

// ============================================================================
// GAME STATE
// ============================================================================
type Direction = 'dr' | 'dl' | 'ur' | 'ul';
type Tool = 'hoe' | 'water' | 'seeds';

const player = {
  // Sub-tile position (4x precision, so 0-31 per tile)
  x: 3.5 * 4, // Start at tile (3,3)
  y: 3.5 * 4,
  // Target for smooth movement
  targetX: 3.5 * 4,
  targetY: 3.5 * 4,
  direction: 'dr' as Direction,
  isMoving: false,
  tool: 'hoe' as Tool,
};

// Inventory
const inventory = {
  seeds: 10,
  wheat: 0,
};

// Time system (60 seconds = 1 full day)
const DAY_LENGTH = 60 * 60; // 60 seconds at 60fps
let gameTick = 0;
let currentDay = 1;
let wasNight = false;

// Input state
const keys: Record<string, boolean> = {};

// ============================================================================
// INPUT HANDLING
// ============================================================================
document.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  
  // Tool switching
  if (e.key === '1') player.tool = 'hoe';
  if (e.key === '2') player.tool = 'water';
  if (e.key === '3') player.tool = 'seeds';
  
  // Action on space
  if (e.key === ' ') {
    e.preventDefault();
    performAction();
  }
});

document.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// ============================================================================
// MOVEMENT (Sub-tile, 4:1 ratio)
// ============================================================================
const MOVE_SPEED = 0.15;
const SUB_TILE = 4; // 4 sub-positions per tile

function updateMovement(): void {
  let dx = 0, dy = 0;
  
  // Isometric movement mapping (WASD to iso directions)
  if (keys['w']) { dx -= 1; dy -= 1; } // up-left in iso
  if (keys['s']) { dx += 1; dy += 1; } // down-right in iso
  if (keys['a']) { dx -= 1; dy += 1; } // down-left in iso
  if (keys['d']) { dx += 1; dy -= 1; } // up-right in iso
  
  // Normalize diagonal movement
  if (dx !== 0 && dy !== 0) {
    dx *= 0.707;
    dy *= 0.707;
  }
  
  if (dx !== 0 || dy !== 0) {
    player.isMoving = true;
    
    // Update facing direction
    if (dx > 0 && dy > 0) player.direction = 'dr';
    else if (dx < 0 && dy > 0) player.direction = 'dl';
    else if (dx > 0 && dy < 0) player.direction = 'ur';
    else if (dx < 0 && dy < 0) player.direction = 'ul';
    else if (dx > 0) player.direction = 'dr';
    else if (dx < 0) player.direction = 'ul';
    else if (dy > 0) player.direction = 'dl';
    else player.direction = 'ur';
    
    // Calculate new position
    const newX = player.x + dx * MOVE_SPEED;
    const newY = player.y + dy * MOVE_SPEED;
    
    // Convert to tile coords for bounds checking
    const tileX = newX / SUB_TILE;
    const tileY = newY / SUB_TILE;
    
    // Keep within grid bounds (with small margin)
    if (tileX >= 0.3 && tileX < GRID_SIZE - 0.3 && tileY >= 0.3 && tileY < GRID_SIZE - 0.3) {
      player.x = newX;
      player.y = newY;
    }
  } else {
    player.isMoving = false;
  }
}

// ============================================================================
// PLAYER ACTIONS
// ============================================================================
function performAction(): void {
  // Get the tile the player is standing on
  const tileX = Math.floor(player.x / SUB_TILE);
  const tileY = Math.floor(player.y / SUB_TILE);
  const tile = getTile(tileX, tileY);
  if (!tile) return;
  
  const { sx, sy } = gridToScreen(tileX, tileY);
  const particleX = sx + TILE_W / 2;
  const particleY = sy + TILE_H / 2;
  
  switch (player.tool) {
    case 'hoe':
      if (tile.crop && tile.crop.stage === 3) {
        // Harvest mature crop
        if (harvestCrop(tileX, tileY)) {
          inventory.wheat++;
          spawnBurst(particleX, particleY, 6, 8); // Golden particles
        }
      } else if (tile.type === 'grass') {
        // Till the ground
        if (tillTile(tileX, tileY)) {
          spawnBurst(particleX, particleY, 2, 5); // Brown dirt particles
        }
      }
      break;
      
    case 'water':
      if (tile.type !== 'grass') {
        if (waterTile(tileX, tileY)) {
          spawnBurst(particleX, particleY, 27, 6); // Blue water particles
        }
      }
      break;
      
    case 'seeds':
      if (inventory.seeds > 0 && tile.type !== 'grass' && !tile.crop) {
        if (plantCrop(tileX, tileY, currentDay)) {
          inventory.seeds--;
          spawnBurst(particleX, particleY, 5, 4); // Green particles
        }
      }
      break;
  }
}

// ============================================================================
// DAY/NIGHT CYCLE
// ============================================================================
function getDayProgress(): number {
  return (gameTick % DAY_LENGTH) / DAY_LENGTH;
}

function isNight(): boolean {
  const progress = getDayProgress();
  return progress > 0.7 || progress < 0.1; // Night: 70%-100% and 0%-10%
}

function getDayTint(): { r: number; g: number; b: number; a: number } {
  const progress = getDayProgress();
  
  // Dawn: 10%-25%, Day: 25%-70%, Dusk: 70%-85%, Night: 85%-100% & 0%-10%
  if (progress < 0.1) {
    // Late night
    return { r: 20, g: 30, b: 60, a: 80 };
  } else if (progress < 0.25) {
    // Dawn - warm orange
    const t = (progress - 0.1) / 0.15;
    return { r: 255, g: 180, b: 100, a: Math.floor(40 * (1 - t)) };
  } else if (progress < 0.7) {
    // Day - no tint
    return { r: 0, g: 0, b: 0, a: 0 };
  } else if (progress < 0.85) {
    // Dusk - warm orange/purple
    const t = (progress - 0.7) / 0.15;
    return { r: 255, g: 150, b: 80, a: Math.floor(30 + t * 30) };
  } else {
    // Night
    const t = (progress - 0.85) / 0.15;
    return { r: 20, g: 30, b: 60, a: Math.floor(60 + t * 20) };
  }
}

function updateDayNight(): void {
  const night = isNight();
  
  // Transition from night to day - advance crops
  if (wasNight && !night) {
    advanceDay();
    currentDay++;
    // Spawn growth particles on crops that grew
    forEachTile((x, y, tile, sx, sy) => {
      if (tile.crop && tile.crop.stage > 0) {
        spawnBurst(sx + TILE_W / 2, sy, 5, 3);
      }
    });
  }
  
  wasNight = night;
}

// ============================================================================
// RENDERING
// ============================================================================

/** Convert indexed sprite frame to blittable Sprite */
function frameToSprite(frame: SpriteFrame, size = 16): Sprite {
  const pixels = new Uint32Array(size * size);
  for (let i = 0; i < frame.length; i++) {
    pixels[i] = PALETTE[frame[i]!]!;
  }
  return { width: size, height: size, pixels };
}

/** Render a single tile */
function renderTile(type: 'grass' | 'tilled' | 'watered', sx: number, sy: number): void {
  const tile = type === 'grass' ? TILE_GRASS : type === 'tilled' ? TILE_TILLED : TILE_WATERED;
  blitColorkey(surface, tile, sx - TILE_W / 2, sy, { colorkey: 0 });
}

/** Render a crop at a tile */
function renderCrop(stage: number, sx: number, sy: number): void {
  const frame = WHEAT_STAGES[stage]!;
  const sprite = frameToSprite(frame);
  // Center crop on tile, offset up a bit
  blitColorkey(surface, sprite, sx - 8, sy - 12, { colorkey: 0 });
}

/** Render the farmer */
function renderFarmer(): void {
  // Convert player position to screen
  const { sx, sy } = gridToScreen(player.x / SUB_TILE, player.y / SUB_TILE);
  
  // Draw a simple chibi character (bigger and clearer)
  const x = Math.round(sx) - 8;
  const y = Math.round(sy) - 14;
  
  // Head - large brown/tan square
  fillRect(surface, x + 2, y + 0, 12, 8, PALETTE[12]); // dark brown hair
  fillRect(surface, x + 3, y + 2, 10, 5, PALETTE[10]); // skin tone
  
  // Eyes - white dots
  fillRect(surface, x + 5, y + 3, 2, 2, PALETTE[16]); // white
  fillRect(surface, x + 9, y + 3, 2, 2, PALETTE[16]); // white
  
  // Body - orange overalls
  fillRect(surface, x + 2, y + 8, 12, 5, PALETTE[17]); // overalls
  
  // Legs - brown
  fillRect(surface, x + 4, y + 13, 3, 2, PALETTE[2]); // left leg
  fillRect(surface, x + 9, y + 13, 3, 2, PALETTE[2]); // right leg
}

/** Render particles */
function renderParticles(): void {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    if (alpha <= 0) continue;
    
    // Simple alpha blend by drawing only if life is high enough
    if (alpha > 0.3) {
      setPixel(surface, Math.floor(p.x), Math.floor(p.y), p.color);
      setPixel(surface, Math.floor(p.x) + 1, Math.floor(p.y), p.color);
      setPixel(surface, Math.floor(p.x), Math.floor(p.y) + 1, p.color);
    } else {
      setPixel(surface, Math.floor(p.x), Math.floor(p.y), p.color);
    }
  }
}

/** Apply day/night tint overlay */
function applyTint(): void {
  const tint = getDayTint();
  if (tint.a === 0) return;
  
  // Simple screen-blend: darken/tint entire surface
  for (let i = 0; i < surface.pixels.length; i++) {
    const px = surface.pixels[i]!;
    const pr = px & 0xff;
    const pg = (px >> 8) & 0xff;
    const pb = (px >> 16) & 0xff;
    const pa = (px >> 24) & 0xff;
    
    if (pa === 0) continue; // Skip transparent
    
    // Blend with tint
    const t = tint.a / 255;
    const nr = Math.floor(pr * (1 - t) + tint.r * t);
    const ng = Math.floor(pg * (1 - t) + tint.g * t);
    const nb = Math.floor(pb * (1 - t) + tint.b * t);
    
    surface.pixels[i] = packRGBA(nr, ng, nb, pa);
  }
}

/** Render HUD (inventory, tool, time) */
function renderHUD(): void {
  const barY = H - 20;
  
  // Background bar
  fillRect(surface, 0, barY, W, 20, packRGBA(30, 25, 20, 200));
  
  // Tool icons
  const tools: Tool[] = ['hoe', 'water', 'seeds'];
  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i]!;
    const icon = TOOL_ICONS[tool]!;
    const x = 10 + i * 24;
    const y = barY + 6;
    
    // Highlight selected tool
    if (player.tool === tool) {
      fillRect(surface, x - 2, y - 2, 12, 12, packRGBA(255, 220, 100, 150));
    }
    
    // Draw icon
    for (let py = 0; py < icon.size; py++) {
      for (let px = 0; px < icon.size; px++) {
        const colorIdx = icon.data[py * icon.size + px]!;
        if (colorIdx !== 0) {
          setPixel(surface, x + px, y + py, PALETTE[colorIdx]!);
        }
      }
    }
  }
  
  // Inventory counts
  drawText(`Seeds:${inventory.seeds}`, 95, barY + 8);
  drawText(`Wheat:${inventory.wheat}`, 165, barY + 8);
  
  // Day counter and time
  const progress = getDayProgress();
  const timeIcon = isNight() ? '☾' : '☀';
  drawText(`Day ${currentDay} ${timeIcon}`, 250, barY + 8);
  
  // Time progress bar
  fillRect(surface, 250, barY + 14, 60, 3, packRGBA(20, 20, 20, 255));
  fillRect(surface, 250, barY + 14, Math.floor(60 * progress), 3, 
    isNight() ? packRGBA(100, 100, 180, 255) : packRGBA(255, 200, 100, 255));
}

/** Simple text rendering (using built-in positions, no font) */
function drawText(text: string, x: number, y: number): void {
  // Ultra-simple: just draw colored rectangles as placeholder
  // In a real game you'd have a bitmap font
  const charW = 5;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch !== ' ') {
      // Draw a small block for each character
      const color = packRGBA(240, 230, 210, 255);
      for (let py = 0; py < 5; py++) {
        for (let px = 0; px < 4; px++) {
          // Simple pattern based on character
          const on = getCharPixel(ch, px, py);
          if (on) setPixel(surface, x + i * charW + px, y + py, color);
        }
      }
    }
  }
}

/** Mini 4x5 font patterns */
function getCharPixel(ch: string, x: number, y: number): boolean {
  const fonts: Record<string, number[]> = {
    '0': [0b0110, 0b1001, 0b1001, 0b1001, 0b0110],
    '1': [0b0010, 0b0110, 0b0010, 0b0010, 0b0111],
    '2': [0b0110, 0b1001, 0b0010, 0b0100, 0b1111],
    '3': [0b1110, 0b0001, 0b0110, 0b0001, 0b1110],
    '4': [0b1001, 0b1001, 0b1111, 0b0001, 0b0001],
    '5': [0b1111, 0b1000, 0b1110, 0b0001, 0b1110],
    '6': [0b0110, 0b1000, 0b1110, 0b1001, 0b0110],
    '7': [0b1111, 0b0001, 0b0010, 0b0100, 0b0100],
    '8': [0b0110, 0b1001, 0b0110, 0b1001, 0b0110],
    '9': [0b0110, 0b1001, 0b0111, 0b0001, 0b0110],
    'S': [0b0111, 0b1000, 0b0110, 0b0001, 0b1110],
    'e': [0b0000, 0b0110, 0b1111, 0b1000, 0b0110],
    'd': [0b0001, 0b0001, 0b0111, 0b1001, 0b0111],
    's': [0b0000, 0b0110, 0b1100, 0b0010, 0b1100],
    ':': [0b0000, 0b0100, 0b0000, 0b0100, 0b0000],
    'W': [0b1001, 0b1001, 0b1001, 0b1111, 0b1001],
    'h': [0b1000, 0b1000, 0b1110, 0b1001, 0b1001],
    'a': [0b0000, 0b0110, 0b0001, 0b0111, 0b0111],
    't': [0b0100, 0b1110, 0b0100, 0b0100, 0b0011],
    'D': [0b1110, 0b1001, 0b1001, 0b1001, 0b1110],
    'y': [0b0000, 0b1001, 0b0101, 0b0010, 0b1100],
    ' ': [0b0000, 0b0000, 0b0000, 0b0000, 0b0000],
    '☀': [0b0100, 0b1110, 0b1110, 0b1110, 0b0100],
    '☾': [0b0110, 0b1000, 0b1000, 0b1000, 0b0110],
  };
  const pattern = fonts[ch];
  if (!pattern) return false;
  return ((pattern[y]! >> (3 - x)) & 1) === 1;
}

// ============================================================================
// MAIN GAME LOOP
// ============================================================================
function gameLoop(): void {
  gameTick++;
  
  // Update
  updateMovement();
  updateDayNight();
  updateParticles();
  
  // Clear with sky color (varies by time)
  const skyBase = isNight() ? packRGBA(25, 30, 45, 255) : packRGBA(135, 180, 220, 255);
  clearSurface(surface, skyBase);
  
  // Render all tiles and crops in isometric order
  forEachTile((x, y, tile, sx, sy) => {
    // Draw tile
    renderTile(tile.type, sx, sy);
    
    // Draw crop if present
    if (tile.crop) {
      renderCrop(tile.crop.stage, sx, sy);
    }
  });
  
  // Player always rendered last (on top of all tiles)
  renderFarmer();
  
  // Particles on top
  renderParticles();
  
  // Day/night tint
  applyTint();
  
  // HUD always on top
  renderHUD();
  
  // Present to canvas
  presentToCanvas(ctx, surface);
  
  requestAnimationFrame(gameLoop);
}

// ============================================================================
// START GAME
// ============================================================================
initGrid();
gameLoop();
