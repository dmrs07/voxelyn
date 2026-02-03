import type { EnemyArchetype, Entity, Vec2 } from '../game/types';

export type SpriteFrame = readonly string[];
export type SpritePalette = Record<string, string>;

const TRANSPARENT = '.';

const mirrorFrame = (frame: SpriteFrame): SpriteFrame =>
  frame.map((line) => line.split('').reverse().join(''));

const clampScale = (scale: number): number => Math.max(1, Math.floor(scale));

const BASE_IDLE_0: SpriteFrame = [
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '....obbbbbbo....',
  '....obhbbhbo....',
  '....obbeebbo....',
  '....obbbbbbo....',
  '....obbbbbbo....',
  '.....obbbbo.....',
  '.....ollllo.....',
  '.....ol..lo.....',
  '.....ol..lo.....',
  '.....o....o.....',
  '................',
  '................',
];

const BASE_IDLE_1: SpriteFrame = [
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '....obbbbbbo....',
  '....obhbbhbo....',
  '....obbeebbo....',
  '....obbbbbbo....',
  '.....obbbbo.....',
  '.....obbbbo.....',
  '.....ollllo.....',
  '.....ol..lo.....',
  '......o..o......',
  '......o..o......',
  '................',
  '................',
];

const BASE_WALK_0: SpriteFrame = [
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '....obbbbbbo....',
  '....obhbbhbo....',
  '....obbeebbo....',
  '....obbbbbbo....',
  '....obbbbbbo....',
  '.....obbbbo.....',
  '.....ollllo.....',
  '....ol....lo....',
  '...oo......oo...',
  '................',
  '................',
  '................',
];

const BASE_WALK_1: SpriteFrame = [
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '....obbbbbbo....',
  '....obhbbhbo....',
  '....obbeebbo....',
  '....obbbbbbo....',
  '....obbbbbbo....',
  '.....obbbbo.....',
  '.....ollllo.....',
  '....lo....ol....',
  '...oo......oo...',
  '................',
  '................',
  '................',
];

const BOMBER_IDLE_0: SpriteFrame = [
  '................',
  '................',
  '................',
  '......oooo......',
  '....oobbbbboo...',
  '...oobbhhbbboo..',
  '...oobbeebbboo..',
  '...oobbbbbbboo..',
  '...oobbbbbbboo..',
  '....oobbbbboo...',
  '.....oollloo....',
  '.....oollloo....',
  '......o..o......',
  '................',
  '................',
  '................',
];

const BOMBER_IDLE_1: SpriteFrame = [
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '....oobbbbboo...',
  '...oobbhhbbboo..',
  '...oobbeebbboo..',
  '...oobbbbbbboo..',
  '....oobbbbboo...',
  '.....obbbbbo....',
  '.....oollloo....',
  '......olllo.....',
  '......o..o......',
  '................',
  '................',
  '................',
];

const BOMBER_WALK_0: SpriteFrame = [
  '................',
  '................',
  '................',
  '......oooo......',
  '....oobbbbboo...',
  '...oobbhhbbboo..',
  '...oobbeebbboo..',
  '...oobbbbbbboo..',
  '...oobbbbbbboo..',
  '....oobbbbboo...',
  '.....oollloo....',
  '....oo....oo....',
  '...oo......oo...',
  '................',
  '................',
  '................',
];

const BOMBER_WALK_1: SpriteFrame = [
  '................',
  '................',
  '................',
  '......oooo......',
  '....oobbbbboo...',
  '...oobbhhbbboo..',
  '...oobbeebbboo..',
  '...oobbbbbbboo..',
  '...oobbbbbbboo..',
  '....oobbbbboo...',
  '.....oollloo....',
  '....oo....oo....',
  '.....oo..oo.....',
  '................',
  '................',
  '................',
];

const PLAYER_PALETTE: SpritePalette = {
  [TRANSPARENT]: 'rgba(0,0,0,0)',
  o: '#182135',
  b: '#5edcf8',
  h: '#9befff',
  e: '#eaffff',
  l: '#8af06f',
};

const ENEMY_PALETTES: Record<EnemyArchetype, SpritePalette> = {
  stalker: {
    [TRANSPARENT]: 'rgba(0,0,0,0)',
    o: '#2a1320',
    b: '#e2799a',
    h: '#f4a6be',
    e: '#ffe8f1',
    l: '#d45e85',
  },
  bruiser: {
    [TRANSPARENT]: 'rgba(0,0,0,0)',
    o: '#2a1913',
    b: '#cf6b56',
    h: '#e89674',
    e: '#ffe8dd',
    l: '#b94c3b',
  },
  spitter: {
    [TRANSPARENT]: 'rgba(0,0,0,0)',
    o: '#2a2213',
    b: '#e7af59',
    h: '#ffd88c',
    e: '#fff6df',
    l: '#c48b39',
  },
  guardian: {
    [TRANSPARENT]: 'rgba(0,0,0,0)',
    o: '#20132f',
    b: '#bd72ff',
    h: '#ddadff',
    e: '#f7e9ff',
    l: '#9f53ea',
  },
  spore_bomber: {
    [TRANSPARENT]: 'rgba(0,0,0,0)',
    o: '#162a1b',
    b: '#76dd8a',
    h: '#a8f3b3',
    e: '#eaffef',
    l: '#49b95e',
  },
};

