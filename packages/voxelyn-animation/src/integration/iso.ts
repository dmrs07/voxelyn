import {
  blitColorkey,
  makeDrawKey,
  projectIso,
  type Surface2D,
} from '@voxelyn/core';
import type {
  AnimatedDrawOptions,
  AnimatedDrawResult,
  AnimatedDrawTarget,
  IsoCamera,
  IsoDrawConfig,
  PixelSprite,
} from '../types.js';

type StageCanvas = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  imageData: ImageData;
  bytes: Uint8ClampedArray;
};

const STAGE_BY_SIZE = new Map<string, StageCanvas>();

const isSurfaceTarget = (target: AnimatedDrawTarget): target is Surface2D =>
  typeof (target as Surface2D).width === 'number' &&
  typeof (target as Surface2D).height === 'number' &&
  !!(target as Surface2D).pixels;

const getStage = (width: number, height: number): StageCanvas => {
  const key = `${width}x${height}`;
  const cached = STAGE_BY_SIZE.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Nao foi possivel criar contexto para stage canvas');
  }
  const imageData = ctx.createImageData(width, height);
  const stage: StageCanvas = {
    canvas,
    ctx,
    imageData,
    bytes: imageData.data,
  };
  STAGE_BY_SIZE.set(key, stage);
  return stage;
};

const drawToCanvas = (
  ctx: CanvasRenderingContext2D,
  sprite: PixelSprite,
  dx: number,
  dy: number,
  options: AnimatedDrawOptions
): void => {
  const stage = getStage(sprite.width, sprite.height);
  stage.bytes.set(new Uint8ClampedArray(sprite.pixels.buffer));
  stage.ctx.putImageData(stage.imageData, 0, 0);

  const scale = Math.max(1, Math.floor(options.scale ?? 1));
  const anchorX = options.anchorX ?? 0.5;
  const anchorY = options.anchorY ?? 1;
  const w = sprite.width * scale;
  const h = sprite.height * scale;
  const px = Math.floor(dx - w * anchorX);
  const py = Math.floor(dy - h * anchorY);

  ctx.save();
  if (typeof options.alpha === 'number') {
    ctx.globalAlpha = Math.max(0, Math.min(1, options.alpha));
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(stage.canvas, px, py, w, h);
  ctx.restore();
};

const drawToSurface = (
  surface: Surface2D,
  sprite: PixelSprite,
  dx: number,
  dy: number,
  options: AnimatedDrawOptions
): void => {
  const anchorX = options.anchorX ?? 0.5;
  const anchorY = options.anchorY ?? 1;
  const px = Math.floor(dx - sprite.width * anchorX);
  const py = Math.floor(dy - sprite.height * anchorY);

  blitColorkey(surface, sprite, px, py, {
    colorkey: options.colorkey ?? 0,
  });
};

export const drawAnimatedIso = (
  target: AnimatedDrawTarget,
  frame: PixelSprite,
  worldPos: { x: number; y: number; z: number },
  isoConfig: IsoDrawConfig,
  camera: IsoCamera,
  options: AnimatedDrawOptions = {}
): AnimatedDrawResult => {
  const iso = projectIso(worldPos.x, worldPos.y, worldPos.z, isoConfig.tileW, isoConfig.tileH, isoConfig.zStep);
  const sx = Math.floor((camera.originX ?? 0) + camera.x + iso.sx);
  const sy = Math.floor((camera.originY ?? 0) + camera.y + iso.sy);

  if (isSurfaceTarget(target)) {
    drawToSurface(target, frame, sx, sy, options);
  } else {
    drawToCanvas(target, frame, sx, sy, options);
  }

  return { sx, sy };
};

export const makeAnimatedDrawKey = (x: number, y: number, z: number, layer: number): number =>
  makeDrawKey(x, y, z, layer);
