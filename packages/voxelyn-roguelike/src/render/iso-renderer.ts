import { forEachIsoOrder, getVoxel, makeDrawKey, projectIso } from '@voxelyn/core';
import {
  DITHER_PATTERN_SIZE,
  FEATURE_BIOFLUID,
  FEATURE_POPUP_SCALE,
  FEATURE_PROP_BEACON,
  FEATURE_PROP_CRATE,
  FEATURE_PROP_DEBRIS,
  FEATURE_PROP_FUNGAL_CLUSTER,
  FEATURE_ROOT_BARRIER,
  FEATURE_SHADOW_ALPHA,
  FEATURE_TILT_X,
  FEATURE_TRACK,
  FOG_BASE_RANGE,
  WALL_BASE_HEIGHT_VISIBLE,
} from '../game/constants';
import type {
  Entity,
  GameState,
  LevelInteractable,
  ParticleState,
  ProjectileState,
} from '../game/types';
import { drawHud, HUD_HEIGHT } from '../ui/hud';
import { drawPowerUpMenu } from '../ui/powerup-menu';
import { isCellInActiveCorridorEvent } from '../world/corridor-events';
import { computeFogVisibility, type FogLightSource } from './fog';
import { computeOcclusionMask } from './occlusion';
import { drawBillboardSprite, drawEntitySprite } from './sprites';
import {
  getBeaconSprite,
  getCrateSprite,
  getCrystalSprite,
  getDebrisSprite,
  getFungalClusterSprite,
  getGateSprite,
  getPortalSprite,
  getRootBarrierSprite,
  getTerminalSprite,
} from './feature-sprites';
import { MATERIALS } from '../world/materials';

const index2D = (width: number, x: number, y: number): number => y * width + x;

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

const unpack = (color: number): [number, number, number, number] => {
  const r = color & 0xff;
  const g = (color >> 8) & 0xff;
  const b = (color >> 16) & 0xff;
  const a = ((color >> 24) & 0xff) / 255;
  return [r, g, b, a];
};

const hashNoise = (x: number, y: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263 + seed * 2654435761) >>> 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) & 0xff) / 255;
};

const drawDiamond = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileW: number,
  tileH: number,
  fillStyle: string
): void => {
  ctx.beginPath();
  ctx.moveTo(x, y - tileH / 2);
  ctx.lineTo(x + tileW / 2, y);
  ctx.lineTo(x, y + tileH / 2);
  ctx.lineTo(x - tileW / 2, y);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
};

const drawWallBlock = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileW: number,
  tileH: number,
  blockHeight: number,
  topColor: string,
  leftColor: string,
  rightColor: string
): void => {
  ctx.beginPath();
  ctx.moveTo(x - tileW / 2, y);
  ctx.lineTo(x, y + tileH / 2);
  ctx.lineTo(x, y + tileH / 2 - blockHeight);
  ctx.lineTo(x - tileW / 2, y - blockHeight);
  ctx.closePath();
  ctx.fillStyle = leftColor;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + tileW / 2, y);
  ctx.lineTo(x, y + tileH / 2);
  ctx.lineTo(x, y + tileH / 2 - blockHeight);
  ctx.lineTo(x + tileW / 2, y - blockHeight);
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();

  drawDiamond(ctx, x, y - blockHeight, tileW, tileH, topColor);
};

const buildWallSectionPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileW: number,
  tileH: number,
  blockHeight: number
): void => {
  ctx.beginPath();
  ctx.moveTo(x - tileW / 2, y);
  ctx.lineTo(x, y + tileH / 2);
  ctx.lineTo(x, y + tileH / 2 - blockHeight);
  ctx.lineTo(x - tileW / 2, y - blockHeight);
  ctx.closePath();

  ctx.moveTo(x + tileW / 2, y);
  ctx.lineTo(x, y + tileH / 2);
  ctx.lineTo(x, y + tileH / 2 - blockHeight);
  ctx.lineTo(x + tileW / 2, y - blockHeight);
  ctx.closePath();

  ctx.moveTo(x, y - blockHeight - tileH / 2);
  ctx.lineTo(x + tileW / 2, y - blockHeight);
  ctx.lineTo(x, y - blockHeight + tileH / 2);
  ctx.lineTo(x - tileW / 2, y - blockHeight);
  ctx.closePath();
};

const applyDitherToWallSection = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileW: number,
  tileH: number,
  blockHeight: number,
  phase = 0,
  compositeOperation: GlobalCompositeOperation = 'destination-out',
  color = 'rgba(0,0,0,0.9)'
): void => {
  ctx.save();
  buildWallSectionPath(ctx, x, y, tileW, tileH, blockHeight);
  ctx.clip();

  ctx.globalCompositeOperation = compositeOperation;
  ctx.fillStyle = color;
  const minX = Math.floor(x - tileW / 2);
  const maxX = Math.ceil(x + tileW / 2);
  const minY = Math.floor(y - blockHeight - tileH / 2);
  const maxY = Math.ceil(y + tileH / 2);
  const stride = Math.max(2, DITHER_PATTERN_SIZE);
  const phaseOffset = Math.abs(Math.floor(phase)) % stride;

  for (let py = minY; py <= maxY; py += stride) {
    for (let px = minX; px <= maxX; px += stride) {
      const gx = Math.floor((px - minX + phaseOffset) / stride);
      const gy = Math.floor((py - minY) / stride);
      const diagonal = ((gx + gy) & 1) === 0;
      const secondary = ((gx * 3 + gy * 2) & 3) === 0;
      if (!diagonal && !secondary) continue;
      ctx.fillRect(px + 1, py + 1, Math.max(1, stride - 2), Math.max(1, stride - 2));
    }
  }

  ctx.restore();
};