const SPRITE_SETS: Record<EnemyArchetype | 'player', { idle: SpriteFrame[]; walk: SpriteFrame[] }> = {
  player: { idle: [BASE_IDLE_0, BASE_IDLE_1], walk: [BASE_WALK_0, BASE_WALK_1] },
  stalker: { idle: [BASE_IDLE_0, BASE_IDLE_1], walk: [BASE_WALK_0, BASE_WALK_1] },
  bruiser: { idle: [BASE_IDLE_0, BASE_IDLE_1], walk: [BASE_WALK_0, BASE_WALK_1] },
  spitter: { idle: [BASE_IDLE_0, BASE_IDLE_1], walk: [BASE_WALK_0, BASE_WALK_1] },
  guardian: { idle: [BASE_IDLE_1, BASE_IDLE_0], walk: [BASE_WALK_1, BASE_WALK_0] },
  spore_bomber: { idle: [BOMBER_IDLE_0, BOMBER_IDLE_1], walk: [BOMBER_WALK_0, BOMBER_WALK_1] },
};

const cache = new Map<string, HTMLCanvasElement>();

const frameToCanvas = (frame: SpriteFrame, palette: SpritePalette, scale: number, mirrored: boolean): HTMLCanvasElement => {
  const safeScale = clampScale(scale);
  const key = `${frame.join('|')}::${Object.entries(palette).map(([k, v]) => `${k}:${v}`).join(',')}::${safeScale}::${mirrored ? 1 : 0}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const width = frame[0]?.length ?? 16;
  const height = frame.length;
  const canvas = document.createElement('canvas');
  canvas.width = width * safeScale;
  canvas.height = height * safeScale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const source = mirrored ? mirrorFrame(frame) : frame;
  for (let y = 0; y < source.length; y += 1) {
    const row = source[y] ?? '';
    for (let x = 0; x < row.length; x += 1) {
      const token = row[x] ?? TRANSPARENT;
      if (token === TRANSPARENT) continue;
      const color = palette[token];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * safeScale, y * safeScale, safeScale, safeScale);
    }
  }

  cache.set(key, canvas);
  return canvas;
};

const framePairIndex = (simTick: number, speedDiv: number): 0 | 1 => {
  const idx = Math.floor(simTick / speedDiv) & 1;
  return idx === 0 ? 0 : 1;
};

const isMoving = (entity: Entity): boolean => (entity.animPhase & 1) === 1;

export const directionFromFacing = (facing: Vec2): 'left' | 'right' => {
  if (Math.abs(facing.x) >= Math.abs(facing.y)) {
    return facing.x < 0 ? 'left' : 'right';
  }
  return facing.y < 0 ? 'left' : 'right';
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
  const setKey = entity.kind === 'player' ? 'player' : entity.archetype;
  const set = SPRITE_SETS[setKey];
  const palette = entity.kind === 'player' ? PLAYER_PALETTE : ENEMY_PALETTES[entity.archetype];

  const index = framePairIndex(simTick + entity.animPhase * 3, 6);
  const frame = (isMoving(entity) ? set.walk : set.idle)[index] ?? set.idle[0]!;
  const mirrored = directionFromFacing(entity.facing) === 'left';

  if (typeof document !== 'undefined') {
    const image = frameToCanvas(frame, palette, scale, mirrored);
    ctx.save();
    if (flash) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - image.width / 2 - 2, sy - image.height + 1, image.width + 4, image.height + 2);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(image, Math.floor(sx - image.width / 2), Math.floor(sy - image.height));
    ctx.restore();
    return;
  }

  const src = mirrored ? mirrorFrame(frame) : frame;
  const safeScale = clampScale(scale);
  for (let y = 0; y < src.length; y += 1) {
    const row = src[y] ?? '';
    for (let x = 0; x < row.length; x += 1) {
      const token = row[x] ?? TRANSPARENT;
      if (token === TRANSPARENT) continue;
      const color = palette[token];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.floor(sx - (row.length * safeScale) / 2 + x * safeScale),
        Math.floor(sy - src.length * safeScale + y * safeScale),
        safeScale,
        safeScale
      );
    }
  }
};
