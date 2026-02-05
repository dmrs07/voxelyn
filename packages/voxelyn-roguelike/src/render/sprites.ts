import {
  createAnimationPlayer,
  createProceduralCharacter,
  stepAnimation,
  type AnimationFacing,
  type AnimationPlayer,
  type PixelSprite,
  type ProceduralCharacter,
} from '@voxelyn/animation';
import type { EnemyArchetype, Entity, Vec2 } from '../game/types';

export type { PixelSprite };

const clampScale = (scale: number): number => Math.max(1, Math.floor(scale));

const facingFromVec = (facing: Vec2): AnimationFacing => {
  if (facing.x >= 0 && facing.y >= 0) return 'dr';
  if (facing.x < 0 && facing.y >= 0) return 'dl';
  if (facing.x >= 0 && facing.y < 0) return 'ur';
  return 'ul';
};

type RuntimeEntry = {
  character: ProceduralCharacter;
  player: AnimationPlayer;
  lastSimTick: number;
};

const runtimeByEntity = new Map<string, RuntimeEntry>();

type StageCanvas = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  imageData: ImageData;
  bytes: Uint8ClampedArray;
};

const stageBySize = new Map<string, StageCanvas>();

const stageFor = (width: number, height: number): StageCanvas => {
  const key = `${width}x${height}`;
  const cached = stageBySize.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Falha ao criar contexto para stage de sprite');
  }
  const imageData = ctx.createImageData(width, height);
  const stage: StageCanvas = {
    canvas,
    ctx,
    imageData,
    bytes: imageData.data,
  };
  stageBySize.set(key, stage);
  return stage;
};

const styleFromEntity = (entity: Entity): ProceduralCharacter['style'] => {
  if (entity.kind === 'player') return 'player';

  const byArchetype: Record<EnemyArchetype, ProceduralCharacter['style']> = {
    stalker: 'stalker',
    bruiser: 'bruiser',
    spitter: 'spitter',
    guardian: 'guardian',
    spore_bomber: 'spore_bomber',
  };
  return byArchetype[entity.archetype] ?? 'stalker';
};

const ensureRuntime = (entity: Entity): RuntimeEntry => {
  const existing = runtimeByEntity.get(entity.id);
  if (existing) return existing;

  const character = createProceduralCharacter({
    id: entity.id,
    style: styleFromEntity(entity),
    seed: entity.occ * 7919,
  });
  const player = createAnimationPlayer({
    set: character.clips,
    width: character.width,
    height: character.height,
    seed: entity.occ * 104729,
  });

  const created: RuntimeEntry = {
    character,
    player,
    lastSimTick: -1,
  };
  runtimeByEntity.set(entity.id, created);
  return created;
};

const frameForEntity = (entity: Entity, simTick: number): PixelSprite => {
  const runtime = ensureRuntime(entity);
  const stepTicks = runtime.lastSimTick < 0 ? 1 : Math.max(0, simTick - runtime.lastSimTick);
  runtime.lastSimTick = simTick;

  const dtMs = Math.max(1, stepTicks * 50 * Math.max(0.35, entity.animSpeedMul || 1));
  const facing = entity.animFacing ?? facingFromVec(entity.facing);
  const intent = entity.animIntent ?? 'idle';

  const ref = stepAnimation(runtime.player, dtMs, intent, facing);
  return ref.sprite;
};

const drawSpriteFallback = (
  ctx: CanvasRenderingContext2D,
  sprite: PixelSprite,
  sx: number,
  sy: number,
  scale: number
): void => {
  const safeScale = clampScale(scale);
  const px = Math.floor(sx - (sprite.width * safeScale) / 2);
  const py = Math.floor(sy - sprite.height * safeScale);

  for (let y = 0; y < sprite.height; y += 1) {
    for (let x = 0; x < sprite.width; x += 1) {
      const packed = sprite.pixels[y * sprite.width + x] ?? 0;
      const a = (packed >>> 24) & 0xff;
      if (a === 0) continue;
      const r = packed & 0xff;
      const g = (packed >>> 8) & 0xff;
      const b = (packed >>> 16) & 0xff;
      ctx.fillStyle = `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
      ctx.fillRect(px + x * safeScale, py + y * safeScale, safeScale, safeScale);
    }
  }
};

export const drawEntitySprite = (
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  sx: number,
  sy: number,
  simTick: number,
  scale = 2,
  flash = false
): void => {
  const sprite = frameForEntity(entity, simTick);
  const safeScale = clampScale(scale);

  if (typeof document === 'undefined') {
    drawSpriteFallback(ctx, sprite, sx, sy, safeScale);
    return;
  }

  const stage = stageFor(sprite.width, sprite.height);
  stage.bytes.set(new Uint8ClampedArray(sprite.pixels.buffer));
  stage.ctx.putImageData(stage.imageData, 0, 0);

  const drawX = Math.floor(sx - (sprite.width * safeScale) / 2);
  const drawY = Math.floor(sy - sprite.height * safeScale);
  const drawW = sprite.width * safeScale;
  const drawH = sprite.height * safeScale;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(stage.canvas, drawX, drawY, drawW, drawH);
  if (flash) {
    // Flash overlay sem quadrado: reaplica sprite com blend aditivo.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.28;
    ctx.drawImage(stage.canvas, drawX, drawY, drawW, drawH);
  }
  ctx.restore();
};

/**
 * Draws a billboard sprite with isometric tilt and drop shadow.
 * Used for features that need 3D "pop-up" presence.
 */
export const drawBillboardSprite = (
  ctx: CanvasRenderingContext2D,
  sprite: PixelSprite,
  sx: number,
  sy: number,
  scale: number,
  options: {
    tiltX?: number;
    shadowAlpha?: number;
    shadowScale?: number;
    alpha?: number;
  } = {}
): void => {
  const { tiltX = -0.25, shadowAlpha = 0.2, shadowScale = 0.35, alpha = 1 } = options;
  const safeScale = clampScale(scale);

  const stage = stageFor(sprite.width, sprite.height);
  stage.bytes.set(new Uint8ClampedArray(sprite.pixels.buffer));
  stage.ctx.putImageData(stage.imageData, 0, 0);

  const w = sprite.width * safeScale;
  const h = sprite.height * safeScale;

  // 1. Ground shadow ellipse (isometric ratio ~2.2:1)
  if (shadowAlpha > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2, w * shadowScale, w * shadowScale * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. Draw tilted sprite (shear transform for billboard effect)
  ctx.save();
  ctx.translate(sx, sy);
  ctx.transform(1, 0, tiltX, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(stage.canvas, Math.floor(-w / 2), Math.floor(-h), w, h);
  ctx.restore();
};