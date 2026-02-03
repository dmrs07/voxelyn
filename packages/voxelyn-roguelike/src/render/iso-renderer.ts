import { forEachIsoOrder, getVoxel, makeDrawKey, projectIso } from '@voxelyn/core';
import { FOG_BASE_RANGE } from '../game/constants';
import type { Entity, GameState, ParticleState, ProjectileState } from '../game/types';
import { drawHud } from '../ui/hud';
import { drawPowerUpMenu } from '../ui/powerup-menu';
import { computeFogVisibility, type FogLightSource } from './fog';
import { drawEntitySprite } from './sprites';
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

export class IsoRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tileW = 48;
  private readonly tileH = 24;
  private readonly zStep = 20;
  private readonly wallHeight = 56;
  private readonly hudHeight = 80;
  private cameraX = 0;
  private cameraY = 0;
  private cameraInitialized = false;
  private passableMask = new Uint8Array(0);
  private visibilityMask = new Uint8Array(0);
  private cachedLevelSeed = -1;
  private colorLightCache = new Map<string, string>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Nao foi possivel inicializar CanvasRenderingContext2D');
    }
    this.ctx = ctx;
  }

  private ensureBuffers(state: GameState): void {
    const size = state.level.width * state.level.height;
    if (this.passableMask.length !== size) {
      this.passableMask = new Uint8Array(size);
      this.visibilityMask = new Uint8Array(size);
      this.cachedLevelSeed = -1;
    }

    if (this.cachedLevelSeed === state.level.seed) return;

    for (let y = 0; y < state.level.height; y += 1) {
      for (let x = 0; x < state.level.width; x += 1) {
        const i = index2D(state.level.width, x, y);
        this.passableMask[i] = state.level.heightMap[i] < 0.5 ? 1 : 0;
      }
    }

    this.cachedLevelSeed = state.level.seed;
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
    const iso = projectIso(
      entity.x - state.level.width / 2,
      entity.y - state.level.height / 2,
      entity.z,
      this.tileW,
      this.tileH,
      this.zStep
    );

    const bob = Math.sin((state.simTick + entity.animPhase * 2) * 0.25) * (entity.kind === 'player' ? 1.6 : 1.2);
    const sx = this.cameraX + iso.sx;
    const sy = this.cameraY + iso.sy - 8 + bob;
    const flash = entity.hitFlashUntilMs > state.simTimeMs;
    drawEntitySprite(ctx, entity, sx, sy, state.simTick, 2, flash);

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
    const sy = this.cameraY + iso.sy - 10;

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
    const sy = this.cameraY + iso.sy - 12;

    if (particle.text) {
      const [r, g, b] = unpack(particle.color);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(particle.text, sx, sy);
      return;
    }

    const [r, g, b] = unpack(particle.color);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
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

    this.ensureBuffers(state);

    const player = state.level.entities.get(state.playerId);
    const fallbackPlayerPos = { x: state.level.entry.x, y: state.level.entry.y };
    const followX = player?.x ?? fallbackPlayerPos.x;
    const followY = player?.y ?? fallbackPlayerPos.y;

    this.computeFogMask(state, followX, followY);

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

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#091223');
    gradient.addColorStop(1, '#040811');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    forEachIsoOrder(state.level.width, state.level.height, (x, y) => {
      const idx = index2D(state.level.width, x, y);
      if (this.visibilityMask[idx] === 0) return;

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
        drawWallBlock(
          ctx,
          sx,
          sy,
          this.tileW,
          this.tileH,
          this.wallHeight,
          this.lightColor(visual.colorTop, light + 0.05),
          this.lightColor(visual.colorLeft, light * 0.92),
          this.lightColor(visual.colorRight, light * 0.85)
        );
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

    this.drawObjectiveIndicator(state);
    this.drawScreenFlashes(state);
    drawHud(ctx, state);
    if (state.phase === 'powerup_choice') {
      drawPowerUpMenu(ctx, state);
    }

    if (state.phase === 'game_over' || state.phase === 'victory') {
      this.drawEndScreen(state.phase);
    }
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
