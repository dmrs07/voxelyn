// Runtime contract for generated Voxelyn Survival sprite manifests.
export type SpriteAnimationDefinition = {
  frames: number;
  fps: number;
  loop: boolean;
};

export type SpriteFootprint = {
  /** Occupied width and height in logical isometric tiles. */
  w: number;
  h: number;
  /** Offset, in logical tiles, from the visual anchor to footprint center. */
  offsetX: number;
  offsetY: number;
};

export type SpriteManifestEntry = {
  id: string;
  version: number;
  atlas: string;
  frameWidth: number;
  frameHeight: number;
  anchorX: number;
  anchorY: number;
  directions: number;
  authoredDirs: string[];
  flipPairs: Record<string, string>;
  hitbox: { w: number; h: number };
  footprint: SpriteFootprint;
  palette: string;
  paletteColors: string[];
  animations: Record<string, SpriteAnimationDefinition>;
  /** dir -> anim -> starting column in the stable, single-row atlas. */
  frameMap: Record<string, Record<string, number>>;
  generation?: { tool: string; prompt: string; seedOrRef?: string };
};

export type FrameRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  flip: boolean;
};

/** Map a world-space facing vector to one of the four authored isometric facings. */
export const dirFromFacing = (fx: number, fy: number): string => {
  const sdx = fx - fy;
  const sdy = fx + fy;
  const angle = Math.atan2(sdy, sdx);
  if (angle >= 0 && angle < Math.PI / 2) return 'dr';
  if (angle >= Math.PI / 2) return 'dl';
  if (angle < -Math.PI / 2) return 'ul';
  return 'ur';
};

export const resolveFrame = (
  manifest: SpriteManifestEntry,
  animation: string,
  direction: string,
  frame: number
): FrameRect => {
  const useAnim = manifest.animations[animation] ? animation : Object.keys(manifest.animations)[0];
  const flip = Boolean(manifest.flipPairs[direction]);
  const sourceDirection = flip ? manifest.flipPairs[direction] : direction;
  const dirMap = manifest.frameMap[sourceDirection] ?? manifest.frameMap[manifest.authoredDirs[0]];
  const start = dirMap[useAnim] ?? dirMap[Object.keys(dirMap)[0]] ?? 0;
  const count = manifest.animations[useAnim]?.frames ?? 1;
  const normalized = ((frame % count) + count) % count;
  return {
    sx: (start + normalized) * manifest.frameWidth,
    sy: 0,
    sw: manifest.frameWidth,
    sh: manifest.frameHeight,
    flip,
  };
};

export const frameAtTime = (
  manifest: SpriteManifestEntry,
  animation: string,
  elapsedMs: number
): number => {
  const def = manifest.animations[animation] ?? manifest.animations[Object.keys(manifest.animations)[0]];
  const index = Math.floor((Math.max(0, elapsedMs) / 1000) * def.fps);
  return def.loop ? index % def.frames : Math.min(index, def.frames - 1);
};

export const CHARACTER_SPRITE_IDS = [
  'player-prospector',
  'enemy-stalker',
  'enemy-spitter',
  'enemy-spore-bomber',
  'enemy-bruiser',
  'enemy-guardian',
] as const;

export const FIRST_PACK_IDS = [
  ...CHARACTER_SPRITE_IDS,
  'fx-projectile-bolt',
  'fx-impact-burst',
] as const;
