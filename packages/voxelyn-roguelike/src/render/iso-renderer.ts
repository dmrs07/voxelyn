import { forEachIsoOrder, getVoxel, projectIso } from '@voxelyn/core';
import type { Entity, GameState } from '../game/types';
import { MATERIALS, isPassableMaterial } from '../world/materials';
import { drawHud } from '../ui/hud';
import { drawPowerUpMenu } from '../ui/powerup-menu';
import { ENEMY_COLORS } from './sprites';

const colorCache = new Map<number, string>();
const CARDINAL_DIRS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const WALL_REVEAL_DIRS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const index2D = (width: number, x: number, y: number): number => y * width + x;

const toCss = (color: number): string => {
  const cached = colorCache.get(color);
  if (cached) return cached;
  const r = color & 0xff;
  const g = (color >> 8) & 0xff;
  const b = (color >> 16) & 0xff;
  const a = ((color >> 24) & 0xff) / 255;
  const css = `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
  colorCache.set(color, css);
  return css;
};

const drawDiamond = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileW: number,
  tileH: number,
  color: number
): void => {
  ctx.beginPath();
  ctx.moveTo(x, y - tileH / 2);
  ctx.lineTo(x + tileW / 2, y);
  ctx.lineTo(x, y + tileH / 2);
  ctx.lineTo(x - tileW / 2, y);
  ctx.closePath();
  ctx.fillStyle = toCss(color);
  ctx.fill();
};

const drawWallBlock = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileW: number,
  tileH: number,
  blockHeight: number,
  topColor: number,
  leftColor: number,
  rightColor: number
): void => {
  ctx.beginPath();
  ctx.moveTo(x - tileW / 2, y);
  ctx.lineTo(x, y + tileH / 2);
  ctx.lineTo(x, y + tileH / 2 - blockHeight);
  ctx.lineTo(x - tileW / 2, y - blockHeight);
  ctx.closePath();
  ctx.fillStyle = toCss(leftColor);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + tileW / 2, y);
  ctx.lineTo(x, y + tileH / 2);
  ctx.lineTo(x, y + tileH / 2 - blockHeight);
  ctx.lineTo(x + tileW / 2, y - blockHeight);
  ctx.closePath();
  ctx.fillStyle = toCss(rightColor);
  ctx.fill();

  drawDiamond(ctx, x, y - blockHeight, tileW, tileH, topColor);
};

const drawEntity = (
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  tileW: number,
  tileH: number,
  originX: number,
  originY: number,
  mapW: number,
  mapH: number
): void => {
  const iso = projectIso(entity.x - mapW / 2, entity.y - mapH / 2, 0, tileW, tileH, 10);
  const sx = originX + iso.sx;
  const sy = originY + iso.sy - 18;

  const color = entity.kind === 'player' ? 'rgba(94,220,248,1)' : toCss(ENEMY_COLORS[entity.archetype]);

  ctx.beginPath();
  ctx.arc(sx, sy, entity.kind === 'player' ? 7 : 6, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  const hpRatio = Math.max(0, Math.min(1, entity.hp / Math.max(1, entity.maxHp)));
  ctx.fillStyle = 'rgba(30,35,46,0.95)';
  ctx.fillRect(sx - 10, sy - 12, 20, 3);
  ctx.fillStyle = entity.kind === 'player' ? 'rgba(110,226,138,1)' : 'rgba(240,116,116,1)';
  ctx.fillRect(sx - 10, sy - 12, Math.floor(20 * hpRatio), 3);
};

export class IsoRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tileW = 48;
  private readonly tileH = 24;
  private readonly zStep = 20;
  private readonly wallHeight = 56;
  private readonly hudHeight = 72;
  private cameraX = 0;
  private cameraY = 0;
  private cameraInitialized = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Nao foi possivel inicializar CanvasRenderingContext2D');
    }
    this.ctx = ctx;
  }

  private computeVisibilityMask(state: GameState, focusX: number, focusY: number): Uint8Array {
    const width = state.level.width;
    const height = state.level.height;
    const size = width * height;
    const passableMask = new Uint8Array(size);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = index2D(width, x, y);
        passableMask[idx] = isPassableMaterial(getVoxel(state.level.grid, x, y, 0)) ? 1 : 0;
      }
    }

    const visibility = new Uint8Array(size);
    if (focusX < 0 || focusY < 0 || focusX >= width || focusY >= height) {
      return visibility;
    }

    const startIdx = index2D(width, focusX, focusY);
    if (passableMask[startIdx] === 0) {
      visibility[startIdx] = 1;
      return visibility;
    }

    const degree = new Uint8Array(size);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = index2D(width, x, y);
        if (passableMask[idx] === 0) continue;
        let count = 0;
        for (const [dx, dy] of CARDINAL_DIRS) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (passableMask[index2D(width, nx, ny)] === 1) count += 1;
        }
        degree[idx] = count;
      }
    }

    const visiblePassable = new Uint8Array(size);
    if ((degree[startIdx] ?? 0) >= 3) {
      visiblePassable[startIdx] = 1;
      for (const [dx, dy] of CARDINAL_DIRS) {
        const nx = focusX + dx;
        const ny = focusY + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const neighborIdx = index2D(width, nx, ny);
        if (passableMask[neighborIdx] === 1) {
          visiblePassable[neighborIdx] = 1;
        }
      }
    } else {
      const queue = new Int32Array(size);
      let qh = 0;
      let qt = 0;
      queue[qt] = startIdx;
      qt += 1;
      visiblePassable[startIdx] = 1;

      while (qh < qt) {
        const idx = queue[qh] ?? startIdx;
        qh += 1;
        const cx = idx % width;
        const cy = Math.floor(idx / width);

        for (const [dx, dy] of CARDINAL_DIRS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

          const nextIdx = index2D(width, nx, ny);
          if (passableMask[nextIdx] === 0 || visiblePassable[nextIdx] === 1) continue;

          visiblePassable[nextIdx] = 1;
          if ((degree[nextIdx] ?? 0) <= 2) {
            queue[qt] = nextIdx;
            qt += 1;
          }
        }
      }
    }

    for (let i = 0; i < size; i += 1) {
      if (visiblePassable[i] === 1) {
        visibility[i] = 1;
      }
    }

    for (let i = 0; i < size; i += 1) {
      if (visiblePassable[i] === 0) continue;
      const x = i % width;
      const y = Math.floor(i / width);

      for (const [dx, dy] of WALL_REVEAL_DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const neighborIdx = index2D(width, nx, ny);
        if (passableMask[neighborIdx] === 0) {
          visibility[neighborIdx] = 1;
        }
      }
    }

    return visibility;
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

    const marginX = 24;
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

  render(state: GameState): void {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    const player = state.level.entities.get(state.playerId);
    const fallbackPlayerPos = { x: state.level.entry.x, y: state.level.entry.y };
    const followX = player?.x ?? fallbackPlayerPos.x;
    const followY = player?.y ?? fallbackPlayerPos.y;
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

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0b1322');
    gradient.addColorStop(1, '#050911');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const visibility = this.computeVisibilityMask(state, followX, followY);

    forEachIsoOrder(state.level.width, state.level.height, (x, y) => {
      const idx = index2D(state.level.width, x, y);
      if (visibility[idx] === 0) return;

      const material = (getVoxel(state.level.grid, x, y, 0) & 0xffff) as keyof typeof MATERIALS;
      const visual = MATERIALS[material] ?? MATERIALS[1];
      const iso = projectIso(x - state.level.width / 2, y - state.level.height / 2, 0, this.tileW, this.tileH, this.zStep);
      const sx = this.cameraX + iso.sx;
      const sy = this.cameraY + iso.sy;

      if (visual.blocks) {
        drawWallBlock(
          ctx,
          sx,
          sy,
          this.tileW,
          this.tileH,
          this.wallHeight,
          visual.colorTop,
          visual.colorLeft,
          visual.colorRight
        );
      } else {
        drawDiamond(ctx, sx, sy, this.tileW, this.tileH, visual.colorFlat);

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

    const entities = Array.from(state.level.entities.values())
      .filter((entity) => entity.alive)
      .sort((a, b) => (a.x + a.y) - (b.x + b.y));

    for (const entity of entities) {
      const entityIdx = index2D(state.level.width, entity.x, entity.y);
      if (entity.kind !== 'player' && visibility[entityIdx] === 0) {
        continue;
      }

      drawEntity(
        ctx,
        entity,
        this.tileW,
        this.tileH,
        this.cameraX,
        this.cameraY,
        state.level.width,
        state.level.height
      );
    }

    this.drawObjectiveIndicator(state);
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