const drawWallCutRim = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileW: number,
  tileH: number,
  intensity: number
): void => {
  const edge = clamp(0.35 + intensity * 0.45, 0.25, 0.9);

  ctx.save();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = `rgba(224, 238, 255, ${edge.toFixed(3)})`;
  ctx.beginPath();
  ctx.moveTo(x - tileW / 2 + 1, y + 0.5);
  ctx.lineTo(x, y + tileH / 2 - 0.5);
  ctx.lineTo(x + tileW / 2 - 1, y + 0.5);
  ctx.stroke();

  ctx.strokeStyle = `rgba(56, 68, 88, ${(edge * 0.55).toFixed(3)})`;
  ctx.beginPath();
  ctx.moveTo(x - tileW / 2 + 1, y - 0.5);
  ctx.lineTo(x, y - tileH / 2 + 0.5);
  ctx.lineTo(x + tileW / 2 - 1, y - 0.5);
  ctx.stroke();
  ctx.restore();
};

export class IsoRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  // Zoom-in geral para deixar o heroi e o combate mais em destaque no canvas.
  private readonly zoom = 1.4;
  private readonly tileW = Math.round(48 * this.zoom);
  private readonly tileH = Math.round(24 * this.zoom);
  private readonly zStep = Math.round(20 * this.zoom);
  private readonly wallHeight = Math.round(56 * this.zoom);
  private readonly entitySpriteScale = Math.max(2, Math.round(2 * this.zoom));
  private readonly entityYOffset = Math.round(8 * this.zoom);
  private readonly effectYOffset = Math.round(10 * this.zoom);
  private readonly hudHeight = HUD_HEIGHT;
  private cameraX = 0;
  private cameraY = 0;
  private cameraInitialized = false;
  private passableMask = new Uint8Array(0);
  private visibilityMask = new Uint8Array(0);
  private smoothVisibility = new Float32Array(0);
  private occlusionMask = new Uint8Array(0);
  private cachedLevelSeed = -1;
  private colorLightCache = new Map<string, string>();
  private interactablesByCell = new Map<number, LevelInteractable[]>();
  private entityVisualPos = new Map<string, { x: number; y: number }>();
  private lastFrameTime = 0;
  private currentDt = 0.016;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Nao foi possivel inicializar CanvasRenderingContext2D');
    }
    this.ctx = ctx;
    this.attachMouseListener();
  }

  private attachMouseListener(): void {
    if (this.mouseListenerAttached) return;
    this.mouseListenerAttached = true;

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mouseX = -1;
      this.mouseY = -1;
      this.hoveredTile = null;
    });
  }

  /**
   * Convert screen coordinates to tile coordinates (inverse iso projection).
   */
  private screenToTile(sx: number, sy: number, levelWidth: number, levelHeight: number): { x: number; y: number } | null {
    // Reverse the camera offset
    const rx = sx - this.cameraX;
    const ry = sy - this.cameraY;

    // Inverse isometric projection:
    // sx = (x - y) * (tileW / 2)
    // sy = (x + y) * (tileH / 2)
    // Solving for x and y:
    // x = (sx / (tileW/2) + sy / (tileH/2)) / 2
    // y = (sy / (tileH/2) - sx / (tileW/2)) / 2
    const halfW = this.tileW / 2;
    const halfH = this.tileH / 2;
    const tileX = Math.floor((rx / halfW + ry / halfH) / 2 + levelWidth / 2);
    const tileY = Math.floor((ry / halfH - rx / halfW) / 2 + levelHeight / 2);

    if (tileX < 0 || tileY < 0 || tileX >= levelWidth || tileY >= levelHeight) {
      return null;
    }
    return { x: tileX, y: tileY };
  }

  private ensureBuffers(state: GameState): void {
    const size = state.level.width * state.level.height;
    if (this.passableMask.length !== size) {
      this.passableMask = new Uint8Array(size);
      this.visibilityMask = new Uint8Array(size);
      this.smoothVisibility = new Float32Array(size);
      this.occlusionMask = new Uint8Array(size);
      this.cachedLevelSeed = -1;
    }

    if (this.cachedLevelSeed === state.level.seed) return;

    for (let y = 0; y < state.level.height; y += 1) {
      for (let x = 0; x < state.level.width; x += 1) {
        const i = index2D(state.level.width, x, y);
        this.passableMask[i] = state.level.heightMap[i] < 0.5 ? 1 : 0;
      }
    }

    // Reset smooth visibility on level change
    this.smoothVisibility.fill(0);
    this.entityVisualPos.clear();

    if (state.level.occludableWalls.length !== size) {
      state.level.occludableWalls = new Uint8Array(size);
    }

    this.interactablesByCell.clear();
    for (const interactable of state.level.interactables) {
      const key = index2D(state.level.width, interactable.x, interactable.y);
      const bucket = this.interactablesByCell.get(key);
      if (bucket) {
        bucket.push(interactable);
      } else {
        this.interactablesByCell.set(key, [interactable]);
      }
    }

    this.cachedLevelSeed = state.level.seed;
  }

  /**
   * Update smooth fog visibility by lerping toward target values.
   */
  private updateSmoothVisibility(dt: number): void {
    const lerpSpeed = 8.0; // Higher = faster reveal
    const factor = Math.min(1, dt * lerpSpeed);

    for (let i = 0; i < this.visibilityMask.length; i++) {
      const target = this.visibilityMask[i];
      const current = this.smoothVisibility[i];
      if (current < target) {
        // Revealing: lerp up
        this.smoothVisibility[i] = current + (target - current) * factor;
      } else if (current > target) {
        // Hiding (shouldn't happen often): lerp down slower
        this.smoothVisibility[i] = current + (target - current) * factor * 0.3;
      }
    }
  }

  /**
   * Get interpolated visual position for an entity.
   */
  private getEntityVisualPos(entity: Entity, dt: number): { x: number; y: number } {
    const lerpSpeed = 12.0; // Higher = snappier movement
    const factor = Math.min(1, dt * lerpSpeed);

    let vpos = this.entityVisualPos.get(entity.id);
    if (!vpos) {
      vpos = { x: entity.x, y: entity.y };
      this.entityVisualPos.set(entity.id, vpos);
    }

    // Lerp toward actual position
    vpos.x += (entity.x - vpos.x) * factor;
    vpos.y += (entity.y - vpos.y) * factor;

    return vpos;
  }

  private lightColor(color: number, factor: number): string {
    const q = clamp(Math.round(factor * 100), 5, 180);
    const key = `${color}:${q}`;
    const cached = this.colorLightCache.get(key);
    if (cached) return cached;

    const [r, g, b, a] = unpack(color);
    const lit = `rgba(${Math.round(clamp(r * (q / 100), 0, 255))}, ${Math.round(clamp(g * (q / 100), 0, 255))}, ${Math.round(clamp(b * (q / 100), 0, 255))}, ${a.toFixed(3)})`;
    this.colorLightCache.set(key, lit);
    return lit;
  }

  private computeFogMask(state: GameState, heroX: number, heroY: number): void {
    const lightSources: FogLightSource[] = [];
    for (const light of state.level.fungalLights) {
      lightSources.push({ x: light.x, y: light.y, radius: light.radius });
    }
    for (const projectile of state.projectiles) {
      if (!projectile.alive) continue;
      lightSources.push({ x: projectile.x, y: projectile.y, radius: 2 });
    }

    computeFogVisibility({
      width: state.level.width,
      height: state.level.height,
      passableMask: this.passableMask,
      heroX,
      heroY,
      baseRange: FOG_BASE_RANGE,
      lightSources,
      output: this.visibilityMask,
    });
  }

  private tileGlow(state: GameState, x: number, y: number): number {
    let glow = 0;

    for (const light of state.level.fungalLights) {
      const dx = x - light.x;
      const dy = y - light.y;
      const dist = Math.hypot(dx, dy);
      if (dist > light.radius) continue;

      const pulse = 0.72 + (Math.sin(state.simTick * 0.08 + light.x * 0.7 + light.y * 0.5) * 0.28 + 0.28);
      const falloff = 1 - dist / Math.max(0.001, light.radius);
      glow += falloff * light.intensity * pulse * 0.28;
    }

    for (const projectile of state.projectiles) {
      if (!projectile.alive) continue;
      const dx = x - projectile.x;
      const dy = y - projectile.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 2.5) continue;
      glow += (1 - dist / 2.5) * 0.35;
    }

    return glow;
  }

  private clampCamera(
    targetX: number,
    targetY: number,
    mapW: number,
    mapH: number,
    screenW: number,
    screenH: number
  ): { x: number; y: number } {
    const corners = [
      projectIso(0 - mapW / 2, 0 - mapH / 2, 0, this.tileW, this.tileH, this.zStep),
      projectIso((mapW - 1) - mapW / 2, 0 - mapH / 2, 0, this.tileW, this.tileH, this.zStep),
      projectIso(0 - mapW / 2, (mapH - 1) - mapH / 2, 0, this.tileW, this.tileH, this.zStep),
      projectIso((mapW - 1) - mapW / 2, (mapH - 1) - mapH / 2, 0, this.tileW, this.tileH, this.zStep),
    ];

    let minSx = Number.POSITIVE_INFINITY;
    let maxSx = Number.NEGATIVE_INFINITY;
    let minSy = Number.POSITIVE_INFINITY;
    let maxSy = Number.NEGATIVE_INFINITY;
    for (const corner of corners) {
      minSx = Math.min(minSx, corner.sx);
      maxSx = Math.max(maxSx, corner.sx);
      minSy = Math.min(minSy, corner.sy - this.wallHeight);
      maxSy = Math.max(maxSy, corner.sy + this.tileH / 2);
    }

    const marginX = 32;
    const topBound = this.hudHeight + 24;
    const bottomBound = screenH - 24;

    const minCamX = screenW - marginX - maxSx;
    const maxCamX = marginX - minSx;
    const minCamY = bottomBound - maxSy;
    const maxCamY = topBound - minSy;

    const x = minCamX <= maxCamX
      ? Math.max(minCamX, Math.min(maxCamX, targetX))
      : (minCamX + maxCamX) / 2;
    const y = minCamY <= maxCamY
      ? Math.max(minCamY, Math.min(maxCamY, targetY))
      : (minCamY + maxCamY) / 2;

    return { x, y };
  }

  private drawObjectiveIndicator(state: GameState): void {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    const exit = state.level.exit;
    const floor = state.floorNumber;
    const goalLabel = floor === 10 ? 'Nucleo' : 'Saida';

    const iso = projectIso(
      exit.x - state.level.width / 2,
      exit.y - state.level.height / 2,
      0,
      this.tileW,
      this.tileH,
      this.zStep
    );
    const sx = this.cameraX + iso.sx;
    const sy = this.cameraY + iso.sy;
    const inView =
      sx >= 16 &&
      sx <= width - 16 &&
      sy >= this.hudHeight + 16 &&
      sy <= height - 16;

    const pulse = (Math.sin(state.simTick * 0.12) + 1) * 0.5;

    ctx.save();
    if (inView) {
      ctx.strokeStyle = floor === 10 ? 'rgba(226,92,255,0.85)' : 'rgba(255,214,94,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 8);
      ctx.lineTo(sx, sy - 30 - pulse * 10);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sx, sy - 4, 8 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(238,244,255,0.95)';
      ctx.fillText(goalLabel, sx, sy - 36 - pulse * 10);
    } else {
      const centerX = width / 2;
      const centerY = (this.hudHeight + height) / 2;
      const vx = sx - centerX;
      const vy = sy - centerY;
      const len = Math.hypot(vx, vy) || 1;
      const nx = vx / len;
      const ny = vy / len;

      const indicatorX = Math.max(24, Math.min(width - 24, centerX + nx * (width * 0.38)));
      const indicatorY = Math.max(this.hudHeight + 24, Math.min(height - 24, centerY + ny * (height * 0.35)));
      const angle = Math.atan2(ny, nx);
      const size = 10;

      ctx.translate(indicatorX, indicatorY);
      ctx.rotate(angle);
      ctx.fillStyle = floor === 10 ? 'rgba(226,92,255,0.95)' : 'rgba(255,214,94,0.95)';
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size, size * 0.75);
      ctx.lineTo(-size, -size * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-angle);
      ctx.translate(-indicatorX, -indicatorY);

      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(238,244,255,0.95)';
      ctx.fillText(goalLabel, indicatorX, indicatorY - 14);
    }
    ctx.restore();
  }

  private drawEntity(entity: Entity, state: GameState): void {
    const ctx = this.ctx;

    // Use interpolated visual position for smooth movement
    const vpos = this.getEntityVisualPos(entity, this.currentDt);

    const iso = projectIso(
      vpos.x - state.level.width / 2,
      vpos.y - state.level.height / 2,
      entity.z,
      this.tileW,
      this.tileH,
      this.zStep
    );

    // Grounding offset - positive pushes sprite down toward ground
    // Enemies keep old offset behavior inverted
    const groundOffset = entity.kind === 'player' ? 12 : -6;
    
    // Movement bob only when moving, subtle breathing when idle
    const isMoving = entity.animIntent === 'move';
    const bobAmplitude = isMoving ? (entity.kind === 'player' ? 1.2 : 0.9) : 0.4;
    const bobFreq = isMoving ? 0.35 : 0.08;
    const bob = Math.sin((state.simTick + entity.animPhase * 2) * bobFreq) * bobAmplitude;

    // Tile center position
    const tileCenterX = this.cameraX + iso.sx;
    const groundY = this.cameraY + iso.sy;
    
    // Sprite position: centered on tile, with grounding offset
    const sx = tileCenterX;
    const sy = groundY + groundOffset + bob;

    // Draw ground shadow ellipse - centered on tile
    const shadowScale = entity.kind === 'player' ? 1.2 : 0.85;
    const shadowAlpha = 0.22 + (isMoving ? 0.04 : 0);
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(tileCenterX, groundY + 4, 12 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const flash = entity.hitFlashUntilMs > state.simTimeMs;
    drawEntitySprite(ctx, entity, sx, sy, state.simTick, this.entitySpriteScale, flash);

    if (entity.kind === 'enemy') {
      const hpRatio = Math.max(0, Math.min(1, entity.hp / Math.max(1, entity.maxHp)));
      ctx.fillStyle = 'rgba(28,34,42,0.95)';
      ctx.fillRect(sx - 12, sy - 36, 24, 3);
      ctx.fillStyle = 'rgba(241,110,110,0.95)';
      ctx.fillRect(sx - 12, sy - 36, Math.floor(24 * hpRatio), 3);

      if (entity.alertUntilMs > state.simTimeMs) {
        ctx.fillStyle = 'rgba(255,230,116,0.98)';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', sx, sy - 42);
      }
    }
  }

  private drawFeatureOverlay(
    state: GameState,
    x: number,
    y: number,
    idx: number,
    sx: number,
    sy: number,
    light: number
  ): void {
    const ctx = this.ctx;
    const flags = state.level.featureMap[idx] ?? 0;

    const alphaScale = clamp(0.48 + (light - 0.45) * 0.4, 0.25, 0.85);

    // Flat ground overlays only (BIOFLUID, TRACK, SPORE_VENT)
    if ((flags & FEATURE_BIOFLUID) !== 0) {
      ctx.fillStyle = `rgba(74, 220, 188, ${(0.22 * alphaScale).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 3, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if ((flags & FEATURE_TRACK) !== 0) {
      ctx.strokeStyle = `rgba(130, 146, 170, ${(0.36 * alphaScale).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx - 10, sy + 2);
      ctx.lineTo(sx + 10, sy + 2);
      ctx.moveTo(sx - 8, sy + 5);
      ctx.lineTo(sx + 8, sy + 5);
      ctx.stroke();
    }

    // Spore vent from interactables (flat pulsing circle)
    const interactables = this.interactablesByCell.get(idx) ?? [];
    for (const item of interactables) {
      if (item.type === 'spore_vent') {
        const pulse = (Math.sin(state.simTick * 0.13 + item.x * 0.4 + item.y * 0.3) + 1) * 0.5;
        ctx.fillStyle = `rgba(140, 244, 158, ${(0.24 + pulse * 0.25).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 2 + pulse * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Dynamic cells and corridor events remain flat
    const dynamic = state.level.dynamicCells.find((cell) => cell.x === x && cell.y === y);
    if (dynamic) {
      if (dynamic.phase === 'warning') {
        const pulse = (Math.sin(state.simTick * 0.32 + x * 0.4 + y * 0.3) + 1) * 0.5;
        ctx.strokeStyle = `rgba(248, 194, 96, ${(0.5 + pulse * 0.28).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - 10, sy + 4);
        ctx.lineTo(sx + 10, sy - 2);
        ctx.moveTo(sx - 10, sy - 2);
        ctx.lineTo(sx + 10, sy + 4);
        ctx.stroke();
      } else if (dynamic.phase === 'closed') {
        if (dynamic.kind === 'spore_lane') {
          const pulse = (Math.sin(state.simTick * 0.22 + x * 0.5 + y * 0.2) + 1) * 0.5;
          ctx.fillStyle = `rgba(142, 255, 170, ${(0.2 + pulse * 0.24).toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(sx, sy + 2, 12, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = 'rgba(242, 116, 106, 0.92)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx - 10, sy - 1);
          ctx.lineTo(sx + 10, sy + 5);
          ctx.moveTo(sx - 10, sy + 5);
          ctx.lineTo(sx + 10, sy - 1);
          ctx.stroke();
        }
      }
    }

    const activeEvent = isCellInActiveCorridorEvent(state.level, x, y, state.simTimeMs);
    if (activeEvent) {
      const pulse = (Math.sin(state.simTick * 0.3 + x * 0.2 + y * 0.2) + 1) * 0.5;
      if (activeEvent.kind === 'spore_wave') {
        ctx.fillStyle = `rgba(116, 240, 146, ${(0.12 + pulse * 0.2).toFixed(3)})`;
      } else {
        ctx.fillStyle = `rgba(246, 185, 104, ${(0.1 + pulse * 0.16).toFixed(3)})`;
      }
      ctx.beginPath();
      ctx.ellipse(sx, sy + 1, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draws a pop-up feature using billboard sprites.
   * Called from draw commands for proper depth sorting.
   */
  private drawPopupFeature(
    state: GameState,
    x: number,
    y: number,
    idx: number,
    sx: number,
    sy: number,
    light: number
  ): void {
    const ctx = this.ctx;
    const flags = state.level.featureMap[idx] ?? 0;
    const alpha = clamp(0.48 + (light - 0.45) * 0.4, 0.25, 0.95);
    const options = {
      tiltX: FEATURE_TILT_X,
      shadowAlpha: FEATURE_SHADOW_ALPHA,
      shadowScale: 0.35,
      alpha,
    };

    // Pop-up feature sprites from feature flags
    if ((flags & FEATURE_ROOT_BARRIER) !== 0) {
      drawBillboardSprite(ctx, getRootBarrierSprite(), sx, sy, FEATURE_POPUP_SCALE, options);
    }

    if ((flags & FEATURE_PROP_FUNGAL_CLUSTER) !== 0) {
      const sprite = getFungalClusterSprite(state.simTick, x, y);
      drawBillboardSprite(ctx, sprite, sx, sy, FEATURE_POPUP_SCALE, options);
    }

    if ((flags & FEATURE_PROP_DEBRIS) !== 0) {
      drawBillboardSprite(ctx, getDebrisSprite(), sx, sy, FEATURE_POPUP_SCALE, options);
    }

    if ((flags & FEATURE_PROP_CRATE) !== 0) {
      drawBillboardSprite(ctx, getCrateSprite(), sx, sy, FEATURE_POPUP_SCALE, options);
    }

    if ((flags & FEATURE_PROP_BEACON) !== 0) {
      const sprite = getBeaconSprite(state.simTick, x, y);
      drawBillboardSprite(ctx, sprite, sx, sy, FEATURE_POPUP_SCALE, options);
    }

    // Pop-up interactables
    const interactables = this.interactablesByCell.get(idx) ?? [];
    for (const item of interactables) {
      if (item.type === 'terminal') {
        const sprite = getTerminalSprite(item.active);
        drawBillboardSprite(ctx, sprite, sx, sy, FEATURE_POPUP_SCALE, options);
      }

      if (item.type === 'gate') {
        const sprite = getGateSprite(item.open);
        drawBillboardSprite(ctx, sprite, sx, sy, FEATURE_POPUP_SCALE, options);
      }

      if (item.type === 'one_way_portal') {
        const sprite = getPortalSprite(state.simTick, item.x, item.y);
        drawBillboardSprite(ctx, sprite, sx, sy, FEATURE_POPUP_SCALE, options);
      }

      if (item.type === 'crystal' && !item.used) {
        drawBillboardSprite(ctx, getCrystalSprite(), sx, sy, FEATURE_POPUP_SCALE, options);
      }
    }
  }

  /**
   * Check if a cell has any pop-up features that need depth-sorted rendering.
   */
  private hasPopupFeatures(idx: number): boolean {
    const flags = this.currentFeatureMap[idx] ?? 0;
    const popupFlags =
      FEATURE_ROOT_BARRIER |
      FEATURE_PROP_FUNGAL_CLUSTER |
      FEATURE_PROP_DEBRIS |
      FEATURE_PROP_CRATE |
      FEATURE_PROP_BEACON;

    if ((flags & popupFlags) !== 0) return true;

    const interactables = this.interactablesByCell.get(idx) ?? [];
    for (const item of interactables) {
      if (
        item.type === 'terminal' ||
        item.type === 'gate' ||
        item.type === 'one_way_portal' ||
        (item.type === 'crystal' && !item.used)
      ) {
        return true;
      }
    }
    return false;
  }

  private currentFeatureMap: Uint16Array = new Uint16Array(0);
  private mouseX = -1;
  private mouseY = -1;
  private hoveredTile: { x: number; y: number } | null = null;
  private mouseListenerAttached = false;

  private drawOccludedWall(
    sx: number,
    sy: number,
    topColor: string,
    leftColor: string,
    rightColor: string,
    simTick: number
  ): void {
    const ctx = this.ctx;
    const baseHeight = Math.min(this.wallHeight - 6, WALL_BASE_HEIGHT_VISIBLE);
    const upperHeight = Math.max(8, Math.floor((this.wallHeight - baseHeight) * 0.58));
    const cutY = sy - baseHeight;
    const shimmer = (Math.sin(simTick * 0.18 + sx * 0.018 + sy * 0.011) + 1) * 0.5;

    drawWallBlock(
      ctx,
      sx,
      sy,
      this.tileW,
      this.tileH,
      baseHeight,
      topColor,
      leftColor,
      rightColor
    );

    ctx.save();
    ctx.globalAlpha = 0.42 + shimmer * 0.16;
    drawWallBlock(
      ctx,
      sx,
      cutY,
      this.tileW,
      this.tileH,
      upperHeight,
      topColor,
      leftColor,
      rightColor
    );
    ctx.restore();

    applyDitherToWallSection(
      ctx,
      sx,
      cutY,
      this.tileW,
      this.tileH,
      upperHeight,
      shimmer * 10
    );

    drawWallCutRim(ctx, sx, cutY, this.tileW, this.tileH, shimmer);
  }

  private drawOccludedWallFrontDither(
    sx: number,
    sy: number,
    simTick: number
  ): void {
    const baseHeight = Math.min(this.wallHeight - 6, WALL_BASE_HEIGHT_VISIBLE);
    const upperHeight = Math.max(8, Math.floor((this.wallHeight - baseHeight) * 0.58));
    const cutY = sy - baseHeight;
    const shimmer = (Math.sin(simTick * 0.18 + sx * 0.018 + sy * 0.011) + 1) * 0.5;
    const alpha = 0.16 + shimmer * 0.1;

    applyDitherToWallSection(
      this.ctx,
      sx,
      cutY,
      this.tileW,
      this.tileH,
      upperHeight,
      shimmer * 10,
      'source-over',
      `rgba(170, 186, 214, ${alpha.toFixed(3)})`
    );
  }

  private drawHeroSilhouette(player: Entity, state: GameState): void {
    const ctx = this.ctx;
    const iso = projectIso(
      player.x - state.level.width / 2,
      player.y - state.level.height / 2,
      player.z,
      this.tileW,
      this.tileH,
      this.zStep
    );
    const sx = this.cameraX + iso.sx;
    // Match grounding offset from entity rendering
    const groundOffset = 12;
    const sy = this.cameraY + iso.sy - this.effectYOffset + groundOffset;

    ctx.save();
    ctx.globalAlpha = 0.72;
    drawEntitySprite(ctx, player, sx, sy, state.simTick, this.entitySpriteScale, false);
    ctx.restore();
  }

  private drawProjectile(projectile: ProjectileState, state: GameState): void {
    const ctx = this.ctx;
    const iso = projectIso(
      projectile.x - state.level.width / 2,
      projectile.y - state.level.height / 2,
      projectile.z,
      this.tileW,
      this.tileH,
      this.zStep
    );

    const sx = this.cameraX + iso.sx;
    const sy = this.cameraY + iso.sy - this.effectYOffset;

    ctx.beginPath();
    ctx.arc(sx, sy, projectile.kind === 'guardian_shard' ? 4.2 : 3.2, 0, Math.PI * 2);
    ctx.fillStyle = projectile.kind === 'guardian_shard' ? 'rgba(206,120,255,0.95)' : 'rgba(132,244,154,0.95)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sx, sy, projectile.kind === 'guardian_shard' ? 7 : 6, 0, Math.PI * 2);
    ctx.strokeStyle = projectile.kind === 'guardian_shard' ? 'rgba(206,120,255,0.38)' : 'rgba(132,244,154,0.34)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawParticle(particle: ParticleState, state: GameState): void {
    const ctx = this.ctx;
    const alpha = clamp(particle.lifeMs / 420, 0, 1);

    const iso = projectIso(
      particle.x - state.level.width / 2,
      particle.y - state.level.height / 2,
      particle.z,
      this.tileW,
      this.tileH,
      this.zStep
    );
    const sx = this.cameraX + iso.sx;
    const sy = this.cameraY + iso.sy - Math.round(this.effectYOffset * 1.2);

    ctx.save();
    if (particle.text) {
      const [r, g, b] = unpack(particle.color);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(particle.text, sx, sy);
      ctx.restore();
      return;
    }

    const [r, g, b] = unpack(particle.color);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
    ctx.restore();
  }

  private drawScreenFlashes(state: GameState): void {
    const ctx = this.ctx;
    const { width, height } = this.canvas;

    if (state.screenFlash.damageMs > 0) {
      const a = clamp(state.screenFlash.damageMs / 180, 0, 1) * 0.22;
      ctx.fillStyle = `rgba(210, 38, 64, ${a.toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
    }

    if (state.screenFlash.healMs > 0) {
      const a = clamp(state.screenFlash.healMs / 180, 0, 1) * 0.16;
      ctx.fillStyle = `rgba(78, 210, 120, ${a.toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  render(state: GameState): void {
    const ctx = this.ctx;
    const { width, height } = this.canvas;

    // Calculate frame delta time
    const now = performance.now();
    const dt = this.lastFrameTime > 0 ? Math.min(0.1, (now - this.lastFrameTime) / 1000) : 0.016;
    this.lastFrameTime = now;
    this.currentDt = dt;

    this.ensureBuffers(state);

    const player = state.level.entities.get(state.playerId);
    const fallbackPlayerPos = { x: state.level.entry.x, y: state.level.entry.y };

    // Use visual position for camera following for smoother movement
    let followX = fallbackPlayerPos.x;
    let followY = fallbackPlayerPos.y;
    if (player) {
      const vpos = this.getEntityVisualPos(player, dt);
      followX = vpos.x;
      followY = vpos.y;
    }

    this.computeFogMask(state, player?.x ?? followX, player?.y ?? followY);

    // Update smooth visibility for gradual fog reveal
    this.updateSmoothVisibility(dt);

    const playerIso = projectIso(
      followX - state.level.width / 2,
      followY - state.level.height / 2,
      0,
      this.tileW,
      this.tileH,
      this.zStep
    );

    const desiredX = width * 0.5 - playerIso.sx;
    const desiredY = (height * 0.56) - playerIso.sy;
    const clamped = this.clampCamera(
      desiredX,
      desiredY,
      state.level.width,
      state.level.height,
      width,
      height
    );

    if (!this.cameraInitialized) {
      this.cameraX = clamped.x;
      this.cameraY = clamped.y;
      this.cameraInitialized = true;
    } else {
      this.cameraX += (clamped.x - this.cameraX) * 0.18;
      this.cameraY += (clamped.y - this.cameraY) * 0.18;
    }

    if (state.cameraShakeMs > 0) {
      const power = clamp(state.cameraShakeMs / 180, 0, 1) * 3;
      this.cameraX += Math.sin(state.simTick * 2.1) * power;
      this.cameraY += Math.cos(state.simTick * 2.6) * power;
    }

    const occlusion = computeOcclusionMask({
      width: state.level.width,
      height: state.level.height,
      heroX: followX,
      heroY: followY,
      passableMask: this.passableMask,
      cameraX: this.cameraX,
      cameraY: this.cameraY,
      tileW: this.tileW,
      tileH: this.tileH,
      zStep: this.zStep,
      wallHeight: this.wallHeight,
      output: state.level.occludableWalls,
    });
    if (this.occlusionMask.length !== occlusion.mask.length) {
      this.occlusionMask = new Uint8Array(occlusion.mask.length);
    }
    this.occlusionMask.set(occlusion.mask);
    state.level.occludableWalls = occlusion.mask;

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#091223');
    gradient.addColorStop(1, '#040811');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const frontWallDitherOverlays: Array<{ sx: number; sy: number }> = [];

    // Store feature map reference for popup check
    this.currentFeatureMap = state.level.featureMap;

    forEachIsoOrder(state.level.width, state.level.height, (x, y) => {
      const idx = index2D(state.level.width, x, y);
      const smoothVis = this.smoothVisibility[idx];
      if (smoothVis < 0.01) return; // Skip nearly invisible tiles

      // Apply fade alpha for partially visible tiles
      const fadeAlpha = Math.min(1, smoothVis);
      const needsAlpha = fadeAlpha < 0.99;
      if (needsAlpha) {
        ctx.save();
        ctx.globalAlpha = fadeAlpha;
      }

      const material = (getVoxel(state.level.grid, x, y, 0) & 0xffff) as keyof typeof MATERIALS;
      const visual = MATERIALS[material] ?? MATERIALS[1];
      const iso = projectIso(x - state.level.width / 2, y - state.level.height / 2, 0, this.tileW, this.tileH, this.zStep);
      const sx = this.cameraX + iso.sx;
      const sy = this.cameraY + iso.sy;

      const baseLight = state.level.baseLightMap[idx] ?? 1;
      const jitter = (hashNoise(x, y, state.level.seed) - 0.5) * (visual.blocks ? 0.08 : 0.14);
      const glow = this.tileGlow(state, x, y);
      const light = clamp(baseLight + jitter + glow, 0.18, 1.35);

      if (visual.blocks) {
        const top = this.lightColor(visual.colorTop, light + 0.05);
        const left = this.lightColor(visual.colorLeft, light * 0.92);
        const right = this.lightColor(visual.colorRight, light * 0.85);
        if (this.occlusionMask[idx] === 1) {
          this.drawOccludedWall(sx, sy, top, left, right, state.simTick);
          frontWallDitherOverlays.push({ sx, sy });
        } else {
          drawWallBlock(
            ctx,
            sx,
            sy,
            this.tileW,
            this.tileH,
            this.wallHeight,
            top,
            left,
            right
          );
        }
      } else {
        drawDiamond(ctx, sx, sy, this.tileW, this.tileH, this.lightColor(visual.colorFlat, light));

        if (material === 4 || material === 5 || material === 6) {
          const pulse = (Math.sin(state.simTick * 0.18 + x * 0.2 + y * 0.2) + 1) * 0.5;
          ctx.beginPath();
          ctx.arc(sx, sy - 3, material === 6 ? 6 + pulse * 2 : 4.5 + pulse * 1.4, 0, Math.PI * 2);
          ctx.fillStyle = material === 6
            ? 'rgba(233,92,255,0.95)'
            : material === 5
              ? 'rgba(99,218,242,0.9)'
              : 'rgba(247,206,92,0.9)';
          ctx.fill();
        }

        // Draw flat overlays immediately
        this.drawFeatureOverlay(state, x, y, idx, sx, sy, light);

        // Draw popup features immediately during iso traversal for proper occlusion
        if (this.hasPopupFeatures(idx)) {
          this.drawPopupFeature(state, x, y, idx, sx, sy, light);
        }
      }

      // Restore alpha if we changed it
      if (needsAlpha) {
        ctx.restore();
      }
    });

    const drawCommands: Array<{ key: number; draw: () => void }> = [];

    for (const entity of state.level.entities.values()) {
      if (!entity.alive) continue;
      const idx = index2D(state.level.width, entity.x, entity.y);
      if (this.visibilityMask[idx] === 0 && entity.kind !== 'player') continue;


      drawCommands.push({
        key: makeDrawKey(entity.x, entity.y, entity.z, 2),
        draw: () => this.drawEntity(entity, state),
      });
    }

    for (const projectile of state.projectiles) {
      if (!projectile.alive) continue;
      const px = Math.round(projectile.x);
      const py = Math.round(projectile.y);
      if (px < 0 || py < 0 || px >= state.level.width || py >= state.level.height) continue;
      if (this.visibilityMask[index2D(state.level.width, px, py)] === 0) continue;

      drawCommands.push({
        key: makeDrawKey(px, py, 1, 3),
        draw: () => this.drawProjectile(projectile, state),
      });
    }

    for (const particle of state.particles) {
      const px = Math.round(particle.x);
      const py = Math.round(particle.y);
      if (px < 0 || py < 0 || px >= state.level.width || py >= state.level.height) continue;
      if (this.visibilityMask[index2D(state.level.width, px, py)] === 0) continue;

      drawCommands.push({
        key: makeDrawKey(px, py, 2, 4),
        draw: () => this.drawParticle(particle, state),
      });
    }

    drawCommands.sort((a, b) => a.key - b.key);
    for (const command of drawCommands) {
      command.draw();
    }

    if (player && player.alive && occlusion.heroHeavilyOccluded) {
      this.drawHeroSilhouette(player, state);
    }

    for (const overlay of frontWallDitherOverlays) {
      this.drawOccludedWallFrontDither(overlay.sx, overlay.sy, state.simTick);
    }

    this.drawObjectiveIndicator(state);
    this.drawScreenFlashes(state);
    drawHud(ctx, state);
    if (state.phase === 'powerup_choice') {
      drawPowerUpMenu(ctx, state);
    }

    if (state.phase === 'game_over' || state.phase === 'victory') {
      this.drawEndScreen(state.phase);
    }

    // Draw hover tooltip
    this.drawHoverTooltip(state);
  }

  private getFeatureName(flags: number, interactables: LevelInteractable[]): string | null {
    // Check interactables first (more specific)
    for (const item of interactables) {
      if (item.type === 'crystal' && !item.used) return 'Cristal';
      if (item.type === 'terminal') return item.active ? 'Terminal (ativo)' : 'Terminal';
      if (item.type === 'gate') return item.open ? 'Portao (aberto)' : 'Portao (fechado)';
      if (item.type === 'one_way_portal') return 'Portal';
      if (item.type === 'spore_vent') return 'Respiradouro de Esporos';
    }

    // Check feature flags
    if ((flags & FEATURE_ROOT_BARRIER) !== 0) return 'Barreira de Raizes';
    if ((flags & FEATURE_PROP_FUNGAL_CLUSTER) !== 0) return 'Cogumelos';
    if ((flags & FEATURE_PROP_DEBRIS) !== 0) return 'Escombros';
    if ((flags & FEATURE_PROP_CRATE) !== 0) return 'Caixa';
    if ((flags & FEATURE_PROP_BEACON) !== 0) return 'Sinalizador';
    if ((flags & FEATURE_BIOFLUID) !== 0) return 'Biofluido';

    return null;
  }

  private drawHoverTooltip(state: GameState): void {
    if (this.mouseX < 0 || this.mouseY < 0) return;

    const tile = this.screenToTile(this.mouseX, this.mouseY, state.level.width, state.level.height);
    if (!tile) {
      this.hoveredTile = null;
      return;
    }

    this.hoveredTile = tile;
    const idx = index2D(state.level.width, tile.x, tile.y);

    // Check visibility
    if (this.visibilityMask[idx] === 0) return;

    const flags = state.level.featureMap[idx] ?? 0;
    const interactables = this.interactablesByCell.get(idx) ?? [];
    const name = this.getFeatureName(flags, interactables);

    if (!name) return;

    const ctx = this.ctx;
    ctx.save();

    // Tooltip styling
    ctx.font = '12px monospace';
    const textWidth = ctx.measureText(name).width;
    const padding = 6;
    const tooltipW = textWidth + padding * 2;
    const tooltipH = 20;

    // Position tooltip above mouse cursor
    let tx = this.mouseX - tooltipW / 2;
    let ty = this.mouseY - 28;

    // Clamp to canvas bounds
    tx = Math.max(4, Math.min(this.canvas.width - tooltipW - 4, tx));
    ty = Math.max(4, ty);

    // Draw tooltip background
    ctx.fillStyle = 'rgba(16, 22, 32, 0.92)';
    ctx.beginPath();
    ctx.roundRect(tx, ty, tooltipW, tooltipH, 3);
    ctx.fill();

    // Draw border
    ctx.strokeStyle = 'rgba(120, 140, 180, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw text
    ctx.fillStyle = '#e0e8f0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, tx + tooltipW / 2, ty + tooltipH / 2);

    ctx.restore();
  }

  private drawEndScreen(phase: 'game_over' | 'victory'): void {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    ctx.save();
    ctx.fillStyle = 'rgba(6, 8, 15, 0.8)';
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e5edff';
    ctx.font = 'bold 38px monospace';
    ctx.fillText(phase === 'victory' ? 'VITORIA!' : 'GAME OVER', width / 2, Math.floor(height * 0.45));
    ctx.font = '16px monospace';
    ctx.fillText('Recarregue a pagina para jogar novamente.', width / 2, Math.floor(height * 0.52));
    ctx.restore();
  }
}
